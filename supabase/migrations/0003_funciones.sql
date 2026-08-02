-- ============================================================
-- Mercado San Miguel — 0003 Funciones de negocio (RPC)
-- Todas: security definer + search_path fijo + chequeo de rol explícito.
-- El dato entra una vez; el sistema imputa, arquea y reporta solo.
-- ============================================================

-- ---------- Abrir caja del día ----------
create or replace function public.abrir_caja(p_tipo public.tipo_caja)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
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
  where org_id = v_org and tipo = p_tipo and fecha = current_date;
  if found then return v_id; end if;

  insert into public.cajas (org_id, tipo, fecha, abierta_por)
  values (v_org, p_tipo, current_date, (select auth.uid()))
  on conflict (org_id, tipo, fecha) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.cajas
    where org_id = v_org and tipo = p_tipo and fecha = current_date;
  end if;
  return v_id;
end;
$$;

-- ---------- Registrar cobro con imputación automática ----------
-- Imputa deuda más vieja primero y, dentro del período, según el orden
-- de prioridad configurado en cada concepto (la expensa va última).
-- Aplica el descuento por pronto pago si el cargo queda saldado en término.
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
      coalesce((p_cheque->>'fecha_cobro')::date, current_date),
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
    v_objetivo := case when current_date <= v_cargo.vencimiento
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
        when v_aplicar = v_saldo and current_date <= vencimiento
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

