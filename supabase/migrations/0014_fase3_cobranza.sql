-- ============================================================
-- Mercado San Miguel — 0014 Fase 3: M1 · Cobranza
-- Contrato: docs/FASE3-CONTRATO.md §4.0, §4.1–§4.4 y §1.3 (D-P2: el Líder cobra).
--
-- Solo `create or replace` de las funciones de M1, con la firma EXACTA de 0012 (o la de
-- fase 2 para las modificadas), más las privadas nuevas de M1. Idempotente: se puede
-- re-correr. Se aplica como UNA transacción, en la ventana de mantenimiento (§0.3).
--
--   private.cobro_pesos(numeric)            → "$ 1.234" / "$ 1.234,50" para los mensajes
--   private.cobro_fecha(text, text)         → fecha ISO del JSON o error legible
--   private.puestos_cliente(uuid)           → "Puesto 34½ · Puesto 52 · Local 3" (snapshot del cheque)
--   private.imputar_pago(...)               → imputación de un pago (algoritmo único)
--   private.resumen_lote(uuid)              → JSON del cobro (retorno de las RPC)
--   public.registrar_cobro(...)             → cobro mixto (admin, guardia, lider)
--   public.cobrar_diario(...)               → días del ambulante (guardia, lider)
--   public.datos_recibo(uuid)               → recibo del lote (staff y socio dueño)
--   public.anular_pago(uuid, text)          → anula el RECIBO completo
--   public.aplicar_saldo_favor_cliente(uuid)
--   public.registrar_pago(...)              → DEPRECADA: wrapper de registrar_cobro
--
-- Reglas §4.0: candado de idempotencia → caja → cliente → cargos → cheques.
-- Dependencias de otros módulos (se resuelven en ejecución, todo es plpgsql):
--   · private.recalcular_arqueo (M2) — anular_pago la llama si la caja está cerrada/integrada.
--   · public.abrir_caja (M2) — la usa la server action antes de cobrar (el Líder abre la
--     caja de administración: D-P2).
-- ============================================================


-- ------------------------------------------------------------
-- Helpers privados de M1
-- ------------------------------------------------------------

-- Pesos para los mensajes de error: "$ 1.234.567" o "$ 1.234,50". Independiente del locale.
create or replace function private.cobro_pesos(p_monto numeric)
returns text
language sql immutable set search_path = '' as $$
  select '$ ' || case
    when round(coalesce(p_monto, 0), 2) = trunc(coalesce(p_monto, 0))
      then translate(to_char(round(coalesce(p_monto, 0)), 'FM999,999,999,990'), ',', '.')
    else translate(to_char(round(coalesce(p_monto, 0), 2), 'FM999,999,999,990.00'), ',.', '.,')
  end
$$;

-- Fecha "YYYY-MM-DD" que viene en el JSON de una línea. Vacía → null. Inválida → p_mensaje.
create or replace function private.cobro_fecha(p_texto text, p_mensaje text)
returns date
language plpgsql immutable set search_path = '' as $$
declare
  v_txt text := btrim(coalesce(p_texto, ''));
begin
  if v_txt = '' then
    return null;
  end if;
  if v_txt !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception '%', p_mensaje;
  end if;
  return v_txt::date;
exception
  when datetime_field_overflow or invalid_datetime_format then
    raise exception '%', p_mensaje;
end $$;

-- Espacios del cliente, legibles y ordenados (tipo y número): el "puesto" del cheque (A2).
create or replace function private.puestos_cliente(p_cliente uuid)
returns text
language sql stable security definer set search_path = '' as $$
  select string_agg(s.etiqueta, ' · ' order by s.orden_tipo, s.orden_num, s.etiqueta)
  from (
    select distinct
      case e.tipo
        when 'puesto' then 'Puesto ' || coalesce(e.numero, '') || case when e.medio then '½' else '' end
        when 'local' then 'Local ' || coalesce(e.numero, '')
        when 'contenedor' then 'Contéiner ' || coalesce(e.numero, '')
        else btrim('Bar ' || coalesce(e.numero, ''))
      end as etiqueta,
      case e.tipo when 'puesto' then 1 when 'local' then 2 when 'contenedor' then 3 else 4 end as orden_tipo,
      coalesce(nullif(regexp_replace(coalesce(e.numero, ''), '[^0-9]', '', 'g'), '')::bigint, 0) as orden_num
    from public.espacios e
    where e.cliente_id = p_cliente
  ) s
$$;

