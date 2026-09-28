-- ============================================================
-- Mercado San Miguel — 0021 Fase 3: Mapa, facturación, energía y reportes (M9)
-- Contrato: docs/FASE3-CONTRATO.md §4.12 (C3, C6, I1, G11, J5, J7) y §6 M9.
--
-- Cuerpos de las funciones de M9, con la firma EXACTA que dejaron 0012 (editar_espacio)
-- y 0008 (generar_periodo, registrar_lectura, resumen_conceptos):
--   · public.editar_espacio(p_espacio uuid, p_numero text, p_medio boolean, p_nota text,
--       p_propio boolean default null) returns void                     (admin, lider)
--   · public.generar_periodo(p_periodo date) returns jsonb               (admin, lider, consejo)
--   · public.registrar_lectura(p_medidor uuid, p_periodo date, p_anterior numeric,
--       p_actual numeric) returns uuid                                   (admin, lider, consejo)
--   · public.resumen_conceptos(p_periodo date) returns table(codigo, nombre, estimado,
--       cobrado, descuentos, pendiente)                                  (admin, guardia, tesoreria, lider, consejo)
--   · private.generar_abonos_energia(p_org uuid, p_periodo date, p_venc date) returns integer (nueva)
--
-- Reglas §4.0 aplicadas:
--   · Bloqueos: generar_periodo y registrar_lectura se serializan por (org, período) con un
--     candado de transacción (la ENER de una lectura la crean las dos); registrar_lectura
--     bloquea al cliente ANTES de tocar sus cargos (cliente → cargos, §4.0-1/2) y bloquea el
--     cargo ENER antes de mirar monto_pagado (un cobro en paralelo no se cuela).
--     private.aplicar_saldo_favor ya bloquea al cliente (0012).
--   · Idempotencia: los cargos de generación van con `on conflict … do nothing` sobre
--     cargos_generacion_unq; volver a generar solo agrega lo que falta (ABEN de medidores nuevos).
--   · RETURNS TABLE (resumen_conceptos): `#variable_conflict use_column` (§4.0-7).
--
-- Ninguna función de acá llama a funciones de otro módulo (solo helpers de Fundación:
-- private.org_actual, private.rol_actual, private.tiene_rol, private.hoy_ar,
-- private.aplicar_saldo_favor). Idempotente: create or replace + revoke/grant.
-- Se aplica como UNA transacción, en la ventana de mantenimiento (§0.3, paso 5):
-- saca a Tesorería de generar_periodo y registrar_lectura (J5).
-- ============================================================


