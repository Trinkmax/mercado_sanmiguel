# Fase 2 — Contrato técnico (revisión del cliente, agosto 2026)

Complementa `docs/GUIA-MODULOS.md` (que sigue vigente: patrones, componentes
obligatorios, reglas de diseño). Acá está **lo nuevo**: roles, tablas, RPCs,
helpers compartidos y la regla de aprobación. Leé los dos antes de tocar código.

## 1. Roles (enum `rol_usuario`)

| Valor | Label visible (`LABEL_ROL`) | Qué hace |
|---|---|---|
| `lider` (nuevo) | Líder de Procesos | Aprueba altas/bajas/modificaciones de clientes y conceptos; personal (empleados, contrato, horarios); Reportes; revisa solicitudes, las deriva al Consejo y asigna resoluciones a Administración; configura el cobro por día de ambulantes/quinteros. Hereda TODO lo que veía `consejo`. |
| `admin` | Administración | Cobra, carga cheques, **integra la caja de portería en la caja mayor**, carga solicitudes físicas al sistema y ejecuta resoluciones, autoriza reaperturas de caja. **Sin Reportes.** Sus cambios de clientes/conceptos pasan por aprobación. |
| `guardia` | **Jefe de Portería** | Único de portería que cobra (quinteros, canon). Rinde (cierra) su caja. El valor del enum no cambió para no romper RPC/RLS. |
| `porteria` (nuevo) | Portería | Registra ingreso de personal (DNI, nombre, apellido, firma digital); genera solicitudes/informes. **No cobra.** Inicio: `/porteria`. |
| `tesoreria` | Tesorería | Valida cierres (definitivos), concilia transferencias y comprobantes de gastos, flujo de fondos, débito fiscal, comisiones, cheques. |
| `consejo` | Consejo | Reportes; ve solicitudes derivadas y registra resolución. |
| `socio` | Socio | Portal: cuenta, pagos, documentos, **solicitudes (ex peticiones)**, circulares con recepción obligatoria, términos y condiciones. |

Helpers: `requireStaff()` incluye `lider` y `porteria`; `rutaInicio("porteria") = "/porteria"`;
`aplicaDirecto(rol)` (auth.ts) = `rol === "lider"`; `ROLES_*` en `src/lib/roles.ts`.
Usuarios demo nuevos (pass `SanMiguel2026`): `lider@sanmiguel.coop` (Franco Delucchi),
`porteria@sanmiguel.coop` (Luis Aguirre). `consejo@` ahora se llama "Consejo Directivo".

## 2. Regla de aprobación obligatoria (clientes y conceptos)

**RLS**: solo `lider` hace insert/update directo en `clientes`, `conceptos`,
`cliente_conceptos`. Todo lo demás (admin, tesorería, consejo) propone un cambio:

```ts
const { data } = await supabase.rpc("solicitar_cambio", {
  p_entidad: "cliente" | "cliente_concepto" | "concepto",
  p_accion: "alta" | "modificacion" | "baja",
  p_entidad_id: id | null,        // null en alta
  p_datos: {...},                 // payload (ver abajo)
  p_resumen: "Alta de cliente Verdulería X",
  p_cliente_id: clienteId | null, // opcional: para agrupar en la ficha
});
// → { estado: "aplicado" | "pendiente", cambio_id, resultado_id }
// Si el que llama es lider, se aplica en el acto (estado "aplicado").
```

Payloads (`p_datos`) que entiende `private.aplicar_cambio`:
- cliente/alta: `{ codigo, nombre, apodo?, tipo_persona, cuit?, telefono?, email?, direccion?, notas?, cuotas_mes, conceptos?: [{concepto_id, cantidad}] }`
- cliente/modificacion: solo las claves que cambian (`{ telefono: "…", apodo: "…" }`); `activo: false` = baja lógica.
- cliente_concepto/alta: `{ cliente_id, concepto_id, cantidad, notas? }` (si ya existe, lo reactiva y actualiza cantidad).
- cliente_concepto/modificacion: `{ cantidad?, activo?, notas? }`; baja: `activo=false`.
- concepto/alta: `{ codigo, nombre, tipo, precio, orden_imputacion, descuento_pronto_pago, activo }`; modificacion: claves que cambian.

