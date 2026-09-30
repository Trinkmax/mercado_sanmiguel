"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { darDeBajaRevisada, marcarRevisada } from "@/lib/actions/aprobaciones";
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
import { Sello } from "@/components/shared/sello";
import { DiffCambio } from "@/components/aprobaciones/diff-cambio";
import type { CambioFila, ReferenciaConcepto } from "@/components/aprobaciones/tipos";
import { llamarAccion } from "@/lib/llamar-accion";

/**
 * Alta de ambulante que el Jefe de Portería aplicó en el acto (§1.3 D-P1): ya existe y ya se
 * le pudo cobrar. El Líder la mira y la marca revisada, o —si no está de acuerdo— lo da de
 * baja (con motivo, queda en el registro) y la revisión queda firmada igual.
 */
export function CardRevision({
  cambio,
  conceptosPorId,
}: {
  cambio: CambioFila;
  conceptosPorId: Record<string, ReferenciaConcepto>;
}) {
  const [revisando, startRevisar] = useTransition();
  const [dandoDeBaja, startBaja] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [errorMotivo, setErrorMotivo] = useState<string | null>(null);
  const ocupado = revisando || dandoDeBaja;
  const cliente = cambio.cliente;
  const sigueActivo = cliente?.activo !== false;

  function revisar() {
    startRevisar(async () => {
      const res = await llamarAccion(() => marcarRevisada({ cambio_id: cambio.id }));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Revisada", { description: cambio.resumen });
    });
  }

  function darDeBaja() {
    const texto = motivo.trim();
    if (texto.length < 3) {
      setErrorMotivo("Contá por qué lo das de baja: queda en el registro.");
      return;
    }
    if (!cliente) return;
    setErrorMotivo(null);
    startBaja(async () => {
      const res = await llamarAccion(() => darDeBajaRevisada({
        cambio_id: cambio.id,
        cliente_id: cliente.id,
        motivo: texto,
      }));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${cliente.nombre} quedó dado de baja`, {
        description: "El alta quedó revisada.",
      });
      setAbierto(false);
      setMotivo("");
    });
  }

  return (
    <article
      className="space-y-5 rounded-lg bg-card p-5 ring-1 ring-foreground/10 sm:p-6"
      aria-labelledby={`revision-${cambio.id}`}
      data-tour="aprobaciones-revision"
    >
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Sello estado="revisar" />
          {!sigueActivo ? <Sello estado="inactivo" texto="Ya dado de baja" /> : null}
        </div>
        <h2
          id={`revision-${cambio.id}`}
          className="font-display text-lg font-bold tracking-tight text-balance sm:text-xl"
        >
          {cambio.resumen}
        </h2>
        <p className="text-sm text-muted-foreground">
          Lo cargó{" "}
          <span className="font-medium text-foreground">
            {cambio.solicitadoPor ?? "el Jefe de Portería"}
          </span>
          {cambio.solicitadoRol ? ` (${cambio.solicitadoRol})` : ""} ·{" "}
          {formatFechaHora(cambio.solicitadoEn)}
          {cliente ? (
            <>
              {" · "}
              <Link
                href={`/clientes/${cliente.id}`}
                className="inline-flex min-h-11 items-center gap-0.5 font-medium text-primary underline-offset-4 hover:underline"
              >
                Ver ficha de {cliente.nombre}
                <ArrowUpRight className="size-4" strokeWidth={2} />
              </Link>
            </>
          ) : null}
        </p>
      </header>

      <DiffCambio cambio={cambio} conceptosPorId={conceptosPorId} />

      <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-end">
        {sigueActivo && cliente ? (
          <Button
            variant="outline"
            size="lg"
            className="h-12 px-6 text-base text-destructive hover:text-destructive"
            disabled={ocupado}
            onClick={() => {
              setErrorMotivo(null);
              setAbierto(true);
            }}
          >
            <UserX className="size-5" strokeWidth={2} />
            Dar de baja
          </Button>
        ) : null}
        <Button size="lg" className="h-12 px-8 text-base font-semibold" disabled={ocupado} onClick={revisar}>
          {revisando ? <Spinner className="size-5" /> : <CheckCheck className="size-5" strokeWidth={2} />}
          Marcar revisada
        </Button>
      </div>

      <Dialog
        open={abierto}
        onOpenChange={(v) => {
          if (!dandoDeBaja) setAbierto(v);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">¿Dar de baja a {cliente?.nombre}?</DialogTitle>
            <DialogDescription className="text-sm/relaxed">
              Deja de figurar entre los ambulantes y no se le puede cobrar más. Lo que ya pagó queda
              registrado y se puede reactivar desde su ficha.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`motivo-baja-${cambio.id}`} className="text-sm">
              ¿Por qué lo das de baja?
            </Label>
            <Textarea
              id={`motivo-baja-${cambio.id}`}
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value);
                if (errorMotivo) setErrorMotivo(null);
              }}
              placeholder="Ej.: ya estaba cargado con otro número"
              className="min-h-24 text-base"
              maxLength={300}
              aria-invalid={errorMotivo ? true : undefined}
            />
            {errorMotivo ? (
              <p className="text-sm font-medium text-pendiente">{errorMotivo}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Obligatorio. Queda en el registro del cambio.</p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline" className="h-11 px-5 text-base" disabled={dandoDeBaja}>
                Volver
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              className="h-11 px-6 text-base font-semibold"
              disabled={dandoDeBaja}
              onClick={darDeBaja}
            >
              {dandoDeBaja ? <Spinner className="size-5" /> : <UserX className="size-5" strokeWidth={2} />}
              Sí, darlo de baja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
