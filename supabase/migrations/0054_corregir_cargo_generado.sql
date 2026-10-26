-- ============================================================
-- 0054 · Corregir un cargo del mes que se generó mal.
--
-- Pedido del 25/10/2026 (audio de Administración): "cuando se generan los conceptos que se
-- van a cobrar en el mes, si en alguno se generó con algún error, después no nos permite
-- modificarlo. Por ejemplo la cochera [de P&P] sale 34.000 y se ve que apretamos el botón de
-- más: se cobra por 1,25 y nos quedan 42.500. Fuimos al cliente, lo modificamos, pero como
-- ya se generó, sigue estando el precio de 42.500 por pagar. Eso se debería poder modificar."
--
-- La carpeta manda: los cambios de la carpeta rigen desde el mes que viene, pero si el cargo
-- del mes se generó mal, se rehace con lo que dice HOY la carpeta (cantidad, porcentaje y
-- precio del concepto), con la misma cuenta que generar_periodo y generar_abonos_energia:
--   · private.cargo_segun_carpeta(cargo): cómo saldría ese cargo si se generara ahora (o que
--     ya no corresponde: concepto apagado, eximido del abono, sin medidor…).
--   · cargos_para_corregir(cliente): los cargos del mes en curso que no coinciden con la
--     carpeta (la ficha los marca y ofrece «Corregir»).
--   · corregir_cargo(cargo, motivo): anula el cargo con su rastro y genera el corregido. Lo
--     que ya estaba pagado de ese cargo pasa al corregido (cada cobro con su día, para el
--     beneficio en término); si sobra, vuelve a ser saldo a favor y se aplica a sus otras
--     deudas. Los recibos no cambian de número ni de plata.
-- Solo cargos generados con el mes (mensuales y abono de energía), del mes en curso o
-- posteriores. Quien gestiona al cliente: Administración, el Jefe de Portería y el Líder.
-- ============================================================

