-- ============================================================
-- 0032 · Plano: galpón con subgalpones, cocheras y playa de quintas asignables
--
-- Relevamiento del 29/09/2026 (dibujos de Ignacio). La geometría sale de
-- supabase/plano/generar.mjs (fuente de verdad); acá se lleva el plano YA CARGADO a esa
-- geometría sin tocar puestos ni asignaciones:
--   · Tipos nuevos de lugar: 'cochera' (EXPC, una por lugar), 'galpon' (EXPG) y 'quinta'
--     (EXPQ); de elemento: 'galpon' (el edificio que contiene a los subgalpones).
--   · El recinto de 9 contéiners es un galpón con 10 subgalpones. Cada uno lleva el número
--     del puesto de quien lo tiene (el 9 tiene dos). Quien ocupaba el contéiner 11 (el
--     cliente 1, que factura 1 galpón y tiene el puesto 1) pasa al subgalpón "1".
--   · Los 10 contéiners bajo las 18 cocheras van en una hilera, del 1 al 10 desde la
--     derecha; el suelto (era el 23) es el 3 y va debajo del invernadero 82.
--   · Locales 86 · 87 · 94 · 80 · 75 (eran 5 · 4 · 3 · 2 · 1, de norte a sur).
--   · 74 cocheras (1–74 de corrido) y 68 quintas en las dos zonas de quinteros.
-- Idempotente: si el galpón ya está, la parte de datos no hace nada.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tipos nuevos
-- ------------------------------------------------------------
alter table public.espacios drop constraint if exists espacios_tipo_check;
alter table public.espacios add constraint espacios_tipo_check
  check (tipo = any (array['puesto', 'bar', 'local', 'contenedor', 'cochera', 'galpon', 'quinta']));

alter table public.plano_elementos drop constraint if exists plano_elementos_tipo_check;
alter table public.plano_elementos add constraint plano_elementos_tipo_check
  check (tipo = any (array['nave', 'pasillo', 'cocheras', 'quinteros', 'administracion', 'invernadero',
                           'recinto', 'rotulo', 'galpon']));


-- ------------------------------------------------------------
-- 2. Etiquetas legibles de los lugares nuevos: "Cochera 12", "Galpón 9", "Quinta 40"
--    (el "puesto" del cheque y la referencia de las solicitudes con lugar).
-- ------------------------------------------------------------
create or replace function private.puestos_cliente(p_cliente uuid)
returns text
language sql stable security definer set search_path = '' as $$
  select string_agg(s.etiqueta, ' · ' order by s.orden_tipo, s.orden_num, s.etiqueta)
  from (
    select distinct
      case e.tipo
        when 'puesto' then 'Puesto ' || coalesce(e.numero, '') || case when e.medio then '½' else '' end
        when 'local' then 'Local ' || coalesce(e.numero, '')
        when 'contenedor' then 'Contéiner ' || coalesce(e.numero, '')
        when 'galpon' then 'Galpón ' || coalesce(e.numero, '')
        when 'cochera' then 'Cochera ' || coalesce(e.numero, '')
        when 'quinta' then 'Quinta ' || coalesce(e.numero, '')
        else btrim('Bar ' || coalesce(e.numero, ''))
      end as etiqueta,
      case e.tipo
        when 'puesto' then 1 when 'local' then 2 when 'contenedor' then 3 when 'galpon' then 4
        when 'cochera' then 5 when 'quinta' then 6 else 7
      end as orden_tipo,
      coalesce(nullif(regexp_replace(coalesce(e.numero, ''), '[^0-9]', '', 'g'), '')::bigint, 0) as orden_num
    from public.espacios e
    where e.cliente_id = p_cliente
  ) s
$$;
revoke all on function private.puestos_cliente(uuid) from public, anon;
grant execute on function private.puestos_cliente(uuid) to authenticated;

-- Igual que 0019 §6, con los lugares nuevos en la referencia ("Galpón 9", no "Galpon 9").
create or replace function private.preparar_solicitud()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_rol public.rol_usuario := private.rol_actual();
  v_esp record;
