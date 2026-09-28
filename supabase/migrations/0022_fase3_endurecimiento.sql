-- ============================================================
-- Mercado San Miguel — 0022 Fase 3: endurecimiento (CONTRACT)
-- Contrato: docs/FASE3-CONTRATO.md §3 y §10.
--
-- NO se aplica junto con 0010/0011/0012. Se aplica DESPUÉS de todas las
-- 0013…0021_fase3_<modulo>.sql y EN LA MISMA VENTANA DE MANTENIMIENTO que el
-- deploy del código de la fase 3: cierra accesos que la app de fase 2 todavía
-- usa (Jefe cargando canon, Administración depositando cheques, upsert de
-- saldos por medio, alta directa de sanciones, columnas de autoría, etc.).
-- Aplicarla antes rompe la app desplegada.
-- Se aplica como UNA transacción.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Clientes y su cuenta: el Jefe de Portería solo LEE quinteros y
--    ambulantes; Portería deja de leer clientes. Administración y Tesorería
--    siguen leyendo todo (joins de caja, cheques, conciliación, público de
--    circulares). La separación por categoría en ESCRITURA la hacen las RPC.
-- ------------------------------------------------------------
drop policy if exists "staff lee clientes" on public.clientes;
create policy "staff lee clientes" on public.clientes for select to authenticated using (
  private.tiene_rol(org_id, array['admin','tesoreria','consejo','lider']::public.rol_usuario[])
  or (private.tiene_rol(org_id, array['guardia']::public.rol_usuario[]) and categoria in ('quintero','ambulante'))
  or auth_user_id = (select auth.uid()));

drop policy if exists "leer items de cliente" on public.cliente_conceptos;
create policy "leer items de cliente" on public.cliente_conceptos for select to authenticated using (
  private.tiene_rol(org_id, array['admin','tesoreria','consejo','lider']::public.rol_usuario[])
  or (private.tiene_rol(org_id, array['guardia']::public.rol_usuario[]) and private.cliente_de_porteria(cliente_id))
  or cliente_id = (select private.cliente_actual()));

drop policy if exists "leer cargos" on public.cargos;
create policy "leer cargos" on public.cargos for select to authenticated using (
  private.tiene_rol(org_id, array['admin','tesoreria','consejo','lider']::public.rol_usuario[])
  or (private.tiene_rol(org_id, array['guardia']::public.rol_usuario[]) and private.cliente_de_porteria(cliente_id))
  or cliente_id = (select private.cliente_actual()));

drop policy if exists "leer pagos" on public.pagos;
create policy "leer pagos" on public.pagos for select to authenticated using (
  private.tiene_rol(org_id, array['admin','tesoreria','consejo','lider']::public.rol_usuario[])
  or (private.tiene_rol(org_id, array['guardia']::public.rol_usuario[]) and private.cliente_de_porteria(cliente_id))
  or cliente_id = (select private.cliente_actual()));

drop policy if exists "leer imputaciones" on public.imputaciones;
create policy "leer imputaciones" on public.imputaciones for select to authenticated using (
  private.tiene_rol(org_id, array['admin','tesoreria','consejo','lider']::public.rol_usuario[])
  or exists (
    select 1 from public.pagos p
    where p.id = imputaciones.pago_id
      and (p.cliente_id = (select private.cliente_actual())
           or (private.tiene_rol(imputaciones.org_id, array['guardia']::public.rol_usuario[])
               and private.cliente_de_porteria(p.cliente_id)))));

drop policy if exists "leer medidores" on public.medidores;
create policy "leer medidores" on public.medidores for select to authenticated using (
  private.tiene_rol(org_id, array['admin','tesoreria','consejo','lider']::public.rol_usuario[])
  or (private.tiene_rol(org_id, array['guardia']::public.rol_usuario[]) and private.cliente_de_porteria(cliente_id))
  or cliente_id = (select private.cliente_actual()));

