-- ============================================================
-- Mercado San Miguel — 0037 Gastos fijos que se cargan solos cada mes
--
-- Cada rubro de gasto es fijo o variable:
-- · Fijo: tiene su monto y el día del mes en que vence. Todos los meses se carga solo en
--   Gastos (pendiente, con ese monto y ese vencimiento) para pagarlo como cualquier otro.
-- · Variable: se va cargando a medida que pasa (cada compra o pago, un gasto del rubro).
--
-- La carga del mes la hace una tarea programada (pg_cron, todos los días a las 00:05 de
-- Argentina: si el mes ya está, no hace nada) y, por las dudas, también la pantalla de
-- Gastos al abrirse. Nunca duplica: un rubro se carga solo una vez por mes (aunque después
-- se anule) y no se carga si ese mes ya tiene un gasto del rubro cargado a mano.
-- Idempotente.
-- ============================================================

-- ---------- Rubros: fijo o variable ----------
alter table public.rubros_gasto add column if not exists tipo public.tipo_gasto not null default 'variable';
alter table public.rubros_gasto add column if not exists monto_fijo numeric(14, 2);
alter table public.rubros_gasto add column if not exists dia_vencimiento smallint;

alter table public.rubros_gasto drop constraint if exists rubros_gasto_fijo_completo;
alter table public.rubros_gasto add constraint rubros_gasto_fijo_completo check (
  (monto_fijo is null or monto_fijo > 0)
  and (dia_vencimiento is null or dia_vencimiento between 1 and 31)
  and (tipo = 'variable' or (monto_fijo is not null and dia_vencimiento is not null))
);

comment on column public.rubros_gasto.tipo is
  'Fijo: se carga solo todos los meses con monto_fijo y vence el dia_vencimiento. Variable: se carga a medida que pasa.';
comment on column public.rubros_gasto.monto_fijo is 'Monto del gasto fijo de cada mes (solo rubros fijos).';
comment on column public.rubros_gasto.dia_vencimiento is
  'Día del mes en que vence el gasto fijo (1 a 31; en meses más cortos, el último día).';

grant insert (tipo, monto_fijo, dia_vencimiento), update (tipo, monto_fijo, dia_vencimiento)
  on public.rubros_gasto to authenticated;

-- ---------- Gastos: los que se cargaron solos ----------
alter table public.gastos add column if not exists automatico boolean not null default false;
comment on column public.gastos.automatico is
  'Lo cargó el sistema (gasto fijo del mes, 0037). Uno por rubro y mes, aunque se anule.';
create unique index if not exists gastos_automatico_unq
  on public.gastos (org_id, rubro_id, periodo) where automatico;

-- ---------- Vencimiento dentro del mes ----------
create or replace function private.vencimiento_en_mes(p_periodo date, p_dia integer)
returns date
language sql immutable set search_path = '' as $$
  select make_date(
    extract(year from p_periodo)::int,
    extract(month from p_periodo)::int,
    least(greatest(p_dia, 1), extract(day from (date_trunc('month', p_periodo) + interval '1 month - 1 day'))::int)
  )
$$;
revoke all on function private.vencimiento_en_mes(date, integer) from public, anon;
grant execute on function private.vencimiento_en_mes(date, integer) to authenticated;

-- ---------- Cargar los fijos de un mes (una organización) ----------
create or replace function private.generar_gastos_fijos(p_org uuid, p_periodo date)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_periodo date := date_trunc('month', p_periodo)::date;
  v_n integer;
begin
  if p_org is null or p_periodo is null then return 0; end if;
  insert into public.gastos (org_id, rubro_id, tipo, descripcion, monto, vencimiento, periodo,
                             automatico, creado_por)
  select r.org_id, r.id, 'fijo', null, r.monto_fijo,
         private.vencimiento_en_mes(v_periodo, r.dia_vencimiento), v_periodo, true, null
  from public.rubros_gasto r
  where r.org_id = p_org
    and r.activo
    and r.tipo = 'fijo'
    and r.monto_fijo > 0
    and r.dia_vencimiento is not null
    -- Una sola vez por rubro y mes (aunque se haya anulado) y nunca encima de uno cargado a mano.
    and not exists (
      select 1 from public.gastos g
      where g.org_id = r.org_id and g.rubro_id = r.id and g.periodo = v_periodo
        and (g.automatico or g.estado <> 'anulado')
    )
  on conflict (org_id, rubro_id, periodo) where automatico do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function private.generar_gastos_fijos(uuid, date) from public, anon, authenticated;

-- ---------- Todas las organizaciones, el mes de hoy (la tarea programada) ----------
create or replace function private.generar_gastos_fijos_todas()
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_total integer := 0;
  v_periodo date := date_trunc('month', private.hoy_ar())::date;
begin
  for v_org in select distinct r.org_id from public.rubros_gasto r where r.tipo = 'fijo' and r.activo loop
    v_total := v_total + private.generar_gastos_fijos(v_org, v_periodo);
  end loop;
  return v_total;
