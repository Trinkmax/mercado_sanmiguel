import Link from "next/link";
import { Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** "Imprimir cierre" (o "Imprimir parcial" con la caja abierta) → /cierre-caja/{id}. */
export function BotonImprimirCaja({
  cajaId,
  abierta,
  className,
}: {
  cajaId: string;
  abierta: boolean;
  className?: string;
}) {
  return (
    <Button asChild variant="outline" className={cn("min-h-11 text-sm", className)}>
      <Link href={`/cierre-caja/${cajaId}`}>
        <Printer className="size-4" strokeWidth={2} />
        {abierta ? "Imprimir parcial" : "Imprimir cierre"}
      </Link>
    </Button>
  );
}
