import Link from "next/link";
import { Receipt, Settings2, Tag, Tractor, Truck, Users, type LucideIcon } from "lucide-react";
import type { Rol } from "@/lib/auth";
import { cn } from "@/lib/utils";

/** Claves de `?tab=` (congeladas, contrato §6.10: las linkean Portería y Clientes). */
export type PestanaConfiguracion = "precios" | "general" | "tarifas" | "quintas" | "usuarios" | "rubros";

type DefPestana = { valor: PestanaConfiguracion; label: string; icono: LucideIcon };

const TODAS: Record<PestanaConfiguracion, DefPestana> = {
  precios: { valor: "precios", label: "Precios", icono: Tag },
  general: { valor: "general", label: "General", icono: Settings2 },
  tarifas: { valor: "tarifas", label: "Tarifas de transporte", icono: Truck },
  quintas: { valor: "quintas", label: "Quintas y ambulantes", icono: Tractor },
  usuarios: { valor: "usuarios", label: "Usuarios", icono: Users },
  rubros: { valor: "rubros", label: "Rubros de gasto", icono: Receipt },
};

/** Qué pestañas ve cada rol, en orden (§6 M8.4). La primera es la de entrada. */
export function pestanasDeRol(rol: Rol): PestanaConfiguracion[] {
  switch (rol) {
    case "lider":
      return ["precios", "general", "tarifas", "quintas", "usuarios", "rubros"];
    case "admin":
      return ["precios", "general", "usuarios", "rubros"];
    case "guardia":
      return ["quintas", "usuarios"];
    default:
      return [];
  }
}

function labelDe(p: PestanaConfiguracion, rol: Rol): string {
  if (p === "usuarios" && rol === "guardia") return "Usuarios de Portería";
  if (p === "usuarios" && rol === "admin") return "Portal de clientes";
  return TODAS[p].label;
}

/**
 * Pestañas grandes por link: cada una arma su contenido en el server (una a la vez).
 * En el celular van en dos columnas (el nombre largo pasa a dos líneas): todas a la
 * vista y la activa siempre marcada, sin nada escondido de costado.
 */
export function PestanasConfiguracion({
  rol,
  activa,
  pendientes,
}: {
  rol: Rol;
  activa: PestanaConfiguracion;
  /** Globo por pestaña (p. ej. cambios de precio esperando aprobación). */
  pendientes?: Partial<Record<PestanaConfiguracion, number>>;
}) {
  const pestanas = pestanasDeRol(rol);
  return (
    <nav aria-label="Secciones de configuración">
      <ul className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {pestanas.map((p, i) => {
          const { icono: Icono } = TODAS[p];
          const esActiva = p === activa;
          const n = pendientes?.[p] ?? 0;
          return (
            <li key={p}>
              <Link
                href={i === 0 ? "/configuracion" : `/configuracion?tab=${p}`}
                aria-current={esActiva ? "page" : undefined}
                className={cn(
                  "flex h-full min-h-12 items-center gap-2 rounded-lg border px-3 py-1.5 text-sm leading-tight font-semibold transition-colors sm:px-4 sm:whitespace-nowrap",
                  esActiva
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-accent"
                )}
              >
                <Icono className="size-5 shrink-0" strokeWidth={2} />
                <span className="min-w-0 break-words">{labelDe(p, rol)}</span>
                {n > 0 ? (
                  <span
                    className={cn(
                      "ml-auto inline-flex min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-xs leading-5 font-bold tabular sm:ml-0.5",
                      esActiva ? "bg-primary-foreground/20" : "bg-parcial text-white"
                    )}
                  >
                    {n}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
