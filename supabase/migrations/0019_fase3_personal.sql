-- ============================================================
-- Mercado San Miguel — 0019 Fase 3 · M7: Personal, novedades y solicitudes
-- Contrato: docs/FASE3-CONTRATO.md §4.10 (H3, H4, G11, J5, F5) y §1.3 (D-P2).
--
-- Requiere 0010, 0011 y 0012 aplicadas. Se aplica como UNA transacción, en la
-- ventana de mantenimiento (§0.3), después de 0013…0018 y antes de 0022.
-- Idempotente: solo `create or replace` y `drop trigger if exists` + `create trigger`.
--
-- Contenido
--   · private.preparar_novedad()   trigger BEFORE INSERT OR UPDATE en novedades_personal
--   · public.revisar_novedad(…)    Administración / Líder aprueban o rechazan (firma de 0012)
--   · public.aprobar_novedades(…)  "Aprobar todas (N)"                          (firma de 0012)
--   · public.anular_novedad(…)     anulación con motivo y rastro                (firma de 0012)
--   · public.resumen_novedades(…)  planilla mensual, SECURITY INVOKER            (firma de 0012)
--   · public.avanzar_solicitud(…)  máquina de estados con el Jefe de Portería (misma firma)
--   · private.preparar_solicitud() trigger BEFORE INSERT en solicitudes
--   · private.tocar_solicitud()    trigger AFTER INSERT en solicitud_mensajes
--
-- Service role / migraciones (auth.uid() nulo): los triggers no imponen reglas de rol
-- (mismo criterio que private.proteger_perfiles): las semillas pueden cargar datos en
-- cualquier estado. Desde la app (PostgREST, rol authenticated) rigen todas las reglas.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Novedades: trigger preparar_novedad (H4)
-- ------------------------------------------------------------
create or replace function private.preparar_novedad()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_rol public.rol_usuario := private.rol_actual();
  v_emp record;
  v_datos_cambian boolean;
begin
  -- Empleado de la misma organización. El bloqueo serializa dos cargas simultáneas
  -- del mismo empleado (así el control de "novedad repetida" no se saltea).
  select e.id, e.org_id, e.sector into v_emp
  from public.empleados e
  where e.id = new.empleado_id
  for no key update;
  if v_emp.id is null or v_emp.org_id is distinct from new.org_id then
    raise exception 'Ese empleado no existe';
  end if;

  if tg_op = 'INSERT' then
    -- Foto del sector del empleado: define quién la ve aunque después cambie de sector.
    new.sector := v_emp.sector;
    new.cargada_en := now();
    new.actualizada_en := now();
    new.anulada_por := null;
    new.anulada_en := null;
    new.motivo_anulacion := null;
    if v_uid is not null then
      new.cargada_por := v_uid;
      new.motivo_rechazo := null;
      if v_rol in ('admin', 'lider') then
        -- Lo que carga Administración o el Líder queda aprobado en el acto.
        new.estado := 'aprobada';
        new.revisada_por := v_uid;
        new.revisada_en := now();
      else
        -- Lo que carga el Jefe de Portería espera el OK de Administración.
        new.estado := 'pendiente';
        new.revisada_por := null;
        new.revisada_en := null;
      end if;
    end if;
    v_datos_cambian := true;
  else
    if new.empleado_id is distinct from old.empleado_id then
      raise exception 'No se puede cambiar el empleado de una novedad: borrala y cargala de nuevo';
    end if;
    -- Lo que no se edita nunca (tampoco está en el grant de UPDATE).
    new.org_id := old.org_id;
    new.sector := old.sector;
    new.cargada_por := old.cargada_por;
    new.cargada_en := old.cargada_en;
    new.actualizada_en := now();
    v_datos_cambian := (new.tipo, new.fecha_desde, new.fecha_hasta, new.horas, new.justificada, new.detalle)
      is distinct from (old.tipo, old.fecha_desde, old.fecha_hasta, old.horas, old.justificada, old.detalle);
  end if;

  if v_uid is not null and not (new.sector = any (private.sectores_novedades())) then
    raise exception 'No podés cargar novedades de ese sector';
  end if;

  if v_datos_cambian then
    -- Cada tipo guarda solo lo suyo (los contadores de la planilla no se ensucian).
    if new.tipo not in ('vacaciones', 'licencia') then
      new.fecha_hasta := null;
    elsif new.fecha_hasta = new.fecha_desde then
      new.fecha_hasta := null;
    end if;
    if new.tipo not in ('llegada_tarde', 'horas_extra', 'feriado_trabajado') then
      new.horas := null;
    end if;
    if new.tipo in ('falta', 'llegada_tarde') then
      new.justificada := coalesce(new.justificada, false);
    else
      new.justificada := null;
    end if;
    new.detalle := nullif(trim(coalesce(new.detalle, '')), '');

    if new.tipo in ('falta', 'llegada_tarde', 'feriado_trabajado', 'horas_extra')
       and new.fecha_desde > private.hoy_ar() then
      raise exception 'Esa novedad no puede tener fecha futura';
    end if;

    -- Sin dos novedades del mismo tipo que se pisen (pendientes o aprobadas). "Otra" es
    -- texto libre: dos notas distintas el mismo día son válidas.
    if new.estado in ('pendiente', 'aprobada') and new.tipo <> 'otra' and exists (
      select 1 from public.novedades_personal n
      where n.empleado_id = new.empleado_id
        and n.id <> new.id
        and n.tipo = new.tipo
        and n.estado in ('pendiente', 'aprobada')
        and n.fecha_desde <= coalesce(new.fecha_hasta, new.fecha_desde)
        and coalesce(n.fecha_hasta, n.fecha_desde) >= new.fecha_desde) then
      raise exception 'Ya hay una novedad igual cargada para esos días';
    end if;
  end if;

  return new;
