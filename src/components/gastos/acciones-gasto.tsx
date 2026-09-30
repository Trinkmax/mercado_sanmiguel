"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { formatARS, formatFecha, montoATexto, parseMonto, sanitizarMonto } from "@/lib/format";
import {
  anularGasto,
  corregirMontoGasto,
  pagarGasto,
  revertirPagoGasto,
  type ResultadoPagoGasto,
} from "@/lib/actions/gastos";
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
import { Money } from "@/components/shared/money";
import {
  SelectorOrigen,
  origenCompleto,
  origenInicial,
  textoBotonPago,
} from "@/components/gastos/selector-origen";
import { delDia, type CajaElegible, type OrigenPago } from "@/components/gastos/tipos";
import { AlertaError } from "@/components/cobranza/alerta-error";
import { llamarAccion } from "@/lib/llamar-accion";

export type GastoAcciones = {
  id: string;
  etiqueta: string;
  monto: number;
  estado: string;
  pagadoDesde: string | null;
};

type Dialogo = "pagar" | "anular" | "deshacer" | "monto" | null;

const MOTIVOS_DESHACER = [
  "Se cargó dos veces",
  "Salió de otra caja",
  "El monto estaba mal",
  "Todavía no se pagó",
];

/** Mensaje del toast después de pagar, con el número que importa. */
export function avisarPago(
  r: ResultadoPagoGasto,
  hoy: string,
  irACaja: (href: string) => void
) {
  if (r.cajaId && r.cajaFecha) {
    const frase = `Pagado desde la caja ${delDia(r.cajaFecha, hoy)}`;
    toast.success(
      r.efectivoCaja !== null
        ? `${frase}: ahora tiene que tener ${formatARS(r.efectivoCaja)}`
        : `${frase}.`,
      {
        action: {
          label: "Ver caja",
          onClick: () => irACaja(`/caja?fecha=${r.cajaFecha}&tipo=administracion`),
        },
      }
    );
  } else {
    toast.success(`Pagado desde Tesorería el ${formatFecha(r.fechaPago).slice(0, 5)}.`);
  }
}

/**
 * Acciones de un gasto: Pagar (elige de dónde sale la plata) y Anular si está
 * pendiente; "Deshacer pago" (con motivo) si está pagado y no fue con cheque.
 */
