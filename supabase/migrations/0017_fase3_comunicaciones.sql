-- ============================================================
-- Mercado San Miguel — 0017 Fase 3 · M5 Comunicaciones y portal
-- Contrato: docs/FASE3-CONTRATO.md §4.8 (y §4.0 reglas transversales).
--
-- Reescribe SOLO los cuerpos de las RPC de M5 que 0012 dejó como stub, con la
-- MISMA firma (nombres, tipos, orden, defaults y retorno):
--   · public.emitir_registro(...)            → registro + multa (cargo MULT), idempotente por p_ref
--   · public.dejar_sin_efecto_multa(...)     → anula el cargo MULT si no tiene cobros, con rastro
--   · public.marcar_registro_visto(...)      → el socio abrió el detalle ("Visto" / "Respuesta nueva")
-- Y crea los triggers de registro_mensajes (hilo de descargo y respuesta):
--   · registro_mensaje_descargo  BEFORE INSERT (corre después de fijar_autor_registro: orden alfabético)
--   · registro_mensaje_estado    AFTER INSERT  (actualiza sanciones: estado y ultimo_mensaje_en)
--   Ambos con private.tg_registro_mensaje() (security definer: el socio no tiene UPDATE en sanciones).
--
-- Idempotente: se puede volver a correr. Se aplica como UNA transacción.
-- Orden de bloqueo (§4.0-1): candado de idempotencia → cliente → cargos → sanciones.
--
-- Pedidos a Fundación: ninguno (las policies de sanciones, registro_mensajes,
-- circulares y circular_recepciones de 0011/0022 alcanzan).
-- ============================================================


-- ------------------------------------------------------------
-- emitir_registro (D3, D4): notificación, apercibimiento o sanción, con multa opcional.
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
    v_venc := coalesce(p_multa_vencimiento, v_fecha + 10);
    if v_venc < v_fecha then
      raise exception 'La multa no puede vencer antes de la fecha del registro';
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
    perform private.aplicar_saldo_favor(p_cliente);
  end if;

  return jsonb_build_object(
    'id', v_id, 'numero', v_numero, 'cargo_id', v_cargo, 'multa', v_multa, 'repetido', false);
end;
$$;
revoke all on function public.emitir_registro(uuid, public.tipo_sancion, text, text, date, text, uuid, numeric, date, uuid) from public, anon;
grant execute on function public.emitir_registro(uuid, public.tipo_sancion, text, text, date, text, uuid, numeric, date, uuid) to authenticated;


