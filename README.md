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
| `admin@sanmiguel.coop` | Administración | Cobranza, clientes, caja, cheques, energía, gastos, facturación, reportes |
| `guardia@sanmiguel.coop` | Jefe de guardia | Cobro a quinteros, canon de camiones, su caja |
| `tesorera@sanmiguel.coop` | Tesorería | Validación de cajas, movimientos bancarios, flujo de caja + todo lo de admin |
| `consejo@sanmiguel.coop` | Consejo (Franco) | Reportería, clientes, configuración (solo lectura de cajas) |
| `socio@sanmiguel.coop` | Socio (puestero) | Su portal: estado de cuenta, pagos, documentos, notificaciones |

Datos demo cargados: **julio 2026** generado y cobrado en parte (los clientes 1, 2
y 8 deben; hay una caja del 31/07 cerrada sin validar y un cheque diferido en
cartera) y **agosto 2026** recién generado, todo pendiente, vence el 30/08.

## Recorrido sugerido para la demo con el cliente

1. Entrá como **admin** → Inicio: la cobranza del mes con barras verde/rojo.
2. **Cobrar** → elegí "Verdulería Don Pedro" → registrá un cobro (probá "Cobrar
   todo" o la cuota sugerida) → mirá la imputación automática → imprimí el recibo.
3. **Caja del día** → cerrá la caja → el arqueo te dice cuánto tenés que tener.
4. Entrá como **tesorera** → validá la caja del 31/07 pendiente → mirá el flujo de caja.
5. **Energía** → cargá lecturas (solo tipeás la actual) → imprimí la planilla del electricista.
6. **Reportes** → reporte mensual para la contadora (PDF por impresión).
7. Entrá como **socio** → el puestero ve su estado verde/rojo y sube documentación.

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
- Migraciones en `supabase/migrations/`, seed reproducible en `supabase/seed.sql`.

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
- `docs/reunion-2026-07-24.md` — transcripción de la reunión de requerimientos.
- `docs/codigos-conceptos.md` — códigos oficiales de la cooperativa.