export function AccionesGasto({
  gasto,
  cajas,
  hoy,
  preferirCaja,
  cajaPreseleccionadaId,
  soloPagar = false,
}: {
  gasto: GastoAcciones;
  cajas: CajaElegible[];
  hoy: string;
  /** Administración (y el Líder con caja de hoy) arrancan en "Caja del día"; Tesorería en "Tesorería". */
  preferirCaja: boolean;
  /** Viene de la caja (`/gastos?caja=…`): esa caja queda elegida. */
  cajaPreseleccionadaId?: string | null;
  /** En listas compactas (Tesorería → Hoy) solo se ofrece Pagar. */
  soloPagar?: boolean;
}) {
  const router = useRouter();
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [origen, setOrigen] = useState<OrigenPago>(() =>
    origenInicial({ cajas, preferirCaja, cajaPreseleccionadaId, hoy })
  );
  const [motivo, setMotivo] = useState("");
  const [montoNuevo, setMontoNuevo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function abrir(cual: Dialogo) {
    setError(null);
    setMotivo("");
    if (cual === "pagar") {
      setOrigen(origenInicial({ cajas, preferirCaja, cajaPreseleccionadaId, hoy }));
    }
    if (cual === "monto") setMontoNuevo(montoATexto(gasto.monto));
    setDialogo(cual);
  }

  function pagar() {
    setError(null);
    startTransition(async () => {
      const res = await llamarAccion(() => pagarGasto({
        id: gasto.id,
        origen: origen.origen,
        cajaId: origen.origen === "caja" ? origen.caja?.id ?? null : null,
        medio: origen.origen === "caja" ? "efectivo" : origen.medio,
        fecha: origen.origen === "tesoreria" ? origen.fecha : null,
      }));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDialogo(null);
      avisarPago(res.data, hoy, (href) => router.push(href));
    });
  }

  function anular() {
    startTransition(async () => {
      const res = await llamarAccion(() => anularGasto({ id: gasto.id }));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDialogo(null);
      toast.success(`Anulaste ${gasto.etiqueta}: ya no suma en el mes.`);
    });
  }

  function corregirMonto() {
    setError(null);
    const monto = parseMonto(montoNuevo);
    startTransition(async () => {
      const res = await llamarAccion(() => corregirMontoGasto({ id: gasto.id, monto }));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDialogo(null);
      toast.success(`${gasto.etiqueta}: ahora es de ${formatARS(monto)}.`, {
        description: "Cambió solo este gasto. Si cambia para todos los meses, cambialo en los fijos.",
      });
    });
  }

  function deshacer() {
    setError(null);
    startTransition(async () => {
      const res = await llamarAccion(() => revertirPagoGasto({ id: gasto.id, motivo }));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDialogo(null);
      toast.success(`Deshiciste el pago de ${gasto.etiqueta}: vuelve a Por pagar.`);
    });
  }

  const puedePagar = origenCompleto(origen, hoy);

  return (
    <>
      {gasto.estado === "pendiente" ? (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            className="h-11 min-w-24 px-5 text-base font-semibold"
            onClick={() => abrir("pagar")}
            aria-label={`Pagar ${gasto.etiqueta}`}
            data-tour="gastos-pagar"
          >
            Pagar
          </Button>
          {!soloPagar ? (
            <Button
              variant="outline"
              className="h-11 px-4 text-base"
              onClick={() => abrir("monto")}
              aria-label={`Cambiar el monto de ${gasto.etiqueta}`}
              data-tour="gastos-cambiar-monto"
            >
              Cambiar monto
            </Button>
          ) : null}
          {!soloPagar ? (
            <Button
              variant="outline"
              className="h-11 px-4 text-base text-destructive hover:text-destructive"
              onClick={() => abrir("anular")}
              aria-label={`Anular ${gasto.etiqueta}`}
            >
              Anular
            </Button>
          ) : null}
        </div>
      ) : gasto.estado === "pagado" && gasto.pagadoDesde !== "cheque" && !soloPagar ? (
        <Button
          variant="ghost"
          className="h-11 px-3 text-base text-muted-foreground hover:text-foreground"
          onClick={() => abrir("deshacer")}
          aria-label={`Deshacer el pago de ${gasto.etiqueta}`}
        >
          <Undo2 className="size-4" strokeWidth={2} />
          Deshacer pago
        </Button>
      ) : null}

      {/* Pagar */}
      <Dialog open={dialogo === "pagar"} onOpenChange={(o) => !o && !pendiente && setDialogo(null)}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">Pagar {gasto.etiqueta}</DialogTitle>
            <DialogDescription className="text-base">
              <Money monto={gasto.monto} className="text-2xl font-bold text-foreground" />
            </DialogDescription>
          </DialogHeader>
          <SelectorOrigen
            valor={origen}
            onCambiar={(v) => {
              setOrigen(v);
              setError(null);
            }}
            cajas={cajas}
            monto={gasto.monto}
            hoy={hoy}
            idBase={`pagar-${gasto.id}`}
          />
          {error ? <AlertaError error={error} titulo="No se pudo pagar" /> : null}
          {/* Una salida clara además de la X, como en Anular y Deshacer. */}
          <DialogFooter>
            <Button
              variant="outline"
              className="h-auto min-h-12 px-5 text-base"
              disabled={pendiente}
              onClick={() => setDialogo(null)}
            >
              No, volver
            </Button>
            <Button
              size="lg"
              className="h-auto min-h-13 w-full py-2.5 text-base leading-snug font-semibold whitespace-normal sm:w-auto sm:flex-1"
              disabled={pendiente || !puedePagar}
              onClick={pagar}
            >
              {pendiente ? <Spinner className="size-5" /> : null}
              {textoBotonPago(origen, gasto.monto, hoy)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cambiar monto (solo este gasto) */}
      <Dialog open={dialogo === "monto"} onOpenChange={(o) => !o && !pendiente && setDialogo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Cambiar el monto de {gasto.etiqueta}</DialogTitle>
            <DialogDescription className="text-base">
              Ahora es de {formatARS(gasto.monto)}. Cambia solo este gasto, no los meses que vienen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`monto-${gasto.id}`} className="text-base">
              Monto nuevo
            </Label>
            <Input
              id={`monto-${gasto.id}`}
              inputMode="decimal"
              autoComplete="off"
              value={montoNuevo}
              onChange={(e) => {
                setMontoNuevo(sanitizarMonto(e.target.value).slice(0, 15));
                setError(null);
              }}
              className="h-13 text-xl font-semibold tabular"
            />
            <p className="min-h-5 text-base font-semibold tabular text-muted-foreground">
              {parseMonto(montoNuevo) > 0 ? formatARS(parseMonto(montoNuevo)) : "Los centavos van con coma: 1234,50"}
            </p>
          </div>
          {error ? <AlertaError error={error} titulo="No se pudo cambiar el monto" /> : null}
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-12 px-5 text-base" disabled={pendiente} onClick={() => setDialogo(null)}>
              No, volver
            </Button>
            <Button
              className="h-12 px-5 text-base font-semibold"
              disabled={pendiente || !(parseMonto(montoNuevo) > 0) || parseMonto(montoNuevo) === gasto.monto}
              onClick={corregirMonto}
            >
              {pendiente ? <Spinner className="size-5" /> : null}
              Guardar monto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Anular */}
      <Dialog open={dialogo === "anular"} onOpenChange={(o) => !o && !pendiente && setDialogo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">¿Anular {gasto.etiqueta}?</DialogTitle>
            <DialogDescription className="text-base">
              {formatARS(gasto.monto)}. Queda anotado como anulado y no suma en el mes.
            </DialogDescription>
          </DialogHeader>
          {error ? <AlertaError error={error} titulo="No se pudo anular" /> : null}
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-12 px-5 text-base" disabled={pendiente} onClick={() => setDialogo(null)}>
              No, volver
            </Button>
            <Button variant="destructive" className="h-12 px-5 text-base font-semibold" disabled={pendiente} onClick={anular}>
              {pendiente ? <Spinner className="size-5" /> : null}
              Anular gasto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deshacer pago */}
      <Dialog open={dialogo === "deshacer"} onOpenChange={(o) => !o && !pendiente && setDialogo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">¿Deshacer el pago de {gasto.etiqueta}?</DialogTitle>
            <DialogDescription className="text-base">
              {formatARS(gasto.monto)} vuelve a Por pagar. Si salió de una caja, su arqueo se
              corrige y queda anotado con tu nombre.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor={`motivo-${gasto.id}`} className="text-base">
              ¿Por qué lo deshacés?
            </Label>
            <div className="flex flex-wrap gap-2">
              {MOTIVOS_DESHACER.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMotivo(m)}
                  aria-pressed={motivo === m}
                  className={
                    motivo === m
                      ? "min-h-11 rounded-full border border-primary bg-primary px-4 text-sm font-medium text-primary-foreground"
                      : "min-h-11 rounded-full border bg-card px-4 text-sm font-medium hover:bg-accent"
                  }
                >
                  {m}
                </button>
              ))}
            </div>
            <Textarea
              id={`motivo-${gasto.id}`}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="O contalo con tus palabras"
              className="min-h-20 text-base"
              maxLength={300}
            />
          </div>
          {error ? <AlertaError error={error} titulo="No se pudo deshacer" /> : null}
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-12 px-5 text-base" disabled={pendiente} onClick={() => setDialogo(null)}>
              No, volver
            </Button>
            <Button
              className="h-12 px-5 text-base font-semibold"
              disabled={pendiente || motivo.trim().length < 3}
              onClick={deshacer}
            >
              {pendiente ? <Spinner className="size-5" /> : <Undo2 className="size-5" strokeWidth={2} />}
              Deshacer el pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
