"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PiggyBank } from "lucide-react";
import { toast } from "sonner";
import { aplicarSaldoFavor } from "@/lib/actions/cobranza";
import { formatARS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AlertaError } from "@/components/cobranza/alerta-error";
import { llamarAccion } from "@/lib/llamar-accion";

/**
 * Cuando el saldo a favor cubre la deuda: un toque y queda al día, sin cobrar
 * nada. La RPC imputa el crédito a los cargos pendientes (reintentar es seguro:
 * si ya se había aplicado, no hay nada más para aplicar).
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
  const [error, setError] = useState<string | null>(null);

  function aplicar() {
    setError(null);
    startTransition(async () => {
      const res = await llamarAccion(() => aplicarSaldoFavor(clienteId));
      if (!res.ok) {
        setError(res.error);
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
    <div className="space-y-3 text-left">
      <Button
        size="lg"
        onClick={aplicar}
        disabled={enviando}
        className="h-auto min-h-12 w-full py-2 text-base font-semibold whitespace-normal"
      >
        {enviando ? (
          <Spinner className="size-5" />
        ) : (
          <PiggyBank className="size-5" strokeWidth={2} />
        )}
        Aplicar los {formatARS(saldoFavor)} a favor y dejarlo al día
      </Button>
      {error ? <AlertaError error={error} titulo="No se pudo aplicar el saldo a favor" /> : null}
    </div>
  );
}
