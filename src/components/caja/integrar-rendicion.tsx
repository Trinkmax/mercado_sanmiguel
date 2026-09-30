"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, Check, Footprints, Printer, Tractor, Truck } from "lucide-react";
import { toast } from "sonner";
import { integrarCajaPorteria, type ResultadoIntegracion } from "@/lib/actions/cajas";
import { cn } from "@/lib/utils";
import { formatARS, formatFecha } from "@/lib/format";
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
import { Sello } from "@/components/shared/sello";
import { AlertaError } from "@/components/cobranza/alerta-error";
import { montoATexto, parseMonto, redondear2, sanitizarMonto } from "@/components/cobranza/tipos";
import { llamarAccion } from "@/lib/llamar-accion";

/** Lo que se muestra de una caja de portería rendida que espera entrar en la caja mayor. */
export type RendicionARecibir = {
  cajaId: string;
  fecha: string;
  efectivo: number;
  transferencia: number;
  quintas: number;
  ambulantes: number;
  canon: number;
  ajustes: number;
};

export type Recibida = { cajaId: string; fecha: string; resultado: ResultadoIntegracion };

/** "Quintas $A · Ambulantes $B · Bono camioneros $C" con íconos. */
export function DesglosePorteria({
  quintas,
  ambulantes,
  canon,
  ajustes = 0,
}: {
  quintas: number;
  ambulantes: number;
  canon: number;
  ajustes?: number;
}) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
        <Tractor className="size-4 shrink-0 translate-y-0.5 text-muted-foreground" strokeWidth={2} />
        Quintas <Money monto={quintas} className="font-semibold text-foreground" />
      </span>
      <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
        <Footprints className="size-4 shrink-0 translate-y-0.5 text-muted-foreground" strokeWidth={2} />
        Ambulantes <Money monto={ambulantes} className="font-semibold text-foreground" />
      </span>
      <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
        <Truck className="size-4 shrink-0 translate-y-0.5 text-muted-foreground" strokeWidth={2} />
        Bono camioneros <Money monto={canon} className="font-semibold text-foreground" />
      </span>
      {Math.abs(ajustes) > 0.009 ? (
        <span className="whitespace-nowrap">
          Ajustes{" "}
          <span className="tabular font-semibold text-foreground">
            {ajustes < 0 ? "−" : "+"}
            {formatARS(Math.abs(ajustes))}
          </span>
        </span>
      ) : null}
    </span>
  );
}

/** Lo que se ofrece en el campo "¿Cuánto te entregó?": lo rendido (o 0). */
function textoInicial(efectivo: number): string {
  return efectivo > 0 ? montoATexto(efectivo) : "0";
}

/**
 * Confirmación de "Recibir e integrar": el detalle de lo que entra (sin cheques: la caja de
 * portería no recibe cheques), cuánto efectivo contó al recibirla (precargado con lo rendido)
 * y observaciones. Si lo contado no coincide, la diferencia se ve en rojo, el motivo es
 * obligatorio y la base la anota como faltante/sobrante de la CAJA DE PORTERÍA.
 * Al terminar llama a `onRecibida` (el que lo monta muestra el éxito, que tiene que
 * sobrevivir a que la fila desaparezca de la bandeja).
 */
