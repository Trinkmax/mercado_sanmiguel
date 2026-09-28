-- ============================================================
-- Mercado San Miguel — 0015 Fase 3 · M3 Portería (canon de transporte / bono camioneros)
-- Contrato: docs/FASE3-CONTRATO.md §4.6 (+ §1.3 D-P2: el Líder opera todo, también el canon).
--
-- Requiere 0010, 0011 y 0012 aplicadas. Se aplica como UNA transacción, en la ventana de
-- mantenimiento (§0.3), después de 0013/0014 y antes de 0016.
-- Idempotente: solo `create or replace` con la firma EXACTA de 0012 + drop/create del trigger.
--
-- Qué hace:
--   1) registrar_canon      — Portería (y el Líder) cobra el canon en la caja de portería de HOY
--                             (la abre si hace falta). Monto = tarifa × cantidad (nadie tipea montos).
--   2) anular_canon         — anulación lógica con motivo y evento `canon_anulado` (nunca se borra).
--   3) estado_caja_porteria — estado de la caja de portería de hoy (Portería no lee `cajas`).
--   4) resumen_canon        — por tarifa, sin anulados.
--   5) trigger proteger_ingreso en ingresos_personal (H4: nadie infla ni borra horas).
--
-- Dependencias: el recálculo del arqueo cuando se anula un canon de una caja cerrada lo hace el
-- trigger `recalcular_caja` de M2 (0013) sobre canon_camiones. Acá no se llama a nada de otro módulo.
-- Pedidos a Fundación: ninguno.
-- ============================================================


