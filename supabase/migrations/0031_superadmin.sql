-- ============================================================
-- Mercado San Miguel — 0031 Superadministrador
--
-- Un usuario marcado como superadmin (lo marca solo la base, nunca la app) puede ver y
-- operar el sistema con cualquier rol: cambia su propio rol con public.cambiar_vista_superadmin
-- y la app le muestra ese panel con esos permisos (toda la RLS ya se basa en perfiles.rol).
-- Para el portal del socio elige un cliente y lo ve como VISTA PREVIA de solo lectura:
-- private.cliente_actual() devuelve ese cliente y un candado impide guardar nada (ni
-- "la vio", ni aceptar términos, ni mensajes) en nombre de un cliente real.
-- Nadie más puede cambiarle el rol, quitarle el acceso, cambiarle el DNI ni la contraseña.
-- Idempotente.
-- ============================================================

-- 1. Columnas (sin grants de escritura: la app no las puede tocar)
alter table public.perfiles add column if not exists superadmin boolean not null default false;
alter table public.perfiles add column if not exists vista_cliente_id uuid
  references public.clientes(id) on delete set null;
comment on column public.perfiles.superadmin is
  'Superadministrador: puede cambiar su propio rol (cambiar_vista_superadmin). Se asigna solo desde la base.';
comment on column public.perfiles.vista_cliente_id is
  'Superadministrador con rol socio: cliente cuyo portal ve como vista previa (solo lectura).';

-- 2. ¿Está viendo el portal de un cliente como vista previa?
create or replace function private.es_vista_previa()
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfiles p
    where p.user_id = (select auth.uid()) and p.activo and p.superadmin and p.rol = 'socio'
  )
$$;
revoke all on function private.es_vista_previa() from public, anon;
grant execute on function private.es_vista_previa() to authenticated;

-- 3. El cliente del portal: el vinculado al usuario o, en la vista previa, el elegido.
create or replace function private.cliente_actual()
returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select p.vista_cliente_id from public.perfiles p
      where p.user_id = (select auth.uid()) and p.activo and p.superadmin and p.rol = 'socio'),
    (select c.id from public.clientes c where c.auth_user_id = (select auth.uid()))
  )
$$;

-- 4. El socio (o la vista previa) lee su cliente por cliente_actual(), no por auth_user_id.
drop policy if exists "staff lee clientes" on public.clientes;
create policy "staff lee clientes" on public.clientes for select to authenticated
  using (
    private.tiene_rol(org_id, array['admin','tesoreria','consejo','lider']::public.rol_usuario[])
    or (private.tiene_rol(org_id, array['guardia']::public.rol_usuario[])
        and categoria = any (array['quintero','ambulante']::public.categoria_cliente[]))
    or id = (select private.cliente_actual())
  );

-- 5. Vista previa = solo lectura: nada de lo que escribe un socio se guarda.
create or replace function private.bloquear_vista_previa()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if private.es_vista_previa() then
    raise exception 'Estás viendo el portal como vista previa: no se guarda nada';
  end if;
  return null;
end $$;
revoke all on function private.bloquear_vista_previa() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['aceptaciones_terminos', 'circular_recepciones', 'documentos_cliente',
                           'registro_mensajes', 'solicitud_mensajes', 'solicitudes', 'sanciones']
  loop
    execute format('drop trigger if exists bloquear_vista_previa on public.%I', t);
    execute format('create trigger bloquear_vista_previa before insert or update or delete on public.%I
                    for each statement execute function private.bloquear_vista_previa()', t);
  end loop;
end $$;

drop policy if exists "socio sube documentos" on storage.objects;
create policy "socio sube documentos" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = (select (private.org_actual())::text)
    and (storage.foldername(name))[2] = 'clientes'
    and (storage.foldername(name))[3] = (select (private.cliente_actual())::text)
    and not (select private.es_vista_previa())
  );
drop policy if exists "miembros suben adjuntos de solicitudes" on storage.objects;
create policy "miembros suben adjuntos de solicitudes" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = (select (private.org_actual())::text)
    and (storage.foldername(name))[2] = 'solicitudes'
    and (select private.rol_actual()) = any (array['porteria','guardia','socio']::public.rol_usuario[])
    and not (select private.es_vista_previa())
  );

