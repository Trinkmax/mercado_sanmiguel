# Fase 3 — Contrato técnico (relevamiento del 28/09/2026)

Complementa `docs/GUIA-MODULOS.md` y `docs/FASE2-CONTRATO.md`, que siguen vigentes
(patrones de server actions, componentes obligatorios, reglas de diseño, copy en voseo).
Acá está **lo nuevo**: esquema, permisos, RPCs, helpers compartidos, qué hace cada
módulo y cómo se conectan. Fuente de los requisitos: relevamiento numerado (A1…J7) y
decisiones vinculantes del ingeniero a cargo. Si algo de acá contradice a la fase 2,
**manda este documento**.

Principio rector: usuarios mayores, tablets, a plena luz, apurados. Un camino por
pantalla, botones grandes, el número importante bien grande, nada de jerga.
Para el dueño: cada peso tiene un responsable, cada corrección deja rastro (quién,
cuándo, por qué) y nada se borra si se puede anular.

---

## 0. Cómo se construye (orden y reglas de juego)

### 0.1 Migraciones: expand → módulos → contract → limpieza

Los archivos tienen versiones numéricas únicas (patrón `^[0-9]+_.*\.sql$` del Supabase CLI: sin
sufijos tipo "0011b" ni versiones repetidas). Cada archivo se aplica como UNA transacción.

| Paso | Archivo | Qué hace | Quién / cuándo |
|---|---|---|---|
| 1 | `0010_fase3_enums.sql` | Valores nuevos de enums y tipos nuevos. Sola: `ALTER TYPE … ADD VALUE` no se puede usar en la misma transacción. | Ingeniero, con autorización del usuario. |
| 2 | `0011_fase3_esquema.sql` | EXPAND: columnas, tablas, vistas, datos, helpers privados, RLS de tablas nuevas, arreglo de seguridad de `perfiles`. No rompe la app de fase 2. | Ídem, inmediatamente después. |
| 3 | `0012_fase3_rpcs.sql` | RPC nuevas con **firma final** y cuerpo stub; `validar_caja` y `editar_espacio` con firma nueva y comportamiento viejo; funciones completas de Fundación (`espacios_del_plano`, `private.aplicar_saldo_favor` con bloqueo). | Ídem. Después: **Fundación regenera `database.types.ts`**. |
| 4 | `0013_fase3_cajas.sql` … `0021_fase3_mapa.sql` (9 archivos) | Cada módulo reescribe los cuerpos de SUS funciones y crea SUS triggers. | Los escribe cada módulo; los aplica el ingeniero (paso 5). |
| 4b | Rama de prueba | Integración y prueba de humo por rol ANTES de tocar producción (§11.3). | Ingeniero. |
| 5 | 0013…0021 + `0022_fase3_endurecimiento.sql` + deploy | CONTRACT: RLS/grants de tablas existentes que cierran accesos que la app vieja usa. **Una sola ventana de mantenimiento**: 0013…0021 en orden, enseguida 0022 y enseguida el deploy del código (§0.3). | Ingeniero, con autorización del usuario. |
| 6 | `0023_fase3_limpieza.sql` (futuro) | Borrar lo deprecado (§8). | Cuando fase 3 esté estable en producción. |

Archivos de los módulos (el número es el orden de aplicación; M2 primero porque su arqueo lo
usan otros): `0013_fase3_cajas.sql` (M2), `0014_fase3_cobranza.sql` (M1), `0015_fase3_porteria.sql` (M3),
`0016_fase3_clientes.sql` (M4), `0017_fase3_comunicaciones.sql` (M5), `0018_fase3_tesoreria.sql` (M6),
`0019_fase3_personal.sql` (M7), `0020_fase3_accesos.sql` (M8), `0021_fase3_mapa.sql` (M9). Aun así
**ninguna función de estos archivos puede depender del orden**: toda función que llame a una función
de OTRO módulo tiene que ser `language plpgsql` (plpgsql resuelve en ejecución; `language sql`
valida el cuerpo al crearse y fallaría).

### 0.2 Reglas para los módulos (obligatorias)

1. **Nadie toca la base.** Ni `apply_migration` ni `execute_sql` con DDL/DML. Solo lectura. Tu SQL va en tu archivo 0013…0021.
2. **Firmas congeladas.** En tu archivo solo `create or replace` de las funciones que sos dueño, con la misma firma exacta (nombres de parámetros, tipos, orden, defaults y tipo de retorno) que dejó `0012_fase3_rpcs.sql`. Podés cambiar volatilidad, `language` y cuerpo. Mantené `security definer` (salvo `resumen_novedades` y los triggers de M6, ver §4) y `set search_path = ''`, y calificá todo con `public.` / `private.`. Las funciones privadas nuevas que crees: `revoke all … from public, anon` y, si las llama otra función o una policy, `grant execute … to authenticated`.
3. **Policies y grants son de Fundación** (0011 y 0022). Si tu módulo necesita otra policy, no la escribas: anotala en "Pedidos a Fundación" al pie de tu archivo y avisá.
4. **Triggers**: los creás en tu archivo solo sobre las tablas que figuran como tuyas en §4, con los nombres de este contrato. Funciones de trigger en `private`.
5. **Archivos**: solo los que figuran como tuyos en §6. Si necesitás algo de otro módulo, importalo con el nombre y las props de §6.10 "Interfaces congeladas" (lo construye su dueño en paralelo: programá contra el contrato, no contra el archivo).
6. Mensajes de error de las RPC: castellano rioplatense, voseo, accionables. La UI los muestra tal cual (`fallo(error)`).
7. Al terminar: `pnpm tsc --noEmit` sin errores en tus archivos; no commitees. Hay **otra sesión trabajando en paralelo** (navegación móvil y mapa). Archivos sensibles: `barra-inferior.tsx`, `principal.tsx`, `(panel)/layout.tsx`, `navegacion.ts` (dueño M8) y `src/components/mapa/{lienzo-plano,use-vista,mapa-mercado,panel-detalle,panel-asignacion,resumen-mapa}.tsx` + `src/app/(panel)/mapa/page.tsx` (dueño M9). Condiciones: releer cada archivo justo antes de editarlo, cambios aditivos (props nuevas opcionales, sin reordenar ni reformatear), y al terminar dejar el `git diff` de esos archivos en el resumen para que el ingeniero reconcilie.
8. **Nada de dependencias ni componentes de UI nuevos.** Ningún módulo agrega archivos en `src/components/ui/**`, corre `shadcn add` ni toca `package.json`. Fundación ya agregó `collapsible`, `radio-group`, `toggle` y `toggle-group` (§5.6). Si falta otra pieza, pedila a Fundación.
9. **Reglas SQL** de §4.0 (bloqueos, idempotencia, `= any` con cast, `#variable_conflict`): obligatorias en todo cuerpo nuevo.

### 0.3 Ventana entre la base y el deploy

0011/0012 se aplican días antes del deploy y la app de fase 2 sigue en uso (demo, sin datos
transaccionales). Verificado en una réplica local de la base: con 0010–0012 aplicadas, la app vieja
genera el período, cobra (efectivo y cheque), anula, cierra, carga canon, valida y lee el flujo igual
que hoy. Efectos visibles, todos aceptados:

- Configuración → Precios muestra EXME activo a $1.080.000, EXPP renombrado "Expensas Puestos Propios", EXPQ a $330.000, BC a $0 y tres conceptos nuevos (AMB, ABEN, MULT) con tipos que la UI vieja no traduce.
- Usuarios: Administración ya no puede desactivar a usuarios del equipo (la RLS lo ignora sin error). El usuario demo `consejo@` queda desactivado (el login le dice que no tiene acceso).
- Todo lo demás de la app vieja sigue andando igual.

**Las 0013…0021 NO se aplican sueltas.** Rompen la app de fase 2: con M1, `registrar_pago` pasa a
ser un wrapper de `registrar_cobro` (rechaza a Tesorería y exige CUIT en los cheques, que la UI vieja
no manda); con M2, `abrir_caja` rechaza a Tesorería; con M9, `generar_periodo` saca a Tesorería.
Por eso van en la misma ventana de mantenimiento que 0022 y el deploy (paso 5), y antes se prueban
en la rama del paso 4b.

---

## 1. Resumen de decisiones

### 1.1 Decisiones que este contrato implementa (decisiones.md)

| # | Tema | Cómo queda |
|---|---|---|
| 1 | Segmentación | `clientes.categoria` (`puestero` \| `quintero` \| `ambulante`) define quién gestiona; `clientes.es_socio`; `espacios.propio`. Segmentos no excluyentes en `private.segmentos_cliente()` + vista `v_clientes_segmentos` + espejo TS `src/lib/segmentos.ts`. El Jefe solo lee quinteros/ambulantes (RLS, 0022); Administración lee todo pero la UI y las RPC de escritura/cobro la limitan a puesteros; Tesorería conserva lectura sin módulo Clientes. La aprobación del Líder aplica igual al Jefe. |
| 2 | Catálogo | EXME = expensa del puesto común (1.080.000, 15 %, orden 40); EXPP = puestos propios (orden 45, mismo precio/beneficio); EXPQ 330.000; AMB 15.000/día (tipo `diario`); ABEN 15.000 (tipo `abono_energia`); MULT (tipo `eventual`); BC queda como código del canon, precio en tarifas. BA/BQ desaparecen (nunca fueron conceptos: salían de `resumen_conceptos`). |
| 3 | Caja de portería | Caja `guardia` = "Caja de portería", una por día. El Jefe cobra quinteros/ambulantes (efectivo/transferencia); Portería registra el canon (abre la caja si hace falta, no la cierra). Desglose: Quintas · Ambulantes · Bono camioneros. |
| 4 | Canon | `tarifas_transporte` (edita el Líder) + `registrar_canon` (Portería y Líder, §1.3) con tarifa, cantidad, medio, patente, "¿A quién viene?". |
| 5 | Cobro mixto | `pagos.lote_id` + `registrar_cobro(p_lineas)`; recibo por lote (también para el socio); cheque con CUIT, recibido de, puesto, proveedor, estado inicial; `cobrar_diario` para ambulantes; Tesorería no cobra; el Jefe no recibe cheques. El cheque entregado en el acto se vincula después al gasto que pagó (`vincular_cheque_gasto`). |
| 6 | Arqueo y gastos | `pagar_gasto` desde la caja de cualquier día no validada (se recalcula el arqueo) o desde Tesorería; arqueo = juntado − gastos ± ajustes; imprimible del cierre; `replicar_gastos_fijos`. |
| 7 | Tesorería | Moneda ARS/USD, cuentas efectivo/banco, depósito/extracción/ingreso/egreso; `flujo_caja` con pesos, dólares y cheques; ajustes de tesorería sobre la caja del día. |
| 8 | Comunicaciones | `circulares.publico text[]` = "Todos" o unión de segmentos, **más el filtro "Solo socios"** (intersección, D2 "únicamente los socios"); `circular_recepciones` = "la vio"; registros con multa (cargo MULT), hilo `registro_mensajes`, visto y "leído". `emitir_registro`, `dejar_sin_efecto_multa`. |
| 9 | Usuarios | `perfiles.dni` único; login por DNI (resolución DNI→email solo en el servidor); Líder = todo el staff, Administración = socios, Jefe = Portería (RLS + trigger en la tabla y `autorizar_gestion_usuario` antes de todo `auth.admin.*`); consejo oculto y desactivado; DNIs demo. |
| 10 | Solicitudes | `con_jefe`, `elevar`, `resolver_jefe`; el Jefe crea avisos sobre un puesto (`espacio_id`) que van al Líder; Tesorería crea solicitudes (origen `tesoreria`). |
| 11 | Personal | `empleados.sector` + `horas_semanales`; `novedades_personal` con aprobación de Administración para lo que carga el Jefe; `resumen_novedades(p_periodo)`. |
| 12 | Medidores y mapa | `medidores.espacio_id`; mapa del Jefe sin datos de puesteros + "Avisar al Líder"; marcar puesto propio. |
| 13 | Cuotas | 1/2/3/4 + "Todos los días" (30) + personalizada 1–31. |

### 1.2 Desvíos respecto de decisiones.md (justificados)

1. **`cobrar_diario` recibe líneas, no un medio.** Firma: `cobrar_diario(p_cliente, p_caja, p_dias, p_lineas, p_desde, p_notas, p_lote)` en lugar de `(p_cliente, p_dias, p_medio, p_caja, p_transferencia?)`. Motivo: mismo formato de línea que `registrar_cobro` (A1 aplica también al Jefe: 2 días en efectivo + 1 por transferencia), idempotencia por `p_lote` (doble toque en la tablet) y día de inicio elegible (vino ayer y no pagó). El caso simple es una sola línea.
2. **`registrar_cobro` suma `p_lote uuid default null`** (idempotencia). El resto de la firma es la de la decisión.
3. **Cheque: `fecha_entregado` (date) en vez de `entregado_en`**, por coherencia con `fecha_depositado` / `fecha_acreditado`. Se suman `entregado_por`, `entregado_en_cobro` (el arqueo descuenta los cheques que no quedaron en la caja), `gasto_id` (el cheque endosado cancela un gasto: sin eso el proveedor figura impago y el cheque "se va" sin contrapartida) y `rechazado_por/en`, `motivo_rechazo` (rastro no editable).
4. **Ajustes de caja (J3) = `movimientos_tesoreria` con `caja_id`** (la columna ya existía y no se usaba), no una tabla nueva: un solo registro impacta en el arqueo de esa caja y en el flujo de tesorería. Se escriben por `registrar_ajuste_caja`. (Interpretación a validar, §9-P21.)
5. **`validar_caja` suma `p_efectivo_contado`** (tesorería cuenta la plata; si no coincide, el faltante/sobrante queda como ajuste en el mismo acto). Firma nueva, comportamiento viejo hasta que M2 lo implemente.
6. **`novedades_personal` suma `justificada`, el estado `anulada` y una foto del `sector`.** Una novedad aprobada que resultó errónea se anula con motivo (trazabilidad) en vez de borrarse; el sector congelado define quién la ve.
7. **Registros: `estado` (enum `estado_registro`) + `ultimo_mensaje_en` + `numero` + `espacio_id` + `visto_en` (primera vista) + `socio_leyo_en` (última vista, para "Respuesta nueva")**, y una RPC más: `marcar_registro_visto` (el socio no puede escribir `sanciones`).
8. **Público de circulares.** "Todos" o la UNIÓN de los segmentos elegidos; **"Solo socios" es un filtro aparte** (intersección): `{quinteros, socios}` = los quinteros que son socios; `{socios}` = todos los socios. "Todos" excluye ambulantes (no tienen portal). Valores válidos: `todos, socios, puesteros, puestos_propios, locales, galpones, conteiners, quinteros`. (La versión anterior de este contrato los unía: con "Solo socios + Quinteros" le llegaba a quinteros que no son socios, lo contrario de D2.)
9. ~~**El Líder no cobra y no opera la plata**~~ — **REEMPLAZADO por §1.3 D-P2: el Líder opera todo.** Texto original, solo como historia: La matriz del relevamiento le da ✓ en `/cobranza`, `/caja`, `/cheques`, `/gastos` y `/tesoreria`; decisiones.md no lo define. Este contrato se lo da **en solo lectura** en todas (en `/cobranza` también: ve deudas y avance, sin botón Cobrar) y no le da ningún rol de escritura en las RPC de plata (`registrar_cobro`, `cobrar_diario`, `registrar_canon`, `abrir/cerrar/integrar/reabrir_caja`, `pagar_gasto`, `entregar_cheque`, movimientos). Motivo: cada peso tiene un responsable de caja; el Líder supervisa, aprueba y ve las correcciones (§6 M8). Si el usuario decide que opere, el cambio es sumar `lider` a esas listas de roles y sacar el `modoLectura`.
10. **Contract en 0022** (no pedido explícitamente): sin él, la base rompería flujos de la app desplegada (regla 2). Es parte de la fundación, ya escrito.
11. **ABEN no se genera en `registrar_lectura`**: si se agrega un medidor después de generar el mes, se vuelve a generar el período (es idempotente y solo suma lo que falta). Evita abonos retroactivos al corregir lecturas viejas.
12. **Avance del quintero por plata, no por cantidad de pagos.** G5 dice "2 de 4 pagos"; el contrato cuenta **cuotas cubiertas por plata** (`floor(cubierto / (total/cuotas))`, vista `v_avance_mes`): si paga dos cuotas juntas marca 2, y un pago chico no suma una cuota. Una sola fórmula para Cobrar, Inicio y Mapa. (§9-P22.)
13. **Recibo del socio (B1) = imprimible + "Guardar como PDF"** del navegador, no un archivo PDF generado en el servidor (haría falta una dependencia nueva). Es la interpretación documentada en el relevamiento ("recibo imprimible/guardar PDF accesible por el socio"). §9-P23.
14. **El Jefe de Portería y Portería no leen la tabla `espacios`** (tiene `cliente_id` y `nota`): usan `public.espacios_del_plano()` (número, tipo, medio, propio y geometría). G11 pide "no debe ver nada de los puestos".
15. **Alta de ambulantes del Jefe** — RESUELTO en §1.3 D-P1 (opción A). Recomendado y especificado (§4.7): se aplica en el acto y el Líder la revisa después (excepción a "todo alta pasa por el Líder" de decisiones §1).

### 1.3 Decisiones FINALES del ingeniero a cargo (reemplazan §1.2-9, §1.2-15, §9-P1 y §9-P2 — mandan sobre cualquier otra línea de este documento)

**D-P2 · El Líder de Procesos es superusuario operativo.** El cliente lo dijo textual: *"los únicos que
pueden hacer todo son los líderes de procesos"*. Regla única, sin excepciones: **el Líder puede hacer
todo lo que puede hacer cualquier otro rol del staff**, además de lo suyo. No existe `modoLectura` para el
Líder en ninguna pantalla. Concretamente:
- **RPC de plata**: sumar `lider` a los roles de `registrar_cobro`, `cobrar_diario`, `registrar_canon`,
  `anular_canon`, `anular_pago`, `abrir_caja`, `cerrar_caja`, `integrar_caja_porteria`,
  `solicitar_reapertura_caja`, `reabrir_caja`, `rechazar_reapertura_caja`, `validar_caja`,
  `registrar_ajuste_caja`, `borrar_ajuste_caja`, `pagar_gasto`, `revertir_pago_gasto`,
  `replicar_gastos_fijos`, `vincular_cheque_gasto`, `entregar_cheque` y demás acciones de cheques,
  movimientos de tesorería y saldos iniciales.
- **Caja del Líder**: cuando el Líder cobra (a cualquier categoría: puesteros, quinteros o ambulantes)
  el cobro va a la **caja de `administracion` del día** (la abre si hace falta). Cuando registra canon
  va a la caja de portería del día. Puede cerrar/integrar/reabrir/validar cualquier caja.
- **Cheques**: el Líder puede recibir cheques en el cobro (no es el Jefe).
- **UI**: `/cobranza` del Líder = control segmentado **"Puesteros · Quinteros · Ambulantes"** con el
  formulario de cobro completo (FormCobro / CobroAmbulante). `/caja`, `/cheques`, `/gastos`,
  `/tesoreria` y `/porteria` con todas las acciones. `ROLES_COBRAN = ['admin','guardia','lider']`.
- **Server actions**: donde §7.3 lista roles de escritura de plata, sumar `lider`.
- **Trazabilidad** (lo que pide el dueño): todo lo que opera el Líder queda firmado igual que el resto
  (recibido_por, caja_eventos, creado_por). Nada cambia en la auditoría.

**D-P1 · Alta de ambulantes del Jefe: opción A definitiva.** Se aplica en el acto (el Jefe le puede
cobrar enseguida), el cambio queda `aprobado` con `revisar_despues = true` y el Líder lo ve en
Aprobaciones → "Aplicadas por el Jefe (revisalas)". Solo **altas de ambulantes**: las modificaciones,
las bajas y todo lo de quinteros siguen pasando por el Líder (tal cual §4.7).

**Otras preguntas del §9 resueltas por defecto** (se implementan así; se validan con el cliente
después): P21 ajustes de caja = faltantes/sobrantes/comisiones sobre la caja (§1.2-4); P22 avance del
quintero por plata (§1.2-12); P23 recibo del socio = imprimible + "Guardar como PDF" (§1.2-13).

---

## 2. Esquema

### 2.1 Enums (0010)

| Tipo | Valores nuevos / tipo nuevo | Uso |
|---|---|---|
| `estado_cheque` | + `entregado` (después de `en_cartera`) | Cheque endosado a un proveedor. Texto: "Entregado a proveedor". |
| `tipo_concepto` | + `diario`, `abono_energia`, `eventual` | AMB, ABEN, MULT. `generar_periodo` solo genera `recurrente` y (M9) `abono_energia`. |
| `tipo_mov_tesoreria` | + `deposito`, `extraccion`, `ingreso`, `egreso` | J6. |
| `estado_solicitud` | + `con_jefe` (antes de `nueva`) | Bandeja del Jefe. Texto: "Con el Jefe". |
| `origen_solicitud` | + `tesoreria` | J5. |
| `categoria_cliente` (nuevo) | `puestero`, `quintero`, `ambulante` | `clientes.categoria`. |
| `moneda` (nuevo) | `ARS`, `USD` | Tesorería. |
| `cuenta_tesoreria` (nuevo) | `efectivo`, `banco` | Tesorería. |
| `estado_registro` (nuevo) | `notificado`, `descargo`, `respondido` | `sanciones.estado`. |
| `sector_personal` (nuevo) | `porteria`, `limpieza`, `mantenimiento`, `administracion`, `otro` | `empleados.sector`. |
| `tipo_novedad` (nuevo) | `falta`, `llegada_tarde`, `feriado_trabajado`, `vacaciones`, `licencia`, `horas_extra`, `otra` | H4. |
| `estado_novedad` (nuevo) | `pendiente`, `aprobada`, `rechazada`, `anulada` | H4. |

### 2.2 Columnas nuevas por tabla (0011)

| Tabla | Columna | Tipo / default / checks | Para qué |
|---|---|---|---|
| clientes | `categoria` | `categoria_cliente not null default 'puestero'`; check `clientes_ambulante_sin_portal` (ambulante ⇒ `auth_user_id is null`); índice `(org_id, categoria)` | G8: quién lo gestiona. |
| clientes | `es_socio` | `boolean not null default false` | C4. |
| conceptos | `segmento` | `text null`, check ∈ {puesteros, puestos_propios, locales, galpones, conteiners, cocheras, quinteros, ambulantes} | Segmentos y "qué concepto asigna cada rol". |
| espacios | `propio` | `boolean not null default false`; check solo `tipo='puesto'` | C3. |
| medidores | `espacio_id` | `uuid` FK espacios `on delete set null`; trigger `medidores_valida_espacio` (misma org) | C8. `ubicacion` = etiqueta legible. |
| cargos | `desde`, `hasta` | `date` (ambos o ninguno, `hasta ≥ desde`) | Días cubiertos por un cargo AMB. |
| cargos | `lote_id` | `uuid` | Lote que creó el cargo diario (se anula con el recibo). |
| cargos | `origen` (check) | ahora ∈ {generacion, energia, manual, deuda, **diario**, **multa**} | |
| cargos | check `cargos_pagado_tope` | `monto_pagado ≤ monto` | Red de seguridad del cobro. |
| pagos | `lote_id` | `uuid not null default gen_random_uuid()` | Cobro mixto. El default mantiene a `registrar_pago` (un pago = un lote). |
| pagos | `linea` | `smallint not null default 1`, 1..6; único `(lote_id, linea)` | Orden de los medios en el recibo. |
| pagos | `numero` | sin cambio de tipo (identity) | Se REPITE en las líneas del lote: la RPC toma `nextval(pg_get_serial_sequence('public.pagos','numero'))` e inserta con `overriding system value`. |
| pagos | índices `pagos_cheque_idx`, `pagos_comprobante_idx` | parciales | `rechazar_cheque`/`anular_pago` y la policy de comprobantes. |
| imputaciones | constraint trigger `imputaciones_tope` (diferido) | Σ imputaciones de un pago ≤ su monto, al commit | Si dos transacciones imputan el mismo crédito, la segunda falla entera (mensaje "Probá de nuevo"). |
| cheques | `cuit` | `text`, 11 dígitos; único `(org_id, cuit, numero)` si no está rechazado | A2. |
| cheques | `recibido_de`, `puesto`, `proveedor` | `text` | A2 (puesto = snapshot "Puesto 34½ · 52"). |
| cheques | `fecha_entregado`, `entregado_por` | `date`, `uuid` | E2. Check: `entregado` ⇒ proveedor y fecha. |
| cheques | `entregado_en_cobro` | `boolean not null default false` | Se entregó en el mismo acto del cobro: no está en la caja. |
| cheques | `gasto_id` | `uuid` FK gastos `on delete set null` | Gasto que canceló el cheque endosado. |
| cheques | `titular` | pasa a nullable (deprecada) | La RPC la llena = `recibido_de`. |
| cheques | `rechazado_por`, `rechazado_en`, `motivo_rechazo` | rastro de `rechazar_cheque` (no están en el grant de UPDATE) | El motivo ya no va a `notas`, que es editable. |
| cajas | `total_cobros`, `total_quintas`, `total_ambulantes`, `total_cheques_entregados`, `total_ajustes`, `total_rendido_quintas`, `total_rendido_ambulantes`, `total_rendido_canon` | `numeric` (null mientras la caja está abierta) | A3, E4, J3: el arqueo persistido. |
| caja_eventos | `tipo` (check) | + `gasto_imputado`, `gasto_revertido`, `ajuste`, `ajuste_borrado`, `canon_anulado`, `arqueo_recalculado`, `cierre_forzado`, **`cobro_anulado`** | Bitácora. Todo lo que corrige plata deja evento. |
| canon_camiones | `numero` | `bigint generated always as identity` | Correlativo del cobro de garita. |
| canon_camiones | `tarifa_id`, `tarifa_nombre`, `unidad`, `precio_unitario` | FK tarifas; snapshot; unidad ∈ {vehiculo, dia}; check `monto = round(precio_unitario*cantidad,2)` si hay tarifa | H1. |
| canon_camiones | `patente` | `^[A-Z0-9]{5,8}$` | Opcional. |
| canon_camiones | `destino`, `destino_detalle`, `espacio_id` | destino ∈ {puesto, verdulero, ambulante}; detalle solo si puesto (≤20); espacio si el N° es inequívoco | H2 "¿A quién viene?". |
| canon_camiones | `ref` | `uuid`, único `(org_id, ref)` | Idempotencia. |
| canon_camiones | `anulado`, `anulado_por`, `anulado_en`, `motivo_anulacion` | anulación lógica con motivo | Se anula, no se borra. |
| canon_camiones | `tipo` | se mantiene (deprecada); `registrar_canon` escribe `'camion'` | Compatibilidad. |
| gastos | `descripcion` | pasa a nullable | E3 (la UI muestra el rubro si falta). |
| gastos | `periodo` | `date not null default` 1° del mes actual AR; check día 1 | Mes al que corresponde. Criterio único de resúmenes. |
| gastos | `origen_id` | FK gastos; único si no está anulado | Fijo replicado. |
| gastos | `pagado_por`, `pagado_en` | auditoría del pago | E4. |
| gastos | `pago_revertido_por`, `pago_revertido_en`, `pago_revertido_motivo` | rastro del último "Deshacer pago" (no están en ningún grant) | El motivo ya no va a `notas`. |
| gastos | `creado_por` | default `auth.uid()` | |
| gastos | checks | `pagado_desde` ∈ {caja, tesoreria, **cheque**}; medio `cheque` ⇒ `pagado_desde='cheque'`; `pagado` ⇒ fecha, medio y origen; `caja_id` presente ⇔ `pagado_desde='caja'`. (En 0022: `caja` ⇒ efectivo.) | |
| movimientos_tesoreria | `moneda` | `moneda not null default 'ARS'` | J2. |
| movimientos_tesoreria | `cuenta`, `cuenta_destino` | `cuenta_tesoreria`; default `banco`; check: depósito = efectivo→banco, extracción = banco→efectivo, destino solo en esos dos | J6. |
| movimientos_tesoreria | `grupo_id` | `uuid` | Depósito + su comisión. |
| movimientos_tesoreria | `ref` | `uuid`, único `(org_id, ref)` | Idempotencia de `registrar_ajuste_caja`. |
| movimientos_tesoreria | `caja_id` (existía) | check: si hay caja ⇒ `tipo='ajuste'` y ARS | J3. |
| movimientos_tesoreria | `descripcion` | nullable; `creado_por` default `auth.uid()` | |
| saldos_iniciales | `moneda` | `moneda not null default 'ARS'` (el UNIQUE pasa a `(org_id, medio, moneda)` en 0022) | J2. |
| circulares | `publico` | `text[]` null o valores válidos (§1.2-8; `socios` = filtro) | D2. Índice `circulares_storage_idx` para la policy de storage. |
| sanciones | `numero` | identity | "Apercibimiento N° 12". |
| sanciones | `espacio_id` | FK espacios; trigger misma org | D3 (puesto de referencia). |
| sanciones | `estado` | `estado_registro not null default 'notificado'` | D5/D6. |
| sanciones | `visto_en`, `socio_leyo_en`, `ultimo_mensaje_en` | `timestamptz` | `visto_en` = primera vez ("Visto por el socio el…"); `socio_leyo_en` = última vez que abrió el detalle ("Respuesta nueva"); orden de bandeja. |
| sanciones | `ref` | `uuid`, único `(org_id, ref)` | Idempotencia de `emitir_registro` (doble toque = una sola multa). |
| sanciones | `multa`, `multa_vencimiento`, `cargo_id` | multa > 0 solo apercibimiento/sanción; cargo único | D4. |
| sanciones | `multa_sin_efecto_en/_por/_motivo` | | D4. |
| solicitudes | `espacio_id` | FK espacios; trigger misma org | G11, H3. |
| solicitudes | `elevada_por`, `elevada_en` | | H3. |
| solicitudes | `resolucion_de` | ∈ {jefe, lider, consejo} | "Resuelta por el Jefe" / "Resolución del Consejo". |
| empleados | `sector` | `sector_personal not null default 'otro'` | H4. |
| empleados | `horas_semanales` | `numeric(5,2)` 0<x≤84, null = sale de `empleado_horarios` | H4. |
| perfiles | `dni` | `^[0-9]{7,8}$`, único global | F4. |
| perfiles | `creado_por` | `uuid` default `auth.uid()` (fuera del grant: no se falsea) | Trazabilidad de altas. |
| perfiles | `desactivado_por`, `desactivado_en` | los escribe el trigger `proteger_perfiles` al pasar `activo` a false (y los limpia al devolver el acceso) | Rastro de "Quitar acceso". |
| configuracion | `cuotas_default_quintero` | `integer not null default 4`, 1..31 | G7. |
| documentos_cliente | `categoria` | check largo 1..60 (texto libre) | C7. |
| documentos_cliente | `subido_por` | default `auth.uid()` (fuera del grant en 0022) | Autoría no falsificable. |
| ingresos_personal | `registrado_por` | default `auth.uid()`; check `egreso_en ≥ ingreso_en` | Las horas alimentan Novedades (H4). |
| cambios_pendientes | `revisar_despues` | `boolean not null default false` | Altas aplicadas en el acto que el Líder revisa después (§4.7, D-1). |

