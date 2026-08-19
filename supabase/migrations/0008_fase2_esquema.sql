-- ============================================================
-- Mercado San Miguel — 0008 Fase 2: esquema, RLS y funciones
-- Revisión del cliente (agosto 2026):
--   1. Roles: Líder de Procesos, Portería (sin cobro), Jefe de Portería cobra.
--   2. Aprobación obligatoria (Líder) de altas/bajas/modificaciones de
--      clientes y conceptos → cambios_pendientes + RPCs.
--   3. Cajas: rendición de portería → integración en caja mayor (admin) →
--      validación definitiva (tesorería). Reapertura con solicitud/autorización.
--   4. Cobros por transferencia con foto del comprobante + titular; conciliación
--      de tesorería. Saldo a favor (pagos que superan la deuda) con aplicación
--      automática. Canon diario de camiones / ambulantes / quinteros.
--   5. Solicitudes (ex "Peticiones") con mensajería bidireccional socio ↔
--      administración ↔ líder ↔ consejo. Circulares con recepción obligatoria.
--      Términos y condiciones del portal. Apercibimientos.
--   6. Personal (empleados, contrato, horarios) e ingresos de personal en
--      portería con firma digital.
--   7. Mapa: apodo + posiciones persistentes (drag & drop).
-- ============================================================

-- ------------------------------------------------------------
-- 0. Políticas existentes: todo lo que podía "consejo" lo puede "lider"
--    (se recrean programáticamente; después se ajustan las que cambian).
-- ------------------------------------------------------------
do $$
declare
  p record;
  v_qual text;
  v_check text;
  v_roles text;
  v_sql text;
begin
  for p in
    select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') like '%''consejo''::%rol_usuario%'
        or coalesce(with_check, '') like '%''consejo''::%rol_usuario%')
  loop
    -- calificar los tipos (la migración puede correr con search_path vacío)
    v_qual := replace(replace(p.qual, '::rol_usuario', '::public.rol_usuario'), '::tipo_caja', '::public.tipo_caja');
    v_check := replace(replace(p.with_check, '::rol_usuario', '::public.rol_usuario'), '::tipo_caja', '::public.tipo_caja');
    v_qual := replace(v_qual, '''consejo''::public.rol_usuario', '''consejo''::public.rol_usuario, ''lider''::public.rol_usuario');
    v_check := replace(v_check, '''consejo''::public.rol_usuario', '''consejo''::public.rol_usuario, ''lider''::public.rol_usuario');
    select string_agg(quote_ident(r), ', ') into v_roles from unnest(p.roles) as r;
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    v_sql := format('create policy %I on %I.%I as %s for %s to %s',
      p.policyname, p.schemaname, p.tablename,
      case when p.permissive = 'PERMISSIVE' then 'permissive' else 'restrictive' end,
      p.cmd, v_roles);
    if v_qual is not null then v_sql := v_sql || ' using (' || v_qual || ')'; end if;
    if v_check is not null then v_sql := v_sql || ' with check (' || v_check || ')'; end if;
    execute v_sql;
  end loop;
end $$;

-- ------------------------------------------------------------
-- 1. Columnas nuevas en tablas existentes
-- ------------------------------------------------------------
alter table public.clientes add column if not exists apodo text;

alter table public.configuracion
  add column if not exists precio_canon_ambulante numeric(14,2) not null default 0,
  add column if not exists precio_canon_quintero_dia numeric(14,2) not null default 0,
  add column if not exists impresion_directa boolean not null default false;

-- Canon diario en portería: camiones, ambulantes o quinteros (por día).
alter table public.canon_camiones
  add column if not exists tipo text not null default 'camion'
    check (tipo in ('camion','ambulante','quintero'));

-- Cobros por transferencia: titular + comprobante; conciliación bancaria de tesorería.
alter table public.pagos
  add column if not exists titular_transferencia text,
  add column if not exists comprobante_path text,
  add column if not exists conciliado boolean not null default false,
  add column if not exists conciliado_por uuid references auth.users(id),
  add column if not exists conciliado_en timestamptz;

-- Gastos: validación del comprobante por tesorería.
alter table public.gastos
  add column if not exists comprobante_validado boolean not null default false,
  add column if not exists validado_por uuid references auth.users(id),
  add column if not exists validado_en timestamptz;

-- Cajas: integración de portería en la caja mayor + reapertura.
alter table public.cajas
  add column if not exists caja_destino_id uuid references public.cajas(id),
  add column if not exists integrada_por uuid references auth.users(id),
  add column if not exists integrada_en timestamptz,
  add column if not exists total_rendido_efectivo numeric(14,2),
  add column if not exists total_rendido_transferencia numeric(14,2),
  add column if not exists reapertura_solicitada_en timestamptz,
  add column if not exists reapertura_solicitada_por uuid references auth.users(id),
  add column if not exists reapertura_motivo text,
  add column if not exists reaperturas int not null default 0;
create index if not exists cajas_destino_idx on public.cajas(caja_destino_id) where caja_destino_id is not null;

-- ------------------------------------------------------------
-- 2. Tablas nuevas
-- ------------------------------------------------------------

-- Bitácora de cajas (apertura, cierre, reapertura, integración, validación)
create table if not exists public.caja_eventos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id),
  caja_id uuid not null references public.cajas(id) on delete cascade,
  tipo text not null check (tipo in (
    'apertura','cierre','solicitud_reapertura','reapertura','rechazo_reapertura',
    'integracion','recibe_rendicion','validacion')),
  detalle text,
  usuario_id uuid references auth.users(id),
  creado_en timestamptz not null default now()
);
create index if not exists caja_eventos_caja_idx on public.caja_eventos(caja_id, creado_en desc);

-- Aprobaciones: cambios de clientes / conceptos que esperan al Líder de Procesos
create type public.estado_cambio as enum ('pendiente','aprobado','rechazado');
create table if not exists public.cambios_pendientes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id),
  entidad text not null check (entidad in ('cliente','cliente_concepto','concepto')),
  accion text not null check (accion in ('alta','modificacion','baja')),
  entidad_id uuid,
  cliente_id uuid references public.clientes(id) on delete cascade, -- para agrupar en la ficha
  datos jsonb not null default '{}'::jsonb,
  datos_anteriores jsonb,
  resumen text not null,
  estado public.estado_cambio not null default 'pendiente',
  solicitado_por uuid references auth.users(id),
  solicitado_en timestamptz not null default now(),
  revisado_por uuid references auth.users(id),
  revisado_en timestamptz,
  motivo_rechazo text,
  resultado_id uuid
);
create index if not exists cambios_pendientes_org_estado_idx on public.cambios_pendientes(org_id, estado, solicitado_en desc);
create index if not exists cambios_pendientes_cliente_idx on public.cambios_pendientes(cliente_id) where cliente_id is not null;

-- Personal (lo configura el Líder de Procesos)
create type public.tipo_contrato as enum ('planta_permanente','contratado','eventual','monotributista','pasantia');
create table if not exists public.empleados (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id),
  nombre text not null,
  apellido text not null,
  dni text not null,
  cuil text,
  cargo text,
  tipo_contrato public.tipo_contrato not null default 'planta_permanente',
  fecha_ingreso date,
  fecha_egreso date,
  telefono text,
  email text,
  contrato_path text,
  observaciones text,
  activo boolean not null default true,
  creado_por uuid references auth.users(id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (org_id, dni)
);
create index if not exists empleados_org_idx on public.empleados(org_id, apellido, nombre);

-- Franjas horarias por día de la semana (1 = lunes … 7 = domingo)
create table if not exists public.empleado_horarios (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id),
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  dia_semana int not null check (dia_semana between 1 and 7),
  hora_desde time not null,
  hora_hasta time not null,
  check (hora_hasta > hora_desde)
);
create index if not exists empleado_horarios_emp_idx on public.empleado_horarios(empleado_id, dia_semana);

-- Ingresos de personal registrados en portería (DNI, nombre, apellido, firma digital)
create table if not exists public.ingresos_personal (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id),
  empleado_id uuid references public.empleados(id) on delete set null,
  dni text not null,
  nombre text not null,
  apellido text not null,
  firma_path text not null,
  ingreso_en timestamptz not null default now(),
  egreso_en timestamptz,
  fuera_de_horario boolean not null default false,
  notas text,
  registrado_por uuid references auth.users(id)
);
create index if not exists ingresos_personal_org_fecha_idx on public.ingresos_personal(org_id, ingreso_en desc);
create index if not exists ingresos_personal_dni_idx on public.ingresos_personal(org_id, dni);

-- Solicitudes (ex "Peticiones"): canal bidireccional socio ↔ administración ↔ líder ↔ consejo
create type public.tipo_solicitud as enum ('solicitud','informe','reclamo','consulta');
create type public.origen_solicitud as enum ('portal','porteria','administracion','lider');
create type public.estado_solicitud as enum (
  'nueva','en_revision','en_consejo','resuelta','asignada','ejecutada','rechazada','cerrada');
create table if not exists public.solicitudes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id),
  numero bigint generated always as identity,
  tipo public.tipo_solicitud not null default 'solicitud',
  asunto text not null,
  detalle text,
  cliente_id uuid references public.clientes(id) on delete set null, -- puede o no asociarse a un puesto
  referencia text,                -- si no hay cliente: nombre/puesto a mano
  origen public.origen_solicitud not null,
  estado public.estado_solicitud not null default 'nueva',
  adjunto_path text,
  creada_por uuid references auth.users(id),
  creada_en timestamptz not null default now(),
  revisada_por uuid references auth.users(id),
  revisada_en timestamptz,
  derivada_consejo_en timestamptz,
  resolucion text,
  resuelta_por uuid references auth.users(id),
  resuelta_en timestamptz,
  asignada_a uuid references auth.users(id),
  asignada_en timestamptz,
  ejecutada_por uuid references auth.users(id),
  ejecutada_en timestamptz,
  nota_ejecucion text,
  cerrada_en timestamptz,
  actualizada_en timestamptz not null default now()
);
create index if not exists solicitudes_org_estado_idx on public.solicitudes(org_id, estado, actualizada_en desc);
create index if not exists solicitudes_cliente_idx on public.solicitudes(cliente_id) where cliente_id is not null;

create table if not exists public.solicitud_mensajes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id),
  solicitud_id uuid not null references public.solicitudes(id) on delete cascade,
  autor_id uuid references auth.users(id),
  autor_nombre text not null,
  autor_rol public.rol_usuario not null,
  mensaje text not null,
  adjunto_path text,
  interno boolean not null default false, -- solo staff (no lo ve el socio)
  creado_en timestamptz not null default now()
);
create index if not exists solicitud_mensajes_sol_idx on public.solicitud_mensajes(solicitud_id, creado_en);

-- Circulares: comunicación a TODOS los socios, con recepción obligatoria en el portal
create table if not exists public.circulares (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id),
  numero bigint generated always as identity,
  titulo text not null,
  detalle text,
  fecha date not null default private.hoy_ar(),
  storage_path text,
  obligatoria boolean not null default true,
  activa boolean not null default true,
  creada_por uuid references auth.users(id),
  creada_en timestamptz not null default now()
);
create index if not exists circulares_org_idx on public.circulares(org_id, fecha desc);

