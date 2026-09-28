-- ============================================================
-- Mercado San Miguel — 0024 Fase 3: arreglos de Clientes, Mapa y Facturación
-- (revisión de UX del 28/09). Contrato: docs/FASE3-CONTRATO.md §4.0, §4.7, §4.12.
--
-- Idempotente (create or replace / if not exists / drop … if exists). UNA transacción.
-- Va después de 0023 (usa imputaciones.origen; ver sección 0) y ANTES del deploy del código
-- (la ficha lee cargos.creado_por/anulado_* y Energía/Reportes/Inicio usan las RPC nuevas).
--
--   1. private.aplicar_cambio (misma firma, cuerpo de 0016 + lo nuevo):
--      · Cambio de categoría: deja de facturar (activo = false, la fila queda y se puede
--        volver a prender desde "Qué paga") los conceptos MENSUALES que la categoría nueva
--        no tiene: ambulante → todos (se le cobra por día); quintero → los que no son de
--        quinteros; puestero → los de quinteros/ambulantes. Es la misma regla que usa la
--        ficha para ofrecer conceptos. Energía (ABEN/ENER) no se toca.
--      · Pasar a ambulante: además libera sus lugares del plano (el mapa no muestra
--        ambulantes: quedaban "ocupados" por nadie), deja cuotas_mes = 1 (como el alta) y
--        desactiva sus medidores (abono + consumo; se desatan del lugar liberado).
--      · Lo mensual activo tiene que corresponder a la categoría ACTUAL (un pedido que
--        esperaba aprobación y llega después del cambio de categoría: EXPQ a un puestero,
--        EXME a un quintero, cualquier mensual a un ambulante): mensaje humano.
--        El alta de un ambulante no carga conceptos aunque vengan en el pedido.
--   2. public.generar_periodo (cuerpo de 0021): red de seguridad, los recurrentes no se
--      generan a ambulantes. 2b. private.generar_abonos_energia (cuerpo de 0021): el
--      abono de energía tampoco.
--   3. cargos.creado_por (default auth.uid(), sin grant: no se puede falsificar) y rastro
--      de anulación (anulado_por / anulado_en / anulado_motivo).
--      public.anular_cargo_manual(p_cargo, p_motivo): anula una deuda anterior (RD) o un
--      cargo manual cargado por error. Admin (sobre sus clientes) y Líder. Lo que se tomó
--      solo del saldo a favor se devuelve; lo cobrado en caja exige anular ese cobro.
--   4. public.sumar_abonos_energia(p_periodo): SOLO los abonos de energía que faltan del
--      mes en curso (medidores cargados después de generar). No genera expensas ni pisa
--      quién generó el período (antes Energía llamaba a generar_periodo entero).
--   5. public.cobranza_diaria(p_desde, p_hasta): cobros + bono camioneros por día, sumados
--      en SQL (el gráfico de Reportes y la serie de 14 días del Inicio se cortaban en las
--      1000 filas de PostgREST).
--   6. public.ultimas_lecturas(p_antes): última lectura de cada medidor antes de un mes
--      (Energía y la planilla del electricista traían todo el historial, con el mismo tope).
--      6b. public.lugares_del_cliente(p_cliente): lugares del plano de un cliente que el
--      rol gestiona (el Jefe no lee espacios): qué se libera al pasarlo a ambulante.
--   7. Datos: ambulantes sin conceptos mensuales activos ni medidores activos, y lugares
--      del plano sin dueño inactivo/ambulante (lo que dejó el comportamiento anterior).
-- ============================================================


-- ------------------------------------------------------------
-- 0. imputaciones.origen lo crea 0023. Red de seguridad por si esta migración corre sin
--    0023 (misma columna, mismo default). Si 0023 ya corrió, no hace nada.
-- ------------------------------------------------------------
alter table public.imputaciones add column if not exists origen text not null default 'cobro';


-- ------------------------------------------------------------
-- 1. private.aplicar_cambio (misma firma que 0008/0016)
-- ------------------------------------------------------------
create or replace function private.aplicar_cambio(p_cambio public.cambios_pendientes) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  d jsonb := p_cambio.datos;
  v_id uuid := p_cambio.entidad_id;
  v_item jsonb;
  v_existente uuid;
  v_categoria public.categoria_cliente;
  v_cat_anterior public.categoria_cliente;
  v_cuotas integer;
