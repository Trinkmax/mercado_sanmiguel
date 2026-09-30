-- ============================================================
-- Mercado San Miguel — 0034 Beneficio por pago en término: dividir, no restar
--
-- El precio de lista ya incluye el recargo: quien paga en término paga el precio
-- dividido (1 + %), no el precio menos el %. Con 15 %: 1.080.000 / 1,15 = 939.130,43
-- (antes 1.080.000 × 0,85 = 918.000). Una sola función, private.monto_con_beneficio,
-- la usan la imputación de pagos, el saldo a favor, la deuda (v_deuda_clientes), el
-- avance del mes (v_avance_mes) y el resumen por concepto. Idempotente.
-- ============================================================

create or replace function private.monto_con_beneficio(p_monto numeric, p_porcentaje numeric)
returns numeric
language sql immutable set search_path = '' as $$
  select round(p_monto / (1 + coalesce(p_porcentaje, 0) / 100.0), 2)
$$;
revoke all on function private.monto_con_beneficio(numeric, numeric) from public, anon;
grant execute on function private.monto_con_beneficio(numeric, numeric) to authenticated;
comment on function private.monto_con_beneficio(numeric, numeric) is
  'Monto a pagar en término: monto / (1 + porcentaje/100), a centavos (el precio de lista incluye el recargo).';

create or replace function private.imputar_pago(p_pago uuid, p_cliente uuid, p_monto numeric, p_cargo_primero uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$;
revoke all on function private.imputar_pago(uuid, uuid, numeric, uuid) from public, anon;
grant execute on function private.imputar_pago(uuid, uuid, numeric, uuid) to authenticated;

create or replace function private.aplicar_saldo_favor(p_cliente uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
        then private.monto_con_beneficio(v_cargo.monto, v_cargo.descuento_pronto_pago)
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
$function$;
revoke all on function private.aplicar_saldo_favor(uuid) from public, anon;
grant execute on function private.aplicar_saldo_favor(uuid) to authenticated;

create or replace function public.resumen_conceptos(p_periodo date)
 RETURNS TABLE(codigo text, nombre text, estimado numeric, cobrado numeric, descuentos numeric, pendiente numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
        then private.monto_con_beneficio(c.monto, c.descuento_pronto_pago)
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
end $function$;
revoke all on function public.resumen_conceptos(date) from public, anon;
grant execute on function public.resumen_conceptos(date) to authenticated;

create or replace view public.v_deuda_clientes with (security_invoker = true) as
 SELECT org_id,
    cliente_id,
    sum(
        CASE
            WHEN private.hoy_ar() <= vencimiento THEN private.monto_con_beneficio(monto, descuento_pronto_pago)
            ELSE monto
        END - monto_pagado) AS deuda,
    count(*) AS cargos_pendientes,
    min(periodo) AS periodo_mas_viejo,
    COALESCE(sum(monto - monto_pagado) FILTER (WHERE vencimiento < private.hoy_ar()), 0::numeric) AS deuda_vencida,
    min(vencimiento) FILTER (WHERE vencimiento < private.hoy_ar()) AS vencido_desde,
    min(vencimiento) FILTER (WHERE vencimiento >= private.hoy_ar()) AS proximo_vencimiento
   FROM cargos
  WHERE estado = ANY (ARRAY['pendiente'::estado_cargo, 'parcial'::estado_cargo])
  GROUP BY org_id, cliente_id;

create or replace view public.v_avance_mes with (security_invoker = true) as
 WITH base AS (
         SELECT c.org_id,
            c.cliente_id,
            c.periodo,
            sum(c.monto) AS total,
            sum(c.monto_pagado) AS pagado,
            sum(
                CASE
                    WHEN c.estado = ANY (ARRAY['pendiente'::estado_cargo, 'parcial'::estado_cargo]) THEN GREATEST(
                    CASE
                        WHEN private.hoy_ar() <= c.vencimiento THEN private.monto_con_beneficio(c.monto, c.descuento_pronto_pago)
                        ELSE c.monto
                    END - c.monto_pagado, 0::numeric)
                    ELSE 0::numeric
                END) AS falta
           FROM cargos c
          WHERE c.estado <> 'anulado'::estado_cargo AND (c.origen = ANY (ARRAY['generacion'::text, 'energia'::text]))
          GROUP BY c.org_id, c.cliente_id, c.periodo
        ), cub AS (
         SELECT b.org_id,
            b.cliente_id,
            b.periodo,
            b.total,
            b.pagado,
            b.falta,
            cl.cuotas_mes AS cuotas,
                CASE
                    WHEN b.falta <= 0.009 THEN cl.cuotas_mes
                    ELSE LEAST((cl.cuotas_mes - 1)::numeric, COALESCE(floor((b.total - b.falta) / NULLIF(b.total / cl.cuotas_mes::numeric, 0::numeric)), 0::numeric))::integer
                END AS cuotas_cubiertas
           FROM base b
             JOIN clientes cl ON cl.id = b.cliente_id
        )
 SELECT org_id,
    cliente_id,
    periodo,
    total,
    pagado,
    falta,
    cuotas,
    cuotas_cubiertas,
        CASE
            WHEN falta <= 0.009 THEN 0::numeric
            WHEN (cuotas - cuotas_cubiertas) <= 1 THEN falta
            ELSE LEAST(falta, round(total / cuotas::numeric, 2))
        END AS cuota_sugerida
   FROM cub;
