"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Navegación grande del portal: "Mi cuenta" (con las solicitudes que tienen respuesta nueva)
 * · "Comunicaciones" (con lo nuevo contado).
 */
export function NavPortal({ nuevas, respuestas = 0 }: { nuevas: number; respuestas?: number }) {
  const pathname = usePathname();
  const enComunicaciones =
    pathname.startsWith("/mi-cuenta/comunicaciones") ||
    pathname.startsWith("/mi-cuenta/circulares");

  const items = [
    {
      href: "/mi-cuenta",
      label: "Mi cuenta",
      icono: Wallet,
      activo: !enComunicaciones,
      badge: respuestas,
      queCuenta: ["respuesta nueva", "respuestas nuevas"],
    },
    {
      href: "/mi-cuenta/comunicaciones",
      label: "Comunicaciones",
      icono: Bell,
      activo: enComunicaciones,
      badge: nuevas,
      queCuenta: ["nueva", "nuevas"],
    },
  ];

  return (
    <nav aria-label="Secciones del portal" className="no-print mb-6 grid grid-cols-2 gap-2">
      {items.map((it) => {
        const Icono = it.icono;
        return (
          <Link
            key={it.href}
            href={it.href}
            data-tour={`nav:${it.href}`}
            aria-current={it.activo ? "page" : undefined}
            className={cn(
              "relative flex min-h-12 items-center justify-center gap-2 rounded-lg border px-3 text-base font-semibold transition-colors",
              it.activo
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-accent active:bg-accent"
            )}
          >
            <Icono className="size-5 shrink-0" strokeWidth={2} />
            <span className="truncate">{it.label}</span>
            {it.badge > 0 ? (
              <span
                className={cn(
                  "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-sm font-bold tabular",
                  it.activo ? "bg-card text-parcial" : "bg-parcial text-primary-foreground"
                )}
                aria-label={`${it.badge} ${it.badge === 1 ? it.queCuenta[0] : it.queCuenta[1]}`}
              >
                {it.badge > 99 ? "99+" : it.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
