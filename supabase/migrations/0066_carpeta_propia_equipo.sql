-- ============================================================
-- Mercado San Miguel — 0066 Alguien del equipo con su propia carpeta
--
-- Audio de Franco (17/11/2026): Gerardo Succani, el ingeniero del mercado, entra como Jefe de
-- Portería y además es el cliente 82 (Invernadero). Un mismo DNI no puede tener dos usuarios
-- (perfiles_dni_unq) y el portal era solo del rol socio: no tenía cómo ver su cuenta.
--
-- Desde ahora su MISMO usuario queda unido a su carpeta (clientes.auth_user_id) y desde el
-- panel entra a «Mi lugar en el mercado» (el portal). private.cliente_actual() ya devolvía el
-- cliente unido a cualquier usuario, así que la RLS de lectura del portal anda sola. Lo que se
-- decidía por el rol «socio» ahora mira si es lo de SU carpeta: ahí es un cliente más.
--   · No ve ni escribe notas internas en las solicitudes de su carpeta.
--   · Lo que escribe desde el portal en esas solicitudes, y en los avisos de su carpeta, queda
--     como del socio (descargo, «Respuesta nueva»).
--   · La solicitud que carga desde el portal para su carpeta tiene origen 'portal' (la ven el
--     Líder y Administración, no Portería).
--   · Ve los recibos de su carpeta (aunque su rol no los vea) y, si su rol no ve todo, como
--     los ve un socio. Confirma que vio un aviso y abre el PDF de las circulares.
-- Unir y separar la carpeta: solo el Líder de Procesos, y solo si el DNI de la carpeta es el
-- del usuario (unir_carpeta_equipo / separar_carpeta_equipo).
-- Idempotente.
-- ============================================================

-- 1. ¿La solicitud es de SU carpeta? (la que cargó desde el portal o la que Administración o el
--    Líder cargaron a nombre de su carpeta; Portería y el Jefe nunca eligen cliente).
create or replace function private.solicitud_propia(p_solicitud uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.solicitudes s
    where s.id = p_solicitud
      and s.cliente_id = (select private.cliente_actual()))
$$;
revoke all on function private.solicitud_propia(uuid) from public, anon;
grant execute on function private.solicitud_propia(uuid) to authenticated;
comment on function private.solicitud_propia(uuid) is
  '0066 · Solicitud del cliente unido al usuario (socio o alguien del equipo con carpeta propia).';

-- 2. Las notas internas nunca le llegan al cliente, tampoco si es del equipo.
drop policy if exists "leer mensajes de solicitud" on public.solicitud_mensajes;
create policy "leer mensajes de solicitud" on public.solicitud_mensajes for select to authenticated
  using (
    exists (select 1 from public.solicitudes s where s.id = solicitud_mensajes.solicitud_id)
    and (not interno
         or (private.rol_actual() <> 'socio' and not private.solicitud_propia(solicitud_id)))
  );
drop policy if exists "escribir mensajes de solicitud" on public.solicitud_mensajes;
create policy "escribir mensajes de solicitud" on public.solicitud_mensajes for insert to authenticated
  with check (
    private.es_miembro(org_id)
    and autor_id = (select auth.uid())
    and exists (select 1 from public.solicitudes s where s.id = solicitud_mensajes.solicitud_id)
    and (not interno
         or (private.rol_actual() <> 'socio' and not private.solicitud_propia(solicitud_id)))
  );

-- 3. Quién escribe. En una solicitud, el portal pide autor_rol 'socio' y vale solo si es una
--    solicitud de SU carpeta (desde el panel firma con su rol, como siempre). En un aviso o una
--    sanción de SU carpeta escribe el cliente: es su descargo (no hay panel que lo haga por él).
create or replace function private.fijar_autor_mensaje()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_nombre text;
  v_rol public.rol_usuario;
  v_pedido text := new.autor_rol::text;
  v_fila jsonb := to_jsonb(new);
