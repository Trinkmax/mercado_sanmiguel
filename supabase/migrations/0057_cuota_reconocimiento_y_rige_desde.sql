-- ============================================================
-- 0057 · La cuota del reconocimiento de deuda en el cobro, y «¿desde cuándo rige?» en los
-- cambios de la carpeta.
--
-- 1) Pedido del 30/10/2026 (WhatsApp de Administración): "a RD tiene que haber una
--    posibilidad de descontar un monto específico para ese rubro, porque se arma un plan de
--    pago y se abona en cuotas". El reconocimiento de deuda (0055) se paga después de todo lo
--    demás; ahora el cobro puede decir cuánto de lo que paga es la cuota del plan
--    (registrar_cobro, p_a_reconocimiento): esa parte va primero al reconocimiento (del más
--    viejo al más nuevo) y el resto, en el orden de siempre. Un solo recibo.
--
-- 2) Pedido del 29/10/2026 (audio de Administración): "si yo cambio un concepto o cambio lo
--    que se consumió de luz porque hubo un error, que me impacte en el mes vigente [...] nos
--    equivocamos y pusimos de cochera 1,25 y era 1: la modifico y el mes que viene se va a
--    generar bien, pero no me deja corregir el mes que estoy en curso". La corrección existía
--    (0054) pero era un paso aparte, en otra pestaña, que nadie encontró. Ahora el cambio de la
--    carpeta (cliente_concepto) lleva datos.corregir_desde = el primer mes en que rige; cuando
--    se aplica (en el acto si lo hace el Líder, o al aprobarlo), un trigger:
--      · rehace con la carpeta los cargos ya generados de ese concepto desde ese mes
--        (corregir_cargo, 0054: lo pagado pasa al corregido, lo que sobra queda a favor);
--      · y si ese mes ya se generó y no tenía el cargo (lo agregó o lo volvió a facturar), se
--        lo carga como lo hubiera hecho generar_periodo.
--    Si se eligió que rija desde un mes posterior, cargos_para_corregir ya no marca el cargo
--    de este mes como mal generado: quedó así a propósito.
--    (La luz ya se corrige desde Energía aunque esté cobrada: 0056.)
-- ============================================================

-- ---------- 1) registrar_cobro con la cuota del reconocimiento ----------
-- Cambia la firma (un parámetro más, con default): las llamadas de antes siguen andando.
drop function if exists public.registrar_cobro(uuid, uuid, jsonb, text, boolean, uuid);

