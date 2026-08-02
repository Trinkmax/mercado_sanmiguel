-- ============================================================
-- Mercado San Miguel — 0002 Funciones auxiliares + RLS
-- ============================================================

-- ---------- Helpers (esquema privado, no expuesto por la API) ----------
create or replace function private.org_actual() returns uuid
language sql stable security definer set search_path = ''
as $$
  select org_id from public.perfiles
  where user_id = (select auth.uid()) and activo
$$;

create or replace function private.rol_actual() returns public.rol_usuario
language sql stable security definer set search_path = ''
as $$
  select rol from public.perfiles
  where user_id = (select auth.uid()) and activo
$$;

create or replace function private.tiene_rol(p_org uuid, p_roles public.rol_usuario[]) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles
    where user_id = (select auth.uid()) and activo
      and org_id = p_org and rol = any(p_roles)
  )
$$;

create or replace function private.es_miembro(p_org uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles
    where user_id = (select auth.uid()) and activo and org_id = p_org
  )
$$;

create or replace function private.cliente_actual() returns uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.clientes
  where auth_user_id = (select auth.uid())
$$;

revoke all on all functions in schema private from public, anon;
grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;

-- ---------- RLS ----------
alter table public.organizaciones enable row level security;
alter table public.perfiles enable row level security;
alter table public.conceptos enable row level security;
alter table public.rubros_gasto enable row level security;
alter table public.configuracion enable row level security;
alter table public.clientes enable row level security;
alter table public.cliente_conceptos enable row level security;
alter table public.medidores enable row level security;
alter table public.lecturas enable row level security;
alter table public.documentos_cliente enable row level security;
alter table public.sanciones enable row level security;
alter table public.periodos enable row level security;
alter table public.cargos enable row level security;
alter table public.cajas enable row level security;
alter table public.cheques enable row level security;
alter table public.pagos enable row level security;
alter table public.imputaciones enable row level security;
alter table public.canon_camiones enable row level security;
alter table public.gastos enable row level security;
alter table public.movimientos_tesoreria enable row level security;
alter table public.saldos_iniciales enable row level security;

-- organizaciones: los miembros ven su organización
create policy "miembros ven su org" on public.organizaciones
  for select to authenticated
  using (private.es_miembro(id));

-- perfiles
create policy "ver perfil propio o staff" on public.perfiles
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[])
  );
create policy "gestionar perfiles" on public.perfiles
  for all to authenticated
  using (private.tiene_rol(org_id, array['admin','consejo']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['admin','consejo']::public.rol_usuario[]));

-- catálogos: cualquier miembro lee; gestionan admin/tesorería/consejo
create policy "miembros leen conceptos" on public.conceptos
  for select to authenticated using (private.es_miembro(org_id));
create policy "gestionar conceptos" on public.conceptos
  for all to authenticated
  using (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]));

create policy "miembros leen rubros" on public.rubros_gasto
  for select to authenticated using (private.es_miembro(org_id));
create policy "gestionar rubros" on public.rubros_gasto
  for all to authenticated
  using (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]));

create policy "miembros leen configuracion" on public.configuracion
  for select to authenticated using (private.es_miembro(org_id));
create policy "gestionar configuracion" on public.configuracion
  for all to authenticated
  using (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]));

-- clientes: staff completo lee; el socio ve su propia ficha
create policy "staff lee clientes" on public.clientes
  for select to authenticated
  using (
    private.tiene_rol(org_id, array['admin','guardia','tesoreria','consejo']::public.rol_usuario[])
    or auth_user_id = (select auth.uid())
  );
create policy "gestionar clientes" on public.clientes
  for insert to authenticated
  with check (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]));
create policy "editar clientes" on public.clientes
  for update to authenticated
  using (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]));

-- cliente_conceptos
create policy "leer items de cliente" on public.cliente_conceptos
  for select to authenticated
  using (
    private.tiene_rol(org_id, array['admin','guardia','tesoreria','consejo']::public.rol_usuario[])
    or cliente_id = private.cliente_actual()
  );
create policy "gestionar items de cliente" on public.cliente_conceptos
  for all to authenticated
  using (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]));

-- medidores
create policy "leer medidores" on public.medidores
  for select to authenticated
  using (
    private.tiene_rol(org_id, array['admin','guardia','tesoreria','consejo']::public.rol_usuario[])
    or cliente_id = private.cliente_actual()
  );
create policy "gestionar medidores" on public.medidores
  for all to authenticated
  using (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]));

-- lecturas: solo lectura directa; se cargan por RPC
create policy "leer lecturas" on public.lecturas
  for select to authenticated
  using (
    private.tiene_rol(org_id, array['admin','guardia','tesoreria','consejo']::public.rol_usuario[])
    or exists (
      select 1 from public.medidores m
      where m.id = medidor_id and m.cliente_id = private.cliente_actual()
    )
  );

-- documentos: staff todo; el socio ve y sube los suyos
create policy "leer documentos" on public.documentos_cliente
  for select to authenticated
  using (
    private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[])
    or cliente_id = private.cliente_actual()
  );
create policy "subir documentos" on public.documentos_cliente
  for insert to authenticated
  with check (
    private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[])
    or cliente_id = private.cliente_actual()
  );
create policy "borrar documentos" on public.documentos_cliente
  for delete to authenticated
  using (private.tiene_rol(org_id, array['admin','consejo']::public.rol_usuario[]));

