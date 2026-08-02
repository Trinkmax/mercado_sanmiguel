-- ============================================================
-- Mercado San Miguel — 0001 Esquema base
-- Multitenant: todo dato de negocio cuelga de org_id.
-- ============================================================

create schema if not exists private;

-- ---------- Enums ----------
create type public.rol_usuario as enum ('admin','guardia','tesoreria','consejo','socio');
create type public.tipo_persona as enum ('fisica','juridica');
create type public.tipo_concepto as enum ('recurrente','energia','canon_diario','deuda');
create type public.medio_pago as enum ('efectivo','transferencia','cheque');
create type public.estado_cargo as enum ('pendiente','parcial','pagado','anulado');
create type public.estado_cheque as enum ('en_cartera','depositado','acreditado','rechazado');
create type public.tipo_caja as enum ('administracion','guardia');
create type public.estado_caja as enum ('abierta','cerrada','validada');
create type public.estado_gasto as enum ('pendiente','pagado','anulado');
create type public.tipo_gasto as enum ('fijo','variable');
create type public.tipo_sancion as enum ('sancion','notificacion');
create type public.tipo_mov_tesoreria as enum ('impuesto','comision','ajuste');

-- ---------- Organizaciones y perfiles ----------
create table public.organizaciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  slug text not null unique,
  creado_en timestamptz not null default now()
);

create table public.perfiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizaciones(id),
  nombre text not null,
  rol public.rol_usuario not null,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
create index perfiles_org_idx on public.perfiles(org_id);

-- ---------- Catálogos ----------
create table public.conceptos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id),
  codigo text not null,
  nombre text not null,
  tipo public.tipo_concepto not null default 'recurrente',
  precio numeric(14,2) not null default 0 check (precio >= 0),
  orden_imputacion int not null default 100,
  descuento_pronto_pago numeric(5,2) not null default 0 check (descuento_pronto_pago between 0 and 100),
  activo boolean not null default true,
  unique (org_id, codigo)
);
create index conceptos_org_idx on public.conceptos(org_id);

create table public.rubros_gasto (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id),
  codigo text not null,
  nombre text not null,
  activo boolean not null default true,
  unique (org_id, codigo)
);
create index rubros_gasto_org_idx on public.rubros_gasto(org_id);

create table public.configuracion (
  org_id uuid primary key references public.organizaciones(id),
  dia_vencimiento int not null default 30 check (dia_vencimiento between 1 and 31),
  precio_canon_camion numeric(14,2) not null default 0,
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid references auth.users(id)
);

-- ---------- Clientes ----------
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id),
  codigo int not null,
  nombre text not null,
  tipo_persona public.tipo_persona not null default 'fisica',
  cuit text,
  telefono text,
  email text,
  direccion text,
  notas text,
  cuotas_mes int not null default 1 check (cuotas_mes between 1 and 31),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  unique (org_id, codigo)
);
create index clientes_org_idx on public.clientes(org_id);
create index clientes_nombre_idx on public.clientes(org_id, nombre);

create table public.cliente_conceptos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  concepto_id uuid not null references public.conceptos(id),
  cantidad numeric(6,2) not null default 1 check (cantidad > 0),
  activo boolean not null default true,
  notas text,
  unique (cliente_id, concepto_id)
);
create index cliente_conceptos_cliente_idx on public.cliente_conceptos(cliente_id);
create index cliente_conceptos_org_idx on public.cliente_conceptos(org_id);

create table public.medidores (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  numero text not null,
  ubicacion text,
  activo boolean not null default true,
  unique (org_id, numero)
);
create index medidores_cliente_idx on public.medidores(cliente_id);