export function BotonIntegrarRendicion({
  rendicion: r,
  onRecibida,
}: {
  rendicion: RendicionARecibir;
  onRecibida: (recibida: Recibida) => void;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [contado, setContado] = useState(() => textoInicial(r.efectivo));
  const [observaciones, setObservaciones] = useState("");
  const [faltaMotivo, setFaltaMotivo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, startTransition] = useTransition();
  const idObs = useId();
  const idContado = useId();

  const hayContado = contado.trim() !== "";
  const recibido = redondear2(parseMonto(contado));
  const diferencia = hayContado ? redondear2(recibido - r.efectivo) : 0;
  const coincide = hayContado && Math.abs(diferencia) < 0.01;

  function abrir() {
    setContado(textoInicial(r.efectivo));
    setObservaciones("");
    setFaltaMotivo(false);
    setError(null);
    setAbierto(true);
  }

  function confirmar() {
    if (!hayContado) {
      setError("Poné cuánto efectivo te entregó (si coincide, dejá el monto que aparece).");
      return;
    }
    if (!coincide && !observaciones.trim()) {
      setFaltaMotivo(true);
      document.getElementById(idObs)?.focus();
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await llamarAccion(() =>
        integrarCajaPorteria(r.cajaId, observaciones.trim() || undefined, recibido)
      );
      if (!res.ok) {
        // El diálogo queda abierto con lo cargado; reintentar es seguro (la base no la integra dos veces).
        if (coincide && res.error.startsWith("Contá qué pasó con la diferencia")) {
          // Lo rendido cambió mientras el diálogo estaba abierto (p. ej. un ajuste de Tesorería):
          // se trae el monto nuevo y la diferencia aparece arriba.
          router.refresh();
          setError("Lo que rindió cambió recién (hubo un ajuste). Revisá la diferencia y contá qué pasó.");
          return;
        }
        setError(res.error);
        return;
      }
      if (res.data.repetido) toast.info("Esa caja de portería ya la habías recibido.");
      setAbierto(false);
      setObservaciones("");
      onRecibida({ cajaId: r.cajaId, fecha: r.fecha, resultado: res.data });
    });
  }

  return (
    <>
      <Button size="lg" className="h-12 w-full px-5 text-base font-semibold sm:w-auto" onClick={abrir}>
        <ArrowDownToLine className="size-5" strokeWidth={2} />
        Recibir e integrar
      </Button>
      <Dialog
        open={abierto}
        onOpenChange={(v) => {
          if (enviando) return;
          setAbierto(v);
        }}
      >
        <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Recibir la caja de portería del {formatFecha(r.fecha)}</DialogTitle>
            <DialogDescription className="text-base">
              Contá el efectivo que te entrega el Jefe de Portería y confirmá. Entra en tu caja de hoy y
              Tesorería lo valida todo junto.
            </DialogDescription>
          </DialogHeader>

          <dl className="divide-y rounded-md border text-base">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3">
              <dt className="font-medium">Tiene que entregarte (en mano)</dt>
              <dd>
                <Money monto={r.efectivo} className="text-2xl font-bold" />
              </dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
              <dt className="text-muted-foreground">Por transferencia (ya en el banco)</dt>
              <dd>
                <Money monto={r.transferencia} className="font-semibold" />
              </dd>
            </div>
            <div className="px-4 py-2.5 text-sm text-muted-foreground">
              <DesglosePorteria quintas={r.quintas} ambulantes={r.ambulantes} canon={r.canon} ajustes={r.ajustes} />
            </div>
          </dl>

          <div className="space-y-2">
            <Label htmlFor={idContado} className="text-base">
              ¿Cuánto efectivo te entregó?
            </Label>
            <Input
              id={idContado}
              inputMode="decimal"
              autoComplete="off"
              value={contado}
              onChange={(e) => {
                setContado(sanitizarMonto(e.target.value));
                setError(null);
              }}
              onFocus={(e) => e.currentTarget.select()}
              aria-invalid={!hayContado || !coincide}
              className="h-14 text-2xl font-semibold tabular md:text-2xl"
            />
            {!hayContado ? (
              <p className="text-sm font-medium text-destructive">Poné cuánto te entregó.</p>
            ) : coincide ? (
              <p className="flex items-center gap-1.5 text-sm font-medium text-pagado">
                <Check className="size-4 shrink-0" strokeWidth={2.5} />
                Coincide con lo que rindió.
              </p>
            ) : (
              <div
                className={cn(
                  "rounded-lg border px-4 py-3 text-sm",
                  diferencia < 0
                    ? "border-pendiente/40 bg-pendiente-suave text-pendiente"
                    : "border-parcial bg-parcial-suave"
                )}
                aria-live="polite"
              >
                <p className="text-base font-semibold tabular">
                  {diferencia < 0 ? "Faltan" : "Sobran"} {formatARS(Math.abs(diferencia))}
                </p>
                <p>
                  Queda anotado como {diferencia < 0 ? "faltante" : "sobrante"} de la caja de portería
                  (lo ve Tesorería). Contá abajo qué pasó.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={idObs} className="text-base">
              {coincide || !hayContado ? (
                <>
                  Observaciones <span className="font-normal text-muted-foreground">(opcional)</span>
                </>
              ) : (
                <>¿Qué pasó con la diferencia?</>
              )}
            </Label>
            <Textarea
              id={idObs}
              value={observaciones}
              onChange={(e) => {
                setObservaciones(e.target.value);
                setFaltaMotivo(false);
                setError(null);
              }}
              maxLength={500}
              aria-invalid={faltaMotivo}
              placeholder={
                coincide || !hayContado
                  ? "Ej.: me la entregó a las 18 h"
                  : "Ej.: el Jefe repone lo que falta mañana"
              }
              className="min-h-20 text-base md:text-base"
            />
            {faltaMotivo ? (
              <p className="text-sm font-medium text-destructive">Contá qué pasó con la diferencia.</p>
            ) : null}
          </div>

          {error ? <AlertaError error={error} titulo="No se pudo recibir la caja" /> : null}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" size="lg" className="h-12 px-5 text-base" onClick={() => setAbierto(false)} disabled={enviando}>
              Todavía no
            </Button>
            <Button
              size="lg"
              className="h-auto min-h-12 px-5 py-2 text-base font-semibold whitespace-normal"
              onClick={confirmar}
              disabled={enviando || !hayContado}
            >
              {enviando ? <Spinner className="size-5" /> : <ArrowDownToLine className="size-5" strokeWidth={2} />}
              Recibí {formatARS(hayContado ? recibido : r.efectivo)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Éxito de la recepción, con el comprobante para imprimir y firmar. */
export function ExitoRecepcion({ recibida, onCerrar }: { recibida: Recibida | null; onCerrar: () => void }) {
  const r = recibida?.resultado;
  return (
    <Dialog open={Boolean(recibida)} onOpenChange={(v) => (!v ? onCerrar() : undefined)}>
      <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto p-6 sm:max-w-md">
        {recibida && r ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Caja de portería recibida</DialogTitle>
              <DialogDescription className="text-base">
                La caja del {formatFecha(recibida.fecha)} ya está dentro de tu caja de hoy.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 rounded-lg bg-muted/60 px-4 py-4 text-center">
              <Sello grande estado="integrada" texto="Recibida" />
              <p className="text-base">Recibiste en mano</p>
              <Money monto={r.efectivo} className="block text-3xl font-bold" />
              <p className="text-sm text-muted-foreground">
                en efectivo · {formatARS(r.transferencia)} por transferencia
              </p>
              {Math.abs(r.diferencia) > 0.009 ? (
                <p className={cn("text-sm font-semibold", r.diferencia < 0 ? "text-pendiente" : "text-parcial")}>
                  {r.diferencia < 0 ? "Faltaron" : "Sobraron"} {formatARS(Math.abs(r.diferencia))}: quedó
                  anotado en la caja de portería.
                </p>
              ) : null}
              <p className="text-sm text-muted-foreground">
                <DesglosePorteria quintas={r.quintas} ambulantes={r.ambulantes} canon={r.canon} ajustes={r.ajustes} />
              </p>
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" size="lg" className="h-12 px-5 text-base" onClick={onCerrar}>
                Listo
              </Button>
              <Button
                asChild
                size="lg"
                className="h-auto min-h-12 px-5 py-2 text-base font-semibold whitespace-normal"
              >
                <Link href={`/cierre-caja/${recibida.cajaId}?auto=1`}>
                  <Printer className="size-5" strokeWidth={2} />
                  Imprimir comprobante
                </Link>
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Botón + éxito juntos, para la vista de una caja de portería (Tesorería / Líder).
 * Se monta siempre que el rol puede recibir; `mostrar` = la caja está rendida.
 */
export function RecibirCajaPorteria({ rendicion, mostrar }: { rendicion: RendicionARecibir; mostrar: boolean }) {
  const [recibida, setRecibida] = useState<Recibida | null>(null);
  if (!mostrar && !recibida) return null;
  return (
    <>
      {mostrar ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-5 sm:p-6">
          <div className="min-w-0 space-y-1">
            <p className="text-lg font-semibold">
              Recibí <Money monto={rendicion.efectivo} className="font-bold" /> en efectivo
            </p>
            <p className="text-sm text-muted-foreground">
              <DesglosePorteria
                quintas={rendicion.quintas}
                ambulantes={rendicion.ambulantes}
                canon={rendicion.canon}
                ajustes={rendicion.ajustes}
              />
            </p>
          </div>
          <BotonIntegrarRendicion rendicion={rendicion} onRecibida={setRecibida} />
        </div>
      ) : null}
      <ExitoRecepcion recibida={recibida} onCerrar={() => setRecibida(null)} />
    </>
  );
}
