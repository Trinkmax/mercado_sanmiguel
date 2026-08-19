-- ============================================================
-- Mercado San Miguel — Seed fase 2 (se aplica después de seed.sql)
-- Usuarios demo nuevos (pass SanMiguel2026):
--   lider@sanmiguel.coop    → Líder de Procesos (Franco Delucchi)
--   porteria@sanmiguel.coop → Portería (Luis Aguirre), registra ingresos, no cobra
-- consejo@ pasa a llamarse "Consejo Directivo"; guardia@ (Jorge Ferreyra) es el
-- Jefe de Portería (el que cobra).
-- ============================================================

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new)
values
('00000000-0000-0000-0000-000000000000', 'b0000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated',
 'lider@sanmiguel.coop',    crypt('SanMiguel2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"nombre":"Franco Delucchi"}', now(), now(), '', '', '', ''),
('00000000-0000-0000-0000-000000000000', 'b0000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated',
 'porteria@sanmiguel.coop', crypt('SanMiguel2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"nombre":"Luis Aguirre"}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.id in ('b0000000-0000-4000-8000-000000000006','b0000000-0000-4000-8000-000000000007')
and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');

insert into public.perfiles (user_id, org_id, nombre, rol) values
('b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'Franco Delucchi', 'lider'),
('b0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001', 'Luis Aguirre',    'porteria')
on conflict (user_id) do nothing;

update public.perfiles set nombre = 'Consejo Directivo'
where user_id = 'b0000000-0000-4000-8000-000000000004' and nombre = 'Franco Delucchi';

-- ---------- Configuración: cobro por día en portería ----------
update public.configuracion set
  precio_canon_ambulante = coalesce(nullif(precio_canon_ambulante, 0), 5000),
  precio_canon_quintero_dia = coalesce(nullif(precio_canon_quintero_dia, 0), 15000)
where org_id = 'a0000000-0000-4000-8000-000000000001';

-- ---------- Apodos de puesteros (se ven en el mapa) ----------
update public.clientes set apodo = v.apodo
from (values
  ('c0000000-0000-4000-8000-000000000001'::uuid, 'Don Pedro'),
  ('c0000000-0000-4000-8000-000000000002'::uuid, 'Del Valle'),
  ('c0000000-0000-4000-8000-000000000003'::uuid, 'Rosa'),
  ('c0000000-0000-4000-8000-000000000004'::uuid, 'Los Álamos'),
  ('c0000000-0000-4000-8000-000000000005'::uuid, 'Santa Rita'),
  ('c0000000-0000-4000-8000-000000000006'::uuid, 'El Progreso'),
  ('c0000000-0000-4000-8000-000000000007'::uuid, 'Carnes'),
  ('c0000000-0000-4000-8000-000000000008'::uuid, 'Los Ríos'),
  ('c0000000-0000-4000-8000-000000000009'::uuid, 'Depósito Sur'),
  ('c0000000-0000-4000-8000-000000000010'::uuid, 'La Económica'),
  ('c0000000-0000-4000-8000-000000000011'::uuid, 'El Ceibo'),
  ('c0000000-0000-4000-8000-000000000012'::uuid, 'Juárez')
) as v(id, apodo)
where clientes.id = v.id and clientes.apodo is null;

-- ---------- Personal ----------
insert into public.empleados (id, org_id, nombre, apellido, dni, cuil, cargo, tipo_contrato, fecha_ingreso, telefono, activo, creado_por) values
('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Jorge',  'Ferreyra', '22345678', '20-22345678-4', 'Jefe de Portería', 'planta_permanente', '2019-03-01', '351 555-0201', true, 'b0000000-0000-4000-8000-000000000006'),
('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Luis',   'Aguirre',  '30123456', '20-30123456-7', 'Portería',         'planta_permanente', '2022-08-15', '351 555-0202', true, 'b0000000-0000-4000-8000-000000000006'),
('e0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Marta',  'Núñez',    '18765432', '27-18765432-9', 'Administración',   'planta_permanente', '2015-06-01', '351 555-0203', true, 'b0000000-0000-4000-8000-000000000006'),
('e0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'Carlos', 'Medina',   '35678901', '20-35678901-1', 'Limpieza',         'contratado',        '2024-02-01', '351 555-0204', true, 'b0000000-0000-4000-8000-000000000006'),
('e0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'Ramón',  'Sosa',     '28901234', '20-28901234-3', 'Mantenimiento',    'monotributista',    '2023-05-10', '351 555-0205', true, 'b0000000-0000-4000-8000-000000000006')
on conflict (id) do nothing;

insert into public.empleado_horarios (org_id, empleado_id, dia_semana, hora_desde, hora_hasta)
select 'a0000000-0000-4000-8000-000000000001', e.id, d, h.desde, h.hasta
from public.empleados e
cross join generate_series(1, 6) as d
cross join lateral (
  select case when e.cargo in ('Jefe de Portería','Portería') then time '04:00' else time '07:00' end as desde,
         case when e.cargo in ('Jefe de Portería','Portería') then time '12:00' else time '15:00' end as hasta
) h
where e.org_id = 'a0000000-0000-4000-8000-000000000001'
  and e.id in ('e0000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000003','e0000000-0000-4000-8000-000000000004','e0000000-0000-4000-8000-000000000005')
  and not exists (select 1 from public.empleado_horarios x where x.empleado_id = e.id);

-- ---------- Términos y condiciones del portal (v1) ----------
insert into public.terminos (id, org_id, version, titulo, contenido, vigente, creado_por) values
('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 1, 'Términos y condiciones del portal de socios',
E'1. El portal es un servicio de la Cooperativa Mercado San Miguel para que cada socio consulte su estado de cuenta, sus pagos, su documentación y las comunicaciones de la cooperativa.\n\n2. La información del portal es de uso personal del socio. El acceso (usuario y contraseña) es intransferible; el socio es responsable de su resguardo.\n\n3. Los importes exhibidos son informativos y se actualizan con cada cobro registrado en administración o portería. Ante una diferencia, el comprobante emitido por la cooperativa es el documento válido.\n\n4. Las circulares publicadas en el portal se consideran notificadas al socio al confirmar su recepción. La cooperativa podrá requerir esa confirmación para continuar operando el portal.\n\n5. Las solicitudes enviadas por el portal son recibidas por administración y revisadas por el Líder de Procesos; la cooperativa responde por el mismo canal.\n\n6. La cooperativa protege los datos personales del socio conforme a la Ley 25.326 y no los comparte con terceros ajenos a la gestión del mercado.\n\n7. Estos términos pueden actualizarse; la nueva versión se presentará en el portal y requerirá una nueva aceptación.',
true, 'b0000000-0000-4000-8000-000000000006')
on conflict (id) do nothing;

-- ---------- Circular con recepción obligatoria ----------
insert into public.circulares (id, org_id, titulo, detalle, fecha, obligatoria, activa, creada_por) values
('f1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
 'Horario de ingreso de camiones — temporada alta',
 E'Se informa a todos los socios que a partir del lunes 24/08 el ingreso de camiones al playón será de 03:00 a 09:00. Fuera de ese horario se cobrará canon doble. Las quintas mantienen el horario habitual.\n\nPor consultas, comunicarse con administración.',
 '2026-08-18', true, true, 'b0000000-0000-4000-8000-000000000006')
on conflict (id) do nothing;

-- ---------- Solicitudes (ex Peticiones) con hilo de mensajes ----------
insert into public.solicitudes (id, org_id, tipo, asunto, detalle, cliente_id, origen, estado, creada_por, creada_en, actualizada_en) values
('f2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'solicitud',
 'Pedido de medio puesto más en Nave A',
 'Solicito ampliar mi puesto con el medio puesto lindero (quedó libre el mes pasado). Estoy al día con las expensas.',
 'c0000000-0000-4000-8000-000000000012', 'portal', 'en_consejo', 'b0000000-0000-4000-8000-000000000005', '2026-08-10 09:15-03', '2026-08-17 11:00-03'),
('f2000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'reclamo',
 'Luminaria rota frente al puesto 7',
 'Desde la semana pasada no anda la luz del pasillo frente al puesto 7. De madrugada no se ve nada.',
 'c0000000-0000-4000-8000-000000000002', 'porteria', 'asignada', 'b0000000-0000-4000-8000-000000000007', '2026-08-14 05:40-03', '2026-08-18 10:30-03'),
('f2000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'informe',
 'Camión descargó fuera del playón',
 'Informe de portería: el 17/08 a las 04:10 un camión patente AC123BD descargó en el acceso este, obstruyendo el paso. Se le indicó mover el vehículo.',
 null, 'porteria', 'nueva', 'b0000000-0000-4000-8000-000000000002', '2026-08-17 06:00-03', '2026-08-17 06:00-03')
on conflict (id) do nothing;

update public.solicitudes set
  revisada_por = 'b0000000-0000-4000-8000-000000000006', revisada_en = '2026-08-11 10:00-03',
  derivada_consejo_en = '2026-08-17 11:00-03'
where id = 'f2000000-0000-4000-8000-000000000001' and derivada_consejo_en is null;

update public.solicitudes set
  revisada_por = 'b0000000-0000-4000-8000-000000000006', revisada_en = '2026-08-15 09:00-03',
  resolucion = 'Que mantenimiento reponga la luminaria esta semana y administración informe al socio.',
  resuelta_por = 'b0000000-0000-4000-8000-000000000006', resuelta_en = '2026-08-18 10:30-03',
  asignada_en = '2026-08-18 10:30-03'
where id = 'f2000000-0000-4000-8000-000000000002' and asignada_en is null;

insert into public.solicitud_mensajes (org_id, solicitud_id, autor_id, autor_nombre, autor_rol, mensaje, interno, creado_en)
select * from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'f2000000-0000-4000-8000-000000000001'::uuid, 'b0000000-0000-4000-8000-000000000001'::uuid, 'Marta Núñez', 'admin'::public.rol_usuario, 'Recibido, Roberto. Lo pasamos al Líder de Procesos para que lo revise.', false, '2026-08-10 10:00-03'::timestamptz),
  ('a0000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000006', 'Franco Delucchi', 'lider', 'Tomó la solicitud para revisarla.', false, '2026-08-11 10:00-03'),
  ('a0000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000006', 'Franco Delucchi', 'lider', 'Derivó la solicitud al Consejo. Se trata en la reunión del 21/08.', false, '2026-08-17 11:00-03'),
  ('a0000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000005', 'Roberto Juárez', 'socio', 'Gracias. Quedo atento a lo que resuelva el Consejo.', false, '2026-08-17 12:20-03'),
  ('a0000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000006', 'Franco Delucchi', 'lider', 'Resolución: Que mantenimiento reponga la luminaria esta semana y administración informe al socio.', false, '2026-08-18 10:30-03'),
  ('a0000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000006', 'Franco Delucchi', 'lider', 'Asignó la resolución a Administración.', false, '2026-08-18 10:31-03')
) as v(org_id, solicitud_id, autor_id, autor_nombre, autor_rol, mensaje, interno, creado_en)
where not exists (select 1 from public.solicitud_mensajes m where m.solicitud_id = 'f2000000-0000-4000-8000-000000000001');

-- ---------- Un cambio pendiente de aprobación (lo pidió administración) ----------
insert into public.cambios_pendientes (id, org_id, entidad, accion, entidad_id, cliente_id, datos, datos_anteriores, resumen, solicitado_por, solicitado_en)
select 'f3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'cliente', 'modificacion', c.id, c.id,
  jsonb_build_object('telefono', '351 555-0199', 'email', 'donpedro.verduleria@gmail.com'),
  to_jsonb(c) - 'org_id',
  'Actualizar teléfono y email de Verdulería Don Pedro',
  'b0000000-0000-4000-8000-000000000001', '2026-08-18 16:40-03'
from public.clientes c where c.id = 'c0000000-0000-4000-8000-000000000001'
on conflict (id) do nothing;

-- ---------- Caja de portería rendida (cerrada) esperando integración ----------
insert into public.cajas (id, org_id, tipo, fecha, estado, abierta_por, abierta_en, cerrada_por, cerrada_en)
values ('d0000000-0000-4000-8000-000000000021', 'a0000000-0000-4000-8000-000000000001', 'guardia', '2026-08-18', 'abierta',
  'b0000000-0000-4000-8000-000000000002', '2026-08-18 04:05-03', null, null)
on conflict (org_id, tipo, fecha) do nothing;

insert into public.canon_camiones (org_id, caja_id, fecha, cantidad, monto, medio, tipo, creado_por, creado_en)
select 'a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000021', '2026-08-18', v.cant, v.monto, 'efectivo', v.tipo, 'b0000000-0000-4000-8000-000000000002', v.creado
from (values
  (9, 72000::numeric, 'camion', '2026-08-18 05:30-03'::timestamptz),
  (4, 20000::numeric, 'ambulante', '2026-08-18 06:10-03'::timestamptz),
  (2, 30000::numeric, 'quintero', '2026-08-18 06:45-03'::timestamptz)
) as v(cant, monto, tipo, creado)
where exists (select 1 from public.cajas c where c.id = 'd0000000-0000-4000-8000-000000000021' and c.estado = 'abierta')
  and not exists (select 1 from public.canon_camiones x where x.caja_id = 'd0000000-0000-4000-8000-000000000021');

update public.cajas set
  estado = 'cerrada', cerrada_por = 'b0000000-0000-4000-8000-000000000002', cerrada_en = '2026-08-18 12:05-03',
  total_efectivo = 122000, total_transferencia = 0, total_cheques = 0, total_canon = 122000, total_gastos = 0
where id = 'd0000000-0000-4000-8000-000000000021' and estado = 'abierta';

insert into public.caja_eventos (org_id, caja_id, tipo, detalle, usuario_id, creado_en)
select 'a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000021', v.tipo, v.detalle, 'b0000000-0000-4000-8000-000000000002', v.creado
from (values
  ('apertura', null::text, '2026-08-18 04:05-03'::timestamptz),
  ('cierre', null::text, '2026-08-18 12:05-03'::timestamptz)
) as v(tipo, detalle, creado)
where not exists (select 1 from public.caja_eventos e where e.caja_id = 'd0000000-0000-4000-8000-000000000021');
