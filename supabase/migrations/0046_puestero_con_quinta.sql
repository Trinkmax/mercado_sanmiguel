-- ============================================================
-- 0046 · El puestero también puede tener quinta.
--
-- Un puestero puede alquilar además una quinta de la playa: la tiene en el plano y paga
-- la quinta por mes (concepto de segmento "quinteros", EXPQ) junto con lo demás suyo, que
-- le cobra Administración. Sigue siendo puestero.
--
-- · Conceptos: al puestero se le puede asignar EXPQ (lo de ambulantes, no). Administración
--   lo pide (alta, cambio o baja de la fila, también en el alta del puestero) y el Líder lo
--   aprueba; el Líder lo hace directo. El Jefe de Portería sigue sin gestionar puesteros.
--   Con los quinteros no cambia nada: su quinta la gestiona el Jefe, no Administración.
--   El precio de la quinta sigue siendo de Portería (catálogo sin cambios).
-- · Chequeo final de aplicar_cambio: EXPQ a un puestero ya no se rechaza.
-- · Pasar a alguien a puestero: conserva la quinta (concepto activo; sus quintas del plano
--   ya quedaban). Lo de ambulantes deja de facturarse como antes. Puestero → quintero,
--   ambulante o empleado: igual que antes (0040, 0045).
-- · Plano: asignar_espacios y el trigger espacios_empleado_solo_cochera ya dejaban darle una
--   quinta a un puestero (solo frenan a empleados y ambulantes). En el mapa del Jefe
--   (quintas_del_plano) esa quinta sale ocupada, sin decir de quién; antes salía libre.
-- · Generación del mes: generar_periodo ya genera EXPQ a cualquiera que no sea ambulante
--   con el concepto activo: no cambia.
--
-- Mismas firmas: los permisos de las funciones no cambian. Idempotente.
-- ============================================================

