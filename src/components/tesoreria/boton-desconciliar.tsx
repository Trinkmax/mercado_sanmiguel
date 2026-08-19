"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { desconciliarTransferencia } from "@/lib/actions/tesoreria";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/** "Deshacer" de una conciliación marcada por error. Solo tesorería. */
export function BotonDesconciliar({ id, numero }: { id: string; numero: number }) {
  const [pendiente, startTransition] = useTransition();

  function deshacer() {
    startTransition(async () => {
      const res = await desconciliarTransferencia(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Recibo N° ${numero} vuelve a "sin conciliar".`);
    });
  }

  return (
    <Button
      variant="ghost"
      className="h-10 px-3 text-muted-foreground hover:text-foreground"
      disabled={pendiente}
      onClick={deshacer}
      aria-label={`Deshacer conciliación del recibo N° ${numero}`}
    >
      {pendiente ? <Spinner className="size-4" /> : <Undo2 className="size-4" strokeWidth={2} />}
      Deshacer
    </Button>
  );
}
