-- ============================================================
-- Mercado San Miguel — 0013 Fase 3 · M2 Cajas y arqueo (A3, E4, I2, J3)
-- Contrato: docs/FASE3-CONTRATO.md §4.5 (+ §1.3 D-P2: el Líder opera todo).
--
-- Requiere 0010, 0011 y 0012. Se aplica como UNA transacción, en la ventana de
-- mantenimiento junto con 0014…0022 y el deploy (§0.3). Idempotente: solo
-- `create or replace` (firmas EXACTAS de 0012 / fase 2) y `drop trigger if exists`.
--
-- Qué hace:
--  · private.calcular_arqueo  — la ÚNICA fórmula del arqueo (Juntaste − Gastos ± Ajustes).
--  · private.recalcular_arqueo — persiste el arqueo de una caja cerrada/integrada, deja
--    `arqueo_recalculado` si cambia y cascada al destino cerrado.
--  · private.tg_recalcular_caja + triggers `recalcular_caja` en gastos, canon_camiones y
--    movimientos_tesoreria (un gasto, un canon anulado o un ajuste sobre una caja ya cerrada
--    recalculan su arqueo solos).
--  · public.arqueo_caja (en vivo / persistido con las mismas claves).
--  · abrir / cerrar / integrar / reabrir / validar caja, ajustes de tesorería sobre la caja
--    (registrar / borrar), pedido y rechazo de reapertura: el Líder suma todas (§1.3).
--
-- Reglas §4.0: caja `for update` antes que cualquier otra fila; `recalcular_arqueo` lee sin
-- bloqueo y recién bloquea si va a escribir; idempotencia de ajustes por `p_ref` con candado;
-- toda corrección de plata deja evento en `caja_eventos`.
-- ============================================================


-- ------------------------------------------------------------
-- 0. Formato de pesos para la bitácora: "$ 1.234.567" · "-$ 500" · "$ 82.500,50"
--    (misma convención que §4: to_char con G y el separador de miles con punto).
-- ------------------------------------------------------------
create or replace function private.caja_pesos(p numeric)
returns text
language sql immutable set search_path = '' as $$
  select case when coalesce(p, 0) < 0 then '-' else '' end || '$ ' ||
    case
      when abs(coalesce(p, 0)) = trunc(abs(coalesce(p, 0)))
        then translate(to_char(abs(coalesce(p, 0)), 'FM999G999G999G990'), ',.', '.,')
      else translate(to_char(abs(coalesce(p, 0)), 'FM999G999G999G990D00'), ',.', '.,')
    end
$$;
revoke all on function private.caja_pesos(numeric) from public, anon;
grant execute on function private.caja_pesos(numeric) to authenticated;