drop policy if exists "leer lecturas" on public.lecturas;
create policy "leer lecturas" on public.lecturas for select to authenticated using (
  private.tiene_rol(org_id, array['admin','tesoreria','consejo','lider']::public.rol_usuario[])
  or exists (
    select 1 from public.medidores m
    where m.id = lecturas.medidor_id
      and (m.cliente_id = (select private.cliente_actual())
           or (private.tiene_rol(lecturas.org_id, array['guardia']::public.rol_usuario[])
               and private.cliente_de_porteria(m.cliente_id)))));

-- Deuda anterior (RD) y cargos manuales: Administración (sobre puesteros) y el Líder. Sin Tesorería (J4).
-- Un cargo directo nace pendiente y sin pagos: nada de cargos "cobrados" sin plata ni colgados
-- de un lote o de una lectura (grants por columna + check).
drop policy if exists "cargo manual" on public.cargos;
create policy "cargo manual" on public.cargos for insert to authenticated with check (
  private.tiene_rol(org_id, array['admin','lider']::public.rol_usuario[])
  and origen in ('manual','deuda')
  and estado = 'pendiente' and monto_pagado = 0 and descuento_aplicado = 0
  and private.puede_gestionar_cliente(cliente_id));
revoke insert, update, truncate on public.cargos from authenticated;
grant insert (org_id, periodo, cliente_id, concepto_id, codigo, descripcion, cantidad, precio_unitario,
              monto, descuento_pronto_pago, vencimiento, origen)
  on public.cargos to authenticated;

-- Medidores: Administración y el Líder (Energía es de Administración para todas las categorías).
drop policy if exists "insertar medidores" on public.medidores;
create policy "insertar medidores" on public.medidores for insert to authenticated
  with check (private.tiene_rol(org_id, array['admin','lider']::public.rol_usuario[]));
drop policy if exists "editar medidores" on public.medidores;
create policy "editar medidores" on public.medidores for update to authenticated
  using (private.tiene_rol(org_id, array['admin','lider']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['admin','lider']::public.rol_usuario[]));
drop policy if exists "borrar medidores" on public.medidores;
create policy "borrar medidores" on public.medidores for delete to authenticated
  using (private.tiene_rol(org_id, array['admin','lider']::public.rol_usuario[]));


-- ------------------------------------------------------------
-- 2. Documentos de la carpeta: cada rol sobre SUS clientes (G7, G8, J4)
-- ------------------------------------------------------------
drop policy if exists "leer documentos" on public.documentos_cliente;
create policy "leer documentos" on public.documentos_cliente for select to authenticated using (
  private.puede_gestionar_cliente(cliente_id) or cliente_id = (select private.cliente_actual()));
drop policy if exists "subir documentos" on public.documentos_cliente;
create policy "subir documentos" on public.documentos_cliente for insert to authenticated with check (
  private.puede_gestionar_cliente(cliente_id) or cliente_id = (select private.cliente_actual()));
drop policy if exists "borrar documentos" on public.documentos_cliente;
create policy "borrar documentos" on public.documentos_cliente for delete to authenticated using (
  private.puede_gestionar_cliente(cliente_id));
-- Autoría: subido_por la pone el servidor (default auth.uid(), 0011). Sin UPDATE directo.
revoke insert, update, truncate on public.documentos_cliente from authenticated;
grant insert (org_id, cliente_id, categoria, titulo, storage_path, mime) on public.documentos_cliente to authenticated;

-- Comprobantes de transferencia ({org}/comprobantes): la policy de fase 2 le daba al Jefe
-- ALL sobre TODA la carpeta (incluidos los comprobantes de puesteros que cobra Administración).
-- Ahora: sube; lee solo los que referencia un pago que su RLS le deja ver (clientes de
-- Portería); borra solo lo que subió él y que ningún pago usa (rollback de un cobro fallido).
drop policy if exists "cobradores gestionan comprobantes" on storage.objects;
drop policy if exists "jefe sube comprobantes" on storage.objects;
create policy "jefe sube comprobantes" on storage.objects for insert to authenticated with check (
  bucket_id = 'documentos'
  and (storage.foldername(name))[1] = (select private.org_actual()::text)
  and (storage.foldername(name))[2] = 'comprobantes'
  and (select private.rol_actual()) = 'guardia');
