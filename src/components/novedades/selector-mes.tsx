import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { labelPeriodo, periodoActual, sumarMeses } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * ◀ Septiembre 2026 ▶ — cambia de mes con links (sirve sin JavaScript). No deja pasar del
 * mes actual. `href` arma la URL de cada mes (conserva el sector elegido).
 */
export function SelectorMes({
  periodo,
  hrefMes,
  className,
}: {
  periodo: string;
  hrefMes: (periodo: string) => string;
  className?: string;
}) {
  const anterior = sumarMeses(periodo, -1);
  const siguiente = sumarMeses(periodo, 1);
  const haySiguiente = siguiente <= periodoActual();
  const boton =
    "inline-flex size-12 shrink-0 items-center justify-center rounded-md border bg-card transition-colors";

  return (
    <nav className={cn("flex items-center gap-2", className)} aria-label="Elegir mes">
      <Link href={hrefMes(anterior)} className={cn(boton, "hover:bg-accent")} aria-label={`Ver ${labelPeriodo(anterior)}`}>
        <ChevronLeft className="size-5" strokeWidth={2.2} />
      </Link>
      <p className="min-w-44 text-center font-display text-xl font-bold tracking-tight" aria-live="polite">
        {labelPeriodo(periodo)}
      </p>
      {haySiguiente ? (
        <Link href={hrefMes(siguiente)} className={cn(boton, "hover:bg-accent")} aria-label={`Ver ${labelPeriodo(siguiente)}`}>
          <ChevronRight className="size-5" strokeWidth={2.2} />
        </Link>
      ) : (
        <span className={cn(boton, "text-muted-foreground/40")} aria-hidden>
          <ChevronRight className="size-5" strokeWidth={2.2} />
        </span>
      )}
    </nav>
  );
}
