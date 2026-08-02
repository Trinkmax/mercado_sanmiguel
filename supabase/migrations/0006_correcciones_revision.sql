-- ============================================================
-- 0006 Correcciones de la revisión adversarial
-- 1. Fecha de negocio en huso argentino (private.hoy_ar) en toda decisión
--    de descuento, cajas y vista de deuda.
-- 2. rechazar_cheque: el rebote del banco revive la deuda del cliente.
-- 3. anular_pago: valida tipo de caja por rol, recalcula el arqueo de
--    cajas cerradas y bloquea si el cheque ya fue depositado.
-- 4. resumen_conceptos incluye el canon de camiones (BC).
-- 5. Gastos y canon no admiten medio 'cheque' (fuera del arqueo).
-- 6. Perfiles: nadie cambia su propio rol ni la organización.
-- 7. Gastos: consejo queda solo-lectura (alineado con las actions).
-- ============================================================

-- ---------- 1. Fecha de negocio ----------
create or replace function private.hoy_ar() returns date
language sql stable
as $$
  select (now() at time zone 'America/Argentina/Cordoba')::date
$$;
grant execute on function private.hoy_ar() to authenticated;

alter table public.cajas alter column fecha set default private.hoy_ar();
alter table public.canon_camiones alter column fecha set default private.hoy_ar();
alter table public.cheques alter column fecha_recibido set default private.hoy_ar();
alter table public.cheques alter column fecha_cobro set default private.hoy_ar();
alter table public.lecturas alter column fecha_lectura set default private.hoy_ar();
alter table public.sanciones alter column fecha set default private.hoy_ar();
alter table public.saldos_iniciales alter column fecha set default private.hoy_ar();
alter table public.movimientos_tesoreria alter column fecha set default private.hoy_ar();

create or replace view public.v_deuda_clientes
with (security_invoker = true) as
select
  org_id,
  cliente_id,
  sum(
    (case when private.hoy_ar() <= vencimiento
      then round(monto * (1 - descuento_pronto_pago / 100.0), 2)
      else monto end) - monto_pagado
  ) as deuda,
  count(*) as cargos_pendientes,
  min(periodo) as periodo_mas_viejo
from public.cargos
where estado in ('pendiente','parcial')
group by org_id, cliente_id;

-- ---------- 5. Sin cheques en gastos ni canon ----------
alter table public.gastos add constraint gastos_medio_sin_cheque
  check (medio_pago is null or medio_pago <> 'cheque');
alter table public.canon_camiones add constraint canon_medio_sin_cheque
  check (medio <> 'cheque');

-- ---------- 6. Protección de perfiles ----------
create or replace function private.proteger_perfiles() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.org_id <> old.org_id then
    raise exception 'No se puede mover un perfil de organización';
  end if;
  if old.user_id = (select auth.uid()) and new.rol <> old.rol then
    raise exception 'No podés cambiar tu propio rol';
  end if;
  if old.user_id = (select auth.uid()) and new.activo = false then
    raise exception 'No podés desactivarte a vos mismo';
  end if;
  return new;
end;
$$;
drop trigger if exists proteger_perfiles on public.perfiles;
create trigger proteger_perfiles before update on public.perfiles
  for each row execute function private.proteger_perfiles();

-- ---------- 7. Gastos: consejo solo lectura ----------
drop policy "insertar gastos" on public.gastos;
drop policy "editar gastos" on public.gastos;
drop policy "borrar gastos" on public.gastos;
create policy "insertar gastos" on public.gastos for insert to authenticated
  with check (private.tiene_rol(org_id, array['admin','tesoreria']::public.rol_usuario[]));
create policy "editar gastos" on public.gastos for update to authenticated
  using (private.tiene_rol(org_id, array['admin','tesoreria']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['admin','tesoreria']::public.rol_usuario[]));
create policy "borrar gastos" on public.gastos for delete to authenticated
  using (private.tiene_rol(org_id, array['admin','tesoreria']::public.rol_usuario[]));