create table if not exists public.circular_recepciones (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id),
  circular_id uuid not null references public.circulares(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  recibida_por uuid references auth.users(id),
  recibida_en timestamptz not null default now(),
  unique (circular_id, cliente_id)
);
create index if not exists circular_recepciones_cliente_idx on public.circular_recepciones(cliente_id);

-- Términos y condiciones del portal (versionados) + aceptación por socio
create table if not exists public.terminos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id),
  version int not null,
  titulo text not null default 'Términos y condiciones del portal',
  contenido text not null,
  vigente boolean not null default true,
  creado_por uuid references auth.users(id),
  creado_en timestamptz not null default now(),
  unique (org_id, version)
);
create unique index if not exists terminos_vigente_unq on public.terminos(org_id) where vigente;

create table if not exists public.aceptaciones_terminos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id),
  terminos_id uuid not null references public.terminos(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  user_id uuid references auth.users(id),
  aceptado_en timestamptz not null default now(),
  unique (terminos_id, cliente_id)
);

-- Mapa: posición persistente de cada espacio (drag & drop). Coordenadas en el
-- viewBox del plano (1000×640). Sin fila → ubicación automática.
create table if not exists public.mapa_posiciones (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  tipo text not null check (tipo in ('puesto','quinta','local','deposito')),
  x numeric(7,2) not null,
  y numeric(7,2) not null,
  actualizado_por uuid references auth.users(id),
  actualizado_en timestamptz not null default now(),
  unique (org_id, cliente_id, tipo)
);

-- ------------------------------------------------------------
-- 3. Grants base (RLS restringe filas)
-- ------------------------------------------------------------
grant select, insert, update, delete on
  public.caja_eventos, public.cambios_pendientes, public.empleados, public.empleado_horarios,
  public.ingresos_personal, public.solicitudes, public.solicitud_mensajes, public.circulares,
  public.circular_recepciones, public.terminos, public.aceptaciones_terminos, public.mapa_posiciones
  to authenticated;
revoke all on
  public.caja_eventos, public.cambios_pendientes, public.empleados, public.empleado_horarios,
  public.ingresos_personal, public.solicitudes, public.solicitud_mensajes, public.circulares,
  public.circular_recepciones, public.terminos, public.aceptaciones_terminos, public.mapa_posiciones
  from anon;

-- ------------------------------------------------------------
-- 4. Vistas
-- ------------------------------------------------------------

-- Saldo a favor por cliente: lo pagado que todavía no se imputó a ningún cargo.
create or replace view public.v_saldo_favor
with (security_invoker = true) as
select
  p.org_id,
  p.cliente_id,
  sum(p.monto) - coalesce(sum(i.imputado), 0) as saldo_favor
from public.pagos p
left join lateral (
  select sum(monto) as imputado from public.imputaciones where pago_id = p.id
) i on true
where not p.anulado
group by p.org_id, p.cliente_id
having sum(p.monto) - coalesce(sum(i.imputado), 0) > 0.009;
grant select on public.v_saldo_favor to authenticated;

-- ------------------------------------------------------------
-- 5. RLS de las tablas nuevas y ajustes de las existentes
-- ------------------------------------------------------------
alter table public.caja_eventos enable row level security;
alter table public.cambios_pendientes enable row level security;
alter table public.empleados enable row level security;
alter table public.empleado_horarios enable row level security;
alter table public.ingresos_personal enable row level security;
alter table public.solicitudes enable row level security;
alter table public.solicitud_mensajes enable row level security;
alter table public.circulares enable row level security;
alter table public.circular_recepciones enable row level security;
alter table public.terminos enable row level security;
alter table public.aceptaciones_terminos enable row level security;
alter table public.mapa_posiciones enable row level security;

-- Aprobación obligatoria: solo el Líder escribe directo en clientes / conceptos /
-- ítems de cliente. Los demás pasan por solicitar_cambio (RPC) → cambios_pendientes.
drop policy if exists "gestionar clientes" on public.clientes;
drop policy if exists "editar clientes" on public.clientes;
create policy "insertar clientes" on public.clientes for insert to authenticated
  with check (private.tiene_rol(org_id, array['lider']::public.rol_usuario[]));
create policy "editar clientes" on public.clientes for update to authenticated
  using (private.tiene_rol(org_id, array['lider']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['lider']::public.rol_usuario[]));
-- lectura de clientes: también portería (solicitudes) y el propio socio
drop policy if exists "staff lee clientes" on public.clientes;
create policy "staff lee clientes" on public.clientes for select to authenticated
  using (
    private.tiene_rol(org_id, array['admin','guardia','porteria','tesoreria','consejo','lider']::public.rol_usuario[])
    or auth_user_id = (select auth.uid())
  );

drop policy if exists "insertar conceptos" on public.conceptos;
drop policy if exists "editar conceptos" on public.conceptos;
drop policy if exists "borrar conceptos" on public.conceptos;
create policy "insertar conceptos" on public.conceptos for insert to authenticated
  with check (private.tiene_rol(org_id, array['lider']::public.rol_usuario[]));
create policy "editar conceptos" on public.conceptos for update to authenticated
  using (private.tiene_rol(org_id, array['lider']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['lider']::public.rol_usuario[]));
create policy "borrar conceptos" on public.conceptos for delete to authenticated
  using (private.tiene_rol(org_id, array['lider']::public.rol_usuario[]));

drop policy if exists "insertar items de cliente" on public.cliente_conceptos;
drop policy if exists "editar items de cliente" on public.cliente_conceptos;
drop policy if exists "borrar items de cliente" on public.cliente_conceptos;
create policy "insertar items de cliente" on public.cliente_conceptos for insert to authenticated
  with check (private.tiene_rol(org_id, array['lider']::public.rol_usuario[]));
create policy "editar items de cliente" on public.cliente_conceptos for update to authenticated
  using (private.tiene_rol(org_id, array['lider']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['lider']::public.rol_usuario[]));
create policy "borrar items de cliente" on public.cliente_conceptos for delete to authenticated
  using (private.tiene_rol(org_id, array['lider']::public.rol_usuario[]));

-- cargos manuales / deuda anterior: también el líder
drop policy if exists "cargo manual" on public.cargos;
create policy "cargo manual" on public.cargos for insert to authenticated
  with check (
    private.tiene_rol(org_id, array['admin','tesoreria','lider']::public.rol_usuario[])
    and origen in ('manual','deuda')
  );

-- pagos: tesorería concilia transferencias (update acotado por la action)
create policy "conciliar pagos" on public.pagos for update to authenticated
  using (private.tiene_rol(org_id, array['tesoreria']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['tesoreria']::public.rol_usuario[]));

-- cajas: el líder lee (ya agregado por el bloque programático); eventos
create policy "leer eventos de caja" on public.caja_eventos for select to authenticated
  using (
    private.tiene_rol(org_id, array['admin','tesoreria','consejo','lider']::public.rol_usuario[])
    or (private.tiene_rol(org_id, array['guardia']::public.rol_usuario[])
        and exists (select 1 from public.cajas c where c.id = caja_id and c.tipo = 'guardia'))
  );

-- cambios pendientes: el que lo pidió lo ve; líder/consejo ven todo. Escritura solo por RPC.
create policy "leer cambios pendientes" on public.cambios_pendientes for select to authenticated
  using (
    private.tiene_rol(org_id, array['lider','consejo']::public.rol_usuario[])
    or (private.tiene_rol(org_id, array['admin','tesoreria']::public.rol_usuario[]))
  );

-- empleados y horarios: líder gestiona; portería/jefe/admin/tesorería consultan
create policy "leer empleados" on public.empleados for select to authenticated
  using (private.tiene_rol(org_id, array['lider','admin','porteria','guardia','tesoreria','consejo']::public.rol_usuario[]));
create policy "insertar empleados" on public.empleados for insert to authenticated
  with check (private.tiene_rol(org_id, array['lider']::public.rol_usuario[]));
create policy "editar empleados" on public.empleados for update to authenticated
  using (private.tiene_rol(org_id, array['lider']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['lider']::public.rol_usuario[]));
create policy "borrar empleados" on public.empleados for delete to authenticated
  using (private.tiene_rol(org_id, array['lider']::public.rol_usuario[]));

create policy "leer horarios" on public.empleado_horarios for select to authenticated
  using (private.tiene_rol(org_id, array['lider','admin','porteria','guardia','tesoreria','consejo']::public.rol_usuario[]));
create policy "insertar horarios" on public.empleado_horarios for insert to authenticated
  with check (private.tiene_rol(org_id, array['lider']::public.rol_usuario[]));
create policy "editar horarios" on public.empleado_horarios for update to authenticated
  using (private.tiene_rol(org_id, array['lider']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['lider']::public.rol_usuario[]));
create policy "borrar horarios" on public.empleado_horarios for delete to authenticated
  using (private.tiene_rol(org_id, array['lider']::public.rol_usuario[]));

-- ingresos de personal: portería y jefe registran; líder/admin/tesorería/consejo leen
create policy "leer ingresos personal" on public.ingresos_personal for select to authenticated
  using (private.tiene_rol(org_id, array['lider','admin','porteria','guardia','tesoreria','consejo']::public.rol_usuario[]));
create policy "registrar ingresos personal" on public.ingresos_personal for insert to authenticated
  with check (private.tiene_rol(org_id, array['porteria','guardia','admin','lider']::public.rol_usuario[]));
create policy "marcar egreso personal" on public.ingresos_personal for update to authenticated
  using (private.tiene_rol(org_id, array['porteria','guardia','admin','lider']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['porteria','guardia','admin','lider']::public.rol_usuario[]));

-- solicitudes: staff de gestión ve todo; portería ve las suyas; socio ve las de su carpeta
create policy "leer solicitudes" on public.solicitudes for select to authenticated
  using (
    private.tiene_rol(org_id, array['admin','tesoreria','consejo','lider']::public.rol_usuario[])
    or creada_por = (select auth.uid())            -- portería / jefe: las que generaron
    or cliente_id = private.cliente_actual()       -- socio: las de su carpeta
  );
create policy "crear solicitudes" on public.solicitudes for insert to authenticated
  with check (
    private.es_miembro(org_id)
    and creada_por = (select auth.uid())
    and (
      -- el socio solo sobre su propia carpeta y desde el portal
      (private.rol_actual() <> 'socio')
      or (cliente_id = private.cliente_actual() and origen = 'portal')
    )
  );
-- cambios de estado solo por RPC (security definer); edición de texto por quien gestiona
create policy "editar solicitudes" on public.solicitudes for update to authenticated
  using (private.tiene_rol(org_id, array['admin','lider','consejo']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['admin','lider','consejo']::public.rol_usuario[]));

create policy "leer mensajes de solicitud" on public.solicitud_mensajes for select to authenticated
  using (
    exists (select 1 from public.solicitudes s where s.id = solicitud_id) -- visible si ve la solicitud (RLS de solicitudes)
    and (not interno or private.rol_actual() <> 'socio')
  );
