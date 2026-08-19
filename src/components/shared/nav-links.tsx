"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LABEL_GRUPO,
  NAVEGACION_SOCIO,
  navParaRol,
  type BadgesNav,
  type GrupoNav,
  type ItemNav,
} from "@/lib/navegacion";
import type { Rol } from "@/lib/auth";

const ORDEN_GRUPOS: GrupoNav[] = ["hoy", "gestion", "direccion"];

/** Links de navegación filtrados por rol, con estado activo, agrupados cuando
 * el rol ve muchas entradas, y con badge de pendientes. Targets grandes. */
export function NavLinks({
  rol,
  badges,
  onNavigate,
  className,
}: {
  rol: Rol;
  badges?: BadgesNav;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const items = rol === "socio" ? NAVEGACION_SOCIO : navParaRol(rol);

  const grupos = ORDEN_GRUPOS.map((g) => ({
    grupo: g,
    items: items.filter((i) => i.grupo === g),
  })).filter((g) => g.items.length > 0);
  const mostrarTitulos = grupos.length > 1 && items.length > 7;

  const link = ({ href, label, icono: Icono }: ItemNav) => {
    const activo = pathname === href || pathname.startsWith(`${href}/`);
    const pendientes = badges?.[href] ?? 0;
    return (
      <Link
        key={href}
        href={href}
        onClick={onNavigate}
        aria-current={activo ? "page" : undefined}
        className={cn(
          "flex min-h-10 items-center gap-2.5 rounded-md px-3 text-sm font-medium transition-colors",
          activo
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <Icono className="size-[18px] shrink-0" strokeWidth={activo ? 2.2 : 1.8} />
        <span className="flex-1 truncate">{label}</span>
        {pendientes > 0 ? (
          <span
            aria-label={`${pendientes} pendientes`}
            className={cn(
              "ml-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular leading-5",
              activo
                ? "bg-sidebar-primary-foreground/15 text-sidebar-primary-foreground"
                : "bg-parcial text-white"
            )}
          >
            {pendientes > 99 ? "99+" : pendientes}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <nav className={cn("flex flex-col gap-1", className)}>
      {grupos.map(({ grupo, items: its }) => (
        <div key={grupo} className="flex flex-col gap-1">
          {mostrarTitulos ? (
            <p className="mt-3 mb-0.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/50 first:mt-0">
              {LABEL_GRUPO[grupo]}
            </p>
          ) : null}
          {its.map(link)}
        </div>
      ))}
    </nav>
  );
}