-- ---------- Anular un cobro ----------
create or replace function public.anular_pago(p_pago uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_pago public.pagos;
  v_caja public.cajas;
  v_imp record;
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

  select * into v_caja from public.cajas where id = v_pago.caja_id;
  if v_rol in ('admin','guardia') and v_caja.estado <> 'abierta' then
    raise exception 'La caja ya se cerró: pedile la anulación a tesorería';
  end if;
  if v_caja.estado = 'validada' then
    raise exception 'La caja ya fue validada por tesorería; no se puede anular';
  end if;

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

  if v_pago.cheque_id is not null then
    delete from public.cheques where id = v_pago.cheque_id and estado = 'en_cartera';
  end if;

  update public.pagos set
    anulado = true,
    anulado_por = (select auth.uid()),
    anulado_en = now(),
    motivo_anulacion = trim(p_motivo)
  where id = p_pago;
end;
$$;

-- ---------- Cerrar caja: arqueo automático ----------
create or replace function public.cerrar_caja(p_caja uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_caja public.cajas;
  v_efectivo numeric; v_transferencia numeric; v_cheques numeric;
  v_canon numeric; v_gastos numeric;
begin
  select * into v_caja from public.cajas where id = p_caja and org_id = v_org for update;
  if not found then raise exception 'Caja inexistente'; end if;
  if v_caja.estado <> 'abierta' then raise exception 'La caja ya está cerrada'; end if;
  if not (
    v_rol = 'tesoreria'
    or (v_rol = 'admin' and v_caja.tipo = 'administracion')
    or (v_rol = 'guardia' and v_caja.tipo = 'guardia')
  ) then
    raise exception 'No tenés permiso para cerrar esta caja';
  end if;

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

  -- el canon entra casi siempre en efectivo; si se cargó otro medio, suma a ese medio
  v_efectivo := v_efectivo + coalesce((select sum(monto) from public.canon_camiones where caja_id = p_caja and medio = 'efectivo'), 0) - v_gastos;
  v_transferencia := v_transferencia + coalesce((select sum(monto) from public.canon_camiones where caja_id = p_caja and medio = 'transferencia'), 0);

  update public.cajas set
    estado = 'cerrada',
    total_efectivo = v_efectivo,
    total_transferencia = v_transferencia,
    total_cheques = v_cheques,
    total_canon = v_canon,
    total_gastos = v_gastos,
    cerrada_por = (select auth.uid()),
    cerrada_en = now()
  where id = p_caja;

  return jsonb_build_object(
    'efectivo', v_efectivo,
    'transferencia', v_transferencia,
    'cheques', v_cheques,
    'canon', v_canon,
    'gastos_pagados', v_gastos
  );
end;
$$;

-- ---------- Validación de tesorería: traspaso de responsabilidad ----------
create or replace function public.validar_caja(p_caja uuid, p_observaciones text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_caja public.cajas;
begin
  if private.rol_actual() <> 'tesoreria' then
    raise exception 'Solo tesorería puede validar cajas';
  end if;
  select * into v_caja from public.cajas where id = p_caja and org_id = v_org for update;
  if not found then raise exception 'Caja inexistente'; end if;
  if v_caja.estado <> 'cerrada' then
    raise exception 'Solo se validan cajas cerradas';
  end if;
  update public.cajas set
    estado = 'validada',
    validada_por = (select auth.uid()),
    validada_en = now(),
    observaciones = coalesce(p_observaciones, observaciones)
  where id = p_caja;
end;
$$;

-- ---------- Generación mensual automática ----------
-- Genera los cargos de cada cliente según sus ítems, con precio congelado.
-- Idempotente: se puede correr dos veces sin duplicar.
create or replace function public.generar_periodo(p_periodo date)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_periodo date := date_trunc('month', p_periodo)::date;
  v_dia int;
  v_venc date;
  v_cargos int := 0;
  v_energia int := 0;
begin
  if v_rol not in ('admin','tesoreria','consejo') then
    raise exception 'No tenés permiso para generar el período';
  end if;

  select dia_vencimiento into v_dia from public.configuracion where org_id = v_org;
  v_dia := coalesce(v_dia, 30);
  v_venc := least(
    (v_periodo + interval '1 month' - interval '1 day')::date,
    make_date(extract(year from v_periodo)::int, extract(month from v_periodo)::int, 1) + (v_dia - 1)
  );

  insert into public.periodos (org_id, periodo, vencimiento, generado_en, generado_por)
  values (v_org, v_periodo, v_venc, now(), (select auth.uid()))
  on conflict (org_id, periodo) do update
    set generado_en = now(), generado_por = (select auth.uid());

  with nuevos as (
    insert into public.cargos (
      org_id, periodo, cliente_id, concepto_id, codigo, descripcion,
      cantidad, precio_unitario, monto, descuento_pronto_pago, vencimiento, origen
    )
    select
      v_org, v_periodo, cc.cliente_id, co.id, co.codigo,
      co.nombre || case when cc.cantidad <> 1 then ' × ' || trim(trailing '.' from trim(trailing '0' from cc.cantidad::text)) else '' end,
      cc.cantidad, co.precio, round(cc.cantidad * co.precio, 2), co.descuento_pronto_pago, v_venc, 'generacion'
    from public.cliente_conceptos cc
    join public.conceptos co on co.id = cc.concepto_id
    join public.clientes cl on cl.id = cc.cliente_id
    where cc.org_id = v_org and cc.activo and co.activo and cl.activo
      and co.tipo = 'recurrente'
      and round(cc.cantidad * co.precio, 2) > 0
    on conflict (cliente_id, concepto_id, periodo) where origen = 'generacion' and estado <> 'anulado'
    do nothing
    returning 1
  )
  select count(*) into v_cargos from nuevos;

  -- cargos de energía por lecturas del período que aún no tienen cargo
  with nuevos_ener as (
    insert into public.cargos (
      org_id, periodo, cliente_id, concepto_id, codigo, descripcion,
      cantidad, precio_unitario, monto, descuento_pronto_pago, vencimiento, origen, origen_lectura
    )
    select
      v_org, v_periodo, m.cliente_id, co.id, co.codigo,
      'Energía · Medidor N° ' || m.numero || ' (' || l.kwh || ' kWh)',
      l.kwh, l.precio_kwh, l.monto, 0, v_venc, 'energia', l.id
    from public.lecturas l
    join public.medidores m on m.id = l.medidor_id
    join public.conceptos co on co.org_id = v_org and co.codigo = 'ENER'
    where l.org_id = v_org and l.periodo = v_periodo and l.monto > 0
      and not exists (select 1 from public.cargos c where c.origen_lectura = l.id)
    returning 1
  )
  select count(*) into v_energia from nuevos_ener;

  return jsonb_build_object('periodo', v_periodo, 'vencimiento', v_venc, 'cargos', v_cargos, 'energia', v_energia);
end;
$$;

-- ---------- Registrar lectura de medidor ----------
-- Crea o corrige la lectura del período y su cargo de energía.
create or replace function public.registrar_lectura(
  p_medidor uuid,
  p_periodo date,
  p_anterior numeric,
  p_actual numeric
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_periodo date := date_trunc('month', p_periodo)::date;
  v_medidor public.medidores;
  v_precio numeric;
  v_lectura_id uuid;
  v_cargo public.cargos;
  v_venc date;
  v_dia int;
begin
  if v_rol not in ('admin','tesoreria','consejo') then
    raise exception 'No tenés permiso para cargar lecturas';
  end if;
  if p_actual < p_anterior then
    raise exception 'La lectura actual no puede ser menor a la anterior';
  end if;

  select * into v_medidor from public.medidores where id = p_medidor and org_id = v_org;
  if not found then raise exception 'Medidor inexistente'; end if;

  select precio into v_precio from public.conceptos where org_id = v_org and codigo = 'ENER';
  if v_precio is null then raise exception 'Falta configurar el precio del kWh (concepto ENER)'; end if;

  select id into v_lectura_id from public.lecturas
  where medidor_id = p_medidor and periodo = v_periodo;

  if v_lectura_id is not null then
    select * into v_cargo from public.cargos where origen_lectura = v_lectura_id;
    if found and v_cargo.monto_pagado > 0 then
      raise exception 'La lectura ya tiene cobros imputados; no se puede corregir';
    end if;
    update public.lecturas set
      lectura_anterior = p_anterior,
      lectura_actual = p_actual,
      precio_kwh = v_precio,
      fecha_lectura = current_date
    where id = v_lectura_id;
  else
    insert into public.lecturas (org_id, medidor_id, periodo, lectura_anterior, lectura_actual, precio_kwh, creado_por)
    values (v_org, p_medidor, v_periodo, p_anterior, p_actual, v_precio, (select auth.uid()))
    returning id into v_lectura_id;
  end if;

  -- vencimiento del período (o calculado si el período aún no existe)
  select vencimiento into v_venc from public.periodos where org_id = v_org and periodo = v_periodo;
  if v_venc is null then
    select dia_vencimiento into v_dia from public.configuracion where org_id = v_org;
    v_dia := coalesce(v_dia, 30);
    v_venc := least(
      (v_periodo + interval '1 month' - interval '1 day')::date,
      make_date(extract(year from v_periodo)::int, extract(month from v_periodo)::int, 1) + (v_dia - 1)
    );
  end if;

  -- crea o actualiza el cargo de energía asociado
  select * into v_cargo from public.cargos where origen_lectura = v_lectura_id;
  if found then
    update public.cargos c set
      cantidad = l.kwh,
      precio_unitario = l.precio_kwh,
      monto = l.monto,
      descripcion = 'Energía · Medidor N° ' || v_medidor.numero || ' (' || l.kwh || ' kWh)',
      estado = case when l.monto = 0 then 'pagado'::public.estado_cargo else 'pendiente'::public.estado_cargo end
    from public.lecturas l
    where c.id = v_cargo.id and l.id = v_lectura_id;
  else
    insert into public.cargos (
      org_id, periodo, cliente_id, concepto_id, codigo, descripcion,
      cantidad, precio_unitario, monto, descuento_pronto_pago, vencimiento, origen, origen_lectura
    )
    select
      v_org, v_periodo, v_medidor.cliente_id, co.id, co.codigo,
      'Energía · Medidor N° ' || v_medidor.numero || ' (' || l.kwh || ' kWh)',
      l.kwh, l.precio_kwh, l.monto, 0, v_venc, 'energia', l.id
    from public.lecturas l
    join public.conceptos co on co.org_id = v_org and co.codigo = 'ENER'
    where l.id = v_lectura_id and l.monto > 0;
  end if;

  return v_lectura_id;
end;
$$;

-- ---------- Flujo de caja (solo tesorería y consejo) ----------
create or replace function public.flujo_caja()
returns jsonb
language plpgsql security definer set search_path = ''
stable
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_inicial_efectivo numeric; v_inicial_banco numeric;
  v_efectivo numeric; v_banco numeric; v_cartera numeric;
begin
  if v_rol not in ('tesoreria','consejo') then
    raise exception 'Solo tesorería y consejo ven el flujo de caja';
  end if;

  select
    coalesce(sum(monto) filter (where medio = 'efectivo'), 0),
    coalesce(sum(monto) filter (where medio = 'transferencia'), 0)
  into v_inicial_efectivo, v_inicial_banco
  from public.saldos_iniciales where org_id = v_org;

  select v_inicial_efectivo
    + coalesce((select sum(monto) from public.pagos where org_id = v_org and not anulado and medio = 'efectivo'), 0)
    + coalesce((select sum(monto) from public.canon_camiones where org_id = v_org and medio = 'efectivo'), 0)
    - coalesce((select sum(monto) from public.gastos where org_id = v_org and estado = 'pagado' and medio_pago = 'efectivo'), 0)
  into v_efectivo;

  select v_inicial_banco
    + coalesce((select sum(monto) from public.pagos where org_id = v_org and not anulado and medio = 'transferencia'), 0)
    + coalesce((select sum(monto) from public.canon_camiones where org_id = v_org and medio = 'transferencia'), 0)
    + coalesce((select sum(monto) from public.cheques where org_id = v_org and estado = 'acreditado'), 0)
    - coalesce((select sum(monto) from public.gastos where org_id = v_org and estado = 'pagado' and medio_pago = 'transferencia'), 0)
    - coalesce((select sum(monto) from public.movimientos_tesoreria where org_id = v_org and tipo in ('impuesto','comision')), 0)
    + coalesce((select sum(case when tipo = 'ajuste' then monto else 0 end) from public.movimientos_tesoreria where org_id = v_org), 0)
  into v_banco;

  select coalesce(sum(monto), 0) into v_cartera
  from public.cheques where org_id = v_org and estado in ('en_cartera','depositado');

  return jsonb_build_object(
    'efectivo', v_efectivo,
    'banco', v_banco,
    'cheques_en_cartera', v_cartera,
    'total', v_efectivo + v_banco + v_cartera
  );
end;
$$;

-- ---------- Reportería: ingresos estimados vs. cobrado por concepto ----------
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
      then (case when current_date <= c.vencimiento
        then round(c.monto * (1 - c.descuento_pronto_pago / 100.0), 2)
        else c.monto end) - c.monto_pagado
      else 0 end) as pendiente
  from public.cargos c
  join public.conceptos co on co.id = c.concepto_id
  where c.org_id = v_org and c.periodo = v_periodo and c.estado <> 'anulado'
  group by c.codigo
  order by min(co.orden_imputacion);
end;
$$;

-- ---------- Reportería: gastos del mes por rubro ----------
create or replace function public.resumen_gastos(p_periodo date)
returns table (
  codigo text,
  nombre text,
  tipo public.tipo_gasto,
  pagado numeric,
  pendiente numeric
)
language plpgsql security definer set search_path = ''
stable
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_periodo date := date_trunc('month', p_periodo)::date;
begin
  if v_rol not in ('admin','tesoreria','consejo') then
    raise exception 'Sin permiso';
  end if;
  return query
  select
    r.codigo,
    max(r.nombre) as nombre,
    g.tipo,
    coalesce(sum(g.monto) filter (where g.estado = 'pagado'), 0) as pagado,
    coalesce(sum(g.monto) filter (where g.estado = 'pendiente'), 0) as pendiente
  from public.gastos g
  join public.rubros_gasto r on r.id = g.rubro_id
  where g.org_id = v_org and g.estado <> 'anulado'
    and date_trunc('month', coalesce(g.fecha_pago, g.vencimiento, g.creado_en::date))::date = v_periodo
  group by r.codigo, g.tipo
  order by r.codigo;
end;
$$;

-- ---------- Permisos de ejecución ----------
revoke execute on all functions in schema public from anon, public;
grant execute on function public.abrir_caja(public.tipo_caja) to authenticated;
grant execute on function public.registrar_pago(uuid, numeric, public.medio_pago, uuid, jsonb, text) to authenticated;
grant execute on function public.anular_pago(uuid, text) to authenticated;
grant execute on function public.cerrar_caja(uuid) to authenticated;
grant execute on function public.validar_caja(uuid, text) to authenticated;
grant execute on function public.generar_periodo(date) to authenticated;
grant execute on function public.registrar_lectura(uuid, date, numeric, numeric) to authenticated;
grant execute on function public.flujo_caja() to authenticated;
grant execute on function public.resumen_conceptos(date) to authenticated;
grant execute on function public.resumen_gastos(date) to authenticated;
