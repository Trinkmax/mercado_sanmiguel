-- ============================================================
-- 0065 · El alta de un cliente con el mes ya generado pregunta desde cuándo paga
--
-- Pedido de Franco del 15/11/2026 (audio): "si nosotros creamos ahora este quintero… necesitamos
-- generarle las expensas, porque nosotros lo creamos el uno, los conceptos, y a este lo estamos
-- agregando después: no va a tener asignado lo que tengo que cobrar en el mes".
-- generar_periodo ya había corrido: el cliente nuevo quedaba sin nada hasta el mes siguiente
-- (carpeta 170; se le cargó noviembre a mano).
--
-- Igual que el cambio de la carpeta (0057): el alta lleva datos.corregir_desde = el primer mes
-- en que paga. Cuando se aplica (en el acto si la hace el Líder, o al aprobarla), este trigger
-- le carga los meses ya generados desde ese mes, como lo hubiera hecho generar_periodo. Si se
-- eligió el mes que viene (o el alta no lo trae), no hace nada: entra con la próxima generación.
-- ============================================================

create or replace function private.tg_alta_rige_desde()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_desde text := new.datos ->> 'corregir_desde';
  v_mes date;
  v_cc record;
  v_p record;
  v_n jsonb;
  v_id uuid;
  v_nuevos int := 0;
begin
  if new.resultado_id is null then return null; end if;
  if v_desde is null or v_desde !~ '^[0-9]{4}-[0-9]{2}-01$' then return null; end if;
  -- Un alta que se aprueba ya en otro mes paga desde el mes en curso: lo de meses anteriores
  -- no se carga desde acá (misma regla que tg_cambio_rige_desde).
  v_mes := greatest(v_desde::date, date_trunc('month', private.hoy_ar())::date);

  for v_p in
    select pe.periodo, pe.vencimiento
    from public.periodos pe
    where pe.org_id = new.org_id and pe.periodo >= v_mes and pe.generado_en is not null
    order by pe.periodo
  loop
    for v_cc in
      select cc.concepto_id
      from public.cliente_conceptos cc
      join public.conceptos co on co.id = cc.concepto_id
      where cc.cliente_id = new.resultado_id and cc.org_id = new.org_id and co.tipo = 'recurrente'
      order by co.orden_imputacion, co.codigo
    loop
      v_n := private.carpeta_concepto(new.resultado_id, v_cc.concepto_id);
      continue when v_n is null or not (v_n ->> 'existe')::boolean;
      v_id := null;
      insert into public.cargos (
        org_id, periodo, cliente_id, concepto_id, codigo, descripcion, cantidad, precio_unitario,
        monto, descuento_pronto_pago, vencimiento, origen, creado_por)
      select new.org_id, v_p.periodo, new.resultado_id, co.id, co.codigo, v_n ->> 'descripcion',
             (v_n ->> 'cantidad')::numeric, (v_n ->> 'precio_unitario')::numeric,
             (v_n ->> 'monto')::numeric, (v_n ->> 'descuento_pronto_pago')::numeric,
             v_p.vencimiento, 'generacion', (select auth.uid())
      from public.conceptos co where co.id = v_cc.concepto_id
      on conflict (cliente_id, concepto_id, periodo) where origen = 'generacion' and estado <> 'anulado'
      do nothing
      returning id into v_id;
      if v_id is not null then v_nuevos := v_nuevos + 1; end if;
    end loop;
  end loop;

  if v_nuevos > 0 then
    perform private.aplicar_saldo_favor(new.resultado_id);
  end if;
  return null;
end $$;
revoke all on function private.tg_alta_rige_desde() from public, anon, authenticated;
comment on function private.tg_alta_rige_desde() is
  'Al aplicarse el alta de un cliente con datos.corregir_desde: le carga los meses ya generados desde ese mes, como generar_periodo (0065).';

drop trigger if exists altas_rigen_desde on public.cambios_pendientes;
create trigger altas_rigen_desde
  after update of estado on public.cambios_pendientes
  for each row
  when (old.estado = 'pendiente' and new.estado = 'aprobado'
        and new.entidad = 'cliente' and new.accion = 'alta' and new.datos ? 'corregir_desde')
  execute function private.tg_alta_rige_desde();
