-- ============================================================
-- Mercado San Miguel — 0018 Fase 3 · M6 Tesorería, gastos y cheques
-- Contrato: docs/FASE3-CONTRATO.md §4.9 (+ §1.3 D-P2: el Líder opera todo).
--
-- Requiere 0010, 0011 y 0012. Se aplica como UNA transacción, en la ventana de
-- mantenimiento (0013…0021 + 0022 + deploy, §0.3). Idempotente: solo
-- `create or replace` de las funciones de M6 con la firma EXACTA de 0012 (o la
-- vigente para las modificadas) y `drop trigger if exists` + `create trigger`.
--
-- Funciones: pagar_gasto, revertir_pago_gasto, replicar_gastos_fijos,
-- entregar_cheque, vincular_cheque_gasto, flujo_caja, resumen_gastos,
-- rechazar_cheque. Triggers: proteger_gasto (gastos) y proteger_cheque (cheques).
--
-- Dependencias de otros módulos (plpgsql: se resuelven en ejecución, §0.1):
--   · M2: private.recalcular_arqueo(uuid) (existe desde fase 2; M2 la reescribe) y
--     private.calcular_arqueo(uuid) (nueva de M2: se usa solo si existe) + el trigger
--     recalcular_caja de M2 sobre gastos. Acá se llama igual a recalcular_arqueo
--     sobre cajas no abiertas como red de seguridad: es idempotente (una segunda
--     pasada no cambia nada ni deja otro evento).
--   · Fundación: private.registrar_evento_caja, private.revertir_imputaciones,
--     private.org_actual/rol_actual/hoy_ar.
--
-- Reglas §4.0: orden de bloqueo caja → cliente → cargos → cheques/gastos; estados
-- validados DESPUÉS del bloqueo; rastro en caja_eventos y columnas no editables.
-- ============================================================


-- ------------------------------------------------------------
-- Helper privado: "$ 1.234.567" (formato de pesos de los mensajes, §4)
-- ------------------------------------------------------------
create or replace function private.tesoreria_pesos(p_monto numeric)
returns text
language sql stable set search_path = '' as $$
  select '$ ' || replace(to_char(round(coalesce(p_monto, 0), 0), 'FM999G999G999G990'), ',', '.')
$$;
revoke all on function private.tesoreria_pesos(numeric) from public, anon;


