-- ============================================================
-- Mercado San Miguel — 0023 Fase 3: arreglos de cobros, cajas y portería
-- (revisión de UX del 28/09). Contrato: docs/FASE3-CONTRATO.md §4.0, §4.1–§4.5.
--
-- Idempotente (create or replace / if not exists / drop … if exists). UNA transacción.
--
--   1. imputaciones.creado_en + imputaciones.origen ('cobro' | 'saldo_favor'):
--      private.aplicar_saldo_favor marca lo que el crédito de un recibo viejo paga
--      DESPUÉS. datos_recibo y resumen_lote muestran solo lo imputado en el cobro
--      (el recibo entregado no cambia) y datos_recibo devuelve aparte
--      "aplicado_despues" y "total_original" (recibo anulado ≠ "$ 0"). El beneficio por
--      pago en término sale solo en el recibo que terminó de pagar el cargo.
--   2. private.mensaje_caja_no_abierta: registrar_cobro y cobrar_diario dicen qué hacer
--      según quién cobra (Administración reabre su caja; el Jefe pide la reapertura) y si
--      Tesorería ya validó la caja (hoy no se cobra más en ella).
--   3. integrar_caja_porteria(p_caja, p_observaciones, p_efectivo_recibido): lo que se
--      contó al recibir. Si no coincide, la diferencia queda como ajuste de la CAJA DE
--      PORTERÍA (con motivo obligatorio) y no aparece después como faltante de
--      Administración. Reintento del mismo usuario → devuelve lo registrado ("repetido").
--   4. public.v_ultimo_pago_ambulante: último día pago de cada ambulante (una fila por
--      cliente; la lista del Jefe ya no depende del tope de 1000 filas de PostgREST).
--   5. ingresos_personal: Portería puede mandar el id (clave de idempotencia del
--      formulario: un corte de red no duplica el ingreso).
-- ============================================================


-- ------------------------------------------------------------
-- 1. Imputaciones: cuándo y por qué se imputó
--    Las filas viejas quedan con creado_en null y origen 'cobro' (como hasta hoy).
-- ------------------------------------------------------------
alter table public.imputaciones add column if not exists creado_en timestamptz;
alter table public.imputaciones alter column creado_en set default now();
alter table public.imputaciones add column if not exists origen text not null default 'cobro';
alter table public.imputaciones drop constraint if exists imputaciones_origen_valido;
alter table public.imputaciones add constraint imputaciones_origen_valido
  check (origen in ('cobro', 'saldo_favor'));


-- ------------------------------------------------------------
-- Saldo a favor: MISMO cuerpo que 0012 (bloqueo del cliente, orden de imputación); solo
-- marca las imputaciones con origen 'saldo_favor'.
-- ------------------------------------------------------------
create or replace function private.aplicar_saldo_favor(p_cliente uuid)
returns numeric
language plpgsql security definer set search_path = '' as $$
declare
  v_hoy date := private.hoy_ar();
  v_org uuid;
  v_pago record;
  v_cargo record;
  v_restante numeric;
  v_objetivo numeric;
  v_saldo numeric;
  v_aplicar numeric;
  v_total numeric := 0;
begin
  select org_id into v_org from public.clientes where id = p_cliente for update;
  if v_org is null then return 0; end if;

  for v_pago in
    select p.id, p.monto - coalesce((select sum(i.monto) from public.imputaciones i where i.pago_id = p.id), 0) as credito
    from public.pagos p
    where p.cliente_id = p_cliente and not p.anulado
    order by p.fecha asc
  loop
    continue when v_pago.credito <= 0.009;
    v_restante := round(v_pago.credito, 2);

    for v_cargo in
      select c.id, c.monto, c.monto_pagado, c.descuento_pronto_pago, c.vencimiento
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

      -- 0023: queda marcado como "aplicado después" (el recibo viejo no cambia).
      insert into public.imputaciones (org_id, pago_id, cargo_id, monto, origen)
      values (v_org, v_pago.id, v_cargo.id, v_aplicar, 'saldo_favor');

      update public.cargos set
        monto_pagado = monto_pagado + v_aplicar,
        descuento_aplicado = case
          when v_aplicar = v_saldo and v_hoy <= vencimiento then monto - v_objetivo
          else descuento_aplicado end,
        estado = case when v_aplicar = v_saldo then 'pagado'::public.estado_cargo else 'parcial'::public.estado_cargo end
      where id = v_cargo.id;

      v_restante := v_restante - v_aplicar;
      v_total := v_total + v_aplicar;
    end loop;
    exit when v_restante > 0;
  end loop;
  return v_total;
end;
$$;


-- ------------------------------------------------------------
-- Resumen del cobro (retorno de registrar_cobro / cobrar_diario): mismo cuerpo que 0014,
-- solo con lo imputado en el cobro.
-- ------------------------------------------------------------
create or replace function private.resumen_lote(p_lote uuid)
returns jsonb
language sql stable security definer set search_path = '' as $$
  with l as (
    select p.id, p.numero, p.linea, p.medio, p.monto, p.anulado
    from public.pagos p
    where p.lote_id = p_lote
  ), i as (
    select im.cargo_id, c.codigo, c.descripcion, c.periodo,
           sum(im.monto) as monto, bool_and(c.estado = 'pagado') as saldado
    from public.imputaciones im
    -- 0023: solo lo imputado EN el cobro (lo que el saldo a favor pagó después no lo cambia)
    join l on l.id = im.pago_id and not l.anulado and im.origen = 'cobro'
    join public.cargos c on c.id = im.cargo_id
    group by im.cargo_id, c.codigo, c.descripcion, c.periodo
  )
  select jsonb_build_object(
    'lote_id', p_lote,
    'numero', (select min(l.numero) from l),
    'pago_id', (select l.id from l order by l.linea limit 1),
    'total', (select coalesce(sum(l.monto), 0) from l where not l.anulado),
    'pagos', (select coalesce(jsonb_agg(jsonb_build_object(
                 'pago_id', l.id, 'numero', l.numero, 'linea', l.linea, 'medio', l.medio,
                 'monto', l.monto, 'anulado', l.anulado) order by l.linea), '[]'::jsonb)
              from l),
    'imputaciones', (select coalesce(jsonb_agg(jsonb_build_object(
                 'cargo_id', i.cargo_id, 'codigo', i.codigo, 'descripcion', i.descripcion,
                 'periodo', i.periodo, 'monto', i.monto, 'saldado', i.saldado)
                 order by i.periodo, i.codigo), '[]'::jsonb)
              from i),
    'saldo_favor', greatest(
      (select coalesce(sum(l.monto), 0) from l where not l.anulado)
      - (select coalesce(sum(i.monto), 0) from i), 0))
