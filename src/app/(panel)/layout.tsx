import { LogOut } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { cerrarSesion } from "@/lib/actions/auth";
import { LABEL_ROL } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { NavLinks } from "@/components/shared/nav-links";
import { MobileNav } from "@/components/shared/mobile-nav";
import { Marca } from "@/components/shared/marca";

function BotonSalir() {
  return (
    <form action={cerrarSesion}>
      <Button
        type="submit"
        variant="ghost"
        className="w-full justify-start gap-3 text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground min-h-11"
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

  return (
    <div className="flex min-h-svh w-full">
      {/* Barra lateral (escritorio y tablet apaisada) */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-56 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="border-b border-sidebar-border p-4">
          <Marca className="text-sidebar-foreground" />
        </div>
        <div className="flex-1 overflow-y-auto p-2.5">
          <NavLinks rol={perfil.rol} />
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
        {/* Barra superior (tablet vertical y celular) */}
        <header className="no-print sticky top-0 z-20 flex items-center gap-3 bg-sidebar px-3 py-2 text-sidebar-foreground lg:hidden">
          <MobileNav
            rol={perfil.rol}
            nombre={perfil.nombre}
            rolLabel={rolLabel}
            logout={<BotonSalir />}
          />
          <Marca compacta className="text-sidebar-foreground" />
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 md:px-7 md:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
