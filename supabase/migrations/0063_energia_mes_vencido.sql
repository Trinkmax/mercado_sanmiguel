-- ============================================================
-- 0063 · La energía se cobra a mes vencido (pedido del 09/11/2026)
--
-- «Energía noviembre en realidad es la de octubre: a los clientes les debe aparecer la de
-- octubre. Igual se va cargando noviembre.» Las lecturas se siguen cargando en el mes en que se
-- cobran, y el renglón del cliente dice de qué mes es el consumo. En el cargo de noviembre:
--   «Energía de octubre · Medidor N° 14C1 (2.001 kWh)»
-- Lo pone el trigger de la descripción, que ya pasa por todos los cargos de energía
-- (registrar_lectura y generar_periodo arman «Energía · Medidor …»). También se corrigen los
-- cargos que ya estaban.
--
-- «No me deja ir a diciembre»: las lecturas se pueden adelantar al mes que viene (el
-- electricista lee a fin de mes), pero no más allá.
-- ============================================================

create or replace function private.tg_descripcion_energia()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
declare
  v_kwh text;
begin
  if new.origen = 'energia' and new.descripcion is not null then
    -- 0063: a mes vencido. «Energía · Medidor …» del cargo de noviembre queda
    -- «Energía de octubre · Medidor …». Si ya dice el mes, no se vuelve a tocar.
    if new.descripcion like 'Energía · %' and new.periodo is not null then
      new.descripcion := 'Energía de '
        || ('{enero,febrero,marzo,abril,mayo,junio,julio,agosto,septiembre,octubre,noviembre,diciembre}'::text[])
             [extract(month from new.periodo - interval '1 month')::int]
        || substr(new.descripcion, length('Energía') + 1);
    end if;
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
end $function$;

-- Los cargos de energía que ya estaban: el trigger les pone el mes del consumo.
update public.cargos set descripcion = descripcion
where origen = 'energia' and descripcion like 'Energía · %';

-- registrar_lectura: hasta el mes que viene (antes, solo hasta el mes en curso).
do $do$
declare
  v_def text;
  v_ancla text;
  v_nueva text;
begin
  v_def := pg_get_functiondef('public.registrar_lectura(uuid, date, numeric, numeric)'::regprocedure);
  v_ancla := E'  if v_periodo > date_trunc(''month'', v_hoy)::date then\n'
          || E'    raise exception ''No se cargan lecturas de meses que todavía no empezaron'';\n'
          || E'  end if;\n';
  v_nueva := E'  -- 0063: se pueden adelantar las del mes que viene (el electricista lee a fin de mes).\n'
          || E'  if v_periodo > (date_trunc(''month'', v_hoy) + interval ''1 month'')::date then\n'
          || E'    raise exception ''Las lecturas se cargan hasta el mes que viene'';\n'
          || E'  end if;\n';
  if (length(v_def) - length(replace(v_def, v_ancla, ''))) / length(v_ancla) <> 1 then
    raise exception 'registrar_lectura: el ancla no aparece una sola vez';
  end if;
  execute replace(v_def, v_ancla, v_nueva);
end $do$;
