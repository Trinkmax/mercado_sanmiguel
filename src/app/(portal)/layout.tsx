import { Eye, LogOut } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { cerrarSesion } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Marca } from "@/components/shared/marca";
import { SesionViva } from "@/components/shared/sesion-viva";
import { GateTerminos } from "@/components/portal/gate-terminos";
import { GateCirculares } from "@/components/portal/gate-circulares";
import { NavPortal } from "@/components/portal/nav-portal";
import {
  getClienteSocio,
  getResumenComunicaciones,
  getSolicitudesConRespuesta,
} from "@/components/portal/datos-portal";
import { SelectorVista } from "@/components/shared/selector-vista";
import { ProveedorTour } from "@/components/tour/proveedor-tour";
import { BotonAyuda } from "@/components/tour/boton-ayuda";
import { BienvenidaTour } from "@/components/tour/bienvenida-tour";

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
  const vistaPrevia = perfil.superadmin;
  const [resumen, conRespuesta, clienteVista] = await Promise.all([
    getResumenComunicaciones(perfil.user_id),
    getSolicitudesConRespuesta(),
    vistaPrevia ? getClienteSocio(perfil.user_id) : Promise.resolve(null),
  ]);
  const contenido = (
    <>
      <BienvenidaTour nombre={perfil.nombre} />
      <NavPortal nuevas={resumen.total} respuestas={conRespuesta.length} />
      {children}
    </>
  );

  return (
    <ProveedorTour rol={perfil.rol} usuario={perfil.user_id}>
    <div className="flex min-h-svh flex-col">
      <SesionViva />
      <header className="no-print bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-3">
          <Marca compacta className="text-sidebar-foreground" />
          {/* Ayuda y Salir separados: al buscar ayuda no se cierra la sesión. */}
          <div className="flex items-center gap-4">
          <BotonAyuda variante="cabecera" />
          <form action={cerrarSesion}>
            <Button
              type="submit"
              data-tour="salir"
              variant="ghost"
              size="sm"
              className="gap-2 text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground min-h-11"
            >
              <LogOut className="size-4" />
              Salir
            </Button>
          </form>
          </div>
        </div>
      </header>
      {vistaPrevia ? (
        // Vista previa del superadministrador: se ve el portal como el cliente, sin guardar
        // nada en su nombre (la base lo bloquea) y sin pedirle términos ni circulares.
        <div className="no-print border-b border-parcial/40 bg-parcial-suave">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
            <p className="flex min-w-0 flex-1 items-start gap-2 text-sm leading-snug">
              <Eye className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
              <span className="min-w-0 break-words">
                <strong>Vista previa</strong> del portal
                {clienteVista ? ` de ${clienteVista.nombre} (carpeta ${clienteVista.codigo})` : ""}. Lo ves
                como el socio; no se guarda nada.
              </span>
            </p>
            <div className="sm:w-64">
              <SelectorVista rolActual={perfil.rol} clienteVista={clienteVista?.nombre ?? null} />
            </div>
          </div>
        </div>
      ) : null}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <p className="sr-only">Sesión de {perfil.nombre}</p>
        {vistaPrevia ? (
          contenido
        ) : (
          <GateTerminos perfil={perfil}>
            <GateCirculares perfil={perfil}>{contenido}</GateCirculares>
          </GateTerminos>
        )}
      </main>
    </div>
    </ProveedorTour>
  );
}