begin
  select nombre, rol into v_nombre, v_rol from public.perfiles
  where user_id = (select auth.uid()) and activo;
  if v_rol is null then raise exception 'Sin perfil activo'; end if;
  new.autor_id := (select auth.uid());
  new.autor_rol := v_rol;
  if v_rol <> 'socio' then
    if tg_table_name = 'solicitud_mensajes' then
      if v_pedido = 'socio' and private.solicitud_propia((v_fila ->> 'solicitud_id')::uuid) then
        new.autor_rol := 'socio';
      end if;
    elsif tg_table_name = 'registro_mensajes' then
      if exists (
        select 1 from public.sanciones s
        where s.id = (v_fila ->> 'registro_id')::uuid
          and s.cliente_id = (select private.cliente_actual())) then
        new.autor_rol := 'socio';
      end if;
    end if;
  end if;
  new.autor_nombre := coalesce(nullif(trim(v_nombre), ''), new.autor_nombre);
  return new;
end;
$$;

-- 4. Origen de la solicitud: la del portal para SU carpeta es 'portal' aunque la cargue
--    alguien del equipo (si no, el Jefe la mandaba a Portería).
create or replace function private.preparar_solicitud()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_rol public.rol_usuario := private.rol_actual();
  v_esp record;
  v_portal_propio boolean;
begin
  -- Semillas / service role: se respeta lo que viene.
  if v_uid is null then return new; end if;

  -- 0066: alguien del equipo que la carga desde «Mi lugar en el mercado» para su carpeta.
  v_portal_propio := coalesce(
    v_rol <> 'socio' and new.origen = 'portal'
      and new.cliente_id is not null and new.cliente_id = private.cliente_actual(),
    false);

  -- Seguimiento siempre vacío al nacer.
  new.revisada_por := null;
  new.revisada_en := null;
  new.derivada_consejo_en := null;
  new.resolucion := null;
  new.resolucion_de := null;
  new.resuelta_por := null;
  new.resuelta_en := null;
  new.asignada_a := null;
  new.asignada_en := null;
  new.ejecutada_por := null;
  new.ejecutada_en := null;
  new.nota_ejecucion := null;
  new.cerrada_en := null;
  new.elevada_por := null;
  new.elevada_en := null;
  new.creada_por := v_uid;
  new.creada_en := now();
  new.actualizada_en := now();

  -- El origen lo decide el rol de quien la carga (Administración y el Líder eligen: cargan
  -- formularios en papel de otros).
  new.origen := case
    when v_portal_propio then 'portal'::public.origen_solicitud
    else case v_rol
      when 'socio' then 'portal'::public.origen_solicitud
      when 'porteria' then 'porteria'::public.origen_solicitud
      when 'guardia' then 'porteria'::public.origen_solicitud
      when 'tesoreria' then 'tesoreria'::public.origen_solicitud
      when 'admin' then coalesce(new.origen, 'administracion'::public.origen_solicitud)
      when 'lider' then coalesce(new.origen, 'lider'::public.origen_solicitud)
      else coalesce(new.origen, 'lider'::public.origen_solicitud)
    end
  end;

  -- Estado EXACTO del contrato (§4.10): se decide por el ROL de quien carga, no por el
  -- origen. Lo de Portería va al Jefe (si hay uno activo); los avisos del Jefe van al Líder.
  new.estado := case
    when v_rol = 'porteria' and not v_portal_propio and exists (
      select 1 from public.perfiles p
      where p.org_id = new.org_id and p.rol = 'guardia' and p.activo)
    then 'con_jefe'::public.estado_solicitud
    else 'nueva'::public.estado_solicitud
  end;

  -- Con un lugar del plano y sin referencia escrita: "Puesto 58" (el Jefe y Portería no
  -- leen la tabla espacios; ven el puesto por esta referencia).
  if new.espacio_id is not null and coalesce(trim(new.referencia), '') = '' then
    select es.tipo, es.numero, es.medio into v_esp
    from public.espacios es
    where es.id = new.espacio_id and es.org_id = new.org_id;
    if found then
      new.referencia := case v_esp.tipo
        when 'puesto' then 'Puesto ' || coalesce(v_esp.numero, '?') || case when v_esp.medio then '½' else '' end
        when 'local' then 'Local ' || coalesce(v_esp.numero, '?')
        when 'contenedor' then 'Contéiner ' || coalesce(v_esp.numero, '?')
        when 'galpon' then 'Galpón ' || coalesce(v_esp.numero, '?')
        when 'cochera' then 'Cochera ' || coalesce(v_esp.numero, '?')
        when 'quinta' then 'Quinta ' || coalesce(v_esp.numero, '?')
        when 'bar' then coalesce(v_esp.numero, 'Bar')
        else initcap(v_esp.tipo) || ' ' || coalesce(v_esp.numero, '')
      end;
    end if;
  end if;

  return new;
