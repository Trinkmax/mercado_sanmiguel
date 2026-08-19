# Sistema de Gestión — Cooperativa Mercado San Miguel

Gestión integral de la cooperativa: clientes, facturación mensual automática,
cobranza con imputación por prioridad, cheques, cajas con arqueo automático,
tesorería, energía, gastos, reportería y portal del socio.

El principio rector: **el dato entra una sola vez** — el cobro en el puesto, la
lectura del medidor, el gasto — y el sistema imputa, arquea y reporta solo.

## Arrancar

```bash
pnpm install
pnpm dev
```

Abrí http://localhost:3000. Las credenciales de Supabase ya están en `.env.local`.

## Usuarios de demo

Contraseña de todos: `SanMiguel2026`

| Email | Rol | Qué ve |
|---|---|---|
| `lider@sanmiguel.coop` | Líder de Procesos (Franco) | Aprobaciones, personal, solicitudes ↔ consejo, reportes, configuración; aplica cambios directo |
| `admin@sanmiguel.coop` | Administración | Cobranza, clientes (propone cambios), caja mayor + rendiciones de portería, cheques, energía, gastos, facturación, solicitudes, circulares. **Sin reportes** |
| `guardia@sanmiguel.coop` | Jefe de Portería | Cobro a quinteros, canon diario (camiones / ambulantes / quinteros), su caja, ingresos de personal |
| `porteria@sanmiguel.coop` | Portería | Registro de ingreso de personal con firma digital, solicitudes/informes. No cobra |
| `tesorera@sanmiguel.coop` | Tesorería | Validación definitiva de cajas, conciliación de transferencias y comprobantes, flujo de fondos, cheques + todo lo de admin |
| `consejo@sanmiguel.coop` | Consejo Directivo | Reportería y resolución de solicitudes (solo lectura del resto) |
| `socio@sanmiguel.coop` | Socio (puestero) | Su portal: términos y condiciones, circulares (recepción obligatoria), estado de cuenta, pagos, documentos, solicitudes |

Datos demo cargados: **julio 2026** generado y cobrado en parte (los clientes 1, 2
y 8 deben; hay una caja del 31/07 cerrada sin validar y un cheque diferido en
cartera) y **agosto 2026** recién generado, todo pendiente, vence el 30/08.

Datos demo de la fase 2: una rendición de portería del 18/08 esperando que
administración la integre, un cambio de cliente esperando aprobación del Líder,
tres solicitudes en distintos estados (una en el Consejo, una asignada a
Administración, un informe de portería nuevo), una circular obligatoria sin
confirmar y los términos y condiciones v1 sin aceptar por el socio.

## Recorrido sugerido para la demo con el cliente

1. Entrá como **admin** → Inicio: la cobranza del mes con barras verde/rojo.
2. **Cobrar** → elegí "Verdulería Don Pedro" → registrá un cobro (probá "Cobrar
   todo" o la cuota sugerida) → mirá la imputación automática → imprimí el recibo.
3. **Caja del día** → cerrá la caja → el arqueo te dice cuánto tenés que tener.
4. Entrá como **tesorera** → validá la caja del 31/07 pendiente → mirá el flujo de caja.
5. **Energía** → cargá lecturas (solo tipeás la actual) → imprimí la planilla del electricista.
6. **Reportes** → reporte mensual para la contadora (PDF por impresión).
7. Entrá como **socio** → acepta los términos, confirma la circular, ve su estado verde/rojo, su saldo a favor si lo tiene, y escribe una solicitud.
8. **Fase 2** — entrá como **admin** → Caja del día: recibí la rendición de portería e integrala a la caja mayor; Clientes: editá un teléfono → "Enviar a aprobación". Entrá como **Líder de Procesos** → Aprobaciones: aprobá el cambio; Solicitudes: derivá al Consejo / asigná a Administración; Personal: cargá un empleado con horarios. Entrá como **Portería** → registrá un ingreso con firma. **Tesorería** → conciliá una transferencia con su comprobante y validá la caja (arrastra la de portería). **Reportes** → exportá el balance a Excel.

## Arquitectura

- **Next.js 16** (App Router, Server Components, Server Actions, `proxy.ts`) +
  Tailwind v4 + shadcn/ui. Tipografías: Archivo (Omnibus-Type) y Big Shoulders
  Stencil para los códigos de concepto.
- **Supabase**: Postgres + Auth + Storage. **RLS estricta en todas las tablas**;
  el socio solo ve lo suyo; tesorería es invisible para administración.
- **Multitenant**: todo cuelga de `organizaciones` (`org_id`) — listo para
  venderle el mismo sistema a otro mercado.
- **La lógica de negocio vive en Postgres** (funciones `security definer` con
  chequeo de rol): generación mensual idempotente, imputación de pagos por
  prioridad con descuento por pronto pago, arqueo de caja, validación de
  tesorería, flujo de caja y reportería. El frontend nunca la reimplementa.
- Migraciones en `supabase/migrations/` (0007–0008 = fase 2), seed reproducible en `supabase/seed.sql` + `supabase/seed_fase2.sql`.

## Configuración pendiente para producción

- `SUPABASE_SECRET_KEY` en `.env.local` (solo servidor) para crear accesos de
  socios desde Configuración → Usuarios.
- Revisar los **supuestos declarados** al final de `PRODUCT.md` con Franco
  (precios reales, regla exacta del descuento, orden de imputación).
- Cargar los clientes reales y los saldos iniciales de tesorería.

## Documentos

- `PRODUCT.md` — verdad del producto y supuestos.
- `DESIGN.md` — sistema visual (mundo "etiqueta de cajón de mercado").
- `docs/GUIA-MODULOS.md` — contrato técnico para extender el sistema.
- `docs/FASE2-CONTRATO.md` — lo nuevo de la fase 2 (roles, tablas, RPCs, regla de aprobación, rutas).
- `docs/reunion-2026-07-24.md` — transcripción de la reunión de requerimientos.
- `docs/codigos-conceptos.md` — códigos oficiales de la cooperativa.
