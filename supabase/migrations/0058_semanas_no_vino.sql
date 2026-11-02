-- ============================================================
-- 0058 · Semanas que el quintero no vino (pedido del mercado, 02/11/2026)
--
-- «A los quinteros se les cobra 330 mil pesos mensuales por quinta, pero se les cobra en cada
-- una de las semanas que vienen. Tengo una quinta que me debe tres semanas, pero esas tres
-- semanas no vino: que no tenga esa deuda, pero que tampoco entró esa plata.»
--
-- La quinta del mes (EXPQ) se cobra en `clientes.cuotas_mes` cuotas (una por semana). Con
-- `descontar_semanas` quien gestiona al cliente descuenta las semanas que no vino de un mes
-- que todavía debe: el cargo queda anulado con el rastro (quién, cuándo, «No vino 3 semanas:
-- $ 330.000 → $ 82.500») y se rehace por lo que corresponde, con lo ya pagado adentro (como
-- corregir_cargo, 0054). No es un cobro: no entra plata a ninguna caja.
--
--   · cargos.semanas_no_vino: cuántas semanas se le descontaron a ese cargo (acumula).
--   · v_avance_mes: las cuotas del mes son las semanas que sí vino (cuotas_mes − descontadas),
--     así la cuota sugerida sigue siendo la de una semana; columna nueva semanas_no_vino al final.
--   · Un cargo con semanas descontadas no es «mal generado»: cargos_para_corregir no lo marca,
--     corregir_cargo no lo toca y el cambio de la carpeta que rige desde ese mes lo deja como está.
-- ============================================================

alter table public.cargos
  add column if not exists semanas_no_vino smallint not null default 0;
alter table public.cargos drop constraint if exists cargos_semanas_no_vino_check;
alter table public.cargos add constraint cargos_semanas_no_vino_check
  check (semanas_no_vino between 0 and 31);
comment on column public.cargos.semanas_no_vino is
  'Semanas de la quinta del mes que se le descontaron porque no vino (descontar_semanas, 0058).';

