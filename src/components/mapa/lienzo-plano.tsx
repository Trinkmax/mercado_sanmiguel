"use client";

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Minus, Plus, Scan } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  anilloDe,
  Anillos,
  CapaBloques,
  DefsPlano,
  FichasQuinteros,
  Fondo,
  ubicarPastilla,
  type AccionesEspacio,
  type Anillo,
  type Arbol,
  type DatosPastilla,
  type EstiloBloque,
  type FichaQuintero,
  type MedirTexto,
  type Pastilla,
  type Resto,
} from "./plano-svg";
import { ALT, alturaDe, type Bloque } from "./geometria";
import { envolvente } from "./geometria-3d";
import type { ElementoPlano, Espacio, Rect } from "./tipos";
import { useVista } from "./use-vista";

/** Desde esta escala (px por unidad) se lee el apodo debajo del número. */
const ESCALA_DETALLE = 0.85;
/** Lo que se enfoca puede estar seleccionado: la cámara cuenta con su tapa flotando. */
const Z_ENFOQUE = ALT.despegue + ALT.puesto;

export type ControlLienzo = {
  enfocar: (r: Rect) => void;
  ajustar: () => void;
  /** Acerca hasta esa escala (px por unidad) si hoy se ve más chico. */
  asegurarZoom: (k: number, centro?: Rect | null) => void;
  /** Si el área quedó fuera de lo visible (o debajo del panel), la trae. */
  asegurarVisible: (r: Rect) => void;
};

type Hover = { espacio: Espacio; bloque: Bloque; x: number; y: number; ancho: number };

// Valores por defecto estables (el selector de lugar usa el lienzo sin quinteros ni pastilla).
const SIN_FICHAS: FichaQuintero[] = [];
const SIN_RESTOS: Resto[] = [];
const SIN_ARBOLES: Arbol[] = [];
const SIN_FIN_FICHAS = new Map<string, number>();
const NADA = () => {};
const QUINTERO = () => "Quintero";

