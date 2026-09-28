# PRODUCT.md — Sistema de Gestión · Mercado San Miguel

## Qué es

Sistema de gestión integral para la **Cooperativa del Mercado San Miguel** (Malagueño, Córdoba, Argentina). Reemplaza un proceso 100 % manual (papel + Excel + suma a mano) de facturación, cobranza, cajas, tesorería, gastos y reportes. No hay un dueño: es una cooperativa cuyos socios son los dueños de los puestos.

**Mecanismo único en una frase:** el dato entra una sola vez —el cobro en el puesto, la lectura del medidor, el gasto— y el sistema hace solo todo lo demás: imputación, arqueo, flujo de caja y reportes.

## Quiénes lo usan (escena real)

| Rol | Persona | Escena | Dispositivo |
|---|---|---|---|
| `lider` (Líder de Procesos) | Franco y quien lo reemplace | Aprueba cada alta/baja/modificación de clientes y conceptos, configura el personal y sus horarios, mira los reportes, revisa las solicitudes y las deriva al Consejo, y le asigna a Administración lo que el Consejo resolvió | PC / tablet |
| `admin` (Administración) | 2 personas, adultas, la tecnología no es su fuerte | Caminan el mercado cobrando puesto por puesto; luz de galpón, apuro, ruido. Reciben la rendición de portería y la integran a la caja mayor. Cargan al sistema las solicitudes que llegan en papel y ejecutan lo que el Consejo resolvió. **No ven Reportes.** | Tablet (en mano) + PC |
| `guardia` (Jefe de Portería) | 1 persona | El único de portería que cobra: quinteros en las playas y el canon diario (camiones, ambulantes, quinteros) en la garita. Rinde su caja a administración | Tablet |
| `porteria` (Portería) | personal de puerta | Registra el ingreso del personal (DNI, nombre, apellido, firma digital) y genera solicitudes/informes en papel para administración. No cobra | Tablet en la garita |
| `tesoreria` (Tesorera) | 1 persona | Al día siguiente valida definitivamente las cajas (arqueo), concilia transferencias contra el banco con la foto del comprobante, valida comprobantes de gastos, registra flujo de fondos, débito fiscal y comisiones; mueve los cheques | PC + tablet |
| `consejo` (Consejo Directivo) | Dirigencia | Mira reportería y resuelve las solicitudes que el Líder le deriva | PC / celular |
| `socio` (Puestero) | ~cientos, adultos | Entra a su portal a ver cuánto debe y qué pagó (verde/rojo), acepta los términos y condiciones, confirma la recepción de circulares y conversa con administración por solicitudes | Celular |

> Los valores del enum `guardia` y `consejo` se mantuvieron en la base para no
> romper RPC/RLS; lo que cambió es la etiqueta visible y las responsabilidades.

**Principio rector (pedido explícito del cliente): facilitar, no complejizar.** Usuarios mayores, con fricción tecnológica. Tipografía grande, targets táctiles grandes, un camino por pantalla, cero jerga.

## Modelo de negocio

### Ingresos (códigos oficiales de la cooperativa)

| Código | Concepto | Cómo se cobra |
|---|---|---|
| EXPC | Alquiler Cocheras | Mensual por cantidad |
| EXCO | Contribución Puestos | Mensual por cantidad |
| EXPQ | Expensas Quinteros | Mensual (canon diario $15.000 ≈ $300.000/quinta/mes; cobra el **guardia**) |
| EXPP | Expensas Puestos | Mensual por cantidad (½, 1, 1½, 2, 3, 4 expensas) |
| EXPL | Expensas Locales | Mensual por cantidad |
| EXPG | Expensas Galpón | Mensual por cantidad |
| EXPE | Expensas Contéiner | Mensual por cantidad |
| ENER | Recupero Energía | kWh consumido × precio kWh (lecturas de +100 medidores) |
| EXME | Expensas Cobradas | Código contable de reporte |
| BC | Canon Camiones | Diario en portería, lo rinde el guardia |
| RD | Reconocimiento de Deuda | Deuda arrastrada |