end $$;

-- 5. Marcar como visto un aviso de SU carpeta (antes: solo el rol socio).
create or replace function public.marcar_registro_visto(p_registro uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_cliente uuid;
begin
  if v_org is null then raise exception 'Sin perfil activo'; end if;
  -- 0066: el socio o alguien del equipo con su carpeta unida (cliente_actual), solo lo suyo.
  v_cliente := private.cliente_actual();
  if v_cliente is null then raise exception 'Registro inexistente'; end if;
  update public.sanciones s
  set visto_en = coalesce(s.visto_en, now()),
      socio_leyo_en = now()
  where s.id = p_registro and s.org_id = v_org and s.cliente_id = v_cliente;
  if not found then raise exception 'Registro inexistente'; end if;
end;
$$;

-- 6. Los recibos de SU carpeta.
create or replace function public.datos_recibo(p_pago uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_rol public.rol_usuario := private.rol_actual();
  v_pago public.pagos;
  v_primera public.pagos;
  v_socio boolean;
  v_propio boolean;
  v_cli public.clientes;
  v_caja public.cajas;
  v_lineas jsonb;
  v_imputaciones jsonb;
  v_despues jsonb;
  v_total numeric;
  v_total_original numeric;
  v_imputado numeric;
  v_anulado boolean;
begin
  if v_org is null or v_rol is null then
    raise exception 'Recibo inexistente';
  end if;

  select * into v_pago from public.pagos where id = p_pago and org_id = v_org;
  if not found then
    raise exception 'Recibo inexistente';
  end if;
  -- 0066: el recibo de SU carpeta lo ve quien la tiene unida a su usuario (el socio o alguien
  -- del equipo con carpeta propia). Si su rol no ve todo, lo ve como lo ve un socio.
  v_propio := coalesce(v_pago.cliente_id = private.cliente_actual(), false);
  if not v_propio and v_rol not in ('admin','tesoreria','lider','guardia') then
    raise exception 'Recibo inexistente';
  end if;
  v_socio := v_rol = 'socio' or (v_propio and v_rol not in ('admin','tesoreria','lider'));
  -- 0052: el Jefe también ve los recibos cobrados en una caja de portería (la cochera de un
  -- puestero o de un empleado).
  if v_rol = 'guardia' and not v_propio and not private.cliente_de_porteria(v_pago.cliente_id)
     and not private.caja_de_porteria(v_pago.caja_id) then
    raise exception 'Recibo inexistente';
  end if;

  select * into v_primera from public.pagos
  where lote_id = v_pago.lote_id
  order by linea limit 1;
  select * into v_cli from public.clientes where id = v_pago.cliente_id;
  select * into v_caja from public.cajas where id = v_primera.caja_id;

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'pago_id', p.id,
      'linea', p.linea,
      'medio', p.medio,
      'monto', p.monto,
      'anulado', p.anulado,
      'anulado_en', p.anulado_en,
      'motivo_anulacion', p.motivo_anulacion,
      'titular_transferencia', p.titular_transferencia,
      'tiene_comprobante', p.comprobante_path is not null,
      'comprobante_path', case when v_socio then null else p.comprobante_path end,
      'cheque', case when ch.id is null then null else jsonb_build_object(
        'numero', ch.numero,
        'cuit', ch.cuit,
        'recibido_de', coalesce(ch.recibido_de, ch.titular),
        'fecha_recibido', ch.fecha_recibido,
        'fecha_cobro', ch.fecha_cobro,
        'puesto', ch.puesto,
        'estado', case when v_socio then null else ch.estado end,
        'proveedor', case when v_socio then null else ch.proveedor end) end
    ) order by p.linea), '[]'::jsonb),
    coalesce(sum(p.monto) filter (where not p.anulado), 0),
    coalesce(sum(p.monto), 0),
    coalesce(bool_and(p.anulado), false)
  into v_lineas, v_total, v_total_original, v_anulado
  from public.pagos p
  left join public.cheques ch on ch.id = p.cheque_id
  where p.lote_id = v_pago.lote_id;

  -- Detalle del comprobante: SOLO lo imputado en el cobro. Si después el saldo a favor de este
  -- recibo pagó deudas nuevas (private.aplicar_saldo_favor, origen 'saldo_favor'), el recibo
  -- entregado no cambia: eso va aparte en "aplicado_despues".
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'cargo_id', x.cargo_id,
      'codigo', x.codigo,
      'descripcion', x.descripcion,
      'periodo', x.periodo,
      'monto', x.monto,
      'beneficio', x.beneficio) order by x.periodo, x.orden, x.codigo), '[]'::jsonb),
    coalesce(sum(x.monto), 0)
  into v_imputaciones, v_imputado
  from (
    select c.id as cargo_id, c.codigo, c.descripcion, c.periodo,
           coalesce(co.orden_imputacion, 0) as orden,
           sum(i.monto) as monto,
           -- El beneficio por pago en término va en el recibo que TERMINÓ de pagar el cargo. Si
           -- después otro cobro (número mayor) o un saldo a favor le imputó algo, este recibo
           -- lo pagó en parte y no muestra el beneficio (antes aparecía al reimprimirlo).
           case when c.estado = 'pagado' and not exists (
                  select 1
                  from public.imputaciones i2
                  join public.pagos p2 on p2.id = i2.pago_id and not p2.anulado
                  where i2.cargo_id = c.id
                    and ((i2.origen = 'cobro' and p2.lote_id <> v_pago.lote_id and p2.numero > v_pago.numero)
                         or (i2.origen = 'saldo_favor' and i2.creado_en > v_primera.fecha)))
                then c.descuento_aplicado else 0 end as beneficio
    from public.imputaciones i
    join public.pagos pp on pp.id = i.pago_id and not pp.anulado
    join public.cargos c on c.id = i.cargo_id
    left join public.conceptos co on co.id = c.concepto_id
    where pp.lote_id = v_pago.lote_id
      and i.origen = 'cobro'
    group by c.id, c.codigo, c.descripcion, c.periodo, co.orden_imputacion, c.estado, c.descuento_aplicado
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object(
      'cargo_id', y.cargo_id,
      'codigo', y.codigo,
      'descripcion', y.descripcion,
      'periodo', y.periodo,
      'monto', y.monto,
      'fecha', y.fecha) order by y.fecha, y.periodo, y.codigo), '[]'::jsonb)
  into v_despues
  from (
    select c.id as cargo_id, c.codigo, c.descripcion, c.periodo,
           sum(i.monto) as monto, min(i.creado_en) as fecha
    from public.imputaciones i
    join public.pagos pp on pp.id = i.pago_id and not pp.anulado
    join public.cargos c on c.id = i.cargo_id
    where pp.lote_id = v_pago.lote_id
      and i.origen = 'saldo_favor'
    group by c.id, c.codigo, c.descripcion, c.periodo
  ) y;

  return jsonb_build_object(
    'numero', v_pago.numero,
    'lote_id', v_pago.lote_id,
    'fecha', v_primera.fecha,
    'anulado', v_anulado,
    'cliente', jsonb_build_object(
      'id', v_cli.id, 'codigo', v_cli.codigo, 'nombre', v_cli.nombre, 'apodo', v_cli.apodo),
    'caja', jsonb_build_object(
      'tipo', v_caja.tipo,
      'label', case v_caja.tipo when 'guardia' then 'Caja de portería' else 'Administración' end,
      'fecha', v_caja.fecha),
    'recibio', (select pf.nombre from public.perfiles pf where pf.user_id = v_primera.recibido_por),
    'notas', case when v_socio then null else v_primera.notas end,
    'total', v_total,
    -- 0023: lo que decía el recibo antes de anularse (un recibo anulado no muestra "$ 0").
    'total_original', v_total_original,
    'lineas', v_lineas,
    'imputaciones', v_imputaciones,
    'saldo_favor', greatest(v_total - v_imputado, 0),
    'aplicado_despues', v_despues);