drop policy if exists "jefe lee comprobantes de sus cobros" on storage.objects;
create policy "jefe lee comprobantes de sus cobros" on storage.objects for select to authenticated using (
  bucket_id = 'documentos'
  and (storage.foldername(name))[1] = (select private.org_actual()::text)
  and (storage.foldername(name))[2] = 'comprobantes'
  and (select private.rol_actual()) = 'guardia'
  and exists (select 1 from public.pagos p where p.comprobante_path = objects.name));
drop policy if exists "jefe borra comprobantes sin usar" on storage.objects;
create policy "jefe borra comprobantes sin usar" on storage.objects for delete to authenticated using (
  bucket_id = 'documentos'
  and (storage.foldername(name))[1] = (select private.org_actual()::text)
  and (storage.foldername(name))[2] = 'comprobantes'
  and (select private.rol_actual()) = 'guardia'
  and owner_id = (select auth.uid())::text
  and not exists (select 1 from public.pagos p where p.comprobante_path = objects.name));

drop policy if exists "jefe gestiona documentos de sus clientes" on storage.objects;
create policy "jefe gestiona documentos de sus clientes" on storage.objects for all to authenticated
using (
  bucket_id = 'documentos'
  and (storage.foldername(name))[1] = (select private.org_actual()::text)
  and (storage.foldername(name))[2] = 'clientes'
  and (select private.rol_actual()) = 'guardia'
  and private.carpeta_de_porteria((storage.foldername(name))[3]))
with check (
  bucket_id = 'documentos'
  and (storage.foldername(name))[1] = (select private.org_actual()::text)
  and (storage.foldername(name))[2] = 'clientes'
  and (select private.rol_actual()) = 'guardia'
  and private.carpeta_de_porteria((storage.foldername(name))[3]));


-- ------------------------------------------------------------
-- 3. Aprobaciones: el Jefe ve sus propuestas; Tesorería sale (J4, J7)
-- ------------------------------------------------------------
drop policy if exists "leer cambios pendientes" on public.cambios_pendientes;
create policy "leer cambios pendientes" on public.cambios_pendientes for select to authenticated using (
  private.tiene_rol(org_id, array['lider','consejo','admin']::public.rol_usuario[])
  or (private.tiene_rol(org_id, array['guardia']::public.rol_usuario[])
      and (solicitado_por = (select auth.uid())
           or (cliente_id is not null and private.cliente_de_porteria(cliente_id)))));


-- ------------------------------------------------------------
-- 4. Cheques: el módulo es de Tesorería (E1). Administración los sigue
--    recibiendo por registrar_cobro y leyendo (recibo, caja). El Jefe no (G2).
-- ------------------------------------------------------------
drop policy if exists "leer cheques" on public.cheques;
create policy "leer cheques" on public.cheques for select to authenticated using (
  private.tiene_rol(org_id, array['admin','tesoreria','consejo','lider']::public.rol_usuario[]));
drop policy if exists "actualizar cheques" on public.cheques;
create policy "actualizar cheques" on public.cheques for update to authenticated
  using (private.tiene_rol(org_id, array['tesoreria']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['tesoreria']::public.rol_usuario[]));
revoke insert, update, delete, truncate on public.cheques from authenticated;
-- Escritura directa solo para depositar / acreditar (el trigger de M6 valida transiciones);
-- entregar, rechazar y dar de alta van por RPC.
grant update (estado, fecha_depositado, fecha_acreditado, notas) on public.cheques to authenticated;


-- ------------------------------------------------------------
-- 5. Canon de transporte: solo por RPC (registrar_canon / anular_canon). Portería lee (H1, G4).
-- ------------------------------------------------------------
drop policy if exists "cargar canon" on public.canon_camiones;
drop policy if exists "borrar canon con caja abierta" on public.canon_camiones;
drop policy if exists "leer canon" on public.canon_camiones;
create policy "leer canon" on public.canon_camiones for select to authenticated using (
  private.tiene_rol(org_id, array['admin','guardia','porteria','tesoreria','consejo','lider']::public.rol_usuario[]));
