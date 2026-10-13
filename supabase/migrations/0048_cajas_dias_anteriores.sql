-- ============================================================
-- Mercado San Miguel — 0048 Cajas de días anteriores
--
-- El sistema solo dejaba abrir y cargar la caja de HOY. Ahora se puede abrir la caja de un
-- día anterior (hasta dos meses atrás) y cargar ahí lo que se cobró ese día y no se registró
-- en el momento: los cobros, el canon y la rendición de portería quedan con la fecha de ESA caja.
--
--  · abrir_caja(p_tipo, p_fecha)           — p_fecha opcional (sin fecha = hoy, como antes).
--  · private.imputar_pago                  — el beneficio por pago en término se mide con el
--                                            día de la caja del cobro, no con el día de carga.
--  · registrar_cobro / cobrar_diario       — en una caja de un día anterior, el cobro (y el
--                                            cheque) llevan la fecha de esa caja.
--  · registrar_canon(…, p_fecha)           — canon de un día anterior (solo el Líder) en la
--                                            caja de portería de ese día, ya abierta.
--  · integrar_caja_porteria(…, p_fecha_destino) — la caja de portería puede entrar en la caja
--                                            de administración de un día anterior.
--
-- Las tres firmas que cambian suman un parámetro opcional AL FINAL: la versión anterior de la
-- app (que no lo manda) sigue andando durante el deploy. Se borra la firma vieja para no dejar
-- dos sobrecargas. Los cuerpos son los vigentes (0013, 0015, 0023, 0034, 0044) con el cambio
-- marcado "0048".
-- ============================================================


-- ------------------------------------------------------------
-- 1. Abrir la caja de hoy o de un día anterior.
-- ------------------------------------------------------------
drop function if exists public.abrir_caja(public.tipo_caja);

