import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { labelPeriodo, mesDelConsumo } from "@/lib/format";
import { Button } from "@/components/ui/button";

/** El cedulón de energía de un cliente (todos sus medidores sumados), del último mes cargado. */
export function BotonCedulon({ clienteId, periodo }: { clienteId: string; periodo: string }) {
  const mes = labelPeriodo(periodo).split(" ")[0].toLowerCase();
  return (
    <Button asChild variant="outline" className="h-auto min-h-11 bg-card px-4 py-2 text-left text-sm whitespace-normal">
      <Link href={`/cedulones/${periodo}?cliente=${clienteId}`}>
        <ReceiptText className="size-5" strokeWidth={2} />
        <span>
          Imprimir cedulón de {mes}{" "}
          <span className="font-normal text-muted-foreground">(consumo de {mesDelConsumo(periodo)})</span>
        </span>
      </Link>
    </Button>
  );
}