-- ------------------------------------------------------------
-- 1. La fórmula única del arqueo (§4.5)
-- ------------------------------------------------------------
create or replace function private.calcular_arqueo(p_caja uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_caja public.cajas;
  v_cob_ef numeric := 0;
  v_cob_tr numeric := 0;
  v_cob_ch numeric := 0;
  v_ch_ent numeric := 0;
  v_quintas numeric := 0;
  v_ambulantes numeric := 0;
  v_can_ef numeric := 0;
  v_can_tr numeric := 0;
  v_ren_ef numeric := 0;
  v_ren_tr numeric := 0;
  v_ren_q numeric := 0;
  v_ren_a numeric := 0;
  v_ren_c numeric := 0;
  v_gastos numeric := 0;
  v_aj_ef numeric := 0;
  v_aj_tr numeric := 0;
  v_detalle jsonb := '[]'::jsonb;
  v_cobros numeric;
  v_canon numeric;
  v_rendido numeric;
begin
  select * into v_caja from public.cajas where id = p_caja;
  if not found then return null; end if;

  -- Cobros vigentes (no anulados) por medio; cheques entregados a un proveedor en el
  -- mismo acto del cobro (no quedaron en la caja); desglose Quintas / Ambulantes.
  select
    coalesce(sum(p.monto) filter (where p.medio = 'efectivo'), 0),
    coalesce(sum(p.monto) filter (where p.medio = 'transferencia'), 0),
    coalesce(sum(p.monto) filter (where p.medio = 'cheque'), 0),
    coalesce(sum(p.monto) filter (where p.medio = 'cheque' and coalesce(ch.entregado_en_cobro, false)), 0),
    coalesce(sum(p.monto) filter (where c.categoria = 'quintero'), 0),
    coalesce(sum(p.monto) filter (where c.categoria = 'ambulante'), 0)
  into v_cob_ef, v_cob_tr, v_cob_ch, v_ch_ent, v_quintas, v_ambulantes
  from public.pagos p
  left join public.cheques ch on ch.id = p.cheque_id
  left join public.clientes c on c.id = p.cliente_id
  where p.caja_id = p_caja and not p.anulado;

  -- El desglose Quintas · Ambulantes es de la caja de portería.
  if v_caja.tipo <> 'guardia' then
    v_quintas := 0;
    v_ambulantes := 0;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'numero', ch.numero, 'monto', p.monto, 'proveedor', ch.proveedor)
           order by p.fecha, p.linea), '[]'::jsonb)
  into v_detalle
  from public.pagos p
  join public.cheques ch on ch.id = p.cheque_id
  where p.caja_id = p_caja and not p.anulado and p.medio = 'cheque' and ch.entregado_en_cobro;

  -- Bono camioneros (canon de transporte) vigente.
  select
    coalesce(sum(k.monto) filter (where k.medio = 'efectivo'), 0),
    coalesce(sum(k.monto) filter (where k.medio = 'transferencia'), 0)
  into v_can_ef, v_can_tr
  from public.canon_camiones k
  where k.caja_id = p_caja and not k.anulado;

  -- Cajas de portería rendidas e integradas en esta caja (solo administración).
  select
    coalesce(sum(r.total_efectivo), 0),
    coalesce(sum(r.total_transferencia), 0),
    coalesce(sum(r.total_quintas), 0),
    coalesce(sum(r.total_ambulantes), 0),
    coalesce(sum(r.total_canon), 0)
  into v_ren_ef, v_ren_tr, v_ren_q, v_ren_a, v_ren_c
  from public.cajas r
  where r.caja_destino_id = p_caja and r.estado in ('integrada', 'validada');

  -- Gastos pagados desde esta caja (siempre en efectivo: 0022 gastos_caja_efectivo).
  select coalesce(sum(g.monto), 0)
  into v_gastos
  from public.gastos g
  where g.caja_id = p_caja and g.estado = 'pagado' and g.pagado_desde = 'caja';

  -- Ajustes de tesorería sobre esta caja (con signo: + sobrante, − faltante).
  select
    coalesce(sum(m.monto) filter (where m.cuenta = 'efectivo'), 0),
    coalesce(sum(m.monto) filter (where m.cuenta = 'banco'), 0)
  into v_aj_ef, v_aj_tr
  from public.movimientos_tesoreria m
  where m.caja_id = p_caja;

  v_cobros := v_cob_ef + v_cob_tr + v_cob_ch;
  v_canon := v_can_ef + v_can_tr;
  v_rendido := v_ren_ef + v_ren_tr;

  return jsonb_build_object(
    'cobros_efectivo', round(v_cob_ef, 2),
    'cobros_transferencia', round(v_cob_tr, 2),
    'cobros_cheques', round(v_cob_ch, 2),
    'cobros', round(v_cobros, 2),
    'cheques_entregados', round(v_ch_ent, 2),
    'quintas', round(v_quintas, 2),
    'ambulantes', round(v_ambulantes, 2),
    'canon_efectivo', round(v_can_ef, 2),
    'canon_transferencia', round(v_can_tr, 2),
    'canon', round(v_canon, 2),
    'rendido_efectivo', round(v_ren_ef, 2),
    'rendido_transferencia', round(v_ren_tr, 2),
    'rendido', round(v_rendido, 2),
    'rendido_quintas', round(v_ren_q, 2),
    'rendido_ambulantes', round(v_ren_a, 2),
    'rendido_canon', round(v_ren_c, 2),
    'juntado', round(v_cobros + v_canon + v_rendido, 2),
    'gastos_pagados', round(v_gastos, 2),
    'ajustes_efectivo', round(v_aj_ef, 2),
    'ajustes_transferencia', round(v_aj_tr, 2),
    'ajustes', round(v_aj_ef + v_aj_tr, 2),
    'efectivo', round(v_cob_ef + v_can_ef + v_ren_ef - v_gastos + v_aj_ef, 2),
    'transferencia', round(v_cob_tr + v_can_tr + v_ren_tr + v_aj_tr, 2),
    'cheques', round(greatest(v_cob_ch - v_ch_ent, 0), 2),
    'cheques_entregados_detalle', v_detalle
  );
end $$;
revoke all on function private.calcular_arqueo(uuid) from public, anon;
grant execute on function private.calcular_arqueo(uuid) to authenticated;