create policy "escribir mensajes de solicitud" on public.solicitud_mensajes for insert to authenticated
  with check (
    private.es_miembro(org_id)
    and autor_id = (select auth.uid())
    and exists (select 1 from public.solicitudes s where s.id = solicitud_id)
    and (not interno or private.rol_actual() <> 'socio')
  );

-- circulares: todos los miembros leen; líder/admin gestionan; el socio marca recepción
create policy "leer circulares" on public.circulares for select to authenticated
  using (private.es_miembro(org_id));
create policy "insertar circulares" on public.circulares for insert to authenticated
  with check (private.tiene_rol(org_id, array['lider','admin']::public.rol_usuario[]));
create policy "editar circulares" on public.circulares for update to authenticated
  using (private.tiene_rol(org_id, array['lider','admin']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['lider','admin']::public.rol_usuario[]));

create policy "leer recepciones" on public.circular_recepciones for select to authenticated
  using (
    private.tiene_rol(org_id, array['lider','admin','tesoreria','consejo']::public.rol_usuario[])
    or cliente_id = private.cliente_actual()
  );
create policy "confirmar recepcion" on public.circular_recepciones for insert to authenticated
  with check (cliente_id = private.cliente_actual() and recibida_por = (select auth.uid()));

-- términos: todos leen; líder gestiona; el socio acepta
create policy "leer terminos" on public.terminos for select to authenticated
  using (private.es_miembro(org_id));
create policy "insertar terminos" on public.terminos for insert to authenticated
  with check (private.tiene_rol(org_id, array['lider']::public.rol_usuario[]));
create policy "editar terminos" on public.terminos for update to authenticated
  using (private.tiene_rol(org_id, array['lider']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['lider']::public.rol_usuario[]));

create policy "leer aceptaciones" on public.aceptaciones_terminos for select to authenticated
  using (
    private.tiene_rol(org_id, array['lider','admin','tesoreria','consejo']::public.rol_usuario[])
    or cliente_id = private.cliente_actual()
  );
create policy "aceptar terminos" on public.aceptaciones_terminos for insert to authenticated
  with check (cliente_id = private.cliente_actual() and user_id = (select auth.uid()));

-- mapa: staff lee; admin/líder mueven
create policy "leer mapa" on public.mapa_posiciones for select to authenticated
  using (private.tiene_rol(org_id, array['admin','guardia','tesoreria','consejo','lider']::public.rol_usuario[]));
create policy "insertar mapa" on public.mapa_posiciones for insert to authenticated
  with check (private.tiene_rol(org_id, array['admin','lider']::public.rol_usuario[]));
create policy "editar mapa" on public.mapa_posiciones for update to authenticated
  using (private.tiene_rol(org_id, array['admin','lider']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['admin','lider']::public.rol_usuario[]));
create policy "borrar mapa" on public.mapa_posiciones for delete to authenticated
  using (private.tiene_rol(org_id, array['admin','lider']::public.rol_usuario[]));

-- ------------------------------------------------------------
-- 6. Storage: nuevas carpetas del bucket `documentos`
--   {org}/comprobantes/…  (fotos de comprobantes de transferencia)
--   {org}/firmas/…        (firmas digitales de ingresos de personal)
--   {org}/solicitudes/…   (adjuntos de solicitudes y mensajes)
--   {org}/circulares/…    (PDF de circulares)
--   {org}/empleados/…     (contratos)
-- ------------------------------------------------------------
drop policy if exists "staff gestiona documentos" on storage.objects;
create policy "staff gestiona documentos"
on storage.objects for all to authenticated
using (
  bucket_id = 'documentos'
  and (storage.foldername(name))[1] = (select private.org_actual()::text)
  and (select private.rol_actual()) in ('admin','tesoreria','consejo','lider')
)
with check (
  bucket_id = 'documentos'
  and (storage.foldername(name))[1] = (select private.org_actual()::text)
  and (select private.rol_actual()) in ('admin','tesoreria','consejo','lider')
);

create policy "cobradores suben comprobantes"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'documentos'
  and (storage.foldername(name))[1] = (select private.org_actual()::text)
  and (storage.foldername(name))[2] = 'comprobantes'
  and (select private.rol_actual()) in ('guardia')
);
create policy "cobradores leen comprobantes"
on storage.objects for select to authenticated
using (
  bucket_id = 'documentos'
  and (storage.foldername(name))[1] = (select private.org_actual()::text)
  and (storage.foldername(name))[2] = 'comprobantes'
  and (select private.rol_actual()) in ('guardia')
);

create policy "porteria gestiona firmas"
on storage.objects for all to authenticated
using (
  bucket_id = 'documentos'
  and (storage.foldername(name))[1] = (select private.org_actual()::text)
  and (storage.foldername(name))[2] = 'firmas'
  and (select private.rol_actual()) in ('porteria','guardia')
)
with check (
  bucket_id = 'documentos'
  and (storage.foldername(name))[1] = (select private.org_actual()::text)
  and (storage.foldername(name))[2] = 'firmas'
  and (select private.rol_actual()) in ('porteria','guardia')
);

create policy "miembros suben adjuntos de solicitudes"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'documentos'
  and (storage.foldername(name))[1] = (select private.org_actual()::text)
  and (storage.foldername(name))[2] = 'solicitudes'
  and (select private.rol_actual()) in ('porteria','guardia','socio')
);
create policy "miembros leen adjuntos de solicitudes"
on storage.objects for select to authenticated
using (
  bucket_id = 'documentos'
  and (storage.foldername(name))[1] = (select private.org_actual()::text)
  and (storage.foldername(name))[2] = 'solicitudes'
  and (select private.rol_actual()) in ('porteria','guardia','socio')
);

create policy "socios leen circulares"
on storage.objects for select to authenticated
using (
  bucket_id = 'documentos'
  and (storage.foldername(name))[1] = (select private.org_actual()::text)
  and (storage.foldername(name))[2] = 'circulares'
  and (select private.rol_actual()) in ('socio','guardia','porteria')
);

-- ------------------------------------------------------------
-- 7. Funciones de negocio
-- ------------------------------------------------------------

