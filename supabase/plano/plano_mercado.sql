-- ============================================================
-- Plano real del Mercado San Miguel — generado por supabase/plano/generar.mjs
-- 72 puestos (5 medios, 0 propios), 1 bar, 5 locales, 23 contéiners.
-- Carga INICIAL: borra el plano de la organización antes de insertarlo. Correr una sola
-- vez, con el rol postgres. Si el plano ya está en uso (puestos asignados o marcados
-- como propios, medidores, solicitudes, canon o registros que apuntan a un lugar) NO
-- corre: esos vínculos se perderían (FASE3 §8). Los arreglos se hacen desde el mapa.
-- ============================================================
begin;

do $$
begin
  if exists (select 1 from public.espacios e
              where e.org_id = 'a0000000-0000-4000-8000-000000000001' and (e.cliente_id is not null or e.propio))
     or exists (select 1 from public.medidores m join public.espacios e on e.id = m.espacio_id
                 where e.org_id = 'a0000000-0000-4000-8000-000000000001')
     or exists (select 1 from public.solicitudes s join public.espacios e on e.id = s.espacio_id
                 where e.org_id = 'a0000000-0000-4000-8000-000000000001')
     or exists (select 1 from public.canon_camiones c join public.espacios e on e.id = c.espacio_id
                 where e.org_id = 'a0000000-0000-4000-8000-000000000001')
     or exists (select 1 from public.sanciones s join public.espacios e on e.id = s.espacio_id
                 where e.org_id = 'a0000000-0000-4000-8000-000000000001')
  then
    raise exception 'El plano ya está en uso (puestos asignados o propios, medidores, solicitudes, canon o registros con lugar): recrearlo borraría esos vínculos. Corregí los puestos desde el mapa (Asignar puestos → tocá el puesto).';
  end if;
end $$;

delete from public.espacios where org_id = 'a0000000-0000-4000-8000-000000000001';
delete from public.plano_elementos where org_id = 'a0000000-0000-4000-8000-000000000001';

insert into public.plano_elementos (org_id, tipo, etiqueta, capacidad, x, y, w, h, orden) values
  ('a0000000-0000-4000-8000-000000000001', 'nave', 'Nave', null, 40, 250, 1504, 312, 0),
  ('a0000000-0000-4000-8000-000000000001', 'quinteros', 'Quinteros', null, 436, 358, 288, 96, 1),
  ('a0000000-0000-4000-8000-000000000001', 'quinteros', 'Quinteros', null, 812, 358, 336, 96, 2),
  ('a0000000-0000-4000-8000-000000000001', 'administracion', 'Administración', null, 1436, 358, 92, 96, 3),
  ('a0000000-0000-4000-8000-000000000001', 'cocheras', '36 cocheras', 36, 40, 146, 1504, 50, 4),
  ('a0000000-0000-4000-8000-000000000001', 'cocheras', '20 cocheras', 20, 40, 620, 684, 48, 5),
  ('a0000000-0000-4000-8000-000000000001', 'cocheras', '18 cocheras', 18, 812, 620, 716, 48, 6),
  ('a0000000-0000-4000-8000-000000000001', 'pasillo', 'Pasillo', null, 738, 196, 60, 522, 7),
  ('a0000000-0000-4000-8000-000000000001', 'recinto', 'Contéiners', null, 1680, 40, 170, 150, 8),
  ('a0000000-0000-4000-8000-000000000001', 'recinto', 'Contéiners', null, 1680, 232, 362, 160, 9),
  ('a0000000-0000-4000-8000-000000000001', 'rotulo', 'Contéiners', null, 1031, 814, 278, 20, 10),
  ('a0000000-0000-4000-8000-000000000001', 'rotulo', 'Locales', null, 1596, 742, 80, 20, 11),
  ('a0000000-0000-4000-8000-000000000001', 'invernadero', 'Invernadero', null, 1774, 470, 86, 260, 12),
  ('a0000000-0000-4000-8000-000000000001', 'invernadero', 'Invernadero', null, 1890, 470, 86, 260, 13);

