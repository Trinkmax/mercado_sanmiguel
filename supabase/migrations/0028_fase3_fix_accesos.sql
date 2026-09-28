-- ============================================================
-- Mercado San Miguel — 0028 Fase 3: arreglos de Accesos (M8)
-- Contrato: docs/FASE3-CONTRATO.md §3.4, §4.0-8, §4.11 y §6 M8.
--
-- 1. Rastro de accesos que no se borra: public.perfiles_eventos.
--    Hasta ahora "Correcciones" (inicio del Líder) leía perfiles.desactivado_*,
--    que proteger_perfiles limpia al devolver el acceso: quitar y devolver en la
--    misma semana no dejaba nada. Tampoco quedaba quién cambió un rol, un DNI o
--    una contraseña (quien resetea una contraseña puede entrar como esa persona).
--    Ahora cada cambio de activo / rol / DNI deja una fila (trigger AFTER UPDATE)
--    y la contraseña nueva la registra public.registrar_contrasena_nueva.
--    Nadie la escribe por la API (sin grants de escritura); la lee solo el Líder.
-- 2. La baja de un cliente corta su acceso al portal: trigger AFTER UPDATE OF
--    activo en clientes (vale para cualquier camino: aprobación, Líder directo,
--    modificación con activo = false). El perfil socio queda inactivo con el
--    rastro de quien aprobó la baja; tiene_rol / rol_actual / getPerfil ya lo
--    bloquean. Arreglo de datos: los socios de clientes YA dados de baja.
--    Reactivar al cliente NO devuelve el acceso solo: se devuelve a mano desde
--    Configuración → Usuarios (Sin acceso → "Devolver acceso").
--
-- No toca funciones de otros módulos (aplicar_cambio, proteger_perfiles quedan igual).
-- Idempotente: create table/index if not exists, create or replace, drop … if exists.
-- Se aplica como UNA transacción.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Tabla de rastro de accesos
-- ------------------------------------------------------------
create table if not exists public.perfiles_eventos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  accion text not null,
  valor_anterior text,
  valor_nuevo text,
  detalle text,
  hecho_por uuid references auth.users(id) on delete set null,
  hecho_en timestamptz not null default now()
);
alter table public.perfiles_eventos drop constraint if exists perfiles_eventos_accion_check;
alter table public.perfiles_eventos add constraint perfiles_eventos_accion_check
  check (accion in ('quitar', 'devolver', 'rol', 'contrasena', 'dni'));
create index if not exists perfiles_eventos_org_idx on public.perfiles_eventos (org_id, hecho_en desc);
create index if not exists perfiles_eventos_user_idx on public.perfiles_eventos (user_id);
create index if not exists perfiles_eventos_hecho_por_idx on public.perfiles_eventos (hecho_por);

alter table public.perfiles_eventos enable row level security;
drop policy if exists "lider lee eventos de perfiles" on public.perfiles_eventos;
create policy "lider lee eventos de perfiles" on public.perfiles_eventos for select to authenticated
  using (private.tiene_rol(org_id, array['lider']::public.rol_usuario[]));
-- Solo lectura: las filas las escriben el trigger y la RPC (security definer).
revoke all on public.perfiles_eventos from public, anon, authenticated;
grant select on public.perfiles_eventos to authenticated;
comment on table public.perfiles_eventos is
  'M8 · Rastro de accesos: quitar/devolver acceso, cambio de rol, de DNI y contraseña nueva. Lo lee el Líder (Correcciones).';

-- Lo que ya había: los accesos quitados antes de esta migración (perfiles.desactivado_*)
-- pasan como eventos, así Correcciones no los pierde al cambiar de fuente. El Consejo
-- no (lo desactivó la migración de fase 3, F5). Idempotente: no duplica.
insert into public.perfiles_eventos (org_id, user_id, accion, hecho_por, hecho_en)
select p.org_id, p.user_id, 'quitar', p.desactivado_por, p.desactivado_en
  from public.perfiles p
 where not p.activo
   and p.desactivado_en is not null
   and p.rol <> 'consejo'
   and not exists (
     select 1 from public.perfiles_eventos e
      where e.user_id = p.user_id
        and e.accion = 'quitar'
        and e.hecho_en >= p.desactivado_en);


