-- ============================================================
-- Mercado San Miguel — 0025 Fase 3 · Correcciones de Comunicaciones (M5)
-- Contrato: docs/FASE3-CONTRATO.md §4.8 (y §4.0 reglas transversales).
-- Va DESPUÉS de 0023 (usa imputaciones.origen; ver sección 0). Idempotente: se puede
-- volver a correr. UNA transacción.
--
-- 1. emitir_registro: la multa nunca nace vencida. Sin vencimiento elegido vence a los
--    10 días de HOY (o de la fecha del hecho, la que sea más tarde) y no se acepta un
--    vencimiento anterior a hoy. Antes, un apercibimiento cargado hoy por algo de hace
--    dos semanas creaba el cargo MULT ya vencido y el semáforo del socio se ponía rojo.
--    Misma firma, mismo retorno.
-- 2. dejar_sin_efecto_multa: si la multa se cubrió sola con saldo a favor (lo que
--    aplicar_saldo_favor imputó, origen 'saldo_favor' de 0023, o pagos ANTERIORES a la
--    multa en filas viejas, de antes de 0023, sin creado_en), ese crédito vuelve al
--    cliente: se borran esas imputaciones
--    (los pagos y la caja no cambian), el cargo queda anulado y el crédito liberado se
--    aplica a sus otras deudas o le queda a favor. Lo cobrado en caja PARA la multa
--    (imputado en el cobro, después de emitirla) sigue exigiendo anular ese cobro primero
--    (D4). Misma firma, mismo retorno.
-- 3. circulares.ref: clave de idempotencia de la publicación. Si se corta el wifi y el
--    Líder toca "Publicar" de nuevo, no sale una segunda circular obligatoria.
-- 4. registro_mensajes.ref: ídem para el descargo del socio y la respuesta del staff
--    (un reintento no duplica el mensaje en el hilo).
--
-- Orden de bloqueo (§4.0-1): candado de idempotencia → cliente → cargos → sanciones.
-- ============================================================


-- ------------------------------------------------------------
-- 0. imputaciones.origen y imputaciones.creado_en los crea 0023 (origen con su check;
--    creado_en null en las filas viejas y now() en las nuevas). Red de seguridad por si
--    esta migración corre sin 0023: las columnas existen (origen con el mismo default
--    'cobro'; creado_en sin default, así todo queda como "fila vieja") y
--    dejar_sin_efecto_multa usa entonces solo el criterio de fecha (pagos anteriores a la
--    multa). Si 0023 ya corrió, no hace nada.
-- ------------------------------------------------------------
alter table public.imputaciones add column if not exists origen text not null default 'cobro';
alter table public.imputaciones add column if not exists creado_en timestamptz;


