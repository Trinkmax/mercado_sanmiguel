import { FileText, ImageIcon } from "lucide-react";
import { diasHasta, formatFechaLarga, formatSoloHora, TZ_AR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { sinComa } from "./armar-cuenta";

/**
 * La conversación con la cooperativa, como WhatsApp (lo conocen todos): lo tuyo a la derecha,
 * lo de ellos a la izquierda, separado por días. Los cambios de estado y los hechos van en el
 * medio, chiquitos: no son un mensaje de una persona.
 */

export type ItemChat =
  | {
      clase: "mensaje";
      id: string;
      mio: boolean;
      /** Quién escribe, si no sos vos ("Administración"). */
      autor: string | null;
      texto: string;
      fecha: string;
      adjunto?: string | null;
    }
  | { clase: "hecho"; id: string; texto: string; fecha: string };

function diaAR(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_AR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function textoDia(dia: string): string {
  const d = diasHasta(dia);
  if (d === 0) return "Hoy";
  if (d === -1) return "Ayer";
  const t = sinComa(formatFechaLarga(dia));
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function HiloPortal({ items, vacio }: { items: ItemChat[]; vacio?: string }) {
  const ordenados = [...items].sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (ordenados.length === 0) {
    return vacio ? <p className="chat-hecho my-2">{vacio}</p> : null;
  }
  return (
    <ol className="flex flex-col gap-2">
      {ordenados.map((it, i) => {
        const dia = diaAR(it.fecha);
        const anterior = ordenados[i - 1];
        const separador = !anterior || diaAR(anterior.fecha) !== dia ? textoDia(dia) : null;
        return (
          <li key={it.id} className="contents">
            {separador ? <span className="chat-fecha my-1">{separador}</span> : null}
            {it.clase === "hecho" ? (
              <span className="chat-hecho">{it.texto}</span>
            ) : (
              <div className={cn("burbuja", it.mio ? "burbuja-mia" : "burbuja-otra")}>
                {it.autor ? <p className="mb-0.5 text-[0.9rem] font-extrabold text-esmalte">{it.autor}</p> : null}
                <p className="whitespace-pre-line break-words">{it.texto}</p>
                {it.adjunto ? (
                  <a
                    href={it.adjunto}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "mt-1.5 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-[0.98rem] font-bold underline-offset-2",
                      it.mio ? "bg-white/15" : "bg-porcelana-2"
                    )}
                  >
                    <ImageIcon aria-hidden className="size-[1.15rem]" strokeWidth={2.2} />
                    Ver lo que se adjuntó
                  </a>
                ) : null}
                <p className={cn("mt-0.5 text-right text-[0.82rem] tabular", it.mio ? "text-white/80" : "text-tinta-2")}>
                  {formatSoloHora(it.fecha)}
                </p>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** El documento de la cooperativa adjunto a un aviso o a una circular. */
export function BotonDocumento({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="boton boton-suave w-full">
      <FileText aria-hidden strokeWidth={2.2} />
      {children}
    </a>
  );
}
