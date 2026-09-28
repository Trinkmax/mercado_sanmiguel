-- ============================================================
-- Mercado San Miguel — 0010 Fase 3: valores nuevos de enums y tipos nuevos
-- Contrato: docs/FASE3-CONTRATO.md §2.1
--
-- Va SOLA y ANTES de 0011: Postgres no permite USAR un valor de enum
-- recién agregado con ALTER TYPE ... ADD VALUE dentro de la misma
-- transacción. Nada de este archivo usa los valores nuevos.
-- Se aplica como UNA transacción. Es idempotente (se puede re-correr).
-- ============================================================

-- Cheques: endosado / entregado a un proveedor (A2, E2). Visible: "Entregado a proveedor".
alter type public.estado_cheque add value if not exists 'entregado' after 'en_cartera';

-- Catálogo de conceptos (decisiones §2):
--   diario        → AMB: se cobra en el acto por N días (no se genera por mes).
--   abono_energia → ABEN: lo genera generar_periodo a todo cliente con medidor activo.
--   eventual      → MULT: cargo manual desde un apercibimiento/sanción.
alter type public.tipo_concepto add value if not exists 'diario';
alter type public.tipo_concepto add value if not exists 'abono_energia';
alter type public.tipo_concepto add value if not exists 'eventual';

-- Tesorería (J2, J6): movimientos entre cuentas e ingresos/egresos sueltos.
alter type public.tipo_mov_tesoreria add value if not exists 'deposito';
alter type public.tipo_mov_tesoreria add value if not exists 'extraccion';
alter type public.tipo_mov_tesoreria add value if not exists 'ingreso';
alter type public.tipo_mov_tesoreria add value if not exists 'egreso';

-- Solicitudes (H3, J5): bandeja del Jefe de Portería y origen Tesorería.
alter type public.estado_solicitud add value if not exists 'con_jefe' before 'nueva';
alter type public.origen_solicitud add value if not exists 'tesoreria';

-- Tipos nuevos (create type sí se puede usar en la misma transacción, pero
-- se dejan acá para que 0011 quede solo con esquema).
do $$ begin
  create type public.categoria_cliente as enum ('puestero', 'quintero', 'ambulante');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.moneda as enum ('ARS', 'USD');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.cuenta_tesoreria as enum ('efectivo', 'banco');
exception when duplicate_object then null; end $$;

-- Estado del hilo de un registro documental (notificación / apercibimiento / sanción):
-- notificado → descargo (el socio escribió) → respondido (Líder/Administración contestó).
do $$ begin
  create type public.estado_registro as enum ('notificado', 'descargo', 'respondido');
exception when duplicate_object then null; end $$;

-- Personal (H4).
do $$ begin
  create type public.sector_personal as enum ('porteria', 'limpieza', 'mantenimiento', 'administracion', 'otro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tipo_novedad as enum
    ('falta', 'llegada_tarde', 'feriado_trabajado', 'vacaciones', 'licencia', 'horas_extra', 'otra');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estado_novedad as enum ('pendiente', 'aprobada', 'rechazada', 'anulada');
exception when duplicate_object then null; end $$;