$$;


-- ------------------------------------------------------------
-- Recibo: lo imputado en el cobro + "aplicado_despues" + "total_original".
-- ------------------------------------------------------------
create or replace function public.datos_recibo(p_pago uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_pago public.pagos;
  v_primera public.pagos;
  v_socio boolean;
  v_cli public.clientes;
  v_caja public.cajas;
  v_lineas jsonb;
  v_imputaciones jsonb;
  v_despues jsonb;
  v_total numeric;
  v_total_original numeric;
  v_imputado numeric;
  v_anulado boolean;
begin
  if v_org is null or v_rol is null
     or v_rol not in ('admin','tesoreria','lider','guardia','socio') then
    raise exception 'Recibo inexistente';
  end if;
  v_socio := v_rol = 'socio';

  select * into v_pago from public.pagos where id = p_pago and org_id = v_org;
  if not found then
    raise exception 'Recibo inexistente';
  end if;
  if v_socio and v_pago.cliente_id is distinct from private.cliente_actual() then
    raise exception 'Recibo inexistente';
  end if;
  if v_rol = 'guardia' and not private.cliente_de_porteria(v_pago.cliente_id) then
    raise exception 'Recibo inexistente';
  end if;

  select * into v_primera from public.pagos
  where lote_id = v_pago.lote_id
  order by linea limit 1;
  select * into v_cli from public.clientes where id = v_pago.cliente_id;
  select * into v_caja from public.cajas where id = v_primera.caja_id;

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'pago_id', p.id,
      'linea', p.linea,
      'medio', p.medio,
      'monto', p.monto,
      'anulado', p.anulado,
      'anulado_en', p.anulado_en,
      'motivo_anulacion', p.motivo_anulacion,
      'titular_transferencia', p.titular_transferencia,
      'tiene_comprobante', p.comprobante_path is not null,
      'comprobante_path', case when v_socio then null else p.comprobante_path end,
      'cheque', case when ch.id is null then null else jsonb_build_object(
        'numero', ch.numero,
        'cuit', ch.cuit,
        'recibido_de', coalesce(ch.recibido_de, ch.titular),
        'fecha_recibido', ch.fecha_recibido,
        'fecha_cobro', ch.fecha_cobro,
        'puesto', ch.puesto,
        'estado', case when v_socio then null else ch.estado end,
        'proveedor', case when v_socio then null else ch.proveedor end) end
    ) order by p.linea), '[]'::jsonb),
    coalesce(sum(p.monto) filter (where not p.anulado), 0),
    coalesce(sum(p.monto), 0),
    coalesce(bool_and(p.anulado), false)
  into v_lineas, v_total, v_total_original, v_anulado
  from public.pagos p
  left join public.cheques ch on ch.id = p.cheque_id
  where p.lote_id = v_pago.lote_id;

  -- Detalle del comprobante: SOLO lo imputado en el cobro. Si después el saldo a favor de este
  -- recibo pagó deudas nuevas (private.aplicar_saldo_favor, origen 'saldo_favor'), el recibo
  -- entregado no cambia: eso va aparte en "aplicado_despues".
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'cargo_id', x.cargo_id,
      'codigo', x.codigo,
      'descripcion', x.descripcion,
      'periodo', x.periodo,
      'monto', x.monto,
      'beneficio', x.beneficio) order by x.periodo, x.orden, x.codigo), '[]'::jsonb),
    coalesce(sum(x.monto), 0)
  into v_imputaciones, v_imputado
  from (
    select c.id as cargo_id, c.codigo, c.descripcion, c.periodo,
           coalesce(co.orden_imputacion, 0) as orden,
           sum(i.monto) as monto,
           -- El beneficio por pago en término va en el recibo que TERMINÓ de pagar el cargo. Si
           -- después otro cobro (número mayor) o un saldo a favor le imputó algo, este recibo
           -- lo pagó en parte y no muestra el beneficio (antes aparecía al reimprimirlo).
           case when c.estado = 'pagado' and not exists (
                  select 1
                  from public.imputaciones i2
                  join public.pagos p2 on p2.id = i2.pago_id and not p2.anulado
                  where i2.cargo_id = c.id
                    and ((i2.origen = 'cobro' and p2.lote_id <> v_pago.lote_id and p2.numero > v_pago.numero)
                         or (i2.origen = 'saldo_favor' and i2.creado_en > v_primera.fecha)))
                then c.descuento_aplicado else 0 end as beneficio
    from public.imputaciones i
    join public.pagos pp on pp.id = i.pago_id and not pp.anulado
    join public.cargos c on c.id = i.cargo_id
    left join public.conceptos co on co.id = c.concepto_id
    where pp.lote_id = v_pago.lote_id
      and i.origen = 'cobro'
    group by c.id, c.codigo, c.descripcion, c.periodo, co.orden_imputacion, c.estado, c.descuento_aplicado
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object(
      'cargo_id', y.cargo_id,
      'codigo', y.codigo,
      'descripcion', y.descripcion,
      'periodo', y.periodo,
      'monto', y.monto,
      'fecha', y.fecha) order by y.fecha, y.periodo, y.codigo), '[]'::jsonb)
  into v_despues
  from (
    select c.id as cargo_id, c.codigo, c.descripcion, c.periodo,
           sum(i.monto) as monto, min(i.creado_en) as fecha
    from public.imputaciones i
    join public.pagos pp on pp.id = i.pago_id and not pp.anulado
    join public.cargos c on c.id = i.cargo_id
    where pp.lote_id = v_pago.lote_id
      and i.origen = 'saldo_favor'
    group by c.id, c.codigo, c.descripcion, c.periodo
  ) y;

  return jsonb_build_object(
    'numero', v_pago.numero,
    'lote_id', v_pago.lote_id,
    'fecha', v_primera.fecha,
    'anulado', v_anulado,
    'cliente', jsonb_build_object(
      'id', v_cli.id, 'codigo', v_cli.codigo, 'nombre', v_cli.nombre, 'apodo', v_cli.apodo),
    'caja', jsonb_build_object(
      'tipo', v_caja.tipo,
      'label', case v_caja.tipo when 'guardia' then 'Caja de portería' else 'Administración' end,
      'fecha', v_caja.fecha),
    'recibio', (select pf.nombre from public.perfiles pf where pf.user_id = v_primera.recibido_por),
    'notas', case when v_socio then null else v_primera.notas end,
    'total', v_total,
    -- 0023: lo que decía el recibo antes de anularse (un recibo anulado no muestra "$ 0").
    'total_original', v_total_original,
    'lineas', v_lineas,
    'imputaciones', v_imputaciones,
    'saldo_favor', greatest(v_total - v_imputado, 0),
    'aplicado_despues', v_despues);
