"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, Check, TriangleAlert } from "lucide-react";
import { cargarMesAnterior } from "@/lib/actions/clientes";
import { formatARS, formatFecha, labelPeriodo, redondear2, saldoCargo } from "@/lib/format";
import type { MesParaCargar } from "@/lib/mes-anterior";
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
import { Spinner } from "@/components/ui/spinner";
import { Money } from "@/components/shared/money";
import { AlertaError } from "@/components/cobranza/alerta-error";
import { DescripcionCargo } from "@/components/cobranza/descripcion-cargo";
import { AntesDespues, Renglon } from "@/components/clientes/deuda-pasada";
import { llamarAccion } from "@/lib/llamar-accion";

/** "2026-10-01" → "octubre" */
function nombreMes(periodo: string): string {
  return labelPeriodo(periodo).split(" ")[0].toLowerCase();
}

/**
 * «Cargar un mes anterior» de la cuenta (pedido de Franco del 20/11/2026, ver @/lib/mes-anterior):
 * alguien que ya estaba en el mercado y un mes no se le facturó. Se elige el mes (solo los ya
 * generados en los que le falta algo) y se ve qué se le carga —lo que dice hoy su carpeta— y
 * cómo queda su cuenta antes de confirmar. Vence junto con el mes en curso, así lo paga con
 * este mes y mantiene el beneficio. Si se cargó de más, se anula desde «Cuenta».
 */
