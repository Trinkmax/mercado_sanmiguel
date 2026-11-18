import Link from "next/link";
import { ArrowLeft, Store } from "lucide-react";
import type { Rol } from "@/lib/auth";

/** «Volver a Portería»: a la pantalla de inicio de su trabajo (rutaInicio). */
function textoVolver(rol: Rol): string {
  return rol === "guardia" || rol === "porteria" ? "Volver a Portería" : "Volver al sistema";
}

/**
 * Arriba del portal cuando lo abre alguien del equipo con su propia carpeta (0066): le recuerda
 * que está viendo su carpeta como cualquier cliente y lo vuelve a su trabajo con un toque.
 */
export function FranjaCarpetaPropia({ rol, codigo, volverA }: { rol: Rol; codigo: number | null; volverA: string }) {
  return (
    <div className="no-print relative z-10 bg-porcelana text-tinta">
      <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
        <p className="flex min-w-0 flex-1 basis-56 items-start gap-2 text-[0.95rem] leading-snug">
          <Store aria-hidden className="mt-0.5 size-4 shrink-0 text-esmalte" strokeWidth={2.2} />
          <span className="min-w-0 break-words">
            <strong className="font-extrabold">Tu carpeta</strong>
            {codigo !== null ? ` N° ${codigo}` : ""}: la ves como la ve cualquier cliente.
          </span>
        </p>
        <Link
          href={volverA}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-esmalte px-4 text-[0.95rem] font-extrabold text-porcelana transition-colors hover:bg-esmalte-hondo focus-visible:ring-2 focus-visible:ring-esmalte focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden className="size-4" strokeWidth={2.4} />
          {textoVolver(rol)}
        </Link>
      </div>
    </div>
  );
}