end $$;
revoke all on function private.preparar_novedad() from public, anon;

drop trigger if exists preparar_novedad on public.novedades_personal;
create trigger preparar_novedad before insert or update on public.novedades_personal
  for each row execute function private.preparar_novedad();


-- ------------------------------------------------------------
-- 2. revisar_novedad: Administración (o el Líder) aprueba o rechaza lo del Jefe
-- ------------------------------------------------------------
create or replace function public.revisar_novedad(
  p_novedad uuid,
  p_aprobar boolean,
  p_motivo text default null
) returns public.estado_novedad
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
  v_n public.novedades_personal;
  v_nuevo public.estado_novedad;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('admin', 'lider') then
    raise exception 'Las novedades las aprueba Administración o el Líder de Procesos';
  end if;

  select * into v_n from public.novedades_personal
  where id = p_novedad and org_id = v_org
  for update;
  if not found then raise exception 'Esa novedad ya no existe. Actualizá la página.'; end if;
  if not (v_n.sector = any (private.sectores_novedades())) then
    raise exception 'Sin permiso sobre ese sector';
  end if;
  if v_n.estado <> 'pendiente' then raise exception 'La novedad ya fue revisada'; end if;
  if not coalesce(p_aprobar, false) and v_motivo is null then
    raise exception 'Contá por qué se rechaza';
  end if;

  v_nuevo := case when coalesce(p_aprobar, false) then 'aprobada' else 'rechazada' end;
  update public.novedades_personal
     set estado = v_nuevo,
         revisada_por = auth.uid(),
         revisada_en = now(),
         motivo_rechazo = case when v_nuevo = 'rechazada' then v_motivo else null end
   where id = v_n.id;
  return v_nuevo;
end $$;
revoke all on function public.revisar_novedad(uuid, boolean, text) from public, anon;
grant execute on function public.revisar_novedad(uuid, boolean, text) to authenticated;


-- ------------------------------------------------------------
-- 3. aprobar_novedades: "Aprobar todas (N)"
-- ------------------------------------------------------------
create or replace function public.aprobar_novedades(p_ids uuid[])
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_cant integer := 0;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('admin', 'lider') then
    raise exception 'Las novedades las aprueba Administración o el Líder de Procesos';
  end if;
  if p_ids is null or cardinality(p_ids) = 0 then return 0; end if;

  -- Bloqueo en orden de id (dos "Aprobar todas" simultáneos no se trancan) y recién
  -- después se filtra por estado: lo que otro ya revisó se saltea sin error.
  with objetivo as (
    select n.id
    from public.novedades_personal n
    where n.id = any (p_ids)
      and n.org_id = v_org
      and n.estado = 'pendiente'
      and n.sector = any (private.sectores_novedades())
    order by n.id
    for update
  )
  update public.novedades_personal n
     set estado = 'aprobada',
         revisada_por = auth.uid(),
         revisada_en = now(),
         motivo_rechazo = null
    from objetivo o
   where n.id = o.id
     and n.estado = 'pendiente';
  get diagnostics v_cant = row_count;
  return v_cant;
