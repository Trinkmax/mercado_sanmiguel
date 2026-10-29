-- ============================================================
-- 0056 · Corregir lecturas de luz ya cobradas y reabrir cajas validadas.
--
-- Pedidos del 29/10/2026:
--   «No se puede corregir lecturas de luz ya generadas, permitir.» registrar_lectura
--   rechazaba la corrección si el cargo ENER ya tenía algo cobrado (y eso pasa enseguida: el
--   saldo a favor se aplica solo al cargar la lectura). Ahora se corrige igual: lo cobrado
--   sigue en el cargo hasta el monto nuevo; si la lectura bajó y sobra, se suelta lo último
--   que entró y queda como saldo a favor, que va a sus otras deudas. Los recibos no cambian
--   de número ni de plata.
--   «No permite reabrir una caja validada por tesorería, permitir.» reabrir_caja también
--   reabre una caja validada: se deshace la validación (el ajuste por la diferencia del
--   conteo se borra, con rastro) y, al cerrarla, Tesorería la vuelve a contar y validar.
--   Quién: la de administración, quien reabre una cerrada (Administración, Tesorería, el
--   Líder); la de portería, Tesorería y el Líder (como una integrada). Reabrir una caja de
--   portería validada deja su caja de administración cerrada sin validar; reabrir una de
--   administración devuelve a «integrada» las de portería que se validaron con ella.
-- ============================================================

alter table public.caja_eventos drop constraint if exists caja_eventos_tipo_check;
alter table public.caja_eventos add constraint caja_eventos_tipo_check check (tipo in (
  'apertura', 'cierre', 'solicitud_reapertura', 'reapertura', 'rechazo_reapertura', 'integracion',
  'recibe_rendicion', 'validacion', 'gasto_imputado', 'gasto_revertido', 'ajuste', 'ajuste_borrado',
  'canon_anulado', 'arqueo_recalculado', 'cierre_forzado', 'cobro_anulado', 'ingreso_anulado',
  'validacion_deshecha'));

