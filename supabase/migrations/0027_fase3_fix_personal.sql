-- ============================================================
-- Mercado San Miguel — 0027 Fase 3 · Correcciones de Personal, Novedades y Solicitudes (M7)
-- Contrato: docs/FASE3-CONTRATO.md §4.10 (y §4.0 reglas transversales).
-- Se aplica DESPUÉS de 0022 (no depende de 0023/0025/0028 ni ellas de esta).
-- Idempotente: se puede volver a correr. UNA transacción.
--
-- 1. solicitudes.ref: clave de idempotencia del alta (formulario y aviso desde el mapa).
--    Si se corta el wifi y el portero toca "Enviar" de nuevo, no sale una solicitud repetida:
--    la acción encuentra la que ya se guardó con esa clave y la devuelve.
-- 2. solicitud_mensajes.ref: ídem para los mensajes del hilo.
-- 3. novedades_personal.lote: ídem para "Cargar novedad" (una carga de varios empleados
--    comparte el lote). Antes, un reintento de una novedad "Otra" se duplicaba.
-- 4. "Respuesta nueva" para quien cargó la solicitud (H3/J5): solicitudes.solicitante_visto_en
--    + solicitudes_con_respuesta() (ids de MIS solicitudes con algo nuevo de otra persona) +
--    marcar_solicitud_vista() (lo apaga al abrir el detalle).
-- 5. Aviso de novedades rechazadas del Jefe: novedades_personal.rechazo_visto_en +
--    ocultar_rechazo_novedad() ("Entendido").
-- 6. Turnos nocturnos (sereno 22 a 06): empleado_horarios acepta franjas que cruzan la
--    medianoche (salida ≤ entrada = termina al día siguiente). resumen_novedades suma 24 h.
-- 7. Reincorporación con período afuera: tabla empleado_bajas (días entre una baja y la
--    vuelta) + reincorporar_empleado(p_empleado, p_desde). resumen_novedades no cuenta esos
--    días ni muestra al empleado en los meses que estuvo afuera. Sin p_desde = "fue un error,
--    deshacer la baja" (como antes).
-- ============================================================


-- ------------------------------------------------------------
-- 1. solicitudes.ref — idempotencia del alta.
-- ------------------------------------------------------------
alter table public.solicitudes add column if not exists ref uuid;
create unique index if not exists solicitudes_ref_unq
  on public.solicitudes (org_id, ref) where ref is not null;
comment on column public.solicitudes.ref is
  'Clave de idempotencia del alta (uuid por intento desde la UI): un reintento no duplica la solicitud.';
grant insert (ref) on public.solicitudes to authenticated;


-- ------------------------------------------------------------
-- 2. solicitud_mensajes.ref — idempotencia del mensaje del hilo (INSERT ya es por tabla).
-- ------------------------------------------------------------
alter table public.solicitud_mensajes add column if not exists ref uuid;
create unique index if not exists solicitud_mensajes_ref_unq
  on public.solicitud_mensajes (solicitud_id, ref) where ref is not null;
comment on column public.solicitud_mensajes.ref is
  'Clave de idempotencia del mensaje (uuid por intento desde la UI): un reintento no lo duplica.';


-- ------------------------------------------------------------
-- 3. novedades_personal.lote — idempotencia de "Cargar novedad".
--    Una fila por empleado con el mismo lote. El UPDATE no la toca (no está en el grant).
-- ------------------------------------------------------------
alter table public.novedades_personal add column if not exists lote uuid;
create unique index if not exists novedades_lote_unq
  on public.novedades_personal (org_id, lote, empleado_id) where lote is not null;
comment on column public.novedades_personal.lote is
  'Clave de idempotencia de la carga (uuid por intento desde la UI, compartido por los empleados de una carga múltiple).';
grant insert (lote) on public.novedades_personal to authenticated;