create or replace function private.cargo_segun_carpeta(p_cargo uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_c public.cargos;
  v_co public.conceptos;
  v_cl public.clientes;
  v_cc public.cliente_conceptos;
  v_cant numeric;
  v_pct numeric;
  v_monto numeric;
  v_existe boolean;
begin
  select * into v_c from public.cargos where id = p_cargo;
  if not found then return null; end if;
  select * into v_co from public.conceptos where id = v_c.concepto_id;
  select * into v_cl from public.clientes where id = v_c.cliente_id;
  select * into v_cc from public.cliente_conceptos
  where cliente_id = v_c.cliente_id and concepto_id = v_c.concepto_id;

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
    return null;   -- energía, diarios, deudas, multas: no se corrigen desde acá
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
revoke all on function private.cargo_segun_carpeta(uuid) from public, anon;
grant execute on function private.cargo_segun_carpeta(uuid) to authenticated;
comment on function private.cargo_segun_carpeta(uuid) is
  'Cómo saldría hoy un cargo generado con el mes (misma cuenta que generar_periodo / generar_abonos_energia), o {existe:false} si ya no corresponde; null si no es mensual ni abono (0054).';

create or replace function public.cargos_para_corregir(p_cliente uuid)
returns table (
  cargo_id uuid,
  periodo date,
  codigo text,
  descripcion text,
  cantidad numeric,
  monto numeric,
  monto_pagado numeric,
  existe boolean,
  descripcion_nueva text,
  cantidad_nueva numeric,
  monto_nuevo numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
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
end $$;
revoke all on function public.cargos_para_corregir(uuid) from public, anon;
grant execute on function public.cargos_para_corregir(uuid) to authenticated;
comment on function public.cargos_para_corregir(uuid) is
  'Cargos generados del mes en curso (o posteriores) que no coinciden con la carpeta del cliente: lo que tienen y cómo quedarían. Para «Corregir» en la ficha (0054).';

create or replace function public.corregir_cargo(p_cargo uuid, p_motivo text default null)
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
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_cliente uuid;
  v_c public.cargos;
  v_n jsonb;
  v_existe boolean;
  v_nuevo public.cargos;
  v_imp record;
  v_objetivo numeric;
  v_saldo numeric;
  v_aplicar numeric;
  v_movido numeric := 0;
  v_liberado numeric := 0;
  v_aplicado numeric := 0;
  v_texto text;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('admin', 'guardia', 'lider') then
    raise exception 'No tenés permiso para corregir cargos';
  end if;
  if v_motivo is not null and char_length(v_motivo) > 300 then
    raise exception 'El motivo es demasiado largo (hasta 300 letras)';
  end if;

  select c.cliente_id into v_cliente from public.cargos c where c.id = p_cargo and c.org_id = v_org;
  if v_cliente is null then raise exception 'Ese cargo no existe. Recargá la página'; end if;
  if not private.puede_gestionar_cliente(v_cliente) then
    raise exception '%', case when v_rol = 'guardia'
      then 'A este cliente lo gestiona Administración'
      else 'A quinteros y ambulantes los gestiona el Jefe de Portería' end;
  end if;

  -- (c) Cliente → (d) cargo (§4.0-1/2): un cobro en paralelo espera o ya terminó.
  perform 1 from public.clientes where id = v_cliente for update;
  select * into v_c from public.cargos where id = p_cargo for update;
  if v_c.estado = 'anulado' then
    raise exception 'Ese cargo ya se corrigió o se anuló. Recargá la página';
  end if;
  if v_c.origen <> 'generacion' then
    raise exception 'Desde acá se corrigen los cargos que se generan con el mes';
  end if;
  if v_c.periodo < date_trunc('month', v_hoy)::date then
    raise exception 'Solo se corrigen los cargos del mes en curso';
  end if;
  v_n := private.cargo_segun_carpeta(p_cargo);
  if v_n is null then raise exception 'Este cargo no se corrige desde acá'; end if;
  v_existe := (v_n ->> 'existe')::boolean;
  if v_existe
     and (v_n ->> 'monto')::numeric = v_c.monto
     and (v_n ->> 'cantidad')::numeric = v_c.cantidad
     and (v_n ->> 'precio_unitario')::numeric = v_c.precio_unitario
     and (v_n ->> 'descuento_pronto_pago')::numeric = v_c.descuento_pronto_pago then
    raise exception 'Este cargo ya coincide con la carpeta: no hay nada que corregir';
  end if;

  v_texto := case when v_existe
      then 'Corregido con la carpeta: ' || v_c.descripcion || ' ' || private.cobro_pesos(v_c.monto)
           || ' → ' || (v_n ->> 'descripcion') || ' ' || private.cobro_pesos((v_n ->> 'monto')::numeric)
      else 'Anulado: según la carpeta ya no corresponde' end
    || coalesce(' · ' || v_motivo, '');

  -- El cargo mal generado queda anulado, con quién, cuándo y por qué (su plata se mueve abajo).
  update public.cargos set
    estado = 'anulado',
    anulado_por = v_yo,
    anulado_en = now(),
    anulado_motivo = left(v_texto, 500)
  where id = v_c.id;

  if v_existe then
    insert into public.cargos (
      org_id, periodo, cliente_id, concepto_id, codigo, descripcion, cantidad, precio_unitario,
      monto, descuento_pronto_pago, vencimiento, origen, creado_por)
    values (
      v_org, v_c.periodo, v_c.cliente_id, v_c.concepto_id, v_c.codigo, v_n ->> 'descripcion',
      (v_n ->> 'cantidad')::numeric, (v_n ->> 'precio_unitario')::numeric, (v_n ->> 'monto')::numeric,
      (v_n ->> 'descuento_pronto_pago')::numeric, v_c.vencimiento, 'generacion', v_yo)
    returning * into v_nuevo;
  end if;

  -- Lo que ya estaba pagado (cobros y saldo a favor) pasa al cargo corregido, en el orden en
  -- que entró y con la regla de imputar_pago: para el beneficio en término vale el día de la
  -- caja de cada cobro. Lo que no entra queda libre (saldo a favor).
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
    v_aplicar := 0;
    if v_existe then
      select * into v_nuevo from public.cargos where id = v_nuevo.id;
      v_objetivo := case when v_imp.dia <= v_nuevo.vencimiento
        then private.monto_con_beneficio(v_nuevo.monto, v_nuevo.descuento_pronto_pago)
        else v_nuevo.monto end;
      v_saldo := v_objetivo - v_nuevo.monto_pagado;
      v_aplicar := greatest(least(v_imp.monto, v_saldo), 0);
    end if;
    if v_aplicar > 0 then
      update public.imputaciones set cargo_id = v_nuevo.id, monto = v_aplicar where id = v_imp.id;
      update public.cargos set
        monto_pagado = monto_pagado + v_aplicar,
        descuento_aplicado = case when v_aplicar = v_saldo and v_imp.dia <= vencimiento
          then monto - v_objetivo else descuento_aplicado end,
        estado = case when v_aplicar = v_saldo
          then 'pagado'::public.estado_cargo else 'parcial'::public.estado_cargo end
      where id = v_nuevo.id;
      v_movido := v_movido + v_aplicar;
    else
      delete from public.imputaciones where id = v_imp.id;
    end if;
    v_liberado := v_liberado + (v_imp.monto - v_aplicar);
  end loop;

  update public.cargos set monto_pagado = 0, descuento_aplicado = 0 where id = v_c.id;

  -- Lo que quedó libre es saldo a favor del cliente y va a sus otras deudas, como siempre.
  if v_liberado > 0.009 then
    v_aplicado := private.aplicar_saldo_favor(v_cliente);
  end if;

  return jsonb_build_object(
    'cargo_anulado', v_c.id,
    'cargo_nuevo', case when v_existe then v_nuevo.id end,
    'descripcion_anterior', v_c.descripcion,
    'monto_anterior', v_c.monto,
    'descripcion_nueva', case when v_existe then v_n ->> 'descripcion' end,
    'monto_nuevo', case when v_existe then (v_n ->> 'monto')::numeric end,
    'pagado', round(v_movido, 2),
    'liberado', round(v_liberado, 2),
    'aplicado', round(v_aplicado, 2));
end $$;
revoke all on function public.corregir_cargo(uuid, text) from public, anon;
grant execute on function public.corregir_cargo(uuid, text) to authenticated;
comment on function public.corregir_cargo(uuid, text) is
  'Rehace un cargo del mes generado mal con lo que dice hoy la carpeta (o lo anula si ya no corresponde). Lo pagado pasa al corregido; lo que sobra vuelve a saldo a favor. Administración, el Jefe y el Líder, sobre sus clientes (0054).';
