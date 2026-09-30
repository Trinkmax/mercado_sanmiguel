"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarClock, HandCoins, Landmark, Link2, RotateCcw, Undo2, Wallet } from "lucide-react";
import { formatARS, formatFecha } from "@/lib/format";
import type { ActionResult } from "@/lib/actions/result";
import {
  acreditarCheque,
  depositarCheque,
  deshacerAcreditacion,
  deshacerDeposito,
  desvincularChequeGasto,
  devolverChequeACartera,
  entregarCheque,
  rechazarCheque,
  vincularChequeGasto,
  type DiferenciaCheque,
  type ResultadoPagoCheque,
} from "@/lib/actions/cheques";
import { cn } from "@/lib/utils";
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
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ElegirDiferencia, ElegirGasto, montosDistintos } from "@/components/cheques/elegir-gasto";
import { useDatosCheques } from "@/components/cheques/datos-cheques";
import { AlertaError } from "@/components/cobranza/alerta-error";
import { PIE_DIALOGO_FIJO, enfocarDialogo } from "@/components/tesoreria/tipos";
import { llamarAccion } from "@/lib/llamar-accion";

export type ChequeAcciones = {
  id: string;
  numero: string;
  monto: number;
  estado: string;
  /** "YYYY-MM-DD": desde cuándo se puede depositar. */
  fechaCobro: string;
  fechaRecibido: string;
  fechaDepositado: string | null;
  /** Calculado en el server con la fecha de negocio (huso argentino). */
  puedeDepositar: boolean;
  proveedor: string | null;
  gastoId: string | null;
  gastoEtiqueta: string | null;
  /** Qué se hizo con la diferencia de montos al pagar el gasto (0026). */
  gastoDiferencia: string | null;
  /** Cheque mayor que el gasto que pagó: cuánto sobró (vuelto o a favor). */
  sobrante: number | null;
  puesto: string | null;
};

type Dialogo =
  | "depositar"
  | "acreditar"
  | "entregar"
  | "vincular"
  | "rechazar"
  | "deshacer_deposito"
  | "deshacer_acreditacion"
  | "deshacer_entrega"
  | null;

/** Solo para cheques que REBOTARON: el cobro del cliente se anula. */
const MOTIVOS_RECHAZO = ["Sin fondos", "Firma no coincide", "Cuenta cerrada", "El proveedor lo devolvió porque rebotó"];

const MOTIVOS_DESHACER: Record<"deshacer_deposito" | "deshacer_acreditacion" | "a_cartera" | "cambiar_gasto", string[]> = {
  deshacer_deposito: ["Lo marqué por error", "Todavía no lo llevé al banco", "El banco no lo recibió"],
  deshacer_acreditacion: ["Lo marqué por error", "Todavía no está en el extracto"],
  a_cartera: ["El proveedor lo devolvió sano", "Se lo di al proveedor equivocado", "No se lo di"],
  cambiar_gasto: ["Elegí el gasto equivocado", "Pagaba otro gasto"],
};

const CTA_LARGO = "h-auto min-h-13 w-full py-2.5 text-base leading-snug font-semibold whitespace-normal";

function restarDia(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const f = new Date(y, m - 1, d - 1);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
}

function Chip({
  activo,
  onClick,
  children,
  disabled,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "min-h-12 rounded-lg border px-4 text-base font-medium transition-colors",
        activo ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-accent",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      {children}
    </button>
  );
}

/** Elegir fecha: Hoy / Ayer / otro día, entre `min` y hoy. */
function ElegirFecha({
  valor,
  onCambiar,
  hoy,
  min,
  id,
}: {
  valor: string;
  onCambiar: (f: string) => void;
  hoy: string;
  min?: string | null;
  id: string;
}) {
  const ayer = restarDia(hoy);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip activo={valor === hoy} onClick={() => onCambiar(hoy)}>
        Hoy
      </Chip>
      <Chip activo={valor === ayer} onClick={() => onCambiar(ayer)} disabled={Boolean(min && ayer < min)}>
        Ayer
      </Chip>
      <Label htmlFor={id} className="sr-only">
        Otro día
      </Label>
      <Input
        id={id}
        type="date"
        min={min ?? undefined}
        max={hoy}
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        className="h-12 w-auto text-base"
      />
    </div>
  );
}

