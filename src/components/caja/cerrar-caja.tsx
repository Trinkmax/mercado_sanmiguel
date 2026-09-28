"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarX2, HandCoins, Lock, Printer } from "lucide-react";
import { toast } from "sonner";
import { cerrarCaja } from "@/lib/actions/cajas";
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
import { Spinner } from "@/components/ui/spinner";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { CuentaCajon } from "@/components/caja/cuenta-cajon";
import type { Arqueo } from "@/components/caja/arqueo-tipos";
import { llamarAccion } from "@/lib/llamar-accion";

/**
 * Acción del final del día. El diálogo muestra la cuenta ANTES de confirmar
 * ("Vas a cerrar con…") y, al cerrar, pasa a un estado de éxito con lo que tiene
 * que haber y el botón para imprimir el cierre.
 *
 * Se monta siempre que el rol puede cerrar este tipo de caja (aunque ya esté
 * cerrada): así el estado de éxito sobrevive a la recarga de la página.
 * `mostrar` = la caja está abierta y se ofrece el botón.
 */
export function BotonCerrarCaja({
  cajaId,
  tipo,
  fecha,
  arqueo,
  mostrar,
  forzado = false,
}: {
  cajaId: string;
  tipo: "administracion" | "guardia";
  fecha: string;
  arqueo: Arqueo;
  mostrar: boolean;
  /** Tesorería cierra una caja de un día anterior que quedó abierta. */
  forzado?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [resultado, setResultado] = useState<Arqueo | null>(null);
  const [enviando, startTransition] = useTransition();
  const router = useRouter();
  const rinde = tipo === "guardia" && !forzado;
  const Icono = forzado ? CalendarX2 : rinde ? HandCoins : Lock;
  const verbo = forzado ? "Cerrar (quedó abierta)" : rinde ? "Rendir caja" : "Cerrar caja";

  if (!mostrar && !resultado) return null;

  function confirmar() {
    startTransition(async () => {
      const res = await llamarAccion(() => cerrarCaja(cajaId));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setResultado(res.data);
    });
  }

  function cerrarDialogo(v: boolean) {
    if (enviando) return;
    setAbierto(v);
    if (!v) setResultado(null);
  }

  const a = resultado ?? arqueo;

  return (
    <>
      {mostrar ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-5 sm:p-6">
          <div className="min-w-0">
            <p className="text-lg font-semibold">
              {forzado ? `La caja del ${formatFecha(fecha)} quedó abierta` : "¿Terminaste el día?"}
            </p>
            <p className="text-sm text-muted-foreground">
              {forzado
                ? "Cerrala para poder contarla y validarla. Queda anotado que la cerró Tesorería."
                : rinde
                  ? "Rendí la caja y el sistema te dice cuánto efectivo entregar en Administración."
                  : "Cerrá la caja y el sistema te dice cuánto tenés que tener."}
            </p>
          </div>
          <Button
            size="lg"
            className="h-13 w-full px-8 text-base font-semibold sm:w-auto"
            onClick={() => {
              setAbierto(true);
              // La vista previa usa el arqueo de la página: se trae de nuevo por si hubo cobros recién.
              router.refresh();
            }}
          >
            <Icono className="size-5" strokeWidth={2} />
            {verbo}
          </Button>
        </div>
      ) : null}

      <Dialog open={abierto} onOpenChange={cerrarDialogo}>
        <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto p-6 sm:max-w-lg">
          {resultado ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">
                  {rinde ? "Caja de portería rendida" : "Caja cerrada"}
                </DialogTitle>
                <DialogDescription className="text-base">
                  {rinde
                    ? "Llevá el efectivo a Administración. Cuando lo reciban, entra en la caja mayor."
                    : "Contá la plata y fijate que coincida. Tesorería la controla y la valida."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 rounded-lg bg-muted/60 px-4 py-4 text-center">
                <Sello grande estado="cerrada" texto={rinde ? "Rendida" : "Cerrada"} />
                {rinde ? (
                  <>
                    <p className="text-base">Entregá en Administración</p>
                    <Money monto={a.efectivo} className="block text-3xl font-bold" />
                    <p className="text-sm text-muted-foreground">
                      en efectivo — Quintas {formatARS(a.quintas)} · Ambulantes {formatARS(a.ambulantes)} · Bono
                      camioneros {formatARS(a.canon)}
                      {a.transferencia > 0.009 ? ` (+${formatARS(a.transferencia)} ya están en el banco)` : ""}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-base">Tenés que tener</p>
                    <Money monto={a.efectivo} className="block text-3xl font-bold" />
                    <p className="text-sm text-muted-foreground">
                      en efectivo · {formatARS(a.transferencia)} en el banco
                      {a.cheques > 0.009 ? ` · ${formatARS(a.cheques)} en cheques` : ""}
                    </p>
                  </>
                )}
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 px-5 text-base"
                  onClick={() => cerrarDialogo(false)}
                >
                  Listo
                </Button>
                <Button asChild size="lg" className="h-12 px-5 text-base font-semibold">
                  <Link href={`/cierre-caja/${cajaId}?auto=1`}>
                    <Printer className="size-5" strokeWidth={2} />
                    Imprimir cierre
                  </Link>
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">
                  {rinde ? "Rendir la caja a Administración" : forzado ? "Cerrar la caja que quedó abierta" : "Cerrar la caja"}
                </DialogTitle>
                <DialogDescription className="text-base">
                  {rinde
                    ? "Vas a rendir con lo cargado hasta ahora:"
                    : "Vas a cerrar con esta cuenta (lo cargado hasta ahora):"}
                </DialogDescription>
              </DialogHeader>

              {rinde ? (
                <div className="rounded-lg border px-4 py-3">
                  <p className="text-base">
                    Entregás <Money monto={a.efectivo} className="text-2xl font-bold" /> en efectivo
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Quintas {formatARS(a.quintas)} · Ambulantes {formatARS(a.ambulantes)} · Bono camioneros{" "}
                    {formatARS(a.canon)}
                    {a.transferencia > 0.009 ? ` · ${formatARS(a.transferencia)} por transferencia` : ""}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border px-4 py-3">
                  <CuentaCajon arqueo={a} tipo={tipo} variante="compacta" />
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                {rinde
                  ? "Después de rendir, Portería no puede cobrar más canon hoy; si hubo un error pedí la reapertura."
                  : "Después de cerrar no se cargan más cobros. Si te olvidaste de algo, se reabre mientras Tesorería no la valide."}
              </p>

              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 px-5 text-base"
                  onClick={() => cerrarDialogo(false)}
                  disabled={enviando}
                >
                  Todavía no
                </Button>
                <Button size="lg" className="h-12 px-5 text-base font-semibold" onClick={confirmar} disabled={enviando}>
                  {enviando ? <Spinner className="size-5" /> : <Icono className="size-5" strokeWidth={2} />}
                  {rinde ? "Rendir caja" : "Cerrar caja"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
