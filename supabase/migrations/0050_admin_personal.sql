-- 0050: Administración también gestiona el padrón del personal (Dirección → Personal):
-- alta, edición, horarios, baja y reincorporación, igual que el Líder de Procesos.
-- La lectura ya la tenía (0008/0027); borrar empleados sigue siendo solo del Líder.

drop policy if exists "insertar empleados" on public.empleados;
create policy "insertar empleados" on public.empleados for insert to authenticated
  with check (private.tiene_rol(org_id, array['lider', 'admin']::public.rol_usuario[]));

drop policy if exists "editar empleados" on public.empleados;
create policy "editar empleados" on public.empleados for update to authenticated
  using (private.tiene_rol(org_id, array['lider', 'admin']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['lider', 'admin']::public.rol_usuario[]));

drop policy if exists "insertar horarios" on public.empleado_horarios;
create policy "insertar horarios" on public.empleado_horarios for insert to authenticated
  with check (private.tiene_rol(org_id, array['lider', 'admin']::public.rol_usuario[]));

drop policy if exists "editar horarios" on public.empleado_horarios;
create policy "editar horarios" on public.empleado_horarios for update to authenticated
  using (private.tiene_rol(org_id, array['lider', 'admin']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['lider', 'admin']::public.rol_usuario[]));

drop policy if exists "borrar horarios" on public.empleado_horarios;
create policy "borrar horarios" on public.empleado_horarios for delete to authenticated
  using (private.tiene_rol(org_id, array['lider', 'admin']::public.rol_usuario[]));

create or replace function public.reincorporar_empleado(p_empleado uuid, p_desde date default null::date)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_org uuid := private.org_actual();
  v_e record;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if not private.tiene_rol(v_org, array['lider', 'admin']::public.rol_usuario[]) then
    raise exception 'Solo Administración o el Líder de Procesos reincorporan empleados';
  end if;

  select e.id, e.activo, e.fecha_egreso into v_e
  from public.empleados e
  where e.id = p_empleado and e.org_id = v_org
  for update;
  if not found then raise exception 'Ese empleado no existe'; end if;

  if v_e.activo and v_e.fecha_egreso is null then
    return;
  end if;

  if p_desde is not null and v_e.fecha_egreso is not null then
    if p_desde <= v_e.fecha_egreso then
      raise exception 'La vuelta tiene que ser después de la baja (%)', to_char(v_e.fecha_egreso, 'DD/MM/YYYY');
    end if;
    if p_desde > private.hoy_ar() + 31 then
      raise exception 'Revisá la fecha de vuelta: es dentro de más de un mes';
    end if;
    if p_desde > v_e.fecha_egreso + 1 then
      insert into public.empleado_bajas (org_id, empleado_id, desde, hasta, creada_por)
      values (v_org, v_e.id, v_e.fecha_egreso + 1, p_desde - 1, auth.uid());
    end if;
  end if;

  update public.empleados
     set activo = true, fecha_egreso = null, actualizado_en = now()
   where id = v_e.id;
end $function$;