- **Precios configurables** (cambian entre meses). El cargo generado congela el precio del momento.
- **Generación mensual automática**: a principio de mes se generan los cargos de cada cliente según sus ítems (ej.: puesto 1½ + galpón 1 + cocheras 2). Sin modificaciones durante el mes: los cambios de ítems rigen desde el mes siguiente.
- **Vencimiento el 30** (configurable). La expensa tiene un **beneficio del 15 % por pago en término** (el cliente pidió llamarlo *beneficio*, no *descuento*); si no paga a término lo pierde por mora y debe el importe completo. El sistema avisa en pantalla (cobranza, ficha, portal) cuánto se ahorra pagando a tiempo y cuándo ya se perdió.
- **Orden de imputación configurable** (prioridad de cobro de un pago parcial): el default carga el **orden oficial de la lista escrita** ("por prioridad de cobros"): EXPC → EXCO → EXPQ → EXPP → EXPL → EXPG → EXPE → ENER (+ RD al final, ver supuestos). Primero la deuda más vieja; dentro del mes, este ranking. Editable por concepto en Configuración → Precios, sin tocar código. La exclusión por cliente existe en dos niveles: un cliente solo genera los conceptos que tiene asignados en su carpeta, y cualquier concepto asignado se puede desactivar puntualmente (switch en la pestaña Conceptos: deja de generarse desde el mes siguiente).
- **Cuotas / frecuencia**: el total del mes puede pagarse en 1, 2, 3 o 4 veces (quincenal, cada 10 días, semanal) u otra cantidad, configurable por cliente. Las cantidades de cada concepto aceptan **cuartos** (¼ · ½ · ¾ · 1¼…).
- **Saldo a favor**: si un socio paga más de lo que debe (o adelanta), el sobrante queda como saldo a favor y se aplica solo a los próximos cargos. Se ve en la ficha, en cobranza y en el portal.

### Cobranza y cajas

- Medios de pago: **efectivo, transferencia, cheque**.
- **Cheques**: registro completo — a nombre de quién, quién lo entregó (propio o de tercero), fecha de recepción, fecha en que se puede depositar, depósito y acreditación (~72 h). Estados: en cartera → listo para depositar → depositado → acreditado / rechazado.
- **Caja del día (administración)**: todos los cobros del día. Al cerrar, el sistema da el **arqueo automático**: "debés tener X en efectivo, Y en transferencias, Z en cheques".
- **Caja del guardia**: quinteros + canon camiones, mismo mecanismo; su arqueo se rinde a administración.
- **Transferencias**: el cobro por transferencia registra a nombre de quién está la cuenta y la **foto del comprobante** (desde la tablet). Tesorería las **concilia** contra el banco una por una.
- **Flujo de cierre de caja** (pedido del cliente): Portería rinde su caja (la cierra con arqueo) → Administración la **recibe e integra a la caja mayor** (su arqueo del día incluye lo rendido) → Tesorería valida y hace el **cierre definitivo** (validar la caja de administración arrastra las de portería que integró). Cada paso queda en la bitácora de la caja.
- **Reapertura**: ante un error de cierre, el Jefe de Portería **pide la reapertura** con motivo y Administración la autoriza (o la rechaza); Administración reabre su propia caja mientras tesorería no la haya validado. Todo queda registrado.
- **Canon diario en portería**: camiones, ambulantes y quinteros por día, con formulario de dos campos (fecha y monto) y precio por tipo configurado por el Líder.
- **Tesorería**: al día siguiente valida cada caja contra el banco (traspaso de responsabilidad con OK explícito), concilia transferencias y comprobantes de gastos, registra **impuestos, débito fiscal y comisiones bancarias**, y ve el **flujo de fondos** total (plata real de la cooperativa por medio). *Solo tesorería, consejo y líder ven esto; administración no.*
- **Recibo / libre deuda**: al completar todos los conceptos del mes, se emite comprobante imprimible (sin validez fiscal, no va a ARCA).

### Ficha del cliente (eje del sistema)

