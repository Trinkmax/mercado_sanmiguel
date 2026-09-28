# Guía de construcción de módulos — Mercado San Miguel

Leé también `PRODUCT.md` (verdad del producto) y **`docs/FASE2-CONTRATO.md`**
(roles nuevos, aprobación obligatoria, flujo de cajas, solicitudes, personal,
saldo a favor, exportación). Esta guía es el contrato técnico y de diseño.
**No inventes patrones nuevos: seguí estos.**

## Stack y fundación (ya construida — NO tocar)

- Next.js 16 App Router + React 19 + TS + Tailwind v4 + shadcn/ui (estilo radix-mira).
- Supabase con RLS estricta. Tipos generados en `src/lib/database.types.ts`.
- **Archivos compartidos intocables**: `src/app/globals.css`, `src/app/layout.tsx`,
  `src/app/(panel)/layout.tsx`, `src/app/(portal)/layout.tsx`, `src/app/(print)/layout.tsx`,
  todo `src/lib/*` (excepto crear TU archivo de actions), `src/components/ui/*`,
  `src/components/shared/*`, `src/lib/navegacion.ts`, `src/proxy.ts`.
  Si necesitás un componente nuevo, crealo dentro de tu módulo:
  `src/components/<modulo>/…`.

## Acceso a datos

```ts
// Server Component / Server Action
import { createClient } from "@/lib/supabase/server";
import { requireRol, requireStaff, getPerfil } from "@/lib/auth";

const perfil = await requireRol("admin", "tesoreria", "lider"); // redirige si no corresponde
const supabase = await createClient();
const { data, error } = await supabase.from("clientes").select("…").order("codigo");
```

- Páginas: Server Components que consultan directo. Interactividad: componentes
  cliente chicos (`"use client"`) que llaman server actions.
- `perfil.org_id` es la organización: **todo insert lleva `org_id: perfil.org_id`**.
- Roles (`rol_usuario`): `lider` (Líder de Procesos, hereda todo lo de `consejo`), `admin`,
  `guardia` (= Jefe de Portería, el único de portería que cobra), `porteria` (no cobra),
  `tesoreria`, `consejo`, `socio`. Labels en `src/lib/roles.ts`. Reportes: sin `admin`.
- **Clientes / conceptos / ítems de cliente**: NUNCA insert/update directo (RLS solo deja al
  líder). Llamá `rpc("solicitar_cambio", …)` (ver FASE2-CONTRATO §2): si el rol es `lider`
  se aplica en el acto; si no, queda en `cambios_pendientes` hasta que el líder apruebe.
- La vista `v_deuda_clientes` da `{ cliente_id, deuda, cargos_pendientes, periodo_mas_viejo }`
  (solo clientes CON deuda; no se puede "join" desde clientes: consultala aparte y
  cruzá por `cliente_id` en memoria).
- Números `numeric` llegan como `number`; igual envolvé con `Number(...)` al sumar.

## RPCs de negocio (toda mutación compleja pasa por acá — NUNCA reimplementar la lógica)

