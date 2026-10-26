-- ============================================================
-- 0052 · Cocheras en Portería y bono camioneros en Administración.
--
-- Pedidos del mercado (WhatsApp, 25 y 26/10/2026):
--   1. "No nos deja cargar una cochera en Valeria Weiss": es quintera y al quintero solo se
--      le facturaba lo de quinteros. Ahora también la cochera (EXPC), como al ambulante
--      (0045): la asigna y la factura el Líder; el Jefe la cobra con la quinta, en cuotas.
--   2. "Necesitamos que el jefe de portería le permita cobrar COCHERAS": el Jefe cobra la
--      cochera de cualquier cliente que tenga una. A un puestero o a un empleado (que no son
--      suyos) le cobra SOLO la cochera, en la caja de portería y sin dejar saldo a favor; lo
--      demás se lo sigue cobrando Administración. Ese cobro se ve en su caja (pagos e
--      imputaciones de una caja de portería) y su recibo también (datos_recibo). De esos
--      clientes ve lo justo para cobrar: cocheras_para_cobrar() y, para nombrarlos en la caja,
--      clientes_cobrados_en_porteria(); la tabla clientes sigue sin mostrárselos.
--   3. "También necesitamos que le permita a administración el BONO DE CAMIONEROS":
--      Administración cobra el canon de transporte en la caja de administración del día (la
--      abre si hace falta) y anula el suyo mientras la caja está abierta. Portería y el Líder
--      siguen cobrándolo en la caja de portería.
--
-- imputar_pago conserva su firma: el algoritmo pasa a private.imputar_pago_en, que además
-- puede limitarse a un segmento (la cochera). Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Quintero con cochera: lo mensual del quintero son la quinta y la cochera.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.aplicar_cambio(p_cambio cambios_pendientes)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
        v_categoria not in ('ambulante', 'empleado') and coalesce((d->>'es_socio')::boolean, false)
      ) returning id into v_id;
      -- Empleado (0040): de lo mensual, solo la cochera. Ambulante (se le cobra por día): la
      -- cochera (0045) y la quinta (0047). Si viniera otro concepto, no se carga.
      for v_item in select * from jsonb_array_elements(coalesce(d->'conceptos', '[]'::jsonb)) loop
        insert into public.cliente_conceptos (org_id, cliente_id, concepto_id, cantidad, porcentaje, activo)
        select p_cambio.org_id, v_id, (v_item->>'concepto_id')::uuid,
               coalesce((v_item->>'cantidad')::numeric, 1), coalesce((v_item->>'porcentaje')::numeric, 100), true
        where exists (select 1 from public.conceptos co
                      where co.id = (v_item->>'concepto_id')::uuid and co.org_id = p_cambio.org_id
                        and case v_categoria
                              when 'empleado'  then co.segmento = 'cocheras'
                              when 'ambulante' then co.segmento in ('cocheras', 'quinteros')
                              else true
                            end)
        on conflict (cliente_id, concepto_id) do update
          set cantidad = excluded.cantidad, porcentaje = excluded.porcentaje, activo = true;
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
      -- 0046: el que pasa a puestero conserva la quinta (EXPQ), como conserva sus quintas
      -- en el plano. 0047: el que pasa a ambulante conserva la cochera y la quinta.
      v_categoria := case when d ? 'categoria' then (d->>'categoria')::public.categoria_cliente end;
      if v_categoria is not null and v_cat_anterior is not null and v_categoria <> v_cat_anterior then
        update public.cliente_conceptos cc set activo = false
        from public.conceptos co
        where co.id = cc.concepto_id
          and cc.cliente_id = v_id and cc.org_id = p_cambio.org_id
          and cc.activo
          and co.tipo = 'recurrente'
          and case v_categoria
                when 'ambulante' then coalesce(co.segmento, '') not in ('cocheras', 'quinteros')   -- 0045, 0047
                when 'quintero'  then coalesce(co.segmento, '') not in ('quinteros', 'cocheras')   -- 0052: y la cochera
                when 'empleado'  then coalesce(co.segmento, '') <> 'cocheras'
                else coalesce(co.segmento, '') = 'ambulantes'   -- 0046: puestero, la quinta sí
              end;

        if v_categoria = 'ambulante' then
          -- Se le cobra por día: sin cuotas ni socio. 0045: en el plano conserva sus cocheras
          -- y 0047 sus quintas (se le siguen cobrando por mes); los otros lugares quedan libres.
          update public.clientes set cuotas_mes = 1, es_socio = false
          where id = v_id and org_id = p_cambio.org_id and (cuotas_mes <> 1 or es_socio);
          update public.espacios set cliente_id = null, asignado_en = null, actualizado_en = now()
          where cliente_id = v_id and org_id = p_cambio.org_id and tipo not in ('cochera', 'quinta');
          -- Sus medidores dejan de facturarse (abono y consumo) y de salir en la planilla del
          -- electricista, y se desatan del lugar que acaba de liberar. Se pueden reactivar
          -- desde Energía si hiciera falta (los ambulantes no pagan abono: ver sección 2b).
          update public.medidores set activo = false, espacio_id = null
          where cliente_id = v_id and org_id = p_cambio.org_id
            and (activo or espacio_id is not null);
        end if;

        if v_categoria = 'empleado' then
          -- 0040: solo alquila cochera. Sin socio ni cuotas; los otros lugares del plano quedan
          -- libres y sus medidores dejan de facturarse (se reactivan desde Energía si hiciera falta).
          update public.clientes set cuotas_mes = 1, es_socio = false
          where id = v_id and org_id = p_cambio.org_id and (cuotas_mes <> 1 or es_socio);
          update public.espacios set cliente_id = null, asignado_en = null, actualizado_en = now()
          where cliente_id = v_id and org_id = p_cambio.org_id and tipo <> 'cochera';
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
          porcentaje = coalesce((d->>'porcentaje')::numeric, porcentaje),
          notas = coalesce(nullif(trim(d->>'notas'), ''), notas),
          activo = coalesce((d->>'activo')::boolean, true)
        where id = v_existente;
        v_id := v_existente;
      else
        insert into public.cliente_conceptos (org_id, cliente_id, concepto_id, cantidad, porcentaje, notas, activo)
        values (p_cambio.org_id, (d->>'cliente_id')::uuid, (d->>'concepto_id')::uuid,
                coalesce((d->>'cantidad')::numeric, 1), coalesce((d->>'porcentaje')::numeric, 100),
                nullif(trim(d->>'notas'), ''),
                coalesce((d->>'activo')::boolean, true))
        returning id into v_id;
      end if;
    elsif p_cambio.accion = 'modificacion' then
      update public.cliente_conceptos set
        cantidad = case when d ? 'cantidad' then (d->>'cantidad')::numeric else cantidad end,
        porcentaje = case when d ? 'porcentaje' then (d->>'porcentaje')::numeric else porcentaje end,
        activo   = case when d ? 'activo' then (d->>'activo')::boolean else activo end,
        notas    = case when d ? 'notas' then nullif(trim(d->>'notas'), '') else notas end
      where id = v_id and org_id = p_cambio.org_id;
    elsif p_cambio.accion = 'baja' then
      update public.cliente_conceptos set activo = false where id = v_id and org_id = p_cambio.org_id;
    end if;

    -- Lo mensual tiene que corresponder a la categoría ACTUAL del cliente (misma regla que el
    -- cambio de categoría de arriba y que la ficha): un pedido que esperaba aprobación y
    -- llega después de un cambio de categoría (EXME a quien ya es quintero, a un ambulante
    -- lo que no es cochera ni quinta) se rechaza en vez de dejar una deuda que ni
    -- Administración ni el Jefe podrían sacar. 0046: al puestero, la quinta (EXPQ) sí le
    -- corresponde. 0047: al ambulante también.
    select cl.categoria into v_categoria
    from public.cliente_conceptos cc
    join public.conceptos co on co.id = cc.concepto_id
    join public.clientes cl on cl.id = cc.cliente_id
    where cc.id = v_id and cc.activo and co.tipo = 'recurrente'
      and case cl.categoria
            when 'ambulante' then coalesce(co.segmento, '') not in ('cocheras', 'quinteros')   -- 0045, 0047
            when 'quintero'  then coalesce(co.segmento, '') not in ('quinteros', 'cocheras')   -- 0052: y la cochera
            when 'empleado'  then coalesce(co.segmento, '') <> 'cocheras'
            else coalesce(co.segmento, '') = 'ambulantes'   -- 0046: puestero, la quinta sí
          end;
    if v_categoria = 'ambulante' then
      raise exception 'Este cliente ahora es ambulante: se le cobra por día y por mes solo paga la cochera o la quinta. Rechazá este cambio.';
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
$function$;

