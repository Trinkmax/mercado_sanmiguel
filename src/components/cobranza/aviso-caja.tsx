import Link from "next/link";
import { ArrowRight, CalendarClock, Lock, Undo2 } from "lucide-react";
import type { Rol } from "@/lib/auth";
import { formatFecha } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** La caja de HOY de quien cobra (Jefe: portería; Administración y Líder: administración). */
export type CajaDeHoy = {
  estado: "abierta" | "cerrada" | "integrada" | "validada";
  reaperturaPedida: boolean;
} | null;

/** Sin caja todavía o abierta: se cobra. Cerrada, rendida o validada: no. */
export function cajaNoDejaCobrar(caja: CajaDeHoy): boolean {
  return Boolean(caja && caja.estado !== "abierta");
}

function textos(caja: NonNullable<CajaDeHoy>, rol: Rol): { titulo: string; texto: string; boton: string } {
  if (caja.estado === "validada") {
    return {
      titulo: "Tesorería ya validó la caja de hoy",
      texto:
        rol === "lider"
          ? "Hoy no se puede cobrar más en esta caja."
          : "Hoy no se puede cobrar más en esta caja. Avisale al Líder de Procesos.",
      boton: "Ver la caja",
    };
  }
  if (rol === "guardia") {
    // Rendida (cerrada) la reabre Administración; ya recibida (integrada), solo Tesorería.
    const quienReabre = caja.estado === "integrada" ? "Tesorería" : "Administración";
    return caja.reaperturaPedida
      ? {
          titulo: "Ya rendiste la caja de portería de hoy",
          texto: `Ya pediste la reapertura: cuando ${quienReabre} la reabra, vas a poder cobrar de nuevo.`,
          boton: "Ver la caja",
        }
      : {
          titulo: "Ya rendiste la caja de portería de hoy",
          texto: "Para seguir cobrando, pedí la reapertura desde Caja.",
          boton: "Pedir la reapertura",
        };
  }
  return {
    titulo: rol === "lider" ? "La caja de administración de hoy está cerrada" : "Tu caja de hoy está cerrada",
    texto: "Para seguir cobrando, reabrila desde Caja (te pide el motivo).",
    boton: "Reabrir la caja",
  };
}

/**
 * Aviso ARRIBA de la lista y del formulario de cobro cuando la caja de hoy no está abierta:
 * se ve antes de cargar nada y lleva a donde se resuelve. El botón de cobrar queda apagado.
 */
export function AvisoCajaCerrada({
  caja,
  rol,
  className,
}: {
  caja: CajaDeHoy;
  rol: Rol;
  className?: string;
}) {
  if (!caja || !cajaNoDejaCobrar(caja)) return null;
  const t = textos(caja, rol);
  const href = rol === "lider" ? "/caja?tipo=administracion" : "/caja";
  return (
    <div
      role="status"
      data-tour="cobranza-aviso-caja"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-parcial bg-parcial-suave px-4 py-3",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 basis-60 items-start gap-3">
        <Lock className="mt-0.5 size-5 shrink-0 text-parcial" strokeWidth={2} />
        <div className="min-w-0 space-y-0.5">
          <p className="text-base font-semibold">{t.titulo}</p>
          <p className="text-sm">{t.texto}</p>
        </div>
      </div>
      <Button asChild className="h-11 px-4 text-sm font-semibold">
        <Link href={href}>
          {t.boton}
          <ArrowRight className="size-4" strokeWidth={2} />
        </Link>
      </Button>
    </div>
  );
}

/** La caja de un día anterior solo deja cobrar si existe y está abierta (no se abre sola). */
export function cajaAnteriorNoDejaCobrar(caja: CajaDeHoy): boolean {
  return !caja || caja.estado !== "abierta";
}

/** Dónde se abre, reabre o mira la caja de ese día anterior. */
export function hrefCajaDelDia(fecha: string, rol: Rol): string {
  return `/caja?fecha=${fecha}&tipo=${rol === "guardia" ? "guardia" : "administracion"}`;
}

