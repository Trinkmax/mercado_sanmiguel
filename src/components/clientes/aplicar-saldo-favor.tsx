"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { aplicarSaldoFavor } from "@/lib/actions/clientes";
import { formatARS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

/**
 * Aplica el saldo a favor del cliente a su deuda (la más vieja primero),
 * con una confirmación corta. Solo aparece cuando hay crédito Y deuda.
 */
export function AplicarSaldoFavor({
  clienteId,
  saldoFavor,
  deuda,
}: {
  clienteId: string;
  saldoFavor: number;
  deuda: number;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const aAplicar = Math.min(saldoFavor, deuda);

  function aplicar() {
    startTransition(async () => {
      const res = await aplicarSaldoFavor({ clienteId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.data.aplicado > 0
          ? `Se aplicaron ${formatARS(res.data.aplicado)} del saldo a favor a la deuda`
          : "No había nada para aplicar"
      );
      setAbierto(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button size="lg" className="h-12 px-5 text-base font-semibold">
          <Wallet className="size-5" strokeWidth={2} />
          Aplicar saldo a favor
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aplicar el saldo a favor a la deuda</DialogTitle>
          <DialogDescription>
            Tiene {formatARS(saldoFavor)} a favor y debe {formatARS(deuda)}. Se
            imputan {formatARS(aAplicar)} a los cargos más viejos primero, como
            en un cobro.
            {saldoFavor > deuda
              ? ` Le quedan ${formatARS(saldoFavor - deuda)} a favor.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            className="h-11 px-4"
            onClick={() => setAbierto(false)}
            disabled={pendiente}
          >
            Todavía no
          </Button>
          <Button
            className="h-11 px-4 font-semibold"
            onClick={aplicar}
            disabled={pendiente}
          >
            {pendiente ? <Spinner className="size-4" /> : <Wallet className="size-4" />}
            Aplicar {formatARS(aAplicar)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
