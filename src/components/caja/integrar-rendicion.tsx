"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowDownToLine, Footprints, Printer, Tractor, Truck } from "lucide-react";
import { toast } from "sonner";
import { integrarCajaPorteria, type ResultadoIntegracion } from "@/lib/actions/cajas";
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
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";

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

/**
 * Confirmación de "Recibir e integrar": el detalle de lo que entra (sin cheques:
 * la caja de portería no recibe cheques) y observaciones opcionales.
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
  const [abierto, setAbierto] = useState(false);
  const [observaciones, setObservaciones] = useState("");
  const [enviando, startTransition] = useTransition();
  const idObs = useId();

  function confirmar() {
    startTransition(async () => {
      const res = await integrarCajaPorteria(r.cajaId, observaciones.trim() || undefined);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setAbierto(false);
      setObservaciones("");
      onRecibida({ cajaId: r.cajaId, fecha: r.fecha, resultado: res.data });
    });
  }

  return (
    <>
      <Button size="lg" className="h-12 w-full px-5 text-base font-semibold sm:w-auto" onClick={() => setAbierto(true)}>
        <ArrowDownToLine className="size-5" strokeWidth={2} />
        Recibir e integrar
      </Button>
      <Dialog
        open={abierto}
        onOpenChange={(v) => {
          if (enviando) return;
          setAbierto(v);
          if (!v) setObservaciones("");
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
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <dt className="font-medium">Efectivo a recibir (en mano)</dt>
              <dd>
                <Money monto={r.efectivo} className="text-2xl font-bold" />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
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
            <Label htmlFor={idObs} className="text-base">
              Observaciones <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id={idObs}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Ej.: faltaban $ 500, se reponen mañana"
              className="min-h-20 text-base md:text-base"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" size="lg" className="h-12 px-5 text-base" onClick={() => setAbierto(false)} disabled={enviando}>
              Todavía no
            </Button>
            <Button size="lg" className="h-12 px-5 text-base font-semibold" onClick={confirmar} disabled={enviando}>
              {enviando ? <Spinner className="size-5" /> : <ArrowDownToLine className="size-5" strokeWidth={2} />}
              Recibí {formatARS(r.efectivo)}
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
              <p className="text-sm text-muted-foreground">
                <DesglosePorteria quintas={r.quintas} ambulantes={r.ambulantes} canon={r.canon} ajustes={r.ajustes} />
              </p>
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" size="lg" className="h-12 px-5 text-base" onClick={onCerrar}>
                Listo
              </Button>
              <Button asChild size="lg" className="h-12 px-5 text-base font-semibold">
                <Link href={`/cierre-caja/${recibida.cajaId}?auto=1`}>
                  <Printer className="size-5" strokeWidth={2} />
                  Imprimir comprobante de recepción
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