-- ------------------------------------------------------------
-- 2. El Jefe de Portería cobra cocheras.
-- ------------------------------------------------------------
create or replace function private.caja_de_porteria(p_caja uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.cajas c where c.id = p_caja and c.tipo = 'guardia')
$$;
revoke all on function private.caja_de_porteria(uuid) from public, anon;
grant execute on function private.caja_de_porteria(uuid) to authenticated;
comment on function private.caja_de_porteria(uuid) is
  'La caja es de portería (tipo guardia). Para la RLS de pagos e imputaciones del Jefe (0052).';

create or replace function private.debe_cochera(p_cliente uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.cargos c
    join public.conceptos co on co.id = c.concepto_id
    where c.cliente_id = p_cliente
      and c.estado in ('pendiente', 'parcial')
      and co.segmento = 'cocheras')
$$;
revoke all on function private.debe_cochera(uuid) from public, anon;
grant execute on function private.debe_cochera(uuid) to authenticated;
comment on function private.debe_cochera(uuid) is
  'El cliente tiene cargos de cochera (segmento cocheras) sin pagar. registrar_cobro (0052).';

-- El algoritmo de imputación, con un segmento opcional.
CREATE OR REPLACE FUNCTION private.imputar_pago_en(p_pago uuid, p_cliente uuid, p_monto numeric, p_cargo_primero uuid, p_segmento text)
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
      -- 0052: con segmento, solo esos cargos (el Jefe le cobra a un puestero o a un empleado
      -- únicamente la cochera).
      and (p_segmento is null or co.segmento = p_segmento)
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
revoke all on function private.imputar_pago_en(uuid, uuid, numeric, uuid, text) from public, anon;
grant execute on function private.imputar_pago_en(uuid, uuid, numeric, uuid, text) to authenticated;

