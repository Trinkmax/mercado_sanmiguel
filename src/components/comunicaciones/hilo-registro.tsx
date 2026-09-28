import { Info, MessageSquareDashed, Paperclip } from "lucide-react";
import type { Rol } from "@/lib/auth";
import { LABEL_ROL } from "@/lib/roles";
import { formatFechaHora } from "@/lib/format";
import { cn } from "@/lib/utils";
import { nombreMensajeSocio } from "./constantes";

export type MensajeRegistro = {
  id: string;
  autor_id: string | null;
  autor_nombre: string;
  autor_rol: Rol;
  mensaje: string;
  es_descargo: boolean;
  creado_en: string;
  adjunto_url?: string | null;
};

/** Hechos del registro que no son mensajes (se intercalan por fecha, centrados). */
export type EventoRegistro = { id: string; fecha: string; texto: string };

/**
 * Hilo de descargo y respuesta de un registro. Los míos a la derecha (azul suave); los del
 * socio con la etiqueta "Descargo" / "Respuesta"; los hechos (multa sin efecto) centrados.
 * Mismo estilo que el hilo de solicitudes, sin depender de sus archivos.
 */
export function HiloRegistro({
  mensajes,
  eventos = [],
  usuarioId,
  tipo,
  paraSocio = false,
  className,
}: {
  mensajes: MensajeRegistro[];
  eventos?: EventoRegistro[];
  usuarioId: string;
  tipo: string;
  paraSocio?: boolean;
  className?: string;
}) {
  const items = [
    ...mensajes.map((m) => ({ clase: "mensaje" as const, fecha: m.creado_en, m })),
    ...eventos.map((e) => ({ clase: "evento" as const, fecha: e.fecha, e })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha));

  if (items.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center text-muted-foreground",
          className
        )}
      >
        <MessageSquareDashed className="size-6" strokeWidth={1.6} />
        <p className="text-sm">
          {paraSocio
            ? "Todavía no hay mensajes. Si querés contar tu versión, escribí acá abajo."
            : "Todavía no hay mensajes. Cuando el socio responda, lo vas a ver acá."}
        </p>
      </div>
    );
  }

  const etiquetaSocio = nombreMensajeSocio(tipo).singular;

  return (
    <ol className={cn("space-y-3", className)}>
      {items.map((it) => {
        if (it.clase === "evento") {
          return (
            <li key={it.e.id} className="flex justify-center px-2">
              <p className="inline-flex max-w-prose items-start gap-2 rounded-lg bg-muted/70 px-3.5 py-2 text-left text-sm text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
                <span>
                  {it.e.texto}
                  <span className="tabular"> · {formatFechaHora(it.e.fecha)}</span>
                </span>
              </p>
            </li>
          );
        }
        const m = it.m;
        const mio = m.autor_id === usuarioId;
        const delSocio = m.autor_rol === "socio";
        return (
          <li key={m.id} className={cn("flex", mio ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[88%] rounded-xl border px-4 py-3 sm:max-w-[75%]",
                mio ? "border-accent bg-accent/60" : delSocio ? "border-parcial/40 bg-parcial-suave/50" : "border-border bg-card"
              )}
            >
              <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-sm font-semibold">{mio ? "Vos" : m.autor_nombre}</span>
                <span className="text-xs text-muted-foreground">
                  {delSocio ? etiquetaSocio : LABEL_ROL[m.autor_rol]}
                </span>
                <span className="tabular text-xs text-muted-foreground">
                  {formatFechaHora(m.creado_en)}
                </span>
              </div>
              <p className="whitespace-pre-line text-[15px] leading-relaxed">{m.mensaje}</p>
              {m.adjunto_url ? (
                <a
                  href={m.adjunto_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-md border bg-card px-3 text-sm font-medium hover:bg-muted"
                >
                  <Paperclip className="size-4" strokeWidth={2} />
                  Ver adjunto
                </a>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
