"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserMinus, UserCheck } from "lucide-react";
import { darDeBaja, reincorporar } from "@/lib/actions/personal";
import { hoyISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

/** Baja lógica del empleado (con fecha de egreso) o reincorporación. */
export function DarDeBaja({
  empleadoId,
  nombre,
  activo,
}: {
  empleadoId: string;
  nombre: string;
  activo: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [fecha, setFecha] = useState(hoyISO());
  const [pendiente, startTransition] = useTransition();

  function confirmarBaja() {
    startTransition(async () => {
      const res = await darDeBaja({ id: empleadoId, fecha_egreso: fecha });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${nombre} dado de baja`);
      setAbierto(false);
      router.refresh();
    });
  }

  function confirmarAlta() {
    startTransition(async () => {
      const res = await reincorporar({ id: empleadoId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${nombre} vuelve a estar activo`);
      router.refresh();
    });
  }

  if (!activo) {
    return (
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-12 px-5 text-base"
        onClick={confirmarAlta}
        disabled={pendiente}
      >
        {pendiente ? <Spinner className="size-5" /> : <UserCheck className="size-5" strokeWidth={2} />}
        Reincorporar
      </Button>
    );
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-12 px-5 text-base text-pendiente hover:text-pendiente"
        >
          <UserMinus className="size-5" strokeWidth={2} />
          Dar de baja
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Dar de baja a {nombre}</DialogTitle>
          <DialogDescription className="text-sm">
            Deja de figurar como activo y Portería ya no lo va a encontrar en el
            padrón. Sus ingresos anteriores se conservan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="fecha_egreso_baja" className="text-base">
            Fecha de egreso
          </Label>
          <Input
            id="fecha_egreso_baja"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="h-12 text-base md:text-base"
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-12 px-5 text-base"
            onClick={() => setAbierto(false)}
            disabled={pendiente}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="lg"
            className="h-12 px-5 text-base font-semibold"
            onClick={confirmarBaja}
            disabled={pendiente || !fecha}
          >
            {pendiente ? <Spinner className="size-5" /> : <UserMinus className="size-5" strokeWidth={2} />}
            Confirmar la baja
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