Carpeta digital equivalente a la carpeta física numerada:
- Datos: razón social / persona física, CUIT/DNI, teléfono, email.
- **Ítems asociados** (qué paga y cuánto de cada concepto).
- **Documentación adjunta**: habilitación municipal, SENASA, apto eléctrico… (foto/PDF, guardado seguro, nunca se pierde).
- **Registros documentales**: notificaciones, sanciones y apercibimientos con su documento; y las circulares (con confirmación de recepción).
- **Medidores de luz** asociados (con número).
- **Apodo** del puestero (cómo le dicen en el mercado), visible en el mapa debajo del número de puesto.
- **Aprobación obligatoria**: toda alta, baja o modificación de un cliente o de sus conceptos (y de los conceptos del catálogo) que proponga Administración queda *esperando aprobación* del Líder de Procesos; nada se aplica hasta que la apruebe. El Líder aplica directo.

### Energía

Un electricista recorre +100 medidores una vez al mes **con planilla en papel**. El sistema: imprime la planilla (número de medidor + lectura anterior + espacio en blanco), y ofrece **carga rápida** en pantalla (solo tipear la lectura actual; el sistema calcula kWh × precio). Precio kWh configurable (hoy ~$600).

### Gastos

Fijos y variables por rubro (30 códigos: AGUA, ALQ, SJ, GINT…). Carga manual estilo planilla: vencimiento, monto, pagado/pendiente, medio de pago, factura adjunta. Los chicos los paga administración desde caja; los grandes, tesorería.

### Reportería

- **Ingresos estimados vs. cobrado** por concepto, con barra de progreso (lo estimado se sabe el día 1 porque es fijo).
- **Gastos del mes** por rubro.
- **Reporte mensual para la contadora** (no entra al sistema): cuánto ingresó y cuánto se gastó, por concepto/rubro, exportable a PDF.

### Solicitudes (ex "Peticiones"), circulares y términos

- **Solicitudes**: canal bidireccional de mensajería entre socios, Administración, el Líder de Procesos y el Consejo. Pueden o no asociarse a un puesto. Tipos: solicitud, informe, reclamo, consulta. Orígenes: portal (socio), portería (se genera y se imprime para derivar a Administración), administración, líder. Estados: nueva → en revisión (Líder) → en el Consejo → resuelta → asignada a Administración → ejecutada (o rechazada / cerrada). Cada cambio de estado queda como mensaje del hilo.
- **Circulares**: comunicación a todos los socios con **recepción obligatoria** en el portal (el portal se bloquea hasta confirmar). Administración y el Líder ven quién confirmó.
- **Términos y condiciones** del portal, versionados: cada socio debe aceptar la versión vigente antes de entrar.

### Personal y portería

- **Personal** (Líder): empleados con contrato laboral (tipo, fechas, archivo), franjas horarias y horarios de trabajo por día.
- **Ingreso de personal** (Portería): DNI (con autocompletado desde el padrón y lectura del código del DNI si el dispositivo lo soporta), nombre, apellido y **firma digital** en pantalla; marca si entró fuera de horario; salida opcional.

### Mapa interactivo

- Apodo debajo del número de puesto; **drag & drop** (admin / líder) para reubicar puestos en el plano, con la posición guardada.

### Exportación

- Todos los datasets y el **balance mensual** se exportan a **Excel (.xlsx)** (botón "Exportar a Excel" en cada módulo y en Reportes).
- **Impresión directa**: con la opción activada, el recibo abre el diálogo de impresión apenas se emite; con Chrome en modo `--kiosk-printing` sale directo a la impresora del mostrador.

## Arquitectura

- **Multitenant desde el día 1**: tabla `organizaciones`; todo dato de negocio cuelga de `org_id`. Hoy una sola cooperativa; mañana el mismo producto se vende a otros mercados.
- **Stack**: Next.js 16 (App Router, Server Components, Server Actions), Supabase (Postgres + Auth + Storage + RLS), Tailwind v4, shadcn/ui.
- **Seguridad**: RLS en todas las tablas; roles vía tabla de perfiles con funciones `security definer` en esquema privado; el socio solo ve lo suyo; tesorería es invisible para administración.
- **Idioma**: español rioplatense. Moneda ARS. Fechas es-AR.

