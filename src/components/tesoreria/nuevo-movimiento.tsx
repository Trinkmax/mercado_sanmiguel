"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { crearMovimiento } from "@/lib/actions/tesoreria";
import { formatARS, hoyISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

const TIPOS = [
  { valor: "impuesto", label: "Impuesto" },
  { valor: "comision", label: "Comisión" },
  { valor: "ajuste", label: "Ajuste" },
] as const;

type Tipo = (typeof TIPOS)[number]["valor"];

/** Alta de un movimiento bancario (impuesto, comisión o ajuste). Solo tesorería. */
export function NuevoMovimiento() {
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<Tipo>("impuesto");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [resta, setResta] = useState(true);
  const [fecha, setFecha] = useState(hoyISO());
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const montoNumero = Number(monto);

  function limpiar() {
    setTipo("impuesto");
    setDescripcion("");
    setMonto("");
    setResta(true);
    setFecha(hoyISO());
    setError(null);
  }

  function guardar() {
    setError(null);
    startTransition(async () => {
      const res = await crearMovimiento({
        tipo,
        descripcion,
        monto: montoNumero,
        resta: tipo === "ajuste" ? resta : undefined,
        fecha,
      });
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success("Movimiento registrado.");
      limpiar();
      setAbierto(false);
    });
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (!v) limpiar();
      }}
    >
      <DialogTrigger asChild>
        <Button className="h-11 px-5 text-base font-semibold">
          <Plus className="size-5" strokeWidth={2} />
          Registrar movimiento
        </Button>
      </DialogTrigger>
      <DialogContent className="text-sm sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Registrar movimiento bancario</DialogTitle>
          <DialogDescription className="text-sm">
            Impuestos y comisiones que el banco descuenta, o un ajuste del saldo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="mov-tipo" className="text-sm">
              Tipo
            </Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
              <SelectTrigger id="mov-tipo" className="h-11 w-full px-3 text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t.valor} value={t.valor} className="min-h-11 text-base">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {tipo === "ajuste" ? (
            <div className="space-y-2">
              <Label className="text-sm">El ajuste…</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={resta ? "default" : "outline"}
                  onClick={() => setResta(true)}
                  className={cn("h-11 text-base", resta && "font-semibold")}
                >
                  Resta del banco
                </Button>
                <Button
                  type="button"
                  variant={!resta ? "default" : "outline"}
                  onClick={() => setResta(false)}
                  className={cn("h-11 text-base", !resta && "font-semibold")}
                >
                  Suma al banco
                </Button>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="mov-descripcion" className="text-sm">
              Descripción
            </Label>
            <Input
              id="mov-descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Por ejemplo: IIBB SIRCREB"
              className="h-11 text-base"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mov-monto" className="text-sm">
              Monto
            </Label>
            <Input
              id="mov-monto"
              inputMode="numeric"
              value={monto}
              onChange={(e) => setMonto(e.target.value.replace(/\D/g, ""))}
              placeholder="0"
              className="h-11 text-base tabular"
            />
            {montoNumero > 0 ? (
              <p className="text-sm text-muted-foreground tabular">
                {tipo === "ajuste" && !resta ? "" : "− "}
                {formatARS(montoNumero)}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="mov-fecha" className="text-sm">
              Fecha
            </Label>
            <Input
              id="mov-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="h-11 w-fit text-base"
            />
          </div>

          {error ? <p className="text-sm font-medium text-pendiente">{error}</p> : null}
        </div>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline" className="h-11 px-5 text-base">
              Cancelar
            </Button>
          </DialogClose>
          <Button
            onClick={guardar}
            disabled={pendiente}
            className="h-11 px-6 text-base font-semibold"
          >
            {pendiente ? <Spinner className="size-5" /> : null}
            Guardar movimiento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
