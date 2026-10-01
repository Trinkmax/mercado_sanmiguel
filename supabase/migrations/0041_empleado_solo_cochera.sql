-- 0041: el empleado (0040) solo alquila cochera, siempre — no solo en el momento de pasarlo.
--
-- (a) Paga en un pago y no es socio. 0040 lo fuerza al pasarlo a empleado, pero un cambio
--     que esperaba aprobación desde antes (cuotas, socio) podía aprobarse después y dejarlo
--     pagando en cuotas o como socio. El trigger lo corrige en cualquier insert/update.
-- (b) En el plano solo tiene cocheras. asignar_espacios no miraba la categoría: se le podía
--     asignar un puesto o un local, que después no se le puede facturar.

create or replace function private.clientes_empleado_un_pago()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.categoria = 'empleado' then
    new.cuotas_mes := 1;
    new.es_socio := false;
  end if;
  return new;
end $function$;

drop trigger if exists clientes_empleado_un_pago on public.clientes;
create trigger clientes_empleado_un_pago
  before insert or update of categoria, cuotas_mes, es_socio on public.clientes
  for each row execute function private.clientes_empleado_un_pago();

create or replace function private.espacios_empleado_solo_cochera()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.cliente_id is not null and new.tipo <> 'cochera' and exists (
       select 1 from public.clientes c
       where c.id = new.cliente_id and c.categoria = 'empleado') then
    raise exception 'A un empleado solo se le asigna cochera. Si también tiene otro lugar, cargalo como puestero.';
  end if;
  return new;
end $function$;

drop trigger if exists espacios_empleado_solo_cochera on public.espacios;
create trigger espacios_empleado_solo_cochera
  before insert or update of cliente_id, tipo on public.espacios
  for each row execute function private.espacios_empleado_solo_cochera();

revoke all on function private.clientes_empleado_un_pago() from public, anon, authenticated;
revoke all on function private.espacios_empleado_solo_cochera() from public, anon, authenticated;
