-- ============================================================
-- Mercado San Miguel — 0026 Fase 3: arreglos de Tesorería, gastos y cheques (M6)
-- (revisión de UX del 28/09). Contrato: docs/FASE3-CONTRATO.md §3.1, §4.0, §4.9 y §6 M6.
--
-- Regla que manda (§4.0-8): cada corrección de plata deja rastro (quién, cuándo, por qué)
-- y nada se borra si se puede anular.
--
--   1. public.tesoreria_eventos: rastro de las correcciones de Tesorería que no pasan por
--      una caja (movimiento anulado, saldo inicial corregido, cheque devuelto a la cartera,
--      gasto del cheque cambiado, acreditación o depósito deshechos, gasto dividido).
--      Solo lectura por la API; la escriben las RPC. La lee "Correcciones" del Líder.
--   2. Movimientos de Tesorería: se ANULAN con motivo (anulado_en/por, motivo_anulacion),
--      no se borran. flujo_caja no cuenta los anulados. Sin INSERT/UPDATE/DELETE directos:
--      registrar_movimiento_tesoreria (con clave de idempotencia p_ref: un corte de red no
--      duplica el depósito) y anular_movimiento_tesoreria (la comisión de un depósito se
--      anula sola; el depósito se lleva su comisión).
--   3. Saldos iniciales: guardar_saldo_inicial. Corregir monto o fecha pide motivo y deja
--      el valor anterior → nuevo en tesoreria_eventos. Sin escrituras directas (ni TRUNCATE).
--   4. Cheques: deshacer sin perjudicar al cliente. devolver_cheque_a_cartera (entregado →
--      por cobrar; el gasto que pagaba vuelve a Por pagar), desvincular_cheque_gasto (el
--      gasto estaba mal: el cheque queda "entregado sin gasto"), deshacer_acreditacion_cheque
--      (acreditado → depositado) y deshacer_deposito_cheque (depositado → por cobrar; ya no
--      por update directo). Todas con motivo y rastro.
--      entregar_cheque / vincular_cheque_gasto(…, p_diferencia): si el cheque y el gasto no
--      son del mismo monto hay que decir qué pasó con la diferencia: 'dividir' (el gasto baja
--      al monto del cheque y el resto queda como otro gasto pendiente), 'vuelto_efectivo'
--      (el proveedor devolvió el vuelto: entra como ingreso en efectivo) o 'a_favor' (queda a
--      favor con el proveedor). Reintento del mismo pedido → "repetido", sin error.
--      Deshacer la entrega (a cartera / otro gasto / rechazo) junta de nuevo un gasto
--      dividido si el "Resto" sigue pendiente. rechazar_cheque (misma firma que 0018) además
--      deja el vuelto en efectivo como ingreso común y crea el gasto pendiente "Devolver a
--      {proveedor} el vuelto del cheque N° X".
--   5. gastos.ref: clave de idempotencia de "Cargar gasto" (un corte de red no duplica el
--      gasto ni lo paga dos veces desde la caja).
--   6. Bono camioneros por transferencia: canon_camiones.conciliado* + conciliar_canon /
--      desconciliar_canon (J2: Tesorería también chequea esas transferencias).
--
-- No toca funciones de otros módulos (calcular_arqueo, registrar_canon, validar_caja…).
-- Idempotente: create … if not exists, create or replace, drop … if exists. UNA transacción.
-- ============================================================


-- ------------------------------------------------------------
-- 0. Formato de montos para los textos del rastro: "$ 1.234" · "$ 1.234,56" · "US$ 100"
-- ------------------------------------------------------------
create or replace function private.tesoreria_monto(p_monto numeric, p_moneda public.moneda default 'ARS')
returns text
language sql
stable
set search_path = ''
as $$
  select case when p_moneda = 'USD' then 'US$ ' else '$ ' end
    || translate(
         to_char(round(coalesce(p_monto, 0), 2),
                 case when round(coalesce(p_monto, 0), 2) = trunc(coalesce(p_monto, 0))
                      then 'FM999G999G999G990' else 'FM999G999G999G990D00' end),
         ',.', '.,')
$$;
revoke all on function private.tesoreria_monto(numeric, public.moneda) from public, anon, authenticated;


-- ------------------------------------------------------------
-- 1. Rastro de Tesorería
-- ------------------------------------------------------------
create table if not exists public.tesoreria_eventos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id) on delete cascade,
  tipo text not null,
  detalle text not null,
  motivo text,
  monto numeric(14,2),
  moneda public.moneda not null default 'ARS',
  movimiento_id uuid references public.movimientos_tesoreria(id) on delete set null,
  cheque_id uuid references public.cheques(id) on delete set null,
  gasto_id uuid references public.gastos(id) on delete set null,
  valor_anterior jsonb,
  valor_nuevo jsonb,
  hecho_por uuid references auth.users(id) on delete set null default auth.uid(),
  hecho_en timestamptz not null default now()
);
alter table public.tesoreria_eventos drop constraint if exists tesoreria_eventos_tipo_check;
alter table public.tesoreria_eventos add constraint tesoreria_eventos_tipo_check
  check (tipo in ('movimiento_anulado', 'saldo_inicial_cargado', 'saldo_inicial_corregido',
                  'cheque_a_cartera', 'cheque_desvinculado', 'acreditacion_deshecha',
                  'deposito_deshecho', 'gasto_dividido', 'gasto_reunido', 'vuelto_a_devolver'));
create index if not exists tesoreria_eventos_org_idx on public.tesoreria_eventos (org_id, hecho_en desc);
create index if not exists tesoreria_eventos_cheque_idx on public.tesoreria_eventos (cheque_id) where cheque_id is not null;
create index if not exists tesoreria_eventos_mov_idx on public.tesoreria_eventos (movimiento_id) where movimiento_id is not null;
create index if not exists tesoreria_eventos_gasto_idx on public.tesoreria_eventos (gasto_id) where gasto_id is not null;
create index if not exists tesoreria_eventos_hecho_por_idx on public.tesoreria_eventos (hecho_por);

alter table public.tesoreria_eventos enable row level security;
drop policy if exists "leer eventos de tesoreria" on public.tesoreria_eventos;
create policy "leer eventos de tesoreria" on public.tesoreria_eventos for select to authenticated
  using (private.tiene_rol(org_id, array['tesoreria','lider','consejo']::public.rol_usuario[]));
revoke all on public.tesoreria_eventos from public, anon, authenticated;
grant select on public.tesoreria_eventos to authenticated;
comment on table public.tesoreria_eventos is
  'M6 · Rastro de correcciones de Tesorería (movimientos anulados, saldos iniciales corregidos, cheques deshechos). Solo lo escriben las RPC.';


-- ------------------------------------------------------------
-- 2. Movimientos de Tesorería: anular en vez de borrar
-- ------------------------------------------------------------
alter table public.movimientos_tesoreria add column if not exists anulado_en timestamptz;
alter table public.movimientos_tesoreria add column if not exists anulado_por uuid references auth.users(id);
alter table public.movimientos_tesoreria add column if not exists motivo_anulacion text;
alter table public.movimientos_tesoreria drop constraint if exists mov_tes_anulacion_completa;
alter table public.movimientos_tesoreria add constraint mov_tes_anulacion_completa
  check (anulado_en is null or coalesce(trim(motivo_anulacion), '') <> '');
create index if not exists mov_tes_anulado_por_idx on public.movimientos_tesoreria (anulado_por) where anulado_por is not null;

-- Todo pasa por RPC: sin INSERT/UPDATE/DELETE directos (el REVOKE de tabla se lleva los
-- grants por columna de 0022).
drop policy if exists "insertar movimientos tesoreria" on public.movimientos_tesoreria;
drop policy if exists "editar movimientos tesoreria" on public.movimientos_tesoreria;
drop policy if exists "borrar movimientos tesoreria" on public.movimientos_tesoreria;
revoke insert, update, delete, truncate on public.movimientos_tesoreria from public, anon, authenticated;