| RPC | Qué hace | Roles |
|---|---|---|
| `abrir_caja({ p_tipo })` | Devuelve el uuid de la caja de hoy (la crea si no existe). Tipos: `administracion` \| `guardia` | admin/guardia/tesorería |
| `registrar_pago({ p_cliente, p_monto, p_medio, p_caja, p_cheque?, p_notas?, p_transferencia?, p_permitir_saldo_favor? })` | Crea el cobro e imputa solo (deuda más vieja primero, orden de prioridad, beneficio por pago en término). `p_cheque`: `{ numero, banco, titular, es_tercero, fecha_cobro }`; `p_transferencia`: `{ titular (obligatorio), comprobante_path? }`. Devuelve `{ pago_id, numero, imputaciones: [...], saldo_favor }`. Si el monto supera la deuda falla salvo `p_permitir_saldo_favor: true` (el sobrante queda como saldo a favor) | admin/guardia/tesorería |
| `anular_pago({ p_pago, p_motivo })` | Revierte imputaciones y marca anulado | admin/guardia (caja abierta), tesorería |
| `cerrar_caja({ p_caja })` | Cierra y devuelve el arqueo `{ efectivo, transferencia, cheques, canon, gastos_pagados }` | dueño de la caja |
| `validar_caja({ p_caja, p_observaciones? })` | OK de tesorería (traspaso de responsabilidad) | tesorería |
| `generar_periodo({ p_periodo: "YYYY-MM-01" })` | Genera los cargos del mes (idempotente). Devuelve `{ periodo, vencimiento, cargos, energia }` | admin/tesorería/consejo |
| `registrar_lectura({ p_medidor, p_periodo, p_anterior, p_actual })` | Alta/corrección de lectura + su cargo ENER. Falla si ya tiene cobros | admin/tesorería/consejo |
| `flujo_caja()` | `{ efectivo, banco, cheques_en_cartera, total }` | tesorería/consejo |
| `resumen_conceptos({ p_periodo })` | Por concepto: `{ codigo, nombre, estimado, cobrado, descuentos, pendiente }` | staff |
| `resumen_gastos({ p_periodo })` | Por rubro: `{ codigo, nombre, tipo, pagado, pendiente }` | admin/tesorería/consejo/líder |
| `integrar_caja_porteria({ p_caja, p_observaciones? })` | Caja de portería cerrada → `integrada` en la caja mayor de hoy | admin/tesorería |
| `solicitar_reapertura_caja` / `reabrir_caja` / `rechazar_reapertura_caja` | Reapertura de caja con motivo y bitácora | guardia pide; admin/tesorería reabren |
| `aplicar_saldo_favor_cliente({ p_cliente })` | Aplica el crédito del cliente a sus cargos pendientes | admin/guardia/tesorería/líder |
| `solicitar_cambio` / `aprobar_cambio` / `rechazar_cambio` | Aprobación obligatoria de clientes y conceptos | staff de gestión / solo líder |
| `avanzar_solicitud({ p_solicitud, p_accion, p_texto?, p_usuario? })` | Máquina de estados de solicitudes | según acción (ver contrato) |

Los mensajes de error de las RPC ya vienen en castellano: mostralos tal cual.

## Server Actions

Un archivo por módulo: `src/lib/actions/<modulo>.ts`. Patrón obligatorio:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";

const schema = z.object({ nombre: z.string().min(1, "Poné el nombre del cliente") });