CREATE FUNCTION public.registrar_cobro(p_cliente uuid, p_caja uuid, p_lineas jsonb, p_notas text DEFAULT NULL::text, p_permitir_saldo_favor boolean DEFAULT false, p_lote uuid DEFAULT NULL::uuid, p_a_reconocimiento numeric DEFAULT NULL::numeric)
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
  v_solo_cochera boolean := false;
  -- 0057: cuánto de este cobro es para la cuota del reconocimiento de deuda (plan de pago).
  v_a_rec numeric := round(coalesce(p_a_reconocimiento, 0), 2);
  v_total numeric := 0;
  v_rec_saldo numeric;
  v_rec_linea numeric;
  v_rec_resto numeric;
  v_rec record;
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
    -- 0052: el Jefe de Portería también cobra cocheras. A un cliente que no es suyo (un
    -- puestero o un empleado) le cobra solo la cochera: lo demás se lo cobra Administración.
    if v_rol = 'guardia' and private.debe_cochera(p_cliente) then
      v_solo_cochera := true;
    elsif v_rol = 'guardia' then
      raise exception 'A este cliente lo cobra Administración';
    else
      raise exception 'A quinteros y ambulantes los cobra el Jefe de Portería';
    end if;
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
    v_total := v_total + v_monto;

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

  -- 0057: la cuota del reconocimiento de deuda sale de lo que paga (no se suma aparte).
  if v_a_rec < 0 then
    raise exception 'La cuota del reconocimiento de deuda no puede ser negativa';
  end if;
  if v_a_rec > 0 and v_solo_cochera then
    raise exception 'Cobrando solo la cochera no se cobra el reconocimiento de deuda';
  end if;
  if v_a_rec > v_total then
    raise exception 'La cuota del reconocimiento (%) no puede ser más que lo que te pagan (%)',
      private.cobro_pesos(v_a_rec), private.cobro_pesos(v_total);
  end if;

  -- Escritura. Red de seguridad de la idempotencia: si otra transacción ganó la carrera
  -- con el mismo lote (o el mismo cheque), se relee y se contesta sin duplicar (§4.0-5).
  begin
    -- El crédito previo del cliente va primero a sus deudas (ya bloquea al cliente: sin costo).
    perform private.aplicar_saldo_favor(p_cliente);

    -- 0057: lo que le queda del reconocimiento DESPUÉS del saldo a favor (que va primero a lo demás).
    if v_a_rec > 0 then
      select coalesce(sum(c.monto - c.monto_pagado), 0) into v_rec_saldo
      from public.cargos c
      where c.cliente_id = p_cliente and c.reconocimiento and c.estado in ('pendiente','parcial');
      if v_rec_saldo <= 0 then
        raise exception 'Este cliente no tiene reconocimiento de deuda por pagar. Recargá la página';
      end if;
      if v_a_rec > v_rec_saldo then
        raise exception 'Del reconocimiento de deuda le quedan % por pagar: la cuota no puede ser más',
          private.cobro_pesos(v_rec_saldo);
      end if;
    end if;

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

      -- 0057: primero la cuota del reconocimiento (cada reconocimiento con saldo, del más viejo
      -- al más nuevo, cada uno como "cargo primero"); el resto, en el orden de siempre (el
      -- reconocimiento al final, 0055).
      v_rec_linea := least(v_monto, v_a_rec);
      v_rec_resto := v_rec_linea;
      if v_rec_linea > 0 then
        for v_rec in
          select c.id, c.monto - c.monto_pagado as saldo
          from public.cargos c
          where c.cliente_id = p_cliente and c.reconocimiento and c.estado in ('pendiente','parcial')
          order by c.periodo, c.creado_en
        loop
          exit when v_rec_resto <= 0;
          continue when v_rec.saldo <= 0;
          v_res := private.imputar_pago_en(v_pago_id, p_cliente, least(v_rec_resto, v_rec.saldo), v_rec.id, null);
          v_rec_resto := v_rec_resto - least(v_rec_resto, v_rec.saldo) + (v_res->>'restante')::numeric;
        end loop;
        v_a_rec := v_a_rec - v_rec_linea;
      end if;

      v_res := private.imputar_pago_en(v_pago_id, p_cliente, v_monto - v_rec_linea + v_rec_resto, null,
        case when v_solo_cochera then 'cocheras' end);
      v_sobra := v_sobra + (v_res->>'restante')::numeric;
    end loop;

    -- 0052: cobrando solo la cochera no se deja saldo a favor (el resto es de Administración).
    if v_solo_cochera and v_sobra > 0.009 then
      raise exception 'Eso supera lo que debe de cochera: sobran %. Lo demás se lo cobra Administración.',
        private.cobro_pesos(v_sobra);
    end if;
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
end $function$;
revoke all on function public.registrar_cobro(uuid, uuid, jsonb, text, boolean, uuid, numeric) from public, anon;
grant execute on function public.registrar_cobro(uuid, uuid, jsonb, text, boolean, uuid, numeric) to authenticated;
comment on function public.registrar_cobro(uuid, uuid, jsonb, text, boolean, uuid, numeric) is
  'Cobro mixto (un recibo, hasta 6 medios). p_a_reconocimiento (0057): la parte del cobro que es cuota del reconocimiento de deuda; va primero a él y el resto en el orden de siempre.';

