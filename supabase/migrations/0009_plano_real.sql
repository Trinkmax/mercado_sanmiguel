-- ============================================================
-- Mercado San Miguel — 0009 Plano real del predio (septiembre 2026)
--
-- Reemplaza el plano esquemático (celdas repartidas por N° de carpeta y
-- reubicadas con drag & drop en `mapa_posiciones`) por el plano REAL:
--   · `espacios`: cada puesto, medio puesto, bar, local y contenedor es un
--     lugar físico con su número y su geometría, y se asigna a un cliente.
--     Un puestero puede tener varios (2, 3, 4… o 2 y medio): el plano junta
--     los contiguos del mismo cliente en un solo bloque.
--   · `plano_elementos`: lo fijo del predio que no se alquila por unidad
--     (nave, pasillo, cocheras, zona de quinteros, administración,
--     invernaderos, recintos de contenedores y rótulos).
-- Geometría en unidades del plano (el SVG arma su viewBox con los límites).
-- Todo cuelga de org_id: otro mercado = otro plano.
-- La asignación se hace solo por RPC (Administración y Líder de Procesos).
-- ============================================================

-- El drag & drop del plano esquemático queda reemplazado por la asignación
-- sobre el plano real (la tabla estaba vacía).
drop table if exists public.mapa_posiciones;

-- ------------------------------------------------------------
-- 1. Tablas
-- ------------------------------------------------------------
create table public.espacios (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id),
  tipo text not null check (tipo in ('puesto','bar','local','contenedor')),
  -- Número visible ("58", "0", "1"). Texto porque el plano real trae
  -- repetidos y puestos sin número: null = sin número (se muestra "?").
  numero text check (numero is null or length(numero) between 1 and 12),
  -- Medio puesto ("/2" en el plano): cuenta 0,5 para la expensa de puestos.
  medio boolean not null default false,
  -- Puestos que el plano original dibuja juntos (un mismo puestero). Mientras
  -- estén libres se ven como un bloque, y al asignar uno se sugieren los demás.
  grupo text,
  nota text check (nota is null or length(nota) <= 60),
  cliente_id uuid references public.clientes(id) on delete set null,
  asignado_en timestamptz,
  x numeric(7,2) not null,
  y numeric(7,2) not null,
  w numeric(7,2) not null check (w > 0),
  h numeric(7,2) not null check (h > 0),
  actualizado_por uuid references auth.users(id),
  actualizado_en timestamptz not null default now(),
  check (not medio or tipo = 'puesto')
);
create index espacios_org_idx on public.espacios(org_id);
create index espacios_cliente_idx on public.espacios(cliente_id) where cliente_id is not null;

create table public.plano_elementos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id),
  tipo text not null check (tipo in (
    'nave','pasillo','cocheras','quinteros','administracion','invernadero','recinto','rotulo'
  )),
  etiqueta text,
  -- Cocheras: cantidad de lugares del sector.
  capacidad int check (capacidad is null or capacidad >= 0),
  x numeric(7,2) not null,
  y numeric(7,2) not null,
  w numeric(7,2) not null check (w > 0),
  h numeric(7,2) not null check (h > 0),
  orden int not null default 0
);
create index plano_elementos_org_idx on public.plano_elementos(org_id);

-- ------------------------------------------------------------
-- 2. RLS: el staff lee el plano; el socio ve sus propios espacios.
--    Nadie escribe directo: la asignación y la edición van por RPC.
-- ------------------------------------------------------------
alter table public.espacios enable row level security;
alter table public.plano_elementos enable row level security;

create policy "leer espacios" on public.espacios for select to authenticated
  using (
    private.tiene_rol(org_id, array['admin','guardia','tesoreria','consejo','lider']::public.rol_usuario[])
    or cliente_id = private.cliente_actual()
  );

create policy "leer plano" on public.plano_elementos for select to authenticated
  using (private.tiene_rol(org_id, array['admin','guardia','tesoreria','consejo','lider']::public.rol_usuario[]));

grant select on public.espacios, public.plano_elementos to authenticated;
revoke all on public.espacios, public.plano_elementos from anon;

-- ------------------------------------------------------------
-- 3. RPCs
-- ------------------------------------------------------------