revoke insert, update, delete, truncate on public.canon_camiones from authenticated;


-- ------------------------------------------------------------
-- 6. Plano (G11, H2, H3). La tabla espacios tiene cliente_id y nota (quién ocupa cada puesto):
--    el Jefe de Portería y Portería NO la leen directo; usan public.espacios_del_plano()
--    (0012: id, tipo, número, medio, propio, grupo y geometría, sin cliente ni nota).
--    Tesorería la sigue leyendo (ya lee todos los clientes). plano_elementos: todo el staff.
-- ------------------------------------------------------------
drop policy if exists "leer espacios" on public.espacios;
create policy "leer espacios" on public.espacios for select to authenticated using (
  private.tiene_rol(org_id, array['admin','tesoreria','consejo','lider']::public.rol_usuario[])
  or cliente_id = (select private.cliente_actual()));
drop policy if exists "leer plano" on public.plano_elementos;
create policy "leer plano" on public.plano_elementos for select to authenticated using (
  private.tiene_rol(org_id, array['admin','guardia','porteria','tesoreria','consejo','lider']::public.rol_usuario[]));


-- ------------------------------------------------------------
-- 6b. Perfiles: el Jefe, Portería y Tesorería ven solo al equipo (no los perfiles de los
--     socios: nombre y DNI de login). Administración, el Líder (y el Consejo) ven todos.
-- ------------------------------------------------------------
drop policy if exists "ver perfil propio o staff" on public.perfiles;
create policy "ver perfil propio o staff" on public.perfiles for select to authenticated using (
  user_id = (select auth.uid())
  or private.tiene_rol(org_id, array['admin','lider','consejo']::public.rol_usuario[])
  or (private.tiene_rol(org_id, array['guardia','porteria','tesoreria']::public.rol_usuario[])
      and rol <> 'socio'));


-- ------------------------------------------------------------
-- 7. Gastos: el pago solo por RPC (pagar_gasto / revertir_pago_gasto) (E4)
-- ------------------------------------------------------------
alter table public.gastos drop constraint if exists gastos_caja_efectivo;
alter table public.gastos add constraint gastos_caja_efectivo
  check (pagado_desde is distinct from 'caja' or medio_pago = 'efectivo');

revoke insert, update, truncate on public.gastos from authenticated;
-- creado_por: default auth.uid() (0011), no se puede falsear.
grant insert (org_id, rubro_id, tipo, descripcion, monto, vencimiento, factura_path, notas, periodo)
  on public.gastos to authenticated;
grant update (rubro_id, tipo, descripcion, monto, vencimiento, factura_path, notas, periodo, estado,
              comprobante_validado, validado_por, validado_en)
  on public.gastos to authenticated;

-- Un gasto pagado no se borra: se deshace el pago (queda en la bitácora de la caja).
drop policy if exists "borrar gastos" on public.gastos;
create policy "borrar gastos" on public.gastos for delete to authenticated using (
  private.tiene_rol(org_id, array['admin','tesoreria']::public.rol_usuario[]) and estado <> 'pagado');


-- ------------------------------------------------------------
-- 8. Tesorería: ajustes de caja visibles en la caja; escritura con caja solo por RPC (J3)
-- ------------------------------------------------------------
drop policy if exists "leer movimientos tesoreria" on public.movimientos_tesoreria;
create policy "leer movimientos tesoreria" on public.movimientos_tesoreria for select to authenticated using (
  private.tiene_rol(org_id, array['tesoreria','consejo','lider']::public.rol_usuario[])
  or (caja_id is not null and private.tiene_rol(org_id, array['admin']::public.rol_usuario[]))
  or (caja_id is not null and private.tiene_rol(org_id, array['guardia']::public.rol_usuario[])
      and exists (select 1 from public.cajas c where c.id = movimientos_tesoreria.caja_id and c.tipo = 'guardia')));