Aprobación (solo lider): `rpc("aprobar_cambio", { p_cambio })` → `{ resultado_id, entidad, accion }`;
`rpc("rechazar_cambio", { p_cambio, p_motivo })`. Tabla `cambios_pendientes`
(`estado`: pendiente/aprobado/rechazado; `datos`, `datos_anteriores` para el diff; `resumen`;
`cliente_id` para mostrar "tiene cambios esperando aprobación" en la ficha).
UX: en los formularios de admin el botón dice "Enviar a aprobación"; el toast:
"Enviado al Líder de Procesos para su aprobación". Si `estado === "aplicado"`, toast normal.
En la ficha y el listado de clientes: `<Sello estado="pendiente_aprobacion" />` cuando hay
cambios pendientes del cliente.

## 3. Cajas: rendición → caja mayor → validación

`estado_caja`: `abierta → cerrada → integrada → validada` (integrada solo para cajas de
portería = tipo `guardia`). Columnas nuevas en `cajas`: `caja_destino_id`, `integrada_por/en`,
`total_rendido_efectivo`, `total_rendido_transferencia`, `reapertura_solicitada_en/por`,
`reapertura_motivo`, `reaperturas`. Tabla `caja_eventos` (bitácora: apertura, cierre,
solicitud_reapertura, reapertura, rechazo_reapertura, integracion, recibe_rendicion, validacion).

RPCs:
- `cerrar_caja(p_caja)` → arqueo `{ efectivo, transferencia, cheques, canon, gastos_pagados, rendido_efectivo, rendido_transferencia }`. El arqueo de la caja de administración **incluye** las rendiciones de portería integradas ese día.
- `integrar_caja_porteria(p_caja, p_observaciones?)` (admin/tesorería): caja guardia `cerrada` → `integrada` en la caja de administración de hoy (la abre si hace falta). Devuelve `{ caja_destino, efectivo, transferencia, canon }`.
- `solicitar_reapertura_caja(p_caja, p_motivo)` (guardia sobre su caja; admin sobre la suya).
- `reabrir_caja(p_caja, p_motivo?)` (admin: cajas `cerrada`; tesorería: `cerrada` o `integrada`). Vuelve a `abierta`, limpia totales, `reaperturas + 1`.
- `rechazar_reapertura_caja(p_caja, p_motivo?)` (admin/tesorería).
- `validar_caja(p_caja, p_observaciones?)` (tesorería): acepta `cerrada` o `integrada`; validar la caja de administración arrastra las de portería integradas.
- `anular_pago` y `rechazar_cheque` recalculan arqueos en cascada (caja de portería → caja mayor).

Sellos: `integrada` ("En caja mayor"), `reapertura_pedida`.

## 4. Cobros

`registrar_pago(p_cliente, p_monto, p_medio, p_caja, p_cheque?, p_notas?, p_transferencia?, p_permitir_saldo_favor?)`
- `p_transferencia = { titular, comprobante_path? }` — **obligatorio `titular`** si medio = transferencia. La foto del comprobante se sube ANTES a `rutaComprobanteTransferencia(orgId, nombre)` (bucket `documentos`, carpeta `comprobantes`) y se pasa el path.
- `p_permitir_saldo_favor = true` deja que el monto supere la deuda: el sobrante queda como **saldo a favor** (se aplica solo al generar el próximo período / nuevos cargos). Si es `false` y sobra, la RPC falla con mensaje claro → la UI muestra confirmación "Sobran $X: ¿los dejamos como saldo a favor?" y reintenta con `true`.
- Devuelve `{ pago_id, numero, imputaciones[], saldo_favor }`.
- Vista `v_saldo_favor { org_id, cliente_id, saldo_favor }` (solo clientes con crédito). RPC `aplicar_saldo_favor_cliente(p_cliente)` → numeric aplicado (botón "Aplicar saldo a favor" en la ficha si hay crédito y deuda a la vez).
- `pagos` nuevas columnas: `titular_transferencia`, `comprobante_path`, `conciliado`, `conciliado_por`, `conciliado_en` (tesorería concilia transferencias: update directo, RLS "conciliar pagos").
- `canon_camiones.tipo`: `camion | ambulante | quintero` (cobro por día en portería). Precios en `configuracion`: `precio_canon_camion`, `precio_canon_ambulante`, `precio_canon_quintero_dia`. El formulario de canon se simplifica a **Fecha + Monto** (+ tipo con chips); `resumen_conceptos` devuelve filas BC / BA / BQ.
- Copy: **"Beneficio por pago en término"** en lugar de "descuento" en TODO texto visible (la columna DB sigue siendo `descuento_pronto_pago`; la RPC `resumen_conceptos` sigue devolviendo `descuentos` → mostrar como "Beneficios otorgados").
- Aviso de deuda activa: en cobranza, ficha y portal, banner visible cuando el cliente debe: si hay cargos en término con beneficio → "Pagando antes del {venc} mantiene el beneficio de $X"; si ya venció → "Perdió el beneficio por mora: debe el importe completo".

