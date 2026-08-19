-- ============================================================
-- Mercado San Miguel — Seed de demo
-- Org + catálogos + usuarios por rol + clientes + actividad
-- de julio (cobrada en parte) y agosto 2026 (recién generado).
-- Contraseña de todos los usuarios demo: SanMiguel2026
-- Después de este archivo, correr supabase/seed_fase2.sql (usuarios lider@ y
-- porteria@, personal, solicitudes, circular, términos, rendición de portería).
-- ============================================================

-- ---------- Organización y configuración ----------
insert into public.organizaciones (id, nombre, slug)
values ('a0000000-0000-4000-8000-000000000001', 'Cooperativa Mercado San Miguel', 'san-miguel')
on conflict (id) do nothing;

insert into public.configuracion (org_id, dia_vencimiento, precio_canon_camion)
values ('a0000000-0000-4000-8000-000000000001', 30, 8000)
on conflict (org_id) do nothing;

-- ---------- Conceptos (códigos oficiales, orden = prioridad de cobro) ----------
insert into public.conceptos (org_id, codigo, nombre, tipo, precio, orden_imputacion, descuento_pronto_pago, activo) values
('a0000000-0000-4000-8000-000000000001', 'EXPC', 'Alquiler Cocheras',      'recurrente', 31000,    10, 0,  true),
('a0000000-0000-4000-8000-000000000001', 'EXCO', 'Contribución Puestos',   'recurrente', 25000,    20, 0,  true),
('a0000000-0000-4000-8000-000000000001', 'EXPQ', 'Expensas Quinteros',     'recurrente', 300000,   30, 0,  true),
('a0000000-0000-4000-8000-000000000001', 'EXPP', 'Expensas Puestos',       'recurrente', 1080000,  40, 15, true),
('a0000000-0000-4000-8000-000000000001', 'EXPL', 'Expensas Locales',       'recurrente', 450000,   50, 0,  true),
('a0000000-0000-4000-8000-000000000001', 'EXPG', 'Expensas Galpón',        'recurrente', 120000,   60, 0,  true),
('a0000000-0000-4000-8000-000000000001', 'EXPE', 'Expensas Contéiner',     'recurrente', 80000,    70, 0,  true),
('a0000000-0000-4000-8000-000000000001', 'ENER', 'Recupero Energía (kWh)', 'energia',    600,      80, 0,  true),
('a0000000-0000-4000-8000-000000000001', 'EXME', 'Expensas Cobradas',      'recurrente', 0,        90, 0,  false),
('a0000000-0000-4000-8000-000000000001', 'RD',   'Reconocimiento de Deuda','deuda',      0,        95, 0,  true),
('a0000000-0000-4000-8000-000000000001', 'BC',   'Canon Camiones',         'canon_diario', 8000,  100, 0,  true)
on conflict (org_id, codigo) do nothing;