### 2.3 Tablas nuevas (0011)

**`tarifas_transporte`** (H1) — `id`, `org_id`, `nombre` (1–40, único por org), `precio numeric(14,2) ≥ 0`,
`unidad` (`vehiculo` \| `dia`), `icono` (`camioneta` \| `camion` \| `balancin` \| `equipo` \| `estadia`),
`orden`, `activo`, `creado_en`, `actualizado_por`, `actualizado_en`. Sin DELETE (se desactiva).
Semilla: Camioneta 6.000 · Chasis 8.000 · Balancín 9.000 · Equipo 12.000 (por vehículo) · Estadía diaria 12.000 (por día).

**`registro_mensajes`** (D5/D6) — `id`, `org_id`, `registro_id` (FK `sanciones` cascade), `autor_id`,
`autor_rol`, `autor_nombre`, `mensaje` (1–4000), `adjunto_path`, `es_descargo`, `creado_en`.
Trigger base `fijar_autor_registro` (BEFORE INSERT, reusa `private.fijar_autor_mensaje`: fija autor desde el
perfil real). El cliente solo manda `org_id, registro_id, mensaje, adjunto_path`. Adjuntos en
`{org}/clientes/{cliente}/registros/…` (cubierto por las policies de storage existentes).

**`novedades_personal`** (H4) — `id`, `org_id`, `empleado_id`, `sector` (foto; la fija el trigger de M7),
`tipo`, `fecha_desde`, `fecha_hasta` (solo vacaciones/licencia), `horas` (llegada tarde, horas extra,
horas del feriado; 0<h≤24), `justificada`, `detalle` (obligatorio en `otra`; ≤2000), `adjunto_path`,
`estado` (default pendiente), `cargada_por` (default `auth.uid()`), `cargada_en`, `revisada_por/en`,
`motivo_rechazo` (obligatorio si rechazada), `anulada_por/en`, `motivo_anulacion` (obligatorio si anulada),
`actualizada_en`. Índices por fecha, empleado, pendientes por sector y adjunto.

### 2.4 Vistas

- **`v_clientes_segmentos`** (nueva, `security_invoker`): `org_id, cliente_id, codigo, nombre, apodo, categoria, es_socio, activo, tiene_portal, segmentos text[]`. `tiene_portal` = usuario vinculado **y perfil activo** (`private.tiene_portal_activo`): quitarle el acceso a un socio no infla "51 lo ven en el portal". Cada rol ve solo los clientes que su RLS le deja. Uso: listado de Clientes, conteo del público de circulares (siempre con `clienteEnPublico()` de §5.5, no con `.overlaps` suelto: `socios` es filtro), exportación.
- **`v_avance_mes`** (nueva, `security_invoker`): `org_id, cliente_id, periodo, total, pagado, falta, cuotas, cuotas_cubiertas, cuota_sugerida`. La ÚNICA cuenta de "2 de 4 · Falta $165.000" (G5): cargos del período no anulados de origen `generacion`/`energia` (recurrentes + ABEN + consumo; afuera AMB diario, multas, RD y manuales); `falta` = exigible hoy; `cuotas_cubiertas` = `floor((total − falta) / (total/cuotas))`, tope `cuotas − 1` mientras falte algo; `cuota_sugerida` = `round(total/cuotas, 2)` y la última = `falta` exacto. La consumen M1 (buscador y PlanCuotas), M8 (inicio del Jefe) y M9 (mapa del Jefe) filtrando `periodo`; nadie la recalcula en TS (texto con `textoAvance()`, §5.5). Probado en la réplica: 330.000 en 4 → sugiere 82.500; tras 247.500 pagados sugiere exactamente 82.500 = lo que falta.
- **`v_deuda_clientes`** (reemplazada, compatible): suma al final `deuda_vencida numeric` (lo vencido, sin beneficio), `vencido_desde date` (vencimiento impago más viejo), `proximo_vencimiento date` (próximo en término). Base del semáforo B3.

### 2.5 Datos (0011)

**Catálogo final de conceptos** (orden de imputación = prioridad de cobro):

| Código | Nombre | Tipo | Precio | Orden | Beneficio | Segmento | Nota |
|---|---|---|---|---|---|---|---|
| EXPC | Alquiler Cocheras | recurrente | 31.000 | 10 | 0 % | cocheras | sin cambios |
| EXCO | Contribución Puestos | recurrente | 25.000 | 20 | 0 % | — | sin cambios |
| EXPQ | Expensas Quinteros | recurrente | **330.000** | 30 | 0 % | quinteros | la quinta entera por mes |
| AMB | **Ambulantes** | **diario** | **15.000** | 35 | 0 % | ambulantes | nuevo; por día, se cobra en el acto |
| EXME | **Expensas Cobradas** | recurrente | **1.080.000** | **40** | **15 %** | puesteros | **activo**; la expensa del puesto común |
| EXPP | **Expensas Puestos Propios** | recurrente | 1.080.000 | **45** | 15 % | puestos_propios | los 4 puestos de la cooperativa (supuesto) |
| EXPL | Expensas Locales | recurrente | 450.000 | 50 | 0 % | locales | |
| EXPG | Expensas Galpón | recurrente | 120.000 | 60 | 0 % | galpones | |
| EXPE | Expensas Contéiner | recurrente | 80.000 | 70 | 0 % | conteiners | |
| ABEN | **Abono mensual de energía** | **abono_energia** | **15.000** | 78 | 0 % | — | nuevo; a todo cliente con medidor activo |
| ENER | Recupero Energía (kWh) | energia | 600 | 80 | 0 % | — | sin cambios |
| RD | Reconocimiento de Deuda | deuda | 0 | 95 | 0 % | — | sin cambios |
| MULT | **Multas** | **eventual** | 0 | 97 | 0 % | — | nuevo; cargo desde un registro |
| BC | **Bono camioneros (canon de transporte)** | canon_diario | **0** | 100 | 0 % | — | precio en `tarifas_transporte` |

**Tarifas de transporte**: ver §2.3. **DNIs demo** (pass `SanMiguel2026`): Líder 20111111 · Administración
20222222 · Tesorería 20333333 · Jefe de Portería 20444444 · Portería 20555555 · Socio 20666666.
**Consejo**: el perfil `consejo@sanmiguel.coop` queda `activo = false`. `supabase/seed.sql` lo actualiza Fundación (§5).

### 2.6 Helpers de Fundación (0011 y 0012, congelados)

Privados: `language sql stable security definer set search_path = ''`, EXECUTE solo `authenticated`
(salvo triggers). Ningún módulo los modifica.

| Función | Devuelve | Regla |
|---|---|---|
| `private.categorias_gestionables()` | `categoria_cliente[]` | lider: las 3 · admin: `{puestero}` · guardia: `{quintero, ambulante}` · resto: `{}` |
| `private.cliente_de_porteria(p_cliente uuid)` | boolean | categoría quintero o ambulante |
| `private.puede_gestionar_cliente(p_cliente uuid)` | boolean | cliente de mi org y su categoría ∈ `categorias_gestionables()` |
| `private.carpeta_de_porteria(p_carpeta text)` | boolean | storage: carpeta `clientes/{id}` de un cliente de Portería de mi org |
| `private.segmentos_cliente(p_cliente uuid)` | `text[]` ordenado | conceptos activos (en cliente_conceptos activos) con segmento ∈ {puesteros, puestos_propios, locales, galpones, conteiners, cocheras} + `quinteros`/`ambulantes` por categoría + `socios` si es_socio |
| `private.cliente_en_publico(p_cliente uuid, p_publico text[])` | boolean | false si no existe o es ambulante; si `socios` ∈ público, además tiene que ser socio; si el público es null/vacío/tiene `todos`/solo `{socios}` → sin filtro de segmento; si no, algún segmento en común con `público − {socios}`. Probado en una réplica local (§11.1). |
| `private.tiene_portal_activo(p_user uuid)` | boolean | hay perfil activo para ese usuario (para `v_clientes_segmentos`) |
| `private.sectores_novedades()` | `sector_personal[]` | lider: todos · admin: porteria, limpieza, mantenimiento · guardia: porteria · resto: `{}`. En policies: `sector = any ((select private.sectores_novedades())::public.sector_personal[])` (§4.0-6). |
| `private.puede_gestionar_rol(p_org uuid, p_rol rol_usuario)` | boolean | nunca `consejo`; lider: todos; admin: `socio`; guardia: `porteria` |
| `private.validar_espacio_misma_org()` | trigger | `espacio_id` de la misma org; error "Ese lugar del plano no existe. Recargá la página y probá de nuevo". Triggers: `medidores_valida_espacio`, `solicitudes_valida_espacio`, `canon_valida_espacio`, `sanciones_valida_espacio`. |
| `private.tg_imputaciones_tope()` | constraint trigger diferido `imputaciones_tope` | Σ imputaciones del pago ≤ monto del pago (al commit). |
| `private.proteger_perfiles()` | trigger (reescrito) | ver §3.4 |
| `private.aplicar_saldo_favor(p_cliente)` (0012) | numeric | mismo algoritmo de fase 2 + **`for update` del cliente como primera sentencia** (§4.0-2). |
| `public.espacios_del_plano()` (0012) | `table(id, tipo, numero, medio, propio, grupo, x, y, w, h)` | espacios de mi org sin `cliente_id` ni `nota`; staff (admin, guardia, porteria, tesoreria, lider). Lo usan el mapa del Jefe, el selector de puesto de Portería/Tesorería/Jefe y la validación "Puesto 58 ✓". |

---

## 3. RLS y grants

### 3.1 Matriz final (después de 0022)

S = lee · I = inserta · U = actualiza · D = borra · "RPC" = solo por función security definer.
Consejo: conserva la lectura que ya tenía (arrays de policies) pero su perfil está desactivado y no
tiene UI; no se lista. "todo" = toda la organización.

| Tabla | Líder | Admin | Jefe (`guardia`) | Portería | Tesorería | Socio | Escrituras por RPC |
|---|---|---|---|---|---|---|---|
| clientes | S todo · I/U directo | S todo | S quinteros+ambulantes | – | S todo | S propio | alta/cambios: `solicitar_cambio` |
| cliente_conceptos | S · I/U/D | S | S de Portería | – | S | S propio | `solicitar_cambio` |
| cargos | S · I manual/deuda | S · I manual/deuda (puesteros) | S de Portería | – | S | S propio | multa, diario, generación, energía (I directo: solo columnas de alta, nace pendiente y sin pagos) |
| pagos | S | S | S de Portería | – | S · U `conciliado*` | S propio | `registrar_cobro`, `cobrar_diario`, `anular_pago` |
| imputaciones | S | S | S de Portería | – | S | S propio | idem |
| medidores | S I U D | S I U D | S de Portería | – | S | S propio | |
| lecturas | S | S | S de Portería | – | S | S propio | `registrar_lectura` |
| cheques | S | S | – | – | S · U `estado, fecha_depositado, fecha_acreditado, notas` | – | alta, `entregar_cheque`, `rechazar_cheque` |
| espacios | S | S | – (usa `espacios_del_plano()`) | – (usa `espacios_del_plano()`) | S | S propio | `asignar_espacios`, `editar_espacio` |
| plano_elementos | S | S | S | S | S | – | |
| tarifas_transporte (nueva) | S I U | S | S | S | S | – | |
| canon_camiones | S | S | S | S | S | – | `registrar_canon` (solo Portería), `anular_canon` |
| cajas | S | S | S tipo guardia | – (`estado_caja_porteria`) | S | – | todas las de caja |
| caja_eventos | S | S | S cajas guardia | – | S | – | RPC |
| movimientos_tesoreria | S | S con `caja_id` | S con caja guardia | – | S · I/U/D sin `caja_id` | – | ajustes de caja: `registrar_ajuste_caja` |
| saldos_iniciales | S | – | – | – | S I U D | – | |
| gastos | S | S · I · U (sin columnas de pago) · D no pagados | – | – | idem Admin | – | `pagar_gasto`, `revertir_pago_gasto`, `replicar_gastos_fijos`, `entregar_cheque` |
| rubros_gasto | S I U D | S I U D | S | S | S I U D | S | (sin cambios) |
| sanciones | S | S | – | – | – | S propio | `emitir_registro`, `dejar_sin_efecto_multa`, `marcar_registro_visto` |
| registro_mensajes (nueva) | S I | S I | – | – | – | S I propio | |
| circulares | S I U | S I U | – | – | S | S si está en el público | |
| circular_recepciones | S | S | – | – | S | S · I propio (circular activa y visible) | |
| solicitudes | S · U | S · U | S propias + origen `porteria` · I | S propias · I | S propias · I | S propias · I (portal) | `avanzar_solicitud` |
| solicitud_mensajes | como hoy (hereda de solicitudes) | | | | | | |
| empleados / empleado_horarios | S I U D | S | S | S | S | – | (sin cambios) |
| novedades_personal (nueva) | S I U D todos los sectores | S I U D porteria/limpieza/mantenimiento | S I U D porteria | – | – | – | `revisar_novedad`, `aprobar_novedades`, `anular_novedad` |
| ingresos_personal | S I U | S | S | S I U | S | – | trigger `proteger_ingreso` (M3) |
| perfiles | S · I/U todo el staff y socios (nunca consejo) | S · I/U socios | S equipo · I/U Portería | S equipo | S equipo | S propio | `autorizar_gestion_usuario` antes de todo `auth.admin.*` (M8) |
| configuracion | S U I (sin cuotas) | S U I (sin cuotas) | S (cuotas por RPC) | S | S | S | `guardar_cuotas_quinteros` |
| conceptos | S I U D | S (propone) | S (propone precio EXPQ/AMB) | S | S | S | `solicitar_cambio` |
| cambios_pendientes | S | S | S propias o de clientes de Portería | – | – | – | RPC |
| documentos_cliente | S I D | S I D puesteros | S I D quinteros/ambulantes | – | – | S I propio | (`subido_por` lo pone el servidor) |

Notas (grants por columna; todos en 0022 salvo perfiles, que va en 0011):
- `gastos` UPDATE: `rubro_id, tipo, descripcion, monto, vencimiento, factura_path, notas, periodo, estado, comprobante_validado, validado_por, validado_en`; INSERT: `org_id, rubro_id, tipo, descripcion, monto, vencimiento, factura_path, notas, periodo` (`creado_por` = default `auth.uid()`). Las transiciones de `estado` directas las acota el trigger de M6 (§4.9).
- `movimientos_tesoreria` INSERT: `org_id, fecha, tipo, descripcion, monto, moneda, cuenta, cuenta_destino, grupo_id` (sin `caja_id`, `ref` ni `creado_por`); UPDATE: `fecha, tipo, descripcion, monto, moneda, cuenta, cuenta_destino, grupo_id`. U/D solo filas con `caja_id is null`.
- `cargos` INSERT: `org_id, periodo, cliente_id, concepto_id, codigo, descripcion, cantidad, precio_unitario, monto, descuento_pronto_pago, vencimiento, origen`; sin UPDATE directo. La policy exige además `estado='pendiente'`, `monto_pagado=0`, `descuento_aplicado=0`.
- `solicitudes` INSERT: `org_id, tipo, asunto, detalle, cliente_id, referencia, origen, adjunto_path, creada_por, espacio_id` (cierra el agujero de insertar una solicitud "resuelta"); UPDATE suma `espacio_id`.
- `perfiles` INSERT: `user_id, org_id, nombre, rol, activo, dni` (`creado_por` = default `auth.uid()`); UPDATE: `nombre, activo, dni, rol`; sin DELETE. `desactivado_por/en` los escribe el trigger.
- `circular_recepciones` INSERT: `org_id, circular_id, cliente_id, recibida_por` (`recibida_en` = default `now()`: el socio no falsea la hora de "La vio").
- `documentos_cliente` INSERT: `org_id, cliente_id, categoria, titulo, storage_path, mime`; sin UPDATE.
- `configuracion` INSERT/UPDATE: `dia_vencimiento, impresion_directa, actualizado_en, actualizado_por` (+ `org_id` en INSERT). `cuotas_default_quintero` solo por `guardar_cuotas_quinteros`; `precio_canon_*` deprecados, nadie los escribe.
- `ingresos_personal` INSERT: `org_id, empleado_id, dni, nombre, apellido, firma_path, fuera_de_horario, notas` (`ingreso_en` = `now()`, `registrado_por` = `auth.uid()`); UPDATE: `egreso_en, notas` (como hoy) + trigger `proteger_ingreso` de M3.
- `registro_mensajes` INSERT: `org_id, registro_id, mensaje, adjunto_path`. `novedades_personal` INSERT: `org_id, empleado_id, tipo, fecha_desde, fecha_hasta, horas, justificada, detalle, adjunto_path`; UPDATE: los mismos sin org/empleado.
- `pagos`, `cheques`, `canon_camiones`, `sanciones`: sin INSERT/DELETE directos (y `sanciones`/`canon` sin UPDATE). `cheques` UPDATE: `estado, fecha_depositado, fecha_acreditado, notas`.

### 3.2 Storage (bucket `documentos`)

| Carpeta | Líder / Admin / Tesorería | Jefe | Portería | Socio |
|---|---|---|---|---|
| `{org}/clientes/{cliente}/…` (incl. `registros/`) | "staff gestiona documentos" (todo) | ALL si el cliente es de Portería (0022) | – | lee/sube lo propio |
| `{org}/comprobantes/…` | staff | sube; lee solo los que referencia un pago que ve (clientes de Portería); borra lo que subió y ningún pago usa (0022) | – | – |
| `{org}/firmas/…` | staff | – (0022) | ALL | – |
| `{org}/circulares/…` | staff | – | – | lee solo PDFs de circulares de su público (0022) |
| `{org}/novedades/…` (nueva) | staff | sube; lee lo referenciado por una novedad visible; borra lo que subió mientras la novedad esté pendiente (0011) | – | – |
| `{org}/solicitudes/…` | staff | como hoy | como hoy | como hoy |

### 3.3 Qué va en 0011 y qué en 0022

- **0011**: RLS de tablas nuevas (tarifas, registro_mensajes, novedades), storage de novedades, perfiles (seguridad: policies, grants, trigger), defaults de autoría (`creado_por`, `subido_por`, `registrado_por`), checks nuevos.
- **0022**: clientes y tablas hijas (Jefe solo Portería; Portería sin clientes), cargos manuales (grants + check), medidores, documentos + storage del Jefe, comprobantes del Jefe, cambios_pendientes, cheques, canon, espacios (sin Jefe ni Portería) y plano, perfiles (lectura: el Jefe, Portería y Tesorería solo ven al equipo), gastos (grants + `gastos_caja_efectivo` + borrar solo no pagados), movimientos_tesoreria, saldos_iniciales (UNIQUE por moneda), sanciones (solo RPC), circulares por público + recepciones + storage, solicitudes, configuración (sin Tesorería, sin cuotas), ingresos de personal y firmas (solo Portería + Líder).

### 3.4 `perfiles` (0011, F1–F5)

- UPDATE/INSERT solo si `private.puede_gestionar_rol(org_id, rol)` (para UPDATE se evalúa el rol viejo y el nuevo). Sin DELETE.
- Trigger `proteger_perfiles` (reescrito): no se cambia org ni user_id; al pasar `activo` true→false escribe `desactivado_por = auth.uid()`, `desactivado_en = now()` (y los limpia al devolver el acceso); `creado_por` no cambia. Con service role (`auth.uid()` nulo) permite el resto; si no: nadie cambia su propio rol ni se desactiva a sí mismo; solo el Líder cambia roles; nunca a `consejo`; socio ↔ equipo prohibido ("creá otro usuario"); siempre queda al menos un Líder activo.
- **La RLS protege la TABLA, no el service role.** Resetear contraseñas y banear sesiones (`auth.admin.*`) corren con el cliente admin, que saltea RLS y trigger. Por eso M8 llama SIEMPRE antes `rpc('autorizar_gestion_usuario', { p_user, p_accion })` con el cliente del usuario, con el `user_id` del objetivo (nunca un rol mandado por el cliente) (§4.11).

---

## 4. RPCs y funciones SQL

Convenciones para todas: `security definer`, `set search_path = ''`, `v_org := private.org_actual()`,
`v_rol := private.rol_actual()`, `v_hoy := private.hoy_ar()`; si `v_org` es null → `'Sin perfil activo'`.
Montos: `round(x, 2)`. Formato de pesos en mensajes: `'$ ' || replace(to_char(x, 'FM999G999G999G990'), ',', '.')`.
Fechas en mensajes: `to_char(d, 'DD/MM')`. "Evento" = `perform private.registrar_evento_caja(caja, tipo, detalle)`.

"Dueño" = único módulo que escribe la función (o el trigger) en su archivo.

### 4.0 Reglas transversales (obligatorias en todo cuerpo nuevo)

1. **Orden de bloqueo** (evita deadlocks): (a) candado de idempotencia → (b) caja → (c) cliente → (d) cargos (`for update`, en orden de imputación) → (e) cheques / gastos / sanciones / canon. Nunca al revés. Validá estados DESPUÉS de tomar el bloqueo (un `select` sin bloqueo puede ver una caja "abierta" que otra transacción está cerrando).
2. **Bloqueo del cliente**: toda RPC que imputa, desimputa o crea cargos de un cliente toma `select … from public.clientes where id = p_cliente and org_id = v_org for update` antes de tocar cargos o pagos: `registrar_cobro`, `cobrar_diario`, `anular_pago`, `emitir_registro`, `dejar_sin_efecto_multa`, `aplicar_saldo_favor_cliente`. `private.aplicar_saldo_favor` ya lo hace (0012) y `generar_periodo` lo hereda al llamarla por cliente.
3. **Bloqueo de la caja**:
   - `for share` — RPC que agregan movimientos a una caja **abierta** sin tocar la fila de la caja: `registrar_cobro`, `cobrar_diario`, `registrar_canon`. Se serializan contra `cerrar_caja` (que toma `for update`): o el cobro entra antes del cierre y el arqueo lo cuenta, o espera y ve la caja cerrada.
   - `for update` — RPC que cambian el arqueo de la caja o cuyo trigger hace UPDATE de la fila (con `for share` dos llamadas concurrentes se bloquean mutuamente): `pagar_gasto`, `revertir_pago_gasto`, `registrar_ajuste_caja`, `borrar_ajuste_caja`, `anular_canon`, `anular_pago`, `rechazar_cheque`, `cerrar_caja`, `integrar_caja_porteria`, `reabrir_caja`, `validar_caja`. Validan "no validada" después del bloqueo.
   - `private.recalcular_arqueo` (M2) lee la caja sin bloqueo, sale si está `abierta` o `validada`, y recién si va a escribir toma `for update` (así un trigger disparado desde un cobro en caja abierta nunca pide un bloqueo más fuerte que `for share`).
4. **Crear la caja del día** (abrir_caja, registrar_canon, pagar_gasto de Administración): `insert into public.cajas (org_id, tipo, fecha, abierta_por) values (v_org, <tipo>, v_hoy, auth.uid()) on conflict (org_id, tipo, fecha) do nothing returning id` → si devolvió fila, evento `apertura`; después `select … for share|update` y validar estado. Nunca `if not exists … insert` (dos porteros a la vez chocan con `cajas_org_id_tipo_fecha_key`).
5. **Idempotencia** (`p_lote` en `registrar_cobro`/`cobrar_diario`, `p_ref` en `registrar_canon`/`emitir_registro`/`registrar_ajuste_caja`): si viene la clave, primera sentencia después del chequeo de rol: `perform pg_advisory_xact_lock(hashtextextended('<nombre_rpc>:' || p_ref::text, 0));` → buscar lo ya registrado con esa clave en la org → si existe y es de OTRO cliente/caja/registro → `raise exception 'Ese cobro ya se registró para otro cliente'` (o el equivalente); si existe y es el mismo → devolver lo registrado con `"repetido": true` sin hacer nada (aunque la caja ya esté cerrada). Red de seguridad: el INSERT va en un bloque `begin … exception when unique_violation then <releer y devolver repetido> end`. Aceptación común: dos llamadas simultáneas con la misma clave devuelven el mismo número, sin error.
6. **`= any` con subconsulta**: nunca `x = any ((select f()))` sin cast (Postgres lo toma como ANY(subconsulta) y compara `x` con un array: ERROR 42883). Usar `x = any ((select f())::tipo[])` (mantiene el initPlan) o `x = any (f())`.
7. **`RETURNS TABLE`**: las columnas OUT son variables plpgsql. En `resumen_canon`, `resumen_novedades` y cualquier función con `returns table`, empezar el cuerpo con `#variable_conflict use_column` o calificar TODAS las columnas con alias de tabla.
8. **Rastro**: toda corrección de plata deja un evento en `caja_eventos` (`cobro_anulado`, `canon_anulado`, `gasto_revertido`, `ajuste`, `ajuste_borrado`, `arqueo_recalculado`, `cierre_forzado`) y/o columnas de rastro que ningún grant deja editar (`gastos.pago_revertido_*`, `cheques.rechazado_*`/`motivo_rechazo`, `sanciones.multa_sin_efecto_*`, `perfiles.desactivado_*`). Nada de motivos solo en `notas`.

### Índice de funciones

| Función | Estado | Dueño |
|---|---|---|
| `registrar_cobro`, `cobrar_diario`, `datos_recibo` | nuevas (stub en 0012) | M1 |
| `anular_pago`, `aplicar_saldo_favor_cliente`, `registrar_pago` | modificadas | M1 |
| `private.imputar_pago`, `private.resumen_lote` | nuevas privadas (las crea M1 en su archivo) | M1 |
| `arqueo_caja`, `registrar_ajuste_caja`, `borrar_ajuste_caja` | nuevas | M2 |
| `validar_caja` | firma nueva en 0012 (comportamiento viejo) → implementa M2 | M2 |
| `abrir_caja`, `cerrar_caja`, `integrar_caja_porteria`, `reabrir_caja` | modificadas | M2 |
| `private.calcular_arqueo` (nueva), `private.recalcular_arqueo` (mod), `private.tg_recalcular_caja` (trigger nuevo) | | M2 |
| `registrar_canon`, `anular_canon`, `estado_caja_porteria`, `resumen_canon` | nuevas | M3 |
| `private.tg_proteger_ingreso` + trigger `proteger_ingreso` en `ingresos_personal` | nuevo | M3 |
| `siguiente_codigo_cliente` | nueva | M4 |
| `solicitar_cambio`, `aprobar_cambio`, `private.aplicar_cambio` | modificadas | M4 |
| `emitir_registro`, `dejar_sin_efecto_multa`, `marcar_registro_visto` | nuevas | M5 |
| `private.tg_registro_mensaje` (triggers nuevos) | | M5 |
| `pagar_gasto`, `revertir_pago_gasto`, `replicar_gastos_fijos`, `entregar_cheque`, `vincular_cheque_gasto` | nuevas | M6 |
| `flujo_caja`, `resumen_gastos`, `rechazar_cheque` | modificadas | M6 |
| `private.tg_proteger_gasto`, `private.tg_proteger_cheque` (triggers nuevos) | | M6 |
| `revisar_novedad`, `aprobar_novedades`, `anular_novedad`, `resumen_novedades` | nuevas | M7 |
| `avanzar_solicitud` | modificada | M7 |
| `private.preparar_solicitud`, `private.tocar_solicitud`, `private.preparar_novedad` (triggers nuevos) | | M7 |
| `email_para_login`, `guardar_cuotas_quinteros`, `autorizar_gestion_usuario` | nuevas | M8 |
| `editar_espacio` | firma nueva en 0012 (comportamiento viejo) → implementa M9 | M9 |
| `generar_periodo`, `registrar_lectura`, `resumen_conceptos` | modificadas | M9 |
| `private.generar_abonos_energia` | nueva privada | M9 |
| `espacios_del_plano`, `private.aplicar_saldo_favor` (con bloqueo del cliente), `private.tg_imputaciones_tope`, helpers de §2.6, vistas, `private.proteger_perfiles` | Fundación (0011/0012, completas) | — |
| `solicitar_reapertura_caja`, `rechazar_reapertura_caja`, `asignar_espacios`, `rechazar_cambio`, `private.revertir_imputaciones`, `private.registrar_evento_caja` | sin cambios | — |

---

### 4.1 `registrar_cobro` — M1 (A1, A2, G2, G8, J1)

```
public.registrar_cobro(p_cliente uuid, p_caja uuid, p_lineas jsonb,
  p_notas text default null, p_permitir_saldo_favor boolean default false,
  p_lote uuid default null) returns jsonb
```

**Roles**: `admin` (caja `administracion`, clientes que `puede_gestionar_cliente` → puesteros) y `guardia`
(caja `guardia`, quinteros/ambulantes, sin cheque) y `lider` (caja `administracion`, cualquier categoría, con cheque; §1.3 D-P2). Tesorería no cobra.

**Línea** (`p_lineas` = array de 1 a 6):
```json
{ "medio": "efectivo" | "transferencia" | "cheque",
  "monto": 100000,
  "transferencia": { "titular": "Juan Pérez", "comprobante_path": "{org}/comprobantes/…" },
  "cheque": { "numero": "00012345", "cuit": "20123456783", "recibido_de": "Juan Pérez",
              "fecha_recepcion": "2026-09-28", "fecha_cobro": "2026-10-28",
              "estado": "en_cartera" | "entregado", "proveedor": "Frutas del Sur" } }
```

**Pasos** (reglas de §4.0)
1. Rol ∉ {admin, guardia} → error.
2. Idempotencia (§4.0-5): si `p_lote` no es null → `pg_advisory_xact_lock(hashtextextended('registrar_cobro:' || p_lote::text, 0))`; si ya hay pagos con ese `lote_id` en la org: de OTRO cliente → `'Ese cobro ya se registró para otro cliente'`; del mismo → devolver `private.resumen_lote(p_lote) || {"repetido": true}` sin hacer nada.
3. `p_lineas` es array de 1..6 elementos.
4. Caja de la org `for share`; después del bloqueo: `estado = 'abierta'` y tipo según rol.
5. Cliente de la org `for update` (serializa cobros, saldo a favor y anulaciones del mismo cliente). `private.puede_gestionar_cliente(p_cliente)` (el Líder no llega acá).
6. Validar TODAS las líneas antes de escribir: monto > 0; medio válido; guardia + cheque → error; transferencia exige `titular`; cheque exige `numero` (solo dígitos, 1–20), `cuit` (11 dígitos; el dígito verificador lo avisa la UI sin bloquear, §6 M1), `fecha_recepcion ≤ hoy` (default hoy), `fecha_cobro` (default hoy), `estado` ∈ {en_cartera, entregado} (default en_cartera), `proveedor` si entregado; mismo CUIT+N° repetido en el lote o ya cargado (no rechazado) → error.
7. `perform private.aplicar_saldo_favor(p_cliente)` (ya bloquea al cliente; acá es un re-bloqueo sin costo).
8. `v_numero := nextval(pg_get_serial_sequence('public.pagos','numero'))`.
9. `v_puestos` = snapshot de los espacios del cliente ordenados por tipo y número: `'Puesto 34½ · Puesto 52 · Local 3 · Contéiner 7'`.
10. Por cada línea, en orden efectivo → transferencia → cheque (y dentro, el orden recibido): si es cheque, insertar en `cheques` (`cuit`, `recibido_de` = dato o nombre del cliente, `titular` = lo mismo (compatibilidad), `es_tercero` = CUIT ≠ CUIT del cliente, `puesto` = v_puestos, `fecha_recibido`, `fecha_cobro`, `estado`, `proveedor`, y si es entregado: `fecha_entregado = hoy`, `entregado_por = auth.uid()`, `entregado_en_cobro = true`); insertar el pago con `overriding system value` (`numero = v_numero`, `lote_id = coalesce(p_lote, gen_random_uuid())` — uno solo para todas las líneas —, `linea` 1..n, `notas` solo en la línea 1, `titular_transferencia`, `comprobante_path`, `recibido_por = auth.uid()`); `private.imputar_pago(pago, cliente, monto, null)`; acumular lo que sobra. Los inserts van en un bloque `exception when unique_violation` (§4.0-5).
11. Si sobra > 0 y `not p_permitir_saldo_favor` → error de saldo a favor (texto exacto abajo; la UI pregunta y reintenta con `true` y el mismo `p_lote`).
12. Devolver `private.resumen_lote(lote)`.

