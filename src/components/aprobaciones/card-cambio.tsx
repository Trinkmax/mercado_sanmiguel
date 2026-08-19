"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Stamp, XCircle } from "lucide-react";
import { toast } from "sonner";
import { aprobarCambio, rechazarCambio } from "@/lib/actions/aprobaciones";
import { formatFechaHora } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Codigo } from "@/components/shared/codigo";
import { DiffCambio } from "@/components/aprobaciones/diff-cambio";
import { ChipsCambio } from "@/components/aprobaciones/chips-cambio";
import type {
  CambioFila,
  ReferenciaConcepto,
} from "@/components/aprobaciones/tipos";

/**
 * Un cambio pendiente: qué se pide, quién y cuándo, el diff legible y los dos
 * botones grandes: Aprobar (aplica en el acto) o Rechazar (con motivo).
 */
export function CardCambio({
  cambio,
  conceptosPorId,
}: {
  cambio: CambioFila;
  conceptosPorId: Record<string, ReferenciaConcepto>;
}) {
  const router = useRouter();
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [errorMotivo, setErrorMotivo] = useState<string | null>(null);
  const [aprobandoPendiente, startAprobar] = useTransition();
  const [rechazoPendiente, startRechazar] = useTransition();
  const ocupado = aprobandoPendiente || rechazoPendiente;

  function aprobar() {
    startAprobar(async () => {
      const res = await aprobarCambio({ cambio_id: cambio.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      // Link a la ficha: la del cliente nuevo (alta) o la del cliente afectado.
      const fichaId =
        res.data.entidad === "cliente" && res.data.resultado_id
          ? res.data.resultado_id
          : cambio.cliente?.id ?? null;
      toast.success("Aplicado", {
        description: cambio.resumen,
        action: fichaId
          ? {
              label: "Ver ficha",
              onClick: () => router.push(`/clientes/${fichaId}`),
            }
          : undefined,
      });
    });
  }

  function rechazar() {
    const texto = motivo.trim();
    if (texto.length < 3) {
      setErrorMotivo("Contá por qué lo rechazás: así Administración sabe qué corregir.");
      return;
    }
    setErrorMotivo(null);
    startRechazar(async () => {
      const res = await rechazarCambio({ cambio_id: cambio.id, motivo: texto });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Rechazado", { description: cambio.resumen });
      setRechazando(false);
      setMotivo("");
    });
  }

  return (
    <article
      className="space-y-5 rounded-lg bg-card p-5 ring-1 ring-foreground/10 sm:p-6"
      aria-labelledby={`cambio-${cambio.id}`}
    >
      {/* Encabezado: chips + resumen + quién / cuándo */}
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <ChipsCambio entidad={cambio.entidad} accion={cambio.accion} />
          {cambio.concepto ? <Codigo codigo={cambio.concepto.codigo} /> : null}
        </div>
        <h2
          id={`cambio-${cambio.id}`}
          className="font-display text-lg font-bold tracking-tight text-balance sm:text-xl"
        >
          {cambio.resumen}
        </h2>
        <p className="text-sm text-muted-foreground">
          Lo pidió{" "}
          <span className="font-medium text-foreground">
            {cambio.solicitadoPor ?? "alguien del equipo"}
          </span>
          {cambio.solicitadoRol ? ` (${cambio.solicitadoRol})` : ""} ·{" "}
          {formatFechaHora(cambio.solicitadoEn)}
          {cambio.cliente ? (
            <>
              {" · "}
              <Link
                href={`/clientes/${cambio.cliente.id}`}
                className="inline-flex items-center gap-0.5 font-medium text-primary underline-offset-4 hover:underline"
              >
                Ver ficha de {cambio.cliente.nombre}
                <ArrowUpRight className="size-4" strokeWidth={2} />
              </Link>
            </>
          ) : null}
        </p>
      </header>

      {/* Qué cambia */}
      <DiffCambio cambio={cambio} conceptosPorId={conceptosPorId} />

      {/* Acciones */}
      <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          size="lg"
          className="h-12 px-6 text-base"
          disabled={ocupado}
          onClick={() => {
            setErrorMotivo(null);
            setRechazando(true);
          }}
        >
          <XCircle className="size-5" strokeWidth={2} />
          Rechazar
        </Button>
        <Button
          size="lg"
          className="h-12 px-8 text-base font-semibold"
          disabled={ocupado}
          onClick={aprobar}
        >
          {aprobandoPendiente ? (
            <Spinner className="size-5" />
          ) : (
            <Stamp className="size-5" strokeWidth={2} />
          )}
          Aprobar
        </Button>
      </div>

      {/* Rechazo: motivo obligatorio */}
      <Dialog
        open={rechazando}
        onOpenChange={(abierto) => {
          if (!rechazoPendiente) setRechazando(abierto);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">¿Rechazar este cambio?</DialogTitle>
            <DialogDescription className="text-sm/relaxed">
              {cambio.resumen}. No se aplica nada; quien lo pidió va a ver tu
              motivo para corregirlo y volver a enviarlo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`motivo-${cambio.id}`} className="text-sm">
              Motivo del rechazo
            </Label>
            <Textarea
              id={`motivo-${cambio.id}`}
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value);
                if (errorMotivo) setErrorMotivo(null);
              }}
              placeholder="Por ejemplo: el CUIT está mal, faltan dígitos"
              className="min-h-24 text-base"
              maxLength={500}
              autoFocus
              aria-invalid={errorMotivo ? true : undefined}
            />
            {errorMotivo ? (
              <p className="text-sm font-medium text-pendiente">{errorMotivo}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Obligatorio. Lo ve Administración junto al cambio rechazado.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline" className="h-11 px-5 text-base" disabled={rechazoPendiente}>
                Volver
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              className="h-11 px-6 text-base font-semibold"
              disabled={rechazoPendiente}
              onClick={rechazar}
            >
              {rechazoPendiente ? <Spinner className="size-5" /> : <XCircle className="size-5" strokeWidth={2} />}
              Rechazar cambio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
