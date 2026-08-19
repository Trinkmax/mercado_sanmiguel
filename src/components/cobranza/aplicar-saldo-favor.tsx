"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PiggyBank } from "lucide-react";
import { toast } from "sonner";
import { aplicarSaldoFavor } from "@/lib/actions/cobranza";
import { formatARS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/**
 * Cuando el saldo a favor cubre la deuda: un toque y queda al día, sin cobrar
 * nada. La RPC imputa el crédito a los cargos pendientes.
 */
export function BotonAplicarSaldoFavor({
  clienteId,
  saldoFavor,
}: {
  clienteId: string;
  saldoFavor: number;
}) {
  const router = useRouter();
  const [enviando, startTransition] = useTransition();

  function aplicar() {
    startTransition(async () => {
      const res = await aplicarSaldoFavor(clienteId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.data.aplicado > 0
          ? `Saldo a favor aplicado: ${formatARS(res.data.aplicado)}.`
          : "No había nada para aplicar."
      );
      router.refresh();
    });
  }

  return (
    <Button
      size="lg"
      onClick={aplicar}
      disabled={enviando}
      className="h-12 w-full text-base font-semibold"
    >
      {enviando ? (
        <Spinner className="size-5" />
      ) : (
        <PiggyBank className="size-5" strokeWidth={2} />
      )}
      Aplicar los {formatARS(saldoFavor)} a favor y dejarlo al día
    </Button>
  );
}