**Errores**
- `'No tenés permiso para registrar cobros'`
- `'Agregá al menos un medio de pago'` · `'Un mismo cobro admite hasta 6 medios de pago'`
- `'Ese cobro ya se registró para otro cliente'`
- `'Caja inexistente'` · `'La caja ya está cerrada: pedí la reapertura para seguir cobrando'`
- `'Solo podés cobrar en la caja de portería'` · `'Solo podés cobrar en la caja de administración'`
- `'Cliente inexistente'` · `'A este cliente lo cobra Administración'` (guardia) · `'A quinteros y ambulantes los cobra el Jefe de Portería'` (admin)
- `'Cada medio de pago necesita un monto mayor a cero'` · `'Medio de pago inválido'`
- `'En portería se cobra solo en efectivo o transferencia'`
- `'Poné a nombre de quién está la cuenta que transfirió'`
- `'Poné el número del cheque (solo números)'` · `'El CUIT del cheque tiene que tener 11 números'` · `'La fecha de recepción no puede ser futura'` · `'Poné a qué proveedor se le entregó el cheque'` · `'El cheque N° % de ese CUIT ya está cargado'`
- `'El monto supera la deuda del cliente: sobran $ %. Confirmá si querés dejarlo como saldo a favor.'` (mismo texto que hoy)

**Retorno** (`private.resumen_lote`):
```json
{ "lote_id": "uuid", "numero": 1234, "pago_id": "uuid de la línea 1 (para /recibos)",
  "total": 200000,
  "pagos": [ { "pago_id": "uuid", "numero": 1234, "linea": 1, "medio": "efectivo", "monto": 100000, "anulado": false } ],
  "imputaciones": [ { "cargo_id": "uuid", "codigo": "EXME", "descripcion": "Expensas Cobradas", "periodo": "2026-09-01", "monto": 150000, "saldado": true } ],
  "saldo_favor": 0,
  "repetido": false }
```
`imputaciones` agrupadas por cargo (suma de todas las líneas vigentes del lote). **Efectos**: la caja está
abierta → no recalcula arqueo; sin eventos.

**`private.imputar_pago(p_pago uuid, p_cliente uuid, p_monto numeric, p_cargo_primero uuid default null) returns jsonb`**
(M1): mismo algoritmo que hoy (`registrar_pago` / `aplicar_saldo_favor`): cargos `pendiente|parcial` del
cliente `for update`, orden `(id = p_cargo_primero) desc, periodo, conceptos.orden_imputacion, creado_en`;
objetivo con beneficio si `hoy ≤ vencimiento`; salda → `descuento_aplicado`. Devuelve
`{"detalle": [{cargo_id, codigo, descripcion, periodo, monto, saldado}], "restante": n}`.
**`private.resumen_lote(p_lote uuid) returns jsonb`** (M1): el JSON de arriba sin `repetido`.

### 4.2 `cobrar_diario` — M1 (G5, G6)

```
public.cobrar_diario(p_cliente uuid, p_caja uuid, p_dias integer, p_lineas jsonb,
  p_desde date default null, p_notas text default null, p_lote uuid default null) returns jsonb
```
**Rol**: solo `guardia`. **Pasos** (reglas de §4.0): idempotencia por `p_lote` (igual que 4.1: candado,
otro cliente → error, mismo → `repetido`) → `p_dias` 1..31 → `v_desde = coalesce(p_desde, hoy)` entre
`hoy − 30` y `hoy + 31` → `v_hasta = v_desde + p_dias − 1` → caja `guardia` `for share` y abierta →
cliente de la org `for update`, `categoria = 'ambulante'`, `activo` → concepto `AMB` activo con precio > 0 →
sin cargo `origen='diario'` no anulado que se solape con `[v_desde, v_hasta]` → líneas 1..3, solo
efectivo/transferencia (mismas validaciones), suma exacta `= p_dias × precio` →
**`perform private.aplicar_saldo_favor(p_cliente)` ANTES de insertar el cargo** (si tenía crédito, va a
sus deudas viejas, no a este cobro) → insertar cargo AMB (`periodo` = 1° del mes de `v_desde`,
`descripcion` `'Ambulantes · 28/09'` o `'Ambulantes · 3 días (28/09 al 30/09)'`, `cantidad = p_dias`,
`precio_unitario`, `monto`, beneficio 0, `vencimiento = v_desde`, `origen = 'diario'`, `desde`, `hasta`,
`lote_id`) → número de recibo y pagos como en 4.1 → `private.imputar_pago(pago, cliente, monto, cargo_id)`
con el cargo nuevo primero: como las líneas suman exacto el cargo, todo va a SU cargo del día (nunca a
una multa vieja). Si al final sobra algo (no debería) → `raise exception 'No se pudo imputar el cobro
del ambulante: revisá los montos'` (no hay `p_permitir_saldo_favor`: nunca se genera saldo a favor en
silencio).

**Errores**: `'A los ambulantes les cobra el Jefe de Portería'` · `'Elegí entre 1 y 31 días'` ·
`'Elegí un día cercano a hoy'` · `'Solo podés cobrar en la caja de portería'` · `'La caja ya está cerrada: pedí la reapertura para seguir cobrando'` ·
`'Elegí un ambulante registrado'` · `'Este ambulante está dado de baja'` ·
`'Falta configurar el precio por día de los ambulantes (concepto AMB)'` ·
`'Ya tiene pagado del % al %: elegí otros días'` · `'Elegí cómo te paga'` ·
`'En portería se cobra solo en efectivo o transferencia'` · `'El total tiene que ser $ % (% días × $ %)'`.

**Retorno**: `resumen_lote || {"cargo_id", "desde", "hasta", "dias", "precio_dia"}`.

### 4.3 `datos_recibo` — M1 (B1, A1, A2)

```
public.datos_recibo(p_pago uuid) returns jsonb        -- stable
```
**Roles**: admin, tesoreria, lider (cualquier pago de la org); guardia (solo clientes de Portería);
socio (solo `cliente_id = private.cliente_actual()`). Si no corresponde → `'Recibo inexistente'` (nunca
revela que existe). **Retorno** (todo el lote del pago):
```json
{ "numero": 1234, "lote_id": "uuid", "fecha": "timestamptz de la línea 1", "anulado": false,
  "cliente": { "id": "uuid", "codigo": 12, "nombre": "…", "apodo": "…" },
  "caja": { "tipo": "administracion" | "guardia", "label": "Administración" | "Caja de portería", "fecha": "2026-09-28" },
  "recibio": "Marta Núñez",
  "notas": "…",                     // null para el socio
  "total": 200000,                   // líneas vigentes
  "lineas": [ { "pago_id": "uuid", "linea": 1, "medio": "cheque", "monto": 100000,
      "anulado": false, "motivo_anulacion": null,
      "titular_transferencia": null, "tiene_comprobante": false,
      "comprobante_path": null,        // siempre null para el socio
      "cheque": { "numero": "00012345", "cuit": "20123456783", "recibido_de": "…",
                  "fecha_recibido": "…", "fecha_cobro": "…", "puesto": "Puesto 52",
                  "estado": "en_cartera", "proveedor": null } } ],   // estado y proveedor null para el socio
  "imputaciones": [ { "cargo_id": "uuid", "codigo": "EXME", "descripcion": "…", "periodo": "2026-09-01",
                      "monto": 150000, "beneficio": 162000 } ],
  "saldo_favor": 0 }
```
`anulado` = todas las líneas anuladas. `beneficio` = `descuento_aplicado` si el cargo quedó pagado.

### 4.4 Modificadas de M1

- **`anular_pago(p_pago uuid, p_motivo text) returns void`** — misma firma. Anula el **recibo completo** (todas las líneas vigentes del lote del pago). Bloqueos §4.0: caja `for update` → cliente `for update` → cargos. Roles y reglas de hoy: admin solo cajas `administracion` abiertas; guardia solo `guardia` abiertas; tesorería también cerradas o integradas; nadie sobre validadas. Si alguna línea tiene cheque que no está `en_cartera` → `'El cheque N° % ya fue %: pedile a Tesorería que lo resuelva desde Cheques'` (depositado / acreditado / entregado a un proveedor). Revierte imputaciones de cada línea (orden `linea desc`), borra los cheques en cartera del lote, marca anuladas las líneas, pasa a `anulado` los cargos `origen='diario'` del lote que quedaron con `monto_pagado = 0`, **evento `cobro_anulado` `'Recibo N° 1234 · $ 200.000 · {motivo}'`** en la caja del pago, y si la caja está cerrada/integrada → `private.recalcular_arqueo`. Errores de hoy + `'El cobro ya está anulado'`.
- **`aplicar_saldo_favor_cliente(p_cliente)`** — roles `admin, guardia, lider` y `private.puede_gestionar_cliente` (Tesorería sale, J4). Error `'Sin permiso para aplicar saldo a favor'`. (Aplicar un crédito que ya está en la cuenta no mueve plata de ninguna caja: por eso el Líder sí puede.)
- **`registrar_pago(...)`** — DEPRECADA, misma firma. Pasa a ser un wrapper: arma una línea con `p_medio/p_monto/p_cheque/p_transferencia` y llama a `registrar_cobro`; devuelve la forma vieja `{pago_id, numero, imputaciones, saldo_favor}`. Así nadie cobra por fuera de las reglas nuevas. Rompe la UI de fase 2 (cheques sin CUIT, Tesorería): por eso se aplica en la ventana del deploy (§0.3). Se borra en 0023.

### 4.5 Cajas y arqueo — M2 (A3, E4, I2, J3)

**`private.calcular_arqueo(p_caja uuid) returns jsonb`** — la ÚNICA fórmula del arqueo (plpgsql, stable).
Para la caja C:

| Clave | Cálculo |
|---|---|
| `cobros_efectivo`, `cobros_transferencia`, `cobros_cheques`, `cobros` | Σ pagos de C no anulados por medio / total |
| `cheques_entregados` | Σ pagos de C **no anulados** con `medio='cheque'` y `cheques.entregado_en_cobro` (si el proveedor lo devolvió y se rechazó, la línea está anulada y ya no cuenta ni acá ni en `cobros_cheques`). Mismo criterio para `total_cheques_entregados`. |
| `quintas`, `ambulantes` | Σ pagos de C no anulados de clientes quintero / ambulante (todos los medios; 0 en cajas de administración) |
| `canon_efectivo`, `canon_transferencia`, `canon` | Σ `canon_camiones` de C no anulados |
| `rendido_efectivo`, `rendido_transferencia`, `rendido` | Σ `total_efectivo` / `total_transferencia` de las cajas con `caja_destino_id = C` en estado integrada/validada |
| `rendido_quintas`, `rendido_ambulantes`, `rendido_canon` | Σ `total_quintas` / `total_ambulantes` / `total_canon` de esas cajas |
| `juntado` | `cobros + canon + rendido` |
| `gastos_pagados` | Σ gastos `estado='pagado'`, `pagado_desde='caja'`, `caja_id = C` |
| `ajustes_efectivo`, `ajustes_transferencia`, `ajustes` | Σ `movimientos_tesoreria` con `caja_id = C` por `cuenta` (efectivo / banco), con signo |
| **`efectivo`** | `cobros_efectivo + canon_efectivo + rendido_efectivo − gastos_pagados + ajustes_efectivo` |
| **`transferencia`** | `cobros_transferencia + canon_transferencia + rendido_transferencia + ajustes_transferencia` |
| **`cheques`** | `cobros_cheques − cheques_entregados` (nunca negativo) |
| `cheques_entregados_detalle` | `[{numero, monto, proveedor}]` de esos cheques (el arqueo dice a quién fue cada "cheque entregado en el acto"). `arqueo_caja` lo arma siempre en vivo, también con `fuente: "cierre"`. |

Claves compatibles con fase 2 incluidas (`efectivo, transferencia, cheques, canon, gastos_pagados, rendido_efectivo, rendido_transferencia`).

**`private.recalcular_arqueo(p_caja uuid)`** (mod): si la caja está `abierta` o `validada` no hace nada
(validada = congelada). Si no, persiste `calcular_arqueo` en `total_efectivo, total_transferencia,
total_cheques, total_canon, total_gastos, total_rendido_efectivo, total_rendido_transferencia,
total_cobros, total_quintas, total_ambulantes, total_cheques_entregados, total_ajustes,
total_rendido_quintas, total_rendido_ambulantes, total_rendido_canon`. Si `total_efectivo` tenía valor y
cambia → evento `arqueo_recalculado` `'Efectivo: $ 1.000.000 → $ 950.000'`. Cascada al destino si está `cerrada`.

**Trigger `private.tg_recalcular_caja()`** (M2) — `after insert or update or delete` en `gastos`,
`canon_camiones` y `movimientos_tesoreria` (triggers `recalcular_caja` en cada tabla): recalcula
`old.caja_id` y/o `new.caja_id` cuando corresponden. Idempotente.

**`private.recalcular_arqueo`** bloquea como dice §4.0-3.

**`public.arqueo_caja(p_caja uuid) returns jsonb`** (nueva, stable). Roles: admin, tesoreria, lider
(cualquier caja de la org); guardia y porteria (cajas `guardia`). Devuelve
`calcular_arqueo(C) || {"caja_id", "tipo", "fecha", "estado", "fuente": "vivo"}` si está abierta; si no,
las columnas persistidas con las MISMAS claves y `"fuente": "cierre"`. Errores: `'Caja inexistente'`, `'Sin permiso'`.

**`abrir_caja(p_tipo)`** (mod): admin → `administracion`, guardia → `guardia`. Tesorería ya no abre
(`'Tesorería no abre cajas: las abre quien cobra'`). Crea con `on conflict (org_id, tipo, fecha) do nothing` (§4.0-4).

**`cerrar_caja(p_caja) returns jsonb`** (mod): admin su caja, guardia la de portería, tesorería solo cajas
de días anteriores que quedaron abiertas (evento `cierre_forzado`; si es de hoy:
`'Tesorería solo cierra cajas de días anteriores que quedaron abiertas'`). Evento `cierre` con
`'Efectivo $ X'`. Devuelve `calcular_arqueo` (superset de las claves viejas).

**`integrar_caja_porteria(p_caja, p_observaciones)`** (mod): igual que hoy + evento en el destino
`'Recibe la caja de portería del DD/MM: efectivo $ X — Quintas $ A · Ambulantes $ B · Bono camioneros $ C'`.
Devuelve `{"caja_destino", "efectivo", "transferencia", "canon", "quintas", "ambulantes", "ajustes"}`.

**`reabrir_caja(p_caja, p_motivo)`** (mod): además pone en null las 8 columnas nuevas.

**`validar_caja(p_caja uuid, p_observaciones text default null, p_efectivo_contado numeric default null)`**
(firma nueva, M2 implementa): solo tesorería. Nuevo: una caja `guardia` en estado `cerrada` (no integrada)
no se valida (`'Primero hay que recibir la caja de portería en la caja de administración'`). Si
`p_efectivo_contado` no es null y difiere del `total_efectivo` recalculado: inserta un ajuste
(`movimientos_tesoreria` tipo `ajuste`, cuenta `efectivo`, `caja_id`, `monto = contado − total_efectivo`,
`descripcion 'Diferencia de arqueo al validar: contado $ X'`), evento `ajuste`, recalcula y valida. Resto igual.

**`registrar_ajuste_caja(p_caja uuid, p_cuenta cuenta_tesoreria, p_monto numeric, p_motivo text, p_ref uuid default null) returns uuid`**
(nueva): solo tesorería; idempotencia por `p_ref` (§4.0-5: si ya existe el movimiento con ese `ref`, devuelve su id); caja `for update`; `p_monto ≠ 0` (+ sobrante, − faltante); motivo obligatorio; caja de la org no
validada (abierta, cerrada o integrada), verificado después del bloqueo. Inserta el movimiento (`fecha` = fecha de la caja, `tipo='ajuste'`,
`moneda='ARS'`, `cuenta = p_cuenta`, `caja_id`, `descripcion = motivo`, `ref = p_ref`) y evento `ajuste`
`'Faltante $ 500 en efectivo: Faltante en el conteo'`. El trigger recalcula. Devuelve el id.
Errores: `'Solo tesorería carga ajustes de caja'` · `'Poné el monto del ajuste'` · `'Contá el motivo del ajuste'` ·
`'Caja inexistente'` · `'La caja ya fue validada: cargá el ajuste en Tesorería'`.

**`borrar_ajuste_caja(p_ajuste uuid, p_motivo text)`** (nueva; **motivo obligatorio, sin default**): solo tesorería; caja `for update`; el movimiento
tiene `caja_id` y la caja no está validada; borra y evento `ajuste_borrado` `'Ajuste de $ 500 en efectivo (Faltante en el conteo) borrado: {motivo}'` (el evento guarda monto y motivo: el rastro queda aunque la fila se borre). Errores `'Contá por qué lo borrás'` · `'Ese ajuste ya no se puede borrar'`.

### 4.6 Portería — M3 (H1, H2, G4)

**`registrar_canon(p_tarifa uuid, p_cantidad integer default 1, p_medio medio_pago default 'efectivo',
p_patente text default null, p_destino text default null, p_destino_detalle text default null,
p_notas text default null, p_ref uuid default null) returns jsonb`**
- Rol: `porteria` y `lider` (§1.3 D-P2). Administración y el Jefe no: `'El canon de transporte lo cobra Portería'`.
- Idempotencia por `p_ref` (§4.0-5: candado + registro existente con `"repetido": true`; el INSERT con `exception when unique_violation` por `canon_ref_unq`).
- Tarifa de la org y activa (`'Esa tarifa ya no está disponible. Actualizá la pantalla.'`), precio > 0 (`'La tarifa de % no tiene precio: pedile al Líder que la cargue'`); cantidad 1..99 (`'La cantidad va de 1 a 99'`); medio efectivo/transferencia (`'El canon se cobra en efectivo o por transferencia'`).
- Patente: mayúsculas sin espacios ni guiones, 5–8 alfanuméricos (`'La patente no parece válida (ej.: AB123CD o ABC123)'`).
- Destino ∈ {puesto, verdulero, ambulante} (`'Elegí a quién viene: puesto, verdulero o ambulante'`); `p_destino_detalle` solo si es puesto (`'El número de puesto va solo si viene a un puesto'`) y tiene que existir un espacio tipo puesto con ese número (`'No existe el puesto %'`); si hay uno solo → `espacio_id`.
- Caja `guardia` de HOY: si no existe la crea con `on conflict do nothing` (§4.0-4; `abierta_por = auth.uid()`, evento `apertura` `'Abierta por Portería con el primer ingreso de transporte'`); la toma `for share`; si no está abierta → **`'La caja de portería de hoy ya se rindió. Avisale al Jefe de Portería: él pide la reapertura a Administración.'`** (el Jefe no reabre: pide; reabre Administración, o Tesorería si ya estaba integrada). Mismo texto en el aviso de `/porteria`.
- Inserta (`tipo = 'camion'` por compatibilidad, `tarifa_*` snapshot, `monto = precio × cantidad`, `fecha = hoy`, `creado_por`).
- **Retorno**: `{"id", "numero", "monto", "tarifa", "cantidad", "unidad", "caja_id", "repetido": false}`.

**`anular_canon(p_canon uuid, p_motivo text) returns void`** — caja `for update` y después el canon `for update` (§4.0-3); motivo obligatorio (`'Contá por qué lo anulás'`);
existe y no anulado (`'Ese cobro ya estaba anulado'`); caja no validada. Portería: solo los propios, dentro de
15 minutos y con la caja abierta (`'Pasaron más de 15 minutos: pedile al Jefe de Portería que lo anule'`);
Jefe: cualquiera con la caja abierta (`'La caja ya se rindió: pedí la reapertura'`); Tesorería: con la caja
abierta, cerrada o integrada. Marca anulado y evento `canon_anulado`
`'N° 124 · Camioneta × 2 · $ 12.000 · Se cargó dos veces'`. El trigger de M2 recalcula si la caja estaba cerrada.

**`estado_caja_porteria() returns jsonb`** (stable) — roles porteria, guardia, lider, admin, tesoreria.
`{"caja_id": uuid|null, "fecha": "hoy", "estado": "abierta"|"cerrada"|"integrada"|"validada"|null, "reapertura_pedida": bool}`.

**`resumen_canon(p_desde date, p_hasta date) returns table(tarifa, unidad, entradas, cantidad, monto, efectivo, transferencia)`**
(stable) — roles porteria, guardia, admin, tesoreria, lider; agrupa por `tarifa_nombre, unidad` sin anulados, orden por monto desc. Las columnas OUT (`unidad`, `cantidad`, `monto`…) chocan con columnas de `canon_camiones`: cuerpo con `#variable_conflict use_column` o todo calificado (§4.0-7).

**Trigger `proteger_ingreso`** (BEFORE UPDATE en `ingresos_personal`, `private.tg_proteger_ingreso`, M3): rechaza `egreso_en > now() + 5 minutos` (`'La hora de salida no puede ser futura'`) y `egreso_en < ingreso_en` (`'La salida no puede ser antes de la entrada'`); si `old.egreso_en` ya tenía valor y cambia, solo el Líder (`'La salida ya estaba marcada: pedile al Líder de Procesos que la corrija'`); nunca cambia `ingreso_en`, `empleado_id`, `dni` ni `registrado_por` (los fija a `old`). Así nadie infla ni borra horas de compañeros (H4).

### 4.7 Clientes y aprobaciones — M4 (C1–C8, G6–G8)

**`siguiente_codigo_cliente() returns integer`** (stable): roles admin, guardia, lider;
`greatest(max(clientes.codigo de la org), max(codigo de altas pendientes)) + 1` mirando TODOS los clientes
(el Jefe no los ve por RLS). Error `'Sin permiso'`.

**`solicitar_cambio(...)`** (misma firma) — reglas nuevas:
- Roles: `admin, guardia, lider` (Tesorería y Consejo salen: `'No tenés permiso para proponer cambios'`).
- `cliente` alta: `categoria` del payload (default: guardia → `quintero`, admin → `puestero`) validada contra `private.categorias_gestionables()`; se escribe en `p_datos` para que `aplicar_cambio` la reciba. Modificación/baja: la categoría actual y la nueva (si viene) tienen que ser gestionables. Mensajes: `'Desde Portería solo se gestionan quinteros y ambulantes'` (guardia) · `'A quinteros y ambulantes los gestiona el Jefe de Portería'` (admin). Pasar a `ambulante` un cliente con acceso al portal → `'Un ambulante no puede tener acceso al portal: quitale el acceso primero'`. `categoria` inválida → `'Categoría inválida'` (validar con IN antes de castear).
- `cliente_concepto`: el cliente tiene que ser gestionable; guardia solo conceptos con `segmento ∈ {quinteros, ambulantes}` (`'Ese concepto lo gestiona Administración'`); admin no esos (`'Ese concepto lo gestiona el Jefe de Portería'`). Excepción: conceptos `tipo ∈ {energia, abono_energia}` los propone Administración para cualquier cliente (Energía es de Administración; permite "Eximir del abono").
- `concepto`: alta solo el Líder (`'Los conceptos nuevos los da de alta el Líder de Procesos'`); guardia solo `modificacion` con la clave `precio` y `segmento ∈ {quinteros, ambulantes}` (`'Desde Portería solo se cambia el precio de Quintas y Ambulantes'`); admin no toca esos segmentos ni BC (`'Ese precio lo maneja Portería'`).
- **Decisión D-1 — RESUELTA: opción A (§1.3 D-P1). Alta de ambulante del Jefe.** Opción A (la que se implementa): un `cliente/alta` con `categoria='ambulante'` pedido por `guardia` se aplica en el acto (`private.aplicar_cambio`) y el cambio queda `estado='aprobado'`, `revisado_por = null`, `revisar_despues = true`, resumen `'Alta de ambulante Juan Pérez (aplicada en el acto, revisala)'`; devuelve `estado: "aplicado"`. Solo altas de ambulantes: las modificaciones, bajas y los quinteros siguen pasando por el Líder.
- Retorno igual que hoy: `{estado: "aplicado"|"pendiente", cambio_id, resultado_id}`.

**`private.aplicar_cambio(p_cambio)`** (mod): cliente/alta y modificación aceptan `categoria` y `es_socio`;
en el alta de un quintero sin `cuotas_mes` usa `configuracion.cuotas_default_quintero`. cliente_concepto/alta
acepta `activo` (default true) — así "Eximir del abono" es un alta de ABEN con `activo: false`.
concepto/alta y modificación aceptan `segmento`.

**`aprobar_cambio(p_cambio)`** (mod): si el cambio viola `clientes_ambulante_sin_portal`, devolver
`'Este ambulante tiene acceso al portal: quitáselo antes de aprobar'` en vez del error de constraint.
Sobre un cambio `aprobado` con `revisar_despues = true` y `revisado_por is null` (D-1 opción A): no
vuelve a aplicar nada, solo marca `revisado_por/en` ("Revisada"). Si el Líder no está de acuerdo, da de
baja al ambulante con un cambio normal (modificación `activo: false`).

**Payloads de `solicitar_cambio`** (amplía FASE2 §2):
- cliente/alta: `{ codigo, nombre, apodo?, categoria, es_socio, tipo_persona, cuit?, telefono?, email?, direccion?, notas?, cuotas_mes, conceptos?: [{concepto_id, cantidad}] }`
- cliente/modificacion: solo claves que cambian, incluidas `categoria` y `es_socio`.
- cliente_concepto/alta: `{ cliente_id, concepto_id, cantidad, notas?, activo? }`.

### 4.8 Comunicaciones — M5 (D1–D7, B2)

**`emitir_registro(p_cliente uuid, p_tipo tipo_sancion, p_titulo text, p_detalle text default null,
p_fecha date default null, p_storage_path text default null, p_espacio uuid default null,
p_multa numeric default null, p_multa_vencimiento date default null, p_ref uuid default null) returns jsonb`**
- Idempotencia por `p_ref` (§4.0-5): la UI manda `crypto.randomUUID()` por intento; si ya existe un registro con ese `ref`, devuelve el existente con `"repetido": true` (doble toque = UNA multa). Cliente `for update` antes de crear el cargo (§4.0-2).
- Roles: admin, lider, con `private.puede_gestionar_cliente(p_cliente)` (Administración: puesteros; Líder: todos) → `'No tenés permiso para emitir registros sobre este cliente'`.
- Título obligatorio (`'Poné un título (ej.: Falta de limpieza del puesto)'`); cliente activo (`'Cliente inexistente o dado de baja'`); `p_espacio`, si viene, tiene que ser un espacio del cliente (`'Ese puesto no es de este cliente'`); multa solo en apercibimiento/sanción (`'Las notificaciones no llevan multa'`), > 0; `v_fecha = coalesce(p_fecha, hoy)`; `v_venc = coalesce(p_multa_vencimiento, v_fecha + 10)` y no antes de `v_fecha` (`'La multa no puede vencer antes de la fecha del registro'`); `p_storage_path` tiene que empezar con `{org}/clientes/{cliente}/`.
- Inserta el registro (`estado='notificado'`, `ref = p_ref`). Si hay multa: concepto `MULT` activo (`'Falta el concepto MULT (Multas) en Configuración'`) → cargo (`periodo` = mes de `v_fecha`, `codigo='MULT'`, `descripcion 'Multa · Apercibimiento N° 12 · Falta de limpieza'`, cantidad 1, `precio_unitario = monto = multa`, beneficio 0, `vencimiento = v_venc`, `origen = 'multa'`) → `sanciones.multa, multa_vencimiento, cargo_id` → `private.aplicar_saldo_favor(cliente)`.
- **Retorno**: `{"id", "numero", "cargo_id": uuid|null, "multa": n|null, "repetido": bool}`. Sin efectos en cajas.

**`dejar_sin_efecto_multa(p_registro uuid, p_motivo text) returns void`** — roles admin, lider con
`puede_gestionar_cliente`; motivo obligatorio (`'Contá por qué la multa queda sin efecto'`); cliente `for update` y
después el cargo `for update` ANTES de mirar `monto_pagado` (un cobro en paralelo no se cuela); el registro tiene
multa vigente (`'Este registro no tiene una multa vigente'`); si el cargo tiene `monto_pagado > 0` →
`'La multa ya tiene $ % cobrados: anulá primero ese cobro desde la caja'`; si no, cargo `estado = 'anulado'`
y `multa_sin_efecto_en/_por/_motivo`.

**`marcar_registro_visto(p_registro uuid) returns void`** — solo socio; el registro es de
`private.cliente_actual()` (si no, `'Registro inexistente'`); `visto_en = coalesce(visto_en, now()), socio_leyo_en = now()`.
Silencioso. M5 la llama CADA VEZ que el socio abre el detalle. Reglas únicas (TS en `src/lib/segmentos.ts`, §5.5):
`registroSinVer` = `visto_en === null`; `respuestaNueva` = `estado === 'respondido' && ultimo_mensaje_en > (socio_leyo_en ?? -∞)`.
Badge del portal = circulares visibles sin recepción + registros sin ver + registros con respuesta nueva.

**Triggers de `registro_mensajes`** (M5, en su `0017_fase3_comunicaciones.sql`): `registro_mensaje_descargo` BEFORE INSERT (se
dispara después de `fijar_autor_registro` por orden alfabético) fija `es_descargo = (autor_rol = 'socio')`;
`registro_mensaje_estado` AFTER INSERT actualiza `sanciones`: socio → `estado = 'descargo'`; staff y el
estado era `descargo` → `respondido`; siempre `ultimo_mensaje_en = now()`. Función: `private.tg_registro_mensaje()`
(una o dos, a criterio de M5), **security definer** (el socio no tiene UPDATE sobre `sanciones`). Escritura del socio: directo por RLS (nunca en circulares: son otra tabla).

**Circulares** (sin RPC): alta directa con `publico` (RLS admin/lider) armado con `armarPublico()` (§5.5). "La vio" = insert directo en
`circular_recepciones` desde el portal (`recibida_en` la pone el servidor): obligatorias al tocar "Confirmo que la recibí"; informativas al
abrirlas. El público se calcula en la UI con `v_clientes_segmentos` + `clienteEnPublico()` (§5.5), que es el espejo exacto de `private.cliente_en_publico` (`socios` = filtro).