-- ------------------------------------------------------------
-- 4. "Respuesta nueva" para quien cargó la solicitud.
--    Hay algo nuevo cuando, después de la última vez que la abrió (o de crearla), otra persona
--    escribió en el hilo o la movió de estado (avanzar_solicitud deja un mensaje automático).
--    Las notas internas no cuentan. Nadie escribe solicitante_visto_en directo (no está en
--    ningún grant): solo marcar_solicitud_vista.
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'solicitudes' and column_name = 'solicitante_visto_en'
  ) then
    alter table public.solicitudes add column solicitante_visto_en timestamptz;
    -- Solo al crear la columna: lo que no se movió en los últimos 3 días se da por visto (si
    -- no, cada uno vería de golpe todas sus solicitudes viejas como "Respuesta nueva").
    update public.solicitudes
       set solicitante_visto_en = now()
     where actualizada_en < now() - interval '3 days';
  end if;
end $$;
comment on column public.solicitudes.solicitante_visto_en is
  'Última vez que quien la cargó abrió el detalle con algo nuevo (apaga "Respuesta nueva").';
create index if not exists solicitudes_creada_por_idx
  on public.solicitudes (creada_por, actualizada_en desc) where creada_por is not null;

create or replace function public.solicitudes_con_respuesta()
returns setof uuid
language sql stable security definer set search_path = '' as $$
  select s.id
  from public.solicitudes s
  where s.creada_por = (select auth.uid())
    and s.org_id = (select private.org_actual())
    -- Filtro barato: cualquier mensaje o cambio de estado mueve actualizada_en.
    and s.actualizada_en > coalesce(s.solicitante_visto_en, s.creada_en)
    and exists (
      select 1 from public.solicitud_mensajes m
      where m.solicitud_id = s.id
        and m.creado_en > coalesce(s.solicitante_visto_en, s.creada_en)
        and m.autor_id is distinct from s.creada_por
        and not m.interno);
$$;
revoke all on function public.solicitudes_con_respuesta() from public, anon;
grant execute on function public.solicitudes_con_respuesta() to authenticated;