## 5. Solicitudes (ex "Peticiones"), circulares, términos, registros documentales

- `solicitudes` (numero, tipo `solicitud|informe|reclamo|consulta`, asunto, detalle, `cliente_id` opcional, `referencia` libre, origen `portal|porteria|administracion|lider`, estado `nueva|en_revision|en_consejo|resuelta|asignada|ejecutada|rechazada|cerrada`, resolucion, asignada_a, nota_ejecucion, adjunto_path…). Insert directo (RLS: cualquier miembro, el socio solo con `cliente_id` propio y `origen='portal'`).
- `solicitud_mensajes` (autor_nombre, autor_rol, mensaje, adjunto_path, `interno` = solo staff). Insert directo con `autor_id = auth.uid()`.
- `avanzar_solicitud(p_solicitud, p_accion, p_texto?, p_usuario?)` → nuevo estado. Acciones y quién: `tomar` (lider/consejo/admin), `derivar_consejo` (lider), `resolver` (lider/consejo, texto obligatorio), `asignar` (lider → Administración; `p_usuario` opcional), `ejecutar` (admin/lider), `rechazar` (lider/consejo, texto), `cerrar` (lider/admin), `reabrir` (lider). Cada acción deja un mensaje automático en el hilo.
- Flujo completo: socio/portería/admin crean → lider toma → deriva al Consejo → Consejo/lider registra resolución → lider asigna a Admin → Admin ejecuta → cerrada.
- `circulares` (numero, titulo, detalle, fecha, storage_path, obligatoria, activa) + `circular_recepciones (circular_id, cliente_id)`; el socio confirma recepción (insert). En el portal, una circular obligatoria sin confirmar bloquea con un aviso prominente hasta tocar "Confirmo que la recibí".
- `terminos` (version, titulo, contenido, vigente — único vigente por org) + `aceptaciones_terminos (terminos_id, cliente_id, user_id)`. El portal exige aceptar la versión vigente antes de mostrar cualquier otra cosa.
- `sanciones.tipo` ahora: `notificacion | sancion | apercibimiento`. La pestaña de la ficha pasa a llamarse "Registros" ("Registros documentales") y lista los tres tipos + las circulares (con recibida/sin recibir).

## 6. Personal y portería

- `empleados` (nombre, apellido, dni único por org, cuil, cargo, tipo_contrato `planta_permanente|contratado|eventual|monotributista|pasantia`, fecha_ingreso/egreso, telefono, email, contrato_path, observaciones, activo) + `empleado_horarios (dia_semana 1..7, hora_desde, hora_hasta)`. Gestiona `lider`; leen porteria/guardia/admin/tesorería/consejo.
- `ingresos_personal` (empleado_id?, dni, nombre, apellido, firma_path **obligatorio**, ingreso_en, egreso_en?, fuera_de_horario, notas, registrado_por). Insert porteria/guardia/admin/lider. La firma se dibuja en un canvas y se sube como PNG a `rutaFirmaIngreso(orgId)`.

## 7. Mapa

- `clientes.apodo` (se muestra debajo del N° de puesto).
- `mapa_posiciones (cliente_id, tipo puesto|quinta|local|deposito, x, y)` en coordenadas del viewBox 1000×640; admin/lider arrastran (drag & drop) y se persiste con upsert; sin fila → ubicación automática (la actual).

## 8. Helpers compartidos nuevos

