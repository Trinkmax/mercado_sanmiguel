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

/**
 * Caja de la multa del registro (D4): monto grande, sello Pendiente/Pagada/Sin efecto, vence,
 * y "Dejar sin efecto la multa" (motivo obligatorio). Si ya se cobró algo, explica qué hacer.
 */
export function MultaRegistro({
  registroId,
  monto,
  pagado,
  vencimiento,
  estado,
  sinEfecto,
  puedeGestionar,
  hoy,
}: {
  registroId: string;
  monto: number;
  pagado: number;
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
      const res = await dejarSinEfectoMulta({ registroId, motivo: motivo.trim() });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`Listo: la multa de ${formatARS(monto)} quedó sin efecto y se sacó de su cuenta`);
      setAbierto(false);
      setMotivo("");
      router.refresh();
    });
  }

  const vencida = estado !== "sin_efecto" && estado !== "pagada" && vencimiento !== null && vencimiento < hoy;

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
        <p className="text-sm">Está pagada. Se cobra como cualquier otro cargo de su cuenta.</p>
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

      {puedeGestionar && (estado === "pendiente" || estado === "parcial") ? (
        pagado > 0 ? (
          <p className="flex items-start gap-2 rounded-md bg-card/70 px-3 py-2 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-parcial" strokeWidth={2} />
            Ya se cobraron <Money monto={pagado} className="font-semibold" />: para dejarla sin efecto,
            primero anulá ese cobro desde la caja.
          </p>
        ) : (
          <>
            <Button
              variant="outline"
              className="min-h-11 bg-card text-destructive hover:text-destructive"
              onClick={() => setAbierto(true)}
            >
              <Ban className="size-4" strokeWidth={2} />
              Dejar sin efecto la multa
            </Button>
            <Dialog open={abierto} onOpenChange={setAbierto}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-lg">¿Dejar sin efecto la multa de {formatARS(monto)}?</DialogTitle>
                  <DialogDescription className="text-sm">
                    Se saca de la cuenta del cliente. El registro y su hilo siguen; queda anotado quién lo
                    hizo, cuándo y por qué.
                  </DialogDescription>
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
                          "min-h-10 rounded-full border px-3 text-sm transition-colors",
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
                    onChange={(e) => setMotivo(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder="Contá el motivo"
                    className="text-base md:text-base"
                  />
                  {error ? (
                    <p role="alert" className="text-sm font-medium text-pendiente">
                      {error}
                    </p>
                  ) : null}
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