-- 2a. Registrar (acciones rápidas de Tesorería). p_monto: para 'ajuste' con signo
--     (− falta, + sobra); para el resto, mayor a cero. p_comision solo en depósitos.
create or replace function public.registrar_movimiento_tesoreria(
  p_tipo public.tipo_mov_tesoreria,
  p_moneda public.moneda,
  p_cuenta public.cuenta_tesoreria,
  p_monto numeric,
  p_fecha date,
  p_descripcion text default null,
  p_comision numeric default null,
  p_ref uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
  v_monto numeric := round(coalesce(p_monto, 0), 2);
  v_comision numeric := round(coalesce(p_comision, 0), 2);
  v_desc text := nullif(trim(coalesce(p_descripcion, '')), '');
  v_cuenta public.cuenta_tesoreria := p_cuenta;
  v_destino public.cuenta_tesoreria;
  v_grupo uuid;
  v_id uuid;
  v_existente public.movimientos_tesoreria;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('tesoreria','lider') then
    raise exception 'Solo Tesorería y el Líder de Procesos registran movimientos';
  end if;

  -- §4.0-5: candado de idempotencia primero; el mismo pedido devuelve lo ya registrado.
  if p_ref is not null then
    perform pg_advisory_xact_lock(hashtextextended('registrar_movimiento_tesoreria:' || p_ref::text, 0));
    select * into v_existente from public.movimientos_tesoreria where org_id = v_org and ref = p_ref;
    if found then
      return jsonb_build_object('id', v_existente.id, 'repetido', true,
        'filas', 1 + (select count(*) from public.movimientos_tesoreria m
                      where m.org_id = v_org and m.grupo_id = v_existente.grupo_id
                        and v_existente.grupo_id is not null and m.id <> v_existente.id));
    end if;
  end if;

  if p_tipo is null then raise exception 'Elegí qué pasó'; end if;
  if p_moneda is null then raise exception 'Elegí pesos o dólares'; end if;
  if p_fecha is null then raise exception 'Elegí la fecha del movimiento'; end if;
  if p_fecha > v_hoy then raise exception 'La fecha no puede ser futura'; end if;
  if p_tipo = 'ajuste' then
    if v_monto = 0 then raise exception 'Poné el monto del ajuste'; end if;
  elsif v_monto <= 0 then
    raise exception 'El monto tiene que ser mayor a cero';
  end if;
  if v_desc is not null and char_length(v_desc) > 200 then
    raise exception 'La descripción es muy larga (máximo 200 letras)';
  end if;
  if v_comision < 0 then raise exception 'La comisión no puede ser negativa'; end if;
  if v_comision > 0 and p_tipo <> 'deposito' then
    raise exception 'Solo los depósitos llevan comisión: cargala aparte como "Comisión o impuesto"';
  end if;
  if v_comision > 0 and v_comision >= v_monto then
    raise exception 'La comisión no puede ser mayor que el depósito';
  end if;

  -- Depósito: efectivo → banco. Extracción: banco → efectivo (check mov_tes_cuentas).
  if p_tipo = 'deposito' then
    v_cuenta := 'efectivo'; v_destino := 'banco';
  elsif p_tipo = 'extraccion' then
    v_cuenta := 'banco'; v_destino := 'efectivo';
  elsif v_cuenta is null then
    raise exception 'Elegí efectivo o banco';
  end if;
  if v_comision > 0 then v_grupo := gen_random_uuid(); end if;

  begin
    insert into public.movimientos_tesoreria
      (org_id, fecha, tipo, descripcion, monto, moneda, cuenta, cuenta_destino, grupo_id, ref, creado_por)
    values
      (v_org, p_fecha, p_tipo, v_desc, v_monto, p_moneda, v_cuenta, v_destino, v_grupo, p_ref, (select auth.uid()))
    returning id into v_id;
  exception when unique_violation then
    select * into v_existente from public.movimientos_tesoreria where org_id = v_org and ref = p_ref;
    return jsonb_build_object('id', v_existente.id, 'repetido', true, 'filas', 1);
  end;

  if v_comision > 0 then
    insert into public.movimientos_tesoreria
      (org_id, fecha, tipo, descripcion, monto, moneda, cuenta, cuenta_destino, grupo_id, creado_por)
    values
      (v_org, p_fecha, 'comision', 'Comisión por el depósito', v_comision, p_moneda, 'banco', null, v_grupo, (select auth.uid()));
  end if;

  return jsonb_build_object('id', v_id, 'repetido', false, 'filas', case when v_comision > 0 then 2 else 1 end);
end $$;
revoke all on function public.registrar_movimiento_tesoreria(public.tipo_mov_tesoreria, public.moneda, public.cuenta_tesoreria, numeric, date, text, numeric, uuid) from public, anon;
grant execute on function public.registrar_movimiento_tesoreria(public.tipo_mov_tesoreria, public.moneda, public.cuenta_tesoreria, numeric, date, text, numeric, uuid) to authenticated;

-- 2b. Anular con motivo. La comisión de un depósito se anula sola (el depósito queda);
--     el depósito se lleva su comisión. Los ajustes de caja se borran desde la caja.
create or replace function public.anular_movimiento_tesoreria(p_id uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
  v_mov public.movimientos_tesoreria;
  v_cheque text;
  v_comision numeric := 0;
  v_n integer := 1;
  v_label text;
  v_cuenta text;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('tesoreria','lider') then
    raise exception 'Solo Tesorería y el Líder de Procesos anulan movimientos';
  end if;
  if v_motivo is null then raise exception 'Contá por qué lo anulás'; end if;
  if char_length(v_motivo) > 300 then raise exception 'El motivo es muy largo (máximo 300 letras)'; end if;

  select * into v_mov from public.movimientos_tesoreria where id = p_id and org_id = v_org for update;
  if not found then raise exception 'No encontramos el movimiento. Actualizá la página.'; end if;
  if v_mov.caja_id is not null then
    raise exception 'Es un ajuste de caja: se borra desde la caja de ese día, con motivo.';
  end if;
  if v_mov.anulado_en is not null then
    -- Reintento del mismo pedido (corte de red): ya quedó anulado por esta persona.
    if v_mov.anulado_por = (select auth.uid()) and v_mov.anulado_en > now() - interval '15 minutes' then
      return jsonb_build_object('anulados', 0, 'comision', null, 'repetido', true);
    end if;
    raise exception 'Ese movimiento ya estaba anulado. Actualizá la página.';
  end if;
  -- El vuelto de un cheque entregado se deshace con el cheque. Si el cheque rebotó, el
  -- vuelto queda como un ingreso común (rechazar_cheque lo suelta y anota la devolución).
  select c.numero into v_cheque from public.cheques c
  where c.org_id = v_org and c.vuelto_movimiento_id = p_id and c.estado <> 'rechazado';
  if v_cheque is not null then
    raise exception 'Es el vuelto del cheque N° %: se deshace desde Cheques', v_cheque;
  end if;

  update public.movimientos_tesoreria set
    anulado_en = now(), anulado_por = (select auth.uid()), motivo_anulacion = v_motivo
  where id = p_id;

  if v_mov.tipo = 'deposito' and v_mov.grupo_id is not null then
    with anuladas as (
      update public.movimientos_tesoreria set
        anulado_en = now(), anulado_por = (select auth.uid()),
        motivo_anulacion = 'Se anuló el depósito: ' || v_motivo
      where org_id = v_org and grupo_id = v_mov.grupo_id and id <> p_id
        and tipo = 'comision' and anulado_en is null and caja_id is null
      returning monto
    )
    select coalesce(sum(monto), 0), count(*) + 1 into v_comision, v_n from anuladas;
  end if;

  v_label := case v_mov.tipo
    when 'deposito' then 'Depósito' when 'extraccion' then 'Extracción' when 'comision' then 'Comisión'
    when 'impuesto' then 'Impuesto' when 'debito_fiscal' then 'IVA (débito fiscal)' when 'ajuste' then 'Ajuste'
    when 'ingreso' then 'Ingreso' else 'Egreso' end;
  v_cuenta := case
    when v_mov.cuenta_destino is not null then
      (case v_mov.cuenta when 'efectivo' then 'Efectivo' else 'Banco' end) || ' → ' ||
      (case v_mov.cuenta_destino when 'efectivo' then 'Efectivo' else 'Banco' end)
    else (case v_mov.cuenta when 'efectivo' then 'Efectivo' else 'Banco' end) end;

  insert into public.tesoreria_eventos (org_id, tipo, detalle, motivo, monto, moneda, movimiento_id, valor_anterior)
  values (v_org, 'movimiento_anulado',
    v_label || ' del ' || to_char(v_mov.fecha, 'DD/MM') || ' · ' || v_cuenta
      || coalesce(' · ' || nullif(trim(v_mov.descripcion), ''), '')
      || case when v_comision > 0 then ' (y su comisión de ' || private.tesoreria_monto(v_comision, v_mov.moneda) || ')' else '' end,
    v_motivo, abs(v_mov.monto), v_mov.moneda, v_mov.id,
    jsonb_build_object('tipo', v_mov.tipo, 'monto', v_mov.monto, 'fecha', v_mov.fecha, 'cuenta', v_mov.cuenta,
                       'creado_por', v_mov.creado_por, 'comision', nullif(v_comision, 0)));

  return jsonb_build_object('anulados', v_n, 'comision', nullif(v_comision, 0), 'repetido', false);
end $$;
revoke all on function public.anular_movimiento_tesoreria(uuid, text) from public, anon;
grant execute on function public.anular_movimiento_tesoreria(uuid, text) to authenticated;


-- ------------------------------------------------------------
-- 3. flujo_caja (misma firma y forma que 0018): no cuenta los movimientos anulados
-- ------------------------------------------------------------
create or replace function public.flujo_caja()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
  v_ini_ef numeric; v_ini_bco numeric; v_ini_ef_usd numeric; v_ini_bco_usd numeric;
  d_ef date; d_bco date; d_ef_usd date; d_bco_usd date;
  v_ef numeric; v_bco numeric; v_ef_usd numeric; v_bco_usd numeric;
  m_ef numeric; m_bco numeric; m_ef_usd numeric; m_bco_usd numeric;
  v_ef_cajas numeric;
  v_cart numeric; v_listos numeric; v_dep numeric;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('tesoreria','lider','consejo') then
    raise exception 'Solo Tesorería y el Líder de Procesos ven el flujo de fondos';
  end if;

  select
    coalesce(sum(s.monto) filter (where s.medio = 'efectivo' and s.moneda = 'ARS'), 0),
    max(s.fecha)          filter (where s.medio = 'efectivo' and s.moneda = 'ARS'),
    coalesce(sum(s.monto) filter (where s.medio = 'transferencia' and s.moneda = 'ARS'), 0),
    max(s.fecha)          filter (where s.medio = 'transferencia' and s.moneda = 'ARS'),
    coalesce(sum(s.monto) filter (where s.medio = 'efectivo' and s.moneda = 'USD'), 0),
    max(s.fecha)          filter (where s.medio = 'efectivo' and s.moneda = 'USD'),
    coalesce(sum(s.monto) filter (where s.medio = 'transferencia' and s.moneda = 'USD'), 0),
    max(s.fecha)          filter (where s.medio = 'transferencia' and s.moneda = 'USD')
  into v_ini_ef, d_ef, v_ini_bco, d_bco, v_ini_ef_usd, d_ef_usd, v_ini_bco_usd, d_bco_usd
  from public.saldos_iniciales s
  where s.org_id = v_org;

  -- Pesos · efectivo
  v_ef := v_ini_ef
    + coalesce((select sum(p.monto) from public.pagos p
        where p.org_id = v_org and not p.anulado and p.medio = 'efectivo'
          and (d_ef is null or (p.fecha at time zone 'America/Argentina/Cordoba')::date >= d_ef)), 0)
    + coalesce((select sum(cc.monto) from public.canon_camiones cc
        where cc.org_id = v_org and not cc.anulado and cc.medio = 'efectivo'
          and (d_ef is null or cc.fecha >= d_ef)), 0)
    - coalesce((select sum(g.monto) from public.gastos g
        where g.org_id = v_org and g.estado = 'pagado' and g.medio_pago = 'efectivo'
          and (d_ef is null or g.fecha_pago >= d_ef)), 0);

  -- Pesos · banco
  v_bco := v_ini_bco
    + coalesce((select sum(p.monto) from public.pagos p
        where p.org_id = v_org and not p.anulado and p.medio = 'transferencia'
          and (d_bco is null or (p.fecha at time zone 'America/Argentina/Cordoba')::date >= d_bco)), 0)
    + coalesce((select sum(cc.monto) from public.canon_camiones cc
        where cc.org_id = v_org and not cc.anulado and cc.medio = 'transferencia'
          and (d_bco is null or cc.fecha >= d_bco)), 0)
    + coalesce((select sum(ch.monto) from public.cheques ch
        where ch.org_id = v_org and ch.estado = 'acreditado'
          and (d_bco is null or coalesce(ch.fecha_acreditado, ch.fecha_cobro) >= d_bco)), 0)
    - coalesce((select sum(g.monto) from public.gastos g
        where g.org_id = v_org and g.estado = 'pagado' and g.medio_pago = 'transferencia'
          and (d_bco is null or g.fecha_pago >= d_bco)), 0);

  -- Movimientos vigentes (los anulados no cuentan): ajuste (con su signo) e ingreso suman
  -- en su cuenta; impuesto, débito fiscal, comisión y egreso restan; depósito/extracción
  -- restan de la cuenta y suman en la cuenta destino. Incluye los ajustes de caja (J3).
  with efectos as (
    select m.moneda, m.cuenta, m.fecha,
           case when m.tipo in ('ajuste','ingreso') then m.monto else -m.monto end as efecto
    from public.movimientos_tesoreria m
    where m.org_id = v_org and m.anulado_en is null
    union all
    select m.moneda, m.cuenta_destino, m.fecha, m.monto
    from public.movimientos_tesoreria m
    where m.org_id = v_org and m.anulado_en is null
      and m.tipo in ('deposito','extraccion') and m.cuenta_destino is not null
  )
  select
    coalesce(sum(e.efecto) filter (where e.moneda = 'ARS' and e.cuenta = 'efectivo' and (d_ef is null or e.fecha >= d_ef)), 0),
    coalesce(sum(e.efecto) filter (where e.moneda = 'ARS' and e.cuenta = 'banco' and (d_bco is null or e.fecha >= d_bco)), 0),
    coalesce(sum(e.efecto) filter (where e.moneda = 'USD' and e.cuenta = 'efectivo' and (d_ef_usd is null or e.fecha >= d_ef_usd)), 0),
    coalesce(sum(e.efecto) filter (where e.moneda = 'USD' and e.cuenta = 'banco' and (d_bco_usd is null or e.fecha >= d_bco_usd)), 0)
  into m_ef, m_bco, m_ef_usd, m_bco_usd
  from efectos e;

  v_ef := v_ef + m_ef;
  v_bco := v_bco + m_bco;
  v_ef_usd := v_ini_ef_usd + m_ef_usd;
  v_bco_usd := v_ini_bco_usd + m_bco_usd;

  -- Parte del efectivo que sigue en cajas sin validar (administración y portería
  -- sin integrar; una caja de portería integrada se valida junto con su destino).
  v_ef_cajas :=
      coalesce((select sum(p.monto) from public.pagos p join public.cajas c on c.id = p.caja_id
        where p.org_id = v_org and not p.anulado and p.medio = 'efectivo' and c.estado <> 'validada'
          and (d_ef is null or (p.fecha at time zone 'America/Argentina/Cordoba')::date >= d_ef)), 0)
    + coalesce((select sum(cc.monto) from public.canon_camiones cc join public.cajas c on c.id = cc.caja_id
        where cc.org_id = v_org and not cc.anulado and cc.medio = 'efectivo' and c.estado <> 'validada'
          and (d_ef is null or cc.fecha >= d_ef)), 0)
    - coalesce((select sum(g.monto) from public.gastos g join public.cajas c on c.id = g.caja_id
        where g.org_id = v_org and g.estado = 'pagado' and g.medio_pago = 'efectivo' and c.estado <> 'validada'
          and (d_ef is null or g.fecha_pago >= d_ef)), 0)
    + coalesce((select sum(m.monto) from public.movimientos_tesoreria m join public.cajas c on c.id = m.caja_id
        where m.org_id = v_org and m.tipo = 'ajuste' and m.cuenta = 'efectivo' and m.moneda = 'ARS'
          and m.anulado_en is null and c.estado <> 'validada' and (d_ef is null or m.fecha >= d_ef)), 0);

  -- Cheques: los entregados a proveedores y los rechazados no cuentan.
  select
    coalesce(sum(ch.monto) filter (where ch.estado = 'en_cartera'), 0),
    coalesce(sum(ch.monto) filter (where ch.estado = 'en_cartera' and ch.fecha_cobro <= v_hoy), 0),
    coalesce(sum(ch.monto) filter (where ch.estado = 'depositado'), 0)
  into v_cart, v_listos, v_dep
  from public.cheques ch
  where ch.org_id = v_org;

  return jsonb_build_object(
    'pesos',   jsonb_build_object('efectivo', v_ef, 'efectivo_en_cajas', v_ef_cajas,
                                  'banco', v_bco, 'total', v_ef + v_bco),
    'dolares', jsonb_build_object('efectivo', v_ef_usd, 'banco', v_bco_usd, 'total', v_ef_usd + v_bco_usd),
    'cheques', jsonb_build_object('por_cobrar', v_cart, 'listos', v_listos,
                                  'depositados', v_dep, 'total', v_cart + v_dep),
    'total_pesos', v_ef + v_bco + v_cart + v_dep,
    -- compatibilidad con la forma de fase 2 (todo en pesos)
    'efectivo', v_ef,
    'banco', v_bco,
    'cheques_en_cartera', v_cart + v_dep,
    'total', v_ef + v_bco + v_cart + v_dep
  );
end $$;
revoke all on function public.flujo_caja() from public, anon;
grant execute on function public.flujo_caja() to authenticated;


-- ------------------------------------------------------------
-- 4. Saldos iniciales: corregir pide motivo y deja el valor anterior → nuevo
-- ------------------------------------------------------------
drop policy if exists "insertar saldos iniciales" on public.saldos_iniciales;
drop policy if exists "editar saldos iniciales" on public.saldos_iniciales;
drop policy if exists "borrar saldos iniciales" on public.saldos_iniciales;
-- (tenía INSERT/UPDATE/DELETE y hasta TRUNCATE, que no pasa por RLS)
revoke all on public.saldos_iniciales from public, anon, authenticated;
grant select on public.saldos_iniciales to authenticated;

create or replace function public.guardar_saldo_inicial(
  p_medio public.medio_pago,
  p_moneda public.moneda,
  p_monto numeric,
  p_fecha date,
  p_notas text default null,
  p_motivo text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
  v_monto numeric := round(p_monto, 2);
  v_notas text := nullif(trim(coalesce(p_notas, '')), '');
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
  v_actual public.saldos_iniciales;
  v_id uuid;
  v_cuenta text;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('tesoreria','lider') then
    raise exception 'Solo Tesorería y el Líder de Procesos cargan los saldos iniciales';
  end if;
  if p_medio is null or p_medio not in ('efectivo','transferencia') then
    raise exception 'Elegí efectivo o banco';
  end if;
  if p_moneda is null then raise exception 'Elegí pesos o dólares'; end if;
  if v_monto is null then raise exception 'Poné el monto que había'; end if;
  if v_monto < 0 then raise exception 'El monto no puede ser negativo'; end if;
  if p_fecha is null then raise exception 'Elegí desde qué día'; end if;
  if p_fecha > v_hoy then raise exception 'La fecha no puede ser futura'; end if;
  if v_notas is not null and char_length(v_notas) > 300 then
    raise exception 'La nota es muy larga (máximo 300 letras)';
  end if;
  if v_motivo is not null and char_length(v_motivo) > 300 then
    raise exception 'El motivo es muy largo (máximo 300 letras)';
  end if;

  v_cuenta := case when p_moneda = 'USD' then 'Dólares' else 'Pesos' end
    || case when p_medio = 'efectivo' then ' en efectivo' else ' en el banco' end;

  select * into v_actual from public.saldos_iniciales
  where org_id = v_org and medio = p_medio and moneda = p_moneda
  for update;

  if not found then
    insert into public.saldos_iniciales (org_id, medio, moneda, monto, fecha, notas)
    values (v_org, p_medio, p_moneda, v_monto, p_fecha, v_notas)
    on conflict (org_id, medio, moneda) do nothing
    returning id into v_id;
    if v_id is null then
      raise exception 'Alguien acaba de cargar ese saldo. Actualizá la página.';
    end if;
    insert into public.tesoreria_eventos (org_id, tipo, detalle, monto, moneda, valor_nuevo)
    values (v_org, 'saldo_inicial_cargado',
      v_cuenta || ': ' || private.tesoreria_monto(v_monto, p_moneda) || ' al comenzar el ' || to_char(p_fecha, 'DD/MM/YYYY'),
      v_monto, p_moneda, jsonb_build_object('medio', p_medio, 'monto', v_monto, 'fecha', p_fecha));
    return jsonb_build_object('cargado', true, 'corregido', false);
  end if;

  if v_actual.monto = v_monto and v_actual.fecha = p_fecha then
    -- Solo la nota (o nada): no cambia la plata, no pide motivo.
    update public.saldos_iniciales set notas = v_notas where id = v_actual.id;
    return jsonb_build_object('cargado', false, 'corregido', false);
  end if;

  if v_motivo is null then
    raise exception 'Contá por qué corregís el saldo inicial';
  end if;

  update public.saldos_iniciales set monto = v_monto, fecha = p_fecha, notas = v_notas
  where id = v_actual.id;

  insert into public.tesoreria_eventos (org_id, tipo, detalle, motivo, monto, moneda, valor_anterior, valor_nuevo)
  values (v_org, 'saldo_inicial_corregido',
    v_cuenta || ': de ' || private.tesoreria_monto(v_actual.monto, p_moneda)
      || case when v_actual.fecha <> p_fecha then ' (' || to_char(v_actual.fecha, 'DD/MM') || ')' else '' end
      || ' a ' || private.tesoreria_monto(v_monto, p_moneda)
      || case when v_actual.fecha <> p_fecha then ' (' || to_char(p_fecha, 'DD/MM') || ')' else '' end,
    v_motivo, v_monto, p_moneda,
    jsonb_build_object('medio', p_medio, 'monto', v_actual.monto, 'fecha', v_actual.fecha),
    jsonb_build_object('medio', p_medio, 'monto', v_monto, 'fecha', p_fecha));
  return jsonb_build_object('cargado', false, 'corregido', true);
end $$;
revoke all on function public.guardar_saldo_inicial(public.medio_pago, public.moneda, numeric, date, text, text) from public, anon;
grant execute on function public.guardar_saldo_inicial(public.medio_pago, public.moneda, numeric, date, text, text) to authenticated;


-- ------------------------------------------------------------
-- 5. Cheques: pagar un gasto de otro monto y deshacer sin rechazar
-- ------------------------------------------------------------
alter table public.cheques add column if not exists gasto_diferencia text;
alter table public.cheques add column if not exists vuelto_movimiento_id uuid
  references public.movimientos_tesoreria(id) on delete set null;
alter table public.cheques drop constraint if exists cheques_gasto_diferencia_check;
alter table public.cheques add constraint cheques_gasto_diferencia_check
  check (gasto_diferencia is null or gasto_diferencia in ('dividido', 'vuelto_efectivo', 'a_favor'));
create index if not exists cheques_vuelto_idx on public.cheques (vuelto_movimiento_id) where vuelto_movimiento_id is not null;

-- 5a. Trigger: el "deshacer depósito" ya no es un update directo (pasa por la RPC, con rastro).
create or replace function private.tg_proteger_cheque()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if new.estado is not distinct from old.estado then
    -- Mismo estado: solo las notas. Las fechas se corrigen deshaciendo el paso.
    if new.fecha_depositado is distinct from old.fecha_depositado
       or new.fecha_acreditado is distinct from old.fecha_acreditado then
      raise exception 'Eso se hace desde Cheques con su botón';
    end if;
    return new;
  end if;

  if old.estado = 'en_cartera' and new.estado = 'depositado' then
    if new.fecha_depositado is null then
      raise exception 'Poné la fecha en que lo depositaste';
    end if;
    if new.fecha_depositado < old.fecha_cobro then
      raise exception 'Este cheque se puede depositar desde el %', to_char(old.fecha_cobro, 'DD/MM');
    end if;
    if new.fecha_depositado > (now() at time zone 'America/Argentina/Cordoba')::date then
      raise exception 'La fecha del depósito no puede ser futura';
    end if;
    new.fecha_acreditado := null;
    return new;
  end if;

  if old.estado = 'depositado' and new.estado = 'acreditado' then
    if new.fecha_acreditado is null then
      raise exception 'Poné la fecha en que se acreditó';
    end if;
    if old.fecha_depositado is not null and new.fecha_acreditado < old.fecha_depositado then
      raise exception 'No se puede acreditar antes del depósito (%)', to_char(old.fecha_depositado, 'DD/MM');
    end if;
    if new.fecha_acreditado > (now() at time zone 'America/Argentina/Cordoba')::date then
      raise exception 'La fecha de acreditación no puede ser futura';
    end if;
    new.fecha_depositado := old.fecha_depositado;
    return new;
  end if;

  raise exception 'Eso se hace desde Cheques con su botón';
end $$;
revoke all on function private.tg_proteger_cheque() from public, anon, authenticated;

-- 5b. Deja un gasto pendiente "pagado con cheque", resolviendo la diferencia de montos.
--     Lo llaman entregar_cheque y vincular_cheque_gasto con el cheque ya bloqueado.
create or replace function private.pagar_gasto_con_cheque(
  p_cheque public.cheques,
  p_gasto uuid,
  p_fecha date,
  p_proveedor text,
  p_diferencia text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gasto public.gastos;
  v_etiqueta text;
  v_dif numeric;
  v_resto uuid;
  v_mov uuid;
  v_modo text;
begin
  select * into v_gasto from public.gastos where id = p_gasto and org_id = p_cheque.org_id for update;
  if not found or v_gasto.estado <> 'pendiente' then
    raise exception 'Ese gasto ya no está pendiente';
  end if;
  select coalesce(nullif(trim(v_gasto.descripcion), ''), r.nombre) into v_etiqueta
  from public.rubros_gasto r where r.id = v_gasto.rubro_id;
  v_etiqueta := coalesce(v_etiqueta, 'Gasto');
  v_dif := round(p_cheque.monto - v_gasto.monto, 2);

  if v_dif < 0 then
    if p_diferencia is distinct from 'dividir' then
      raise exception 'El cheque es de % y el gasto de %: dividí el gasto (quedan % por pagar) o elegí otro',
        private.tesoreria_monto(p_cheque.monto), private.tesoreria_monto(v_gasto.monto), private.tesoreria_monto(-v_dif);
    end if;
    -- El gasto baja al monto del cheque y el resto queda como otro gasto pendiente
    -- (variable: no se "trae" al mes siguiente como un fijo).
    update public.gastos set monto = p_cheque.monto where id = v_gasto.id;
    insert into public.gastos (org_id, rubro_id, tipo, descripcion, monto, vencimiento, periodo, creado_por)
    values (v_gasto.org_id, v_gasto.rubro_id, 'variable',
            left('Resto de ' || v_etiqueta || ' (cheque N° ' || p_cheque.numero || ')', 200),
            -v_dif, v_gasto.vencimiento, v_gasto.periodo, (select auth.uid()))
    returning id into v_resto;
    v_modo := 'dividido';
    insert into public.tesoreria_eventos (org_id, tipo, detalle, monto, cheque_id, gasto_id, valor_anterior, valor_nuevo)
    values (v_gasto.org_id, 'gasto_dividido',
      v_etiqueta || ': ' || private.tesoreria_monto(p_cheque.monto) || ' con el cheque N° ' || p_cheque.numero
        || ' y quedan ' || private.tesoreria_monto(-v_dif) || ' por pagar',
      v_gasto.monto, p_cheque.id, v_gasto.id,
      jsonb_build_object('monto', v_gasto.monto),
      jsonb_build_object('monto', p_cheque.monto, 'resto', -v_dif, 'resto_gasto_id', v_resto));
  elsif v_dif > 0 then
    if p_diferencia = 'vuelto_efectivo' then
      insert into public.movimientos_tesoreria (org_id, fecha, tipo, descripcion, monto, moneda, cuenta, creado_por)
      values (p_cheque.org_id, p_fecha, 'ingreso',
              left('Vuelto del cheque N° ' || p_cheque.numero || coalesce(' (' || p_proveedor || ')', ''), 200),
              v_dif, 'ARS', 'efectivo', (select auth.uid()))
      returning id into v_mov;
      v_modo := 'vuelto_efectivo';
    elsif p_diferencia = 'a_favor' then
      v_modo := 'a_favor';
    else
      raise exception 'El cheque es de % y el gasto de %: decí qué pasó con los % de diferencia',
        private.tesoreria_monto(p_cheque.monto), private.tesoreria_monto(v_gasto.monto), private.tesoreria_monto(v_dif);
    end if;
  end if;

  update public.gastos set
    estado = 'pagado',
    fecha_pago = p_fecha,
    medio_pago = 'cheque',
    pagado_desde = 'cheque',
    caja_id = null,
    pagado_por = (select auth.uid()),
    pagado_en = now()
  where id = v_gasto.id;

  return jsonb_build_object('diferencia', v_modo, 'vuelto_movimiento_id', v_mov,
    'resto_gasto_id', v_resto, 'resto', case when v_dif < 0 then -v_dif end,
    'sobrante', case when v_dif > 0 then v_dif end, 'etiqueta', v_etiqueta);
end $$;
revoke all on function private.pagar_gasto_con_cheque(public.cheques, uuid, date, text, text) from public, anon, authenticated;

-- 5c. Vuelve a "Por pagar" el gasto que pagaba el cheque y anula el vuelto (si hubo; quien
--     no quiera anularlo, como rechazar_cheque, pasa el cheque con vuelto_movimiento_id null).
--     Si el cheque había dividido el gasto, lo junta de nuevo: el gasto recupera el monto del
--     "Resto" y el Resto se anula, solo si sigue pendiente (si ya se pagó, queda todo igual).
--     Devuelve {etiqueta (null si el gasto no volvió a Por pagar), reunido, resto_anulado}.
drop function if exists private.soltar_gasto_de_cheque(public.cheques, text);
create or replace function private.soltar_gasto_de_cheque(p_cheque public.cheques, p_rastro text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gasto public.gastos;
  v_etiqueta text;
  v_div public.tesoreria_eventos;
  v_resto public.gastos;
  v_monto numeric;
  v_resto_monto numeric;
begin
  if p_cheque.vuelto_movimiento_id is not null then
    update public.movimientos_tesoreria set
      anulado_en = now(), anulado_por = (select auth.uid()), motivo_anulacion = p_rastro
    where id = p_cheque.vuelto_movimiento_id and anulado_en is null;
  end if;
  if p_cheque.gasto_id is null then return jsonb_build_object('etiqueta', null); end if;

  select * into v_gasto from public.gastos where id = p_cheque.gasto_id and org_id = p_cheque.org_id for update;
  if not found or v_gasto.estado <> 'pagado' or v_gasto.pagado_desde is distinct from 'cheque' then
    return jsonb_build_object('etiqueta', null);
  end if;
  select coalesce(nullif(trim(v_gasto.descripcion), ''), r.nombre) into v_etiqueta
  from public.rubros_gasto r where r.id = v_gasto.rubro_id;
  v_etiqueta := coalesce(v_etiqueta, 'Gasto');
  v_monto := v_gasto.monto;

  if p_cheque.gasto_diferencia = 'dividido' then
    select * into v_div from public.tesoreria_eventos e
    where e.org_id = p_cheque.org_id and e.cheque_id = p_cheque.id and e.gasto_id = v_gasto.id
      and e.tipo = 'gasto_dividido'
    order by e.hecho_en desc
    limit 1;
    if found and v_div.valor_nuevo ? 'resto_gasto_id' then
      select * into v_resto from public.gastos
      where id = (v_div.valor_nuevo->>'resto_gasto_id')::uuid and org_id = p_cheque.org_id
      for update;
      if found and v_resto.estado = 'pendiente' then
        -- Se suma lo que tenga hoy el Resto (por si lo corrigieron) en vez del monto original.
        v_resto_monto := v_resto.monto;
        v_monto := round(v_gasto.monto + v_resto.monto, 2);
        update public.gastos set
          estado = 'anulado',
          notas = left(concat_ws(' · ', nullif(trim(notas), ''),
                                 'Anulado: se juntó de nuevo con ' || v_etiqueta || ' (' || p_rastro || ')'), 1000)
        where id = v_resto.id;
        insert into public.tesoreria_eventos (org_id, tipo, detalle, motivo, monto, cheque_id, gasto_id, valor_anterior, valor_nuevo)
        values (p_cheque.org_id, 'gasto_reunido',
          v_etiqueta || ': vuelve a ' || private.tesoreria_monto(v_monto) || ' y se anula «'
            || coalesce(nullif(trim(v_resto.descripcion), ''), 'el resto') || '» ('
            || private.tesoreria_monto(v_resto_monto) || ')',
          p_rastro, v_monto, p_cheque.id, v_gasto.id,
          jsonb_build_object('monto', v_gasto.monto, 'resto', v_resto_monto, 'resto_gasto_id', v_resto.id),
          jsonb_build_object('monto', v_monto));
      end if;
    end if;
  end if;

  update public.gastos set
    estado = 'pendiente',
    monto = v_monto,
    fecha_pago = null,
    medio_pago = null,
    pagado_desde = null,
    caja_id = null,
    pagado_por = null,
    pagado_en = null,
    comprobante_validado = false,
    validado_por = null,
    validado_en = null,
    pago_revertido_por = (select auth.uid()),
    pago_revertido_en = now(),
    pago_revertido_motivo = left(p_rastro, 500)
  where id = v_gasto.id;

  return jsonb_build_object('etiqueta', v_etiqueta,
    'reunido', case when v_resto_monto is not null then v_monto end,
    'resto_anulado', v_resto_monto);
end $$;
revoke all on function private.soltar_gasto_de_cheque(public.cheques, text) from public, anon, authenticated;

-- 5d. entregar_cheque: + p_diferencia; reintento idéntico → "repetido"; devuelve jsonb.
drop function if exists public.entregar_cheque(uuid, text, date, uuid);
create or replace function public.entregar_cheque(
  p_cheque uuid,
  p_proveedor text,
  p_fecha date default null,
  p_gasto uuid default null,
  p_diferencia text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
  v_fecha date := coalesce(p_fecha, private.hoy_ar());
  v_proveedor text := nullif(trim(coalesce(p_proveedor, '')), '');
  v_cheque public.cheques;
  v_pago jsonb := '{}'::jsonb;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('tesoreria','lider') then
    raise exception 'Solo Tesorería entrega cheques';
  end if;
  if v_proveedor is null then
    raise exception 'Poné a qué proveedor se lo entregaste';
  end if;
  if char_length(v_proveedor) > 120 then
    raise exception 'El nombre del proveedor es muy largo (máximo 120 letras)';
  end if;
  if v_fecha > v_hoy then
    raise exception 'La fecha de entrega no puede ser futura';
  end if;
  if p_diferencia is not null and p_diferencia not in ('dividir','vuelto_efectivo','a_favor') then
    raise exception 'Elegí qué pasó con la diferencia';
  end if;

  select * into v_cheque from public.cheques where id = p_cheque and org_id = v_org for update;
  if not found then raise exception 'Ese cheque no existe. Actualizá la página.'; end if;
  if v_cheque.estado = 'entregado' and v_cheque.proveedor = v_proveedor
     and v_cheque.gasto_id is not distinct from p_gasto and v_cheque.fecha_entregado = v_fecha
     and v_cheque.entregado_por = (select auth.uid()) then
    -- Reintento del mismo pedido (corte de red): ya quedó entregado.
    return jsonb_build_object('repetido', true, 'diferencia', v_cheque.gasto_diferencia);
  end if;
  if v_cheque.estado <> 'en_cartera' then
    raise exception 'Solo se entregan cheques que están por cobrar';
  end if;
  if v_fecha < v_cheque.fecha_recibido then
    raise exception 'No se puede entregar antes de recibirlo (llegó el %)', to_char(v_cheque.fecha_recibido, 'DD/MM');
  end if;

  if p_gasto is not null then
    v_pago := private.pagar_gasto_con_cheque(v_cheque, p_gasto, v_fecha, v_proveedor, p_diferencia);
  end if;

  update public.cheques set
    estado = 'entregado',
    proveedor = v_proveedor,
    fecha_entregado = v_fecha,
    entregado_por = (select auth.uid()),
    gasto_id = p_gasto,
    gasto_diferencia = v_pago->>'diferencia',
    vuelto_movimiento_id = (v_pago->>'vuelto_movimiento_id')::uuid
  where id = p_cheque;

  return v_pago || jsonb_build_object('repetido', false);
end $$;
revoke all on function public.entregar_cheque(uuid, text, date, uuid, text) from public, anon;
grant execute on function public.entregar_cheque(uuid, text, date, uuid, text) to authenticated;

-- 5e. vincular_cheque_gasto: + p_diferencia; reintento idéntico → "repetido"; devuelve jsonb.
drop function if exists public.vincular_cheque_gasto(uuid, uuid);
create or replace function public.vincular_cheque_gasto(
  p_cheque uuid,
  p_gasto uuid,
  p_diferencia text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_cheque public.cheques;
  v_pago jsonb;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('tesoreria','lider') then
    raise exception 'Solo Tesorería vincula cheques con gastos';
  end if;
  if p_diferencia is not null and p_diferencia not in ('dividir','vuelto_efectivo','a_favor') then
    raise exception 'Elegí qué pasó con la diferencia';
  end if;

  select * into v_cheque from public.cheques where id = p_cheque and org_id = v_org for update;
  if found and v_cheque.estado = 'entregado' and v_cheque.gasto_id = p_gasto then
    return jsonb_build_object('repetido', true, 'diferencia', v_cheque.gasto_diferencia);
  end if;
  if not found or v_cheque.estado <> 'entregado' or v_cheque.gasto_id is not null then
    raise exception 'Ese cheque ya está vinculado o no fue entregado a un proveedor';
  end if;

  v_pago := private.pagar_gasto_con_cheque(v_cheque, p_gasto,
    coalesce(v_cheque.fecha_entregado, private.hoy_ar()), v_cheque.proveedor, p_diferencia);

  update public.cheques set
    gasto_id = p_gasto,
    gasto_diferencia = v_pago->>'diferencia',
    vuelto_movimiento_id = (v_pago->>'vuelto_movimiento_id')::uuid
  where id = p_cheque;

  return v_pago || jsonb_build_object('repetido', false);
end $$;
revoke all on function public.vincular_cheque_gasto(uuid, uuid, text) from public, anon;
grant execute on function public.vincular_cheque_gasto(uuid, uuid, text) to authenticated;

-- 5f. Entregado → por cobrar (el proveedor lo devolvió sano, o se marcó por error).
--     El cobro del cliente NO se toca (eso es "Rechazar", solo si rebotó).
create or replace function public.devolver_cheque_a_cartera(p_cheque uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
  v_cheque public.cheques;
  v_soltar jsonb;
  v_gasto text;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('tesoreria','lider') then
    raise exception 'Solo Tesorería devuelve cheques a la cartera';
  end if;
  if v_motivo is null then raise exception 'Contá por qué vuelve a la cartera'; end if;
  if char_length(v_motivo) > 300 then raise exception 'El motivo es muy largo (máximo 300 letras)'; end if;

  select * into v_cheque from public.cheques where id = p_cheque and org_id = v_org for update;
  if not found then raise exception 'Ese cheque no existe. Actualizá la página.'; end if;
  if v_cheque.estado = 'en_cartera' and exists (
      select 1 from public.tesoreria_eventos e
      where e.cheque_id = p_cheque and e.tipo = 'cheque_a_cartera'
        and e.hecho_por = (select auth.uid()) and e.hecho_en > now() - interval '15 minutes') then
    return jsonb_build_object('repetido', true, 'gasto', null);
  end if;
  if v_cheque.estado <> 'entregado' then
    raise exception 'Solo vuelven a la cartera los cheques entregados a un proveedor. Actualizá la página.';
  end if;

  v_soltar := private.soltar_gasto_de_cheque(v_cheque,
    'Cheque N° ' || v_cheque.numero || ' devuelto a la cartera: ' || v_motivo);
  v_gasto := v_soltar->>'etiqueta';

  update public.cheques set
    estado = 'en_cartera',
    proveedor = null,
    fecha_entregado = null,
    entregado_por = null,
    gasto_id = null,
    gasto_diferencia = null,
    vuelto_movimiento_id = null
  where id = p_cheque;

  insert into public.tesoreria_eventos (org_id, tipo, detalle, motivo, monto, cheque_id, gasto_id, valor_anterior)
  values (v_org, 'cheque_a_cartera',
    'Cheque N° ' || v_cheque.numero || ' · estaba entregado a ' || coalesce(v_cheque.proveedor, 'un proveedor')
      || coalesce(' · ' || v_gasto || ' vuelve a Por pagar', '')
      || case when v_soltar->>'reunido' is not null
              then ' por ' || private.tesoreria_monto((v_soltar->>'reunido')::numeric) || ' (se juntó con el resto)'
              else '' end,
    v_motivo, v_cheque.monto, v_cheque.id, v_cheque.gasto_id,
    jsonb_build_object('proveedor', v_cheque.proveedor, 'fecha_entregado', v_cheque.fecha_entregado,
                       'gasto_id', v_cheque.gasto_id, 'gasto_diferencia', v_cheque.gasto_diferencia));

  return jsonb_build_object('repetido', false, 'gasto', v_gasto,
    'vuelto_anulado', v_cheque.vuelto_movimiento_id is not null,
    'reunido', (v_soltar->>'reunido')::numeric);
end $$;
revoke all on function public.devolver_cheque_a_cartera(uuid, text) from public, anon;
grant execute on function public.devolver_cheque_a_cartera(uuid, text) to authenticated;

-- 5g. El gasto que pagó el cheque estaba mal: el cheque queda "entregado sin gasto" (para
--     elegir el correcto con "¿Qué gasto pagó?") y el gasto vuelve a Por pagar.
create or replace function public.desvincular_cheque_gasto(p_cheque uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
  v_cheque public.cheques;
  v_soltar jsonb;
  v_gasto text;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('tesoreria','lider') then
    raise exception 'Solo Tesorería vincula cheques con gastos';
  end if;
  if v_motivo is null then raise exception 'Contá por qué cambiás el gasto'; end if;
  if char_length(v_motivo) > 300 then raise exception 'El motivo es muy largo (máximo 300 letras)'; end if;

  select * into v_cheque from public.cheques where id = p_cheque and org_id = v_org for update;
  if not found then raise exception 'Ese cheque no existe. Actualizá la página.'; end if;
  if v_cheque.estado = 'entregado' and v_cheque.gasto_id is null and exists (
      select 1 from public.tesoreria_eventos e
      where e.cheque_id = p_cheque and e.tipo = 'cheque_desvinculado'
        and e.hecho_por = (select auth.uid()) and e.hecho_en > now() - interval '15 minutes') then
    return jsonb_build_object('repetido', true, 'gasto', null);
  end if;
  if v_cheque.estado <> 'entregado' or v_cheque.gasto_id is null then
    raise exception 'Ese cheque no tiene un gasto para cambiar. Actualizá la página.';
  end if;

  v_soltar := private.soltar_gasto_de_cheque(v_cheque,
    'Cheque N° ' || v_cheque.numero || ': se cambió el gasto que pagó: ' || v_motivo);
  v_gasto := v_soltar->>'etiqueta';

  update public.cheques set gasto_id = null, gasto_diferencia = null, vuelto_movimiento_id = null
  where id = p_cheque;

  insert into public.tesoreria_eventos (org_id, tipo, detalle, motivo, monto, cheque_id, gasto_id, valor_anterior)
  values (v_org, 'cheque_desvinculado',
    'Cheque N° ' || v_cheque.numero || ' a ' || coalesce(v_cheque.proveedor, 'un proveedor')
      || coalesce(' · ' || v_gasto || ' vuelve a Por pagar', '')
      || case when v_soltar->>'reunido' is not null
              then ' por ' || private.tesoreria_monto((v_soltar->>'reunido')::numeric) || ' (se juntó con el resto)'
              else '' end,
    v_motivo, v_cheque.monto, v_cheque.id, v_cheque.gasto_id,
    jsonb_build_object('gasto_id', v_cheque.gasto_id, 'gasto_diferencia', v_cheque.gasto_diferencia));

  return jsonb_build_object('repetido', false, 'gasto', v_gasto,
    'vuelto_anulado', v_cheque.vuelto_movimiento_id is not null,
    'reunido', (v_soltar->>'reunido')::numeric);
end $$;
revoke all on function public.desvincular_cheque_gasto(uuid, text) from public, anon;
grant execute on function public.desvincular_cheque_gasto(uuid, text) to authenticated;

-- 5h. Acreditado → depositado ("Se acreditó" tocado por error): el banco baja.
create or replace function public.deshacer_acreditacion_cheque(p_cheque uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
  v_cheque public.cheques;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('tesoreria','lider') then
    raise exception 'Solo Tesorería corrige cheques';
  end if;
  if v_motivo is null then raise exception 'Contá por qué lo deshacés'; end if;
  if char_length(v_motivo) > 300 then raise exception 'El motivo es muy largo (máximo 300 letras)'; end if;

  select * into v_cheque from public.cheques where id = p_cheque and org_id = v_org for update;
  if not found then raise exception 'Ese cheque no existe. Actualizá la página.'; end if;
  if v_cheque.estado = 'depositado' and exists (
      select 1 from public.tesoreria_eventos e
      where e.cheque_id = p_cheque and e.tipo = 'acreditacion_deshecha'
        and e.hecho_por = (select auth.uid()) and e.hecho_en > now() - interval '15 minutes') then
    return jsonb_build_object('repetido', true);
  end if;
  if v_cheque.estado <> 'acreditado' then
    raise exception 'Ese cheque ya no figura como acreditado. Actualizá la página.';
  end if;

  update public.cheques set estado = 'depositado', fecha_acreditado = null where id = p_cheque;

  insert into public.tesoreria_eventos (org_id, tipo, detalle, motivo, monto, cheque_id, valor_anterior)
  values (v_org, 'acreditacion_deshecha',
    'Cheque N° ' || v_cheque.numero || ' · se había acreditado el '
      || coalesce(to_char(v_cheque.fecha_acreditado, 'DD/MM'), '—') || ': vuelve a Depositados',
    v_motivo, v_cheque.monto, v_cheque.id,
    jsonb_build_object('fecha_acreditado', v_cheque.fecha_acreditado));
  return jsonb_build_object('repetido', false);
end $$;
revoke all on function public.deshacer_acreditacion_cheque(uuid, text) from public, anon;
grant execute on function public.deshacer_acreditacion_cheque(uuid, text) to authenticated;

-- 5i. Depositado → por cobrar (antes era un update directo, sin rastro).
create or replace function public.deshacer_deposito_cheque(p_cheque uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
  v_cheque public.cheques;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('tesoreria','lider') then
    raise exception 'Solo Tesorería corrige cheques';
  end if;
  if v_motivo is null then raise exception 'Contá por qué lo deshacés'; end if;
  if char_length(v_motivo) > 300 then raise exception 'El motivo es muy largo (máximo 300 letras)'; end if;

  select * into v_cheque from public.cheques where id = p_cheque and org_id = v_org for update;
  if not found then raise exception 'Ese cheque no existe. Actualizá la página.'; end if;
  if v_cheque.estado = 'en_cartera' and exists (
      select 1 from public.tesoreria_eventos e
      where e.cheque_id = p_cheque and e.tipo = 'deposito_deshecho'
        and e.hecho_por = (select auth.uid()) and e.hecho_en > now() - interval '15 minutes') then
    return jsonb_build_object('repetido', true);
  end if;
  if v_cheque.estado <> 'depositado' then
    raise exception 'Ese cheque ya no figura como depositado. Actualizá la página.';
  end if;

  update public.cheques set estado = 'en_cartera', fecha_depositado = null, fecha_acreditado = null
  where id = p_cheque;

  insert into public.tesoreria_eventos (org_id, tipo, detalle, motivo, monto, cheque_id, valor_anterior)
  values (v_org, 'deposito_deshecho',
    'Cheque N° ' || v_cheque.numero || ' · se había depositado el '
      || coalesce(to_char(v_cheque.fecha_depositado, 'DD/MM'), '—') || ': vuelve a Por cobrar',
    v_motivo, v_cheque.monto, v_cheque.id,
    jsonb_build_object('fecha_depositado', v_cheque.fecha_depositado));
  return jsonb_build_object('repetido', false);
end $$;
revoke all on function public.deshacer_deposito_cheque(uuid, text) from public, anon;
grant execute on function public.deshacer_deposito_cheque(uuid, text) to authenticated;

-- 5j. rechazar_cheque (misma firma y grants que 0018). Además de lo de 0018, resuelve lo que
--     dejó la entrega a un proveedor con otro monto:
--     · vuelto en efectivo: esa plata sí entró, pero hay que devolverla. El ingreso queda
--       (ya no atado al cheque: se puede anular como cualquier otro) y se crea el gasto
--       pendiente «Devolver a {proveedor} el vuelto del cheque N° X», que vence hoy.
--     · gasto dividido: se junta de nuevo (private.soltar_gasto_de_cheque).
--     · saldo a favor: ya no existe (el proveedor no cobró nada).
create or replace function public.rechazar_cheque(p_cheque uuid, p_motivo text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
  v_caja_id uuid;
  v_cliente_id uuid;
  v_caja public.cajas;
  v_cheque public.cheques;
  v_pago public.pagos;
  v_hay_pago boolean := false;
  v_vuelto public.movimientos_tesoreria;
  v_rubro uuid;
  v_devolver uuid;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('tesoreria','lider') then
    raise exception 'Solo Tesorería rechaza cheques';
  end if;
  if v_motivo is null then
    raise exception 'Contá por qué se rechazó el cheque (por ejemplo: sin fondos)';
  end if;

  -- Ubicar el cobro vigente del cheque sin bloquear, para respetar el orden §4.0.
  select p.caja_id, p.cliente_id into v_caja_id, v_cliente_id
  from public.pagos p
  where p.cheque_id = p_cheque and p.org_id = v_org and not p.anulado
  limit 1;

  if v_caja_id is not null then
    select * into v_caja from public.cajas where id = v_caja_id for update;          -- (b)
  end if;
  if v_cliente_id is not null then
    perform 1 from public.clientes where id = v_cliente_id and org_id = v_org for update;  -- (c)
  end if;

  select * into v_cheque from public.cheques where id = p_cheque and org_id = v_org for update;  -- (e)
  if not found then raise exception 'Cheque inexistente'; end if;
  if v_cheque.estado = 'rechazado' then raise exception 'El cheque ya está rechazado'; end if;

  select * into v_pago from public.pagos
  where cheque_id = p_cheque and org_id = v_org and not anulado
  for update;
  v_hay_pago := found;
  if v_hay_pago and v_pago.caja_id is distinct from v_caja_id then
    raise exception 'El cobro de este cheque cambió recién. Actualizá la página y probá de nuevo.';
  end if;

  update public.cheques set
    estado = 'rechazado',
    rechazado_por = (select auth.uid()),
    rechazado_en = now(),
    motivo_rechazo = v_motivo,
    gasto_diferencia = null,
    vuelto_movimiento_id = null
  where id = p_cheque;

  -- El proveedor había dado vuelto en efectivo: hay que devolvérselo.
  if v_cheque.vuelto_movimiento_id is not null then
    select * into v_vuelto from public.movimientos_tesoreria
    where id = v_cheque.vuelto_movimiento_id and org_id = v_org
    for update;
    if found and v_vuelto.anulado_en is null then
      select g.rubro_id into v_rubro from public.gastos g where g.id = v_cheque.gasto_id;
      if v_rubro is null then
        select r.id into v_rubro from public.rubros_gasto r
        where r.org_id = v_org order by r.activo desc, r.codigo limit 1;
      end if;
      if v_rubro is not null then
        insert into public.gastos (org_id, rubro_id, tipo, descripcion, monto, vencimiento, periodo, creado_por)
        values (v_org, v_rubro, 'variable',
                left('Devolver a ' || coalesce(nullif(trim(v_cheque.proveedor), ''), 'el proveedor')
                     || ' el vuelto del cheque N° ' || v_cheque.numero, 200),
                v_vuelto.monto, v_hoy, date_trunc('month', v_hoy)::date, (select auth.uid()))
        returning id into v_devolver;
      end if;
      insert into public.tesoreria_eventos (org_id, tipo, detalle, motivo, monto, movimiento_id, cheque_id, gasto_id)
      values (v_org, 'vuelto_a_devolver',
        'Cheque N° ' || v_cheque.numero || ' rechazado: hay que devolverle '
          || private.tesoreria_monto(v_vuelto.monto) || ' de vuelto a '
          || coalesce(nullif(trim(v_cheque.proveedor), ''), 'el proveedor'),
        v_motivo, v_vuelto.monto, v_vuelto.id, v_cheque.id, v_devolver);
    end if;
    v_cheque.vuelto_movimiento_id := null;  -- el vuelto no se anula: la plata está
  end if;

  -- El cheque había pagado un gasto (entregado a un proveedor): el gasto vuelve a pendiente
  -- (y si se había dividido, se junta de nuevo).
  perform private.soltar_gasto_de_cheque(v_cheque,
    'Cheque N° ' || v_cheque.numero || ' rechazado: ' || v_motivo);

  -- Se anula SOLO la línea del cobro que lo recibió; la deuda del cliente vuelve.
  if v_hay_pago then
    perform private.revertir_imputaciones(v_pago.id);
    update public.pagos set
      anulado = true,
      anulado_por = (select auth.uid()),
      anulado_en = now(),
      motivo_anulacion = 'Cheque N° ' || v_cheque.numero || ' rechazado: ' || v_motivo
    where id = v_pago.id;

    perform private.registrar_evento_caja(v_pago.caja_id, 'cobro_anulado',
      'Recibo N° ' || v_pago.numero || ' · cheque N° ' || v_cheque.numero || ' rechazado: ' || v_motivo);

    if v_caja.estado in ('cerrada','integrada') then
      perform private.recalcular_arqueo(v_caja.id);
    end if;
  end if;
end $$;
revoke all on function public.rechazar_cheque(uuid, text) from public, anon;
grant execute on function public.rechazar_cheque(uuid, text) to authenticated;


-- ------------------------------------------------------------
-- 6. gastos.ref: clave de idempotencia de "Cargar gasto"
-- ------------------------------------------------------------
alter table public.gastos add column if not exists ref uuid;
create unique index if not exists gastos_ref_unq on public.gastos (org_id, ref) where ref is not null;
grant insert (ref) on public.gastos to authenticated;


-- ------------------------------------------------------------
-- 7. Bono camioneros por transferencia: conciliación (J2)
-- ------------------------------------------------------------
alter table public.canon_camiones add column if not exists conciliado boolean not null default false;
alter table public.canon_camiones add column if not exists conciliado_por uuid references auth.users(id);
alter table public.canon_camiones add column if not exists conciliado_en timestamptz;
create index if not exists canon_sin_conciliar_idx on public.canon_camiones (org_id, fecha)
  where medio = 'transferencia' and not anulado and not conciliado;
create index if not exists canon_conciliado_por_idx on public.canon_camiones (conciliado_por) where conciliado_por is not null;

create or replace function public.conciliar_canon(p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_n integer;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('tesoreria','lider') then
    raise exception 'Solo Tesorería y el Líder de Procesos concilian transferencias';
  end if;
  if p_ids is null or cardinality(p_ids) = 0 then
    raise exception 'Elegí al menos una transferencia';
  end if;
  if cardinality(p_ids) > 200 then
    raise exception 'Conciliá de a 200 transferencias como máximo';
  end if;

  with hechas as (
    update public.canon_camiones set
      conciliado = true, conciliado_por = (select auth.uid()), conciliado_en = now()
    where org_id = v_org and id = any (p_ids)
      and medio = 'transferencia' and not anulado and not conciliado
    returning 1
  )
  select count(*) into v_n from hechas;

  if v_n = 0 then
    raise exception 'Esas transferencias ya estaban conciliadas. Actualizá la página.';
  end if;
  return jsonb_build_object('conciliados', v_n);
end $$;
revoke all on function public.conciliar_canon(uuid[]) from public, anon;
grant execute on function public.conciliar_canon(uuid[]) to authenticated;

create or replace function public.desconciliar_canon(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('tesoreria','lider') then
    raise exception 'Solo Tesorería y el Líder de Procesos concilian transferencias';
  end if;
  update public.canon_camiones set conciliado = false, conciliado_por = null, conciliado_en = null
  where id = p_id and org_id = v_org and conciliado;
  if not found then
    raise exception 'Esa transferencia ya no figura como conciliada. Actualizá la página.';
  end if;
end $$;
revoke all on function public.desconciliar_canon(uuid) from public, anon;
grant execute on function public.desconciliar_canon(uuid) to authenticated;
