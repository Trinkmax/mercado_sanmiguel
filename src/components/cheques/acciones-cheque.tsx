"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarClock, HandCoins, Landmark, Link2, Undo2 } from "lucide-react";
import { formatARS, formatFecha } from "@/lib/format";
import type { ActionResult } from "@/lib/actions/result";
import {
  acreditarCheque,
  depositarCheque,
  deshacerDeposito,
  entregarCheque,
  rechazarCheque,
  vincularChequeGasto,
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
import { ElegirGasto } from "@/components/cheques/elegir-gasto";
import { useDatosCheques } from "@/components/cheques/datos-cheques";

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
  puesto: string | null;
};

type Dialogo = "depositar" | "acreditar" | "entregar" | "vincular" | "rechazar" | null;

const MOTIVOS_RECHAZO = ["Sin fondos", "Firma no coincide", "Cuenta cerrada", "El proveedor lo devolvió"];

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

/**
 * Acciones del ciclo de vida de un cheque (Tesorería y el Líder): depositar
 * (no antes de su fecha), se acreditó, entregar a un proveedor (pagando un gasto),
 * "¿Qué gasto pagó?" para los que se entregaron en el cobro y rechazar (con motivo).
 */
export function AccionesCheque({ cheque, hoy }: { cheque: ChequeAcciones; hoy: string }) {
  const { gastos, proveedores } = useDatosCheques();
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [fecha, setFecha] = useState(hoy);
  const [motivo, setMotivo] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [gastoId, setGastoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function abrir(cual: Dialogo) {
    setFecha(hoy);
    setMotivo("");
    setProveedor(cheque.proveedor ?? "");
    setGastoId(null);
    setError(null);
    setDialogo(cual);
  }

  function ejecutar(accion: () => Promise<ActionResult>, exito: string) {
    setError(null);
    startTransition(async () => {
      const res = await accion();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDialogo(null);
      toast.success(exito);
    });
  }

  const nombre = `cheque N° ${cheque.numero}`;
  const esDiferido = cheque.estado === "en_cartera" && !cheque.puedeDepositar;
  const sinGasto = cheque.estado === "entregado" && !cheque.gastoId;
  const gastoElegido = gastoId ? gastos.find((g) => g.id === gastoId) ?? null : null;
  const cerrar = (o: boolean) => !o && !pendiente && setDialogo(null);
  const errorVisible = error ? (
    <p role="alert" className="rounded-lg bg-pendiente-suave px-4 py-3 text-sm font-medium text-pendiente">
      {error}
    </p>
  ) : null;

  return (
    <>
      <div className="flex flex-wrap gap-2 md:justify-end">
        {cheque.estado === "en_cartera" ? (
          <>
            {esDiferido ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0} className="inline-flex rounded-md">
                      <Button className="h-11 px-4 text-base font-semibold" disabled>
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
              <Button className="h-11 px-4 text-base font-semibold" onClick={() => abrir("depositar")}>
                <Landmark className="size-4" strokeWidth={2} />
                Depositar
              </Button>
            )}
            <Button variant="outline" className="h-11 px-4 text-base" onClick={() => abrir("entregar")}>
              <HandCoins className="size-4" strokeWidth={2} />
              Entregar a proveedor
            </Button>
          </>
        ) : null}
        {cheque.estado === "depositado" ? (
          <>
            <Button className="h-11 px-4 text-base font-semibold" onClick={() => abrir("acreditar")}>
              Se acreditó
            </Button>
            <Button
              variant="ghost"
              className="h-11 px-3 text-base text-muted-foreground"
              disabled={pendiente}
              onClick={() =>
                ejecutar(
                  () => deshacerDeposito({ id: cheque.id }),
                  `El ${nombre} volvió a Por cobrar.`
                )
              }
            >
              <Undo2 className="size-4" strokeWidth={2} />
              Deshacer depósito
            </Button>
          </>
        ) : null}
        {sinGasto ? (
          <Button className="h-11 px-4 text-base font-semibold" onClick={() => abrir("vincular")}>
            <Link2 className="size-4" strokeWidth={2} />
            ¿Qué gasto pagó?
          </Button>
        ) : null}
        {cheque.estado !== "rechazado" ? (
          <Button
            variant="outline"
            className="h-11 px-4 text-base text-destructive hover:text-destructive"
            onClick={() => abrir("rechazar")}
          >
            Rechazar
          </Button>
        ) : null}
      </div>

      {/* Depositar */}
      <Dialog open={dialogo === "depositar"} onOpenChange={cerrar}>
        <DialogContent className="sm:max-w-md">
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
          <DialogFooter>
            <Button
              size="lg"
              className="h-13 w-full text-base font-semibold"
              disabled={pendiente || !fecha || fecha > hoy}
              onClick={() =>
                ejecutar(() => depositarCheque({ id: cheque.id, fecha }), `Depositaste el ${nombre}.`)
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
        <DialogContent className="sm:max-w-md">
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
          <DialogFooter>
            <Button
              size="lg"
              className="h-13 w-full text-base font-semibold"
              disabled={pendiente || !fecha || fecha > hoy}
              onClick={() =>
                ejecutar(() => acreditarCheque({ id: cheque.id, fecha }), `El ${nombre} quedó acreditado.`)
              }
            >
              {pendiente ? <Spinner className="size-5" /> : null}
              Sí, se acreditó
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
                      className="min-h-11 rounded-full border bg-card px-4 text-sm font-medium hover:bg-accent"
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
                onCambiar={setGastoId}
                idBase={`ent-gasto-${cheque.id}`}
              />
            </div>
          </div>
          {errorVisible}
          <DialogFooter>
            <Button
              size="lg"
              className="h-13 w-full text-base font-semibold"
              disabled={pendiente || proveedor.trim().length < 2 || !fecha || fecha > hoy}
              onClick={() =>
                ejecutar(
                  () =>
                    entregarCheque({
                      id: cheque.id,
                      proveedor: proveedor.trim(),
                      fecha,
                      gastoId,
                    }),
                  gastoElegido
                    ? `Entregaste el ${nombre} a ${proveedor.trim()} y quedó pagado ${gastoElegido.etiqueta}.`
                    : `Entregaste el ${nombre} a ${proveedor.trim()}.`
                )
              }
            >
              {pendiente ? <Spinner className="size-5" /> : <HandCoins className="size-5" strokeWidth={2} />}
              {gastoElegido
                ? `Entregar y pagar ${gastoElegido.etiqueta}`
                : `Entregar a ${proveedor.trim() || "…"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ¿Qué gasto pagó? */}
      <Dialog open={dialogo === "vincular"} onOpenChange={cerrar}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">¿Qué gasto pagó el {nombre}?</DialogTitle>
            <DialogDescription className="text-base">
              Se lo dieron a {cheque.proveedor ?? "un proveedor"} en el cobro
              {` (${formatARS(cheque.monto)})`}. Elegí el gasto y queda pagado con el cheque.
            </DialogDescription>
          </DialogHeader>
          <ElegirGasto
            gastos={gastos}
            proveedor={cheque.proveedor ?? ""}
            montoCheque={cheque.monto}
            valor={gastoId}
            onCambiar={setGastoId}
            idBase={`vin-${cheque.id}`}
          />
          {errorVisible}
          <DialogFooter>
            <Button
              size="lg"
              className="h-13 w-full text-base font-semibold"
              disabled={pendiente || !gastoId}
              onClick={() =>
                gastoId &&
                ejecutar(
                  () => vincularChequeGasto({ chequeId: cheque.id, gastoId }),
                  `${gastoElegido?.etiqueta ?? "El gasto"} quedó pagado con el ${nombre}.`
                )
              }
            >
              {pendiente ? <Spinner className="size-5" /> : <Link2 className="size-5" strokeWidth={2} />}
              {gastoElegido ? `Es este: pagar ${gastoElegido.etiqueta}` : "Elegí el gasto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rechazar */}
      <Dialog open={dialogo === "rechazar"} onOpenChange={cerrar}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">¿Rechazar el {nombre}?</DialogTitle>
            <DialogDescription className="text-base">
              {formatARS(cheque.monto)}. El cobro que respaldaba se anula y la deuda del cliente vuelve a
              figurar.
              {cheque.gastoId
                ? ` ${cheque.gastoEtiqueta ?? "El gasto que pagó"} vuelve a Por pagar.`
                : ""}{" "}
              No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor={`motivo-${cheque.id}`} className="text-base">
              ¿Por qué se rechazó?
            </Label>
            <div className="flex flex-wrap gap-2">
              {MOTIVOS_RECHAZO.map((m) => (
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
              id={`motivo-${cheque.id}`}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="O contalo con tus palabras"
              className="min-h-20 text-base"
              maxLength={300}
            />
          </div>
          {errorVisible}
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-12 px-5 text-base" disabled={pendiente} onClick={() => setDialogo(null)}>
              No, volver
            </Button>
            <Button
              variant="destructive"
              className="h-12 px-5 text-base font-semibold"
              disabled={pendiente || motivo.trim().length < 3}
              onClick={() =>
                ejecutar(
                  () => rechazarCheque({ id: cheque.id, motivo: motivo.trim() }),
                  `Rechazaste el ${nombre}: la deuda del cliente volvió.`
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