drop policy if exists "editar movimientos tesoreria" on public.movimientos_tesoreria;
create policy "editar movimientos tesoreria" on public.movimientos_tesoreria for update to authenticated
  using (private.tiene_rol(org_id, array['tesoreria']::public.rol_usuario[]) and caja_id is null)
  with check (private.tiene_rol(org_id, array['tesoreria']::public.rol_usuario[]) and caja_id is null);
drop policy if exists "borrar movimientos tesoreria" on public.movimientos_tesoreria;
create policy "borrar movimientos tesoreria" on public.movimientos_tesoreria for delete to authenticated
  using (private.tiene_rol(org_id, array['tesoreria']::public.rol_usuario[]) and caja_id is null);
revoke insert, update, truncate on public.movimientos_tesoreria from authenticated;
-- creado_por: default auth.uid() (0011). caja_id y ref: solo por RPC (registrar_ajuste_caja).
grant insert (org_id, fecha, tipo, descripcion, monto, moneda, cuenta, cuenta_destino, grupo_id)
  on public.movimientos_tesoreria to authenticated;
grant update (fecha, tipo, descripcion, monto, moneda, cuenta, cuenta_destino, grupo_id)
  on public.movimientos_tesoreria to authenticated;

-- Saldos iniciales por cuenta y moneda (J2): 4 combinaciones.
alter table public.saldos_iniciales drop constraint if exists saldos_iniciales_org_id_medio_key;
alter table public.saldos_iniciales drop constraint if exists saldos_iniciales_org_medio_moneda_key;
alter table public.saldos_iniciales add constraint saldos_iniciales_org_medio_moneda_key unique (org_id, medio, moneda);
alter table public.saldos_iniciales drop constraint if exists saldos_iniciales_medio_check;
alter table public.saldos_iniciales add constraint saldos_iniciales_medio_check check (medio in ('efectivo','transferencia'));


-- ------------------------------------------------------------
-- 9. Registros documentales: solo por RPC (emitir_registro, dejar_sin_efecto_multa,
--    marcar_registro_visto). Tesorería sale (J4).
-- ------------------------------------------------------------
drop policy if exists "leer sanciones" on public.sanciones;
create policy "leer sanciones" on public.sanciones for select to authenticated using (
  private.tiene_rol(org_id, array['admin','consejo','lider']::public.rol_usuario[])
  or cliente_id = (select private.cliente_actual()));
drop policy if exists "insertar sanciones" on public.sanciones;
drop policy if exists "editar sanciones" on public.sanciones;
drop policy if exists "borrar sanciones" on public.sanciones;
revoke insert, update, delete, truncate on public.sanciones from authenticated;


-- ------------------------------------------------------------
-- 10. Circulares por público (D2): el socio ve y confirma solo las suyas.
-- ------------------------------------------------------------
drop policy if exists "leer circulares" on public.circulares;
create policy "leer circulares" on public.circulares for select to authenticated using (
  private.tiene_rol(org_id, array['admin','tesoreria','consejo','lider']::public.rol_usuario[])
  or (private.es_miembro(org_id) and private.cliente_en_publico((select private.cliente_actual()), publico)));

drop policy if exists "confirmar recepcion" on public.circular_recepciones;
create policy "confirmar recepcion" on public.circular_recepciones for insert to authenticated with check (
  cliente_id = (select private.cliente_actual())
  and recibida_por = (select auth.uid())
  and exists (select 1 from public.circulares c
              where c.id = circular_recepciones.circular_id
                and c.org_id = circular_recepciones.org_id
                and c.activa));
revoke insert, update, delete, truncate on public.circular_recepciones from authenticated;
-- recibida_en la pone el servidor (default now()): el socio no puede falsear la hora de "La vio" (D1).
grant insert (org_id, circular_id, cliente_id, recibida_por) on public.circular_recepciones to authenticated;

