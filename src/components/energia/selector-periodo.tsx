import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { labelPeriodo, mesDelConsumo, periodoActual, sumarMeses } from "@/lib/format";
import { Button } from "@/components/ui/button";

/** Hasta dónde se puede ir: el mes que viene (09/11/2026: «No me deja ir a diciembre»). El
 * electricista lee a fin de mes y la planilla del mes siguiente se imprime antes. */
export function periodoMaximoEnergia(): string {
  return sumarMeses(periodoActual(), 1);
}

/**
 * Navegación de período: ← Noviembre 2026 →, y debajo de qué mes es el consumo (la energía
 * se cobra a mes vencido, 0063). Cambia el searchParam ?periodo= de /energia.
 */
export function SelectorPeriodo({ periodo }: { periodo: string }) {
  const anterior = sumarMeses(periodo, -1);
  const siguiente = sumarMeses(periodo, 1);
  const haySiguiente = siguiente <= periodoMaximoEnergia();

  return (
    <div className="flex items-center justify-center gap-2" data-tour="energia-selector">
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
      <div className="w-52 text-center">
        <p className="font-display text-lg font-bold tracking-tight">{labelPeriodo(periodo)}</p>
        <p className="text-sm text-muted-foreground">Consumo de {mesDelConsumo(periodo)}</p>
      </div>
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