-- Asigna (o libera, con p_cliente null) uno o varios espacios de golpe.
-- p_actual = a quién le ve asignados esos espacios quien opera (null = libres):
-- si mientras tanto otro usuario los cambió, se rechaza en vez de pisarlo.
-- Devuelve cuántos cambiaron de manos.
create or replace function public.asignar_espacios(
  p_espacios uuid[],
  p_cliente uuid default null,
  p_actual uuid default null
) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_total integer := coalesce(array_length(p_espacios, 1), 0);
  v_conflicto text;
  v_n integer;
begin
  if v_org is null or not private.tiene_rol(v_org, array['admin','lider']::public.rol_usuario[]) then
    raise exception 'Solo Administración y el Líder de Procesos asignan espacios del plano';
  end if;
  if v_total = 0 then
    raise exception 'Elegí al menos un puesto';
  end if;
  if (select count(*) from public.espacios where org_id = v_org and id = any(p_espacios))
     <> (select count(distinct e) from unnest(p_espacios) e) then
    raise exception 'Algún puesto no existe. Recargá la página y probá de nuevo';
  end if;
  if p_cliente is not null and not exists (
    select 1 from public.clientes where id = p_cliente and org_id = v_org and activo
  ) then
    raise exception 'El cliente no existe o está dado de baja';
  end if;

  -- Bloqueo + control de concurrencia: nadie tiene que haberlos cambiado.
  select string_agg(coalesce(e.numero, '?'), ', ' order by e.y, e.x)
    into v_conflicto
    from (
      select numero, x, y, cliente_id from public.espacios
       where org_id = v_org and id = any(p_espacios)
       for update
    ) e
   where e.cliente_id is distinct from p_actual
     and e.cliente_id is distinct from p_cliente;
  if v_conflicto is not null then
    raise exception 'Otra persona ya cambió el % mientras tanto. El plano se actualizó, fijate y probá de nuevo', v_conflicto;
  end if;

  update public.espacios
     set cliente_id = p_cliente,
         asignado_en = case when p_cliente is null then null else now() end,
         actualizado_por = (select auth.uid()),
         actualizado_en = now()
   where org_id = v_org
     and id = any(p_espacios)
     and cliente_id is distinct from p_cliente;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Corrige los datos de un espacio: número, medio puesto y nota.
create or replace function public.editar_espacio(
  p_espacio uuid,
  p_numero text,
  p_medio boolean,
  p_nota text
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_numero text := nullif(trim(coalesce(p_numero, '')), '');
  v_nota text := nullif(trim(coalesce(p_nota, '')), '');
  v_tipo text;
begin
  if v_org is null or not private.tiene_rol(v_org, array['admin','lider']::public.rol_usuario[]) then
    raise exception 'Solo Administración y el Líder de Procesos editan el plano';
  end if;
  select tipo into v_tipo from public.espacios where id = p_espacio and org_id = v_org for update;
  if not found then
    raise exception 'El puesto no existe. Recargá la página y probá de nuevo';
  end if;
  if length(v_numero) > 12 then
    raise exception 'El número puede tener hasta 12 caracteres';
  end if;
  if length(v_nota) > 60 then
    raise exception 'La nota puede tener hasta 60 caracteres';
  end if;

  update public.espacios
     set numero = v_numero,
         medio = coalesce(p_medio, false) and v_tipo = 'puesto',
         nota = v_nota,
         actualizado_por = (select auth.uid()),
         actualizado_en = now()
   where id = p_espacio;
end;
$$;

revoke all on function public.asignar_espacios(uuid[], uuid, uuid) from public, anon;
revoke all on function public.editar_espacio(uuid, text, boolean, text) from public, anon;
grant execute on function public.asignar_espacios(uuid[], uuid, uuid) to authenticated;
grant execute on function public.editar_espacio(uuid, text, boolean, text) to authenticated;

-- ------------------------------------------------------------
-- 4. La baja de un cliente libera sus espacios del plano.
-- ------------------------------------------------------------
create or replace function private.liberar_espacios_baja() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.espacios
     set cliente_id = null, asignado_en = null, actualizado_en = now()
   where cliente_id = new.id;
  return new;
end;
$$;

revoke all on function private.liberar_espacios_baja() from public, anon;

create trigger clientes_baja_libera_espacios
  after update of activo on public.clientes
  for each row
  when (old.activo and not new.activo)
  execute function private.liberar_espacios_baja();
