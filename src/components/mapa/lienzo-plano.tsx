"use client";

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Minus, Plus, Scan } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Anillos,
  CapaBloques,
  FichasQuinteros,
  Fondo,
  type AccionesEspacio,
  type Anillo,
  type EstiloBloque,
  type FichaQuintero,
  type Resto,
} from "./plano-svg";
import type { Bloque } from "./geometria";
import type { ElementoPlano, Espacio, Rect } from "./tipos";
import { useVista } from "./use-vista";

/** Desde esta escala (px por unidad) se lee el apodo debajo del número. */
const ESCALA_DETALLE = 0.85;

export type ControlLienzo = {
  enfocar: (r: Rect) => void;
  ajustar: () => void;
  /** Acerca hasta esa escala (px por unidad) si hoy se ve más chico. */
  asegurarZoom: (k: number, centro?: Rect | null) => void;
};

type Hover = { espacio: Espacio; bloque: Bloque; x: number; y: number; ancho: number };

/**
 * El plano navegable: dueño de la cámara (zoom y desplazamiento), así mover
 * el plano solo repinta el lienzo y no los paneles de alrededor.
 */
export function LienzoPlano({
  ref,
  limites,
  elementos,
  bloques,
  estilos,
  anillos,
  fichas,
  restos,
  acciones,
  onTocarFicha,
  describirFicha,
  onTocarFondo,
  tooltip,
  enfoqueInicial,
  pantallaCompleta,
  resaltarBorde,
  children,
}: {
  ref?: React.Ref<ControlLienzo>;
  limites: Rect;
  elementos: ElementoPlano[];
  bloques: Bloque[];
  estilos: Map<string, EstiloBloque>;
  anillos: Anillo[];
  fichas: FichaQuintero[];
  /** Fichas "+N" de quinteros que no entraron en su zona. */
  restos: Resto[];
  acciones: Pick<AccionesEspacio, "alTocar" | "describir">;
  onTocarFicha: (clienteId: string) => void;
  describirFicha: (clienteId: string) => string;
  onTocarFondo: () => void;
  /** Contenido del cartel al pasar el mouse por un espacio. */
  tooltip: (espacio: Espacio, bloque: Bloque) => React.ReactNode;
  enfoqueInicial: Rect | null;
  pantallaCompleta: boolean;
  /** Marco azul: el plano está en modo asignar. */
  resaltarBorde: boolean;
  /** Carteles flotantes sobre el plano (modo asignar, etc.). */
  children?: React.ReactNode;
}) {
  const {
    contRef,
    viewBox,
    escala,
    fueArrastre,
    rectContenedor,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    alTeclado,
    acercar,
    alejar,
    ajustar,
    enfocar,
    asegurarVisible,
    asegurarZoom,
  } = useVista(limites);
  const [hover, setHover] = useState<Hover | null>(null);
  const detalle = (escala ?? 0) >= ESCALA_DETALLE;

  useImperativeHandle(ref, () => ({ enfocar, ajustar, asegurarZoom }), [
    enfocar,
    ajustar,
    asegurarZoom,
  ]);

  // Enfoque pedido por link (?cliente=… / ?puesto=…), una sola vez al medir.
  const enfocadoRef = useRef(false);
  const listo = escala !== null;
  useEffect(() => {
    if (!listo || enfocadoRef.current) return;
    enfocadoRef.current = true;
    if (enfoqueInicial) enfocar(enfoqueInicial);
  }, [listo, enfoqueInicial, enfocar]);

  const accionesLienzo = useMemo<AccionesEspacio>(
    () => ({
      alTocar: (e, b) => {
        if (fueArrastre()) return; // fue un arrastre, no un toque
        setHover(null);
        acciones.alTocar(e, b);
      },
      alEntrar: (e, b, ev) => {
        if (ev.pointerType !== "mouse" || ev.buttons !== 0) return;
        const r = rectContenedor();
        if (!r) return;
        setHover({ espacio: e, bloque: b, x: ev.clientX - r.left, y: ev.clientY - r.top, ancho: r.width });
      },
      alSalir: () => setHover(null),
      alEnfocar: (e, ev) => {
        // Solo con teclado (el foco por click no tiene que mover el plano).
        if (ev.currentTarget.matches(":focus-visible")) asegurarVisible(e);
      },
      describir: acciones.describir,
    }),
    [acciones, fueArrastre, rectContenedor, asegurarVisible]
  );

  const tocarFicha = useCallback(
    (clienteId: string) => {
      if (fueArrastre()) return;
      onTocarFicha(clienteId);
    },
    [fueArrastre, onTocarFicha]
  );

  const tooltipAbajo = hover !== null && hover.y < 150;
  const tooltipX = hover ? Math.min(Math.max(hover.x, 140), Math.max(140, hover.ancho - 140)) : 0;

  return (
    <div
      ref={contRef}
      role="group"
      aria-label="Plano del mercado. Arrastrá para moverte; con + y − acercás o alejás, y con 0 lo ves entero."
      tabIndex={0}
      onKeyDown={alTeclado}
      className={cn(
        "relative overflow-hidden bg-background outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset",
        pantallaCompleta ? "min-h-0 flex-1" : "max-h-[74vh] min-h-[24rem]"
      )}
      style={pantallaCompleta ? undefined : { aspectRatio: `${limites.w} / ${limites.h}` }}
    >
      <svg
        viewBox={viewBox ?? `${limites.x} ${limites.y} ${limites.w} ${limites.h}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 size-full touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClick={(ev) => {
          if (fueArrastre()) return;
          const t = ev.target as Element;
          if (t.closest("[data-espacio],[data-ficha]")) return;
          onTocarFondo();
        }}
        onPointerLeave={() => setHover(null)}
      >
        <Fondo elementos={elementos} limites={limites} />
        <FichasQuinteros fichas={fichas} restos={restos} alTocar={tocarFicha} describir={describirFicha} />
        <CapaBloques
          bloques={bloques}
          estilos={estilos}
          detalle={detalle}
          resaltado={hover?.bloque.clave ?? null}
          acciones={accionesLienzo}
        />
        <Anillos anillos={anillos} />
      </svg>

      {/* Marco del modo asignar */}
      {resaltarBorde ? (
        <div aria-hidden className="pointer-events-none absolute inset-0 ring-2 ring-primary/45 ring-inset" />
      ) : null}

      {/* Zoom */}
      <div className="absolute bottom-3 left-3 flex overflow-hidden rounded-lg border bg-card/95 shadow-sm backdrop-blur-sm">
        <BotonZoom etiqueta="Acercar" onClick={acercar}>
          <Plus className="size-[1.1rem]" strokeWidth={2.2} />
        </BotonZoom>
        <BotonZoom etiqueta="Alejar" onClick={alejar} borde>
          <Minus className="size-[1.1rem]" strokeWidth={2.2} />
        </BotonZoom>
        <BotonZoom etiqueta="Ver todo el predio" onClick={ajustar} borde>
          <Scan className="size-[1.05rem]" strokeWidth={2} />
        </BotonZoom>
      </div>

      {children}

      {/* Cartel al pasar el mouse */}
      {hover ? (
        <div
          className="pointer-events-none absolute z-20 w-68 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg"
          style={{
            left: tooltipX,
            top: hover.y,
            transform: tooltipAbajo ? "translate(-50%, 18px)" : "translate(-50%, calc(-100% - 14px))",
          }}
        >
          {tooltip(hover.espacio, hover.bloque)}
        </div>
      ) : null}
    </div>
  );
}

function BotonZoom({
  etiqueta,
  onClick,
  borde = false,
  children,
}: {
  etiqueta: string;
  onClick: () => void;
  borde?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      onClick={onClick}
      className={cn(
        "flex size-11 items-center justify-center text-foreground/80 transition-colors hover:bg-muted hover:text-foreground active:bg-muted",
        borde && "border-l"
      )}
    >
      {children}
    </button>
  );
}