-- ---------- 1) descontar_semanas ----------
create or replace function public.descontar_semanas(p_cargo uuid, p_semanas integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
  v_yo uuid := (select auth.uid());
  v_cliente uuid;
  v_cuotas integer;
  v_c public.cargos;
  v_codigo text;
  v_vigentes integer;
  v_semana numeric;
  v_debe numeric;
  v_max integer;
  v_descuento numeric;
  v_semanas integer;
  v_nuevo public.cargos;
  v_imp record;
  v_objetivo numeric;
  v_saldo numeric;
  v_aplicar numeric;
  v_liberado numeric := 0;
  v_texto text;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('admin', 'guardia', 'lider') then
    raise exception 'No tenés permiso para descontar semanas';
  end if;
  if p_semanas is null or p_semanas < 1 then
    raise exception 'Elegí cuántas semanas no vino';
  end if;

  select c.cliente_id into v_cliente from public.cargos c where c.id = p_cargo and c.org_id = v_org;
  if v_cliente is null then raise exception 'Ese cargo no existe. Recargá la página'; end if;
  if not private.puede_gestionar_cliente(v_cliente) then
    raise exception '%', case when v_rol = 'guardia'
      then 'A este cliente lo gestiona Administración'
      else 'A quinteros y ambulantes los gestiona el Jefe de Portería' end;
  end if;

  -- Cliente → cargo, como un cobro (§4.0-1/2): uno en paralelo espera o ya terminó.
  select cl.cuotas_mes into v_cuotas from public.clientes cl where cl.id = v_cliente for update;
  select * into v_c from public.cargos where id = p_cargo for update;
  if v_c.estado = 'anulado' then
    raise exception 'Ese cargo ya se corrigió o se anuló. Recargá la página';
  end if;
  select co.codigo into v_codigo from public.conceptos co where co.id = v_c.concepto_id;
  if v_codigo is distinct from 'EXPQ' or v_c.origen <> 'generacion' then
    raise exception 'Las semanas que no vino se descuentan de la quinta del mes';
  end if;
  if coalesce(v_cuotas, 1) <= 1 then
    raise exception 'Paga la quinta en un solo pago: no hay semanas para descontar';
  end if;
  v_vigentes := v_cuotas - v_c.semanas_no_vino;
  if v_vigentes < 1 then
    raise exception 'Ya se le descontaron todas las semanas de ese mes';
  end if;
  v_debe := v_c.monto - v_c.monto_pagado;
  if v_c.estado not in ('pendiente', 'parcial') or v_debe <= 0.009 then
    raise exception 'Ese mes ya está pago: no hay semanas que descontar';
  end if;

  -- Una semana = la quinta del mes / las semanas que quedan. Se descuentan como mucho las
  -- semanas que debe (lo pagado no se toca): la última se lleva lo que falte exacto.
  v_semana := round(v_c.monto / v_vigentes, 2);
  v_max := least(v_vigentes, ceil(round(v_debe / v_semana, 4))::integer);
  if p_semanas > v_max then
    raise exception 'De ese mes debe %: se pueden descontar hasta esas',
      case when v_max = 1 then '1 semana' else v_max || ' semanas' end;
  end if;
  v_descuento := case when p_semanas = v_max then v_debe
                      else least(round(p_semanas * v_semana, 2), v_debe) end;
  v_semanas := v_c.semanas_no_vino + p_semanas;

  v_texto := 'No vino ' || p_semanas || case when p_semanas = 1 then ' semana: ' else ' semanas: ' end
    || private.cobro_pesos(v_c.monto) || ' → ' || private.cobro_pesos(v_c.monto - v_descuento);

  update public.cargos set
    estado = 'anulado',
    anulado_por = v_yo,
    anulado_en = now(),
    anulado_motivo = left(v_texto, 500)
  where id = v_c.id;

  insert into public.cargos (
    org_id, periodo, cliente_id, concepto_id, codigo, descripcion, cantidad, precio_unitario,
    monto, descuento_pronto_pago, vencimiento, origen, creado_por, semanas_no_vino)
  values (
    v_org, v_c.periodo, v_c.cliente_id, v_c.concepto_id, v_c.codigo,
    regexp_replace(v_c.descripcion, ' · no vino [0-9]+ semanas?$', '')
      || ' · no vino ' || v_semanas || case when v_semanas = 1 then ' semana' else ' semanas' end,
    v_c.cantidad, v_c.precio_unitario, v_c.monto - v_descuento, v_c.descuento_pronto_pago,
    v_c.vencimiento, 'generacion', v_yo, v_semanas)
  returning * into v_nuevo;

  -- Lo ya pagado pasa al cargo nuevo con la regla de imputar_pago (corregir_cargo, 0054): para
  -- el beneficio en término vale el día de la caja de cada cobro. Lo que no entra queda a favor.
  for v_imp in
    select i.id, i.monto,
           case when i.origen = 'cobro' then least(cj.fecha, v_hoy)
                else (i.creado_en at time zone 'America/Argentina/Cordoba')::date end as dia
    from public.imputaciones i
    join public.pagos p on p.id = i.pago_id
    join public.cajas cj on cj.id = p.caja_id
    where i.cargo_id = v_c.id
    order by p.fecha, i.creado_en
    for update of i
  loop
    select * into v_nuevo from public.cargos where id = v_nuevo.id;
    v_objetivo := case when v_imp.dia <= v_nuevo.vencimiento
      then private.monto_con_beneficio(v_nuevo.monto, v_nuevo.descuento_pronto_pago)
      else v_nuevo.monto end;
    v_saldo := v_objetivo - v_nuevo.monto_pagado;
    v_aplicar := greatest(least(v_imp.monto, v_saldo), 0);
    if v_aplicar > 0 then
      update public.imputaciones set cargo_id = v_nuevo.id, monto = v_aplicar where id = v_imp.id;
      update public.cargos set
        monto_pagado = monto_pagado + v_aplicar,
        descuento_aplicado = case when v_aplicar = v_saldo and v_imp.dia <= vencimiento
          then monto - v_objetivo else descuento_aplicado end,
        estado = case when v_aplicar = v_saldo
          then 'pagado'::public.estado_cargo else 'parcial'::public.estado_cargo end
      where id = v_nuevo.id;
    else
      delete from public.imputaciones where id = v_imp.id;
    end if;
    v_liberado := v_liberado + (v_imp.monto - v_aplicar);
  end loop;

  update public.cargos set monto_pagado = 0, descuento_aplicado = 0 where id = v_c.id;
  -- No vino en todo el mes: queda el cargo en $ 0 (con sus semanas), saldado.
  update public.cargos set estado = 'pagado' where id = v_nuevo.id and monto = 0;

  if v_liberado > 0.009 then
    perform private.aplicar_saldo_favor(v_cliente);
  end if;

  select * into v_nuevo from public.cargos where id = v_nuevo.id;
  return jsonb_build_object(
    'cargo_anulado', v_c.id,
    'cargo_nuevo', v_nuevo.id,
    'periodo', v_c.periodo,
    'semanas', p_semanas,
    'semanas_no_vino', v_semanas,
    'descuento', v_descuento,
    'monto_anterior', v_c.monto,
    'monto_nuevo', v_nuevo.monto,
    'debe', greatest(v_nuevo.monto - v_nuevo.monto_pagado, 0));
end $$;
revoke all on function public.descontar_semanas(uuid, integer) from public, anon;
grant execute on function public.descontar_semanas(uuid, integer) to authenticated;
comment on function public.descontar_semanas(uuid, integer) is
  'Descuenta de la quinta del mes (EXPQ) las semanas que el quintero no vino, sin cobro (0058).';

-- ---------- 2) v_avance_mes: las cuotas son las semanas que sí vino ----------
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
                    ELSE LEAST((s.cuotas - 1)::numeric, COALESCE(floor((s.total - s.falta) / NULLIF(s.total / s.cuotas::numeric, 0::numeric)), 0::numeric))::integer
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