begin
  if p_cambio.entidad = 'cliente' then
    if p_cambio.accion = 'alta' then
      v_categoria := coalesce((d->>'categoria')::public.categoria_cliente, 'puestero');
      -- Quintero sin cuotas elegidas: las que configuró el Jefe (G7). Ambulante: se le cobra por día.
      v_cuotas := case
        when v_categoria = 'ambulante' then 1
        when d ? 'cuotas_mes' and d->'cuotas_mes' <> 'null'::jsonb then (d->>'cuotas_mes')::int
        when v_categoria = 'quintero' then coalesce((
          select cf.cuotas_default_quintero from public.configuracion cf where cf.org_id = p_cambio.org_id), 4)
        else 1
      end;
      insert into public.clientes (org_id, codigo, nombre, apodo, tipo_persona, cuit, telefono, email,
                                   direccion, notas, cuotas_mes, categoria, es_socio)
      values (
        p_cambio.org_id,
        (d->>'codigo')::int,
        trim(d->>'nombre'),
        nullif(trim(d->>'apodo'), ''),
        coalesce((d->>'tipo_persona')::public.tipo_persona, 'fisica'),
        nullif(trim(d->>'cuit'), ''), nullif(trim(d->>'telefono'), ''), nullif(trim(d->>'email'), ''),
        nullif(trim(d->>'direccion'), ''), nullif(trim(d->>'notas'), ''),
        v_cuotas,
        v_categoria,
        v_categoria <> 'ambulante' and coalesce((d->>'es_socio')::boolean, false)
      ) returning id into v_id;
      -- El ambulante no tiene conceptos mensuales (se le cobra por día): si vinieran, no se cargan.
      for v_item in select * from jsonb_array_elements(coalesce(d->'conceptos', '[]'::jsonb)) loop
        insert into public.cliente_conceptos (org_id, cliente_id, concepto_id, cantidad, activo)
        select p_cambio.org_id, v_id, (v_item->>'concepto_id')::uuid,
               coalesce((v_item->>'cantidad')::numeric, 1), true
        where v_categoria <> 'ambulante'
          and exists (select 1 from public.conceptos co
                      where co.id = (v_item->>'concepto_id')::uuid and co.org_id = p_cambio.org_id)
        on conflict (cliente_id, concepto_id) do update set cantidad = excluded.cantidad, activo = true;
      end loop;
    elsif p_cambio.accion = 'modificacion' then
      select c.categoria into v_cat_anterior
      from public.clientes c where c.id = v_id and c.org_id = p_cambio.org_id
      for update;

      update public.clientes set
        codigo       = case when d ? 'codigo' then (d->>'codigo')::int else codigo end,
        nombre       = case when d ? 'nombre' then trim(d->>'nombre') else nombre end,
        apodo        = case when d ? 'apodo' then nullif(trim(d->>'apodo'), '') else apodo end,
        tipo_persona = case when d ? 'tipo_persona' then (d->>'tipo_persona')::public.tipo_persona else tipo_persona end,
        cuit         = case when d ? 'cuit' then nullif(trim(d->>'cuit'), '') else cuit end,
        telefono     = case when d ? 'telefono' then nullif(trim(d->>'telefono'), '') else telefono end,
        email        = case when d ? 'email' then nullif(trim(d->>'email'), '') else email end,
        direccion    = case when d ? 'direccion' then nullif(trim(d->>'direccion'), '') else direccion end,
        notas        = case when d ? 'notas' then nullif(trim(d->>'notas'), '') else notas end,
        cuotas_mes   = case when d ? 'cuotas_mes' then (d->>'cuotas_mes')::int else cuotas_mes end,
        activo       = case when d ? 'activo' then (d->>'activo')::boolean else activo end,
        categoria    = case when d ? 'categoria' then (d->>'categoria')::public.categoria_cliente else categoria end,
        es_socio     = case when d ? 'es_socio' then (d->>'es_socio')::boolean else es_socio end
      where id = v_id and org_id = p_cambio.org_id;

      -- Cambio de categoría: lo mensual que la categoría nueva no tiene deja de facturarse
      -- (misma regla que la ficha usa para ofrecer conceptos). La fila queda (inactiva).
      v_categoria := case when d ? 'categoria' then (d->>'categoria')::public.categoria_cliente end;
      if v_categoria is not null and v_cat_anterior is not null and v_categoria <> v_cat_anterior then
        update public.cliente_conceptos cc set activo = false
        from public.conceptos co
        where co.id = cc.concepto_id
          and cc.cliente_id = v_id and cc.org_id = p_cambio.org_id
          and cc.activo
          and co.tipo = 'recurrente'
          and case v_categoria
                when 'ambulante' then true
                when 'quintero'  then coalesce(co.segmento, '') <> 'quinteros'
                else coalesce(co.segmento, '') in ('quinteros', 'ambulantes')
              end;

        if v_categoria = 'ambulante' then
          -- Se le cobra por día: sin cuotas y sin lugar en el plano (el mapa no muestra ambulantes).
          update public.clientes set cuotas_mes = 1
          where id = v_id and org_id = p_cambio.org_id and cuotas_mes <> 1;
          update public.espacios set cliente_id = null, asignado_en = null, actualizado_en = now()
          where cliente_id = v_id and org_id = p_cambio.org_id;
          -- Sus medidores dejan de facturarse (abono y consumo) y de salir en la planilla del
          -- electricista, y se desatan del lugar que acaba de liberar. Se pueden reactivar
          -- desde Energía si hiciera falta (los ambulantes no pagan abono: ver sección 2b).
          update public.medidores set activo = false, espacio_id = null
          where cliente_id = v_id and org_id = p_cambio.org_id
            and (activo or espacio_id is not null);
        end if;
      end if;
    elsif p_cambio.accion = 'baja' then
      update public.clientes set activo = false where id = v_id and org_id = p_cambio.org_id;
    end if;

  elsif p_cambio.entidad = 'cliente_concepto' then
    if p_cambio.accion = 'alta' then
      -- `activo` (default true): "Eximir del abono" es un alta de ABEN con activo = false.
      select id into v_existente from public.cliente_conceptos
      where cliente_id = (d->>'cliente_id')::uuid and concepto_id = (d->>'concepto_id')::uuid;
      if v_existente is not null then
        update public.cliente_conceptos set
          cantidad = coalesce((d->>'cantidad')::numeric, cantidad),
          notas = coalesce(nullif(trim(d->>'notas'), ''), notas),
          activo = coalesce((d->>'activo')::boolean, true)
        where id = v_existente;
        v_id := v_existente;
      else
        insert into public.cliente_conceptos (org_id, cliente_id, concepto_id, cantidad, notas, activo)
        values (p_cambio.org_id, (d->>'cliente_id')::uuid, (d->>'concepto_id')::uuid,
                coalesce((d->>'cantidad')::numeric, 1), nullif(trim(d->>'notas'), ''),
                coalesce((d->>'activo')::boolean, true))
        returning id into v_id;
      end if;
    elsif p_cambio.accion = 'modificacion' then
      update public.cliente_conceptos set
        cantidad = case when d ? 'cantidad' then (d->>'cantidad')::numeric else cantidad end,
        activo   = case when d ? 'activo' then (d->>'activo')::boolean else activo end,
        notas    = case when d ? 'notas' then nullif(trim(d->>'notas'), '') else notas end
      where id = v_id and org_id = p_cambio.org_id;
    elsif p_cambio.accion = 'baja' then
      update public.cliente_conceptos set activo = false where id = v_id and org_id = p_cambio.org_id;
    end if;

    -- Lo mensual tiene que corresponder a la categoría ACTUAL del cliente (misma regla que el
    -- cambio de categoría de arriba y que la ficha): un pedido que esperaba aprobación y
    -- llega después de un cambio de categoría (EXPQ a quien ya es puestero, EXME a quien ya
    -- es quintero, cualquier mensual a un ambulante) se rechaza en vez de dejar una deuda
    -- que ni Administración ni el Jefe podrían sacar.
    select cl.categoria into v_categoria
    from public.cliente_conceptos cc
    join public.conceptos co on co.id = cc.concepto_id
    join public.clientes cl on cl.id = cc.cliente_id
    where cc.id = v_id and cc.activo and co.tipo = 'recurrente'
      and case cl.categoria
            when 'ambulante' then true
            when 'quintero'  then coalesce(co.segmento, '') <> 'quinteros'
            else coalesce(co.segmento, '') in ('quinteros', 'ambulantes')
          end;
    if v_categoria = 'ambulante' then
      raise exception 'Este cliente ahora es ambulante: se le cobra por día y no paga conceptos mensuales. Rechazá este cambio.';
    elsif v_categoria is not null then
      raise exception 'Este cliente ahora es %: ese concepto ya no le corresponde. Rechazá este cambio.', v_categoria;
    end if;

  elsif p_cambio.entidad = 'concepto' then
    if p_cambio.accion = 'alta' then
      insert into public.conceptos (org_id, codigo, nombre, tipo, precio, orden_imputacion,
                                    descuento_pronto_pago, activo, segmento)
      values (p_cambio.org_id, d->>'codigo', d->>'nombre',
              coalesce((d->>'tipo')::public.tipo_concepto, 'recurrente'),
              coalesce((d->>'precio')::numeric, 0), coalesce((d->>'orden_imputacion')::int, 100),
              coalesce((d->>'descuento_pronto_pago')::numeric, 0), coalesce((d->>'activo')::boolean, true),
              nullif(d->>'segmento', ''))
      returning id into v_id;
    elsif p_cambio.accion = 'modificacion' then
      update public.conceptos set
        nombre = case when d ? 'nombre' then d->>'nombre' else nombre end,
        precio = case when d ? 'precio' then (d->>'precio')::numeric else precio end,
        orden_imputacion = case when d ? 'orden_imputacion' then (d->>'orden_imputacion')::int else orden_imputacion end,
        descuento_pronto_pago = case when d ? 'descuento_pronto_pago' then (d->>'descuento_pronto_pago')::numeric else descuento_pronto_pago end,
        activo = case when d ? 'activo' then (d->>'activo')::boolean else activo end,
        segmento = case when d ? 'segmento' then nullif(d->>'segmento', '') else segmento end
      where id = v_id and org_id = p_cambio.org_id;
    elsif p_cambio.accion = 'baja' then
      update public.conceptos set activo = false where id = v_id and org_id = p_cambio.org_id;
    end if;
  end if;
  return v_id;