-- ------------------------------------------------------------
-- 1. Puesto propio de la cooperativa (C3)
--    Misma regla que medio: solo tipo puesto. p_propio null = no se toca (la app de
--    fase 2 manda 4 parámetros y sigue funcionando).
-- ------------------------------------------------------------
create or replace function public.editar_espacio(
  p_espacio uuid,
  p_numero text,
  p_medio boolean,
  p_nota text,
  p_propio boolean default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_numero text := nullif(trim(coalesce(p_numero, '')), '');
  v_nota text := nullif(trim(coalesce(p_nota, '')), '');
  v_tipo text;
begin
  if v_org is null then
    raise exception 'Sin perfil activo';
  end if;
  if not private.tiene_rol(v_org, array['admin','lider']::public.rol_usuario[]) then
    raise exception 'Solo Administración y el Líder de Procesos editan el plano';
  end if;

  select e.tipo into v_tipo
    from public.espacios e
   where e.id = p_espacio and e.org_id = v_org
     for update;
  if not found then
    raise exception 'El puesto no existe. Recargá la página y probá de nuevo';
  end if;

  if length(v_numero) > 12 then
    raise exception 'El número puede tener hasta 12 caracteres';
  end if;
  if length(v_nota) > 60 then
    raise exception 'La nota puede tener hasta 60 caracteres';
  end if;
  if coalesce(p_propio, false) and v_tipo <> 'puesto' then
    raise exception 'Solo un puesto puede ser propio de la cooperativa';
  end if;

  update public.espacios
     set numero = v_numero,
         medio = coalesce(p_medio, false) and v_tipo = 'puesto',
         propio = coalesce(p_propio, propio) and v_tipo = 'puesto',
         nota = v_nota,
         actualizado_por = (select auth.uid()),
         actualizado_en = now()
   where id = p_espacio;
end $$;
revoke all on function public.editar_espacio(uuid, text, boolean, text, boolean) from public, anon;
grant execute on function public.editar_espacio(uuid, text, boolean, text, boolean) to authenticated;
comment on function public.editar_espacio(uuid, text, boolean, text, boolean) is
  'M9 · Corrige número, medio puesto, nota y "puesto propio" (C3; solo puestos) de un espacio del plano. Admin y Líder.';


-- ------------------------------------------------------------
-- 2. Abono mensual de energía (I1)
--    Un cargo ABEN por cliente activo con al menos un medidor activo, salvo que tenga la
--    fila ABEN de cliente_conceptos con activo = false ("Eximir del abono"). Cantidad: la de
--    su fila activa si la tiene (p. ej. 2 abonos), si no 1. Origen 'generacion' (cuenta en
--    v_avance_mes). Idempotente por cargos_generacion_unq: solo agrega lo que falta.
--    La llama generar_periodo (security definer); el guard interno impide usarla para otra
--    organización o sin rol de facturación aunque alguien llegue a ejecutarla directo.
-- ------------------------------------------------------------
create or replace function private.generar_abonos_energia(p_org uuid, p_periodo date, p_venc date)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_n integer := 0;
begin
  if p_org is null or p_org is distinct from private.org_actual()
     or not private.tiene_rol(p_org, array['admin','lider','consejo']::public.rol_usuario[]) then
    raise exception 'No tenés permiso para generar el período';
  end if;
  if p_periodo is null or p_venc is null then
    raise exception 'Falta el período o el vencimiento';
  end if;

  insert into public.cargos (
    org_id, periodo, cliente_id, concepto_id, codigo, descripcion,
    cantidad, precio_unitario, monto, descuento_pronto_pago, vencimiento, origen
  )
  select
    p_org, date_trunc('month', p_periodo)::date, cl.id, co.id, co.codigo,
    co.nombre || case when coalesce(cc.cantidad, 1) <> 1
      then ' × ' || trim(trailing '.' from trim(trailing '0' from cc.cantidad::text)) else '' end,
    coalesce(cc.cantidad, 1), co.precio, round(coalesce(cc.cantidad, 1) * co.precio, 2),
    co.descuento_pronto_pago, p_venc, 'generacion'
  from public.clientes cl
  join public.conceptos co
    on co.org_id = p_org and co.codigo = 'ABEN' and co.activo
  left join public.cliente_conceptos cc
    on cc.cliente_id = cl.id and cc.concepto_id = co.id
  where cl.org_id = p_org
    and cl.activo
    and coalesce(cc.activo, true)                       -- fila inactiva = exento
    and round(coalesce(cc.cantidad, 1) * co.precio, 2) > 0
    and exists (
      select 1 from public.medidores m
       where m.cliente_id = cl.id and m.org_id = p_org and m.activo)
  on conflict (cliente_id, concepto_id, periodo) where origen = 'generacion' and estado <> 'anulado'
  do nothing;

  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function private.generar_abonos_energia(uuid, date, date) from public, anon;
grant execute on function private.generar_abonos_energia(uuid, date, date) to authenticated;
comment on function private.generar_abonos_energia(uuid, date, date) is
  'M9 · I1: un cargo ABEN por cliente activo con medidor activo (exento si su fila ABEN está inactiva). Idempotente. La llama generar_periodo.';


-- ------------------------------------------------------------
-- 3. Generación mensual (J5: Tesorería sale; I1: abono de energía)
--    Recurrentes → abonos de energía → consumo (lecturas ya cargadas) → saldo a favor.
--    Retorno: {periodo, vencimiento, cargos, abonos, energia, saldo_favor_aplicado}.
--    "cargos" son los recurrentes; "abonos" los ABEN nuevos; "energia" los consumos.
-- ------------------------------------------------------------
create or replace function public.generar_periodo(p_periodo date)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_periodo date;
  v_dia int;
  v_venc date;
  v_cargos int := 0;
  v_abonos int := 0;
  v_energia int := 0;
  v_cli uuid;
  v_saldos numeric := 0;
begin
  if v_org is null or v_rol is null then
    raise exception 'Sin perfil activo';
  end if;
  if v_rol not in ('admin','consejo','lider') then
    raise exception 'No tenés permiso para generar el período';
  end if;
  if p_periodo is null then
    raise exception 'Elegí el mes que querés generar';
  end if;
  v_periodo := date_trunc('month', p_periodo)::date;

  -- Una generación (o una lectura) del mismo mes a la vez: la segunda espera y solo agrega
  -- lo que falte. Sin esto, dos "Generar" simultáneos podían chocar en el índice de lecturas.
  perform pg_advisory_xact_lock(hashtextextended('generar_periodo:' || v_org::text || ':' || v_periodo::text, 0));

  select c.dia_vencimiento into v_dia from public.configuracion c where c.org_id = v_org;
  v_dia := coalesce(v_dia, 30);
  v_venc := least(
    (v_periodo + interval '1 month' - interval '1 day')::date,
    make_date(extract(year from v_periodo)::int, extract(month from v_periodo)::int, 1) + (v_dia - 1)
  );

  insert into public.periodos (org_id, periodo, vencimiento, generado_en, generado_por)
  values (v_org, v_periodo, v_venc, now(), (select auth.uid()))
  on conflict (org_id, periodo) do update
    set generado_en = now(), generado_por = (select auth.uid());

  -- Recurrentes (expensas, cocheras, quinta…): precio y beneficio congelados.
  with nuevos as (
    insert into public.cargos (
      org_id, periodo, cliente_id, concepto_id, codigo, descripcion,
      cantidad, precio_unitario, monto, descuento_pronto_pago, vencimiento, origen
    )
    select
      v_org, v_periodo, cc.cliente_id, co.id, co.codigo,
      co.nombre || case when cc.cantidad <> 1
        then ' × ' || trim(trailing '.' from trim(trailing '0' from cc.cantidad::text)) else '' end,
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

  -- Abono mensual de energía (I1): a todo cliente con medidor activo, salvo exentos.
  v_abonos := private.generar_abonos_energia(v_org, v_periodo, v_venc);

  -- Consumo de las lecturas ya cargadas del mes que todavía no tienen cargo.
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

  -- Saldos a favor: se aplican solos a los cargos recién generados (aplicar_saldo_favor
  -- bloquea a cada cliente antes de imputar, §4.0-2).
  for v_cli in
    select p.cliente_id
    from public.pagos p
    where p.org_id = v_org and not p.anulado
    group by p.cliente_id
    having sum(p.monto) - coalesce((
      select sum(i.monto) from public.imputaciones i join public.pagos p2 on p2.id = i.pago_id
      where p2.cliente_id = p.cliente_id and not p2.anulado), 0) > 0.009
  loop
    v_saldos := v_saldos + private.aplicar_saldo_favor(v_cli);
  end loop;

  return jsonb_build_object(
    'periodo', v_periodo,
    'vencimiento', v_venc,
    'cargos', v_cargos,
    'abonos', v_abonos,
    'energia', v_energia,
    'saldo_favor_aplicado', v_saldos
  );
end $$;
revoke all on function public.generar_periodo(date) from public, anon;
grant execute on function public.generar_periodo(date) to authenticated;
comment on function public.generar_periodo(date) is
  'M9 · Genera los cargos del mes (recurrentes, abono de energía ABEN y consumo de lecturas) y aplica saldos a favor. Idempotente. Admin y Líder (J5: Tesorería no).';


-- ------------------------------------------------------------
-- 4. Lecturas de energía (J5: Tesorería sale). Sin ABEN (§1.2-11): si se agrega un
--    medidor después de generar el mes, se vuelve a generar el período.
-- ------------------------------------------------------------
create or replace function public.registrar_lectura(
  p_medidor uuid,
  p_periodo date,
  p_anterior numeric,
  p_actual numeric
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
  v_periodo date;
  v_medidor public.medidores;
  v_precio numeric;
  v_lectura_id uuid;
  v_cargo public.cargos;
  v_venc date;
  v_dia int;
begin
  if v_org is null or v_rol is null then
    raise exception 'Sin perfil activo';
  end if;
  if v_rol not in ('admin','consejo','lider') then
    raise exception 'No tenés permiso para cargar lecturas';
  end if;
  if p_periodo is null then
    raise exception 'Elegí el mes de la lectura';
  end if;
  v_periodo := date_trunc('month', p_periodo)::date;
  if v_periodo > date_trunc('month', v_hoy)::date then
    raise exception 'No se cargan lecturas de meses que todavía no empezaron';
  end if;
  if p_anterior is null then
    raise exception 'Poné la lectura anterior del medidor';
  end if;
  if p_actual is null then
    raise exception 'Poné la lectura actual del medidor';
  end if;
  if p_anterior < 0 or p_actual < 0 then
    raise exception 'Las lecturas no pueden ser negativas';
  end if;
  if p_actual < p_anterior then
    raise exception 'La lectura actual no puede ser menor a la anterior';
  end if;

  select * into v_medidor from public.medidores where id = p_medidor and org_id = v_org;
  if not found then
    raise exception 'Medidor inexistente';
  end if;

  select c.precio into v_precio from public.conceptos c where c.org_id = v_org and c.codigo = 'ENER';
  if v_precio is null then
    raise exception 'Falta configurar el precio del kWh (concepto ENER)';
  end if;

  -- Mismo candado que generar_periodo (las dos crean la ENER de una lectura) y después el
  -- cliente: cliente → cargos (§4.0-1/2), así un cobro en paralelo no ve un cargo a medio corregir.
  perform pg_advisory_xact_lock(hashtextextended('generar_periodo:' || v_org::text || ':' || v_periodo::text, 0));
  perform 1 from public.clientes cl where cl.id = v_medidor.cliente_id and cl.org_id = v_org for update;

  select l.id into v_lectura_id from public.lecturas l
   where l.medidor_id = p_medidor and l.periodo = v_periodo
     for update;

  if v_lectura_id is not null then
    select * into v_cargo from public.cargos c where c.origen_lectura = v_lectura_id for update;
    if found and v_cargo.monto_pagado > 0 then
      raise exception 'La lectura ya tiene cobros imputados; no se puede corregir';
    end if;
    update public.lecturas set
      lectura_anterior = p_anterior,
      lectura_actual = p_actual,
      precio_kwh = v_precio,
      fecha_lectura = v_hoy
    where id = v_lectura_id;
  else
    insert into public.lecturas (org_id, medidor_id, periodo, lectura_anterior, lectura_actual, precio_kwh, creado_por)
    values (v_org, p_medidor, v_periodo, p_anterior, p_actual, v_precio, (select auth.uid()))
    returning id into v_lectura_id;
  end if;

  select p.vencimiento into v_venc from public.periodos p where p.org_id = v_org and p.periodo = v_periodo;
  if v_venc is null then
    select c.dia_vencimiento into v_dia from public.configuracion c where c.org_id = v_org;
    v_dia := coalesce(v_dia, 30);
    v_venc := least(
      (v_periodo + interval '1 month' - interval '1 day')::date,
      make_date(extract(year from v_periodo)::int, extract(month from v_periodo)::int, 1) + (v_dia - 1)
    );
  end if;

  select * into v_cargo from public.cargos c where c.origen_lectura = v_lectura_id;
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

  perform private.aplicar_saldo_favor(v_medidor.cliente_id);
  return v_lectura_id;
end $$;
revoke all on function public.registrar_lectura(uuid, date, numeric, numeric) from public, anon;
grant execute on function public.registrar_lectura(uuid, date, numeric, numeric) to authenticated;
comment on function public.registrar_lectura(uuid, date, numeric, numeric) is
  'M9 · Alta o corrección de la lectura de un medidor y su cargo ENER (falla si ya tiene cobros). Sin abono (§1.2-11). Admin y Líder (J5).';


-- ------------------------------------------------------------
-- 5. Resumen por concepto del mes (reportes, facturación, inicio, balance)
--    Bloque 1: cargos del mes por código (AMB, ABEN, MULT, EXME y EXPP salen solos). Para el
--    Jefe de Portería, solo cargos de quinteros y ambulantes.
--    Bloque 2: UNA fila BC (bono camioneros) = canon de transporte del mes SIN anulados, con el
--    nombre del concepto BC. Se acabaron BA y BQ (G9: ambulantes y quinteros por día no son canon).
-- ------------------------------------------------------------
create or replace function public.resumen_conceptos(p_periodo date)
returns table (
  codigo text,
  nombre text,
  estimado numeric,
  cobrado numeric,
  descuentos numeric,
  pendiente numeric
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_periodo date;
  v_hasta date;
  v_hoy date := private.hoy_ar();
  v_canon numeric := 0;
  v_nombre_bc text;
begin
  if v_org is null or v_rol is null then
    raise exception 'Sin perfil activo';
  end if;
  if v_rol not in ('admin','guardia','tesoreria','consejo','lider') then
    raise exception 'Sin permiso';
  end if;
  if p_periodo is null then
    raise exception 'Elegí el mes';
  end if;
  v_periodo := date_trunc('month', p_periodo)::date;
  v_hasta := (v_periodo + interval '1 month')::date;

  return query
  select
    c.codigo::text,
    max(co.nombre)::text,
    sum(c.monto),
    sum(c.monto_pagado),
    sum(c.descuento_aplicado),
    sum(case when c.estado in ('pendiente','parcial')
      then (case when v_hoy <= c.vencimiento
        then round(c.monto * (1 - c.descuento_pronto_pago / 100.0), 2)
        else c.monto end) - c.monto_pagado
      else 0 end)
  from public.cargos c
  join public.conceptos co on co.id = c.concepto_id
  join public.clientes cl on cl.id = c.cliente_id
  where c.org_id = v_org
    and c.periodo = v_periodo
    and c.estado <> 'anulado'
    and (v_rol <> 'guardia' or cl.categoria in ('quintero','ambulante'))
  group by c.codigo
  order by min(co.orden_imputacion), c.codigo;

  select coalesce(sum(cc.monto), 0) into v_canon
    from public.canon_camiones cc
   where cc.org_id = v_org
     and cc.fecha >= v_periodo and cc.fecha < v_hasta
     and not cc.anulado;

  if v_canon > 0 then
    select co.nombre into v_nombre_bc from public.conceptos co where co.org_id = v_org and co.codigo = 'BC';
    return query
    select 'BC'::text, coalesce(nullif(trim(v_nombre_bc), ''), 'Bono camioneros')::text,
           v_canon, v_canon, 0::numeric, 0::numeric;
  end if;
end $$;
revoke all on function public.resumen_conceptos(date) from public, anon;
grant execute on function public.resumen_conceptos(date) to authenticated;
comment on function public.resumen_conceptos(date) is
  'M9 · Estimado/cobrado/beneficios/pendiente por código del mes + una fila BC (canon de transporte sin anulados). Jefe: solo quinteros y ambulantes.';


-- ------------------------------------------------------------
-- Pedidos a Fundación: ninguno de SQL. Las lecturas que usa M9 ya están en 0011/0022:
--   espacios ("leer espacios" sin guardia/porteria), espacios_del_plano() para el Jefe,
--   medidores.espacio_id + trigger medidores_valida_espacio, v_avance_mes, tarifas y canon.
-- Nota para el ingeniero: re-correr supabase/plano/plano_mercado.sql (DELETE + INSERT de
-- espacios) borraría `propio` y los espacio_id de medidores/solicitudes/canon/sanciones (§8).
-- ------------------------------------------------------------
