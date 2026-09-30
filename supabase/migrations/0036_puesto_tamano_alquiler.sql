-- ============================================================
-- 0036 · Plano: tamaño de cada puesto y puestos en alquiler
--
-- · tamano: cuántos puestos cuenta un puesto del plano para la expensa (EXME/EXPP):
--   ½, 1, 1½, 2, 2½ o 3. "medio" queda como espejo de tamano = ½ (lo siguen leyendo
--   Portería, las etiquetas y espacios_del_plano). El 34 es un puesto y medio y estaba
--   cargado como medio: se corrige desde el mapa con esto.
-- · en_alquiler / duenio: el puesto lo ocupa un inquilino; el dueño va por nombre
--   (texto libre). Como la nota, solo lo leen Administración y el Líder.
-- · editar_espacio suma p_tamano, p_en_alquiler y p_duenio (con default: la versión
--   anterior de la app los omite y sigue andando). Al cambiar el tamaño, el puesto se
--   ensancha o se angosta en su fila usando el lugar libre entre sus vecinos, sin
--   pisarlos ni invadir el pasillo, Administración o la zona de quintas.
-- ============================================================

alter table public.espacios add column if not exists tamano numeric(3, 1) not null default 1;
alter table public.espacios add column if not exists en_alquiler boolean not null default false;
alter table public.espacios add column if not exists duenio text;

update public.espacios set tamano = 0.5 where medio and tamano <> 0.5;

alter table public.espacios drop constraint if exists espacios_tamano_check;
alter table public.espacios add constraint espacios_tamano_check check (
  tamano in (0.5, 1, 1.5, 2, 2.5, 3)
  and (tipo = 'puesto' or tamano = 1)
  and medio = (tamano = 0.5)
);
alter table public.espacios drop constraint if exists espacios_duenio_check;
alter table public.espacios add constraint espacios_duenio_check check (
  (duenio is null or char_length(duenio) between 1 and 80) and (en_alquiler or duenio is null)
);

comment on column public.espacios.tamano is 'Puestos que cuenta para la expensa: 0.5, 1, 1.5, 2, 2.5 o 3 (solo puestos; el resto, 1). medio = (tamano = 0.5).';
comment on column public.espacios.en_alquiler is 'Lo ocupa un inquilino (el dueño va en duenio).';
comment on column public.espacios.duenio is 'Nombre del dueño del puesto cuando está en alquiler (hasta 80 letras).';