-- ---------- Bitácora de caja ----------
create or replace function private.registrar_evento_caja(p_caja uuid, p_tipo text, p_detalle text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.caja_eventos (org_id, caja_id, tipo, detalle, usuario_id)
  select c.org_id, c.id, p_tipo, p_detalle, (select auth.uid())
  from public.cajas c where c.id = p_caja;
end;
$$;

-- ---------- Recalcular arqueo (incluye rendiciones de portería integradas) ----------
create or replace function private.recalcular_arqueo(p_caja uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_caja public.cajas;
  v_efectivo numeric; v_transferencia numeric; v_cheques numeric;
  v_canon numeric; v_gastos numeric;
  v_rend_ef numeric; v_rend_tr numeric;
begin
  select * into v_caja from public.cajas where id = p_caja;
  if not found then return; end if;

  select
    coalesce(sum(monto) filter (where medio = 'efectivo'), 0),
    coalesce(sum(monto) filter (where medio = 'transferencia'), 0),
    coalesce(sum(monto) filter (where medio = 'cheque'), 0)
  into v_efectivo, v_transferencia, v_cheques
  from public.pagos where caja_id = p_caja and not anulado;

  select coalesce(sum(monto), 0) into v_canon
  from public.canon_camiones where caja_id = p_caja;

  select coalesce(sum(monto), 0) into v_gastos
  from public.gastos where caja_id = p_caja and estado = 'pagado' and medio_pago = 'efectivo';

  -- rendiciones de portería integradas en esta caja (solo caja de administración)
  select coalesce(sum(total_efectivo), 0), coalesce(sum(total_transferencia), 0)
  into v_rend_ef, v_rend_tr
  from public.cajas where caja_destino_id = p_caja and estado in ('integrada','validada');

  update public.cajas set
    total_efectivo = v_efectivo
      + coalesce((select sum(monto) from public.canon_camiones where caja_id = p_caja and medio = 'efectivo'), 0)
      - v_gastos
      + v_rend_ef,
    total_transferencia = v_transferencia
      + coalesce((select sum(monto) from public.canon_camiones where caja_id = p_caja and medio = 'transferencia'), 0)
      + v_rend_tr,
    total_cheques = v_cheques,
    total_canon = v_canon,
    total_gastos = v_gastos,
    total_rendido_efectivo = v_rend_ef,
    total_rendido_transferencia = v_rend_tr
  where id = p_caja;

  -- si esta caja está integrada en otra (cerrada, aún sin validar), la otra también cambia
  if v_caja.caja_destino_id is not null then
    perform 1 from public.cajas d where d.id = v_caja.caja_destino_id and d.estado = 'cerrada';
    if found then
      perform private.recalcular_arqueo(v_caja.caja_destino_id);
    end if;
  end if;
end;
$$;

-- ---------- Abrir caja del día (+ evento) ----------
create or replace function public.abrir_caja(p_tipo public.tipo_caja)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
  v_id uuid;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if not (
    v_rol = 'tesoreria'
    or (v_rol = 'admin' and p_tipo = 'administracion')
    or (v_rol = 'guardia' and p_tipo = 'guardia')
  ) then
    raise exception 'No tenés permiso para abrir esta caja';
  end if;

  select id into v_id from public.cajas
  where org_id = v_org and tipo = p_tipo and fecha = v_hoy;
  if found then return v_id; end if;

  insert into public.cajas (org_id, tipo, fecha, abierta_por)
  values (v_org, p_tipo, v_hoy, (select auth.uid()))
  on conflict (org_id, tipo, fecha) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.cajas
    where org_id = v_org and tipo = p_tipo and fecha = v_hoy;
  else
    perform private.registrar_evento_caja(v_id, 'apertura', null);
  end if;
  return v_id;
end;
$$;

-- ---------- Cerrar caja: arqueo automático (+ rendiciones, + evento) ----------
create or replace function public.cerrar_caja(p_caja uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_caja public.cajas;
begin
  select * into v_caja from public.cajas where id = p_caja and org_id = v_org for update;
  if not found then raise exception 'Caja inexistente'; end if;
  if v_caja.estado <> 'abierta' then raise exception 'La caja ya está cerrada'; end if;
  if not (
    v_rol = 'tesoreria'
    or (v_rol = 'admin' and v_caja.tipo = 'administracion')
    or (v_rol = 'guardia' and v_caja.tipo = 'guardia')
  ) then
    raise exception 'No tenés permiso para cerrar esta caja';
  end if;

  update public.cajas set
    estado = 'cerrada',
    cerrada_por = (select auth.uid()),
    cerrada_en = now()
  where id = p_caja;

  perform private.recalcular_arqueo(p_caja);
  perform private.registrar_evento_caja(p_caja, 'cierre', null);

  select * into v_caja from public.cajas where id = p_caja;
  return jsonb_build_object(
    'efectivo', v_caja.total_efectivo,
    'transferencia', v_caja.total_transferencia,
    'cheques', v_caja.total_cheques,
    'canon', v_caja.total_canon,
    'gastos_pagados', v_caja.total_gastos,
    'rendido_efectivo', coalesce(v_caja.total_rendido_efectivo, 0),
    'rendido_transferencia', coalesce(v_caja.total_rendido_transferencia, 0)
  );
end;
$$;

-- ---------- Integrar la caja de portería en la caja mayor (administración) ----------
create or replace function public.integrar_caja_porteria(p_caja uuid, p_observaciones text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
  v_caja public.cajas;
  v_destino public.cajas;
begin
  if v_rol not in ('admin','tesoreria') then
    raise exception 'Solo administración puede recibir la rendición de portería';
  end if;
  select * into v_caja from public.cajas where id = p_caja and org_id = v_org for update;
  if not found then raise exception 'Caja inexistente'; end if;
  if v_caja.tipo <> 'guardia' then raise exception 'Solo se integran cajas de portería'; end if;
  if v_caja.estado <> 'cerrada' then
    raise exception 'La caja de portería tiene que estar cerrada (rendida) para integrarla';
  end if;

  -- caja de administración de hoy (se crea si hace falta)
  select * into v_destino from public.cajas
  where org_id = v_org and tipo = 'administracion' and fecha = v_hoy for update;
  if not found then
    insert into public.cajas (org_id, tipo, fecha, abierta_por)
    values (v_org, 'administracion', v_hoy, (select auth.uid()))
    on conflict (org_id, tipo, fecha) do nothing;
    select * into v_destino from public.cajas
    where org_id = v_org and tipo = 'administracion' and fecha = v_hoy for update;
    perform private.registrar_evento_caja(v_destino.id, 'apertura', 'Abierta al recibir la rendición de portería');
  end if;
  if v_destino.estado = 'validada' then
    raise exception 'La caja de administración de hoy ya fue validada por tesorería; la rendición entra mañana';
  end if;

  update public.cajas set
    estado = 'integrada',
    caja_destino_id = v_destino.id,
    integrada_por = (select auth.uid()),
    integrada_en = now(),
    observaciones = case when coalesce(trim(p_observaciones), '') = '' then observaciones
      else trim(both ' · ' from coalesce(observaciones, '') || ' · ' || trim(p_observaciones)) end
  where id = p_caja;

  if v_destino.estado = 'cerrada' then
    perform private.recalcular_arqueo(v_destino.id);
  end if;

  perform private.registrar_evento_caja(p_caja, 'integracion',
    'Integrada a la caja de administración del ' || to_char(v_destino.fecha, 'DD/MM/YYYY'));
  perform private.registrar_evento_caja(v_destino.id, 'recibe_rendicion',
    'Recibe la rendición de portería del ' || to_char(v_caja.fecha, 'DD/MM/YYYY')
    || ': efectivo $ ' || replace(to_char(coalesce(v_caja.total_efectivo, 0), 'FM999G999G999G990'), ',', '.'));

  return jsonb_build_object(
    'caja_destino', v_destino.id,
    'efectivo', coalesce(v_caja.total_efectivo, 0),
    'transferencia', coalesce(v_caja.total_transferencia, 0),
    'canon', coalesce(v_caja.total_canon, 0)
  );
end;
$$;

-- ---------- Solicitar reapertura (portería → administración) ----------
create or replace function public.solicitar_reapertura_caja(p_caja uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_caja public.cajas;
begin
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Contá qué pasó para pedir la reapertura'; end if;
  select * into v_caja from public.cajas where id = p_caja and org_id = v_org for update;
  if not found then raise exception 'Caja inexistente'; end if;
  if not ((v_rol = 'guardia' and v_caja.tipo = 'guardia') or (v_rol = 'admin' and v_caja.tipo = 'administracion')) then
    raise exception 'Solo podés pedir la reapertura de tu propia caja';
  end if;
  if v_caja.estado = 'abierta' then raise exception 'La caja ya está abierta'; end if;
  if v_caja.estado = 'validada' then raise exception 'La caja ya fue validada por tesorería: no se puede reabrir'; end if;
  if v_caja.reapertura_solicitada_en is not null then raise exception 'Ya hay un pedido de reapertura pendiente'; end if;

  update public.cajas set
    reapertura_solicitada_en = now(),
    reapertura_solicitada_por = (select auth.uid()),
    reapertura_motivo = trim(p_motivo)
  where id = p_caja;
  perform private.registrar_evento_caja(p_caja, 'solicitud_reapertura', trim(p_motivo));
end;
$$;

-- ---------- Reabrir caja (administración autoriza / tesorería) ----------
create or replace function public.reabrir_caja(p_caja uuid, p_motivo text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_caja public.cajas;
  v_destino public.cajas;
  v_motivo text := coalesce(nullif(trim(p_motivo), ''), null);
begin
  if v_rol not in ('admin','tesoreria') then
    raise exception 'Solo administración (o tesorería) puede reabrir una caja';
  end if;
  select * into v_caja from public.cajas where id = p_caja and org_id = v_org for update;
  if not found then raise exception 'Caja inexistente'; end if;
  if v_caja.estado = 'abierta' then raise exception 'La caja ya está abierta'; end if;
  if v_caja.estado = 'validada' then raise exception 'La caja ya fue validada por tesorería: no se puede reabrir'; end if;
  if v_rol = 'admin' and v_caja.estado = 'integrada' then
    raise exception 'Esta rendición ya entró en la caja mayor; pedile la reapertura a tesorería';
  end if;
  if v_motivo is null then v_motivo := v_caja.reapertura_motivo; end if;
  if v_motivo is null then raise exception 'Indicá el motivo de la reapertura'; end if;

  -- si estaba integrada, se desengancha de la caja mayor
  if v_caja.estado = 'integrada' and v_caja.caja_destino_id is not null then
    select * into v_destino from public.cajas where id = v_caja.caja_destino_id for update;
    if found and v_destino.estado = 'validada' then
      raise exception 'La caja de administración que recibió esta rendición ya fue validada';
    end if;
  end if;

  update public.cajas set
    estado = 'abierta',
    total_efectivo = null, total_transferencia = null, total_cheques = null,
    total_canon = null, total_gastos = null,
    total_rendido_efectivo = null, total_rendido_transferencia = null,
    cerrada_por = null, cerrada_en = null,
    caja_destino_id = null, integrada_por = null, integrada_en = null,
    reapertura_solicitada_en = null, reapertura_solicitada_por = null, reapertura_motivo = null,
    reaperturas = reaperturas + 1
  where id = p_caja;

  if v_destino.id is not null and v_destino.estado = 'cerrada' then
    perform private.recalcular_arqueo(v_destino.id);
  end if;
  perform private.registrar_evento_caja(p_caja, 'reapertura', v_motivo);
end;
$$;

-- ---------- Rechazar un pedido de reapertura ----------
create or replace function public.rechazar_reapertura_caja(p_caja uuid, p_motivo text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_caja public.cajas;
begin
  if v_rol not in ('admin','tesoreria') then raise exception 'Sin permiso'; end if;
  select * into v_caja from public.cajas where id = p_caja and org_id = v_org for update;
  if not found then raise exception 'Caja inexistente'; end if;
  if v_caja.reapertura_solicitada_en is null then raise exception 'No hay un pedido de reapertura'; end if;
  update public.cajas set
    reapertura_solicitada_en = null, reapertura_solicitada_por = null, reapertura_motivo = null
  where id = p_caja;
  perform private.registrar_evento_caja(p_caja, 'rechazo_reapertura', nullif(trim(coalesce(p_motivo, '')), ''));
end;
$$;

-- ---------- Validación de tesorería (cierre definitivo) ----------
create or replace function public.validar_caja(p_caja uuid, p_observaciones text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_caja public.cajas;
begin
  if private.rol_actual() <> 'tesoreria' then
    raise exception 'Solo tesorería puede validar cajas';
  end if;
  select * into v_caja from public.cajas where id = p_caja and org_id = v_org for update;
  if not found then raise exception 'Caja inexistente'; end if;
  if v_caja.estado not in ('cerrada','integrada') then
    raise exception 'Solo se validan cajas cerradas';
  end if;
  update public.cajas set
    estado = 'validada',
    validada_por = (select auth.uid()),
    validada_en = now(),
    observaciones = coalesce(p_observaciones, observaciones),
    reapertura_solicitada_en = null, reapertura_solicitada_por = null, reapertura_motivo = null
  where id = p_caja;
  perform private.registrar_evento_caja(p_caja, 'validacion', p_observaciones);

  -- la validación de la caja mayor arrastra las rendiciones de portería que integró
  if v_caja.tipo = 'administracion' then
    with arrastradas as (
      update public.cajas set
        estado = 'validada', validada_por = (select auth.uid()), validada_en = now()
      where caja_destino_id = p_caja and estado = 'integrada'
      returning id, org_id
    )
    insert into public.caja_eventos (org_id, caja_id, tipo, detalle, usuario_id)
    select org_id, id, 'validacion', 'Validada junto con la caja de administración', (select auth.uid())
    from arrastradas;
  end if;
end;
$$;

-- ---------- Saldo a favor: aplicar crédito pendiente de un cliente a sus cargos ----------
create or replace function private.aplicar_saldo_favor(p_cliente uuid) returns numeric
language plpgsql security definer set search_path = ''
as $$
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
  select org_id into v_org from public.clientes where id = p_cliente;
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
        then round(v_cargo.monto * (1 - v_cargo.descuento_pronto_pago / 100.0), 2)
        else v_cargo.monto end;
      v_saldo := v_objetivo - v_cargo.monto_pagado;
      continue when v_saldo <= 0;
      v_aplicar := least(v_restante, v_saldo);

      insert into public.imputaciones (org_id, pago_id, cargo_id, monto)
      values (v_org, v_pago.id, v_cargo.id, v_aplicar);

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
    exit when v_restante > 0; -- no quedan cargos pendientes
  end loop;
  return v_total;
end;
$$;

create or replace function public.aplicar_saldo_favor_cliente(p_cliente uuid)
returns numeric
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
begin
  if v_rol not in ('admin','guardia','tesoreria','lider') then
    raise exception 'Sin permiso para aplicar saldo a favor';
  end if;
  perform 1 from public.clientes where id = p_cliente and org_id = v_org;
  if not found then raise exception 'Cliente inexistente'; end if;
  return private.aplicar_saldo_favor(p_cliente);
end;
$$;

-- ---------- Registrar cobro (transferencia con comprobante, saldo a favor) ----------
drop function if exists public.registrar_pago(uuid, numeric, public.medio_pago, uuid, jsonb, text);
create or replace function public.registrar_pago(
  p_cliente uuid,
  p_monto numeric,
  p_medio public.medio_pago,
  p_caja uuid,
  p_cheque jsonb default null,
  p_notas text default null,
  p_transferencia jsonb default null,
  p_permitir_saldo_favor boolean default false
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
  v_caja public.cajas;
  v_cheque_id uuid;
  v_pago_id uuid;
  v_numero bigint;
  v_restante numeric := round(p_monto, 2);
  v_cargo record;
  v_objetivo numeric;
  v_saldo numeric;
  v_aplicar numeric;
  v_detalle jsonb := '[]'::jsonb;
begin
  if v_rol not in ('admin','guardia','tesoreria') then
    raise exception 'No tenés permiso para registrar cobros';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto debe ser mayor a cero';
  end if;

  select * into v_caja from public.cajas where id = p_caja and org_id = v_org;
  if not found then raise exception 'Caja inexistente'; end if;
  if v_caja.estado <> 'abierta' then raise exception 'La caja ya está cerrada'; end if;
  if v_rol = 'guardia' and v_caja.tipo <> 'guardia' then
    raise exception 'Solo podés cobrar en la caja de portería';
  end if;
  if v_rol = 'admin' and v_caja.tipo <> 'administracion' then
    raise exception 'Solo podés cobrar en la caja de administración';
  end if;

  perform 1 from public.clientes where id = p_cliente and org_id = v_org;
  if not found then raise exception 'Cliente inexistente'; end if;

  if p_medio = 'cheque' then
    if p_cheque is null or coalesce(p_cheque->>'numero','') = '' or coalesce(p_cheque->>'titular','') = '' then
      raise exception 'Faltan los datos del cheque (número y titular)';
    end if;
    insert into public.cheques (org_id, cliente_id, numero, banco, titular, es_tercero, monto, fecha_cobro, creado_por)
    values (
      v_org, p_cliente,
      p_cheque->>'numero',
      p_cheque->>'banco',
      p_cheque->>'titular',
      coalesce((p_cheque->>'es_tercero')::boolean, false),
      round(p_monto, 2),
      coalesce((p_cheque->>'fecha_cobro')::date, v_hoy),
      (select auth.uid())
    ) returning id into v_cheque_id;
  end if;

  if p_medio = 'transferencia' and coalesce(p_transferencia->>'titular','') = '' then
    raise exception 'Poné a nombre de quién está la cuenta que transfirió';
  end if;

  -- si el cliente tenía saldo a favor sin aplicar, se usa primero
  perform private.aplicar_saldo_favor(p_cliente);

  insert into public.pagos (org_id, cliente_id, caja_id, medio, monto, cheque_id, notas, recibido_por,
    titular_transferencia, comprobante_path)
  values (v_org, p_cliente, p_caja, p_medio, round(p_monto, 2), v_cheque_id, p_notas, (select auth.uid()),
    case when p_medio = 'transferencia' then p_transferencia->>'titular' end,
    case when p_medio = 'transferencia' then p_transferencia->>'comprobante_path' end)
  returning id, numero into v_pago_id, v_numero;

  for v_cargo in
    select c.id, c.monto, c.monto_pagado, c.descuento_pronto_pago, c.vencimiento,
           c.codigo, c.descripcion, c.periodo
    from public.cargos c
    join public.conceptos co on co.id = c.concepto_id
    where c.cliente_id = p_cliente and c.estado in ('pendiente','parcial')
    order by c.periodo asc, co.orden_imputacion asc, c.creado_en asc
    for update of c
  loop
    exit when v_restante <= 0;
    v_objetivo := case when v_hoy <= v_cargo.vencimiento
      then round(v_cargo.monto * (1 - v_cargo.descuento_pronto_pago / 100.0), 2)
      else v_cargo.monto end;
    v_saldo := v_objetivo - v_cargo.monto_pagado;
    continue when v_saldo <= 0;
    v_aplicar := least(v_restante, v_saldo);

    insert into public.imputaciones (org_id, pago_id, cargo_id, monto)
    values (v_org, v_pago_id, v_cargo.id, v_aplicar);

    update public.cargos set
      monto_pagado = monto_pagado + v_aplicar,
      descuento_aplicado = case
        when v_aplicar = v_saldo and v_hoy <= vencimiento
        then monto - v_objetivo
        else descuento_aplicado end,
      estado = case when v_aplicar = v_saldo then 'pagado'::public.estado_cargo else 'parcial'::public.estado_cargo end
    where id = v_cargo.id;

    v_detalle := v_detalle || jsonb_build_object(
      'cargo_id', v_cargo.id,
      'codigo', v_cargo.codigo,
      'descripcion', v_cargo.descripcion,
      'periodo', v_cargo.periodo,
      'monto', v_aplicar,
      'saldado', v_aplicar = v_saldo
    );
    v_restante := v_restante - v_aplicar;
  end loop;

  if v_restante > 0 and not p_permitir_saldo_favor then
    raise exception 'El monto supera la deuda del cliente: sobran $ %. Confirmá si querés dejarlo como saldo a favor.', replace(to_char(v_restante, 'FM999G999G999G990'), ',', '.');
  end if;

  return jsonb_build_object(
    'pago_id', v_pago_id,
    'numero', v_numero,
    'imputaciones', v_detalle,
    'saldo_favor', greatest(v_restante, 0)
  );
end;
$$;

-- ---------- Anular cobro: recalcula arqueo también en cajas integradas ----------
create or replace function public.anular_pago(p_pago uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_pago public.pagos;
  v_caja public.cajas;
  v_cheque public.cheques;
begin
  if v_rol not in ('admin','guardia','tesoreria') then
    raise exception 'No tenés permiso para anular cobros';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Indicá el motivo de la anulación';
  end if;

  select * into v_pago from public.pagos where id = p_pago and org_id = v_org for update;
  if not found then raise exception 'Cobro inexistente'; end if;
  if v_pago.anulado then raise exception 'El cobro ya está anulado'; end if;

  select * into v_caja from public.cajas where id = v_pago.caja_id for update;
  if v_rol = 'guardia' and v_caja.tipo <> 'guardia' then
    raise exception 'Solo podés anular cobros de la caja de portería';
  end if;
  if v_rol = 'admin' and v_caja.tipo <> 'administracion' then
    raise exception 'Solo podés anular cobros de la caja de administración';
  end if;
  if v_rol in ('admin','guardia') and v_caja.estado <> 'abierta' then
    raise exception 'La caja ya se cerró: pedí la reapertura o la anulación a tesorería';
  end if;
  if v_caja.estado = 'validada' then
    raise exception 'La caja ya fue validada; si es un cheque rebotado, marcalo como rechazado desde Cheques';
  end if;

  if v_pago.cheque_id is not null then
    select * into v_cheque from public.cheques where id = v_pago.cheque_id;
    if found and v_cheque.estado <> 'en_cartera' then
      raise exception 'El cheque ya fue depositado o acreditado: marcalo como rechazado desde Cheques para revertir el cobro';
    end if;
  end if;

  perform private.revertir_imputaciones(p_pago);

  if v_pago.cheque_id is not null then
    delete from public.cheques where id = v_pago.cheque_id and estado = 'en_cartera';
  end if;

  update public.pagos set
    anulado = true,
    anulado_por = (select auth.uid()),
    anulado_en = now(),
    motivo_anulacion = trim(p_motivo)
  where id = p_pago;

  if v_caja.estado in ('cerrada','integrada') then
    perform private.recalcular_arqueo(v_caja.id);
  end if;
end;
$$;

-- rechazar_cheque: el recálculo del arqueo ahora cascadea solo (recalcular_arqueo)
create or replace function public.rechazar_cheque(p_cheque uuid, p_motivo text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_cheque public.cheques;
  v_pago public.pagos;
  v_caja public.cajas;
begin
  if v_rol not in ('admin','tesoreria') then
    raise exception 'No tenés permiso para rechazar cheques';
  end if;

  select * into v_cheque from public.cheques where id = p_cheque and org_id = v_org for update;
  if not found then raise exception 'Cheque inexistente'; end if;
  if v_cheque.estado = 'rechazado' then raise exception 'El cheque ya está rechazado'; end if;

  update public.cheques set
    estado = 'rechazado',
    notas = trim(both ' · ' from coalesce(notas, '') || case
      when coalesce(trim(p_motivo), '') = '' then ''
      else ' · Rechazado: ' || trim(p_motivo) end)
  where id = p_cheque;

  select * into v_pago from public.pagos
  where cheque_id = p_cheque and not anulado
  for update;

  if found then
    perform private.revertir_imputaciones(v_pago.id);
    update public.pagos set
      anulado = true,
      anulado_por = (select auth.uid()),
      anulado_en = now(),
      motivo_anulacion = 'Cheque N° ' || v_cheque.numero || ' rechazado por el banco'
        || case when coalesce(trim(p_motivo), '') = '' then '' else ': ' || trim(p_motivo) end
    where id = v_pago.id;

    select * into v_caja from public.cajas where id = v_pago.caja_id;
    if found and v_caja.estado in ('cerrada','integrada') then
      perform private.recalcular_arqueo(v_caja.id);
    end if;
  end if;
end;
$$;

-- ---------- Generación mensual: aplica saldos a favor sobre los cargos nuevos ----------
create or replace function public.generar_periodo(p_periodo date)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_periodo date := date_trunc('month', p_periodo)::date;
  v_dia int;
  v_venc date;
  v_cargos int := 0;
  v_energia int := 0;
  v_cli uuid;
  v_saldos numeric := 0;
begin
  if v_rol not in ('admin','tesoreria','consejo','lider') then
    raise exception 'No tenés permiso para generar el período';
  end if;

  select dia_vencimiento into v_dia from public.configuracion where org_id = v_org;
  v_dia := coalesce(v_dia, 30);
  v_venc := least(
    (v_periodo + interval '1 month' - interval '1 day')::date,
    make_date(extract(year from v_periodo)::int, extract(month from v_periodo)::int, 1) + (v_dia - 1)
  );

  insert into public.periodos (org_id, periodo, vencimiento, generado_en, generado_por)
  values (v_org, v_periodo, v_venc, now(), (select auth.uid()))
  on conflict (org_id, periodo) do update
    set generado_en = now(), generado_por = (select auth.uid());

  with nuevos as (
    insert into public.cargos (
      org_id, periodo, cliente_id, concepto_id, codigo, descripcion,
      cantidad, precio_unitario, monto, descuento_pronto_pago, vencimiento, origen
    )
    select
      v_org, v_periodo, cc.cliente_id, co.id, co.codigo,
      co.nombre || case when cc.cantidad <> 1 then ' × ' || trim(trailing '.' from trim(trailing '0' from cc.cantidad::text)) else '' end,
      cc.cantidad, co.precio, round(cc.cantidad * co.precio, 2), co.descuento_pronto_pago, v_venc, 'generacion'
    from public.cliente_conceptos cc
    join public.conceptos co on co.id = cc.concepto_id
    join public.clientes cl on cl.id = cc.cliente_id
    where cc.org_id = v_org and cc.activo and co.activo and cl.activo
      and co.tipo = 'recurrente'
      and round(cc.cantidad * co.precio, 2) > 0
    on conflict (cliente_id, concepto_id, periodo) where origen = 'generacion' and estado <> 'anulado'
    do nothing
    returning 1
  )
  select count(*) into v_cargos from nuevos;

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

  -- saldos a favor: se aplican automáticamente a los cargos recién generados
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

  return jsonb_build_object('periodo', v_periodo, 'vencimiento', v_venc, 'cargos', v_cargos, 'energia', v_energia, 'saldo_favor_aplicado', v_saldos);
end;
$$;

-- registrar_lectura: el líder también puede; aplica saldo a favor del cliente
create or replace function public.registrar_lectura(
  p_medidor uuid,
  p_periodo date,
  p_anterior numeric,
  p_actual numeric
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_periodo date := date_trunc('month', p_periodo)::date;
  v_medidor public.medidores;
  v_precio numeric;
  v_lectura_id uuid;
  v_cargo public.cargos;
  v_venc date;
  v_dia int;
begin
  if v_rol not in ('admin','tesoreria','consejo','lider') then
    raise exception 'No tenés permiso para cargar lecturas';
  end if;
  if p_actual < p_anterior then
    raise exception 'La lectura actual no puede ser menor a la anterior';
  end if;

  select * into v_medidor from public.medidores where id = p_medidor and org_id = v_org;
  if not found then raise exception 'Medidor inexistente'; end if;

  select precio into v_precio from public.conceptos where org_id = v_org and codigo = 'ENER';
  if v_precio is null then raise exception 'Falta configurar el precio del kWh (concepto ENER)'; end if;

  select id into v_lectura_id from public.lecturas
  where medidor_id = p_medidor and periodo = v_periodo;

  if v_lectura_id is not null then
    select * into v_cargo from public.cargos where origen_lectura = v_lectura_id;
    if found and v_cargo.monto_pagado > 0 then
      raise exception 'La lectura ya tiene cobros imputados; no se puede corregir';
    end if;
    update public.lecturas set
      lectura_anterior = p_anterior,
      lectura_actual = p_actual,
      precio_kwh = v_precio,
      fecha_lectura = private.hoy_ar()
    where id = v_lectura_id;
  else
    insert into public.lecturas (org_id, medidor_id, periodo, lectura_anterior, lectura_actual, precio_kwh, creado_por)
    values (v_org, p_medidor, v_periodo, p_anterior, p_actual, v_precio, (select auth.uid()))
    returning id into v_lectura_id;
  end if;

  select vencimiento into v_venc from public.periodos where org_id = v_org and periodo = v_periodo;
  if v_venc is null then
    select dia_vencimiento into v_dia from public.configuracion where org_id = v_org;
    v_dia := coalesce(v_dia, 30);
    v_venc := least(
      (v_periodo + interval '1 month' - interval '1 day')::date,
      make_date(extract(year from v_periodo)::int, extract(month from v_periodo)::int, 1) + (v_dia - 1)
    );
  end if;

  select * into v_cargo from public.cargos where origen_lectura = v_lectura_id;
  if found then
    update public.cargos c set
      cantidad = l.kwh,
      precio_unitario = l.precio_kwh,
      monto = l.monto,
      descripcion = 'Energía · Medidor N° ' || v_medidor.numero || ' (' || l.kwh || ' kWh)',
      estado = case when l.monto = 0 then 'pagado'::public.estado_cargo else 'pendiente'::public.estado_cargo end
    from public.lecturas l
    where c.id = v_cargo.id and l.id = v_lectura_id;
  else
    insert into public.cargos (
      org_id, periodo, cliente_id, concepto_id, codigo, descripcion,
      cantidad, precio_unitario, monto, descuento_pronto_pago, vencimiento, origen, origen_lectura
    )
    select
      v_org, v_periodo, v_medidor.cliente_id, co.id, co.codigo,
      'Energía · Medidor N° ' || v_medidor.numero || ' (' || l.kwh || ' kWh)',
      l.kwh, l.precio_kwh, l.monto, 0, v_venc, 'energia', l.id
    from public.lecturas l
    join public.conceptos co on co.org_id = v_org and co.codigo = 'ENER'
    where l.id = v_lectura_id and l.monto > 0;
  end if;

  perform private.aplicar_saldo_favor(v_medidor.cliente_id);
  return v_lectura_id;
end;
$$;

-- ---------- Flujo de caja: también el líder ----------
create or replace function public.flujo_caja()
returns jsonb
language plpgsql security definer set search_path = ''
stable
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_inicial_efectivo numeric; v_inicial_banco numeric;
  v_efectivo numeric; v_banco numeric; v_cartera numeric;
begin
  if v_rol not in ('tesoreria','consejo','lider') then
    raise exception 'Solo tesorería, consejo y líderes ven el flujo de caja';
  end if;

  select
    coalesce(sum(monto) filter (where medio = 'efectivo'), 0),
    coalesce(sum(monto) filter (where medio = 'transferencia'), 0)
  into v_inicial_efectivo, v_inicial_banco
  from public.saldos_iniciales where org_id = v_org;

  select v_inicial_efectivo
    + coalesce((select sum(monto) from public.pagos where org_id = v_org and not anulado and medio = 'efectivo'), 0)
    + coalesce((select sum(monto) from public.canon_camiones where org_id = v_org and medio = 'efectivo'), 0)
    - coalesce((select sum(monto) from public.gastos where org_id = v_org and estado = 'pagado' and medio_pago = 'efectivo'), 0)
  into v_efectivo;

  select v_inicial_banco
    + coalesce((select sum(monto) from public.pagos where org_id = v_org and not anulado and medio = 'transferencia'), 0)
    + coalesce((select sum(monto) from public.canon_camiones where org_id = v_org and medio = 'transferencia'), 0)
    + coalesce((select sum(monto) from public.cheques where org_id = v_org and estado = 'acreditado'), 0)
    - coalesce((select sum(monto) from public.gastos where org_id = v_org and estado = 'pagado' and medio_pago = 'transferencia'), 0)
    - coalesce((select sum(monto) from public.movimientos_tesoreria where org_id = v_org and tipo in ('impuesto','comision','debito_fiscal')), 0)
    + coalesce((select sum(case when tipo = 'ajuste' then monto else 0 end) from public.movimientos_tesoreria where org_id = v_org), 0)
  into v_banco;

  select coalesce(sum(monto), 0) into v_cartera
  from public.cheques where org_id = v_org and estado in ('en_cartera','depositado');

  return jsonb_build_object(
    'efectivo', v_efectivo,
    'banco', v_banco,
    'cheques_en_cartera', v_cartera,
    'total', v_efectivo + v_banco + v_cartera
  );
end;
$$;

-- ---------- Reportería: canon por tipo + roles nuevos ----------
create or replace function public.resumen_conceptos(p_periodo date)
returns table (
  codigo text,
  nombre text,
  estimado numeric,
  cobrado numeric,
  descuentos numeric,
  pendiente numeric
)
language plpgsql security definer set search_path = ''
stable
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_periodo date := date_trunc('month', p_periodo)::date;
  v_hoy date := private.hoy_ar();
begin
  if v_rol not in ('admin','guardia','tesoreria','consejo','lider') then
    raise exception 'Sin permiso';
  end if;
  return query
  select
    c.codigo,
    max(co.nombre) as nombre,
    sum(c.monto) as estimado,
    sum(c.monto_pagado) as cobrado,
    sum(c.descuento_aplicado) as descuentos,
    sum(case when c.estado in ('pendiente','parcial')
      then (case when v_hoy <= c.vencimiento
        then round(c.monto * (1 - c.descuento_pronto_pago / 100.0), 2)
        else c.monto end) - c.monto_pagado
      else 0 end) as pendiente
  from public.cargos c
  join public.conceptos co on co.id = c.concepto_id
  where c.org_id = v_org and c.periodo = v_periodo and c.estado <> 'anulado'
  group by c.codigo
  order by min(co.orden_imputacion);

  -- canon diario de portería (sin cargos): camiones / ambulantes / quinteros por día
  return query
  select
    case cc.tipo when 'camion' then 'BC' when 'ambulante' then 'BA' else 'BQ' end::text,
    case cc.tipo when 'camion' then 'Canon Camiones' when 'ambulante' then 'Canon Ambulantes (día)' else 'Canon Quinteros (día)' end::text,
    coalesce(sum(cc.monto), 0),
    coalesce(sum(cc.monto), 0),
    0::numeric,
    0::numeric
  from public.canon_camiones cc
  where cc.org_id = v_org
    and date_trunc('month', cc.fecha)::date = v_periodo
  group by cc.tipo
  having coalesce(sum(cc.monto), 0) > 0
  order by 1;
end;
$$;

create or replace function public.resumen_gastos(p_periodo date)
returns table (
  codigo text,
  nombre text,
  tipo public.tipo_gasto,
  pagado numeric,
  pendiente numeric
)
language plpgsql security definer set search_path = ''
stable
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_periodo date := date_trunc('month', p_periodo)::date;
begin
  if v_rol not in ('admin','tesoreria','consejo','lider') then
    raise exception 'Sin permiso';
  end if;
  return query
  select
    r.codigo,
    max(r.nombre) as nombre,
    g.tipo,
    coalesce(sum(g.monto) filter (where g.estado = 'pagado'), 0) as pagado,
    coalesce(sum(g.monto) filter (where g.estado = 'pendiente'), 0) as pendiente
  from public.gastos g
  join public.rubros_gasto r on r.id = g.rubro_id
  where g.org_id = v_org and g.estado <> 'anulado'
    and date_trunc('month', coalesce(g.fecha_pago, g.vencimiento, g.creado_en::date))::date = v_periodo
  group by r.codigo, g.tipo
  order by r.codigo;
end;
$$;

-- ---------- Aprobaciones: solicitar / aplicar / aprobar / rechazar ----------
create or replace function private.aplicar_cambio(p_cambio public.cambios_pendientes) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  d jsonb := p_cambio.datos;
  v_id uuid := p_cambio.entidad_id;
  v_item jsonb;
  v_existente uuid;
begin
  if p_cambio.entidad = 'cliente' then
    if p_cambio.accion = 'alta' then
      insert into public.clientes (org_id, codigo, nombre, apodo, tipo_persona, cuit, telefono, email, direccion, notas, cuotas_mes)
      values (
        p_cambio.org_id,
        (d->>'codigo')::int,
        d->>'nombre',
        nullif(d->>'apodo', ''),
        coalesce((d->>'tipo_persona')::public.tipo_persona, 'fisica'),
        nullif(d->>'cuit', ''), nullif(d->>'telefono', ''), nullif(d->>'email', ''),
        nullif(d->>'direccion', ''), nullif(d->>'notas', ''),
        coalesce((d->>'cuotas_mes')::int, 1)
      ) returning id into v_id;
      for v_item in select * from jsonb_array_elements(coalesce(d->'conceptos', '[]'::jsonb)) loop
        insert into public.cliente_conceptos (org_id, cliente_id, concepto_id, cantidad, activo)
        select p_cambio.org_id, v_id, (v_item->>'concepto_id')::uuid, (v_item->>'cantidad')::numeric, true
        where exists (select 1 from public.conceptos co where co.id = (v_item->>'concepto_id')::uuid and co.org_id = p_cambio.org_id)
        on conflict (cliente_id, concepto_id) do update set cantidad = excluded.cantidad, activo = true;
      end loop;
    elsif p_cambio.accion = 'modificacion' then
      update public.clientes set
        codigo       = case when d ? 'codigo' then (d->>'codigo')::int else codigo end,
        nombre       = case when d ? 'nombre' then d->>'nombre' else nombre end,
        apodo        = case when d ? 'apodo' then nullif(d->>'apodo', '') else apodo end,
        tipo_persona = case when d ? 'tipo_persona' then (d->>'tipo_persona')::public.tipo_persona else tipo_persona end,
        cuit         = case when d ? 'cuit' then nullif(d->>'cuit', '') else cuit end,
        telefono     = case when d ? 'telefono' then nullif(d->>'telefono', '') else telefono end,
        email        = case when d ? 'email' then nullif(d->>'email', '') else email end,
        direccion    = case when d ? 'direccion' then nullif(d->>'direccion', '') else direccion end,
        notas        = case when d ? 'notas' then nullif(d->>'notas', '') else notas end,
        cuotas_mes   = case when d ? 'cuotas_mes' then (d->>'cuotas_mes')::int else cuotas_mes end,
        activo       = case when d ? 'activo' then (d->>'activo')::boolean else activo end
      where id = v_id and org_id = p_cambio.org_id;
    elsif p_cambio.accion = 'baja' then
      update public.clientes set activo = false where id = v_id and org_id = p_cambio.org_id;
    end if;

  elsif p_cambio.entidad = 'cliente_concepto' then
    if p_cambio.accion = 'alta' then
      select id into v_existente from public.cliente_conceptos
      where cliente_id = (d->>'cliente_id')::uuid and concepto_id = (d->>'concepto_id')::uuid;
      if v_existente is not null then
        update public.cliente_conceptos set
          cantidad = coalesce((d->>'cantidad')::numeric, cantidad),
          notas = coalesce(nullif(d->>'notas', ''), notas),
          activo = true
        where id = v_existente;
        v_id := v_existente;
      else
        insert into public.cliente_conceptos (org_id, cliente_id, concepto_id, cantidad, notas, activo)
        values (p_cambio.org_id, (d->>'cliente_id')::uuid, (d->>'concepto_id')::uuid,
                coalesce((d->>'cantidad')::numeric, 1), nullif(d->>'notas', ''), true)
        returning id into v_id;
      end if;
    elsif p_cambio.accion = 'modificacion' then
      update public.cliente_conceptos set
        cantidad = case when d ? 'cantidad' then (d->>'cantidad')::numeric else cantidad end,
        activo   = case when d ? 'activo' then (d->>'activo')::boolean else activo end,
        notas    = case when d ? 'notas' then nullif(d->>'notas', '') else notas end
      where id = v_id and org_id = p_cambio.org_id;
    elsif p_cambio.accion = 'baja' then
      update public.cliente_conceptos set activo = false where id = v_id and org_id = p_cambio.org_id;
    end if;

  elsif p_cambio.entidad = 'concepto' then
    if p_cambio.accion = 'alta' then
      insert into public.conceptos (org_id, codigo, nombre, tipo, precio, orden_imputacion, descuento_pronto_pago, activo)
      values (p_cambio.org_id, d->>'codigo', d->>'nombre',
              coalesce((d->>'tipo')::public.tipo_concepto, 'recurrente'),
              coalesce((d->>'precio')::numeric, 0), coalesce((d->>'orden_imputacion')::int, 100),
              coalesce((d->>'descuento_pronto_pago')::numeric, 0), coalesce((d->>'activo')::boolean, true))
      returning id into v_id;
    elsif p_cambio.accion = 'modificacion' then
      update public.conceptos set
        nombre = case when d ? 'nombre' then d->>'nombre' else nombre end,
        precio = case when d ? 'precio' then (d->>'precio')::numeric else precio end,
        orden_imputacion = case when d ? 'orden_imputacion' then (d->>'orden_imputacion')::int else orden_imputacion end,
        descuento_pronto_pago = case when d ? 'descuento_pronto_pago' then (d->>'descuento_pronto_pago')::numeric else descuento_pronto_pago end,
        activo = case when d ? 'activo' then (d->>'activo')::boolean else activo end
      where id = v_id and org_id = p_cambio.org_id;
    elsif p_cambio.accion = 'baja' then
      update public.conceptos set activo = false where id = v_id and org_id = p_cambio.org_id;
    end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.solicitar_cambio(
  p_entidad text,
  p_accion text,
  p_entidad_id uuid,
  p_datos jsonb,
  p_resumen text,
  p_cliente_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_cambio public.cambios_pendientes;
  v_anterior jsonb;
  v_resultado uuid;
  v_cliente uuid := p_cliente_id;
begin
  if v_rol not in ('admin','tesoreria','consejo','lider') then
    raise exception 'No tenés permiso para proponer cambios';
  end if;
  if p_entidad not in ('cliente','cliente_concepto','concepto') then raise exception 'Entidad inválida'; end if;
  if p_accion not in ('alta','modificacion','baja') then raise exception 'Acción inválida'; end if;
  if p_accion <> 'alta' and p_entidad_id is null then raise exception 'Falta el registro a modificar'; end if;
  if coalesce(trim(p_resumen), '') = '' then raise exception 'Falta el resumen del cambio'; end if;

  -- pertenencia a la organización + snapshot anterior (para mostrar el diff)
  if p_entidad = 'cliente' and p_entidad_id is not null then
    select to_jsonb(c) - 'org_id' into v_anterior from public.clientes c where c.id = p_entidad_id and c.org_id = v_org;
    if v_anterior is null then raise exception 'Cliente inexistente'; end if;
    v_cliente := p_entidad_id;
  elsif p_entidad = 'cliente_concepto' then
    if p_entidad_id is not null then
      select to_jsonb(cc) - 'org_id' into v_anterior from public.cliente_conceptos cc where cc.id = p_entidad_id and cc.org_id = v_org;
      if v_anterior is null then raise exception 'Ítem inexistente'; end if;
      v_cliente := (v_anterior->>'cliente_id')::uuid;
    else
      v_cliente := (p_datos->>'cliente_id')::uuid;
      perform 1 from public.clientes where id = v_cliente and org_id = v_org;
      if not found then raise exception 'Cliente inexistente'; end if;
      perform 1 from public.conceptos where id = (p_datos->>'concepto_id')::uuid and org_id = v_org;
      if not found then raise exception 'Concepto inexistente'; end if;
    end if;
  elsif p_entidad = 'concepto' and p_entidad_id is not null then
    select to_jsonb(co) - 'org_id' into v_anterior from public.conceptos co where co.id = p_entidad_id and co.org_id = v_org;
    if v_anterior is null then raise exception 'Concepto inexistente'; end if;
  end if;
  if p_entidad = 'cliente' and p_accion = 'alta' then
    if coalesce(p_datos->>'nombre', '') = '' or (p_datos->>'codigo') is null then
      raise exception 'El alta necesita nombre y número de carpeta';
    end if;
    perform 1 from public.clientes where org_id = v_org and codigo = (p_datos->>'codigo')::int;
    if found then raise exception 'Ya existe un cliente con ese número de carpeta'; end if;
  end if;

  insert into public.cambios_pendientes (org_id, entidad, accion, entidad_id, cliente_id, datos, datos_anteriores, resumen, solicitado_por)
  values (v_org, p_entidad, p_accion, p_entidad_id, v_cliente, coalesce(p_datos, '{}'::jsonb), v_anterior, trim(p_resumen), (select auth.uid()))
  returning * into v_cambio;

  -- el Líder de Procesos aplica directo (queda igual en la bitácora, ya aprobado)
  if v_rol = 'lider' then
    v_resultado := private.aplicar_cambio(v_cambio);
    update public.cambios_pendientes set
      estado = 'aprobado', revisado_por = (select auth.uid()), revisado_en = now(), resultado_id = v_resultado
    where id = v_cambio.id;
    return jsonb_build_object('estado', 'aplicado', 'cambio_id', v_cambio.id, 'resultado_id', v_resultado);
  end if;

  return jsonb_build_object('estado', 'pendiente', 'cambio_id', v_cambio.id, 'resultado_id', null);
end;
$$;

create or replace function public.aprobar_cambio(p_cambio uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_cambio public.cambios_pendientes;
  v_resultado uuid;
begin
  if v_rol <> 'lider' then raise exception 'Solo el Líder de Procesos aprueba cambios'; end if;
  select * into v_cambio from public.cambios_pendientes where id = p_cambio and org_id = v_org for update;
  if not found then raise exception 'Cambio inexistente'; end if;
  if v_cambio.estado <> 'pendiente' then raise exception 'Este cambio ya fue revisado'; end if;

  if v_cambio.entidad = 'cliente' and v_cambio.accion = 'alta' then
    perform 1 from public.clientes where org_id = v_org and codigo = (v_cambio.datos->>'codigo')::int;
    if found then raise exception 'Ya existe un cliente con el número de carpeta %. Rechazá el cambio y pedí otro número.', v_cambio.datos->>'codigo'; end if;
  end if;

  v_resultado := private.aplicar_cambio(v_cambio);
  update public.cambios_pendientes set
    estado = 'aprobado', revisado_por = (select auth.uid()), revisado_en = now(), resultado_id = v_resultado
  where id = p_cambio;
  return jsonb_build_object('resultado_id', v_resultado, 'entidad', v_cambio.entidad, 'accion', v_cambio.accion);
end;
$$;

create or replace function public.rechazar_cambio(p_cambio uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_cambio public.cambios_pendientes;
begin
  if v_rol <> 'lider' then raise exception 'Solo el Líder de Procesos revisa cambios'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Contá por qué lo rechazás'; end if;
  select * into v_cambio from public.cambios_pendientes where id = p_cambio and org_id = v_org for update;
  if not found then raise exception 'Cambio inexistente'; end if;
  if v_cambio.estado <> 'pendiente' then raise exception 'Este cambio ya fue revisado'; end if;
  update public.cambios_pendientes set
    estado = 'rechazado', revisado_por = (select auth.uid()), revisado_en = now(), motivo_rechazo = trim(p_motivo)
  where id = p_cambio;
end;
$$;

-- ---------- Solicitudes: máquina de estados ----------
-- Acciones: tomar (→ en_revision), derivar_consejo (→ en_consejo), resolver (→ resuelta),
-- asignar (→ asignada a administración), ejecutar (→ ejecutada), rechazar, cerrar, reabrir.
create or replace function public.avanzar_solicitud(
  p_solicitud uuid,
  p_accion text,
  p_texto text default null,
  p_usuario uuid default null
) returns public.estado_solicitud
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_s public.solicitudes;
  v_texto text := nullif(trim(coalesce(p_texto, '')), '');
  v_nuevo public.estado_solicitud;
  v_nombre text;
begin
  select * into v_s from public.solicitudes where id = p_solicitud and org_id = v_org for update;
  if not found then raise exception 'Solicitud inexistente'; end if;
  select nombre into v_nombre from public.perfiles where user_id = (select auth.uid());

  if p_accion = 'tomar' then
    if v_rol not in ('lider','consejo','admin') then raise exception 'Sin permiso'; end if;
    if v_s.estado not in ('nueva') then raise exception 'La solicitud ya está en revisión'; end if;
    v_nuevo := 'en_revision';
    update public.solicitudes set estado = v_nuevo, revisada_por = (select auth.uid()), revisada_en = now() where id = p_solicitud;

  elsif p_accion = 'derivar_consejo' then
    if v_rol not in ('lider') then raise exception 'Solo el Líder de Procesos deriva al Consejo'; end if;
    if v_s.estado not in ('nueva','en_revision') then raise exception 'La solicitud no está en revisión'; end if;
    v_nuevo := 'en_consejo';
    update public.solicitudes set estado = v_nuevo, derivada_consejo_en = now(),
      revisada_por = coalesce(revisada_por, (select auth.uid())), revisada_en = coalesce(revisada_en, now())
    where id = p_solicitud;

  elsif p_accion = 'resolver' then
    if v_rol not in ('lider','consejo') then raise exception 'Solo el Líder o el Consejo registran la resolución'; end if;
    if v_s.estado not in ('nueva','en_revision','en_consejo') then raise exception 'La solicitud no admite resolución en este estado'; end if;
    if v_texto is null then raise exception 'Escribí la resolución'; end if;
    v_nuevo := 'resuelta';
    update public.solicitudes set estado = v_nuevo, resolucion = v_texto, resuelta_por = (select auth.uid()), resuelta_en = now() where id = p_solicitud;

  elsif p_accion = 'asignar' then
    if v_rol not in ('lider') then raise exception 'Solo el Líder de Procesos asigna resoluciones a Administración'; end if;
    if v_s.estado not in ('resuelta','en_revision','en_consejo','nueva') then raise exception 'La solicitud no se puede asignar en este estado'; end if;
    if v_s.resolucion is null and v_texto is null then raise exception 'Escribí qué tiene que hacer Administración'; end if;
    v_nuevo := 'asignada';
    update public.solicitudes set estado = v_nuevo,
      resolucion = coalesce(v_texto, resolucion),
      resuelta_por = coalesce(resuelta_por, (select auth.uid())), resuelta_en = coalesce(resuelta_en, now()),
      asignada_a = p_usuario, asignada_en = now()
    where id = p_solicitud;

  elsif p_accion = 'ejecutar' then
    if v_rol not in ('admin','lider') then raise exception 'Solo Administración ejecuta la resolución'; end if;
    if v_s.estado not in ('asignada') then raise exception 'La solicitud todavía no fue asignada'; end if;
    v_nuevo := 'ejecutada';
    update public.solicitudes set estado = v_nuevo, ejecutada_por = (select auth.uid()), ejecutada_en = now(), nota_ejecucion = v_texto where id = p_solicitud;

  elsif p_accion = 'rechazar' then
    if v_rol not in ('lider','consejo') then raise exception 'Solo el Líder o el Consejo rechazan solicitudes'; end if;
    if v_s.estado in ('ejecutada','cerrada','rechazada') then raise exception 'La solicitud ya está terminada'; end if;
    if v_texto is null then raise exception 'Contá por qué se rechaza'; end if;
    v_nuevo := 'rechazada';
    update public.solicitudes set estado = v_nuevo, resolucion = v_texto, resuelta_por = (select auth.uid()), resuelta_en = now(), cerrada_en = now() where id = p_solicitud;

  elsif p_accion = 'cerrar' then
    if v_rol not in ('lider','admin') then raise exception 'Sin permiso'; end if;
    if v_s.estado in ('cerrada') then raise exception 'La solicitud ya está cerrada'; end if;
    v_nuevo := 'cerrada';
    update public.solicitudes set estado = v_nuevo, cerrada_en = now() where id = p_solicitud;

  elsif p_accion = 'reabrir' then
    if v_rol not in ('lider') then raise exception 'Solo el Líder de Procesos reabre solicitudes'; end if;
    v_nuevo := 'en_revision';
    update public.solicitudes set estado = v_nuevo, cerrada_en = null where id = p_solicitud;

  else
    raise exception 'Acción desconocida';
  end if;

  update public.solicitudes set actualizada_en = now() where id = p_solicitud;

  -- el cambio de estado queda como mensaje del hilo (visible para todos)
  insert into public.solicitud_mensajes (org_id, solicitud_id, autor_id, autor_nombre, autor_rol, mensaje, interno)
  values (v_org, p_solicitud, (select auth.uid()), coalesce(v_nombre, 'Sistema'), v_rol,
    case p_accion
      when 'tomar' then 'Tomó la solicitud para revisarla.'
      when 'derivar_consejo' then 'Derivó la solicitud al Consejo.' || coalesce(' ' || v_texto, '')
      when 'resolver' then 'Resolución: ' || v_texto
      when 'asignar' then 'Asignó la resolución a Administración.' || coalesce(' ' || v_texto, '')
      when 'ejecutar' then 'Ejecutó la resolución.' || coalesce(' ' || v_texto, '')
      when 'rechazar' then 'Rechazó la solicitud: ' || v_texto
      when 'cerrar' then 'Cerró la solicitud.' || coalesce(' ' || v_texto, '')
      when 'reabrir' then 'Reabrió la solicitud.' || coalesce(' ' || v_texto, '')
    end,
    false);

  return v_nuevo;
end;
$$;

-- ---------- Permisos de ejecución ----------
revoke execute on all functions in schema public from anon, public;
grant execute on function public.abrir_caja(public.tipo_caja) to authenticated;
grant execute on function public.cerrar_caja(uuid) to authenticated;
grant execute on function public.integrar_caja_porteria(uuid, text) to authenticated;
grant execute on function public.solicitar_reapertura_caja(uuid, text) to authenticated;
grant execute on function public.reabrir_caja(uuid, text) to authenticated;
grant execute on function public.rechazar_reapertura_caja(uuid, text) to authenticated;
grant execute on function public.validar_caja(uuid, text) to authenticated;
grant execute on function public.aplicar_saldo_favor_cliente(uuid) to authenticated;
grant execute on function public.registrar_pago(uuid, numeric, public.medio_pago, uuid, jsonb, text, jsonb, boolean) to authenticated;
grant execute on function public.anular_pago(uuid, text) to authenticated;
grant execute on function public.rechazar_cheque(uuid, text) to authenticated;
grant execute on function public.generar_periodo(date) to authenticated;
grant execute on function public.registrar_lectura(uuid, date, numeric, numeric) to authenticated;
grant execute on function public.flujo_caja() to authenticated;
grant execute on function public.resumen_conceptos(date) to authenticated;
grant execute on function public.resumen_gastos(date) to authenticated;
grant execute on function public.solicitar_cambio(text, text, uuid, jsonb, text, uuid) to authenticated;
grant execute on function public.aprobar_cambio(uuid) to authenticated;
grant execute on function public.rechazar_cambio(uuid, text) to authenticated;
grant execute on function public.avanzar_solicitud(uuid, text, text, uuid) to authenticated;
revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- ------------------------------------------------------------
-- 8. Ajustes posteriores (aplicados como migraciones separadas en el proyecto)
-- ------------------------------------------------------------
-- Todo el staff (incl. portería y jefe) puede leer los perfiles de su organización
-- (solo nombre/rol: sirve para mostrar "cerrada por", "registrado por", autores).
drop policy if exists "ver perfil propio o staff" on public.perfiles;
create policy "ver perfil propio o staff" on public.perfiles
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.tiene_rol(org_id, array['admin','guardia','porteria','tesoreria','consejo','lider']::public.rol_usuario[])
  );

-- hoy_ar con search_path fijo (linter de seguridad)
create or replace function private.hoy_ar() returns date
language sql stable set search_path = ''
as $$
  select (now() at time zone 'America/Argentina/Cordoba')::date
$$;

-- El Jefe de Portería también borra su comprobante si la RPC falla (rollback de la subida)
drop policy if exists "cobradores suben comprobantes" on storage.objects;
drop policy if exists "cobradores leen comprobantes" on storage.objects;
create policy "cobradores gestionan comprobantes"
on storage.objects for all to authenticated
using (
  bucket_id = 'documentos'
  and (storage.foldername(name))[1] = (select private.org_actual()::text)
  and (storage.foldername(name))[2] = 'comprobantes'
  and (select private.rol_actual()) in ('guardia')
)
with check (
  bucket_id = 'documentos'
  and (storage.foldername(name))[1] = (select private.org_actual()::text)
  and (storage.foldername(name))[2] = 'comprobantes'
  and (select private.rol_actual()) in ('guardia')
);

-- ------------------------------------------------------------
-- 9. Correcciones de la revisión adversarial (fase 2)
-- ------------------------------------------------------------
-- Adjuntos de solicitudes: socio/portería/jefe solo leen archivos ligados a una
-- solicitud o mensaje que su RLS les deja ver (antes: toda la carpeta).
drop policy if exists "miembros leen adjuntos de solicitudes" on storage.objects;
create policy "miembros leen adjuntos de solicitudes"
on storage.objects for select to authenticated
using (
  bucket_id = 'documentos'
  and (storage.foldername(name))[1] = (select private.org_actual()::text)
  and (storage.foldername(name))[2] = 'solicitudes'
  and (select private.rol_actual()) in ('porteria','guardia','socio')
  and (
    exists (select 1 from public.solicitudes s where s.adjunto_path = storage.objects.name)
    or exists (select 1 from public.solicitud_mensajes m where m.adjunto_path = storage.objects.name)
  )
);
create index if not exists solicitudes_adjunto_path_idx on public.solicitudes (adjunto_path) where adjunto_path is not null;
create index if not exists solicitud_mensajes_adjunto_path_idx on public.solicitud_mensajes (adjunto_path) where adjunto_path is not null;

-- Mensajes del hilo: el autor (id, rol, nombre) sale del perfil real, no del payload.
create or replace function private.fijar_autor_mensaje() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_nombre text;
  v_rol public.rol_usuario;
begin
  select nombre, rol into v_nombre, v_rol from public.perfiles
  where user_id = (select auth.uid()) and activo;
  if v_rol is null then raise exception 'Sin perfil activo'; end if;
  new.autor_id := (select auth.uid());
  new.autor_rol := v_rol;
  new.autor_nombre := coalesce(nullif(trim(v_nombre), ''), new.autor_nombre);
  return new;
end;
$$;
drop trigger if exists fijar_autor_mensaje on public.solicitud_mensajes;
create trigger fijar_autor_mensaje before insert on public.solicitud_mensajes
  for each row execute function private.fijar_autor_mensaje();

-- Escrituras directas acotadas por columna (las RPC security definer no se ven afectadas).
revoke update on public.pagos from authenticated;
grant update (conciliado, conciliado_por, conciliado_en) on public.pagos to authenticated;
revoke update on public.solicitudes from authenticated;
grant update (tipo, asunto, detalle, cliente_id, referencia, adjunto_path, actualizada_en) on public.solicitudes to authenticated;
revoke update on public.ingresos_personal from authenticated;
grant update (egreso_en, notas) on public.ingresos_personal to authenticated;

-- Los precios del cobro por día en portería los configura solo el Líder de Procesos.
create or replace function private.proteger_precios_porteria() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if private.rol_actual() is distinct from 'lider' and (
    new.precio_canon_camion is distinct from old.precio_canon_camion
    or new.precio_canon_ambulante is distinct from old.precio_canon_ambulante
    or new.precio_canon_quintero_dia is distinct from old.precio_canon_quintero_dia
  ) then
    raise exception 'Solo el Líder de Procesos configura el cobro por día en portería';
  end if;
  return new;
end;
$$;
drop trigger if exists proteger_precios_porteria on public.configuracion;
create trigger proteger_precios_porteria before update on public.configuracion
  for each row execute function private.proteger_precios_porteria();