-- ------------------------------------------------------------
-- 1. registrar_canon (H1, H2)
-- ------------------------------------------------------------
create or replace function public.registrar_canon(
  p_tarifa uuid,
  p_cantidad integer default 1,
  p_medio public.medio_pago default 'efectivo',
  p_patente text default null,
  p_destino text default null,
  p_destino_detalle text default null,
  p_notas text default null,
  p_ref uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
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
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  -- Portería cobra el canon; el Líder también (§1.3 D-P2). El Jefe, Administración y Tesorería no.
  if v_rol is null or v_rol not in ('porteria', 'lider') then
    raise exception 'El canon de transporte lo cobra Portería';
  end if;

  -- (a) Idempotencia (§4.0-5): doble toque o reintento sin red = un solo cobro.
  if p_ref is not null then
    perform pg_advisory_xact_lock(hashtextextended('registrar_canon:' || p_ref::text, 0));
    select * into v_prev from public.canon_camiones where org_id = v_org and ref = p_ref;
    if found then
      if v_prev.tarifa_id is distinct from p_tarifa
         or v_prev.cantidad is distinct from p_cantidad
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
  if p_tarifa is null then raise exception 'Elegí qué entró'; end if;
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
  insert into public.cajas (org_id, tipo, fecha, abierta_por)
  values (v_org, 'guardia', v_hoy, v_uid)
  on conflict (org_id, tipo, fecha) do nothing
  returning id into v_caja_id;
  if v_caja_id is not null then
    perform private.registrar_evento_caja(v_caja_id, 'apertura',
      'Abierta por Portería con el primer ingreso de transporte');
  end if;

  select c.id, c.estado into v_caja_id, v_caja_estado
  from public.cajas c
  where c.org_id = v_org and c.tipo = 'guardia' and c.fecha = v_hoy
  for share;
  if v_caja_id is null or v_caja_estado is distinct from 'abierta' then
    raise exception 'La caja de portería de hoy ya se rindió. Avisale al Jefe de Portería: él pide la reapertura a Administración.';
  end if;

  -- (e) El cobro: snapshot de la tarifa (cambiar el precio después no toca cobros viejos).
  v_monto := round(v_tarifa.precio * p_cantidad, 2);
  begin
    insert into public.canon_camiones (
      org_id, caja_id, fecha, tipo, cantidad, monto, medio, notas, creado_por,
      tarifa_id, tarifa_nombre, unidad, precio_unitario,
      patente, destino, destino_detalle, espacio_id, ref)
    values (
      v_org, v_caja_id, v_hoy, 'camion', p_cantidad, v_monto, p_medio, v_notas, v_uid,
      v_tarifa.id, v_tarifa.nombre, v_tarifa.unidad, v_tarifa.precio,
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
end $$;
revoke all on function public.registrar_canon(uuid, integer, public.medio_pago, text, text, text, text, uuid) from public, anon;
grant execute on function public.registrar_canon(uuid, integer, public.medio_pago, text, text, text, text, uuid) to authenticated;


-- ------------------------------------------------------------
-- 2. anular_canon — se anula, no se borra (rastro: quién, cuándo, por qué + evento de caja)
-- ------------------------------------------------------------
create or replace function public.anular_canon(p_canon uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_uid uuid := (select auth.uid());
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
  v_caja_id uuid;
  v_caja public.cajas;
  v_c public.canon_camiones;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  -- Portería (lo suyo, 15 min), el Jefe (caja abierta), Tesorería y el Líder (§1.3 D-P2).
  if v_rol is null or v_rol not in ('porteria', 'guardia', 'tesoreria', 'lider') then
    raise exception 'No tenés permiso para anular cobros de canon';
  end if;
  if v_motivo is null then raise exception 'Contá por qué lo anulás'; end if;
  if char_length(v_motivo) > 500 then
    raise exception 'El motivo es demasiado largo (hasta 500 letras)';
  end if;

  -- Solo para saber qué caja bloquear (caja_id no cambia nunca).
  select cc.caja_id into v_caja_id
  from public.canon_camiones cc where cc.id = p_canon and cc.org_id = v_org;
  if not found then raise exception 'Ese cobro de canon no existe'; end if;

  -- Orden de bloqueo (§4.0-1/3): caja FOR UPDATE → canon FOR UPDATE. Validar después.
  select * into v_caja from public.cajas where id = v_caja_id and org_id = v_org for update;
  if not found then raise exception 'Caja inexistente'; end if;
  select * into v_c from public.canon_camiones where id = p_canon and org_id = v_org for update;

  if v_c.anulado then raise exception 'Ese cobro ya estaba anulado'; end if;
  if v_caja.estado = 'validada' then
    raise exception 'La caja de ese día ya la validó Tesorería: el cobro no se puede anular';
  end if;

  if v_rol = 'porteria' then
    if v_c.creado_por is distinct from v_uid
       or v_c.creado_en < now() - interval '15 minutes' then
      raise exception 'Pasaron más de 15 minutos: pedile al Jefe de Portería que lo anule';
    end if;
    if v_caja.estado <> 'abierta' then
      raise exception 'La caja de portería ya se rindió: pedile al Jefe de Portería que lo resuelva';
    end if;
  elsif v_rol = 'guardia' then
    if v_caja.estado <> 'abierta' then
      raise exception 'La caja ya se rindió: pedí la reapertura';
    end if;
  end if;
  -- Tesorería y el Líder: abierta, cerrada o integrada (la validada ya se rechazó).

  update public.canon_camiones
  set anulado = true, anulado_por = v_uid, anulado_en = now(), motivo_anulacion = v_motivo
  where id = v_c.id;

  -- 'N° 124 · Camioneta × 2 · $ 12.000 · Se cargó dos veces'
  perform private.registrar_evento_caja(v_c.caja_id, 'canon_anulado',
    'N° ' || v_c.numero || ' · ' || coalesce(v_c.tarifa_nombre, 'Canon') || ' × ' || v_c.cantidad
    || ' · $ ' || replace(to_char(v_c.monto, 'FM999G999G999G990'), ',', '.')
    || ' · ' || v_motivo);
  -- Si la caja estaba cerrada/integrada, el trigger recalcular_caja de M2 (0013) recalcula el arqueo.
end $$;
revoke all on function public.anular_canon(uuid, text) from public, anon;
grant execute on function public.anular_canon(uuid, text) to authenticated;


-- ------------------------------------------------------------
-- 3. estado_caja_porteria — Portería no lee `cajas`: esto alcanza para el aviso y el bloqueo
-- ------------------------------------------------------------
create or replace function public.estado_caja_porteria()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
  v_caja public.cajas;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('porteria', 'guardia', 'lider', 'admin', 'tesoreria') then
    raise exception 'Sin permiso';
  end if;
  select * into v_caja
  from public.cajas c
  where c.org_id = v_org and c.tipo = 'guardia' and c.fecha = v_hoy;
  return jsonb_build_object(
    'caja_id', v_caja.id,
    'fecha', v_hoy,
    'estado', v_caja.estado,
    'reapertura_pedida', coalesce(v_caja.reapertura_solicitada_en is not null, false));
end $$;
revoke all on function public.estado_caja_porteria() from public, anon;
grant execute on function public.estado_caja_porteria() to authenticated;


-- ------------------------------------------------------------
-- 4. resumen_canon — por tarifa, sin anulados (Líder, reportes, caja)
-- ------------------------------------------------------------
create or replace function public.resumen_canon(p_desde date, p_hasta date)
returns table (
  tarifa text,
  unidad text,
  entradas bigint,
  cantidad bigint,
  monto numeric,
  efectivo numeric,
  transferencia numeric
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('porteria', 'guardia', 'admin', 'tesoreria', 'lider') then
    raise exception 'Sin permiso';
  end if;
  if p_desde is null or p_hasta is null then raise exception 'Elegí desde y hasta qué día'; end if;
  if p_hasta < p_desde then raise exception 'La fecha final no puede ser anterior a la inicial'; end if;

  return query
  select
    coalesce(cc.tarifa_nombre, 'Canon (sin tarifa)')::text,
    coalesce(cc.unidad, 'vehiculo')::text,
    count(*)::bigint,
    coalesce(sum(cc.cantidad), 0)::bigint,
    coalesce(sum(cc.monto), 0)::numeric,
    coalesce(sum(cc.monto) filter (where cc.medio = 'efectivo'), 0)::numeric,
    coalesce(sum(cc.monto) filter (where cc.medio = 'transferencia'), 0)::numeric
  from public.canon_camiones cc
  where cc.org_id = v_org
    and not cc.anulado
    and cc.fecha between p_desde and p_hasta
  group by 1, 2
  order by 5 desc, 1;
end $$;
revoke all on function public.resumen_canon(date, date) from public, anon;
grant execute on function public.resumen_canon(date, date) to authenticated;


-- ------------------------------------------------------------
-- 5. Trigger proteger_ingreso (H4): las horas de ingresos_personal alimentan Novedades.
--    - La salida no puede ser futura (tolerancia 5 min) ni anterior a la entrada.
--    - Una salida ya marcada solo la corrige el Líder (con service role, auth.uid() nulo, se permite:
--      mantenimiento del ingeniero).
--    - Entrada, empleado, DNI, quién registró y la organización no cambian nunca.
-- ------------------------------------------------------------
create or replace function private.tg_proteger_ingreso()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.org_id := old.org_id;
  new.ingreso_en := old.ingreso_en;
  new.empleado_id := old.empleado_id;
  new.dni := old.dni;
  new.registrado_por := old.registrado_por;

  if new.egreso_en is distinct from old.egreso_en then
    if old.egreso_en is not null
       and (select auth.uid()) is not null
       and private.rol_actual() is distinct from 'lider' then
      raise exception 'La salida ya estaba marcada: pedile al Líder de Procesos que la corrija';
    end if;
    if new.egreso_en is not null then
      if new.egreso_en > now() + interval '5 minutes' then
        raise exception 'La hora de salida no puede ser futura';
      end if;
      if new.egreso_en < new.ingreso_en then
        raise exception 'La salida no puede ser antes de la entrada';
      end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function private.tg_proteger_ingreso() from public, anon, authenticated;

drop trigger if exists proteger_ingreso on public.ingresos_personal;
create trigger proteger_ingreso
  before update on public.ingresos_personal
  for each row execute function private.tg_proteger_ingreso();
