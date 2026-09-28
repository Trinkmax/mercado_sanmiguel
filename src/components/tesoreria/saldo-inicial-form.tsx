"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { guardarSaldoInicial } from "@/lib/actions/tesoreria";
import { formatFecha, formatMoneda, hoyISO, montoATexto, parseMonto, sanitizarMonto, type Moneda } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { AlertaError } from "@/components/cobranza/alerta-error";
import { llamarAccion } from "@/lib/llamar-accion";

const NOMBRE: Record<string, string> = {
  "efectivo-ARS": "Pesos en efectivo",
  "transferencia-ARS": "Pesos en el banco",
  "efectivo-USD": "Dólares en efectivo",
  "transferencia-USD": "Dólares en el banco",
};

const MOTIVOS = ["Me equivoqué al cargarlo", "El arqueo daba otro número", "Cambió el día de inicio"];

/** Monto del saldo → texto del input ("0" es un saldo válido: la cuenta arranca vacía). */
function textoInicial(monto: number | null): string {
  if (monto === null) return "";
  return monto === 0 ? "0" : montoATexto(monto);
}

/**
 * Saldo inicial de una cuenta (efectivo o banco) en una moneda: cuánta plata
 * había al comenzar el día elegido. El flujo de esa cuenta cuenta desde ese día.
 * Corregir el monto o el día de un saldo ya cargado pide el motivo (queda el rastro
 * del valor anterior y lo ve el Líder).
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
  const [montoStr, setMontoStr] = useState(textoInicial(monto));
  const [fechaStr, setFechaStr] = useState(fecha ?? hoyISO());
  const [notasStr, setNotasStr] = useState(notas ?? "");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const montoNumero = parseMonto(montoStr);
  const nombre = NOMBRE[`${medio}-${moneda}`] ?? "Saldo";
  const idBase = `saldo-${medio}-${moneda}`;
  const esCorreccion = monto !== null && fecha !== null;
  const cambiaPlata =
    esCorreccion && (Math.abs(montoNumero - (monto ?? 0)) >= 0.005 || fechaStr !== fecha);
  const faltaMotivo = cambiaPlata && motivo.trim().length < 3;

  function guardar() {
    setError(null);
    startTransition(async () => {
      const res = await llamarAccion(() =>
        guardarSaldoInicial(
          medio,
          moneda,
          montoNumero,
          fechaStr,
          notasStr.trim() || undefined,
          cambiaPlata ? motivo.trim() : undefined
        )
      );
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(
        res.data.corregido
          ? `Corregiste ${nombre.toLowerCase()}: ahora ${formatMoneda(montoNumero, moneda)}.`
          : `Guardaste ${nombre.toLowerCase()}: ${formatMoneda(montoNumero, moneda)}.`
      );
      setMotivo("");
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
          inputMode="decimal"
          autoComplete="off"
          value={montoStr}
          onChange={(e) => {
            setMontoStr(sanitizarMonto(e.target.value).slice(0, 15));
            setError(null);
          }}
          placeholder="0"
          className="h-12 text-lg font-semibold tabular"
        />
        <p className="min-h-5 text-sm font-medium tabular text-muted-foreground">
          {montoStr !== "" ? formatMoneda(montoNumero, moneda) : "Los centavos van con coma: 1234,50"}
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
          onChange={(e) => {
            setFechaStr(e.target.value);
            setError(null);
          }}
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

      {cambiaPlata ? (
        <div className="space-y-3 rounded-xl border border-parcial/40 bg-parcial-suave/50 p-3">
          <p className="text-sm font-medium">
            Estás cambiando {formatMoneda(monto ?? 0, moneda)} del {formatFecha(fecha)} por{" "}
            {formatMoneda(montoNumero, moneda)}
            {fechaStr !== fecha && fechaStr ? ` del ${formatFecha(fechaStr)}` : ""}. Queda anotado con tu
            nombre.
          </p>
          <Label htmlFor={`${idBase}-motivo`} className="text-base">
            ¿Por qué lo corregís?
          </Label>
          <div className="flex flex-wrap gap-2">
            {MOTIVOS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMotivo(m)}
                aria-pressed={motivo === m}
                className={cn(
                  "min-h-11 rounded-full border px-4 text-sm font-medium",
                  motivo === m ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <Textarea
            id={`${idBase}-motivo`}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="O contalo con tus palabras"
            className="min-h-16 bg-card text-base"
            maxLength={300}
          />
        </div>
      ) : null}

      {error ? <AlertaError error={error} titulo="No se pudo guardar el saldo" /> : null}

      <Button
        onClick={guardar}
        disabled={pendiente || montoStr === "" || fechaStr === "" || faltaMotivo}
        className="h-auto min-h-12 w-full px-6 py-2.5 text-base leading-snug font-semibold whitespace-normal"
      >
        {pendiente ? <Spinner className="size-5" /> : null}
        {cambiaPlata ? `Corregir ${nombre.toLowerCase()}` : `Guardar ${nombre.toLowerCase()}`}
      </Button>
    </div>
  );
}