-- ---------- Recalcular el arqueo de una caja (reutilizado) ----------
create or replace function private.recalcular_arqueo(p_caja uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_efectivo numeric; v_transferencia numeric; v_cheques numeric;
  v_canon numeric; v_gastos numeric;
begin
  select
    coalesce(sum(monto) filter (where medio = 'efectivo'), 0),
    coalesce(sum(monto) filter (where medio = 'transferencia'), 0),
    coalesce(sum(monto) filter (where medio = 'cheque'), 0)
  into v_efectivo, v_transferencia, v_cheques
  from public.pagos where caja_id = p_caja and not anulado;

  select coalesce(sum(monto), 0) into v_canon
  from public.canon_camiones where caja_id = p_caja;

  select coalesce(sum(monto), 0) into v_gastos
  from public.gastos where caja_id = p_caja and estado = 'pagado' and medio_pago = 'efectivo';

  update public.cajas set
    total_efectivo = v_efectivo
      + coalesce((select sum(monto) from public.canon_camiones where caja_id = p_caja and medio = 'efectivo'), 0)
      - v_gastos,
    total_transferencia = v_transferencia
      + coalesce((select sum(monto) from public.canon_camiones where caja_id = p_caja and medio = 'transferencia'), 0),
    total_cheques = v_cheques,
    total_canon = v_canon,
    total_gastos = v_gastos
  where id = p_caja;
end;
$$;

-- ---------- Reversión de imputaciones de un pago (reutilizado) ----------
create or replace function private.revertir_imputaciones(p_pago uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_imp record;
begin
  for v_imp in select * from public.imputaciones where pago_id = p_pago loop
    update public.cargos set
      monto_pagado = greatest(monto_pagado - v_imp.monto, 0),
      descuento_aplicado = 0,
      estado = case when monto_pagado - v_imp.monto <= 0
        then 'pendiente'::public.estado_cargo
        else 'parcial'::public.estado_cargo end
    where id = v_imp.cargo_id;
  end loop;
  delete from public.imputaciones where pago_id = p_pago;
end;
$$;

-- ---------- 3. anular_pago corregido ----------
create or replace function public.anular_pago(p_pago uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_pago public.pagos;
  v_caja public.cajas;
  v_cheque public.cheques;
begin
  if v_rol not in ('admin','guardia','tesoreria') then
    raise exception 'No tenés permiso para anular cobros';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Indicá el motivo de la anulación';
  end if;

  select * into v_pago from public.pagos where id = p_pago and org_id = v_org for update;
  if not found then raise exception 'Cobro inexistente'; end if;
  if v_pago.anulado then raise exception 'El cobro ya está anulado'; end if;

  select * into v_caja from public.cajas where id = v_pago.caja_id for update;
  if v_rol = 'guardia' and v_caja.tipo <> 'guardia' then
    raise exception 'Solo podés anular cobros de la caja de guardia';
  end if;
  if v_rol = 'admin' and v_caja.tipo <> 'administracion' then
    raise exception 'Solo podés anular cobros de la caja de administración';
  end if;
  if v_rol in ('admin','guardia') and v_caja.estado <> 'abierta' then
    raise exception 'La caja ya se cerró: pedile la anulación a tesorería';
  end if;
  if v_caja.estado = 'validada' then
    raise exception 'La caja ya fue validada; si es un cheque rebotado, marcalo como rechazado desde Cheques';
  end if;

  if v_pago.cheque_id is not null then
    select * into v_cheque from public.cheques where id = v_pago.cheque_id;
    if found and v_cheque.estado <> 'en_cartera' then
      raise exception 'El cheque ya fue depositado o acreditado: marcalo como rechazado desde Cheques para revertir el cobro';
    end if;
  end if;

  perform private.revertir_imputaciones(p_pago);

  if v_pago.cheque_id is not null then
    delete from public.cheques where id = v_pago.cheque_id and estado = 'en_cartera';
  end if;

  update public.pagos set
    anulado = true,
    anulado_por = (select auth.uid()),
    anulado_en = now(),
    motivo_anulacion = trim(p_motivo)
  where id = p_pago;

  -- si la caja ya estaba cerrada (tesorería aún no validó), el arqueo se corrige
  if v_caja.estado = 'cerrada' then
    perform private.recalcular_arqueo(v_caja.id);
  end if;
end;
$$;

-- ---------- 2. rechazar_cheque: el rebote revive la deuda ----------
create or replace function public.rechazar_cheque(p_cheque uuid, p_motivo text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_cheque public.cheques;
  v_pago public.pagos;
  v_caja public.cajas;
begin
  if v_rol not in ('admin','tesoreria') then
    raise exception 'No tenés permiso para rechazar cheques';
  end if;

  select * into v_cheque from public.cheques where id = p_cheque and org_id = v_org for update;
  if not found then raise exception 'Cheque inexistente'; end if;
  if v_cheque.estado = 'rechazado' then raise exception 'El cheque ya está rechazado'; end if;

  update public.cheques set
    estado = 'rechazado',
    notas = trim(both ' · ' from coalesce(notas, '') || case
      when coalesce(trim(p_motivo), '') = '' then ''
      else ' · Rechazado: ' || trim(p_motivo) end)
  where id = p_cheque;

  -- revertir el cobro que este cheque respaldaba: la deuda vuelve a existir
  select * into v_pago from public.pagos
  where cheque_id = p_cheque and not anulado
  for update;

  if found then
    perform private.revertir_imputaciones(v_pago.id);
    update public.pagos set
      anulado = true,
      anulado_por = (select auth.uid()),
      anulado_en = now(),
      motivo_anulacion = 'Cheque N° ' || v_cheque.numero || ' rechazado por el banco'
        || case when coalesce(trim(p_motivo), '') = '' then '' else ': ' || trim(p_motivo) end
    where id = v_pago.id;

    -- el arqueo histórico validado no se toca; una caja cerrada sin validar sí se corrige
    select * into v_caja from public.cajas where id = v_pago.caja_id;
    if found and v_caja.estado = 'cerrada' then
      perform private.recalcular_arqueo(v_caja.id);
    end if;
  end if;
end;
$$;
revoke execute on function public.rechazar_cheque(uuid, text) from anon, public;
grant execute on function public.rechazar_cheque(uuid, text) to authenticated;

-- ---------- 1b. RPCs con fecha de negocio argentina ----------
create or replace function public.abrir_caja(p_tipo public.tipo_caja)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
  v_id uuid;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if not (
    v_rol = 'tesoreria'
    or (v_rol = 'admin' and p_tipo = 'administracion')
    or (v_rol = 'guardia' and p_tipo = 'guardia')
  ) then
    raise exception 'No tenés permiso para abrir esta caja';
  end if;

  select id into v_id from public.cajas
  where org_id = v_org and tipo = p_tipo and fecha = v_hoy;
  if found then return v_id; end if;

  insert into public.cajas (org_id, tipo, fecha, abierta_por)
  values (v_org, p_tipo, v_hoy, (select auth.uid()))
  on conflict (org_id, tipo, fecha) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.cajas
    where org_id = v_org and tipo = p_tipo and fecha = v_hoy;
  end if;
  return v_id;
end;
$$;

create or replace function public.registrar_pago(
  p_cliente uuid,
  p_monto numeric,
  p_medio public.medio_pago,
  p_caja uuid,
  p_cheque jsonb default null,
  p_notas text default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
  v_caja public.cajas;
  v_cheque_id uuid;
  v_pago_id uuid;
  v_numero bigint;
  v_restante numeric := round(p_monto, 2);
  v_cargo record;
  v_objetivo numeric;
  v_saldo numeric;
  v_aplicar numeric;
  v_detalle jsonb := '[]'::jsonb;
begin
  if v_rol not in ('admin','guardia','tesoreria') then
    raise exception 'No tenés permiso para registrar cobros';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto debe ser mayor a cero';
  end if;

  select * into v_caja from public.cajas where id = p_caja and org_id = v_org;
  if not found then raise exception 'Caja inexistente'; end if;
  if v_caja.estado <> 'abierta' then raise exception 'La caja ya está cerrada'; end if;
  if v_rol = 'guardia' and v_caja.tipo <> 'guardia' then
    raise exception 'Solo podés cobrar en la caja de guardia';
  end if;
  if v_rol = 'admin' and v_caja.tipo <> 'administracion' then
    raise exception 'Solo podés cobrar en la caja de administración';
  end if;

  perform 1 from public.clientes where id = p_cliente and org_id = v_org;
  if not found then raise exception 'Cliente inexistente'; end if;

  if p_medio = 'cheque' then
    if p_cheque is null or coalesce(p_cheque->>'numero','') = '' or coalesce(p_cheque->>'titular','') = '' then
      raise exception 'Faltan los datos del cheque (número y titular)';
    end if;
    insert into public.cheques (org_id, cliente_id, numero, banco, titular, es_tercero, monto, fecha_cobro, creado_por)
    values (
      v_org, p_cliente,
      p_cheque->>'numero',
      p_cheque->>'banco',
      p_cheque->>'titular',
      coalesce((p_cheque->>'es_tercero')::boolean, false),
      round(p_monto, 2),
      coalesce((p_cheque->>'fecha_cobro')::date, v_hoy),
      (select auth.uid())
    ) returning id into v_cheque_id;
  end if;

  insert into public.pagos (org_id, cliente_id, caja_id, medio, monto, cheque_id, notas, recibido_por)
  values (v_org, p_cliente, p_caja, p_medio, round(p_monto, 2), v_cheque_id, p_notas, (select auth.uid()))
  returning id, numero into v_pago_id, v_numero;

  for v_cargo in
    select c.id, c.monto, c.monto_pagado, c.descuento_pronto_pago, c.vencimiento,
           c.codigo, c.descripcion, c.periodo
    from public.cargos c
    join public.conceptos co on co.id = c.concepto_id
    where c.cliente_id = p_cliente and c.estado in ('pendiente','parcial')
    order by c.periodo asc, co.orden_imputacion asc, c.creado_en asc
    for update of c
  loop
    exit when v_restante <= 0;
    v_objetivo := case when v_hoy <= v_cargo.vencimiento
      then round(v_cargo.monto * (1 - v_cargo.descuento_pronto_pago / 100.0), 2)
      else v_cargo.monto end;
    v_saldo := v_objetivo - v_cargo.monto_pagado;
    continue when v_saldo <= 0;
    v_aplicar := least(v_restante, v_saldo);

    insert into public.imputaciones (org_id, pago_id, cargo_id, monto)
    values (v_org, v_pago_id, v_cargo.id, v_aplicar);

    update public.cargos set
      monto_pagado = monto_pagado + v_aplicar,
      descuento_aplicado = case
        when v_aplicar = v_saldo and v_hoy <= vencimiento
        then monto - v_objetivo
        else descuento_aplicado end,
      estado = case when v_aplicar = v_saldo then 'pagado'::public.estado_cargo else 'parcial'::public.estado_cargo end
    where id = v_cargo.id;

    v_detalle := v_detalle || jsonb_build_object(
      'cargo_id', v_cargo.id,
      'codigo', v_cargo.codigo,
      'descripcion', v_cargo.descripcion,
      'periodo', v_cargo.periodo,
      'monto', v_aplicar,
      'saldado', v_aplicar = v_saldo
    );
    v_restante := v_restante - v_aplicar;
  end loop;

  if v_restante > 0 then
    raise exception 'El monto supera la deuda del cliente: sobran $ %. Cobrá hasta el total adeudado.', to_char(v_restante, 'FM999G999G999G990');
  end if;

  return jsonb_build_object('pago_id', v_pago_id, 'numero', v_numero, 'imputaciones', v_detalle);
end;
$$;

-- ---------- 4. resumen_conceptos con canon de camiones ----------
create or replace function public.resumen_conceptos(p_periodo date)
returns table (
  codigo text,
  nombre text,
  estimado numeric,
  cobrado numeric,
  descuentos numeric,
  pendiente numeric
)
language plpgsql security definer set search_path = ''
stable
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_periodo date := date_trunc('month', p_periodo)::date;
  v_hoy date := private.hoy_ar();
begin
  if v_rol not in ('admin','guardia','tesoreria','consejo') then
    raise exception 'Sin permiso';
  end if;
  return query
  select
    c.codigo,
    max(co.nombre) as nombre,
    sum(c.monto) as estimado,
    sum(c.monto_pagado) as cobrado,
    sum(c.descuento_aplicado) as descuentos,
    sum(case when c.estado in ('pendiente','parcial')
      then (case when v_hoy <= c.vencimiento
        then round(c.monto * (1 - c.descuento_pronto_pago / 100.0), 2)
        else c.monto end) - c.monto_pagado
      else 0 end) as pendiente
  from public.cargos c
  join public.conceptos co on co.id = c.concepto_id
  where c.org_id = v_org and c.periodo = v_periodo and c.estado <> 'anulado'
  group by c.codigo
  order by min(co.orden_imputacion);

  -- canon de camiones del mes (ingreso diario de portería, sin cargos)
  return query
  select
    'BC'::text,
    'Canon Camiones'::text,
    coalesce(sum(cc.monto), 0),
    coalesce(sum(cc.monto), 0),
    0::numeric,
    0::numeric
  from public.canon_camiones cc
  where cc.org_id = v_org
    and date_trunc('month', cc.fecha)::date = v_periodo
  having coalesce(sum(cc.monto), 0) > 0;
end;
$$;