/**
 * Carga atrasada: ARRIBA de la lista y del formulario cuando se cobra en la caja de un día
 * anterior. Dice en qué caja entra el cobro (y cómo volver a hoy); si esa caja no está
 * abierta, lleva a Caja para abrirla o reabrirla y el botón de cobrar queda apagado.
 */
export function AvisoDiaAnterior({
  fecha,
  caja,
  rol,
  volverAHoy,
  className,
}: {
  fecha: string;
  caja: CajaDeHoy;
  rol: Rol;
  /** La misma pantalla, en la caja de hoy. */
  volverAHoy: string;
  className?: string;
}) {
  const dia = formatFecha(fecha);
  const bloqueada = cajaAnteriorNoDejaCobrar(caja);

  if (!bloqueada) {
    return (
      <div
        role="status"
        data-tour="cobranza-dia-anterior"
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent-foreground/20 bg-accent px-4 py-3",
          className
        )}
      >
        <div className="flex min-w-0 flex-1 basis-60 items-start gap-3">
          <CalendarClock className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
          <div className="min-w-0 space-y-0.5">
            <p className="text-base font-semibold">
              Estás cargando cobros del <span className="whitespace-nowrap">{dia}</span>
            </p>
            <p className="text-sm">Entran en la caja de ese día y el recibo sale con esa fecha.</p>
          </div>
        </div>
        <Button asChild variant="outline" className="h-11 bg-card px-4 text-sm font-semibold">
          <Link href={volverAHoy}>
            <Undo2 className="size-4" strokeWidth={2} />
            Volver a hoy
          </Link>
        </Button>
      </div>
    );
  }

  const t = !caja
    ? {
        titulo: `Todavía no se abrió la caja del ${dia}`,
        texto: "Abrila desde Caja para cargar los cobros de ese día.",
      }
    : caja.estado === "validada"
      ? {
          titulo: `Tesorería ya validó la caja del ${dia}`,
          texto: "Ya no se pueden cargar cobros de ese día.",
        }
      : {
          titulo: `La caja del ${dia} está cerrada`,
          texto:
            rol === "guardia"
              ? "Para seguir cargando cobros de ese día, pedí la reapertura desde Caja."
              : "Para seguir cargando cobros de ese día, reabrila desde Caja.",
        };

  return (
    <div
      role="status"
      data-tour="cobranza-aviso-caja"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-parcial bg-parcial-suave px-4 py-3",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 basis-60 items-start gap-3">
        <Lock className="mt-0.5 size-5 shrink-0 text-parcial" strokeWidth={2} />
        <div className="min-w-0 space-y-0.5">
          <p className="text-base font-semibold">{t.titulo}</p>
          <p className="text-sm">{t.texto}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" className="h-11 bg-card px-4 text-sm font-semibold">
          <Link href={volverAHoy}>
            <Undo2 className="size-4" strokeWidth={2} />
            Volver a hoy
          </Link>
        </Button>
        <Button asChild className="h-11 px-4 text-sm font-semibold">
          <Link href={hrefCajaDelDia(fecha, rol)}>
            Ir a esa caja
            <ArrowRight className="size-4" strokeWidth={2} />
          </Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * Viendo hoy: cajas de días anteriores que están abiertas (carga atrasada o reabiertas).
 * Un toque lleva a cobrar en esa caja.
 */
export function CajasAnterioresAbiertas({ fechas, className }: { fechas: string[]; className?: string }) {
  if (fechas.length === 0) return null;
  return (
    <div
      className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-card px-4 py-3", className)}
      data-tour="cobranza-cajas-anteriores"
    >
      <p className="flex items-start gap-2 text-sm">
        <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
        <span>
          {fechas.length === 1
            ? "Hay una caja de un día anterior abierta. ¿Cargar cobros de ese día?"
            : "Hay cajas de días anteriores abiertas. ¿Cargar cobros de uno de esos días?"}
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        {fechas.map((f) => (
          <Button key={f} asChild variant="outline" className="h-11 px-4 text-sm font-semibold tabular">
            <Link href={`/cobranza?fecha=${f}`}>{formatFecha(f)}</Link>
          </Button>
        ))}
      </div>
    </div>
  );
}
