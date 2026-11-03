-- ============================================================
-- 0060 · El saldo inicial de cheques cuenta desde su día (03/11/2026)
--
-- Con 0059 el saldo de cheques se sumaba entero a los cheques ya cargados en el sistema, y
-- Tesorería lo cargó como hacen el efectivo y el banco: TODO lo que había en cartera ese día
-- (los 4 cheques cargados por cobros incluidos). «Por cobrar» daba el doble.
-- Ahora es igual que las otras cuentas: el saldo es la cartera al comenzar ese día. Se suman los
-- cheques recibidos desde ese día que siguen en cartera y se restan los recibidos antes que
-- salieron de la cartera (depositados, entregados o rechazados) desde ese día.
-- ============================================================

do $do$
declare
  v_def text;
  v_ancla text;
  v_nueva text;
begin
  v_def := pg_get_functiondef('public.flujo_caja()'::regprocedure);
  v_ancla := E'  v_ini_ch numeric;\n';
  v_nueva := v_ancla || E'  d_ch date;\n';
  if (length(v_def) - length(replace(v_def, v_ancla, ''))) / length(v_ancla) <> 1 then
    raise exception 'flujo_caja: el ancla 1 no aparece una sola vez';
  end if;
  v_def := replace(v_def, v_ancla, v_nueva);

  v_ancla := E'  -- 0059: los cheques que ya había en cartera al empezar (saldo inicial, sin cargarlos uno por uno).\n'
          || E'  select coalesce(sum(s.monto), 0) into v_ini_ch from public.saldos_iniciales s\n'
          || E'  where s.org_id = v_org and s.medio = ''cheque'' and s.moneda = ''ARS'';\n'
          || E'  v_cart := v_cart + v_ini_ch;\n';
  v_nueva := E'  -- 0060: el saldo inicial de cheques es la cartera al comenzar ese día (como el efectivo y el\n'
          || E'  -- banco): lo recibido antes ya está adentro. Se suman los recibidos desde ese día que siguen\n'
          || E'  -- en cartera y se restan los de antes que salieron de la cartera desde ese día.\n'
          || E'  select coalesce(sum(s.monto), 0), max(s.fecha) into v_ini_ch, d_ch from public.saldos_iniciales s\n'
          || E'  where s.org_id = v_org and s.medio = ''cheque'' and s.moneda = ''ARS'';\n'
          || E'  if d_ch is not null then\n'
          || E'    select v_ini_ch\n'
          || E'      + coalesce(sum(ch.monto) filter (where ch.estado = ''en_cartera''\n'
          || E'          and coalesce(ch.fecha_recibido, (ch.creado_en at time zone ''America/Argentina/Cordoba'')::date) >= d_ch), 0)\n'
          || E'      - coalesce(sum(ch.monto) filter (where ch.estado <> ''en_cartera''\n'
          || E'          and coalesce(ch.fecha_recibido, (ch.creado_en at time zone ''America/Argentina/Cordoba'')::date) < d_ch\n'
          || E'          and coalesce(ch.fecha_depositado, ch.fecha_entregado,\n'
          || E'                       (ch.rechazado_en at time zone ''America/Argentina/Cordoba'')::date, ch.fecha_acreditado) >= d_ch), 0)\n'
          || E'    into v_cart\n'
          || E'    from public.cheques ch\n'
          || E'    where ch.org_id = v_org;\n'
          || E'  end if;\n';
  if (length(v_def) - length(replace(v_def, v_ancla, ''))) / length(v_ancla) <> 1 then
    raise exception 'flujo_caja: el ancla 2 no aparece una sola vez';
  end if;
  execute replace(v_def, v_ancla, v_nueva);
end $do$;