-- ------------------------------------------------------------
-- 2. Persistir el arqueo (cajas cerradas / integradas). Validada = congelada.
-- ------------------------------------------------------------
create or replace function private.recalcular_arqueo(p_caja uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_caja public.cajas;
  a jsonb;
  v_ef numeric;
  v_tr numeric;
  v_ch numeric;
  v_cambios text[] := '{}';
begin
  -- Lectura sin bloqueo (§4.0-3): un trigger disparado desde un cobro en caja abierta
  -- nunca pide más que el `for share` que ya tiene su RPC.
  select * into v_caja from public.cajas where id = p_caja;
  if not found or v_caja.estado in ('abierta', 'validada') then return; end if;

  -- Va a escribir: recién ahora bloquea, y revalida el estado con el bloqueo.
  select * into v_caja from public.cajas where id = p_caja for update;
  if v_caja.estado in ('abierta', 'validada') then return; end if;

  a := private.calcular_arqueo(p_caja);
  v_ef := (a ->> 'efectivo')::numeric;
  v_tr := (a ->> 'transferencia')::numeric;
  v_ch := (a ->> 'cheques')::numeric;

  update public.cajas set
    total_efectivo = v_ef,
    total_transferencia = v_tr,
    total_cheques = v_ch,
    total_canon = (a ->> 'canon')::numeric,
    total_gastos = (a ->> 'gastos_pagados')::numeric,
    total_rendido_efectivo = (a ->> 'rendido_efectivo')::numeric,
    total_rendido_transferencia = (a ->> 'rendido_transferencia')::numeric,
    total_cobros = (a ->> 'cobros')::numeric,
    total_quintas = (a ->> 'quintas')::numeric,
    total_ambulantes = (a ->> 'ambulantes')::numeric,
    total_cheques_entregados = (a ->> 'cheques_entregados')::numeric,
    total_ajustes = (a ->> 'ajustes')::numeric,
    total_rendido_quintas = (a ->> 'rendido_quintas')::numeric,
    total_rendido_ambulantes = (a ->> 'rendido_ambulantes')::numeric,
    total_rendido_canon = (a ->> 'rendido_canon')::numeric
  where id = p_caja;

  -- Rastro: si la caja ya tenía un arqueo y cambia, queda "antes → ahora".
  if v_caja.total_efectivo is not null and v_caja.total_efectivo is distinct from v_ef then
    v_cambios := v_cambios || ('Efectivo: ' || private.caja_pesos(v_caja.total_efectivo) || ' → ' || private.caja_pesos(v_ef));
  end if;
  if v_caja.total_transferencia is not null and v_caja.total_transferencia is distinct from v_tr then
    v_cambios := v_cambios || ('Banco: ' || private.caja_pesos(v_caja.total_transferencia) || ' → ' || private.caja_pesos(v_tr));
  end if;
  if v_caja.total_cheques is not null and v_caja.total_cheques is distinct from v_ch then
    v_cambios := v_cambios || ('Cheques: ' || private.caja_pesos(v_caja.total_cheques) || ' → ' || private.caja_pesos(v_ch));
  end if;
  if cardinality(v_cambios) > 0 then
    perform private.registrar_evento_caja(p_caja, 'arqueo_recalculado', array_to_string(v_cambios, ' · '));
  end if;

  -- Cascada: la caja de administración que recibió esta caja de portería, si está cerrada.
  if v_caja.caja_destino_id is not null
     and exists (select 1 from public.cajas d where d.id = v_caja.caja_destino_id and d.estado = 'cerrada') then
    perform private.recalcular_arqueo(v_caja.caja_destino_id);
  end if;
end $$;
revoke all on function private.recalcular_arqueo(uuid) from public, anon;
grant execute on function private.recalcular_arqueo(uuid) to authenticated;


-- ------------------------------------------------------------
-- 3. Trigger: lo que cambia sobre una caja ya cerrada recalcula su arqueo
-- ------------------------------------------------------------
create or replace function private.tg_recalcular_caja()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_viejo uuid;
  v_nuevo uuid;
  v_o jsonb;
  v_n jsonb;
  v_cols text[];
  v_relevante boolean;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_viejo := old.caja_id; end if;
  if tg_op in ('INSERT', 'UPDATE') then v_nuevo := new.caja_id; end if;
  if v_viejo is null and v_nuevo is null then return null; end if;

  -- En un UPDATE solo importan las columnas que mueven el arqueo (editar la descripción de
  -- un gasto no toca la caja ni pide su bloqueo).
  if tg_op = 'UPDATE' then
    v_o := to_jsonb(old);
    v_n := to_jsonb(new);
    v_cols := case tg_table_name
      when 'gastos' then array['estado', 'monto', 'caja_id', 'pagado_desde', 'medio_pago']
      when 'canon_camiones' then array['anulado', 'monto', 'medio', 'caja_id']
      else array['monto', 'cuenta', 'caja_id', 'tipo', 'moneda']
    end;
    select bool_or((v_o -> c) is distinct from (v_n -> c)) into v_relevante from unnest(v_cols) c;
    if not coalesce(v_relevante, false) then return null; end if;
  end if;

  if v_viejo is not null then
    perform private.recalcular_arqueo(v_viejo);
  end if;
  if v_nuevo is not null and v_nuevo is distinct from v_viejo then
    perform private.recalcular_arqueo(v_nuevo);
  end if;
  return null;
end $$;
revoke all on function private.tg_recalcular_caja() from public, anon;

drop trigger if exists recalcular_caja on public.gastos;
create trigger recalcular_caja after insert or update or delete on public.gastos
  for each row execute function private.tg_recalcular_caja();
drop trigger if exists recalcular_caja on public.canon_camiones;
create trigger recalcular_caja after insert or update or delete on public.canon_camiones
  for each row execute function private.tg_recalcular_caja();
drop trigger if exists recalcular_caja on public.movimientos_tesoreria;
create trigger recalcular_caja after insert or update or delete on public.movimientos_tesoreria
  for each row execute function private.tg_recalcular_caja();


-- ------------------------------------------------------------
-- 4. Arqueo para la UI: en vivo si está abierta; si no, el persistido (mismas claves)
-- ------------------------------------------------------------
create or replace function public.arqueo_caja(p_caja uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_caja public.cajas;
  a jsonb;
  v_meta jsonb;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  select * into v_caja from public.cajas where id = p_caja and org_id = v_org;
  if not found then raise exception 'Caja inexistente'; end if;
  if not (v_rol in ('admin', 'tesoreria', 'lider')
          or (v_rol in ('guardia', 'porteria') and v_caja.tipo = 'guardia')) then
    raise exception 'Sin permiso';
  end if;

  a := private.calcular_arqueo(p_caja);
  v_meta := jsonb_build_object('caja_id', v_caja.id, 'tipo', v_caja.tipo, 'fecha', v_caja.fecha,
                               'estado', v_caja.estado);

  if v_caja.estado = 'abierta' then
    return a || v_meta || jsonb_build_object('fuente', 'vivo');
  end if;

  -- Cerrada, integrada o validada: manda lo persistido (validada = congelada). Lo que no
  -- tiene columna (el detalle por medio) sale de las filas; una columna nula (caja vieja)
  -- cae en el valor calculado.
  a := a || jsonb_strip_nulls(jsonb_build_object(
    'efectivo', v_caja.total_efectivo,
    'transferencia', v_caja.total_transferencia,
    'cheques', v_caja.total_cheques,
    'canon', v_caja.total_canon,
    'gastos_pagados', v_caja.total_gastos,
    'rendido_efectivo', v_caja.total_rendido_efectivo,
    'rendido_transferencia', v_caja.total_rendido_transferencia,
    'cobros', v_caja.total_cobros,
    'quintas', v_caja.total_quintas,
    'ambulantes', v_caja.total_ambulantes,
    'cheques_entregados', v_caja.total_cheques_entregados,
    'ajustes', v_caja.total_ajustes,
    'rendido_quintas', v_caja.total_rendido_quintas,
    'rendido_ambulantes', v_caja.total_rendido_ambulantes,
    'rendido_canon', v_caja.total_rendido_canon));
  a := a || jsonb_build_object(
    'cobros_cheques', (a ->> 'cheques')::numeric + (a ->> 'cheques_entregados')::numeric,
    'rendido', (a ->> 'rendido_efectivo')::numeric + (a ->> 'rendido_transferencia')::numeric,
    'juntado', (a ->> 'cobros')::numeric + (a ->> 'canon')::numeric
               + (a ->> 'rendido_efectivo')::numeric + (a ->> 'rendido_transferencia')::numeric);
  return a || v_meta || jsonb_build_object('fuente', 'cierre');
end $$;
revoke all on function public.arqueo_caja(uuid) from public, anon;
grant execute on function public.arqueo_caja(uuid) to authenticated;


-- ------------------------------------------------------------
-- 5. Abrir la caja de hoy. Tesorería no abre (las abre quien cobra); el Líder, cualquiera.
-- ------------------------------------------------------------
create or replace function public.abrir_caja(p_tipo public.tipo_caja)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
  v_id uuid;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol = 'tesoreria' then
    raise exception 'Tesorería no abre cajas: las abre quien cobra';
  end if;
  if p_tipo is null or not (
    v_rol = 'lider'
    or (v_rol = 'admin' and p_tipo = 'administracion')
    or (v_rol = 'guardia' and p_tipo = 'guardia')
  ) then
    raise exception 'No tenés permiso para abrir esta caja';
  end if;

  -- §4.0-4: nunca "if not exists … insert" (dos personas a la vez chocan con la UNIQUE).
  insert into public.cajas (org_id, tipo, fecha, abierta_por)
  values (v_org, p_tipo, v_hoy, (select auth.uid()))
  on conflict (org_id, tipo, fecha) do nothing
  returning id into v_id;

  if v_id is not null then
    perform private.registrar_evento_caja(v_id, 'apertura', null);
    return v_id;
  end if;

  select id into v_id from public.cajas
  where org_id = v_org and tipo = p_tipo and fecha = v_hoy;
  return v_id;
end $$;
revoke all on function public.abrir_caja(public.tipo_caja) from public, anon;
grant execute on function public.abrir_caja(public.tipo_caja) to authenticated;


-- ------------------------------------------------------------
-- 6. Cerrar (o rendir) la caja: persiste el arqueo y devuelve la cuenta completa
-- ------------------------------------------------------------
create or replace function public.cerrar_caja(p_caja uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
  v_caja public.cajas;
  a jsonb;
  v_detalle text;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('admin', 'guardia', 'tesoreria', 'lider') then
    raise exception 'No tenés permiso para cerrar esta caja';
  end if;

  select * into v_caja from public.cajas where id = p_caja and org_id = v_org for update;
  if not found then raise exception 'Caja inexistente'; end if;
  if v_rol = 'admin' and v_caja.tipo <> 'administracion' then
    raise exception 'Solo podés cerrar la caja de administración';
  end if;
  if v_rol = 'guardia' and v_caja.tipo <> 'guardia' then
    raise exception 'Solo podés rendir la caja de portería';
  end if;
  if v_caja.estado <> 'abierta' then raise exception 'La caja ya está cerrada'; end if;
  if v_rol = 'tesoreria' and v_caja.fecha >= v_hoy then
    raise exception 'Tesorería solo cierra cajas de días anteriores que quedaron abiertas';
  end if;

  update public.cajas set
    estado = 'cerrada',
    cerrada_por = (select auth.uid()),
    cerrada_en = now()
  where id = p_caja;

  perform private.recalcular_arqueo(p_caja);
  a := private.calcular_arqueo(p_caja);

  v_detalle := 'Efectivo ' || private.caja_pesos((a ->> 'efectivo')::numeric);
  if v_caja.tipo = 'guardia' then
    v_detalle := v_detalle
      || ' — Quintas ' || private.caja_pesos((a ->> 'quintas')::numeric)
      || ' · Ambulantes ' || private.caja_pesos((a ->> 'ambulantes')::numeric)
      || ' · Bono camioneros ' || private.caja_pesos((a ->> 'canon')::numeric);
  end if;

  if v_rol = 'tesoreria' then
    perform private.registrar_evento_caja(p_caja, 'cierre_forzado',
      'Quedó abierta desde el ' || to_char(v_caja.fecha, 'DD/MM') || ' · ' || v_detalle);
  else
    perform private.registrar_evento_caja(p_caja, 'cierre', v_detalle);
  end if;

  return a || jsonb_build_object('caja_id', v_caja.id, 'tipo', v_caja.tipo, 'fecha', v_caja.fecha,
                                 'estado', 'cerrada', 'fuente', 'cierre');
end $$;
revoke all on function public.cerrar_caja(uuid) from public, anon;
grant execute on function public.cerrar_caja(uuid) to authenticated;


-- ------------------------------------------------------------
-- 7. Administración recibe la caja de portería en la caja mayor de hoy
-- ------------------------------------------------------------
create or replace function public.integrar_caja_porteria(p_caja uuid, p_observaciones text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
  v_caja public.cajas;
  v_destino public.cajas;
  v_nueva uuid;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('admin', 'tesoreria', 'lider') then
    raise exception 'Solo administración puede recibir la caja de portería';
  end if;

  -- Bloqueos §4.0: primero la caja de portería, después la de administración.
  select * into v_caja from public.cajas where id = p_caja and org_id = v_org for update;
  if not found then raise exception 'Caja inexistente'; end if;
  if v_caja.tipo <> 'guardia' then raise exception 'Solo se integran cajas de portería'; end if;
  if v_caja.estado <> 'cerrada' then
    raise exception 'La caja de portería tiene que estar rendida (cerrada) para recibirla';
  end if;

  -- Caja de administración de hoy (se crea si hace falta, §4.0-4).
  insert into public.cajas (org_id, tipo, fecha, abierta_por)
  values (v_org, 'administracion', v_hoy, (select auth.uid()))
  on conflict (org_id, tipo, fecha) do nothing
  returning id into v_nueva;
  if v_nueva is not null then
    perform private.registrar_evento_caja(v_nueva, 'apertura', 'Abierta al recibir la caja de portería');
  end if;
  select * into v_destino from public.cajas
  where org_id = v_org and tipo = 'administracion' and fecha = v_hoy for update;
  if v_destino.estado = 'validada' then
    raise exception 'La caja de administración de hoy ya fue validada por tesorería: la caja de portería entra mañana';
  end if;

  update public.cajas set
    estado = 'integrada',
    caja_destino_id = v_destino.id,
    integrada_por = (select auth.uid()),
    integrada_en = now(),
    observaciones = case when coalesce(trim(p_observaciones), '') = '' then observaciones
      else trim(both ' · ' from coalesce(observaciones, '') || ' · ' || trim(p_observaciones)) end
  where id = p_caja;

  if v_destino.estado = 'cerrada' then
    perform private.recalcular_arqueo(v_destino.id);
  end if;

  perform private.registrar_evento_caja(p_caja, 'integracion',
    'Integrada a la caja de administración del ' || to_char(v_destino.fecha, 'DD/MM/YYYY'));
  perform private.registrar_evento_caja(v_destino.id, 'recibe_rendicion',
    'Recibe la caja de portería del ' || to_char(v_caja.fecha, 'DD/MM')
    || ': efectivo ' || private.caja_pesos(coalesce(v_caja.total_efectivo, 0))
    || ' — Quintas ' || private.caja_pesos(coalesce(v_caja.total_quintas, 0))
    || ' · Ambulantes ' || private.caja_pesos(coalesce(v_caja.total_ambulantes, 0))
    || ' · Bono camioneros ' || private.caja_pesos(coalesce(v_caja.total_canon, 0)));

  return jsonb_build_object(
    'caja_destino', v_destino.id,
    'efectivo', coalesce(v_caja.total_efectivo, 0),
    'transferencia', coalesce(v_caja.total_transferencia, 0),
    'canon', coalesce(v_caja.total_canon, 0),
    'quintas', coalesce(v_caja.total_quintas, 0),
    'ambulantes', coalesce(v_caja.total_ambulantes, 0),
    'ajustes', coalesce(v_caja.total_ajustes, 0)
  );
end $$;
revoke all on function public.integrar_caja_porteria(uuid, text) from public, anon;
grant execute on function public.integrar_caja_porteria(uuid, text) to authenticated;


-- ------------------------------------------------------------
-- 8. Pedido de reapertura (sin cambios de fase 2 salvo el Líder, §1.3)
-- ------------------------------------------------------------
create or replace function public.solicitar_reapertura_caja(p_caja uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_caja public.cajas;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Contá qué pasó para pedir la reapertura'; end if;
  select * into v_caja from public.cajas where id = p_caja and org_id = v_org for update;
  if not found then raise exception 'Caja inexistente'; end if;
  if not (v_rol = 'lider'
          or (v_rol = 'guardia' and v_caja.tipo = 'guardia')
          or (v_rol = 'admin' and v_caja.tipo = 'administracion')) then
    raise exception 'Solo podés pedir la reapertura de tu propia caja';
  end if;
  if v_caja.estado = 'abierta' then raise exception 'La caja ya está abierta'; end if;
  if v_caja.estado = 'validada' then raise exception 'La caja ya fue validada por tesorería: no se puede reabrir'; end if;
  if v_caja.reapertura_solicitada_en is not null then raise exception 'Ya hay un pedido de reapertura pendiente'; end if;

  update public.cajas set
    reapertura_solicitada_en = now(),
    reapertura_solicitada_por = (select auth.uid()),
    reapertura_motivo = trim(p_motivo)
  where id = p_caja;
  perform private.registrar_evento_caja(p_caja, 'solicitud_reapertura', trim(p_motivo));
end $$;
revoke all on function public.solicitar_reapertura_caja(uuid, text) from public, anon;
grant execute on function public.solicitar_reapertura_caja(uuid, text) to authenticated;

create or replace function public.rechazar_reapertura_caja(p_caja uuid, p_motivo text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_caja public.cajas;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('admin', 'tesoreria', 'lider') then raise exception 'Sin permiso'; end if;
  select * into v_caja from public.cajas where id = p_caja and org_id = v_org for update;
  if not found then raise exception 'Caja inexistente'; end if;
  if v_caja.reapertura_solicitada_en is null then raise exception 'No hay un pedido de reapertura'; end if;
  update public.cajas set
    reapertura_solicitada_en = null, reapertura_solicitada_por = null, reapertura_motivo = null
  where id = p_caja;
  perform private.registrar_evento_caja(p_caja, 'rechazo_reapertura', nullif(trim(coalesce(p_motivo, '')), ''));
end $$;
revoke all on function public.rechazar_reapertura_caja(uuid, text) from public, anon;
grant execute on function public.rechazar_reapertura_caja(uuid, text) to authenticated;


-- ------------------------------------------------------------
-- 9. Reabrir: vuelve a abierta y limpia TODO el arqueo persistido (también las 8 columnas nuevas)
-- ------------------------------------------------------------
create or replace function public.reabrir_caja(p_caja uuid, p_motivo text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_caja public.cajas;
  v_destino public.cajas;
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('admin', 'tesoreria', 'lider') then
    raise exception 'Solo administración (o tesorería) puede reabrir una caja';
  end if;
  select * into v_caja from public.cajas where id = p_caja and org_id = v_org for update;
  if not found then raise exception 'Caja inexistente'; end if;
  if v_caja.estado = 'abierta' then raise exception 'La caja ya está abierta'; end if;
  if v_caja.estado = 'validada' then raise exception 'La caja ya fue validada por tesorería: no se puede reabrir'; end if;
  if v_rol = 'admin' and v_caja.estado = 'integrada' then
    raise exception 'Esta caja de portería ya entró en la caja mayor: pedile la reapertura a tesorería';
  end if;
  if v_motivo is null then v_motivo := v_caja.reapertura_motivo; end if;
  if v_motivo is null then raise exception 'Contá por qué la reabrís'; end if;

  -- Si estaba integrada, se desengancha de la caja mayor (que no puede estar validada).
  if v_caja.estado = 'integrada' and v_caja.caja_destino_id is not null then
    select * into v_destino from public.cajas where id = v_caja.caja_destino_id for update;
    if found and v_destino.estado = 'validada' then
      raise exception 'La caja de administración que recibió esta caja de portería ya fue validada';
    end if;
  end if;

  update public.cajas set
    estado = 'abierta',
    total_efectivo = null, total_transferencia = null, total_cheques = null,
    total_canon = null, total_gastos = null,
    total_rendido_efectivo = null, total_rendido_transferencia = null,
    total_cobros = null, total_quintas = null, total_ambulantes = null,
    total_cheques_entregados = null, total_ajustes = null,
    total_rendido_quintas = null, total_rendido_ambulantes = null, total_rendido_canon = null,
    cerrada_por = null, cerrada_en = null,
    caja_destino_id = null, integrada_por = null, integrada_en = null,
    reapertura_solicitada_en = null, reapertura_solicitada_por = null, reapertura_motivo = null,
    reaperturas = reaperturas + 1
  where id = p_caja;

  if v_destino.id is not null and v_destino.estado = 'cerrada' then
    perform private.recalcular_arqueo(v_destino.id);
  end if;
  perform private.registrar_evento_caja(p_caja, 'reapertura', v_motivo);
end $$;
revoke all on function public.reabrir_caja(uuid, text) from public, anon;
grant execute on function public.reabrir_caja(uuid, text) to authenticated;


-- ------------------------------------------------------------
-- 10. Validar (tesorería / Líder): cuenta la plata y, si no coincide, el ajuste queda en el acto
-- ------------------------------------------------------------
create or replace function public.validar_caja(
  p_caja uuid,
  p_observaciones text default null,
  p_efectivo_contado numeric default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_caja public.cajas;
  v_total numeric;
  v_dif numeric := 0;
  v_obs text := nullif(trim(coalesce(p_observaciones, '')), '');
  v_detalle text;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('tesoreria', 'lider') then
    raise exception 'Solo tesorería puede validar cajas';
  end if;
  if p_efectivo_contado is not null and p_efectivo_contado < 0 then
    raise exception 'El efectivo contado no puede ser negativo';
  end if;

  select * into v_caja from public.cajas where id = p_caja and org_id = v_org for update;
  if not found then raise exception 'Caja inexistente'; end if;
  if v_caja.estado = 'validada' then raise exception 'La caja ya está validada'; end if;
  if v_caja.estado not in ('cerrada', 'integrada') then
    raise exception 'Solo se validan cajas cerradas';
  end if;
  if v_caja.tipo = 'guardia' and v_caja.estado = 'cerrada' then
    raise exception 'Primero hay que recibir la caja de portería en la caja de administración';
  end if;

  -- Totales frescos antes de comparar con lo contado.
  perform private.recalcular_arqueo(p_caja);
  select total_efectivo into v_total from public.cajas where id = p_caja;

  if p_efectivo_contado is not null then
    v_dif := round(p_efectivo_contado - coalesce(v_total, 0), 2);
    if v_dif <> 0 then
      perform private.registrar_evento_caja(p_caja, 'ajuste',
        case when v_dif < 0 then 'Faltante ' else 'Sobrante ' end || private.caja_pesos(abs(v_dif))
        || ' en efectivo: Diferencia de arqueo al validar (contado ' || private.caja_pesos(p_efectivo_contado) || ')');
      -- El trigger recalcular_caja actualiza el arqueo con este ajuste.
      insert into public.movimientos_tesoreria
        (org_id, fecha, tipo, moneda, cuenta, caja_id, monto, descripcion, creado_por)
      values
        (v_org, v_caja.fecha, 'ajuste', 'ARS', 'efectivo', p_caja, v_dif,
         'Diferencia de arqueo al validar: contado ' || private.caja_pesos(p_efectivo_contado),
         (select auth.uid()));
    end if;
  end if;

  update public.cajas set
    estado = 'validada',
    validada_por = (select auth.uid()),
    validada_en = now(),
    observaciones = coalesce(v_obs, observaciones),
    reapertura_solicitada_en = null, reapertura_solicitada_por = null, reapertura_motivo = null
  where id = p_caja;

  v_detalle := concat_ws(' · ',
    case when p_efectivo_contado is not null then
      'Efectivo contado ' || private.caja_pesos(p_efectivo_contado)
      || case when v_dif = 0 then ' (coincide)'
              when v_dif < 0 then ' (faltan ' || private.caja_pesos(abs(v_dif)) || ')'
              else ' (sobran ' || private.caja_pesos(v_dif) || ')' end
    end,
    v_obs);
  perform private.registrar_evento_caja(p_caja, 'validacion', nullif(v_detalle, ''));

  -- La caja de administración arrastra a las cajas de portería que recibió.
  if v_caja.tipo = 'administracion' then
    with arrastradas as (
      update public.cajas set
        estado = 'validada', validada_por = (select auth.uid()), validada_en = now()
      where caja_destino_id = p_caja and estado = 'integrada'
      returning id, org_id
    )
    insert into public.caja_eventos (org_id, caja_id, tipo, detalle, usuario_id)
    select org_id, id, 'validacion', 'Validada junto con la caja de administración', (select auth.uid())
    from arrastradas;
  end if;
end $$;
revoke all on function public.validar_caja(uuid, text, numeric) from public, anon;
grant execute on function public.validar_caja(uuid, text, numeric) to authenticated;


-- ------------------------------------------------------------
-- 11. Ajustes de tesorería sobre la caja (J3): movimientos_tesoreria con caja_id (§1.2-4)
-- ------------------------------------------------------------
create or replace function public.registrar_ajuste_caja(
  p_caja uuid,
  p_cuenta public.cuenta_tesoreria,
  p_monto numeric,
  p_motivo text,
  p_ref uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_caja public.cajas;
  v_id uuid;
  v_caja_previa uuid;
  v_monto numeric := round(coalesce(p_monto, 0), 2);
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('tesoreria', 'lider') then
    raise exception 'Solo tesorería carga ajustes de caja';
  end if;

  -- Idempotencia (§4.0-5): doble toque = un solo ajuste.
  if p_ref is not null then
    perform pg_advisory_xact_lock(hashtextextended('registrar_ajuste_caja:' || p_ref::text, 0));
    select m.id, m.caja_id into v_id, v_caja_previa
    from public.movimientos_tesoreria m where m.org_id = v_org and m.ref = p_ref;
    if v_id is not null then
      if v_caja_previa is distinct from p_caja then
        raise exception 'Ese ajuste ya se registró en otra caja';
      end if;
      return v_id;
    end if;
  end if;

  if v_monto = 0 then raise exception 'Poné el monto del ajuste'; end if;
  if v_motivo is null then raise exception 'Contá el motivo del ajuste'; end if;
  if char_length(v_motivo) > 300 then raise exception 'El motivo es muy largo: resumilo en una línea'; end if;
  if p_cuenta is null then raise exception 'Elegí si el ajuste es en efectivo o en el banco'; end if;

  select * into v_caja from public.cajas where id = p_caja and org_id = v_org for update;
  if not found then raise exception 'Caja inexistente'; end if;
  if v_caja.estado = 'validada' then
    raise exception 'La caja ya fue validada: cargá el ajuste en Tesorería';
  end if;

  begin
    perform private.registrar_evento_caja(p_caja, 'ajuste',
      case when v_monto < 0 then 'Faltante ' else 'Sobrante ' end || private.caja_pesos(abs(v_monto))
      || case when p_cuenta = 'efectivo' then ' en efectivo' else ' en el banco' end
      || ': ' || v_motivo);
    -- El trigger recalcular_caja actualiza el arqueo si la caja ya estaba cerrada.
    insert into public.movimientos_tesoreria
      (org_id, fecha, tipo, moneda, cuenta, caja_id, monto, descripcion, ref, creado_por)
    values
      (v_org, v_caja.fecha, 'ajuste', 'ARS', p_cuenta, p_caja, v_monto, v_motivo, p_ref, (select auth.uid()))
    returning id into v_id;
  exception when unique_violation then
    if p_ref is null then raise; end if;
    select m.id into v_id from public.movimientos_tesoreria m where m.org_id = v_org and m.ref = p_ref;
  end;
  return v_id;
end $$;
revoke all on function public.registrar_ajuste_caja(uuid, public.cuenta_tesoreria, numeric, text, uuid) from public, anon;
grant execute on function public.registrar_ajuste_caja(uuid, public.cuenta_tesoreria, numeric, text, uuid) to authenticated;

create or replace function public.borrar_ajuste_caja(p_ajuste uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_mov public.movimientos_tesoreria;
  v_caja public.cajas;
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('tesoreria', 'lider') then
    raise exception 'Solo tesorería borra ajustes de caja';
  end if;
  if v_motivo is null then raise exception 'Contá por qué lo borrás'; end if;

  select * into v_mov from public.movimientos_tesoreria where id = p_ajuste and org_id = v_org;
  if not found or v_mov.caja_id is null then raise exception 'Ese ajuste ya no se puede borrar'; end if;

  -- Bloqueos §4.0: la caja primero; después se relee el movimiento.
  select * into v_caja from public.cajas where id = v_mov.caja_id for update;
  if not found or v_caja.estado = 'validada' then raise exception 'Ese ajuste ya no se puede borrar'; end if;
  select * into v_mov from public.movimientos_tesoreria where id = p_ajuste and org_id = v_org for update;
  if not found or v_mov.caja_id is distinct from v_caja.id then
    raise exception 'Ese ajuste ya no se puede borrar';
  end if;

  -- El evento guarda monto y motivo: el rastro queda aunque la fila se borre.
  perform private.registrar_evento_caja(v_caja.id, 'ajuste_borrado',
    'Ajuste de ' || private.caja_pesos(v_mov.monto)
    || case when v_mov.cuenta = 'efectivo' then ' en efectivo' else ' en el banco' end
    || coalesce(' (' || nullif(trim(v_mov.descripcion), '') || ')', '')
    || ' borrado: ' || v_motivo);
  delete from public.movimientos_tesoreria where id = p_ajuste;  -- el trigger recalcula
end $$;
revoke all on function public.borrar_ajuste_caja(uuid, text) from public, anon;
grant execute on function public.borrar_ajuste_caja(uuid, text) to authenticated;


-- ------------------------------------------------------------
-- Pedidos a Fundación: ninguno. Las lecturas que usa /caja ya están en 0011/0022
-- (cajas, caja_eventos, pagos, cheques, gastos, canon_camiones, movimientos_tesoreria con
-- caja_id para Administración y el Jefe, perfiles del equipo).
-- ------------------------------------------------------------