### 4.9 Tesorería, gastos y cheques — M6 (E1–E4, J2, J3, J5, J6)

**`pagar_gasto(p_gasto uuid, p_origen text, p_medio medio_pago default 'efectivo', p_fecha date default null,
p_caja uuid default null) returns jsonb`**
- Roles: admin, tesoreria (`'No tenés permiso para pagar gastos'`).
- Bloqueos (§4.0): primero la caja `for update` (si es de caja), después el gasto `for update`; recién ahí validar `pendiente` (`'El gasto ya no está pendiente. Actualizá la página.'`) y "no validada". Si Tesorería está validando esa caja a la vez, una espera a la otra: nunca queda un gasto imputado a una caja validada.
- `p_origen = 'caja'`: siempre efectivo (`p_medio` distinto → `'De la caja del día solo sale efectivo'`); caja = `p_caja` o la de administración de HOY. Si la de hoy no existe: **Administración** la crea (§4.0-4, evento `apertura` `'Abierta al pagar un gasto'`); **Tesorería no abre cajas** → `'Todavía no hay caja de Administración hoy: pagalo desde Tesorería o elegí otro día'`. Tipo `administracion` (`'Elegí una caja de administración'`); no validada (`'La caja del % ya la validó tesorería: elegí otro día o pagalo desde Tesorería'`); `fecha_pago` = fecha de la caja.
- `p_origen = 'tesoreria'`: medio efectivo o transferencia (`'Elegí efectivo o banco'`); `fecha_pago = coalesce(p_fecha, hoy)`, no futura (`'La fecha de pago no puede ser futura'`).
- Otro → `'Elegí de dónde sale la plata'`.
- Update: `estado='pagado', fecha_pago, medio_pago, pagado_desde, caja_id, pagado_por, pagado_en`.
- Si es de caja: evento `gasto_imputado` `'{descripción o rubro} — $ X'` + `' (cargado después del cierre)'` si la caja no está abierta. El trigger de M2 recalcula (y deja `arqueo_recalculado`).
- **Retorno**: `{"caja_id": uuid|null, "caja_fecha": date|null, "caja_estado": text|null, "efectivo_caja": n|null (arqueo después), "fecha_pago": date, "arqueo_recalculado": bool}`.

**`revertir_pago_gasto(p_gasto uuid, p_motivo text) returns void`** — admin, tesoreria; motivo obligatorio
(`'Contá por qué deshacés el pago'`); `pagado` (`'Ese gasto no está pagado'`); pagado con cheque →
`'Se pagó con un cheque: resolvelo desde Cheques'`; caja validada → `'La caja de ese día ya fue validada'`.
Bloqueos: caja `for update` (si era de caja) → gasto `for update`. Vuelve a `pendiente` limpiando datos de pago y validación del comprobante,
escribe `pago_revertido_por = auth.uid()`, `pago_revertido_en = now()`, `pago_revertido_motivo = motivo` (rastro no editable;
`notas` no se toca) y evento `gasto_revertido` `'{descripción o rubro} — $ X: {motivo}'` si era de caja.

**`replicar_gastos_fijos(p_desde_periodo date, p_hasta_periodo date, p_items jsonb) returns jsonb`** —
admin, tesoreria. `p_items = [{"origen_id": uuid, "monto": n, "vencimiento": "YYYY-MM-DD"|null, "descripcion": text|null}]`.
Ambos períodos día 1 y `hasta > desde`; cada origen: de la org, `tipo='fijo'`, `periodo = p_desde`, no anulado;
monto > 0 (`'El monto de % tiene que ser mayor a cero'`); ya replicado (índice único) → se omite.
Inserta: rubro, `tipo='fijo'`, descripción (item o del origen), monto, vencimiento (item o el del origen +
1 mes), `periodo = p_hasta`, notas del origen, `origen_id`, `creado_por`. Vacío → `'Elegí al menos un gasto para traer'`.
**Retorno**: `{"creados": n, "omitidos": [uuid], "total": n}`.

**`entregar_cheque(p_cheque uuid, p_proveedor text, p_fecha date default null, p_gasto uuid default null) returns void`**
— solo tesorería (`'Solo Tesorería entrega cheques'`); proveedor obligatorio (`'Poné a qué proveedor se lo entregaste'`);
fecha ≤ hoy; cheque `en_cartera` (`'Solo se entregan cheques que están por cobrar'`, aunque sea diferido). Si
`p_gasto`: gasto de la org `pendiente` (`'Ese gasto ya no está pendiente'`) → pagado con `pagado_desde='cheque'`,
`medio_pago='cheque'`, `fecha_pago`, `pagado_por/en`. Cheque → `entregado`, `proveedor`, `fecha_entregado`,
`entregado_por`, `gasto_id`. Sin efecto en cajas (el cheque ya estaba en tesorería).

**`vincular_cheque_gasto(p_cheque uuid, p_gasto uuid) returns void`** (nueva) — cierra el circuito del cheque
"Se lo di a un proveedor" en el mismo cobro (§1.1-5). Solo tesorería (`'Solo Tesorería vincula cheques con gastos'`).
Cheque de la org `for update` en estado `entregado` con `gasto_id is null` (`'Ese cheque ya está vinculado o no fue
entregado a un proveedor'`); gasto de la org `for update` y `pendiente` (`'Ese gasto ya no está pendiente'`). Efecto:
gasto → `pagado`, `pagado_desde='cheque'`, `medio_pago='cheque'`, `fecha_pago = cheque.fecha_entregado`,
`pagado_por = auth.uid()`, `pagado_en = now()`; cheque → `gasto_id`. Sin efecto en cajas. Si después el cheque se rechaza,
`rechazar_cheque` devuelve el gasto a pendiente (igual que con `entregar_cheque`).

**`flujo_caja() returns jsonb`** (mod, misma firma). Roles tesoreria, lider (+consejo). Cada cuenta cuenta
desde la `fecha` de su saldo inicial inclusive (sin saldo: todo el histórico, como hoy).
```json
{ "pesos":   { "efectivo": n, "efectivo_en_cajas": n, "banco": n, "total": n },
  "dolares": { "efectivo": n, "banco": n, "total": n },
  "cheques": { "por_cobrar": n, "listos": n, "depositados": n, "total": n },
  "total_pesos": n,
  "efectivo": n, "banco": n, "cheques_en_cartera": n, "total": n }
```
- Pesos efectivo = saldo inicial (efectivo, ARS) + pagos efectivo + canon efectivo (no anulado) − gastos pagados en efectivo + efecto de movimientos ARS sobre `efectivo` (incluye ajustes de caja).
- Pesos banco = saldo (transferencia, ARS) + pagos transferencia + canon transferencia + cheques acreditados − gastos por transferencia + efecto de movimientos ARS sobre `banco`.
- Efecto de un movimiento: `ajuste` suma su signo en `cuenta`; `ingreso` suma; `impuesto, debito_fiscal, comision, egreso` restan; `deposito`/`extraccion` restan de `cuenta` y suman en `cuenta_destino`.
- Dólares: saldos iniciales USD + movimientos USD (mismas reglas).
- `efectivo_en_cajas` = efectivo que sigue en cajas no validadas (administración y portería sin integrar).
- Cheques: `por_cobrar` = en cartera; `listos` = en cartera con `fecha_cobro ≤ hoy`; `depositados`; los entregados y rechazados no cuentan.
- Compatibilidad: `efectivo`, `banco`, `cheques_en_cartera = por_cobrar + depositados`, `total = total_pesos`.

**`resumen_gastos(p_periodo)`** (mod): filtra por `gastos.periodo` (ya no por `coalesce(fecha_pago, vencimiento, creado_en)`); roles admin, tesoreria, lider (+consejo).

**`rechazar_cheque(p_cheque, p_motivo)`** (mod): solo tesorería; motivo obligatorio. Bloqueos: caja del pago `for update` →
cliente → cheque. Acepta en_cartera, depositado, acreditado o entregado (el proveedor lo devolvió). Escribe
`rechazado_por`, `rechazado_en`, `motivo_rechazo` (no en `notas`). Si tenía `gasto_id` pagado con cheque → el gasto vuelve a
`pendiente` con `pago_revertido_*` = `'Cheque N° % rechazado'`. Anula SOLO la línea del pago que lo recibió (como hoy),
evento `cobro_anulado` `'Recibo N° X · cheque N° Y rechazado: {motivo}'` y recalcula la caja si está cerrada/integrada.

**Triggers de M6** (BEFORE UPDATE; "directo" = `current_user = 'authenticated'`, o sea no viene de una
función security definer). Las dos funciones de trigger van **`security invoker`** (el default, NO definer):
si fueran definer, `current_user` adentro sería siempre el dueño y no se podría distinguir. Solo leen
`new`/`old`, así que no necesitan privilegios extra. `set search_path = ''` igual.
- `proteger_gasto` en `gastos` (`private.tg_proteger_gasto`): directo solo permite cambiar `estado` de `pendiente` a `anulado`; en un gasto `pagado` no deja cambiar `monto`, `rubro_id` ni `periodo` (`'Deshacé el pago para cambiar el monto'`).
- `proteger_cheque` en `cheques` (`private.tg_proteger_cheque`): directo solo `en_cartera → depositado` (exige `fecha_depositado`, no antes de `fecha_cobro`: `'Este cheque se puede depositar desde el %'`), `depositado → acreditado` (exige `fecha_acreditado`) y `depositado → en_cartera` (deshacer). El resto: `'Eso se hace desde Cheques con su botón'`.

### 4.10 Personal, novedades y solicitudes — M7 (H3, H4, G11, J5, F5)

**Trigger `preparar_novedad`** (BEFORE INSERT OR UPDATE en `novedades_personal`, `private.preparar_novedad`):
- Empleado de la org (`'Ese empleado no existe'`); en UPDATE no se cambia el empleado.
- INSERT: `sector` = sector actual del empleado; `cargada_por = auth.uid()`; guardia → `estado='pendiente'`; admin/lider → `aprobada` con `revisada_por/en`. `sector ∈ private.sectores_novedades()` (`'No podés cargar novedades de ese sector'`).
- Sin fecha futura para falta, llegada tarde, feriado trabajado y horas extra (`'Esa novedad no puede tener fecha futura'`); sin superposición con otra del mismo tipo pendiente/aprobada del mismo empleado (`'Ya hay una novedad igual cargada para esos días'`).
- UPDATE: `actualizada_en = now()`.

**`revisar_novedad(p_novedad uuid, p_aprobar boolean, p_motivo text default null) returns estado_novedad`** —
admin, lider, sector en su alcance (`'Sin permiso sobre ese sector'`); `pendiente` (`'La novedad ya fue revisada'`);
rechazo con motivo (`'Contá por qué se rechaza'`). Devuelve el estado nuevo.
**`aprobar_novedades(p_ids uuid[]) returns integer`** — aprueba las pendientes de la lista que estén en su alcance; devuelve cuántas.
**`anular_novedad(p_novedad uuid, p_motivo text) returns void`** — admin, lider; solo `aprobada`
(`'Solo se anulan novedades aprobadas (las pendientes se borran)'`); motivo obligatorio.

**`resumen_novedades(p_periodo date) returns table(...)`** (security invoker: la RLS recorta; filtra además
por `private.sectores_novedades()` con el cast de §4.0-6). Las columnas OUT (`empleado_id`, `apellido`, `nombre`, `dni`,
`sector`, `activo`, `horas_semanales`…) chocan con columnas de `empleados`: `#variable_conflict use_column` o todo
calificado (§4.0-7). Una fila por empleado vigente en el mes:
- `horas_semanales` = la del contrato o Σ franjas de `empleado_horarios`.
- `horas_esperadas` = por cada día vigente del mes (desde ingreso hasta egreso; en el mes en curso, hasta hoy): si hay `horas_semanales` → `horas_semanales / 7`; si no, Σ franjas de ese día de la semana. Se descuentan los días cubiertos por vacaciones/licencias aprobadas.
- `horas_registradas` = Σ (egreso − ingreso) de `ingresos_personal` (por `empleado_id`, o por DNI si es null), tope 16 h por ingreso, atribuidas al día AR del ingreso; `ingresos`, `ingresos_sin_salida` (de días anteriores).
- Contadores de novedades aprobadas del mes: `faltas`, `faltas_injustificadas`, `llegadas_tarde`, `horas_tarde`, `feriados_trabajados`, `horas_feriado`, `dias_vacaciones`, `dias_licencia` (días dentro del mes), `horas_extra`, `otras`; `pendientes` (sin aprobar).

**`avanzar_solicitud(p_solicitud, p_accion, p_texto, p_usuario)`** (mod, misma firma). Acciones nuevas/cambiadas:
- `elevar` (guardia sobre origen `porteria` en `con_jefe`; también el Líder) → `nueva`, `elevada_por/en`; mensaje `'Elevó la solicitud al Líder de Procesos.'` + texto.
- `resolver_jefe` (guardia, origen `porteria`, `con_jefe`, texto obligatorio `'Contá cómo la resolviste'`) → `cerrada`, `resolucion`, `resolucion_de='jefe'`, `resuelta_por/en`, `cerrada_en`; mensaje `'Resolución del Jefe de Portería: …'`.
- `rechazar`: además el guardia sobre `con_jefe` de origen porteria (`resolucion_de='jefe'`).
- `tomar`: el Líder también desde `con_jefe`.
- `resolver`: si el estado era `en_consejo` → `resolucion_de='consejo'` (el Líder registra lo que resolvió el Consejo); si no `lider`.
- `asignar`: `p_usuario`, si viene, tiene que ser un perfil activo de Administración de la org (`'Elegí a alguien de Administración'`).
- Guardia sobre otra cosa → `'Solo podés actuar sobre solicitudes de Portería'`. El resto de acciones y mensajes, igual que hoy.

**Trigger `preparar_solicitud`** (BEFORE INSERT en `solicitudes`, `private.preparar_solicitud`): limpia todas
las columnas de seguimiento; fuerza `origen` por rol (socio → `portal`; porteria y guardia → `porteria`;
tesoreria → `tesoreria`; admin/lider → el que eligieron, default `administracion`/`lider`); estado, EXACTO:
`new.estado := case when private.rol_actual() = 'porteria' and exists (select 1 from public.perfiles where org_id = new.org_id and rol = 'guardia' and activo) then 'con_jefe' else 'nueva' end`.
Se decide por el ROL de quien carga, no por el origen: las solicitudes del Jefe (avisos desde el mapa, G11) tienen
origen `porteria` pero nacen `nueva` y van directo a la bandeja del Líder, nunca a "Para resolver" del Jefe.
**Trigger `tocar_solicitud`** (AFTER INSERT en `solicitud_mensajes`, `private.tocar_solicitud`, **security definer**:
quien escribe el mensaje puede no tener UPDATE sobre solicitudes): `solicitudes.actualizada_en = now()`.

### 4.11 Accesos — M8 (F1–F5, G7)

**`email_para_login(p_dni text) returns text`** (stable) — EXECUTE **solo `service_role`** (el server action
del login usa el cliente admin). Devuelve el email de `auth.users` del perfil con
`dni = regexp_replace(p_dni, '\D', '', 'g')` (activo o no; el login después avisa si está desactivado), o null.

**`guardar_cuotas_quinteros(p_cuotas integer) returns void`** — guardia, lider; 1..31
(`'Elegí en cuántos pagos (de 1 a 31)'`); actualiza `configuracion.cuotas_default_quintero`,
`actualizado_por/en` de la org. No cambia a los quinteros existentes.

**`autorizar_gestion_usuario(p_user uuid, p_accion text) returns rol_usuario`** (stable) — el candado de todo lo
que M8 hace con el service role. `p_accion` ∈ {`resetear_contrasena`, `quitar_acceso`, `devolver_acceso`,
`editar`} (otro → `'Acción inválida'`). Lee el perfil objetivo DE LA BASE por `p_user` (nunca confía en un rol que
mande el cliente) y falla salvo que: el perfil exista y sea de `private.org_actual()` (`'Ese usuario no existe'`);
`private.puede_gestionar_rol(org, rol_objetivo)` (`'No podés gestionar a ese usuario'`); el rol objetivo no sea
`consejo`; para `quitar_acceso` el objetivo no sea el usuario actual (`'No podés quitarte el acceso a vos mismo'`) ni
el último Líder activo. Devuelve el rol del objetivo. Se llama con el cliente del USUARIO (`createClient()`), y
recién si no tira error la action usa `createAdminClient().auth.admin.*`.

**Altas de usuarios (M8)**: 1) `auth.admin.createUser` con el cliente admin; 2) el perfil se inserta con el
cliente del USUARIO (así rigen la policy "alta de perfiles" y `creado_por = auth.uid()`); 3) si el paso 2 falla,
`auth.admin.deleteUser` del usuario recién creado (rollback). "Quitar acceso" = `update perfiles set activo=false`
con el cliente del usuario (RLS + trigger, que deja `desactivado_por/en`) y después, autorizado,
`updateUserById(id, { ban_duration })` con el admin. "Devolver acceso" al revés. "Nueva contraseña" =
`autorizar_gestion_usuario(id, 'resetear_contrasena')` → `updateUserById(id, { password })`.

### 4.12 Mapa, facturación, energía y reportes — M9 (C3, C6, I1, G11, J5, J7)

**`editar_espacio(p_espacio, p_numero, p_medio, p_nota, p_propio boolean default null)`** (firma nueva):
M9 implementa `propio = coalesce(p_propio, propio) and tipo = 'puesto'`; `p_propio = true` en algo que no es
puesto → `'Solo un puesto puede ser propio de la cooperativa'`. Resto igual.

**`generar_periodo(p_periodo)`** (mod): roles admin, lider (+consejo) — Tesorería sale (J5). Después de los
recurrentes, `private.generar_abonos_energia(org, periodo, vencimiento)`: un cargo ABEN (`origen='generacion'`,
`on conflict do nothing`) a cada cliente activo con ≥1 medidor activo, salvo que tenga `cliente_conceptos`
ABEN con `activo = false` (exento); `cantidad = cc.cantidad` si tiene fila activa, si no 1. Idempotente: volver
a generar agrega solo lo que falta (medidores nuevos). Retorno: `{periodo, vencimiento, cargos, abonos, energia, saldo_favor_aplicado}`.

**`registrar_lectura(...)`** (mod): roles admin, lider (+consejo). Sin ABEN (ver §1.2-11).

**`resumen_conceptos(p_periodo)`** (mod, misma firma): bloque 1 sin cambios (AMB, ABEN, MULT, EXME y EXPP
aparecen solos). Bloque 2: UNA fila `BC` con el nombre del concepto BC (fallback `'Bono camioneros'`),
`estimado = cobrado = Σ canon no anulado del mes`. Para rol `guardia`: bloque 1 solo cargos de clientes de
Portería. Roles: admin, guardia, tesoreria, lider (+consejo).

---

## 5. Fundación: helpers compartidos (antes que los módulos)

La hace el ingeniero a cargo (o un agente de fundación). Lo que no depende de la base (§5.2–§5.6) **ya está
en el working tree** (revisión del 28/09); lo que depende (§5.1, seeds) se hace después de aplicar
0010/0011/0012. Los módulos arrancan cuando está todo. Ningún módulo edita estos archivos.

### 5.1 `src/lib/database.types.ts`
Regenerar con `generate_typescript_types` sobre la base con 0010 + 0011 + 0012. Las 0013…0022 no cambian
firmas ni columnas: no hace falta regenerar después. Hasta regenerar, `src/lib/segmentos.ts` define
`CategoriaCliente` como unión literal (idéntica al enum `categoria_cliente`) para compilar sin los tipos nuevos.

### 5.2 `src/components/shared/sello.tsx` — estados nuevos (HECHO)

| Clave | Texto | Variante | Dónde |
|---|---|---|---|
| `en_cartera` | **Por cobrar** (cambia el texto) | parcial | cheques (A2) |
| `entregado` | Entregado a proveedor | info | cheques |
| `puestero` | Puestero | neutro | categoría |
| `socio` | Socio | info | clientes |
| `propio` | Puesto propio | info | mapa, ficha |
| `en_termino` | En término | parcial | semáforo (ámbar) |
| `pago_hoy` | Pagó hoy | pagado | ambulantes |
| `no_pago_hoy` | Hoy no pagó | neutro | ambulantes |
| `con_jefe` | Con el Jefe | info | solicitudes |
| `resuelta_jefe` | Resuelta por el Jefe | pagado | solicitudes |
| `notificado` | Notificado | info | registros |
| `descargo` | Descargo presentado | parcial | registros (apercibimiento/sanción) |
| `respondio` | Respondió | parcial | registros (notificación: el socio contestó) |
| `respondido` | Respondido | pagado | registros |
| `a_responder` | Tenés que responder | pendiente | portal (registro que espera descargo del socio) |
| `respuesta_nueva` | Respuesta nueva | info | portal (`respuestaNueva()`) |
| `nueva_comunicacion` | Nueva | parcial | portal (`registroSinVer()` / circular sin abrir) |
| `multa` | Multa | pendiente | registros |
| `multa_pagada` | Multa pagada | pagado | registros |
| `sin_efecto` | Sin efecto | neutro | multas |
| `la_vio` | La vio | pagado | circulares |
| `no_la_vio` | Todavía no | neutro | circulares |
| `sin_portal` | Sin portal | neutro | circulares |
| `despues_cierre` | Después del cierre | parcial | caja |
| `deposito` | Depósito | info | tesorería |
| `extraccion` | Extracción | info | tesorería |
| `ingreso` | Ingreso | pagado | tesorería |
| `egreso` | Egreso | neutro | tesorería |
| `aprobada` | Aprobada | pagado | novedades |
| `anulada` | Anulada | neutro | novedades |
| `revisar` | Revisala | parcial | aprobaciones (D-1: aplicada en el acto) |

Se mantienen `camion`, `ambulante`, `quintero` (los dos últimos se reusan como categoría; `camion` queda deprecado).

### 5.3 `src/lib/storage.ts` (HECHO)
- `rutaAdjuntoRegistro(orgId, clienteId, nombre)` → `{org}/clientes/{cliente}/registros/{uuid}-{nombre}` (descargos, respuestas y documento del registro; lo cubren las policies del socio y del staff).
- `rutaAdjuntoNovedad(orgId, nombre)` → `{org}/novedades/{uuid}-{nombre}`.
- Comentario de cabecera con las dos carpetas.

### 5.4 `src/lib/format.ts` (HECHO; `OPCIONES_CUOTAS_MES` es de M4)
```ts
export type Moneda = "ARS" | "USD";
export const LABEL_MONEDA: Record<Moneda, string>;                 // { ARS: "Pesos", USD: "Dólares" }
export function formatMoneda(monto: number | string | null | undefined, moneda?: Moneda): string; // USD → "US$ 1.234"
export function normalizarDni(v: string): string;                   // solo dígitos
export function esDniValido(v: string): boolean;                    // 7 u 8 dígitos
export function formatDni(dni: string | null | undefined): string;  // "12.345.678"
export function limpiarCuit(v: string): string;                     // solo dígitos
export function cuitTieneOnceDigitos(v: string): boolean;           // lo que exige la RPC
export function esCuitValido(v: string): boolean;                   // 11 dígitos + dígito verificador (módulo 11): AVISO, no bloqueo
export function formatCuit(cuit: string | null | undefined): string; // "20-12345678-3"
export type NivelDeuda = "al_dia" | "en_termino" | "vencido";
/** Semáforo B3. deuda y deudaVencida salen de v_deuda_clientes; saldoFavor de v_saldo_favor. */
export function nivelDeuda(d: { deuda: number; deudaVencida: number; saldoFavor?: number }): NivelDeuda;
// al_dia si deuda − saldoFavor ≤ 0,009; vencido si deudaVencida > 0,009; si no en_termino.
export const SELLO_NIVEL_DEUDA: Record<NivelDeuda, "al_dia" | "en_termino" | "vencido">;
export const TEXTO_NIVEL_DEUDA: Record<NivelDeuda, string>;         // "Al día" · "Debe, en término" · "Vencido"
export const CUOTAS_TODOS_LOS_DIAS = 30;
```

### 5.5 `src/lib/segmentos.ts` (HECHO; client-safe; espejo de `private.segmentos_cliente` y `private.cliente_en_publico`)
```ts
export type CategoriaCliente = "puestero" | "quintero" | "ambulante"; // = Enums<"categoria_cliente">
export const CATEGORIAS: CategoriaCliente[];
export const LABEL_CATEGORIA: Record<CategoriaCliente, string>;          // Puestero · Quintero · Ambulante
export const LABEL_CATEGORIA_PLURAL: Record<CategoriaCliente, string>;   // Puesteros · Quinteros · Ambulantes
export type Segmento = "socios" | "puesteros" | "puestos_propios" | "locales" | "galpones"
  | "conteiners" | "cocheras" | "quinteros" | "ambulantes";
export const SEGMENTOS: { valor: Segmento; label: string; singular: string }[];
export const LABEL_SEGMENTO: Record<Segmento, string>;
export const SEGMENTO_POR_CODIGO: Record<string, Segmento>;  // EXME, EXPP, EXPL, EXPG, EXPE, EXPC
export function categoriasDeRol(rol: Rol): CategoriaCliente[]; // lider: 3 · admin: puestero · guardia: quintero, ambulante · resto: []
export function segmentosDeCliente(c: { categoria; es_socio; conceptosActivos: { segmento: string | null }[] }): Segmento[];
// Público de circulares: "Todos" o segmentos (unión) + switch "Solo socios" (filtro)
export type SegmentoPublico = "puesteros" | "puestos_propios" | "locales" | "galpones" | "conteiners" | "quinteros";
export type Publico = "todos" | "socios" | SegmentoPublico;
export const OPCIONES_PUBLICO: { valor: SegmentoPublico; label: string }[]; // chips (sin "socios": es el switch)
export type EleccionPublico = { todos: boolean; segmentos: SegmentoPublico[]; soloSocios: boolean };
export function armarPublico(e: EleccionPublico): string[] | null;   // null = todos; {socios} = todos los socios
export function leerPublico(publico: string[] | null): EleccionPublico;
export function clienteEnPublico(c: { categoria: CategoriaCliente; segmentos: string[] }, publico: string[] | null): boolean;
export function textoPublico(publico: string[] | null): string;  // "Todos" · "Todos los socios" · "Puesteros · Locales" · "Quinteros — solo socios"
// Avance del mes (v_avance_mes)
export type AvanceMes = { total: number; pagado: number; falta: number; cuotas: number; cuotas_cubiertas: number; cuota_sugerida: number };
export function textoAvance(a: AvanceMes): string;  // "2 de 4 · Falta $165.000" · "Pagó 12 de 30 días · Falta $…" · "Al día"
// Registros en el portal (§4.8)
export function registroSinVer(r: { visto_en: string | null }): boolean;
export function respuestaNueva(r: { estado: string; ultimo_mensaje_en: string | null; socio_leyo_en: string | null }): boolean;
export function esperaDescargo(r: { tipo: string; estado: string }): boolean;   // apercibimiento/sanción aún "notificado"
```

### 5.6 Otros archivos compartidos
- `src/components/ui/{collapsible,radio-group,toggle,toggle-group}.tsx` (HECHO; `radix-ui` ya estaba instalado, no hay dependencias nuevas): controles segmentados ("Quinteros · Ambulantes"), tarjetas grandes de opción y bloques plegados. Ningún módulo agrega más piezas de UI (§0.2-8).
- `src/components/shared/money.tsx`: prop opcional `moneda?: Moneda` (default ARS; USD usa `formatMoneda`).
- `src/components/shared/boton-exportar.tsx`: `DatasetExportable` suma `"registros"` y `"novedades_personal"`.
- `src/components/shared/boton-imprimir.tsx`: prop opcional `ayuda?: string` (línea `.no-print` debajo de los botones).
- `src/lib/actions/helpers.ts`: `clienteGestionable(supabase, clienteId, perfil): Promise<{ ok: true; categoria: CategoriaCliente } | { ok: false; error: string }>` (org + `categoriasDeRol(perfil.rol)`; mensajes: `'Ese cliente no existe'`, `'A quinteros y ambulantes los gestiona el Jefe de Portería'`, `'Desde Portería solo se gestionan quinteros y ambulantes'`). La base es la autoridad final.
- `supabase/seed.sql` **y `supabase/seed_fase2.sql`** (Fundación, después de aplicar 0012): catálogo como §2.5 (EXPP→EXME en los ítems demo), AMB/ABEN/MULT, tarifas, categoría y DNIs demo; canon con `tarifa_id`/`tarifa_nombre` (sin tipos ambulante/quintero ni `precio_canon_*`), sin consejo activo, "Galpón Sur" en lugar de "Depósito Sur". Si no se actualiza `seed_fase2.sql`, se lo marca obsoleto con `do $$ begin raise exception 'Obsoleto: usar seed.sql'; end $$;` en la primera línea (re-correrlo hoy reintroduce el modelo viejo).
- Al cierre de la fase (no los módulos): actualizar `docs/GUIA-MODULOS.md` (tabla de RPC, lista de shadcn instalados) y `PRODUCT.md`.

---

## 6. Módulos

Formato: requisitos · archivos que posee · SQL que posee · cambios de UI · exporta / importa · aceptación.
"Tuyo" significa que solo vos lo editás. Todo lo que no figura acá no se toca.

### M1 · Cobranza

**Requisitos**: A1, A2, G2, G3, G5 (cobro), G8 (buscador), J1, B1 (recibo).
**Archivos**: `src/app/(panel)/cobranza/**`, `src/components/cobranza/**`, `src/lib/actions/cobranza.ts`, `src/app/(print)/recibos/**`.
**SQL**: `registrar_cobro`, `cobrar_diario`, `datos_recibo`, `anular_pago`, `aplicar_saldo_favor_cliente`, `registrar_pago` (wrapper), `private.imputar_pago`, `private.resumen_lote`.

