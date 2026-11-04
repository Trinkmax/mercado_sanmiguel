"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderOpen, MessagesSquare, Receipt, Store } from "lucide-react";
import { PlanoPortal, type LugarPlano, type TonoPlano } from "./plano-portal";

/**
 * Las cuatro secciones del portal, abajo y grandes: siempre con su texto (el ícono solo no se
 * entiende) y al alcance del pulgar. En una conversación o en un trámite se esconde: pantalla
 * de una sola cosa, con «Volver» arriba.
 */

const SECCIONES = [
  { href: "/mi-cuenta", label: "Mi cuenta", icono: Store },
  { href: "/mi-cuenta/pagos", label: "Mis pagos", icono: Receipt },
  { href: "/mi-cuenta/mensajes", label: "Mensajes", icono: MessagesSquare },
  { href: "/mi-cuenta/carpeta", label: "Mi carpeta", icono: FolderOpen },
] as const;

function esPantallaDeUnaCosa(pathname: string): boolean {
  return /^\/mi-cuenta\/(solicitudes|comunicaciones|circulares)\/.+/.test(pathname);
}

export function BarraPortal({ mensajes }: { mensajes: number }) {
  const pathname = usePathname();
  if (esPantallaDeUnaCosa(pathname)) return null;
  return (
    <nav aria-label="Secciones del portal" data-tour="nav:barra" className="portal-barra no-print">
      {SECCIONES.map((s) => {
        const activo = s.href === "/mi-cuenta" ? pathname === s.href : pathname.startsWith(s.href);
        const Icono = s.icono;
        const globo = s.href === "/mi-cuenta/mensajes" ? mensajes : 0;
        return (
          <Link
            key={s.href}
            href={s.href}
            data-tour={`nav:${s.href}`}
            aria-current={activo ? "page" : undefined}
            className="portal-tab"
          >
            <span className="portal-tab-chapa" aria-hidden>
              <Icono strokeWidth={2.2} />
            </span>
            <span>{s.label}</span>
            {globo > 0 ? (
              <span className="portal-globo" aria-label={`${globo} ${globo === 1 ? "nuevo" : "nuevos"}`}>
                {globo > 9 ? "9+" : globo}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** El lugar que deja libre la barra de abajo, para que no tape lo último de la página. */
export function EspacioBarra() {
  const pathname = usePathname();
  if (esPantallaDeUnaCosa(pathname)) return null;
  return <div aria-hidden className="portal-espacio-barra" />;
}

/**
 * El plano quieto de fondo. En «Mi cuenta» se ve entero; en las demás pantallas (y en los
 * términos o una circular para confirmar) queda velado detrás del título: lo decide el CSS según
 * lo que haya en la pantalla (.portal-espacio-chico), así no depende de la dirección.
 */
export function CieloPortal({
  lugares,
  foco,
  tono,
  etiqueta,
  children,
}: {
  lugares: LugarPlano[];
  foco: LugarPlano[];
  tono: TonoPlano;
  etiqueta: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="portal-cielo no-print" data-tour="portal-plano">
      <PlanoPortal lugares={lugares} foco={foco} tono={tono} etiqueta={etiqueta} />
      <div className="plano-sombra-alta" aria-hidden />
      <div className="plano-velo" aria-hidden />
      {children}
    </div>
  );
}
