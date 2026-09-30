-- ============================================================
-- Mercado San Miguel — 0035 Porcentaje por concepto: también más de 100 %
--
-- Hay clientes que pagan más que un concepto entero (110 % de la expensa de galpón,
-- una expensa y cuarto = 125 %, cuatro galpones a un monto que no sale de cantidad ×
-- precio = 400 %…). El porcentaje pasa a ir de 1 a 1000 (antes 1 a 100).
-- La cuenta no cambia: cargo = cantidad × precio × porcentaje / 100. Idempotente.
-- ============================================================

alter table public.cliente_conceptos alter column porcentaje type numeric(6,2);
alter table public.cliente_conceptos drop constraint if exists cliente_conceptos_porcentaje_valido;
alter table public.cliente_conceptos add constraint cliente_conceptos_porcentaje_valido
  check (porcentaje >= 1 and porcentaje <= 1000);
comment on column public.cliente_conceptos.porcentaje is
  'Porcentaje del precio que paga el cliente por este concepto (1 a 1000; 100 = entero, 150 = uno y medio).';

create or replace function public.solicitar_cambio(p_entidad text, p_accion text, p_entidad_id uuid, p_datos jsonb, p_resumen text, p_cliente_id uuid DEFAULT NULL::uuid)
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
       or v_datos->>'categoria' not in ('puestero','quintero','ambulante') then
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
        if v_rol = 'admin' and v_seg in ('quinteros','ambulantes') then
          raise exception 'Ese concepto lo gestiona el Jefe de Portería';
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

    if v_tipo in ('energia','abono_energia') then
      -- Energía es de Administración para TODOS los clientes (permite "Eximir del abono").
      if v_rol = 'guardia' then raise exception 'Ese concepto lo gestiona Administración'; end if;
    else
      if not (v_cat_actual = any (v_gest)) then raise exception '%', v_msg_cat; end if;
      if v_rol = 'guardia' and coalesce(v_seg, '') not in ('quinteros','ambulantes') then
        raise exception 'Ese concepto lo gestiona Administración';
      end if;
      if v_rol = 'admin' and v_seg in ('quinteros','ambulantes') then
        raise exception 'Ese concepto lo gestiona el Jefe de Portería';
      end if;
      if p_accion = 'alta' and v_tipo <> 'recurrente' then
        raise exception 'Ese concepto no se asigna a la carpeta: se cobra en el momento';
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
        if v_constraint = 'clientes_ambulante_sin_portal' then
          raise exception 'Un ambulante no puede tener acceso al portal: quitale el acceso primero';
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
revoke all on function public.solicitar_cambio(text, text, uuid, jsonb, text, uuid) from public, anon;
grant execute on function public.solicitar_cambio(text, text, uuid, jsonb, text, uuid) to authenticated;
