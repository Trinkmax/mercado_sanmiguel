import type { Viewport } from "next";
import { Archivo } from "next/font/google";
import Image from "next/image";
import { Eye } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { nivelDeuda, TZ_AR } from "@/lib/format";
import { SesionViva } from "@/components/shared/sesion-viva";
import { RefrescarAlVolver } from "@/components/portal/refrescar-al-volver";
import { GateTerminos } from "@/components/portal/gate-terminos";
import { GateCirculares } from "@/components/portal/gate-circulares";
import { BarraPortal, CieloPortal, EspacioBarra } from "@/components/portal/barra-portal";
import { aLugarPlano, etiquetaChapa, lugaresPrincipales } from "@/components/portal/armar-cuenta";
import {
  getClienteSocio,
  getDeudaSocio,
  getLugaresSocio,
  getPendientesSocio,
} from "@/components/portal/datos-portal";
import { SelectorVista } from "@/components/shared/selector-vista";
import { ProveedorTour } from "@/components/tour/proveedor-tour";
import { BotonAyuda } from "@/components/tour/boton-ayuda";
import { BienvenidaTour } from "@/components/tour/bienvenida-tour";
import logo from "../../../public/logo.png";
import "./portal.css";

// La barra del navegador del celular, del mismo azul que el plano.
export const viewport: Viewport = { themeColor: "#253b8a" };

/** La letra del portal: grotesca fuerte, argentina (Omnibus-Type), de números bien claros.
 * Con eje de ancho: los montos largos se angostan un poco en vez de achicarse. */
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], display: "swap" });

function saludo(): string {
  const hora = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ_AR, hour: "numeric", hourCycle: "h23" }).format(new Date())
  );
  if (hora >= 5 && hora < 12) return "Buen día";
  if (hora >= 12 && hora < 20) return "Buenas tardes";
  return "Buenas noches";
}

/**
 * Portal del socio: «Tu lugar en el mercado» (DESIGN.md). El plano queda quieto de fondo y
 * todo sube por encima; abajo, cuatro secciones grandes. Antes de mostrar nada exige aceptar
 * los términos vigentes y confirmar las circulares obligatorias de su público.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const perfil = await requireRol("socio");
  const vistaPrevia = perfil.superadmin;
  const [cliente, lugares, deuda, pendientes] = await Promise.all([
    getClienteSocio(perfil.user_id),
    getLugaresSocio(perfil.user_id),
    getDeudaSocio(perfil.user_id),
    getPendientesSocio(perfil.user_id),
  ]);

  const nombre = (cliente?.nombre ?? perfil.nombre).trim().split(/\s+/)[0] ?? "";
  const principales = lugaresPrincipales(lugares);
  const nivel = nivelDeuda(deuda);

  const contenido = (
    <>
      <BienvenidaTour nombre={nombre} />
      <BarraPortal mensajes={pendientes.length} />
      {children}
      <EspacioBarra />
    </>
  );

  return (
    <ProveedorTour rol={perfil.rol} usuario={perfil.user_id}>
      {/* La letra se declara acá (y no en la raíz) para que el panel no la descargue. */}
      <style href="portal-letra" precedence="default">{`:root{--font-chapa:${archivo.style.fontFamily}}`}</style>
      <div className="portal">
        <SesionViva />
        <RefrescarAlVolver />
        {vistaPrevia ? (
          // Vista previa del superadministrador: se ve el portal como el cliente, sin guardar
          // nada en su nombre (la base lo bloquea) y sin pedirle términos ni circulares.
          <div className="no-print relative z-10 bg-parcial-suave text-tinta">
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center">
              <p className="flex min-w-0 flex-1 items-start gap-2 text-sm leading-snug">
                <Eye className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
                <span className="min-w-0 break-words">
                  <strong>Vista previa</strong> del portal
                  {cliente ? ` de ${cliente.nombre} (carpeta ${cliente.codigo})` : ""}. Lo ves como el socio; no se
                  guarda nada.
                </span>
              </p>
              <div className="sm:w-64">
                <SelectorVista rolActual={perfil.rol} clienteVista={cliente?.nombre ?? null} />
              </div>
            </div>
          </div>
        ) : null}

        <div className="portal-cuerpo">
          <CieloPortal
            lugares={lugares.map(aLugarPlano)}
            foco={principales.map(aLugarPlano)}
            tono={nivel}
            etiqueta={etiquetaChapa(principales)}
          >
            <header className="portal-encabezado">
              <span className="portal-logo">
                <Image src={logo} alt="Mercado San Miguel" className="h-[1.65rem] w-auto" priority />
              </span>
              <p className="portal-saludo">
                {saludo()}
                {nombre ? "," : ""}
                {nombre ? <strong>{nombre}</strong> : null}
              </p>
              <BotonAyuda
                variante="cabecera"
                className="bg-porcelana text-[0.98rem] font-extrabold text-esmalte hover:bg-porcelana-2 focus-visible:ring-porcelana"
              />
            </header>
          </CieloPortal>

          <main className="portal-main">
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
      </div>
    </ProveedorTour>
  );
}
