import Link from "next/link";
import { ChevronRight, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CarpetaPropia } from "@/lib/auth";

/**
 * «Mi lugar en el mercado»: alguien del equipo que además es cliente (0066) abre su propia
 * carpeta en el portal con su mismo usuario. En la barra lateral (azul) o en la hoja del menú
 * del celular (clara).
 */
export function MiLugar({ carpeta, claro = false }: { carpeta: CarpetaPropia; claro?: boolean }) {
  const detalle = `Carpeta ${carpeta.codigo}${carpeta.apodo ? ` · ${carpeta.apodo}` : ""}`;
  return (
    <Link
      href="/mi-cuenta"
      data-tour="mi-lugar"
      className={cn(
        "group flex min-h-12 w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors outline-none focus-visible:ring-2",
        claro
          ? "border bg-card text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.05)] hover:bg-muted focus-visible:ring-ring"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring"
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          claro ? "bg-accent text-primary" : "bg-white/12 text-sidebar-foreground"
        )}
      >
        <Store className="size-5" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-sm font-semibold break-words">Mi lugar en el mercado</span>
        <span className={cn("block text-xs break-words", claro ? "text-muted-foreground" : "text-sidebar-foreground/70")}>
          {detalle}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
    </Link>
  );
}