insert into public.espacios (org_id, tipo, numero, medio, propio, grupo, nota, x, y, w, h) values
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '58', false, false, 'g58', null, 56, 264, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '56', false, false, 'g58', null, 104, 264, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '54', false, false, null, null, 152, 264, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '52', false, false, 'g52', null, 200, 264, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '50', false, false, 'g52', null, 248, 264, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '48', false, false, 'g52', null, 296, 264, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '46', false, false, 'g52', null, 344, 264, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '44', false, false, 'g44', null, 392, 264, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '42', false, false, 'g44', null, 440, 264, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '40', false, false, null, null, 488, 264, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '38', false, false, null, null, 536, 264, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '36', false, false, null, null, 584, 264, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '34', true, false, null, null, 648, 264, 20, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '32', true, false, null, null, 688, 264, 20, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '30', false, false, null, null, 812, 264, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '28', false, false, null, null, 860, 264, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '26', false, false, null, null, 908, 264, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '22', false, false, 'g22', null, 956, 264, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '24', false, false, 'g22', null, 1004, 264, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '20', false, false, 'g20', null, 1052, 264, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '18', false, false, 'g20', null, 1100, 264, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '16', false, false, null, null, 1148, 264, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '14', false, false, 'g14', null, 1196, 264, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '12', false, false, 'g14', null, 1244, 264, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '10', true, false, null, null, 1292, 264, 20, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '8', true, false, null, null, 1316, 264, 20, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '4', false, false, 'g4', null, 1340, 264, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '6', false, false, 'g4', null, 1388, 264, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '2', false, false, 'g2', null, 1436, 264, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '0', false, false, 'g2', null, 1484, 264, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'bar', null, false, false, null, null, 56, 358, 68, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '76', false, false, null, 'Quiniela', 128, 358, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', null, false, false, null, null, 176, 358, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '62', false, false, null, null, 224, 358, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '64', false, false, null, null, 272, 358, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '68', false, false, null, null, 320, 358, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '72', false, false, null, null, 368, 358, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '66', false, false, null, null, 320, 414, 92, 40),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '71', false, false, null, null, 1172, 358, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '63', false, false, 'g63', null, 1220, 358, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '63', false, false, 'g63', null, 1268, 358, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '61', false, false, null, null, 1316, 358, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '59', false, false, null, null, 1364, 358, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '5', true, false, null, null, 1412, 358, 20, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '69', false, false, null, null, 1268, 414, 44, 40),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '57', false, false, null, null, 56, 496, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '55', false, false, null, null, 104, 496, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '53', false, false, null, null, 152, 496, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '51', false, false, null, null, 200, 496, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '49', false, false, null, null, 248, 496, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '47', false, false, null, null, 296, 496, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '45', false, false, null, null, 344, 496, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '43', false, false, null, null, 392, 496, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '41', false, false, null, null, 440, 496, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '39', false, false, null, null, 488, 496, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '37', false, false, null, null, 536, 496, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '35', false, false, 'g35', null, 584, 496, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '33', false, false, 'g35', null, 632, 496, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '31', false, false, null, null, 680, 496, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '29', false, false, null, null, 812, 496, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '27', false, false, 'g27', null, 860, 496, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '25', false, false, 'g27', null, 908, 496, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '23', false, false, null, null, 956, 496, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '21', false, false, null, null, 1004, 496, 68, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '19', false, false, null, null, 1076, 496, 68, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '15', false, false, null, null, 1148, 496, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '13', false, false, null, null, 1196, 496, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '11', false, false, null, null, 1244, 496, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '9', false, false, null, null, 1292, 496, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '7', false, false, 'g7', null, 1340, 496, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '5', false, false, 'g7', null, 1388, 496, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '3', false, false, null, null, 1436, 496, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'puesto', '1', false, false, null, null, 1484, 496, 44, 52),
  ('a0000000-0000-4000-8000-000000000001', 'contenedor', '1', false, false, null, null, 1702, 56, 46, 46),
  ('a0000000-0000-4000-8000-000000000001', 'contenedor', '2', false, false, null, null, 1776, 92, 46, 46),
  ('a0000000-0000-4000-8000-000000000001', 'contenedor', '3', false, false, null, null, 1702, 128, 46, 46),
  ('a0000000-0000-4000-8000-000000000001', 'contenedor', '4', false, false, null, null, 1698, 286, 86, 52),
  ('a0000000-0000-4000-8000-000000000001', 'contenedor', '5', false, false, null, null, 1804, 260, 46, 46),
  ('a0000000-0000-4000-8000-000000000001', 'contenedor', '6', false, false, null, null, 1862, 260, 46, 46),
  ('a0000000-0000-4000-8000-000000000001', 'contenedor', '7', false, false, null, null, 1920, 260, 46, 46),
  ('a0000000-0000-4000-8000-000000000001', 'contenedor', '8', false, false, null, null, 1978, 260, 46, 46),
  ('a0000000-0000-4000-8000-000000000001', 'contenedor', '9', false, false, null, null, 1804, 318, 46, 46),
  ('a0000000-0000-4000-8000-000000000001', 'contenedor', '10', false, false, null, null, 1862, 318, 46, 46),
  ('a0000000-0000-4000-8000-000000000001', 'contenedor', '11', false, false, null, null, 1920, 318, 46, 46),
  ('a0000000-0000-4000-8000-000000000001', 'contenedor', '12', false, false, null, null, 1978, 318, 46, 46),
  ('a0000000-0000-4000-8000-000000000001', 'contenedor', '13', false, false, null, null, 1031, 700, 46, 46),
  ('a0000000-0000-4000-8000-000000000001', 'contenedor', '14', false, false, null, null, 1089, 700, 46, 46),
  ('a0000000-0000-4000-8000-000000000001', 'contenedor', '15', false, false, null, null, 1147, 700, 46, 46),
  ('a0000000-0000-4000-8000-000000000001', 'contenedor', '16', false, false, null, null, 1205, 700, 46, 46),
  ('a0000000-0000-4000-8000-000000000001', 'contenedor', '17', false, false, null, null, 1263, 700, 46, 46),
  ('a0000000-0000-4000-8000-000000000001', 'contenedor', '18', false, false, null, null, 1031, 758, 46, 46),
  ('a0000000-0000-4000-8000-000000000001', 'contenedor', '19', false, false, null, null, 1089, 758, 46, 46),
  ('a0000000-0000-4000-8000-000000000001', 'contenedor', '20', false, false, null, null, 1147, 758, 46, 46),
  ('a0000000-0000-4000-8000-000000000001', 'contenedor', '21', false, false, null, null, 1205, 758, 46, 46),
  ('a0000000-0000-4000-8000-000000000001', 'contenedor', '22', false, false, null, null, 1263, 758, 46, 46),
  ('a0000000-0000-4000-8000-000000000001', 'local', '5', false, false, null, null, 1614, 470, 44, 40),
  ('a0000000-0000-4000-8000-000000000001', 'local', '4', false, false, null, null, 1614, 524, 44, 40),
  ('a0000000-0000-4000-8000-000000000001', 'local', '3', false, false, null, null, 1614, 578, 44, 40),
  ('a0000000-0000-4000-8000-000000000001', 'local', '2', false, false, null, null, 1614, 632, 44, 40),
  ('a0000000-0000-4000-8000-000000000001', 'local', '1', false, false, null, null, 1614, 686, 44, 40),
  ('a0000000-0000-4000-8000-000000000001', 'contenedor', '23', false, false, null, null, 1832, 770, 86, 52);

commit;
