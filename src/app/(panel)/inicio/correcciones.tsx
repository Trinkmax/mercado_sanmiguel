import Link from "next/link";
import {
  Banknote,
  Calculator,
  ChevronDown,
  ChevronRight,
  ClipboardX,
  Eraser,
  Gavel,
  Lock,
  Receipt,
  Scale,
  ShieldCheck,
  Truck,
  Undo2,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { formatDni, formatFecha, formatFechaHora } from "@/lib/format";
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

type Correccion = {
  id: string;
  cuando: string;
  titulo: string;
  icono: LucideIcon;
  donde: string | null;
  detalle: string | null;
  monto: number | null;
  quien: string | null;
  href: string;
};

const VISIBLES = 6;

/**
 * "Correcciones de los últimos 7 días" (control del dueño): todo lo que anuló,
 * deshizo o corrigió plata o accesos, con quién, cuándo, monto y motivo.
 * Fuentes: caja_eventos, multas sin efecto, cheques rechazados, novedades
 * anuladas y accesos quitados.
 */
export async function Correcciones({ org, supabase }: { org: string; supabase: Supabase }) {
  const desde = desdeHaceDias(7);

  const [eventosRes, multasRes, chequesRes, novedadesRes, accesosRes, perfilesRes] =
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
        .from("perfiles")
        .select("user_id, nombre, rol, dni, desactivado_en, desactivado_por")
        .eq("org_id", org)
        // El Consejo lo desactivó la migración de fase 3 (F5): no es una corrección de nadie.
        .neq("rol", "consejo")
        .gte("desactivado_en", desde)
        .limit(30),
      supabase.from("perfiles").select("user_id, nombre").eq("org_id", org),
    ]);

  const nombre = new Map((perfilesRes.data ?? []).map((p) => [p.user_id, p.nombre]));
  const quien = (id: string | null) => (id ? (nombre.get(id) ?? null) : null);
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
  for (const p of accesosRes.data ?? []) {
    if (!p.desactivado_en) continue;
    lista.push({
      id: `ac-${p.user_id}`,
      cuando: p.desactivado_en,
      titulo: "Acceso quitado",
      icono: UserX,
      donde: `${p.nombre} · ${LABEL_ROL[p.rol as Rol]}${p.dni ? ` · DNI ${formatDni(p.dni)}` : ""}`,
      detalle: null,
      monto: null,
      quien: quien(p.desactivado_por),
      href: p.rol === "socio" ? "/configuracion?tab=usuarios&ver=socios" : "/configuracion?tab=usuarios",
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
          Cobros anulados, ajustes, gastos deshechos, cheques rechazados, multas sin efecto y accesos
          quitados: quién, cuándo y por qué.
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
          <p className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="font-semibold">{c.titulo}</span>
            {c.monto !== null ? <Money monto={c.monto} className="font-semibold" /> : null}
          </p>
          {c.donde ? <p className="text-sm">{c.donde}</p> : null}
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