end;
$$;
revoke all on function private.aplicar_cambio(public.cambios_pendientes) from public, anon;
grant execute on function private.aplicar_cambio(public.cambios_pendientes) to authenticated;


-- ------------------------------------------------------------
-- 2. generar_periodo (cuerpo de 0021): los recurrentes no se generan a ambulantes.
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
  -- 0024: nunca a un ambulante (se le cobra por día, aunque le haya quedado una fila activa).
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
      and cl.categoria <> 'ambulante'
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
  'M9 · Genera los cargos del mes (recurrentes —nunca a ambulantes—, abono de energía ABEN y consumo de lecturas) y aplica saldos a favor. Idempotente. Admin y Líder (J5: Tesorería no).';


-- ------------------------------------------------------------
-- 2b. private.generar_abonos_energia (misma firma y cuerpo que 0021): el abono mensual
--     tampoco se genera a ambulantes (se les cobra por día; al pasar a ambulante sus
--     medidores se desactivan, esto es la red de seguridad si alguno se reactiva).
--     La usan generar_periodo y sumar_abonos_energia.
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
    and cl.categoria <> 'ambulante'                     -- 0024: se les cobra por día
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
  'M9 · I1: un cargo ABEN por cliente activo con medidor activo (exento si su fila ABEN está inactiva; nunca a ambulantes, 0024). Idempotente. La llaman generar_periodo y sumar_abonos_energia.';


