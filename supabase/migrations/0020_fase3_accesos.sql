-- ============================================================
-- Mercado San Miguel — 0020 Fase 3: Accesos (M8)
-- Contrato: docs/FASE3-CONTRATO.md §4.11 (F1–F5, G7) y §6 M8.
--
-- Solo los CUERPOS de las funciones de M8, con la firma EXACTA que dejó
-- 0012_fase3_rpcs.sql (nombres, tipos, orden, defaults y retorno):
--   · public.email_para_login(p_dni text) returns text                    (solo service_role)
--   · public.guardar_cuotas_quinteros(p_cuotas integer) returns void      (guardia, lider)
--   · public.autorizar_gestion_usuario(p_user uuid, p_accion text)
--       returns public.rol_usuario                                         (candado de auth.admin.*)
--
-- Idempotente: create or replace + revoke/grant (se puede re-correr).
-- Ninguna de estas funciones llama a funciones de otro módulo (solo helpers de
-- Fundación de 0011: private.org_actual, private.rol_actual, private.puede_gestionar_rol).
-- Se aplica como UNA transacción, en la ventana de mantenimiento (§0.3, paso 5).
-- ============================================================


-- ------------------------------------------------------------
-- 1. DNI → email de login (F4)
--    La llama SOLO el server action del login con el cliente admin (service role).
--    Nunca authenticated/anon: no hay endpoint público para enumerar usuarios.
--    Devuelve el email aunque el perfil esté desactivado: el login valida la
--    contraseña y recién ahí avisa "Tu usuario está desactivado".
--    Entrada con puntos/espacios ("20.222.222") → se normaliza a dígitos.
--    Algo que no es un DNI (7 u 8 dígitos) → null (el login responde el error único).
-- ------------------------------------------------------------
create or replace function public.email_para_login(p_dni text)
returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v_dni text := regexp_replace(coalesce(p_dni, ''), '[^0-9]', '', 'g');
  v_email text;
begin
  if v_dni !~ '^[0-9]{7,8}$' then
    return null;
  end if;

  select u.email
    into v_email
    from public.perfiles p
    join auth.users u on u.id = p.user_id
   where p.dni = v_dni
   limit 1;  -- perfiles_dni_unq: a lo sumo uno

  return v_email;
end $$;
revoke all on function public.email_para_login(text) from public, anon, authenticated;
grant execute on function public.email_para_login(text) to service_role;
comment on function public.email_para_login(text) is
  'M8 · Login por DNI (F4): email de auth.users del perfil con ese DNI (activo o no), o null. Solo service_role.';


-- ------------------------------------------------------------
-- 2. Cuotas por defecto de los quinteros (G7)
--    El Jefe de Portería (y el Líder) eligen en cuántos pagos se cobra la quinta.
--    Rige para los quinteros NUEVOS (private.aplicar_cambio de M4 lo usa en el alta);
--    no toca clientes.cuotas_mes de los existentes.
--    Rastro: actualizado_por / actualizado_en de configuracion.
--    configuracion.cuotas_default_quintero no está en ningún grant (0022): solo por acá.
-- ------------------------------------------------------------
create or replace function public.guardar_cuotas_quinteros(p_cuotas integer)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_uid uuid := (select auth.uid());
begin
  if v_org is null then
    raise exception 'Sin perfil activo';
  end if;
  if v_rol is null or v_rol not in ('guardia', 'lider') then
    raise exception 'En cuántos pagos se cobra la quinta lo elige el Jefe de Portería';
  end if;
  if p_cuotas is null or p_cuotas < 1 or p_cuotas > 31 then
    raise exception 'Elegí en cuántos pagos (de 1 a 31)';
  end if;

  update public.configuracion
     set cuotas_default_quintero = p_cuotas,
         actualizado_por = v_uid,
         actualizado_en = now()
   where org_id = v_org;

  -- La fila de configuración existe desde el alta de la organización; si faltara,
  -- se crea (on conflict: dos llamadas simultáneas no chocan).
  if not found then
    insert into public.configuracion (org_id, cuotas_default_quintero, actualizado_por, actualizado_en)
    values (v_org, p_cuotas, v_uid, now())
    on conflict (org_id) do update
      set cuotas_default_quintero = excluded.cuotas_default_quintero,
          actualizado_por = excluded.actualizado_por,
          actualizado_en = excluded.actualizado_en;
  end if;
