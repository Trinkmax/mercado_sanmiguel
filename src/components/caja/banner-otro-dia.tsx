import Link from "next/link";
import { ArrowRight, CalendarClock, Undo2 } from "lucide-react";
import { formatFecha } from "@/lib/format";
import { Button } from "@/components/ui/button";

/**
 * Avisos de navegación entre días:
 *  - viendo hoy, pero quedó una caja de otro día abierta (reabierta o sin cerrar) → ir;
 *  - viendo otro día → volver a hoy.
 */
export function BannerOtroDia({
  esHoy,
  fecha,
  tipo,
  cajaAbiertaOtroDia,
}: {
  esHoy: boolean;
  fecha: string;
  /** Pestaña a la que vuelve (Tesorería y el Líder ven las dos cajas). */
  tipo?: "administracion" | "guardia";
  cajaAbiertaOtroDia: { fecha: string; reaperturas: number } | null;
}) {
  const sufijo = tipo ? `&tipo=${tipo}` : "";

  if (!esHoy) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent-foreground/20 bg-accent px-4 py-3">
        {/* El texto va en un solo <span>: suelto dentro del flex, el gap separaba "del", la fecha
            y el punto ("28/09/2026 ."). */}
        <p className="flex items-start gap-2 text-base">
          <CalendarClock className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
          <span>
            Estás viendo la caja del <strong className="whitespace-nowrap">{formatFecha(fecha)}</strong>.
          </span>
        </p>
        <Button asChild variant="outline" className="h-11 bg-card px-4 text-sm font-semibold">
          <Link href={tipo ? `/caja?tipo=${tipo}` : "/caja"}>
            <Undo2 className="size-4" strokeWidth={2} />
            Volver a hoy
          </Link>
        </Button>
      </div>
    );
  }

  if (!cajaAbiertaOtroDia) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-parcial bg-parcial-suave px-4 py-3">
      <p className="flex items-start gap-2 text-base">
        <CalendarClock className="mt-0.5 size-5 shrink-0 text-parcial" strokeWidth={2} />
        <span>
          {tipo === "guardia" ? "La caja de portería" : "La caja"} del{" "}
          <strong className="whitespace-nowrap">{formatFecha(cajaAbiertaOtroDia.fecha)}</strong>{" "}
          {cajaAbiertaOtroDia.reaperturas > 0 ? "está reabierta" : "quedó abierta"}: corregila y cerrala.
        </span>
      </p>
      <Button asChild className="h-11 px-4 text-sm font-semibold">
        <Link href={`/caja?fecha=${cajaAbiertaOtroDia.fecha}${sufijo}`}>
          Ir a esa caja
          <ArrowRight className="size-4" strokeWidth={2} />
        </Link>
      </Button>
    </div>
  );
}