end $$;
revoke all on function public.aprobar_novedades(uuid[]) from public, anon;
grant execute on function public.aprobar_novedades(uuid[]) to authenticated;


-- ------------------------------------------------------------
-- 4. anular_novedad: una aprobada que resultó errónea se anula con motivo (no se borra)
-- ------------------------------------------------------------
create or replace function public.anular_novedad(p_novedad uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
  v_n public.novedades_personal;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('admin', 'lider') then
    raise exception 'Las novedades aprobadas las anula Administración o el Líder de Procesos';
  end if;

  select * into v_n from public.novedades_personal
  where id = p_novedad and org_id = v_org
  for update;
  if not found then raise exception 'Esa novedad ya no existe. Actualizá la página.'; end if;
  if not (v_n.sector = any (private.sectores_novedades())) then
    raise exception 'Sin permiso sobre ese sector';
  end if;
  if v_n.estado <> 'aprobada' then
    raise exception 'Solo se anulan novedades aprobadas (las pendientes se borran)';
  end if;
  if v_motivo is null then raise exception 'Contá por qué la anulás'; end if;

  update public.novedades_personal
     set estado = 'anulada',
         anulada_por = auth.uid(),
         anulada_en = now(),
         motivo_anulacion = v_motivo
   where id = v_n.id;
end $$;
revoke all on function public.anular_novedad(uuid, text) from public, anon;
grant execute on function public.anular_novedad(uuid, text) to authenticated;


-- ------------------------------------------------------------
-- 5. resumen_novedades: planilla del mes (H4). SECURITY INVOKER: la RLS de empleados,
--    horarios, ingresos y novedades recorta; además filtra por los sectores del rol.
-- ------------------------------------------------------------
create or replace function public.resumen_novedades(p_periodo date)
returns table (
  empleado_id uuid,
  apellido text,
  nombre text,
  dni text,
  sector public.sector_personal,
  activo boolean,
  horas_semanales numeric,
  horas_esperadas numeric,
  horas_registradas numeric,
  ingresos integer,
  ingresos_sin_salida integer,
  faltas integer,
  faltas_injustificadas integer,
  llegadas_tarde integer,
  horas_tarde numeric,
  feriados_trabajados integer,
  horas_feriado numeric,
  dias_vacaciones integer,
  dias_licencia integer,
  horas_extra numeric,
  otras integer,
  pendientes integer
)
language plpgsql stable security invoker set search_path = '' as $$
#variable_conflict use_column
declare
  v_org uuid := private.org_actual();
  v_hoy date := private.hoy_ar();
  v_desde date;
  v_fin date;
  v_hasta date;
  v_sectores public.sector_personal[] := private.sectores_novedades();
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  v_desde := date_trunc('month', coalesce(p_periodo, v_hoy))::date;
  v_fin := (v_desde + interval '1 month' - interval '1 day')::date;
  -- En el mes en curso, las horas que debería tener se cuentan hasta hoy.
  v_hasta := least(v_fin, v_hoy);

  return query
  with emp as (
    select e.id, e.apellido, e.nombre, e.dni, e.sector, e.activo, e.horas_semanales,
           e.fecha_ingreso, e.fecha_egreso
    from public.empleados e
    where e.org_id = v_org
      and e.sector = any (v_sectores)
      and (e.fecha_ingreso is null or e.fecha_ingreso <= v_fin)
      and (e.fecha_egreso is null or e.fecha_egreso >= v_desde)
      and (e.activo or e.fecha_egreso is not null)
  ),
  franjas as (
    select h.empleado_id, h.dia_semana,
           sum(extract(epoch from (h.hora_hasta - h.hora_desde)) / 3600.0) as horas
    from public.empleado_horarios h
    join emp e on e.id = h.empleado_id
    group by h.empleado_id, h.dia_semana
  ),
  semana as (
    select f.empleado_id, sum(f.horas) as horas from franjas f group by f.empleado_id
  ),
  -- Novedades del mes que tocan el mes (pendientes y aprobadas; los contadores usan
  -- solo las aprobadas).
  nov as (
    select n.empleado_id, n.tipo, n.estado, n.fecha_desde, coalesce(n.fecha_hasta, n.fecha_desde) as fecha_hasta,
           n.horas, n.justificada
    from public.novedades_personal n
    join emp e on e.id = n.empleado_id
    where n.org_id = v_org
      and n.estado in ('pendiente', 'aprobada')
      and n.fecha_desde <= v_fin
      and coalesce(n.fecha_hasta, n.fecha_desde) >= v_desde
  ),
  dias as (
    select e.id as empleado_id, d::date as fecha
    from emp e
    cross join lateral generate_series(
      greatest(v_desde, coalesce(e.fecha_ingreso, v_desde)),
      least(v_hasta, coalesce(e.fecha_egreso, v_hasta)),
      interval '1 day') as d
  ),
  esperadas as (
    select d.empleado_id,
           sum(case
                 when e.horas_semanales is not null then e.horas_semanales / 7.0
                 else coalesce(f.horas, 0)
               end) as horas
    from dias d
    join emp e on e.id = d.empleado_id
    left join franjas f on f.empleado_id = d.empleado_id
                       and f.dia_semana = extract(isodow from d.fecha)::int
    where not exists (
      select 1 from nov n
      where n.empleado_id = d.empleado_id
        and n.estado = 'aprobada'
        and n.tipo in ('vacaciones', 'licencia')
        and d.fecha between n.fecha_desde and n.fecha_hasta)
    group by d.empleado_id
  ),
  ing as (
    select e.id as empleado_id, i.ingreso_en, i.egreso_en,
           (i.ingreso_en at time zone 'America/Argentina/Cordoba')::date as dia
    from public.ingresos_personal i
    join emp e on (i.empleado_id = e.id or (i.empleado_id is null and i.dni = e.dni))
    where i.org_id = v_org
      and i.ingreso_en >= (v_desde::timestamp at time zone 'America/Argentina/Cordoba')
      and i.ingreso_en < ((v_fin + 1)::timestamp at time zone 'America/Argentina/Cordoba')
  ),
  reg as (
    select g.empleado_id,
           count(*)::integer as ingresos,
           (count(*) filter (where g.egreso_en is null and g.dia < v_hoy))::integer as sin_salida,
           coalesce(sum(least(extract(epoch from (g.egreso_en - g.ingreso_en)) / 3600.0, 16))
                    filter (where g.egreso_en is not null), 0) as horas
    from ing g
    group by g.empleado_id
  ),
  cont as (
    select n.empleado_id,
      (count(*) filter (where n.estado = 'aprobada' and n.tipo = 'falta'
                          and n.fecha_desde >= v_desde))::integer as faltas,
      (count(*) filter (where n.estado = 'aprobada' and n.tipo = 'falta'
                          and n.fecha_desde >= v_desde and not coalesce(n.justificada, false)))::integer as faltas_inj,
      (count(*) filter (where n.estado = 'aprobada' and n.tipo = 'llegada_tarde'
                          and n.fecha_desde >= v_desde))::integer as tardes,
      coalesce(sum(n.horas) filter (where n.estado = 'aprobada' and n.tipo = 'llegada_tarde'
                                      and n.fecha_desde >= v_desde), 0) as horas_tarde,
      (count(*) filter (where n.estado = 'aprobada' and n.tipo = 'feriado_trabajado'
                          and n.fecha_desde >= v_desde))::integer as feriados,
      coalesce(sum(n.horas) filter (where n.estado = 'aprobada' and n.tipo = 'feriado_trabajado'
                                      and n.fecha_desde >= v_desde), 0) as horas_feriado,
      coalesce(sum(least(n.fecha_hasta, v_fin) - greatest(n.fecha_desde, v_desde) + 1)
               filter (where n.estado = 'aprobada' and n.tipo = 'vacaciones'), 0)::integer as vacaciones,
      coalesce(sum(least(n.fecha_hasta, v_fin) - greatest(n.fecha_desde, v_desde) + 1)
               filter (where n.estado = 'aprobada' and n.tipo = 'licencia'), 0)::integer as licencia,
      coalesce(sum(n.horas) filter (where n.estado = 'aprobada' and n.tipo = 'horas_extra'
                                      and n.fecha_desde >= v_desde), 0) as extra,
      (count(*) filter (where n.estado = 'aprobada' and n.tipo = 'otra'
                          and n.fecha_desde >= v_desde))::integer as otras,
      (count(*) filter (where n.estado = 'pendiente'))::integer as pendientes
    from nov n
    group by n.empleado_id
  )
  select e.id,
         e.apellido,
         e.nombre,
         e.dni,
         e.sector,
         e.activo,
         round(coalesce(e.horas_semanales, s.horas), 2),
         round(coalesce(es.horas, 0), 2),
         round(coalesce(r.horas, 0), 2),
         coalesce(r.ingresos, 0),
         coalesce(r.sin_salida, 0),
         coalesce(c.faltas, 0),
         coalesce(c.faltas_inj, 0),
         coalesce(c.tardes, 0),
         round(coalesce(c.horas_tarde, 0), 2),
         coalesce(c.feriados, 0),
         round(coalesce(c.horas_feriado, 0), 2),
         coalesce(c.vacaciones, 0),
         coalesce(c.licencia, 0),
         round(coalesce(c.extra, 0), 2),
         coalesce(c.otras, 0),
         coalesce(c.pendientes, 0)
  from emp e
  left join semana s on s.empleado_id = e.id
  left join esperadas es on es.empleado_id = e.id
  left join reg r on r.empleado_id = e.id
  left join cont c on c.empleado_id = e.id
  order by e.sector, e.apellido, e.nombre;
end $$;
revoke all on function public.resumen_novedades(date) from public, anon;
grant execute on function public.resumen_novedades(date) to authenticated;


-- ------------------------------------------------------------
-- 6. Solicitudes: trigger preparar_solicitud (H3, J5, G11)
--    Cierra el agujero de insertar una solicitud "ya resuelta" y decide a quién le llega.
-- ------------------------------------------------------------
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
        when 'bar' then coalesce(v_esp.numero, 'Bar')
        else initcap(v_esp.tipo) || ' ' || coalesce(v_esp.numero, '')
      end;
    end if;
  end if;

  return new;
end $$;
revoke all on function private.preparar_solicitud() from public, anon;

drop trigger if exists preparar_solicitud on public.solicitudes;
create trigger preparar_solicitud before insert on public.solicitudes
  for each row execute function private.preparar_solicitud();


-- ------------------------------------------------------------
-- 7. Solicitudes: trigger tocar_solicitud — cualquier mensaje sube la solicitud en la
--    bandeja (quien escribe puede no tener UPDATE sobre solicitudes: security definer).
-- ------------------------------------------------------------
create or replace function private.tocar_solicitud()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.solicitudes
     set actualizada_en = now()
   where id = new.solicitud_id;
  return null;
end $$;
revoke all on function private.tocar_solicitud() from public, anon;

drop trigger if exists tocar_solicitud on public.solicitud_mensajes;
create trigger tocar_solicitud after insert on public.solicitud_mensajes
  for each row execute function private.tocar_solicitud();


-- ------------------------------------------------------------
-- 8. avanzar_solicitud (misma firma que 0008). Suma el Jefe de Portería (H3), el
--    registro de lo que decide el Consejo (F5) y el Líder operando todo (§1.3 D-P2).
-- ------------------------------------------------------------
create or replace function public.avanzar_solicitud(
  p_solicitud uuid,
  p_accion text,
  p_texto text default null,
  p_usuario uuid default null
) returns public.estado_solicitud
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_uid uuid := auth.uid();
  v_s public.solicitudes;
  v_texto text := nullif(trim(coalesce(p_texto, '')), '');
  v_nuevo public.estado_solicitud;
  v_nombre text;
  v_de text;
  v_mensaje text;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('admin', 'guardia', 'lider', 'consejo') then
    raise exception 'No tenés permiso para cambiar el estado de las solicitudes';
  end if;

  select * into v_s from public.solicitudes
  where id = p_solicitud and org_id = v_org
  for update;
  if not found then raise exception 'Solicitud inexistente'; end if;

  -- El Jefe de Portería actúa solo sobre las solicitudes de Portería.
  if v_rol = 'guardia' and v_s.origen <> 'porteria' then
    raise exception 'Solo podés actuar sobre solicitudes de Portería';
  end if;

  select p.nombre into v_nombre from public.perfiles p where p.user_id = v_uid;

  if p_accion = 'elevar' then
    if v_rol not in ('guardia', 'lider') then
      raise exception 'Solo el Jefe de Portería eleva solicitudes al Líder de Procesos';
    end if;
    if v_s.estado <> 'con_jefe' then
      raise exception 'La solicitud ya no está con el Jefe de Portería. Actualizá la página.';
    end if;
    v_nuevo := 'nueva';
    update public.solicitudes
       set estado = v_nuevo, elevada_por = v_uid, elevada_en = now()
     where id = v_s.id;
    v_mensaje := 'Elevó la solicitud al Líder de Procesos.' || coalesce(' ' || v_texto, '');

  elsif p_accion = 'resolver_jefe' then
    if v_rol not in ('guardia', 'lider') then
      raise exception 'Solo el Jefe de Portería resuelve las solicitudes de Portería';
    end if;
    if v_s.estado <> 'con_jefe' then
      raise exception 'La solicitud ya no está con el Jefe de Portería. Actualizá la página.';
    end if;
    if v_texto is null then raise exception 'Contá cómo la resolviste'; end if;
    v_de := case when v_rol = 'guardia' then 'jefe' else 'lider' end;
    v_nuevo := 'cerrada';
    update public.solicitudes
       set estado = v_nuevo, resolucion = v_texto, resolucion_de = v_de,
           resuelta_por = v_uid, resuelta_en = now(), cerrada_en = now()
     where id = v_s.id;
    v_mensaje := case when v_de = 'jefe' then 'Resolución del Jefe de Portería: ' else 'Resolución: ' end || v_texto;

  elsif p_accion = 'tomar' then
    if v_rol = 'guardia' then
      raise exception 'Resolvela o elevala al Líder de Procesos';
    end if;
    if v_rol = 'admin' then
      if v_s.estado <> 'nueva' then raise exception 'La solicitud ya está en revisión'; end if;
    elsif v_s.estado not in ('nueva', 'con_jefe') then
      raise exception 'La solicitud ya está en revisión';
    end if;
    v_nuevo := 'en_revision';
    update public.solicitudes
       set estado = v_nuevo, revisada_por = v_uid, revisada_en = now()
     where id = v_s.id;
    v_mensaje := 'Tomó la solicitud para revisarla.';

  elsif p_accion = 'derivar_consejo' then
    if v_rol <> 'lider' then raise exception 'Solo el Líder de Procesos deriva al Consejo'; end if;
    if v_s.estado not in ('nueva', 'en_revision', 'con_jefe') then
      raise exception 'La solicitud no está en revisión';
    end if;
    v_nuevo := 'en_consejo';
    update public.solicitudes
       set estado = v_nuevo, derivada_consejo_en = now(),
           revisada_por = coalesce(revisada_por, v_uid), revisada_en = coalesce(revisada_en, now())
     where id = v_s.id;
    v_mensaje := 'Derivó la solicitud al Consejo.' || coalesce(' ' || v_texto, '');

  elsif p_accion = 'resolver' then
    if v_rol not in ('lider', 'consejo') then
      raise exception 'Solo el Líder de Procesos registra la resolución';
    end if;
    if v_s.estado not in ('nueva', 'en_revision', 'en_consejo', 'con_jefe') then
      raise exception 'La solicitud no admite resolución en este estado';
    end if;
    if v_texto is null then raise exception 'Escribí la resolución'; end if;
    -- Lo que decide el Consejo lo registra el Líder (F5): queda dicho quién decidió.
    v_de := case when v_s.estado = 'en_consejo' or v_rol = 'consejo' then 'consejo' else 'lider' end;
    v_nuevo := 'resuelta';
    update public.solicitudes
       set estado = v_nuevo, resolucion = v_texto, resolucion_de = v_de,
           resuelta_por = v_uid, resuelta_en = now()
     where id = v_s.id;
    v_mensaje := 'Resolución: ' || v_texto;

  elsif p_accion = 'asignar' then
    if v_rol <> 'lider' then
      raise exception 'Solo el Líder de Procesos asigna resoluciones a Administración';
    end if;
    if v_s.estado not in ('resuelta', 'en_revision', 'en_consejo', 'nueva', 'con_jefe') then
      raise exception 'La solicitud no se puede asignar en este estado';
    end if;
    if v_s.resolucion is null and v_texto is null then
      raise exception 'Escribí qué tiene que hacer Administración';
    end if;
    if p_usuario is not null and not exists (
      select 1 from public.perfiles p
      where p.user_id = p_usuario and p.org_id = v_org and p.rol = 'admin' and p.activo) then
      raise exception 'Elegí a alguien de Administración';
    end if;
    v_de := case when v_s.estado = 'en_consejo' then 'consejo' else 'lider' end;
    v_nuevo := 'asignada';
    update public.solicitudes
       set estado = v_nuevo,
           resolucion = coalesce(v_texto, resolucion),
           resolucion_de = case when v_texto is not null and resolucion is null then v_de
                                else coalesce(resolucion_de, v_de) end,
           resuelta_por = coalesce(resuelta_por, v_uid), resuelta_en = coalesce(resuelta_en, now()),
           asignada_a = p_usuario, asignada_en = now()
     where id = v_s.id;
    v_mensaje := 'Asignó la resolución a Administración.' || coalesce(' ' || v_texto, '');

  elsif p_accion = 'ejecutar' then
    if v_rol not in ('admin', 'lider') then raise exception 'Solo Administración ejecuta la resolución'; end if;
    if v_s.estado <> 'asignada' then raise exception 'La solicitud todavía no fue asignada'; end if;
    v_nuevo := 'ejecutada';
    update public.solicitudes
       set estado = v_nuevo, ejecutada_por = v_uid, ejecutada_en = now(), nota_ejecucion = v_texto
     where id = v_s.id;
    v_mensaje := 'Ejecutó la resolución.' || coalesce(' ' || v_texto, '');

  elsif p_accion = 'rechazar' then
    if v_rol = 'guardia' then
      if v_s.estado <> 'con_jefe' then
        raise exception 'La solicitud ya no está con el Jefe de Portería. Actualizá la página.';
      end if;
      v_de := 'jefe';
    elsif v_rol in ('lider', 'consejo') then
      v_de := case when v_s.estado = 'en_consejo' or v_rol = 'consejo' then 'consejo' else 'lider' end;
    else
      raise exception 'Solo el Líder de Procesos rechaza solicitudes';
    end if;
    if v_s.estado in ('ejecutada', 'cerrada', 'rechazada') then
      raise exception 'La solicitud ya está terminada';
    end if;
    if v_texto is null then raise exception 'Contá por qué se rechaza'; end if;
    v_nuevo := 'rechazada';
    update public.solicitudes
       set estado = v_nuevo, resolucion = v_texto, resolucion_de = v_de,
           resuelta_por = v_uid, resuelta_en = now(), cerrada_en = now()
     where id = v_s.id;
    v_mensaje := 'Rechazó la solicitud: ' || v_texto;

  elsif p_accion = 'cerrar' then
    if v_rol not in ('lider', 'admin') then raise exception 'Sin permiso'; end if;
    if v_s.estado = 'cerrada' then raise exception 'La solicitud ya está cerrada'; end if;
    v_nuevo := 'cerrada';
    update public.solicitudes set estado = v_nuevo, cerrada_en = now() where id = v_s.id;
    v_mensaje := 'Cerró la solicitud.' || coalesce(' ' || v_texto, '');

  elsif p_accion = 'reabrir' then
    if v_rol <> 'lider' then raise exception 'Solo el Líder de Procesos reabre solicitudes'; end if;
    v_nuevo := 'en_revision';
    update public.solicitudes
       set estado = v_nuevo, cerrada_en = null,
           revisada_por = coalesce(revisada_por, v_uid), revisada_en = coalesce(revisada_en, now())
     where id = v_s.id;
    v_mensaje := 'Reabrió la solicitud.' || coalesce(' ' || v_texto, '');

  else
    raise exception 'Acción desconocida';
  end if;

  update public.solicitudes set actualizada_en = now() where id = v_s.id;

  -- El cambio de estado queda como mensaje del hilo (visible para todos).
  insert into public.solicitud_mensajes (org_id, solicitud_id, autor_id, autor_nombre, autor_rol, mensaje, interno)
  values (v_org, v_s.id, v_uid, coalesce(v_nombre, 'Sistema'), v_rol, v_mensaje, false);

  return v_nuevo;
end;
$$;
revoke all on function public.avanzar_solicitud(uuid, text, text, uuid) from public, anon;
grant execute on function public.avanzar_solicitud(uuid, text, text, uuid) to authenticated;


-- ------------------------------------------------------------
-- Pedidos a Fundación (no son de M7; no se escriben acá)
-- ------------------------------------------------------------
-- · Ninguna policy nueva: 0011 (novedades + storage del Jefe) y 0022 (lectura de solicitudes
--   del Jefe, grants de INSERT acotados) alcanzan para este módulo.
-- · src/components/shared/boton-exportar.tsx: sumar "novedades_personal" a DatasetExportable (§5.6).
