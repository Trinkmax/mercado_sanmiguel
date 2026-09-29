import { LogOut } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { cerrarSesion } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Marca } from "@/components/shared/marca";
import { SesionViva } from "@/components/shared/sesion-viva";
import { GateTerminos } from "@/components/portal/gate-terminos";
import { GateCirculares } from "@/components/portal/gate-circulares";
import { NavPortal } from "@/components/portal/nav-portal";
import {
  getResumenComunicaciones,
  getSolicitudesConRespuesta,
} from "@/components/portal/datos-portal";

/** Portal del socio: una sola columna, simple, pensado para el celular.
 * Antes de mostrar cualquier cosa, exige aceptar los términos vigentes y confirmar las
 * circulares obligatorias de su público. Navegación: "Mi cuenta" (con las respuestas nuevas
 * a sus solicitudes) · "Comunicaciones" (con lo nuevo). */
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await requireRol("socio");
  const [resumen, conRespuesta] = await Promise.all([
    getResumenComunicaciones(perfil.user_id),
    getSolicitudesConRespuesta(),
  ]);

  return (
    <div className="flex min-h-svh flex-col">
      <SesionViva />
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
        <GateTerminos perfil={perfil}>
          <GateCirculares perfil={perfil}>
            <NavPortal nuevas={resumen.total} respuestas={conRespuesta.length} />
            {children}
          </GateCirculares>
        </GateTerminos>
      </main>
    </div>
  );
}
