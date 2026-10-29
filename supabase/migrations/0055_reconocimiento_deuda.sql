-- ============================================================
-- 0055 · Reconocimiento de deuda: deuda de antes con plan de pago, sin perder el beneficio.
--
-- Pedido del 29/10/2026 (audio de Administración): "agregamos un campo al lado [de deuda
-- pasada] que diría reconocimiento de deuda. Es un puestero que tiene una deuda anterior, que
-- ya reconocieron la forma de pago y la están pagando, y de esa manera nosotros evitamos
-- cobrarle la pérdida del beneficio. Necesitamos cargarle la deuda, pero que la deuda que
-- figure ahí no haga que pierda el beneficio."
--
-- El beneficio se pierde porque cada cobro paga primero lo más viejo: con una deuda de antes
-- del sistema, la expensa del mes no llega a saldarse antes del vencimiento. Un cargo de deuda
-- (RD) marcado como reconocimiento:
--   · se paga ÚLTIMO, después de todo lo demás de cualquier mes (imputar_pago_en y
--     aplicar_saldo_favor): lo que paga va primero a su mes y lo que paga de más, al
--     reconocimiento;
--   · no cuenta como deuda vencida ni atrasada (v_deuda_clientes): tiene un plan acordado.
-- Sigue sumando en «Debe»: la deuda existe. La «Deuda pasada» sin acuerdo sigue igual (la más
-- vieja, se paga primero). Lo carga Administración o el Líder, como la deuda pasada.
-- ============================================================

alter table public.cargos add column if not exists reconocimiento boolean not null default false;
alter table public.cargos drop constraint if exists cargos_reconocimiento_es_deuda;
alter table public.cargos add constraint cargos_reconocimiento_es_deuda
  check (not reconocimiento or origen = 'deuda');
comment on column public.cargos.reconocimiento is
  'Deuda de antes con plan de pago acordado (0055): se imputa al final y no cuenta como vencida.';
grant insert (reconocimiento) on public.cargos to authenticated;

-- El algoritmo de imputación (0052) con el reconocimiento al final.
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
    order by coalesce(c.id = p_cargo_primero, false) desc, c.reconocimiento asc,
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

-- El saldo a favor (0034), con el mismo orden.
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
      order by c.reconocimiento asc, c.periodo asc, co.orden_imputacion asc, c.creado_en asc
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

-- Deuda por cliente (0034): el reconocimiento suma en la deuda pero no la vuelve vencida ni
-- atrasada (el mapa pinta "deuda atrasada" por periodo_mas_viejo).
create or replace view public.v_deuda_clientes with (security_invoker = true) as
 SELECT org_id,
    cliente_id,
    sum(
        CASE
            WHEN private.hoy_ar() <= vencimiento THEN private.monto_con_beneficio(monto, descuento_pronto_pago)
            ELSE monto
        END - monto_pagado) AS deuda,
    count(*) AS cargos_pendientes,
    min(periodo) FILTER (WHERE NOT reconocimiento) AS periodo_mas_viejo,
    COALESCE(sum(monto - monto_pagado) FILTER (WHERE vencimiento < private.hoy_ar() AND NOT reconocimiento), 0::numeric) AS deuda_vencida,
    min(vencimiento) FILTER (WHERE vencimiento < private.hoy_ar() AND NOT reconocimiento) AS vencido_desde,
    min(vencimiento) FILTER (WHERE vencimiento >= private.hoy_ar()) AS proximo_vencimiento
   FROM cargos
  WHERE estado = ANY (ARRAY['pendiente'::estado_cargo, 'parcial'::estado_cargo])
  GROUP BY org_id, cliente_id;