-- ------------------------------------------------------------
-- dejar_sin_efecto_multa (D4): anula el cargo MULT si todavía no se cobró nada.
-- El rastro (quién, cuándo, por qué) queda en sanciones.multa_sin_efecto_* (sin grant de UPDATE).
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

  -- (c) Cliente → (d) cargo → (e) registro (§4.0-1). Un cobro en paralelo espera o ya terminó.
  perform 1 from public.clientes c where c.id = v_cliente and c.org_id = v_org for update;

  select s.id, s.cargo_id, s.multa_sin_efecto_en into v_reg
  from public.sanciones s
  where s.id = p_registro and s.org_id = v_org;
  if v_reg.cargo_id is null or v_reg.multa_sin_efecto_en is not null then
    raise exception 'Este registro no tiene una multa vigente';
  end if;

  select c.id, c.estado, c.monto_pagado into v_cargo
  from public.cargos c
  where c.id = v_reg.cargo_id and c.org_id = v_org
  for update;
  if not found then raise exception 'Este registro no tiene una multa vigente'; end if;

  if v_cargo.monto_pagado > 0 then
    raise exception 'La multa ya tiene $ % cobrados: anulá primero ese cobro desde la caja',
      replace(to_char(v_cargo.monto_pagado, 'FM999G999G999G990'), ',', '.');
  end if;

  perform 1 from public.sanciones s where s.id = p_registro for update;

  if v_cargo.estado <> 'anulado' then
    update public.cargos set estado = 'anulado' where id = v_cargo.id;
  end if;

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
-- marcar_registro_visto (§4.8): el socio abrió el detalle. Silencioso.
--   visto_en      = primera vez ("Visto por el socio el …")
--   socio_leyo_en = última vez (apaga "Respuesta nueva")
-- ------------------------------------------------------------
create or replace function public.marcar_registro_visto(p_registro uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_cliente uuid;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  if private.rol_actual() is distinct from 'socio' then
    raise exception 'Registro inexistente';
  end if;
  v_cliente := private.cliente_actual();
  if v_cliente is null then raise exception 'Registro inexistente'; end if;

  update public.sanciones s
  set visto_en = coalesce(s.visto_en, now()),
      socio_leyo_en = now()
  where s.id = p_registro and s.org_id = v_org and s.cliente_id = v_cliente;
  if not found then raise exception 'Registro inexistente'; end if;
end;
$$;
revoke all on function public.marcar_registro_visto(uuid) from public, anon;
grant execute on function public.marcar_registro_visto(uuid) to authenticated;


-- ------------------------------------------------------------
-- Hilo de descargo y respuesta (D5, D6): triggers de registro_mensajes.
-- El cliente inserta directo (RLS "escribir mensajes de registro", grant por columna:
-- org_id, registro_id, mensaje, adjunto_path); el autor lo fija fijar_autor_registro.
--   BEFORE (registro_mensaje_descargo): es_descargo = lo escribió el socio; el adjunto
--          tiene que estar en la carpeta del cliente del registro.
--   AFTER  (registro_mensaje_estado): socio → 'descargo' (y cuenta como leído);
--          staff sobre 'descargo' → 'respondido'; siempre ultimo_mensaje_en.
-- ------------------------------------------------------------
create or replace function private.tg_registro_mensaje()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_reg record;
  v_prefijo text;
begin
  if tg_when = 'BEFORE' then
    select s.org_id, s.cliente_id into v_reg
    from public.sanciones s
    where s.id = new.registro_id;
    if not found then raise exception 'Registro inexistente'; end if;

    new.es_descargo := (new.autor_rol = 'socio');
    new.mensaje := trim(coalesce(new.mensaje, ''));
    if new.mensaje = '' then raise exception 'Escribí el mensaje antes de enviarlo'; end if;
    if char_length(new.mensaje) > 4000 then
      raise exception 'El mensaje es demasiado largo (hasta 4000 letras)';
    end if;

    if new.adjunto_path is not null then
      v_prefijo := v_reg.org_id::text || '/clientes/' || v_reg.cliente_id::text || '/';
      if left(new.adjunto_path, char_length(v_prefijo)) <> v_prefijo then
        raise exception 'El adjunto no es válido: subilo de nuevo';
      end if;
    end if;
    return new;
  end if;

  -- AFTER INSERT
  if new.autor_rol = 'socio' then
    update public.sanciones s
    set estado = 'descargo',
        ultimo_mensaje_en = new.creado_en,
        visto_en = coalesce(s.visto_en, new.creado_en),
        socio_leyo_en = greatest(s.socio_leyo_en, new.creado_en)
    where s.id = new.registro_id;
  else
    update public.sanciones s
    set estado = case when s.estado = 'descargo' then 'respondido'::public.estado_registro else s.estado end,
        ultimo_mensaje_en = new.creado_en
    where s.id = new.registro_id;
  end if;
  return null;
end;
$$;
revoke all on function private.tg_registro_mensaje() from public, anon;

drop trigger if exists registro_mensaje_descargo on public.registro_mensajes;
create trigger registro_mensaje_descargo before insert on public.registro_mensajes
  for each row execute function private.tg_registro_mensaje();

drop trigger if exists registro_mensaje_estado on public.registro_mensajes;
create trigger registro_mensaje_estado after insert on public.registro_mensajes
  for each row execute function private.tg_registro_mensaje();