begin
  -- Semillas / service role: se respeta lo que viene.
  if v_uid is null then return new; end if;

  -- Seguimiento siempre vacío al nacer.
  new.revisada_por := null;
  new.revisada_en := null;
  new.derivada_consejo_en := null;
  new.resolucion := null;
  new.resolucion_de := null;
  new.resuelta_por := null;
  new.resuelta_en := null;
  new.asignada_a := null;
  new.asignada_en := null;
  new.ejecutada_por := null;
  new.ejecutada_en := null;
  new.nota_ejecucion := null;
  new.cerrada_en := null;
  new.elevada_por := null;
  new.elevada_en := null;
  new.creada_por := v_uid;
  new.creada_en := now();
  new.actualizada_en := now();

  -- El origen lo decide el rol de quien la carga (Administración y el Líder eligen: cargan
  -- formularios en papel de otros).
  new.origen := case v_rol
    when 'socio' then 'portal'::public.origen_solicitud
    when 'porteria' then 'porteria'::public.origen_solicitud
    when 'guardia' then 'porteria'::public.origen_solicitud
    when 'tesoreria' then 'tesoreria'::public.origen_solicitud
    when 'admin' then coalesce(new.origen, 'administracion'::public.origen_solicitud)
    when 'lider' then coalesce(new.origen, 'lider'::public.origen_solicitud)
    else coalesce(new.origen, 'lider'::public.origen_solicitud)
  end;

  -- Estado EXACTO del contrato (§4.10): se decide por el ROL de quien carga, no por el
  -- origen. Lo de Portería va al Jefe (si hay uno activo); los avisos del Jefe van al Líder.
  new.estado := case
    when v_rol = 'porteria' and exists (
      select 1 from public.perfiles p
      where p.org_id = new.org_id and p.rol = 'guardia' and p.activo)
    then 'con_jefe'::public.estado_solicitud
    else 'nueva'::public.estado_solicitud
  end;

  -- Con un lugar del plano y sin referencia escrita: "Puesto 58" (el Jefe y Portería no
  -- leen la tabla espacios; ven el puesto por esta referencia).
  if new.espacio_id is not null and coalesce(trim(new.referencia), '') = '' then
    select es.tipo, es.numero, es.medio into v_esp
    from public.espacios es
    where es.id = new.espacio_id and es.org_id = new.org_id;
    if found then
      new.referencia := case v_esp.tipo
        when 'puesto' then 'Puesto ' || coalesce(v_esp.numero, '?') || case when v_esp.medio then '½' else '' end
        when 'local' then 'Local ' || coalesce(v_esp.numero, '?')
        when 'contenedor' then 'Contéiner ' || coalesce(v_esp.numero, '?')
        when 'galpon' then 'Galpón ' || coalesce(v_esp.numero, '?')
        when 'cochera' then 'Cochera ' || coalesce(v_esp.numero, '?')
        when 'quinta' then 'Quinta ' || coalesce(v_esp.numero, '?')
        when 'bar' then coalesce(v_esp.numero, 'Bar')
        else initcap(v_esp.tipo) || ' ' || coalesce(v_esp.numero, '')
      end;
    end if;
  end if;

  return new;
end $$;
revoke all on function private.preparar_solicitud() from public, anon;


-- ------------------------------------------------------------
-- 3. quintas_del_plano(): qué quintero está en cada quinta, para el mapa del Jefe de
--    Portería (G11: no lee la tabla espacios). Solo quintas y solo quinteros activos:
--    nada de quién ocupa un puesto, un local o una cochera.
-- ------------------------------------------------------------
create or replace function public.quintas_del_plano()
returns table (espacio_id uuid, cliente_id uuid)
language sql stable security definer set search_path = '' as $$
  select e.id, e.cliente_id
  from public.espacios e
  join public.clientes c on c.id = e.cliente_id and c.org_id = e.org_id
  where e.org_id = (select private.org_actual())
    and e.tipo = 'quinta'
    and c.activo
    and c.categoria = 'quintero'
    and (select private.tiene_rol(private.org_actual(), array['admin','guardia','lider']::public.rol_usuario[]))
$$;
revoke all on function public.quintas_del_plano() from public, anon;
grant execute on function public.quintas_del_plano() to authenticated;
comment on function public.quintas_del_plano() is
  'Quinta → quintero que la ocupa (solo quinteros activos). Para el mapa del Jefe de Portería, que no lee espacios.';


-- ------------------------------------------------------------
-- 4. El plano cargado → la geometría nueva (una sola vez).
-- ------------------------------------------------------------
do $$
declare
  v_org constant uuid := 'a0000000-0000-4000-8000-000000000001';
  v_ocupados text;