end $$;

-- 7. El PDF de las circulares que le llegan a SU carpeta (antes: solo el rol socio).
drop policy if exists "socios leen circulares" on storage.objects;
create policy "socios leen circulares" on storage.objects for select to authenticated
  using (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = (select (private.org_actual())::text)
    and (storage.foldername(name))[2] = 'circulares'
    and ((select private.rol_actual()) = 'socio' or (select private.cliente_actual()) is not null)
    and exists (select 1 from public.circulares c where c.storage_path = objects.name)
  );

-- 8. DNI de la carpeta (espejo de dniDesdeCuit): "12.345.678" → "12345678";
--    CUIT "20-12345678-3" → "12345678". Solo personas físicas; null si no se puede.
create or replace function private.dni_de_carpeta(p_cuit text, p_tipo text)
returns text
language sql immutable set search_path = '' as $$
  select case
    when coalesce(p_tipo, '') <> 'fisica' then null
    when length(d) in (7, 8) then d
    when length(d) = 11 and ltrim(substr(d, 3, 8), '0') ~ '^[0-9]{7,8}$' then ltrim(substr(d, 3, 8), '0')
    else null
  end
  from (select regexp_replace(coalesce(p_cuit, ''), '[^0-9]', '', 'g') as d) x
$$;
revoke all on function private.dni_de_carpeta(text, text) from public, anon;
grant execute on function private.dni_de_carpeta(text, text) to authenticated;

