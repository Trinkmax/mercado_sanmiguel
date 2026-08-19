"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LABEL_GRUPO,
  NAVEGACION_SOCIO,
  ORDEN_GRUPOS,
  navParaRol,
  type BadgesNav,
  type GrupoNav,
  type ItemNav,
} from "@/lib/navegacion";
import type { Rol } from "@/lib/auth";

/** Con esta cantidad o menos el menú va plano (Portería, Jefe de Portería). */
const MAX_PLANO = 7;
/** Los grupos que el usuario abrió o cerró a mano se recuerdan en el dispositivo. */
const CLAVE_ESTADO = "msm-nav-grupos";

type EstadoGrupos = Partial<Record<GrupoNav, boolean>>;

// Store externo mínimo sobre localStorage: el server rinde todo plegado (snapshot
// vacío) y el cliente hidrata con lo recordado sin setState en efectos.
const oyentes = new Set<() => void>();
function suscribir(cb: () => void) {
  oyentes.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === CLAVE_ESTADO) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    oyentes.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}
function leerCrudo(): string {
  try {
    return window.localStorage.getItem(CLAVE_ESTADO) ?? "";
  } catch {
    return "";
  }
}
function guardarEstado(estado: EstadoGrupos) {
  try {
    window.localStorage.setItem(CLAVE_ESTADO, JSON.stringify(estado));
  } catch {
    /* modo privado / sin storage: se vive sin memoria */
  }
  oyentes.forEach((cb) => cb());
}
function parsear(crudo: string): EstadoGrupos {
  if (!crudo) return {};
  try {
    return JSON.parse(crudo) as EstadoGrupos;
  } catch {
    return {};
  }
}

function esActivo(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Navegación del panel.
 * - Pocas entradas (≤ 7): lista plana.
 * - Muchas: grupos plegables. "Hoy" (lo operativo) queda siempre abierto; Gestión,
 *   Plata y Dirección se pliegan. El grupo de la ruta actual se abre solo; lo que
 *   el usuario abre o cierra a mano se recuerda en el dispositivo. Un grupo plegado
 *   muestra la suma de sus pendientes, para que nada quede escondido.
 * - Targets grandes (≥ 40 px), un solo color de marca.
 */
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

  const grupos = useMemo(
    () =>
      ORDEN_GRUPOS.map((g) => ({
        grupo: g,
        items: items.filter((i) => i.grupo === g),
      })).filter((g) => g.items.length > 0),
    [items]
  );
  const plano = grupos.length <= 1 || items.length <= MAX_PLANO;

  // Grupo de la ruta actual: siempre abierto aunque el usuario lo haya plegado antes.
  const grupoActivo = useMemo(
    () => items.find((i) => esActivo(pathname, i.href))?.grupo ?? null,
    [items, pathname]
  );

  // Estado manual recordado en el dispositivo (server: todo plegado).
  const crudo = useSyncExternalStore(suscribir, leerCrudo, () => "");
  const manual = useMemo(() => parsear(crudo), [crudo]);
  // Excepción local: el usuario plegó a mano el grupo donde está parado. Se
  // guarda el grupo en el que lo hizo: al cambiar de grupo se olvida solo.
  const [plegadoEn, setPlegadoEn] = useState<GrupoNav | null>(null);
  const plegadoActivo = plegadoEn !== null && plegadoEn === grupoActivo;

  const estaAbierto = (grupo: GrupoNav): boolean => {
    if (grupo === "hoy") return true;
    if (grupo === grupoActivo) return !plegadoActivo;
    return manual[grupo] ?? false;
  };

  const alternar = (grupo: GrupoNav) => {
    const nuevo = !estaAbierto(grupo);
    if (grupo === grupoActivo) setPlegadoEn(nuevo ? null : grupo);
    guardarEstado({ ...manual, [grupo]: nuevo });
  };

  const link = ({ href, label, icono: Icono }: ItemNav) => {
    const activo = esActivo(pathname, href);
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
        {pendientes > 0 ? <Badge n={pendientes} activo={activo} /> : null}
      </Link>
    );
  };

  if (plano) {
    return <nav className={cn("flex flex-col gap-1", className)}>{items.map(link)}</nav>;
  }

  return (
    <nav className={cn("flex flex-col gap-1", className)}>
      {grupos.map(({ grupo, items: its }) => {
        const fijo = grupo === "hoy";
        const abiertoAhora = estaAbierto(grupo);
        const pendientesGrupo = its.reduce((acc, i) => acc + (badges?.[i.href] ?? 0), 0);
        const contieneActivo = grupo === grupoActivo;
        const idPanel = `nav-grupo-${grupo}`;

        return (
          <div key={grupo} className="flex flex-col gap-1">
            {fijo ? (
              <p className="mb-0.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/50">
                {LABEL_GRUPO[grupo]}
              </p>
            ) : (
              <button
                type="button"
                onClick={() => alternar(grupo)}
                aria-expanded={abiertoAhora}
                aria-controls={idPanel}
                className={cn(
                  "mt-2 flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.14em] transition-colors",
                  "text-sidebar-foreground/55 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  contieneActivo && !abiertoAhora && "text-sidebar-foreground/85"
                )}
              >
                <span className="flex-1">{LABEL_GRUPO[grupo]}</span>
                {!abiertoAhora && pendientesGrupo > 0 ? (
                  <Badge n={pendientesGrupo} activo={false} />
                ) : null}
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 transition-transform duration-200",
                    abiertoAhora ? "rotate-180" : "rotate-0"
                  )}
                  strokeWidth={2}
                  aria-hidden
                />
              </button>
            )}
            {abiertoAhora ? (
              <div
                id={idPanel}
                className={cn(
                  "flex flex-col gap-1",
                  !fijo && "animate-in fade-in slide-in-from-top-1 duration-150"
                )}
              >
                {its.map(link)}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

function Badge({ n, activo }: { n: number; activo: boolean }) {
  return (
    <span
      aria-label={`${n} pendientes`}
      className={cn(
        "ml-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular leading-5",
        activo
          ? "bg-sidebar-primary-foreground/15 text-sidebar-primary-foreground"
          : "bg-parcial text-white"
      )}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}
