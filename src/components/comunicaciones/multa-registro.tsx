"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Info } from "lucide-react";
import { dejarSinEfectoMulta } from "@/lib/actions/sanciones";
import { formatARS, formatFecha, formatFechaHora } from "@/lib/format";
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
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { MOTIVOS_SIN_EFECTO, SELLO_MULTA, type EstadoMulta } from "./constantes";
import { llamarAccion } from "@/lib/llamar-accion";
import { AvisoError } from "./aviso-error";

/**
 * Caja de la multa del registro (D4): monto grande, sello Pendiente/Pagada/Sin efecto, vence,
 * y "Dejar sin efecto la multa" (motivo obligatorio). Si ya se cobró algo en caja, explica qué
 * hacer. Lo que se descontó solo de su saldo a favor NO bloquea: al dejarla sin efecto, esa
 * plata vuelve a su cuenta (0025).
 */
export function MultaRegistro({
  registroId,
  monto,
  pagado,
  pagadoConSaldo = 0,
  vencimiento,
  estado,
  sinEfecto,
  puedeGestionar,
  hoy,
}: {
  registroId: string;
  monto: number;
  pagado: number;
  /** Parte de `pagado` que salió sola de su saldo a favor (no de un cobro hecho para la multa). */
  pagadoConSaldo?: number;
  vencimiento: string | null;
  estado: Exclude<EstadoMulta, "sin_multa">;
  sinEfecto: { en: string; por: string | null; motivo: string | null } | null;
  puedeGestionar: boolean;
  /** Fecha de hoy (huso AR) para decir "Venció" o "Vence". */
  hoy: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function confirmar() {
    setError(null);
    if (!motivo.trim()) {
      setError("Contá por qué la multa queda sin efecto.");
      return;
    }
    startTransition(async () => {
      const res = await llamarAccion(() => dejarSinEfectoMulta({ registroId, motivo: motivo.trim() }));
      if (!res.ok) {
        // Reintento después de un corte: el primer pedido ya la había dejado sin efecto (o lo
        // hizo otra persona). No es un error: se cierra y se muestra cómo quedó.
        if (res.error.includes("no tiene una multa vigente")) {
          setAbierto(false);
          setMotivo("");
          toast.info("La multa ya había quedado sin efecto");
          router.refresh();
          return;
        }
        setError(res.error);
        return;
      }
      toast.success(
        conSaldo > 0
          ? `Listo: la multa quedó sin efecto y los ${formatARS(conSaldo)} de su saldo a favor volvieron a su cuenta`
          : `Listo: la multa de ${formatARS(monto)} quedó sin efecto y se sacó de su cuenta`
      );
      setAbierto(false);
      setMotivo("");
      router.refresh();
    });
  }

  const vencida = estado !== "sin_efecto" && estado !== "pagada" && vencimiento !== null && vencimiento < hoy;
  const conSaldo = Math.min(Math.max(pagadoConSaldo, 0), pagado);
  /** Lo cobrado en caja para esta multa: eso sí hay que anularlo primero. */
  const cobradoEnCaja = Math.round((pagado - conSaldo) * 100) / 100;
  const vigente = estado === "pendiente" || estado === "parcial" || estado === "pagada";

  return (
    <section
      aria-label="Multa"
      className={cn(
        "space-y-3 rounded-xl border-2 p-4 sm:p-5",
        estado === "sin_efecto"
          ? "border-border bg-muted/40"
          : estado === "pagada"
            ? "border-pagado/30 bg-pagado-suave"
            : "border-pendiente/30 bg-pendiente-suave"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">Multa</p>
        <Sello estado={SELLO_MULTA[estado].estado} texto={SELLO_MULTA[estado].texto} />
      </div>
      <Money
        monto={monto}
        className={cn(
          "block text-3xl font-bold",
          estado === "sin_efecto"
            ? "text-muted-foreground line-through"
            : estado === "pagada"
              ? "text-pagado"
              : "text-pendiente"
        )}
      />
      {estado === "sin_efecto" && sinEfecto ? (
        <p className="text-sm">
          Quedó sin efecto el <span className="tabular">{formatFechaHora(sinEfecto.en)}</span>
          {sinEfecto.por ? ` por ${sinEfecto.por}` : ""}
          {sinEfecto.motivo ? (
            <>
              : <span className="italic">&ldquo;{sinEfecto.motivo}&rdquo;</span>
            </>
          ) : null}
        </p>
      ) : estado === "pagada" ? (
        <p className="text-sm">
          {conSaldo >= pagado && conSaldo > 0
            ? "Está pagada: se descontó sola de su saldo a favor."
            : "Está pagada. Se cobra como cualquier otro cargo de su cuenta."}
        </p>
      ) : (
        <p className="text-sm">
          {estado === "parcial" ? (
            <>
              Pagó <Money monto={pagado} className="font-semibold" />, le falta{" "}
              <Money monto={Math.max(monto - pagado, 0)} className="font-semibold" />.{" "}
            </>
          ) : (
            "Está en su cuenta como un cargo más. "
          )}
          {vencida ? "Venció" : "Vence"} el <span className="font-semibold tabular">{formatFecha(vencimiento)}</span>.
        </p>
      )}

      {puedeGestionar && vigente ? (
        cobradoEnCaja > 0.009 ? (
          <p className="flex items-start gap-2 rounded-md bg-card/70 px-3 py-2 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-parcial" strokeWidth={2} />
            <span>
              Ya se cobraron <Money monto={cobradoEnCaja} className="font-semibold" /> en caja: para dejarla
              sin efecto, primero anulá ese cobro desde la caja.
            </span>
          </p>
        ) : (
          <>
            <Button
              variant="outline"
              className="min-h-11 bg-card text-destructive hover:text-destructive"
              onClick={() => {
                setError(null);
                setAbierto(true);
              }}
            >
              <Ban className="size-4" strokeWidth={2} />
              Dejar sin efecto la multa
            </Button>
            {/* Mientras se guarda no se cierra (si no, el resultado no se vería). */}
            <Dialog open={abierto} onOpenChange={(v) => !pendiente && setAbierto(v)}>
              <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
                <DialogHeader>
                  {/* pr-8: el título largo no pasa por debajo de la X de cerrar. */}
                  <DialogTitle className="pr-8 text-lg">
                    ¿Dejar sin efecto la multa de <span className="whitespace-nowrap">{formatARS(monto)}</span>?
                  </DialogTitle>
                  <DialogDescription className="text-sm">
                    Se saca de la cuenta del cliente. El registro y su hilo siguen; queda anotado quién lo
                    hizo, cuándo y por qué.
                  </DialogDescription>
                  {conSaldo > 0 ? (
                    <p className="rounded-md bg-pagado-suave px-3 py-2 text-sm">
                      Los <Money monto={conSaldo} className="font-semibold" /> que se habían descontado de su
                      saldo a favor vuelven a su cuenta: pagan otras deudas o le quedan a favor.
                    </p>
                  ) : null}
                </DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor={`motivo-${registroId}`} className="text-base">
                    ¿Por qué?
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {MOTIVOS_SIN_EFECTO.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMotivo(m)}
                        className={cn(
                          "min-h-11 rounded-full border px-3 text-sm transition-colors",
                          motivo === m ? "border-primary bg-accent" : "bg-card hover:bg-accent/60"
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <Textarea
                    id={`motivo-${registroId}`}
                    value={motivo}
                    onChange={(e) => {
                      setMotivo(e.target.value);
                      if (error) setError(null);
                    }}
                    rows={3}
                    maxLength={2000}
                    placeholder="Contá el motivo"
                    className="text-base md:text-base"
                  />
                  {error ? <AvisoError mensaje={error} /> : null}
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" className="h-12" disabled={pendiente} onClick={() => setAbierto(false)}>
                    No, volver
                  </Button>
                  <Button
                    variant="destructive"
                    size="lg"
                    className="h-12 font-semibold"
                    disabled={pendiente}
                    onClick={confirmar}
                  >
                    {pendiente ? <Spinner /> : null}
                    Dejar sin efecto
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )
      ) : null}
    </section>
  );
}
