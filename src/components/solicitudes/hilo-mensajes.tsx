import { ArrowRightCircle, Lock, MessageSquareDashed, Paperclip } from "lucide-react";
import type { Rol } from "@/lib/auth";
import { LABEL_ROL } from "@/lib/roles";
import { formatFechaHora } from "@/lib/format";
import { cn } from "@/lib/utils";
import { esMensajeAutomatico } from "./constantes";

export type MensajeHilo = {
  id: string;
  autor_id: string | null;
  autor_nombre: string;
  autor_rol: Rol;
  mensaje: string;
  interno: boolean;
  creado_en: string;
  adjunto_url?: string | null;
};

/**
 * Hilo de mensajes de una solicitud, en orden cronológico.
 * - Los míos van a la derecha (azul suave), los de los demás a la izquierda.
 * - Los internos (solo staff) llevan fondo ámbar y la leyenda "Interno".
 * - Los automáticos (cambios de estado que deja la RPC) van centrados, sutiles.
 */
export function HiloMensajes({
  mensajes,
  usuarioId,
  className,
}: {
  mensajes: MensajeHilo[];
  usuarioId: string;
  className?: string;
}) {
  if (mensajes.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center text-muted-foreground",
          className
        )}
      >
        <MessageSquareDashed className="size-6" strokeWidth={1.6} />
        <p className="text-sm">
          Todavía no hay mensajes. Escribí el primero acá abajo.
        </p>
      </div>
    );
  }

  return (
    <ol className={cn("space-y-3", className)}>
      {mensajes.map((m) => {
        const automatico = esMensajeAutomatico(m.mensaje) && !m.interno;
        const mio = m.autor_id === usuarioId;

        if (automatico) {
          return (
            <li key={m.id} className="flex justify-center px-2">
              <p className="inline-flex max-w-prose items-start gap-2 rounded-lg bg-muted/70 px-3.5 py-2 text-left text-sm text-muted-foreground">
                <ArrowRightCircle
                  className="mt-0.5 size-4 shrink-0"
                  strokeWidth={1.8}
                />
                <span>
                  <span className="font-medium text-foreground/80">
                    {m.autor_nombre}
                  </span>{" "}
                  {fraseAutomatica(m.mensaje)}
                  <span className="tabular"> · {formatFechaHora(m.creado_en)}</span>
                </span>
              </p>
            </li>
          );
        }

        return (
          <li
            key={m.id}
            className={cn("flex", mio ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-xl border px-4 py-3 sm:max-w-[75%]",
                m.interno
                  ? "border-parcial/40 bg-parcial-suave"
                  : mio
                    ? "border-accent bg-accent/60"
                    : "border-border bg-card"
              )}
            >
              <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-sm font-semibold">
                  {mio ? "Vos" : m.autor_nombre}
                </span>
                <span className="text-xs text-muted-foreground">
                  {LABEL_ROL[m.autor_rol]}
                </span>
                <span className="tabular text-xs text-muted-foreground">
                  {formatFechaHora(m.creado_en)}
                </span>
              </div>
              {m.interno ? (
                <p className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-parcial">
                  <Lock className="size-3.5" strokeWidth={2.2} />
                  Interno — no lo ve el socio
                </p>
              ) : null}
              <p className="whitespace-pre-line text-[15px] leading-relaxed">
                {m.mensaje}
              </p>
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

/** "Tomó la solicitud…" → "tomó la solicitud…" para leerlo después del nombre. */
function fraseAutomatica(texto: string): string {
  if (texto.startsWith("Resolución:"))
    return `registró la resolución: ${texto.slice("Resolución:".length).trim()}`;
  return texto.charAt(0).toLowerCase() + texto.slice(1);
}
