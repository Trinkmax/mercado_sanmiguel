-- ============================================================
-- 0064 · Libres deuda del mes (pedido de Administración, 12/11/2026)
--
-- «Cuando un cliente paga el 100%, que nos marque una alerta para que las chicas impriman
-- los libres de deuda todos juntos: una solapita donde ver los libres de deuda e imprimirlos
-- a todos, los firman y se los reparten.»
--
--  1. public.libres_deuda: qué libre deuda ya se imprimió, uno por cliente y mes (si se
--     vuelve a imprimir, se actualiza la fecha y suma una vez). Se escribe solo por RPC.
--  2. libres_deuda_del_mes(p_periodo): los clientes al día con ese mes (tienen cargos del
--     mes y no deben nada, ni de antes ni lo que todavía no venció: la misma regla que el
--     libre deuda impreso), cuándo terminaron de pagar y si ya se imprimió. Con la RLS de
--     quien consulta (security invoker).
--  3. marcar_libres_deuda(p_clientes, p_periodo): los anota como impresos. Solo los que
--     el rol gestiona y que siguen sin deber.
-- ============================================================

create table if not exists public.libres_deuda (
  org_id uuid not null references public.organizaciones(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  periodo date not null check (periodo = date_trunc('month', periodo)::date),
  impreso_en timestamptz not null default now(),
  impreso_por uuid references auth.users(id) on delete set null,
  veces integer not null default 1 check (veces > 0),
  primary key (cliente_id, periodo)
);
comment on table public.libres_deuda is
  'Libres deuda impresos: uno por cliente y mes (0064). Se escribe solo por marcar_libres_deuda.';

create index if not exists libres_deuda_org_periodo_idx on public.libres_deuda (org_id, periodo);
create index if not exists libres_deuda_impreso_por_idx on public.libres_deuda (impreso_por)
  where impreso_por is not null;

alter table public.libres_deuda enable row level security;
drop policy if exists "leer libres deuda" on public.libres_deuda;
create policy "leer libres deuda" on public.libres_deuda
  for select to authenticated
  using (
    private.tiene_rol(org_id, array['admin', 'lider']::public.rol_usuario[])
    or (private.tiene_rol(org_id, array['guardia']::public.rol_usuario[]) and private.cliente_de_porteria(cliente_id))
  );
revoke all on table public.libres_deuda from anon, authenticated;
grant select on table public.libres_deuda to authenticated;

-- ------------------------------------------------------------
-- Los que están al día con el mes.
-- ------------------------------------------------------------
create or replace function public.libres_deuda_del_mes(p_periodo date)
returns table (
  cliente_id uuid,
  codigo integer,
  nombre text,
  categoria public.categoria_cliente,
  completo_en timestamptz,
  impreso_en timestamptz,
  veces integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id, c.codigo, c.nombre, c.categoria,
    -- Cuándo terminó de pagar el mes: la última imputación a un cargo del mes.
    (select max(i.creado_en)
       from public.imputaciones i
       join public.cargos g on g.id = i.cargo_id
      where g.cliente_id = c.id and g.periodo = p_periodo and g.estado <> 'anulado'),
    ld.impreso_en, ld.veces
  from public.clientes c
  left join public.libres_deuda ld on ld.cliente_id = c.id and ld.periodo = p_periodo
  where c.activo
    and exists (select 1 from public.cargos g
                 where g.cliente_id = c.id and g.periodo = p_periodo and g.estado <> 'anulado')
    and not exists (select 1 from public.cargos g
                     where g.cliente_id = c.id and g.estado in ('pendiente', 'parcial'))
$$;
revoke all on function public.libres_deuda_del_mes(date) from public, anon;
grant execute on function public.libres_deuda_del_mes(date) to authenticated;

-- ------------------------------------------------------------
-- Anotar los impresos.
-- ------------------------------------------------------------
create or replace function public.marcar_libres_deuda(p_clientes uuid[], p_periodo date default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_uid uuid := (select auth.uid());
  v_periodo date := date_trunc('month', coalesce(p_periodo, private.hoy_ar()))::date;
  v_categorias public.categoria_cliente[];
  v_n integer;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  -- Quien emite el libre deuda: Administración (puesteros y empleados), el Jefe de Portería
  -- (quinteros y ambulantes) y el Líder (todos), como en la pantalla.
  v_categorias := case v_rol
    when 'lider' then array['puestero', 'quintero', 'ambulante', 'empleado']::public.categoria_cliente[]
    when 'admin' then array['puestero', 'empleado']::public.categoria_cliente[]
    when 'guardia' then array['quintero', 'ambulante']::public.categoria_cliente[]
    else null end;
  if v_categorias is null then raise exception 'El libre deuda lo emiten Administración y el Jefe de Portería'; end if;
  if p_clientes is null or cardinality(p_clientes) = 0 then return 0; end if;
  if cardinality(p_clientes) > 500 then raise exception 'Son demasiados clientes de una vez'; end if;

  insert into public.libres_deuda as ld (org_id, cliente_id, periodo, impreso_por)
  select v_org, c.id, v_periodo, v_uid
    from public.clientes c
   where c.id = any (p_clientes)
     and c.org_id = v_org
     and c.categoria = any (v_categorias)
     -- Con deuda no hay libre deuda: no se anota.
     and not exists (select 1 from public.cargos g
                      where g.cliente_id = c.id and g.estado in ('pendiente', 'parcial'))
  on conflict (cliente_id, periodo) do update
    set impreso_en = now(), impreso_por = excluded.impreso_por, veces = ld.veces + 1;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.marcar_libres_deuda(uuid[], date) from public, anon;
grant execute on function public.marcar_libres_deuda(uuid[], date) to authenticated;