end $$;
revoke all on function private.generar_gastos_fijos_todas() from public, anon, authenticated;

-- ---------- Desde la app: el mes en curso ----------
-- La llama la pantalla de Gastos al abrirse (por si la tarea programada no corrió todavía).
create or replace function public.generar_gastos_fijos()
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
begin
  if v_org is null or v_rol is null or v_rol not in ('admin','tesoreria','lider') then
    return 0;
  end if;
  return private.generar_gastos_fijos(v_org, private.hoy_ar());
end $$;
revoke all on function public.generar_gastos_fijos() from public, anon;
grant execute on function public.generar_gastos_fijos() to authenticated;

-- ---------- Configurar un rubro (Configuración → Rubros de gasto) ----------
-- Fijo: guarda monto y día; si el gasto de este mes se cargó solo y todavía no se pagó, lo
-- actualiza; si todavía no está, lo carga ya. Variable: deja de cargarse solo desde el mes
-- que viene (el de este mes, si ya estaba, queda).
create or replace function public.configurar_rubro_gasto(
  p_rubro uuid, p_tipo public.tipo_gasto, p_monto numeric default null, p_dia integer default null
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_periodo date := date_trunc('month', private.hoy_ar())::date;
  v_rubro public.rubros_gasto;
  v_actualizado integer := 0;
  v_generado integer := 0;
  v_este_mes public.gastos;
begin
  if v_org is null or v_rol is null or v_rol not in ('admin','lider') then
    raise exception 'No tenés permiso para configurar los rubros de gasto';
  end if;
  select * into v_rubro from public.rubros_gasto where id = p_rubro and org_id = v_org for update;
  if not found then raise exception 'No encontramos el rubro'; end if;
  if p_tipo is null then raise exception 'Elegí si el rubro es fijo o variable'; end if;

  if p_tipo = 'fijo' then
    if p_monto is null or p_monto <= 0 then raise exception 'Poné el monto de cada mes'; end if;
    if p_monto >= 1000000000000 then raise exception 'Revisá el monto: es demasiado grande'; end if;
    if p_dia is null or p_dia not between 1 and 31 then raise exception 'Elegí el día del mes en que vence (1 a 31)'; end if;
    if not v_rubro.activo then raise exception 'El rubro está desactivado: activalo primero'; end if;
    update public.rubros_gasto
       set tipo = 'fijo', monto_fijo = round(p_monto, 2), dia_vencimiento = p_dia
     where id = p_rubro;
    -- El de este mes que se cargó solo y está sin pagar: con los datos nuevos.
    update public.gastos
       set monto = round(p_monto, 2), vencimiento = private.vencimiento_en_mes(v_periodo, p_dia)
     where org_id = v_org and rubro_id = p_rubro and periodo = v_periodo
       and automatico and estado = 'pendiente'
       and (monto <> round(p_monto, 2) or vencimiento is distinct from private.vencimiento_en_mes(v_periodo, p_dia));
    get diagnostics v_actualizado = row_count;
    v_generado := private.generar_gastos_fijos(v_org, v_periodo);
  else
    update public.rubros_gasto set tipo = 'variable', monto_fijo = null, dia_vencimiento = null where id = p_rubro;
  end if;

  select * into v_este_mes from public.gastos g
   where g.org_id = v_org and g.rubro_id = p_rubro and g.periodo = v_periodo and g.estado <> 'anulado'
   order by g.automatico desc, g.creado_en
   limit 1;

  return jsonb_build_object(
    'periodo', v_periodo,
    -- 'cargado': se cargó ahora · 'actualizado': ya estaba (sin pagar) y se corrigió
    -- · 'ya_estaba': este mes ya tenía uno (pagado, o cargado a mano) · null: variable/nada
    'este_mes', case
      when p_tipo <> 'fijo' then null
      when v_generado > 0 then 'cargado'
      when v_actualizado > 0 then 'actualizado'
      when v_este_mes.id is not null then 'ya_estaba'
      else null end,
    'estado_este_mes', v_este_mes.estado
  );
end $$;
revoke all on function public.configurar_rubro_gasto(uuid, public.tipo_gasto, numeric, integer) from public, anon;
grant execute on function public.configurar_rubro_gasto(uuid, public.tipo_gasto, numeric, integer) to authenticated;

-- ---------- Tarea programada (pg_cron) ----------
-- Todos los días a las 03:05 UTC (00:05 en Argentina): el día 1 carga el mes nuevo; los
-- otros días no hace nada (o carga un fijo configurado a mitad de mes). Si pg_cron no está
-- disponible (réplica local), se saltea: la pantalla de Gastos igual los carga al abrirse.
do $cron$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron with schema pg_catalog';
    perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'msm-gastos-fijos';
    perform cron.schedule('msm-gastos-fijos', '5 3 * * *', 'select private.generar_gastos_fijos_todas()');
  end if;
end
$cron$;
