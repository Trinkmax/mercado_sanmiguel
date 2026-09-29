-- ============================================================
-- Mercado San Miguel — 0030 Fase 3: consumo de energía en formato argentino
--
-- La descripción del cargo de energía decía "(1240.00 kWh)" (número de la base, en inglés).
-- Un trigger la normaliza al guardar ("(1.240 kWh)", "(1.240,5 kWh)") para cualquier camino que
-- cree una ENER (generar_periodo, registrar_lectura), y se corrigen las ya guardadas.
-- Idempotente.
-- ============================================================

-- 1. kWh en formato argentino: miles con punto, decimales con coma y sin ceros de más.
--    (misma técnica que private.caja_pesos: to_char con G/D y translate; lc_numeric = C)
create or replace function private.formato_kwh(p numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p is null then ''
    when p = trunc(p) then translate(to_char(p, 'FM999G999G999G990'), ',.', '.,')
    else translate(rtrim(to_char(p, 'FM999G999G999G990D99'), '0'), ',.', '.,')
  end
$$;
revoke all on function private.formato_kwh(numeric) from public, anon;
grant execute on function private.formato_kwh(numeric) to authenticated;

-- 2. Trigger: la ENER guarda "(1.240 kWh)" aunque la función que la arme mande "(1240.00 kWh)".
create or replace function private.tg_descripcion_energia()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_kwh text;
begin
  if new.origen = 'energia' and new.descripcion is not null then
    -- Solo el formato de la base ("1240.00": kwh es numeric(12,2)); "1.240" ya está bien y
    -- no se vuelve a tocar (el punto de miles va seguido de 3 cifras, nunca de 2).
    v_kwh := (regexp_match(new.descripcion, '\(([0-9]+\.[0-9]{2}) kWh\)$'))[1];
    if v_kwh is not null then
      new.descripcion := regexp_replace(
        new.descripcion,
        '\([0-9]+\.[0-9]{2} kWh\)$',
        '(' || private.formato_kwh(v_kwh::numeric) || ' kWh)'
      );
    end if;
  end if;
  return new;
end $$;

drop trigger if exists cargos_descripcion_energia on public.cargos;
create trigger cargos_descripcion_energia
  before insert or update of descripcion on public.cargos
  for each row
  when (new.origen = 'energia')
  execute function private.tg_descripcion_energia();

-- 3. Las ENER ya guardadas con el número en inglés (el trigger las reescribe).
update public.cargos
   set descripcion = descripcion
 where origen = 'energia'
   and descripcion ~ '\([0-9]+\.[0-9]{2} kWh\)$';
