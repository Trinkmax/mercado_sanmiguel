import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/** Arriba de una pantalla de una sola cosa: «Volver» bien grande y de qué se trata. */
export function EncabezadoDetalle({
  volverA,
  volverTexto,
  titulo,
  bajada,
  children,
}: {
  volverA: string;
  volverTexto: string;
  titulo: string;
  bajada?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="portal-espacio-chico" data-tour="encabezado">
      <Link
        href={volverA}
        className="-ml-1.5 mb-1.5 inline-flex min-h-11 items-center gap-1 self-start rounded-lg pr-3 text-[1.05rem] font-extrabold [font-stretch:92%]"
      >
        <ChevronLeft aria-hidden className="size-6" strokeWidth={2.6} />
        {volverTexto}
      </Link>
      <h1 className="portal-titulo !text-[1.72rem] line-clamp-3">{titulo}</h1>
      {bajada ? <p className="portal-bajada">{bajada}</p> : null}
      {children}
    </div>
  );
}