-- ------------------------------------------------------------
-- 1. Lecturas: corregir aunque el cargo ENER ya tenga cobros (0021 + 0056).
-- ------------------------------------------------------------
create or replace function public.registrar_lectura(
  p_medidor uuid,
  p_periodo date,
  p_anterior numeric,
  p_actual numeric
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
  v_periodo date;
  v_medidor public.medidores;
  v_precio numeric;
  v_lectura_id uuid;
  v_cargo public.cargos;
  v_venc date;
  v_dia int;
  v_l public.lecturas;
  v_pagado numeric;
  v_sobra numeric;
  v_imp record;
begin
  if v_org is null or v_rol is null then
    raise exception 'Sin perfil activo';
  end if;
  if v_rol not in ('admin','consejo','lider') then
    raise exception 'No tenés permiso para cargar lecturas';
  end if;
  if p_periodo is null then
    raise exception 'Elegí el mes de la lectura';
  end if;
  v_periodo := date_trunc('month', p_periodo)::date;
  if v_periodo > date_trunc('month', v_hoy)::date then
    raise exception 'No se cargan lecturas de meses que todavía no empezaron';
  end if;
  if p_anterior is null then
    raise exception 'Poné la lectura anterior del medidor';
  end if;
  if p_actual is null then
    raise exception 'Poné la lectura actual del medidor';
  end if;
  if p_anterior < 0 or p_actual < 0 then
    raise exception 'Las lecturas no pueden ser negativas';
  end if;
  if p_actual < p_anterior then
    raise exception 'La lectura actual no puede ser menor a la anterior';
  end if;

  select * into v_medidor from public.medidores where id = p_medidor and org_id = v_org;
  if not found then
    raise exception 'Medidor inexistente';
  end if;

  select c.precio into v_precio from public.conceptos c where c.org_id = v_org and c.codigo = 'ENER';
  if v_precio is null then
    raise exception 'Falta configurar el precio del kWh (concepto ENER)';
  end if;

  -- Mismo candado que generar_periodo (las dos crean la ENER de una lectura) y después el
  -- cliente: cliente → cargos (§4.0-1/2), así un cobro en paralelo no ve un cargo a medio corregir.
  perform pg_advisory_xact_lock(hashtextextended('generar_periodo:' || v_org::text || ':' || v_periodo::text, 0));
  perform 1 from public.clientes cl where cl.id = v_medidor.cliente_id and cl.org_id = v_org for update;

  select l.id into v_lectura_id from public.lecturas l
   where l.medidor_id = p_medidor and l.periodo = v_periodo
     for update;

  if v_lectura_id is not null then
    -- 0056: se corrige aunque ya tenga cobros (abajo se acomoda lo cobrado al monto nuevo).
    perform 1 from public.cargos c where c.origen_lectura = v_lectura_id for update;
    update public.lecturas set
      lectura_anterior = p_anterior,
      lectura_actual = p_actual,
      precio_kwh = v_precio,
      fecha_lectura = v_hoy
    where id = v_lectura_id;
  else
    insert into public.lecturas (org_id, medidor_id, periodo, lectura_anterior, lectura_actual, precio_kwh, creado_por)
    values (v_org, p_medidor, v_periodo, p_anterior, p_actual, v_precio, (select auth.uid()))
    returning id into v_lectura_id;
  end if;

  select p.vencimiento into v_venc from public.periodos p where p.org_id = v_org and p.periodo = v_periodo;
  if v_venc is null then
    select c.dia_vencimiento into v_dia from public.configuracion c where c.org_id = v_org;
    v_dia := coalesce(v_dia, 30);
    v_venc := least(
      (v_periodo + interval '1 month' - interval '1 day')::date,
      make_date(extract(year from v_periodo)::int, extract(month from v_periodo)::int, 1) + (v_dia - 1)
    );
  end if;

  select * into v_cargo from public.cargos c where c.origen_lectura = v_lectura_id;
  if found then
    select * into v_l from public.lecturas l where l.id = v_lectura_id;
    -- 0056: lo cobrado sigue en el cargo hasta el monto nuevo. Si la lectura bajó y sobra, se
    -- suelta lo último que entró (cada cobro conserva su recibo y su plata): queda como saldo a
    -- favor y aplicar_saldo_favor lo lleva a sus otras deudas.
    v_pagado := v_cargo.monto_pagado;
    if v_pagado > v_l.monto then
      v_sobra := v_pagado - v_l.monto;
      for v_imp in
        select i.id, i.monto
        from public.imputaciones i
        join public.pagos p on p.id = i.pago_id
        where i.cargo_id = v_cargo.id
        order by p.fecha desc, i.creado_en desc
        for update of i
      loop
        exit when v_sobra <= 0;
        if v_imp.monto <= v_sobra then
          delete from public.imputaciones where id = v_imp.id;
          v_sobra := v_sobra - v_imp.monto;
        else
          update public.imputaciones set monto = monto - v_sobra where id = v_imp.id;
          v_sobra := 0;
        end if;
      end loop;
      v_pagado := v_l.monto;
    end if;
    update public.cargos c set
      cantidad = v_l.kwh,
      precio_unitario = v_l.precio_kwh,
      monto = v_l.monto,
      monto_pagado = v_pagado,
      descripcion = 'Energía · Medidor N° ' || v_medidor.numero || ' (' || v_l.kwh || ' kWh)',
      estado = case
        when v_pagado >= v_l.monto then 'pagado'::public.estado_cargo
        when v_pagado > 0 then 'parcial'::public.estado_cargo
        else 'pendiente'::public.estado_cargo end
    where c.id = v_cargo.id;
  else
    insert into public.cargos (
      org_id, periodo, cliente_id, concepto_id, codigo, descripcion,
      cantidad, precio_unitario, monto, descuento_pronto_pago, vencimiento, origen, origen_lectura
    )
    select
      v_org, v_periodo, v_medidor.cliente_id, co.id, co.codigo,
      'Energía · Medidor N° ' || v_medidor.numero || ' (' || l.kwh || ' kWh)',
      l.kwh, l.precio_kwh, l.monto, 0, v_venc, 'energia', l.id
    from public.lecturas l
    join public.conceptos co on co.org_id = v_org and co.codigo = 'ENER'
    where l.id = v_lectura_id and l.monto > 0;
  end if;

  perform private.aplicar_saldo_favor(v_medidor.cliente_id);
  return v_lectura_id;
end $$;
revoke all on function public.registrar_lectura(uuid, date, numeric, numeric) from public, anon;
grant execute on function public.registrar_lectura(uuid, date, numeric, numeric) to authenticated;
comment on function public.registrar_lectura(uuid, date, numeric, numeric) is
  'M9 · Alta o corrección de la lectura de un medidor y su cargo ENER. Con cobros, lo cobrado queda hasta el monto nuevo y lo que sobra pasa a saldo a favor (0056). Sin abono (§1.2-11). Admin y Líder (J5).';

-- ------------------------------------------------------------
-- 2. Deshacer la validación de una caja (la usa reabrir_caja). Borra el ajuste por la
--    diferencia del conteo (validar_caja lo vuelve a hacer al contar de nuevo) dejando el
--    rastro en la bitácora, y una caja de administración devuelve a «integrada» las de
--    portería que se validaron con ella. El estado de p_caja lo pone quien llama.
-- ------------------------------------------------------------
create or replace function private.deshacer_validacion(p_caja uuid, p_detalle text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_caja public.cajas;
  v_mov record;
begin
  select * into v_caja from public.cajas where id = p_caja for update;
  if not found or v_caja.estado <> 'validada' then return; end if;

  for v_mov in
    select m.id, m.monto from public.movimientos_tesoreria m
    where m.caja_id = p_caja and m.tipo = 'ajuste' and m.anulado_en is null
      and m.descripcion like 'Diferencia de arqueo al validar%'
    for update
  loop
    perform private.registrar_evento_caja(p_caja, 'ajuste_borrado',
      'Ajuste de ' || private.caja_pesos(v_mov.monto)
      || ' en efectivo (diferencia del conteo al validar) borrado: se deshizo la validación');
    delete from public.movimientos_tesoreria where id = v_mov.id;
  end loop;

  update public.cajas set validada_por = null, validada_en = null where id = p_caja;
  perform private.registrar_evento_caja(p_caja, 'validacion_deshecha', p_detalle);

  if v_caja.tipo = 'administracion' then
    with devueltas as (
      update public.cajas set estado = 'integrada', validada_por = null, validada_en = null
      where caja_destino_id = p_caja and estado = 'validada'
      returning id, org_id
    )
    insert into public.caja_eventos (org_id, caja_id, tipo, detalle, usuario_id)
    select org_id, id, 'validacion_deshecha',
           'Se deshizo la validación de la caja de administración: vuelve a estar en la caja mayor',
           (select auth.uid())
    from devueltas;
  end if;
end $$;
revoke all on function private.deshacer_validacion(uuid, text) from public, anon, authenticated;
comment on function private.deshacer_validacion(uuid, text) is
  'Deshace la validación de una caja (0056): borra el ajuste del conteo y devuelve sus cajas de portería a integrada. La usa reabrir_caja.';

-- ------------------------------------------------------------
-- 3. Pedido de reapertura (0013): una caja validada no se pide (no entra en la bandeja de
--    Tesorería): se reabre directo.
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
  -- 0056: una caja validada se reabre directo (Tesorería, o Administración la suya), sin pedido.
  if v_caja.estado = 'validada' then
    raise exception 'Tesorería ya validó esta caja: pedile a Tesorería que la reabra';
  end if;
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

-- ------------------------------------------------------------
-- 4. Reabrir (0013), también una caja validada.
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
  if v_rol = 'admin' and v_caja.tipo = 'guardia' and v_caja.estado in ('integrada', 'validada') then
    raise exception 'Esta caja de portería ya entró en la caja mayor: pedile la reapertura a tesorería';
  end if;
  if v_motivo is null then v_motivo := v_caja.reapertura_motivo; end if;
  if v_motivo is null then raise exception 'Contá por qué la reabrís'; end if;

  -- 0056: una caja validada se reabre deshaciendo la validación.
  if v_caja.estado = 'validada' then
    perform private.deshacer_validacion(p_caja, v_motivo);
    -- Una de portería queda como antes de validar (así la caja mayor, abajo, no la arrastra).
    if v_caja.tipo = 'guardia' then
      update public.cajas set estado = 'integrada' where id = p_caja;
    end if;
  end if;

  -- Si estaba en la caja mayor, se desengancha. 0056: si esa caja mayor ya estaba validada,
  -- vuelve a quedar cerrada sin validar (falta contarla de nuevo sin esta caja).
  if v_caja.estado in ('integrada', 'validada') and v_caja.caja_destino_id is not null then
    select * into v_destino from public.cajas where id = v_caja.caja_destino_id for update;
    if found and v_destino.estado = 'validada' then
      perform private.deshacer_validacion(v_destino.id,
        'Se reabrió la caja de portería del ' || to_char(v_caja.fecha, 'DD/MM/YYYY')
        || ': esta caja vuelve a estar cerrada, falta validarla de nuevo · ' || v_motivo);
      update public.cajas set estado = 'cerrada' where id = v_destino.id;
      v_destino.estado := 'cerrada';
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
    validada_por = null, validada_en = null,
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
comment on function public.reabrir_caja(uuid, text) is
  'Reabre una caja cerrada, integrada o validada (0056: se deshace la validación). Administración la suya; Tesorería y el Líder cualquiera.';
