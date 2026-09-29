import Link from "next/link";
import { Bell, FileSignature, Gavel, Megaphone, MessageSquareWarning } from "lucide-react";
import { cn } from "@/lib/utils";

export type PestanaComunicaciones =
  | "circulares"
  | "notificaciones"
  | "apercibimientos"
  | "sanciones"
  | "terminos";

const PESTANAS: {
  valor: PestanaComunicaciones;
  label: string;
  icono: typeof Megaphone;
}[] = [
  { valor: "circulares", label: "Circulares", icono: Megaphone },
  { valor: "notificaciones", label: "Notificaciones", icono: Bell },
  { valor: "apercibimientos", label: "Apercibimientos", icono: MessageSquareWarning },
  { valor: "sanciones", label: "Sanciones", icono: Gavel },
  { valor: "terminos", label: "Términos", icono: FileSignature },
];

/**
 * Pestañas grandes de Comunicaciones (links: el contenido se arma en el server).
 * `badges` = descargos que esperan respuesta, en rojo. En el celular van en dos
 * columnas: todas a la vista y la activa siempre marcada, nada escondido de costado.
 */
export function PestanasComunicaciones({
  activa,
  badges = {},
}: {
  activa: PestanaComunicaciones;
  badges?: Partial<Record<PestanaComunicaciones, number>>;
}) {
  return (
    <nav aria-label="Secciones de Comunicaciones" className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      {PESTANAS.map((p) => {
        const Icono = p.icono;
        const esActiva = activa === p.valor;
        const badge = badges[p.valor] ?? 0;
        return (
          <Link
            key={p.valor}
            aria-current={esActiva ? "page" : undefined}
            href={p.valor === "circulares" ? "/comunicaciones" : `/comunicaciones?tab=${p.valor}`}
            className={cn(
              "flex min-h-12 min-w-0 items-center gap-2 rounded-md border px-3 py-1.5 text-sm leading-tight font-medium transition-colors sm:shrink-0 sm:px-4 sm:whitespace-nowrap",
              p.valor === "terminos" && "sm:ml-auto",
              esActiva
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-accent"
            )}
          >
            <Icono className="size-4 shrink-0" strokeWidth={2} />
            <span className="min-w-0 break-words">{p.label}</span>
            {badge > 0 ? (
              <span
                className={cn(
                  "ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular sm:ml-0",
                  esActiva ? "bg-card text-pendiente" : "bg-pendiente text-primary-foreground"
                )}
                aria-label={`${badge} ${badge === 1 ? "espera" : "esperan"} tu respuesta`}
              >
                {badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