**UI**
1. **/cobranza** — `requireRol('admin','guardia','lider')`. Admin: clientes `categoria='puestero'`; Jefe: quinteros y ambulantes con control segmentado grande **"Quinteros (N) · Ambulantes (M)"** (`ToggleGroup` de §5.6). **Líder** (§1.3 D-P2): control segmentado **"Puesteros · Quinteros · Ambulantes"**, misma fila y mismo cobro completo que los demás (cobra a cualquier categoría, a la caja de administración). Buscador (autofocus) por nombre, apodo, N° de carpeta o N° de puesto; placeholder admin `Buscá por nombre, apodo o número de puesto…`, Jefe `Buscá al quintero o ambulante por nombre o apodo…`. Fila: código, nombre + apodo, puestos, `<Money>` deuda y `<Sello>` del semáforo (`nivelDeuda`). Quintero: mini-progreso **"2 de 4 · Falta $165.000"** = `textoAvance()` sobre `v_avance_mes` del período actual (nunca recalculado en TS). Ambulante: `pago_hoy` / `no_pago_hoy` + "Último: 25/09". Encabezado del Jefe: **"Hoy cobraste $X · N ambulantes · M quinteros"** y botón **"Nuevo ambulante"** → `/clientes/nuevo?categoria=ambulante` (D-P1 opción A: al volver ya se le puede cobrar). Sin botón "Canon de portería". Vacío: `No encontramos a nadie con eso`; sin clientes (Jefe): `Cuando se carguen quinteros y ambulantes (Quinteros y ambulantes → Nuevo) van a aparecer acá.`
2. **/cobranza/[clienteId]** — `requireRol('admin','guardia','lider')`. Líder: la misma pantalla con FormCobro / CobroAmbulante según la categoría (§1.3). Si la categoría no es del rol (admin/guardia): pantalla simple **"A este cliente lo cobra Administración"** / **"…el Jefe de Portería"** + "Volver". Ambulante → `CobroAmbulante` como acción principal y, si además debe (multas), `FormCobro` plegado ("Tiene otras deudas"). Clientes con `cuotas_mes > 1` → `PlanCuotas` arriba del formulario.
3. **FormCobro** — estado `lineas[]` + `loteId` (`crypto.randomUUID()` al montar y al resetear). Una línea = pantalla de hoy (monto grande, "Cobrar todo", chips de medio). **"+ Pagar una parte con otro medio"** agrega una línea con el siguiente medio y "el resto" precargado. Modo mixto: "Total del cobro" grande (suma), barra apilada contra "Debe hoy" (cubre / queda debiendo / sobra → saldo a favor), cada línea en tarjeta (chips, monto, "El resto", "Quitar"), máximo 6. Jefe: solo Efectivo/Transferencia (`grid-cols-2`). Botón: **"Registrar cobro de $200.000 (efectivo + transferencia)"**. Sobra plata → diálogo **"Sobran $X: ¿los dejamos como saldo a favor de {nombre}?"** y reintento con el MISMO `loteId`. Éxito: sello "Cobro registrado", **"Recibo N° 1234"**, líneas con ícono, **"Ver recibo"**, **"Cobrar otra vez a {nombre}"** (resetea, nuevo `loteId`, `router.refresh()` con spinner hasta tener la deuda nueva) y "Cobrar a otro cliente". `repetido` → `toast.info("Ese cobro ya estaba registrado (Recibo N° X)")`.
4. **DatosCheque** (sin Banco ni "de tercero"). **Visibles solo tres campos**, en el orden en que se lee el cheque: **N° de cheque** (numérico), **CUIT** con máscara `20-12345678-3`, **Fecha de cobro** (chips Hoy/+30/+60/+90 + fecha; aviso "Diferido: se cobra en 23 días"). Debajo, una línea de resumen **"Lo entrega {cliente} · Recibido hoy · Puesto 52 · Queda en la cooperativa"** con botón "Cambiar" que despliega (`Collapsible`) el resto: "Lo entrega" (chip "Otra persona"), Fecha de recepción (Hoy/Ayer + fecha), Puesto (chips de solo lectura; "Sin puesto en el plano") y Estado con dos tarjetas grandes **"Queda en la cooperativa (por cobrar)"** / **"Se lo di a un proveedor"** + "¿A qué proveedor?" (sugerencias). CUIT: la RPC y el zod exigen 11 dígitos (`cuitTieneOnceDigitos`); si el dígito verificador no coincide (`!esCuitValido`) se muestra un aviso ámbar **"Revisá el CUIT: el último número no coincide"** con el botón **"Está bien así, seguir"** — nunca bloquea el cobro.
5. **PlanCuotas** (nuevo) — datos de `v_avance_mes` (§2.4; nada de cuentas propias). "Quinta de septiembre $330.000"; barra segmentada **"Cubrió 2 de 4 cuotas"** (`cuotas_cubiertas`, por plata), Pagó / Falta, **"Cuota sugerida $82.500"** (`cuota_sugerida`: la última = lo que falta exacto) con botón "Cobrar la cuota". Si hay deuda de meses anteriores: "Primero se cobra agosto ($X)" + botón "Cuota + lo atrasado ($Y)". 30 cuotas: barra continua "Pagó 12 de 30 días". Mes sin generar: "El mes todavía no se generó".
6. **CobroAmbulante** (nuevo) — "$15.000 por día"; estado "Pagó hasta el mié 30/09" / "Último pago 25/09" / "Todavía no pagó nunca"; stepper grande de días + chips "Solo hoy · 2 · 3 · Semana (7)"; tira de días marcando los ya pagados; arranque = max(hoy, pagó hasta + 1) y "Empieza otro día"; total grande; Efectivo/Transferencia (titular + foto si es transferencia); botón **"Cobrar 3 días — $45.000"**; éxito "Pagó hasta el mié 30/09 · Recibo N° X", "Ver recibo", "Cobrar a otro ambulante".
7. **Recibo** `(print)/recibos/[pagoId]` — datos por `rpc('datos_recibo')`; `requireRol('admin','guardia','tesoreria','lider','socio')`; error → `notFound()`. "Recibo N° X", sección **"Cómo pagó"** (una fila por línea; cheque: "Cheque N° 123456 · CUIT 20-12345678-3 · entregó Juan Pérez · se cobra desde 30/10 · Puesto 52"), líneas anuladas tachadas con motivo, total, detalle agrupado por cargo con beneficio, "Recibió: {nombre} · {Administración|Caja de portería}". Socio: sin comprobante ni notas, `volverA="/mi-cuenta"`, botón **"Descargar recibo (PDF)"** (abre el diálogo de impresión con "Guardar como PDF"; §1.2-13, pregunta §9-P23), `ayuda="En el celular: Compartir → Imprimir → Guardar como PDF"`, sin auto-imprimir. `generateMetadata` → `Recibo N° 1234 — {cliente}` (nombre del PDF).
8. **Actions** (`cobranza.ts`): `registrarCobro(formData)` (zod de líneas discriminadas por medio; un archivo por línea de transferencia `comprobante:<lineaId>`; valida todos antes de subir; sube; `abrir_caja` según rol; `rpc('registrar_cobro')`; si falla borra todos los subidos) → `ActionResult<ResultadoCobro>`; `cobrarDiario(formData)` (solo guardia; `abrir_caja('guardia')`; `rpc('cobrar_diario')`); `aplicarSaldoFavor` (admin, guardia, lider). Revalidar `/cobranza`, `/caja`, `/clientes/{id}`, `/inicio`.

**Importa**: `nivelDeuda`, `formatCuit`, `esCuitValido`, `cuitTieneOnceDigitos` (format), `categoriasDeRol`, `textoAvance` (segmentos), `ROLES_COBRAN` (M8), `anularCobro` de `cajas.ts` (M2, §6.10). **Exporta**: la ruta `/recibos/{pagoId}` acepta el id de CUALQUIER línea del lote (la usan M2, M4 y M5).

**Aceptación**
- [ ] Admin cobra $100.000 efectivo + $100.000 transferencia a un puestero → 2 pagos con el mismo `lote_id` y `numero`; el recibo muestra las dos líneas y total $200.000.
- [ ] Doble toque en "Registrar cobro" → un solo lote (la segunda respuesta viene `repetido`). Dos llamadas SIMULTÁNEAS con el mismo lote devuelven el mismo número, sin error. Un lote de otro cliente → "Ese cobro ya se registró para otro cliente".
- [ ] Cobro y cierre de caja a la vez: el cobro queda en el arqueo o falla con "La caja ya está cerrada…" (nunca un cobro fuera del arqueo de una caja cerrada).
- [ ] El Jefe no ve "Cheque"; por API `registrar_cobro` con cheque del Jefe devuelve `En portería se cobra solo en efectivo o transferencia`.
- [ ] Admin en `/cobranza/{quintero}` ve "A este cliente lo cobra el Jefe de Portería". Tesorería en `/cobranza` → `/inicio`.
- [ ] El Líder ve `/cobranza` con los tres grupos y sin botón Cobrar; por API `registrar_cobro` del Líder devuelve "No tenés permiso para registrar cobros".
- [ ] Quinta de $330.000 en 4 pagos: sugiere $82.500; después de 3 pagos de $82.500 sugiere exactamente $82.500 (lo que falta) y dice "3 de 4".
- [ ] Ambulante: 3 días crea un cargo AMB `origen='diario'` con `desde/hasta`, pagado; cobrar de nuevo un día incluido → error de solapamiento.
- [ ] Anular un recibo mixto anula todas sus líneas y el cargo AMB del lote.
- [ ] El socio abre `/recibos/{su pago}` y descarga el PDF; con un pago ajeno ve 404.
- [ ] Cheque "Se lo di a un proveedor" queda `entregado` con `entregado_en_cobro`; el arqueo de la caja no lo cuenta en "Cheques".
- [ ] CUIT con dígito verificador que no coincide: aviso ámbar y el cobro se registra al tocar "Está bien así, seguir".

### M2 · Cajas

**Requisitos**: A3, E4 (arqueo), I2, J3 (lado caja), Caja de portería, matriz de `/caja`.
**Archivos**: `src/app/(panel)/caja/**`, `src/components/caja/**`, `src/lib/actions/cajas.ts`, `src/app/(print)/cierre-caja/**` (nuevo).
**SQL**: `arqueo_caja`, `registrar_ajuste_caja`, `borrar_ajuste_caja`, `validar_caja` (implementación), `abrir_caja`, `cerrar_caja`, `integrar_caja_porteria`, `reabrir_caja`, `private.calcular_arqueo`, `private.recalcular_arqueo`, `private.tg_recalcular_caja` + triggers `recalcular_caja` en `gastos`, `canon_camiones`, `movimientos_tesoreria`.

**UI**
1. **/caja** — `requireRol('admin','guardia','tesoreria','lider')`. Admin: su caja + bandeja. Jefe: **"Caja de portería"**. Tesorería y Líder: pestañas **"Administración" / "Caja de portería"** (el Líder con TODAS las acciones: abrir, cerrar, integrar, reabrir, ajustar, validar; §1.3). Tesorería no abre cajas; en cajas de días anteriores que quedaron abiertas ve "Cerrar (quedó abierta)"; con la caja cerrada o integrada ve el botón primario **"Contar y validar"**, que monta `<ValidarCajaDialog>` de M6 (§6.10): Tesorería cuenta, ajusta y valida desde `/caja`, en una sola pantalla. PageHeader: **"Imprimir cierre"** (o "Imprimir parcial" si está abierta) → `/cierre-caja/{id}`.
2. **datos.ts** — totales en vivo por `rpc('arqueo_caja')` (se elimina la cuenta duplicada en TS); cobros agrupados por `lote_id`; canon con las columnas nuevas; gastos de la caja con `pagado_en` y "después del cierre"; ajustes = `movimientos_tesoreria` con `caja_id`.
3. **BandaTotales** (abierta) — Admin: Efectivo (lo **juntado**) / Transferencias / Cheques + tira **"Caja de portería $X — Quintas $A · Ambulantes $B · Bono camioneros $C"** (A3; íconos Tractor/Footprints/Truck) y debajo una línea chica **"En mano $E · Por transferencia $T"** (`rendido_efectivo` / `rendido_transferencia`: cuánto le entregaron en mano). Si hay gastos o ajustes: "− Gastos pagados desde esta caja $G", "± Ajustes de tesorería $Z", **"= Tenés que tener ahora: $E en efectivo"**. Jefe: dos bloques (sin Cheques) + "Quintas (tus cobros) $A · Ambulantes $B · Bono camioneros (Portería) $C".
4. **ArqueoCaja** (cerrada o después) como cuenta de cajón: **JUNTASTE** $ (cobros por medio; Caja de portería con su desglose) **− GASTOS PAGADOS DESDE ESTA CAJA** $G **± AJUSTES DE TESORERÍA** $Z **= TENÉS QUE TENER**: En el cajón $E (grande) · En el banco $T · Cheques en cartera $C (+ "Cheques entregados a proveedores en el acto: $X", con el proveedor de cada uno desde `cheques_entregados_detalle`). Rendición del Jefe: **"Entregá en Administración $E en efectivo"** + desglose + "(+$T ya están en el banco)". Banner ámbar si hubo eventos `gasto_imputado` / `gasto_revertido` / `ajuste` / `ajuste_borrado` / `canon_anulado` / `cobro_anulado` / `arqueo_recalculado` después de `cerrada_en`: "El arqueo cambió después del cierre: se imputó el gasto Luz $50.000 (Tesorería, 28/09 10:32). Efectivo: $1.000.000 → $950.000".
5. **CobrosDia** — una fila por recibo (lote) con medios apilados; anular por recibo: "Se anula el recibo completo N° X (efectivo + transferencia) por $total"; toast "Recibo N° X anulado". Link "Ver recibo".
6. **Canon en la caja de portería** — solo lectura con `<CanonDelDia>` de M3 (`modo="jefe"` si es el Jefe con la caja abierta; `"lectura"` para el resto). Se borran `form-canon.tsx`, `borrar-canon.tsx` y `canon-camiones.tsx`.
7. **GastosCaja** — "Gastos pagados desde esta caja" con total en rojo; descripción o rubro; sello `despues_cierre`; pie "Se restan del efectivo que tenés que tener"; admin/tesorería en caja de administración no validada: link **"Pagar un gasto desde esta caja"** → `/gastos?caja={id}` (M6).
8. **AjustesCaja** (nuevo) — tesorería con caja no validada: toggles **"Falta plata (−)" / "Sobra plata (+)"**, chips Efectivo/Banco, monto, motivo con atajos ("Faltante en el conteo", "Sobrante en el conteo", "Comisión bancaria", "Redondeo"), `ref = crypto.randomUUID()` por intento; lista firmada (quién/cuándo) con borrar (pide motivo obligatorio). El resto: lista de solo lectura.
9. **CerrarCaja** — el diálogo muestra la cuenta antes de confirmar ("Vas a cerrar con…"); al cerrar pasa a éxito: **"Tenés que tener $E en efectivo"** (o "Entregá $E en Administración — Quintas · Ambulantes · Bono camioneros"), CTA **"Imprimir cierre"** (`/cierre-caja/{id}?auto=1`) y "Listo". Texto del Jefe: "Después de rendir, Portería no puede cobrar más canon hoy; si hubo un error pedí la reapertura."
10. **IntegrarRendicion / BandejaAdmin** — "Caja de portería del 27/09 — Quintas $A · Ambulantes $B · Bono camioneros $C" (sin fila de cheques); éxito con "Imprimir comprobante de recepción".
11. **HistorialCaja** — labels: `cobro_anulado` "Recibo anulado" · `gasto_imputado` "Gasto pagado desde la caja" · `gasto_revertido` "Pago de gasto deshecho" · `ajuste` "Ajuste de tesorería" · `ajuste_borrado` "Ajuste borrado" · `canon_anulado` "Ingreso de transporte anulado" · `arqueo_recalculado` "Arqueo recalculado" · `cierre_forzado` "Cerrada por Tesorería" · `recibe_rendicion` "Recibe la caja de portería". **UltimosDias**: botón impresora por fila.
12. **`(print)/cierre-caja/[cajaId]`** — `requireRol('admin','guardia','tesoreria','lider')` (la RLS limita al Jefe a cajas de portería; si no se ve → `notFound`). Encabezado de la cooperativa, "Cierre de caja — Administración" o "Rendición — Caja de portería", fecha larga, sello de estado, "Impreso el … por …", marca "PARCIAL — caja abierta". La cuenta completa; cobros (hora · recibo · cliente · medio · monto, anulados tachados, subtotales); cheques recibidos (N°, CUIT, fecha de cobro, monto; entregados aparte); bono camioneros por tarifa; rendiciones integradas; gastos y ajustes; recuadro **"Efectivo contado $____ · Diferencia $____"**; firmas "Entregó / Recibió"; bitácora compacta. `autoImprimir` con `?auto=1` + `configuracion.impresion_directa`.
13. **Actions** (`cajas.ts`): `abrirCaja` (admin, guardia); `cerrarCaja` (admin, guardia, tesoreria); `integrarCajaPorteria`, `reabrirCaja`, `rechazarReaperturaCaja` (admin, tesoreria); `solicitarReaperturaCaja` (admin, guardia); `anularCobro` (admin, guardia, tesoreria → `anular_pago`); nuevas `registrarAjusteCaja`, `borrarAjusteCaja` (tesoreria). Se borran `cargarCanon` y `borrarCanon`. `revalidarCajas()` suma `/porteria`. `anularCobro` mantiene nombre y firma (la reexporta `cobranza.ts` de M1, §6.10).

**Exporta**: `export type Arqueo` (claves de `calcular_arqueo`, §4.5) en `src/components/caja/arqueo-tipos.ts` (lo importan M6 y M8); `anularCobro` (§6.10). **Importa**: `CanonDelDia` (M3), `ValidarCajaDialog` (M6).

**Aceptación**
- [ ] El arqueo en vivo (`arqueo_caja`) y el persistido al cerrar dan lo mismo para la misma caja.
- [ ] Pagar un gasto de $50.000 desde la caja cerrada de ayer baja su "Tenés que tener" en $50.000, deja `gasto_imputado` + `arqueo_recalculado` y se ve el banner.
- [ ] Ajuste −$500 de Tesorería aparece en la caja de Administración y en `flujo_caja`.
- [ ] Caja de portería: "Quintas · Ambulantes · Bono camioneros" suman lo cobrado; la banda de Administración muestra el desglose de lo integrado.
- [ ] Imprimible del cierre anda con caja abierta (PARCIAL) y cerrada.
- [ ] Tesorería no ve "Abrir caja"; el Líder ve `/caja` sin ningún botón de acción.
- [ ] Validar con efectivo contado distinto crea el ajuste y valida en un paso; una caja de portería sin integrar no se valida.
- [ ] Tesorería valida desde `/caja` ("Contar y validar") sin ir a `/tesoreria`.
- [ ] Un recibo anulado aparece en el Historial ("Recibo anulado") y en el imprimible del cierre.
- [ ] Pagar un gasto desde una caja mientras Tesorería la valida: o el gasto entra y el arqueo validado lo incluye, o el pago falla con "ya la validó tesorería".

### M3 · Portería

**Requisitos**: H1, H2, G4, G9, G10, A4.
**Archivos**: `src/app/(panel)/porteria/**`, `src/components/porteria/**`, `src/lib/actions/porteria.ts`, `src/components/configuracion/tarifas-transporte.tsx` (nuevo; lo monta M8).
**SQL**: `registrar_canon`, `anular_canon`, `estado_caja_porteria`, `resumen_canon`, trigger `proteger_ingreso` (`private.tg_proteger_ingreso`) en `ingresos_personal`.

**UI**
1. **/porteria** — `requireRol('porteria','lider')` (Admin y Jefe rebotan a su inicio). PageHeader "Portería" · "Cobrá el canon de transporte y registrá el ingreso del personal." Pestañas grandes (`?vista=canon|personal`, default canon) con contadores en vivo: **"Canon de transporte · $98.000"** y **"Personal · 3 adentro"**. Caja rendida (`estado_caja_porteria`): Alert ámbar **"La caja de portería de hoy ya se rindió. Avisale al Jefe de Portería: él pide la reapertura a Administración."** (mismo texto que la RPC) y formulario deshabilitado. Líder: cobra canon igual que Portería (§1.3) + selector de fecha + link "Editar tarifas" → `/configuracion?tab=tarifas` (clave congelada, §6.10). El Líder sí puede corregir salidas olvidadas en Personal. La tarjeta "Solicitudes e informes" queda abajo (texto de M7: "le llega al Jefe de Portería…").
2. **CanonTransporte** (nuevo, talonario de 2 toques): **"¿Qué entró?"** tiles grandes por tarifa activa (ícono, nombre, "$6.000 por vehículo" / "$12.000 por día"); stepper **"¿Cuántos vehículos?" / "¿Cuántos días?"**; **"¿Cómo paga?"** Efectivo / Transferencia; opcionales: **Patente** (mayúsculas, muestra "AB 123 CD") y **"¿A quién viene?"** chips Puesto (+ N°, validado contra `rpc('espacios_del_plano')` — Portería no lee la tabla `espacios` —: "Puesto 58 ✓" / "No existe el puesto 158") · Verdulero · Ambulante; total gigante y botón **"Cobrar $12.000"** (h-14). `ref = crypto.randomUUID()` por intento. Éxito: sello animado **"COBRADO N° 124"** + toast con **"Deshacer"** (`anularCanon` con motivo "Deshecho al instante"); conserva tarifa y medio, limpia el resto. Sin red: no borra nada, "No se pudo cobrar. Revisá la conexión y tocá de nuevo".
3. **CanonDelDia** (nuevo, exportado) — resumen **"Tenés que tener en la garita $X en efectivo"** + "y $Y por transferencia" + conteo por tarifa ("Camioneta ×6 · Chasis ×3 · Estadía 2 días"); en modo jefe, subtotal por quién cobró; lista: hora, N°, tarifa × cantidad, patente, destino, medio, `<Money>`; anuladas tachadas con `<Sello estado="anulado">` y motivo; botón Anular según reglas de `anular_canon`. Vacío: "Todavía no entró ningún vehículo hoy".
4. **Personal** — lo de hoy extraído a `IngresosDelDia`, más: **marcar salida con hora** (hora elegible ≥ ingreso y ≤ ahora) y bloque **"Quedaron adentro de días anteriores (N)"** con marcar salida (sin esto las horas de Novedades quedan abiertas). El alta de ingreso ya no manda `ingreso_en` ni `registrado_por` (los pone el servidor; grants de 0022). Corregir una salida ya marcada: solo el Líder (lo impone el trigger `proteger_ingreso`).
5. **TarifasTransporte** (exportado; M8 lo monta en Configuración) — Líder edita: nombre, precio (vista previa `formatARS`), unidad ("por vehículo" / "por día"), ícono (5 opciones), activa, "Agregar tarifa"; toast "Tarifa guardada. Rige desde el próximo cobro." Otros roles: lectura.
6. **Actions** (`porteria.ts`): `ROLES_CANON = ['porteria']` y `ROLES_INGRESOS = ['porteria','lider']` (reemplazan a `ROLES_PORTERIA`); `registrarCanon` (porteria); `anularCanon` (porteria, guardia, tesoreria); `guardarTarifaTransporte`, `cambiarActivoTarifaTransporte` (lider; revalidan `/configuracion` y `/porteria`); `marcarEgreso({ id, egresoEn? })`. Revalidar `/porteria`, `/caja`, `/inicio`.

**Exporta**
```ts
// src/components/porteria/tarifas.ts
export type TarifaTransporte = { id: string; nombre: string; precio: number; unidad: "vehiculo" | "dia"; icono: "camioneta" | "camion" | "balancin" | "equipo" | "estadia"; orden: number; activo: boolean };
export type CanonEntrada = { id: string; numero: number; creado_en: string; creado_por: string | null; creadoPorNombre: string | null; tarifa_nombre: string | null; unidad: "vehiculo" | "dia" | null; cantidad: number; precio_unitario: number | null; monto: number; medio: "efectivo" | "transferencia"; patente: string | null; destino: "puesto" | "verdulero" | "ambulante" | null; destino_detalle: string | null; anulado: boolean; motivo_anulacion: string | null };
// src/components/porteria/canon-del-dia.tsx
export function CanonDelDia(props: { entradas: CanonEntrada[]; modo: "porteria" | "jefe" | "lectura"; cajaAbierta: boolean; cajaValidada?: boolean; miUserId: string }): JSX.Element;
// src/components/configuracion/tarifas-transporte.tsx
export function TarifasTransporte(props: { tarifas: TarifaTransporte[]; puedeEditar: boolean }): JSX.Element;
```

**Aceptación**
- [ ] Portería cobra "Camioneta × 2, efectivo" en dos toques; si no había caja de portería hoy, se abre sola.
- [ ] El Jefe ve el ingreso en su Caja de portería (solo lectura) y puede anularlo con la caja abierta.
- [ ] Con la caja rendida el formulario queda bloqueado con el mensaje exacto.
- [ ] Portería anula su propio cobro dentro de 15 minutos; después, el error pide al Jefe.
- [ ] Admin y Jefe entrando a `/porteria` son redirigidos; el Jefe no tiene formulario de canon en ningún lado.
- [ ] Cambiar el precio de una tarifa no cambia cobros viejos (snapshot).
- [ ] "¿A quién viene? Puesto 158" con un puesto que no existe → "No existe el puesto 158" y no cobra.
- [ ] Dos porteros cobran el primer canon del día a la vez: se crea UNA sola caja de portería y entran los dos cobros. Doble toque con el mismo `ref` → un solo cobro (el segundo vuelve `repetido`).
- [ ] Portería no puede marcar una salida en el futuro ni cambiar una salida ya marcada; el Líder sí la corrige.
- [ ] El Líder ve `/porteria` sin formulario de canon; por API `registrar_canon` del Líder devuelve "El canon de transporte lo cobra Portería".

### M4 · Clientes (y aprobaciones)

**Requisitos**: C1–C8, G6–G8, C6 (lado clientes).
**Archivos**: `src/app/(panel)/clientes/**`, `src/components/clientes/**` **excepto** `nueva-sancion.tsx`, `registros-cliente.tsx` y `circulares-cliente.tsx` (M5); `src/lib/actions/clientes.ts`, `src/lib/actions/documentos.ts`, `src/lib/format.ts` (solo `OPCIONES_CUOTAS_MES`), `src/app/(panel)/aprobaciones/**`, `src/components/aprobaciones/**`, `src/lib/actions/aprobaciones.ts`.
**SQL**: `siguiente_codigo_cliente`, `solicitar_cambio`, `aprobar_cambio`, `private.aplicar_cambio`.

**UI**
1. **Listado** — `requireRol('admin','guardia','lider')`. Título: "Clientes" / Jefe **"Quinteros y ambulantes"**. Admin: `.eq('categoria','puestero')`. Datos: `v_clientes_segmentos` + espacios del cliente + `v_deuda_clientes` + `v_saldo_favor`, cruzados en memoria. Dos filas de chips que se combinan (AND): **"¿Qué tiene?"** (`?seg=`) Puesteros · Puestos propios · Locales · Galpones · Contéiners · Cocheras · Socios (+ Quinteros · Ambulantes para el Líder; el Jefe solo esos dos), cada uno con su conteo (en 0 atenuado); **"¿Cómo está?"** (`?estado=`) Con deuda · Vencidos · Dados de baja. `?tipo=vencidos` sigue andando (link del Inicio). Fila: mini-etiquetas por segmento ("Puesto 58 · 60", "Local 3", "2 galpones", "Contéiner 12"), chip "Socio", deuda + sello del semáforo. Búsqueda numérica: carpeta o N° de puesto. Bajas ocultas salvo el chip. **Desaparece "Depósitos"** en todo el módulo. Botón "Nuevo cliente" / Jefe "Nuevo quintero o ambulante".
2. **Ficha** — `requireRol('admin','guardia','lider')`; si la categoría no es del rol → pantalla simple (no 404): **"Este cliente es de Portería: lo gestiona el Jefe de Portería"** / **"Este cliente lo gestiona Administración"** + botón "Volver" (mismo criterio que `/cobranza/[id]` de M1). Chip de categoría (ícono Store/Tractor/Footprints) y "Socio". `facturaPuestos` con EXME/EXPP/EXPL/EXPE. Pestañas: **Cuenta · Qué paga · Documentos · Registros** (Admin y Líder; monta `<RegistrosCliente>` y `<CircularesCliente>` de M5) **· Medidores** (Admin y Líder). "Pagos recibidos" agrupados por recibo (lote) con "Ver recibo". Botón "Cobrar" si el rol está en `ROLES_COBRAN` y la categoría es suya. Semáforo de deuda.
3. **Alta / edición** — **"¿Qué es?"**: tarjetas grandes (Líder: Puestero/Quintero/Ambulante; Jefe: Quintero/Ambulante; Admin: no se muestra, va puestero). **"¿Es socio de la cooperativa?"** Sí/No (48 px; no para ambulantes). "Tipo" pasa a **"Persona"** (física/empresa). **Ambulante**: nombre, apodo, DNI, teléfono; N° de carpeta automático (`siguiente_codigo_cliente`) plegado; "No tiene acceso al portal. Se le cobra por día cuando viene". **Quintero**: Expensas Quinteros × 1 preseleccionado y cuotas 1–4 con default `configuracion.cuotas_default_quintero`. `?categoria=` preselecciona. Botón "Enviar a aprobación" (Admin y Jefe); toast "Enviado al Líder de Procesos para su aprobación". **Alta de ambulante del Jefe (D-1, §4.7)**: opción A → botón "Dar de alta", toast "Listo: ya le podés cobrar. El Líder lo va a revisar." y link "Cobrarle ahora" → `/cobranza/{id}`.
4. **Qué paga** — agrupado: Expensas (EXME "La expensa mensual del puesto — beneficio 15 % pagando en término"; EXPP "Solo los 4 puestos propios de la cooperativa") · Espacios (EXPL, EXPG, EXPE) · Otros (EXPC, EXCO); precio unitario y subtotal mensual en vivo ("Por mes: $1.620.000 · con beneficio en término $1.377.000"); solo los conceptos que el rol puede asignar.
5. **Cuotas** — `OPCIONES_CUOTAS_MES` suma `{ valor: 30, label: "Todos los días", ayuda: "Paga por día" }`; "Otra cantidad" con stepper − / + (1–31); vista previa "Son 4 pagos de ≈ $82.500"; quintero solo 1–4; ambulante no lo ve. Zod `max(31)`.
6. **Documentos** — chips Habilitación municipal · SENASA · Apto eléctrico + las categorías ya usadas + **"+ Otra categoría"** (input con sugerencias; texto libre 1–60, primera letra en mayúscula); carpeta agrupada por categoría con contadores.
7. **Medidores** — ubicación con `<SelectorEspacio>` (M9) sugiriendo los espacios del cliente; guarda `espacio_id` + `ubicacion` (etiqueta); "Otro lugar" = texto libre; fila con pin "Puesto 58 · Ver en el plano" (`/mapa?espacio=`). Bloque ABEN: **"Abono mensual de energía: $15.000 — lo paga porque tiene medidor activo"** + switch **"Eximir del abono"** (alta de cliente_concepto ABEN con `activo: false` vía `solicitar_cambio`) / "Sin medidor: no paga abono".
8. **Aprobaciones** — filtro/pestaña **"Aplicadas por el Jefe (N)"** (cambios `revisar_despues` sin `revisado_por`, sello `revisar` "Revisala") con "Marcar revisada" (`aprobar_cambio`) y "Dar de baja" (D-1 opción A). Diff con `categoria` ("Categoría: Quintero"), `es_socio` ("Socio de la cooperativa: Sí/No"), "Todos los días", tipos de concepto nuevos ("Por día", "Abono de energía", "Eventual"); el rol que pidió se ve "Jefe de Portería". Resumen del alta: "Alta de quintero Juan Pérez (N° 214)".
9. **Actions** — `crearCliente`, `editarCliente`, `editarCuotasMes`, `darDeBajaCliente`, `reactivarCliente`, `agregarConceptoCliente`, `editarConceptoCliente`: `requireRol('admin','guardia','lider')` + `clienteGestionable`; `registrarDeudaAnterior`: admin, lider; `crearMedidor`/`editarMedidor`: admin, lider con `espacioId`; documentos: admin, guardia, lider.

**Importa**: `SelectorEspacio`, `planoParaSelector`, `etiquetaEspacio`, `EnElPlano`, tipos de `mapa/tipos.ts` (M9); `RegistrosCliente`, `CircularesCliente` (M5); `segmentos.ts`, `nivelDeuda`, `clienteGestionable` (Fundación). Todo con las firmas de §6.10. `TIPOS_REGISTRO` de `clientes/constantes.ts` NO se toca (lo reemplaza M5 en su carpeta; se borra en la limpieza).

