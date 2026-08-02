import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { labelPeriodo, sumarMeses } from "@/lib/format";
import { Button } from "@/components/ui/button";

/** Selector de mes con flechas grandes: ← Agosto 2026 → */
export function SelectorMes({ periodo }: { periodo: string }) {
  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="outline" className="size-11">
        <Link
          href={`/gastos?periodo=${sumarMeses(periodo, -1)}`}
          aria-label="Mes anterior"
        >
          <ChevronLeft className="size-5" strokeWidth={2} />
        </Link>
      </Button>
      <p className="min-w-40 text-center font-display text-lg font-bold tracking-tight">
        {labelPeriodo(periodo)}
      </p>
      <Button asChild variant="outline" className="size-11">
        <Link
          href={`/gastos?periodo=${sumarMeses(periodo, 1)}`}
          aria-label="Mes siguiente"
        >
          <ChevronRight className="size-5" strokeWidth={2} />
        </Link>
      </Button>
    </div>
  );
}