-- sanciones: administración/consejo gestionan; el socio ve las suyas
create policy "leer sanciones" on public.sanciones
  for select to authenticated
  using (
    private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[])
    or cliente_id = private.cliente_actual()
  );
create policy "gestionar sanciones" on public.sanciones
  for all to authenticated
  using (private.tiene_rol(org_id, array['admin','consejo']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['admin','consejo']::public.rol_usuario[]));

-- periodos: staff lee; se generan por RPC
create policy "staff lee periodos" on public.periodos
  for select to authenticated
  using (private.tiene_rol(org_id, array['admin','guardia','tesoreria','consejo']::public.rol_usuario[]));

-- cargos: staff lee; socio ve los suyos; alta manual solo admin/tesorería
create policy "leer cargos" on public.cargos
  for select to authenticated
  using (
    private.tiene_rol(org_id, array['admin','guardia','tesoreria','consejo']::public.rol_usuario[])
    or cliente_id = private.cliente_actual()
  );
create policy "cargo manual" on public.cargos
  for insert to authenticated
  with check (
    private.tiene_rol(org_id, array['admin','tesoreria']::public.rol_usuario[])
    and origen in ('manual','deuda')
  );

-- cajas: admin/tesorería/consejo ven todas; guardia solo la suya
create policy "leer cajas" on public.cajas
  for select to authenticated
  using (
    private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[])
    or (private.tiene_rol(org_id, array['guardia']::public.rol_usuario[]) and tipo = 'guardia')
  );

-- cheques: cobradores y tesorería; estados los mueve admin/tesorería
create policy "leer cheques" on public.cheques
  for select to authenticated
  using (private.tiene_rol(org_id, array['admin','guardia','tesoreria','consejo']::public.rol_usuario[]));
create policy "actualizar cheques" on public.cheques
  for update to authenticated
  using (private.tiene_rol(org_id, array['admin','tesoreria']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['admin','tesoreria']::public.rol_usuario[]));

-- pagos e imputaciones: lectura; el alta es por RPC
create policy "leer pagos" on public.pagos
  for select to authenticated
  using (
    private.tiene_rol(org_id, array['admin','guardia','tesoreria','consejo']::public.rol_usuario[])
    or cliente_id = private.cliente_actual()
  );
create policy "leer imputaciones" on public.imputaciones
  for select to authenticated
  using (
    private.tiene_rol(org_id, array['admin','guardia','tesoreria','consejo']::public.rol_usuario[])
    or exists (
      select 1 from public.pagos p
      where p.id = pago_id and p.cliente_id = private.cliente_actual()
    )
  );

-- canon de camiones: lo carga el guardia (o admin/tesorería) sobre caja abierta
create policy "leer canon" on public.canon_camiones
  for select to authenticated
  using (private.tiene_rol(org_id, array['admin','guardia','tesoreria','consejo']::public.rol_usuario[]));
create policy "cargar canon" on public.canon_camiones
  for insert to authenticated
  with check (
    private.tiene_rol(org_id, array['guardia','admin','tesoreria']::public.rol_usuario[])
    and exists (
      select 1 from public.cajas c
      where c.id = caja_id and c.org_id = canon_camiones.org_id and c.estado = 'abierta'
    )
  );
create policy "borrar canon con caja abierta" on public.canon_camiones
  for delete to authenticated
  using (
    private.tiene_rol(org_id, array['guardia','admin','tesoreria']::public.rol_usuario[])
    and exists (
      select 1 from public.cajas c
      where c.id = caja_id and c.org_id = canon_camiones.org_id and c.estado = 'abierta'
    )
  );

-- gastos
create policy "leer gastos" on public.gastos
  for select to authenticated
  using (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]));
create policy "gestionar gastos" on public.gastos
  for all to authenticated
  using (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]));

-- tesorería: SOLO tesorería y consejo (administración no ve esto)
create policy "leer movimientos tesoreria" on public.movimientos_tesoreria
  for select to authenticated
  using (private.tiene_rol(org_id, array['tesoreria','consejo']::public.rol_usuario[]));
create policy "gestionar movimientos tesoreria" on public.movimientos_tesoreria
  for all to authenticated
  using (private.tiene_rol(org_id, array['tesoreria']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['tesoreria']::public.rol_usuario[]));

create policy "leer saldos iniciales" on public.saldos_iniciales
  for select to authenticated
  using (private.tiene_rol(org_id, array['tesoreria','consejo']::public.rol_usuario[]));
create policy "gestionar saldos iniciales" on public.saldos_iniciales
  for all to authenticated
  using (private.tiene_rol(org_id, array['tesoreria']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['tesoreria']::public.rol_usuario[]));

-- ---------- Vista: deuda por cliente ----------
create view public.v_deuda_clientes
with (security_invoker = true) as
select
  org_id,
  cliente_id,
  sum(
    (case when current_date <= vencimiento
      then round(monto * (1 - descuento_pronto_pago / 100.0), 2)
      else monto end) - monto_pagado
  ) as deuda,
  count(*) as cargos_pendientes,
  min(periodo) as periodo_mas_viejo
from public.cargos
where estado in ('pendiente','parcial')
group by org_id, cliente_id;

grant select on public.v_deuda_clientes to authenticated;
