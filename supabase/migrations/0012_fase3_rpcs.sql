-- ============================================================
-- Mercado San Miguel — 0012 Fase 3: RPC nuevas (stubs) y cambios de firma
-- Contrato: docs/FASE3-CONTRATO.md §4.
--
-- Requiere 0010 y 0011 aplicadas. Se aplica como UNA transacción.
--
-- 1) Toda RPC nueva se crea acá con su FIRMA FINAL (nombres, tipos, orden y
--    defaults de los parámetros + tipo de retorno) y un cuerpo stub. Así los
--    tipos TS se regeneran UNA vez. Cada módulo dueño reescribe SOLO el cuerpo
--    con `create or replace` en su archivo 0013…0021_fase3_<modulo>.sql
--    (contrato §0.1), SIN cambiar la firma (puede cambiar volatilidad, lenguaje
--    y cuerpo).
-- 2) Las funciones existentes cuya firma cambia (validar_caja, editar_espacio)
--    se recrean con la firma nueva y el comportamiento VIEJO: los parámetros
--    nuevos se ignoran hasta que el módulo dueño los implemente. Se borra la
--    firma vieja para que PostgREST no vea dos sobrecargas.
-- 3) Patrón de permisos: security definer, search_path = '', revoke de
--    public/anon, grant execute a authenticated (las default privileges del
--    schema public le dan EXECUTE a anon a toda función nueva: hay que revocar).
-- ============================================================


-- ============================================================
-- M1 · Cobranza
-- ============================================================