-- Devuelve true si había algo nuevo (y lo apagó); false si no había nada o no es suya.
create or replace function public.marcar_solicitud_vista(p_solicitud uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_n integer;
begin
  if v_uid is null then return false; end if;
  update public.solicitudes s
     set solicitante_visto_en = now()
   where s.id = p_solicitud
     and s.creada_por = v_uid
     and s.org_id = private.org_actual()
     and s.actualizada_en > coalesce(s.solicitante_visto_en, s.creada_en)
     and exists (
       select 1 from public.solicitud_mensajes m
       where m.solicitud_id = s.id
         and m.creado_en > coalesce(s.solicitante_visto_en, s.creada_en)
         and m.autor_id is distinct from s.creada_por
         and not m.interno);
  get diagnostics v_n = row_count;
  return v_n > 0;
end $$;
revoke all on function public.marcar_solicitud_vista(uuid) from public, anon;
grant execute on function public.marcar_solicitud_vista(uuid) to authenticated;


-- ------------------------------------------------------------
-- 5. Novedades rechazadas: "Entendido" las saca del aviso del Jefe.
-- ------------------------------------------------------------
alter table public.novedades_personal add column if not exists rechazo_visto_en timestamptz;
comment on column public.novedades_personal.rechazo_visto_en is
  'Quien la cargó tocó "Entendido" en el aviso de rechazo (deja de mostrarse).';

create or replace function public.ocultar_rechazo_novedad(p_novedad uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_n integer;
begin
  if v_uid is null then return false; end if;
  update public.novedades_personal n
     set rechazo_visto_en = now()
   where n.id = p_novedad
     and n.cargada_por = v_uid
     and n.org_id = private.org_actual()
     and n.estado = 'rechazada'
     and n.rechazo_visto_en is null;
  get diagnostics v_n = row_count;
  return v_n > 0;
end $$;
revoke all on function public.ocultar_rechazo_novedad(uuid) from public, anon;
grant execute on function public.ocultar_rechazo_novedad(uuid) to authenticated;


-- ------------------------------------------------------------
-- 6. Franjas que cruzan la medianoche: salida ≤ entrada = termina al día siguiente
--    (22:00 a 06:00 son 8 h del día en que entra). Solo se prohíbe entrada = salida.
-- ------------------------------------------------------------
alter table public.empleado_horarios drop constraint if exists empleado_horarios_check;
alter table public.empleado_horarios drop constraint if exists empleado_horarios_franja_check;
alter table public.empleado_horarios
  add constraint empleado_horarios_franja_check check (hora_hasta <> hora_desde);


-- ------------------------------------------------------------
-- 7. Períodos de baja entre dos etapas de trabajo (reincorporación).
--    Solo los escribe reincorporar_empleado; los leen los mismos que leen empleados
--    (resumen_novedades es security invoker).
-- ------------------------------------------------------------
create table if not exists public.empleado_bajas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizaciones(id),
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  desde date not null,
  hasta date not null,
  creada_por uuid references auth.users(id),
  creada_en timestamptz not null default now(),
  constraint empleado_bajas_rango check (hasta >= desde)
);
comment on table public.empleado_bajas is
  'Días en que el empleado estuvo dado de baja entre dos etapas de trabajo (se va y vuelve). No cuentan en la planilla de novedades.';
create index if not exists empleado_bajas_emp_idx on public.empleado_bajas (empleado_id, desde);

alter table public.empleado_bajas enable row level security;
drop policy if exists "leer bajas de empleados" on public.empleado_bajas;
create policy "leer bajas de empleados" on public.empleado_bajas for select to authenticated
  using (private.tiene_rol(org_id, array['lider', 'admin', 'porteria', 'guardia', 'tesoreria', 'consejo']::public.rol_usuario[]));
revoke all on public.empleado_bajas from public, anon, authenticated;
grant select on public.empleado_bajas to authenticated;

-- Reincorpora a un empleado dado de baja.
--  · p_desde null → "fue un error": se borra la baja (activo, sin fecha de egreso), como antes.
--  · p_desde = día en que vuelve → los días entre el egreso y la vuelta quedan como baja
--    (no cuentan en la planilla) y el empleado vuelve a estar activo, sin fecha de egreso.
--  Si ya está activo y sin egreso (reintento tras un corte), no hace nada.
create or replace function public.reincorporar_empleado(p_empleado uuid, p_desde date default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_e record;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if not private.tiene_rol(v_org, array['lider']::public.rol_usuario[]) then
    raise exception 'Solo el Líder de Procesos reincorpora empleados';
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
end $$;
revoke all on function public.reincorporar_empleado(uuid, date) from public, anon;
grant execute on function public.reincorporar_empleado(uuid, date) to authenticated;


-- ------------------------------------------------------------
-- resumen_novedades (firma de 0012, cuerpo de 0019) con:
--   · franjas nocturnas: salida ≤ entrada suma 24 h (22 a 06 = 8 h del día en que entra);
--   · períodos de baja: esos días no cuentan como "debería" y el empleado no aparece en un
--     mes que pasó entero afuera.
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
      -- Un mes que pasó entero de baja (entre dos etapas de trabajo) no lo muestra.
      and not exists (
        select 1 from public.empleado_bajas b
        where b.empleado_id = e.id
          and b.desde <= greatest(v_desde, coalesce(e.fecha_ingreso, v_desde))
          and b.hasta >= least(v_fin, coalesce(e.fecha_egreso, v_fin)))
  ),
  franjas as (
    -- Salida ≤ entrada: la franja termina al día siguiente (+24 h).
    select h.empleado_id, h.dia_semana,
           sum(extract(epoch from (h.hora_hasta - h.hora_desde)) / 3600.0
               + case when h.hora_hasta <= h.hora_desde then 24 else 0 end) as horas
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
    where not exists (
      select 1 from public.empleado_bajas b
      where b.empleado_id = e.id
        and d::date between b.desde and b.hasta)
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