end $$;
revoke all on function public.guardar_cuotas_quinteros(integer) from public, anon;
grant execute on function public.guardar_cuotas_quinteros(integer) to authenticated;
comment on function public.guardar_cuotas_quinteros(integer) is
  'M8 · G7: cuotas por defecto de los quinteros nuevos (1..31). Roles guardia, lider.';


-- ------------------------------------------------------------
-- 3. Candado de la gestión de usuarios (F1–F3, F5) — §3.4 y §4.11
--    La RLS y el trigger proteger_perfiles protegen la TABLA perfiles, pero
--    resetear contraseñas y banear/desbanear sesiones corre con el service role
--    (auth.admin.*), que saltea RLS y triggers. Por eso la server action llama
--    PRIMERO a esta función con el cliente del USUARIO: si no tira error, recién
--    ahí usa el cliente admin.
--    El rol del objetivo se lee DE LA BASE por p_user (nunca se confía en un rol
--    que mande el cliente). Devuelve ese rol.
--    Reglas (mismas que private.puede_gestionar_rol de Fundación):
--      Líder → todo el staff y socios · Administración → socios ·
--      Jefe de Portería → Portería · nadie → Consejo.
--    quitar_acceso: nadie se lo quita a sí mismo y siempre queda un Líder activo
--    (el trigger proteger_perfiles lo vuelve a controlar al escribir la tabla).
-- ------------------------------------------------------------
create or replace function public.autorizar_gestion_usuario(p_user uuid, p_accion text)
returns public.rol_usuario
language plpgsql stable security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_uid uuid := (select auth.uid());
  v_rol_objetivo public.rol_usuario;
  v_activo boolean;
begin
  if v_org is null then
    raise exception 'Sin perfil activo';
  end if;
  if p_accion is null
     or p_accion not in ('resetear_contrasena', 'quitar_acceso', 'devolver_acceso', 'editar') then
    raise exception 'Acción inválida';
  end if;

  select p.rol, p.activo
    into v_rol_objetivo, v_activo
    from public.perfiles p
   where p.user_id = p_user
     and p.org_id = v_org;
  if not found then
    raise exception 'Ese usuario no existe';
  end if;

  if v_rol_objetivo = 'consejo'
     or not coalesce(private.puede_gestionar_rol(v_org, v_rol_objetivo), false) then
    raise exception 'No podés gestionar a ese usuario';
  end if;

  if p_accion = 'quitar_acceso' then
    if p_user = v_uid then
      raise exception 'No podés quitarte el acceso a vos mismo';
    end if;
    if v_rol_objetivo = 'lider' and v_activo and not exists (
      select 1
        from public.perfiles o
       where o.org_id = v_org
         and o.rol = 'lider'
         and o.activo
         and o.user_id <> p_user) then
      raise exception 'Tiene que quedar al menos un Líder de Procesos activo';
    end if;
  end if;

  return v_rol_objetivo;
end $$;
revoke all on function public.autorizar_gestion_usuario(uuid, text) from public, anon;
grant execute on function public.autorizar_gestion_usuario(uuid, text) to authenticated;
comment on function public.autorizar_gestion_usuario(uuid, text) is
  'M8 · §4.11: autoriza resetear_contrasena | quitar_acceso | devolver_acceso | editar sobre p_user (rol leído de la base). Llamar con el cliente del usuario ANTES de todo auth.admin.*.';


-- ------------------------------------------------------------
-- Pedidos a Fundación: ninguno. Policies y grants que usa M8 ya están en 0011/0022:
--   perfiles ("gestionar perfiles", "alta de perfiles", grants por columna, trigger
--   proteger_perfiles), configuracion (grants sin cuotas_default_quintero) y
--   "ver perfil propio o staff" (0022).
-- ------------------------------------------------------------