-- ---------- 3) Lo descontado no es «mal generado» ----------
-- Anclas de una línea sobre las definiciones vigentes (0057 y 0054); si alguna no está tal
-- cual, no se cambia nada. Después se compara el md5 del cuerpo con el de la réplica probada.
do $do$
declare
  v_def text;
  v_ancla text;
  v_nueva text;
begin
  -- cargos_para_corregir: no lista los cargos con semanas descontadas.
  v_def := pg_get_functiondef('public.cargos_para_corregir(uuid)'::regprocedure);
  v_ancla := E'      and co.tipo in (''recurrente'', ''abono_energia'')\n';
  v_nueva := v_ancla || E'      -- 0058: con semanas que no vino descontadas, el monto distinto a la carpeta es a propósito.\n'
                     || E'      and c.semanas_no_vino = 0\n';
  if (length(v_def) - length(replace(v_def, v_ancla, ''))) / length(v_ancla) <> 1 then
    raise exception 'cargos_para_corregir: el ancla no aparece una sola vez';
  end if;
  execute replace(v_def, v_ancla, v_nueva);

  -- corregir_cargo: no lo rehace con la carpeta (perdería las semanas descontadas).
  v_def := pg_get_functiondef('public.corregir_cargo(uuid, text)'::regprocedure);
  v_ancla := E'  v_n := private.cargo_segun_carpeta(p_cargo);\n';
  v_nueva := E'  if v_c.semanas_no_vino > 0 then\n'
          || E'    raise exception ''A este cargo se le descontaron semanas que no vino: no se corrige con la carpeta'';\n'
          || E'  end if;\n' || v_ancla;
  if (length(v_def) - length(replace(v_def, v_ancla, ''))) / length(v_ancla) <> 1 then
    raise exception 'corregir_cargo: el ancla no aparece una sola vez';
  end if;
  execute replace(v_def, v_ancla, v_nueva);

  -- El cambio de la carpeta que rige desde ese mes deja como está el cargo con semanas descontadas.
  v_def := pg_get_functiondef('private.tg_cambio_rige_desde()'::regprocedure);
  v_ancla := E'      and c.periodo >= v_mes\n';
  v_nueva := v_ancla || E'      and c.semanas_no_vino = 0\n';
  if (length(v_def) - length(replace(v_def, v_ancla, ''))) / length(v_ancla) <> 1 then
    raise exception 'tg_cambio_rige_desde: el ancla no aparece una sola vez';
  end if;
  execute replace(v_def, v_ancla, v_nueva);
end $do$;
