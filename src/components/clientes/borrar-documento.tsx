"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { borrarDocumento } from "@/lib/actions/documentos";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Borrado de un documento con confirmación (administración, consejo y líder). */
export function BorrarDocumento({
  id,
  clienteId,
  titulo,
}: {
  id: string;
  clienteId: string;
  titulo: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [pendiente, startTransition] = useTransition();

  function confirmar() {
    startTransition(async () => {
      const res = await borrarDocumento({ id, clienteId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Documento borrado");
      setAbierto(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="h-11 px-3 text-destructive hover:text-destructive">
          <Trash2 className="size-4" strokeWidth={2} />
          Borrar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>¿Borrar este documento?</DialogTitle>
          <DialogDescription>
            &ldquo;{titulo}&rdquo; se va a borrar de la carpeta y no se puede
            recuperar.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            className="h-11 px-4"
            onClick={() => setAbierto(false)}
            disabled={pendiente}
          >
            No, dejarlo
          </Button>
          <Button
            variant="destructive"
            className="h-11 px-4 font-semibold"
            onClick={confirmar}
            disabled={pendiente}
          >
            {pendiente ? <Spinner className="size-4" /> : <Trash2 className="size-4" />}
            Sí, borrarlo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