create or replace function public.abrir_caja(p_tipo public.tipo_caja, p_fecha date default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
  v_fecha date := coalesce(p_fecha, v_hoy);
  v_id uuid;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol = 'tesoreria' then
    raise exception 'Tesorería no abre cajas: las abre quien cobra';
  end if;
  if p_tipo is null or not (
    v_rol = 'lider'
    or (v_rol = 'admin' and p_tipo = 'administracion')
    or (v_rol = 'guardia' and p_tipo = 'guardia')
  ) then
    raise exception 'No tenés permiso para abrir esta caja';
  end if;
  -- 0048: también la de un día anterior (para cargar lo que no se registró en el momento).
  if v_fecha > v_hoy then
    raise exception 'Ese día todavía no llegó: no se puede abrir su caja';
  end if;
  if v_fecha < v_hoy - 62 then
    raise exception 'Solo se pueden abrir cajas de los últimos dos meses';
  end if;

  -- §4.0-4: nunca "if not exists … insert" (dos personas a la vez chocan con la UNIQUE).
  insert into public.cajas (org_id, tipo, fecha, abierta_por)
  values (v_org, p_tipo, v_fecha, (select auth.uid()))
  on conflict (org_id, tipo, fecha) do nothing
  returning id into v_id;

  if v_id is not null then
    perform private.registrar_evento_caja(v_id, 'apertura',
      case when v_fecha < v_hoy
        then 'Caja de un día anterior: se abrió el ' || to_char(v_hoy, 'DD/MM/YYYY')
             || ' para cargar lo de ese día'
      end);
    return v_id;
  end if;

  select id into v_id from public.cajas
  where org_id = v_org and tipo = p_tipo and fecha = v_fecha;
  return v_id;
end $$;
revoke all on function public.abrir_caja(public.tipo_caja, date) from public, anon;
grant execute on function public.abrir_caja(public.tipo_caja, date) to authenticated;


-- ------------------------------------------------------------
-- 2. Imputación: el día del cobro es el de su caja.
-- ------------------------------------------------------------
create or replace function private.imputar_pago(p_pago uuid, p_cliente uuid, p_monto numeric, p_cargo_primero uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_hoy date := private.hoy_ar();
  v_dia date;
  v_org uuid;
  v_restante numeric := round(coalesce(p_monto, 0), 2);
  v_cargo record;
  v_objetivo numeric;
  v_saldo numeric;
  v_aplicar numeric;
  v_detalle jsonb := '[]'::jsonb;
begin
  -- 0048: el cobro vale por el día de SU caja (una caja de un día anterior que se carga
  -- después): quien pagó en término ese día conserva el beneficio aunque se registre tarde.
  select p.org_id, least(c.fecha, v_hoy) into v_org, v_dia
  from public.pagos p
  join public.cajas c on c.id = p.caja_id
  where p.id = p_pago;
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
    v_objetivo := case when v_dia <= v_cargo.vencimiento
      then private.monto_con_beneficio(v_cargo.monto, v_cargo.descuento_pronto_pago)
      else v_cargo.monto end;
    v_saldo := v_objetivo - v_cargo.monto_pagado;
    continue when v_saldo <= 0;
    v_aplicar := least(v_restante, v_saldo);

    insert into public.imputaciones (org_id, pago_id, cargo_id, monto)
    values (v_org, p_pago, v_cargo.id, v_aplicar);

    update public.cargos set
      monto_pagado = monto_pagado + v_aplicar,
      descuento_aplicado = case
        when v_aplicar = v_saldo and v_dia <= vencimiento then monto - v_objetivo
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
end $function$;
revoke all on function private.imputar_pago(uuid, uuid, numeric, uuid) from public, anon;
grant execute on function private.imputar_pago(uuid, uuid, numeric, uuid) to authenticated;


-- ------------------------------------------------------------
-- 3. registrar_cobro: en una caja de un día anterior, el cobro lleva la fecha de esa caja.
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
  v_dia date;
  v_fecha_pago timestamptz;
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

  -- 0048: en una caja de un día anterior el cobro lleva la fecha de ESA caja (con la hora en
  -- que se carga, para que los recibos del día queden en el orden en que se cargaron).
  v_dia := least(v_caja.fecha, v_hoy);
  v_fecha_pago := case when v_dia < v_hoy
    then (v_dia + (now() at time zone 'America/Argentina/Cordoba')::time)
         at time zone 'America/Argentina/Cordoba'
    else now() end;

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
        v_dia);
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
          'La fecha de recepción del cheque no es válida'), v_dia);
        v_f_cobro := coalesce(private.cobro_fecha(v_l#>>'{cheque,fecha_cobro}',
          'La fecha de cobro del cheque no es válida'), v_dia);

        insert into public.cheques (
          org_id, cliente_id, numero, cuit, recibido_de, titular, es_tercero, puesto, monto,
          fecha_recibido, fecha_cobro, estado, proveedor,
          fecha_entregado, entregado_por, entregado_en_cobro, creado_por)
        values (
          v_org, p_cliente, v_num_cheque, v_cuit, v_recibido_de, v_recibido_de,
          coalesce(v_cuit <> v_cuit_cli, false), v_puestos, v_monto,
          v_f_recepcion, v_f_cobro, v_estado_ch::public.estado_cheque,
          case when v_estado_ch = 'entregado' then v_proveedor end,
          case when v_estado_ch = 'entregado' then v_dia end,
          case when v_estado_ch = 'entregado' then v_yo end,
          v_estado_ch = 'entregado',
          v_yo)
        returning id into v_cheque_id;
      end if;

      insert into public.pagos (
        org_id, numero, cliente_id, caja_id, fecha, medio, monto, cheque_id, notas, recibido_por,
        titular_transferencia, comprobante_path, lote_id, linea)
      overriding system value
      values (
        v_org, v_numero, p_cliente, p_caja, v_fecha_pago, v_medio, v_monto, v_cheque_id,
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
-- 4. cobrar_diario: ídem; los días que paga el ambulante se cuentan desde el día de la caja.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cobrar_diario(p_cliente uuid, p_caja uuid, p_dias integer, p_lineas jsonb, p_desde date DEFAULT NULL::date, p_notas text DEFAULT NULL::text, p_lote uuid DEFAULT NULL::uuid, p_precio numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
  v_yo uuid := (select auth.uid());
  v_caja public.cajas;
  v_cli public.clientes;
  v_amb public.conceptos;
  v_precio numeric;
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
  v_dia date;
  v_fecha_pago timestamptz;
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

  -- 0048: en una caja de un día anterior el cobro lleva la fecha de ESA caja, y los días que
  -- paga se cuentan desde ese día (no desde el día en que se carga).
  v_dia := least(v_caja.fecha, v_hoy);
  v_fecha_pago := case when v_dia < v_hoy
    then (v_dia + (now() at time zone 'America/Argentina/Cordoba')::time)
         at time zone 'America/Argentina/Cordoba'
    else now() end;
  v_desde := coalesce(p_desde, v_dia);
  if v_desde < v_dia - 30 or v_desde > v_dia + 31 then
    raise exception '%', case when v_dia < v_hoy
      then 'Elegí un día cercano al de la caja' else 'Elegí un día cercano a hoy' end;
  end if;
  v_hasta := v_desde + (p_dias - 1);

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

  -- 0044: AMB es el concepto donde va el cargo (apagarlo sigue frenando los cobros). El
  -- precio por día lo pone quien cobra (sin precio predefinido); sin p_precio, como antes,
  -- el del concepto.
  select * into v_amb from public.conceptos
  where org_id = v_org and codigo = 'AMB' and activo
  limit 1;
  if not found then
    raise exception 'Los cobros a ambulantes están desactivados: el concepto AMB está apagado en Configuración → Precios';
  end if;
  v_precio := round(coalesce(p_precio, nullif(v_amb.precio, 0)), 2);
  if v_precio is null or v_precio <= 0 then
    raise exception 'Poné cuánto paga por día';
  end if;
  if v_precio > 10000000 then
    raise exception 'El precio por día es demasiado alto';
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
  v_total := round(p_dias * v_precio, 2);
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
      private.cobro_pesos(v_precio);
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
      p_dias, v_precio, v_total, 0, v_desde, 'diario', v_desde, v_hasta, v_lote)
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
        org_id, numero, cliente_id, caja_id, fecha, medio, monto, notas, recibido_por,
        titular_transferencia, comprobante_path, lote_id, linea)
      overriding system value
      values (
        v_org, v_numero, p_cliente, p_caja, v_fecha_pago, v_medio, v_monto,
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
    'precio_dia', v_precio,
    'repetido', false);
