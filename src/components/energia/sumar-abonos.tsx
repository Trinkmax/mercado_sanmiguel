"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlugZap } from "lucide-react";
import { toast } from "sonner";
import { sumarAbonosEnergia } from "@/lib/actions/facturacion";
import { formatARS, formatNumero } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { AlertaError } from "@/components/cobranza/alerta-error";
import { llamarAccion } from "@/lib/llamar-accion";

/** Cliente con medidor que todavía no tiene el abono del mes, y cuánto le toca. */
export type AbonoFaltante = { nombre: string; monto: number };

/** Cuántos nombres se listan en la confirmación antes de "y N más". */
const NOMBRES_A_LA_VISTA = 5;

/**
 * Medidores que se agregaron después de generar el mes (I1, §1.2-11): esos clientes todavía
 * no tienen el abono. Suma SOLO esos abonos (no genera expensas ni otros cargos del mes),
 * después de confirmar cuánto se suma. Solo para el mes en curso: en un mes viejo sería un
 * abono retroactivo. Es idempotente: tocar dos veces no duplica nada.
 */
export function SumarAbonos({
  periodo,
  mes,
  faltantes,
}: {
  periodo: string;
  /** "septiembre 2026" */
  mes: string;
  faltantes: AbonoFaltante[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const faltan = faltantes.length;
  const total = faltantes.reduce((acc, f) => acc + f.monto, 0);
  const nombres = faltantes.map((f) => f.nombre);
  const resumenNombres =
    faltan <= 3 ? nombres.join(", ") : `${nombres.slice(0, 2).join(", ")} y ${formatNumero(faltan - 2)} más`;

  function sumar() {
    setError(null);
    startTransition(async () => {
      const res = await llamarAccion(() => sumarAbonosEnergia({ periodo }));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const { abonos, monto } = res.data;
      toast.success(
        abonos > 0
          ? `Listo: se ${abonos === 1 ? "sumó 1 abono" : `sumaron ${formatNumero(abonos)} abonos`} de energía a ${mes} (${formatARS(monto)}).`
          : `Ya estaba todo: ${mes} no tenía abonos pendientes.`
      );
      setAbierto(false);
      router.refresh();
    });
  }

  return (
    <section
      aria-label="Abonos que faltan"
      className="flex flex-wrap items-center gap-4 rounded-xl bg-parcial-suave px-4 py-3.5 sm:px-5"
    >
      <PlugZap className="size-6 shrink-0 text-parcial" strokeWidth={2} aria-hidden />
      <div className="min-w-0 flex-1 basis-64">
        <p className="font-medium">
          {faltan === 1
            ? "1 cliente con medidor todavía no tiene el abono de este mes"
            : `${formatNumero(faltan)} clientes con medidor todavía no tienen el abono de este mes`}
        </p>
        <p className="text-sm break-words text-muted-foreground">
          {resumenNombres}. Se les agregó el medidor después de generar {mes}.
        </p>
      </div>
      <Dialog
        open={abierto}
        onOpenChange={(v) => {
          if (pendiente) return;
          setAbierto(v);
          if (!v) setError(null);
        }}
      >
        <DialogTrigger asChild>
          <Button size="lg" className="h-12 w-full px-5 text-base font-semibold sm:w-auto">
            <PlugZap className="size-5" strokeWidth={2} />
            {faltan === 1 ? "Sumarle el abono" : `Sumar los ${formatNumero(faltan)} abonos`}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-lg font-semibold">
              ¿Sumar {faltan === 1 ? "el abono" : `${formatNumero(faltan)} abonos`} a {mes}?
            </DialogTitle>
            <DialogDescription className="text-base">
              Se {faltan === 1 ? "suma 1 abono" : `suman ${formatNumero(faltan)} abonos`} de energía por{" "}
              <strong className="text-foreground">{formatARS(total)}</strong>, con el vencimiento del mes.
              No se agrega ningún otro cargo.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-48 divide-y overflow-y-auto rounded-lg border text-base">
            {faltantes.slice(0, NOMBRES_A_LA_VISTA).map((f, i) => (
              <li key={`${f.nombre}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0 break-words">{f.nombre}</span>
                <span className="shrink-0 font-medium tabular">{formatARS(f.monto)}</span>
              </li>
            ))}
            {faltan > NOMBRES_A_LA_VISTA ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                y {formatNumero(faltan - NOMBRES_A_LA_VISTA)} más
              </li>
            ) : null}
          </ul>
          {error ? <AlertaError error={error} titulo="No se pudieron sumar los abonos" /> : null}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="h-12 px-5 text-base"
              onClick={() => setAbierto(false)}
              disabled={pendiente}
            >
              No, dejarlo
            </Button>
            <Button className="h-12 px-5 text-base font-semibold" onClick={sumar} disabled={pendiente}>
              {pendiente ? <Spinner className="size-5" /> : <PlugZap className="size-5" strokeWidth={2} />}
              Sí, sumar {formatARS(total)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
