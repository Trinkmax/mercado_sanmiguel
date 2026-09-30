-- ============================================================
-- Mercado San Miguel — 0038 Gastos fijos: ajustes de la revisión de 0037
--
-- · fijo_desde: el primer mes en que un rubro fijo se carga solo. Si se configura cuando
--   el vencimiento de este mes ya pasó, la pantalla pregunta y, si no se quiere el de este
--   mes, empieza el que viene (nada de gastos del mes que termina cargados ya vencidos).
-- · Solo lo fijo cargado a mano evita que se cargue el del mes (una compra variable del
--   mismo rubro no).
-- · configurar_rubro_gasto dice exactamente qué pasó con el mes en curso.
-- · Los datos de un rubro fijo (tipo, monto, día) solo se cambian con configurar_rubro_gasto
--   (Administración y el Líder): nada de escribirlos directo desde la API.
-- · «Traer fijos» ya no existe: replicar_gastos_fijos deja de estar disponible (la carga
--   automática lo reemplaza y así no se duplican).
-- · vencimiento_en_mes, inmutable de verdad (sin depender de la zona horaria de la sesión).
-- Idempotente.
-- ============================================================

alter table public.rubros_gasto add column if not exists fijo_desde date;
comment on column public.rubros_gasto.fijo_desde is
  'Primer mes (YYYY-MM-01) en que el rubro fijo se carga solo en Gastos.';
update public.rubros_gasto
   set fijo_desde = date_trunc('month', private.hoy_ar()::timestamp)::date
 where tipo = 'fijo' and fijo_desde is null;
alter table public.rubros_gasto drop constraint if exists rubros_gasto_fijo_desde_mes;
alter table public.rubros_gasto add constraint rubros_gasto_fijo_desde_mes
  check (fijo_desde is null or fijo_desde = date_trunc('month', fijo_desde::timestamp)::date);

-- ---------- Permisos: los datos del fijo, solo por configurar_rubro_gasto ----------
-- (El REVOKE de tabla también saca los permisos por columna: se vuelven a dar los de antes.)
revoke insert, update on public.rubros_gasto from authenticated;
grant insert (id, org_id, codigo, nombre, activo) on public.rubros_gasto to authenticated;
grant update (codigo, nombre, activo) on public.rubros_gasto to authenticated;

-- ---------- «Traer fijos» ya no se usa ----------
revoke execute on function public.replicar_gastos_fijos(date, date, jsonb) from authenticated;

-- ---------- Vencimiento dentro del mes ----------
create or replace function private.vencimiento_en_mes(p_periodo date, p_dia integer)
returns date
language sql immutable set search_path = '' as $$
  select make_date(
    extract(year from p_periodo)::int,
    extract(month from p_periodo)::int,
    least(
      greatest(p_dia, 1),
      extract(day from (date_trunc('month', p_periodo::timestamp) + interval '1 month - 1 day'))::int
    )
  )
$$;

-- ---------- Cargar los fijos de un mes (una organización) ----------
create or replace function private.generar_gastos_fijos(p_org uuid, p_periodo date)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_periodo date := date_trunc('month', p_periodo::timestamp)::date;
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
    and coalesce(r.fijo_desde, v_periodo) <= v_periodo
    -- Una sola vez por rubro y mes (aunque se haya anulado), y nunca encima del fijo del
    -- mes cargado a mano (una compra variable del mismo rubro no cuenta).
    and not exists (
      select 1 from public.gastos g
      where g.org_id = r.org_id and g.rubro_id = r.id and g.periodo = v_periodo
        and (g.automatico or (g.estado <> 'anulado' and g.tipo = 'fijo'))
    )
  on conflict (org_id, rubro_id, periodo) where automatico do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function private.generar_gastos_fijos(uuid, date) from public, anon, authenticated;

-- ---------- Configurar un rubro ----------
drop function if exists public.configurar_rubro_gasto(uuid, public.tipo_gasto, numeric, integer);
-- p_cargar_este_mes: true = también el mes en curso · false = empieza el mes que viene ·
-- null = lo de siempre (un rubro que pasa a fijo arranca este mes; uno que ya era fijo sigue
-- como estaba).
create or replace function public.configurar_rubro_gasto(
  p_rubro uuid,
  p_tipo public.tipo_gasto,
  p_monto numeric default null,
  p_dia integer default null,
  p_cargar_este_mes boolean default null
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_periodo date := date_trunc('month', private.hoy_ar()::timestamp)::date;
  v_proximo date := (date_trunc('month', private.hoy_ar()::timestamp) + interval '1 month')::date;
  v_rubro public.rubros_gasto;
  v_desde date;
  v_actualizado integer := 0;
  v_generado integer := 0;
  v_auto public.gastos;
  v_a_mano boolean;
  v_este_mes text;
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
    v_desde := case
      when p_cargar_este_mes is true then v_periodo
      when p_cargar_este_mes is false then greatest(coalesce(v_rubro.fijo_desde, v_proximo), v_proximo)
      when v_rubro.tipo = 'fijo' then coalesce(v_rubro.fijo_desde, v_periodo)
      else v_periodo
    end;
    update public.rubros_gasto
       set tipo = 'fijo', monto_fijo = round(p_monto, 2), dia_vencimiento = p_dia, fijo_desde = v_desde
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
    update public.rubros_gasto
       set tipo = 'variable', monto_fijo = null, dia_vencimiento = null, fijo_desde = null
     where id = p_rubro;
  end if;

  select * into v_auto from public.gastos g
   where g.org_id = v_org and g.rubro_id = p_rubro and g.periodo = v_periodo and g.automatico;
  v_a_mano := exists (
    select 1 from public.gastos g
     where g.org_id = v_org and g.rubro_id = p_rubro and g.periodo = v_periodo
       and not g.automatico and g.tipo = 'fijo' and g.estado <> 'anulado');

  v_este_mes := case
    when p_tipo <> 'fijo' then case when v_auto.id is not null and v_auto.estado = 'pendiente' then 'queda_pendiente' end
    when v_generado > 0 then 'cargado'
    when v_actualizado > 0 then 'actualizado'
    when v_auto.id is not null and v_auto.estado = 'pagado' then 'pagado'
    when v_auto.id is not null and v_auto.estado = 'anulado' then 'anulado'
    when v_auto.id is not null then 'ya_cargado_solo'
    when v_a_mano then 'a_mano'
    when v_desde > v_periodo then 'desde_el_proximo'
    else null end;

  return jsonb_build_object(
    'periodo', v_periodo,
    'este_mes', v_este_mes,
    'fijo_desde', v_desde,
    'vencimiento_este_mes', case when p_tipo = 'fijo' then private.vencimiento_en_mes(v_periodo, p_dia) end
  );
end $$;
revoke all on function public.configurar_rubro_gasto(uuid, public.tipo_gasto, numeric, integer, boolean) from public, anon;
grant execute on function public.configurar_rubro_gasto(uuid, public.tipo_gasto, numeric, integer, boolean) to authenticated;