create table public.lecturas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id),
  medidor_id uuid not null references public.medidores(id) on delete cascade,
  periodo date not null,
  lectura_anterior numeric(12,2) not null check (lectura_anterior >= 0),
  lectura_actual numeric(12,2) not null,
  kwh numeric(12,2) generated always as (lectura_actual - lectura_anterior) stored,
  precio_kwh numeric(12,2) not null check (precio_kwh >= 0),
  monto numeric(14,2) generated always as (round((lectura_actual - lectura_anterior) * precio_kwh, 2)) stored,
  fecha_lectura date not null default current_date,
  creado_por uuid references auth.users(id),
  creado_en timestamptz not null default now(),
  check (lectura_actual >= lectura_anterior),
  unique (medidor_id, periodo)
);
create index lecturas_org_periodo_idx on public.lecturas(org_id, periodo);

create table public.documentos_cliente (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  categoria text not null default 'otro',
  titulo text not null,
  storage_path text not null,
  mime text,
  subido_por uuid references auth.users(id),
  creado_en timestamptz not null default now()
);
create index documentos_cliente_idx on public.documentos_cliente(cliente_id);

create table public.sanciones (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  tipo public.tipo_sancion not null default 'notificacion',
  titulo text not null,
  detalle text,
  fecha date not null default current_date,
  storage_path text,
  creado_por uuid references auth.users(id),
  creado_en timestamptz not null default now()
);
create index sanciones_cliente_idx on public.sanciones(cliente_id);

-- ---------- Facturación ----------
create table public.periodos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id),
  periodo date not null, -- primer día del mes
  vencimiento date not null,
  estado text not null default 'abierto' check (estado in ('abierto','cerrado')),
  generado_en timestamptz,
  generado_por uuid references auth.users(id),
  unique (org_id, periodo)
);

create table public.cargos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id),
  periodo date not null,
  cliente_id uuid not null references public.clientes(id),
  concepto_id uuid not null references public.conceptos(id),
  codigo text not null,           -- snapshot del código para reportes
  descripcion text not null,
  cantidad numeric(6,2) not null default 1,
  precio_unitario numeric(14,2) not null default 0,
  monto numeric(14,2) not null check (monto >= 0),
  descuento_pronto_pago numeric(5,2) not null default 0,
  vencimiento date not null,
  monto_pagado numeric(14,2) not null default 0 check (monto_pagado >= 0),
  descuento_aplicado numeric(14,2) not null default 0 check (descuento_aplicado >= 0),
  estado public.estado_cargo not null default 'pendiente',
  origen text not null default 'generacion' check (origen in ('generacion','energia','manual','deuda')),
  origen_lectura uuid references public.lecturas(id),
  creado_en timestamptz not null default now()
);
-- idempotencia de la generación mensual
create unique index cargos_generacion_unq on public.cargos(cliente_id, concepto_id, periodo)
  where origen = 'generacion' and estado <> 'anulado';
create unique index cargos_lectura_unq on public.cargos(origen_lectura) where origen_lectura is not null;
create index cargos_cliente_pendiente_idx on public.cargos(cliente_id) where estado in ('pendiente','parcial');
create index cargos_org_periodo_idx on public.cargos(org_id, periodo);

-- ---------- Cajas ----------
create table public.cajas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id),
  tipo public.tipo_caja not null,
  fecha date not null default current_date,
  estado public.estado_caja not null default 'abierta',
  abierta_por uuid references auth.users(id),
  abierta_en timestamptz not null default now(),
  total_efectivo numeric(14,2),
  total_transferencia numeric(14,2),
  total_cheques numeric(14,2),
  total_canon numeric(14,2),
  total_gastos numeric(14,2),
  cerrada_por uuid references auth.users(id),
  cerrada_en timestamptz,
  validada_por uuid references auth.users(id),
  validada_en timestamptz,
  observaciones text,
  unique (org_id, tipo, fecha)
);
create index cajas_org_fecha_idx on public.cajas(org_id, fecha desc);

