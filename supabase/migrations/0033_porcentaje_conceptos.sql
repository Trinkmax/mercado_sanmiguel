-- ============================================================
-- Mercado San Miguel — 0033 Porcentaje por concepto del cliente
--
-- Cada concepto de la carpeta de un cliente puede pagarse por un porcentaje del precio
-- (por ejemplo, el 70 % de la expensa), además de la cantidad (4 puestos, ½ puesto).
-- Cargo = cantidad × precio × porcentaje / 100 (precio_unitario = precio × %), y la
-- descripción lo dice: "Expensas Cobradas × 4 · 70 %". Vale para todo concepto de la
-- carpeta (expensas, cocheras, quinta, abono de energía…). Por defecto, 100 %.
-- Idempotente.
-- ============================================================

alter table public.cliente_conceptos add column if not exists porcentaje numeric(5,2) not null default 100;
alter table public.cliente_conceptos drop constraint if exists cliente_conceptos_porcentaje_valido;
alter table public.cliente_conceptos add constraint cliente_conceptos_porcentaje_valido
  check (porcentaje >= 1 and porcentaje <= 100);
comment on column public.cliente_conceptos.porcentaje is
  'Porcentaje del precio que paga el cliente por este concepto (1 a 100; 100 = entero).';

create or replace function private.formato_porcentaje(p numeric)
returns text
language sql immutable set search_path = '' as $$
  select private.formato_kwh(p) || ' %'
$$;
revoke all on function private.formato_porcentaje(numeric) from public, anon;
grant execute on function private.formato_porcentaje(numeric) to authenticated;