drop policy if exists "socios leen circulares" on storage.objects;
create policy "socios leen circulares" on storage.objects for select to authenticated using (
  bucket_id = 'documentos'
  and (storage.foldername(name))[1] = (select private.org_actual()::text)
  and (storage.foldername(name))[2] = 'circulares'
  and (select private.rol_actual()) = 'socio'
  and exists (select 1 from public.circulares c where c.storage_path = objects.name));


-- ------------------------------------------------------------
-- 11. Solicitudes (H3, J5): el Jefe ve las de Portería; Tesorería solo las suyas.
--     Alta con columnas acotadas (cierra el agujero de insertar ya "resuelta").
-- ------------------------------------------------------------
drop policy if exists "leer solicitudes" on public.solicitudes;
create policy "leer solicitudes" on public.solicitudes for select to authenticated using (
  private.tiene_rol(org_id, array['admin','consejo','lider']::public.rol_usuario[])
  or creada_por = (select auth.uid())
  or cliente_id = (select private.cliente_actual())
  or (origen = 'porteria' and private.tiene_rol(org_id, array['guardia']::public.rol_usuario[])));
revoke insert on public.solicitudes from authenticated;
grant insert (org_id, tipo, asunto, detalle, cliente_id, referencia, origen, adjunto_path, creada_por, espacio_id)
  on public.solicitudes to authenticated;
grant update (espacio_id) on public.solicitudes to authenticated;


-- ------------------------------------------------------------
-- 12. Configuración: Administración y el Líder (J7: sin Tesorería; F5: sin Consejo).
--     El Jefe cambia solo las cuotas de los quinteros por RPC (guardar_cuotas_quinteros).
-- ------------------------------------------------------------
drop policy if exists "editar configuracion" on public.configuracion;
create policy "editar configuracion" on public.configuracion for update to authenticated
  using (private.tiene_rol(org_id, array['admin','lider']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['admin','lider']::public.rol_usuario[]));
drop policy if exists "insertar configuracion" on public.configuracion;
create policy "insertar configuracion" on public.configuracion for insert to authenticated
  with check (private.tiene_rol(org_id, array['admin','lider']::public.rol_usuario[]));
-- cuotas_default_quintero es del Jefe (G7): solo por guardar_cuotas_quinteros. Los precio_canon_*
-- están deprecados (tarifas_transporte / AMB): ya nadie los escribe.
revoke insert, update, truncate on public.configuracion from authenticated;
grant insert (org_id, dia_vencimiento, impresion_directa, actualizado_en, actualizado_por)
  on public.configuracion to authenticated;
grant update (dia_vencimiento, impresion_directa, actualizado_en, actualizado_por)
  on public.configuracion to authenticated;


-- ------------------------------------------------------------
-- 13. Ingresos de personal: los registra Portería (A4, G10). La lectura sigue para
--     Administración y el Jefe (Novedades H4).
-- ------------------------------------------------------------
drop policy if exists "registrar ingresos personal" on public.ingresos_personal;
create policy "registrar ingresos personal" on public.ingresos_personal for insert to authenticated
  with check (private.tiene_rol(org_id, array['porteria','lider']::public.rol_usuario[]));
drop policy if exists "marcar egreso personal" on public.ingresos_personal;
create policy "marcar egreso personal" on public.ingresos_personal for update to authenticated
  using (private.tiene_rol(org_id, array['porteria','lider']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['porteria','lider']::public.rol_usuario[]));
-- Las horas alimentan Novedades (H4): ingreso_en = now() y registrado_por = auth.uid() los pone
-- el servidor (defaults). UPDATE sigue siendo solo egreso_en y notas (grant de fase 2); el
-- trigger proteger_ingreso (M3) valida la hora de salida.
revoke insert, truncate on public.ingresos_personal from authenticated;
grant insert (org_id, empleado_id, dni, nombre, apellido, firma_path, fuera_de_horario, notas)
  on public.ingresos_personal to authenticated;

