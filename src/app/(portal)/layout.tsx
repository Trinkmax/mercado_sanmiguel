import { LogOut } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { cerrarSesion } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Marca } from "@/components/shared/marca";
import { GateTerminos } from "@/components/portal/gate-terminos";

/** Portal del socio: una sola columna, simple, pensado para el celular.
 * Antes de mostrar cualquier cosa, exige aceptar los términos vigentes. */
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await requireRol("socio");

  return (
    <div className="flex min-h-svh flex-col">
      <header className="no-print bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-3">
          <Marca compacta className="text-sidebar-foreground" />
          <form action={cerrarSesion}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="gap-2 text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground min-h-11"
            >
              <LogOut className="size-4" />
              Salir
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <p className="sr-only">Sesión de {perfil.nombre}</p>
        <GateTerminos perfil={perfil}>{children}</GateTerminos>
      </main>
    </div>
  );
}
