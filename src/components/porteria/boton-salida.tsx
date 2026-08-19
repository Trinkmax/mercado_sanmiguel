"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { marcarEgreso } from "@/lib/actions/porteria";
import { horaAR } from "@/components/porteria/fechas";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/** "Marcar salida" de un ingreso que sigue adentro. Un toque, sin confirmación. */
export function BotonSalida({ ingresoId, nombre }: { ingresoId: string; nombre: string }) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  function marcar() {
    startTransition(async () => {
      const res = await marcarEgreso({ id: ingresoId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Salida marcada: ${nombre} · ${horaAR(res.data.egreso_en)}`);
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="h-12 px-4 text-base"
      onClick={marcar}
      disabled={pendiente}
    >
      {pendiente ? <Spinner className="size-5" /> : <LogOut className="size-5" strokeWidth={2} />}
      Marcar salida
    </Button>
  );
}