export function CargarMesAnterior({
  clienteId,
  nombre,
  meses,
  mesEnCurso,
  vencimiento,
  deuda,
  saldoFavor,
  hoy,
}: {
  clienteId: string;
  nombre: string;
  /** Los meses que se le pueden cargar, del más nuevo al más viejo (nunca vacío). */
  meses: MesParaCargar[];
  /** El mes en curso ("2026-11-01") y cuándo vence: lo que se cargue vence ese día. */
  mesEnCurso: string;
  vencimiento: string;
  /** «Debe hoy» y saldo a favor de la ficha. */
  deuda: number;
  saldoFavor: number;
  hoy: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [periodo, setPeriodo] = useState(meses[0]?.periodo ?? "");
  // Lo que NO se carga del mes elegido (por defecto se carga todo lo que le falta).
  const [sacados, setSacados] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const mes = meses.find((m) => m.periodo === periodo) ?? meses[0];
  if (!mes) return null;

  const elegidos = mes.renglones.filter((r) => !sacados.has(r.codigo));
  const total = redondear2(elegidos.reduce((acc, r) => acc + r.monto, 0));
  // Lo exigible hoy de lo que se carga: con el beneficio si el mes en curso todavía no venció.
  const exigible = redondear2(
    elegidos.reduce(
      (acc, r) =>
        acc +
        saldoCargo(
          { estado: "pendiente", monto: r.monto, monto_pagado: 0, descuento_pronto_pago: r.beneficio, vencimiento },
          hoy
        ),
      0
    )
  );
  const enTermino = hoy <= vencimiento;
  const beneficio = redondear2(total - exigible);
  // Lo mismo que hace la base después de cargar: el saldo a favor cubre lo más viejo primero.
  const usa = redondear2(Math.min(saldoFavor, deuda + exigible));
  const debeDespues = redondear2(deuda + exigible - usa);
  const favorDespues = redondear2(saldoFavor - usa);
  const hayAlgo = elegidos.length > 0;
  const titulo = labelPeriodo(mes.periodo);

  function limpiar() {
    setPeriodo(meses[0]?.periodo ?? "");
    setSacados(new Set());
    setError(null);
  }

  function cargar() {
    if (!hayAlgo) return;
    setError(null);
    startTransition(async () => {
      const res = await llamarAccion(() =>
        cargarMesAnterior({ clienteId, periodo: mes.periodo, codigos: elegidos.map((r) => r.codigo) })
      );
      if (!res.ok) {
        // Lo elegido queda en el diálogo. Tocar de nuevo no lo duplica (la acción lo reconoce).
        setError(res.error);
        return;
      }
      const { cargados, aplicado } = res.data;
      const vence = `Vence el ${formatFecha(res.data.vencimiento)}, junto con ${nombreMes(mesEnCurso)}.`;
      if (cargados === 0) {
        toast.info(`${titulo} ya estaba cargado: no se cargó dos veces.`);
      } else if (aplicado === null) {
        toast.warning(`${titulo} cargado: ${formatARS(res.data.total)}.`, {
          description: "No se pudo descontar su saldo a favor: tocá «Aplicar saldo a favor» en la ficha.",
        });
      } else {
        toast.success(`${titulo} cargado: ${formatARS(res.data.total)}.`, {
          description:
            aplicado > 0.009
              ? `Se cubrieron ${formatARS(aplicado)} con su saldo a favor. ${vence}`
              : `${vence} Si te equivocaste, anulalo desde «Cuenta».`,
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
        <Button variant="outline" className="min-h-11 text-sm" data-tour="clientes-mes-anterior">
          <CalendarPlus className="size-4" strokeWidth={1.9} />
          Cargar un mes anterior
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] grid-cols-[minmax(0,1fr)] gap-5 overflow-y-auto p-6 sm:max-w-md">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-xl">Cargar un mes anterior</DialogTitle>
          <DialogDescription className="text-base">
            Para cuando {nombre} ya estaba en el mercado y un mes no se le facturó. Se le carga lo que dice hoy su
            carpeta y lo paga <strong className="font-semibold text-foreground">junto con {nombreMes(mesEnCurso)}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {meses.length > 1 ? (
            <fieldset className="space-y-2">
              <legend className="mb-2 text-base font-medium">¿Qué mes?</legend>
              <div role="radiogroup" aria-label="¿Qué mes?" className="grid gap-2 sm:grid-cols-2">
                {meses.map((m) => {
                  const elegido = m.periodo === mes.periodo;
                  return (
                    <button
                      key={m.periodo}
                      type="button"
                      role="radio"
                      aria-checked={elegido}
                      disabled={pendiente}
                      onClick={() => {
                        setPeriodo(m.periodo);
                        setSacados(new Set());
                        setError(null);
                      }}
                      className={cn(
                        "min-h-12 rounded-lg border-2 px-4 py-2.5 text-left text-base font-semibold transition-colors",
                        elegido
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card hover:bg-accent"
                      )}
                    >
                      {labelPeriodo(m.periodo)}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          <div className="space-y-2">
            <p className="text-base font-medium">
              {meses.length > 1 ? "Qué se le carga" : `Qué se le carga de ${nombreMes(mes.periodo)}`}
            </p>
            <ul className="divide-y rounded-lg border">
              {mes.renglones.map((r) => {
                const va = !sacados.has(r.codigo);
                const fila = (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block font-medium break-words", !va && "text-muted-foreground line-through")}>
                        <DescripcionCargo texto={r.descripcion} />
                      </span>
                      {enTermino && r.beneficio > 0 ? (
                        <span className="block text-sm text-muted-foreground tabular">
                          en término{" "}
                          {formatARS(
                            saldoCargo(
                              {
                                estado: "pendiente",
                                monto: r.monto,
                                monto_pagado: 0,
                                descuento_pronto_pago: r.beneficio,
                                vencimiento,
                              },
                              hoy
                            )
                          )}
                        </span>
                      ) : null}
                    </span>
                    <Money monto={r.monto} className={cn("shrink-0 font-semibold", !va && "text-muted-foreground")} />
                  </>
                );
                // Con una sola cosa no hay nada que elegir: se muestra y listo.
                if (mes.renglones.length === 1) {
                  return (
                    <li key={r.codigo} className="flex items-center gap-3 px-3.5 py-3">
                      {fila}
                    </li>
                  );
                }
                return (
                  <li key={r.codigo}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={va}
                      disabled={pendiente}
                      onClick={() => {
                        setSacados((s) => {
                          const n = new Set(s);
                          if (n.has(r.codigo)) n.delete(r.codigo);
                          else n.add(r.codigo);
                          return n;
                        });
                        setError(null);
                      }}
                      className="flex min-h-14 w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-accent/60"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-md border-2",
                          va ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                        )}
                      >
                        {va ? <Check className="size-4" strokeWidth={3} /> : null}
                      </span>
                      {fila}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {hayAlgo ? (
            <div className="space-y-2 rounded-lg border bg-muted/40 px-4 py-3" aria-live="polite">
              <p className="text-sm font-medium text-muted-foreground">Cómo queda su cuenta</p>
              <dl className="space-y-1.5 text-base">
                <Renglon etiqueta={titulo}>
                  <Money monto={total} className="font-semibold" />
                </Renglon>
                {beneficio > 0.009 ? (
                  <Renglon etiqueta={`Pagando hasta el ${formatFecha(vencimiento)}`}>
                    <span className="font-semibold tabular">−{formatARS(beneficio)}</span>
                  </Renglon>
                ) : null}
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
          ) : (
            <p className="text-sm font-medium text-pendiente">Elegí al menos una cosa para cargar.</p>
          )}

          {enTermino ? (
            <p className="text-sm text-muted-foreground">
              Vence el {formatFecha(vencimiento)}, igual que {nombreMes(mesEnCurso)}: si paga antes, mantiene el
              beneficio. Queda anotado quién lo cargó.
            </p>
          ) : (
            <p className="flex items-start gap-2 rounded-lg border border-parcial bg-parcial-suave px-3 py-2.5 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-parcial" strokeWidth={2} />
              <span>
                {labelPeriodo(mesEnCurso)} venció el {formatFecha(vencimiento)}: lo que cargues entra como deuda
                vencida, sin beneficio.
              </span>
            </p>
          )}
        </div>

        {error ? <AlertaError error={error} titulo="No se pudo cargar" /> : null}

        <DialogFooter className="gap-2 sm:flex-col sm:justify-start">
          <Button
            size="lg"
            className="h-auto min-h-12 w-full px-5 py-2 text-base font-semibold whitespace-normal"
            disabled={pendiente || !hayAlgo}
            onClick={cargar}
          >
            {pendiente ? <Spinner className="size-5" /> : null}
            {hayAlgo ? `Cargar ${nombreMes(mes.periodo)}: ${formatARS(total)}` : `Cargar ${nombreMes(mes.periodo)}`}
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