const seTocan = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

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
  fichas = SIN_FICHAS,
  restos = SIN_RESTOS,
  atenuar = false,
  pastilla = null,
  arboles = SIN_ARBOLES,
  finFichas = SIN_FIN_FICHAS,
  acciones,
  onTocarFicha = NADA,
  describirFicha = QUINTERO,
  onTocarFondo,
  tooltip,
  enfoqueInicial,
  resaltarBorde = false,
  insetInferior = 0,
  children,
}: {
  ref?: React.Ref<ControlLienzo>;
  limites: Rect;
  elementos: ElementoPlano[];
  bloques: Bloque[];
  estilos: Map<string, EstiloBloque>;
  anillos: Anillo[];
  fichas?: FichaQuintero[];
  /** Fichas "+N" de quinteros que no entraron en su zona. */
  restos?: Resto[];
  /** Hay selección o filtro: un velo apaga el fondo. */
  atenuar?: boolean;
  /** Texto de la pastilla del cliente seleccionado (null: sin pastilla). */
  pastilla?: DatosPastilla | null;
  arboles?: Arbol[];
  /** Hasta dónde llegan las fichas de cada cantero (id → y). */
  finFichas?: Map<string, number>;
  acciones: Pick<AccionesEspacio, "alTocar" | "describir">;
  onTocarFicha?: (clienteId: string) => void;
  describirFicha?: (clienteId: string) => string;
  onTocarFondo: () => void;
  /** Contenido del cartel al pasar el mouse por un espacio (sin esto, no hay cartel). */
  tooltip?: (espacio: Espacio, bloque: Bloque) => React.ReactNode;
  enfoqueInicial: Rect | null;
  /** Marco azul: el plano está en modo asignar. */
  resaltarBorde?: boolean;
  /** px de abajo tapados por el panel flotante: la cámara los descuenta al enfocar. */
  insetInferior?: number;
  /** Carteles flotantes sobre el plano (modo asignar, etc.). */
  children?: React.ReactNode;
}) {
  // La cámara abarca también el canto de la placa, las sombras (abajo y a la
  // derecha) y lo que sobresale arriba (rótulos de los recintos, cabriadas).
  const limitesVista = useMemo(
    () => ({ x: limites.x - 6, y: limites.y - 14, w: limites.w + 12, h: limites.h + 22 }),
    [limites]
  );
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
  } = useVista(limitesVista, insetInferior);
  const [hover, setHover] = useState<Hover | null>(null);
  /** Espacio con foco de teclado: su bloque despega y lleva anillo doble. */
  const [foco, setFoco] = useState<string | null>(null);
  const [medir, setMedir] = useState<MedirTexto | null>(null);
  const detalle = (escala ?? 0) >= ESCALA_DETALLE;
  const resaltado = hover?.bloque.clave ?? null;

  // La pastilla se mide con la fuente real (Nunito 800) cuando termina de
  // cargar; hasta entonces se estima por cantidad de caracteres.
  useEffect(() => {
    const familia = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim();
    const ctx = document.createElement("canvas").getContext("2d");
    if (!familia || !ctx || !document.fonts) return;
    let vigente = true;
    document.fonts.load(`800 17px ${familia}`).then(
      () => {
        if (!vigente) return;
        setMedir(() => (texto: string, tam: number) => {
          ctx.font = `800 ${tam}px ${familia}`;
          // + el letter-spacing de los rótulos (0,01 em)
          return ctx.measureText(texto).width + texto.length * tam * 0.01;
        });
      },
      () => {}
    );
    return () => {
      vigente = false;
    };
  }, []);

  const pastillaUbicada = useMemo(
    () => ubicarPastilla(pastilla, bloques, estilos, detalle, limites, medir),
    [pastilla, bloques, estilos, detalle, limites, medir]
  );
  const pastillaRef = useRef<Pastilla | null>(null);
  useEffect(() => {
    pastillaRef.current = pastillaUbicada;
  }, [pastillaUbicada]);

  /** Lo que tiene que entrar en cámara: la tapa elevada y, si apunta ahí, la pastilla. */
  const encuadre = useCallback((r: Rect, zTop: number): Rect => {
    const env = envolvente(r, zTop, 4);
    const p = pastillaRef.current;
    if (!p || !seTocan(p.ancla, r)) return env;
    const extra = p.alto + 12;
    return p.lado === "arriba" ? { ...env, y: env.y - extra, h: env.h + extra } : { ...env, h: env.h + extra };
  }, []);

  const enfocarPlano = useCallback((r: Rect) => enfocar(encuadre(r, Z_ENFOQUE)), [enfocar, encuadre]);
  const asegurarVisiblePlano = useCallback(
    (r: Rect) => asegurarVisible(encuadre(r, Z_ENFOQUE)),
    [asegurarVisible, encuadre]
  );

  useImperativeHandle(
    ref,
    () => ({ enfocar: enfocarPlano, ajustar, asegurarZoom, asegurarVisible: asegurarVisiblePlano }),
    [enfocarPlano, ajustar, asegurarZoom, asegurarVisiblePlano]
  );

  // Enfoque pedido por link (?cliente=… / ?puesto=…), una sola vez al medir.
  const enfocadoRef = useRef(false);
  const listo = escala !== null;
  useEffect(() => {
    if (!listo || enfocadoRef.current) return;
    enfocadoRef.current = true;
    if (enfoqueInicial) enfocarPlano(enfoqueInicial);
  }, [listo, enfoqueInicial, enfocarPlano]);

  // Hover y foco de teclado despegan el bloque 4 u: sus anillos van con él, y
  // se suman el contorno del hover y el anillo doble del foco.
  const anillosVista = useMemo<Anillo[]>(() => {
    const bFoco = foco ? bloques.find((b) => b.espacios.some((e) => e.id === foco)) ?? null : null;
    const bHover = resaltado ? bloques.find((b) => b.clave === resaltado) ?? null : null;
    if (!bFoco && !bHover) return anillos;
    const alturas = (b: Bloque) => {
      const estilo = estilos.get(b.clave);
      return estilo ? alturaDe(b, estilo, { hover: b === bHover, foco: b === bFoco }) : null;
    };
    const lista = anillos.map((a) => {
      const b = a.clave === bHover?.clave ? bHover : a.clave === bFoco?.clave ? bFoco : null;
      const al = b ? alturas(b) : null;
      return al ? { ...a, z0: al.z0, zTop: al.zTop } : a;
    });
    if (bFoco) {
      const e = bFoco.espacios.find((x) => x.id === foco);
      const al = alturas(bFoco);
      // Si el espacio ya tiene anillo de selección, el de foco lo taparía y se
      // vería igual: va uno propio por fuera.
      const conSeleccion =
        e !== undefined &&
        anillos.some(
          (a) =>
            a.tono === "seleccion" &&
            a.clave === bFoco.clave &&
            a.rect.x === e.x &&
            a.rect.y === e.y &&
            a.rect.w === e.w &&
            a.rect.h === e.h
        );
      if (e && al) lista.push(anilloDe(bFoco, e, conSeleccion ? "focoSel" : "foco", al));
    }
    if (bHover && bHover !== bFoco) {
      const al = alturas(bHover);
      if (al) lista.push(anilloDe(bHover, bHover.rect, "hover", al));
    }
    return lista;
  }, [anillos, bloques, estilos, resaltado, foco]);

  // alEnfocar lee los estilos de acá: así las acciones (y con ellas todas las
  // zonas táctiles) no cambian con cada selección o filtro.
  const estilosRef = useRef(estilos);
  useEffect(() => {
    estilosRef.current = estilos;
  }, [estilos]);

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
      alEnfocar: (e, b, ev) => {
        // Solo con teclado (el foco por click no levanta el bloque ni mueve el plano).
        if (!ev.currentTarget.matches(":focus-visible")) return;
        setFoco(e.id);
        const estilo = estilosRef.current.get(b.clave);
        const zTop = estilo ? alturaDe(b, estilo, { hover: false, foco: true }).zTop : ALT.puesto;
        asegurarVisible(encuadre(e, zTop));
      },
      alDesenfocar: () => setFoco(null),
      describir: acciones.describir,
    }),
    [acciones, fueArrastre, rectContenedor, asegurarVisible, encuadre]
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
      className="relative min-h-0 flex-1 overflow-hidden bg-background outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset"
    >
      <svg
        viewBox={viewBox ?? `${limitesVista.x} ${limitesVista.y} ${limitesVista.w} ${limitesVista.h}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 size-full touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClick={(ev) => {
          if (fueArrastre()) return;
          const t = ev.target as Element;
          // La pastilla de la selección tampoco es "fondo": tocarla no limpia nada.
          if (t.closest("[data-espacio],[data-ficha],[data-pastilla]")) return;
          onTocarFondo();
        }}
        onPointerLeave={() => setHover(null)}
      >
        <DefsPlano />
        <Fondo elementos={elementos} limites={limites} detalle={detalle} arboles={arboles} finFichas={finFichas} />
        {/* Velo: con selección o filtro, todo el fondo baja de un solo golpe */}
        {atenuar ? (
          <rect
            x={limites.x - 600}
            y={limites.y - 600}
            width={limites.w + 1200}
            height={limites.h + 1200}
            fill="var(--background)"
            fillOpacity={0.58}
            pointerEvents="none"
          />
        ) : null}
        <FichasQuinteros fichas={fichas} restos={restos} alTocar={tocarFicha} describir={describirFicha} />
        <CapaBloques
          bloques={bloques}
          estilos={estilos}
          detalle={detalle}
          resaltado={resaltado}
          foco={foco}
          acciones={accionesLienzo}
        />
        <Anillos anillos={anillosVista} pastilla={pastillaUbicada} />
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
      {hover && tooltip ? (
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
