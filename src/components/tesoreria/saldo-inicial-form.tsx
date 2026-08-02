"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { guardarSaldoInicial } from "@/lib/actions/tesoreria";
import { formatARS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

/** Edición del saldo inicial de un medio (efectivo o banco). Solo tesorería. */
export function SaldoInicialForm({
  medio,
  monto,
  fecha,
  notas,
}: {
  medio: "efectivo" | "transferencia";
  monto: number | null;
  fecha: string | null;
  notas: string | null;
}) {
  const [montoStr, setMontoStr] = useState(
    monto === null ? "" : String(Math.round(monto))
  );
  const [fechaStr, setFechaStr] = useState(fecha ?? "");
  const [notasStr, setNotasStr] = useState(notas ?? "");
  const [pendiente, startTransition] = useTransition();

  const montoNumero = Number(montoStr);

  function guardar() {
    startTransition(async () => {
      const res = await guardarSaldoInicial(
        medio,
        montoNumero,
        fechaStr,
        notasStr.trim() || undefined
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        medio === "efectivo"
          ? "Saldo inicial de efectivo guardado."
          : "Saldo inicial del banco guardado."
      );
    });
  }

  const idBase = `saldo-${medio}`;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idBase}-monto`} className="text-sm">
          Monto que había
        </Label>
        <Input
          id={`${idBase}-monto`}
          inputMode="numeric"
          value={montoStr}
          onChange={(e) => setMontoStr(e.target.value.replace(/\D/g, ""))}
          placeholder="0"
          className="h-11 text-base tabular"
        />
        {montoStr !== "" ? (
          <p className="text-sm text-muted-foreground tabular">
            {formatARS(montoNumero)}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idBase}-fecha`} className="text-sm">
          Fecha
        </Label>
        <Input
          id={`${idBase}-fecha`}
          type="date"
          value={fechaStr}
          onChange={(e) => setFechaStr(e.target.value)}
          className="h-11 w-fit text-base"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idBase}-notas`} className="text-sm">
          Nota (opcional)
        </Label>
        <Input
          id={`${idBase}-notas`}
          value={notasStr}
          onChange={(e) => setNotasStr(e.target.value)}
          placeholder="Por ejemplo: arqueo del 01/07"
          className="h-11 text-base"
          maxLength={300}
        />
      </div>

      <Button
        onClick={guardar}
        disabled={pendiente || montoStr === "" || fechaStr === ""}
        className="h-11 w-full px-6 text-base font-semibold"
      >
        {pendiente ? <Spinner className="size-5" /> : null}
        Guardar saldo
      </Button>
    </div>
  );
}