-- ------------------------------------------------------------
-- 3. Autoría y anulación de cargos cargados a mano (RD / manual)
--    creado_por: default auth.uid(). No está en el grant de INSERT de 0022 (solo columnas
--    de negocio), así que nadie lo puede falsificar. Las filas viejas quedan en null.
--    anulado_*: rastro de anular_cargo_manual (§4.0-8); sin grant de UPDATE para nadie.
-- ------------------------------------------------------------
alter table public.cargos add column if not exists creado_por uuid references auth.users(id) on delete set null;
alter table public.cargos alter column creado_por set default auth.uid();
alter table public.cargos add column if not exists anulado_por uuid references auth.users(id) on delete set null;
alter table public.cargos add column if not exists anulado_en timestamptz;
alter table public.cargos add column if not exists anulado_motivo text;
comment on column public.cargos.creado_por is 'Quién lo cargó (default auth.uid(); en la deuda anterior es quien la registró).';
comment on column public.cargos.anulado_motivo is 'Por qué se anuló a mano (anular_cargo_manual). Sin grant de escritura.';

create or replace function public.anular_cargo_manual(p_cargo uuid, p_motivo text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
  v_cliente uuid;
  v_cargo record;
  v_credito numeric := 0;
  v_cobrado numeric := 0;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('admin', 'lider') then
    raise exception 'No tenés permiso para anular cargos';
  end if;
  if v_motivo is null or char_length(v_motivo) < 3 then
    raise exception 'Contá por qué se anula (ej.: se tipeó mal el monto)';
  end if;
  if char_length(v_motivo) > 300 then raise exception 'El motivo es demasiado largo'; end if;

  select c.cliente_id into v_cliente
  from public.cargos c
  where c.id = p_cargo and c.org_id = v_org;
  if v_cliente is null then raise exception 'Ese cargo no existe. Recargá la página'; end if;
  if not private.puede_gestionar_cliente(v_cliente) then
    raise exception 'A quinteros y ambulantes los gestiona el Jefe de Portería';
  end if;

  -- (c) Cliente → (d) cargo (§4.0-1, §4.0-2): un cobro en paralelo espera o ya terminó.
  perform 1 from public.clientes c where c.id = v_cliente and c.org_id = v_org for update;

  select c.id, c.estado, c.origen, c.monto, c.monto_pagado, c.creado_en, c.descripcion
    into v_cargo
  from public.cargos c
  where c.id = p_cargo and c.org_id = v_org
  for update;

  -- Doble toque: ya quedó anulado, no se hace nada más.
  if v_cargo.estado = 'anulado' then
    return jsonb_build_object('cargo', v_cargo.id, 'estado', 'anulado', 'repetido', true);
  end if;
  if v_cargo.origen not in ('deuda', 'manual') then
    raise exception 'Solo se anula desde acá una deuda anterior cargada a mano';
  end if;

  -- Lo que se tomó solo del saldo a favor (aplicar_saldo_favor, 0023) o, en filas viejas,
  -- pagos hechos ANTES de cargar la deuda: se devuelve al cliente.
  select coalesce(sum(i.monto), 0) into v_credito
  from public.imputaciones i
  join public.pagos p on p.id = i.pago_id
  where i.cargo_id = v_cargo.id
    and (i.origen = 'saldo_favor' or p.fecha < v_cargo.creado_en);

  -- Lo cobrado en caja para esta deuda: ese cobro se anula primero (queda su rastro en la caja).
  v_cobrado := round(v_cargo.monto_pagado - v_credito, 2);
  if v_cobrado > 0.009 then
    raise exception 'Esta deuda ya tiene $ % cobrados: anulá primero ese cobro (Pagos recibidos)',
      replace(to_char(v_cobrado, 'FM999G999G999G990'), ',', '.');
  end if;

  if v_credito > 0 then
    delete from public.imputaciones i
    using public.pagos p
    where i.cargo_id = v_cargo.id and p.id = i.pago_id
      and (i.origen = 'saldo_favor' or p.fecha < v_cargo.creado_en);
  end if;

  update public.cargos set
    estado = 'anulado',
    monto_pagado = 0,
    descuento_aplicado = 0,
    anulado_por = (select auth.uid()),
    anulado_en = now(),
    anulado_motivo = v_motivo
  where id = v_cargo.id;

  -- El crédito liberado va a sus otras deudas; lo que sobre le queda a favor.
  if v_credito > 0 then
    perform private.aplicar_saldo_favor(v_cliente);
  end if;

  return jsonb_build_object('cargo', v_cargo.id, 'estado', 'anulado', 'monto', v_cargo.monto,
                            'credito_devuelto', v_credito, 'repetido', false);
end $$;
revoke all on function public.anular_cargo_manual(uuid, text) from public, anon;
grant execute on function public.anular_cargo_manual(uuid, text) to authenticated;
comment on function public.anular_cargo_manual(uuid, text) is
  'Anula una deuda anterior (RD) o un cargo manual cargado por error, con motivo y rastro (anulado_por/en/motivo). Admin (sus clientes) y Líder. Devuelve el saldo a favor que se le había aplicado; lo cobrado en caja exige anular ese cobro.';


-- ------------------------------------------------------------
-- 4. sumar_abonos_energia(p_periodo): solo los ABEN que faltan del mes en curso.
--    Mismo candado que generar_periodo; no toca periodos ni recurrentes. El saldo a favor
--    de quien recibió un abono nuevo se le aplica (como al generar el mes).
-- ------------------------------------------------------------
create or replace function public.sumar_abonos_energia(p_periodo date)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
  v_periodo date;
  v_venc date;
  v_n integer := 0;
  v_monto numeric := 0;
  v_cli uuid;
  v_saldos numeric := 0;
begin
  if v_org is null or v_rol is null then raise exception 'Sin perfil activo'; end if;
  if v_rol not in ('admin','consejo','lider') then
    raise exception 'No tenés permiso para sumar abonos de energía';
  end if;
  if p_periodo is null then raise exception 'Elegí el mes'; end if;
  v_periodo := date_trunc('month', p_periodo)::date;
  -- En un mes que ya pasó sería cobrar el abono retroactivo (§1.2-11).
  if v_periodo <> date_trunc('month', v_hoy)::date then
    raise exception 'Los abonos que faltan se suman solo al mes en curso';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('generar_periodo:' || v_org::text || ':' || v_periodo::text, 0));

  select p.vencimiento into v_venc
  from public.periodos p
  where p.org_id = v_org and p.periodo = v_periodo and p.generado_en is not null;
  if v_venc is null then
    raise exception 'Este mes todavía no se generó: el abono se suma solo al generarlo desde Facturación';
  end if;

  v_n := private.generar_abonos_energia(v_org, v_periodo, v_venc);

  if v_n > 0 then
    -- Los recién creados en esta transacción (creado_en = now()).
    select coalesce(sum(c.monto), 0) into v_monto
    from public.cargos c
    where c.org_id = v_org and c.periodo = v_periodo and c.codigo = 'ABEN'
      and c.origen = 'generacion' and c.creado_en = now();

    for v_cli in
      select distinct c.cliente_id
      from public.cargos c
      where c.org_id = v_org and c.periodo = v_periodo and c.codigo = 'ABEN'
        and c.origen = 'generacion' and c.creado_en = now()
    loop
      v_saldos := v_saldos + private.aplicar_saldo_favor(v_cli);
    end loop;
  end if;

  return jsonb_build_object('periodo', v_periodo, 'abonos', v_n, 'monto', v_monto,
                            'saldo_favor_aplicado', v_saldos);
