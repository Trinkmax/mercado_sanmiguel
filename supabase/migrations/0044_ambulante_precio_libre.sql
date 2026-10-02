-- ============================================================
-- 0044 · Ambulantes: el precio por día se pone en cada cobro (sin precio predefinido).
--
-- cobrar_diario recibe p_precio (opcional, al final): lo que paga por día ese ambulante,
-- escrito por quien cobra. Total = días × precio. El concepto AMB queda solo como el
-- concepto donde se registra el cargo (apagado, frena los cobros como antes). Sin p_precio se usa el precio de
-- AMB como antes, así la versión anterior de la app sigue andando durante el deploy.
-- Cambia la firma: se borra la vieja y se recrea con los mismos permisos.
-- ============================================================

drop function if exists public.cobrar_diario(uuid, uuid, integer, jsonb, date, text, uuid);

CREATE OR REPLACE FUNCTION public.cobrar_diario(p_cliente uuid, p_caja uuid, p_dias integer, p_lineas jsonb, p_desde date DEFAULT NULL::date, p_notas text DEFAULT NULL::text, p_lote uuid DEFAULT NULL::uuid, p_precio numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_hoy date := private.hoy_ar();
  v_yo uuid := (select auth.uid());
  v_caja public.cajas;
  v_cli public.clientes;
  v_amb public.conceptos;
  v_precio numeric;
  v_lote uuid := coalesce(p_lote, gen_random_uuid());
  v_otro uuid;
  v_otro_org uuid;
  v_desde date;
  v_hasta date;
  v_choque record;
  v_total numeric;
  v_suma numeric := 0;
  v_cargo_id uuid;
  v_numero bigint;
  v_l jsonb;
  v_txt text;
  v_n smallint := 0;
  v_medio public.medio_pago;
  v_monto numeric;
  v_path text;
  v_pago_id uuid;
  v_res jsonb;
  v_sobra numeric := 0;
  v_extra jsonb;
begin
  if v_org is null then
    raise exception 'Sin perfil activo';
  end if;
  if v_rol is null or v_rol not in ('guardia','lider') then
    raise exception 'A los ambulantes les cobra el Jefe de Portería';
  end if;

  -- (a) Idempotencia (§4.0-5).
  if p_lote is not null then
    perform pg_advisory_xact_lock(hashtextextended('cobrar_diario:' || p_lote::text, 0));
    select p.cliente_id, p.org_id into v_otro, v_otro_org
    from public.pagos p where p.lote_id = p_lote
    order by p.linea limit 1;
    if found then
      if v_otro_org is distinct from v_org or v_otro is distinct from p_cliente then
        raise exception 'Ese cobro ya se registró para otro cliente';
      end if;
      select jsonb_build_object('cargo_id', c.id, 'desde', c.desde, 'hasta', c.hasta,
                                'dias', (c.hasta - c.desde) + 1, 'precio_dia', c.precio_unitario)
        into v_extra
      from public.cargos c
      where c.lote_id = p_lote and c.origen = 'diario'
      order by c.creado_en limit 1;
      return private.resumen_lote(p_lote) || coalesce(v_extra, '{}'::jsonb)
             || jsonb_build_object('repetido', true);
    end if;
  end if;

  if p_dias is null or p_dias < 1 or p_dias > 31 then
    raise exception 'Elegí entre 1 y 31 días';
  end if;
  v_desde := coalesce(p_desde, v_hoy);
  if v_desde < v_hoy - 30 or v_desde > v_hoy + 31 then
    raise exception 'Elegí un día cercano a hoy';
  end if;
  v_hasta := v_desde + (p_dias - 1);

  -- (b) Caja for share, estado después del bloqueo.
  select * into v_caja from public.cajas
  where id = p_caja and org_id = v_org
  for share;
  if not found then
    raise exception 'Caja inexistente';
  end if;
  if v_rol = 'guardia' and v_caja.tipo <> 'guardia' then
    raise exception 'Solo podés cobrar en la caja de portería';
  end if;
  if v_rol = 'lider' and v_caja.tipo <> 'administracion' then
    raise exception 'Solo podés cobrar en la caja de administración';
  end if;
  if v_caja.estado <> 'abierta' then
    -- 0023: el mensaje dice qué hacer según quién cobra y en qué estado quedó la caja.
    raise exception '%', private.mensaje_caja_no_abierta(v_caja.estado, v_rol);
  end if;

  -- (c) Cliente for update: ambulante activo de la org.
  select * into v_cli from public.clientes
  where id = p_cliente and org_id = v_org
  for update;
  if not found or v_cli.categoria is distinct from 'ambulante' then
    raise exception 'Elegí un ambulante registrado';
  end if;
  if not v_cli.activo then
    raise exception 'Este ambulante está dado de baja';
  end if;

  -- 0044: AMB es el concepto donde va el cargo (apagarlo sigue frenando los cobros). El
  -- precio por día lo pone quien cobra (sin precio predefinido); sin p_precio, como antes,
  -- el del concepto.
  select * into v_amb from public.conceptos
  where org_id = v_org and codigo = 'AMB' and activo
  limit 1;
  if not found then
    raise exception 'Los cobros a ambulantes están desactivados: el concepto AMB está apagado en Configuración → Precios';
  end if;
  v_precio := round(coalesce(p_precio, nullif(v_amb.precio, 0)), 2);
  if v_precio is null or v_precio <= 0 then
    raise exception 'Poné cuánto paga por día';
  end if;
  if v_precio > 10000000 then
    raise exception 'El precio por día es demasiado alto';
  end if;

  -- Días ya pagados (con el cliente bloqueado: dos cobros a la vez no se pisan).
  select c.desde, c.hasta into v_choque
  from public.cargos c
  where c.cliente_id = p_cliente and c.origen = 'diario' and c.estado <> 'anulado'
    and c.desde <= v_hasta and c.hasta >= v_desde
  order by c.desde
  limit 1;
  if found then
    raise exception 'Ya tiene pagado del % al %: elegí otros días',
      to_char(v_choque.desde, 'DD/MM'), to_char(v_choque.hasta, 'DD/MM');
  end if;

  -- Líneas: 1 a 3, solo efectivo / transferencia, suma exacta.
  v_total := round(p_dias * v_precio, 2);
  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array'
     or jsonb_array_length(p_lineas) not between 1 and 3 then
    raise exception 'Elegí cómo te paga';
  end if;
  for v_l in select t.value from jsonb_array_elements(p_lineas) as t(value) loop
    v_txt := case when jsonb_typeof(v_l) = 'object' then v_l->>'medio' end;
    if v_txt = 'cheque' then
      if v_rol = 'guardia' then
        raise exception 'En portería se cobra solo en efectivo o transferencia';
      end if;
      raise exception 'A los ambulantes se les cobra en efectivo o transferencia';
    end if;
    if v_txt is null or v_txt not in ('efectivo','transferencia') then
      raise exception 'Elegí cómo te paga';
    end if;
    v_medio := v_txt::public.medio_pago;
    v_txt := btrim(coalesce(v_l->>'monto', ''));
    if v_txt !~ '^[0-9]+(\.[0-9]+)?$' or round(v_txt::numeric, 2) <= 0 then
      raise exception 'Cada medio de pago necesita un monto mayor a cero';
    end if;
    v_monto := round(v_txt::numeric, 2);
    if v_medio = 'transferencia' then
      if btrim(coalesce(v_l#>>'{transferencia,titular}', '')) = '' then
        raise exception 'Poné a nombre de quién está la cuenta que transfirió';
      end if;
      v_path := nullif(btrim(coalesce(v_l#>>'{transferencia,comprobante_path}', '')), '');
      if v_path is not null
         and (v_path not like v_org::text || '/comprobantes/%' or position('..' in v_path) > 0) then
        raise exception 'La foto del comprobante no es válida: volvé a sacarla';
      end if;
    end if;
    v_suma := v_suma + v_monto;
  end loop;
  if v_suma <> v_total then
    raise exception 'El total tiene que ser % (% × %)',
      private.cobro_pesos(v_total),
      case when p_dias = 1 then '1 día' else p_dias || ' días' end,
      private.cobro_pesos(v_precio);
  end if;

  begin
    -- Si tenía crédito, va a sus deudas viejas ANTES de crear el cargo del día (no a este cobro).
    perform private.aplicar_saldo_favor(p_cliente);

    insert into public.cargos (
      org_id, periodo, cliente_id, concepto_id, codigo, descripcion, cantidad, precio_unitario,
      monto, descuento_pronto_pago, vencimiento, origen, desde, hasta, lote_id)
    values (
      v_org, date_trunc('month', v_desde)::date, p_cliente, v_amb.id, v_amb.codigo,
      v_amb.nombre || ' · ' || case when p_dias = 1
        then to_char(v_desde, 'DD/MM')
        else p_dias || ' días (' || to_char(v_desde, 'DD/MM') || ' al ' || to_char(v_hasta, 'DD/MM') || ')' end,
      p_dias, v_precio, v_total, 0, v_desde, 'diario', v_desde, v_hasta, v_lote)
    returning id into v_cargo_id;

    v_numero := nextval(pg_get_serial_sequence('public.pagos', 'numero'));

    for v_l in
      select t.value
      from jsonb_array_elements(p_lineas) with ordinality as t(value, ord)
      order by case t.value->>'medio' when 'efectivo' then 1 else 2 end, t.ord
    loop
      v_n := v_n + 1;
      v_medio := (v_l->>'medio')::public.medio_pago;
      v_monto := round((btrim(v_l->>'monto'))::numeric, 2);
      insert into public.pagos (
        org_id, numero, cliente_id, caja_id, medio, monto, notas, recibido_por,
        titular_transferencia, comprobante_path, lote_id, linea)
      overriding system value
      values (
        v_org, v_numero, p_cliente, p_caja, v_medio, v_monto,
        case when v_n = 1 then nullif(btrim(coalesce(p_notas, '')), '') end,
        v_yo,
        case when v_medio = 'transferencia' then btrim(v_l#>>'{transferencia,titular}') end,
        case when v_medio = 'transferencia'
          then nullif(btrim(coalesce(v_l#>>'{transferencia,comprobante_path}', '')), '') end,
        v_lote, v_n)
      returning id into v_pago_id;

      -- El cargo nuevo primero: como las líneas suman exacto, todo va a SU cargo del día.
      v_res := private.imputar_pago(v_pago_id, p_cliente, v_monto, v_cargo_id);
      v_sobra := v_sobra + (v_res->>'restante')::numeric;
    end loop;

    if v_sobra > 0.009 then
      raise exception 'No se pudo imputar el cobro del ambulante: revisá los montos';
    end if;
  exception
    when unique_violation then
      if p_lote is not null then
        select p.cliente_id into v_otro from public.pagos p where p.lote_id = p_lote order by p.linea limit 1;
        if found then
          if v_otro is distinct from p_cliente then
            raise exception 'Ese cobro ya se registró para otro cliente';
          end if;
          select jsonb_build_object('cargo_id', c.id, 'desde', c.desde, 'hasta', c.hasta,
                                    'dias', (c.hasta - c.desde) + 1, 'precio_dia', c.precio_unitario)
            into v_extra
          from public.cargos c
          where c.lote_id = p_lote and c.origen = 'diario'
          order by c.creado_en limit 1;
          return private.resumen_lote(p_lote) || coalesce(v_extra, '{}'::jsonb)
                 || jsonb_build_object('repetido', true);
        end if;
      end if;
      raise;
  end;

  return private.resumen_lote(v_lote) || jsonb_build_object(
    'cargo_id', v_cargo_id,
    'desde', v_desde,
    'hasta', v_hasta,
    'dias', p_dias,
    'precio_dia', v_precio,
    'repetido', false);
end $function$;

revoke all on function public.cobrar_diario(uuid, uuid, integer, jsonb, date, text, uuid, numeric) from public, anon;
grant execute on function public.cobrar_diario(uuid, uuid, integer, jsonb, date, text, uuid, numeric) to authenticated, service_role;
