"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Landmark } from "lucide-react";
import { formatARS, hoyISO } from "@/lib/format";
import type { ActionResult } from "@/lib/actions/result";
import {
  depositarCheque,
  acreditarCheque,
  rechazarCheque,
} from "@/lib/actions/cheques";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

type Cheque = {
  id: string;
  numero: string;
  banco: string | null;
  monto: number;
  estado: string;
};

type Dialogo = "depositar" | "acreditar" | "rechazar" | null;

/** Acciones del ciclo de vida de un cheque (solo admin y tesorería las ven). */
export function AccionesCheque({ cheque }: { cheque: Cheque }) {
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [fecha, setFecha] = useState(hoyISO());
  const [pendiente, startTransition] = useTransition();

  function abrir(cual: Dialogo) {
    setFecha(hoyISO());
    setDialogo(cual);
  }

  function ejecutar(accion: () => Promise<ActionResult>, exito: string) {
    startTransition(async () => {
      const res = await accion();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(exito);
      setDialogo(null);
    });
  }

  const descripcionCheque = `cheque N° ${cheque.numero}${cheque.banco ? ` del ${cheque.banco}` : ""} por ${formatARS(cheque.monto)}`;

  return (
    <>
      <div className="flex justify-end gap-2">
        {cheque.estado === "en_cartera" ? (
          <Button className="h-11 px-4 font-semibold" onClick={() => abrir("depositar")}>
            Depositar
          </Button>
        ) : null}
        {cheque.estado === "depositado" ? (
          <Button className="h-11 px-4 font-semibold" onClick={() => abrir("acreditar")}>
            Se acreditó
          </Button>
        ) : null}
        {cheque.estado === "en_cartera" || cheque.estado === "depositado" ? (
          <Button
            variant="outline"
            className="h-11 px-4 text-destructive hover:text-destructive"
            onClick={() => abrir("rechazar")}
          >
            Rechazar
          </Button>
        ) : null}
      </div>

      {/* Depositar */}
      <Dialog open={dialogo === "depositar"} onOpenChange={(o) => !o && setDialogo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Depositar cheque</DialogTitle>
            <DialogDescription>
              Vas a depositar el {descripcionCheque}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor={`fecha-deposito-${cheque.id}`} className="text-base">
                ¿Qué día lo depositás?
              </Label>
              <Input
                id={`fecha-deposito-${cheque.id}`}
                type="date"
                className="h-11"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            <p className="flex items-center gap-2 rounded-md bg-parcial-suave px-3 py-2.5 text-sm font-medium text-parcial">
              <Landmark className="size-4 shrink-0" strokeWidth={2} />
              Impacta en el banco en ~72 h.
            </p>
          </div>
          <DialogFooter>
            <Button
              size="lg"
              className="h-12 w-full font-semibold"
              disabled={pendiente || !fecha}
              onClick={() =>
                ejecutar(
                  () => depositarCheque({ id: cheque.id, fecha }),
                  "Cheque depositado."
                )
              }
            >
              {pendiente ? <Spinner /> : null}
              Depositar cheque
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Acreditar */}
      <Dialog open={dialogo === "acreditar"} onOpenChange={(o) => !o && setDialogo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar acreditación</DialogTitle>
            <DialogDescription>
              La plata del {descripcionCheque} ya está en el banco.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`fecha-acreditado-${cheque.id}`} className="text-base">
              ¿Qué día se acreditó?
            </Label>
            <Input
              id={`fecha-acreditado-${cheque.id}`}
              type="date"
              className="h-11"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              size="lg"
              className="h-12 w-full font-semibold"
              disabled={pendiente || !fecha}
              onClick={() =>
                ejecutar(
                  () => acreditarCheque({ id: cheque.id, fecha }),
                  "Cheque acreditado."
                )
              }
            >
              {pendiente ? <Spinner /> : null}
              Confirmar acreditación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rechazar */}
      <Dialog open={dialogo === "rechazar"} onOpenChange={(o) => !o && setDialogo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Rechazar el cheque N° {cheque.numero}?</DialogTitle>
            <DialogDescription>
              El {descripcionCheque} queda marcado como rechazado. Esta acción no
              se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="h-12"
              disabled={pendiente}
              onClick={() => setDialogo(null)}
            >
              No, volver
            </Button>
            <Button
              variant="destructive"
              size="lg"
              className="h-12 font-semibold"
              disabled={pendiente}
              onClick={() =>
                ejecutar(() => rechazarCheque({ id: cheque.id }), "Cheque rechazado.")
              }
            >
              {pendiente ? <Spinner /> : null}
              Rechazar cheque
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