end $$;
revoke all on function public.datos_recibo(uuid) from public, anon;
grant execute on function public.datos_recibo(uuid) to authenticated;


-- ------------------------------------------------------------
-- 2. Caja que no está abierta: qué hacer según quién cobra.
--    Todos empiezan con "La caja ya está cerrada" (compatibilidad con fase 2).
-- ------------------------------------------------------------
create or replace function private.mensaje_caja_no_abierta(
  p_estado public.estado_caja,
  p_rol public.rol_usuario
) returns text
language sql immutable security definer set search_path = '' as $$
  select case
    when p_estado = 'validada' then
      'La caja ya está cerrada y Tesorería la validó: hoy no se puede cobrar más en ella'
      || case when p_rol = 'lider' then '' else '. Avisale al Líder de Procesos' end
    when p_rol = 'guardia' then
      'La caja ya está cerrada: la rendiste. Pedí la reapertura desde Caja para seguir cobrando'
    when p_estado = 'integrada' then
      'La caja ya está cerrada: ya entró en la caja mayor. Pedile la reapertura a Tesorería'
    else
      'La caja ya está cerrada: reabrila desde Caja para seguir cobrando'
  end
$$;
revoke all on function private.mensaje_caja_no_abierta(public.estado_caja, public.rol_usuario) from public, anon;
grant execute on function private.mensaje_caja_no_abierta(public.estado_caja, public.rol_usuario) to authenticated;


