-- ============================================================
-- 0005 Ajustes de performance: políticas de escritura separadas
-- (evita doble evaluación en SELECT) + índices de FKs usadas en joins.
-- ============================================================

drop policy "gestionar perfiles" on public.perfiles;
create policy "insertar perfiles" on public.perfiles for insert to authenticated
  with check (private.tiene_rol(org_id, array['admin','consejo']::public.rol_usuario[]));
create policy "editar perfiles" on public.perfiles for update to authenticated
  using (private.tiene_rol(org_id, array['admin','consejo']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['admin','consejo']::public.rol_usuario[]));
create policy "borrar perfiles" on public.perfiles for delete to authenticated
  using (private.tiene_rol(org_id, array['admin','consejo']::public.rol_usuario[]));

drop policy "gestionar conceptos" on public.conceptos;
create policy "insertar conceptos" on public.conceptos for insert to authenticated
  with check (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]));
create policy "editar conceptos" on public.conceptos for update to authenticated
  using (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]));
create policy "borrar conceptos" on public.conceptos for delete to authenticated
  using (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]));

drop policy "gestionar rubros" on public.rubros_gasto;
create policy "insertar rubros" on public.rubros_gasto for insert to authenticated
  with check (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]));
create policy "editar rubros" on public.rubros_gasto for update to authenticated
  using (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]));
create policy "borrar rubros" on public.rubros_gasto for delete to authenticated
  using (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]));

drop policy "gestionar configuracion" on public.configuracion;
create policy "insertar configuracion" on public.configuracion for insert to authenticated
  with check (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]));
create policy "editar configuracion" on public.configuracion for update to authenticated
  using (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]));

drop policy "gestionar items de cliente" on public.cliente_conceptos;
create policy "insertar items de cliente" on public.cliente_conceptos for insert to authenticated
  with check (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]));
create policy "editar items de cliente" on public.cliente_conceptos for update to authenticated
  using (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]));
create policy "borrar items de cliente" on public.cliente_conceptos for delete to authenticated
  using (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]));

drop policy "gestionar medidores" on public.medidores;
create policy "insertar medidores" on public.medidores for insert to authenticated
  with check (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]));
create policy "editar medidores" on public.medidores for update to authenticated
  using (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]));
create policy "borrar medidores" on public.medidores for delete to authenticated
  using (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]));

drop policy "gestionar sanciones" on public.sanciones;
create policy "insertar sanciones" on public.sanciones for insert to authenticated
  with check (private.tiene_rol(org_id, array['admin','consejo']::public.rol_usuario[]));
create policy "editar sanciones" on public.sanciones for update to authenticated
  using (private.tiene_rol(org_id, array['admin','consejo']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['admin','consejo']::public.rol_usuario[]));
create policy "borrar sanciones" on public.sanciones for delete to authenticated
  using (private.tiene_rol(org_id, array['admin','consejo']::public.rol_usuario[]));

drop policy "gestionar gastos" on public.gastos;
create policy "insertar gastos" on public.gastos for insert to authenticated
  with check (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]));
create policy "editar gastos" on public.gastos for update to authenticated
  using (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]));
create policy "borrar gastos" on public.gastos for delete to authenticated
  using (private.tiene_rol(org_id, array['admin','tesoreria','consejo']::public.rol_usuario[]));
-- Nota: 0006 recrea las políticas de gastos SIN consejo (solo lectura).

drop policy "gestionar movimientos tesoreria" on public.movimientos_tesoreria;
create policy "insertar movimientos tesoreria" on public.movimientos_tesoreria for insert to authenticated
  with check (private.tiene_rol(org_id, array['tesoreria']::public.rol_usuario[]));
create policy "editar movimientos tesoreria" on public.movimientos_tesoreria for update to authenticated
  using (private.tiene_rol(org_id, array['tesoreria']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['tesoreria']::public.rol_usuario[]));
create policy "borrar movimientos tesoreria" on public.movimientos_tesoreria for delete to authenticated
  using (private.tiene_rol(org_id, array['tesoreria']::public.rol_usuario[]));

drop policy "gestionar saldos iniciales" on public.saldos_iniciales;
create policy "insertar saldos iniciales" on public.saldos_iniciales for insert to authenticated
  with check (private.tiene_rol(org_id, array['tesoreria']::public.rol_usuario[]));
create policy "editar saldos iniciales" on public.saldos_iniciales for update to authenticated
  using (private.tiene_rol(org_id, array['tesoreria']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['tesoreria']::public.rol_usuario[]));
create policy "borrar saldos iniciales" on public.saldos_iniciales for delete to authenticated
  using (private.tiene_rol(org_id, array['tesoreria']::public.rol_usuario[]));

-- Índices de FKs realmente usadas en joins
create index if not exists cargos_concepto_idx on public.cargos(concepto_id);
create index if not exists gastos_rubro_idx on public.gastos(rubro_id);
create index if not exists cheques_cliente_idx on public.cheques(cliente_id);
create index if not exists cliente_conceptos_concepto_idx on public.cliente_conceptos(concepto_id);
