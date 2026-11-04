-- 0061: v_avance_mes, las cuotas cubiertas salen de lo pagado.
--
-- `falta` lleva el beneficio en término y `total` no, así que `total - falta` contaba el
-- beneficio como si estuviera pagado: con $ 1.080.000 en 30 cuotas y nada pagado decía
-- «Pagó 3 de 30 días» (el 03/11/2026, 25 de las 77 cuentas con cuotas del mes, 7 de ellas sin
-- ningún pago). Ahora se mide lo pagado sobre lo que hay que pagar hoy (lo pagado + lo que
-- falta). Cuando no hay beneficio vigente da lo mismo que antes. La cuota sugerida no cambia.
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
                END) AS falta,
            sum(c.semanas_no_vino)::integer AS semanas_no_vino
           FROM cargos c
          WHERE c.estado <> 'anulado'::estado_cargo AND (c.origen = ANY (ARRAY['generacion'::text, 'energia'::text]))
          GROUP BY c.org_id, c.cliente_id, c.periodo
        ), sem AS (
         SELECT b.org_id,
            b.cliente_id,
            b.periodo,
            b.total,
            b.pagado,
            b.falta,
            b.semanas_no_vino,
            GREATEST(cl.cuotas_mes - b.semanas_no_vino, 1) AS cuotas
           FROM base b
             JOIN clientes cl ON cl.id = b.cliente_id
        ), cub AS (
         SELECT s.org_id,
            s.cliente_id,
            s.periodo,
            s.total,
            s.pagado,
            s.falta,
            s.semanas_no_vino,
            s.cuotas,
                CASE
                    WHEN s.falta <= 0.009 THEN s.cuotas
                    ELSE LEAST((s.cuotas - 1)::numeric, COALESCE(floor(s.pagado * s.cuotas::numeric / NULLIF(s.pagado + s.falta, 0::numeric)), 0::numeric))::integer
                END AS cuotas_cubiertas
           FROM sem s
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
        END AS cuota_sugerida,
    semanas_no_vino
   FROM cub;
revoke all on public.v_avance_mes from public, anon, authenticated;
grant select on public.v_avance_mes to authenticated;