drop function if exists public.editar_espacio(uuid, text, boolean, text, boolean);
create or replace function public.editar_espacio(
  p_espacio uuid,
  p_numero text,
  p_medio boolean,
  p_nota text,
  p_propio boolean default null,
  p_tamano numeric default null,
  p_en_alquiler boolean default null,
  p_duenio text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_numero text := nullif(trim(coalesce(p_numero, '')), '');
  v_nota text := nullif(trim(coalesce(p_nota, '')), '');
  v_duenio text := nullif(trim(coalesce(p_duenio, '')), '');
  v_e record;
  v_tamano numeric;
  v_alquiler boolean;
  v_ancho numeric;
  v_izq numeric;
  v_der numeric;
  v_x numeric;
  v_w numeric;
begin
  if v_org is null then
    raise exception 'Sin perfil activo';
  end if;
  if not private.tiene_rol(v_org, array['admin','lider']::public.rol_usuario[]) then
    raise exception 'Solo Administración y el Líder de Procesos editan el plano';
  end if;

  select e.tipo, e.x, e.y, e.w, e.h, e.tamano, e.en_alquiler, e.duenio into v_e
    from public.espacios e
   where e.id = p_espacio and e.org_id = v_org
     for update;
  if not found then
    raise exception 'El puesto no existe. Recargá la página y probá de nuevo';
  end if;

  if length(v_numero) > 12 then
    raise exception 'El número puede tener hasta 12 caracteres';
  end if;
  if length(v_nota) > 60 then
    raise exception 'La nota puede tener hasta 60 caracteres';
  end if;
  if length(v_duenio) > 80 then
    raise exception 'El nombre del dueño puede tener hasta 80 letras';
  end if;
  if coalesce(p_propio, false) and v_e.tipo <> 'puesto' then
    raise exception 'Solo un puesto puede ser propio de la cooperativa';
  end if;

  -- Tamaño: el pedido; si no viene (versión anterior de la app), lo dice "medio".
  v_tamano := case
    when v_e.tipo <> 'puesto' then 1
    when p_tamano is not null then p_tamano
    when p_medio then 0.5
    when v_e.tamano = 0.5 then 1
    else v_e.tamano
  end;
  if v_tamano not in (0.5, 1, 1.5, 2, 2.5, 3) then
    raise exception 'El tamaño puede ser ½, 1, 1½, 2, 2½ o 3 puestos';
  end if;

  -- Al cambiar el tamaño, el dibujo acompaña: el ancho de ese tamaño, dentro del lugar
  -- libre entre los vecinos de la fila (misma altura) y lo fijo que la corta.
  v_x := v_e.x;
  v_w := v_e.w;
  if v_tamano <> v_e.tamano then
    v_ancho := case v_tamano when 0.5 then 20 when 1 then 44 when 1.5 then 68 when 2 then 92
                             when 2.5 then 116 else 140 end;
    select max(o.x + o.w) into v_izq from (
      select x, w from public.espacios
       where org_id = v_org and id <> p_espacio and y < v_e.y + v_e.h and y + h > v_e.y
      union all
      select x, w from public.plano_elementos
       where org_id = v_org and tipo in ('pasillo', 'administracion', 'quinteros', 'galpon')
         and y < v_e.y + v_e.h and y + h > v_e.y
    ) o where o.x + o.w <= v_e.x + 0.01;
    select min(o.x) into v_der from (
      select x from public.espacios
       where org_id = v_org and id <> p_espacio and y < v_e.y + v_e.h and y + h > v_e.y
      union all
      select x from public.plano_elementos
       where org_id = v_org and tipo in ('pasillo', 'administracion', 'quinteros', 'galpon')
         and y < v_e.y + v_e.h and y + h > v_e.y
    ) o where o.x >= v_e.x + v_e.w - 0.01;
    -- En la punta de una fila no se crece hacia afuera.
    v_izq := coalesce(v_izq + 4, v_e.x);
    v_der := coalesce(v_der - 4, v_e.x + v_e.w);
    v_w := least(v_ancho, greatest(v_der - v_izq, v_e.w));
    if v_ancho < v_e.w then v_w := v_ancho; end if;
    v_x := v_e.x;
    if v_x + v_w > v_der then v_x := greatest(v_izq, v_der - v_w); end if;
  end if;

  v_alquiler := coalesce(p_en_alquiler, v_e.en_alquiler);

  update public.espacios
     set numero = v_numero,
         tamano = v_tamano,
         medio = v_tamano = 0.5,
         propio = coalesce(p_propio, propio) and v_e.tipo = 'puesto',
         nota = v_nota,
         x = v_x,
         w = v_w,
         en_alquiler = v_alquiler,
         duenio = case when not v_alquiler then null
                       when p_en_alquiler is null and p_duenio is null then v_e.duenio
                       else v_duenio end,
         actualizado_por = (select auth.uid()),
         actualizado_en = now()
   where id = p_espacio;
end $$;
revoke all on function public.editar_espacio(uuid, text, boolean, text, boolean, numeric, boolean, text) from public, anon;
grant execute on function public.editar_espacio(uuid, text, boolean, text, boolean, numeric, boolean, text) to authenticated;
comment on function public.editar_espacio(uuid, text, boolean, text, boolean, numeric, boolean, text) is
  'Corrige número, tamaño (½ a 3 puestos; ensancha o angosta el dibujo en su fila), nota, puesto propio (C3) y alquiler (dueño) de un espacio del plano. Admin y Líder.';
