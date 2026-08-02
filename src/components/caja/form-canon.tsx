"use client";

import { useState, useTransition } from "react";
import { Truck } from "lucide-react";
import { toast } from "sonner";
import { cargarCanon } from "@/lib/actions/cajas";
import { formatARS, MEDIOS_SIN_CHEQUE } from "@/lib/format";
import { Button } from "@/components/ui/button";
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
import type { MedioPago } from "@/components/caja/medios";

function soloDigitos(v: string): string {
  return v.replace(/\D/g, "");
}

/**
 * Carga inline del canon: cantidad, monto (precargado cantidad × precio,
 * editable), medio y notas. Sin modal: es la tarea de todos los días.
 */
export function FormCanon({
  cajaId,
  precioCanon,
}: {
  cajaId: string;
  precioCanon: number;
}) {
  const [cantidad, setCantidad] = useState("1");
  const [monto, setMonto] = useState(String(precioCanon > 0 ? precioCanon : ""));
  const [montoEditado, setMontoEditado] = useState(false);
  const [medio, setMedio] = useState<MedioPago>("efectivo");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, startTransition] = useTransition();

  function reiniciar() {
    setCantidad("1");
    setMonto(String(precioCanon > 0 ? precioCanon : ""));
    setMontoEditado(false);
    setMedio("efectivo");
    setNotas("");
    setError(null);
  }

  function cambiarCantidad(v: string) {
    const limpio = soloDigitos(v);
    setCantidad(limpio);
    if (!montoEditado && precioCanon > 0) {
      const n = Number(limpio || 0);
      setMonto(n > 0 ? String(n * precioCanon) : "");
    }
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const nCantidad = Number(cantidad || 0);
    const nMonto = Number(monto || 0);
    if (nCantidad < 1) {
      setError("Poné cuántos camiones entraron.");
      return;
    }
    if (nMonto <= 0) {
      setError("Poné el monto cobrado.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await cargarCanon({
        cajaId,
        cantidad: nCantidad,
        monto: nMonto,
        medio,
        notas: notas.trim() || undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Canon cargado: ${nCantidad} ${nCantidad === 1 ? "camión" : "camiones"} por ${formatARS(nMonto)}.`
      );
      reiniciar();
    });
  }

  return (
    <form
      onSubmit={enviar}
      className="space-y-3 rounded-lg border border-dashed p-4"
    >
      <div className="grid items-end gap-3 sm:grid-cols-[6rem_minmax(9rem,1fr)_11rem_minmax(8rem,1fr)_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="canon-cantidad" className="text-sm">
            Camiones
          </Label>
          <Input
            id="canon-cantidad"
            inputMode="numeric"
            value={cantidad}
            onChange={(e) => cambiarCantidad(e.target.value)}
            className="h-12 text-base md:text-base tabular"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="canon-monto" className="text-sm">
            Monto
          </Label>
          <Input
            id="canon-monto"
            inputMode="numeric"
            value={monto}
            onChange={(e) => {
              setMonto(soloDigitos(e.target.value));
              setMontoEditado(true);
            }}
            placeholder="0"
            className="h-12 text-base md:text-base tabular"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="canon-medio" className="text-sm">
            Medio
          </Label>
          <Select value={medio} onValueChange={(v) => setMedio(v as MedioPago)}>
            <SelectTrigger
              id="canon-medio"
              className="h-12! w-full text-base"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEDIOS_SIN_CHEQUE.map((m) => (
                <SelectItem key={m.valor} value={m.valor} className="min-h-11 text-base">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="canon-notas" className="text-sm">
            Notas <span className="text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="canon-notas"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Ej.: camión de Rodríguez"
            className="h-12 text-base md:text-base"
          />
        </div>
        <Button
          type="submit"
          size="lg"
          disabled={enviando}
          className="h-12 px-5 text-base font-semibold"
        >
          {enviando ? (
            <Spinner className="size-5" />
          ) : (
            <Truck className="size-5" strokeWidth={2} />
          )}
          Cargar canon
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {Number(monto || 0) > 0 ? (
              <>Vas a cargar {formatARS(Number(monto))}.</>
            ) : precioCanon > 0 ? (
              <>El canon por camión es {formatARS(precioCanon)}.</>
            ) : null}
          </p>
        )}
      </div>
    </form>
  );
}
