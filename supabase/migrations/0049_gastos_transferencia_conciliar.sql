-- ============================================================
-- 0049 — Gastos pagados por banco: Tesorería los chequea contra el banco
-- ============================================================
-- Pedido del 13/10/2026: en la caja del día, la tesorera marca una por una las
-- transferencias que ya vio en el banco. Las que entran (cobros y bono camioneros)
-- ya tenían la marca `conciliado` (0008, 0026); a las que salen —los gastos pagados
-- por transferencia— les faltaba. Se agrega igual que en canon_camiones:
--   · gastos.conciliado / conciliado_por / conciliado_en
--   · conciliar_gastos(uuid[]) y desconciliar_gasto(uuid): Tesorería y el Líder
--   · si el pago se deshace (o deja de ser por banco), la marca se borra sola
-- Las columnas nuevas no se dan a `authenticated`: se escriben solo por RPC.

alter table public.gastos add column if not exists conciliado boolean not null default false;
alter table public.gastos add column if not exists conciliado_por uuid references auth.users(id);
alter table public.gastos add column if not exists conciliado_en timestamptz;
create index if not exists gastos_banco_sin_conciliar_idx on public.gastos (org_id, fecha_pago)
  where estado = 'pagado' and medio_pago = 'transferencia' and not conciliado;
create index if not exists gastos_conciliado_por_idx on public.gastos (conciliado_por) where conciliado_por is not null;

-- Un gasto que ya no está pagado por banco no puede quedar "chequeado contra el banco".
create or replace function private.tg_gasto_sin_conciliar()
returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.conciliado and (new.estado <> 'pagado' or new.medio_pago is distinct from 'transferencia') then
    new.conciliado := false;
    new.conciliado_por := null;
    new.conciliado_en := null;
  end if;
  return new;
end $$;
revoke all on function private.tg_gasto_sin_conciliar() from public, anon;

drop trigger if exists gasto_sin_conciliar on public.gastos;
create trigger gasto_sin_conciliar
  before update on public.gastos
  for each row execute function private.tg_gasto_sin_conciliar();

create or replace function public.conciliar_gastos(p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_n integer;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('tesoreria','lider') then
    raise exception 'Solo Tesorería y el Líder de Procesos concilian transferencias';
  end if;
  if p_ids is null or cardinality(p_ids) = 0 then
    raise exception 'Elegí al menos una transferencia';
  end if;
  if cardinality(p_ids) > 200 then
    raise exception 'Conciliá de a 200 transferencias como máximo';
  end if;

  with hechas as (
    update public.gastos set
      conciliado = true, conciliado_por = (select auth.uid()), conciliado_en = now()
    where org_id = v_org and id = any (p_ids)
      and estado = 'pagado' and medio_pago = 'transferencia' and not conciliado
    returning 1
  )
  select count(*) into v_n from hechas;

  if v_n = 0 then
    raise exception 'Esas transferencias ya estaban conciliadas. Actualizá la página.';
  end if;
  return jsonb_build_object('conciliados', v_n);
end $$;
revoke all on function public.conciliar_gastos(uuid[]) from public, anon;
grant execute on function public.conciliar_gastos(uuid[]) to authenticated;

create or replace function public.desconciliar_gasto(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('tesoreria','lider') then
    raise exception 'Solo Tesorería y el Líder de Procesos concilian transferencias';
  end if;
  update public.gastos set conciliado = false, conciliado_por = null, conciliado_en = null
  where id = p_id and org_id = v_org and conciliado;
  if not found then
    raise exception 'Esa transferencia ya no figura como conciliada. Actualizá la página.';
  end if;
end $$;
revoke all on function public.desconciliar_gasto(uuid) from public, anon;
grant execute on function public.desconciliar_gasto(uuid) to authenticated;