## Fuera de alcance del MVP (etapa 2 acordada)

- Barrera de entrada, registro de personal (Face ID / check-in), OCR de planillas con el celular, pagos online, integración bancaria.

## Supuestos declarados (a validar con Franco)

0. **Dos preguntas clave sobre el orden de imputación:**
   a) *¿Cuál manda?* En la reunión Franco dijo de palabra "cochera, galpón y por último la expensa" (y en otro momento "cochera, contenedor, expensa"), pero la lista escrita de códigos —encabezada "por prioridad de cobros"— pone EXPP cuarta y el galpón sexto. El sistema carga la lista escrita como default; se reordena en dos toques desde Configuración cuando Franco confirme.
   b) *¿La intención del "expensa última" es maximizar recupero?* Dejar el saldo impago parado sobre la expensa hace que el socio pierda el 15 % de descuento (bueno para la caja, malo para el socio). Confirmar explícitamente cuál de las dos lecturas quiere, porque es la clase de detalle que después genera reclamos de puesteros.
   c) *RD (Reconocimiento de Deuda) no figura en la lista de prioridad.* Como la imputación cubre primero la deuda más vieja, un RD asignado a un período viejo cobra naturalmente antes; dentro de un mismo período quedó al final del ranking (95). Confirmar posición. BC (canon camiones) no participa: es cobro de portería sin cliente.

1. Números de la reunión normalizados: expensa $1.058.000 nominal → $920.000 con 15 % pronto pago (la transcripción dice "1,53/1,58" con audio entrecortado); kWh $600; canon quinta $15.000/día ≈ $300.000/mes; canon camión monto fijo configurable.
2. La imputación automática cubre deuda más vieja primero y, dentro del mismo período, el orden de prioridad configurado.
3. El descuento de la expensa aplica si el cargo queda saldado antes del vencimiento del período.
4. Los accesos de socios los crea administración (email + contraseña); no hay autorregistro.
5. Cambios de precios rigen para generaciones futuras, nunca retroactivos.

### Supuestos de la fase 2 (revisión de agosto 2026, a validar con Franco)

6. **Roles**: el Líder de Procesos es `lider` (Franco); el Consejo sigue existiendo como rol (`consejo`, solo lectura + resoluciones). `guardia` pasó a llamarse *Jefe de Portería* (único que cobra) y se agregó `porteria` (no cobra).
7. **Reportes**: ocultos para Administración; los ven Líder, Consejo y Tesorería (se interpretó "exclusivo" como "oculto para Administración"; si Tesorería tampoco debe verlos, es un cambio de una línea en `navegacion.ts` y `reportes/page.tsx`).
8. **Aprobación**: cubre clientes (alta/baja/modificación de datos, cuotas, apodo), sus conceptos (alta/cantidad/baja) y el catálogo de conceptos (precio, beneficio, orden, activo, incluido el precio del kWh). Medidores, documentos y registros documentales no pasan por aprobación.
9. **Saldo a favor**: nunca se aplica contra cargos futuros no generados; se aplica solo al generar el período o al registrar una lectura. Un pago anulado retira el crédito que había dejado.
10. **Canon diario**: códigos de reporte `BA` (ambulantes) y `BQ` (quinteros por día) son inventados para el reporte; los oficiales los define la cooperativa. El canon se imputa a la caja abierta del Jefe de Portería aunque la fecha cargada sea otra.
11. **"Integración de lectura de…"** (texto incompleto en la revisión) se interpretó como lectura del código del DNI en portería (BarcodeDetector del navegador, sin hardware extra). **"Ajuste de métricas según … independientes"** no se pudo interpretar; queda para la próxima reunión.
12. **Driver de impresión directa** = `window.print()` automático + Chrome `--kiosk-printing` (no hay driver nativo desde una app web). Si hace falta impresora térmica de tickets, es etapa 3.