-- ------------------------------------------------------------
-- pagar_gasto (E4, J5)
--   p_origen 'caja': siempre efectivo; caja = p_caja o la de administración de HOY.
--     Administración y el Líder la crean si no existe; Tesorería no abre cajas.
--   p_origen 'tesoreria': efectivo o banco (transferencia), fecha no futura.
-- ------------------------------------------------------------
create or replace function public.pagar_gasto(
  p_gasto uuid,
  p_origen text,
  p_medio public.medio_pago default 'efectivo',
  p_fecha date default null,
  p_caja uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
  v_gasto public.gastos;
  v_caja public.cajas;
  v_caja_id uuid := p_caja;
  v_nueva uuid;
  v_fecha date;
  v_medio public.medio_pago := coalesce(p_medio, 'efectivo');
  v_etiqueta text;
  v_efectivo numeric;
  v_arqueo jsonb;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('admin','tesoreria','lider') then
    raise exception 'No tenés permiso para pagar gastos';
  end if;

  if p_origen = 'caja' then
    if v_medio <> 'efectivo' then
      raise exception 'De la caja del día solo sale efectivo';
    end if;

    if v_caja_id is null then
      select c.id into v_caja_id from public.cajas c
      where c.org_id = v_org and c.tipo = 'administracion' and c.fecha = v_hoy;
      if v_caja_id is null then
        if v_rol = 'tesoreria' then
          raise exception 'Todavía no hay caja de Administración hoy: pagalo desde Tesorería o elegí otro día';
        end if;
        -- §4.0-4: nunca "if not exists … insert".
        insert into public.cajas (org_id, tipo, fecha, abierta_por)
        values (v_org, 'administracion', v_hoy, (select auth.uid()))
        on conflict (org_id, tipo, fecha) do nothing
        returning id into v_nueva;
        if v_nueva is not null then
          v_caja_id := v_nueva;
          perform private.registrar_evento_caja(v_caja_id, 'apertura', 'Abierta al pagar un gasto');
        else
          select c.id into v_caja_id from public.cajas c
          where c.org_id = v_org and c.tipo = 'administracion' and c.fecha = v_hoy;
        end if;
      end if;
    end if;

    -- (b) caja for update ANTES que el gasto; el estado se valida después del bloqueo.
    select * into v_caja from public.cajas where id = v_caja_id and org_id = v_org for update;
    if not found then raise exception 'Esa caja no existe. Actualizá la página.'; end if;
    if v_caja.tipo <> 'administracion' then
      raise exception 'Elegí una caja de administración';
    end if;
    if v_caja.estado = 'validada' then
      raise exception 'La caja del % ya la validó tesorería: elegí otro día o pagalo desde Tesorería',
        to_char(v_caja.fecha, 'DD/MM');
    end if;
    v_fecha := v_caja.fecha;

  elsif p_origen = 'tesoreria' then
    if v_medio not in ('efectivo','transferencia') then
      raise exception 'Elegí efectivo o banco';
    end if;
    v_fecha := coalesce(p_fecha, v_hoy);
    if v_fecha > v_hoy then
      raise exception 'La fecha de pago no puede ser futura';
    end if;
    v_caja_id := null;
  else
    raise exception 'Elegí de dónde sale la plata';
  end if;

  -- (e) gasto for update
  select * into v_gasto from public.gastos where id = p_gasto and org_id = v_org for update;
  if not found then raise exception 'Ese gasto no existe. Actualizá la página.'; end if;
  if v_gasto.estado <> 'pendiente' then
    raise exception 'El gasto ya no está pendiente. Actualizá la página.';
  end if;

  select coalesce(nullif(trim(v_gasto.descripcion), ''), r.nombre, 'Gasto') into v_etiqueta
  from public.rubros_gasto r where r.id = v_gasto.rubro_id;
  v_etiqueta := coalesce(v_etiqueta, nullif(trim(v_gasto.descripcion), ''), 'Gasto');

  if v_caja_id is not null then
    perform private.registrar_evento_caja(v_caja_id, 'gasto_imputado',
      v_etiqueta || ' — ' || private.tesoreria_pesos(v_gasto.monto)
      || case when v_caja.estado <> 'abierta' then ' (cargado después del cierre)' else '' end);
  end if;

  update public.gastos set
    estado = 'pagado',
    fecha_pago = v_fecha,
    medio_pago = v_medio,
    pagado_desde = p_origen,
    caja_id = v_caja_id,
    pagado_por = (select auth.uid()),
    pagado_en = now()
  where id = p_gasto;

  if v_caja_id is not null then
    if v_caja.estado <> 'abierta' then
      -- El trigger recalcular_caja de M2 ya lo hizo; red de seguridad idempotente.
      perform private.recalcular_arqueo(v_caja_id);
      select c.total_efectivo into v_efectivo from public.cajas c where c.id = v_caja_id;
    elsif to_regprocedure('private.calcular_arqueo(uuid)') is not null then
      v_arqueo := private.calcular_arqueo(v_caja_id);
      v_efectivo := nullif(v_arqueo ->> 'efectivo', '')::numeric;
    end if;
  end if;

  return jsonb_build_object(
    'caja_id', v_caja_id,
    'caja_fecha', case when v_caja_id is not null then v_caja.fecha end,
    'caja_estado', case when v_caja_id is not null then v_caja.estado::text end,
    'efectivo_caja', v_efectivo,
    'fecha_pago', v_fecha,
    'arqueo_recalculado', v_caja_id is not null and v_caja.estado <> 'abierta'
  );
end $$;
revoke all on function public.pagar_gasto(uuid, text, public.medio_pago, date, uuid) from public, anon;
grant execute on function public.pagar_gasto(uuid, text, public.medio_pago, date, uuid) to authenticated;


-- ------------------------------------------------------------
-- revertir_pago_gasto (E4): "Deshacer pago" con motivo obligatorio y rastro.
-- ------------------------------------------------------------
create or replace function public.revertir_pago_gasto(p_gasto uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
  v_caja_id uuid;
  v_caja public.cajas;
  v_gasto public.gastos;
  v_etiqueta text;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('admin','tesoreria','lider') then
    raise exception 'No tenés permiso para deshacer pagos de gastos';
  end if;
  if v_motivo is null then
    raise exception 'Contá por qué deshacés el pago';
  end if;

  -- Orden §4.0: caja → gasto. Primero se averigua la caja sin bloquear.
  select g.caja_id into v_caja_id from public.gastos g where g.id = p_gasto and g.org_id = v_org;
  if not found then raise exception 'Ese gasto no existe. Actualizá la página.'; end if;

  if v_caja_id is not null then
    select * into v_caja from public.cajas where id = v_caja_id for update;
  end if;

  select * into v_gasto from public.gastos where id = p_gasto and org_id = v_org for update;
  if v_gasto.estado <> 'pagado' then
    raise exception 'Ese gasto no está pagado';
  end if;
  if v_gasto.caja_id is distinct from v_caja_id then
    raise exception 'El pago de este gasto cambió recién. Actualizá la página y probá de nuevo.';
  end if;
  if v_gasto.pagado_desde = 'cheque' then
    raise exception 'Se pagó con un cheque: resolvelo desde Cheques';
  end if;
  if v_caja_id is not null and v_caja.estado = 'validada' then
    raise exception 'La caja de ese día ya fue validada';
  end if;

  if v_caja_id is not null then
    select coalesce(nullif(trim(v_gasto.descripcion), ''), r.nombre, 'Gasto') into v_etiqueta
    from public.rubros_gasto r where r.id = v_gasto.rubro_id;
    perform private.registrar_evento_caja(v_caja_id, 'gasto_revertido',
      coalesce(v_etiqueta, 'Gasto') || ' — ' || private.tesoreria_pesos(v_gasto.monto) || ': ' || v_motivo);
  end if;

  update public.gastos set
    estado = 'pendiente',
    fecha_pago = null,
    medio_pago = null,
    pagado_desde = null,
    caja_id = null,
    pagado_por = null,
    pagado_en = null,
    comprobante_validado = false,
    validado_por = null,
    validado_en = null,
    pago_revertido_por = (select auth.uid()),
    pago_revertido_en = now(),
    pago_revertido_motivo = v_motivo
  where id = p_gasto;

  if v_caja_id is not null and v_caja.estado <> 'abierta' then
    perform private.recalcular_arqueo(v_caja_id);   -- red de seguridad (M2 lo hace por trigger)
  end if;
end $$;
revoke all on function public.revertir_pago_gasto(uuid, text) from public, anon;
grant execute on function public.revertir_pago_gasto(uuid, text) to authenticated;


-- ------------------------------------------------------------
-- replicar_gastos_fijos (E3): trae los fijos del mes anterior con montos editados.
--   p_items = [{"origen_id": uuid, "monto": n, "vencimiento": "YYYY-MM-DD"|null, "descripcion": text|null}]
--   Idempotente por el índice único gastos_origen_unq: lo ya traído se omite.
-- ------------------------------------------------------------
create or replace function public.replicar_gastos_fijos(
  p_desde_periodo date,
  p_hasta_periodo date,
  p_items jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_item jsonb;
  v_origen public.gastos;
  v_origen_id uuid;
  v_nombre text;
  v_monto numeric;
  v_venc date;
  v_desc text;
  v_id uuid;
  v_creados integer := 0;
  v_total numeric := 0;
  v_omitidos uuid[] := '{}';
  v_txt text;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('admin','tesoreria','lider') then
    raise exception 'No tenés permiso para cargar gastos';
  end if;
  if p_desde_periodo is null or p_hasta_periodo is null
     or p_desde_periodo <> (date_trunc('month', p_desde_periodo::timestamp))::date
     or p_hasta_periodo <> (date_trunc('month', p_hasta_periodo::timestamp))::date then
    raise exception 'Elegí un mes válido';
  end if;
  if p_hasta_periodo <= p_desde_periodo then
    raise exception 'Los gastos se traen a un mes posterior';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Elegí al menos un gasto para traer';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_txt := v_item ->> 'origen_id';
    if v_txt is null or v_txt !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Uno de los gastos no se reconoce. Actualizá la página.';
    end if;
    v_origen_id := v_txt::uuid;

    select * into v_origen from public.gastos
    where id = v_origen_id and org_id = v_org and tipo = 'fijo'
      and periodo = p_desde_periodo and estado <> 'anulado';
    if not found then
      raise exception 'Uno de los gastos ya no es un fijo de ese mes. Actualizá la página.';
    end if;

    select coalesce(nullif(trim(v_origen.descripcion), ''), r.nombre, 'Gasto') into v_nombre
    from public.rubros_gasto r where r.id = v_origen.rubro_id;
    v_nombre := coalesce(v_nombre, 'Gasto');

    v_txt := v_item ->> 'monto';
    if v_txt is null or v_txt !~ '^[0-9]+(\.[0-9]+)?$' then
      raise exception 'El monto de % tiene que ser mayor a cero', v_nombre;
    end if;
    v_monto := round(v_txt::numeric, 2);
    if v_monto <= 0 then
      raise exception 'El monto de % tiene que ser mayor a cero', v_nombre;
    end if;

    v_txt := nullif(trim(coalesce(v_item ->> 'vencimiento', '')), '');
    if v_txt is null then
      v_venc := case when v_origen.vencimiento is not null
                     then (v_origen.vencimiento + interval '1 month')::date end;
    elsif v_txt ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      begin
        v_venc := v_txt::date;
      exception when others then
        raise exception 'La fecha de vencimiento de % no es válida', v_nombre;
      end;
    else
      raise exception 'La fecha de vencimiento de % no es válida', v_nombre;
    end if;

    v_desc := coalesce(nullif(trim(coalesce(v_item ->> 'descripcion', '')), ''), v_origen.descripcion);

    v_id := null;
    insert into public.gastos (org_id, rubro_id, tipo, descripcion, monto, vencimiento, periodo,
                               notas, origen_id, creado_por)
    values (v_org, v_origen.rubro_id, 'fijo', v_desc, v_monto, v_venc, p_hasta_periodo,
            v_origen.notas, v_origen.id, (select auth.uid()))
    on conflict (origen_id) where origen_id is not null and estado <> 'anulado' do nothing
    returning id into v_id;

    if v_id is null then
      v_omitidos := v_omitidos || v_origen.id;
    else
      v_creados := v_creados + 1;
      v_total := v_total + v_monto;
    end if;
  end loop;

  return jsonb_build_object('creados', v_creados, 'omitidos', to_jsonb(v_omitidos), 'total', v_total);
end $$;
revoke all on function public.replicar_gastos_fijos(date, date, jsonb) from public, anon;
grant execute on function public.replicar_gastos_fijos(date, date, jsonb) to authenticated;


-- ------------------------------------------------------------
-- entregar_cheque (E2): endoso a un proveedor, opcionalmente pagando un gasto.
--   Sin efecto en cajas (el cheque ya estaba en tesorería).
-- ------------------------------------------------------------
create or replace function public.entregar_cheque(
  p_cheque uuid,
  p_proveedor text,
  p_fecha date default null,
  p_gasto uuid default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
  v_fecha date := coalesce(p_fecha, private.hoy_ar());
  v_proveedor text := nullif(trim(coalesce(p_proveedor, '')), '');
  v_cheque public.cheques;
  v_gasto public.gastos;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('tesoreria','lider') then
    raise exception 'Solo Tesorería entrega cheques';
  end if;
  if v_proveedor is null then
    raise exception 'Poné a qué proveedor se lo entregaste';
  end if;
  if char_length(v_proveedor) > 120 then
    raise exception 'El nombre del proveedor es muy largo (máximo 120 letras)';
  end if;
  if v_fecha > v_hoy then
    raise exception 'La fecha de entrega no puede ser futura';
  end if;

  select * into v_cheque from public.cheques where id = p_cheque and org_id = v_org for update;
  if not found then raise exception 'Ese cheque no existe. Actualizá la página.'; end if;
  if v_cheque.estado <> 'en_cartera' then
    raise exception 'Solo se entregan cheques que están por cobrar';
  end if;
  if v_fecha < v_cheque.fecha_recibido then
    raise exception 'No se puede entregar antes de recibirlo (llegó el %)', to_char(v_cheque.fecha_recibido, 'DD/MM');
  end if;

  if p_gasto is not null then
    select * into v_gasto from public.gastos where id = p_gasto and org_id = v_org for update;
    if not found or v_gasto.estado <> 'pendiente' then
      raise exception 'Ese gasto ya no está pendiente';
    end if;
    update public.gastos set
      estado = 'pagado',
      fecha_pago = v_fecha,
      medio_pago = 'cheque',
      pagado_desde = 'cheque',
      caja_id = null,
      pagado_por = (select auth.uid()),
      pagado_en = now()
    where id = p_gasto;
  end if;

  update public.cheques set
    estado = 'entregado',
    proveedor = v_proveedor,
    fecha_entregado = v_fecha,
    entregado_por = (select auth.uid()),
    gasto_id = p_gasto
  where id = p_cheque;
end $$;
revoke all on function public.entregar_cheque(uuid, text, date, uuid) from public, anon;
grant execute on function public.entregar_cheque(uuid, text, date, uuid) to authenticated;


-- ------------------------------------------------------------
-- vincular_cheque_gasto (§1.1-5): el cheque que nació "Entregado a proveedor" en
-- el cobro cancela el gasto de ese proveedor. Sin efecto en cajas.
-- ------------------------------------------------------------
create or replace function public.vincular_cheque_gasto(p_cheque uuid, p_gasto uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_cheque public.cheques;
  v_gasto public.gastos;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('tesoreria','lider') then
    raise exception 'Solo Tesorería vincula cheques con gastos';
  end if;

  select * into v_cheque from public.cheques where id = p_cheque and org_id = v_org for update;
  if not found or v_cheque.estado <> 'entregado' or v_cheque.gasto_id is not null then
    raise exception 'Ese cheque ya está vinculado o no fue entregado a un proveedor';
  end if;

  select * into v_gasto from public.gastos where id = p_gasto and org_id = v_org for update;
  if not found or v_gasto.estado <> 'pendiente' then
    raise exception 'Ese gasto ya no está pendiente';
  end if;

  update public.gastos set
    estado = 'pagado',
    fecha_pago = coalesce(v_cheque.fecha_entregado, private.hoy_ar()),
    medio_pago = 'cheque',
    pagado_desde = 'cheque',
    caja_id = null,
    pagado_por = (select auth.uid()),
    pagado_en = now()
  where id = p_gasto;

  update public.cheques set gasto_id = p_gasto where id = p_cheque;
end $$;
revoke all on function public.vincular_cheque_gasto(uuid, uuid) from public, anon;
grant execute on function public.vincular_cheque_gasto(uuid, uuid) to authenticated;


-- ------------------------------------------------------------
-- flujo_caja (J2, J6) — misma firma. Pesos (efectivo, banco), dólares y cheques.
-- Cada cuenta cuenta desde la fecha de su saldo inicial inclusive (sin saldo: todo).
-- ------------------------------------------------------------
create or replace function public.flujo_caja()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
  v_ini_ef numeric; v_ini_bco numeric; v_ini_ef_usd numeric; v_ini_bco_usd numeric;
  d_ef date; d_bco date; d_ef_usd date; d_bco_usd date;
  v_ef numeric; v_bco numeric; v_ef_usd numeric; v_bco_usd numeric;
  m_ef numeric; m_bco numeric; m_ef_usd numeric; m_bco_usd numeric;
  v_ef_cajas numeric;
  v_cart numeric; v_listos numeric; v_dep numeric;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('tesoreria','lider','consejo') then
    raise exception 'Solo Tesorería y el Líder de Procesos ven el flujo de fondos';
  end if;

  select
    coalesce(sum(s.monto) filter (where s.medio = 'efectivo' and s.moneda = 'ARS'), 0),
    max(s.fecha)          filter (where s.medio = 'efectivo' and s.moneda = 'ARS'),
    coalesce(sum(s.monto) filter (where s.medio = 'transferencia' and s.moneda = 'ARS'), 0),
    max(s.fecha)          filter (where s.medio = 'transferencia' and s.moneda = 'ARS'),
    coalesce(sum(s.monto) filter (where s.medio = 'efectivo' and s.moneda = 'USD'), 0),
    max(s.fecha)          filter (where s.medio = 'efectivo' and s.moneda = 'USD'),
    coalesce(sum(s.monto) filter (where s.medio = 'transferencia' and s.moneda = 'USD'), 0),
    max(s.fecha)          filter (where s.medio = 'transferencia' and s.moneda = 'USD')
  into v_ini_ef, d_ef, v_ini_bco, d_bco, v_ini_ef_usd, d_ef_usd, v_ini_bco_usd, d_bco_usd
  from public.saldos_iniciales s
  where s.org_id = v_org;

  -- Pesos · efectivo
  v_ef := v_ini_ef
    + coalesce((select sum(p.monto) from public.pagos p
        where p.org_id = v_org and not p.anulado and p.medio = 'efectivo'
          and (d_ef is null or (p.fecha at time zone 'America/Argentina/Cordoba')::date >= d_ef)), 0)
    + coalesce((select sum(cc.monto) from public.canon_camiones cc
        where cc.org_id = v_org and not cc.anulado and cc.medio = 'efectivo'
          and (d_ef is null or cc.fecha >= d_ef)), 0)
    - coalesce((select sum(g.monto) from public.gastos g
        where g.org_id = v_org and g.estado = 'pagado' and g.medio_pago = 'efectivo'
          and (d_ef is null or g.fecha_pago >= d_ef)), 0);

  -- Pesos · banco
  v_bco := v_ini_bco
    + coalesce((select sum(p.monto) from public.pagos p
        where p.org_id = v_org and not p.anulado and p.medio = 'transferencia'
          and (d_bco is null or (p.fecha at time zone 'America/Argentina/Cordoba')::date >= d_bco)), 0)
    + coalesce((select sum(cc.monto) from public.canon_camiones cc
        where cc.org_id = v_org and not cc.anulado and cc.medio = 'transferencia'
          and (d_bco is null or cc.fecha >= d_bco)), 0)
    + coalesce((select sum(ch.monto) from public.cheques ch
        where ch.org_id = v_org and ch.estado = 'acreditado'
          and (d_bco is null or coalesce(ch.fecha_acreditado, ch.fecha_cobro) >= d_bco)), 0)
    - coalesce((select sum(g.monto) from public.gastos g
        where g.org_id = v_org and g.estado = 'pagado' and g.medio_pago = 'transferencia'
          and (d_bco is null or g.fecha_pago >= d_bco)), 0);

  -- Movimientos: ajuste (con su signo) e ingreso suman en su cuenta; impuesto, débito
  -- fiscal, comisión y egreso restan; depósito/extracción restan de la cuenta y suman
  -- en la cuenta destino. Incluye los ajustes de caja (J3, caja_id no nulo).
  with efectos as (
    select m.moneda, m.cuenta, m.fecha,
           case when m.tipo in ('ajuste','ingreso') then m.monto else -m.monto end as efecto
    from public.movimientos_tesoreria m
    where m.org_id = v_org
    union all
    select m.moneda, m.cuenta_destino, m.fecha, m.monto
    from public.movimientos_tesoreria m
    where m.org_id = v_org and m.tipo in ('deposito','extraccion') and m.cuenta_destino is not null
  )
  select
    coalesce(sum(e.efecto) filter (where e.moneda = 'ARS' and e.cuenta = 'efectivo' and (d_ef is null or e.fecha >= d_ef)), 0),
    coalesce(sum(e.efecto) filter (where e.moneda = 'ARS' and e.cuenta = 'banco' and (d_bco is null or e.fecha >= d_bco)), 0),
    coalesce(sum(e.efecto) filter (where e.moneda = 'USD' and e.cuenta = 'efectivo' and (d_ef_usd is null or e.fecha >= d_ef_usd)), 0),
    coalesce(sum(e.efecto) filter (where e.moneda = 'USD' and e.cuenta = 'banco' and (d_bco_usd is null or e.fecha >= d_bco_usd)), 0)
  into m_ef, m_bco, m_ef_usd, m_bco_usd
  from efectos e;

  v_ef := v_ef + m_ef;
  v_bco := v_bco + m_bco;
  v_ef_usd := v_ini_ef_usd + m_ef_usd;
  v_bco_usd := v_ini_bco_usd + m_bco_usd;

  -- Parte del efectivo que sigue en cajas sin validar (administración y portería
  -- sin integrar; una caja de portería integrada se valida junto con su destino).
  v_ef_cajas :=
      coalesce((select sum(p.monto) from public.pagos p join public.cajas c on c.id = p.caja_id
        where p.org_id = v_org and not p.anulado and p.medio = 'efectivo' and c.estado <> 'validada'
          and (d_ef is null or (p.fecha at time zone 'America/Argentina/Cordoba')::date >= d_ef)), 0)
    + coalesce((select sum(cc.monto) from public.canon_camiones cc join public.cajas c on c.id = cc.caja_id
        where cc.org_id = v_org and not cc.anulado and cc.medio = 'efectivo' and c.estado <> 'validada'
          and (d_ef is null or cc.fecha >= d_ef)), 0)
    - coalesce((select sum(g.monto) from public.gastos g join public.cajas c on c.id = g.caja_id
        where g.org_id = v_org and g.estado = 'pagado' and g.medio_pago = 'efectivo' and c.estado <> 'validada'
          and (d_ef is null or g.fecha_pago >= d_ef)), 0)
    + coalesce((select sum(m.monto) from public.movimientos_tesoreria m join public.cajas c on c.id = m.caja_id
        where m.org_id = v_org and m.tipo = 'ajuste' and m.cuenta = 'efectivo' and m.moneda = 'ARS'
          and c.estado <> 'validada' and (d_ef is null or m.fecha >= d_ef)), 0);

  -- Cheques: los entregados a proveedores y los rechazados no cuentan.
  select
    coalesce(sum(ch.monto) filter (where ch.estado = 'en_cartera'), 0),
    coalesce(sum(ch.monto) filter (where ch.estado = 'en_cartera' and ch.fecha_cobro <= v_hoy), 0),
    coalesce(sum(ch.monto) filter (where ch.estado = 'depositado'), 0)
  into v_cart, v_listos, v_dep
  from public.cheques ch
  where ch.org_id = v_org;

  return jsonb_build_object(
    'pesos',   jsonb_build_object('efectivo', v_ef, 'efectivo_en_cajas', v_ef_cajas,
                                  'banco', v_bco, 'total', v_ef + v_bco),
    'dolares', jsonb_build_object('efectivo', v_ef_usd, 'banco', v_bco_usd, 'total', v_ef_usd + v_bco_usd),
    'cheques', jsonb_build_object('por_cobrar', v_cart, 'listos', v_listos,
                                  'depositados', v_dep, 'total', v_cart + v_dep),
    'total_pesos', v_ef + v_bco + v_cart + v_dep,
    -- compatibilidad con la forma de fase 2 (todo en pesos)
    'efectivo', v_ef,
    'banco', v_bco,
    'cheques_en_cartera', v_cart + v_dep,
    'total', v_ef + v_bco + v_cart + v_dep
  );
end $$;
revoke all on function public.flujo_caja() from public, anon;
grant execute on function public.flujo_caja() to authenticated;


-- ------------------------------------------------------------
-- resumen_gastos (E3) — misma firma; criterio único: gastos.periodo.
-- ------------------------------------------------------------
create or replace function public.resumen_gastos(p_periodo date)
returns table(codigo text, nombre text, tipo public.tipo_gasto, pagado numeric, pendiente numeric)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_periodo date := (date_trunc('month', p_periodo::timestamp))::date;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('admin','tesoreria','lider','consejo') then
    raise exception 'Sin permiso';
  end if;
  return query
  select
    r.codigo,
    max(r.nombre)::text,
    g.tipo,
    coalesce(sum(g.monto) filter (where g.estado = 'pagado'), 0)::numeric,
    coalesce(sum(g.monto) filter (where g.estado = 'pendiente'), 0)::numeric
  from public.gastos g
  join public.rubros_gasto r on r.id = g.rubro_id
  where g.org_id = v_org
    and g.estado <> 'anulado'
    and g.periodo = v_periodo
  group by r.codigo, g.tipo
  order by r.codigo, g.tipo;
end $$;
revoke all on function public.resumen_gastos(date) from public, anon;
grant execute on function public.resumen_gastos(date) to authenticated;


-- ------------------------------------------------------------
-- rechazar_cheque (E1, E2) — misma firma (p_motivo sigue con default null, pero es
-- obligatorio). Bloqueos: caja del pago → cliente → cheque. Acepta en cartera,
-- depositado, acreditado o entregado (el proveedor lo devolvió).
-- ------------------------------------------------------------
create or replace function public.rechazar_cheque(p_cheque uuid, p_motivo text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
  v_caja_id uuid;
  v_cliente_id uuid;
  v_caja public.cajas;
  v_cheque public.cheques;
  v_pago public.pagos;
  v_hay_pago boolean := false;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('tesoreria','lider') then
    raise exception 'Solo Tesorería rechaza cheques';
  end if;
  if v_motivo is null then
    raise exception 'Contá por qué se rechazó el cheque (por ejemplo: sin fondos)';
  end if;

  -- Ubicar el cobro vigente del cheque sin bloquear, para respetar el orden §4.0.
  select p.caja_id, p.cliente_id into v_caja_id, v_cliente_id
  from public.pagos p
  where p.cheque_id = p_cheque and p.org_id = v_org and not p.anulado
  limit 1;

  if v_caja_id is not null then
    select * into v_caja from public.cajas where id = v_caja_id for update;          -- (b)
  end if;
  if v_cliente_id is not null then
    perform 1 from public.clientes where id = v_cliente_id and org_id = v_org for update;  -- (c)
  end if;

  select * into v_cheque from public.cheques where id = p_cheque and org_id = v_org for update;  -- (e)
  if not found then raise exception 'Cheque inexistente'; end if;
  if v_cheque.estado = 'rechazado' then raise exception 'El cheque ya está rechazado'; end if;

  select * into v_pago from public.pagos
  where cheque_id = p_cheque and org_id = v_org and not anulado
  for update;
  v_hay_pago := found;
  if v_hay_pago and v_pago.caja_id is distinct from v_caja_id then
    raise exception 'El cobro de este cheque cambió recién. Actualizá la página y probá de nuevo.';
  end if;

  update public.cheques set
    estado = 'rechazado',
    rechazado_por = (select auth.uid()),
    rechazado_en = now(),
    motivo_rechazo = v_motivo
  where id = p_cheque;

  -- El cheque había pagado un gasto (entregado a un proveedor): el gasto vuelve a pendiente.
  if v_cheque.gasto_id is not null then
    update public.gastos set
      estado = 'pendiente',
      fecha_pago = null,
      medio_pago = null,
      pagado_desde = null,
      caja_id = null,
      pagado_por = null,
      pagado_en = null,
      comprobante_validado = false,
      validado_por = null,
      validado_en = null,
      pago_revertido_por = (select auth.uid()),
      pago_revertido_en = now(),
      pago_revertido_motivo = 'Cheque N° ' || v_cheque.numero || ' rechazado: ' || v_motivo
    where id = v_cheque.gasto_id and org_id = v_org and estado = 'pagado' and pagado_desde = 'cheque';
  end if;

  -- Se anula SOLO la línea del cobro que lo recibió; la deuda del cliente vuelve.
  if v_hay_pago then
    perform private.revertir_imputaciones(v_pago.id);
    update public.pagos set
      anulado = true,
      anulado_por = (select auth.uid()),
      anulado_en = now(),
      motivo_anulacion = 'Cheque N° ' || v_cheque.numero || ' rechazado: ' || v_motivo
    where id = v_pago.id;

    perform private.registrar_evento_caja(v_pago.caja_id, 'cobro_anulado',
      'Recibo N° ' || v_pago.numero || ' · cheque N° ' || v_cheque.numero || ' rechazado: ' || v_motivo);

    if v_caja.estado in ('cerrada','integrada') then
      perform private.recalcular_arqueo(v_caja.id);
    end if;
  end if;
end $$;
revoke all on function public.rechazar_cheque(uuid, text) from public, anon;
grant execute on function public.rechazar_cheque(uuid, text) to authenticated;


-- ------------------------------------------------------------
-- Triggers de M6 (BEFORE UPDATE). "Directo" = current_user = 'authenticated' (PostgREST);
-- dentro de una RPC security definer current_user es el dueño y no se restringe.
-- Por eso las funciones son security INVOKER (el default). Solo leen new/old.
-- ------------------------------------------------------------
create or replace function private.tg_proteger_gasto()
returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if new.estado is distinct from old.estado
     and not (old.estado = 'pendiente' and new.estado = 'anulado') then
    raise exception 'El estado del gasto se cambia con sus botones: Pagar, Deshacer pago o Anular';
  end if;

  if old.estado = 'pagado' then
    if new.monto is distinct from old.monto then
      raise exception 'Deshacé el pago para cambiar el monto';
    end if;
    if new.rubro_id is distinct from old.rubro_id or new.periodo is distinct from old.periodo then
      raise exception 'Deshacé el pago para cambiar el rubro o el mes';
    end if;
  end if;

  return new;
end $$;
revoke all on function private.tg_proteger_gasto() from public, anon;

drop trigger if exists proteger_gasto on public.gastos;
create trigger proteger_gasto
  before update on public.gastos
  for each row execute function private.tg_proteger_gasto();


create or replace function private.tg_proteger_cheque()
returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if new.estado is not distinct from old.estado then
    -- Mismo estado: solo las notas. Las fechas se corrigen deshaciendo el paso.
    if new.fecha_depositado is distinct from old.fecha_depositado
       or new.fecha_acreditado is distinct from old.fecha_acreditado then
      raise exception 'Eso se hace desde Cheques con su botón';
    end if;
    return new;
  end if;

  if old.estado = 'en_cartera' and new.estado = 'depositado' then
    if new.fecha_depositado is null then
      raise exception 'Poné la fecha en que lo depositaste';
    end if;
    if new.fecha_depositado < old.fecha_cobro then
      raise exception 'Este cheque se puede depositar desde el %', to_char(old.fecha_cobro, 'DD/MM');
    end if;
    if new.fecha_depositado > (now() at time zone 'America/Argentina/Cordoba')::date then
      raise exception 'La fecha del depósito no puede ser futura';
    end if;
    new.fecha_acreditado := null;
    return new;
  end if;

  if old.estado = 'depositado' and new.estado = 'acreditado' then
    if new.fecha_acreditado is null then
      raise exception 'Poné la fecha en que se acreditó';
    end if;
    if old.fecha_depositado is not null and new.fecha_acreditado < old.fecha_depositado then
      raise exception 'No se puede acreditar antes del depósito (%)', to_char(old.fecha_depositado, 'DD/MM');
    end if;
    if new.fecha_acreditado > (now() at time zone 'America/Argentina/Cordoba')::date then
      raise exception 'La fecha de acreditación no puede ser futura';
    end if;
    new.fecha_depositado := old.fecha_depositado;
    return new;
  end if;

  if old.estado = 'depositado' and new.estado = 'en_cartera' then
    -- Deshacer un depósito cargado por error.
    new.fecha_depositado := null;
    new.fecha_acreditado := null;
    return new;
  end if;

  raise exception 'Eso se hace desde Cheques con su botón';
end $$;
revoke all on function private.tg_proteger_cheque() from public, anon;

drop trigger if exists proteger_cheque on public.cheques;
create trigger proteger_cheque
  before update on public.cheques
  for each row execute function private.tg_proteger_cheque();


-- ============================================================
-- Pedidos a Fundación (policies/grants que M6 necesita y no son suyos; §0.2-3)
-- §1.3 D-P2: el Líder opera todo. Las RPC de M6 ya lo aceptan, pero estas escrituras
-- directas (PostgREST) las frena la RLS vigente (0005/0006/0022) para el Líder:
--   1. cheques "actualizar cheques": sumar 'lider' (depositar / acreditar / deshacer depósito).
--   2. gastos "insertar gastos", "editar gastos", "borrar gastos": sumar 'lider'.
--   3. movimientos_tesoreria "insertar/editar/borrar movimientos tesoreria": sumar 'lider'.
--   4. saldos_iniciales "insertar/editar/borrar saldos iniciales": sumar 'lider'.
--   5. pagos "conciliar pagos": sumar 'lider' (conciliar transferencias).
-- ============================================================
