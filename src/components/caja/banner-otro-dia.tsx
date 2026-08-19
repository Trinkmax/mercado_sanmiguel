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
  cajaAbiertaOtroDia,
}: {
  esHoy: boolean;
  fecha: string;
  cajaAbiertaOtroDia: { fecha: string; reaperturas: number } | null;
}) {
  if (!esHoy) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent-foreground/20 bg-accent px-4 py-3">
        <p className="flex items-center gap-2 text-base">
          <CalendarClock className="size-5 shrink-0" strokeWidth={2} />
          Estás viendo la caja del <strong>{formatFecha(fecha)}</strong>.
        </p>
        <Button asChild variant="outline" className="h-11 bg-card px-4 text-sm font-semibold">
          <Link href="/caja">
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
      <p className="flex items-center gap-2 text-base">
        <CalendarClock className="size-5 shrink-0 text-parcial" strokeWidth={2} />
        Tenés la caja del <strong>{formatFecha(cajaAbiertaOtroDia.fecha)}</strong>{" "}
        {cajaAbiertaOtroDia.reaperturas > 0 ? "reabierta" : "todavía abierta"}: corregila y cerrala.
      </p>
      <Button asChild className="h-11 px-4 text-sm font-semibold">
        <Link href={`/caja?fecha=${cajaAbiertaOtroDia.fecha}`}>
          Ir a esa caja
          <ArrowRight className="size-4" strokeWidth={2} />
        </Link>
      </Button>
    </div>
  );
}
