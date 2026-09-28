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

/** Salir: en la barra lateral (azul) o en la hoja del menú del celular (clara). */
function BotonSalir({ claro = false }: { claro?: boolean }) {
  return (
    <form action={cerrarSesion}>
      <Button
        type="submit"
        variant={claro ? "outline" : "ghost"}
        className={cn(
          "min-h-11 gap-2",
          claro
            ? "px-4 text-sm font-semibold"
            : "w-full justify-start gap-3 text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <LogOut className="size-5" strokeWidth={1.8} />
        Salir
      </Button>
    </form>
  );
}

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await requireStaff();
  const rolLabel = LABEL_ROL[perfil.rol];
  const badges = await pendientesNav(perfil);

  return (
    <div className="flex min-h-svh w-full">
      {/* Barra lateral (escritorio y tablet apaisada) */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-56 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="border-b border-sidebar-border p-4">
          <Marca className="text-sidebar-foreground" />
        </div>
        <div className="flex-1 overflow-y-auto p-2.5">
          <NavLinks rol={perfil.rol} badges={badges} />
        </div>
        <div className="border-t border-sidebar-border p-4 space-y-3">
          <div className="text-sm">
            <p className="font-medium">{perfil.nombre}</p>
            <p className="text-sidebar-foreground/70">{rolLabel}</p>
          </div>
          <BotonSalir />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-56">
        {/* Barra superior (tablet vertical y celular): solo la marca y quién
            está usando el sistema; la navegación va en la barra de abajo. */}
        <header className="no-print sticky top-0 z-20 flex h-14 items-center justify-between gap-3 bg-sidebar px-4 text-sidebar-foreground lg:hidden">
          <Marca compacta className="text-sidebar-foreground" />
          <span className="truncate rounded-full bg-sidebar-accent px-3 py-1 text-xs font-semibold text-sidebar-accent-foreground">
            {rolLabel}
          </span>
        </header>

        <Principal>{children}</Principal>

        <BarraInferior
          rol={perfil.rol}
          badges={badges}
          nombre={perfil.nombre}
          rolLabel={rolLabel}
          logout={<BotonSalir claro />}
        />
      </div>
    </div>
  );
}
