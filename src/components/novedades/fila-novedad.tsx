"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Check, Paperclip, Pencil, Trash2, X } from "lucide-react";
import {
  anularNovedad,
  borrarNovedad,
  revisarNovedad,
} from "@/lib/actions/novedades";
import { formatFechaHora } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Sello } from "@/components/shared/sello";
import { DialogoMotivo } from "./dialogo-motivo";
import {
  DEF_TIPO,
  fraseNovedad,
  selloNovedad,
  type EstadoNovedad,
  type NovedadVista,
} from "./constantes";

type Dialogo = "rechazar" | "anular" | "borrar" | null;

/**
 * Una novedad con su sello y lo que se puede hacer: el que la cargó la corrige o la borra
 * mientras espera; Administración / Líder la aprueban, la rechazan (con motivo) o anulan una
 * aprobada (con motivo). Todo lo que cambia estado deja rastro en la base.
 */
export function FilaNovedad({
  n,
  nombre,
  puedeRevisar,
  miUserId,
  className,
}: {
  n: NovedadVista;
  /** Nombre del empleado (bandeja de aprobación); en la planilla ya está en el encabezado. */
  nombre?: string;
  puedeRevisar: boolean;
  miUserId: string;
  className?: string;
}) {
  const router = useRouter();
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [estado, setEstado] = useState<EstadoNovedad>(n.estado);
  const [pendiente, startTransition] = useTransition();
  const def = DEF_TIPO[n.tipo];
  const Icono = def.icono;

  const esPendiente = estado === "pendiente";
  const esMia = n.cargada_por === miUserId;
  const puedeEditar = esPendiente && (puedeRevisar || esMia);
  // Borrar, solo quien la cargó: Administración rechaza con motivo (queda el rastro).
  const puedeBorrar = esPendiente && esMia;

  function aprobar() {
    setEstado("aprobada"); // optimista: el sello cambia ya
    startTransition(async () => {
      const res = await revisarNovedad({ id: n.id, aprobar: true });
      if (!res.ok) {
        setEstado(n.estado);
        toast.error(res.error);
        return;
      }
      toast.success(nombre ? `Aprobada la novedad de ${nombre}` : "Novedad aprobada");
      router.refresh();
    });
  }

  async function rechazar(motivo: string): Promise<string | null> {
    const res = await revisarNovedad({ id: n.id, aprobar: false, motivo });
    if (!res.ok) return res.error;
    setDialogo(null);
    setEstado("rechazada");
    toast.success("Novedad rechazada: el Jefe de Portería ve el motivo");
    router.refresh();
    return null;
  }

  async function anular(motivo: string): Promise<string | null> {
    const res = await anularNovedad({ id: n.id, motivo });
    if (!res.ok) return res.error;
    setDialogo(null);
    setEstado("anulada");
    toast.success("Novedad anulada: ya no cuenta en la planilla");
    router.refresh();
    return null;
  }

  async function borrar(): Promise<string | null> {
    const res = await borrarNovedad({ id: n.id });
    if (!res.ok) return res.error;
    setDialogo(null);
    toast.success("Novedad borrada");
    router.refresh();
    return null;
  }

  const frase = fraseNovedad({ ...n, conAdjunto: n.tieneAdjunto });
  const tachada = estado === "anulada" || estado === "rechazada";

  return (
    <div className={cn("flex flex-col gap-3 py-3 sm:flex-row sm:items-start", className)}>
      <div className="flex min-w-0 flex-1 gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground/80">
          <Icono className="size-4.5" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {nombre ? <span className="font-semibold">{nombre}</span> : null}
            <Sello estado={selloNovedad(estado)} />
          </div>
          <p className={cn("text-[15px] leading-snug", tachada && "text-muted-foreground line-through")}>
            {frase}
          </p>
          {n.detalle && n.tipo !== "otra" ? (
            <p className="text-sm text-muted-foreground">“{n.detalle}”</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Cargó {n.cargadaPor ?? "—"} · <span className="tabular">{formatFechaHora(n.cargada_en)}</span>
            {n.revisadaPor && n.estado !== "pendiente" ? (
              <>
                {" · "}
                {n.estado === "rechazada" ? "Rechazó" : "Aprobó"} {n.revisadaPor}
              </>
            ) : null}
          </p>
          {estado === "rechazada" && n.motivo_rechazo ? (
            <p className="rounded-md bg-pendiente-suave px-3 py-2 text-sm">
              <span className="font-semibold">Motivo del rechazo:</span> {n.motivo_rechazo}
            </p>
          ) : null}
          {estado === "anulada" && n.motivo_anulacion ? (
            <p className="rounded-md bg-muted px-3 py-2 text-sm">
              <span className="font-semibold">Anulada{n.anuladaPor ? ` por ${n.anuladaPor}` : ""}:</span>{" "}
              {n.motivo_anulacion}
            </p>
          ) : null}
          {n.adjuntoUrl ? (
            <a
              href={n.adjuntoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-md border bg-card px-3 text-sm font-medium hover:bg-muted"
            >
              <Paperclip className="size-4" strokeWidth={2} />
              {n.tipo === "falta" || n.tipo === "licencia" ? "Ver certificado" : "Ver adjunto"}
            </a>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 sm:max-w-72 sm:justify-end">
        {esPendiente && puedeRevisar ? (
          <>
            <Button size="lg" className="h-11 px-4 font-semibold" disabled={pendiente} onClick={aprobar}>
              {pendiente ? <Spinner /> : <Check className="size-5" strokeWidth={2.2} />}
              Aprobar
            </Button>
            <Button
              variant="outline"
              className="h-11 px-4 text-pendiente hover:text-pendiente"
              disabled={pendiente}
              onClick={() => setDialogo("rechazar")}
            >
              <X className="size-4" strokeWidth={2.2} />
              Rechazar
            </Button>
          </>
        ) : null}
        {puedeEditar ? (
          <Button asChild variant="outline" className="h-11 px-4">
            <Link href={`/novedades/editar/${n.id}`}>
              <Pencil className="size-4" strokeWidth={2} />
              Corregir
            </Link>
          </Button>
        ) : null}
        {puedeBorrar ? (
          <Button
            variant="ghost"
            className="h-11 px-3 text-muted-foreground"
            disabled={pendiente}
            onClick={() => setDialogo("borrar")}
          >
            <Trash2 className="size-4" strokeWidth={2} />
            Borrar
          </Button>
        ) : null}
        {estado === "aprobada" && puedeRevisar ? (
          <Button
            variant="ghost"
            className="h-11 px-3 text-muted-foreground"
            disabled={pendiente}
            onClick={() => setDialogo("anular")}
          >
            <Ban className="size-4" strokeWidth={2} />
            Anular
          </Button>
        ) : null}
      </div>

      <DialogoMotivo
        abierto={dialogo === "rechazar"}
        onCerrar={() => setDialogo(null)}
        titulo="Rechazar la novedad"
        descripcion="El Jefe de Portería ve el motivo y puede cargarla de nuevo corregida."
        placeholder="Ej.: Ese día estaba de franco"
        sugerencias={["Ese día estaba de franco", "Falta el certificado", "La fecha no es correcta"]}
        confirmar="Rechazar"
        destructiva
        onConfirmar={rechazar}
      />
      <DialogoMotivo
        abierto={dialogo === "anular"}
        onCerrar={() => setDialogo(null)}
        titulo="Anular la novedad aprobada"
        descripcion="Deja de contar en la planilla pero no se borra: queda quién la anuló, cuándo y por qué."
        placeholder="Ej.: Se cargó en el día equivocado"
        sugerencias={["Se cargó en el día equivocado", "Se cargó dos veces", "Era de otro empleado"]}
        confirmar="Anular novedad"
        destructiva
        onConfirmar={anular}
      />
      <DialogoMotivo
        abierto={dialogo === "borrar"}
        onCerrar={() => setDialogo(null)}
        titulo="¿Borrar esta novedad?"
        descripcion={`${frase}. Todavía no estaba aprobada: se borra del todo.`}
        conMotivo={false}
        confirmar="Borrar"
        destructiva
        onConfirmar={borrar}
      />
    </div>
  );
}
