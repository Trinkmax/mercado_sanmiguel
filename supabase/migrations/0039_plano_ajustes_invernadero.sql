-- ============================================================
-- 0039 · Plano: correcciones del relevamiento y el invernadero asignable
--
-- · El 57 es medio puesto y al lado va el 70, la otra mitad.
-- · El 68 y el 72 son un solo puesto, el 68, del ancho del 66 (se borra el 72). Lo
--   ocupaba el mismo cliente, que factura 1 puesto: ahora coincide.
-- · Debajo del 76 está la cámara de frío: puesto 74, un bloque chico.
-- · El invernadero es uno solo (las dos naves pegadas) y se asigna a un cliente como
--   cualquier lugar del plano: pasa de elemento fijo a espacio de tipo 'invernadero'
--   (número 82). Sus cargos van por los conceptos de la carpeta de quien lo ocupe.
-- Geometría: supabase/plano/generar.mjs. Idempotente: si el invernadero ya es un espacio,
-- la parte de datos no hace nada.
-- ============================================================

alter table public.espacios drop constraint if exists espacios_tipo_check;
alter table public.espacios add constraint espacios_tipo_check
  check (tipo = any (array['puesto', 'bar', 'local', 'contenedor', 'cochera', 'galpon', 'quinta', 'invernadero']));

-- "Invernadero 82" en el puesto del cheque (sin esto caía en "Bar 82").
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
        when 'invernadero' then 'Invernadero ' || coalesce(e.numero, '')
        when 'cochera' then 'Cochera ' || coalesce(e.numero, '')
        when 'quinta' then 'Quinta ' || coalesce(e.numero, '')
        else btrim('Bar ' || coalesce(e.numero, ''))
      end as etiqueta,
      case e.tipo
        when 'puesto' then 1 when 'local' then 2 when 'contenedor' then 3 when 'galpon' then 4
        when 'invernadero' then 5 when 'cochera' then 6 when 'quinta' then 7 else 8
      end as orden_tipo,
      coalesce(nullif(regexp_replace(coalesce(e.numero, ''), '[^0-9]', '', 'g'), '')::bigint, 0) as orden_num
    from public.espacios e
    where e.cliente_id = p_cliente
  ) s
$$;
revoke all on function private.puestos_cliente(uuid) from public, anon;
grant execute on function private.puestos_cliente(uuid) to authenticated;

do $$
declare
  v_org constant uuid := 'a0000000-0000-4000-8000-000000000001';
begin
  if not exists (select 1 from public.organizaciones where id = v_org) then return; end if;
  if exists (select 1 from public.espacios where org_id = v_org and tipo = 'invernadero') then return; end if;

  -- 57 medio + 70 (la otra mitad, entre el 57 y el 55).
  update public.espacios set medio = true, tamano = 0.5, w = 20, actualizado_en = now()
   where org_id = v_org and tipo = 'puesto' and numero = '57' and x = 56 and y = 496;
  if not exists (select 1 from public.espacios where org_id = v_org and tipo = 'puesto' and numero = '70') then
    insert into public.espacios (org_id, tipo, numero, medio, tamano, x, y, w, h)
    values (v_org, 'puesto', '70', true, 0.5, 80, 496, 20, 52);
  end if;

  -- 68 y 72 → un solo puesto, el 68, del ancho del 66.
  delete from public.espacios
   where org_id = v_org and tipo = 'puesto' and numero = '72' and x = 368 and y = 358;
  update public.espacios set x = 320, w = 92, actualizado_en = now()
   where org_id = v_org and tipo = 'puesto' and numero = '68' and y = 358;

  -- Cámara de frío debajo del 76.
  if not exists (select 1 from public.espacios where org_id = v_org and tipo = 'puesto' and numero = '74') then
    insert into public.espacios (org_id, tipo, numero, nota, x, y, w, h)
    values (v_org, 'puesto', '74', 'Cámara de frío', 128, 414, 44, 24);
  end if;

  -- Un solo invernadero (dos naves pegadas), asignable.
  delete from public.plano_elementos where org_id = v_org and tipo = 'invernadero';
  insert into public.espacios (org_id, tipo, numero, x, y, w, h)
  values (v_org, 'invernadero', '82', 1706, 580, 172, 260);
end $$;
