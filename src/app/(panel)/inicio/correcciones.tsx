import Link from "next/link";
import {
  Ban,
  Banknote,
  Calculator,
  ChevronDown,
  ChevronRight,
  ClipboardX,
  Eraser,
  Gavel,
  IdCard,
  KeyRound,
  Link2Off,
  Lock,
  Receipt,
  RotateCcw,
  Scale,
  ShieldCheck,
  Truck,
  Undo2,
  UserCheck,
  UserCog,
  UserX,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { formatDni, formatFecha, formatFechaHora, formatMoneda, type Moneda } from "@/lib/format";
import { LABEL_ROL } from "@/lib/roles";
import type { Rol } from "@/lib/auth";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Money } from "@/components/shared/money";
import { desdeHaceDias, type Supabase } from "./datos";

/** Eventos de caja que corrigen plata (§4.0-8): cada uno deja rastro y el Líder los ve. */
const EVENTOS_CAJA = [
  "cobro_anulado",
  "canon_anulado",
  "gasto_revertido",
  "ajuste",
  "ajuste_borrado",
  "arqueo_recalculado",
  "cierre_forzado",
] as const;
type EventoCaja = (typeof EVENTOS_CAJA)[number];

const DEF_EVENTO: Record<EventoCaja, { titulo: string; icono: LucideIcon }> = {
  cobro_anulado: { titulo: "Recibo anulado", icono: Undo2 },
  canon_anulado: { titulo: "Ingreso de transporte anulado", icono: Truck },
  gasto_revertido: { titulo: "Pago de gasto deshecho", icono: Receipt },
  ajuste: { titulo: "Ajuste de tesorería en la caja", icono: Scale },
  ajuste_borrado: { titulo: "Ajuste borrado", icono: Eraser },
  arqueo_recalculado: { titulo: "Arqueo recalculado", icono: Calculator },
  cierre_forzado: { titulo: "Caja cerrada por Tesorería", icono: Lock },
};

/** Rastro de accesos (perfiles_eventos, 0028): no se borra al devolver el acceso. */
type AccionAcceso = "quitar" | "devolver" | "rol" | "contrasena" | "dni";

const DEF_ACCESO: Record<AccionAcceso, { titulo: string; icono: LucideIcon }> = {
  quitar: { titulo: "Acceso quitado", icono: UserX },
  devolver: { titulo: "Acceso devuelto", icono: UserCheck },
  rol: { titulo: "Rol cambiado", icono: UserCog },
  contrasena: { titulo: "Contraseña nueva", icono: KeyRound },
  dni: { titulo: "DNI cambiado", icono: IdCard },
};

/** Rastro de Tesorería (tesoreria_eventos, 0026): lo que se anula o deshace fuera de una caja. */
type EventoTesoreria =
  | "movimiento_anulado"
  | "saldo_inicial_corregido"
  | "cheque_a_cartera"
  | "cheque_desvinculado"
  | "acreditacion_deshecha"
  | "deposito_deshecho";

const DEF_TESORERIA: Record<EventoTesoreria, { titulo: string; icono: LucideIcon }> = {
  movimiento_anulado: { titulo: "Movimiento de Tesorería anulado", icono: Ban },
  saldo_inicial_corregido: { titulo: "Saldo inicial corregido", icono: Wallet },
  cheque_a_cartera: { titulo: "Cheque devuelto a la cartera", icono: RotateCcw },
  cheque_desvinculado: { titulo: "Se cambió el gasto que pagó un cheque", icono: Link2Off },
  acreditacion_deshecha: { titulo: "Acreditación de cheque deshecha", icono: Undo2 },
  deposito_deshecho: { titulo: "Depósito de cheque deshecho", icono: Undo2 },
};

function hrefTesoreria(tipo: EventoTesoreria, numeroCheque: string | null, valorAnterior: unknown): string {
  if (tipo === "saldo_inicial_corregido") return "/tesoreria?tab=saldos";
  if (tipo === "movimiento_anulado") {
    const fecha =
      valorAnterior && typeof valorAnterior === "object" && "fecha" in valorAnterior
        ? String((valorAnterior as { fecha: unknown }).fecha ?? "")
        : "";
    return /^\d{4}-\d{2}-\d{2}$/.test(fecha)
      ? `/tesoreria?tab=movimientos&mes=${fecha.slice(0, 8)}01`
      : "/tesoreria?tab=movimientos";
  }
  return numeroCheque ? `/cheques?estado=todos&q=${encodeURIComponent(numeroCheque)}` : "/cheques?estado=todos";
}

function labelRol(rol: string | null): string {
  return rol && rol in LABEL_ROL ? LABEL_ROL[rol as Rol] : (rol ?? "");
}

type Correccion = {
  id: string;
  cuando: string;
  titulo: string;
  icono: LucideIcon;
  donde: string | null;
  detalle: string | null;
  monto: number | null;
  /** Dólares (movimientos y saldos de Tesorería): se muestran en US$, nunca con "$". */
  moneda?: Moneda;
  quien: string | null;
  href: string;
};

const VISIBLES = 6;

