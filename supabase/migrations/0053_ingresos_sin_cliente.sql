-- ============================================================
-- 0053 · Ingresos sin cliente (venta de vacíos y tarimas) y el arqueo con las cocheras.
--
-- Pedido del 25/10/2026 (audio de Administración): "tenemos que crear un concepto que no se
-- le asigna a ningún cliente, sino que es un concepto general de ingreso que es por venta de
-- vacíos" ("Venta de vacíos y tarimas").
--   · Conceptos de tipo 'ingreso' (0051): el Líder puede crear más; se siembra VVT.
--   · ingresos_varios: cada cobro (monto escrito, efectivo o transferencia con titular y foto,
--     detalle opcional), en la caja de administración del día de quien cobra (Administración
--     o el Líder; la de un día anterior, si está abierta, 0048). Anular con motivo; Tesorería
--     lo concilia con el banco como los cobros y el bono camioneros.
--   · Entra en el arqueo (juntado, efectivo, banco; cajas.total_ingresos), en la cobranza por
--     día, en los ingresos del mes (resumen_conceptos, una fila por concepto, como el BC) y en
--     el flujo de fondos.
-- El arqueo además desglosa la cochera que el Jefe cobra en portería (0052): 'cocheras' (y
-- 'rendido_cocheras' en la caja de administración que recibe esa caja de portería).
-- Mismas firmas. Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Lo que se cobra sin cliente: una fila por cobro, en la caja de quien cobra.
-- ------------------------------------------------------------
create table if not exists public.ingresos_varios (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id) on delete cascade,
  numero bigint generated always as identity,
  caja_id uuid not null references public.cajas(id),
  fecha date not null,
  concepto_id uuid not null references public.conceptos(id),
  -- Foto del concepto al cobrar (renombrarlo después no cambia lo cobrado).
  codigo text not null,
  concepto_nombre text not null,
  -- "30 vacíos a Juan", "2 tarimas": lo que se vendió y a quién (opcional).
  detalle text,
  monto numeric not null check (monto > 0),
  medio public.medio_pago not null check (medio in ('efectivo', 'transferencia')),
  titular_transferencia text,
  comprobante_path text,
  -- Idempotencia del cobro (doble toque o reintento sin red).
  ref uuid,
  creado_por uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now(),
  anulado boolean not null default false,
  anulado_por uuid references auth.users(id) on delete set null,
  anulado_en timestamptz,
  motivo_anulacion text,
  conciliado boolean not null default false,
  conciliado_por uuid references auth.users(id) on delete set null,
  conciliado_en timestamptz
);
comment on table public.ingresos_varios is
  'Cobros sin cliente (concepto de tipo ingreso: venta de vacíos y tarimas…). Se escriben solo por RPC: registrar_ingreso, anular_ingreso, conciliar_ingresos (0053).';

create index if not exists ingresos_varios_caja_idx on public.ingresos_varios (caja_id);
create index if not exists ingresos_varios_org_fecha_idx on public.ingresos_varios (org_id, fecha desc);
create index if not exists ingresos_varios_concepto_idx on public.ingresos_varios (concepto_id);
create unique index if not exists ingresos_varios_ref_unq on public.ingresos_varios (org_id, ref) where ref is not null;
create index if not exists ingresos_varios_sin_conciliar_idx on public.ingresos_varios (org_id, fecha)
  where medio = 'transferencia' and not anulado and not conciliado;
create index if not exists ingresos_varios_conciliado_por_idx on public.ingresos_varios (conciliado_por)
  where conciliado_por is not null;

alter table public.ingresos_varios enable row level security;
drop policy if exists "leer ingresos varios" on public.ingresos_varios;
create policy "leer ingresos varios" on public.ingresos_varios
  for select to authenticated
  using (private.tiene_rol(org_id, array['admin', 'tesoreria', 'consejo', 'lider']::public.rol_usuario[]));
revoke all on table public.ingresos_varios from anon, authenticated;
grant select on table public.ingresos_varios to authenticated;

-- El arqueo de la caja se recalcula solo si la caja ya está cerrada (anular después del cierre).
drop trigger if exists recalcular_caja on public.ingresos_varios;
create trigger recalcular_caja after insert or update or delete on public.ingresos_varios
  for each row execute function private.tg_recalcular_caja();

alter table public.cajas add column if not exists total_ingresos numeric;
comment on column public.cajas.total_ingresos is 'Ingresos sin cliente vigentes al cerrar (recalcular_arqueo, 0053).';

-- La bitácora de la caja anota también la anulación de un ingreso sin cliente.
alter table public.caja_eventos drop constraint if exists caja_eventos_tipo_check;
alter table public.caja_eventos add constraint caja_eventos_tipo_check check (tipo in (
  'apertura', 'cierre', 'solicitud_reapertura', 'reapertura', 'rechazo_reapertura', 'integracion',
  'recibe_rendicion', 'validacion', 'gasto_imputado', 'gasto_revertido', 'ajuste', 'ajuste_borrado',
  'canon_anulado', 'arqueo_recalculado', 'cierre_forzado', 'cobro_anulado', 'ingreso_anulado'));