-- Imputa un pago a los cargos pendientes del cliente (mismo algoritmo que fase 2 y que
-- private.aplicar_saldo_favor): deuda más vieja primero, orden de imputación del concepto,
-- beneficio por pago en término si hoy ≤ vencimiento. p_cargo_primero va adelante de todo
-- (el cargo AMB recién creado del ambulante: nunca paga una multa vieja).
-- Quien llama ya tiene bloqueado al cliente (§4.0-2); acá se bloquean los cargos en orden.
create or replace function private.imputar_pago(
  p_pago uuid,
  p_cliente uuid,
  p_monto numeric,
  p_cargo_primero uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_hoy date := private.hoy_ar();
  v_org uuid;
  v_restante numeric := round(coalesce(p_monto, 0), 2);
  v_cargo record;
  v_objetivo numeric;
  v_saldo numeric;
  v_aplicar numeric;
  v_detalle jsonb := '[]'::jsonb;
begin
  select p.org_id into v_org from public.pagos p where p.id = p_pago;
  if v_org is null then
    raise exception 'Cobro inexistente';
  end if;

  for v_cargo in
    select c.id, c.monto, c.monto_pagado, c.descuento_pronto_pago, c.vencimiento,
           c.codigo, c.descripcion, c.periodo
    from public.cargos c
    join public.conceptos co on co.id = c.concepto_id
    where c.cliente_id = p_cliente
      and c.estado in ('pendiente','parcial')
    order by coalesce(c.id = p_cargo_primero, false) desc,
             c.periodo asc, co.orden_imputacion asc, c.creado_en asc
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
    values (v_org, p_pago, v_cargo.id, v_aplicar);

    update public.cargos set
      monto_pagado = monto_pagado + v_aplicar,
      descuento_aplicado = case
        when v_aplicar = v_saldo and v_hoy <= vencimiento then monto - v_objetivo
        else descuento_aplicado end,
      estado = case when v_aplicar = v_saldo
        then 'pagado'::public.estado_cargo else 'parcial'::public.estado_cargo end
    where id = v_cargo.id;

    v_detalle := v_detalle || jsonb_build_object(
      'cargo_id', v_cargo.id,
      'codigo', v_cargo.codigo,
      'descripcion', v_cargo.descripcion,
      'periodo', v_cargo.periodo,
      'monto', v_aplicar,
      'saldado', v_aplicar = v_saldo);
    v_restante := v_restante - v_aplicar;
  end loop;

  return jsonb_build_object('detalle', v_detalle, 'restante', greatest(v_restante, 0));
end $$;

-- El cobro (lote) como lo devuelven registrar_cobro / cobrar_diario (§4.1 "Retorno", sin "repetido").
-- imputaciones: agrupadas por cargo, solo de las líneas vigentes. saldo_favor: lo cobrado
-- vigente que no quedó imputado a ningún cargo.
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
    join l on l.id = im.pago_id and not l.anulado
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

revoke all on function private.cobro_pesos(numeric) from public, anon;
revoke all on function private.cobro_fecha(text, text) from public, anon;
revoke all on function private.puestos_cliente(uuid) from public, anon;
revoke all on function private.imputar_pago(uuid, uuid, numeric, uuid) from public, anon;
revoke all on function private.resumen_lote(uuid) from public, anon;
grant execute on function private.cobro_pesos(numeric) to authenticated;
grant execute on function private.cobro_fecha(text, text) to authenticated;
grant execute on function private.puestos_cliente(uuid) to authenticated;
grant execute on function private.imputar_pago(uuid, uuid, numeric, uuid) to authenticated;
grant execute on function private.resumen_lote(uuid) to authenticated;


-- ------------------------------------------------------------
-- registrar_cobro — cobro mixto (A1, A2, G2, G8, J1, §1.3 D-P2). Contrato §4.1.
--   admin  → caja de administración, puesteros, con cheque.
--   guardia → caja de portería, quinteros y ambulantes, sin cheque.
--   lider  → caja de administración, cualquier categoría, con cheque.
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
    raise exception 'La caja ya está cerrada: pedí la reapertura para seguir cobrando';
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
-- cobrar_diario — días del ambulante (G5, G6, §1.2-1, §1.3 D-P2). Contrato §4.2.
--   guardia → caja de portería · lider → caja de administración.
--   Crea el cargo AMB por N días y lo paga en el mismo acto (las líneas suman exacto).
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
    raise exception 'La caja ya está cerrada: pedí la reapertura para seguir cobrando';
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
-- datos_recibo — el lote completo de un pago (B1, A1, A2). Contrato §4.3.
--   admin, tesoreria, lider: cualquier pago de la org · guardia: clientes de Portería ·
--   socio: solo los suyos (sin comprobante, notas, estado ni proveedor del cheque).
--   Si no corresponde → 'Recibo inexistente' (nunca revela que existe).
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
  v_total numeric;
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
    coalesce(bool_and(p.anulado), false)
  into v_lineas, v_total, v_anulado
  from public.pagos p
  left join public.cheques ch on ch.id = p.cheque_id
  where p.lote_id = v_pago.lote_id;

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
           case when c.estado = 'pagado' then c.descuento_aplicado else 0 end as beneficio
    from public.imputaciones i
    join public.pagos pp on pp.id = i.pago_id and not pp.anulado
    join public.cargos c on c.id = i.cargo_id
    left join public.conceptos co on co.id = c.concepto_id
    where pp.lote_id = v_pago.lote_id
    group by c.id, c.codigo, c.descripcion, c.periodo, co.orden_imputacion, c.estado, c.descuento_aplicado
  ) x;

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
    'lineas', v_lineas,
    'imputaciones', v_imputaciones,
    'saldo_favor', greatest(v_total - v_imputado, 0));