end $$;
revoke all on function public.sumar_abonos_energia(date) from public, anon;
grant execute on function public.sumar_abonos_energia(date) to authenticated;
comment on function public.sumar_abonos_energia(date) is
  'M9 · I1: suma SOLO los abonos de energía (ABEN) que faltan del mes en curso ya generado (medidores cargados después). No genera otros cargos ni cambia quién generó el mes. Admin y Líder.';


-- ------------------------------------------------------------
-- 5. cobranza_diaria(p_desde, p_hasta): cobros + bono camioneros por día argentino.
--    Una fila por día del rango (0 si no entró nada). Sin anulados.
-- ------------------------------------------------------------
create or replace function public.cobranza_diaria(p_desde date, p_hasta date)
returns table (fecha date, monto numeric)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
begin
  if v_org is null or v_rol is null then raise exception 'Sin perfil activo'; end if;
  if v_rol not in ('admin','tesoreria','consejo','lider') then raise exception 'Sin permiso'; end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then
    raise exception 'Elegí un rango de fechas válido';
  end if;
  if p_hasta - p_desde > 400 then raise exception 'El rango es demasiado largo (hasta 400 días)'; end if;

  return query
  select d.dia::date as fecha,
         round(coalesce(pg.total, 0) + coalesce(cn.total, 0), 2) as monto
  from generate_series(p_desde::timestamp, p_hasta::timestamp, interval '1 day') as d(dia)
  left join (
    select (p.fecha at time zone 'America/Argentina/Cordoba')::date as dia, sum(p.monto) as total
    from public.pagos p
    where p.org_id = v_org and not p.anulado
      and p.fecha >= (p_desde::timestamp at time zone 'America/Argentina/Cordoba')
      and p.fecha < ((p_hasta + 1)::timestamp at time zone 'America/Argentina/Cordoba')
    group by 1
  ) pg on pg.dia = d.dia::date
  left join (
    select c.fecha as dia, sum(c.monto) as total
    from public.canon_camiones c
    where c.org_id = v_org and not c.anulado and c.fecha between p_desde and p_hasta
    group by 1
  ) cn on cn.dia = d.dia::date
  order by 1;
