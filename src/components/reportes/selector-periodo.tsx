import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { labelPeriodo, sumarMeses } from "@/lib/format";
import { Button } from "@/components/ui/button";

/** Selector de mes: ← Agosto 2026 →. Navega con el searchParam `periodo`. */
export function SelectorPeriodo({ periodo }: { periodo: string }) {
  const anterior = sumarMeses(periodo, -1);
  const siguiente = sumarMeses(periodo, 1);

  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="outline" size="icon-lg" className="size-11">
        <Link
          href={`/reportes?periodo=${anterior}`}
          aria-label={`Ver ${labelPeriodo(anterior)}`}
        >
          <ChevronLeft className="size-5" strokeWidth={2} />
        </Link>
      </Button>
      <p className="min-w-44 text-center font-display text-lg font-bold tracking-tight">
        {labelPeriodo(periodo)}
      </p>
      <Button asChild variant="outline" size="icon-lg" className="size-11">
        <Link
          href={`/reportes?periodo=${siguiente}`}
          aria-label={`Ver ${labelPeriodo(siguiente)}`}
        >
          <ChevronRight className="size-5" strokeWidth={2} />
        </Link>
      </Button>
    </div>
  );
}