-- 9. Unir la carpeta al usuario del equipo que tiene su DNI (solo el Líder).
create or replace function public.unir_carpeta_equipo(p_cliente uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_cli public.clientes;
  v_dni text;
  v_perfil public.perfiles;
begin
  if v_org is null or private.rol_actual() is distinct from 'lider' then
    raise exception 'Solo el Líder de Procesos une una carpeta al usuario de alguien del equipo';
  end if;
  select * into v_cli from public.clientes
  where id = p_cliente and org_id = v_org
  for update;
  if not found then raise exception 'Ese cliente no existe'; end if;
  if not v_cli.activo then raise exception 'Ese cliente está dado de baja'; end if;
  if v_cli.categoria not in ('puestero', 'quintero') then
    raise exception 'El portal es solo para puesteros y quinteros';
  end if;
  if v_cli.auth_user_id is not null then
    raise exception '% ya tiene acceso al portal', v_cli.nombre;
  end if;
  v_dni := private.dni_de_carpeta(v_cli.cuit, v_cli.tipo_persona::text);
  if v_dni is null then
    raise exception 'La carpeta no tiene el DNI cargado: cargalo en la ficha del cliente';
  end if;
  select * into v_perfil from public.perfiles p
  where p.dni = v_dni and p.org_id = v_org;
  if not found or v_perfil.rol in ('socio', 'consejo') or v_perfil.superadmin then
    raise exception 'Nadie del equipo entra con el DNI de esta carpeta';
  end if;
  if not v_perfil.activo then
    raise exception '% no tiene acceso al sistema: devolvéselo antes', v_perfil.nombre;
  end if;
  if exists (select 1 from public.clientes c where c.auth_user_id = v_perfil.user_id) then
    raise exception '% ya tiene otra carpeta unida a su usuario', v_perfil.nombre;
  end if;
  update public.clientes set auth_user_id = v_perfil.user_id where id = v_cli.id;
  return jsonb_build_object('user_id', v_perfil.user_id, 'nombre', v_perfil.nombre, 'rol', v_perfil.rol);
end $$;
revoke all on function public.unir_carpeta_equipo(uuid) from public, anon;
grant execute on function public.unir_carpeta_equipo(uuid) to authenticated;
comment on function public.unir_carpeta_equipo(uuid) is
  '0066 · Líder: une la carpeta al usuario del equipo con el DNI de la carpeta (la ve en «Mi lugar en el mercado»).';

-- 10. Separarla (vuelve a «Sin acceso»; su usuario del equipo sigue igual).
create or replace function public.separar_carpeta_equipo(p_cliente uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.org_actual();
  v_n integer;
begin
  if v_org is null or private.rol_actual() is distinct from 'lider' then
    raise exception 'Solo el Líder de Procesos separa una carpeta del usuario de alguien del equipo';
  end if;
  update public.clientes c
     set auth_user_id = null
   where c.id = p_cliente
     and c.org_id = v_org
     and exists (
       select 1 from public.perfiles p
       where p.user_id = c.auth_user_id and p.rol <> 'socio');
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'Esa carpeta no está unida al usuario de nadie del equipo'; end if;
end $$;
revoke all on function public.separar_carpeta_equipo(uuid) from public, anon;
grant execute on function public.separar_carpeta_equipo(uuid) to authenticated;
comment on function public.separar_carpeta_equipo(uuid) is
  '0066 · Líder: separa la carpeta del usuario del equipo (su usuario sigue igual).';