-- 6. Proteger el perfil: el superadmin solo se asigna desde la base, nadie más lo modifica,
--    y su cambio de vista (por la RPC) no pasa por las reglas de cambio de rol.
create or replace function private.proteger_perfiles()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_cambio_vista boolean := coalesce(current_setting('msm.vista_superadmin', true), '') = 'on';
begin
  if new.org_id <> old.org_id then
    raise exception 'No se puede mover un perfil de organización';
  end if;
  if new.user_id <> old.user_id then
    raise exception 'No se puede cambiar el usuario de un perfil';
  end if;
  if v_uid is not null then
    if new.superadmin is distinct from old.superadmin then
      raise exception 'El superadministrador se asigna solo desde la base';
    end if;
    if new.vista_cliente_id is distinct from old.vista_cliente_id and not v_cambio_vista then
      raise exception 'Eso se cambia desde el selector de rol';
    end if;
    if old.superadmin and old.user_id <> v_uid then
      raise exception 'Es el superadministrador del sistema: no se puede modificar desde acá';
    end if;
  end if;
  if old.activo and not new.activo then
    new.desactivado_por := v_uid;
    new.desactivado_en := now();
  elsif not old.activo and new.activo then
    new.desactivado_por := null;
    new.desactivado_en := null;
  else
    new.desactivado_por := old.desactivado_por;
    new.desactivado_en := old.desactivado_en;
  end if;
  new.creado_por := old.creado_por;
  if v_uid is null then
    return new;
  end if;
  -- Cambio de vista del superadministrador (cambiar_vista_superadmin).
  if v_cambio_vista and old.superadmin and old.user_id = v_uid then
    return new;
  end if;
  if old.user_id = v_uid and new.rol <> old.rol then
    raise exception 'No podés cambiar tu propio rol';
  end if;
  if old.user_id = v_uid and not new.activo then
    raise exception 'No podés desactivarte a vos mismo';
  end if;
  if new.rol <> old.rol then
    if private.rol_actual() is distinct from 'lider' then
      raise exception 'Solo el Líder de Procesos cambia roles';
    end if;
    if new.rol = 'consejo' then
      raise exception 'El rol Consejo ya no se asigna';
    end if;
    if (old.rol = 'socio') <> (new.rol = 'socio') then
      raise exception 'Un socio no puede pasar a ser del equipo (ni al revés): creá otro usuario';
    end if;
  end if;
  if old.rol = 'lider' and old.activo and (not new.activo or new.rol <> 'lider')
     and not exists (
       select 1 from public.perfiles o
       where o.org_id = old.org_id and o.rol = 'lider' and o.activo and o.user_id <> old.user_id) then
    raise exception 'Tiene que quedar al menos un Líder de Procesos activo';
  end if;
  return new;
end $$;

-- 7. El rastro de accesos no registra los cambios de vista del superadministrador.
create or replace function private.registrar_evento_perfil()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_detalle text := nullif(current_setting('msm.detalle_evento_perfil', true), '');
begin
  if coalesce(current_setting('msm.vista_superadmin', true), '') = 'on' then
    return null;
  end if;
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

-- 8. Nadie más gestiona al superadministrador (contraseña, acceso, datos).
create or replace function public.autorizar_gestion_usuario(p_user uuid, p_accion text)
returns public.rol_usuario
language plpgsql stable security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_uid uuid := (select auth.uid());
  v_rol_objetivo public.rol_usuario;
  v_activo boolean;
  v_super boolean;
begin
  if v_org is null then
    raise exception 'Sin perfil activo';
  end if;
  if p_accion is null
     or p_accion not in ('resetear_contrasena', 'quitar_acceso', 'devolver_acceso', 'editar') then
    raise exception 'Acción inválida';
  end if;
  select p.rol, p.activo, p.superadmin
    into v_rol_objetivo, v_activo, v_super
    from public.perfiles p
   where p.user_id = p_user
     and p.org_id = v_org;
  if not found then
    raise exception 'Ese usuario no existe';
  end if;
  if v_super and p_user <> v_uid then
    raise exception 'Es el superadministrador del sistema: no se puede gestionar desde acá';
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

-- 9. Cambiar de rol (y, para el portal, elegir el cliente).
create or replace function public.cambiar_vista_superadmin(p_rol public.rol_usuario, p_cliente uuid default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_perfil public.perfiles;
  v_cliente uuid;
begin
  select * into v_perfil from public.perfiles where user_id = v_uid and activo for update;
  if not found or not v_perfil.superadmin then
    raise exception 'No tenés permiso para cambiar de rol';
  end if;
  if p_rol is null or p_rol not in ('lider', 'admin', 'tesoreria', 'guardia', 'porteria', 'socio') then
    raise exception 'Elegí un rol';
  end if;
  if p_rol = 'socio' then
    select c.id into v_cliente from public.clientes c
    where c.id = p_cliente and c.org_id = v_perfil.org_id;
    if v_cliente is null then
      raise exception 'Elegí el cliente cuyo portal querés ver';
    end if;
  end if;

  perform set_config('msm.vista_superadmin', 'on', true);
  update public.perfiles
     set rol = p_rol,
         vista_cliente_id = v_cliente
   where user_id = v_uid;
  perform set_config('msm.vista_superadmin', '', true);

  return jsonb_build_object('rol', p_rol, 'cliente_id', v_cliente);
end $$;
revoke all on function public.cambiar_vista_superadmin(public.rol_usuario, uuid) from public, anon;
grant execute on function public.cambiar_vista_superadmin(public.rol_usuario, uuid) to authenticated;

-- 10. Buscar el cliente para la vista previa del portal (cualquiera sea el rol actual).
create or replace function public.clientes_para_vista(p_buscar text default null)
returns table (id uuid, codigo integer, nombre text, apodo text, categoria public.categoria_cliente, activo boolean)
language sql stable security definer set search_path = '' as $$
  select c.id, c.codigo, c.nombre, c.apodo, c.categoria, c.activo
  from public.clientes c
  join public.perfiles p
    on p.user_id = (select auth.uid()) and p.activo and p.superadmin and p.org_id = c.org_id
  where coalesce(btrim(p_buscar), '') = ''
     or c.nombre ilike '%' || btrim(p_buscar) || '%'
     or coalesce(c.apodo, '') ilike '%' || btrim(p_buscar) || '%'
     or c.codigo::text = btrim(p_buscar)
  order by c.activo desc, c.codigo
  limit 30
$$;
revoke all on function public.clientes_para_vista(text) from public, anon;
grant execute on function public.clientes_para_vista(text) to authenticated;