-- ------------------------------------------------------------
-- registrar_cobro: MISMO cuerpo que 0014; solo cambia el mensaje de la caja no abierta.
-- ------------------------------------------------------------
create or replace function public.registrar_cobro(
  p_cliente uuid,
  p_caja uuid,
  p_lineas jsonb,
  p_notas text default null,
  p_permitir_saldo_favor boolean default false,
  p_lote uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
  v_yo uuid := (select auth.uid());
  v_caja public.cajas;
  v_cli public.clientes;
  v_lote uuid := coalesce(p_lote, gen_random_uuid());
  v_otro uuid;
  v_otro_org uuid;
  v_l jsonb;
  v_txt text;
  v_medio public.medio_pago;
  v_monto numeric;
  v_path text;
  v_cuit text;
  v_cuit_cli text;
  v_num_cheque text;
  v_estado_ch text;
  v_proveedor text;
  v_recibido_de text;
  v_f_recepcion date;
  v_f_cobro date;
  v_claves text[] := '{}';
  v_numero bigint;
  v_n smallint := 0;
  v_puestos text;
  v_cheque_id uuid;
  v_pago_id uuid;
  v_res jsonb;
  v_sobra numeric := 0;
  v_constraint text;
begin
  if v_org is null then
    raise exception 'Sin perfil activo';
  end if;
  if v_rol is null or v_rol not in ('admin','guardia','lider') then
    raise exception 'No tenés permiso para registrar cobros';
  end if;

  -- (a) Idempotencia (§4.0-5): doble toque en la tablet = un solo cobro.
  if p_lote is not null then
    perform pg_advisory_xact_lock(hashtextextended('registrar_cobro:' || p_lote::text, 0));
    select p.cliente_id, p.org_id into v_otro, v_otro_org
    from public.pagos p where p.lote_id = p_lote
    order by p.linea limit 1;
    if found then
      if v_otro_org is distinct from v_org or v_otro is distinct from p_cliente then
        raise exception 'Ese cobro ya se registró para otro cliente';
      end if;
      return private.resumen_lote(p_lote) || jsonb_build_object('repetido', true);
    end if;
  end if;

  -- Líneas: array de 1 a 6.
  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'Agregá al menos un medio de pago';
  end if;
  if jsonb_array_length(p_lineas) > 6 then
    raise exception 'Un mismo cobro admite hasta 6 medios de pago';
  end if;

  -- (b) Caja: for share (se serializa contra cerrar_caja). Estado DESPUÉS del bloqueo.
  select * into v_caja from public.cajas
  where id = p_caja and org_id = v_org
  for share;
  if not found then
    raise exception 'Caja inexistente';
  end if;
  if v_rol = 'guardia' and v_caja.tipo <> 'guardia' then
    raise exception 'Solo podés cobrar en la caja de portería';
  end if;
  if v_rol in ('admin','lider') and v_caja.tipo <> 'administracion' then
    raise exception 'Solo podés cobrar en la caja de administración';
  end if;
  if v_caja.estado <> 'abierta' then
    -- 0023: el mensaje dice qué hacer según quién cobra y en qué estado quedó la caja.
    raise exception '%', private.mensaje_caja_no_abierta(v_caja.estado, v_rol);
  end if;

  -- (c) Cliente: for update (serializa cobros, saldo a favor y anulaciones del mismo cliente).
  select * into v_cli from public.clientes
  where id = p_cliente and org_id = v_org
  for update;
  if not found then
    raise exception 'Cliente inexistente';
  end if;
  if not private.puede_gestionar_cliente(p_cliente) then
    if v_rol = 'guardia' then
      raise exception 'A este cliente lo cobra Administración';
    end if;
    raise exception 'A quinteros y ambulantes los cobra el Jefe de Portería';
  end if;
  v_cuit_cli := nullif(regexp_replace(coalesce(v_cli.cuit, ''), '[^0-9]', '', 'g'), '');

  -- Validar TODAS las líneas antes de escribir nada.
  for v_l in select t.value from jsonb_array_elements(p_lineas) as t(value) loop
    v_txt := case when jsonb_typeof(v_l) = 'object' then v_l->>'medio' end;
    if v_txt is null or v_txt not in ('efectivo','transferencia','cheque') then
      raise exception 'Medio de pago inválido';
    end if;
    v_medio := v_txt::public.medio_pago;

    v_txt := btrim(coalesce(v_l->>'monto', ''));
    if v_txt !~ '^[0-9]+(\.[0-9]+)?$' then
      raise exception 'Cada medio de pago necesita un monto mayor a cero';
    end if;
    v_monto := round(v_txt::numeric, 2);
    if v_monto <= 0 then
      raise exception 'Cada medio de pago necesita un monto mayor a cero';
    end if;
    if v_monto > 999999999999 then
      raise exception 'El monto es demasiado grande: revisalo';
    end if;

    if v_medio = 'cheque' and v_rol = 'guardia' then
      raise exception 'En portería se cobra solo en efectivo o transferencia';
    end if;

    if v_medio = 'transferencia' then
      if btrim(coalesce(v_l#>>'{transferencia,titular}', '')) = '' then
        raise exception 'Poné a nombre de quién está la cuenta que transfirió';
      end if;
      v_path := nullif(btrim(coalesce(v_l#>>'{transferencia,comprobante_path}', '')), '');
      if v_path is not null
         and (v_path not like v_org::text || '/comprobantes/%' or position('..' in v_path) > 0) then
        raise exception 'La foto del comprobante no es válida: volvé a sacarla';
      end if;
    end if;

    if v_medio = 'cheque' then
      v_num_cheque := btrim(coalesce(v_l#>>'{cheque,numero}', ''));
      if v_num_cheque !~ '^[0-9]{1,20}$' then
        raise exception 'Poné el número del cheque (solo números)';
      end if;
      v_cuit := regexp_replace(coalesce(v_l#>>'{cheque,cuit}', ''), '[^0-9]', '', 'g');
      if v_cuit !~ '^[0-9]{11}$' then
        raise exception 'El CUIT del cheque tiene que tener 11 números';
      end if;
      v_f_recepcion := coalesce(
        private.cobro_fecha(v_l#>>'{cheque,fecha_recepcion}', 'La fecha de recepción del cheque no es válida'),
        v_hoy);
      if v_f_recepcion > v_hoy then
        raise exception 'La fecha de recepción no puede ser futura';
      end if;
      v_f_cobro := private.cobro_fecha(v_l#>>'{cheque,fecha_cobro}', 'La fecha de cobro del cheque no es válida');
      v_estado_ch := coalesce(nullif(btrim(coalesce(v_l#>>'{cheque,estado}', '')), ''), 'en_cartera');
      if v_estado_ch not in ('en_cartera','entregado') then
        raise exception 'Elegí si el cheque queda en la cooperativa o se lo diste a un proveedor';
      end if;
      v_proveedor := nullif(btrim(coalesce(v_l#>>'{cheque,proveedor}', '')), '');
      if v_estado_ch = 'entregado' and v_proveedor is null then
        raise exception 'Poné a qué proveedor se le entregó el cheque';
      end if;
      if length(coalesce(v_proveedor, '')) > 120
         or length(btrim(coalesce(v_l#>>'{cheque,recibido_de}', ''))) > 120 then
        raise exception 'El nombre es demasiado largo: acortalo';
      end if;
      if (v_cuit || ':' || v_num_cheque) = any (v_claves)
         or exists (select 1 from public.cheques ch
                    where ch.org_id = v_org and ch.cuit = v_cuit and ch.numero = v_num_cheque
                      and ch.estado <> 'rechazado') then
        raise exception 'El cheque N° % de ese CUIT ya está cargado', v_num_cheque;
      end if;
      v_claves := v_claves || (v_cuit || ':' || v_num_cheque);
    end if;
  end loop;

  -- Escritura. Red de seguridad de la idempotencia: si otra transacción ganó la carrera
  -- con el mismo lote (o el mismo cheque), se relee y se contesta sin duplicar (§4.0-5).
  begin
    -- El crédito previo del cliente va primero a sus deudas (ya bloquea al cliente: sin costo).
    perform private.aplicar_saldo_favor(p_cliente);

    v_numero := nextval(pg_get_serial_sequence('public.pagos', 'numero'));
    v_puestos := private.puestos_cliente(p_cliente);

    -- efectivo → transferencia → cheque (si el cheque rebota se reabren los cargos más nuevos)
    for v_l in
      select t.value
      from jsonb_array_elements(p_lineas) with ordinality as t(value, ord)
      order by case t.value->>'medio' when 'efectivo' then 1 when 'transferencia' then 2 else 3 end, t.ord
    loop
      v_n := v_n + 1;
      v_medio := (v_l->>'medio')::public.medio_pago;
      v_monto := round((btrim(v_l->>'monto'))::numeric, 2);
      v_cheque_id := null;

      if v_medio = 'cheque' then
        v_num_cheque := btrim(v_l#>>'{cheque,numero}');
        v_cuit := regexp_replace(v_l#>>'{cheque,cuit}', '[^0-9]', '', 'g');
        v_estado_ch := coalesce(nullif(btrim(coalesce(v_l#>>'{cheque,estado}', '')), ''), 'en_cartera');
        v_proveedor := nullif(btrim(coalesce(v_l#>>'{cheque,proveedor}', '')), '');
        v_recibido_de := coalesce(nullif(btrim(coalesce(v_l#>>'{cheque,recibido_de}', '')), ''), v_cli.nombre);
        v_f_recepcion := coalesce(private.cobro_fecha(v_l#>>'{cheque,fecha_recepcion}',
          'La fecha de recepción del cheque no es válida'), v_hoy);
        v_f_cobro := coalesce(private.cobro_fecha(v_l#>>'{cheque,fecha_cobro}',
          'La fecha de cobro del cheque no es válida'), v_hoy);

        insert into public.cheques (
          org_id, cliente_id, numero, cuit, recibido_de, titular, es_tercero, puesto, monto,
          fecha_recibido, fecha_cobro, estado, proveedor,
          fecha_entregado, entregado_por, entregado_en_cobro, creado_por)
        values (
          v_org, p_cliente, v_num_cheque, v_cuit, v_recibido_de, v_recibido_de,
          coalesce(v_cuit <> v_cuit_cli, false), v_puestos, v_monto,
          v_f_recepcion, v_f_cobro, v_estado_ch::public.estado_cheque,
          case when v_estado_ch = 'entregado' then v_proveedor end,
          case when v_estado_ch = 'entregado' then v_hoy end,
          case when v_estado_ch = 'entregado' then v_yo end,
          v_estado_ch = 'entregado',
          v_yo)
        returning id into v_cheque_id;
      end if;

      insert into public.pagos (
        org_id, numero, cliente_id, caja_id, medio, monto, cheque_id, notas, recibido_por,
        titular_transferencia, comprobante_path, lote_id, linea)
      overriding system value
      values (
        v_org, v_numero, p_cliente, p_caja, v_medio, v_monto, v_cheque_id,
        case when v_n = 1 then nullif(btrim(coalesce(p_notas, '')), '') end,
        v_yo,
        case when v_medio = 'transferencia' then btrim(v_l#>>'{transferencia,titular}') end,
        case when v_medio = 'transferencia'
          then nullif(btrim(coalesce(v_l#>>'{transferencia,comprobante_path}', '')), '') end,
        v_lote, v_n)
      returning id into v_pago_id;

      v_res := private.imputar_pago(v_pago_id, p_cliente, v_monto, null);
      v_sobra := v_sobra + (v_res->>'restante')::numeric;
    end loop;

    if v_sobra > 0.009 and not coalesce(p_permitir_saldo_favor, false) then
      raise exception 'El monto supera la deuda del cliente: sobran %. Confirmá si querés dejarlo como saldo a favor.',
        private.cobro_pesos(v_sobra);
    end if;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if p_lote is not null then
        select p.cliente_id into v_otro from public.pagos p where p.lote_id = p_lote order by p.linea limit 1;
        if found then
          if v_otro is distinct from p_cliente then
            raise exception 'Ese cobro ya se registró para otro cliente';
          end if;
          return private.resumen_lote(p_lote) || jsonb_build_object('repetido', true);
        end if;
      end if;
      if v_constraint = 'cheques_cuit_numero_unq' then
        raise exception 'Uno de los cheques ya está cargado (mismo CUIT y número): revisá el número';
      end if;
      raise;
  end;

  return private.resumen_lote(v_lote) || jsonb_build_object('repetido', false);
end $$;
revoke all on function public.registrar_cobro(uuid, uuid, jsonb, text, boolean, uuid) from public, anon;
grant execute on function public.registrar_cobro(uuid, uuid, jsonb, text, boolean, uuid) to authenticated;


-- ------------------------------------------------------------
-- cobrar_diario: MISMO cuerpo que 0014; solo cambia el mensaje de la caja no abierta.
-- ------------------------------------------------------------
create or replace function public.cobrar_diario(
  p_cliente uuid,
  p_caja uuid,
  p_dias integer,
  p_lineas jsonb,
  p_desde date default null,
  p_notas text default null,
  p_lote uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
  v_yo uuid := (select auth.uid());
  v_caja public.cajas;
  v_cli public.clientes;
  v_amb public.conceptos;
  v_lote uuid := coalesce(p_lote, gen_random_uuid());
  v_otro uuid;
  v_otro_org uuid;
  v_desde date;
  v_hasta date;
  v_choque record;
  v_total numeric;
  v_suma numeric := 0;
  v_cargo_id uuid;
  v_numero bigint;
  v_l jsonb;
  v_txt text;
  v_n smallint := 0;
  v_medio public.medio_pago;
  v_monto numeric;
  v_path text;
  v_pago_id uuid;
  v_res jsonb;
  v_sobra numeric := 0;
  v_extra jsonb;
begin
  if v_org is null then
    raise exception 'Sin perfil activo';
  end if;
  if v_rol is null or v_rol not in ('guardia','lider') then
    raise exception 'A los ambulantes les cobra el Jefe de Portería';
  end if;

  -- (a) Idempotencia (§4.0-5).
  if p_lote is not null then
    perform pg_advisory_xact_lock(hashtextextended('cobrar_diario:' || p_lote::text, 0));
    select p.cliente_id, p.org_id into v_otro, v_otro_org
    from public.pagos p where p.lote_id = p_lote
    order by p.linea limit 1;
    if found then
      if v_otro_org is distinct from v_org or v_otro is distinct from p_cliente then
        raise exception 'Ese cobro ya se registró para otro cliente';
      end if;
      select jsonb_build_object('cargo_id', c.id, 'desde', c.desde, 'hasta', c.hasta,
                                'dias', (c.hasta - c.desde) + 1, 'precio_dia', c.precio_unitario)
        into v_extra
      from public.cargos c
      where c.lote_id = p_lote and c.origen = 'diario'
      order by c.creado_en limit 1;
      return private.resumen_lote(p_lote) || coalesce(v_extra, '{}'::jsonb)
             || jsonb_build_object('repetido', true);
    end if;
  end if;

  if p_dias is null or p_dias < 1 or p_dias > 31 then
    raise exception 'Elegí entre 1 y 31 días';
  end if;
  v_desde := coalesce(p_desde, v_hoy);
  if v_desde < v_hoy - 30 or v_desde > v_hoy + 31 then
    raise exception 'Elegí un día cercano a hoy';
  end if;
  v_hasta := v_desde + (p_dias - 1);

  -- (b) Caja for share, estado después del bloqueo.
  select * into v_caja from public.cajas
  where id = p_caja and org_id = v_org
  for share;
  if not found then
    raise exception 'Caja inexistente';
  end if;
  if v_rol = 'guardia' and v_caja.tipo <> 'guardia' then
    raise exception 'Solo podés cobrar en la caja de portería';
  end if;
  if v_rol = 'lider' and v_caja.tipo <> 'administracion' then
    raise exception 'Solo podés cobrar en la caja de administración';
  end if;
  if v_caja.estado <> 'abierta' then
    -- 0023: el mensaje dice qué hacer según quién cobra y en qué estado quedó la caja.
    raise exception '%', private.mensaje_caja_no_abierta(v_caja.estado, v_rol);
  end if;

  -- (c) Cliente for update: ambulante activo de la org.
  select * into v_cli from public.clientes
  where id = p_cliente and org_id = v_org
  for update;
  if not found or v_cli.categoria is distinct from 'ambulante' then
    raise exception 'Elegí un ambulante registrado';
  end if;
  if not v_cli.activo then
    raise exception 'Este ambulante está dado de baja';
  end if;

  select * into v_amb from public.conceptos
  where org_id = v_org and codigo = 'AMB' and activo
  limit 1;
  if not found or coalesce(v_amb.precio, 0) <= 0 then
    raise exception 'Falta configurar el precio por día de los ambulantes (concepto AMB)';
  end if;

  -- Días ya pagados (con el cliente bloqueado: dos cobros a la vez no se pisan).
  select c.desde, c.hasta into v_choque
  from public.cargos c
  where c.cliente_id = p_cliente and c.origen = 'diario' and c.estado <> 'anulado'
    and c.desde <= v_hasta and c.hasta >= v_desde
  order by c.desde
  limit 1;
  if found then
    raise exception 'Ya tiene pagado del % al %: elegí otros días',
      to_char(v_choque.desde, 'DD/MM'), to_char(v_choque.hasta, 'DD/MM');
  end if;

  -- Líneas: 1 a 3, solo efectivo / transferencia, suma exacta.
  v_total := round(p_dias * v_amb.precio, 2);
  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array'
     or jsonb_array_length(p_lineas) not between 1 and 3 then
    raise exception 'Elegí cómo te paga';
  end if;
  for v_l in select t.value from jsonb_array_elements(p_lineas) as t(value) loop
    v_txt := case when jsonb_typeof(v_l) = 'object' then v_l->>'medio' end;
    if v_txt = 'cheque' then
      if v_rol = 'guardia' then
        raise exception 'En portería se cobra solo en efectivo o transferencia';
      end if;
      raise exception 'A los ambulantes se les cobra en efectivo o transferencia';
    end if;
    if v_txt is null or v_txt not in ('efectivo','transferencia') then
      raise exception 'Elegí cómo te paga';
    end if;
    v_medio := v_txt::public.medio_pago;
    v_txt := btrim(coalesce(v_l->>'monto', ''));
    if v_txt !~ '^[0-9]+(\.[0-9]+)?$' or round(v_txt::numeric, 2) <= 0 then
      raise exception 'Cada medio de pago necesita un monto mayor a cero';
    end if;
    v_monto := round(v_txt::numeric, 2);
    if v_medio = 'transferencia' then
      if btrim(coalesce(v_l#>>'{transferencia,titular}', '')) = '' then
        raise exception 'Poné a nombre de quién está la cuenta que transfirió';
      end if;
      v_path := nullif(btrim(coalesce(v_l#>>'{transferencia,comprobante_path}', '')), '');
      if v_path is not null
         and (v_path not like v_org::text || '/comprobantes/%' or position('..' in v_path) > 0) then
        raise exception 'La foto del comprobante no es válida: volvé a sacarla';
      end if;
    end if;
    v_suma := v_suma + v_monto;
  end loop;
  if v_suma <> v_total then
    raise exception 'El total tiene que ser % (% × %)',
      private.cobro_pesos(v_total),
      case when p_dias = 1 then '1 día' else p_dias || ' días' end,
      private.cobro_pesos(v_amb.precio);
  end if;

  begin
    -- Si tenía crédito, va a sus deudas viejas ANTES de crear el cargo del día (no a este cobro).
    perform private.aplicar_saldo_favor(p_cliente);

    insert into public.cargos (
      org_id, periodo, cliente_id, concepto_id, codigo, descripcion, cantidad, precio_unitario,
      monto, descuento_pronto_pago, vencimiento, origen, desde, hasta, lote_id)
    values (
      v_org, date_trunc('month', v_desde)::date, p_cliente, v_amb.id, v_amb.codigo,
      v_amb.nombre || ' · ' || case when p_dias = 1
        then to_char(v_desde, 'DD/MM')
        else p_dias || ' días (' || to_char(v_desde, 'DD/MM') || ' al ' || to_char(v_hasta, 'DD/MM') || ')' end,
      p_dias, v_amb.precio, v_total, 0, v_desde, 'diario', v_desde, v_hasta, v_lote)
    returning id into v_cargo_id;

    v_numero := nextval(pg_get_serial_sequence('public.pagos', 'numero'));

    for v_l in
      select t.value
      from jsonb_array_elements(p_lineas) with ordinality as t(value, ord)
      order by case t.value->>'medio' when 'efectivo' then 1 else 2 end, t.ord
    loop
      v_n := v_n + 1;
      v_medio := (v_l->>'medio')::public.medio_pago;
      v_monto := round((btrim(v_l->>'monto'))::numeric, 2);
      insert into public.pagos (
        org_id, numero, cliente_id, caja_id, medio, monto, notas, recibido_por,
        titular_transferencia, comprobante_path, lote_id, linea)
      overriding system value
      values (
        v_org, v_numero, p_cliente, p_caja, v_medio, v_monto,
        case when v_n = 1 then nullif(btrim(coalesce(p_notas, '')), '') end,
        v_yo,
        case when v_medio = 'transferencia' then btrim(v_l#>>'{transferencia,titular}') end,
        case when v_medio = 'transferencia'
          then nullif(btrim(coalesce(v_l#>>'{transferencia,comprobante_path}', '')), '') end,
        v_lote, v_n)
      returning id into v_pago_id;

      -- El cargo nuevo primero: como las líneas suman exacto, todo va a SU cargo del día.
      v_res := private.imputar_pago(v_pago_id, p_cliente, v_monto, v_cargo_id);
      v_sobra := v_sobra + (v_res->>'restante')::numeric;
    end loop;

    if v_sobra > 0.009 then
      raise exception 'No se pudo imputar el cobro del ambulante: revisá los montos';
    end if;
  exception
    when unique_violation then
      if p_lote is not null then
        select p.cliente_id into v_otro from public.pagos p where p.lote_id = p_lote order by p.linea limit 1;
        if found then
          if v_otro is distinct from p_cliente then
            raise exception 'Ese cobro ya se registró para otro cliente';
          end if;
          select jsonb_build_object('cargo_id', c.id, 'desde', c.desde, 'hasta', c.hasta,
                                    'dias', (c.hasta - c.desde) + 1, 'precio_dia', c.precio_unitario)
            into v_extra
          from public.cargos c
          where c.lote_id = p_lote and c.origen = 'diario'
          order by c.creado_en limit 1;
          return private.resumen_lote(p_lote) || coalesce(v_extra, '{}'::jsonb)
                 || jsonb_build_object('repetido', true);
        end if;
      end if;
      raise;
  end;

  return private.resumen_lote(v_lote) || jsonb_build_object(
    'cargo_id', v_cargo_id,
    'desde', v_desde,
    'hasta', v_hasta,
    'dias', p_dias,
    'precio_dia', v_amb.precio,
    'repetido', false);
end $$;
revoke all on function public.cobrar_diario(uuid, uuid, integer, jsonb, date, text, uuid) from public, anon;
grant execute on function public.cobrar_diario(uuid, uuid, integer, jsonb, date, text, uuid) to authenticated;


-- ------------------------------------------------------------
-- 3. Recibir la caja de portería contando el efectivo (A3, "cada peso tiene un responsable").
-- ------------------------------------------------------------
-- Firma nueva: + p_efectivo_recibido. La vieja (uuid, text) se borra para no dejar dos
-- sobrecargas (una llamada con 2 argumentos sería ambigua).
drop function if exists public.integrar_caja_porteria(uuid, text);

create or replace function public.integrar_caja_porteria(
  p_caja uuid,
  p_observaciones text default null,
  p_efectivo_recibido numeric default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
  v_yo uuid := (select auth.uid());
  v_caja public.cajas;
  v_destino public.cajas;
  v_nueva uuid;
  v_obs text := nullif(trim(coalesce(p_observaciones, '')), '');
  v_recibido numeric := round(p_efectivo_recibido, 2);
  v_dif numeric := 0;
  v_quien text;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('admin', 'tesoreria', 'lider') then
    raise exception 'Solo administración puede recibir la caja de portería';
  end if;
  if v_recibido is not null and v_recibido < 0 then
    raise exception 'El efectivo recibido no puede ser negativo';
  end if;
  if char_length(coalesce(v_obs, '')) > 500 then
    raise exception 'Las observaciones son muy largas: resumilas';
  end if;

  -- Bloqueos §4.0: primero la caja de portería, después la de administración.
  select * into v_caja from public.cajas where id = p_caja and org_id = v_org for update;
  if not found then raise exception 'Caja inexistente'; end if;
  if v_caja.tipo <> 'guardia' then raise exception 'Solo se integran cajas de portería'; end if;

  -- Reintento del mismo usuario (se cortó la red y no le llegó la respuesta): no es un error,
  -- se devuelve lo que ya quedó registrado. La diferencia es la que anotó ESA recepción: el
  -- ajuste se insertó en la misma transacción que marcó integrada_en (now() es el mismo), así
  -- que la pantalla vuelve a mostrar "Faltaron $X" aunque la primera respuesta no llegó.
  if v_caja.estado = 'integrada' and v_caja.integrada_por = v_yo then
    select coalesce(sum(m.monto), 0) into v_dif
    from public.movimientos_tesoreria m
    where m.caja_id = p_caja
      and m.tipo = 'ajuste'
      and m.creado_en = v_caja.integrada_en
      and m.descripcion like 'Diferencia al recibir la caja de portería%';
    return jsonb_build_object(
      'caja_destino', v_caja.caja_destino_id,
      'efectivo', coalesce(v_caja.total_efectivo, 0),
      'transferencia', coalesce(v_caja.total_transferencia, 0),
      'canon', coalesce(v_caja.total_canon, 0),
      'quintas', coalesce(v_caja.total_quintas, 0),
      'ambulantes', coalesce(v_caja.total_ambulantes, 0),
      'ajustes', coalesce(v_caja.total_ajustes, 0),
      'diferencia', v_dif,
      'repetido', true);
  end if;
  if v_caja.estado in ('integrada', 'validada') then
    select pf.nombre into v_quien from public.perfiles pf where pf.user_id = v_caja.integrada_por;
    raise exception 'Esta caja de portería ya la recibió %: actualizá la pantalla',
      coalesce(v_quien, 'otra persona');
  end if;
  if v_caja.estado <> 'cerrada' then
    raise exception 'La caja de portería tiene que estar rendida (cerrada) para recibirla';
  end if;

  -- Caja de administración de hoy (se crea si hace falta, §4.0-4).
  insert into public.cajas (org_id, tipo, fecha, abierta_por)
  values (v_org, 'administracion', v_hoy, v_yo)
  on conflict (org_id, tipo, fecha) do nothing
  returning id into v_nueva;
  if v_nueva is not null then
    perform private.registrar_evento_caja(v_nueva, 'apertura', 'Abierta al recibir la caja de portería');
  end if;
  select * into v_destino from public.cajas
  where org_id = v_org and tipo = 'administracion' and fecha = v_hoy for update;
  if v_destino.estado = 'validada' then
    raise exception 'La caja de administración de hoy ya fue validada por tesorería: la caja de portería entra mañana';
  end if;

  -- 0023: lo que se contó al recibir. Si no coincide con lo rendido, la diferencia queda como
  -- ajuste (faltante/sobrante en efectivo) de la CAJA DE PORTERÍA: el faltante es de la
  -- rendición del Jefe, no aparece después como faltante de Administración.
  if v_recibido is not null then
    perform private.recalcular_arqueo(p_caja);  -- totales frescos antes de comparar
    select * into v_caja from public.cajas where id = p_caja;
    v_dif := round(v_recibido - coalesce(v_caja.total_efectivo, 0), 2);
    if v_dif <> 0 then
      if v_obs is null then
        raise exception 'Contá qué pasó con la diferencia de %: queda anotado en la caja',
          private.caja_pesos(abs(v_dif));
      end if;
      perform private.registrar_evento_caja(p_caja, 'ajuste',
        case when v_dif < 0 then 'Faltante ' else 'Sobrante ' end || private.caja_pesos(abs(v_dif))
        || ' en efectivo: al recibir la caja de portería (recibido ' || private.caja_pesos(v_recibido)
        || ') · ' || v_obs);
      -- El trigger recalcular_caja recalcula la caja de portería (está cerrada).
      insert into public.movimientos_tesoreria
        (org_id, fecha, tipo, moneda, cuenta, caja_id, monto, descripcion, creado_por)
      values
        (v_org, v_caja.fecha, 'ajuste', 'ARS', 'efectivo', p_caja, v_dif,
         left('Diferencia al recibir la caja de portería (recibido ' || private.caja_pesos(v_recibido)
              || '): ' || v_obs, 300),
         v_yo);
      select * into v_caja from public.cajas where id = p_caja;
    end if;
  end if;

  update public.cajas set
    estado = 'integrada',
    caja_destino_id = v_destino.id,
    integrada_por = v_yo,
    integrada_en = now(),
    observaciones = case when v_obs is null then observaciones
      else trim(both ' · ' from coalesce(observaciones, '') || ' · ' || v_obs) end
  where id = p_caja;

  if v_destino.estado = 'cerrada' then
    perform private.recalcular_arqueo(v_destino.id);
  end if;

  perform private.registrar_evento_caja(p_caja, 'integracion',
    'Integrada a la caja de administración del ' || to_char(v_destino.fecha, 'DD/MM/YYYY')
    || coalesce(' · ' || v_obs, ''));
  perform private.registrar_evento_caja(v_destino.id, 'recibe_rendicion',
    'Recibe la caja de portería del ' || to_char(v_caja.fecha, 'DD/MM')
    || ': efectivo ' || private.caja_pesos(coalesce(v_caja.total_efectivo, 0))
    || ' — Quintas ' || private.caja_pesos(coalesce(v_caja.total_quintas, 0))
    || ' · Ambulantes ' || private.caja_pesos(coalesce(v_caja.total_ambulantes, 0))
    || ' · Bono camioneros ' || private.caja_pesos(coalesce(v_caja.total_canon, 0))
    || case when v_dif < 0 then ' (faltaron ' || private.caja_pesos(abs(v_dif)) || ')'
            when v_dif > 0 then ' (sobraron ' || private.caja_pesos(v_dif) || ')'
            else '' end);

  return jsonb_build_object(
    'caja_destino', v_destino.id,
    'efectivo', coalesce(v_caja.total_efectivo, 0),
    'transferencia', coalesce(v_caja.total_transferencia, 0),
    'canon', coalesce(v_caja.total_canon, 0),
    'quintas', coalesce(v_caja.total_quintas, 0),
    'ambulantes', coalesce(v_caja.total_ambulantes, 0),
    'ajustes', coalesce(v_caja.total_ajustes, 0),
    'diferencia', v_dif,
    'repetido', false
  );
end $$;
revoke all on function public.integrar_caja_porteria(uuid, text, numeric) from public, anon;
grant execute on function public.integrar_caja_porteria(uuid, text, numeric) to authenticated;


-- ------------------------------------------------------------
-- 4. Último día pago de cada ambulante (lista de cobro del Jefe y del Líder).
--    security_invoker: rige la RLS de cargos (el Jefe ve solo clientes de Portería).
-- ------------------------------------------------------------
create or replace view public.v_ultimo_pago_ambulante with (security_invoker = true) as
select c.org_id, c.cliente_id, max(c.hasta) as pago_hasta
from public.cargos c
where c.origen = 'diario' and c.estado <> 'anulado' and c.hasta is not null
group by c.org_id, c.cliente_id;
revoke all on public.v_ultimo_pago_ambulante from public, anon, authenticated;
grant select on public.v_ultimo_pago_ambulante to authenticated;


-- ------------------------------------------------------------
-- 5. Ingreso de personal idempotente: el formulario manda su propio id (uuid) y un
--    reintento tras un corte de red choca con la PK en vez de duplicar el ingreso.
--    ingreso_en y registrado_por siguen siendo del servidor (0022).
-- ------------------------------------------------------------
grant insert (id) on public.ingresos_personal to authenticated;
