"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { guardarSaldoInicial } from "@/lib/actions/tesoreria";
import { formatMoneda, hoyISO, type Moneda } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { llamarAccion } from "@/lib/llamar-accion";

const NOMBRE: Record<string, string> = {
  "efectivo-ARS": "Pesos en efectivo",
  "transferencia-ARS": "Pesos en el banco",
  "efectivo-USD": "Dólares en efectivo",
  "transferencia-USD": "Dólares en el banco",
};

/**
 * Saldo inicial de una cuenta (efectivo o banco) en una moneda: cuánta plata
 * había al comenzar el día elegido. El flujo de esa cuenta cuenta desde ese día.
 */
export function SaldoInicialForm({
  medio,
  moneda,
  monto,
  fecha,
  notas,
  alGuardar,
}: {
  medio: "efectivo" | "transferencia";
  moneda: Moneda;
  monto: number | null;
  fecha: string | null;
  notas: string | null;
  alGuardar?: () => void;
}) {
  const [montoStr, setMontoStr] = useState(monto === null ? "" : String(Math.round(monto)));
  const [fechaStr, setFechaStr] = useState(fecha ?? hoyISO());
  const [notasStr, setNotasStr] = useState(notas ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const montoNumero = Number(montoStr || 0);
  const nombre = NOMBRE[`${medio}-${moneda}`] ?? "Saldo";
  const idBase = `saldo-${medio}-${moneda}`;

  function guardar() {
    setError(null);
    startTransition(async () => {
      const res = await llamarAccion(() => guardarSaldoInicial(medio, moneda, montoNumero, fechaStr, notasStr.trim() || undefined));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`Guardaste ${nombre.toLowerCase()}: ${formatMoneda(montoNumero, moneda)}.`);
      alGuardar?.();
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idBase}-monto`} className="text-base">
          ¿Cuánto había?
        </Label>
        <Input
          id={`${idBase}-monto`}
          inputMode="numeric"
          autoComplete="off"
          value={montoStr}
          onChange={(e) => setMontoStr(e.target.value.replace(/\D/g, "").slice(0, 12))}
          placeholder="0"
          className="h-12 text-lg font-semibold tabular"
        />
        <p className="min-h-5 text-sm font-medium tabular text-muted-foreground">
          {montoStr !== "" ? formatMoneda(montoNumero, moneda) : ""}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idBase}-fecha`} className="text-base">
          Saldo al comenzar el día
        </Label>
        <Input
          id={`${idBase}-fecha`}
          type="date"
          max={hoyISO()}
          value={fechaStr}
          onChange={(e) => setFechaStr(e.target.value)}
          className="h-12 w-fit text-base"
        />
        <p className="text-sm text-muted-foreground">
          Desde ese día el sistema suma y resta todo lo que entra y sale.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idBase}-notas`} className="text-base">
          Nota <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input
          id={`${idBase}-notas`}
          value={notasStr}
          onChange={(e) => setNotasStr(e.target.value)}
          placeholder="Por ejemplo: arqueo del 01/09"
          className="h-12 text-base"
          maxLength={300}
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-pendiente">
          {error}
        </p>
      ) : null}

      <Button
        onClick={guardar}
        disabled={pendiente || montoStr === "" || fechaStr === ""}
        className="h-12 w-full px-6 text-base font-semibold"
      >
        {pendiente ? <Spinner className="size-5" /> : null}
        Guardar {nombre.toLowerCase()}
      </Button>
    </div>
  );
}