end $$;
revoke all on function public.datos_recibo(uuid) from public, anon;
grant execute on function public.datos_recibo(uuid) to authenticated;


-- ------------------------------------------------------------
-- anular_pago — anula el RECIBO completo (todas las líneas vigentes del lote). §4.4.
--   admin: cajas de administración abiertas · guardia: cajas de portería abiertas ·
--   tesoreria: abiertas, cerradas o integradas · lider (D-P2): cualquier caja no validada.
--   Bloqueos §4.0: caja for update → cliente for update → cargos.
-- ------------------------------------------------------------
create or replace function public.anular_pago(p_pago uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_yo uuid := (select auth.uid());
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_pago public.pagos;
  v_caja public.cajas;
  v_l record;
  v_total numeric;
  v_ids uuid[];
begin
  if v_org is null then
    raise exception 'Sin perfil activo';
  end if;
  if v_rol is null or v_rol not in ('admin','guardia','tesoreria','lider') then
    raise exception 'No tenés permiso para anular cobros';
  end if;
  if v_motivo = '' then
    raise exception 'Indicá el motivo de la anulación';
  end if;

  select * into v_pago from public.pagos where id = p_pago and org_id = v_org;
  if not found then
    raise exception 'Cobro inexistente';
  end if;

  -- (b) caja → (c) cliente. Estados después de los bloqueos.
  select * into v_caja from public.cajas where id = v_pago.caja_id for update;
  perform 1 from public.clientes where id = v_pago.cliente_id for update;
  perform 1 from public.pagos where lote_id = v_pago.lote_id order by linea for update;

  if v_rol = 'guardia' and v_caja.tipo <> 'guardia' then
    raise exception 'Solo podés anular cobros de la caja de portería';
  end if;
  if v_rol = 'admin' and v_caja.tipo <> 'administracion' then
    raise exception 'Solo podés anular cobros de la caja de administración';
  end if;
  if v_caja.estado = 'validada' then
    raise exception 'La caja ya fue validada; si es un cheque rebotado, marcalo como rechazado desde Cheques';
  end if;
  if v_rol in ('admin','guardia') and v_caja.estado <> 'abierta' then
    raise exception 'La caja ya se cerró: pedí la reapertura o la anulación a tesorería';
  end if;

  select array_agg(p.id order by p.linea desc), coalesce(sum(p.monto), 0)
    into v_ids, v_total
  from public.pagos p
  where p.lote_id = v_pago.lote_id and not p.anulado;
  if v_ids is null then
    raise exception 'El cobro ya está anulado';
  end if;

  -- Un cheque que ya salió de la cartera no se anula desde la caja.
  for v_l in
    select ch.numero, ch.estado
    from public.pagos p
    join public.cheques ch on ch.id = p.cheque_id
    where p.id = any (v_ids) and ch.estado <> 'en_cartera'
    order by p.linea
    limit 1
  loop
    raise exception 'El cheque N° % ya fue %: pedile a Tesorería que lo resuelva desde Cheques',
      v_l.numero,
      case v_l.estado
        when 'entregado' then 'entregado a un proveedor'
        when 'depositado' then 'depositado'
        when 'acreditado' then 'acreditado'
        else 'rechazado' end;
  end loop;

  -- (d) cargos: se revierten las imputaciones de cada línea (la última primero).
  for v_l in select unnest(v_ids) as id loop
    perform private.revertir_imputaciones(v_l.id);
  end loop;

  -- (e) cheques en cartera del lote: se borran (pagos.cheque_id queda en null por la FK).
  delete from public.cheques ch
  using public.pagos p
  where p.id = any (v_ids) and ch.id = p.cheque_id and ch.estado = 'en_cartera';

  update public.pagos set
    anulado = true,
    anulado_por = v_yo,
    anulado_en = now(),
    motivo_anulacion = v_motivo
  where id = any (v_ids);

  -- Los días del ambulante de este recibo no quedan como deuda.
  update public.cargos set estado = 'anulado'
  where lote_id = v_pago.lote_id and origen = 'diario' and monto_pagado = 0
    and estado <> 'anulado';

  perform private.registrar_evento_caja(
    v_caja.id, 'cobro_anulado',
    'Recibo N° ' || v_pago.numero || ' · ' || private.cobro_pesos(v_total) || ' · ' || v_motivo);

  if v_caja.estado in ('cerrada','integrada') then
    perform private.recalcular_arqueo(v_caja.id);
  end if;
end $$;
revoke all on function public.anular_pago(uuid, text) from public, anon;
grant execute on function public.anular_pago(uuid, text) to authenticated;


-- ------------------------------------------------------------
-- aplicar_saldo_favor_cliente — Tesorería sale (J4); cada rol sobre su categoría. §4.4.
-- Aplicar un crédito que ya está en la cuenta no mueve plata de ninguna caja.
-- ------------------------------------------------------------
create or replace function public.aplicar_saldo_favor_cliente(p_cliente uuid)
returns numeric
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
begin
  if v_org is null then
    raise exception 'Sin perfil activo';
  end if;
  if v_rol is null or v_rol not in ('admin','guardia','lider') then
    raise exception 'Sin permiso para aplicar saldo a favor';
  end if;
  perform 1 from public.clientes where id = p_cliente and org_id = v_org for update;
  if not found then
    raise exception 'Cliente inexistente';
  end if;
  if not private.puede_gestionar_cliente(p_cliente) then
    if v_rol = 'guardia' then
      raise exception 'A este cliente lo gestiona Administración';
    end if;
    raise exception 'A quinteros y ambulantes los gestiona el Jefe de Portería';
  end if;
  return private.aplicar_saldo_favor(p_cliente);
end $$;
revoke all on function public.aplicar_saldo_favor_cliente(uuid) from public, anon;
grant execute on function public.aplicar_saldo_favor_cliente(uuid) to authenticated;


-- ------------------------------------------------------------
-- registrar_pago — DEPRECADA (§4.4, §8). Misma firma de fase 2; ahora es un wrapper de
-- registrar_cobro: nadie cobra por fuera de las reglas nuevas. Devuelve la forma vieja.
-- Se borra en 0023_fase3_limpieza.sql.
-- ------------------------------------------------------------
create or replace function public.registrar_pago(
  p_cliente uuid,
  p_monto numeric,
  p_medio public.medio_pago,
  p_caja uuid,
  p_cheque jsonb default null,
  p_notas text default null,
  p_transferencia jsonb default null,
  p_permitir_saldo_favor boolean default false
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_linea jsonb;
  v_res jsonb;
begin
  v_linea := jsonb_build_object('medio', p_medio, 'monto', p_monto);
  if p_medio = 'transferencia' then
    v_linea := v_linea || jsonb_build_object('transferencia', coalesce(p_transferencia, '{}'::jsonb));
  elsif p_medio = 'cheque' then
    v_linea := v_linea || jsonb_build_object('cheque', jsonb_strip_nulls(jsonb_build_object(
      'numero', p_cheque->>'numero',
      'cuit', p_cheque->>'cuit',
      'recibido_de', coalesce(p_cheque->>'recibido_de', p_cheque->>'titular'),
      'fecha_recepcion', p_cheque->>'fecha_recepcion',
      'fecha_cobro', p_cheque->>'fecha_cobro',
      'estado', p_cheque->>'estado',
      'proveedor', p_cheque->>'proveedor')));
  end if;

  v_res := public.registrar_cobro(
    p_cliente, p_caja, jsonb_build_array(v_linea), p_notas,
    coalesce(p_permitir_saldo_favor, false), null);

  return jsonb_build_object(
    'pago_id', v_res->'pago_id',
    'numero', v_res->'numero',
    'imputaciones', v_res->'imputaciones',
    'saldo_favor', v_res->'saldo_favor');
end $$;
revoke all on function public.registrar_pago(uuid, numeric, public.medio_pago, uuid, jsonb, text, jsonb, boolean) from public, anon;
grant execute on function public.registrar_pago(uuid, numeric, public.medio_pago, uuid, jsonb, text, jsonb, boolean) to authenticated;


-- ------------------------------------------------------------
-- Pedidos a Fundación (no son de M1; no se escriben acá):
--   · Ninguna policy nueva. registrar_cobro/cobrar_diario/datos_recibo son security definer.
--   · abrir_caja (M2): el Líder tiene que poder abrir la caja de administración (§1.3 D-P2);
--     la server action de M1 la llama antes de cobrar.
-- ------------------------------------------------------------