**Aceptación**
- [ ] Un cliente con EXME + EXPG + EXPE aparece en Puesteros, Galpones y Contéiners.
- [ ] El Jefe da de alta un quintero → queda en Aprobaciones con "Categoría: Quintero"; aprobado, aparece en su listado y no en el de Admin (un ambulante: según D-1).
- [ ] Admin no ve quinteros en su listado y su ficha muestra "Este cliente es de Portería…" con "Volver"; `solicitar_cambio` de Admin sobre un quintero falla con el mensaje del §4.7.
- [ ] Marcar "Es socio" → chip "Socio" en listado y ficha, aparece en el filtro Socios y el diff de Aprobaciones dice "Socio de la cooperativa: Sí".
- [ ] (D-1 opción A) El Jefe da de alta un ambulante y le cobra en el acto; el Líder lo ve en "Aplicadas por el Jefe" y lo marca revisado.
- [ ] Cuotas 30 se guardan y se ven "Todos los días"; 17 se guardan con "Otra cantidad".
- [ ] Documento con categoría "Contrato de alquiler" se guarda y la próxima vez aparece como chip.
- [ ] Medidor elegido en el plano queda con `espacio_id` y "Puesto 58".
- [ ] "Eximir del abono" deja al cliente sin ABEN en la próxima generación.

### M5 · Comunicaciones y portal

**Requisitos**: B1 (botón), B2, B3, D1–D7.
**Archivos**: `src/app/(panel)/comunicaciones/**`, `src/components/comunicaciones/**` (incluye `constantes.ts` nuevo con `TIPOS_REGISTRO` sin mencionar al Consejo: "Sanción" = "Medida que decide la cooperativa, con su documento"), `src/lib/actions/circulares.ts`, `sanciones.ts`, `portal.ts`, `terminos.ts`, `src/app/(portal)/**` (incluye `mi-cuenta/solicitudes/**`), `src/components/portal/**`, `src/components/clientes/nueva-sancion.tsx` (NO se borra en esta fase: lo importa la ficha de M4 hasta integrar; queda deprecado), `src/components/clientes/registros-cliente.tsx` (nuevo), `src/components/clientes/circulares-cliente.tsx` (nuevo).
**SQL**: `emitir_registro`, `dejar_sin_efecto_multa`, `marcar_registro_visto`, triggers de `registro_mensajes`.

**UI — panel**
1. **/comunicaciones** — `requireRol('admin','lider')`. Pestañas por link (`?tab=`): **Circulares · Notificaciones · Apercibimientos · Sanciones** (+ Términos al final, separada), con badge rojo de descargos esperando respuesta. Circulares: fila con **"La vieron 34 de 52"** (barra) + chip del público (`textoPublico`) + "Obligatoria". Registros: tira de KPIs (Esperan tu respuesta · Sin ver · Multas pendientes $), chips (Todas · Esperan respuesta · Sin ver · Respondidas · Sin efecto), lista (N°, cliente + puesto, título, sello de estado, multa con su sello), botón primario **"Nueva notificación" / "Nuevo apercibimiento" / "Nueva sanción"**.
2. **Nueva circular** — **"¿A quién le llega?"**: chip grande "Todos" o chips múltiples de `OPCIONES_PUBLICO` (Puesteros · Puestos propios · Locales · Galpones · Contéiners · Quinteros; se suman) con su cantidad, y **aparte** un switch grande **"¿Solo a los socios?"** (filtro: "Quinteros" + switch = los quinteros que son socios; "Todos" + switch = todos los socios) con el conteo en vivo; resumen **"Le llega a 64 clientes · 51 lo ven en el portal · 13 sin portal (avisales en persona)"** calculado con `clienteEnPublico()` sobre `v_clientes_segmentos` (`tiene_portal` ya excluye accesos quitados); botón **"Publicar para 64 clientes"**. Insert directo con `publico = armarPublico(eleccion)` (`null` = Todos). Obligatoria: "Cada uno tiene que confirmar que la recibió"; informativa: "Vas a ver quién la abrió".
3. **Detalle de circular** (`/comunicaciones/[id]`, se mantiene la ruta) — métrica grande **"La vieron 34 de 52"** + chips del público; dos listas: **"La vieron (N)"** con fecha y hora, **"Todavía no (M)"** con subgrupo **"Sin usuario del portal (K) — avisales en persona"**; filtro por segmento y buscador; link a la ficha. Aclaración: "Las circulares no se responden".
4. **Nuevo registro** (`/comunicaciones/registros/nuevo?tipo=&cliente=`) — `ref = crypto.randomUUID()` por intento (`emitir_registro` con `p_ref`: doble toque = una sola multa) — ¿A quién? (buscador grande por N° de puesto, nombre, apodo o carpeta; chips con sus puestos y deuda) → tipo (chips) → título (sugerencias) + detalle + foto/PDF → si apercibimiento/sanción: switch **"¿Lleva multa?"** + monto (preview) + "Vence el" (default +10 días) → vista previa "Así lo ve el socio" → botón **"Notificar a {nombre} (Puesto N)"**. Toast "Apercibimiento N° 12 enviado · multa de $50.000 sumada a su cuenta".
5. **Detalle del registro** (`/comunicaciones/registros/[id]`) — stepper **Notificado → Descargo presentado → Respondido** (notificación: "Respondió"), "Visto por el socio el …", documento, caja de multa (monto, sello Pendiente/Pagada/Sin efecto, vence, **"Dejar sin efecto la multa"** con motivo), hilo (burbujas; reusar el estilo de solicitudes sin importar sus archivos) y respuesta con adjunto.
6. **Ficha** — `<RegistrosCliente>`: lista con sello de estado, visto, multa, link al detalle y alta inline (reemplaza `NuevaSancion`); `<CircularesCliente>`: solo las circulares de su público con "La vio el …" / "Todavía no".

**UI — portal**
7. **Layout** — navegación grande bajo el header: **"Mi cuenta" · "Comunicaciones"** (badge con lo nuevo). Bloqueo por circulares obligatorias sin confirmar centralizado en `GateCirculares` (después de `GateTerminos`) para todo el portal.
8. **/mi-cuenta** — **SemaforoDeuda** (tres luces con texto): verde **"Estás al día"**; ámbar **"$X para pagar antes del DD/MM · te quedan N días"** + beneficio que mantiene; rojo **"$X es lo que tenés que pagar hoy"** + "$A vencido desde DD/MM: perdiste el beneficio" (+ "$B vence el DD/MM" si convive). **Tus pagos**: una fila por recibo (lote) "Recibo N° X · Efectivo + Transferencia", total y botón grande **"Recibo"** (ícono Download, min-h-11) → `/recibos/{pago_id}`; pie **"Tocá Recibo para verlo, guardarlo en PDF o imprimirlo"**. Se quitan las secciones de circulares y notificaciones (van a Comunicaciones) y queda una tarjeta con lo que requiere acción ("Tenés 1 apercibimiento para responder").
9. **/mi-cuenta/comunicaciones** — pestañas grandes **Circulares · Notificaciones · Apercibimientos · Sanciones** con contador de nuevas; filas con sellos `nueva_comunicacion` (`registroSinVer`), `a_responder` (`esperaDescargo`), `respuesta_nueva` (`respuestaNueva`), `sin_efecto` (§5.2/§5.5; nada de `texto=` a mano); vacíos amables ("No tenés apercibimientos. ¡Bien!"); en Circulares: "Las circulares son avisos: no se responden. ¿Tenés una duda? Hacé una solicitud".
10. **/mi-cuenta/comunicaciones/[id]** — al abrir, SIEMPRE `marcar_registro_visto` (actualiza `socio_leyo_en`: apaga "Respuesta nueva"); documento; multa ("Se sumó a tu cuenta · vence el …"); stepper; hilo; caja **"Presentar mi descargo"** (apercibimiento/sanción) o **"Responder"** (notificación) con "Sacar una foto o elegir archivo" (`rutaAdjuntoRegistro`). El hilo sigue abierto aunque la multa quede sin efecto.
11. **/mi-cuenta/circulares/[id]** — texto + PDF; informativa: registra "la vio" al abrir (insert en `circular_recepciones`); obligatoria sin confirmar: botón **"Confirmo que la recibí"** (h-14). Sin caja de respuesta.
12. **Actions** — `crearCircular` (admin, lider; `publico`), `desactivarCircular`, `confirmarRecepcionCircular` y `registrarVistaCircular` (socio), `emitirRegistro`, `responderRegistro` (admin, lider: insert en `registro_mensajes`), `dejarSinEfectoMulta`, `presentarDescargo` / `responderComoSocio` (socio), `marcarRegistroVisto` (socio).

**Exporta**
```ts
// src/components/clientes/registros-cliente.tsx (server component)
export async function RegistrosCliente(props: { clienteId: string; puedeRegistrar: boolean }): Promise<JSX.Element>;
// src/components/clientes/circulares-cliente.tsx (server component)
export async function CircularesCliente(props: { clienteId: string }): Promise<JSX.Element>;
```
**Importa**: `/recibos/{pagoId}` (M1), componentes de solicitudes de M7 para `mi-cuenta/solicitudes/**` (§6.10), `segmentos.ts`, `nivelDeuda`, `rutaAdjuntoRegistro` (Fundación).

**Aceptación**
- [ ] Circular para "Quinteros": un puestero no la ve en el portal ni queda bloqueado; un quintero sí.
- [ ] Circular "Quinteros" + "Solo socios": un quintero que no es socio no la ve; un quintero socio sí; un puestero socio no.
- [ ] El socio responde una notificación → sello "Respondió" y badge en Comunicaciones del staff; Admin contesta → el socio ve "Respuesta nueva" hasta que abre el detalle.
- [ ] Doble toque en "Notificar" con multa → un solo registro y una sola multa.
- [ ] El detalle muestra "La vieron" con hora y "Todavía no" con "Sin usuario del portal".
- [ ] Apercibimiento con multa $50.000 → cargo MULT en la cuenta; "Dejar sin efecto" lo anula si no se cobró; con cobros, el error pide anular el cobro.
- [ ] El socio presenta un descargo con foto → estado "Descargo presentado"; Admin responde → "Respondido".
- [ ] El socio no puede escribir en una circular (no hay caja) ni en un registro ajeno (RLS).
- [ ] Semáforo: verde sin deuda, ámbar con deuda en término, rojo con algo vencido.
- [ ] Cada pago del portal tiene "Recibo" y abre el recibo del lote.

### M6 · Tesorería, gastos y cheques

**Requisitos**: E1–E4 (lado gastos), J2, J3 (movimientos), J5, J6.
**Archivos**: `src/app/(panel)/gastos/**`, `tesoreria/**`, `cheques/**`, `src/components/gastos/**`, `tesoreria/**`, `cheques/**`, `src/lib/actions/gastos.ts`, `tesoreria.ts`, `cheques.ts`.
**SQL**: `pagar_gasto`, `revertir_pago_gasto`, `replicar_gastos_fijos`, `entregar_cheque`, `vincular_cheque_gasto`, `flujo_caja`, `resumen_gastos`, `rechazar_cheque`, triggers `proteger_gasto` y `proteger_cheque`.

**UI**
1. **/gastos** — `requireRol('admin','tesoreria','lider')` (el Líder con todas las acciones, §1.3). Query por `periodo` (no más filtro en memoria). Agrupado **Por pagar** (vencidos arriba en rojo) / **Pagados** / **Anulados** (plegado); chips Fijos/Variables; resumen con "Vencen esta semana: N ($X)". Banner / vacío con **"Traer los 12 gastos fijos de agosto"** cuando hay fijos del mes anterior sin replicar. Columna Pago: "Caja del 25/09 · Efectivo" / "Tesorería · Banco" / "Cheque N° 123 a {proveedor}". Tarjetas en pantallas chicas. Descripción vacía → nombre del rubro. "Nuevo rubro" inline (Tesorería ya no tiene Configuración).
2. **Cargar gasto** — descripción **opcional** ("Si la dejás vacía usamos el nombre del rubro"); período = mes elegido; ayuda de Fijo/Variable ("Fijo: se repite todos los meses; el mes que viene lo traés con un toque" / "Variable: solo este mes"); rubro con búsqueda; opcional "¿Ya lo pagaste?" que abre el mismo selector de origen.
3. **Pagar gasto** — **"¿De dónde sale la plata?"** con dos tarjetas grandes **"Caja del día"** / **"Tesorería"**. Caja: chips de días (cajas de administración no validadas, últimas 10: "Hoy · abierta" / "Hoy · se abre al pagar" (**solo Administración**: Tesorería no abre cajas, §4.9) / "Ayer 27/09 · cerrada") con "tiene $X en efectivo" (`arqueo_caja` / `total_efectivo`); aviso ámbar si está cerrada ("Ya se cerró: su arqueo baja de $X a $Y y queda anotado"); aviso rojo si no alcanza; siempre efectivo, sin fecha; resumen "Juntó $1.000.000 − este gasto $50.000 = queda $950.000". Tesorería: Efectivo / Banco (chips) + fecha (no futura). `?caja=` preselecciona (viene de la caja). Toast: "Pagado desde la caja del 27/09: ahora tiene que tener $950.000" con "Ver caja". Pagados: botón **"Deshacer pago"** (motivo obligatorio; se ve "Pago deshecho por {quién} el {cuándo}: {motivo}" desde `pago_revertido_*`).
4. **TraerFijos** (nuevo) — sección inline: cada fijo del mes anterior con checkbox, rubro, descripción, **monto editable** (el anterior tachado y la diferencia ↑/↓), vencimiento +1 mes editable; pie **"Cargar 12 gastos en septiembre — total $X"**; toast "Trajiste 12 gastos fijos a septiembre".
5. **/cheques** — `requireRol('tesoreria','lider')` (el Líder con todas las acciones, §1.3). Columnas: **N° de cheque** (destacado) · **Puesto** · Recibido de (+ N° de cliente) · CUIT formateado · Monto · Recibido · Se cobra desde · Estado ("a {proveedor} el dd/mm"). Sin Banco. Filtros + **"Entregados a proveedor"**; "En cartera" se muestra **"Por cobrar"**. Buscador por N°, puesto o nombre. Encabezado "Por cobrar $X". Acciones: Depositar (bloqueado si es diferido), Se acreditó, **"Entregar a proveedor"** (proveedor con sugerencias, fecha, opcional "Paga el gasto…" con gastos pendientes), Rechazar (también entregados; motivo obligatorio). Filtro **"Entregados sin gasto (N)"**: cheques `entregado` con `gasto_id is null` (típicamente los que nacieron entregados en el cobro), con el botón **"¿Qué gasto pagó?"** que lista los gastos pendientes de ese proveedor y llama `vincular_cheque_gasto`; el badge de `/cheques` de Tesorería los suma.
6. **/tesoreria** — `requireRol('tesoreria','lider')` (el Líder con todas las acciones, §1.3). **Pestañas por link** (`?tab=`, un camino por pantalla; el archivo actual tiene 929 líneas: partirlo en componentes): **Hoy** (flujo, cajas para validar como lista con link a `/caja?fecha=…&tipo=…`, cheques para depositar, gastos que vencen) · **Movimientos** (acciones rápidas + tabla del mes) · **Conciliar** (transferencias y comprobantes de gastos) · **Saldos** (solo si faltan cargar; si no, plegado). Mientras no haya saldos iniciales, el aviso **"Antes de empezar, cargá cuánta plata había"** tapa la pestaña Hoy. **Flujo** en tres bloques: **PESOS** (Efectivo · Banco, y "$X todavía en cajas sin validar"), **DÓLARES** (Efectivo · Banco, en `US$`), **CHEQUES** (Por cobrar · Listos para depositar · Depositados, link a /cheques); total en pesos destacado; los dólares no se suman a los pesos. Acciones rápidas: **"Deposité efectivo en el banco"**, **"Saqué plata del banco"**, "Comisión / impuesto", "Ajuste", "Ingreso", "Egreso". **Nuevo movimiento**: "¿Qué pasó?" con tiles, moneda ARS/USD, monto, fecha, descripción opcional; depósito con "¿El banco cobró comisión por el depósito?" (dos filas con el mismo `grupo_id`); vista previa "Efectivo $A → $A−m · Banco $B → $B+m". Tabla de movimientos con Moneda y Cuenta ("Efectivo → Banco"). **Saldos iniciales**: 4 tarjetas (Pesos efectivo, Pesos banco, Dólares efectivo, Dólares banco), "Saldo al comenzar el día"; onboarding si no hay ninguno. Cajas para validar con desglose "Caja de portería — Quintas · Ambulantes · Bono camioneros", ajustes y link a imprimir. Gastos a pagar (vencidos + 7 días) con el mismo botón Pagar.
7. **ValidarCajaDialog** (exportado, lo monta M2 en `/caja`, §6.10) — cuenta del arqueo (Juntó − Gastos ± Ajustes = Tiene que haber); input **"¿Cuánto efectivo contaste?"** con diferencia en vivo ("Coincide" / "Faltan $500" / "Sobran $300"); CTA "Registrar faltante de $500 y validar" (`validar_caja` con `p_efectivo_contado`).
8. **Actions** — `gastos.ts`: `crearGasto` (con `periodo`, descripción opcional, `pagarAhora?`), `pagarGasto` → `pagar_gasto`, `revertirPagoGasto`, `traerGastosFijos` → `replicar_gastos_fijos`, `anularGasto`, `adjuntarFacturaGasto`, `crearRubro` (admin, tesoreria). `cheques.ts`: `depositarCheque`, `acreditarCheque` (update directo), `entregarCheque`, `vincularChequeGasto`, `rechazarCheque` (tesoreria). `tesoreria.ts`: movimientos con moneda/cuenta/grupo, `guardarSaldoInicial(medio, moneda, …)` con `onConflict: 'org_id,medio,moneda'`, `validarCaja(cajaId, observaciones?, efectivoContado?)`.

**Importa**: `Arqueo` (M2), `formatMoneda`, `Money moneda` (Fundación). **Exporta**: `ValidarCajaDialog` (§6.10).

**Aceptación**
- [ ] Gasto sin descripción se guarda y se ve con el nombre del rubro.
- [ ] "Traer fijos" replica solo los fijos, con los montos editados y vencimiento +1 mes; repetir no los duplica.
- [ ] Pagar desde la caja de un día cerrado recalcula ese arqueo; desde una caja validada, el error pide otro día.
- [ ] Depósito de $100.000 en efectivo al banco con comisión $500: efectivo −100.000, banco +99.500 en el flujo.
- [ ] Saldos iniciales en dólares se muestran en `US$` y no se suman a pesos.
- [ ] Administración ya no ve Cheques (menú ni ruta) pero sigue recibiendo cheques al cobrar.
- [ ] Entregar un cheque a un proveedor pagando un gasto deja el gasto "pagado con cheque"; rechazarlo vuelve el gasto a pendiente.
- [ ] Cheque entregado en el cobro → aparece en "Entregados sin gasto"; Tesorería lo vincula y el gasto queda pagado con cheque.
- [ ] Extracción de US$ 100 del banco: banco USD −100, efectivo USD +100; los pesos no cambian.
- [ ] Tesorería intenta pagar desde "Hoy" sin caja de Administración abierta → "Todavía no hay caja de Administración hoy…" (no se abre una caja a su nombre).

### M7 · Personal, novedades y solicitudes

**Requisitos**: H3, H4, G11 (la acción), J5 (solicitudes), F5 (Consejo en solicitudes).
**Archivos**: `src/app/(panel)/personal/**`, `src/app/(panel)/novedades/**` (nuevo), `src/components/personal/**`, `src/components/novedades/**` (nuevo), `src/lib/actions/personal.ts`, `src/lib/actions/novedades.ts` (nuevo), `src/app/(panel)/solicitudes/**`, `src/components/solicitudes/**`, `src/lib/actions/solicitudes.ts`, `src/app/(print)/solicitudes/**`, `src/app/(print)/novedades/**` (nuevo).
**SQL**: `revisar_novedad`, `aprobar_novedades`, `anular_novedad`, `resumen_novedades`, `avanzar_solicitud`, triggers `preparar_solicitud`, `tocar_solicitud`, `preparar_novedad`.

**UI**
1. **Personal** (Líder) — alta/edición con **Sector** (chips grandes, obligatorio) y **"Horas por semana según contrato"** (con "Según sus horarios: 44 h · Usar este número"); "Cargo" sugiere "Encargado de turno, Sereno, Peón"; listado con chips de sector y "44 h/sem" (ámbar "Sin horas de contrato"); ficha con tarjeta **"Novedades de septiembre"** (barra "Registró X de Y h", contadores, "Cargar novedad") e ingresos con su duración.
2. **/novedades** — `requireRol('admin','guardia','lider')`. Selector ◀ Septiembre 2026 ▶; chips de sector según rol (Admin: Portería · Limpieza · Mantenimiento; Jefe: solo Portería, sin chips; Líder: todos). Admin/Líder: bandeja ámbar **"N novedades del Jefe de Portería esperan tu OK"** con Aprobar / Rechazar y **"Aprobar todas (N)"**. Jefe: aviso de rechazadas con motivo. Planilla: una fila por empleado **"Registró 150 h de 176 h"** con barra (verde ≥100 %, ámbar ≥90 %, rojo <90 %), "N sin salida marcada", contadores con ícono solo si ≠ 0 (Faltas, Tarde, Feriados — se pagan doble —, Vacaciones, Licencia, Extra) o "Sin novedades"; al tocar se despliega el detalle con sellos y acciones + "Cargar novedad para {nombre}". Botones: **"Cargar novedad"** (h-12), Exportar, **"Imprimir planilla"** (`/novedades/{periodo}` en print).
3. **Cargar novedad** (`/novedades/nueva?empleado=&tipo=`) — **¿A quién?** (tarjetas por sector, buscador, selección múltiple "Podés elegir varios") → **¿Qué pasó?** (7 fichas: Faltó · Llegó tarde · Trabajó un feriado (se paga doble) · Vacaciones · Licencia · Horas extra · Otra) → campos del tipo (fecha con chips Hoy/Ayer/Elegir o desde–hasta con "10 días corridos"; minutos de tardanza con chips 5/10/15/30/60 → se guardan en horas; horas con chips 1/2/3/4/8; ¿Justificada? Sí/No; detalle; **"Sacá una foto del certificado"**) → frase de confirmación ("Juan Pérez faltó el martes 23/09 (justificada, con certificado)") → botón **"Enviar a Administración"** (Jefe; toast "Enviada a Administración para aprobar") o **"Guardar novedad"**.
4. **Solicitudes** — estado `con_jefe` ("Con el Jefe"); acciones del Jefe sobre las de Portería: **"Resolver"** (primario; "Contá qué decidiste. Le llega a quien la cargó y queda cerrada."), **"Elevar al Líder de Procesos"**, **"Rechazar"**; el Líder "Tomarla yo" sobre las del Jefe. Pestañas: Jefe **"Para resolver (N)" · "En manos del Líder" · "Terminadas" · "Todas"**; Portería y Tesorería "Mis solicitudes · En curso · Terminadas"; Líder suma "Con el Jefe de Portería". Stepper con paso "Jefe de Portería" y terminal verde "Resuelta por el Jefe"; "En el Consejo" con "lo registra el Líder"; "Ahora la tiene: …". Alta: Portería, Jefe y Tesorería eligen el **puesto por número** (chips Puesto · Local · Contéiner + teclado validado contra `rpc('espacios_del_plano')`, o `SelectorEspacio` de M9) sin ver clientes; Admin y Líder conservan el buscador de clientes. En listados y detalle, para el Jefe y Portería el puesto se muestra desde `referencia` ("Puesto 58"): ellos no leen la tabla `espacios` (el join `espacio:espacios(...)` les vuelve null). Éxito: **"Le llegó al Jefe de Portería"** / **"Le llegó al Líder de Procesos"** según el estado devuelto; "Ver la solicitud", "Cargar otra", "Imprimir" secundario. Origen "Tesorería". Tesorería sin link a la ficha. Consejo: sin UI propia; "Derivar al Consejo" = "Queda en espera de lo que decida el Consejo; cuando decida, registrá acá la resolución".
5. **Imprimibles** — `(print)/solicitudes/[id]`: "Recibido por: Jefe de Portería" si el origen es Portería; puesto; título de la resolución según quién decidió. `(print)/novedades/[periodo]` (nuevo): tabla por empleado (sector, horas contrato, debería, registró, diferencia, faltas, tardanzas, feriados, vacaciones, licencias, horas extra) + detalle + firmas del Líder y de Administración.
6. **Actions** — `solicitudes.ts`: `crearSolicitud` (admin, guardia, porteria, tesoreria, lider; `espacioId` opcional; Portería/Jefe/Tesorería no mandan `clienteId`; devuelve `{ id, numero, estado }`), `enviarMensaje` (sin tocar `actualizada_en`: lo hace el trigger), `avanzarSolicitud` (admin, guardia, lider). `novedades.ts`: `cargarNovedad` (admin, guardia, lider; varios empleados = un insert por empleado; adjunto `rutaAdjuntoNovedad`), `editarNovedad`, `borrarNovedad` (pendientes), `revisarNovedad`, `aprobarNovedades`, `anularNovedad`. `personal.ts`: `sector`, `horas_semanales`.

**Exporta**
```ts
// src/lib/actions/solicitudes.ts — la usa el mapa del Jefe (M9)
export async function avisarSobrePuesto(input: { espacioId: string; motivo: string; detalle?: string }):
  Promise<ActionResult<{ id: string; numero: number }>>;
// requireRol('guardia','lider'); crea tipo 'informe', asunto `Puesto ${N}: ${motivo}`, referencia `Puesto ${N}`, espacio_id.
// El estado lo decide el trigger preparar_solicitud (§4.10): del Jefe nace 'nueva' (va al Líder); devolvé el estado leído.
```
**Importa**: `SelectorEspacio` (M9, opcional), `rutaAdjuntoNovedad` (Fundación).

**Aceptación**
- [ ] Portería carga una solicitud → queda "Con el Jefe"; el Jefe la resuelve (cerrada, "Resuelta por el Jefe") o la eleva (pasa a "Nueva" para el Líder).
- [ ] Tesorería carga una solicitud (origen Tesorería) y solo ve las suyas.
- [ ] Nadie puede insertar una solicitud ya resuelta por API (columnas acotadas + trigger).
- [ ] El Jefe carga una falta de un portero → pendiente; Admin la aprueba desde la bandeja; el Jefe no puede cargar para Limpieza.
- [ ] El resumen del mes muestra horas esperadas vs registradas y los contadores coinciden con lo aprobado.
- [ ] Aviso del Jefe desde el mapa nace "Nueva", aparece en la bandeja del Líder y NO en "Para resolver" del Jefe; tiene `espacio_id`.

### M8 · Accesos, navegación, inicio y configuración

**Requisitos**: F1–F5, G1, G7 (configuración del Jefe), J4 (inicio de Tesorería), J7, matriz de navegación.
**Archivos**: `src/lib/roles.ts`, `src/lib/navegacion.ts`, `src/lib/auth.ts`, `src/lib/pendientes.ts`, `src/components/shared/nav-links.tsx`, `src/components/shared/barra-inferior.tsx`, `src/components/shared/principal.tsx` (regla §0.2-7), `src/app/(panel)/layout.tsx`, `src/app/login/**`, `src/lib/actions/auth.ts`, `usuarios.ts`, `configuracion.ts`, `src/components/configuracion/**` (salvo `tarifas-transporte.tsx`), `src/app/(panel)/configuracion/**`, `src/app/(panel)/inicio/**`, `src/proxy.ts`, `src/app/page.tsx`.
**SQL**: `email_para_login`, `guardar_cuotas_quinteros`, `autorizar_gestion_usuario`.