create or replace function public.generar_periodo(p_periodo date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
        then ' × ' || trim(trailing '.' from trim(trailing '0' from cc.cantidad::text)) else '' end
        || case when cc.porcentaje <> 100 then ' · ' || private.formato_porcentaje(cc.porcentaje) else '' end,
      -- 0033: el cliente puede pagar un porcentaje del precio (70 % de la expensa, por ejemplo).
      cc.cantidad, round(co.precio * cc.porcentaje / 100, 2),
      round(cc.cantidad * co.precio * cc.porcentaje / 100, 2), co.descuento_pronto_pago, v_venc, 'generacion'
    from public.cliente_conceptos cc
    join public.conceptos co on co.id = cc.concepto_id
    join public.clientes cl on cl.id = cc.cliente_id
    where cc.org_id = v_org and cc.activo and co.activo and cl.activo
      and cl.categoria <> 'ambulante'
      and co.tipo = 'recurrente'
      and round(cc.cantidad * co.precio * cc.porcentaje / 100, 2) > 0
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
end $function$;
revoke all on function public.generar_periodo(date) from public, anon;
grant execute on function public.generar_periodo(date) to authenticated;

create or replace function private.generar_abonos_energia(p_org uuid, p_periodo date, p_venc date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      then ' × ' || trim(trailing '.' from trim(trailing '0' from cc.cantidad::text)) else '' end
      || case when coalesce(cc.porcentaje, 100) <> 100 then ' · ' || private.formato_porcentaje(cc.porcentaje) else '' end,
    coalesce(cc.cantidad, 1), round(co.precio * coalesce(cc.porcentaje, 100) / 100, 2),
    round(coalesce(cc.cantidad, 1) * co.precio * coalesce(cc.porcentaje, 100) / 100, 2),
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
    and round(coalesce(cc.cantidad, 1) * co.precio * coalesce(cc.porcentaje, 100) / 100, 2) > 0
    and exists (
      select 1 from public.medidores m
       where m.cliente_id = cl.id and m.org_id = p_org and m.activo)
  on conflict (cliente_id, concepto_id, periodo) where origen = 'generacion' and estado <> 'anulado'
  do nothing;

  get diagnostics v_n = row_count;
  return v_n;
end $function$;
revoke all on function private.generar_abonos_energia(uuid, date, date) from public, anon;
grant execute on function private.generar_abonos_energia(uuid, date, date) to authenticated;

create or replace function private.aplicar_cambio(p_cambio cambios_pendientes)
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
        v_categoria <> 'ambulante' and coalesce((d->>'es_socio')::boolean, false)
      ) returning id into v_id;
      -- El ambulante no tiene conceptos mensuales (se le cobra por día): si vinieran, no se cargan.
      for v_item in select * from jsonb_array_elements(coalesce(d->'conceptos', '[]'::jsonb)) loop
        insert into public.cliente_conceptos (org_id, cliente_id, concepto_id, cantidad, porcentaje, activo)
        select p_cambio.org_id, v_id, (v_item->>'concepto_id')::uuid,
               coalesce((v_item->>'cantidad')::numeric, 1), coalesce((v_item->>'porcentaje')::numeric, 100), true
        where v_categoria <> 'ambulante'
          and exists (select 1 from public.conceptos co
                      where co.id = (v_item->>'concepto_id')::uuid and co.org_id = p_cambio.org_id)
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
$function$;
revoke all on function private.aplicar_cambio(public.cambios_pendientes) from public, anon;
grant execute on function private.aplicar_cambio(public.cambios_pendientes) to authenticated;

create or replace function public.solicitar_cambio(p_entidad text, p_accion text, p_entidad_id uuid, p_datos jsonb, p_resumen text, p_cliente_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_gest public.categoria_cliente[] := private.categorias_gestionables();
  v_datos jsonb := coalesce(p_datos, '{}'::jsonb);
  v_resumen text := trim(coalesce(p_resumen, ''));
  v_cambio public.cambios_pendientes;
  v_anterior jsonb;
  v_resultado uuid;
  v_cliente uuid := p_cliente_id;
  v_cat_actual public.categoria_cliente;
  v_cat_nueva public.categoria_cliente;
  v_es_socio boolean;
  v_portal boolean;
  v_concepto_id uuid;
  v_seg text;
  v_tipo public.tipo_concepto;
  v_cod_concepto text;
  v_codigo integer;
  v_item jsonb;
  v_en_el_acto boolean := false;
  v_msg_cat text;
  v_constraint text;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  -- Tesorería y Consejo ya no proponen (J4, F5). El Líder aplica directo (D-P2).
  if v_rol is null or v_rol not in ('admin','guardia','lider') then
    raise exception 'No tenés permiso para proponer cambios';
  end if;
  if p_entidad is null or p_entidad not in ('cliente','cliente_concepto','concepto') then
    raise exception 'Entidad inválida';
  end if;
  if p_accion is null or p_accion not in ('alta','modificacion','baja') then
    raise exception 'Acción inválida';
  end if;
  if p_accion <> 'alta' and p_entidad_id is null then raise exception 'Falta el registro a modificar'; end if;
  if v_resumen = '' then raise exception 'Falta el resumen del cambio'; end if;
  if jsonb_typeof(v_datos) <> 'object' then raise exception 'Los datos del cambio no se entienden. Recargá la página y probá de nuevo'; end if;

  -- Idempotencia del alta (doble toque o reintento sin red, §4.0-5): la UI manda datos.ref = uuid
  -- por intento. Si ya se registró con ese ref, se devuelve lo registrado con "repetido": true
  -- (clave para el ambulante del Jefe, que se aplica en el acto: nunca dos ambulantes iguales).
  if p_accion = 'alta' and v_datos ? 'ref' then
    if coalesce(v_datos->>'ref', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Los datos del cambio no se entienden. Recargá la página y probá de nuevo';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('solicitar_cambio:' || lower(v_datos->>'ref'), 0));
    select * into v_cambio from public.cambios_pendientes cp
    where cp.org_id = v_org and cp.entidad = p_entidad and cp.accion = 'alta'
      and lower(cp.datos->>'ref') = lower(v_datos->>'ref')
    order by cp.solicitado_en
    limit 1;
    if found then
      if v_cambio.solicitado_por is distinct from (select auth.uid()) then
        raise exception 'Ese pedido ya lo cargó otra persona. Recargá la página';
      end if;
      return jsonb_build_object(
        'estado', case when v_cambio.estado = 'aprobado' then 'aplicado' else 'pendiente' end,
        'cambio_id', v_cambio.id, 'resultado_id', v_cambio.resultado_id, 'repetido', true);
    end if;
  end if;

  v_msg_cat := case when v_rol = 'guardia'
    then 'Desde Portería solo se gestionan quinteros y ambulantes'
    else 'A quinteros y ambulantes los gestiona el Jefe de Portería' end;

  -- Claves nuevas: se validan como texto ANTES de castear (basura → mensaje humano, no error de enum).
  if v_datos ? 'categoria' then
    if jsonb_typeof(v_datos->'categoria') is distinct from 'string'
       or v_datos->>'categoria' not in ('puestero','quintero','ambulante') then
      raise exception 'Categoría inválida';
    end if;
  end if;
  if v_datos ? 'es_socio' and jsonb_typeof(v_datos->'es_socio') is distinct from 'boolean' then
    raise exception 'Elegí si es socio de la cooperativa: Sí o No';
  end if;
  if v_datos ? 'activo' and jsonb_typeof(v_datos->'activo') is distinct from 'boolean' then
    raise exception 'Elegí si queda activo: Sí o No';
  end if;
  if p_entidad = 'cliente' and v_datos ? 'cuotas_mes' then
    if coalesce(v_datos->>'cuotas_mes', '') !~ '^[0-9]{1,2}$' then
      raise exception 'Elegí en cuántos pagos cobra el mes (de 1 a 31)';
    end if;
    if (v_datos->>'cuotas_mes')::int not between 1 and 31 then
      raise exception 'Elegí en cuántos pagos cobra el mes (de 1 a 31)';
    end if;
  end if;
  if p_entidad = 'cliente' and v_datos ? 'codigo' and v_datos->'codigo' <> 'null'::jsonb then
    if coalesce(v_datos->>'codigo', '') !~ '^[0-9]{1,9}$' then
      raise exception 'El número de carpeta va sin comas ni puntos';
    end if;
  end if;

  -- ================= cliente =================
  if p_entidad = 'cliente' then
    if p_accion = 'alta' then
      if coalesce(trim(v_datos->>'nombre'), '') = '' then raise exception 'Poné el nombre del cliente'; end if;
      v_cat_nueva := coalesce((v_datos->>'categoria')::public.categoria_cliente,
        (case when v_rol = 'guardia' then 'quintero' else 'puestero' end)::public.categoria_cliente);
      if not (v_cat_nueva = any (v_gest)) then raise exception '%', v_msg_cat; end if;
      v_datos := v_datos || jsonb_build_object('categoria', v_cat_nueva);
      if v_cat_nueva = 'ambulante' then
        if coalesce((v_datos->>'es_socio')::boolean, false) then
          raise exception 'Un ambulante no puede ser socio: si es socio, cargalo como quintero o puestero';
        end if;
        -- Sin portal ni cuotas: se le cobra por día cuando viene (G5, G6).
        v_datos := v_datos || jsonb_build_object('es_socio', false, 'cuotas_mes', 1);
        v_en_el_acto := v_rol = 'guardia';   -- D-P1: el Jefe lo da de alta y le cobra enseguida
      end if;

      -- Conceptos del alta: las mismas reglas que un cliente_concepto suelto.
      if v_datos ? 'conceptos' and jsonb_typeof(v_datos->'conceptos') is distinct from 'array' then
        raise exception 'Los conceptos del alta no se entienden. Recargá la página y probá de nuevo';
      end if;
      for v_item in select * from jsonb_array_elements(coalesce(v_datos->'conceptos', '[]'::jsonb)) loop
        if coalesce(v_item->>'concepto_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
          raise exception 'Concepto inexistente';
        end if;
        if v_item ? 'porcentaje' then
        if coalesce(v_item->>'porcentaje', '') !~ '^[0-9]{1,3}(\.[0-9]{1,2})?$' then
          raise exception 'El porcentaje va de 1 a 100 (por ejemplo 70)';
        end if;
        if (v_item->>'porcentaje')::numeric not between 1 and 100 then
          raise exception 'El porcentaje va de 1 a 100 (por ejemplo 70)';
        end if;
        end if;
        select co.segmento, co.tipo into v_seg, v_tipo
        from public.conceptos co where co.id = (v_item->>'concepto_id')::uuid and co.org_id = v_org;
        if not found then raise exception 'Concepto inexistente'; end if;
        if v_tipo <> 'recurrente' then
          raise exception 'Ese concepto no se asigna a la carpeta: se cobra en el momento';
        end if;
        if v_rol = 'guardia' and coalesce(v_seg, '') not in ('quinteros','ambulantes') then
          raise exception 'Ese concepto lo gestiona Administración';
        end if;
        if v_rol = 'admin' and v_seg in ('quinteros','ambulantes') then
          raise exception 'Ese concepto lo gestiona el Jefe de Portería';
        end if;
      end loop;

      -- N° de carpeta: dos altas a la vez no se llevan el mismo número. Si no viene, se asigna.
      perform pg_advisory_xact_lock(hashtextextended('alta_cliente:' || v_org::text, 0));
      if v_datos->'codigo' is null or v_datos->'codigo' = 'null'::jsonb or coalesce(v_datos->>'codigo', '') = '' then
        v_codigo := private.proximo_codigo_cliente();
      else
        v_codigo := (v_datos->>'codigo')::int;
      end if;
      if v_codigo < 1 then raise exception 'El número de carpeta tiene que ser mayor a cero'; end if;
      perform 1 from public.clientes where org_id = v_org and codigo = v_codigo;
      if found then
        raise exception 'Ya existe un cliente con el número de carpeta %: usá el %', v_codigo, private.proximo_codigo_cliente();
      end if;
      perform 1 from public.cambios_pendientes cp
      where cp.org_id = v_org and cp.estado = 'pendiente' and cp.entidad = 'cliente' and cp.accion = 'alta'
        and coalesce(cp.datos->>'codigo', '') ~ '^[0-9]{1,9}$' and (cp.datos->>'codigo')::int = v_codigo;
      if found then
        raise exception 'El número de carpeta % ya lo tiene otra alta que espera aprobación: usá el %', v_codigo, private.proximo_codigo_cliente();
      end if;
      v_datos := v_datos || jsonb_build_object('codigo', v_codigo);

    else
      select to_jsonb(c) - 'org_id', c.categoria, c.auth_user_id is not null, c.es_socio
        into v_anterior, v_cat_actual, v_portal, v_es_socio
      from public.clientes c where c.id = p_entidad_id and c.org_id = v_org;
      if v_anterior is null then raise exception 'Cliente inexistente'; end if;
      v_cliente := p_entidad_id;
      if not (v_cat_actual = any (v_gest)) then raise exception '%', v_msg_cat; end if;

      if p_accion = 'modificacion' then
        if v_datos ? 'nombre' and coalesce(trim(v_datos->>'nombre'), '') = '' then
          raise exception 'Poné el nombre del cliente';
        end if;
        v_cat_nueva := coalesce((v_datos->>'categoria')::public.categoria_cliente, v_cat_actual);
        if not (v_cat_nueva = any (v_gest)) then raise exception '%', v_msg_cat; end if;
        if v_cat_nueva = 'ambulante' and v_cat_actual <> 'ambulante' then
          if v_portal then
            raise exception 'Un ambulante no puede tener acceso al portal: quitale el acceso primero';
          end if;
          -- Pasa a cobrarse por día: deja de ser socio y de pagar en cuotas (queda en el diff).
          if v_es_socio and not (v_datos ? 'es_socio') then
            v_datos := v_datos || jsonb_build_object('es_socio', false);
          end if;
        end if;
        if v_cat_nueva = 'ambulante' and coalesce((v_datos->>'es_socio')::boolean, false) then
          raise exception 'Un ambulante no puede ser socio: si es socio, cargalo como quintero o puestero';
        end if;
        if v_datos ? 'codigo' then
          if v_datos->'codigo' = 'null'::jsonb or coalesce(v_datos->>'codigo', '') = '' then
            raise exception 'Poné el número de carpeta';
          end if;
          v_codigo := (v_datos->>'codigo')::int;
          if v_codigo < 1 then raise exception 'El número de carpeta tiene que ser mayor a cero'; end if;
          perform 1 from public.clientes where org_id = v_org and codigo = v_codigo and id <> p_entidad_id;
          if found then raise exception 'Ya existe otro cliente con el número de carpeta %', v_codigo; end if;
          v_datos := v_datos || jsonb_build_object('codigo', v_codigo);
        end if;
      end if;
    end if;

  -- ================= cliente_concepto =================
  elsif p_entidad = 'cliente_concepto' then
    if p_entidad_id is not null then
      select to_jsonb(cc) - 'org_id' into v_anterior
      from public.cliente_conceptos cc where cc.id = p_entidad_id and cc.org_id = v_org;
      if v_anterior is null then raise exception 'Ese concepto ya no está en la carpeta del cliente'; end if;
      v_cliente := (v_anterior->>'cliente_id')::uuid;
      v_concepto_id := (v_anterior->>'concepto_id')::uuid;
    else
      if coalesce(v_datos->>'cliente_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'Cliente inexistente';
      end if;
      if coalesce(v_datos->>'concepto_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'Concepto inexistente';
      end if;
      v_cliente := (v_datos->>'cliente_id')::uuid;
      v_concepto_id := (v_datos->>'concepto_id')::uuid;
    end if;
    select c.categoria into v_cat_actual from public.clientes c where c.id = v_cliente and c.org_id = v_org;
    if not found then raise exception 'Cliente inexistente'; end if;
    select co.segmento, co.tipo, co.codigo into v_seg, v_tipo, v_cod_concepto
    from public.conceptos co where co.id = v_concepto_id and co.org_id = v_org;
    if not found then raise exception 'Concepto inexistente'; end if;

    if v_tipo in ('energia','abono_energia') then
      -- Energía es de Administración para TODOS los clientes (permite "Eximir del abono").
      if v_rol = 'guardia' then raise exception 'Ese concepto lo gestiona Administración'; end if;
    else
      if not (v_cat_actual = any (v_gest)) then raise exception '%', v_msg_cat; end if;
      if v_rol = 'guardia' and coalesce(v_seg, '') not in ('quinteros','ambulantes') then
        raise exception 'Ese concepto lo gestiona Administración';
      end if;
      if v_rol = 'admin' and v_seg in ('quinteros','ambulantes') then
        raise exception 'Ese concepto lo gestiona el Jefe de Portería';
      end if;
      if p_accion = 'alta' and v_tipo <> 'recurrente' then
        raise exception 'Ese concepto no se asigna a la carpeta: se cobra en el momento';
      end if;
    end if;
    if v_datos ? 'porcentaje' then
      if coalesce(v_datos->>'porcentaje', '') !~ '^[0-9]{1,3}(\.[0-9]{1,2})?$' then
        raise exception 'El porcentaje va de 1 a 100 (por ejemplo 70)';
      end if;
      if (v_datos->>'porcentaje')::numeric not between 1 and 100 then
        raise exception 'El porcentaje va de 1 a 100 (por ejemplo 70)';
      end if;
    end if;
    if v_datos ? 'cantidad' then
      if coalesce(v_datos->>'cantidad', '') !~ '^[0-9]{1,2}(\.[0-9]{1,2})?$' then
        raise exception 'Poné una cantidad válida (de ¼ a 99)';
      end if;
      if (v_datos->>'cantidad')::numeric <= 0 then
        raise exception 'Poné una cantidad válida (de ¼ a 99)';
      end if;
    end if;

  -- ================= concepto (catálogo) =================
  elsif p_entidad = 'concepto' then
    if p_accion = 'alta' then
      if v_rol <> 'lider' then raise exception 'Los conceptos nuevos los da de alta el Líder de Procesos'; end if;
    else
      select to_jsonb(co) - 'org_id', co.segmento, co.codigo into v_anterior, v_seg, v_cod_concepto
      from public.conceptos co where co.id = p_entidad_id and co.org_id = v_org;
      if v_anterior is null then raise exception 'Concepto inexistente'; end if;
      if v_rol = 'guardia' then
        if p_accion <> 'modificacion' or coalesce(v_seg, '') not in ('quinteros','ambulantes')
           or exists (select 1 from jsonb_object_keys(v_datos) k where k <> 'precio') then
          raise exception 'Desde Portería solo se cambia el precio de Quintas y Ambulantes';
        end if;
      elsif v_rol = 'admin' then
        if v_seg in ('quinteros','ambulantes') or v_cod_concepto = 'BC' then
          raise exception 'Ese precio lo maneja Portería';
        end if;
      end if;
    end if;
    if v_datos ? 'segmento' then
      if v_rol <> 'lider' then raise exception 'El segmento de un concepto lo cambia el Líder de Procesos'; end if;
      if v_datos->'segmento' <> 'null'::jsonb and coalesce(v_datos->>'segmento', '') <> ''
         and v_datos->>'segmento' not in ('puesteros','puestos_propios','locales','galpones','conteiners',
                                           'cocheras','quinteros','ambulantes') then
        raise exception 'Segmento inválido';
      end if;
    end if;
    if v_datos ? 'precio' then
      if coalesce(v_datos->>'precio', '') !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$' then
        raise exception 'Poné un precio válido (solo números)';
      end if;
    end if;
  end if;

  if v_en_el_acto then
    v_resumen := format('Alta de ambulante %s (aplicada en el acto, revisala)', trim(v_datos->>'nombre'));
  end if;

  insert into public.cambios_pendientes (org_id, entidad, accion, entidad_id, cliente_id, datos,
                                         datos_anteriores, resumen, solicitado_por, revisar_despues)
  values (v_org, p_entidad, p_accion, p_entidad_id, v_cliente, v_datos, v_anterior, v_resumen,
          (select auth.uid()), v_en_el_acto)
  returning * into v_cambio;

  -- El Líder aplica directo (queda aprobado y firmado). El alta de ambulante del Jefe (D-P1) se aplica
  -- en el acto pero queda SIN revisor y con revisar_despues: el Líder la ve en "Aplicadas por el Jefe".
  if v_rol = 'lider' or v_en_el_acto then
    begin
      v_resultado := private.aplicar_cambio(v_cambio);
    exception
      when check_violation then
        get stacked diagnostics v_constraint = constraint_name;
        if v_constraint = 'clientes_ambulante_sin_portal' then
          raise exception 'Un ambulante no puede tener acceso al portal: quitale el acceso primero';
        end if;
        raise;
      when unique_violation then
        get stacked diagnostics v_constraint = constraint_name;
        if v_constraint = 'clientes_org_id_codigo_key' then
          raise exception 'Ya existe otro cliente con ese número de carpeta: usá el %', private.proximo_codigo_cliente();
        end if;
        raise;
    end;
    update public.cambios_pendientes set
      estado = 'aprobado',
      revisado_por = case when v_en_el_acto then null else (select auth.uid()) end,
      revisado_en = case when v_en_el_acto then null else now() end,
      resultado_id = v_resultado,
      cliente_id = coalesce(cliente_id, case when p_entidad = 'cliente' then v_resultado end)
    where id = v_cambio.id;
    return jsonb_build_object('estado', 'aplicado', 'cambio_id', v_cambio.id, 'resultado_id', v_resultado);
  end if;

  return jsonb_build_object('estado', 'pendiente', 'cambio_id', v_cambio.id, 'resultado_id', null);
end;
$function$;
revoke all on function public.solicitar_cambio(text, text, uuid, jsonb, text, uuid) from public, anon;
grant execute on function public.solicitar_cambio(text, text, uuid, jsonb, text, uuid) to authenticated;