-- ---------- 2) La carpeta de un concepto, sin cargo de por medio ----------
-- Lo que hacía cargo_segun_carpeta (0054) a partir de cliente y concepto: sirve también para
-- cargarle el mes a un concepto que se agregó después de generarlo.
create or replace function private.carpeta_concepto(p_cliente uuid, p_concepto uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_co public.conceptos;
  v_cl public.clientes;
  v_cc public.cliente_conceptos;
  v_cant numeric;
  v_pct numeric;
  v_monto numeric;
  v_existe boolean;
begin
  select * into v_co from public.conceptos where id = p_concepto;
  select * into v_cl from public.clientes where id = p_cliente;
  if v_co.id is null or v_cl.id is null then return null; end if;
  select * into v_cc from public.cliente_conceptos
  where cliente_id = p_cliente and concepto_id = p_concepto;

  if v_co.tipo = 'recurrente' then
    -- Misma regla que generar_periodo (0033, 0047).
    v_cant := v_cc.cantidad;
    v_pct := v_cc.porcentaje;
    v_existe := v_cc.id is not null and v_cc.activo and v_co.activo and v_cl.activo
      and (v_cl.categoria <> 'ambulante' or v_co.segmento in ('cocheras', 'quinteros'));
  elsif v_co.tipo = 'abono_energia' then
    -- Misma regla que generar_abonos_energia (0024, 0040): sin fila = paga 1 entero.
    v_cant := coalesce(v_cc.cantidad, 1);
    v_pct := coalesce(v_cc.porcentaje, 100);
    v_existe := v_co.activo and v_cl.activo
      and v_cl.categoria not in ('ambulante', 'empleado')
      and coalesce(v_cc.activo, true)
      and exists (select 1 from public.medidores m
                  where m.cliente_id = v_cl.id and m.org_id = v_cl.org_id and m.activo);
  else
    return null;   -- energía, diarios, deudas, multas: no se generan con el mes
  end if;

  v_monto := round(coalesce(v_cant, 0) * v_co.precio * coalesce(v_pct, 100) / 100, 2);
  if not coalesce(v_existe, false) or v_monto <= 0 then
    return jsonb_build_object('existe', false);
  end if;
  return jsonb_build_object(
    'existe', true,
    'cantidad', v_cant,
    'porcentaje', v_pct,
    'precio_unitario', round(v_co.precio * v_pct / 100, 2),
    'monto', v_monto,
    'descuento_pronto_pago', v_co.descuento_pronto_pago,
    'descripcion', v_co.nombre
      || case when v_cant <> 1
           then ' × ' || trim(trailing '.' from trim(trailing '0' from v_cant::text)) else '' end
      || case when v_pct <> 100 then ' · ' || private.formato_porcentaje(v_pct) else '' end);
end $$;
revoke all on function private.carpeta_concepto(uuid, uuid) from public, anon;
grant execute on function private.carpeta_concepto(uuid, uuid) to authenticated;
comment on function private.carpeta_concepto(uuid, uuid) is
  'Cómo se generaría hoy ese concepto para ese cliente (misma cuenta que generar_periodo / generar_abonos_energia), o {existe:false} si no corresponde; null si no se genera con el mes (0057).';

create or replace function private.cargo_segun_carpeta(p_cargo uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cliente uuid;
  v_concepto uuid;
begin
  select c.cliente_id, c.concepto_id into v_cliente, v_concepto from public.cargos c where c.id = p_cargo;
  if not found then return null; end if;
  return private.carpeta_concepto(v_cliente, v_concepto);
end $$;
revoke all on function private.cargo_segun_carpeta(uuid) from public, anon;
grant execute on function private.cargo_segun_carpeta(uuid) to authenticated;

-- ---------- 3) cargos_para_corregir: lo que quedó así a propósito no se marca ----------
CREATE OR REPLACE FUNCTION public.cargos_para_corregir(p_cliente uuid)
 RETURNS TABLE(cargo_id uuid, periodo date, codigo text, descripcion text, cantidad numeric, monto numeric, monto_pagado numeric, existe boolean, descripcion_nueva text, cantidad_nueva numeric, monto_nuevo numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_org uuid := private.org_actual();
  v_hoy date := private.hoy_ar();
  v_c record;
  v_n jsonb;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  -- Quien no gestiona al cliente no corrige: no hay nada que ofrecerle.
  if not private.puede_gestionar_cliente(p_cliente) then return; end if;

  for v_c in
    select c.id, c.periodo, c.codigo, c.descripcion, c.cantidad, c.precio_unitario, c.monto,
           c.monto_pagado, c.descuento_pronto_pago
    from public.cargos c
    join public.conceptos co on co.id = c.concepto_id
    where c.org_id = v_org
      and c.cliente_id = p_cliente
      and c.origen = 'generacion'
      and c.estado <> 'anulado'
      and c.periodo >= date_trunc('month', v_hoy)::date
      and co.tipo in ('recurrente', 'abono_energia')
      -- 0057: si después de generarse el cargo se cambió la carpeta eligiendo que rija desde un
      -- mes posterior, el cargo de ese mes queda como se generó: no es un error para corregir.
      and not exists (
        select 1
        from public.cambios_pendientes cp
        join public.cliente_conceptos cc on cc.id = coalesce(cp.entidad_id, cp.resultado_id)
        where cp.org_id = v_org
          and cp.entidad = 'cliente_concepto'
          and cp.estado = 'aprobado'
          and cc.cliente_id = c.cliente_id
          and cc.concepto_id = c.concepto_id
          and cp.revisado_en > c.creado_en
          and cp.datos ->> 'corregir_desde' > to_char(c.periodo, 'YYYY-MM-DD'))
    order by c.periodo, co.orden_imputacion, c.codigo
  loop
    v_n := private.cargo_segun_carpeta(v_c.id);
    continue when v_n is null;
    -- El nombre del concepto no cuenta: renombrarlo no hace "mal generado" al cargo.
    if not (v_n ->> 'existe')::boolean
       or (v_n ->> 'monto')::numeric <> v_c.monto
       or (v_n ->> 'cantidad')::numeric <> v_c.cantidad
       or (v_n ->> 'precio_unitario')::numeric <> v_c.precio_unitario
       or (v_n ->> 'descuento_pronto_pago')::numeric <> v_c.descuento_pronto_pago then
      cargo_id := v_c.id;
      periodo := v_c.periodo;
      codigo := v_c.codigo;
      descripcion := v_c.descripcion;
      cantidad := v_c.cantidad;
      monto := v_c.monto;
      monto_pagado := v_c.monto_pagado;
      existe := (v_n ->> 'existe')::boolean;
      descripcion_nueva := v_n ->> 'descripcion';
      cantidad_nueva := (v_n ->> 'cantidad')::numeric;
      monto_nuevo := (v_n ->> 'monto')::numeric;
      return next;
    end if;
  end loop;
end $function$;
revoke all on function public.cargos_para_corregir(uuid) from public, anon;
grant execute on function public.cargos_para_corregir(uuid) to authenticated;

-- ---------- 4) El cambio de la carpeta que rige desde este mes corrige lo ya generado ----------
create or replace function private.tg_cambio_rige_desde()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_desde text := new.datos ->> 'corregir_desde';
  v_mes date;
  v_cc public.cliente_conceptos;
  v_c record;
  v_n jsonb;
  v_p record;
  v_nuevos int := 0;
  v_id uuid;
  -- El motivo del cargo corregido es lo que se pidió ("Cambiar Alquiler Cocheras de P&P: × 1¼ → × 1").
  v_motivo text := left(nullif(btrim(coalesce(new.resumen, '')), ''), 300);
begin
  if v_desde is null or v_desde !~ '^[0-9]{4}-[0-9]{2}-01$' then return null; end if;
  -- Un pedido que se aprueba ya en otro mes corrige desde el mes en curso (lo de meses
  -- anteriores no se toca desde acá, como en corregir_cargo).
  v_mes := greatest(v_desde::date, date_trunc('month', private.hoy_ar())::date);

  select * into v_cc from public.cliente_conceptos
  where id = coalesce(new.entidad_id, new.resultado_id) and org_id = new.org_id;
  if not found then return null; end if;

  -- (a) Lo ya generado de ese concepto desde ese mes, si no coincide con la carpeta nueva: se
  -- rehace (o se anula si ya no corresponde) con su rastro, quién y por qué (corregir_cargo).
  for v_c in
    select c.id, c.monto, c.cantidad, c.precio_unitario, c.descuento_pronto_pago
    from public.cargos c
    where c.cliente_id = v_cc.cliente_id
      and c.concepto_id = v_cc.concepto_id
      and c.origen = 'generacion'
      and c.estado <> 'anulado'
      and c.periodo >= v_mes
    order by c.periodo
  loop
    v_n := private.cargo_segun_carpeta(v_c.id);
    continue when v_n is null;
    if not (v_n ->> 'existe')::boolean
       or (v_n ->> 'monto')::numeric <> v_c.monto
       or (v_n ->> 'cantidad')::numeric <> v_c.cantidad
       or (v_n ->> 'precio_unitario')::numeric <> v_c.precio_unitario
       or (v_n ->> 'descuento_pronto_pago')::numeric <> v_c.descuento_pronto_pago then
      perform public.corregir_cargo(v_c.id, v_motivo);
    end if;
  end loop;

  -- (b) Meses ya generados que no tienen ese cargo (lo agregó o lo volvió a facturar): se le
  -- carga como lo hubiera hecho generar_periodo, con el vencimiento de ese mes.
  for v_p in
    select pe.periodo, pe.vencimiento
    from public.periodos pe
    where pe.org_id = new.org_id and pe.periodo >= v_mes and pe.generado_en is not null
    order by pe.periodo
  loop
    continue when exists (
      select 1 from public.cargos c
      where c.cliente_id = v_cc.cliente_id and c.concepto_id = v_cc.concepto_id
        and c.periodo = v_p.periodo and c.origen = 'generacion' and c.estado <> 'anulado');
    v_n := private.carpeta_concepto(v_cc.cliente_id, v_cc.concepto_id);
    continue when v_n is null or not (v_n ->> 'existe')::boolean;
    v_id := null;
    insert into public.cargos (
      org_id, periodo, cliente_id, concepto_id, codigo, descripcion, cantidad, precio_unitario,
      monto, descuento_pronto_pago, vencimiento, origen, creado_por)
    select new.org_id, v_p.periodo, v_cc.cliente_id, co.id, co.codigo, v_n ->> 'descripcion',
           (v_n ->> 'cantidad')::numeric, (v_n ->> 'precio_unitario')::numeric,
           (v_n ->> 'monto')::numeric, (v_n ->> 'descuento_pronto_pago')::numeric,
           v_p.vencimiento, 'generacion', (select auth.uid())
    from public.conceptos co where co.id = v_cc.concepto_id
    on conflict (cliente_id, concepto_id, periodo) where origen = 'generacion' and estado <> 'anulado'
    do nothing
    returning id into v_id;
    if v_id is not null then v_nuevos := v_nuevos + 1; end if;
  end loop;

  -- Lo nuevo se cubre con su saldo a favor, como al generar el mes.
  if v_nuevos > 0 then
    perform private.aplicar_saldo_favor(v_cc.cliente_id);
  end if;
  return null;
end $$;
revoke all on function private.tg_cambio_rige_desde() from public, anon, authenticated;
comment on function private.tg_cambio_rige_desde() is
  'Al aplicarse un cambio de la carpeta con datos.corregir_desde: corrige lo ya generado de ese concepto desde ese mes y carga el mes si faltaba (0057).';

drop trigger if exists cambios_rigen_desde on public.cambios_pendientes;
create trigger cambios_rigen_desde
  after update of estado on public.cambios_pendientes
  for each row
  when (old.estado = 'pendiente' and new.estado = 'aprobado'
        and new.entidad = 'cliente_concepto' and new.datos ? 'corregir_desde')
  execute function private.tg_cambio_rige_desde();