-- El concepto que pidió el mercado.
insert into public.conceptos (org_id, codigo, nombre, tipo, precio, orden_imputacion, descuento_pronto_pago, activo, segmento)
select o.id, 'VVT', 'Venta de vacíos y tarimas', 'ingreso', 0, 110, 0, true, null
from public.organizaciones o
on conflict (org_id, codigo) do nothing;

-- ------------------------------------------------------------
-- 2. Cobrar, anular y conciliar.
-- ------------------------------------------------------------
create or replace function private.resumen_ingreso(p public.ingresos_varios)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id, 'numero', p.numero, 'monto', p.monto, 'codigo', p.codigo,
    'concepto', p.concepto_nombre, 'detalle', p.detalle, 'medio', p.medio,
    'caja_id', p.caja_id, 'fecha', p.fecha, 'creado_en', p.creado_en, 'anulado', p.anulado)
$$;
revoke all on function private.resumen_ingreso(public.ingresos_varios) from public, anon;
grant execute on function private.resumen_ingreso(public.ingresos_varios) to authenticated;

create or replace function public.registrar_ingreso(
  p_concepto uuid,
  p_monto numeric,
  p_medio public.medio_pago default 'efectivo',
  p_detalle text default null,
  p_titular text default null,
  p_comprobante text default null,
  p_ref uuid default null,
  p_fecha date default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
  v_fecha date := coalesce(p_fecha, private.hoy_ar());
  v_uid uuid := (select auth.uid());
  v_monto numeric := round(p_monto, 2);
  v_detalle text := nullif(btrim(coalesce(p_detalle, '')), '');
  v_titular text := nullif(btrim(coalesce(p_titular, '')), '');
  v_path text := nullif(btrim(coalesce(p_comprobante, '')), '');
  v_concepto public.conceptos;
  v_prev public.ingresos_varios;
  v_nuevo public.ingresos_varios;
  v_caja public.cajas;
  v_nueva uuid;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  -- Administración y el Líder (§1.3 D-P2), en la caja de administración del día.
  if v_rol is null or v_rol not in ('admin', 'lider') then
    raise exception 'Los ingresos sin cliente los cobra Administración';
  end if;
  if v_fecha > v_hoy then raise exception 'Ese día todavía no llegó'; end if;
  if v_fecha < v_hoy - 62 then raise exception 'Solo se pueden cargar días de los últimos dos meses'; end if;

  -- Idempotencia (§4.0-5): el mismo ref devuelve el mismo cobro.
  if p_ref is not null then
    perform pg_advisory_xact_lock(hashtextextended('registrar_ingreso:' || p_ref::text, 0));
    select * into v_prev from public.ingresos_varios where org_id = v_org and ref = p_ref;
    if found then
      if v_prev.concepto_id is distinct from p_concepto or v_prev.monto is distinct from v_monto
         or v_prev.medio is distinct from p_medio then
        raise exception 'Ese cobro ya se registró (N° %) con otros datos: fijate en la caja antes de cobrar de nuevo', v_prev.numero;
      end if;
      return private.resumen_ingreso(v_prev) || jsonb_build_object('repetido', true);
    end if;
  end if;

  if p_concepto is null then raise exception 'Elegí qué se cobra'; end if;
  select * into v_concepto from public.conceptos where id = p_concepto and org_id = v_org;
  if not found or v_concepto.tipo <> 'ingreso' then
    raise exception 'Ese concepto no es un ingreso sin cliente. Actualizá la pantalla.';
  end if;
  if not v_concepto.activo then
    raise exception 'El concepto «%» está apagado: pedile al Líder de Procesos que lo prenda', v_concepto.nombre;
  end if;
  if v_monto is null or v_monto <= 0 then raise exception 'Poné cuánto se cobró'; end if;
  if v_monto > 999999999999 then raise exception 'El monto es demasiado grande: revisalo'; end if;
  if p_medio is null or p_medio not in ('efectivo', 'transferencia') then
    raise exception 'Se cobra en efectivo o por transferencia';
  end if;
  if p_medio = 'transferencia' then
    if v_titular is null then raise exception 'Poné a nombre de quién está la cuenta que transfirió'; end if;
    if char_length(v_titular) > 120 then raise exception 'El nombre del titular es demasiado largo'; end if;
    if v_path is not null
       and (v_path not like v_org::text || '/comprobantes/%' or position('..' in v_path) > 0) then
      raise exception 'La foto del comprobante no es válida: volvé a sacarla';
    end if;
  else
    v_titular := null;
    v_path := null;
  end if;
  if v_detalle is not null and char_length(v_detalle) > 200 then
    raise exception 'El detalle es demasiado largo (hasta 200 letras)';
  end if;

  -- Caja de administración del día: la de hoy se abre sola (§4.0-4); la de un día anterior
  -- se abre desde Caja (0048).
  if v_fecha = v_hoy then
    insert into public.cajas (org_id, tipo, fecha, abierta_por)
    values (v_org, 'administracion', v_hoy, v_uid)
    on conflict (org_id, tipo, fecha) do nothing
    returning id into v_nueva;
    if v_nueva is not null then
      perform private.registrar_evento_caja(v_nueva, 'apertura', 'Abierta con el primer ingreso sin cliente');
    end if;
  end if;
  select * into v_caja from public.cajas c
  where c.org_id = v_org and c.tipo = 'administracion' and c.fecha = v_fecha
  for share;
  if not found then
    raise exception 'No hay caja de administración del %: abrila desde Caja para cargar lo de ese día',
      to_char(v_fecha, 'DD/MM');
  end if;
  if v_caja.estado <> 'abierta' then
    raise exception '%', private.mensaje_caja_no_abierta(v_caja.estado, v_rol);
  end if;

  begin
    insert into public.ingresos_varios (
      org_id, caja_id, fecha, concepto_id, codigo, concepto_nombre, detalle, monto, medio,
      titular_transferencia, comprobante_path, ref, creado_por)
    values (
      v_org, v_caja.id, v_fecha, v_concepto.id, v_concepto.codigo, v_concepto.nombre, v_detalle,
      v_monto, p_medio, v_titular, v_path, p_ref, v_uid)
    returning * into v_nuevo;
  exception when unique_violation then
    if p_ref is null then raise; end if;
    select * into v_prev from public.ingresos_varios where org_id = v_org and ref = p_ref;
    if not found then raise; end if;
    return private.resumen_ingreso(v_prev) || jsonb_build_object('repetido', true);
  end;

  return private.resumen_ingreso(v_nuevo) || jsonb_build_object('repetido', false);
end $$;
revoke all on function public.registrar_ingreso(uuid, numeric, public.medio_pago, text, text, text, uuid, date) from public, anon;
grant execute on function public.registrar_ingreso(uuid, numeric, public.medio_pago, text, text, text, uuid, date) to authenticated;
comment on function public.registrar_ingreso(uuid, numeric, public.medio_pago, text, text, text, uuid, date) is
  'Cobro sin cliente (concepto de tipo ingreso) en la caja de administración del día (o de un día anterior abierta). Administración y el Líder. Idempotente por p_ref (0053).';

create or replace function public.anular_ingreso(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_uid uuid := (select auth.uid());
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_caja_id uuid;
  v_caja public.cajas;
  v_i public.ingresos_varios;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('admin', 'tesoreria', 'lider') then
    raise exception 'No tenés permiso para anular este cobro';
  end if;
  if v_motivo is null then raise exception 'Contá por qué lo anulás'; end if;
  if char_length(v_motivo) > 500 then raise exception 'El motivo es demasiado largo (hasta 500 letras)'; end if;

  select i.caja_id into v_caja_id from public.ingresos_varios i where i.id = p_id and i.org_id = v_org;
  if not found then raise exception 'Ese cobro no existe. Actualizá la pantalla.'; end if;
  -- Orden de bloqueo (§4.0): caja → cobro.
  select * into v_caja from public.cajas where id = v_caja_id and org_id = v_org for update;
  select * into v_i from public.ingresos_varios where id = p_id and org_id = v_org for update;
  if v_i.anulado then raise exception 'Ese cobro ya estaba anulado'; end if;
  if v_caja.estado = 'validada' then
    raise exception 'La caja de ese día ya la validó Tesorería: el cobro no se puede anular';
  end if;
  if v_rol = 'admin' and v_caja.estado <> 'abierta' then
    raise exception 'La caja ya se cerró: pedí la reapertura o la anulación a tesorería';
  end if;

  update public.ingresos_varios
  set anulado = true, anulado_por = v_uid, anulado_en = now(), motivo_anulacion = v_motivo
  where id = v_i.id;
  perform private.registrar_evento_caja(v_i.caja_id, 'ingreso_anulado',
    'N° ' || v_i.numero || ' · ' || v_i.concepto_nombre || ' · ' || private.caja_pesos(v_i.monto)
    || ' · ' || v_motivo);
end $$;
revoke all on function public.anular_ingreso(uuid, text) from public, anon;
grant execute on function public.anular_ingreso(uuid, text) to authenticated;
comment on function public.anular_ingreso(uuid, text) is
  'Anula un cobro sin cliente con motivo. Administración con la caja abierta; Tesorería y el Líder hasta que se valida (0053).';

create or replace function public.conciliar_ingresos(p_ids uuid[])
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
  if v_rol is null or v_rol not in ('tesoreria', 'lider') then
    raise exception 'Solo Tesorería y el Líder de Procesos concilian transferencias';
  end if;
  if p_ids is null or cardinality(p_ids) = 0 then
    raise exception 'Elegí al menos una transferencia';
  end if;
  if cardinality(p_ids) > 200 then
    raise exception 'Conciliá de a 200 transferencias como máximo';
  end if;

  with hechas as (
    update public.ingresos_varios set
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
revoke all on function public.conciliar_ingresos(uuid[]) from public, anon;
grant execute on function public.conciliar_ingresos(uuid[]) to authenticated;

create or replace function public.desconciliar_ingreso(p_id uuid)
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
  if v_rol is null or v_rol not in ('tesoreria', 'lider') then
    raise exception 'Solo Tesorería y el Líder de Procesos concilian transferencias';
  end if;
  update public.ingresos_varios set conciliado = false, conciliado_por = null, conciliado_en = null
  where id = p_id and org_id = v_org and conciliado;
  if not found then
    raise exception 'Esa transferencia ya no figura como conciliada. Actualizá la página.';
  end if;
end $$;
revoke all on function public.desconciliar_ingreso(uuid) from public, anon;
grant execute on function public.desconciliar_ingreso(uuid) to authenticated;

-- ------------------------------------------------------------
-- 3. Arqueo: ingresos sin cliente y cocheras de portería.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.calcular_arqueo(p_caja uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_caja public.cajas;
  v_cob_ef numeric := 0;
  v_cob_tr numeric := 0;
  v_cob_ch numeric := 0;
  v_ch_ent numeric := 0;
  v_quintas numeric := 0;
  v_ambulantes numeric := 0;
  v_can_ef numeric := 0;
  v_can_tr numeric := 0;
  v_ren_ef numeric := 0;
  v_ren_tr numeric := 0;
  v_ren_q numeric := 0;
  v_ren_a numeric := 0;
  v_ren_c numeric := 0;
  v_gastos numeric := 0;
  v_aj_ef numeric := 0;
  v_aj_tr numeric := 0;
  v_ing_ef numeric := 0;
  v_ing_tr numeric := 0;
  v_ren_co numeric := 0;
  v_detalle jsonb := '[]'::jsonb;
  v_cobros numeric;
  v_canon numeric;
  v_rendido numeric;
begin
  select * into v_caja from public.cajas where id = p_caja;
  if not found then return null; end if;

  -- Cobros vigentes (no anulados) por medio; cheques entregados a un proveedor en el
  -- mismo acto del cobro (no quedaron en la caja); desglose Quintas / Ambulantes.
  select
    coalesce(sum(p.monto) filter (where p.medio = 'efectivo'), 0),
    coalesce(sum(p.monto) filter (where p.medio = 'transferencia'), 0),
    coalesce(sum(p.monto) filter (where p.medio = 'cheque'), 0),
    coalesce(sum(p.monto) filter (where p.medio = 'cheque' and coalesce(ch.entregado_en_cobro, false)), 0),
    coalesce(sum(p.monto) filter (where c.categoria = 'quintero'), 0),
    coalesce(sum(p.monto) filter (where c.categoria = 'ambulante'), 0)
  into v_cob_ef, v_cob_tr, v_cob_ch, v_ch_ent, v_quintas, v_ambulantes
  from public.pagos p
  left join public.cheques ch on ch.id = p.cheque_id
  left join public.clientes c on c.id = p.cliente_id
  where p.caja_id = p_caja and not p.anulado;

  -- El desglose Quintas · Ambulantes es de la caja de portería.
  if v_caja.tipo <> 'guardia' then
    v_quintas := 0;
    v_ambulantes := 0;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'numero', ch.numero, 'monto', p.monto, 'proveedor', ch.proveedor)
           order by p.fecha, p.linea), '[]'::jsonb)
  into v_detalle
  from public.pagos p
  join public.cheques ch on ch.id = p.cheque_id
  where p.caja_id = p_caja and not p.anulado and p.medio = 'cheque' and ch.entregado_en_cobro;

  -- Bono camioneros (canon de transporte) vigente.
  select
    coalesce(sum(k.monto) filter (where k.medio = 'efectivo'), 0),
    coalesce(sum(k.monto) filter (where k.medio = 'transferencia'), 0)
  into v_can_ef, v_can_tr
  from public.canon_camiones k
  where k.caja_id = p_caja and not k.anulado;

  -- 0053: ingresos sin cliente vigentes (venta de vacíos y tarimas…).
  select
    coalesce(sum(i.monto) filter (where i.medio = 'efectivo'), 0),
    coalesce(sum(i.monto) filter (where i.medio = 'transferencia'), 0)
  into v_ing_ef, v_ing_tr
  from public.ingresos_varios i
  where i.caja_id = p_caja and not i.anulado;

  -- Cajas de portería rendidas e integradas en esta caja (solo administración).
  select
    coalesce(sum(r.total_efectivo), 0),
    coalesce(sum(r.total_transferencia), 0),
    coalesce(sum(r.total_quintas), 0),
    coalesce(sum(r.total_ambulantes), 0),
    coalesce(sum(r.total_canon), 0),
    -- 0053: lo que el Jefe cobró de cochera a puesteros y empleados (ni quintas ni ambulantes).
    coalesce(sum(coalesce(r.total_cobros, 0) - coalesce(r.total_quintas, 0) - coalesce(r.total_ambulantes, 0)), 0)
  into v_ren_ef, v_ren_tr, v_ren_q, v_ren_a, v_ren_c, v_ren_co
  from public.cajas r
  where r.caja_destino_id = p_caja and r.estado in ('integrada', 'validada');

  -- Gastos pagados desde esta caja (siempre en efectivo: 0022 gastos_caja_efectivo).
  select coalesce(sum(g.monto), 0)
  into v_gastos
  from public.gastos g
  where g.caja_id = p_caja and g.estado = 'pagado' and g.pagado_desde = 'caja';

  -- Ajustes de tesorería sobre esta caja (con signo: + sobrante, − faltante).
  select
    coalesce(sum(m.monto) filter (where m.cuenta = 'efectivo'), 0),
    coalesce(sum(m.monto) filter (where m.cuenta = 'banco'), 0)
  into v_aj_ef, v_aj_tr
  from public.movimientos_tesoreria m
  where m.caja_id = p_caja;

  v_cobros := v_cob_ef + v_cob_tr + v_cob_ch;
  v_canon := v_can_ef + v_can_tr;
  v_rendido := v_ren_ef + v_ren_tr;

  return jsonb_build_object(
    'cobros_efectivo', round(v_cob_ef, 2),
    'cobros_transferencia', round(v_cob_tr, 2),
    'cobros_cheques', round(v_cob_ch, 2),
    'cobros', round(v_cobros, 2),
    'cheques_entregados', round(v_ch_ent, 2),
    'quintas', round(v_quintas, 2),
    'ambulantes', round(v_ambulantes, 2),
    'canon_efectivo', round(v_can_ef, 2),
    'canon_transferencia', round(v_can_tr, 2),
    'canon', round(v_canon, 2),
    'rendido_efectivo', round(v_ren_ef, 2),
    'rendido_transferencia', round(v_ren_tr, 2),
    'rendido', round(v_rendido, 2),
    'rendido_quintas', round(v_ren_q, 2),
    'rendido_ambulantes', round(v_ren_a, 2),
    'rendido_canon', round(v_ren_c, 2),
    -- 0053: cocheras cobradas por el Jefe a puesteros y empleados (los cobros de la caja de
    -- portería que no son de quinteros ni de ambulantes) y las que entraron con una rendición.
    'cocheras', round(case when v_caja.tipo = 'guardia' then v_cobros - v_quintas - v_ambulantes else 0 end, 2),
    'rendido_cocheras', round(v_ren_co, 2),
    -- 0053: ingresos sin cliente (venta de vacíos y tarimas…).
    'ingresos_efectivo', round(v_ing_ef, 2),
    'ingresos_transferencia', round(v_ing_tr, 2),
    'ingresos', round(v_ing_ef + v_ing_tr, 2),
    'juntado', round(v_cobros + v_canon + v_rendido + v_ing_ef + v_ing_tr, 2),
    'gastos_pagados', round(v_gastos, 2),
    'ajustes_efectivo', round(v_aj_ef, 2),
    'ajustes_transferencia', round(v_aj_tr, 2),
    'ajustes', round(v_aj_ef + v_aj_tr, 2),
    'efectivo', round(v_cob_ef + v_can_ef + v_ing_ef + v_ren_ef - v_gastos + v_aj_ef, 2),
    'transferencia', round(v_cob_tr + v_can_tr + v_ing_tr + v_ren_tr + v_aj_tr, 2),
    'cheques', round(greatest(v_cob_ch - v_ch_ent, 0), 2),
    'cheques_entregados_detalle', v_detalle
  );
end $function$;

CREATE OR REPLACE FUNCTION private.recalcular_arqueo(p_caja uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_caja public.cajas;
  a jsonb;
  v_ef numeric;
  v_tr numeric;
  v_ch numeric;
  v_cambios text[] := '{}';
begin
  -- Lectura sin bloqueo (§4.0-3): un trigger disparado desde un cobro en caja abierta
  -- nunca pide más que el `for share` que ya tiene su RPC.
  select * into v_caja from public.cajas where id = p_caja;
  if not found or v_caja.estado in ('abierta', 'validada') then return; end if;

  -- Va a escribir: recién ahora bloquea, y revalida el estado con el bloqueo.
  select * into v_caja from public.cajas where id = p_caja for update;
  if v_caja.estado in ('abierta', 'validada') then return; end if;

  a := private.calcular_arqueo(p_caja);
  v_ef := (a ->> 'efectivo')::numeric;
  v_tr := (a ->> 'transferencia')::numeric;
  v_ch := (a ->> 'cheques')::numeric;

  update public.cajas set
    total_efectivo = v_ef,
    total_transferencia = v_tr,
    total_cheques = v_ch,
    total_canon = (a ->> 'canon')::numeric,
    total_gastos = (a ->> 'gastos_pagados')::numeric,
    total_rendido_efectivo = (a ->> 'rendido_efectivo')::numeric,
    total_rendido_transferencia = (a ->> 'rendido_transferencia')::numeric,
    total_cobros = (a ->> 'cobros')::numeric,
    total_quintas = (a ->> 'quintas')::numeric,
    total_ambulantes = (a ->> 'ambulantes')::numeric,
    total_cheques_entregados = (a ->> 'cheques_entregados')::numeric,
    total_ajustes = (a ->> 'ajustes')::numeric,
    total_rendido_quintas = (a ->> 'rendido_quintas')::numeric,
    total_rendido_ambulantes = (a ->> 'rendido_ambulantes')::numeric,
    total_rendido_canon = (a ->> 'rendido_canon')::numeric,
    total_ingresos = (a ->> 'ingresos')::numeric   -- 0053
  where id = p_caja;

  -- Rastro: si la caja ya tenía un arqueo y cambia, queda "antes → ahora".
  if v_caja.total_efectivo is not null and v_caja.total_efectivo is distinct from v_ef then
    v_cambios := v_cambios || ('Efectivo: ' || private.caja_pesos(v_caja.total_efectivo) || ' → ' || private.caja_pesos(v_ef));
  end if;
  if v_caja.total_transferencia is not null and v_caja.total_transferencia is distinct from v_tr then
    v_cambios := v_cambios || ('Banco: ' || private.caja_pesos(v_caja.total_transferencia) || ' → ' || private.caja_pesos(v_tr));
  end if;
  if v_caja.total_cheques is not null and v_caja.total_cheques is distinct from v_ch then
    v_cambios := v_cambios || ('Cheques: ' || private.caja_pesos(v_caja.total_cheques) || ' → ' || private.caja_pesos(v_ch));
  end if;
  if cardinality(v_cambios) > 0 then
    perform private.registrar_evento_caja(p_caja, 'arqueo_recalculado', array_to_string(v_cambios, ' · '));
  end if;

  -- Cascada: la caja de administración que recibió esta caja de portería, si está cerrada.
  if v_caja.caja_destino_id is not null
     and exists (select 1 from public.cajas d where d.id = v_caja.caja_destino_id and d.estado = 'cerrada') then
    perform private.recalcular_arqueo(v_caja.caja_destino_id);
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public.arqueo_caja(p_caja uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_caja public.cajas;
  a jsonb;
  v_meta jsonb;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  select * into v_caja from public.cajas where id = p_caja and org_id = v_org;
  if not found then raise exception 'Caja inexistente'; end if;
  if not (v_rol in ('admin', 'tesoreria', 'lider')
          or (v_rol in ('guardia', 'porteria') and v_caja.tipo = 'guardia')) then
    raise exception 'Sin permiso';
  end if;

  a := private.calcular_arqueo(p_caja);
  v_meta := jsonb_build_object('caja_id', v_caja.id, 'tipo', v_caja.tipo, 'fecha', v_caja.fecha,
                               'estado', v_caja.estado);

  if v_caja.estado = 'abierta' then
    return a || v_meta || jsonb_build_object('fuente', 'vivo');
  end if;

  -- Cerrada, integrada o validada: manda lo persistido (validada = congelada). Lo que no
  -- tiene columna (el detalle por medio) sale de las filas; una columna nula (caja vieja)
  -- cae en el valor calculado.
  a := a || jsonb_strip_nulls(jsonb_build_object(
    'efectivo', v_caja.total_efectivo,
    'transferencia', v_caja.total_transferencia,
    'cheques', v_caja.total_cheques,
    'canon', v_caja.total_canon,
    'gastos_pagados', v_caja.total_gastos,
    'rendido_efectivo', v_caja.total_rendido_efectivo,
    'rendido_transferencia', v_caja.total_rendido_transferencia,
    'cobros', v_caja.total_cobros,
    'quintas', v_caja.total_quintas,
    'ambulantes', v_caja.total_ambulantes,
    'cheques_entregados', v_caja.total_cheques_entregados,
    'ajustes', v_caja.total_ajustes,
    'rendido_quintas', v_caja.total_rendido_quintas,
    'rendido_ambulantes', v_caja.total_rendido_ambulantes,
    'rendido_canon', v_caja.total_rendido_canon,
    'ingresos', v_caja.total_ingresos));   -- 0053
  a := a || jsonb_build_object(
    'cobros_cheques', (a ->> 'cheques')::numeric + (a ->> 'cheques_entregados')::numeric,
    'rendido', (a ->> 'rendido_efectivo')::numeric + (a ->> 'rendido_transferencia')::numeric,
    -- 0053: la cochera que cobró el Jefe sale de los totales guardados, como las quintas.
    'cocheras', case when v_caja.tipo = 'guardia'
      then (a ->> 'cobros')::numeric - (a ->> 'quintas')::numeric - (a ->> 'ambulantes')::numeric
      else 0 end,
    'juntado', (a ->> 'cobros')::numeric + (a ->> 'canon')::numeric + (a ->> 'ingresos')::numeric
               + (a ->> 'rendido_efectivo')::numeric + (a ->> 'rendido_transferencia')::numeric);
  return a || v_meta || jsonb_build_object('fuente', 'cierre');
end $function$;

CREATE OR REPLACE FUNCTION public.cerrar_caja(p_caja uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
  v_caja public.cajas;
  a jsonb;
  v_detalle text;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('admin', 'guardia', 'tesoreria', 'lider') then
    raise exception 'No tenés permiso para cerrar esta caja';
  end if;

  select * into v_caja from public.cajas where id = p_caja and org_id = v_org for update;
  if not found then raise exception 'Caja inexistente'; end if;
  if v_rol = 'admin' and v_caja.tipo <> 'administracion' then
    raise exception 'Solo podés cerrar la caja de administración';
  end if;
  if v_rol = 'guardia' and v_caja.tipo <> 'guardia' then
    raise exception 'Solo podés rendir la caja de portería';
  end if;
  if v_caja.estado <> 'abierta' then raise exception 'La caja ya está cerrada'; end if;
  if v_rol = 'tesoreria' and v_caja.fecha >= v_hoy then
    raise exception 'Tesorería solo cierra cajas de días anteriores que quedaron abiertas';
  end if;

  update public.cajas set
    estado = 'cerrada',
    cerrada_por = (select auth.uid()),
    cerrada_en = now()
  where id = p_caja;

  perform private.recalcular_arqueo(p_caja);
  a := private.calcular_arqueo(p_caja);

  v_detalle := 'Efectivo ' || private.caja_pesos((a ->> 'efectivo')::numeric);
  if v_caja.tipo = 'guardia' then
    v_detalle := v_detalle
      || ' — Quintas ' || private.caja_pesos((a ->> 'quintas')::numeric)
      || ' · Ambulantes ' || private.caja_pesos((a ->> 'ambulantes')::numeric)
      || ' · Bono camioneros ' || private.caja_pesos((a ->> 'canon')::numeric)
      -- 0053: la cochera que el Jefe le cobró a puesteros y empleados.
      || case when (a ->> 'cocheras')::numeric > 0.009
           then ' · Cocheras ' || private.caja_pesos((a ->> 'cocheras')::numeric) else '' end;
  end if;

  if v_rol = 'tesoreria' then
    perform private.registrar_evento_caja(p_caja, 'cierre_forzado',
      'Quedó abierta desde el ' || to_char(v_caja.fecha, 'DD/MM') || ' · ' || v_detalle);
  else
    perform private.registrar_evento_caja(p_caja, 'cierre', v_detalle);
  end if;

  return a || jsonb_build_object('caja_id', v_caja.id, 'tipo', v_caja.tipo, 'fecha', v_caja.fecha,
                                 'estado', 'cerrada', 'fuente', 'cierre');
end $function$;

CREATE OR REPLACE FUNCTION public.integrar_caja_porteria(p_caja uuid, p_observaciones text DEFAULT NULL::text, p_efectivo_recibido numeric DEFAULT NULL::numeric, p_fecha_destino date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    -- 0053: la cochera que el Jefe le cobró a puesteros y empleados.
    || case when coalesce(v_caja.total_cobros, 0) - coalesce(v_caja.total_quintas, 0)
                 - coalesce(v_caja.total_ambulantes, 0) > 0.009
         then ' · Cocheras ' || private.caja_pesos(coalesce(v_caja.total_cobros, 0)
                 - coalesce(v_caja.total_quintas, 0) - coalesce(v_caja.total_ambulantes, 0))
         else '' end
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
end $function$;

CREATE OR REPLACE FUNCTION private.tg_recalcular_caja()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_viejo uuid;
  v_nuevo uuid;
  v_o jsonb;
  v_n jsonb;
  v_cols text[];
  v_relevante boolean;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_viejo := old.caja_id; end if;
  if tg_op in ('INSERT', 'UPDATE') then v_nuevo := new.caja_id; end if;
  if v_viejo is null and v_nuevo is null then return null; end if;

  -- En un UPDATE solo importan las columnas que mueven el arqueo (editar la descripción de
  -- un gasto no toca la caja ni pide su bloqueo).
  if tg_op = 'UPDATE' then
    v_o := to_jsonb(old);
    v_n := to_jsonb(new);
    v_cols := case tg_table_name
      when 'gastos' then array['estado', 'monto', 'caja_id', 'pagado_desde', 'medio_pago']
      when 'canon_camiones' then array['anulado', 'monto', 'medio', 'caja_id']
      when 'ingresos_varios' then array['anulado', 'monto', 'medio', 'caja_id']   -- 0053
      else array['monto', 'cuenta', 'caja_id', 'tipo', 'moneda']
    end;
    select bool_or((v_o -> c) is distinct from (v_n -> c)) into v_relevante from unnest(v_cols) c;
    if not coalesce(v_relevante, false) then return null; end if;
  end if;

  if v_viejo is not null then
    perform private.recalcular_arqueo(v_viejo);
  end if;
  if v_nuevo is not null and v_nuevo is distinct from v_viejo then
    perform private.recalcular_arqueo(v_nuevo);
  end if;
  return null;
end $function$;


-- ------------------------------------------------------------
-- 4. Reportes y flujo de fondos.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cobranza_diaria(p_desde date, p_hasta date)
 RETURNS TABLE(fecha date, monto numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
begin
  if v_org is null or v_rol is null then raise exception 'Sin perfil activo'; end if;
  if v_rol not in ('admin','tesoreria','consejo','lider') then raise exception 'Sin permiso'; end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then
    raise exception 'Elegí un rango de fechas válido';
  end if;
  if p_hasta - p_desde > 400 then raise exception 'El rango es demasiado largo (hasta 400 días)'; end if;

  return query
  select d.dia::date as fecha,
         round(coalesce(pg.total, 0) + coalesce(cn.total, 0) + coalesce(iv.total, 0), 2) as monto
  from generate_series(p_desde::timestamp, p_hasta::timestamp, interval '1 day') as d(dia)
  left join (
    select (p.fecha at time zone 'America/Argentina/Cordoba')::date as dia, sum(p.monto) as total
    from public.pagos p
    where p.org_id = v_org and not p.anulado
      and p.fecha >= (p_desde::timestamp at time zone 'America/Argentina/Cordoba')
      and p.fecha < ((p_hasta + 1)::timestamp at time zone 'America/Argentina/Cordoba')
    group by 1
  ) pg on pg.dia = d.dia::date
  left join (
    select c.fecha as dia, sum(c.monto) as total
    from public.canon_camiones c
    where c.org_id = v_org and not c.anulado and c.fecha between p_desde and p_hasta
    group by 1
  ) cn on cn.dia = d.dia::date
  -- 0053: ingresos sin cliente (venta de vacíos y tarimas…).
  left join (
    select i.fecha as dia, sum(i.monto) as total
    from public.ingresos_varios i
    where i.org_id = v_org and not i.anulado and i.fecha between p_desde and p_hasta
    group by 1
  ) iv on iv.dia = d.dia::date
  order by 1;
end $function$;

CREATE OR REPLACE FUNCTION public.resumen_conceptos(p_periodo date)
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

  -- 0053: ingresos sin cliente del mes (venta de vacíos y tarimas…), uno por concepto. Como el
  -- bono camioneros, no tienen estimado: suman lo cobrado. Son de Administración.
  if v_rol <> 'guardia' then
    return query
    select co.codigo::text, co.nombre::text, sum(i.monto), sum(i.monto), 0::numeric, 0::numeric
    from public.ingresos_varios i
    join public.conceptos co on co.id = i.concepto_id
    where i.org_id = v_org and not i.anulado
      and i.fecha >= v_periodo and i.fecha < v_hasta
    group by co.codigo, co.nombre, co.orden_imputacion
    order by co.orden_imputacion, co.codigo;
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public.flujo_caja()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    + coalesce((select sum(i.monto) from public.ingresos_varios i   -- 0053
        where i.org_id = v_org and not i.anulado and i.medio = 'efectivo'
          and (d_ef is null or i.fecha >= d_ef)), 0)
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
    + coalesce((select sum(i.monto) from public.ingresos_varios i   -- 0053
        where i.org_id = v_org and not i.anulado and i.medio = 'transferencia'
          and (d_bco is null or i.fecha >= d_bco)), 0)
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
    + coalesce((select sum(i.monto) from public.ingresos_varios i join public.cajas c on c.id = i.caja_id   -- 0053
        where i.org_id = v_org and not i.anulado and i.medio = 'efectivo' and c.estado <> 'validada'
          and (d_ef is null or i.fecha >= d_ef)), 0)
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
end $function$;
