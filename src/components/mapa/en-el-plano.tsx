import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { listaConY, sinLugarEnPlano, textoEspacios } from "./geometria";
import type { Espacio } from "./tipos";

const ENLACE =
  "group inline-flex min-h-11 max-w-full items-center gap-2.5 rounded-lg border bg-card px-3.5 py-2 text-sm transition-colors hover:border-primary/35 hover:bg-accent/50";

function VerEnElPlano() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-primary">
      Ver en el plano
      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
    </span>
  );
}

/**
 * Línea "dónde está" de la ficha del cliente: sus espacios en el plano con
 * link al mapa (que lo enfoca), o el atajo para ubicarlo si todavía no tiene.
 * Interfaz congelada (FASE3 §6.10): `id`, `propio`, `quintero` y `sinLugar` son opcionales.
 */
export function EnElPlano({
  clienteId,
  espacios,
  facturaPuestos,
  puedeUbicar,
  quintero = false,
  sinLugar,
}: {
  clienteId: string;
  espacios: (Pick<Espacio, "tipo" | "numero" | "medio" | "x" | "y"> & { id?: string; propio?: boolean })[];
  facturaPuestos: boolean;
  puedeUbicar: boolean;
  /** Quintero: no tiene puesto numerado, pero su ficha está en la zona de quinteros del plano. */
  quintero?: boolean;
  /** Cocheras y galpones que factura: no se marcan en el plano, pero se nombran igual
   * (si no, la línea dice menos que su carpeta y que la lista de Clientes). */
  sinLugar?: { cocheras?: number; galpones?: number };
}) {
  const extras = sinLugar ? sinLugarEnPlano(sinLugar) : [];
  const varias = extras.length > 1 || (sinLugar?.cocheras ?? 0) > 1 || (sinLugar?.galpones ?? 0) > 1;
  const nota =
    extras.length > 0 ? (
      <p className="text-sm text-muted-foreground">
        {espacios.length > 0 || quintero ? "También factura " : "Factura "}
        <span className="font-medium text-foreground">{listaConY(extras)}</span>
        {varias ? " (no se marcan en el plano)." : " (no se marca en el plano)."}
      </p>
    ) : null;

  let enlace: React.ReactNode = null;
  if (espacios.length > 0) {
    const texto = textoEspacios(espacios);
    // Con un solo lugar, el link lo enfoca exacto (hay números repetidos en el dibujo).
    const unico = espacios.length === 1 && espacios[0].id ? espacios[0].id : null;
    enlace = (
      <Link href={unico ? `/mapa?espacio=${unico}` : `/mapa?cliente=${clienteId}`} className={ENLACE}>
        <MapPin className="size-4 shrink-0 text-primary" strokeWidth={2} />
        {/* Muchos puestos: el texto salta de renglón en vez de cortarse. */}
        <span className="min-w-0 font-medium break-words">{texto}</span>
        <VerEnElPlano />
      </Link>
    );
  } else if (quintero) {
    // El mapa lo elige y lo enfoca en la zona de quinteros (?cliente=).
    enlace = (
      <Link href={`/mapa?cliente=${clienteId}`} className={ENLACE}>
        <MapPin className="size-4 shrink-0 text-primary" strokeWidth={2} />
        <span className="min-w-0 font-medium">En la zona de quinteros</span>
        <VerEnElPlano />
      </Link>
    );
  } else if (puedeUbicar && facturaPuestos) {
    enlace = (
      <Link
        href={`/mapa?cliente=${clienteId}&editar=1`}
        className="group inline-flex min-h-11 max-w-full items-center gap-2.5 rounded-lg border border-dashed bg-card px-3.5 py-2 text-sm transition-colors hover:border-primary/35 hover:bg-accent/50"
      >
        <MapPin className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
        <span className="min-w-0 text-muted-foreground">Factura puestos pero no está ubicado en el plano.</span>
        <span className="inline-flex shrink-0 items-center gap-1 font-medium text-primary">
          Ubicar en el plano
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
        </span>
      </Link>
    );
  }

  if (!nota) return enlace;
  return (
    <div className="space-y-1.5">
      {enlace}
      {nota}
    </div>
  );
}
