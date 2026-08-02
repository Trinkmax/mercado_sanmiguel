"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { formatARS, hoyISO, MEDIOS_SIN_CHEQUE } from "@/lib/format";
import type { ActionResult } from "@/lib/actions/result";
import { pagarGasto, anularGasto } from "@/lib/actions/gastos";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type Gasto = { id: string; descripcion: string; monto: number };
type Dialogo = "pagar" | "anular" | null;

/** Acciones de un gasto pendiente: pagarlo o anularlo. */
export function AccionesGasto({
  gasto,
  hayCajaAbierta,
}: {
  gasto: Gasto;
  hayCajaAbierta: boolean;
}) {
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [fecha, setFecha] = useState(hoyISO());
  const [medio, setMedio] = useState<"efectivo" | "transferencia">("efectivo");
  const [origen, setOrigen] = useState<"caja" | "tesoreria">(
    hayCajaAbierta ? "caja" : "tesoreria"
  );
  const [pendiente, startTransition] = useTransition();

  function abrir(cual: Dialogo) {
    setFecha(hoyISO());
    setMedio("efectivo");
    setOrigen(hayCajaAbierta ? "caja" : "tesoreria");
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

  return (
    <>
      <div className="flex justify-end gap-2">
        <Button className="h-11 px-4 font-semibold" onClick={() => abrir("pagar")}>
          Pagar
        </Button>
        <Button
          variant="outline"
          className="h-11 px-4 text-destructive hover:text-destructive"
          onClick={() => abrir("anular")}
        >
          Anular
        </Button>
      </div>

      {/* Pagar */}
      <Dialog open={dialogo === "pagar"} onOpenChange={(o) => !o && setDialogo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pagar gasto</DialogTitle>
            <DialogDescription>
              {gasto.descripcion} · {formatARS(gasto.monto)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor={`fecha-pago-${gasto.id}`} className="text-base">
                ¿Qué día se pagó?
              </Label>
              <Input
                id={`fecha-pago-${gasto.id}`}
                type="date"
                className="h-11"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-base">Medio de pago</Label>
              <Select
                value={medio}
                onValueChange={(v) => setMedio(v as typeof medio)}
              >
                <SelectTrigger className="min-h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEDIOS_SIN_CHEQUE.map((m) => (
                    <SelectItem key={m.valor} value={m.valor}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-base">¿De dónde sale la plata?</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => hayCajaAbierta && setOrigen("caja")}
                  disabled={!hayCajaAbierta}
                  aria-pressed={origen === "caja"}
                  className={cn(
                    "h-11 rounded-md border text-sm font-medium transition-colors",
                    origen === "caja"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-card hover:bg-accent",
                    !hayCajaAbierta && "cursor-not-allowed opacity-50 hover:bg-card"
                  )}
                >
                  Caja del día
                </button>
                <button
                  type="button"
                  onClick={() => setOrigen("tesoreria")}
                  aria-pressed={origen === "tesoreria"}
                  className={cn(
                    "h-11 rounded-md border text-sm font-medium transition-colors",
                    origen === "tesoreria"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-card hover:bg-accent"
                  )}
                >
                  Tesorería
                </button>
              </div>
              {!hayCajaAbierta ? (
                <p className="text-sm text-muted-foreground">
                  No hay una caja de administración abierta hoy: sale de tesorería.
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button
              size="lg"
              className="h-12 w-full font-semibold"
              disabled={pendiente || !fecha}
              onClick={() =>
                ejecutar(
                  () => pagarGasto({ id: gasto.id, fecha, medio, origen }),
                  "Gasto pagado."
                )
              }
            >
              {pendiente ? <Spinner /> : null}
              Registrar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Anular */}
      <Dialog open={dialogo === "anular"} onOpenChange={(o) => !o && setDialogo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Anular este gasto?</DialogTitle>
            <DialogDescription>
              {gasto.descripcion} · {formatARS(gasto.monto)}. Queda registrado
              como anulado y no suma en el mes.
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
                ejecutar(() => anularGasto({ id: gasto.id }), "Gasto anulado.")
              }
            >
              {pendiente ? <Spinner /> : null}
              Anular gasto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
