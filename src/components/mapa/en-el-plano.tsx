import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { textoEspacios } from "./geometria";
import type { Espacio } from "./tipos";

/**
 * Línea "dónde está" de la ficha del cliente: sus espacios en el plano con
 * link al mapa (que lo enfoca), o el atajo para ubicarlo si todavía no tiene.
 * Interfaz congelada (FASE3 §6.10): `id` y `propio` son opcionales.
 */
export function EnElPlano({
  clienteId,
  espacios,
  facturaPuestos,
  puedeUbicar,
}: {
  clienteId: string;
  espacios: (Pick<Espacio, "tipo" | "numero" | "medio" | "x" | "y"> & { id?: string; propio?: boolean })[];
  facturaPuestos: boolean;
  puedeUbicar: boolean;
}) {
  if (espacios.length > 0) {
    const texto = textoEspacios(espacios);
    // Con un solo lugar, el link lo enfoca exacto (hay números repetidos en el dibujo).
    const unico = espacios.length === 1 && espacios[0].id ? espacios[0].id : null;
    return (
      <Link
        href={unico ? `/mapa?espacio=${unico}` : `/mapa?cliente=${clienteId}`}
        className="group inline-flex min-h-11 max-w-full items-center gap-2.5 rounded-lg border bg-card px-3.5 py-2 text-sm transition-colors hover:border-primary/35 hover:bg-accent/50"
      >
        <MapPin className="size-4 shrink-0 text-primary" strokeWidth={2} />
        <span className="min-w-0 truncate font-medium">{texto}</span>
        <span className="inline-flex shrink-0 items-center gap-1 text-primary">
          Ver en el plano
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
        </span>
      </Link>
    );
  }

  if (!puedeUbicar || !facturaPuestos) return null;
  return (
    <Link
      href={`/mapa?cliente=${clienteId}&editar=1`}
      className="group inline-flex min-h-11 max-w-full items-center gap-2.5 rounded-lg border border-dashed bg-card px-3.5 py-2 text-sm transition-colors hover:border-primary/35 hover:bg-accent/50"
    >
      <MapPin className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
      <span className="text-muted-foreground">Factura puestos pero no está ubicado en el plano.</span>
      <span className="inline-flex shrink-0 items-center gap-1 font-medium text-primary">
        Ubicar en el plano
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
      </span>
    </Link>
  );
}
