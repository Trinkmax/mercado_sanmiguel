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

## Usuarios

Se entra con el DNI y la contraseña. Los usuarios los crea el Líder de Procesos
(equipo) o Administración (socios) desde **Configuración → Usuarios**. El
superadministrador del sistema (se marca solo desde la base, `perfiles.superadmin`)
puede ver y operar el sistema con cualquier rol desde el selector "Ver el sistema
como", incluido el portal de un cliente en vista previa de solo lectura.

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
