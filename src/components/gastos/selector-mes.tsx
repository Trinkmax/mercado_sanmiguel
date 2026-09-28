import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { labelPeriodo, sumarMeses } from "@/lib/format";
import { Button } from "@/components/ui/button";

/**
 * Selector de mes con flechas grandes: ← Agosto 2026 →. Si se viene de una caja
 * (`?caja=`), la conserva: el gasto de otro mes se sigue pagando desde esa caja.
 */
export function SelectorMes({ periodo, caja = null }: { periodo: string; caja?: string | null }) {
  const href = (p: string) => `/gastos?periodo=${p}${caja ? `&caja=${caja}` : ""}`;
  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="outline" className="size-11">
        <Link href={href(sumarMeses(periodo, -1))} aria-label="Mes anterior">
          <ChevronLeft className="size-5" strokeWidth={2} />
        </Link>
      </Button>
      <p className="min-w-36 text-center font-display text-lg font-bold tracking-tight">
        {labelPeriodo(periodo)}
      </p>
      <Button asChild variant="outline" className="size-11">
        <Link href={href(sumarMeses(periodo, 1))} aria-label="Mes siguiente">
          <ChevronRight className="size-5" strokeWidth={2} />
        </Link>
      </Button>
    </div>
  );
}