end $function$;

revoke all on function public.cobrar_diario(uuid, uuid, integer, jsonb, date, text, uuid, numeric) from public, anon;
grant execute on function public.cobrar_diario(uuid, uuid, integer, jsonb, date, text, uuid, numeric) to authenticated, service_role;


-- ------------------------------------------------------------
-- 5. registrar_canon: + p_fecha (canon de un día anterior, en la caja de portería de ese día).
-- ------------------------------------------------------------
drop function if exists public.registrar_canon(uuid, integer, public.medio_pago, text, text, text, text, uuid);

create or replace function public.registrar_canon(
  p_tarifa uuid,
  p_cantidad integer default 1,
  p_medio public.medio_pago default 'efectivo',
  p_patente text default null,
  p_destino text default null,
  p_destino_detalle text default null,
  p_notas text default null,
  p_ref uuid default null,
  p_fecha date default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
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
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  -- Portería cobra el canon; el Líder también (§1.3 D-P2). El Jefe, Administración y Tesorería no.
  if v_rol is null or v_rol not in ('porteria', 'lider') then
    raise exception 'El canon de transporte lo cobra Portería';
  end if;
  -- 0048: canon de un día anterior (carga atrasada): solo el Líder, en la caja de ese día.
  if v_fecha > v_hoy then
    raise exception 'Ese día todavía no llegó';
  end if;
  if v_fecha < v_hoy and v_rol <> 'lider' then
    raise exception 'El canon de un día anterior lo carga el Líder de Procesos';
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
  -- 0048: la de un día anterior no se crea sola: se abre desde Caja.
  if v_fecha = v_hoy then
    insert into public.cajas (org_id, tipo, fecha, abierta_por)
    values (v_org, 'guardia', v_hoy, v_uid)
    on conflict (org_id, tipo, fecha) do nothing
    returning id into v_caja_id;
    if v_caja_id is not null then
      perform private.registrar_evento_caja(v_caja_id, 'apertura',
        'Abierta por Portería con el primer ingreso de transporte');
    end if;
  end if;

  select c.id, c.estado into v_caja_id, v_caja_estado
  from public.cajas c
  where c.org_id = v_org and c.tipo = 'guardia' and c.fecha = v_fecha
  for share;
  if v_fecha < v_hoy then
    if v_caja_id is null then
      raise exception 'No hay caja de portería del %: abrila desde Caja para cargar el canon de ese día',
        to_char(v_fecha, 'DD/MM');
    end if;
    if v_caja_estado is distinct from 'abierta' then
      raise exception 'La caja de portería del % ya está cerrada: reabrila desde Caja para seguir cargando',
        to_char(v_fecha, 'DD/MM');
    end if;
  elsif v_caja_id is null or v_caja_estado is distinct from 'abierta' then
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
      v_org, v_caja_id, v_fecha, 'camion', p_cantidad, v_monto, p_medio, v_notas, v_uid,
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
revoke all on function public.registrar_canon(uuid, integer, public.medio_pago, text, text, text, text, uuid, date) from public, anon;
grant execute on function public.registrar_canon(uuid, integer, public.medio_pago, text, text, text, text, uuid, date) to authenticated;


-- ------------------------------------------------------------
-- 6. integrar_caja_porteria: + p_fecha_destino (entra en la caja de administración de ese día).
-- ------------------------------------------------------------
drop function if exists public.integrar_caja_porteria(uuid, text, numeric);

create or replace function public.integrar_caja_porteria(
  p_caja uuid,
  p_observaciones text default null,
  p_efectivo_recibido numeric default null,
  p_fecha_destino date default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
  v_fecha_destino date := coalesce(p_fecha_destino, v_hoy);
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

  -- 0048: puede entrar en la caja de administración de un día anterior (carga atrasada: la
  -- rendición de ese día va a la caja mayor de ese día), nunca antes del día de la rendición.
  if v_fecha_destino > v_hoy then
    raise exception 'Ese día todavía no llegó';
  end if;
  if v_fecha_destino < v_caja.fecha then
    raise exception 'La caja de portería del % no puede entrar en una caja de administración de un día anterior',
      to_char(v_caja.fecha, 'DD/MM');
  end if;

  -- Caja de administración de hoy (se crea si hace falta, §4.0-4). La de un día anterior no
  -- se crea sola: se abre desde Caja.
  if v_fecha_destino = v_hoy then
    insert into public.cajas (org_id, tipo, fecha, abierta_por)
    values (v_org, 'administracion', v_hoy, v_yo)
    on conflict (org_id, tipo, fecha) do nothing
    returning id into v_nueva;
    if v_nueva is not null then
      perform private.registrar_evento_caja(v_nueva, 'apertura', 'Abierta al recibir la caja de portería');
    end if;
  end if;
  select * into v_destino from public.cajas
  where org_id = v_org and tipo = 'administracion' and fecha = v_fecha_destino for update;
  if not found then
    raise exception 'No hay caja de administración del %: abrila desde Caja para recibir ahí la caja de portería',
      to_char(v_fecha_destino, 'DD/MM');
  end if;
  if v_destino.estado = 'validada' then
    if v_fecha_destino < v_hoy then
      raise exception 'La caja de administración del % ya fue validada por tesorería: recibila en la caja de hoy',
        to_char(v_fecha_destino, 'DD/MM');
    end if;
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
revoke all on function public.integrar_caja_porteria(uuid, text, numeric, date) from public, anon;
grant execute on function public.integrar_caja_porteria(uuid, text, numeric, date) to authenticated;