export async function crearCliente(input: unknown): Promise<ActionResult<{ id: string }>> {
  const perfil = await requireRol("admin", "tesoreria", "consejo");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clientes")
    .insert({ ...parsed.data, org_id: perfil.org_id })
    .select("id")
    .single();
  if (error) return fallo(error);
  revalidatePath("/clientes");
  return ok({ id: data.id });
}
```

En el cliente: `useTransition` + `toast` de sonner (`import { toast } from "sonner"`),
o `useActionState` para formularios con error inline. Ante `!res.ok`:
`toast.error(res.error)`. Ante éxito: `toast.success("…")` con verbo concreto.

## Storage (documentos y facturas)

Bucket privado `documentos`. Rutas (helpers en `src/lib/storage.ts`): `{org_id}/clientes/{cliente_id}/…`,
`{org_id}/gastos/…`, `{org_id}/comprobantes/…` (transferencias), `{org_id}/firmas/…` (ingresos de
personal), `{org_id}/solicitudes/…`, `{org_id}/circulares/…`, `{org_id}/empleados/…`. Subida: form con `<input type="file">` →
server action con `FormData` → `supabase.storage.from("documentos").upload(ruta, file)`.
Para ver/descargar: `createSignedUrl(ruta, 3600)`. Límite 20 MB. Tipos: pdf/jpg/png/webp.

## Reglas de diseño (mundo: etiqueta de cajón de mercado)

Usuarios mayores con tablets, a plena luz, apurados. **Facilitar, no complejizar.**

- **Un camino por pantalla.** La acción primaria es un botón grande (`size="lg"`,
  mínimo `h-12`) y está siempre visible. Targets táctiles ≥ 44 px.
- **Componentes obligatorios** (de `@/components/shared/`):
  - `<PageHeader titulo="…" descripcion="…">{acciones}</PageHeader>` en toda página.
  - `<Money monto={…} />` para TODO importe; en tablas, columna alineada a la derecha con clase `tabular`.
  - `<Sello estado="pagado|pendiente|parcial|vencido|abierta|cerrada|integrada|validada|en_cartera|listo_depositar|…" />`
    para TODO estado. Verde = pagado/ok, rojo = pendiente/debe, ámbar = parcial/espera, azul (`info`) = en curso administrativo. Jamás texto plano ni Badge para estados. Lista completa en `src/components/shared/sello.tsx`.
  - `<BotonExportar dataset="clientes" />` para exportar a Excel (route handler `/api/exportar`).
  - `<Codigo codigo="EXPP" />` para códigos de concepto/rubro.
  - `<EmptyState icono={…} titulo descripcion>` con la acción siguiente, en toda lista vacía.
- **shadcn instalados**: alert, badge, button, card, checkbox, command, dialog,
  dropdown-menu, input, label, popover, progress, scroll-area, select, separator,
  sheet, skeleton, sonner, spinner, switch, table, tabs, textarea, tooltip.
  No agregues otros.
- **Iconos**: solo `lucide-react`, `strokeWidth` 1.8–2.2. Nunca emoji.
- **Prohibido** (piso de calidad): kickers/eyebrows sobre títulos; grillas de
  tarjetas iguales icono+título+texto; números de sección; texto en degradé;
  `border-left` de color como acento; sombras duras sin blur; modales para tareas
  que no lo necesitan (preferí páginas o secciones inline; Dialog solo para
  confirmaciones destructivas o subformularios cortos); monospace decorativo.
- **Formularios**: `Label` grande + `Input` `h-11`/`h-12`, errores inline en rojo
  con recuperación ("Poné el número del medidor"), `space-y-5`.
- **Montos en formularios**: `<Input inputMode="numeric">`, aceptar solo dígitos,
  mostrar preview formateado con `formatARS`.
- **Copy**: castellano rioplatense, voseo ("Cobrá", "Buscá el puesto"), cero jerga
  técnica. Los botones nombran la acción ("Registrar cobro", no "Aceptar").
- **Fechas/moneda**: SIEMPRE los helpers de `@/lib/format`
  (`formatARS`, `formatFecha`, `formatFechaHora`, `labelPeriodo`, `periodoActual`,
  `sumarMeses`, `hoyISO`, `saldoCargo`). Nunca `toLocaleString` a mano.
  `saldoCargo(cargo)` = lo exigible HOY (aplica descuento vigente). Un cargo
  pendiente con `vencimiento < hoyISO()` se muestra con `<Sello estado="vencido" />`.
- **Loading**: `loading.tsx` con `Skeleton` que copie la silueta real de la página.
- **Imprimibles** (recibos, libre deuda, planilla, reporte mensual): rutas dentro de
  `src/app/(print)/…` (layout pelado ya hecho). Marco `.etiqueta` > `.etiqueta-interior`,
  sello grande (`<Sello grande estado="pagado" texto="PAGADO" />`), datos de la
  cooperativa arriba, leyenda "Comprobante interno — sin validez fiscal" al pie si
  corresponde y una barra `.no-print` con botón "Imprimir" (componente cliente con
  `window.print()`). Tipografía sobria, tabla limpia, nada de color de fondo.
- Página del panel: envuelta en `space-y-8`; el layout ya limita el ancho.

## Datos semilla útiles para probar

- Usuarios (pass `SanMiguel2026`): lider@ / admin@ / guardia@ (Jefe de Portería) / porteria@ /
  tesorera@ / consejo@ / socio@ `sanmiguel.coop`. El socio es el cliente 12 (Puesto Juárez e Hijos).
- Julio 2026: generado y cobrado en parte (cliente 1 parcial, 2 y 8 deben — hoy vencidos).
  Agosto 2026: generado, todo pendiente, vence el 30/08. Hay una caja cerrada del
  31/07 sin validar (demo de tesorería) y un cheque en cartera al 15/08.

Al terminar tu módulo: `pnpm tsc --noEmit` (o `pnpm build`) debe pasar sin errores
en TUS archivos, toda ruta que tu módulo linkea debe existir dentro de tu módulo, y
NO commitees nada.
