-- ============================================================
-- 0059 · Saldo inicial de cheques (pedido de Tesorería, 03/11/2026)
--
-- «Están cargando los saldos iniciales de banco, efectivo, dólares y necesitan otro de cheque.»
-- Los cheques que ya había en cartera al empezar no entraron por un cobro del sistema: se cargan
-- como un saldo inicial más (medio 'cheque', solo pesos) y flujo_caja los suma a «por cobrar»
-- (cartera) y al total. Corregirlo pide motivo, como los otros.
-- ============================================================

alter table public.saldos_iniciales drop constraint if exists saldos_iniciales_medio_check;
alter table public.saldos_iniciales add constraint saldos_iniciales_medio_check
  check (medio = any (array['efectivo'::public.medio_pago, 'transferencia'::public.medio_pago, 'cheque'::public.medio_pago])
         and (medio <> 'cheque'::public.medio_pago or moneda = 'ARS'::public.moneda));

-- Anclas de una línea sobre las definiciones vigentes; si alguna no está tal cual, no cambia nada.
do $do$
declare
  v_def text;
  v_ancla text;
  v_nueva text;
begin
  -- guardar_saldo_inicial: acepta cheques (en pesos) y les pone nombre.
  v_def := pg_get_functiondef('public.guardar_saldo_inicial(public.medio_pago, public.moneda, numeric, date, text, text)'::regprocedure);
  v_ancla := E'  if p_medio is null or p_medio not in (''efectivo'',''transferencia'') then\n    raise exception ''Elegí efectivo o banco'';\n  end if;\n';
  v_nueva := E'  if p_medio is null or p_medio not in (''efectivo'',''transferencia'',''cheque'') then\n    raise exception ''Elegí efectivo, banco o cheques'';\n  end if;\n'
          || E'  if p_medio = ''cheque'' and p_moneda is distinct from ''ARS'' then\n    raise exception ''Los cheques se cargan en pesos'';\n  end if;\n';
  if (length(v_def) - length(replace(v_def, v_ancla, ''))) / length(v_ancla) <> 1 then
    raise exception 'guardar_saldo_inicial: el ancla 1 no aparece una sola vez';
  end if;
  v_def := replace(v_def, v_ancla, v_nueva);
  v_ancla := E'  v_cuenta := case when p_moneda = ''USD'' then ''Dólares'' else ''Pesos'' end\n    || case when p_medio = ''efectivo'' then '' en efectivo'' else '' en el banco'' end;\n';
  v_nueva := E'  v_cuenta := case when p_medio = ''cheque'' then ''Cheques en cartera''\n    else case when p_moneda = ''USD'' then ''Dólares'' else ''Pesos'' end\n    || case when p_medio = ''efectivo'' then '' en efectivo'' else '' en el banco'' end end;\n';
  if (length(v_def) - length(replace(v_def, v_ancla, ''))) / length(v_ancla) <> 1 then
    raise exception 'guardar_saldo_inicial: el ancla 2 no aparece una sola vez';
  end if;
  execute replace(v_def, v_ancla, v_nueva);

  -- flujo_caja: el saldo inicial de cheques suma a la cartera.
  v_def := pg_get_functiondef('public.flujo_caja()'::regprocedure);
  v_ancla := E'  v_cart numeric; v_listos numeric; v_dep numeric;\n';
  v_nueva := v_ancla || E'  v_ini_ch numeric;\n';
  if (length(v_def) - length(replace(v_def, v_ancla, ''))) / length(v_ancla) <> 1 then
    raise exception 'flujo_caja: el ancla 1 no aparece una sola vez';
  end if;
  v_def := replace(v_def, v_ancla, v_nueva);
  v_ancla := E'  into v_cart, v_listos, v_dep\n  from public.cheques ch\n  where ch.org_id = v_org;\n';
  v_nueva := v_ancla
    || E'\n  -- 0059: los cheques que ya había en cartera al empezar (saldo inicial, sin cargarlos uno por uno).\n'
    || E'  select coalesce(sum(s.monto), 0) into v_ini_ch from public.saldos_iniciales s\n'
    || E'  where s.org_id = v_org and s.medio = ''cheque'' and s.moneda = ''ARS'';\n'
    || E'  v_cart := v_cart + v_ini_ch;\n';
  if (length(v_def) - length(replace(v_def, v_ancla, ''))) / length(v_ancla) <> 1 then
    raise exception 'flujo_caja: el ancla 2 no aparece una sola vez';
  end if;
  v_def := replace(v_def, v_ancla, v_nueva);
  v_ancla := E'    ''cheques'', jsonb_build_object(''por_cobrar'', v_cart, ''listos'', v_listos,\n';
  v_nueva := E'    ''cheques'', jsonb_build_object(''por_cobrar'', v_cart, ''listos'', v_listos, ''inicial'', v_ini_ch,\n';
  if (length(v_def) - length(replace(v_def, v_ancla, ''))) / length(v_ancla) <> 1 then
    raise exception 'flujo_caja: el ancla 3 no aparece una sola vez';
  end if;
  execute replace(v_def, v_ancla, v_nueva);
end $do$;