**UI**
1. **Login** — campo **"DNI"** grande (`inputMode="numeric"`, `autoComplete="username"`, h-14, puntos automáticos "12.345.678"; si tiene letras o "@" pasa a modo email "Entrás con email"); contraseña con "Mostrar" (44 px); si falla se conserva el DNI; error único **"El DNI o la contraseña no son correctos."** con tiempo mínimo de respuesta (~700 ms). Resolución DNI → email en el server action con `createAdminClient().rpc('email_para_login')` (si no existe, un email inexistente fijo). Sin clave de servicio: "El ingreso con DNI no está configurado. Entrá con tu email.". Texto: "Entrá con tu DNI y la contraseña que te dio la cooperativa." · "¿Te olvidaste la contraseña? Pedí una nueva en Administración (socios) o al Líder de Procesos (equipo)." Usuario desactivado: signOut + "Tu usuario está desactivado. Consultá en Administración." Acceso demo: **6 tarjetas** (sin Consejo): Líder · Administración "Cobra y arma la caja mayor" · Tesorería "Valida, concilia, cheques y gastos" · Jefe de Portería "Quinteros y ambulantes, rinde la caja" · Portería "Canon de transporte e ingresos" · Socio.
2. **Bucle de redirects** — `proxy.ts` deja de mandar `/login → /` con sesión; `login/page.tsx` redirige a `rutaInicio` solo si `getPerfil()` devuelve perfil. `getPerfil` trata `consejo` como sin acceso. `requireStaff` = admin, guardia, porteria, tesoreria, lider.
3. **Usuarios** (Configuración) — Líder: pestañas **Equipo** (todos los roles de staff menos consejo: crear, cambiar rol, quitar/devolver acceso, nueva contraseña) y **Socios**; Admin: solo **Socios** (clientes puesteros "Con acceso (N)" / "Sin acceso (M)", buscador por carpeta/nombre/apodo/puesto, **"Dar acceso"** inline con DNI prellenado desde el CUIT si es persona física, contraseña legible generada "Tomate-4821", email opcional); Jefe: **Portería** (alta desde el padrón de empleados de sector portería o escaneando el DNI; rol fijo). Filas grandes: inicial, nombre (+ "(vos)"), "DNI 12.345.678", rol, sello activo/inactivo; acciones **"Quitar acceso"** (confirmación "X no va a poder entrar más. Sus datos quedan.") / "Devolver acceso", **"Nueva contraseña"**, "Editar". Toda acción con `auth.admin.*` sigue el flujo de §4.11 (`autorizar_gestion_usuario` con el cliente del usuario primero; perfil insertado con el cliente del usuario; `deleteUser` si falla). Filas desactivadas: "Sin acceso desde el 28/09 (lo quitó Marta Núñez)" desde `desactivado_por/en`. Toda alta o reseteo termina en una **Credencial** imprimible ("Entrá con tu DNI 12.345.678 · Contraseña Tomate-4821"; "Anotala ahora: después no se puede volver a ver"). Nunca se muestra el email técnico. Quitar acceso = `activo=false` + ban de sesión (`updateUserById(..., { ban_duration })`).
4. **Configuración** — `requireRol('admin','guardia','lider')`. Pestañas por rol (`?tab=`): Líder = Precios · General · **Tarifas de transporte** (`<TarifasTransporte>` de M3) · **Quintas y ambulantes** · Usuarios · Rubros de gasto. Admin = Precios (sin EXPQ, AMB ni BC) · General (vencimiento, impresión directa; sin el viejo "cobro por día en portería") · Usuarios (socios) · Rubros. Jefe = **Quintas y ambulantes** · **Usuarios de Portería**. **QuintasAmbulantes** (nuevo): "Quinta (EXPQ) — por mes" con "En 4 pagos: $82.500 cada uno"; "Ambulante (AMB) — por día" con "3 días = $45.000"; **"¿En cuántos pagos cobrás la quinta?"** chips 1/2/3/4 → `guardar_cuotas_quinteros`; los precios van por `solicitar_cambio` (sello "Esperando aprobación"). Tabla de precios del Líder agrupada (Puestos · Quintas y ambulantes · Energía · Otros) con labels de tipo nuevos.
5. **Inicio** — Jefe: sin "Ingresos de personal" (G1); tarjeta principal **"Quintas de {mes}"** (EXPQ cobrado vs estimado, "faltan $X", N al día / con deuda contados con `v_avance_mes` — la misma cuenta que Cobrar y el Mapa) + "Ambulantes cobrados este mes $Y"; botones "Cobrar"; tarjeta lateral **"Caja de portería de hoy"** con Quintas · Ambulantes · Bono camioneros (`arqueo_caja`); aviso "N solicitudes de Portería para resolver". Tesorería (J4): sin "Cobrar" ni "Caja de hoy"; héroe **"Se tendría que cobrar $X / Se cobró $Y (Z %)"** con barra (cobrado / beneficios / falta) y detalle por concepto usando `estimado`; bono camioneros aparte; avisos: cajas para validar, transferencias sin conciliar, **cheques para depositar**; sin "Ver reportes", sin links a Facturación ni Clientes. Admin: aviso "N novedades del Jefe de Portería para aprobar". **Líder (control del dueño)**: dos tarjetas nuevas. (1) **"Correcciones de los últimos 7 días (N)"**: una fila por evento con quién, cuándo, monto, motivo y link; fuentes: `caja_eventos` de tipo `cobro_anulado`, `canon_anulado`, `gasto_revertido`, `ajuste`, `ajuste_borrado`, `arqueo_recalculado`, `cierre_forzado`; `sanciones.multa_sin_efecto_*`; `cheques.rechazado_*`; `novedades_personal` anuladas; `perfiles.desactivado_*`. (2) **"Plata de hoy"**: Administración $A · Caja de portería $B (Quintas · Ambulantes · Bono camioneros) · Gastos pagados desde cajas $G (`arqueo_caja` de las dos cajas de hoy). Aviso "N altas de ambulantes para revisar" (D-1). Consejo: ramas borradas. Filtrar canon anulado en el gráfico de 14 días.
6. **Navegación** — §7 (`/cobranza` suma al Líder, que cobra: §1.3). `NAVEGACION` suma campo opcional `porRol?: Partial<Record<Rol, { label?: string; corto?: string }>>` que aplica `navParaRol` (`/clientes` del Jefe = "Quinteros y ambulantes"/"Quintas"; `/caja` del Jefe = "Caja de portería"/"Caja"; `/caja` de Tesorería = "Cajas del día"). Ítem nuevo `/novedades` (ClipboardList, grupo `gestion`). `MAX_PLANO` y el umbral de la barra inferior pasan a 8 (constante compartida exportada desde `navegacion.ts`).
7. **Badges** (`pendientes.ts`) — Jefe: `/solicitudes` = en `con_jefe`; Admin: `/novedades` = pendientes, `/comunicaciones` = registros en `descargo`; Líder: `/comunicaciones` = registros en `descargo`, `/aprobaciones` suma los `revisar_despues` sin revisar; Tesorería: `/cheques` = en cartera con `fecha_cobro ≤ hoy` + entregados sin gasto, `/gastos` = pendientes vencidos. Se va la rama consejo.
8. **roles.ts** — `ROLES_COBRAN = ['admin','guardia','lider']` (§1.3 D-P2: el Líder cobra; los botones "Cobrar" de ficha, mapa y libre deuda le aparecen); `ROLES_REPORTES = ['lider']`; `ROLES_GESTION_CLIENTES = ['admin','guardia','lider']`; `ROLES_STAFF` y `ORDEN_ROL` sin consejo (`LABEL_ROL.consejo` se queda para hilos viejos); nuevos `ROLES_ASIGNABLES_STAFF = ['lider','admin','tesoreria','guardia','porteria']`, `rolesQueGestiona(rol)`, `puedeGestionarRol(actor, objetivo)` (espejo de `private.puede_gestionar_rol`). Descripciones: admin "Cobra a los puesteros, integra la caja de portería y da acceso a los socios"; guardia "Cobra a quinteros y ambulantes, rinde la caja de portería y gestiona los usuarios de Portería"; porteria "Cobra el canon de transporte, registra el ingreso del personal y genera solicitudes"; tesoreria "Valida cajas, concilia el banco y maneja cheques, gastos y el flujo de fondos"; lider "Aprueba cambios, gestiona usuarios y personal, mira reportes y registra lo que resuelve el Consejo".
9. **Actions** — `auth.ts` (`iniciarSesion` por DNI/email, `USUARIOS_DEMO` sin consejo, opcional `cambiarMiContrasena`); `usuarios.ts` (`crearUsuario` lider/guardia, `crearAccesoSocio` admin/lider con DNI obligatorio, `cambiarActivoUsuario`, `restablecerContrasena`, `editarUsuario`; email técnico `{dni}@usuarios.sanmiguel.coop`; rollback del auth user si falla el perfil); `configuracion.ts` (`actualizarConcepto` admin/guardia/lider vía `solicitar_cambio`, `cambiarActivoConcepto` admin/lider, `guardarConfiguracionGeneral` admin/lider (solo `dia_vencimiento`, `impresion_directa`, `actualizado_por/en`: grants de 0022), `guardarCuotasQuinteros` guardia/lider, rubros admin/lider; se borra `guardarPreciosPorteria`).

**Exporta**: `ROLES_*` (los nombres que hoy existen no cambian), `puedeGestionarRol`, `navParaRol`, `cerrarSesion` de `actions/auth.ts` con la misma firma (lo usa el layout del portal, M5). **Importa**: `TarifasTransporte` (M3), `EscanerDni`/`parsearDni` (M3, alta de usuarios de Portería), `Arqueo` (M2), `formatDni`/`normalizarDni` (Fundación), `textoAvance` (Fundación).

**Aceptación**
- [ ] Login con DNI 20222222 + SanMiguel2026 entra como Administración; con email también; DNI inexistente y contraseña mala dan el mismo error.
- [ ] Admin no puede desactivar al Líder (ni por UI ni por API); el Jefe crea un usuario de Portería y no puede crear otro rol.
- [ ] Nadie puede quedar sin Líder activo; nadie se desactiva a sí mismo.
- [ ] Un usuario desactivado con sesión abierta ve el login con aviso (sin bucle).
- [ ] Cada rol ve exactamente los ítems de §7; el Jefe ve "Quinteros y ambulantes" y "Caja de portería".
- [ ] El inicio de Tesorería muestra Estimado vs Cobrado y no tiene "Cobrar".
- [ ] Por API, Administración llamando `autorizar_gestion_usuario(<id del Líder>, 'resetear_contrasena')` recibe error y la contraseña no cambia.
- [ ] El inicio del Jefe no tiene "Ingresos de personal".
- [ ] Pasar las cuotas por defecto a 3 no cambia a los quinteros existentes; la pantalla dice "Rige para los quinteros nuevos".
- [ ] Anular un cobro aparece en la tarjeta "Correcciones" del Líder.

### M9 · Mapa, facturación, energía, reportes y exportación

**Requisitos**: C3, C6 (plano/reportes), C8 (selector), G11 (mapa del Jefe), I1, J5/J7 (roles de sus rutas), exportación de todos los módulos.
**Archivos**: `src/app/(panel)/mapa/**`, `src/components/mapa/**`, `src/lib/actions/mapa.ts`, `src/app/(panel)/facturacion/**`, `src/components/facturacion/**`, `src/lib/actions/facturacion.ts`, `src/app/(panel)/energia/**`, `src/components/energia/**`, `src/lib/actions/energia.ts`, `src/app/(panel)/reportes/**`, `src/components/reportes/**`, `src/components/charts/**`, `src/lib/exportar/**`, `src/app/api/exportar/**`, `src/app/(print)/reporte-mensual/**`, `src/app/(print)/planilla-lecturas/**`, `src/app/(print)/libre-deuda/**`, `supabase/plano/**`.
**SQL**: `editar_espacio` (implementación), `generar_periodo`, `registrar_lectura`, `resumen_conceptos`, `private.generar_abonos_energia`.

**UI**
1. **/mapa** — `requireRol('admin','guardia','lider')`. `CONCEPTO_FACTURADO`: EXME → puestos, **EXPP → propios**, EXPL, EXPE, EXPQ, EXPC, EXPG. **Puesto propio** se distingue por forma (banderín azul en la tapa + "Propio" con zoom), no por color; chip "Propios 4" en la leyenda/filtro; pastilla "2 puestos + 1 propio"; EditorEspacio con switch **"Puesto propio de la cooperativa · paga EXPP"** (solo puestos; toast "Listo: el 12 quedó como puesto propio"); revisiones separadas EXME/EXPP con botón **"Facturar 1½ en la carpeta"** (usa `agregarConceptoCliente`/`editarConceptoCliente` de M4 → aprobación). Ambulantes fuera del plano. "Contenedor(es)" → **"Contéiner(s)"** en textos (el valor interno `contenedor` no cambia; `plano_elementos.etiqueta` por `supabase/plano/generar.mjs`). `?espacio=<uuid>` enfoca un espacio exacto.
2. **Mapa del Jefe** (G11) — el server lee los espacios con `rpc('espacios_del_plano')` (el Jefe ya no puede leer la tabla `espacios`, 0022) y arma `Espacio` con `clienteId: null`, `nota: null`; clientes = solo quinteros con el dato del mes de `v_avance_mes` (misma cuenta que Cobrar e Inicio). Puestos en gris neutro ("anonimo", con número, sin libre/ocupado); zona de quinteros con fichas verde/roja y resumen "Quinteros 12 · Al día 8 · Deben 4 · $X por cobrar"; tooltip "Puesto 58 · Tocá para avisarle algo al Líder". Tocar un puesto → **AvisoPuesto**: "¿Viste algo en este puesto? Avisale al Líder de Procesos." chips (Luz / electricidad · Limpieza / residuos · Mercadería en el pasillo · Seguridad · Otro), texto opcional, botón **"Avisar al Líder sobre el puesto 58"** (`avisarSobrePuesto` de M7), toast "Listo: el Líder recibió tu aviso (solicitud N° 14)" con "Ver", y "Avisos anteriores de este puesto". Tocar un quintero: sello, `textoAvance()` ("2 de 4 · Falta $165.000"), Cobrar y Ver ficha.
3. **SelectorEspacio** (nuevo, exportado) — para guardia, porteria y tesoreria los datos salen de `espacios_del_plano()` (sin clientes); chips de 1 toque con los espacios sugeridos + "Elegir en el plano" (Sheet ~80dvh con `LienzoPlano`, sugeridos con anillo azul y enfocados, barra fija **"Puesto 58 — Usar esta ubicación"**) + "Otro lugar (sin plano)". Carga con `next/dynamic`. Datos por `planoParaSelector()`.
4. **Facturación** — `requireRol('admin','lider')`. Preview con la fila ABEN automática (clientes con medidor activo sin exención); resultado y toast "X cargos, Y abonos de energía y Z consumos"; texto "El consumo de luz (kWh) se suma con las lecturas del mes; el abono mensual ya está incluido." Estimado/cobrado del historial sin BC.
5. **Energía** — `requireRol('admin','lider')`. Tira **"Energía de {mes}: Abono $15.000 × N clientes con medidor + Consumo cargado $Y = $Z"** con el precio del abono editable (`solicitar_cambio` sobre ABEN, "Enviado al Líder"); por cliente "+ abono $15.000" o "Exento de abono"; ubicación = chip "Puesto 58" con link a `/mapa?espacio=`; pie "Si agregaste medidores después de generar el mes, volvé a generarlo: solo suma lo que falta". Planilla del electricista ordenada por recorrido (y, x); sin lugar al final.
6. **Reportes y reporte mensual** — `requireRol('lider')` (J7). ABEN, AMB, MULT, EXME/EXPP aparecen solos; BC una sola fila "Bono camioneros". Serie diaria sin canon anulado. `veReportes` = `ROLES_REPORTES`.
7. **Libre deuda** — `requireRol('admin','guardia','lider')` + categoría del rol; "Cobrar ahora" solo si el rol está en `ROLES_COBRAN`.
8. **Exportación** (`datasets.ts`, `consultas.ts`, `etiquetas.ts`, `/api/exportar`) — roles: clientes, cuenta_corriente, pagos → admin, guardia (sus clientes, por RLS), lider (+ pagos tesorería); cheques → tesoreria, lider; gastos, cajas → admin, tesoreria, lider; canon → admin, tesoreria, lider; lecturas, circulares, registros → admin, lider; solicitudes → admin, lider; movimientos_tesoreria → tesoreria, lider; balance_mensual → lider; empleados → lider, admin; ingresos_personal → lider, admin, porteria; **novedades_personal** (nuevo, mensual) → lider, admin, guardia; **registros** (nuevo) → admin, lider. Sin consejo. Columnas: clientes + Categoría, Socio, "Tiene" (segmentos), Persona; pagos + Recibo compartido / "Pago mixto"; cheques sin Banco, con CUIT, Puesto, Recibido de, Proveedor, Entregado; gastos con período, "Caja del día (fecha)", descripción o rubro; cajas + Cobros, Quintas, Ambulantes, Bono camioneros, Ajustes, Juntado; canon → hoja "Bono camioneros" (N°, fecha, hora, vehículo, cantidad, precio, monto, medio, patente, a quién viene, puesto, cobró, anulado/motivo; total sin anulados); lecturas + Ubicación; movimientos con Moneda, Cuenta, Destino, efecto por cuenta; solicitudes + Puesto, Resolvió, Elevada; empleados + Sector, Horas/sem; novedades (hojas Resumen `resumen_novedades` + Detalle); registros (N°, fecha, tipo, cliente, puesto, título, estado, visto, multa, estado de la multa). Nota del balance: "BC es el bono camioneros (canon de transporte) cobrado en portería; AMB son los ambulantes cobrados por día."

**Exporta**
```ts
// src/components/mapa/selector-espacio.tsx ("use client")
export type LugarPlano = { espacioId: string; etiqueta: string };
export function SelectorEspacio(props: {
  valor: LugarPlano | null;
  onCambiar: (lugar: LugarPlano | null) => void;
  sugeridos?: string[];                                   // ids de espacios que se ofrecen como chips (los del cliente)
  tipos?: ("puesto" | "local" | "bar" | "contenedor")[];  // qué se puede elegir (default: todos)
  titulo?: string;                                        // "¿Dónde está el medidor?"
  permitirSinLugar?: boolean;                             // muestra "Otro lugar (sin plano)" → onCambiar(null)
}): JSX.Element;
// src/lib/actions/mapa.ts
export async function planoParaSelector(): Promise<ActionResult<{ espacios: Espacio[]; elementos: ElementoPlano[] }>>;
// Espacio y ElementoPlano de src/components/mapa/tipos.ts. Para guardia/porteria/tesoreria: clienteId y nota en null.
// src/components/mapa/geometria.ts (TS puro, server y client)
export function etiquetaEspacio(e: { tipo: string; numero: string | null; medio: boolean; propio?: boolean }): string; // "Puesto 58", "Puesto 34½", "Puesto propio 12", "Contéiner 7", "Bar"
```
**Importa**: `avisarSobrePuesto` (M7), `agregarConceptoCliente`/`editarConceptoCliente` (M4), `textoAvance` (Fundación).

**Archivos compartidos con la otra sesión** (regla §0.2-7): `lienzo-plano.tsx`, `use-vista.ts`, `mapa-mercado.tsx`, `panel-detalle.tsx`, `panel-asignacion.tsx`, `resumen-mapa.tsx` y `mapa/page.tsx` — releer antes de editar, cambios aditivos, `git diff` al terminar. `EnElPlano` y los tipos de `mapa/tipos.ts` solo suman props/campos OPCIONALES (`Espacio.propio?: boolean`), porque los usa la ficha de M4.

**Aceptación**
- [ ] Marcar el puesto 12 como propio: banderín en el plano, chip "Propios", y el cliente que lo ocupa aparece en el segmento "Puestos propios" si factura EXPP.
- [ ] El Jefe ve el plano sin nombres ni estados de puesteros (tampoco en la respuesta del server ni por API: `select` directo a `espacios` le devuelve 0 filas) y puede avisar al Líder sobre un puesto.
- [ ] Generar septiembre crea 1 ABEN por cliente con medidor activo y ninguno al exento; volver a generar no duplica.
- [ ] Tesorería no entra a Mapa, Facturación, Energía ni Reportes.
- [ ] `resumen_conceptos` devuelve una sola fila BC sin anulados.
- [ ] Cada dataset nuevo/cambiado baja con las columnas de arriba y respeta los roles.

### 6.10 Interfaces congeladas (entre módulos)

Hoy ya hay imports cruzados (relevados con `grep` del working tree) y otros nuevos de este contrato. El
dueño mantiene exportado cada símbolo con la MISMA firma; solo puede sumar props/campos **opcionales** y
exports nuevos (nunca renombrar, borrar ni volver obligatorio). Quien importa programa contra esta tabla.

| Dueño | Archivo | Símbolos congelados | Lo usan |
|---|---|---|---|
| M7 | `src/components/solicitudes/constantes.ts` | `selloEstado`, `LABEL_ESTADO`, `LABEL_TIPO`, `LABEL_ORIGEN`, `TIPOS_SOLICITUD`, `ESTADOS_TERMINADOS`, `ESTADOS_EN_CURSO`, `ACCEPT_ADJUNTO`, `esMensajeAutomatico`, tipos `TipoSolicitud`/`EstadoSolicitud`/`OrigenSolicitud` (`selloSolicitud` nuevo se AGREGA, no reemplaza) | M5 (`mi-cuenta`, `form-solicitud-socio`) |
| M7 | `solicitudes/chip-tipo.tsx`, `caja-mensaje.tsx`, `hilo-mensajes.tsx`, `linea-estado.tsx` | `ChipTipo`, `CajaMensaje`, `HiloMensajes` + `MensajeHilo`, `LineaEstado` + `FechasSolicitud` (props actuales) | M5 (`mi-cuenta/solicitudes/**`) |
| M7 | `src/lib/actions/solicitudes.ts` | `avisarSobrePuesto(input)` (§6 M7) | M9 |
| M3 | `src/components/porteria/fechas.ts` | `rangoDiaAR`, `esFechaISO`, `horaAR`, `fechaHoraAR` — sin cambios | M7 (`personal/[id]`) |
| M3 | `src/components/porteria/escaner-dni.tsx` | `EscanerDni({ onLeido, disabled? })`, `parsearDni`, `DatosDni` — sin cambios | M8 (usuarios de Portería) |
| M3 | `porteria/tarifas.ts`, `porteria/canon-del-dia.tsx`, `configuracion/tarifas-transporte.tsx` | `TarifaTransporte`, `CanonEntrada`, `CanonDelDia`, `TarifasTransporte` (§6 M3) | M2, M8 |
| M9 | `src/components/mapa/en-el-plano.tsx` | `EnElPlano({ clienteId, espacios, facturaPuestos, puedeUbicar })` (props nuevas opcionales) | M4 (ficha) |
| M9 | `src/components/mapa/tipos.ts` | `Espacio`, `ElementoPlano`, `TipoEspacio`, `Rect`, `EstadoCobro`, `ClienteMapa`, `Facturado`, `Destinos` (solo campos nuevos opcionales, p. ej. `propio?`) | M4 |
| M9 | `mapa/selector-espacio.tsx`, `mapa/geometria.ts`, `lib/actions/mapa.ts` | `SelectorEspacio`, `LugarPlano`, `etiquetaEspacio`, `planoParaSelector(): ActionResult<{ espacios: Espacio[]; elementos: ElementoPlano[] }>` | M4, M7 |
| M4 | `src/lib/actions/clientes.ts` | `agregarConceptoCliente`, `editarConceptoCliente` (firmas actuales) | M9 |
| M5 | `clientes/registros-cliente.tsx`, `clientes/circulares-cliente.tsx` | `RegistrosCliente`, `CircularesCliente` (§6 M5) | M4 |
| M5 | `src/components/comunicaciones/constantes.ts` (nuevo) | `TIPOS_REGISTRO` (sin "Resolución del Consejo"), `labelTipoRegistro` | M5, M9 (export registros). `clientes/constantes.ts` conserva su copia hasta la limpieza (M4 no la toca) |
| M5 | `src/components/clientes/nueva-sancion.tsx` | se mantiene (deprecado) hasta que la ficha de M4 monte `RegistrosCliente` | M4 |
| M2 | `src/lib/actions/cajas.ts` | `anularCobro(...)` (firma actual) | M1 (reexporta) |
| M2 | `src/components/caja/arqueo-tipos.ts` | `type Arqueo` (claves de §4.5) | M6, M8 |
| M6 | `src/components/tesoreria/validar-caja-dialog.tsx` | `ValidarCajaDialog(props: { caja: { id: string; tipo: "administracion" \| "guardia"; fecha: string; estado: string }; arqueo: Arqueo; ajustes: { id: string; cuenta: "efectivo" \| "banco"; monto: number; descripcion: string \| null }[] })` | M2 (`/caja`) |
| M8 | `src/lib/actions/auth.ts` | `cerrarSesion()` | `(portal)/layout.tsx` (M5) |
| M8 | `src/lib/roles.ts` | todos los `ROLES_*`, `LABEL_ROL`, `DESCRIPCION_ROL`, `ORDEN_ROL` existentes + los nuevos de §6 M8 | todos |
| M8 | Configuración | claves de `?tab=`: `precios \| general \| tarifas \| quintas \| usuarios \| rubros` | M3 (link "Editar tarifas"), M4 |
| M1 | ruta `/recibos/{pagoId}` | acepta el id de cualquier línea del lote | M2, M4, M5 |

### 6.11 Prueba de humo por rol (la corre el ingeniero en la rama del paso 4b, logueado con cada DNI demo)

1. **Administración (20222222)**: cobra a un puestero $100.000 efectivo + $100.000 transferencia + un cheque; anula un recibo; paga un gasto desde la caja de hoy; cierra e imprime el cierre.
2. **Jefe de Portería (20444444)**: cobra una quinta en cuotas y un ambulante 3 días; da de alta un ambulante (D-1); avisa al Líder sobre un puesto desde el mapa; rinde la caja de portería.
3. **Portería (20555555)**: cobra dos canon (uno por transferencia), anula uno dentro de los 15 minutos, registra un ingreso y marca la salida; con la caja rendida ve el aviso y no puede cobrar.
4. **Administración**: integra la caja de portería (ve Quintas · Ambulantes · Bono camioneros y "En mano / Por transferencia").
5. **Tesorería (20333333)**: carga un ajuste de caja, valida con efectivo contado distinto desde `/caja`, vincula un cheque entregado con un gasto, deposita efectivo con comisión y ve el flujo.
6. **Socio (20666666)**: abre Mi cuenta (semáforo), descarga un recibo, confirma una circular, presenta un descargo con foto.
7. **Líder (20111111)**: ve las correcciones del día en el inicio, revisa el alta de ambulante, aprueba un cambio y opera como cualquier rol (§1.3): cobra a cualquier categoría en la caja de administración, registra canon y opera cajas, cheques, gastos y tesorería.

---

## 7. Matriz de navegación y permisos por pantalla

### 7.1 Menú por rol (`NAVEGACION`)

| Ruta | Líder | Admin | Jefe (`guardia`) | Portería | Tesorería | Grupo |
|---|---|---|---|---|---|---|
| `/inicio` | ✓ | ✓ | ✓ (sin ingresos de personal) | – (arranca en /porteria) | ✓ (Estimado vs Cobrado) | hoy |
| `/cobranza` "Cobrar" | ✓ todo (§1.3) | ✓ puesteros | ✓ quinteros + ambulantes (sin cheque) | – | – | hoy |
| `/caja` | ✓ todo (§1.3) | ✓ | ✓ "Caja de portería" | – | ✓ "Cajas del día" (ver, contar y validar, ajustes) | hoy |
| `/porteria` | ✓ todo (§1.3) | – | – | ✓ | – | hoy |
| `/mapa` | ✓ | ✓ | ✓ (solo quintas + avisos) | – | – | hoy |
| `/clientes` | ✓ | ✓ (sin quinteros/ambulantes) | ✓ "Quinteros y ambulantes" | – | – | gestión |
| `/solicitudes` | ✓ | ✓ | ✓ (bandeja de Portería + elevar) | ✓ | ✓ (cargar, ver las suyas) | gestión |
| `/aprobaciones` | ✓ | – | – | – | – | gestión |
| `/comunicaciones` | ✓ | ✓ | – | – | – | gestión |
| `/novedades` (nuevo) | ✓ | ✓ (portería/limpieza/mantenimiento) | ✓ (portería) | – | – | gestión |
| `/facturacion` | ✓ | ✓ | – | – | – | plata |
| `/energia` | ✓ | ✓ | – | – | – | plata |
| `/cheques` | ✓ todo (§1.3) | – | – | – | ✓ | plata |
| `/gastos` | ✓ todo (§1.3) | ✓ | – | – | ✓ | plata |
| `/tesoreria` | ✓ todo (§1.3) | – | – | – | ✓ | plata |
| `/reportes` | ✓ | – | – | – | – | dirección |
| `/personal` | ✓ | – | – | – | – | dirección |
| `/configuracion` "Ajustes" | ✓ | ✓ (precios de puestos, general, usuarios socios, rubros) | ✓ (quintas/ambulantes + usuarios de Portería) | – | – | dirección |
| Consejo | sin acceso (perfil desactivado; `getPerfil` lo trata como sin acceso) | | | | | |

**`TABS_MOVIL`** (barra inferior): porteria `['/porteria','/solicitudes']` · guardia `['/inicio','/cobranza','/caja','/clientes']` · admin `['/inicio','/cobranza','/caja','/mapa']` · tesoreria `['/inicio','/caja','/tesoreria','/cheques']` · lider `['/inicio','/aprobaciones','/mapa','/clientes']` · consejo `[]` · socio `['/mi-cuenta']`.

### 7.2 `requireRol` por página

| Página | requireRol | Dueño |
|---|---|---|
| `(panel)/layout.tsx`, `/inicio` | `requireStaff()` = admin, guardia, porteria, tesoreria, lider (porteria → redirect /porteria) | M8 |
| `/cobranza`, `/cobranza/[clienteId]` | admin, guardia, lider (el Líder cobra, §1.3) | M1 |
| `/caja` | admin, guardia, tesoreria, lider | M2 |
| `/porteria` | porteria, lider | M3 |
| `/mapa` | admin, guardia, lider | M9 |
| `/clientes`, `/clientes/[id]`, `/clientes/nuevo` | admin, guardia, lider (+ categoría del rol) | M4 |
| `/solicitudes`, `/solicitudes/[id]`, `/solicitudes/nueva` | admin, guardia, porteria, tesoreria, lider | M7 |
| `/aprobaciones` | lider | M4 |
| `/comunicaciones/**` | admin, lider | M5 |
| `/novedades/**` | admin, guardia, lider | M7 |
| `/facturacion`, `/energia` | admin, lider | M9 |
| `/cheques` | tesoreria, lider | M6 |
| `/gastos` | admin, tesoreria, lider | M6 |
| `/tesoreria` | tesoreria, lider | M6 |
| `/reportes` | lider | M9 |
| `/personal/**` | lider | M7 |
| `/configuracion` | admin, guardia, lider | M8 |
| `(print)/recibos/[pagoId]` | admin, guardia, tesoreria, lider, socio (+ `datos_recibo`) | M1 |
| `(print)/cierre-caja/[cajaId]` | admin, guardia, tesoreria, lider | M2 |
| `(print)/libre-deuda/[clienteId]` | admin, guardia, lider (+ categoría) | M9 |
| `(print)/planilla-lecturas` | admin, lider | M9 |
| `(print)/reporte-mensual/[periodo]` | lider | M9 |
| `(print)/solicitudes/[id]/imprimir` | requireStaff | M7 |
| `(print)/novedades/[periodo]` | admin, guardia, lider | M7 |
| `(portal)/**` | socio | M5 |

### 7.3 `requireRol` por server action

| Archivo | Acción → roles |
|---|---|
| `cobranza.ts` (M1) | registrarCobro → admin, guardia, lider · cobrarDiario → guardia, lider · aplicarSaldoFavor → admin, guardia, lider |
| `cajas.ts` (M2) | abrirCaja → admin, guardia, lider · cerrarCaja → admin, guardia, tesoreria, lider · integrarCajaPorteria, reabrirCaja, rechazarReaperturaCaja → admin, tesoreria, lider · solicitarReaperturaCaja → admin, guardia, lider · anularCobro → admin, guardia, tesoreria, lider · registrarAjusteCaja, borrarAjusteCaja → tesoreria, lider |
| `porteria.ts` (M3) | registrarIngreso, marcarEgreso, buscarEmpleados → porteria, lider (`ROLES_INGRESOS`) · registrarCanon → porteria, lider (`ROLES_CANON`) · anularCanon → porteria, guardia, tesoreria, lider · guardarTarifaTransporte, cambiarActivoTarifaTransporte → lider |
| `clientes.ts` (M4) | crear/editar/cuotas/baja/reactivar/conceptos → admin, guardia, lider (+ categoría) · registrarDeudaAnterior → admin, lider · aplicarSaldoFavor → admin, guardia, lider · crearMedidor/editarMedidor → admin, lider |
| `documentos.ts` (M4) | subir, borrar → admin, guardia, lider (+ categoría) |
| `aprobaciones.ts` (M4) | aprobar, rechazar → lider |
| `circulares.ts` (M5) | crear, desactivar → admin, lider · confirmar, registrarVista → socio |
| `sanciones.ts` (M5) | emitirRegistro, responderRegistro, dejarSinEfectoMulta → admin, lider · presentarDescargo, marcarRegistroVisto → socio |
| `portal.ts`, `terminos.ts` (M5) | socio (publicarTerminos → lider) |
| `gastos.ts` (M6) | todas → admin, tesoreria, lider |
| `cheques.ts` (M6) | depositar, acreditar, entregar, vincular, rechazar → tesoreria, lider |
| `tesoreria.ts` (M6) | todas → tesoreria, lider |
| `solicitudes.ts` (M7) | crearSolicitud, enviarMensaje → admin, guardia, porteria, tesoreria, lider · avanzarSolicitud → admin, guardia, lider · avisarSobrePuesto → guardia, lider |
| `novedades.ts` (M7) | cargar, editar, borrar → admin, guardia, lider · revisar, aprobarTodas, anular → admin, lider |
| `personal.ts` (M7) | lider |
| `auth.ts` (M8) | público (login) |
| `usuarios.ts` (M8) | crearUsuario → lider, guardia · crearAccesoSocio → admin, lider · cambiarActivoUsuario, restablecerContrasena, editarUsuario → lider, admin, guardia (+ `rpc('autorizar_gestion_usuario')` con el cliente del usuario ANTES de cualquier `auth.admin.*`; el rol objetivo se lee de la base, §4.11) |
| `configuracion.ts` (M8) | actualizarConcepto → admin, guardia, lider · cambiarActivoConcepto, guardarConfiguracionGeneral, rubros → admin, lider · guardarCuotasQuinteros → guardia, lider |
| `mapa.ts` (M9) | asignarEspacios, editarEspacio → admin, lider · planoParaSelector → admin, guardia, porteria, tesoreria, lider |
| `facturacion.ts`, `energia.ts` (M9) | admin, lider |

