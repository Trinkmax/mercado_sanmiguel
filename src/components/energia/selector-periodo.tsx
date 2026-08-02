import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { labelPeriodo, periodoActual, sumarMeses } from "@/lib/format";
import { Button } from "@/components/ui/button";

/**
 * Navegación de período: ← Agosto 2026 →.
 * Cambia el searchParam ?periodo= de /energia. No deja ir al futuro.
 */
export function SelectorPeriodo({ periodo }: { periodo: string }) {
  const anterior = sumarMeses(periodo, -1);
  const siguiente = sumarMeses(periodo, 1);
  const haySiguiente = siguiente <= periodoActual();

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        asChild
        variant="outline"
        size="icon-lg"
        className="size-11"
        aria-label={`Ver ${labelPeriodo(anterior)}`}
      >
        <Link href={`/energia?periodo=${anterior}`}>
          <ChevronLeft className="size-5" strokeWidth={2.2} />
        </Link>
      </Button>
      <p className="w-52 text-center font-display text-lg font-bold tracking-tight">
        {labelPeriodo(periodo)}
      </p>
      {haySiguiente ? (
        <Button
          asChild
          variant="outline"
          size="icon-lg"
          className="size-11"
          aria-label={`Ver ${labelPeriodo(siguiente)}`}
        >
          <Link href={`/energia?periodo=${siguiente}`}>
            <ChevronRight className="size-5" strokeWidth={2.2} />
          </Link>
        </Button>
      ) : (
        <Button
          variant="outline"
          size="icon-lg"
          className="size-11"
          disabled
          aria-label="No hay meses siguientes"
        >
          <ChevronRight className="size-5" strokeWidth={2.2} />
        </Button>
      )}
    </div>
  );
}
