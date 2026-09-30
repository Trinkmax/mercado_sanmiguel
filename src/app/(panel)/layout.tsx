import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { requireStaff } from "@/lib/auth";
import { cerrarSesion } from "@/lib/actions/auth";
import { LABEL_ROL } from "@/lib/roles";
import { pendientesNav } from "@/lib/pendientes";
import { Button } from "@/components/ui/button";
import { NavLinks } from "@/components/shared/nav-links";
import { BarraInferior } from "@/components/shared/barra-inferior";
import { Principal } from "@/components/shared/principal";
import { Marca } from "@/components/shared/marca";
import { SesionViva } from "@/components/shared/sesion-viva";
import { SelectorVista } from "@/components/shared/selector-vista";
import { ProveedorTour } from "@/components/tour/proveedor-tour";
import { BotonAyuda } from "@/components/tour/boton-ayuda";
import { BienvenidaTour } from "@/components/tour/bienvenida-tour";

/** Salir: en la barra lateral (azul) o en la hoja del menú del celular (clara). */
function BotonSalir({ claro = false }: { claro?: boolean }) {
  return (
    <form action={cerrarSesion} className="shrink-0">
      <Button
        type="submit"
        data-tour="salir"
        variant={claro ? "outline" : "ghost"}
        className={cn(
          "gap-2 text-sm",
          claro
            ? "min-h-11 px-4 font-semibold"
            : "min-h-9 px-2.5 text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground pointer-coarse:min-h-11"
        )}
      >
        <LogOut className="size-5" strokeWidth={1.8} />
        Salir
      </Button>
    </form>
  );
}

/**
 * Sombra arriba o abajo de la lista de la barra lateral cuando quedan secciones
 * fuera de la vista (ventana baja o grupos abiertos): avisa que se puede desplazar.
 * Las capas "local" (color de la barra) tapan la sombra cuando ya se llegó al borde.
 */
const SOMBRAS_DESPLAZAR: React.CSSProperties = {
  background: [
    "linear-gradient(var(--sidebar) 30%, transparent) top / 100% 2.5rem no-repeat local",
    "linear-gradient(transparent, var(--sidebar) 70%) bottom / 100% 2.5rem no-repeat local",
    "linear-gradient(oklch(0.16 0.05 268 / 0.75), transparent) top / 100% 1rem no-repeat scroll",
    "linear-gradient(transparent, oklch(0.16 0.05 268 / 0.75)) bottom / 100% 1rem no-repeat scroll",
  ].join(", "),
};

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await requireStaff();
  const rolLabel = LABEL_ROL[perfil.rol];
  const badges = await pendientesNav(perfil);

  return (
    <ProveedorTour rol={perfil.rol} usuario={perfil.user_id}>
    <div className="flex min-h-svh w-full">
      <SesionViva />
      <BienvenidaTour nombre={perfil.nombre} />
      {/* Barra lateral (escritorio y tablet apaisada) */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-56 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="border-b border-sidebar-border p-4">
          <Marca className="text-sidebar-foreground" />
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain p-2.5" style={SOMBRAS_DESPLAZAR}>
          <NavLinks rol={perfil.rol} badges={badges} data-tour="menu-lateral" />
        </div>
        {/* Ayuda: la guía paso a paso de la pantalla actual o del trabajo completo. */}
        <div className="border-t border-sidebar-border p-2.5">
          <BotonAyuda variante="barra" />
        </div>
        {perfil.superadmin ? (
          <div className="border-t border-sidebar-border p-2.5">
            <SelectorVista rolActual={perfil.rol} variante="barra" />
          </div>
        ) : null}
        {/* Quién está y Salir en una sola fila: le deja más alto a la lista. */}
        <div className="flex items-center gap-2 border-t border-sidebar-border py-3 pr-2.5 pl-4">
          <div className="min-w-0 flex-1 text-sm leading-snug">
            <p className="font-medium break-words">{perfil.nombre}</p>
            <p className="break-words text-sidebar-foreground/70">{rolLabel}</p>
          </div>
          <BotonSalir />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-56">
        {/* Barra superior (tablet vertical y celular): solo la marca y quién
            está usando el sistema; la navegación va en la barra de abajo. */}
        <header className="no-print sticky top-0 z-20 flex h-14 items-center justify-between gap-3 bg-sidebar px-4 text-sidebar-foreground lg:hidden">
          <Marca compacta className="text-sidebar-foreground" />
          <div className="flex min-w-0 items-center gap-2">
            <BotonAyuda variante="cabecera" />
            {/* En celulares angostos el rol se ve en «Menú» (le deja lugar a Ayuda). */}
            <span className="truncate rounded-full bg-sidebar-accent px-3 py-1 text-xs font-semibold text-sidebar-accent-foreground max-[420px]:hidden">
              {rolLabel}
            </span>
          </div>
        </header>

        <Principal>{children}</Principal>

        <BarraInferior
          rol={perfil.rol}
          badges={badges}
          nombre={perfil.nombre}
          rolLabel={rolLabel}
          logout={<BotonSalir claro />}
          vista={perfil.superadmin ? <SelectorVista rolActual={perfil.rol} /> : undefined}
        />
      </div>
    </div>
    </ProveedorTour>
  );
}