end $$;
revoke all on function public.cobranza_diaria(date, date) from public, anon;
grant execute on function public.cobranza_diaria(date, date) to authenticated;
comment on function public.cobranza_diaria(date, date) is
  'Cobros (sin anulados) + bono camioneros (sin anulados) por día argentino, una fila por día del rango. Sumado en SQL: no se corta en las 1000 filas de PostgREST.';


-- ------------------------------------------------------------
-- 6. ultimas_lecturas(p_antes): última lectura conocida de cada medidor antes de un mes.
-- ------------------------------------------------------------
create or replace function public.ultimas_lecturas(p_antes date)
returns table (medidor_id uuid, lectura_actual numeric, periodo date, fecha_lectura date)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
begin
  if v_org is null or v_rol is null then raise exception 'Sin perfil activo'; end if;
  if v_rol not in ('admin','tesoreria','consejo','lider') then raise exception 'Sin permiso'; end if;
  if p_antes is null then raise exception 'Elegí el mes'; end if;

  return query
  select distinct on (l.medidor_id)
         l.medidor_id, l.lectura_actual, l.periodo, l.fecha_lectura
  from public.lecturas l
  where l.org_id = v_org and l.periodo < date_trunc('month', p_antes)::date
  order by l.medidor_id, l.periodo desc;
