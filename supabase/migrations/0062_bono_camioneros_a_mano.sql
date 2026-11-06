-- ============================================================
-- 0062 · Bono camioneros a mano (pedido del mercado, 06/11/2026)
--
-- «En las cajas de ayer no les cerraba: en el bono de los camioneros tenemos un monto por cada
-- tipo de camión. Necesitamos poner un número manual de cuánto se cobró y chau. No por
-- balancín, no por camión.»
-- registrar_canon acepta p_monto (lo que se cobró): queda una entrada «Bono camioneros» por ese
-- monto (cantidad 1, sin tarifa). La forma con tarifa × cantidad sigue andando para lo viejo.
-- Cambia la firma (un parámetro más al final, con default; p_tarifa pasa a tener default).
-- ============================================================

drop function if exists public.registrar_canon(uuid, integer, public.medio_pago, text, text, text, text, uuid, date);

CREATE FUNCTION public.registrar_canon(p_tarifa uuid DEFAULT NULL::uuid, p_cantidad integer DEFAULT 1, p_medio medio_pago DEFAULT 'efectivo'::medio_pago, p_patente text DEFAULT NULL::text, p_destino text DEFAULT NULL::text, p_destino_detalle text DEFAULT NULL::text, p_notas text DEFAULT NULL::text, p_ref uuid DEFAULT NULL::uuid, p_fecha date DEFAULT NULL::date, p_monto numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
  v_fecha date := coalesce(p_fecha, v_hoy);
  v_uid uuid := (select auth.uid());
  v_tarifa public.tarifas_transporte;
  v_prev public.canon_camiones;
  v_nuevo public.canon_camiones;
  v_caja_id uuid;
  v_caja_estado public.estado_caja;
  v_patente text;
  v_destino text := nullif(lower(trim(coalesce(p_destino, ''))), '');
  v_detalle text := nullif(trim(coalesce(p_destino_detalle, '')), '');
  v_num text;
  v_medio boolean := false;
  v_espacios uuid[];
  v_espacio uuid;
  v_notas text := nullif(trim(coalesce(p_notas, '')), '');
  v_monto numeric;
  -- 0062: el bono camioneros se escribe a mano (cuánto se cobró), sin tarifa ni cantidad.
  v_manual boolean := p_monto is not null;
  -- 0052: Administración también cobra el bono camioneros, en SU caja.
  v_tipo public.tipo_caja := case when private.rol_actual() = 'admin'
    then 'administracion'::public.tipo_caja else 'guardia'::public.tipo_caja end;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  -- Portería cobra el canon; el Líder también (§1.3 D-P2). 0052: y Administración (en la caja
  -- de administración). El Jefe y Tesorería no.
  if v_rol is null or v_rol not in ('porteria', 'lider', 'admin') then
    raise exception 'El canon de transporte lo cobran Portería y Administración';
  end if;
  -- 0048: canon de un día anterior (carga atrasada): solo el Líder, en la caja de ese día.
  if v_fecha > v_hoy then
    raise exception 'Ese día todavía no llegó';
  end if;
  if v_fecha < v_hoy and v_rol not in ('lider', 'admin') then
    raise exception 'El canon de un día anterior lo carga el Líder de Procesos';
  end if;

  -- (a) Idempotencia (§4.0-5): doble toque o reintento sin red = un solo cobro.
  if p_ref is not null then
    perform pg_advisory_xact_lock(hashtextextended('registrar_canon:' || p_ref::text, 0));
    select * into v_prev from public.canon_camiones where org_id = v_org and ref = p_ref;
    if found then
      if (not v_manual and (v_prev.tarifa_id is distinct from p_tarifa
                            or v_prev.cantidad is distinct from p_cantidad))
         or (v_manual and (v_prev.tarifa_id is not null or v_prev.monto is distinct from round(p_monto, 2)))
         or v_prev.medio is distinct from p_medio then
        raise exception 'Ese cobro ya se registró (N° %) con otros datos: fijate en la lista antes de cobrar de nuevo', v_prev.numero;
      end if;
      return jsonb_build_object(
        'id', v_prev.id, 'numero', v_prev.numero, 'monto', v_prev.monto,
        'tarifa', v_prev.tarifa_nombre, 'cantidad', v_prev.cantidad, 'unidad', v_prev.unidad,
        'caja_id', v_prev.caja_id, 'medio', v_prev.medio, 'creado_en', v_prev.creado_en,
        'anulado', v_prev.anulado, 'repetido', true);
    end if;
  end if;

  -- Validaciones (antes de tocar la caja).
  if v_manual then
    if round(p_monto, 2) <= 0 then raise exception 'Poné cuánto se cobró'; end if;
    if p_monto > 99999999 then raise exception 'Revisá el monto: es demasiado grande'; end if;
  else
    if p_tarifa is null then raise exception 'Poné cuánto se cobró'; end if;
    select * into v_tarifa from public.tarifas_transporte where id = p_tarifa and org_id = v_org;
    if not found or not v_tarifa.activo then
      raise exception 'Esa tarifa ya no está disponible. Actualizá la pantalla.';
    end if;
    if coalesce(v_tarifa.precio, 0) <= 0 then
      raise exception 'La tarifa de % no tiene precio: pedile al Líder que la cargue', v_tarifa.nombre;
    end if;
    if p_cantidad is null or p_cantidad < 1 or p_cantidad > 99 then
      raise exception 'La cantidad va de 1 a 99';
    end if;
  end if;
  if p_medio is null or p_medio not in ('efectivo', 'transferencia') then
    raise exception 'El canon se cobra en efectivo o por transferencia';
  end if;

  -- Patente: mayúsculas, sin espacios, puntos ni guiones ("ab 123 cd" → "AB123CD").
  v_patente := nullif(upper(regexp_replace(coalesce(p_patente, ''), '[[:space:].-]', '', 'g')), '');
  if v_patente is not null and v_patente !~ '^[A-Z0-9]{5,8}$' then
    raise exception 'La patente no parece válida (ej.: AB123CD o ABC123)';
  end if;

  -- ¿A quién viene? (H2)
  if v_destino is not null and v_destino not in ('puesto', 'verdulero', 'ambulante') then
    raise exception 'Elegí a quién viene: puesto, verdulero o ambulante';
  end if;
  if v_detalle is not null then
    if v_destino is distinct from 'puesto' then
      raise exception 'El número de puesto va solo si viene a un puesto';
    end if;
    -- "58", "Puesto 58", "34½", "34 1/2", "34,5" → número + ¿medio puesto?
    v_num := regexp_replace(v_detalle, '^(puesto|pto\.?|n[°º]|nro\.?)[[:space:]]*', '', 'i');
    v_medio := v_num ~ '(½|1/2|[.,]5)$';
    v_num := trim(regexp_replace(v_num, '[[:space:]]*(½|1/2|[.,]5)$', ''));
    if v_num = '' or char_length(v_num) > 10 then
      raise exception 'No existe el puesto %', v_detalle;
    end if;
    select array_agg(e.id order by e.id) into v_espacios
    from public.espacios e
    where e.org_id = v_org and e.tipo = 'puesto'
      and lower(e.numero) = lower(v_num)
      and (not v_medio or e.medio);
    if v_espacios is null then raise exception 'No existe el puesto %', v_detalle; end if;
    -- Un solo espacio con ese número: queda vinculado; si es ambiguo (dos medios), solo el número.
    if cardinality(v_espacios) = 1 then v_espacio := v_espacios[1]; end if;
    v_detalle := v_num || case when v_medio then '½' else '' end;
  end if;

  if v_notas is not null and char_length(v_notas) > 500 then
    raise exception 'La nota es demasiado larga (hasta 500 letras)';
  end if;

  -- (b) Caja de portería de HOY (§4.0-4): la crea si no existe (sin carrera entre dos porteros),
  -- después la toma FOR SHARE (§4.0-3) y valida el estado ya bloqueada.
  -- 0048: la de un día anterior no se crea sola: se abre desde Caja.
  if v_fecha = v_hoy then
    insert into public.cajas (org_id, tipo, fecha, abierta_por)
    values (v_org, v_tipo, v_hoy, v_uid)
    on conflict (org_id, tipo, fecha) do nothing
    returning id into v_caja_id;
    if v_caja_id is not null then
      perform private.registrar_evento_caja(v_caja_id, 'apertura',
        case when v_tipo = 'guardia' then 'Abierta por Portería con el primer ingreso de transporte'
             else 'Abierta con el primer cobro del bono camioneros' end);
    end if;
  end if;

  select c.id, c.estado into v_caja_id, v_caja_estado
  from public.cajas c
  where c.org_id = v_org and c.tipo = v_tipo and c.fecha = v_fecha
  for share;
  if v_fecha < v_hoy then
    if v_caja_id is null then
      raise exception 'No hay caja de % del %: abrila desde Caja para cargar el canon de ese día',
        case when v_tipo = 'guardia' then 'portería' else 'administración' end, to_char(v_fecha, 'DD/MM');
    end if;
    if v_caja_estado is distinct from 'abierta' then
      raise exception 'La caja de % del % ya está cerrada: reabrila desde Caja para seguir cargando',
        case when v_tipo = 'guardia' then 'portería' else 'administración' end, to_char(v_fecha, 'DD/MM');
    end if;
  elsif v_tipo = 'administracion' and v_caja_estado is distinct from 'abierta' then
    raise exception '%', private.mensaje_caja_no_abierta(v_caja_estado, v_rol);
  elsif v_caja_id is null or v_caja_estado is distinct from 'abierta' then
    raise exception 'La caja de portería de hoy ya se rindió. Avisale al Jefe de Portería: él pide la reapertura a Administración.';
  end if;

  -- (e) El cobro: snapshot de la tarifa (cambiar el precio después no toca cobros viejos).
  -- A mano: una entrada «Bono camioneros» por lo que se cobró (precio = monto, cantidad 1).
  v_monto := case when v_manual then round(p_monto, 2) else round(v_tarifa.precio * p_cantidad, 2) end;
  begin
    insert into public.canon_camiones (
      org_id, caja_id, fecha, tipo, cantidad, monto, medio, notas, creado_por,
      tarifa_id, tarifa_nombre, unidad, precio_unitario,
      patente, destino, destino_detalle, espacio_id, ref)
    values (
      v_org, v_caja_id, v_fecha, 'camion', case when v_manual then 1 else p_cantidad end, v_monto, p_medio, v_notas, v_uid,
      v_tarifa.id, coalesce(v_tarifa.nombre, 'Bono camioneros'), v_tarifa.unidad,
      case when v_manual then v_monto else v_tarifa.precio end,
      v_patente, v_destino, v_detalle, v_espacio, p_ref)
    returning * into v_nuevo;
  exception when unique_violation then
    -- Red de seguridad de la idempotencia: otra transacción ya insertó este ref.
    if p_ref is null then raise; end if;
    select * into v_prev from public.canon_camiones where org_id = v_org and ref = p_ref;
    if not found then raise; end if;
    return jsonb_build_object(
      'id', v_prev.id, 'numero', v_prev.numero, 'monto', v_prev.monto,
      'tarifa', v_prev.tarifa_nombre, 'cantidad', v_prev.cantidad, 'unidad', v_prev.unidad,
      'caja_id', v_prev.caja_id, 'medio', v_prev.medio, 'creado_en', v_prev.creado_en,
      'anulado', v_prev.anulado, 'repetido', true);
  end;

  return jsonb_build_object(
    'id', v_nuevo.id, 'numero', v_nuevo.numero, 'monto', v_nuevo.monto,
    'tarifa', v_nuevo.tarifa_nombre, 'cantidad', v_nuevo.cantidad, 'unidad', v_nuevo.unidad,
    'caja_id', v_nuevo.caja_id, 'medio', v_nuevo.medio, 'creado_en', v_nuevo.creado_en,
    'anulado', false, 'repetido', false);
end $function$;
revoke all on function public.registrar_canon(uuid, integer, public.medio_pago, text, text, text, text, uuid, date, numeric) from public, anon;
grant execute on function public.registrar_canon(uuid, integer, public.medio_pago, text, text, text, text, uuid, date, numeric) to authenticated, service_role;
comment on function public.registrar_canon(uuid, integer, public.medio_pago, text, text, text, text, uuid, date, numeric) is
  'Cobra el bono camioneros en la caja del día: p_monto = lo que se cobró, a mano (0062); o tarifa × cantidad (lo de antes).';