-- ------------------------------------------------------------
-- 1. emitir_registro (D3, D4) — cuerpo de 0017 con el vencimiento corregido.
-- ------------------------------------------------------------
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
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
  v_titulo text := nullif(trim(coalesce(p_titulo, '')), '');
  v_detalle text := nullif(trim(coalesce(p_detalle, '')), '');
  v_prefijo text;
  v_fecha date;
  v_venc date;
  v_multa numeric;
  v_existente public.sanciones%rowtype;
  v_cliente record;
  v_concepto uuid;
  v_id uuid;
  v_numero bigint;
  v_cargo uuid;
  v_label_tipo text;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('admin', 'lider') then
    raise exception 'No tenés permiso para emitir registros sobre este cliente';
  end if;

  -- (a) Idempotencia (§4.0-5): doble toque = UN registro y UNA multa.
  if p_ref is not null then
    perform pg_advisory_xact_lock(hashtextextended('emitir_registro:' || p_ref::text, 0));
    select * into v_existente from public.sanciones s where s.org_id = v_org and s.ref = p_ref;
    if found then
      if v_existente.cliente_id <> p_cliente then
        raise exception 'Ese registro ya se emitió para otro cliente';
      end if;
      return jsonb_build_object(
        'id', v_existente.id, 'numero', v_existente.numero, 'cargo_id', v_existente.cargo_id,
        'multa', v_existente.multa, 'repetido', true);
    end if;
  end if;

  -- (c) Cliente de la org, bloqueado antes de crear el cargo (§4.0-2).
  select c.id, c.activo into v_cliente
  from public.clientes c
  where c.id = p_cliente and c.org_id = v_org
  for update;
  if not found or not v_cliente.activo then
    raise exception 'Cliente inexistente o dado de baja';
  end if;
  if not private.puede_gestionar_cliente(p_cliente) then
    raise exception 'No tenés permiso para emitir registros sobre este cliente';
  end if;

  -- Validaciones (todas antes de escribir).
  if p_tipo is null then raise exception 'Elegí si es notificación, apercibimiento o sanción'; end if;
  if v_titulo is null then raise exception 'Poné un título (ej.: Falta de limpieza del puesto)'; end if;
  if char_length(v_titulo) > 200 then raise exception 'El título es demasiado largo (hasta 200 letras)'; end if;
  if v_detalle is not null and char_length(v_detalle) > 8000 then
    raise exception 'El detalle es demasiado largo';
  end if;

  v_fecha := coalesce(p_fecha, v_hoy);
  if v_fecha > v_hoy then raise exception 'La fecha del registro no puede ser futura'; end if;

  if p_espacio is not null and not exists (
    select 1 from public.espacios e
    where e.id = p_espacio and e.org_id = v_org and e.cliente_id = p_cliente
  ) then
    raise exception 'Ese puesto no es de este cliente';
  end if;

  v_prefijo := v_org::text || '/clientes/' || p_cliente::text || '/';
  if p_storage_path is not null and left(p_storage_path, char_length(v_prefijo)) <> v_prefijo then
    raise exception 'El documento adjunto no es válido: subilo de nuevo';
  end if;

  if p_multa is not null then
    if p_tipo = 'notificacion' then raise exception 'Las notificaciones no llevan multa'; end if;
    v_multa := round(p_multa, 2);
    if v_multa <= 0 then raise exception 'La multa tiene que ser mayor a cero'; end if;
    -- El socio se entera HOY: el plazo corre desde hoy aunque el hecho sea de antes.
    v_venc := coalesce(p_multa_vencimiento, greatest(v_fecha, v_hoy) + 10);
    if v_venc < v_fecha then
      raise exception 'La multa no puede vencer antes de la fecha del registro';
    end if;
    if v_venc < v_hoy then
      raise exception 'La multa no puede vencer antes de hoy: elegí una fecha de hoy en adelante';
    end if;
    select co.id into v_concepto
    from public.conceptos co
    where co.org_id = v_org and co.codigo = 'MULT' and co.activo;
    if v_concepto is null then
      raise exception 'Falta el concepto MULT (Multas) en Configuración';
    end if;
  end if;

  -- (e) El registro. Red de seguridad de la idempotencia: sanciones_ref_unq.
  begin
    insert into public.sanciones (org_id, cliente_id, tipo, titulo, detalle, fecha, storage_path,
                                  espacio_id, creado_por, estado, ref)
    values (v_org, p_cliente, p_tipo, v_titulo, v_detalle, v_fecha, p_storage_path,
            p_espacio, (select auth.uid()), 'notificado', p_ref)
    returning id, numero into v_id, v_numero;
  exception when unique_violation then
    select * into v_existente from public.sanciones s where s.org_id = v_org and s.ref = p_ref;
    if not found then raise; end if;
    if v_existente.cliente_id <> p_cliente then
      raise exception 'Ese registro ya se emitió para otro cliente';
    end if;
    return jsonb_build_object(
      'id', v_existente.id, 'numero', v_existente.numero, 'cargo_id', v_existente.cargo_id,
      'multa', v_existente.multa, 'repetido', true);
  end;

  -- Multa (D4): cargo MULT en la cuenta del cliente.
  if v_multa is not null then
    v_label_tipo := case p_tipo when 'sancion' then 'Sanción' else 'Apercibimiento' end;
    insert into public.cargos (org_id, periodo, cliente_id, concepto_id, codigo, descripcion, cantidad,
                               precio_unitario, monto, descuento_pronto_pago, vencimiento, origen)
    values (v_org, date_trunc('month', v_fecha)::date, p_cliente, v_concepto, 'MULT',
            left('Multa · ' || v_label_tipo || ' N° ' || v_numero || ' · ' || v_titulo, 300),
            1, v_multa, v_multa, 0, v_venc, 'multa')
    returning id into v_cargo;

    update public.sanciones
    set multa = v_multa, multa_vencimiento = v_venc, cargo_id = v_cargo
    where id = v_id;

    -- Si tenía crédito a favor, va primero a sus deudas (incluida esta multa).
    -- dejar_sin_efecto_multa lo devuelve si la multa se anula.
    perform private.aplicar_saldo_favor(p_cliente);
  end if;

  return jsonb_build_object(
    'id', v_id, 'numero', v_numero, 'cargo_id', v_cargo, 'multa', v_multa, 'repetido', false);