-- ---------- Rubros de gasto ----------
insert into public.rubros_gasto (org_id, codigo, nombre) values
('a0000000-0000-4000-8000-000000000001', 'AD',    'Gastos de Administración'),
('a0000000-0000-4000-8000-000000000001', 'AGUA',  'Agua de Malagueño'),
('a0000000-0000-4000-8000-000000000001', 'ALQ',   'Alquiler del Predio'),
('a0000000-0000-4000-8000-000000000001', 'APOR',  'Aportes y Contribuciones'),
('a0000000-0000-4000-8000-000000000001', 'BU',    'Bienes de Uso'),
('a0000000-0000-4000-8000-000000000001', 'COMB',  'Combustible'),
('a0000000-0000-4000-8000-000000000001', 'CONT',  'Contenedores'),
('a0000000-0000-4000-8000-000000000001', 'DO',    'Donaciones Varias'),
('a0000000-0000-4000-8000-000000000001', 'FENA',  'Fenaonfra'),
('a0000000-0000-4000-8000-000000000001', 'GE',    'Gastos de Energía'),
('a0000000-0000-4000-8000-000000000001', 'GG',    'Gastos Generales'),
('a0000000-0000-4000-8000-000000000001', 'IVA',   'Impuesto al Valor Agregado'),
('a0000000-0000-4000-8000-000000000001', 'GL',    'Gastos de Limpieza'),
('a0000000-0000-4000-8000-000000000001', 'GLS',   'Limpieza y Seguridad'),
('a0000000-0000-4000-8000-000000000001', 'GM',    'Gastos de Mantenimiento'),
('a0000000-0000-4000-8000-000000000001', 'GMC',   'Gastos de Mantenimiento COM'),
('a0000000-0000-4000-8000-000000000001', 'GR',    'Gastos de Representación'),
('a0000000-0000-4000-8000-000000000001', 'GT',    'Gastos de Teléfono'),
('a0000000-0000-4000-8000-000000000001', 'HONO',  'Honorarios Profesionales'),
('a0000000-0000-4000-8000-000000000001', 'MUNI',  'Impuesto Municipal'),
('a0000000-0000-4000-8000-000000000001', 'PP',    'Publicidad y Propaganda'),
('a0000000-0000-4000-8000-000000000001', 'REPU',  'Repuestos y Reparaciones'),
('a0000000-0000-4000-8000-000000000001', 'RP',    'Ropa de Trabajo Personal'),
('a0000000-0000-4000-8000-000000000001', 'SEGUV', 'Seguros Varios'),
('a0000000-0000-4000-8000-000000000001', 'SEGU',  'Seguros del Personal'),
('a0000000-0000-4000-8000-000000000001', 'SENASA','SENASA'),
('a0000000-0000-4000-8000-000000000001', 'SIND',  'Sindicato Personal - UTEDYC'),
('a0000000-0000-4000-8000-000000000001', 'SJ',    'Sueldos y Jornales'),
('a0000000-0000-4000-8000-000000000001', 'GINT',  'Gastos de Internet'),
('a0000000-0000-4000-8000-000000000001', 'BIO',   'Tratamiento de Residuos')
on conflict (org_id, codigo) do nothing;

