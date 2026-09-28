"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Pantallas que ocupan todo el espacio disponible, sin márgenes ni ancho
 * máximo (el mapa: la pantalla entera es el plano). */
const PANTALLA_PLENA = ["/mapa"];

/** Contenedor principal del panel. Deja lugar abajo para la barra de
 * navegación del celular (--nav-inferior, 0 en escritorio). */
export function Principal({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const plena = PANTALLA_PLENA.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  return (
    <main
      className={cn(
        "w-full flex-1",
        plena
          ? "flex min-h-0 flex-col pb-[var(--nav-inferior)]"
          : "mx-auto max-w-6xl px-4 pt-5 pb-[calc(var(--nav-inferior)+1.25rem)] md:px-7 md:pt-6 lg:pb-6"
      )}
    >
      {children}
    </main>
  );
}