/** Chips de motivo + texto libre (motivo obligatorio para todo lo que deshace). */
function ElegirMotivo({
  id,
  pregunta,
  opciones,
  valor,
  onCambiar,
}: {
  id: string;
  pregunta: string;
  opciones: string[];
  valor: string;
  onCambiar: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <Label htmlFor={id} className="text-base">
        {pregunta}
      </Label>
      <div className="flex flex-wrap gap-2">
        {opciones.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onCambiar(m)}
            aria-pressed={valor === m}
            className={cn(
              "min-h-11 rounded-full border px-4 text-left text-sm font-medium pointer-coarse:min-h-[44px]",
              valor === m ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"
            )}
          >
            {m}
          </button>
        ))}
      </div>
      <Textarea
        id={id}
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        placeholder="O contalo con tus palabras"
        className="min-h-20 text-base"
        maxLength={300}
      />
    </div>
  );
}

/** Frase del toast según qué pasó con la diferencia de montos. */
function fraseDiferencia(r: ResultadoPagoCheque, proveedor: string): string {
  if (r.diferencia === "dividido" && r.resto) {
    return ` Quedan ${formatARS(r.resto)} por pagar en Gastos.`;
  }
  if (r.diferencia === "vuelto_efectivo" && r.sobrante) {
    return ` Entraron ${formatARS(r.sobrante)} de vuelto al efectivo.`;
  }
  if (r.diferencia === "a_favor" && r.sobrante) {
    return ` Quedan ${formatARS(r.sobrante)} a favor con ${proveedor}.`;
  }
  return "";
}

/**
 * Acciones del ciclo de vida de un cheque (Tesorería y el Líder): depositar
 * (no antes de su fecha), se acreditó, entregar a un proveedor (pagando un gasto),
 * "¿Qué gasto pagó?" para los que se entregaron en el cobro, DESHACER cada paso
 * (con motivo: el cobro del cliente no se toca) y rechazar (solo si rebotó).
 */