-- ---------- Usuarios demo (password: SanMiguel2026) ----------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new)
values
('00000000-0000-0000-0000-000000000000', 'b0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
 'admin@sanmiguel.coop',    crypt('SanMiguel2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"nombre":"Marta Núñez"}', now(), now(), '', '', '', ''),
('00000000-0000-0000-0000-000000000000', 'b0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
 'guardia@sanmiguel.coop',  crypt('SanMiguel2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"nombre":"Jorge Ferreyra"}', now(), now(), '', '', '', ''),
('00000000-0000-0000-0000-000000000000', 'b0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
 'tesorera@sanmiguel.coop', crypt('SanMiguel2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"nombre":"Silvia Camaño"}', now(), now(), '', '', '', ''),
('00000000-0000-0000-0000-000000000000', 'b0000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
 'consejo@sanmiguel.coop',  crypt('SanMiguel2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"nombre":"Franco Delucchi"}', now(), now(), '', '', '', ''),
('00000000-0000-0000-0000-000000000000', 'b0000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated',
 'socio@sanmiguel.coop',    crypt('SanMiguel2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"nombre":"Roberto Juárez"}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.id in (
  'b0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000002',
  'b0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000004',
  'b0000000-0000-4000-8000-000000000005')
and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');

insert into public.perfiles (user_id, org_id, nombre, rol) values
('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Marta Núñez',     'admin'),
('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Jorge Ferreyra',  'guardia'),
('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Silvia Camaño',   'tesoreria'),
('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'Franco Delucchi', 'consejo'),
('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'Roberto Juárez',  'socio')
on conflict (user_id) do nothing;

-- ---------- Clientes ----------
insert into public.clientes (id, org_id, codigo, nombre, tipo_persona, cuit, telefono, email, cuotas_mes, auth_user_id) values
('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 1,  'Verdulería Don Pedro · Pedro Gómez', 'fisica',  '20-12345678-3', '351 555-0101', null, 4, null),
('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 2,  'Frutas del Valle SAS', 'juridica', '30-71234567-9', '351 555-0102', 'frutasdelvalle@gmail.com', 1, null),
('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 3,  'La Huerta de Rosa', 'fisica', '27-23456789-1', '351 555-0103', null, 1, null),
('c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 4,  'Quinta Los Álamos · Raúl Benítez', 'fisica', '20-18765432-5', '351 555-0104', null, 2, null),
('c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 5,  'Quinta Santa Rita', 'fisica', '23-20987654-4', '351 555-0105', null, 1, null),
('c0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 6,  'Minimarket El Progreso', 'fisica', '20-25678901-2', '351 555-0106', null, 1, null),
('c0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001', 7,  'Carnes Malagueño SRL', 'juridica', '30-70987654-3', '351 555-0107', 'carnesmalagueno@gmail.com', 1, null),
('c0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001', 8,  'Pollos Hnos. Ríos', 'fisica', '20-31234567-8', '351 555-0108', null, 7, null),
('c0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000001', 9,  'Depósito Sur', 'fisica', '20-27890123-6', '351 555-0109', null, 1, null),
('c0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000001', 10, 'Verdulería La Económica', 'fisica', '27-29012345-7', '351 555-0110', null, 2, null),
('c0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000001', 11, 'Quinta El Ceibo', 'fisica', '20-16543210-9', '351 555-0111', null, 1, null),
('c0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000001', 12, 'Puesto Juárez e Hijos · Roberto Juárez', 'fisica', '20-14567890-1', '351 555-0112', 'socio@sanmiguel.coop', 2, 'b0000000-0000-4000-8000-000000000005')
on conflict (id) do nothing;

-- ---------- Ítems por cliente ----------
insert into public.cliente_conceptos (org_id, cliente_id, concepto_id, cantidad)
select 'a0000000-0000-4000-8000-000000000001', v.cliente, c.id, v.cantidad
from (values
  ('c0000000-0000-4000-8000-000000000001'::uuid, 'EXPP', 1.5),
  ('c0000000-0000-4000-8000-000000000001'::uuid, 'EXPG', 1.0),
  ('c0000000-0000-4000-8000-000000000001'::uuid, 'EXPC', 2.0),
  ('c0000000-0000-4000-8000-000000000002'::uuid, 'EXPP', 2.0),
  ('c0000000-0000-4000-8000-000000000002'::uuid, 'EXPE', 1.0),
  ('c0000000-0000-4000-8000-000000000003'::uuid, 'EXPP', 0.5),
  ('c0000000-0000-4000-8000-000000000004'::uuid, 'EXPQ', 2.0),
  ('c0000000-0000-4000-8000-000000000005'::uuid, 'EXPQ', 1.0),
  ('c0000000-0000-4000-8000-000000000006'::uuid, 'EXPL', 1.0),
  ('c0000000-0000-4000-8000-000000000007'::uuid, 'EXPP', 2.0),
  ('c0000000-0000-4000-8000-000000000007'::uuid, 'EXPC', 1.0),
  ('c0000000-0000-4000-8000-000000000007'::uuid, 'EXCO', 1.0),
  ('c0000000-0000-4000-8000-000000000008'::uuid, 'EXPP', 1.0),
  ('c0000000-0000-4000-8000-000000000009'::uuid, 'EXPG', 2.0),
  ('c0000000-0000-4000-8000-000000000009'::uuid, 'EXPE', 2.0),
  ('c0000000-0000-4000-8000-000000000010'::uuid, 'EXPP', 1.0),
  ('c0000000-0000-4000-8000-000000000010'::uuid, 'EXPC', 1.0),
  ('c0000000-0000-4000-8000-000000000011'::uuid, 'EXPQ', 1.5),
  ('c0000000-0000-4000-8000-000000000012'::uuid, 'EXPP', 1.0),
  ('c0000000-0000-4000-8000-000000000012'::uuid, 'EXPG', 1.0)
) as v(cliente, codigo, cantidad)
join public.conceptos c on c.org_id = 'a0000000-0000-4000-8000-000000000001' and c.codigo = v.codigo
on conflict (cliente_id, concepto_id) do nothing;

-- ---------- Medidores ----------
insert into public.medidores (id, org_id, cliente_id, numero, ubicacion) values
('aa000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'M-001', 'Puesto 4 — Nave A'),
('aa000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'M-002', 'Galpón 2'),
('aa000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'M-003', 'Puesto 7 — Nave A'),
('aa000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 'M-004', 'Puesto 11 — Nave B'),
('aa000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000006', 'M-005', 'Local 3 — Exterior'),
('aa000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000007', 'M-006', 'Puesto 15 — Nave B'),
('aa000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000008', 'M-007', 'Puesto 18 — Nave C'),
('aa000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000010', 'M-008', 'Puesto 21 — Nave C'),
('aa000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000012', 'M-009', 'Puesto 24 — Nave C')
on conflict (id) do nothing;

-- ---------- Períodos ----------
insert into public.periodos (org_id, periodo, vencimiento, estado, generado_en, generado_por) values
('a0000000-0000-4000-8000-000000000001', '2026-07-01', '2026-07-30', 'abierto', '2026-07-01 09:00-03', 'b0000000-0000-4000-8000-000000000001'),
('a0000000-0000-4000-8000-000000000001', '2026-08-01', '2026-08-30', 'abierto', '2026-08-01 09:00-03', 'b0000000-0000-4000-8000-000000000001')
on conflict (org_id, periodo) do nothing;

-- ---------- Lecturas de julio ----------
insert into public.lecturas (id, org_id, medidor_id, periodo, lectura_anterior, lectura_actual, precio_kwh, fecha_lectura, creado_por) values
('ab000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000001', '2026-07-01', 1200, 1520, 600, '2026-07-24', 'b0000000-0000-4000-8000-000000000001'),
('ab000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000002', '2026-07-01', 800,  950,  600, '2026-07-24', 'b0000000-0000-4000-8000-000000000001'),
('ab000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000003', '2026-07-01', 2000, 2400, 600, '2026-07-24', 'b0000000-0000-4000-8000-000000000001'),
('ab000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000004', '2026-07-01', 500,  600,  600, '2026-07-24', 'b0000000-0000-4000-8000-000000000001'),
('ab000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000005', '2026-07-01', 1000, 1250, 600, '2026-07-24', 'b0000000-0000-4000-8000-000000000001'),
('ab000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000006', '2026-07-01', 3000, 3500, 600, '2026-07-24', 'b0000000-0000-4000-8000-000000000001'),
('ab000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000007', '2026-07-01', 900,  1080, 600, '2026-07-24', 'b0000000-0000-4000-8000-000000000001'),
('ab000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000008', '2026-07-01', 400,  610,  600, '2026-07-24', 'b0000000-0000-4000-8000-000000000001'),
('ab000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000009', '2026-07-01', 700,  790,  600, '2026-07-24', 'b0000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

-- ---------- Cargos de julio y agosto (generación mensual) ----------
insert into public.cargos (org_id, periodo, cliente_id, concepto_id, codigo, descripcion, cantidad, precio_unitario, monto, descuento_pronto_pago, vencimiento, origen, creado_en)
select cc.org_id, p.periodo, cc.cliente_id, co.id, co.codigo,
  co.nombre || case when cc.cantidad <> 1 then ' × ' || trim(trailing '.' from trim(trailing '0' from cc.cantidad::text)) else '' end,
  cc.cantidad, co.precio, round(cc.cantidad * co.precio, 2), co.descuento_pronto_pago, p.vencimiento, 'generacion', p.periodo::timestamptz
from public.cliente_conceptos cc
join public.conceptos co on co.id = cc.concepto_id
cross join (values ('2026-07-01'::date, '2026-07-30'::date), ('2026-08-01'::date, '2026-08-30'::date)) as p(periodo, vencimiento)
where cc.org_id = 'a0000000-0000-4000-8000-000000000001' and co.tipo = 'recurrente'
on conflict (cliente_id, concepto_id, periodo) where origen = 'generacion' and estado <> 'anulado' do nothing;

-- Cargos de energía de julio (desde lecturas)
insert into public.cargos (org_id, periodo, cliente_id, concepto_id, codigo, descripcion, cantidad, precio_unitario, monto, descuento_pronto_pago, vencimiento, origen, origen_lectura, creado_en)
select l.org_id, l.periodo, m.cliente_id, co.id, co.codigo,
  'Energía · Medidor N° ' || m.numero || ' (' || l.kwh || ' kWh)',
  l.kwh, l.precio_kwh, l.monto, 0, '2026-07-30', 'energia', l.id, '2026-07-24'::timestamptz
from public.lecturas l
join public.medidores m on m.id = l.medidor_id
join public.conceptos co on co.org_id = l.org_id and co.codigo = 'ENER'
where l.org_id = 'a0000000-0000-4000-8000-000000000001' and l.periodo = '2026-07-01'
  and not exists (select 1 from public.cargos c where c.origen_lectura = l.id);

-- ============================================================
-- Actividad de julio: cajas, cobros, imputaciones, cheques
-- ============================================================

-- ---------- Cajas ----------
insert into public.cajas (id, org_id, tipo, fecha, estado, abierta_por, abierta_en, total_efectivo, total_transferencia, total_cheques, total_canon, total_gastos, cerrada_por, cerrada_en, validada_por, validada_en) values
('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'administracion', '2026-07-28', 'validada', 'b0000000-0000-4000-8000-000000000001', '2026-07-28 08:30-03', 2575000, 1611000, 2192000, 0, 0, 'b0000000-0000-4000-8000-000000000001', '2026-07-28 18:10-03', 'b0000000-0000-4000-8000-000000000003', '2026-07-29 10:05-03'),
('d0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'guardia', '2026-07-29', 'validada', 'b0000000-0000-4000-8000-000000000002', '2026-07-29 06:00-03', 996000, 450000, 0, 96000, 0, 'b0000000-0000-4000-8000-000000000002', '2026-07-29 14:40-03', 'b0000000-0000-4000-8000-000000000003', '2026-07-30 09:45-03'),
('d0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'administracion', '2026-07-31', 'cerrada', 'b0000000-0000-4000-8000-000000000001', '2026-07-31 08:30-03', 0, 0, 1000000, 0, 0, 'b0000000-0000-4000-8000-000000000001', '2026-07-31 18:00-03', null, null)
on conflict (id) do nothing;

-- ---------- Cheques ----------
insert into public.cheques (id, org_id, cliente_id, numero, banco, titular, es_tercero, monto, fecha_recibido, fecha_cobro, estado, fecha_depositado, fecha_acreditado, creado_por) values
('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000007', '00012345', 'Banco Nación', 'Carnes Malagueño SRL', false, 2192000, '2026-07-28', '2026-07-28', 'acreditado', '2026-07-29', '2026-08-01', 'b0000000-0000-4000-8000-000000000001'),
('f0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', '00067890', 'Banco Galicia', 'Distribuidora El Cañito SA', true, 1000000, '2026-07-31', '2026-08-15', 'en_cartera', null, null, 'b0000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

-- ---------- Pagos ----------
insert into public.pagos (id, org_id, cliente_id, caja_id, fecha, medio, monto, cheque_id, recibido_por) values
('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', '2026-07-28 09:15-03', 'transferencia', 519000, null, 'b0000000-0000-4000-8000-000000000001'),
('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000001', '2026-07-28 09:40-03', 'efectivo', 600000, null, 'b0000000-0000-4000-8000-000000000001'),
('e0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000007', 'd0000000-0000-4000-8000-000000000001', '2026-07-28 10:05-03', 'cheque', 2192000, 'f0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001'),
('e0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000009', 'd0000000-0000-4000-8000-000000000001', '2026-07-28 10:30-03', 'efectivo', 400000, null, 'b0000000-0000-4000-8000-000000000001'),
('e0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000010', 'd0000000-0000-4000-8000-000000000001', '2026-07-28 11:00-03', 'efectivo', 1075000, null, 'b0000000-0000-4000-8000-000000000001'),
('e0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000001', '2026-07-28 11:25-03', 'transferencia', 1092000, null, 'b0000000-0000-4000-8000-000000000001'),
('e0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', '2026-07-28 12:10-03', 'efectivo', 500000, null, 'b0000000-0000-4000-8000-000000000001'),
('e0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000002', '2026-07-29 07:20-03', 'efectivo', 600000, null, 'b0000000-0000-4000-8000-000000000002'),
('e0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000002', '2026-07-29 07:45-03', 'efectivo', 300000, null, 'b0000000-0000-4000-8000-000000000002'),
('e0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000002', '2026-07-29 08:10-03', 'transferencia', 450000, null, 'b0000000-0000-4000-8000-000000000002'),
('e0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000003', '2026-07-31 12:00-03', 'cheque', 1000000, 'f0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

-- ---------- Imputaciones + actualización de cargos ----------
-- Pagadores completos de julio (cobrados en término: descuento aplicado en EXPP)
with mapa as (
  select * from (values
    ('c0000000-0000-4000-8000-000000000003'::uuid, 'e0000000-0000-4000-8000-000000000001'::uuid),
    ('c0000000-0000-4000-8000-000000000006'::uuid, 'e0000000-0000-4000-8000-000000000002'::uuid),
    ('c0000000-0000-4000-8000-000000000007'::uuid, 'e0000000-0000-4000-8000-000000000003'::uuid),
    ('c0000000-0000-4000-8000-000000000009'::uuid, 'e0000000-0000-4000-8000-000000000004'::uuid),
    ('c0000000-0000-4000-8000-000000000010'::uuid, 'e0000000-0000-4000-8000-000000000005'::uuid),
    ('c0000000-0000-4000-8000-000000000012'::uuid, 'e0000000-0000-4000-8000-000000000006'::uuid),
    ('c0000000-0000-4000-8000-000000000004'::uuid, 'e0000000-0000-4000-8000-000000000009'::uuid),
    ('c0000000-0000-4000-8000-000000000005'::uuid, 'e0000000-0000-4000-8000-000000000010'::uuid),
    ('c0000000-0000-4000-8000-000000000011'::uuid, 'e0000000-0000-4000-8000-000000000011'::uuid)
  ) as m(cliente_id, pago_id)
)
insert into public.imputaciones (org_id, pago_id, cargo_id, monto)
select c.org_id, m.pago_id, c.id, round(c.monto * (1 - c.descuento_pronto_pago / 100.0), 2)
from public.cargos c
join mapa m on m.cliente_id = c.cliente_id
where c.periodo = '2026-07-01' and c.org_id = 'a0000000-0000-4000-8000-000000000001'
  and not exists (select 1 from public.imputaciones i where i.cargo_id = c.id)
on conflict do nothing;

update public.cargos c set
  monto_pagado = round(c.monto * (1 - c.descuento_pronto_pago / 100.0), 2),
  descuento_aplicado = c.monto - round(c.monto * (1 - c.descuento_pronto_pago / 100.0), 2),
  estado = 'pagado'
where c.periodo = '2026-07-01'
  and c.org_id = 'a0000000-0000-4000-8000-000000000001'
  and c.cliente_id in (
    'c0000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000006',
    'c0000000-0000-4000-8000-000000000007','c0000000-0000-4000-8000-000000000009',
    'c0000000-0000-4000-8000-000000000010','c0000000-0000-4000-8000-000000000012',
    'c0000000-0000-4000-8000-000000000004','c0000000-0000-4000-8000-000000000005',
    'c0000000-0000-4000-8000-000000000011')
  and c.estado = 'pendiente';

-- Cliente 1: pago parcial de 500.000 (EXPC saldada, EXPP parcial)
insert into public.imputaciones (org_id, pago_id, cargo_id, monto)
select c.org_id, 'e0000000-0000-4000-8000-000000000007', c.id, 62000
from public.cargos c
where c.cliente_id = 'c0000000-0000-4000-8000-000000000001' and c.periodo = '2026-07-01' and c.codigo = 'EXPC'
  and not exists (select 1 from public.imputaciones i where i.cargo_id = c.id);
update public.cargos set monto_pagado = 62000, estado = 'pagado'
where cliente_id = 'c0000000-0000-4000-8000-000000000001' and periodo = '2026-07-01' and codigo = 'EXPC' and estado = 'pendiente';

insert into public.imputaciones (org_id, pago_id, cargo_id, monto)
select c.org_id, 'e0000000-0000-4000-8000-000000000007', c.id, 438000
from public.cargos c
where c.cliente_id = 'c0000000-0000-4000-8000-000000000001' and c.periodo = '2026-07-01' and c.codigo = 'EXPP'
  and not exists (select 1 from public.imputaciones i where i.cargo_id = c.id);
update public.cargos set monto_pagado = 438000, estado = 'parcial'
where cliente_id = 'c0000000-0000-4000-8000-000000000001' and periodo = '2026-07-01' and codigo = 'EXPP' and estado = 'pendiente';

-- Cliente 2: pagó 1.000.000 con cheque el 31/7 (fuera de término: sin descuento)
insert into public.imputaciones (org_id, pago_id, cargo_id, monto)
select c.org_id, 'e0000000-0000-4000-8000-000000000008', c.id, 1000000
from public.cargos c
where c.cliente_id = 'c0000000-0000-4000-8000-000000000002' and c.periodo = '2026-07-01' and c.codigo = 'EXPP'
  and not exists (select 1 from public.imputaciones i where i.cargo_id = c.id);
update public.cargos set monto_pagado = 1000000, estado = 'parcial'
where cliente_id = 'c0000000-0000-4000-8000-000000000002' and periodo = '2026-07-01' and codigo = 'EXPP' and estado = 'pendiente';

-- ---------- Canon de camiones (caja del guardia) ----------
insert into public.canon_camiones (org_id, caja_id, fecha, cantidad, monto, medio, notas, creado_por)
select 'a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', '2026-07-29', 12, 96000, 'efectivo', 'Canon del día', 'b0000000-0000-4000-8000-000000000002'
where not exists (select 1 from public.canon_camiones where caja_id = 'd0000000-0000-4000-8000-000000000002');

-- ---------- Gastos ----------
insert into public.gastos (org_id, rubro_id, tipo, descripcion, monto, vencimiento, estado, fecha_pago, medio_pago, pagado_desde, creado_por)
select 'a0000000-0000-4000-8000-000000000001', r.id, v.tipo::public.tipo_gasto, v.descripcion, v.monto, v.vencimiento::date, v.estado::public.estado_gasto, v.fecha_pago::date, v.medio::public.medio_pago, v.desde, 'b0000000-0000-4000-8000-000000000003'
from (values
  ('SJ',   'fijo',     'Sueldos y jornales julio',            4800000, '2026-07-05', 'pagado',    '2026-07-05', 'transferencia', 'tesoreria'),
  ('AGUA', 'fijo',     'Agua de Malagueño julio',              380000, '2026-07-12', 'pagado',    '2026-07-10', 'transferencia', 'tesoreria'),
  ('GINT', 'fijo',     'Internet julio',                        95000, '2026-07-08', 'pagado',    '2026-07-08', 'efectivo',      'tesoreria'),
  ('GLS',  'variable', 'Refuerzo limpieza nave central',       650000, '2026-07-18', 'pagado',    '2026-07-15', 'efectivo',      'tesoreria'),
  ('SJ',   'fijo',     'Sueldos y jornales agosto',           4900000, '2026-08-05', 'pendiente', null,         null,            null),
  ('GINT', 'fijo',     'Internet agosto',                       98000, '2026-08-08', 'pendiente', null,         null,            null),
  ('AGUA', 'fijo',     'Agua de Malagueño agosto',             395000, '2026-08-12', 'pendiente', null,         null,            null),
  ('BIO',  'fijo',     'Tratamiento de residuos agosto',       210000, '2026-08-20', 'pendiente', null,         null,            null)
) as v(rubro, tipo, descripcion, monto, vencimiento, estado, fecha_pago, medio, desde)
join public.rubros_gasto r on r.org_id = 'a0000000-0000-4000-8000-000000000001' and r.codigo = v.rubro
where not exists (
  select 1 from public.gastos g
  where g.org_id = 'a0000000-0000-4000-8000-000000000001' and g.descripcion = v.descripcion
);

-- ---------- Tesorería ----------
insert into public.movimientos_tesoreria (org_id, fecha, tipo, descripcion, monto, creado_por)
select 'a0000000-0000-4000-8000-000000000001', v.fecha::date, v.tipo::public.tipo_mov_tesoreria, v.descripcion, v.monto, 'b0000000-0000-4000-8000-000000000003'
from (values
  ('2026-07-31', 'impuesto', 'Impuesto a los débitos y créditos julio', 118000),
  ('2026-07-31', 'comision', 'Comisión mantenimiento de cuenta',         45000)
) as v(fecha, tipo, descripcion, monto)
where not exists (
  select 1 from public.movimientos_tesoreria m
  where m.org_id = 'a0000000-0000-4000-8000-000000000001' and m.descripcion = v.descripcion
);

insert into public.saldos_iniciales (org_id, medio, monto, fecha, notas) values
('a0000000-0000-4000-8000-000000000001', 'efectivo', 3200000, '2026-07-01', 'Saldo inicial al arrancar el sistema'),
('a0000000-0000-4000-8000-000000000001', 'transferencia', 11500000, '2026-07-01', 'Saldo bancario al arrancar el sistema')
on conflict (org_id, medio) do nothing;

-- ---------- Sanciones y notificaciones ----------
insert into public.sanciones (org_id, cliente_id, tipo, titulo, detalle, fecha, creado_por)
select 'a0000000-0000-4000-8000-000000000001', v.cliente::uuid, v.tipo::public.tipo_sancion, v.titulo, v.detalle, v.fecha::date, 'b0000000-0000-4000-8000-000000000001'
from (values
  ('c0000000-0000-4000-8000-000000000008', 'sancion', 'Obstrucción de pasillo común', 'Cajones apilados fuera del puesto obstruyendo la circulación de la Nave C.', '2026-07-15'),
  ('c0000000-0000-4000-8000-000000000002', 'notificacion', 'Actualizar habilitación SENASA', 'La habilitación de SENASA vence el 31/08/2026. Presentar renovación en administración.', '2026-07-20')
) as v(cliente, tipo, titulo, detalle, fecha)
where not exists (
  select 1 from public.sanciones s where s.cliente_id = v.cliente::uuid and s.titulo = v.titulo
);

-- ============================================================
-- NOTA: sobre esta base se aplicó además un "demo extendido"
-- (clientes 13–30 con ítems y medidores, lecturas de julio,
-- pagos completos/selectivos de julio, pagos de agosto con
-- descuento, cajas validadas del 27/7, 30/7 y 1/8, canon,
-- más gastos, movimientos de tesorería y sanciones), ejecutado
-- directamente contra el proyecto vía MCP. Los datos siguen las
-- mismas convenciones de UUID (c…13-30, aa…10-23, d…05-08,
-- e1…/e2… para pagos por cliente).
-- ============================================================