end $$;
revoke all on function public.ultimas_lecturas(date) from public, anon;
grant execute on function public.ultimas_lecturas(date) to authenticated;
comment on function public.ultimas_lecturas(date) is
  'M9 · Última lectura de cada medidor ANTES del mes dado (una fila por medidor). Energía y la planilla del electricista.';


-- ------------------------------------------------------------
-- 6b. lugares_del_cliente(p_cliente): los lugares del plano de UN cliente que el rol
--     gestiona (el Jefe no lee la tabla espacios, 0022). Sirve para avisar, antes de
--     pasar a un quintero a ambulante, qué se libera del plano (formulario y resumen que
--     lee el Líder en Aprobaciones). Sin nota ni geometría.
-- ------------------------------------------------------------
create or replace function public.lugares_del_cliente(p_cliente uuid)
returns table (id uuid, tipo text, numero text, medio boolean, propio boolean)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_org uuid := private.org_actual();
begin
  if v_org is null or private.rol_actual() is null then raise exception 'Sin perfil activo'; end if;
  if p_cliente is null or not private.puede_gestionar_cliente(p_cliente) then
    raise exception 'Sin permiso';
  end if;

  return query
  select e.id, e.tipo, e.numero, e.medio, e.propio
  from public.espacios e
  where e.org_id = v_org and e.cliente_id = p_cliente
  order by e.tipo, e.numero;
end $$;
revoke all on function public.lugares_del_cliente(uuid) from public, anon;
grant execute on function public.lugares_del_cliente(uuid) to authenticated;
comment on function public.lugares_del_cliente(uuid) is
  'Lugares del plano (tipo, número, medio, propio) de un cliente que el rol gestiona (Jefe: quinteros/ambulantes; Admin: puesteros; Líder: todos). Para avisar qué se libera al pasarlo a ambulante.';


-- ------------------------------------------------------------
-- 7. Datos que dejó el comportamiento anterior (idempotente):
--    · ambulantes con conceptos mensuales activos (pasaron de categoría sin apagarlos);
--    · lugares del plano de clientes dados de baja o ambulantes (el mapa los pintaba
--      "ocupados" sin dueño y los contaba como "al día").
-- ------------------------------------------------------------
update public.cliente_conceptos cc set activo = false
from public.conceptos co, public.clientes cl
where co.id = cc.concepto_id and cl.id = cc.cliente_id
  and cc.activo and co.tipo = 'recurrente' and cl.categoria = 'ambulante';

update public.espacios e set cliente_id = null, asignado_en = null, actualizado_en = now()
from public.clientes cl
where cl.id = e.cliente_id and (not cl.activo or cl.categoria = 'ambulante');

--    · medidores de ambulantes (pasaron de categoría con el medidor activo: seguían pagando
--      abono y consumo sin que nadie lo viera). Se desactivan y se desatan del plano.
update public.medidores m set activo = false, espacio_id = null
from public.clientes cl
where cl.id = m.cliente_id and cl.categoria = 'ambulante'
  and (m.activo or m.espacio_id is not null);