export function AccionesCheque({ cheque, hoy }: { cheque: ChequeAcciones; hoy: string }) {
  const { gastos, proveedores } = useDatosCheques();
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [fecha, setFecha] = useState(hoy);
  const [motivo, setMotivo] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [gastoId, setGastoId] = useState<string | null>(null);
  const [diferencia, setDiferencia] = useState<DiferenciaCheque | null>(null);
  const [deshacerComo, setDeshacerComo] = useState<"a_cartera" | "cambiar_gasto">("a_cartera");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function abrir(cual: Dialogo) {
    setFecha(hoy);
    setMotivo("");
    setProveedor(cheque.proveedor ?? "");
    setGastoId(null);
    setDiferencia(null);
    setDeshacerComo("a_cartera");
    setError(null);
    setDialogo(cual);
  }

  function ejecutar<T>(
    accion: () => Promise<ActionResult<T>>,
    exito: (data: T) => string,
    despues?: () => void
  ) {
    setError(null);
    const conDialogo = dialogo !== null;
    startTransition(async () => {
      const res = await llamarAccion(accion);
      if (!res.ok) {
        // Si no hay un diálogo abierto donde mostrarlo, igual se avisa.
        if (conDialogo) setError(res.error);
        else toast.error(res.error);
        return;
      }
      setDialogo(null);
      toast.success(exito(res.data));
      despues?.();
    });
  }

  const nombre = `cheque N° ${cheque.numero}`;
  const esDiferido = cheque.estado === "en_cartera" && !cheque.puedeDepositar;
  const sinGasto = cheque.estado === "entregado" && !cheque.gastoId;
  const gastoElegido = gastoId ? gastos.find((g) => g.id === gastoId) ?? null : null;
  const faltaDiferencia =
    gastoElegido !== null && montosDistintos(cheque.monto, gastoElegido.monto) && diferencia === null;
  const faltaProveedor = proveedor.trim().length < 2;
  const cerrar = (o: boolean) => !o && !pendiente && setDialogo(null);
  const errorVisible = error ? <AlertaError error={error} titulo="No se pudo guardar" /> : null;
  const motivoListo = motivo.trim().length >= 3;

  function elegirGasto(id: string | null) {
    setGastoId(id);
    setDiferencia(null);
    setError(null);
  }

  return (
    <>
      {/* Desde 1024 px los botones van uno abajo del otro, del mismo ancho, en una columna
          fija de la fila: quedan en el mismo lugar en todos los cheques. */}
      <div className="flex flex-wrap gap-2 md:justify-end lg:flex-col lg:flex-nowrap lg:items-stretch lg:justify-start">
        {cheque.estado === "en_cartera" ? (
          <>
            {esDiferido ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0} className="inline-flex rounded-md" data-tour="cheques-depositar-diferido">
                      <Button className="h-11 px-4 text-base font-semibold lg:w-full" disabled>
                        <CalendarClock className="size-4" strokeWidth={2} />
                        Depositar
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="text-sm">
                    Se puede depositar desde el {formatFecha(cheque.fechaCobro)}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Button className="h-11 px-4 text-base font-semibold" onClick={() => abrir("depositar")} data-tour="cheques-depositar">
                <Landmark className="size-4" strokeWidth={2} />
                Depositar
              </Button>
            )}
            <Button variant="outline" className="h-11 px-4 text-base" onClick={() => abrir("entregar")} data-tour="cheques-entregar">
              <HandCoins className="size-4" strokeWidth={2} />
              Entregar a proveedor
            </Button>
          </>
        ) : null}
        {cheque.estado === "depositado" ? (
          <>
            <Button className="h-11 px-4 text-base font-semibold" onClick={() => abrir("acreditar")} data-tour="cheques-acreditar">
              Se acreditó
            </Button>
            <Button
              variant="outline"
              className="h-11 px-3 text-base"
              disabled={pendiente}
              onClick={() => abrir("deshacer_deposito")}
              data-tour="cheques-deshacer"
            >
              <Undo2 className="size-4" strokeWidth={2} />
              Deshacer depósito
            </Button>
          </>
        ) : null}
        {cheque.estado === "acreditado" ? (
          <Button
            variant="outline"
            className="h-11 px-3 text-base"
            onClick={() => abrir("deshacer_acreditacion")}
            data-tour="cheques-deshacer"
          >
            <Undo2 className="size-4" strokeWidth={2} />
            Deshacer
          </Button>
        ) : null}
        {sinGasto ? (
          <Button className="h-11 px-4 text-base font-semibold" onClick={() => abrir("vincular")} data-tour="cheques-que-gasto">
            <Link2 className="size-4" strokeWidth={2} />
            ¿Qué gasto pagó?
          </Button>
        ) : null}
        {cheque.estado === "entregado" ? (
          <Button
            variant="outline"
            className="h-11 px-3 text-base"
            onClick={() => abrir("deshacer_entrega")}
            data-tour="cheques-deshacer"
          >
            <Undo2 className="size-4" strokeWidth={2} />
            Deshacer
          </Button>
        ) : null}
        {cheque.estado !== "rechazado" ? (
          <Button
            variant="outline"
            className="h-11 px-4 text-base text-destructive hover:text-destructive"
            onClick={() => abrir("rechazar")}
            data-tour="cheques-rechazar"
          >
            Rechazar
          </Button>
        ) : null}
      </div>

      {/* Depositar */}
      <Dialog open={dialogo === "depositar"} onOpenChange={cerrar}>
        <DialogContent className="sm:max-w-md" onOpenAutoFocus={enfocarDialogo}>
          <DialogHeader>
            <DialogTitle className="text-lg">Depositar el {nombre}</DialogTitle>
            <DialogDescription className="text-base">
              {formatARS(cheque.monto)}
              {cheque.puesto ? ` · ${cheque.puesto}` : ""}. Impacta en el banco en unas 72 horas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-base font-medium">¿Qué día lo depositaste?</p>
            <ElegirFecha
              valor={fecha}
              onCambiar={setFecha}
              hoy={hoy}
              min={cheque.fechaCobro}
              id={`dep-${cheque.id}`}
            />
          </div>
          {errorVisible}
          <DialogFooter className={PIE_DIALOGO_FIJO}>
            <Button
              size="lg"
              className={CTA_LARGO}
              disabled={pendiente || !fecha || fecha > hoy}
              onClick={() =>
                ejecutar(() => depositarCheque({ id: cheque.id, fecha }), () => `Depositaste el ${nombre}.`)
              }
            >
              {pendiente ? <Spinner className="size-5" /> : null}
              Depositar {formatARS(cheque.monto)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Acreditar */}
      <Dialog open={dialogo === "acreditar"} onOpenChange={cerrar}>
        <DialogContent className="sm:max-w-md" onOpenAutoFocus={enfocarDialogo}>
          <DialogHeader>
            <DialogTitle className="text-lg">¿Se acreditó el {nombre}?</DialogTitle>
            <DialogDescription className="text-base">
              {formatARS(cheque.monto)} ya están en el banco: suman al saldo del banco.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-base font-medium">¿Qué día se acreditó?</p>
            <ElegirFecha
              valor={fecha}
              onCambiar={setFecha}
              hoy={hoy}
              min={cheque.fechaDepositado}
              id={`acr-${cheque.id}`}
            />
          </div>
          {errorVisible}
          <DialogFooter className={PIE_DIALOGO_FIJO}>
            <Button
              size="lg"
              className={CTA_LARGO}
              disabled={pendiente || !fecha || fecha > hoy}
              onClick={() =>
                ejecutar(() => acreditarCheque({ id: cheque.id, fecha }), () => `El ${nombre} quedó acreditado.`)
              }
            >
              {pendiente ? <Spinner className="size-5" /> : null}
              Sí, se acreditó
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deshacer depósito */}
      <Dialog open={dialogo === "deshacer_deposito"} onOpenChange={cerrar}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md" onOpenAutoFocus={enfocarDialogo}>
          <DialogHeader>
            <DialogTitle className="text-lg">¿Volver el {nombre} a Por cobrar?</DialogTitle>
            <DialogDescription className="text-base">
              {formatARS(cheque.monto)}. Se borra la fecha del depósito y queda anotado con tu nombre.
            </DialogDescription>
          </DialogHeader>
          <ElegirMotivo
            id={`motivo-dep-${cheque.id}`}
            pregunta="¿Por qué lo deshacés?"
            opciones={MOTIVOS_DESHACER.deshacer_deposito}
            valor={motivo}
            onCambiar={(v) => {
              setMotivo(v);
              setError(null);
            }}
          />
          {errorVisible}
          <DialogFooter className={PIE_DIALOGO_FIJO}>
            <Button variant="outline" className="h-12 px-5 text-base" disabled={pendiente} onClick={() => setDialogo(null)}>
              No, volver
            </Button>
            <Button
              className="h-12 px-5 text-base font-semibold"
              disabled={pendiente || !motivoListo}
              onClick={() =>
                ejecutar(
                  () => deshacerDeposito({ id: cheque.id, motivo: motivo.trim() }),
                  () => `El ${nombre} volvió a Por cobrar.`
                )
              }
            >
              {pendiente ? <Spinner className="size-5" /> : <Undo2 className="size-5" strokeWidth={2} />}
              Sí, volver a Por cobrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deshacer acreditación */}
      <Dialog open={dialogo === "deshacer_acreditacion"} onOpenChange={cerrar}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md" onOpenAutoFocus={enfocarDialogo}>
          <DialogHeader>
            <DialogTitle className="text-lg">¿El {nombre} todavía no se acreditó?</DialogTitle>
            <DialogDescription className="text-base">
              Vuelve a Depositados y el saldo del banco baja {formatARS(cheque.monto)}. Queda anotado con
              tu nombre.
            </DialogDescription>
          </DialogHeader>
          <ElegirMotivo
            id={`motivo-acr-${cheque.id}`}
            pregunta="¿Por qué lo deshacés?"
            opciones={MOTIVOS_DESHACER.deshacer_acreditacion}
            valor={motivo}
            onCambiar={(v) => {
              setMotivo(v);
              setError(null);
            }}
          />
          {errorVisible}
          <DialogFooter className={PIE_DIALOGO_FIJO}>
            <Button variant="outline" className="h-12 px-5 text-base" disabled={pendiente} onClick={() => setDialogo(null)}>
              No, volver
            </Button>
            <Button
              className="h-12 px-5 text-base font-semibold"
              disabled={pendiente || !motivoListo}
              onClick={() =>
                ejecutar(
                  () => deshacerAcreditacion({ id: cheque.id, motivo: motivo.trim() }),
                  () => `El ${nombre} volvió a Depositados.`
                )
              }
            >
              {pendiente ? <Spinner className="size-5" /> : <Undo2 className="size-5" strokeWidth={2} />}
              Sí, deshacer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deshacer la entrega a un proveedor (o el gasto que pagó) */}
      <Dialog open={dialogo === "deshacer_entrega"} onOpenChange={cerrar}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg" onOpenAutoFocus={enfocarDialogo}>
          <DialogHeader>
            <DialogTitle className="text-lg">Deshacer: {nombre}</DialogTitle>
            <DialogDescription className="text-base break-words">
              {formatARS(cheque.monto)} · entregado a {cheque.proveedor ?? "un proveedor"}.
              {cheque.gastoEtiqueta ? ` Pagó: ${cheque.gastoEtiqueta}.` : ""}
            </DialogDescription>
          </DialogHeader>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-base font-medium">¿Qué pasó?</legend>
            <button
              type="button"
              aria-pressed={deshacerComo === "a_cartera"}
              onClick={() => {
                setDeshacerComo("a_cartera");
                setMotivo("");
                setError(null);
              }}
              className={cn(
                "flex min-h-14 w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors",
                deshacerComo === "a_cartera" ? "border-primary bg-accent" : "border-input bg-card hover:bg-accent/60"
              )}
            >
              <RotateCcw className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.9} />
              <span className="min-w-0">
                <span className="block text-base font-semibold">Volvió a la cartera</span>
                <span className="block text-sm text-muted-foreground">
                  El proveedor lo devolvió sano o no se lo diste: vuelve a Por cobrar
                  {cheque.gastoId ? " y el gasto, a Por pagar" : ""}.
                </span>
              </span>
            </button>
            {cheque.gastoId ? (
              <button
                type="button"
                aria-pressed={deshacerComo === "cambiar_gasto"}
                onClick={() => {
                  setDeshacerComo("cambiar_gasto");
                  setMotivo("");
                  setError(null);
                }}
                className={cn(
                  "flex min-h-14 w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors",
                  deshacerComo === "cambiar_gasto" ? "border-primary bg-accent" : "border-input bg-card hover:bg-accent/60"
                )}
              >
                <Link2 className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.9} />
                <span className="min-w-0">
                  <span className="block text-base font-semibold">El gasto estaba mal</span>
                  <span className="block text-sm text-muted-foreground">
                    El gasto vuelve a Por pagar y elegís el correcto.
                  </span>
                </span>
              </button>
            ) : null}
          </fieldset>
          {cheque.gastoDiferencia === "vuelto_efectivo" ? (
            <p className="flex gap-2 rounded-lg bg-parcial-suave px-4 py-3 text-sm font-medium text-parcial">
              <Wallet className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
              El vuelto en efectivo que se anotó con este cheque también se anula.
            </p>
          ) : null}
          {cheque.gastoDiferencia === "dividido" ? (
            <p className="rounded-lg bg-muted/60 px-4 py-3 text-sm break-words">
              El gasto vuelve a su monto completo y se anula el «Resto» que quedó por pagar (si ya lo
              pagaste, queda como está).
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            El cobro del cliente no se toca. Si el banco lo rebotó, usá Rechazar.
          </p>
          <ElegirMotivo
            id={`motivo-ent-${cheque.id}`}
            pregunta="¿Por qué lo deshacés?"
            opciones={MOTIVOS_DESHACER[deshacerComo]}
            valor={motivo}
            onCambiar={(v) => {
              setMotivo(v);
              setError(null);
            }}
          />
          {errorVisible}
          <DialogFooter className={PIE_DIALOGO_FIJO}>
            <Button variant="outline" className="h-12 px-5 text-base" disabled={pendiente} onClick={() => setDialogo(null)}>
              No, volver
            </Button>
            <Button
              className="h-auto min-h-12 px-5 py-2 text-base leading-snug font-semibold whitespace-normal"
              disabled={pendiente || !motivoListo}
              onClick={() =>
                deshacerComo === "a_cartera"
                  ? ejecutar(
                      () => devolverChequeACartera({ id: cheque.id, motivo: motivo.trim() }),
                      (r) =>
                        `El ${nombre} volvió a Por cobrar.` +
                        (r.gasto ? ` ${r.gasto} volvió a Por pagar` : "") +
                        (r.gasto && r.reunido ? ` por ${formatARS(r.reunido)} (se juntó con el resto).` : r.gasto ? "." : "")
                    )
                  : ejecutar(
                      () => desvincularChequeGasto({ id: cheque.id, motivo: motivo.trim() }),
                      (r) =>
                        `${r.gasto ?? "El gasto"} volvió a Por pagar` +
                        (r.reunido ? ` por ${formatARS(r.reunido)} (se juntó con el resto)` : "") +
                        ". Ahora elegí el gasto correcto.",
                      // Sigue abierto el paso siguiente: elegir el gasto que sí pagó.
                      () => abrir("vincular")
                    )
              }
            >
              {pendiente ? <Spinner className="size-5" /> : <Undo2 className="size-5" strokeWidth={2} />}
              {deshacerComo === "a_cartera" ? "Volver a Por cobrar" : "Cambiar el gasto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entregar a proveedor */}
      <Dialog open={dialogo === "entregar"} onOpenChange={cerrar}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">Entregar el {nombre} a un proveedor</DialogTitle>
            <DialogDescription className="text-base">
              {formatARS(cheque.monto)}. Sale de la cartera (sin tocar ninguna caja).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor={`prov-${cheque.id}`} className="text-base">
                ¿A qué proveedor?
              </Label>
              <Input
                id={`prov-${cheque.id}`}
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
                placeholder="Por ejemplo: Frutas del Sur"
                className="h-12 text-base"
                maxLength={120}
                autoComplete="off"
              />
              {proveedores.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {proveedores.slice(0, 6).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setProveedor(p)}
                      className="min-h-11 max-w-full rounded-full border bg-card px-4 text-left text-sm font-medium break-words hover:bg-accent pointer-coarse:min-h-[44px]"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <p className="text-base font-medium">¿Qué día se lo diste?</p>
              <ElegirFecha
                valor={fecha}
                onCambiar={setFecha}
                hoy={hoy}
                min={cheque.fechaRecibido}
                id={`ent-${cheque.id}`}
              />
            </div>
            <div className="space-y-2">
              <p className="text-base font-medium">
                ¿Paga un gasto? <span className="font-normal text-muted-foreground">(opcional)</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Si lo elegís, el gasto queda pagado con este cheque y no hay que pagarlo aparte.
              </p>
              <ElegirGasto
                gastos={gastos}
                proveedor={proveedor}
                montoCheque={cheque.monto}
                valor={gastoId}
                onCambiar={elegirGasto}
                idBase={`ent-gasto-${cheque.id}`}
                hoy={hoy}
              />
              {gastoElegido ? (
                <ElegirDiferencia
                  montoCheque={cheque.monto}
                  montoGasto={gastoElegido.monto}
                  proveedor={proveedor}
                  valor={diferencia}
                  onCambiar={setDiferencia}
                />
              ) : null}
            </div>
          </div>
          {errorVisible}
          <DialogFooter className={PIE_DIALOGO_FIJO}>
            <Button
              size="lg"
              className={CTA_LARGO}
              disabled={pendiente || faltaProveedor || !fecha || fecha > hoy || faltaDiferencia}
              onClick={() =>
                ejecutar(
                  () =>
                    entregarCheque({
                      id: cheque.id,
                      proveedor: proveedor.trim(),
                      fecha,
                      gastoId,
                      diferencia: gastoElegido && montosDistintos(cheque.monto, gastoElegido.monto) ? diferencia : null,
                    }),
                  (r) =>
                    (gastoElegido
                      ? `Entregaste el ${nombre} a ${proveedor.trim()} y quedó pagado ${gastoElegido.etiqueta}.`
                      : `Entregaste el ${nombre} a ${proveedor.trim()}.`) + fraseDiferencia(r, proveedor.trim())
                )
              }
            >
              {pendiente ? <Spinner className="size-5" /> : <HandCoins className="size-5" strokeWidth={2} />}
              {faltaProveedor
                ? "Poné a qué proveedor se lo diste"
                : faltaDiferencia
                  ? "Elegí qué pasó con la diferencia"
                  : gastoElegido
                    ? `Entregar y pagar ${gastoElegido.etiqueta}`
                    : `Entregar a ${proveedor.trim()}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ¿Qué gasto pagó? */}
      <Dialog open={dialogo === "vincular"} onOpenChange={cerrar}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg" onOpenAutoFocus={enfocarDialogo}>
          <DialogHeader>
            <DialogTitle className="text-lg">¿Qué gasto pagó el {nombre}?</DialogTitle>
            <DialogDescription className="text-base break-words">
              Se lo dieron a {cheque.proveedor ?? "un proveedor"}
              {` (${formatARS(cheque.monto)})`}. Elegí el gasto y queda pagado con el cheque.
            </DialogDescription>
          </DialogHeader>
          <ElegirGasto
            gastos={gastos}
            proveedor={cheque.proveedor ?? ""}
            montoCheque={cheque.monto}
            valor={gastoId}
            onCambiar={elegirGasto}
            idBase={`vin-${cheque.id}`}
            hoy={hoy}
          />
          {gastoElegido ? (
            <ElegirDiferencia
              montoCheque={cheque.monto}
              montoGasto={gastoElegido.monto}
              proveedor={cheque.proveedor ?? ""}
              valor={diferencia}
              onCambiar={setDiferencia}
            />
          ) : null}
          {errorVisible}
          <DialogFooter className={PIE_DIALOGO_FIJO}>
            <Button
              size="lg"
              className={CTA_LARGO}
              disabled={pendiente || !gastoId || faltaDiferencia}
              onClick={() =>
                gastoId &&
                ejecutar(
                  () =>
                    vincularChequeGasto({
                      chequeId: cheque.id,
                      gastoId,
                      diferencia: gastoElegido && montosDistintos(cheque.monto, gastoElegido.monto) ? diferencia : null,
                    }),
                  (r) =>
                    `${gastoElegido?.etiqueta ?? "El gasto"} quedó pagado con el ${nombre}.` +
                    fraseDiferencia(r, cheque.proveedor ?? "el proveedor")
                )
              }
            >
              {pendiente ? <Spinner className="size-5" /> : <Link2 className="size-5" strokeWidth={2} />}
              {!gastoElegido
                ? "Elegí el gasto"
                : faltaDiferencia
                  ? "Elegí qué pasó con la diferencia"
                  : `Es este: pagar ${gastoElegido.etiqueta}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rechazar */}
      <Dialog open={dialogo === "rechazar"} onOpenChange={cerrar}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md" onOpenAutoFocus={enfocarDialogo}>
          <DialogHeader>
            <DialogTitle className="text-lg">¿El {nombre} rebotó?</DialogTitle>
            <DialogDescription className="text-base">
              {formatARS(cheque.monto)}. El cobro que respaldaba se anula y la deuda del cliente vuelve a
              figurar.
              {cheque.gastoId
                ? ` ${cheque.gastoEtiqueta ?? "El gasto que pagó"} vuelve a Por pagar.`
                : ""}{" "}
              No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          {cheque.estado === "entregado" || cheque.estado === "depositado" || cheque.estado === "acreditado" ? (
            <p className="rounded-lg bg-muted/60 px-4 py-3 text-sm">
              Si no rebotó y solo te equivocaste en un paso, cerrá esto y tocá <strong>Deshacer</strong>: el
              cobro del cliente no se toca.
            </p>
          ) : null}
          {cheque.gastoDiferencia === "vuelto_efectivo" && cheque.sobrante ? (
            <p className="flex gap-2 rounded-lg bg-parcial-suave px-4 py-3 text-sm font-medium break-words text-parcial">
              <Wallet className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
              <span className="min-w-0">
                {cheque.proveedor ?? "El proveedor"} te había dado {formatARS(cheque.sobrante)} de vuelto: queda
                en Gastos como «Devolver el vuelto», para pagárselo.
              </span>
            </p>
          ) : null}
          {cheque.gastoDiferencia === "dividido" ? (
            <p className="rounded-lg bg-muted/60 px-4 py-3 text-sm break-words">
              El gasto vuelve a su monto completo y se anula el «Resto» que quedó por pagar (si ya lo
              pagaste, queda como está).
            </p>
          ) : null}
          <ElegirMotivo
            id={`motivo-${cheque.id}`}
            pregunta="¿Por qué se rechazó?"
            opciones={MOTIVOS_RECHAZO}
            valor={motivo}
            onCambiar={(v) => {
              setMotivo(v);
              setError(null);
            }}
          />
          {errorVisible}
          <DialogFooter className={PIE_DIALOGO_FIJO}>
            <Button variant="outline" className="h-12 px-5 text-base" disabled={pendiente} onClick={() => setDialogo(null)}>
              No, volver
            </Button>
            <Button
              variant="destructive"
              className="h-12 px-5 text-base font-semibold"
              disabled={pendiente || !motivoListo}
              onClick={() =>
                ejecutar(
                  () => rechazarCheque({ id: cheque.id, motivo: motivo.trim() }),
                  () => `Rechazaste el ${nombre}: la deuda del cliente volvió.`
                )
              }
            >
              {pendiente ? <Spinner className="size-5" /> : null}
              Rechazar cheque
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