---

## 8. Deprecaciones (limpieza en `0023_fase3_limpieza.sql` y código, cuando fase 3 esté estable)

| Qué | Reemplazo | Nota |
|---|---|---|
| `public.registrar_pago(...)` | `registrar_cobro` | Queda como wrapper (M1). Borrar la función y sus tipos. |
| `configuracion.precio_canon_camion`, `precio_canon_ambulante`, `precio_canon_quintero_dia` + trigger `proteger_precios_porteria` + `private.proteger_precios_porteria()` | `tarifas_transporte`, concepto AMB | G9: no existe el quintero por día. |
| `canon_camiones.tipo` + check `canon_camiones_tipo_check` | `tarifa_id` / `tarifa_nombre` | `registrar_canon` escribe `'camion'` mientras exista. |
| `cheques.banco`, `cheques.titular`, `cheques.es_tercero` | `recibido_de`, `cuit` | |
| Policy de storage "cobradores gestionan comprobantes" | 3 policies del Jefe (sube / lee lo referenciado / borra lo propio sin usar) | Ya reemplazada en 0022. |
| `src/components/clientes/nueva-sancion.tsx`, `TIPOS_REGISTRO` de `clientes/constantes.ts`, `ROLES_PORTERIA` | `RegistrosCliente`, `comunicaciones/constantes.ts`, `ROLES_CANON`/`ROLES_INGRESOS` | Se borran cuando nadie los importe. |
| `supabase/seed_fase2.sql` (modelo viejo: canon ambulante/quintero, Depósito Sur, consejo) | `seed.sql` actualizado | Fundación lo actualiza o lo marca obsoleto (§5.6). |
| `circular_recepciones` como único dato de "confirmó" | — | Si se pide distinguir "abrió" de "confirmó" en obligatorias, agregar `vista_en`. |
| Rol `consejo`: perfil `consejo@` (borrar el auth user), arrays `'consejo'` en policies y RPCs | — | El enum queda (hilos viejos, `en_consejo`). |
| Sello `camion`; `LABEL_TIPO_CANON`; `form-canon.tsx`, `borrar-canon.tsx`, `canon-camiones.tsx`; `guardarPreciosPorteria`; `CardPorteria` | tarifas | Los borran M2/M3/M8 en su entrega; verificar. |
| `tipo-cliente.ts` (`derivarTipoCliente`, "Depósitos") | `segmentos.ts` + `v_clientes_segmentos` | M4. |
| Criterio de mes de gastos `coalesce(fecha_pago, vencimiento, creado_en)` | `gastos.periodo` | M6/M9; revisar que no quede en otro lado. |
| `staff gestiona documentos` da a Tesorería y Admin acceso a TODO `{org}/…` (incluye clientes de Portería, novedades y empleados) | policies por carpeta | Endurecimiento opcional. |
| `v_deuda_clientes.periodo_mas_viejo` | `vencido_desde` | Solo si nadie lo usa. |
| `supabase/plano/plano_mercado.sql` hace DELETE+INSERT de espacios | upsert por (org, tipo, numero, x, y) | Re-correrlo ahora borra `propio`, `medidores.espacio_id`, `solicitudes.espacio_id`, `sanciones.espacio_id`, `canon_camiones.espacio_id`. |

---

## 9. Supuestos y preguntas para validar con el cliente

**Decisiones obligatorias ANTES de lanzar los módulos** (las pide el ingeniero al usuario; mientras tanto rige lo recomendado):

- **P1 — RESUELTA (§1.3 D-P1, opción A). Altas de ambulantes.** Si el Jefe da de alta un ambulante nuevo y pasa por el Líder, no le puede cobrar el primer día (G5 pide cobrar "en el acto"). *Recomendado (opción A, §4.7):* se aplican en el acto y el Líder las revisa después ("Aplicadas por el Jefe"); no tienen cargos recurrentes ni portal. Opción B: pasan por el Líder como todo.
- **P2 — RESUELTA (§1.3 D-P2: el Líder opera todo). ¿El Líder opera la plata?** La matriz del relevamiento le da ✓ en Cobrar, Caja, Cheques, Gastos y Tesorería. *Recomendado (§1.2-9):* las ve todas en solo lectura y no cobra, no abre ni cierra cajas, no paga ni entrega cheques; supervisa y ve las correcciones. Si tiene que operar cuando falta alguien, se le suman los roles en las RPC y se saca el modo lectura.

**Supuestos tomados (se pueden cambiar sin tocar el esquema)**
1. EXPP (puestos propios) cuesta lo mismo que EXME (1.080.000) y tiene el mismo 15 % de beneficio. Los 4 puestos propios tienen un cliente que los ocupa y paga EXPP.
2. El abono de energía (ABEN) es uno por cliente (no por medidor), sin beneficio, y se cobra antes del consumo (orden 78 vs 80).
3. La multa vence a los 10 días de emitida y se cobra después de todo lo demás (orden 97).
4. Tarifa "Estadía diaria": `cantidad` = días. El monto del canon sale siempre de la tarifa (Portería no tipea montos; las diferencias las ajusta Tesorería).
5. "Quintas" en la caja de portería = todo lo cobrado a clientes quinteros (aunque se impute a energía o multas); "Ambulantes" = todo lo cobrado a ambulantes.
6. El segmento "Puesteros" se define por tener EXME activo (no por tener un puesto asignado en el plano). "Todos" no incluye ambulantes.
7. ~~El Líder no cobra ni opera la plata (P2).~~ Resuelto: el Líder opera todo (§1.3).
8. CUIT del cheque obligatorio (11 dígitos); el dígito verificador solo avisa.
9. Un DNI = un usuario (no puede ser a la vez del equipo y socio).
10. Las horas de contrato se cargan por semana; si no hay, salen del horario. Vacaciones y licencias en días corridos.
11. "Solo socios" en circulares es un filtro sobre el público elegido (D2: "únicamente los socios").

**Preguntas**
3. (Resuelta: el público de circulares usa "Solo socios" como filtro, §1.2-8.)
4. Si un socio nuevo entra al portal, ¿le aparecen (y lo bloquean) todas las circulares obligatorias activas de su público? (hoy: sí, el público es dinámico).
5. Cheque "Se lo di a un proveedor" en el mismo cobro: ¿alcanza con que Tesorería lo vincule después al gasto (`vincular_cheque_gasto`, "Entregados sin gasto"), o quieren cargar el gasto en el mismo momento del cobro?
6. ¿Se permite pagar un gasto de la caja por transferencia? (hoy: no; de la caja solo sale efectivo).
7. ¿Hasta cuántos días atrás se puede imputar un gasto a una caja? (hoy: cualquier caja de administración no validada; la UI ofrece las 10 últimas).
8. Caja de portería: si el Jefe rinde a media tarde, Portería no puede cobrar más ese día hasta la reapertura. ¿Hay turnos que crucen la medianoche?
9. ¿El canon por transferencia necesita titular o foto del comprobante para conciliar?
10. ¿Hay impresora en la garita (ticket para el camionero)?
11. H2 "¿A quién viene?": ¿es obligatorio? ¿"Verdulero" es el quintero u otra figura?
12. ¿Cuáles son los 4 puestos propios (números)?
13. ¿Quién marca un puesto como propio: Administración y el Líder, o solo el Líder?
14. Medidores de quinteros: ¿existen? (ABEN se genera a todo cliente con medidor activo).
15. ¿Un quintero puede ser socio con acceso al portal? ¿Quién le da el acceso?
16. ¿El Jefe emite libre deuda, carga deuda anterior o registros (notificaciones) a sus quinteros?
17. Sectores del personal: ¿alcanza con Portería, Limpieza, Mantenimiento, Administración y Otro?
18. ¿Cuáles son los DNI reales de los usuarios (Franco, Marta, Jorge, Luis, Silvia) y qué hacemos con `consejo@` (desactivado)?
19. Tesorería sin Configuración: ¿crea rubros de gasto desde Gastos? (hoy: sí).
20. ¿Tesorería necesita ver todas las solicitudes o solo las que carga? (hoy: solo las suyas).
21. **J3** "ajustes de cuenta en la caja del día": ¿son faltantes/sobrantes del arqueo (lo implementado, §1.2-4) o correcciones a la cuenta corriente de un cliente hechas desde la caja?
22. **G5** "2 de 4 pagos": ¿se cuenta por plata (lo implementado: dos cuotas juntas = 2; un pago chico no suma una cuota) o por cantidad de pagos hechos?
23. **B1** "descargar el recibo directamente": ¿alcanza con "Descargar recibo" → Guardar como PDF del celular (lo implementado), o quieren un archivo PDF que baje solo? Lo segundo necesita sumar una librería de PDF (Fundación) y una ruta `(print)/recibos/[pagoId]/pdf` de M1.

---

## 10. Revisión adversarial (28/09): cambios aplicados y problemas descartados

Dos revisores encontraron 47 problemas. Todos se atendieron; ninguno se descartó entero. Lo que se resolvió
distinto de lo propuesto, y por qué:

| Problema | Resolución | Por qué distinto |
|---|---|---|
| Policies de novedades con `= any ((select f()))` (bloqueante) | Cast `::public.sector_personal[]` + regla §4.0-6. | — (verificado: la 0011 vieja falla con 42883 en una réplica local; la nueva aplica). |
| Vista `v_plano_publico` para el Jefe y Portería | Función `public.espacios_del_plano()` (security definer, stable). | Una vista sin `security_invoker` saltea la RLS y el linter de Supabase la marca como error (`security_definer_view`); con `security_invoker` no sirve porque habría que dejarles leer la tabla. La función da lo mismo sin ese agujero. |
| `v_avance_mes` "sobre cargos con origen ≠ diario" | Solo `generacion` y `energia`. | Con `≠ diario` una multa o la deuda anterior (RD) se repartirían en cuotas ("2 de 4" con una multa adentro). La cuenta mensual es la de recurrentes + ABEN + consumo. |
| Recibo en PDF generado en el servidor (B1) | Se mantiene imprimir → "Guardar como PDF" y va a §9-P23. | Requiere una dependencia nueva (regla §0.2-8) y la interpretación documentada del relevamiento es "recibo imprimible/guardar PDF". Si el cliente lo pide, se agrega sin cambiar la base. |
| Wrapper `registrar_pago` que acepte cheques sin CUIT | Una sola ventana de mantenimiento (0013…0021 + 0022 + deploy). | Aun con cheques sin CUIT, la app vieja rompe por Tesorería (cobro, abrir caja, generar período). La ventana resuelve todo junto. |
| `perfiles.desactivado_*` escrito por la server action | Lo escribe el trigger `proteger_perfiles`. | Así también queda rastro si alguien desactiva por PostgREST, y no hace falta abrir esas columnas a ningún grant. |
| Trigger de `ingresos_personal` | Dueño M3 (`proteger_ingreso`); el check `egreso ≥ ingreso` y el default de `registrado_por` van en 0011 (Fundación). | Los checks y defaults son transversales; la regla de negocio (quién corrige salidas) es de Portería. |
| `seed_fase2.sql` | Asignado a Fundación (§5.6); no se editó ahora. | Se hace después de aplicar 0012 (necesita el esquema nuevo) y hay otra sesión en el repo. |
| Componentes `toggle-group`, `radio-group`, `collapsible` | Agregados ya por Fundación (+ `toggle`, que usa `toggle-group`). | `radix-ui` ya estaba instalado: cero dependencias nuevas. |

Todo lo demás se aplicó como lo propusieron: bloqueos y orden (§4.0), idempotencia con candado (§4.0-5),
`aplicar_saldo_favor` con bloqueo + constraint trigger `imputaciones_tope`, `autorizar_gestion_usuario`,
`p_ref` en `emitir_registro`/`registrar_ajuste_caja`, `borrar_ajuste_caja` con motivo obligatorio,
`cobro_anulado` y columnas de rastro, `vincular_cheque_gasto`, "Solo socios" como filtro, `socio_leyo_en`,
`v_avance_mes`, `tiene_portal` con perfil activo, grants por columna (cargos, autoría, recepciones, configuración,
ingresos), storage de comprobantes, lectura de perfiles y espacios, borrado de adjuntos de novedades, índices,
`#variable_conflict`, `cheques_entregados` sin anulados, `registrar_canon` solo Portería, Tesorería que no abre
caja al pagar, textos de caja rendida, interfaces congeladas (§6.10), regla 7 extendida, renumeración de
archivos, paso 4b y prueba de humo por rol (§6.11), Líder en `/cobranza` en lectura, validar desde `/caja`,
pestañas de `/tesoreria`, DatosCheque de tres campos, tarjetas del Líder, criterios de aceptación faltantes,
sellos del portal, "En mano / Por transferencia", pregunta J3, ficha de quintero sin 404.

---

## 11. Orden de aplicación

### 11.1 Archivos (cada uno UNA transacción, en este orden)

| # | Archivo | Cuándo | Después |
|---|---|---|---|
| 1 | `supabase/migrations/0010_fase3_enums.sql` | Con autorización del usuario (días antes del deploy). | — |
| 2 | `supabase/migrations/0011_fase3_esquema.sql` | Enseguida. | — |
| 3 | `supabase/migrations/0012_fase3_rpcs.sql` | Enseguida. | Correr §11.2 (todo `true`); regenerar `src/lib/database.types.ts`; Fundación: seeds (§5.6). |
| 4 | Rama de prueba (paso 4b): 0010 → 0011 → 0012 → 0013…0021 → 0022 + semilla de prueba (1 puestero, 1 quintero, 1 ambulante, 1 socio con portal, empleados por sector) | Cuando los 9 módulos entregan. | §11.2, §11.3 y la prueba de humo §6.11 en verde. Si no hay branching de Supabase, una réplica local sirve (así se verificaron estas migraciones: Postgres 17 + esquemas `auth`/`storage` mínimos + 0001…0009). |
| 5 | `0013_fase3_cajas.sql`, `0014_fase3_cobranza.sql`, `0015_fase3_porteria.sql`, `0016_fase3_clientes.sql`, `0017_fase3_comunicaciones.sql`, `0018_fase3_tesoreria.sql`, `0019_fase3_personal.sql`, `0020_fase3_accesos.sql`, `0021_fase3_mapa.sql` | Ventana de mantenimiento (§0.3), en ese orden. | — |
| 6 | `supabase/migrations/0022_fase3_endurecimiento.sql` | Misma ventana, enseguida. | Correr §11.3 (todo `true`). |
| 7 | Deploy del código de fase 3 | Misma ventana, enseguida. | Prueba de humo §6.11 en producción con los DNIs demo. |
| — | `0023_fase3_limpieza.sql` | Cuando la fase 3 esté estable (§8). | — |

Estado verificado el 28/09 sobre una réplica local idéntica a la base viva (mismas columnas, policies, constraints,
grants, triggers, índices y funciones, comparados por hash): 0010 → 0011 → 0012 → 0022 aplican sin errores; con
0010–0012 la app de fase 2 genera, cobra, anula, cierra, carga canon, valida y lee el flujo igual que hoy.

### 11.2 Verificación después de 0010 + 0011 + 0012 (solo lectura)

```sql
-- Verificación post 0010 + 0011 + 0012 (solo lectura). Todas las filas tienen que dar ok = true.
with chequeos(chequeo, ok) as (
  values
  ('enums nuevos', (select count(*) = 12 from pg_type t where t.typnamespace = 'public'::regnamespace and t.typname in
     ('estado_cheque','tipo_concepto','tipo_mov_tesoreria','estado_solicitud','origen_solicitud','categoria_cliente',
      'moneda','cuenta_tesoreria','estado_registro','sector_personal','tipo_novedad','estado_novedad'))),
  ('valores de enums agregados', (select count(*) = 9 from pg_enum e join pg_type t on t.oid = e.enumtypid
     where (t.typname, e.enumlabel) in (('estado_cheque','entregado'),('tipo_concepto','diario'),('tipo_concepto','abono_energia'),
       ('tipo_concepto','eventual'),('tipo_mov_tesoreria','deposito'),('tipo_mov_tesoreria','extraccion'),
       ('tipo_mov_tesoreria','ingreso'),('estado_solicitud','con_jefe'),('origen_solicitud','tesoreria')))
     and exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname='tipo_mov_tesoreria' and e.enumlabel='egreso')),
  ('tablas nuevas con RLS', (select count(*) = 3 from pg_class c where c.relnamespace = 'public'::regnamespace
     and c.relname in ('tarifas_transporte','registro_mensajes','novedades_personal') and c.relrowsecurity)),
  ('columnas nuevas (82)', (select count(*) = 82 from information_schema.columns where table_schema = 'public' and (table_name, column_name) in (
     ('clientes','categoria'),('clientes','es_socio'),('conceptos','segmento'),('espacios','propio'),('medidores','espacio_id'),
     ('cargos','desde'),('cargos','hasta'),('cargos','lote_id'),('pagos','lote_id'),('pagos','linea'),
     ('cheques','cuit'),('cheques','recibido_de'),('cheques','puesto'),('cheques','proveedor'),('cheques','fecha_entregado'),
     ('cheques','entregado_por'),('cheques','entregado_en_cobro'),('cheques','gasto_id'),('cheques','rechazado_por'),
     ('cheques','rechazado_en'),('cheques','motivo_rechazo'),
     ('cajas','total_cobros'),('cajas','total_quintas'),('cajas','total_ambulantes'),('cajas','total_cheques_entregados'),
     ('cajas','total_ajustes'),('cajas','total_rendido_quintas'),('cajas','total_rendido_ambulantes'),('cajas','total_rendido_canon'),
     ('canon_camiones','numero'),('canon_camiones','tarifa_id'),('canon_camiones','tarifa_nombre'),('canon_camiones','unidad'),
     ('canon_camiones','precio_unitario'),('canon_camiones','patente'),('canon_camiones','destino'),('canon_camiones','destino_detalle'),
     ('canon_camiones','espacio_id'),('canon_camiones','ref'),('canon_camiones','anulado'),('canon_camiones','anulado_por'),
     ('canon_camiones','anulado_en'),('canon_camiones','motivo_anulacion'),
     ('gastos','periodo'),('gastos','origen_id'),('gastos','pagado_por'),('gastos','pagado_en'),('gastos','pago_revertido_por'),
     ('gastos','pago_revertido_en'),('gastos','pago_revertido_motivo'),
     ('movimientos_tesoreria','moneda'),('movimientos_tesoreria','cuenta'),('movimientos_tesoreria','cuenta_destino'),
     ('movimientos_tesoreria','grupo_id'),('movimientos_tesoreria','ref'),('saldos_iniciales','moneda'),('circulares','publico'),
     ('sanciones','numero'),('sanciones','espacio_id'),('sanciones','estado'),('sanciones','visto_en'),('sanciones','socio_leyo_en'),
     ('sanciones','ultimo_mensaje_en'),('sanciones','ref'),('sanciones','multa'),('sanciones','multa_vencimiento'),('sanciones','cargo_id'),
     ('sanciones','multa_sin_efecto_en'),('sanciones','multa_sin_efecto_por'),('sanciones','multa_sin_efecto_motivo'),
     ('solicitudes','espacio_id'),('solicitudes','elevada_por'),('solicitudes','elevada_en'),('solicitudes','resolucion_de'),
     ('empleados','sector'),('empleados','horas_semanales'),('perfiles','dni'),('perfiles','creado_por'),
     ('perfiles','desactivado_por'),('perfiles','desactivado_en'),('configuracion','cuotas_default_quintero'),
     ('cambios_pendientes','revisar_despues')))),
  ('vistas', (select count(*) = 3 from pg_views where schemaname = 'public' and viewname in ('v_clientes_segmentos','v_avance_mes','v_deuda_clientes'))),
  ('v_deuda_clientes con columnas nuevas', (select count(*) = 3 from information_schema.columns where table_schema='public' and table_name='v_deuda_clientes'
     and column_name in ('deuda_vencida','vencido_desde','proximo_vencimiento'))),
  ('catálogo de conceptos', (select count(*) = 14 and bool_and(activo) from public.conceptos)),
  ('EXME/EXPP/EXPQ/AMB/ABEN/MULT/BC', (select count(*) = 7 from public.conceptos where
     (codigo, tipo::text, precio, orden_imputacion) in (('EXME','recurrente',1080000,40),('EXPP','recurrente',1080000,45),
     ('EXPQ','recurrente',330000,30),('AMB','diario',15000,35),('ABEN','abono_energia',15000,78),('MULT','eventual',0,97),
     ('BC','canon_diario',0,100)))),
  ('tarifas de transporte', (select count(*) = 5 * (select count(*) from public.organizaciones) from public.tarifas_transporte)),
  ('RPC nuevas y cambiadas (29 firmas)', (select count(*) = 29 from pg_proc p where p.pronamespace = 'public'::regnamespace
     and p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' in (
     'registrar_cobro(p_cliente uuid, p_caja uuid, p_lineas jsonb, p_notas text, p_permitir_saldo_favor boolean, p_lote uuid)',
     'cobrar_diario(p_cliente uuid, p_caja uuid, p_dias integer, p_lineas jsonb, p_desde date, p_notas text, p_lote uuid)',
     'datos_recibo(p_pago uuid)', 'arqueo_caja(p_caja uuid)',
     'registrar_ajuste_caja(p_caja uuid, p_cuenta cuenta_tesoreria, p_monto numeric, p_motivo text, p_ref uuid)',
     'borrar_ajuste_caja(p_ajuste uuid, p_motivo text)',
     'validar_caja(p_caja uuid, p_observaciones text, p_efectivo_contado numeric)',
     'registrar_canon(p_tarifa uuid, p_cantidad integer, p_medio medio_pago, p_patente text, p_destino text, p_destino_detalle text, p_notas text, p_ref uuid)',
     'anular_canon(p_canon uuid, p_motivo text)', 'estado_caja_porteria()', 'resumen_canon(p_desde date, p_hasta date)',
     'siguiente_codigo_cliente()',
     'emitir_registro(p_cliente uuid, p_tipo tipo_sancion, p_titulo text, p_detalle text, p_fecha date, p_storage_path text, p_espacio uuid, p_multa numeric, p_multa_vencimiento date, p_ref uuid)',
     'dejar_sin_efecto_multa(p_registro uuid, p_motivo text)', 'marcar_registro_visto(p_registro uuid)',
     'pagar_gasto(p_gasto uuid, p_origen text, p_medio medio_pago, p_fecha date, p_caja uuid)',
     'revertir_pago_gasto(p_gasto uuid, p_motivo text)',
     'replicar_gastos_fijos(p_desde_periodo date, p_hasta_periodo date, p_items jsonb)',
     'entregar_cheque(p_cheque uuid, p_proveedor text, p_fecha date, p_gasto uuid)',
     'vincular_cheque_gasto(p_cheque uuid, p_gasto uuid)',
     'revisar_novedad(p_novedad uuid, p_aprobar boolean, p_motivo text)', 'aprobar_novedades(p_ids uuid[])',
     'anular_novedad(p_novedad uuid, p_motivo text)', 'resumen_novedades(p_periodo date)',
     'email_para_login(p_dni text)', 'guardar_cuotas_quinteros(p_cuotas integer)',
     'autorizar_gestion_usuario(p_user uuid, p_accion text)',
     'editar_espacio(p_espacio uuid, p_numero text, p_medio boolean, p_nota text, p_propio boolean)',
     'espacios_del_plano()'))),
  ('sin sobrecargas viejas (validar_caja, editar_espacio)', (select count(*) = 2 from pg_proc where pronamespace = 'public'::regnamespace
     and proname in ('validar_caja','editar_espacio'))),
  ('anon sin EXECUTE en RPC nuevas', (select not bool_or(has_function_privilege('anon', p.oid, 'execute')) from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.proname in ('registrar_cobro','cobrar_diario','datos_recibo','arqueo_caja',
     'registrar_ajuste_caja','borrar_ajuste_caja','validar_caja','registrar_canon','anular_canon','estado_caja_porteria','resumen_canon',
     'siguiente_codigo_cliente','emitir_registro','dejar_sin_efecto_multa','marcar_registro_visto','pagar_gasto','revertir_pago_gasto',
     'replicar_gastos_fijos','entregar_cheque','vincular_cheque_gasto','revisar_novedad','aprobar_novedades','anular_novedad',
     'resumen_novedades','email_para_login','guardar_cuotas_quinteros','autorizar_gestion_usuario','editar_espacio','espacios_del_plano'))),
  ('email_para_login solo service_role', (select not has_function_privilege('authenticated', 'public.email_para_login(text)', 'execute')
     and has_function_privilege('service_role', 'public.email_para_login(text)', 'execute'))),
  ('helpers privados de Fundación', (select count(*) = 11 from pg_proc where pronamespace = 'private'::regnamespace and proname in
     ('categorias_gestionables','cliente_de_porteria','puede_gestionar_cliente','carpeta_de_porteria','segmentos_cliente',
      'cliente_en_publico','tiene_portal_activo','sectores_novedades','puede_gestionar_rol','validar_espacio_misma_org','tg_imputaciones_tope'))),
  ('aplicar_saldo_favor bloquea al cliente', (select pg_get_functiondef('private.aplicar_saldo_favor(uuid)'::regprocedure) like '%from public.clientes where id = p_cliente for update%')),
  ('triggers nuevos', (select count(*) = 6 from pg_trigger where not tgisinternal and tgname in ('fijar_autor_registro','medidores_valida_espacio',
     'solicitudes_valida_espacio','canon_valida_espacio','sanciones_valida_espacio','imputaciones_tope'))),
  ('policies nuevas de 0011', (select count(*) = 14 from pg_policies where (tablename, policyname) in (
     ('tarifas_transporte','staff lee tarifas'),('tarifas_transporte','lider crea tarifas'),('tarifas_transporte','lider edita tarifas'),
     ('registro_mensajes','leer mensajes de registro'),('registro_mensajes','escribir mensajes de registro'),
     ('novedades_personal','leer novedades'),('novedades_personal','cargar novedades'),('novedades_personal','editar novedades pendientes'),
     ('novedades_personal','borrar novedades pendientes'),('perfiles','gestionar perfiles'),('perfiles','alta de perfiles'),
     ('objects','jefe sube adjuntos de novedades'),('objects','jefe lee adjuntos de novedades'),('objects','jefe borra sus adjuntos de novedades')))),
  ('perfiles sin policies viejas de escritura', (select count(*) = 0 from pg_policies where tablename = 'perfiles'
     and policyname in ('editar perfiles','insertar perfiles','borrar perfiles'))),
  ('DNIs demo y consejo desactivado', (select count(*) = 6 from public.perfiles where dni in ('20111111','20222222','20333333','20444444','20555555','20666666'))
     and not exists (select 1 from public.perfiles where rol = 'consejo' and activo))
)
select chequeo, ok from chequeos order by ok, chequeo;
```

### 11.3 Verificación después de 0022 (solo lectura)

```sql
-- Verificación post 0022 (solo lectura). Todas las filas tienen que dar ok = true.
with chequeos(chequeo, ok) as (
  values
  ('policies viejas borradas', (select count(*) = 0 from pg_policies where (tablename, policyname) in (
     ('objects','cobradores gestionan comprobantes'),('canon_camiones','cargar canon'),('canon_camiones','borrar canon con caja abierta'),
     ('sanciones','insertar sanciones'),('sanciones','editar sanciones'),('sanciones','borrar sanciones')))),
  ('policies nuevas de storage', (select count(*) = 5 from pg_policies where tablename = 'objects' and policyname in (
     'jefe sube comprobantes','jefe lee comprobantes de sus cobros','jefe borra comprobantes sin usar',
     'jefe gestiona documentos de sus clientes','socios leen circulares'))),
  ('espacios: sin guardia ni porteria', (select qual not like '%guardia%' and qual not like '%porteria%' from pg_policies
     where tablename = 'espacios' and policyname = 'leer espacios')),
  ('perfiles: equipo sin socios para jefe/porteria/tesoreria', (select qual like '%<> ''socio''%' from pg_policies
     where tablename = 'perfiles' and policyname = 'ver perfil propio o staff')),
  ('cargos: alta directa sin estado ni pagos', (select not has_column_privilege('authenticated','public.cargos','estado','INSERT')
     and not has_column_privilege('authenticated','public.cargos','monto_pagado','INSERT')
     and not has_column_privilege('authenticated','public.cargos','lote_id','INSERT')
     and has_column_privilege('authenticated','public.cargos','monto','INSERT')
     and not has_table_privilege('authenticated','public.cargos','UPDATE'))),
  ('autoría no falsificable', (select not has_column_privilege('authenticated','public.gastos','creado_por','INSERT')
     and not has_column_privilege('authenticated','public.movimientos_tesoreria','creado_por','INSERT')
     and not has_column_privilege('authenticated','public.documentos_cliente','subido_por','INSERT')
     and not has_column_privilege('authenticated','public.perfiles','creado_por','INSERT')
     and not has_column_privilege('authenticated','public.ingresos_personal','registrado_por','INSERT')
     and not has_column_privilege('authenticated','public.ingresos_personal','ingreso_en','INSERT')
     and not has_column_privilege('authenticated','public.circular_recepciones','recibida_en','INSERT'))),
  ('rastro no editable', (select not has_column_privilege('authenticated','public.cheques','motivo_rechazo','UPDATE')
     and not has_column_privilege('authenticated','public.gastos','pago_revertido_motivo','UPDATE')
     and not has_column_privilege('authenticated','public.perfiles','desactivado_por','UPDATE'))),
  ('configuración: cuotas solo por RPC', (select not has_column_privilege('authenticated','public.configuracion','cuotas_default_quintero','UPDATE')
     and has_column_privilege('authenticated','public.configuracion','dia_vencimiento','UPDATE'))),
  ('solo RPC: pagos, cheques, canon, sanciones', (select not has_table_privilege('authenticated','public.canon_camiones','INSERT')
     and not has_table_privilege('authenticated','public.sanciones','INSERT')
     and not has_table_privilege('authenticated','public.cheques','INSERT')
     and not has_column_privilege('authenticated','public.cheques','monto','UPDATE'))),
  ('saldos iniciales por moneda', (select count(*) = 1 from pg_constraint where conname = 'saldos_iniciales_org_medio_moneda_key')
     and not exists (select 1 from pg_constraint where conname = 'saldos_iniciales_org_id_medio_key')),
  ('gastos: de la caja solo efectivo', (select count(*) = 1 from pg_constraint where conname = 'gastos_caja_efectivo'))
)
select chequeo, ok from chequeos order by ok, chequeo;
```

Además, a mano: `select * from public.v_avance_mes limit 1;` y `select * from public.espacios_del_plano() limit 5;`
logueado como el Jefe (vía la app) devuelven datos sin error; un `select` directo a `espacios` del Jefe devuelve 0 filas.