-- ---------- Cobranza ----------
create table public.cheques (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id),
  cliente_id uuid references public.clientes(id) on delete set null,
  numero text not null,
  banco text,
  titular text not null,
  es_tercero boolean not null default false,
  monto numeric(14,2) not null check (monto > 0),
  fecha_recibido date not null default current_date,
  fecha_cobro date not null default current_date, -- desde cuándo se puede depositar
  estado public.estado_cheque not null default 'en_cartera',
  fecha_depositado date,
  fecha_acreditado date,
  notas text,
  creado_por uuid references auth.users(id),
  creado_en timestamptz not null default now()
);
create index cheques_org_estado_idx on public.cheques(org_id, estado);

create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id),
  numero bigint generated always as identity,
  cliente_id uuid not null references public.clientes(id),
  caja_id uuid not null references public.cajas(id),
  fecha timestamptz not null default now(),
  medio public.medio_pago not null,
  monto numeric(14,2) not null check (monto > 0),
  cheque_id uuid references public.cheques(id) on delete set null,
  notas text,
  recibido_por uuid references auth.users(id),
  anulado boolean not null default false,
  anulado_por uuid references auth.users(id),
  anulado_en timestamptz,
  motivo_anulacion text
);
create index pagos_cliente_idx on public.pagos(cliente_id);
create index pagos_caja_idx on public.pagos(caja_id);
create index pagos_org_fecha_idx on public.pagos(org_id, fecha desc);

create table public.imputaciones (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id),
  pago_id uuid not null references public.pagos(id) on delete cascade,
  cargo_id uuid not null references public.cargos(id),
  monto numeric(14,2) not null check (monto > 0)
);
create index imputaciones_pago_idx on public.imputaciones(pago_id);
create index imputaciones_cargo_idx on public.imputaciones(cargo_id);

create table public.canon_camiones (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id),
  caja_id uuid not null references public.cajas(id),
  fecha date not null default current_date,
  cantidad int not null default 1 check (cantidad > 0),
  monto numeric(14,2) not null check (monto > 0),
  medio public.medio_pago not null default 'efectivo',
  notas text,
  creado_por uuid references auth.users(id),
  creado_en timestamptz not null default now()
);
create index canon_caja_idx on public.canon_camiones(caja_id);
create index canon_org_fecha_idx on public.canon_camiones(org_id, fecha desc);

-- ---------- Gastos ----------
create table public.gastos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id),
  rubro_id uuid not null references public.rubros_gasto(id),
  tipo public.tipo_gasto not null default 'fijo',
  descripcion text not null,
  monto numeric(14,2) not null check (monto > 0),
  vencimiento date,
  estado public.estado_gasto not null default 'pendiente',
  fecha_pago date,
  medio_pago public.medio_pago,
  pagado_desde text check (pagado_desde in ('caja','tesoreria')),
  caja_id uuid references public.cajas(id),
  factura_path text,
  notas text,
  creado_por uuid references auth.users(id),
  creado_en timestamptz not null default now()
);
create index gastos_org_idx on public.gastos(org_id, vencimiento);
create index gastos_caja_idx on public.gastos(caja_id) where caja_id is not null;

-- ---------- Tesorería ----------
create table public.movimientos_tesoreria (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id),
  fecha date not null default current_date,
  tipo public.tipo_mov_tesoreria not null,
  descripcion text not null,
  monto numeric(14,2) not null, -- impuesto/comisión: egreso (>0); ajuste: con signo
  caja_id uuid references public.cajas(id),
  creado_por uuid references auth.users(id),
  creado_en timestamptz not null default now(),
  check (tipo = 'ajuste' or monto > 0)
);
create index mov_tesoreria_org_idx on public.movimientos_tesoreria(org_id, fecha desc);

create table public.saldos_iniciales (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id),
  medio public.medio_pago not null,
  monto numeric(14,2) not null default 0,
  fecha date not null default current_date,
  notas text,
  unique (org_id, medio)
);

-- ---------- Grants ----------
-- Sin acceso anónimo a datos: todo requiere sesión. RLS restringe filas.
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
alter default privileges in schema public revoke all on tables from anon;