begin
  if not exists (select 1 from public.organizaciones where id = v_org) then return; end if;
  if exists (select 1 from public.plano_elementos where org_id = v_org and tipo = 'galpon') then return; end if;

  -- Del recinto de 9 contéiners solo se sabe a dónde va quien ocupa el 11 (el galpón "1").
  select string_agg(numero, ', ' order by numero::int) into v_ocupados
  from public.espacios
  where org_id = v_org and tipo = 'contenedor' and x >= 1680 and y >= 232 and y < 392
    and cliente_id is not null and not (numero = '11' and x = 1920 and y = 318);
  if v_ocupados is not null then
    raise exception 'Los contéiners % del recinto que pasa a galpón están asignados: reasignalos a mano antes de migrar', v_ocupados;
  end if;

  -- Elementos
  delete from public.plano_elementos
   where org_id = v_org and tipo = 'recinto' and x = 1680 and y = 232;
  update public.plano_elementos set etiqueta = 'Playa de quintas'
   where org_id = v_org and tipo = 'quinteros';
  update public.plano_elementos set x = 955, y = 786, w = 430, h = 20
   where org_id = v_org and tipo = 'rotulo' and etiqueta ilike 'cont%';
  update public.plano_elementos set x = 1605, y = 720, w = 80, h = 20
   where org_id = v_org and tipo = 'rotulo' and etiqueta = 'Locales';
  update public.plano_elementos set x = 1706, y = 580, etiqueta = 'Invernadero 82'
   where org_id = v_org and tipo = 'invernadero' and x = 1774;
  update public.plano_elementos set x = 1822, y = 580
   where org_id = v_org and tipo = 'invernadero' and x = 1890;
  insert into public.plano_elementos (org_id, tipo, etiqueta, capacidad, x, y, w, h, orden)
  values (v_org, 'galpon', 'Galpón', null, 1880, 40, 170, 420, 14);

  -- Subgalpones (número = puesto de quien lo tiene)
  insert into public.espacios (org_id, tipo, numero, nota, x, y, w, h) values
    (v_org, 'galpon', '68', 'Del puesto 68', 1892, 54, 146, 96),
    (v_org, 'galpon', '9', 'Del puesto 9', 1892, 154, 146, 50),
    (v_org, 'galpon', '9', 'Del puesto 9', 1892, 208, 71, 56),
    (v_org, 'galpon', '29', 'Del puesto 29', 1967, 208, 71, 56),
    (v_org, 'galpon', '1', 'Del puesto 1', 1892, 268, 71, 56),
    (v_org, 'galpon', '26', 'Del puesto 26', 1967, 268, 71, 56),
    (v_org, 'galpon', '69', 'Del puesto 69', 1892, 328, 71, 56),
    (v_org, 'galpon', '54', 'Del puesto 54', 1967, 328, 71, 56),
    (v_org, 'galpon', '63', 'Del puesto 63', 1892, 388, 71, 56),
    (v_org, 'galpon', '33', 'Del puesto 33', 1967, 388, 71, 56);

  -- Quien ocupaba el contéiner 11 pasa al subgalpón "1".
  update public.espacios g
     set cliente_id = c.cliente_id, asignado_en = c.asignado_en, actualizado_en = now()
    from public.espacios c
   where g.org_id = v_org and g.tipo = 'galpon' and g.numero = '1'
     and c.org_id = v_org and c.tipo = 'contenedor' and c.numero = '11' and c.x = 1920 and c.y = 318
     and c.cliente_id is not null;
  delete from public.espacios
   where org_id = v_org and tipo = 'contenedor' and x >= 1680 and y >= 232 and y < 392;

  -- Recinto norte: 3 contéiners en caja, uno arriba del otro.
  update public.espacios set x = 1702, y = 64 + (numero::int - 1) * 42, w = 84, h = 30
   where org_id = v_org and tipo = 'contenedor' and y < 200 and numero in ('1', '2', '3');

  -- Los 10 bajo las 18 cocheras (13–22): una hilera, del 1 al 10 desde la derecha.
  update public.espacios
     set numero = (numero::int - 12)::text, x = 955 + (22 - numero::int) * 44, y = 700, w = 34, h = 76
   where org_id = v_org and tipo = 'contenedor' and y >= 700 and y < 810 and numero ~ '^(1[3-9]|2[0-2])$';

  -- El suelto (23) es el 3, debajo del invernadero 82.
  update public.espacios set numero = '3', x = 1707, y = 866, w = 84, h = 34
   where org_id = v_org and tipo = 'contenedor' and numero = '23' and y = 770;

  -- Locales: 5 · 4 · 3 · 2 · 1 → 86 · 87 · 94 · 80 · 75 (de norte a sur).
  update public.espacios l
     set numero = n.nuevo, nota = coalesce(l.nota, n.nota), x = 1614, y = n.y, w = 62, h = 46
    from (values ('5', '86', 'Aug.', 470), ('4', '87', 'Vill.', 519), ('3', '94', 'Luc.', 568),
                 ('2', '80', null, 617), ('1', '75', null, 666)) as n(viejo, nuevo, nota, y)
   where l.org_id = v_org and l.tipo = 'local' and l.numero = n.viejo and l.x = 1614;

  -- Cocheras 1–74 (una por lugar)
  insert into public.espacios (org_id, tipo, numero, nota, x, y, w, h) values
    (v_org, 'cochera', '1', null, 42, 148, 37.78, 46),
    (v_org, 'cochera', '2', null, 83.78, 148, 37.78, 46),
    (v_org, 'cochera', '3', null, 125.56, 148, 37.78, 46),
    (v_org, 'cochera', '4', null, 167.33, 148, 37.78, 46),
    (v_org, 'cochera', '5', null, 209.11, 148, 37.78, 46),
    (v_org, 'cochera', '6', null, 250.89, 148, 37.78, 46),
    (v_org, 'cochera', '7', null, 292.67, 148, 37.78, 46),
    (v_org, 'cochera', '8', null, 334.44, 148, 37.78, 46),
    (v_org, 'cochera', '9', null, 376.22, 148, 37.78, 46),
    (v_org, 'cochera', '10', null, 418, 148, 37.78, 46),
    (v_org, 'cochera', '11', null, 459.78, 148, 37.78, 46),
    (v_org, 'cochera', '12', null, 501.56, 148, 37.78, 46),
    (v_org, 'cochera', '13', null, 543.33, 148, 37.78, 46),
    (v_org, 'cochera', '14', null, 585.11, 148, 37.78, 46),
    (v_org, 'cochera', '15', null, 626.89, 148, 37.78, 46),
    (v_org, 'cochera', '16', null, 668.67, 148, 37.78, 46),
    (v_org, 'cochera', '17', null, 710.44, 148, 37.78, 46),
    (v_org, 'cochera', '18', null, 752.22, 148, 37.78, 46),
    (v_org, 'cochera', '19', null, 794, 148, 37.78, 46),
    (v_org, 'cochera', '20', null, 835.78, 148, 37.78, 46),
    (v_org, 'cochera', '21', null, 877.56, 148, 37.78, 46),
    (v_org, 'cochera', '22', null, 919.33, 148, 37.78, 46),
    (v_org, 'cochera', '23', null, 961.11, 148, 37.78, 46),
    (v_org, 'cochera', '24', null, 1002.89, 148, 37.78, 46),
    (v_org, 'cochera', '25', null, 1044.67, 148, 37.78, 46),
    (v_org, 'cochera', '26', null, 1086.44, 148, 37.78, 46),
    (v_org, 'cochera', '27', null, 1128.22, 148, 37.78, 46),
    (v_org, 'cochera', '28', null, 1170, 148, 37.78, 46),
    (v_org, 'cochera', '29', null, 1211.78, 148, 37.78, 46),
    (v_org, 'cochera', '30', null, 1253.56, 148, 37.78, 46),
    (v_org, 'cochera', '31', null, 1295.33, 148, 37.78, 46),
    (v_org, 'cochera', '32', null, 1337.11, 148, 37.78, 46),
    (v_org, 'cochera', '33', null, 1378.89, 148, 37.78, 46),
    (v_org, 'cochera', '34', null, 1420.67, 148, 37.78, 46),
    (v_org, 'cochera', '35', null, 1462.44, 148, 37.78, 46),
    (v_org, 'cochera', '36', null, 1504.22, 148, 37.78, 46),
    (v_org, 'cochera', '37', null, 42, 622, 30.2, 44),
    (v_org, 'cochera', '38', null, 76.2, 622, 30.2, 44),
    (v_org, 'cochera', '39', null, 110.4, 622, 30.2, 44),
    (v_org, 'cochera', '40', null, 144.6, 622, 30.2, 44),
    (v_org, 'cochera', '41', null, 178.8, 622, 30.2, 44),
    (v_org, 'cochera', '42', null, 213, 622, 30.2, 44),
    (v_org, 'cochera', '43', null, 247.2, 622, 30.2, 44),
    (v_org, 'cochera', '44', null, 281.4, 622, 30.2, 44),
    (v_org, 'cochera', '45', null, 315.6, 622, 30.2, 44),
    (v_org, 'cochera', '46', null, 349.8, 622, 30.2, 44),
    (v_org, 'cochera', '47', null, 384, 622, 30.2, 44),
    (v_org, 'cochera', '48', null, 418.2, 622, 30.2, 44),
    (v_org, 'cochera', '49', null, 452.4, 622, 30.2, 44),
    (v_org, 'cochera', '50', null, 486.6, 622, 30.2, 44),
    (v_org, 'cochera', '51', null, 520.8, 622, 30.2, 44),
    (v_org, 'cochera', '52', null, 555, 622, 30.2, 44),
    (v_org, 'cochera', '53', null, 589.2, 622, 30.2, 44),
    (v_org, 'cochera', '54', null, 623.4, 622, 30.2, 44),
    (v_org, 'cochera', '55', null, 657.6, 622, 30.2, 44),
    (v_org, 'cochera', '56', null, 691.8, 622, 30.2, 44),
    (v_org, 'cochera', '57', null, 814, 622, 35.78, 44),
    (v_org, 'cochera', '58', null, 853.78, 622, 35.78, 44),
    (v_org, 'cochera', '59', null, 893.56, 622, 35.78, 44),
    (v_org, 'cochera', '60', null, 933.33, 622, 35.78, 44),
    (v_org, 'cochera', '61', null, 973.11, 622, 35.78, 44),
    (v_org, 'cochera', '62', null, 1012.89, 622, 35.78, 44),
    (v_org, 'cochera', '63', null, 1052.67, 622, 35.78, 44),
    (v_org, 'cochera', '64', null, 1092.44, 622, 35.78, 44),
    (v_org, 'cochera', '65', null, 1132.22, 622, 35.78, 44),
    (v_org, 'cochera', '66', null, 1172, 622, 35.78, 44),
    (v_org, 'cochera', '67', null, 1211.78, 622, 35.78, 44),
    (v_org, 'cochera', '68', null, 1251.56, 622, 35.78, 44),
    (v_org, 'cochera', '69', null, 1291.33, 622, 35.78, 44),
    (v_org, 'cochera', '70', null, 1331.11, 622, 35.78, 44),
    (v_org, 'cochera', '71', null, 1370.89, 622, 35.78, 44),
    (v_org, 'cochera', '72', null, 1410.67, 622, 35.78, 44),
    (v_org, 'cochera', '73', null, 1450.44, 622, 35.78, 44),
    (v_org, 'cochera', '74', null, 1490.22, 622, 35.78, 44);

  -- Playa de quintas 1–68
  insert into public.espacios (org_id, tipo, numero, nota, x, y, w, h) values
    (v_org, 'quinta', '1', null, 441, 416, 14.47, 34),
    (v_org, 'quinta', '2', null, 457.47, 416, 14.47, 34),
    (v_org, 'quinta', '3', null, 473.94, 416, 14.47, 34),
    (v_org, 'quinta', '4', null, 490.41, 416, 14.47, 34),
    (v_org, 'quinta', '5', null, 506.88, 416, 14.47, 34),
    (v_org, 'quinta', '6', null, 523.35, 416, 14.47, 34),
    (v_org, 'quinta', '7', null, 539.82, 416, 14.47, 34),
    (v_org, 'quinta', '8', null, 556.29, 416, 14.47, 34),
    (v_org, 'quinta', '9', null, 572.76, 416, 14.47, 34),
    (v_org, 'quinta', '10', null, 589.24, 416, 14.47, 34),
    (v_org, 'quinta', '11', null, 605.71, 416, 14.47, 34),
    (v_org, 'quinta', '12', null, 622.18, 416, 14.47, 34),
    (v_org, 'quinta', '13', null, 638.65, 416, 14.47, 34),
    (v_org, 'quinta', '14', null, 655.12, 416, 14.47, 34),
    (v_org, 'quinta', '15', null, 671.59, 416, 14.47, 34),
    (v_org, 'quinta', '16', null, 688.06, 416, 14.47, 34),
    (v_org, 'quinta', '17', null, 704.53, 416, 14.47, 34),
    (v_org, 'quinta', '18', null, 817, 416, 14.4, 34),
    (v_org, 'quinta', '19', null, 833.4, 416, 14.4, 34),
    (v_org, 'quinta', '20', null, 849.8, 416, 14.4, 34),
    (v_org, 'quinta', '21', null, 866.2, 416, 14.4, 34),
    (v_org, 'quinta', '22', null, 882.6, 416, 14.4, 34),
    (v_org, 'quinta', '23', null, 899, 416, 14.4, 34),
    (v_org, 'quinta', '24', null, 915.4, 416, 14.4, 34),
    (v_org, 'quinta', '25', null, 931.8, 416, 14.4, 34),
    (v_org, 'quinta', '26', null, 948.2, 416, 14.4, 34),
    (v_org, 'quinta', '27', null, 964.6, 416, 14.4, 34),
    (v_org, 'quinta', '28', null, 981, 416, 14.4, 34),
    (v_org, 'quinta', '29', null, 997.4, 416, 14.4, 34),
    (v_org, 'quinta', '30', null, 1013.8, 416, 14.4, 34),
    (v_org, 'quinta', '31', null, 1030.2, 416, 14.4, 34),
    (v_org, 'quinta', '32', null, 1046.6, 416, 14.4, 34),
    (v_org, 'quinta', '33', null, 1063, 416, 14.4, 34),
    (v_org, 'quinta', '34', null, 1079.4, 416, 14.4, 34),
    (v_org, 'quinta', '35', null, 1095.8, 416, 14.4, 34),
    (v_org, 'quinta', '36', null, 1112.2, 416, 14.4, 34),
    (v_org, 'quinta', '37', null, 1128.6, 416, 14.4, 34),
    (v_org, 'quinta', '54', null, 817, 362, 17.29, 34),
    (v_org, 'quinta', '53', null, 836.29, 362, 17.29, 34),
    (v_org, 'quinta', '52', null, 855.59, 362, 17.29, 34),
    (v_org, 'quinta', '51', null, 874.88, 362, 17.29, 34),
    (v_org, 'quinta', '50', null, 894.18, 362, 17.29, 34),
    (v_org, 'quinta', '49', null, 913.47, 362, 17.29, 34),
    (v_org, 'quinta', '48', null, 932.76, 362, 17.29, 34),
    (v_org, 'quinta', '47', null, 952.06, 362, 17.29, 34),
    (v_org, 'quinta', '46', null, 971.35, 362, 17.29, 34),
    (v_org, 'quinta', '45', null, 990.65, 362, 17.29, 34),
    (v_org, 'quinta', '44', null, 1009.94, 362, 17.29, 34),
    (v_org, 'quinta', '43', null, 1029.24, 362, 17.29, 34),
    (v_org, 'quinta', '42', null, 1048.53, 362, 17.29, 34),
    (v_org, 'quinta', '41', null, 1067.82, 362, 17.29, 34),
    (v_org, 'quinta', '40', null, 1087.12, 362, 17.29, 34),
    (v_org, 'quinta', '39', null, 1106.41, 362, 17.29, 34),
    (v_org, 'quinta', '38', null, 1125.71, 362, 17.29, 34),
    (v_org, 'quinta', '68', null, 441, 362, 18, 34),
    (v_org, 'quinta', '67', null, 461, 362, 18, 34),
    (v_org, 'quinta', '66', null, 481, 362, 18, 34),
    (v_org, 'quinta', '65', null, 501, 362, 18, 34),
    (v_org, 'quinta', '64', null, 521, 362, 18, 34),
    (v_org, 'quinta', '63', null, 541, 362, 18, 34),
    (v_org, 'quinta', '62', null, 561, 362, 18, 34),
    (v_org, 'quinta', '61', null, 581, 362, 18, 34),
    (v_org, 'quinta', '60', null, 601, 362, 18, 34),
    (v_org, 'quinta', '59', null, 621, 362, 18, 34),
    (v_org, 'quinta', '58', null, 641, 362, 18, 34),
    (v_org, 'quinta', '57', null, 661, 362, 18, 34),
    (v_org, 'quinta', '56', null, 681, 362, 18, 34),
    (v_org, 'quinta', '55', null, 701, 362, 18, 34);
end $$;