end;
$$;
revoke all on function public.emitir_registro(uuid, public.tipo_sancion, text, text, date, text, uuid, numeric, date, uuid) from public, anon;
grant execute on function public.emitir_registro(uuid, public.tipo_sancion, text, text, date, text, uuid, numeric, date, uuid) to authenticated;


-- ------------------------------------------------------------
-- 2. dejar_sin_efecto_multa (D4): anula el cargo MULT.
--    · Crédito a favor que se le aplicó solo: imputaciones con origen 'saldo_favor'
--      (aplicar_saldo_favor, 0023: al emitirla o después, con el sobrante de un cobro)
--      o, en filas anteriores a 0023 (creado_en null y origen 'cobro' por defecto), las de
--      pagos ANTERIORES a la multa. Se devuelve (se borran esas imputaciones; pagos y
--      cajas intactos) y se vuelve a aplicar a sus otras deudas, o le queda a favor.
--      El recibo de esos pagos no mostraba la multa (solo muestra origen 'cobro').
--    · Plata cobrada para la multa (imputación nueva con origen 'cobro', aunque el pago
--      tenga fecha apenas anterior a la multa por una carrera con emitir_registro): hay
--      que anular ese cobro primero, como pide D4.
--    El rastro (quién, cuándo, por qué) queda en sanciones.multa_sin_efecto_* (sin grant).
-- ------------------------------------------------------------
create or replace function public.dejar_sin_efecto_multa(p_registro uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
  v_cliente uuid;
  v_reg record;
  v_cargo record;
  v_credito numeric := 0;
  v_cobrado numeric := 0;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if v_rol is null or v_rol not in ('admin', 'lider') then
    raise exception 'No tenés permiso para dejar sin efecto multas';
  end if;
  if v_motivo is null then raise exception 'Contá por qué la multa queda sin efecto'; end if;
  if char_length(v_motivo) > 2000 then raise exception 'El motivo es demasiado largo'; end if;

  select s.cliente_id into v_cliente
  from public.sanciones s
  where s.id = p_registro and s.org_id = v_org;
  if v_cliente is null then raise exception 'Registro inexistente'; end if;
  if not private.puede_gestionar_cliente(v_cliente) then
    raise exception 'No tenés permiso sobre los registros de este cliente';
  end if;

  -- (c) Cliente → (d) cargos → (e) registro (§4.0-1). Un cobro en paralelo espera o ya terminó.
  perform 1 from public.clientes c where c.id = v_cliente and c.org_id = v_org for update;

  select s.id, s.cargo_id, s.multa_sin_efecto_en into v_reg
  from public.sanciones s
  where s.id = p_registro and s.org_id = v_org;
  if v_reg.cargo_id is null or v_reg.multa_sin_efecto_en is not null then
    raise exception 'Este registro no tiene una multa vigente';
  end if;

  select c.id, c.estado, c.monto_pagado, c.creado_en into v_cargo
  from public.cargos c
  where c.id = v_reg.cargo_id and c.org_id = v_org
  for update;
  if not found then raise exception 'Este registro no tiene una multa vigente'; end if;

  -- Lo que se tomó solo del saldo a favor: lo que imputó aplicar_saldo_favor (0023) o,
  -- en filas viejas (de antes de 0023: creado_en null y origen 'cobro' por defecto), pagos
  -- hechos ANTES de la multa. Una imputación nueva con origen 'cobro' es SIEMPRE un cobro
  -- de caja para la multa, aunque el pago tenga fecha anterior (un cobro que arrancó justo
  -- antes de emitirse la multa y la alcanzó al tomar el candado del cliente): ese sigue
  -- exigiendo anular el cobro (D4), porque su recibo la muestra pagada.
  select coalesce(sum(i.monto), 0) into v_credito
  from public.imputaciones i
  join public.pagos p on p.id = i.pago_id
  where i.cargo_id = v_cargo.id
    and (i.origen = 'saldo_favor' or (i.creado_en is null and p.fecha < v_cargo.creado_en));

  -- El resto se cobró en caja para la multa: ese cobro se anula primero (D4).
  v_cobrado := round(v_cargo.monto_pagado - v_credito, 2);
  if v_cobrado > 0.009 then
    raise exception 'La multa ya tiene $ % cobrados: anulá primero ese cobro desde la caja',
      replace(to_char(v_cobrado, 'FM999G999G999G990'), ',', '.');
  end if;

  if v_credito > 0 then
    delete from public.imputaciones i
    using public.pagos p
    where i.cargo_id = v_cargo.id and p.id = i.pago_id
      and (i.origen = 'saldo_favor' or (i.creado_en is null and p.fecha < v_cargo.creado_en));
  end if;

  update public.cargos
  set estado = 'anulado', monto_pagado = 0, descuento_aplicado = 0
  where id = v_cargo.id;

  -- El crédito liberado va a sus otras deudas; lo que sobre le queda a favor.
  if v_credito > 0 then
    perform private.aplicar_saldo_favor(v_cliente);
  end if;

  perform 1 from public.sanciones s where s.id = p_registro for update;

  update public.sanciones
  set multa_sin_efecto_en = now(),
      multa_sin_efecto_por = (select auth.uid()),
      multa_sin_efecto_motivo = v_motivo
  where id = p_registro;
end;
$$;
revoke all on function public.dejar_sin_efecto_multa(uuid, text) from public, anon;
grant execute on function public.dejar_sin_efecto_multa(uuid, text) to authenticated;


-- ------------------------------------------------------------
-- 3. circulares.ref — idempotencia de "Publicar" (alta directa con RLS admin/lider).
--    La UI manda un uuid por intento y lo conserva si falla: el reintento encuentra la
--    circular ya publicada (crearCircular la devuelve con "repetido") en vez de duplicarla.
-- ------------------------------------------------------------
alter table public.circulares add column if not exists ref uuid;
create unique index if not exists circulares_ref_unq on public.circulares (org_id, ref) where ref is not null;
comment on column public.circulares.ref is
  'Clave de idempotencia de la publicación (uuid por intento desde la UI): un reintento no duplica la circular.';


-- ------------------------------------------------------------
-- 4. registro_mensajes.ref — idempotencia del mensaje del hilo (descargo del socio o
--    respuesta del staff). Un reintento con la misma clave choca con el índice (23505)
--    y la acción lo toma como "ya enviado": no se duplica el mensaje ni el cambio de estado.
-- ------------------------------------------------------------
alter table public.registro_mensajes add column if not exists ref uuid;
create unique index if not exists registro_mensajes_ref_unq
  on public.registro_mensajes (registro_id, ref) where ref is not null;
comment on column public.registro_mensajes.ref is
  'Clave de idempotencia del mensaje (uuid por intento desde la UI): un reintento no lo duplica.';
grant insert (ref) on public.registro_mensajes to authenticated;