drop policy if exists "porteria gestiona firmas" on storage.objects;
create policy "porteria gestiona firmas" on storage.objects for all to authenticated
using (
  bucket_id = 'documentos'
  and (storage.foldername(name))[1] = (select private.org_actual()::text)
  and (storage.foldername(name))[2] = 'firmas'
  and (select private.rol_actual()) = 'porteria')
with check (
  bucket_id = 'documentos'
  and (storage.foldername(name))[1] = (select private.org_actual()::text)
  and (storage.foldername(name))[2] = 'firmas'
  and (select private.rol_actual()) = 'porteria');


-- ------------------------------------------------------------
-- 12. §1.3 D-P2: el Líder de Procesos opera todo lo de la plata.
--     Las escrituras directas (sin RPC) de cheques, gastos, movimientos,
--     saldos iniciales y conciliación de transferencias suman 'lider'
--     (pedido de M6). Mismas condiciones que antes, solo cambia la lista.
-- ------------------------------------------------------------
drop policy if exists "actualizar cheques" on public.cheques;
create policy "actualizar cheques" on public.cheques for update to authenticated
  using (private.tiene_rol(org_id, array['tesoreria','lider']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['tesoreria','lider']::public.rol_usuario[]));

drop policy if exists "insertar gastos" on public.gastos;
create policy "insertar gastos" on public.gastos for insert to authenticated
  with check (private.tiene_rol(org_id, array['admin','tesoreria','lider']::public.rol_usuario[]));
drop policy if exists "editar gastos" on public.gastos;
create policy "editar gastos" on public.gastos for update to authenticated
  using (private.tiene_rol(org_id, array['admin','tesoreria','lider']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['admin','tesoreria','lider']::public.rol_usuario[]));
drop policy if exists "borrar gastos" on public.gastos;
create policy "borrar gastos" on public.gastos for delete to authenticated using (
  private.tiene_rol(org_id, array['admin','tesoreria','lider']::public.rol_usuario[]) and estado <> 'pagado');

drop policy if exists "insertar movimientos tesoreria" on public.movimientos_tesoreria;
create policy "insertar movimientos tesoreria" on public.movimientos_tesoreria for insert to authenticated
  with check (private.tiene_rol(org_id, array['tesoreria','lider']::public.rol_usuario[]));
drop policy if exists "editar movimientos tesoreria" on public.movimientos_tesoreria;
create policy "editar movimientos tesoreria" on public.movimientos_tesoreria for update to authenticated
  using (private.tiene_rol(org_id, array['tesoreria','lider']::public.rol_usuario[]) and caja_id is null)
  with check (private.tiene_rol(org_id, array['tesoreria','lider']::public.rol_usuario[]) and caja_id is null);
drop policy if exists "borrar movimientos tesoreria" on public.movimientos_tesoreria;
create policy "borrar movimientos tesoreria" on public.movimientos_tesoreria for delete to authenticated
  using (private.tiene_rol(org_id, array['tesoreria','lider']::public.rol_usuario[]) and caja_id is null);

drop policy if exists "insertar saldos iniciales" on public.saldos_iniciales;
create policy "insertar saldos iniciales" on public.saldos_iniciales for insert to authenticated
  with check (private.tiene_rol(org_id, array['tesoreria','lider']::public.rol_usuario[]));
drop policy if exists "editar saldos iniciales" on public.saldos_iniciales;
create policy "editar saldos iniciales" on public.saldos_iniciales for update to authenticated
  using (private.tiene_rol(org_id, array['tesoreria','lider']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['tesoreria','lider']::public.rol_usuario[]));
drop policy if exists "borrar saldos iniciales" on public.saldos_iniciales;
create policy "borrar saldos iniciales" on public.saldos_iniciales for delete to authenticated
  using (private.tiene_rol(org_id, array['tesoreria','lider']::public.rol_usuario[]));

drop policy if exists "conciliar pagos" on public.pagos;
create policy "conciliar pagos" on public.pagos for update to authenticated
  using (private.tiene_rol(org_id, array['tesoreria','lider']::public.rol_usuario[]))
  with check (private.tiene_rol(org_id, array['tesoreria','lider']::public.rol_usuario[]));
