"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LABEL_GRUPO,
  MAX_PLANO,
  ORDEN_GRUPOS,
  TABS_MOVIL,
  navParaRol,
  type BadgesNav,
  type ItemNav,
} from "@/lib/navegacion";
import type { Rol } from "@/lib/auth";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

function esActivo(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Globo de pendientes (ámbar, como en la barra lateral). El lector de
 * pantalla oye ", 3 pendientes" en vez de un número suelto. */
function Globo({ n, className }: { n: number; className?: string }) {
  if (n <= 0) return null;
  return (
    <>
      <span
        aria-hidden
        className={cn(
          "flex h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-parcial px-1 text-[0.65rem] leading-none font-bold text-white ring-2 ring-sidebar tabular",
          className
        )}
      >
        {n > 99 ? "99+" : n}
      </span>
      <span className="sr-only">, {n} {n === 1 ? "pendiente" : "pendientes"}</span>
    </>
  );
}

const CLASE_TAB =
  "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[1.05rem] px-1 text-[0.72rem] leading-none font-semibold transition-[background-color,color,transform] duration-200 ease-out active:scale-[0.94] outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring";

function Contenido({
  icono: Icono,
  label,
  activo,
  pendientes,
}: {
  icono: LucideIcon;
  label: string;
  activo: boolean;
  pendientes: number;
}) {
  return (
    <>
      <span className="relative">
        <Icono className="size-[1.45rem]" strokeWidth={activo ? 2.2 : 1.8} />
        <Globo n={pendientes} className="absolute -top-1.5 -right-2.5" />
      </span>
      <span className="max-w-full truncate">{label}</span>
    </>
  );
}

/**
 * Navegación del celular y la tablet, como una app: barra flotante abajo con
 * las secciones de todos los días (a un toque con el pulgar) y "Menú", que
 * sube una hoja con todo lo demás en mosaico, el usuario y Salir.
 */
export function BarraInferior({
  rol,
  badges,
  nombre,
  rolLabel,
  logout,
}: {
  rol: Rol;
  badges?: BadgesNav;
  nombre: string;
  rolLabel: string;
  logout: React.ReactNode;
}) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const items = navParaRol(rol);
  const tabs = (TABS_MOVIL[rol] ?? [])
    .map((href) => items.find((i) => i.href === href))
    .filter((i): i is ItemNav => Boolean(i))
    .slice(0, 4);
  const enTabs = new Set(tabs.map((t) => t.href));
  const enMenu = !tabs.some((t) => esActivo(pathname, t.href));
  const pendientesMenu = items
    .filter((i) => !enTabs.has(i.href))
    .reduce((acc, i) => acc + (badges?.[i.href] ?? 0), 0);

  const grupos = ORDEN_GRUPOS.map((g) => ({
    grupo: g,
    items: items.filter((i) => i.grupo === g),
  })).filter((g) => g.items.length > 0);
  const conGrupos = grupos.length > 1 && items.length > MAX_PLANO;

  return (
    <nav
      aria-label="Navegación principal"
      className="no-print pointer-events-none fixed inset-x-0 bottom-0 z-40 pt-2 pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] lg:hidden"
    >
      <div className="pointer-events-auto mx-auto flex h-[4.25rem] max-w-lg items-stretch gap-1 rounded-[1.4rem] bg-sidebar p-1.5 text-sidebar-foreground shadow-[0_14px_34px_-14px_rgb(15_23_60/0.7)] ring-1 ring-white/10">
        {tabs.map((t) => {
          const activo = esActivo(pathname, t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={activo ? "page" : undefined}
              className={cn(
                CLASE_TAB,
                activo
                  ? "bg-white text-primary shadow-[0_4px_12px_-4px_rgb(0_0_0/0.35)]"
                  : "text-sidebar-foreground/72 hover:text-sidebar-foreground"
              )}
            >
              <Contenido
                icono={t.icono}
                label={t.corto ?? t.label}
                activo={activo}
                pendientes={badges?.[t.href] ?? 0}
              />
            </Link>
          );
        })}

        <Sheet open={abierto} onOpenChange={setAbierto}>
          <SheetTrigger asChild>
            <button
              type="button"
              className={cn(
                CLASE_TAB,
                enMenu
                  ? "bg-white/14 text-white"
                  : "text-sidebar-foreground/72 hover:text-sidebar-foreground"
              )}
            >
              <Contenido icono={LayoutGrid} label="Menú" activo={enMenu} pendientes={pendientesMenu} />
            </button>
          </SheetTrigger>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="max-h-[88dvh] gap-0 rounded-t-[1.75rem] bg-background p-0 pr-[env(safe-area-inset-right)] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] data-[side=bottom]:border-t-0"
        >
          <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-11 rounded-full bg-foreground/15" />
          <div className="flex items-center gap-3 px-5 pt-4 pb-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary font-display text-lg font-bold text-primary-foreground">
              {nombre.trim().charAt(0).toUpperCase() || "?"}
            </span>
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate font-display text-base font-bold">{nombre}</SheetTitle>
              <SheetDescription className="text-sm">{rolLabel}</SheetDescription>
            </div>
            <div className="shrink-0">{logout}</div>
            <SheetClose asChild>
              <button
                type="button"
                aria-label="Cerrar el menú"
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-5" strokeWidth={2} />
              </button>
            </SheetClose>
          </div>

          <div className="overflow-y-auto px-4 pb-2">
            {(conGrupos ? grupos : [{ grupo: "hoy" as const, items }]).map((g) => (
              <section key={g.grupo} className="pt-3">
                {conGrupos ? (
                  <h2 className="px-1 pb-2 text-[0.7rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                    {LABEL_GRUPO[g.grupo]}
                  </h2>
                ) : null}
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {g.items.map(({ href, label, icono: Icono }) => {
                    const activo = esActivo(pathname, href);
                    return (
                      <li key={href}>
                        <Link
                          href={href}
                          onClick={() => setAbierto(false)}
                          aria-current={activo ? "page" : undefined}
                          className={cn(
                            "relative flex h-full min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-2xl border px-1.5 py-3 text-center text-[0.8rem] leading-tight font-semibold break-words hyphens-auto transition-colors active:scale-[0.97]",
                            activo
                              ? "border-primary/30 bg-accent text-accent-foreground"
                              : "border-transparent bg-card text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.05)] ring-1 ring-foreground/5 hover:bg-muted"
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-10 items-center justify-center rounded-xl",
                              activo ? "bg-primary text-primary-foreground" : "bg-accent text-primary"
                            )}
                          >
                            <Icono className="size-5" strokeWidth={2} />
                          </span>
                          {label}
                          <Globo n={badges?.[href] ?? 0} className="absolute top-2 right-2 ring-background" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
