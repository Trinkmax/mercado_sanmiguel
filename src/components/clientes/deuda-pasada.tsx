"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, History, TriangleAlert } from "lucide-react";
import { registrarDeudaPasada } from "@/lib/actions/clientes";
import { formatARS, parseMonto, redondear2, sanitizarMonto } from "@/lib/format";
import { cn } from "@/lib/utils";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Money } from "@/components/shared/money";
import { AlertaError } from "@/components/cobranza/alerta-error";
import { montoConMiles } from "@/components/cobranza/tipos";
import { llamarAccion } from "@/lib/llamar-accion";

/**
 * «Deuda pasada» de la ficha (pedido del mercado del 28/10/2026): lo que el cliente debía antes
 * de empezar con el sistema, con el monto que diga Administración, sin fechas ni períodos (ver
 * @/lib/deuda-pasada). Antes de confirmar se ve cómo queda su cuenta: si tenía saldo a favor
 * (pagos que en realidad eran para esa deuda), se usa en el acto. Si ya tiene una cargada, lo
 * avisa para no cargarla dos veces.
 */
export function DeudaPasada({
  clienteId,
  nombre,
  deuda,
  saldoFavor,
  primerMes,
  cargada,
}: {
  clienteId: string;
  nombre: string;
  /** «Debe hoy» de la ficha. */
  deuda: number;
  saldoFavor: number;
  /** "octubre de 2026": el primer mes del sistema. */
  primerMes: string;
  /** La deuda pasada que ya tiene cargada (sin las anuladas); 0 si no tiene. */
  cargada: number;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [montoTexto, setMontoTexto] = useState("");
  const [detalle, setDetalle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const monto = redondear2(parseMonto(montoTexto));
  const hayMonto = monto > 0;
  // Lo mismo que hace la base (aplicar_saldo_favor): el saldo a favor cubre la deuda, la más
  // vieja primero, y la deuda pasada es la más vieja de todas.
  const usa = redondear2(Math.min(saldoFavor, deuda + monto));
  const debeDespues = redondear2(deuda + monto - usa);
  const favorDespues = redondear2(saldoFavor - usa);

  function limpiar() {
    setMontoTexto("");
    setDetalle("");
    setError(null);
  }

  function cargar() {
    if (!hayMonto) return;
    setError(null);
    startTransition(async () => {
      const res = await llamarAccion(() =>
        registrarDeudaPasada({ clienteId, monto, detalle: detalle.trim() || undefined })
      );
      if (!res.ok) {
        // Lo cargado queda en el diálogo. Tocar de nuevo no la duplica (la acción la reconoce).
        setError(res.error);
        return;
      }
      const { aplicado, repetido } = res.data;
      if (repetido) {
        toast.info("Esa deuda pasada ya estaba cargada: no se cargó dos veces.");
      } else if (aplicado === null) {
        toast.warning(`Deuda pasada de ${formatARS(monto)} cargada.`, {
          description: "No se pudo descontar su saldo a favor: tocá «Aplicar saldo a favor» en la ficha.",
        });
      } else {
        toast.success(`Deuda pasada de ${formatARS(monto)} cargada.`, {
          description:
            aplicado > 0.009
              ? `Se cubrieron ${formatARS(aplicado)} con su saldo a favor. Si te equivocaste, anulala desde «Cuenta».`
              : "Ya se puede cobrar. Si te equivocaste, anulala desde «Cuenta».",
        });
      }
      setAbierto(false);
      limpiar();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        if (pendiente) return;
        setAbierto(v);
        if (!v) limpiar();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="h-12 px-5 text-base" data-tour="clientes-deuda-pasada">
          <History className="size-5" strokeWidth={1.9} />
          Deuda pasada
        </Button>
      </DialogTrigger>
      {/* minmax(0,1fr): nada (ni un monto largo en el botón) ensancha el diálogo más allá de la pantalla. */}
      <DialogContent className="max-h-[92dvh] grid-cols-[minmax(0,1fr)] gap-5 overflow-y-auto p-6 sm:max-w-md">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-xl">Deuda pasada</DialogTitle>
          <DialogDescription className="text-base">
            Lo que {nombre} debía antes de {primerMes}, cuando arrancó el sistema. Se carga una sola
            vez: después su cuenta sigue al día mes a mes.
          </DialogDescription>
        </DialogHeader>

        {cargada > 0.009 ? (
          <p className="flex items-start gap-2 rounded-lg border border-parcial bg-parcial-suave px-3 py-2.5 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-parcial" strokeWidth={2} />
            <span>
              Ya tiene cargada una deuda pasada de <Money monto={cargada} className="font-semibold" />. Si es
              otra deuda, sumala acá; si te equivocaste en el monto, anulá la anterior desde «Cuenta».
            </span>
          </p>
        ) : null}

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="deuda-pasada-monto" className="text-base font-medium">
              ¿Cuánto debía?
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-2xl font-semibold text-muted-foreground">
                $
              </span>
              <Input
                id="deuda-pasada-monto"
                inputMode="decimal"
                placeholder="0"
                autoComplete="off"
                autoFocus
                value={montoTexto}
                onChange={(e) => {
                  setMontoTexto(sanitizarMonto(e.target.value));
                  if (error) setError(null);
                }}
                onBlur={() => setMontoTexto((v) => (v ? montoConMiles(parseMonto(v)) : v))}
                className="h-14 pl-10 text-2xl font-semibold tabular md:text-2xl"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deuda-pasada-detalle" className="text-base font-medium">
              ¿De qué era? <span className="font-normal text-muted-foreground">(si querés)</span>
            </Label>
            <Input
              id="deuda-pasada-detalle"
              value={detalle}
              maxLength={120}
              autoComplete="off"
              onChange={(e) => setDetalle(e.target.value)}
              placeholder="Ej.: expensas de agosto y septiembre"
              className="h-12 text-base md:text-base"
            />
          </div>

          {hayMonto ? (
            <div className="space-y-2 rounded-lg border bg-muted/40 px-4 py-3" aria-live="polite">
              <p className="text-sm font-medium text-muted-foreground">Cómo queda su cuenta</p>
              <dl className="space-y-1.5 text-base">
                <Renglon etiqueta="Deuda pasada">
                  <Money monto={monto} className="font-semibold" />
                </Renglon>
                {usa > 0.009 ? (
                  <Renglon etiqueta="Se cubre con su saldo a favor">
                    <span className="font-semibold text-pagado tabular">−{formatARS(usa)}</span>
                  </Renglon>
                ) : null}
                <div className="space-y-1.5 border-t pt-2">
                  <Renglon etiqueta="Debe hoy">
                    <AntesDespues
                      antes={deuda}
                      despues={debeDespues}
                      claseDespues={debeDespues > 0.009 ? "text-pendiente" : "text-pagado"}
                    />
                  </Renglon>
                  {saldoFavor > 0.009 ? (
                    <Renglon etiqueta="Saldo a favor">
                      <AntesDespues
                        antes={saldoFavor}
                        despues={favorDespues}
                        claseDespues={favorDespues > 0.009 ? "text-pagado" : "text-muted-foreground"}
                      />
                    </Renglon>
                  ) : null}
                </div>
              </dl>
            </div>
          ) : null}
        </div>

        {error ? <AlertaError error={error} titulo="No se pudo cargar" /> : null}

        {/* Una acción grande a todo el ancho (con el monto, que puede ser largo) y, abajo, salir. */}
        <DialogFooter className="gap-2 sm:flex-col sm:justify-start">
          <Button
            size="lg"
            className="h-auto min-h-12 w-full px-5 py-2 text-base font-semibold whitespace-normal"
            disabled={pendiente || !hayMonto}
            onClick={cargar}
          >
            {pendiente ? <Spinner className="size-5" /> : null}
            {hayMonto ? `Cargar deuda pasada de ${formatARS(monto)}` : "Cargar deuda pasada"}
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="h-11 w-full text-base text-muted-foreground"
            onClick={() => setAbierto(false)}
            disabled={pendiente}
          >
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Renglon({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
      <dt className="text-muted-foreground">{etiqueta}</dt>
      {/* ml-auto: si no entra en el renglón, el monto baja pero sigue a la derecha. */}
      <dd className="ml-auto text-right">{children}</dd>
    </div>
  );
}

/** "$ 0 → $ 1.108.800": cómo estaba y cómo queda, lo nuevo resaltado. */
function AntesDespues({ antes, despues, claseDespues }: { antes: number; despues: number; claseDespues: string }) {
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-x-1.5 tabular">
      <span className="text-muted-foreground">{formatARS(antes)}</span>
      <ArrowRight className="size-4 text-muted-foreground" strokeWidth={2} aria-label="queda en" />
      <span className={cn("font-bold", claseDespues)}>{formatARS(despues)}</span>
    </span>
  );
}