-- Misma firma de siempre (la usan cobrar_diario y los demás): delega en imputar_pago_en.
CREATE OR REPLACE FUNCTION private.imputar_pago(p_pago uuid, p_cliente uuid, p_monto numeric, p_cargo_primero uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  return private.imputar_pago_en(p_pago, p_cliente, p_monto, p_cargo_primero, null);
end $function$;

-- El Jefe le cobra a un puestero o a un empleado solo la cochera.
CREATE OR REPLACE FUNCTION public.registrar_cobro(p_cliente uuid, p_caja uuid, p_lineas jsonb, p_notas text DEFAULT NULL::text, p_permitir_saldo_favor boolean DEFAULT false, p_lote uuid DEFAULT NULL::uuid)
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

      v_res := private.imputar_pago_en(v_pago_id, p_cliente, v_monto, null,
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

-- Recibos: el Jefe ve los de su caja de portería.
CREATE OR REPLACE FUNCTION public.datos_recibo(p_pago uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  -- 0052: el Jefe también ve los recibos cobrados en una caja de portería (la cochera de un
  -- puestero o de un empleado).
  if v_rol = 'guardia' and not private.cliente_de_porteria(v_pago.cliente_id)
     and not private.caja_de_porteria(v_pago.caja_id) then
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
end $function$;

-- RLS: el Jefe lee los cobros (y a qué cargos fueron) de las cajas de portería, aunque sean
-- de un cliente que no es suyo (la cochera de un puestero).
drop policy if exists "leer pagos" on public.pagos;
create policy "leer pagos" on public.pagos
  for select to authenticated
  using (
    private.tiene_rol(org_id, array['admin', 'tesoreria', 'consejo', 'lider']::public.rol_usuario[])
    or (private.tiene_rol(org_id, array['guardia']::public.rol_usuario[])
        and (private.cliente_de_porteria(cliente_id) or private.caja_de_porteria(caja_id)))
    or cliente_id = (select private.cliente_actual())
  );

drop policy if exists "leer imputaciones" on public.imputaciones;
create policy "leer imputaciones" on public.imputaciones
  for select to authenticated
  using (
    private.tiene_rol(org_id, array['admin', 'tesoreria', 'consejo', 'lider']::public.rol_usuario[])
    or exists (
      select 1
      from public.pagos p
      where p.id = imputaciones.pago_id
        and (p.cliente_id = (select private.cliente_actual())
             or (private.tiene_rol(imputaciones.org_id, array['guardia']::public.rol_usuario[])
                 and (private.cliente_de_porteria(p.cliente_id) or private.caja_de_porteria(p.caja_id)))))
  );

-- Quién tiene cochera y cuánto debe de cochera (todas las categorías). Para la pestaña
-- «Cocheras» del Jefe y su pantalla de cobro: de un puestero o un empleado no ve nada más.
create or replace function public.cocheras_para_cobrar(p_cliente uuid default null)
returns table (
  cliente_id uuid,
  codigo integer,
  nombre text,
  apodo text,
  categoria public.categoria_cliente,
  cuit text,
  cocheras text,
  deuda numeric,
  deuda_vencida numeric,
  cargos jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('guardia', 'admin', 'lider') then
    raise exception 'Sin permiso';
  end if;

  return query
  with pendientes as (
    select c.cliente_id, c.id, c.codigo, c.descripcion, c.periodo, c.vencimiento, c.estado,
           c.monto, c.monto_pagado, c.descuento_pronto_pago, co.orden_imputacion,
           greatest((case when v_hoy <= c.vencimiento
                       then private.monto_con_beneficio(c.monto, c.descuento_pronto_pago)
                       else c.monto end) - c.monto_pagado, 0) as saldo
    from public.cargos c
    join public.conceptos co on co.id = c.concepto_id
    where c.org_id = v_org
      and c.estado in ('pendiente', 'parcial')
      and co.segmento = 'cocheras'
      and (p_cliente is null or c.cliente_id = p_cliente)
  ), con_cochera as (
    select cl.id
    from public.clientes cl
    where cl.org_id = v_org
      and cl.activo
      and (p_cliente is null or cl.id = p_cliente)
      and (exists (select 1 from public.espacios e where e.cliente_id = cl.id and e.tipo = 'cochera')
           or exists (select 1
                      from public.cliente_conceptos cc
                      join public.conceptos co on co.id = cc.concepto_id
                      where cc.cliente_id = cl.id and cc.activo and co.activo and co.segmento = 'cocheras')
           or exists (select 1 from pendientes p where p.cliente_id = cl.id))
  )
  select
    cl.id,
    cl.codigo,
    cl.nombre,
    cl.apodo,
    cl.categoria,
    cl.cuit,
    (select string_agg('Cochera ' || coalesce(e.numero, ''), ' · '
                       order by coalesce(nullif(regexp_replace(coalesce(e.numero, ''), '[^0-9]', '', 'g'), '')::bigint, 0),
                                e.numero)
     from public.espacios e
     where e.cliente_id = cl.id and e.tipo = 'cochera'),
    round(coalesce((select sum(p.saldo) from pendientes p where p.cliente_id = cl.id), 0), 2),
    round(coalesce((select sum(p.monto - p.monto_pagado) from pendientes p
                    where p.cliente_id = cl.id and p.vencimiento < v_hoy), 0), 2),
    coalesce((select jsonb_agg(jsonb_build_object(
                'id', p.id, 'codigo', p.codigo, 'descripcion', p.descripcion, 'periodo', p.periodo,
                'vencimiento', p.vencimiento, 'estado', p.estado, 'monto', p.monto,
                'monto_pagado', p.monto_pagado, 'descuento_pronto_pago', p.descuento_pronto_pago,
                'orden', p.orden_imputacion)
              order by p.periodo, p.orden_imputacion)
              from pendientes p where p.cliente_id = cl.id), '[]'::jsonb)
  from public.clientes cl
  where cl.id in (select id from con_cochera)
  order by cl.codigo;
end $$;
revoke all on function public.cocheras_para_cobrar(uuid) from public, anon;
grant execute on function public.cocheras_para_cobrar(uuid) to authenticated;
comment on function public.cocheras_para_cobrar(uuid) is
  'Clientes activos con cochera (en el plano, en la carpeta o con cocheras sin pagar) y lo que deben de cochera, con el detalle de esos cargos. El Jefe cobra cocheras (0052).';

-- Nombre de los clientes cobrados en portería (la caja del Jefe nombra la cochera de un
-- puestero sin abrirle la tabla clientes).
create or replace function public.clientes_cobrados_en_porteria(p_clientes uuid[])
returns table (id uuid, codigo integer, nombre text, categoria public.categoria_cliente)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.codigo, c.nombre, c.categoria
  from public.clientes c
  where c.org_id = (select private.org_actual())
    and c.id = any (p_clientes)
    and (select private.tiene_rol(private.org_actual(),
           array['guardia', 'porteria', 'admin', 'tesoreria', 'lider']::public.rol_usuario[]))
    and exists (select 1
                from public.pagos p
                join public.cajas cj on cj.id = p.caja_id
                where p.cliente_id = c.id and cj.tipo = 'guardia')
$$;
revoke all on function public.clientes_cobrados_en_porteria(uuid[]) from public, anon;
grant execute on function public.clientes_cobrados_en_porteria(uuid[]) to authenticated;

-- ------------------------------------------------------------
-- 3. Administración cobra el bono camioneros (en su caja).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_canon(p_tarifa uuid, p_cantidad integer DEFAULT 1, p_medio medio_pago DEFAULT 'efectivo'::medio_pago, p_patente text DEFAULT NULL::text, p_destino text DEFAULT NULL::text, p_destino_detalle text DEFAULT NULL::text, p_notas text DEFAULT NULL::text, p_ref uuid DEFAULT NULL::uuid, p_fecha date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  -- 0052: Administración también cobra el bono camioneros, en SU caja.
  v_tipo public.tipo_caja := case when private.rol_actual() = 'admin'
    then 'administracion'::public.tipo_caja else 'guardia'::public.tipo_caja end;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  -- Portería cobra el canon; el Líder también (§1.3 D-P2). 0052: y Administración (en la caja
  -- de administración). El Jefe y Tesorería no.
  if v_rol is null or v_rol not in ('porteria', 'lider', 'admin') then
    raise exception 'El canon de transporte lo cobran Portería y Administración';
  end if;
  -- 0048: canon de un día anterior (carga atrasada): solo el Líder, en la caja de ese día.
  if v_fecha > v_hoy then
    raise exception 'Ese día todavía no llegó';
  end if;
  if v_fecha < v_hoy and v_rol not in ('lider', 'admin') then
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
    values (v_org, v_tipo, v_hoy, v_uid)
    on conflict (org_id, tipo, fecha) do nothing
    returning id into v_caja_id;
    if v_caja_id is not null then
      perform private.registrar_evento_caja(v_caja_id, 'apertura',
        case when v_tipo = 'guardia' then 'Abierta por Portería con el primer ingreso de transporte'
             else 'Abierta con el primer cobro del bono camioneros' end);
    end if;
  end if;

  select c.id, c.estado into v_caja_id, v_caja_estado
  from public.cajas c
  where c.org_id = v_org and c.tipo = v_tipo and c.fecha = v_fecha
  for share;
  if v_fecha < v_hoy then
    if v_caja_id is null then
      raise exception 'No hay caja de % del %: abrila desde Caja para cargar el canon de ese día',
        case when v_tipo = 'guardia' then 'portería' else 'administración' end, to_char(v_fecha, 'DD/MM');
    end if;
    if v_caja_estado is distinct from 'abierta' then
      raise exception 'La caja de % del % ya está cerrada: reabrila desde Caja para seguir cargando',
        case when v_tipo = 'guardia' then 'portería' else 'administración' end, to_char(v_fecha, 'DD/MM');
    end if;
  elsif v_tipo = 'administracion' and v_caja_estado is distinct from 'abierta' then
    raise exception '%', private.mensaje_caja_no_abierta(v_caja_estado, v_rol);
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
end $function$;

CREATE OR REPLACE FUNCTION public.anular_canon(p_canon uuid, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  -- 0052: Administración, el de su caja mientras está abierta.
  if v_rol is null or v_rol not in ('porteria', 'guardia', 'tesoreria', 'lider', 'admin') then
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
  elsif v_rol = 'admin' then
    if v_caja.tipo <> 'administracion' then
      raise exception 'Solo podés anular el bono camioneros de la caja de administración';
    end if;
    if v_caja.estado <> 'abierta' then
      raise exception 'La caja ya se cerró: pedí la reapertura o la anulación a tesorería';
    end if;
  elsif v_rol = 'guardia' then
    if v_caja.tipo <> 'guardia' then
      raise exception 'Solo podés anular cobros de la caja de portería';
    end if;
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
end $function$;
