"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarX2 } from "lucide-react";
import { descontarSemanas } from "@/lib/actions/clientes";
import { cn } from "@/lib/utils";
import { formatARS, labelPeriodo } from "@/lib/format";
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

function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

function nombreMes(periodo: string): string {
  return labelPeriodo(periodo).split(" ")[0].toLowerCase();
}

function textoSemanas(n: number): string {
  return n === 1 ? "1 semana" : `${n} semanas`;
}

/** La quinta de un mes que todavía debe, para descontarle las semanas que no vino. */
export type QuintaDelMes = {
  cargoId: string;
  periodo: string;
  monto: number;
  pagado: number;
  /** clientes.cuotas_mes: en cuántas semanas se cobra la quinta. */
  cuotasMes: number;
  /** Las que ya se le descontaron a este mes. */
  semanasNoVino: number;
};

/**
 * Cuántas semanas se le pueden descontar y cuánto vale cada una (mismas cuentas que
 * descontar_semanas, 0058). Null si no hay nada que descontar.
 */
export function semanasDescontables(q: QuintaDelMes): { semana: number; debe: number; max: number } | null {
  const vigentes = q.cuotasMes - q.semanasNoVino;
  const debe = redondear2(q.monto - q.pagado);
  if (q.cuotasMes <= 1 || vigentes < 1 || debe <= 0.009) return null;
  const semana = redondear2(q.monto / vigentes);
  const max = Math.min(vigentes, Math.ceil(Math.round((debe / semana) * 10000) / 10000));
  return max >= 1 ? { semana, debe, max } : null;
}

/**
 * Pedido del mercado (02/11/2026): «se le cobra en cada una de las semanas que viene». Las
 * semanas que el quintero no vino no las debe, pero tampoco entra plata: se descuentan de la
 * quinta de ese mes y queda anotado quién lo hizo.
 */
export function NoVino({ clienteId, quinta }: { clienteId: string; quinta: QuintaDelMes }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [semanas, setSemanas] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const cuentas = semanasDescontables(quinta);
  if (!cuentas) return null;

  const mes = nombreMes(quinta.periodo);
  const Mes = mes.charAt(0).toUpperCase() + mes.slice(1);
  const descuento =
    semanas === null ? 0 : semanas === cuentas.max ? cuentas.debe : Math.min(redondear2(semanas * cuentas.semana), cuentas.debe);
  const montoNuevo = redondear2(quinta.monto - descuento);
  const debeNuevo = Math.max(redondear2(montoNuevo - quinta.pagado), 0);

  function descontar() {
    if (semanas === null) return;
    setError(null);
    startTransition(async () => {
      const res = await llamarAccion(() => descontarSemanas({ cargoId: quinta.cargoId, clienteId, semanas }));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`Listo: se le descontaron ${textoSemanas(semanas)} de ${mes}.`, {
        description:
          res.data.debe > 0.009
            ? `${Mes} queda en ${formatARS(res.data.montoNuevo)}: debe ${formatARS(res.data.debe)}.`
            : `${Mes} queda en ${formatARS(res.data.montoNuevo)}: no debe nada de ese mes.`,
      });
      setAbierto(false);
      setSemanas(null);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        if (pendiente) return;
        setAbierto(v);
        if (!v) {
          setSemanas(null);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="min-h-11 bg-card px-3 text-sm font-semibold">
          <CalendarX2 className="size-4" strokeWidth={2} />
          No vino alguna semana
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto p-6 sm:max-w-md">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-xl">¿Cuántas semanas de {mes} no vino?</DialogTitle>
          <DialogDescription className="text-base">
            La quinta de {mes} es{" "}
            <span className="font-semibold text-foreground tabular">{formatARS(quinta.monto)}</span>
            {quinta.semanasNoVino > 0 ? ` (ya se le descontaron ${textoSemanas(quinta.semanasNoVino)})` : ""}:{" "}
            <span className="font-semibold text-foreground tabular">{formatARS(cuentas.semana)}</span> por semana.
            {quinta.pagado > 0.009 ? ` Pagó ${formatARS(quinta.pagado)} y` : ""} debe{" "}
            <span className="font-semibold text-foreground tabular">{formatARS(cuentas.debe)}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Semanas que no vino">
          {Array.from({ length: cuentas.max }, (_, i) => i + 1).map((n) => (
            <Button
              key={n}
              type="button"
              variant="outline"
              aria-pressed={semanas === n}
              disabled={pendiente}
              onClick={() => setSemanas(n)}
              className={cn(
                "h-14 bg-card text-base font-semibold",
                semanas === n && "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
              )}
            >
              {textoSemanas(n)}
            </Button>
          ))}
        </div>

        {semanas !== null ? (
          <div className="space-y-1 rounded-lg border bg-muted/40 px-4 py-3">
            <p>
              Se le descuentan <span className="font-semibold tabular">{formatARS(descuento)}</span>.
            </p>
            <p className="text-sm text-muted-foreground">
              {montoNuevo <= 0.009
                ? `${Mes} queda en $ 0: no vino en todo el mes.`
                : debeNuevo > 0.009
                  ? `${Mes} queda en ${formatARS(montoNuevo)}: debe ${formatARS(debeNuevo)}.`
                  : `${Mes} queda en ${formatARS(montoNuevo)}: ya está pago.`}
            </p>
          </div>
        ) : null}

        <p className="text-sm text-muted-foreground">
          No es un cobro: no entra plata a la caja. En su cuenta queda anotado quién lo descontó y cuándo.
        </p>

        {error ? <AlertaError error={error} titulo="No se pudo descontar" /> : null}

        <DialogFooter className="gap-2">
          <Button variant="ghost" className="h-12 px-5 text-base" onClick={() => setAbierto(false)} disabled={pendiente}>
            Cancelar
          </Button>
          <Button className="h-12 px-5 text-base font-semibold" onClick={descontar} disabled={pendiente || semanas === null}>
            {pendiente ? <Spinner className="size-5" /> : <CalendarX2 className="size-5" strokeWidth={2} />}
            {semanas === null ? "Elegí las semanas" : `Descontar ${textoSemanas(semanas)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
