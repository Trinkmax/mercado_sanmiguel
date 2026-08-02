# PRODUCT.md — Sistema de Gestión · Mercado San Miguel

## Qué es

Sistema de gestión integral para la **Cooperativa del Mercado San Miguel** (Malagueño, Córdoba, Argentina). Reemplaza un proceso 100 % manual (papel + Excel + suma a mano) de facturación, cobranza, cajas, tesorería, gastos y reportes. No hay un dueño: es una cooperativa cuyos socios son los dueños de los puestos.

**Mecanismo único en una frase:** el dato entra una sola vez —el cobro en el puesto, la lectura del medidor, el gasto— y el sistema hace solo todo lo demás: imputación, arqueo, flujo de caja y reportes.

## Quiénes lo usan (escena real)

| Rol | Persona | Escena | Dispositivo |
|---|---|---|---|
| `admin` (Administración) | 2 personas, adultas, la tecnología no es su fuerte | Caminan el mercado cobrando puesto por puesto; luz de galpón, apuro, ruido | Tablet (en mano) + PC |
| `guardia` (Jefe de guardia) | 1 persona | Cobra quinteros en las playas y el canon de camiones en portería | Tablet |
| `tesoreria` (Tesorera) | 1 persona | Al día siguiente controla cajas contra el banco, registra impuestos/comisiones | PC + tablet |
| `consejo` (Consejo / Franco) | Dirigencia | Mira reportería: cuánto se estimó, cuánto entró, cuánto falta, cuánto se gastó | PC / celular |
| `socio` (Puestero) | ~cientos, adultos | Entra a su portal a ver cuánto debe y qué pagó; verde = pagado, rojo = pendiente | Celular |

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
- **Vencimiento el 30** (configurable). La expensa tiene **15 % de descuento por pago en término**; si no paga a término pierde el beneficio y la diferencia se arrastra al mes siguiente.
- **Orden de imputación configurable** (prioridad de cobro de un pago parcial): el default carga el **orden oficial de la lista escrita** ("por prioridad de cobros"): EXPC → EXCO → EXPQ → EXPP → EXPL → EXPG → EXPE → ENER (+ RD al final, ver supuestos). Primero la deuda más vieja; dentro del mes, este ranking. Editable por concepto en Configuración → Precios, sin tocar código. La exclusión por cliente existe en dos niveles: un cliente solo genera los conceptos que tiene asignados en su carpeta, y cualquier concepto asignado se puede desactivar puntualmente (switch en la pestaña Conceptos: deja de generarse desde el mes siguiente).
- **Cuotas**: el total del mes puede pagarse en N cobros durante el mes (configurable por cliente). Algunos pagan todo de una.

### Cobranza y cajas

- Medios de pago: **efectivo, transferencia, cheque**.
- **Cheques**: registro completo — a nombre de quién, quién lo entregó (propio o de tercero), fecha de recepción, fecha en que se puede depositar, depósito y acreditación (~72 h). Estados: en cartera → listo para depositar → depositado → acreditado / rechazado.
- **Caja del día (administración)**: todos los cobros del día. Al cerrar, el sistema da el **arqueo automático**: "debés tener X en efectivo, Y en transferencias, Z en cheques".
- **Caja del guardia**: quinteros + canon camiones, mismo mecanismo; su arqueo se rinde a administración.
- **Tesorería**: al día siguiente valida cada caja contra el banco (traspaso de responsabilidad con OK explícito), registra **impuestos y comisiones bancarias**, y ve el **flujo de caja** total (plata real de la cooperativa por medio). *Solo tesorería y consejo ven esto; administración no.*
- **Recibo / libre deuda**: al completar todos los conceptos del mes, se emite comprobante imprimible (sin validez fiscal, no va a ARCA).

### Ficha del cliente (eje del sistema)

Carpeta digital equivalente a la carpeta física numerada:
- Datos: razón social / persona física, CUIT/DNI, teléfono, email.
- **Ítems asociados** (qué paga y cuánto de cada concepto).
- **Documentación adjunta**: habilitación municipal, SENASA, apto eléctrico… (foto/PDF, guardado seguro, nunca se pierde).
- **Sanciones y notificaciones** con su documento.
- **Medidores de luz** asociados (con número).

### Energía

Un electricista recorre +100 medidores una vez al mes **con planilla en papel**. El sistema: imprime la planilla (número de medidor + lectura anterior + espacio en blanco), y ofrece **carga rápida** en pantalla (solo tipear la lectura actual; el sistema calcula kWh × precio). Precio kWh configurable (hoy ~$600).

### Gastos

Fijos y variables por rubro (30 códigos: AGUA, ALQ, SJ, GINT…). Carga manual estilo planilla: vencimiento, monto, pagado/pendiente, medio de pago, factura adjunta. Los chicos los paga administración desde caja; los grandes, tesorería.

### Reportería

- **Ingresos estimados vs. cobrado** por concepto, con barra de progreso (lo estimado se sabe el día 1 porque es fijo).
- **Gastos del mes** por rubro.
- **Reporte mensual para la contadora** (no entra al sistema): cuánto ingresó y cuánto se gastó, por concepto/rubro, exportable a PDF.

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