- `src/lib/format.ts`: `formatFraccion(1.25) → "1¼"`, `redondearCuarto`, `PASO_CANTIDAD = 0.25`, `OPCIONES_CUOTAS_MES`, `DIAS_SEMANA`, `formatHora`, `formatSoloHora`, `diasHasta`.
- `src/lib/storage.ts`: `rutaComprobanteTransferencia`, `rutaFirmaIngreso`, `rutaAdjuntoSolicitud`, `rutaCircular`, `rutaContratoEmpleado`, `MIME_IMAGEN`.
- `src/components/shared/sello.tsx`: estados nuevos (integrada, reapertura_pedida, listo_depositar, conciliado, sin_conciliar, apercibimiento, circular, recibida, sin_recibir, saldo_favor, nueva, en_revision, en_consejo, resuelta, asignada, ejecutada, rechazada, cerrada_solicitud, pendiente_aprobacion, aprobado, impuesto, debito_fiscal, comision, ajuste, activo, inactivo, en_horario, fuera_horario, adentro, salio, camion, ambulante, quintero). Variante nueva `info` (azul) para "en curso".
- `src/components/shared/boton-exportar.tsx`: `<BotonExportar dataset="…" periodo? label? />` → `GET /api/exportar?dataset=…&periodo=…` (xlsx con `exceljs`, ya instalado).
- `src/lib/navegacion.ts`: ítems con `grupo` (hoy / gestión / plata / dirección); `NavLinks` los pliega (Hoy fijo, el grupo activo se abre solo, el resto recuerda el estado en localStorage) y suma badges de pendientes (`src/lib/pendientes.ts`) en el encabezado plegado.
- `src/lib/roles.ts`: `LABEL_ROL`, `DESCRIPCION_ROL`, `ORDEN_ROL`, `ROLES_STAFF`, `ROLES_COBRAN`, `ROLES_REPORTES`, `ROLES_GESTION_CLIENTES`.

## 9. Rutas nuevas del panel

| Ruta | Roles | Contenido |
|---|---|---|
| `/porteria` | porteria, guardia, admin, lider | Ingresos de personal (registro con DNI + firma, lista de hoy, marcar salida) y "Generar solicitud" (crea + imprime). |
| `/solicitudes`, `/solicitudes/[id]` | admin, guardia, porteria, tesoreria, consejo, lider | Bandeja por estado + detalle con hilo de mensajes y acciones según rol. |
| `/aprobaciones` | lider | Cambios pendientes con diff antes/después, aprobar / rechazar. |
| `/comunicaciones` | admin, consejo, lider | Circulares: crear, ver recepciones (quién confirmó), reenviar aviso. |
| `/personal`, `/personal/[id]` | lider | Empleados: ficha, contrato, franjas horarias. |
| `/api/exportar` | según dataset | Route handler xlsx. |
| `(print)/solicitudes/[id]` | staff | Formulario imprimible de la solicitud (generación física). |

Portal del socio (`/mi-cuenta`): + términos (gate), + circulares pendientes (banner bloqueante), + pestaña/sección "Solicitudes" con alta y mensajería, + saldo a favor.

## 10. Endurecimientos aplicados tras la revisión adversarial

- **Adjuntos de solicitudes** (`storage.objects`, carpeta `{org}/solicitudes/`): socio, portería y jefe solo leen archivos que estén referenciados por una solicitud o un mensaje que su RLS les deja ver (subselect sobre `solicitudes.adjunto_path` / `solicitud_mensajes.adjunto_path`). Antes podían listar toda la carpeta.
- **Autor de mensajes**: trigger `private.fijar_autor_mensaje` fija `autor_id`, `autor_rol` y `autor_nombre` desde el perfil real; el payload no puede firmar como otro rol.
- **Grants por columna** para escrituras directas (las RPC security definer no se ven afectadas): `pagos` → solo `conciliado, conciliado_por, conciliado_en`; `solicitudes` → solo `tipo, asunto, detalle, cliente_id, referencia, adjunto_path, actualizada_en` (los estados van por `avanzar_solicitud`); `ingresos_personal` → solo `egreso_en, notas`.
- **Precios del cobro por día en portería**: trigger `private.proteger_precios_porteria` — solo `lider` los cambia aunque la RLS de `configuracion` deje escribir a otros roles.
- **Subidas por server action**: `next.config.ts` → `experimental.serverActions.bodySizeLimit = "25mb"` (el límite por defecto de 1 MB rompía las fotos de comprobantes, facturas, contratos y firmas).
- **Exportación**: `/api/exportar` acepta `&cliente=<uuid>` para `cuenta_corriente` y `pagos` (la ficha baja solo su carpeta); `ingresos_personal` también lo bajan portería y el jefe; el Excel de tesorería trae la columna "Efecto en banco" con signo.
