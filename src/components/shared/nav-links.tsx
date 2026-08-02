"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAVEGACION_SOCIO, navParaRol } from "@/lib/navegacion";
import type { Rol } from "@/lib/auth";

/** Links de navegación filtrados por rol, con estado activo. Targets grandes. */
export function NavLinks({
  rol,
  onNavigate,
  className,
}: {
  rol: Rol;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const items = rol === "socio" ? NAVEGACION_SOCIO : navParaRol(rol);

  return (
    <nav className={cn("flex flex-col gap-1", className)}>
      {items.map(({ href, label, icono: Icono }) => {
        const activo = pathname === href || pathname.startsWith(`${href}/`);
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
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