-- Pedidos de cambio: Administración pide la quinta de un puestero.
CREATE OR REPLACE FUNCTION public.solicitar_cambio(p_entidad text, p_accion text, p_entidad_id uuid, p_datos jsonb, p_resumen text, p_cliente_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_gest public.categoria_cliente[] := private.categorias_gestionables();
  v_datos jsonb := coalesce(p_datos, '{}'::jsonb);
  v_resumen text := trim(coalesce(p_resumen, ''));
  v_cambio public.cambios_pendientes;
  v_anterior jsonb;
  v_resultado uuid;
  v_cliente uuid := p_cliente_id;
  v_cat_actual public.categoria_cliente;
  v_cat_nueva public.categoria_cliente;
  v_es_socio boolean;
  v_portal boolean;
  v_concepto_id uuid;
  v_seg text;
  v_tipo public.tipo_concepto;
  v_cod_concepto text;
  v_codigo integer;
  v_item jsonb;
  v_en_el_acto boolean := false;
  v_msg_cat text;
  v_constraint text;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  -- Tesorería y Consejo ya no proponen (J4, F5). El Líder aplica directo (D-P2).
  if v_rol is null or v_rol not in ('admin','guardia','lider') then
    raise exception 'No tenés permiso para proponer cambios';
  end if;
  if p_entidad is null or p_entidad not in ('cliente','cliente_concepto','concepto') then
    raise exception 'Entidad inválida';
  end if;
  if p_accion is null or p_accion not in ('alta','modificacion','baja') then
    raise exception 'Acción inválida';
  end if;
  if p_accion <> 'alta' and p_entidad_id is null then raise exception 'Falta el registro a modificar'; end if;
  if v_resumen = '' then raise exception 'Falta el resumen del cambio'; end if;
  if jsonb_typeof(v_datos) <> 'object' then raise exception 'Los datos del cambio no se entienden. Recargá la página y probá de nuevo'; end if;

  -- Idempotencia del alta (doble toque o reintento sin red, §4.0-5): la UI manda datos.ref = uuid
  -- por intento. Si ya se registró con ese ref, se devuelve lo registrado con "repetido": true
  -- (clave para el ambulante del Jefe, que se aplica en el acto: nunca dos ambulantes iguales).
  if p_accion = 'alta' and v_datos ? 'ref' then
    if coalesce(v_datos->>'ref', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Los datos del cambio no se entienden. Recargá la página y probá de nuevo';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('solicitar_cambio:' || lower(v_datos->>'ref'), 0));
    select * into v_cambio from public.cambios_pendientes cp
    where cp.org_id = v_org and cp.entidad = p_entidad and cp.accion = 'alta'
      and lower(cp.datos->>'ref') = lower(v_datos->>'ref')
    order by cp.solicitado_en
    limit 1;
    if found then
      if v_cambio.solicitado_por is distinct from (select auth.uid()) then
        raise exception 'Ese pedido ya lo cargó otra persona. Recargá la página';
      end if;
      return jsonb_build_object(
        'estado', case when v_cambio.estado = 'aprobado' then 'aplicado' else 'pendiente' end,
        'cambio_id', v_cambio.id, 'resultado_id', v_cambio.resultado_id, 'repetido', true);
    end if;
  end if;

  v_msg_cat := case when v_rol = 'guardia'
    then 'Desde Portería solo se gestionan quinteros y ambulantes'
    else 'A quinteros y ambulantes los gestiona el Jefe de Portería' end;

  -- Claves nuevas: se validan como texto ANTES de castear (basura → mensaje humano, no error de enum).
  if v_datos ? 'categoria' then
    if jsonb_typeof(v_datos->'categoria') is distinct from 'string'
       or v_datos->>'categoria' not in ('puestero','quintero','ambulante','empleado') then
      raise exception 'Categoría inválida';
    end if;
  end if;
  if v_datos ? 'es_socio' and jsonb_typeof(v_datos->'es_socio') is distinct from 'boolean' then
    raise exception 'Elegí si es socio de la cooperativa: Sí o No';
  end if;
  if v_datos ? 'activo' and jsonb_typeof(v_datos->'activo') is distinct from 'boolean' then
    raise exception 'Elegí si queda activo: Sí o No';
  end if;
  if p_entidad = 'cliente' and v_datos ? 'cuotas_mes' then
    if coalesce(v_datos->>'cuotas_mes', '') !~ '^[0-9]{1,2}$' then
      raise exception 'Elegí en cuántos pagos cobra el mes (de 1 a 31)';
    end if;
    if (v_datos->>'cuotas_mes')::int not between 1 and 31 then
      raise exception 'Elegí en cuántos pagos cobra el mes (de 1 a 31)';
    end if;
  end if;
  if p_entidad = 'cliente' and v_datos ? 'codigo' and v_datos->'codigo' <> 'null'::jsonb then
    if coalesce(v_datos->>'codigo', '') !~ '^[0-9]{1,9}$' then
      raise exception 'El número de carpeta va sin comas ni puntos';
    end if;
  end if;

  -- ================= cliente =================
  if p_entidad = 'cliente' then
    if p_accion = 'alta' then
      if coalesce(trim(v_datos->>'nombre'), '') = '' then raise exception 'Poné el nombre del cliente'; end if;
      v_cat_nueva := coalesce((v_datos->>'categoria')::public.categoria_cliente,
        (case when v_rol = 'guardia' then 'quintero' else 'puestero' end)::public.categoria_cliente);
      if not (v_cat_nueva = any (v_gest)) then raise exception '%', v_msg_cat; end if;
      v_datos := v_datos || jsonb_build_object('categoria', v_cat_nueva);
      if v_cat_nueva = 'ambulante' then
        if coalesce((v_datos->>'es_socio')::boolean, false) then
          raise exception 'Un ambulante no puede ser socio: si es socio, cargalo como quintero o puestero';
        end if;
        -- Sin portal ni cuotas: se le cobra por día cuando viene (G5, G6).
        v_datos := v_datos || jsonb_build_object('es_socio', false, 'cuotas_mes', 1);
        v_en_el_acto := v_rol = 'guardia';   -- D-P1: el Jefe lo da de alta y le cobra enseguida
      end if;
      if v_cat_nueva = 'empleado' then
        -- 0040: solo para cobrarle la cochera: sin portal, sin socio y en un pago por mes.
        v_datos := v_datos || jsonb_build_object('es_socio', false, 'cuotas_mes', 1);
      end if;

      -- Conceptos del alta: las mismas reglas que un cliente_concepto suelto.
      if v_datos ? 'conceptos' and jsonb_typeof(v_datos->'conceptos') is distinct from 'array' then
        raise exception 'Los conceptos del alta no se entienden. Recargá la página y probá de nuevo';
      end if;
      for v_item in select * from jsonb_array_elements(coalesce(v_datos->'conceptos', '[]'::jsonb)) loop
        if coalesce(v_item->>'concepto_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
          raise exception 'Concepto inexistente';
        end if;
        if v_item ? 'porcentaje' then
        if coalesce(v_item->>'porcentaje', '') !~ '^[0-9]{1,4}(\.[0-9]{1,2})?$' then
          raise exception 'El porcentaje va de 1 a 1000 (por ejemplo 70, 125 o 400)';
        end if;
        if (v_item->>'porcentaje')::numeric not between 1 and 1000 then
          raise exception 'El porcentaje va de 1 a 1000 (por ejemplo 70, 125 o 400)';
        end if;
        end if;
        select co.segmento, co.tipo into v_seg, v_tipo
        from public.conceptos co where co.id = (v_item->>'concepto_id')::uuid and co.org_id = v_org;
        if not found then raise exception 'Concepto inexistente'; end if;
        if v_tipo <> 'recurrente' then
          raise exception 'Ese concepto no se asigna a la carpeta: se cobra en el momento';
        end if;
        if v_rol = 'guardia' and coalesce(v_seg, '') not in ('quinteros','ambulantes') then
          raise exception 'Ese concepto lo gestiona Administración';
        end if;
        -- 0046: la quinta de un puestero (EXPQ) la pide Administración, con lo demás suyo.
        if v_rol = 'admin' and v_seg in ('quinteros','ambulantes')
           and not (v_cat_nueva = 'puestero' and v_seg = 'quinteros') then
          raise exception 'Ese concepto lo gestiona el Jefe de Portería';
        end if;
        if v_cat_nueva = 'empleado' and coalesce(v_seg, '') <> 'cocheras' then
          raise exception 'A un empleado solo se le cobra la cochera';
        end if;
        -- 0045: al ambulante se le cobra por día; por mes, solo la cochera.
        if v_cat_nueva = 'ambulante' and coalesce(v_seg, '') <> 'cocheras' then
          raise exception 'A un ambulante se le cobra por día: por mes solo se le cobra la cochera';
        end if;
      end loop;

      -- N° de carpeta: dos altas a la vez no se llevan el mismo número. Si no viene, se asigna.
      perform pg_advisory_xact_lock(hashtextextended('alta_cliente:' || v_org::text, 0));
      if v_datos->'codigo' is null or v_datos->'codigo' = 'null'::jsonb or coalesce(v_datos->>'codigo', '') = '' then
        v_codigo := private.proximo_codigo_cliente();
      else
        v_codigo := (v_datos->>'codigo')::int;
      end if;
      if v_codigo < 1 then raise exception 'El número de carpeta tiene que ser mayor a cero'; end if;
      perform 1 from public.clientes where org_id = v_org and codigo = v_codigo;
      if found then
        raise exception 'Ya existe un cliente con el número de carpeta %: usá el %', v_codigo, private.proximo_codigo_cliente();
      end if;
      perform 1 from public.cambios_pendientes cp
      where cp.org_id = v_org and cp.estado = 'pendiente' and cp.entidad = 'cliente' and cp.accion = 'alta'
        and coalesce(cp.datos->>'codigo', '') ~ '^[0-9]{1,9}$' and (cp.datos->>'codigo')::int = v_codigo;
      if found then
        raise exception 'El número de carpeta % ya lo tiene otra alta que espera aprobación: usá el %', v_codigo, private.proximo_codigo_cliente();
      end if;
      v_datos := v_datos || jsonb_build_object('codigo', v_codigo);

    else
      select to_jsonb(c) - 'org_id', c.categoria, c.auth_user_id is not null, c.es_socio
        into v_anterior, v_cat_actual, v_portal, v_es_socio
      from public.clientes c where c.id = p_entidad_id and c.org_id = v_org;
      if v_anterior is null then raise exception 'Cliente inexistente'; end if;
      v_cliente := p_entidad_id;
      if not (v_cat_actual = any (v_gest)) then raise exception '%', v_msg_cat; end if;

      if p_accion = 'modificacion' then
        if v_datos ? 'nombre' and coalesce(trim(v_datos->>'nombre'), '') = '' then
          raise exception 'Poné el nombre del cliente';
        end if;
        v_cat_nueva := coalesce((v_datos->>'categoria')::public.categoria_cliente, v_cat_actual);
        if not (v_cat_nueva = any (v_gest)) then raise exception '%', v_msg_cat; end if;
        if v_cat_nueva = 'ambulante' and v_cat_actual <> 'ambulante' then
          if v_portal then
            raise exception 'Un ambulante no puede tener acceso al portal: quitale el acceso primero';
          end if;
          -- Pasa a cobrarse por día: deja de ser socio y de pagar en cuotas (queda en el diff).
          if v_es_socio and not (v_datos ? 'es_socio') then
            v_datos := v_datos || jsonb_build_object('es_socio', false);
          end if;
        end if;
        if v_cat_nueva = 'ambulante' and coalesce((v_datos->>'es_socio')::boolean, false) then
          raise exception 'Un ambulante no puede ser socio: si es socio, cargalo como quintero o puestero';
        end if;
        -- 0040: el empleado solo alquila cochera: sin portal ni socio.
        if v_cat_nueva = 'empleado' and v_cat_actual <> 'empleado' then
          if v_portal then
            raise exception 'Un empleado no tiene acceso al portal: quitale el acceso primero';
          end if;
          if v_es_socio and not (v_datos ? 'es_socio') then
            v_datos := v_datos || jsonb_build_object('es_socio', false);
          end if;
        end if;
        if v_cat_nueva = 'empleado' and coalesce((v_datos->>'es_socio')::boolean, false) then
          raise exception 'Un empleado no puede ser socio: si es socio, cargalo como puestero';
        end if;
        if v_datos ? 'codigo' then
          if v_datos->'codigo' = 'null'::jsonb or coalesce(v_datos->>'codigo', '') = '' then
            raise exception 'Poné el número de carpeta';
          end if;
          v_codigo := (v_datos->>'codigo')::int;
          if v_codigo < 1 then raise exception 'El número de carpeta tiene que ser mayor a cero'; end if;
          perform 1 from public.clientes where org_id = v_org and codigo = v_codigo and id <> p_entidad_id;
          if found then raise exception 'Ya existe otro cliente con el número de carpeta %', v_codigo; end if;
          v_datos := v_datos || jsonb_build_object('codigo', v_codigo);
        end if;
      end if;
    end if;

  -- ================= cliente_concepto =================
  elsif p_entidad = 'cliente_concepto' then
    if p_entidad_id is not null then
      select to_jsonb(cc) - 'org_id' into v_anterior
      from public.cliente_conceptos cc where cc.id = p_entidad_id and cc.org_id = v_org;
      if v_anterior is null then raise exception 'Ese concepto ya no está en la carpeta del cliente'; end if;
      v_cliente := (v_anterior->>'cliente_id')::uuid;
      v_concepto_id := (v_anterior->>'concepto_id')::uuid;
    else
      if coalesce(v_datos->>'cliente_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'Cliente inexistente';
      end if;
      if coalesce(v_datos->>'concepto_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'Concepto inexistente';
      end if;
      v_cliente := (v_datos->>'cliente_id')::uuid;
      v_concepto_id := (v_datos->>'concepto_id')::uuid;
    end if;
    select c.categoria into v_cat_actual from public.clientes c where c.id = v_cliente and c.org_id = v_org;
    if not found then raise exception 'Cliente inexistente'; end if;
    select co.segmento, co.tipo, co.codigo into v_seg, v_tipo, v_cod_concepto
    from public.conceptos co where co.id = v_concepto_id and co.org_id = v_org;
    if not found then raise exception 'Concepto inexistente'; end if;

    -- 0040: al empleado solo se le cobra la cochera.
    if v_cat_actual = 'empleado' and p_accion <> 'baja' and coalesce(v_seg, '') <> 'cocheras' then
      raise exception 'A un empleado solo se le cobra la cochera';
    end if;
    if v_tipo in ('energia','abono_energia') then
      -- Energía es de Administración para TODOS los clientes (permite "Eximir del abono").
      if v_rol = 'guardia' then raise exception 'Ese concepto lo gestiona Administración'; end if;
    else
      if not (v_cat_actual = any (v_gest)) then raise exception '%', v_msg_cat; end if;
      if v_rol = 'guardia' and coalesce(v_seg, '') not in ('quinteros','ambulantes') then
        raise exception 'Ese concepto lo gestiona Administración';
      end if;
      -- 0046: la quinta de un puestero (EXPQ) la pide Administración, con lo demás suyo.
      if v_rol = 'admin' and v_seg in ('quinteros','ambulantes')
         and not (v_cat_actual = 'puestero' and v_seg = 'quinteros') then
        raise exception 'Ese concepto lo gestiona el Jefe de Portería';
      end if;
      if p_accion = 'alta' and v_tipo <> 'recurrente' then
        raise exception 'Ese concepto no se asigna a la carpeta: se cobra en el momento';
      end if;
      -- 0045: al ambulante se le cobra por día; por mes, solo la cochera.
      if v_cat_actual = 'ambulante' and v_tipo = 'recurrente' and coalesce(v_seg, '') <> 'cocheras'
         and p_accion <> 'baja'
         and (case when v_datos ? 'activo' then (v_datos->>'activo')::boolean
                   when p_accion = 'modificacion' then coalesce((v_anterior->>'activo')::boolean, true)
                   else true end) then
        raise exception 'A un ambulante se le cobra por día: por mes solo se le cobra la cochera';
      end if;
    end if;
    if v_datos ? 'porcentaje' then
      if coalesce(v_datos->>'porcentaje', '') !~ '^[0-9]{1,4}(\.[0-9]{1,2})?$' then
        raise exception 'El porcentaje va de 1 a 1000 (por ejemplo 70, 125 o 400)';
      end if;
      if (v_datos->>'porcentaje')::numeric not between 1 and 1000 then
        raise exception 'El porcentaje va de 1 a 1000 (por ejemplo 70, 125 o 400)';
      end if;
    end if;
    if v_datos ? 'cantidad' then
      if coalesce(v_datos->>'cantidad', '') !~ '^[0-9]{1,2}(\.[0-9]{1,2})?$' then
        raise exception 'Poné una cantidad válida (de ¼ a 99)';
      end if;
      if (v_datos->>'cantidad')::numeric <= 0 then
        raise exception 'Poné una cantidad válida (de ¼ a 99)';
      end if;
    end if;

  -- ================= concepto (catálogo) =================
  elsif p_entidad = 'concepto' then
    if p_accion = 'alta' then
      if v_rol <> 'lider' then raise exception 'Los conceptos nuevos los da de alta el Líder de Procesos'; end if;
    else
      select to_jsonb(co) - 'org_id', co.segmento, co.codigo into v_anterior, v_seg, v_cod_concepto
      from public.conceptos co where co.id = p_entidad_id and co.org_id = v_org;
      if v_anterior is null then raise exception 'Concepto inexistente'; end if;
      if v_rol = 'guardia' then
        if p_accion <> 'modificacion' or coalesce(v_seg, '') not in ('quinteros','ambulantes')
           or exists (select 1 from jsonb_object_keys(v_datos) k where k <> 'precio') then
          raise exception 'Desde Portería solo se cambia el precio de Quintas y Ambulantes';
        end if;
      elsif v_rol = 'admin' then
        if v_seg in ('quinteros','ambulantes') or v_cod_concepto = 'BC' then
          raise exception 'Ese precio lo maneja Portería';
        end if;
      end if;
    end if;
    if v_datos ? 'segmento' then
      if v_rol <> 'lider' then raise exception 'El segmento de un concepto lo cambia el Líder de Procesos'; end if;
      if v_datos->'segmento' <> 'null'::jsonb and coalesce(v_datos->>'segmento', '') <> ''
         and v_datos->>'segmento' not in ('puesteros','puestos_propios','locales','galpones','conteiners',
                                           'cocheras','quinteros','ambulantes') then
        raise exception 'Segmento inválido';
      end if;
    end if;
    if v_datos ? 'precio' then
      if coalesce(v_datos->>'precio', '') !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$' then
        raise exception 'Poné un precio válido (solo números)';
      end if;
    end if;
  end if;

  if v_en_el_acto then
    v_resumen := format('Alta de ambulante %s (aplicada en el acto, revisala)', trim(v_datos->>'nombre'));
  end if;

  insert into public.cambios_pendientes (org_id, entidad, accion, entidad_id, cliente_id, datos,
                                         datos_anteriores, resumen, solicitado_por, revisar_despues)
  values (v_org, p_entidad, p_accion, p_entidad_id, v_cliente, v_datos, v_anterior, v_resumen,
          (select auth.uid()), v_en_el_acto)
  returning * into v_cambio;

  -- El Líder aplica directo (queda aprobado y firmado). El alta de ambulante del Jefe (D-P1) se aplica
  -- en el acto pero queda SIN revisor y con revisar_despues: el Líder la ve en "Aplicadas por el Jefe".
  if v_rol = 'lider' or v_en_el_acto then
    begin
      v_resultado := private.aplicar_cambio(v_cambio);
    exception
      when check_violation then
        get stacked diagnostics v_constraint = constraint_name;
        if v_constraint in ('clientes_ambulante_sin_portal', 'clientes_sin_portal') then
          raise exception 'Ambulantes y empleados no tienen acceso al portal: quitale el acceso primero';
        end if;
        raise;
      when unique_violation then
        get stacked diagnostics v_constraint = constraint_name;
        if v_constraint = 'clientes_org_id_codigo_key' then
          raise exception 'Ya existe otro cliente con ese número de carpeta: usá el %', private.proximo_codigo_cliente();
        end if;
        raise;
    end;
    update public.cambios_pendientes set
      estado = 'aprobado',
      revisado_por = case when v_en_el_acto then null else (select auth.uid()) end,
      revisado_en = case when v_en_el_acto then null else now() end,
      resultado_id = v_resultado,
      cliente_id = coalesce(cliente_id, case when p_entidad = 'cliente' then v_resultado end)
    where id = v_cambio.id;
    return jsonb_build_object('estado', 'aplicado', 'cambio_id', v_cambio.id, 'resultado_id', v_resultado);
  end if;

  return jsonb_build_object('estado', 'pendiente', 'cambio_id', v_cambio.id, 'resultado_id', null);
end;
$function$;

-- Aplicar cambios: al puestero, la quinta le corresponde.
CREATE OR REPLACE FUNCTION private.aplicar_cambio(p_cambio cambios_pendientes)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  d jsonb := p_cambio.datos;
  v_id uuid := p_cambio.entidad_id;
  v_item jsonb;
  v_existente uuid;
  v_categoria public.categoria_cliente;
  v_cat_anterior public.categoria_cliente;
  v_cuotas integer;
begin
  if p_cambio.entidad = 'cliente' then
    if p_cambio.accion = 'alta' then
      v_categoria := coalesce((d->>'categoria')::public.categoria_cliente, 'puestero');
      -- Quintero sin cuotas elegidas: las que configuró el Jefe (G7). Ambulante: se le cobra por día.
      v_cuotas := case
        when v_categoria = 'ambulante' then 1
        when d ? 'cuotas_mes' and d->'cuotas_mes' <> 'null'::jsonb then (d->>'cuotas_mes')::int
        when v_categoria = 'quintero' then coalesce((
          select cf.cuotas_default_quintero from public.configuracion cf where cf.org_id = p_cambio.org_id), 4)
        else 1
      end;
      insert into public.clientes (org_id, codigo, nombre, apodo, tipo_persona, cuit, telefono, email,
                                   direccion, notas, cuotas_mes, categoria, es_socio)
      values (
        p_cambio.org_id,
        (d->>'codigo')::int,
        trim(d->>'nombre'),
        nullif(trim(d->>'apodo'), ''),
        coalesce((d->>'tipo_persona')::public.tipo_persona, 'fisica'),
        nullif(trim(d->>'cuit'), ''), nullif(trim(d->>'telefono'), ''), nullif(trim(d->>'email'), ''),
        nullif(trim(d->>'direccion'), ''), nullif(trim(d->>'notas'), ''),
        v_cuotas,
        v_categoria,
        v_categoria not in ('ambulante', 'empleado') and coalesce((d->>'es_socio')::boolean, false)
      ) returning id into v_id;
      -- Empleado (0040) y ambulante (0045: se le cobra por día): de lo mensual, solo la
      -- cochera. Si viniera otro concepto, no se carga.
      for v_item in select * from jsonb_array_elements(coalesce(d->'conceptos', '[]'::jsonb)) loop
        insert into public.cliente_conceptos (org_id, cliente_id, concepto_id, cantidad, porcentaje, activo)
        select p_cambio.org_id, v_id, (v_item->>'concepto_id')::uuid,
               coalesce((v_item->>'cantidad')::numeric, 1), coalesce((v_item->>'porcentaje')::numeric, 100), true
        where exists (select 1 from public.conceptos co
                      where co.id = (v_item->>'concepto_id')::uuid and co.org_id = p_cambio.org_id
                        and (v_categoria not in ('empleado', 'ambulante') or co.segmento = 'cocheras'))
        on conflict (cliente_id, concepto_id) do update
          set cantidad = excluded.cantidad, porcentaje = excluded.porcentaje, activo = true;
      end loop;
    elsif p_cambio.accion = 'modificacion' then
      select c.categoria into v_cat_anterior
      from public.clientes c where c.id = v_id and c.org_id = p_cambio.org_id
      for update;

      update public.clientes set
        codigo       = case when d ? 'codigo' then (d->>'codigo')::int else codigo end,
        nombre       = case when d ? 'nombre' then trim(d->>'nombre') else nombre end,
        apodo        = case when d ? 'apodo' then nullif(trim(d->>'apodo'), '') else apodo end,
        tipo_persona = case when d ? 'tipo_persona' then (d->>'tipo_persona')::public.tipo_persona else tipo_persona end,
        cuit         = case when d ? 'cuit' then nullif(trim(d->>'cuit'), '') else cuit end,
        telefono     = case when d ? 'telefono' then nullif(trim(d->>'telefono'), '') else telefono end,
        email        = case when d ? 'email' then nullif(trim(d->>'email'), '') else email end,
        direccion    = case when d ? 'direccion' then nullif(trim(d->>'direccion'), '') else direccion end,
        notas        = case when d ? 'notas' then nullif(trim(d->>'notas'), '') else notas end,
        cuotas_mes   = case when d ? 'cuotas_mes' then (d->>'cuotas_mes')::int else cuotas_mes end,
        activo       = case when d ? 'activo' then (d->>'activo')::boolean else activo end,
        categoria    = case when d ? 'categoria' then (d->>'categoria')::public.categoria_cliente else categoria end,
        es_socio     = case when d ? 'es_socio' then (d->>'es_socio')::boolean else es_socio end
      where id = v_id and org_id = p_cambio.org_id;

      -- Cambio de categoría: lo mensual que la categoría nueva no tiene deja de facturarse
      -- (misma regla que la ficha usa para ofrecer conceptos). La fila queda (inactiva).
      -- 0046: el que pasa a puestero conserva la quinta (EXPQ), como conserva sus quintas
      -- en el plano.
      v_categoria := case when d ? 'categoria' then (d->>'categoria')::public.categoria_cliente end;
      if v_categoria is not null and v_cat_anterior is not null and v_categoria <> v_cat_anterior then
        update public.cliente_conceptos cc set activo = false
        from public.conceptos co
        where co.id = cc.concepto_id
          and cc.cliente_id = v_id and cc.org_id = p_cambio.org_id
          and cc.activo
          and co.tipo = 'recurrente'
          and case v_categoria
                when 'ambulante' then coalesce(co.segmento, '') <> 'cocheras'   -- 0045
                when 'quintero'  then coalesce(co.segmento, '') <> 'quinteros'
                when 'empleado'  then coalesce(co.segmento, '') <> 'cocheras'
                else coalesce(co.segmento, '') = 'ambulantes'   -- 0046: puestero, la quinta sí
              end;

        if v_categoria = 'ambulante' then
          -- Se le cobra por día: sin cuotas ni socio. 0045: en el plano conserva sus cocheras
          -- (la cochera se le sigue cobrando por mes); los otros lugares quedan libres.
          update public.clientes set cuotas_mes = 1, es_socio = false
          where id = v_id and org_id = p_cambio.org_id and (cuotas_mes <> 1 or es_socio);
          update public.espacios set cliente_id = null, asignado_en = null, actualizado_en = now()
          where cliente_id = v_id and org_id = p_cambio.org_id and tipo <> 'cochera';
          -- Sus medidores dejan de facturarse (abono y consumo) y de salir en la planilla del
          -- electricista, y se desatan del lugar que acaba de liberar. Se pueden reactivar
          -- desde Energía si hiciera falta (los ambulantes no pagan abono: ver sección 2b).
          update public.medidores set activo = false, espacio_id = null
          where cliente_id = v_id and org_id = p_cambio.org_id
            and (activo or espacio_id is not null);
        end if;

        if v_categoria = 'empleado' then
          -- 0040: solo alquila cochera. Sin socio ni cuotas; los otros lugares del plano quedan
          -- libres y sus medidores dejan de facturarse (se reactivan desde Energía si hiciera falta).
          update public.clientes set cuotas_mes = 1, es_socio = false
          where id = v_id and org_id = p_cambio.org_id and (cuotas_mes <> 1 or es_socio);
          update public.espacios set cliente_id = null, asignado_en = null, actualizado_en = now()
          where cliente_id = v_id and org_id = p_cambio.org_id and tipo <> 'cochera';
          update public.medidores set activo = false, espacio_id = null
          where cliente_id = v_id and org_id = p_cambio.org_id
            and (activo or espacio_id is not null);
        end if;
      end if;
    elsif p_cambio.accion = 'baja' then
      update public.clientes set activo = false where id = v_id and org_id = p_cambio.org_id;
    end if;

  elsif p_cambio.entidad = 'cliente_concepto' then
    if p_cambio.accion = 'alta' then
      -- `activo` (default true): "Eximir del abono" es un alta de ABEN con activo = false.
      select id into v_existente from public.cliente_conceptos
      where cliente_id = (d->>'cliente_id')::uuid and concepto_id = (d->>'concepto_id')::uuid;
      if v_existente is not null then
        update public.cliente_conceptos set
          cantidad = coalesce((d->>'cantidad')::numeric, cantidad),
          porcentaje = coalesce((d->>'porcentaje')::numeric, porcentaje),
          notas = coalesce(nullif(trim(d->>'notas'), ''), notas),
          activo = coalesce((d->>'activo')::boolean, true)
        where id = v_existente;
        v_id := v_existente;
      else
        insert into public.cliente_conceptos (org_id, cliente_id, concepto_id, cantidad, porcentaje, notas, activo)
        values (p_cambio.org_id, (d->>'cliente_id')::uuid, (d->>'concepto_id')::uuid,
                coalesce((d->>'cantidad')::numeric, 1), coalesce((d->>'porcentaje')::numeric, 100),
                nullif(trim(d->>'notas'), ''),
                coalesce((d->>'activo')::boolean, true))
        returning id into v_id;
      end if;
    elsif p_cambio.accion = 'modificacion' then
      update public.cliente_conceptos set
        cantidad = case when d ? 'cantidad' then (d->>'cantidad')::numeric else cantidad end,
        porcentaje = case when d ? 'porcentaje' then (d->>'porcentaje')::numeric else porcentaje end,
        activo   = case when d ? 'activo' then (d->>'activo')::boolean else activo end,
        notas    = case when d ? 'notas' then nullif(trim(d->>'notas'), '') else notas end
      where id = v_id and org_id = p_cambio.org_id;
    elsif p_cambio.accion = 'baja' then
      update public.cliente_conceptos set activo = false where id = v_id and org_id = p_cambio.org_id;
    end if;

    -- Lo mensual tiene que corresponder a la categoría ACTUAL del cliente (misma regla que el
    -- cambio de categoría de arriba y que la ficha): un pedido que esperaba aprobación y
    -- llega después de un cambio de categoría (EXME a quien ya es quintero, a un ambulante
    -- lo que no es cochera) se rechaza en vez de dejar una deuda que ni Administración ni el
    -- Jefe podrían sacar. 0046: al puestero, la quinta (EXPQ) sí le corresponde.
    select cl.categoria into v_categoria
    from public.cliente_conceptos cc
    join public.conceptos co on co.id = cc.concepto_id
    join public.clientes cl on cl.id = cc.cliente_id
    where cc.id = v_id and cc.activo and co.tipo = 'recurrente'
      and case cl.categoria
            when 'ambulante' then coalesce(co.segmento, '') <> 'cocheras'   -- 0045
            when 'quintero'  then coalesce(co.segmento, '') <> 'quinteros'
            when 'empleado'  then coalesce(co.segmento, '') <> 'cocheras'
            else coalesce(co.segmento, '') = 'ambulantes'   -- 0046: puestero, la quinta sí
          end;
    if v_categoria = 'ambulante' then
      raise exception 'Este cliente ahora es ambulante: se le cobra por día y por mes solo paga la cochera. Rechazá este cambio.';
    elsif v_categoria is not null then
      raise exception 'Este cliente ahora es %: ese concepto ya no le corresponde. Rechazá este cambio.', v_categoria;
    end if;

  elsif p_cambio.entidad = 'concepto' then
    if p_cambio.accion = 'alta' then
      insert into public.conceptos (org_id, codigo, nombre, tipo, precio, orden_imputacion,
                                    descuento_pronto_pago, activo, segmento)
      values (p_cambio.org_id, d->>'codigo', d->>'nombre',
              coalesce((d->>'tipo')::public.tipo_concepto, 'recurrente'),
              coalesce((d->>'precio')::numeric, 0), coalesce((d->>'orden_imputacion')::int, 100),
              coalesce((d->>'descuento_pronto_pago')::numeric, 0), coalesce((d->>'activo')::boolean, true),
              nullif(d->>'segmento', ''))
      returning id into v_id;
    elsif p_cambio.accion = 'modificacion' then
      update public.conceptos set
        nombre = case when d ? 'nombre' then d->>'nombre' else nombre end,
        precio = case when d ? 'precio' then (d->>'precio')::numeric else precio end,
        orden_imputacion = case when d ? 'orden_imputacion' then (d->>'orden_imputacion')::int else orden_imputacion end,
        descuento_pronto_pago = case when d ? 'descuento_pronto_pago' then (d->>'descuento_pronto_pago')::numeric else descuento_pronto_pago end,
        activo = case when d ? 'activo' then (d->>'activo')::boolean else activo end,
        segmento = case when d ? 'segmento' then nullif(d->>'segmento', '') else segmento end
      where id = v_id and org_id = p_cambio.org_id;
    elsif p_cambio.accion = 'baja' then
      update public.conceptos set activo = false where id = v_id and org_id = p_cambio.org_id;
    end if;
  end if;
  return v_id;
end;
$function$;

-- Mapa del Jefe: la quinta de un puestero, ocupada y sin nombre.
CREATE OR REPLACE FUNCTION public.quintas_del_plano()
 RETURNS TABLE(espacio_id uuid, cliente_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  -- 0046: un puestero también puede tener quinta. Al Jefe se le muestra ocupada pero no de
  -- quién (no gestiona puesteros): en lugar del cliente va el id de la misma quinta.
  select e.id, case when c.categoria = 'quintero' then e.cliente_id else e.id end
  from public.espacios e
  join public.clientes c on c.id = e.cliente_id and c.org_id = e.org_id
  where e.org_id = (select private.org_actual())
    and e.tipo = 'quinta'
    and c.activo
    and (select private.tiene_rol(private.org_actual(), array['admin','guardia','lider']::public.rol_usuario[]))
$function$;

comment on function public.quintas_del_plano() is
  'Quinta → quintero que la ocupa (clientes activos). Si la ocupa otro (un puestero), va el id de la misma quinta: ocupada, sin decir de quién. Para el mapa del Jefe de Portería, que no lee espacios.';
