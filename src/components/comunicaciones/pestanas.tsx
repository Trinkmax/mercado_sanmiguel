import Link from "next/link";
import { FileSignature, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";

export type PestanaComunicaciones = "circulares" | "terminos";

const PESTANAS: {
  valor: PestanaComunicaciones;
  label: string;
  icono: typeof Megaphone;
}[] = [
  { valor: "circulares", label: "Circulares", icono: Megaphone },
  { valor: "terminos", label: "Términos y condiciones", icono: FileSignature },
];

/** Pestañas grandes de Comunicaciones (links: el contenido se arma en el server). */
export function PestanasComunicaciones({
  activa,
}: {
  activa: PestanaComunicaciones;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist">
      {PESTANAS.map((p) => {
        const Icono = p.icono;
        const esActiva = activa === p.valor;
        return (
          <Link
            key={p.valor}
            role="tab"
            aria-selected={esActiva}
            href={p.valor === "circulares" ? "/comunicaciones" : `/comunicaciones?tab=${p.valor}`}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors",
              esActiva
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-accent"
            )}
          >
            <Icono className="size-4" strokeWidth={2} />
            {p.label}
          </Link>
        );
      })}
    </div>
  );
}
