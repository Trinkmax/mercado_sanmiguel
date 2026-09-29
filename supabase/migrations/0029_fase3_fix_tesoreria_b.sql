-- ============================================================
-- Mercado San Miguel — 0029 Fase 3: arreglo pendiente de Tesorería (M6)
-- Contrato: docs/FASE3-CONTRATO.md §4.0-5 (idempotencia) y §4.9.
--
-- pagar_gasto: si se corta la red después de pagar un gasto y el operador toca de
-- nuevo, antes contestaba "El gasto ya no está pendiente" (y parecía que no se había
-- pagado). Ahora, si la MISMA persona lo pagó recién de la misma forma, devuelve el
-- pago ya hecho con repetido = true. Cualquier otro caso sigue igual.
-- Idempotente (create or replace).
-- ============================================================

create or replace function public.pagar_gasto(p_gasto uuid, p_origen text, p_medio medio_pago DEFAULT 'efectivo'::medio_pago, p_fecha date DEFAULT NULL::date, p_caja uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
  v_gasto public.gastos;
  v_caja public.cajas;
  v_caja_id uuid := p_caja;
  v_nueva uuid;
  v_fecha date;
  v_medio public.medio_pago := coalesce(p_medio, 'efectivo');
  v_etiqueta text;
  v_efectivo numeric;
  v_arqueo jsonb;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('admin','tesoreria','lider') then
    raise exception 'No tenés permiso para pagar gastos';
  end if;

  if p_origen = 'caja' then
    if v_medio <> 'efectivo' then
      raise exception 'De la caja del día solo sale efectivo';
    end if;

    if v_caja_id is null then
      select c.id into v_caja_id from public.cajas c
      where c.org_id = v_org and c.tipo = 'administracion' and c.fecha = v_hoy;
      if v_caja_id is null then
        if v_rol = 'tesoreria' then
          raise exception 'Todavía no hay caja de Administración hoy: pagalo desde Tesorería o elegí otro día';
        end if;
        -- §4.0-4: nunca "if not exists … insert".
        insert into public.cajas (org_id, tipo, fecha, abierta_por)
        values (v_org, 'administracion', v_hoy, (select auth.uid()))
        on conflict (org_id, tipo, fecha) do nothing
        returning id into v_nueva;
        if v_nueva is not null then
          v_caja_id := v_nueva;
          perform private.registrar_evento_caja(v_caja_id, 'apertura', 'Abierta al pagar un gasto');
        else
          select c.id into v_caja_id from public.cajas c
          where c.org_id = v_org and c.tipo = 'administracion' and c.fecha = v_hoy;
        end if;
      end if;
    end if;

    -- (b) caja for update ANTES que el gasto; el estado se valida después del bloqueo.
    select * into v_caja from public.cajas where id = v_caja_id and org_id = v_org for update;
    if not found then raise exception 'Esa caja no existe. Actualizá la página.'; end if;
    if v_caja.tipo <> 'administracion' then
      raise exception 'Elegí una caja de administración';
    end if;
    if v_caja.estado = 'validada' then
      raise exception 'La caja del % ya la validó tesorería: elegí otro día o pagalo desde Tesorería',
        to_char(v_caja.fecha, 'DD/MM');
    end if;
    v_fecha := v_caja.fecha;

  elsif p_origen = 'tesoreria' then
    if v_medio not in ('efectivo','transferencia') then
      raise exception 'Elegí efectivo o banco';
    end if;
    v_fecha := coalesce(p_fecha, v_hoy);
    if v_fecha > v_hoy then
      raise exception 'La fecha de pago no puede ser futura';
    end if;
    v_caja_id := null;
  else
    raise exception 'Elegí de dónde sale la plata';
  end if;

  -- (e) gasto for update
  select * into v_gasto from public.gastos where id = p_gasto and org_id = v_org for update;
  if not found then raise exception 'Ese gasto no existe. Actualizá la página.'; end if;
  -- 0029: reintento del mismo pago (se cortó la red y no llegó la respuesta). Si esta misma
  -- persona lo acaba de pagar igual (mismo origen, medio, caja y fecha), se devuelve lo que ya
  -- quedó en vez de "ya no está pendiente": la pantalla muestra el pago hecho y no se duplica.
  if v_gasto.estado = 'pagado'
     and v_gasto.pagado_por = (select auth.uid())
     and v_gasto.pagado_desde = p_origen
     and v_gasto.medio_pago = v_medio
     and v_gasto.caja_id is not distinct from v_caja_id
     and v_gasto.fecha_pago = v_fecha
     and v_gasto.pagado_en > now() - interval '15 minutes' then
    return jsonb_build_object(
      'caja_id', v_caja_id,
      'caja_fecha', case when v_caja_id is not null then v_caja.fecha end,
      'caja_estado', case when v_caja_id is not null then v_caja.estado::text end,
      'efectivo_caja', null,
      'fecha_pago', v_fecha,
      'arqueo_recalculado', false,
      'repetido', true
    );
  end if;
  if v_gasto.estado <> 'pendiente' then
    raise exception 'El gasto ya no está pendiente. Actualizá la página.';
  end if;

  select coalesce(nullif(trim(v_gasto.descripcion), ''), r.nombre, 'Gasto') into v_etiqueta
  from public.rubros_gasto r where r.id = v_gasto.rubro_id;
  v_etiqueta := coalesce(v_etiqueta, nullif(trim(v_gasto.descripcion), ''), 'Gasto');

  if v_caja_id is not null then
    perform private.registrar_evento_caja(v_caja_id, 'gasto_imputado',
      v_etiqueta || ' — ' || private.tesoreria_pesos(v_gasto.monto)
      || case when v_caja.estado <> 'abierta' then ' (cargado después del cierre)' else '' end);
  end if;

  update public.gastos set
    estado = 'pagado',
    fecha_pago = v_fecha,
    medio_pago = v_medio,
    pagado_desde = p_origen,
    caja_id = v_caja_id,
    pagado_por = (select auth.uid()),
    pagado_en = now()
  where id = p_gasto;

  if v_caja_id is not null then
    if v_caja.estado <> 'abierta' then
      -- El trigger recalcular_caja de M2 ya lo hizo; red de seguridad idempotente.
      perform private.recalcular_arqueo(v_caja_id);
      select c.total_efectivo into v_efectivo from public.cajas c where c.id = v_caja_id;
    elsif to_regprocedure('private.calcular_arqueo(uuid)') is not null then
      v_arqueo := private.calcular_arqueo(v_caja_id);
      v_efectivo := nullif(v_arqueo ->> 'efectivo', '')::numeric;
    end if;
  end if;

  return jsonb_build_object(
    'caja_id', v_caja_id,
    'caja_fecha', case when v_caja_id is not null then v_caja.fecha end,
    'caja_estado', case when v_caja_id is not null then v_caja.estado::text end,
    'efectivo_caja', v_efectivo,
    'fecha_pago', v_fecha,
    'arqueo_recalculado', v_caja_id is not null and v_caja.estado <> 'abierta',
    'repetido', false
  );
end $function$;

revoke all on function public.pagar_gasto(uuid, text, public.medio_pago, date, uuid) from public, anon;
grant execute on function public.pagar_gasto(uuid, text, public.medio_pago, date, uuid) to authenticated;