/**
 * "Correcciones de los últimos 7 días" (control del dueño): todo lo que anuló,
 * deshizo o corrigió plata o accesos, con quién, cuándo, monto y motivo.
 * Fuentes: caja_eventos, multas sin efecto, cheques rechazados, novedades
 * anuladas, el rastro de accesos (quitados, devueltos, roles, DNI y
 * contraseñas nuevas: perfiles_eventos) y el de Tesorería (movimientos
 * anulados, saldos iniciales corregidos, cheques deshechos: tesoreria_eventos).
 */
export async function Correcciones({ org, supabase }: { org: string; supabase: Supabase }) {
  const desde = desdeHaceDias(7);

  const [eventosRes, multasRes, chequesRes, novedadesRes, accesosRes, perfilesRes, tesoreriaRes] =
    await Promise.all([
      supabase
        .from("caja_eventos")
        .select("id, tipo, detalle, usuario_id, creado_en, caja:cajas(fecha, tipo)")
        .eq("org_id", org)
        .in("tipo", [...EVENTOS_CAJA])
        .gte("creado_en", desde)
        .order("creado_en", { ascending: false })
        .limit(60),
      supabase
        .from("sanciones")
        .select("id, numero, titulo, multa, multa_sin_efecto_en, multa_sin_efecto_por, multa_sin_efecto_motivo, cliente:clientes(nombre)")
        .eq("org_id", org)
        .gte("multa_sin_efecto_en", desde)
        .limit(30),
      supabase
        .from("cheques")
        .select("id, numero, monto, rechazado_en, rechazado_por, motivo_rechazo, recibido_de")
        .eq("org_id", org)
        .gte("rechazado_en", desde)
        .limit(30),
      supabase
        .from("novedades_personal")
        .select("id, tipo, fecha_desde, anulada_en, anulada_por, motivo_anulacion, empleado:empleados(nombre, apellido)")
        .eq("org_id", org)
        .eq("estado", "anulada")
        .gte("anulada_en", desde)
        .limit(30),
      supabase
        .from("perfiles_eventos")
        .select("id, user_id, accion, valor_anterior, valor_nuevo, detalle, hecho_por, hecho_en")
        .eq("org_id", org)
        .gte("hecho_en", desde)
        .order("hecho_en", { ascending: false })
        .limit(60),
      supabase.from("perfiles").select("user_id, nombre, rol, dni").eq("org_id", org),
      supabase
        .from("tesoreria_eventos")
        .select("id, tipo, detalle, motivo, monto, moneda, valor_anterior, hecho_por, hecho_en, cheque:cheques(numero)")
        .eq("org_id", org)
        .in("tipo", Object.keys(DEF_TESORERIA))
        .gte("hecho_en", desde)
        .order("hecho_en", { ascending: false })
        .limit(60),
    ]);

  const perfilPorId = new Map((perfilesRes.data ?? []).map((p) => [p.user_id, p]));
  const quien = (id: string | null) => (id ? (perfilPorId.get(id)?.nombre ?? null) : null);
  const lista: Correccion[] = [];

  for (const e of eventosRes.data ?? []) {
    const def = DEF_EVENTO[e.tipo as EventoCaja];
    if (!def) continue;
    const caja = e.caja as unknown as { fecha: string; tipo: string } | null;
    lista.push({
      id: `ev-${e.id}`,
      cuando: e.creado_en,
      titulo: def.titulo,
      icono: def.icono,
      donde: caja
        ? `${caja.tipo === "guardia" ? "Caja de portería" : "Caja de Administración"} del ${formatFecha(caja.fecha).slice(0, 5)}`
        : null,
      detalle: e.detalle,
      monto: null,
      quien: quien(e.usuario_id),
      href: caja ? `/caja?fecha=${caja.fecha}&tipo=${caja.tipo}` : "/caja",
    });
  }
  for (const s of multasRes.data ?? []) {
    if (!s.multa_sin_efecto_en) continue;
    const cliente = s.cliente as unknown as { nombre: string } | null;
    lista.push({
      id: `mu-${s.id}`,
      cuando: s.multa_sin_efecto_en,
      titulo: "Multa sin efecto",
      icono: Gavel,
      donde: `Registro N° ${s.numero}${cliente ? ` · ${cliente.nombre}` : ""}`,
      detalle: s.multa_sin_efecto_motivo,
      monto: s.multa !== null ? Number(s.multa) : null,
      quien: quien(s.multa_sin_efecto_por),
      href: `/comunicaciones/registros/${s.id}`,
    });
  }
  for (const c of chequesRes.data ?? []) {
    if (!c.rechazado_en) continue;
    lista.push({
      id: `ch-${c.id}`,
      cuando: c.rechazado_en,
      titulo: "Cheque rechazado",
      icono: Banknote,
      donde: `Cheque N° ${c.numero}${c.recibido_de ? ` · de ${c.recibido_de}` : ""}`,
      detalle: c.motivo_rechazo,
      monto: Number(c.monto),
      quien: quien(c.rechazado_por),
      href: "/cheques",
    });
  }
  for (const n of novedadesRes.data ?? []) {
    if (!n.anulada_en) continue;
    const emp = n.empleado as unknown as { nombre: string; apellido: string } | null;
    lista.push({
      id: `no-${n.id}`,
      cuando: n.anulada_en,
      titulo: "Novedad del personal anulada",
      icono: ClipboardX,
      donde: `${emp ? `${emp.nombre} ${emp.apellido}` : "Empleado"} · ${formatFecha(n.fecha_desde).slice(0, 5)}`,
      detalle: n.motivo_anulacion,
      monto: null,
      quien: quien(n.anulada_por),
      href: "/novedades",
    });
  }
  for (const a of accesosRes.data ?? []) {
    const def = DEF_ACCESO[a.accion as AccionAcceso];
    if (!def) continue;
    const persona = perfilPorId.get(a.user_id);
    const cambio =
      a.accion === "rol"
        ? `De ${labelRol(a.valor_anterior)} a ${labelRol(a.valor_nuevo)}`
        : a.accion === "dni"
          ? `De ${a.valor_anterior ? formatDni(a.valor_anterior) : "sin DNI"} a ${a.valor_nuevo ? formatDni(a.valor_nuevo) : "sin DNI"}`
          : null;
    lista.push({
      id: `ac-${a.id}`,
      cuando: a.hecho_en,
      titulo: def.titulo,
      icono: def.icono,
      donde: persona
        ? `${persona.nombre} · ${labelRol(persona.rol)}${persona.dni ? ` · DNI ${formatDni(persona.dni)}` : ""}`
        : null,
      detalle: [cambio, a.detalle].filter(Boolean).join(" · ") || null,
      monto: null,
      quien: quien(a.hecho_por),
      href:
        persona?.rol === "socio" ? "/configuracion?tab=usuarios&ver=socios" : "/configuracion?tab=usuarios",
    });
  }

  for (const t of tesoreriaRes.data ?? []) {
    const def = DEF_TESORERIA[t.tipo as EventoTesoreria];
    if (!def) continue;
    lista.push({
      id: `te-${t.id}`,
      cuando: t.hecho_en,
      titulo: def.titulo,
      icono: def.icono,
      donde: t.detalle,
      detalle: t.motivo,
      monto: t.monto !== null ? Number(t.monto) : null,
      moneda: t.moneda as Moneda,
      quien: quien(t.hecho_por),
      href: hrefTesoreria(t.tipo as EventoTesoreria, t.cheque?.numero ?? null, t.valor_anterior),
    });
  }

  lista.sort((a, b) => b.cuando.localeCompare(a.cuando));
  const primeras = lista.slice(0, VISIBLES);
  const resto = lista.slice(VISIBLES);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Correcciones de los últimos 7 días{" "}
          <span className="tabular text-muted-foreground">({lista.length})</span>
        </CardTitle>
        <CardDescription>
          Cobros anulados, ajustes, gastos deshechos, movimientos de Tesorería anulados, saldos
          corregidos, cheques rechazados o deshechos, multas sin efecto y cambios de accesos: quién,
          cuándo y por qué.
        </CardDescription>
        {lista.length === 0 ? (
          <CardAction>
            <ShieldCheck className="size-6 text-pagado" strokeWidth={2} aria-hidden />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {lista.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nadie anuló ni corrigió nada en la última semana.
          </p>
        ) : (
          <>
            <ul className="divide-y">
              {primeras.map((c) => (
                <FilaCorreccion key={c.id} c={c} />
              ))}
            </ul>
            {resto.length > 0 ? (
              <Collapsible>
                <CollapsibleContent>
                  <ul className="divide-y border-t">
                    {resto.map((c) => (
                      <FilaCorreccion key={c.id} c={c} />
                    ))}
                  </ul>
                </CollapsibleContent>
                <CollapsibleTrigger className="group mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-primary hover:bg-accent">
                  <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
                  <span className="group-data-[state=open]:hidden">Ver las otras {resto.length}</span>
                  <span className="hidden group-data-[state=open]:inline">Ver menos</span>
                </CollapsibleTrigger>
              </Collapsible>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function FilaCorreccion({ c }: { c: Correccion }) {
  const Icono = c.icono;
  return (
    <li>
      <Link
        href={c.href}
        className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/60"
      >
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground/75">
          <Icono className="size-[18px]" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          {/* Si el monto no entra al lado del título, baja y queda a la derecha igual. */}
          <p className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="min-w-0 font-semibold break-words">{c.titulo}</span>
            {c.monto === null ? null : c.moneda === "USD" ? (
              <span className="ml-auto tabular font-semibold whitespace-nowrap">{formatMoneda(c.monto, "USD")}</span>
            ) : (
              <Money monto={c.monto} className="ml-auto font-semibold whitespace-nowrap" />
            )}
          </p>
          {c.donde ? <p className="text-sm break-words">{c.donde}</p> : null}
          {c.detalle ? <p className="text-sm text-muted-foreground">{c.detalle}</p> : null}
          <p className="text-xs text-muted-foreground">
            {c.quien ? `${c.quien} · ` : ""}
            <span className="tabular">{formatFechaHora(c.cuando)}</span>
          </p>
        </div>
        <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}