-- Cobro mixto (A1, A2, G2, G8, J1). Ver contrato §4.1.
create or replace function public.registrar_cobro(
  p_cliente uuid,
  p_caja uuid,
  p_lineas jsonb,
  p_notas text default null,
  p_permitir_saldo_favor boolean default false,
  p_lote uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Pendiente de implementar: registrar_cobro';
end $$;
revoke all on function public.registrar_cobro(uuid, uuid, jsonb, text, boolean, uuid) from public, anon;
grant execute on function public.registrar_cobro(uuid, uuid, jsonb, text, boolean, uuid) to authenticated;

-- Cobro por días del ambulante: crea el cargo AMB y lo paga en el acto (G5, G6). Ver §4.2.
create or replace function public.cobrar_diario(
  p_cliente uuid,
  p_caja uuid,
  p_dias integer,
  p_lineas jsonb,
  p_desde date default null,
  p_notas text default null,
  p_lote uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Pendiente de implementar: cobrar_diario';
end $$;
revoke all on function public.cobrar_diario(uuid, uuid, integer, jsonb, date, text, uuid) from public, anon;
grant execute on function public.cobrar_diario(uuid, uuid, integer, jsonb, date, text, uuid) to authenticated;

-- Datos del recibo de un lote completo, para el staff y para el socio dueño (B1). Ver §4.3.
create or replace function public.datos_recibo(p_pago uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  raise exception 'Pendiente de implementar: datos_recibo';
end $$;
revoke all on function public.datos_recibo(uuid) from public, anon;
grant execute on function public.datos_recibo(uuid) to authenticated;


-- ============================================================
-- M2 · Cajas
-- ============================================================

-- Arqueo en vivo (la ÚNICA fórmula vive en SQL). Ver §4.5.
create or replace function public.arqueo_caja(p_caja uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  raise exception 'Pendiente de implementar: arqueo_caja';
end $$;
revoke all on function public.arqueo_caja(uuid) from public, anon;
grant execute on function public.arqueo_caja(uuid) to authenticated;

-- Ajuste de tesorería sobre una caja del día (J3). Ver §4.5. p_ref = idempotencia (doble toque).
create or replace function public.registrar_ajuste_caja(
  p_caja uuid,
  p_cuenta public.cuenta_tesoreria,
  p_monto numeric,
  p_motivo text,
  p_ref uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Pendiente de implementar: registrar_ajuste_caja';
end $$;
revoke all on function public.registrar_ajuste_caja(uuid, public.cuenta_tesoreria, numeric, text, uuid) from public, anon;
grant execute on function public.registrar_ajuste_caja(uuid, public.cuenta_tesoreria, numeric, text, uuid) to authenticated;

-- Borrar un ajuste deja rastro en la bitácora: el motivo es obligatorio (sin default).
create or replace function public.borrar_ajuste_caja(p_ajuste uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Pendiente de implementar: borrar_ajuste_caja';
end $$;
revoke all on function public.borrar_ajuste_caja(uuid, text) from public, anon;
grant execute on function public.borrar_ajuste_caja(uuid, text) to authenticated;

-- validar_caja: firma nueva con p_efectivo_contado (J3). Comportamiento VIEJO hasta que M2
-- lo implemente (p_efectivo_contado se ignora). La app de fase 2 lo llama con
-- {p_caja, p_observaciones} y sigue funcionando.
drop function if exists public.validar_caja(uuid, text);
create or replace function public.validar_caja(
  p_caja uuid,
  p_observaciones text default null,
  p_efectivo_contado numeric default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_caja public.cajas;
begin
  if private.rol_actual() <> 'tesoreria' then
    raise exception 'Solo tesorería puede validar cajas';
  end if;
  select * into v_caja from public.cajas where id = p_caja and org_id = v_org for update;
  if not found then raise exception 'Caja inexistente'; end if;
  if v_caja.estado not in ('cerrada','integrada') then
    raise exception 'Solo se validan cajas cerradas';
  end if;
  update public.cajas set
    estado = 'validada',
    validada_por = (select auth.uid()),
    validada_en = now(),
    observaciones = coalesce(p_observaciones, observaciones),
    reapertura_solicitada_en = null, reapertura_solicitada_por = null, reapertura_motivo = null
  where id = p_caja;
  perform private.registrar_evento_caja(p_caja, 'validacion', p_observaciones);

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


-- ============================================================
-- M3 · Portería (canon de transporte / bono camioneros)
-- ============================================================

create or replace function public.registrar_canon(
  p_tarifa uuid,
  p_cantidad integer default 1,
  p_medio public.medio_pago default 'efectivo',
  p_patente text default null,
  p_destino text default null,
  p_destino_detalle text default null,
  p_notas text default null,
  p_ref uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Pendiente de implementar: registrar_canon';
end $$;
revoke all on function public.registrar_canon(uuid, integer, public.medio_pago, text, text, text, text, uuid) from public, anon;
grant execute on function public.registrar_canon(uuid, integer, public.medio_pago, text, text, text, text, uuid) to authenticated;

create or replace function public.anular_canon(p_canon uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Pendiente de implementar: anular_canon';
end $$;
revoke all on function public.anular_canon(uuid, text) from public, anon;
grant execute on function public.anular_canon(uuid, text) to authenticated;

create or replace function public.estado_caja_porteria()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  raise exception 'Pendiente de implementar: estado_caja_porteria';
end $$;
revoke all on function public.estado_caja_porteria() from public, anon;
grant execute on function public.estado_caja_porteria() to authenticated;

create or replace function public.resumen_canon(p_desde date, p_hasta date)
returns table (
  tarifa text,
  unidad text,
  entradas bigint,
  cantidad bigint,
  monto numeric,
  efectivo numeric,
  transferencia numeric
)
language plpgsql stable security definer set search_path = '' as $$
begin
  raise exception 'Pendiente de implementar: resumen_canon';
end $$;
revoke all on function public.resumen_canon(date, date) from public, anon;
grant execute on function public.resumen_canon(date, date) to authenticated;


-- ============================================================
-- M4 · Clientes
-- ============================================================

create or replace function public.siguiente_codigo_cliente()
returns integer
language plpgsql stable security definer set search_path = '' as $$
begin
  raise exception 'Pendiente de implementar: siguiente_codigo_cliente';
end $$;
revoke all on function public.siguiente_codigo_cliente() from public, anon;
grant execute on function public.siguiente_codigo_cliente() to authenticated;


-- ============================================================
-- M5 · Comunicaciones y portal
-- ============================================================

create or replace function public.emitir_registro(
  p_cliente uuid,
  p_tipo public.tipo_sancion,
  p_titulo text,
  p_detalle text default null,
  p_fecha date default null,
  p_storage_path text default null,
  p_espacio uuid default null,
  p_multa numeric default null,
  p_multa_vencimiento date default null,
  p_ref uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Pendiente de implementar: emitir_registro';
end $$;
revoke all on function public.emitir_registro(uuid, public.tipo_sancion, text, text, date, text, uuid, numeric, date, uuid) from public, anon;
grant execute on function public.emitir_registro(uuid, public.tipo_sancion, text, text, date, text, uuid, numeric, date, uuid) to authenticated;

create or replace function public.dejar_sin_efecto_multa(p_registro uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Pendiente de implementar: dejar_sin_efecto_multa';
end $$;
revoke all on function public.dejar_sin_efecto_multa(uuid, text) from public, anon;
grant execute on function public.dejar_sin_efecto_multa(uuid, text) to authenticated;

create or replace function public.marcar_registro_visto(p_registro uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Pendiente de implementar: marcar_registro_visto';
end $$;
revoke all on function public.marcar_registro_visto(uuid) from public, anon;
grant execute on function public.marcar_registro_visto(uuid) to authenticated;


-- ============================================================
-- M6 · Tesorería, gastos y cheques
-- ============================================================

create or replace function public.pagar_gasto(
  p_gasto uuid,
  p_origen text,
  p_medio public.medio_pago default 'efectivo',
  p_fecha date default null,
  p_caja uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Pendiente de implementar: pagar_gasto';
end $$;
revoke all on function public.pagar_gasto(uuid, text, public.medio_pago, date, uuid) from public, anon;
grant execute on function public.pagar_gasto(uuid, text, public.medio_pago, date, uuid) to authenticated;

create or replace function public.revertir_pago_gasto(p_gasto uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Pendiente de implementar: revertir_pago_gasto';
end $$;
revoke all on function public.revertir_pago_gasto(uuid, text) from public, anon;
grant execute on function public.revertir_pago_gasto(uuid, text) to authenticated;

create or replace function public.replicar_gastos_fijos(
  p_desde_periodo date,
  p_hasta_periodo date,
  p_items jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Pendiente de implementar: replicar_gastos_fijos';
end $$;
revoke all on function public.replicar_gastos_fijos(date, date, jsonb) from public, anon;
grant execute on function public.replicar_gastos_fijos(date, date, jsonb) to authenticated;

create or replace function public.entregar_cheque(
  p_cheque uuid,
  p_proveedor text,
  p_fecha date default null,
  p_gasto uuid default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Pendiente de implementar: entregar_cheque';
end $$;
revoke all on function public.entregar_cheque(uuid, text, date, uuid) from public, anon;
grant execute on function public.entregar_cheque(uuid, text, date, uuid) to authenticated;

-- Cheque que nació "Entregado a proveedor" en el cobro → Tesorería dice qué gasto pagó (§4.9).
create or replace function public.vincular_cheque_gasto(p_cheque uuid, p_gasto uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Pendiente de implementar: vincular_cheque_gasto';
end $$;
revoke all on function public.vincular_cheque_gasto(uuid, uuid) from public, anon;
grant execute on function public.vincular_cheque_gasto(uuid, uuid) to authenticated;


-- ============================================================
-- M7 · Personal, novedades y solicitudes
-- ============================================================

create or replace function public.revisar_novedad(
  p_novedad uuid,
  p_aprobar boolean,
  p_motivo text default null
) returns public.estado_novedad
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Pendiente de implementar: revisar_novedad';
end $$;
revoke all on function public.revisar_novedad(uuid, boolean, text) from public, anon;
grant execute on function public.revisar_novedad(uuid, boolean, text) to authenticated;

create or replace function public.aprobar_novedades(p_ids uuid[])
returns integer
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Pendiente de implementar: aprobar_novedades';
end $$;
revoke all on function public.aprobar_novedades(uuid[]) from public, anon;
grant execute on function public.aprobar_novedades(uuid[]) to authenticated;

create or replace function public.anular_novedad(p_novedad uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Pendiente de implementar: anular_novedad';
end $$;
revoke all on function public.anular_novedad(uuid, text) from public, anon;
grant execute on function public.anular_novedad(uuid, text) to authenticated;

create or replace function public.resumen_novedades(p_periodo date)
returns table (
  empleado_id uuid,
  apellido text,
  nombre text,
  dni text,
  sector public.sector_personal,
  activo boolean,
  horas_semanales numeric,
  horas_esperadas numeric,
  horas_registradas numeric,
  ingresos integer,
  ingresos_sin_salida integer,
  faltas integer,
  faltas_injustificadas integer,
  llegadas_tarde integer,
  horas_tarde numeric,
  feriados_trabajados integer,
  horas_feriado numeric,
  dias_vacaciones integer,
  dias_licencia integer,
  horas_extra numeric,
  otras integer,
  pendientes integer
)
language plpgsql stable security invoker set search_path = '' as $$
begin
  raise exception 'Pendiente de implementar: resumen_novedades';
end $$;
revoke all on function public.resumen_novedades(date) from public, anon;
grant execute on function public.resumen_novedades(date) to authenticated;


-- ============================================================
-- M8 · Accesos (login por DNI, configuración del Jefe)
-- ============================================================

-- DNI → email de login. SOLO service role (el server action del login); nunca authenticated/anon:
-- no hay endpoint público de enumeración de usuarios.
create or replace function public.email_para_login(p_dni text)
returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  raise exception 'Pendiente de implementar: email_para_login';
end $$;
revoke all on function public.email_para_login(text) from public, anon, authenticated;
grant execute on function public.email_para_login(text) to service_role;

create or replace function public.guardar_cuotas_quinteros(p_cuotas integer)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Pendiente de implementar: guardar_cuotas_quinteros';
end $$;
revoke all on function public.guardar_cuotas_quinteros(integer) from public, anon;
grant execute on function public.guardar_cuotas_quinteros(integer) to authenticated;

-- Candado de las acciones de usuarios que corren con el service role (auth.admin.*: resetear
-- contraseña, banear/desbanear sesión). La server action la llama PRIMERO con el cliente del
-- usuario; si no tira error, recién ahí usa el cliente admin. Devuelve el rol del objetivo (§4.11).
create or replace function public.autorizar_gestion_usuario(p_user uuid, p_accion text)
returns public.rol_usuario
language plpgsql stable security definer set search_path = '' as $$
begin
  raise exception 'Pendiente de implementar: autorizar_gestion_usuario';
end $$;
revoke all on function public.autorizar_gestion_usuario(uuid, text) from public, anon;
grant execute on function public.autorizar_gestion_usuario(uuid, text) to authenticated;


-- ============================================================
-- M9 · Mapa
-- ============================================================

-- editar_espacio: firma nueva con p_propio (C3). Comportamiento VIEJO hasta que M9 lo
-- implemente (p_propio se ignora). La app de fase 2 lo llama con 4 parámetros nombrados
-- y sigue funcionando (p_propio tiene default).
drop function if exists public.editar_espacio(uuid, text, boolean, text);
create or replace function public.editar_espacio(
  p_espacio uuid,
  p_numero text,
  p_medio boolean,
  p_nota text,
  p_propio boolean default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_numero text := nullif(trim(coalesce(p_numero, '')), '');
  v_nota text := nullif(trim(coalesce(p_nota, '')), '');
  v_tipo text;
begin
  if v_org is null or not private.tiene_rol(v_org, array['admin','lider']::public.rol_usuario[]) then
    raise exception 'Solo Administración y el Líder de Procesos editan el plano';
  end if;
  select tipo into v_tipo from public.espacios where id = p_espacio and org_id = v_org for update;
  if not found then
    raise exception 'El puesto no existe. Recargá la página y probá de nuevo';
  end if;
  if length(v_numero) > 12 then
    raise exception 'El número puede tener hasta 12 caracteres';
  end if;
  if length(v_nota) > 60 then
    raise exception 'La nota puede tener hasta 60 caracteres';
  end if;

  update public.espacios
     set numero = v_numero,
         medio = coalesce(p_medio, false) and v_tipo = 'puesto',
         nota = v_nota,
         actualizado_por = (select auth.uid()),
         actualizado_en = now()
   where id = p_espacio;
end $$;
revoke all on function public.editar_espacio(uuid, text, boolean, text, boolean) from public, anon;
grant execute on function public.editar_espacio(uuid, text, boolean, text, boolean) to authenticated;


-- ============================================================
-- Fundación (completas, congeladas: ningún módulo las modifica)
-- ============================================================

-- Plano sin datos de clientes (G11, H2, H3): el Jefe de Portería, Portería y Tesorería eligen o
-- validan "Puesto 58" sin leer espacios.cliente_id ni espacios.nota (0022 les saca la lectura
-- directa de la tabla a guardia y porteria). Mismo orden y tipos que la tabla.
create or replace function public.espacios_del_plano()
returns table (
  id uuid,
  tipo text,
  numero text,
  medio boolean,
  propio boolean,
  grupo text,
  x numeric,
  y numeric,
  w numeric,
  h numeric
)
language sql stable security definer set search_path = '' as $$
  select e.id, e.tipo, e.numero, e.medio, e.propio, e.grupo, e.x, e.y, e.w, e.h
  from public.espacios e
  where e.org_id = (select private.org_actual())
    and (select private.tiene_rol(private.org_actual(),
           array['admin','guardia','porteria','tesoreria','lider','consejo']::public.rol_usuario[]))
  order by e.tipo, e.numero
$$;
revoke all on function public.espacios_del_plano() from public, anon;
grant execute on function public.espacios_del_plano() to authenticated;

-- Saldo a favor: MISMO algoritmo que hoy + bloqueo de la fila del cliente ANTES de calcular el
-- crédito de cada pago. Sin el bloqueo, generar_periodo / emitir_registro / registrar_cobro del
-- mismo cliente en paralelo podían imputar dos veces el mismo crédito (Σ imputaciones > pago).
-- Orden de bloqueo de toda la fase 3 (contrato §4.0): caja → cliente → cargos.
create or replace function private.aplicar_saldo_favor(p_cliente uuid)
returns numeric
language plpgsql security definer set search_path = '' as $$
declare
  v_hoy date := private.hoy_ar();
  v_org uuid;
  v_pago record;
  v_cargo record;
  v_restante numeric;
  v_objetivo numeric;
  v_saldo numeric;
  v_aplicar numeric;
  v_total numeric := 0;
begin
  select org_id into v_org from public.clientes where id = p_cliente for update;
  if v_org is null then return 0; end if;

  for v_pago in
    select p.id, p.monto - coalesce((select sum(i.monto) from public.imputaciones i where i.pago_id = p.id), 0) as credito
    from public.pagos p
    where p.cliente_id = p_cliente and not p.anulado
    order by p.fecha asc
  loop
    continue when v_pago.credito <= 0.009;
    v_restante := round(v_pago.credito, 2);

    for v_cargo in
      select c.id, c.monto, c.monto_pagado, c.descuento_pronto_pago, c.vencimiento
      from public.cargos c
      join public.conceptos co on co.id = c.concepto_id
      where c.cliente_id = p_cliente and c.estado in ('pendiente','parcial')
      order by c.periodo asc, co.orden_imputacion asc, c.creado_en asc
      for update of c
    loop
      exit when v_restante <= 0;
      v_objetivo := case when v_hoy <= v_cargo.vencimiento
        then round(v_cargo.monto * (1 - v_cargo.descuento_pronto_pago / 100.0), 2)
        else v_cargo.monto end;
      v_saldo := v_objetivo - v_cargo.monto_pagado;
      continue when v_saldo <= 0;
      v_aplicar := least(v_restante, v_saldo);

      insert into public.imputaciones (org_id, pago_id, cargo_id, monto)
      values (v_org, v_pago.id, v_cargo.id, v_aplicar);

      update public.cargos set
        monto_pagado = monto_pagado + v_aplicar,
        descuento_aplicado = case
          when v_aplicar = v_saldo and v_hoy <= vencimiento then monto - v_objetivo
          else descuento_aplicado end,
        estado = case when v_aplicar = v_saldo then 'pagado'::public.estado_cargo else 'parcial'::public.estado_cargo end
      where id = v_cargo.id;

      v_restante := v_restante - v_aplicar;
      v_total := v_total + v_aplicar;
    end loop;
    exit when v_restante > 0;
  end loop;
  return v_total;
end;
$$;