-- ------------------------------------------------------------
-- 2. Trigger: cada cambio de activo / rol / DNI de un perfil deja una fila.
--    hecho_por = auth.uid() (null si fue el service role o una migración).
--    Un detalle opcional llega por la variable local msm.detalle_evento_perfil
--    (la usa el corte de portal por baja de cliente).
-- ------------------------------------------------------------
create or replace function private.registrar_evento_perfil()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_detalle text := nullif(current_setting('msm.detalle_evento_perfil', true), '');
begin
  if old.activo is distinct from new.activo then
    insert into public.perfiles_eventos (org_id, user_id, accion, detalle, hecho_por)
    values (new.org_id, new.user_id, case when new.activo then 'devolver' else 'quitar' end, v_detalle, v_uid);
  end if;
  if old.rol is distinct from new.rol then
    insert into public.perfiles_eventos (org_id, user_id, accion, valor_anterior, valor_nuevo, detalle, hecho_por)
    values (new.org_id, new.user_id, 'rol', old.rol::text, new.rol::text, v_detalle, v_uid);
  end if;
  if old.dni is distinct from new.dni then
    insert into public.perfiles_eventos (org_id, user_id, accion, valor_anterior, valor_nuevo, detalle, hecho_por)
    values (new.org_id, new.user_id, 'dni', old.dni, new.dni, v_detalle, v_uid);
  end if;
  return null;
end $$;
revoke all on function private.registrar_evento_perfil() from public, anon, authenticated;

drop trigger if exists registrar_evento_perfil on public.perfiles;
create trigger registrar_evento_perfil
  after update of activo, rol, dni on public.perfiles
  for each row execute function private.registrar_evento_perfil();


-- ------------------------------------------------------------
-- 3. Contraseña nueva: la server action la llama DESPUÉS de cambiarla con el
--    cliente admin (auth.admin.updateUserById no pasa por la base).
--    Mismo candado que el reseteo (autorizar_gestion_usuario): solo quien puede
--    resetearle la contraseña a esa persona deja el rastro.
-- ------------------------------------------------------------
create or replace function public.registrar_contrasena_nueva(p_user uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
begin
  if v_org is null then
    raise exception 'Sin perfil activo';
  end if;
  -- Tira 'No podés gestionar a ese usuario' / 'Ese usuario no existe' si no corresponde.
  perform public.autorizar_gestion_usuario(p_user, 'resetear_contrasena');

  insert into public.perfiles_eventos (org_id, user_id, accion, hecho_por)
  values (v_org, p_user, 'contrasena', (select auth.uid()));
end $$;
revoke all on function public.registrar_contrasena_nueva(uuid) from public, anon;
grant execute on function public.registrar_contrasena_nueva(uuid) to authenticated;
comment on function public.registrar_contrasena_nueva(uuid) is
  'M8 · Rastro de "Nueva contraseña" (lo lee Correcciones). Mismo permiso que autorizar_gestion_usuario(p_user, ''resetear_contrasena'').';


-- ------------------------------------------------------------
-- 4. La baja de un cliente corta el acceso de su socio al portal.
--    clientes.auth_user_id es único: un usuario del portal es de una sola carpeta.
--    El trigger proteger_perfiles firma desactivado_por/en con quien dio la baja.
-- ------------------------------------------------------------
create or replace function private.cortar_portal_baja()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('msm.detalle_evento_perfil',
                     format('Se dio de baja al cliente N° %s', new.codigo), true);
  update public.perfiles p
     set activo = false
   where p.user_id = new.auth_user_id
     and p.org_id = new.org_id
     and p.rol = 'socio'
     and p.activo;
  perform set_config('msm.detalle_evento_perfil', '', true);
  return null;
end $$;
revoke all on function private.cortar_portal_baja() from public, anon, authenticated;

drop trigger if exists clientes_baja_corta_portal on public.clientes;
create trigger clientes_baja_corta_portal
  after update of activo on public.clientes
  for each row
  when (old.activo and not new.activo and new.auth_user_id is not null)
  execute function private.cortar_portal_baja();

-- Arreglo de datos: socios de clientes que ya estaban dados de baja (idempotente:
-- solo toca perfiles todavía activos). Corre sin auth.uid(): proteger_perfiles lo
-- deja pasar como service role y el evento queda sin autor, con el motivo.
do $$
begin
  perform set_config('msm.detalle_evento_perfil', 'El cliente ya estaba dado de baja', true);
  update public.perfiles p
     set activo = false
    from public.clientes c
   where c.auth_user_id = p.user_id
     and c.org_id = p.org_id
     and not c.activo
     and p.rol = 'socio'
     and p.activo;
  perform set_config('msm.detalle_evento_perfil', '', true);
end $$;
