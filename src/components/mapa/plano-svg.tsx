"use client";

import { memo } from "react";
import type { Bloque } from "./geometria";
import { numeroVisible } from "./geometria";
import type { ElementoPlano, Espacio, EstadoCobro, Rect } from "./tipos";

/* Piezas de dibujo del plano (SVG puro, sin estado). El orquestador
 * (`mapa-mercado.tsx`) decide colores, atenuados y anillos; acá solo se pinta. */

// ---------- Paleta del terreno (paisaje, no estados) ----------
const TINTA_SUAVE = "oklch(0.55 0.02 262)";
const ASFALTO = "oklch(0.94 0.006 258)";
const ASFALTO_BORDE = "oklch(0.885 0.009 258)";
const VERDE_ZONA = "oklch(0.962 0.034 146)";
const VERDE_BORDE = "oklch(0.86 0.06 146)";
const VERDE_TINTA = "oklch(0.43 0.09 146)";
const VIDRIO = "oklch(0.967 0.028 160)";
const VIDRIO_BORDE = "oklch(0.84 0.055 160)";
const VIDRIO_TRAMA = "oklch(0.86 0.05 160)";

const DISPLAY: React.CSSProperties = { fontFamily: "var(--font-display)", fontWeight: 700 };
const SANS: React.CSSProperties = { fontFamily: "var(--font-sans)" };

/** Estado visual de un bloque: el de cobro de su cliente, o libre. */
export type EstadoBloque = EstadoCobro | "libre" | "ocupado";

export const ASPECTO: Record<
  EstadoBloque,
  { fill: string; stroke: string; strokeOpacity: number; texto: string; grosor: number }
> = {
  libre: {
    fill: "var(--card)",
    stroke: "oklch(0.8 0.014 258)",
    strokeOpacity: 1,
    texto: "oklch(0.5 0.022 262)",
    grosor: 1,
  },
  al_dia: {
    fill: "var(--pagado-suave)",
    stroke: "var(--pagado)",
    strokeOpacity: 0.6,
    texto: "var(--pagado)",
    grosor: 1.2,
  },
  debe: {
    fill: "var(--pendiente-suave)",
    stroke: "var(--pendiente)",
    strokeOpacity: 0.6,
    texto: "var(--pendiente)",
    grosor: 1.2,
  },
  vencido: {
    fill: "var(--pendiente)",
    stroke: "oklch(0.4 0.15 27)",
    strokeOpacity: 1,
    texto: "#ffffff",
    grosor: 1.2,
  },
  ocupado: {
    fill: "var(--accent)",
    stroke: "var(--primary)",
    strokeOpacity: 0.45,
    texto: "var(--accent-foreground)",
    grosor: 1.2,
  },
};

/** Texto con halo del color de fondo (legible sobre tramas y líneas). */
function Rotulo({
  x,
  y,
  texto,
  tamano = 15,
  color = TINTA_SUAVE,
  halo = "var(--background)",
  anchor = "middle",
  vertical = false,
}: {
  x: number;
  y: number;
  texto: string;
  tamano?: number;
  color?: string;
  halo?: string;
  anchor?: "start" | "middle" | "end";
  vertical?: boolean;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      dominantBaseline="central"
      transform={vertical ? `rotate(-90 ${x} ${y})` : undefined}
      fill={color}
      stroke={halo}
      strokeWidth={3.5}
      strokeLinejoin="round"
      paintOrder="stroke"
      style={{ ...DISPLAY, fontSize: tamano, letterSpacing: "0.01em" }}
    >
      {texto}
    </text>
  );
}

// ---------- Fondo: terreno + elementos fijos ----------

function Elemento({ el }: { el: ElementoPlano }) {
  const { x, y, w, h } = el;
  const cx = x + w / 2;
  const cy = y + h / 2;
  switch (el.tipo) {
    case "nave":
      return (
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={18}
          fill="var(--card)"
          stroke="oklch(0.87 0.01 258)"
          strokeWidth={1.2}
          filter="url(#mapa-sombra)"
        />
      );
    case "pasillo":
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} fill="oklch(0.955 0.007 258 / 0.75)" />
          {[x, x + w].map((lx) => (
            <line
              key={lx}
              x1={lx}
              y1={y}
              x2={lx}
              y2={y + h}
              stroke="oklch(0.6 0.025 262)"
              strokeWidth={1.4}
              strokeDasharray="0.1 7"
              strokeLinecap="round"
            />
          ))}
          <Rotulo x={cx} y={cy} texto={el.etiqueta ?? "Pasillo"} vertical tamano={15} halo="oklch(0.96 0.006 258)" />
        </g>
      );
    case "cocheras": {
      const n = Math.max(0, el.capacidad ?? 0);
      const horizontal = w >= h;
      const etiqueta = el.etiqueta ?? `${n} cocheras`;
      const anchoPill = etiqueta.length * 8.3 + 30;
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} rx={9} fill={ASFALTO} stroke={ASFALTO_BORDE} />
          {Array.from({ length: Math.max(0, n - 1) }, (_, i) => {
            const t = (i + 1) / n;
            return horizontal ? (
              <line
                key={i}
                x1={x + w * t}
                y1={y + 7}
                x2={x + w * t}
                y2={y + h - 7}
                stroke="var(--card)"
                strokeWidth={1.8}
                strokeLinecap="round"
              />
            ) : (
              <line
                key={i}
                x1={x + 7}
                y1={y + h * t}
                x2={x + w - 7}
                y2={y + h * t}
                stroke="var(--card)"
                strokeWidth={1.8}
                strokeLinecap="round"
              />
            );
          })}
          <rect
            x={cx - anchoPill / 2}
            y={cy - 13.5}
            width={anchoPill}
            height={27}
            rx={13.5}
            fill="var(--card)"
            stroke={ASFALTO_BORDE}
          />
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="central"
            fill={TINTA_SUAVE}
            style={{ ...DISPLAY, fontSize: 15 }}
          >
            {etiqueta}
          </text>
        </g>
      );
    }
    case "quinteros":
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} rx={12} fill={VERDE_ZONA} stroke={VERDE_BORDE} />
          <text
            x={x + 14}
            y={y + 21}
            dominantBaseline="central"
            fill={VERDE_TINTA}
            style={{ ...DISPLAY, fontSize: 16 }}
          >
            {el.etiqueta ?? "Quinteros"}
          </text>
        </g>
      );
    case "administracion":
      return (
        <g>
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            rx={10}
            fill="var(--accent)"
            stroke="var(--primary)"
            strokeOpacity={0.22}
          />
          {/* Isotipo simple: edificio con frontón */}
          <path
            d={`M${cx - 11} ${cy - 4} L${cx} ${cy - 13} L${cx + 11} ${cy - 4} M${cx - 8} ${cy - 3} V${cy + 6} M${cx} ${cy - 3} V${cy + 6} M${cx + 8} ${cy - 3} V${cy + 6} M${cx - 12} ${cy + 8} H${cx + 12}`}
            fill="none"
            stroke="var(--primary)"
            strokeOpacity={0.55}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text
            x={cx}
            y={cy + 26}
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--accent-foreground)"
            style={{ ...DISPLAY, fontSize: 11.5 }}
          >
            {el.etiqueta ?? "Administración"}
          </text>
        </g>
      );
    case "invernadero":
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} rx={8} fill={VIDRIO} stroke={VIDRIO_BORDE} />
          <rect x={x} y={y} width={w} height={h} rx={8} fill="url(#mapa-vidrio)" />
          <Rotulo x={cx} y={cy} texto={el.etiqueta ?? "Invernadero"} vertical color={VERDE_TINTA} halo={VIDRIO} tamano={16} />
        </g>
      );
    case "recinto":
      return (
        <g>
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            rx={14}
            fill="oklch(0.99 0.002 258 / 0.55)"
            stroke="oklch(0.66 0.02 262)"
            strokeOpacity={0.7}
            strokeWidth={1.2}
            strokeDasharray="6 5"
          />
          {el.etiqueta ? <Rotulo x={x + 4} y={y - 12} texto={el.etiqueta} anchor="start" tamano={14} /> : null}
        </g>
      );
    case "rotulo":
      return el.etiqueta ? <Rotulo x={cx} y={cy + 2} texto={el.etiqueta} tamano={15} /> : null;
    default:
      return null;
  }
}

/** Terreno punteado + todo lo fijo del predio. Memo: no se repinta al hacer zoom. */
export const Fondo = memo(function Fondo({
  elementos,
  limites,
}: {
  elementos: ElementoPlano[];
  limites: Rect;
}) {
  const extra = 4000;
  return (
    <g aria-hidden>
      <defs>
        <pattern id="mapa-puntos" width={22} height={22} patternUnits="userSpaceOnUse">
          <circle cx={1.4} cy={1.4} r={1.25} fill="oklch(0.855 0.012 258)" />
        </pattern>
        <pattern
          id="mapa-vidrio"
          width={11}
          height={11}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1={0} y1={0} x2={0} y2={11} stroke={VIDRIO_TRAMA} strokeWidth={1.3} />
        </pattern>
        <filter id="mapa-sombra" x="-4%" y="-12%" width="108%" height="130%">
          <feDropShadow dx={0} dy={4} stdDeviation={9} floodColor="rgb(28 36 78)" floodOpacity={0.07} />
        </filter>
      </defs>
      <rect
        x={limites.x - extra}
        y={limites.y - extra}
        width={limites.w + extra * 2}
        height={limites.h + extra * 2}
        fill="var(--background)"
      />
      <rect
        x={limites.x - extra}
        y={limites.y - extra}
        width={limites.w + extra * 2}
        height={limites.h + extra * 2}
        fill="url(#mapa-puntos)"
      />
      {elementos.map((el) => (
        <Elemento key={el.id} el={el} />
      ))}
    </g>
  );
});

// ---------- Bloques (puestos, bar, locales, contenedores) ----------

export type EstiloBloque = {
  estado: EstadoBloque;
  /** Se atenúa cuando hay una selección o un filtro que no lo incluye. */
  atenuado: boolean;
  /** Segunda línea (apodo, nombre o nota) cuando el zoom lo permite. */
  etiqueta: string | null;
};

/** Recorta un texto al ancho disponible (aprox. por cantidad de caracteres). */
function recortar(texto: string, ancho: number, tamano: number): string {
  const max = Math.max(3, Math.floor(ancho / (tamano * 0.56)));
  const limpio = texto.trim();
  return limpio.length <= max ? limpio : `${limpio.slice(0, max - 1).trimEnd()}…`;
}

const Cuerpo = memo(function Cuerpo({
  bloque,
  estilo,
  detalle,
  resaltado,
}: {
  bloque: Bloque;
  estilo: EstiloBloque;
  detalle: boolean;
  resaltado: boolean;
}) {
  const a = ASPECTO[estilo.estado];
  const { x, y, w, h } = bloque.rect;
  const grosor = a.grosor + (resaltado ? 1 : 0);
  const conEtiqueta = detalle && estilo.etiqueta !== null && h >= 36;

  if (bloque.tipo === "contenedor") {
    const e = bloque.espacios[0];
    return (
      <g style={{ opacity: estilo.atenuado ? 0.28 : 1, transition: "opacity 180ms ease" }}>
        <ellipse
          cx={x + w / 2}
          cy={y + h / 2}
          rx={w / 2}
          ry={h / 2}
          fill={a.fill}
          stroke={a.stroke}
          strokeOpacity={a.strokeOpacity}
          strokeWidth={grosor}
        />
        {/* Tapa del contenedor: un aro interior, como en el dibujo */}
        <ellipse
          cx={x + w / 2}
          cy={y + h / 2}
          rx={w / 2 - 5}
          ry={h / 2 - 5}
          fill="none"
          stroke={a.stroke}
          strokeOpacity={a.strokeOpacity * 0.35}
        />
        <text
          x={x + w / 2}
          y={y + h / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill={a.texto}
          className="tabular"
          style={{ ...SANS, fontWeight: 700, fontSize: 16 }}
        >
          {numeroVisible(e)}
        </text>
      </g>
    );
  }

  const etiquetaY = y + h * 0.74;
  return (
    <g style={{ opacity: estilo.atenuado ? 0.28 : 1, transition: "opacity 180ms ease" }}>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={6}
        fill={a.fill}
        stroke={a.stroke}
        strokeOpacity={a.strokeOpacity}
        strokeWidth={grosor}
      />
      {/* Divisiones entre los puestos de un mismo bloque */}
      {bloque.espacios.slice(1).map((e, i) => {
        const previo = bloque.espacios[i];
        const lx = (previo.x + previo.w + e.x) / 2;
        return (
          <line
            key={e.id}
            x1={lx}
            y1={y + 7}
            x2={lx}
            y2={y + h - 7}
            stroke={a.stroke}
            strokeOpacity={estilo.estado === "vencido" ? 0.55 : 0.32}
            strokeWidth={1}
          />
        );
      })}
      {bloque.espacios.map((e) => {
        const ecx = e.x + e.w / 2;
        if (e.tipo === "bar") {
          return (
            <text
              key={e.id}
              x={ecx}
              y={conEtiqueta ? y + h * 0.4 : y + h / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill={a.texto}
              style={{ ...DISPLAY, fontSize: 18 }}
            >
              {e.numero ?? "Bar"}
            </text>
          );
        }
        if (e.medio) {
          return (
            <g key={e.id}>
              <text
                x={ecx}
                y={y + h * 0.4}
                textAnchor="middle"
                dominantBaseline="central"
                fill={a.texto}
                className="tabular"
                style={{ ...SANS, fontWeight: 700, fontSize: 14 }}
              >
                {e.numero ?? "?"}
              </text>
              <text
                x={ecx}
                y={y + h * 0.7}
                textAnchor="middle"
                dominantBaseline="central"
                fill={a.texto}
                opacity={0.8}
                style={{ ...SANS, fontWeight: 600, fontSize: 12 }}
              >
                ½
              </text>
            </g>
          );
        }
        const tamano = e.tipo === "local" ? 19 : h < 45 ? 19 : 22;
        return (
          <text
            key={e.id}
            x={ecx}
            y={conEtiqueta ? y + h * 0.4 : y + h / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fill={a.texto}
            opacity={e.numero === null ? 0.7 : 1}
            className="tabular"
            style={{ ...SANS, fontWeight: 700, fontSize: tamano }}
          >
            {e.numero ?? "?"}
          </text>
        );
      })}
      {conEtiqueta && estilo.etiqueta && !bloque.espacios.every((e) => e.medio) ? (
        <text
          x={x + w / 2}
          y={etiquetaY}
          textAnchor="middle"
          dominantBaseline="central"
          fill={a.texto}
          opacity={0.88}
          style={{ ...SANS, fontWeight: 600, fontSize: 10.5 }}
        >
          {recortar(estilo.etiqueta, w - 6, 10.5)}
        </text>
      ) : null}
    </g>
  );
});

export type AccionesEspacio = {
  alTocar: (espacio: Espacio, bloque: Bloque) => void;
  alEntrar: (espacio: Espacio, bloque: Bloque, ev: React.PointerEvent) => void;
  alSalir: () => void;
  /** Foco con teclado: el plano se mueve para mostrar el espacio. */
  alEnfocar: (espacio: Espacio, ev: React.FocusEvent<SVGGElement>) => void;
  describir: (espacio: Espacio) => string;
};

/** Todos los bloques + una zona táctil por espacio (en un bloque de 4 puestos
 * se puede tocar cada uno por separado). */
export const CapaBloques = memo(function CapaBloques({
  bloques,
  estilos,
  detalle,
  resaltado,
  acciones,
}: {
  bloques: Bloque[];
  estilos: Map<string, EstiloBloque>;
  detalle: boolean;
  /** Clave del bloque bajo el puntero. */
  resaltado: string | null;
  acciones: AccionesEspacio;
}) {
  return (
    <g>
      {bloques.map((b) => {
        const estilo = estilos.get(b.clave);
        if (!estilo) return null;
        return (
          <g key={b.clave}>
            <Cuerpo bloque={b} estilo={estilo} detalle={detalle} resaltado={resaltado === b.clave} />
            {b.espacios.map((e) => (
              <g
                key={e.id}
                role="button"
                tabIndex={0}
                aria-label={acciones.describir(e)}
                className="mapa-foco cursor-pointer outline-none"
                onClick={() => acciones.alTocar(e, b)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    acciones.alTocar(e, b);
                  }
                }}
                onPointerEnter={(ev) => acciones.alEntrar(e, b, ev)}
                onPointerMove={(ev) => acciones.alEntrar(e, b, ev)}
                onPointerLeave={acciones.alSalir}
                onFocus={(ev) => acciones.alEnfocar(e, ev)}
                data-espacio={e.id}
              >
                {e.tipo === "contenedor" ? (
                  <ellipse
                    cx={e.x + e.w / 2}
                    cy={e.y + e.h / 2}
                    rx={e.w / 2 + 3}
                    ry={e.h / 2 + 3}
                    fill="transparent"
                  />
                ) : (
                  <rect x={e.x - 2} y={e.y - 2} width={e.w + 4} height={e.h + 4} fill="transparent" />
                )}
              </g>
            ))}
          </g>
        );
      })}
    </g>
  );
});

// ---------- Anillos de selección (siempre arriba de todo) ----------

export type Anillo = { rect: Rect; forma: "rect" | "elipse"; tono: "seleccion" | "pincel" | "aviso" };

const TONO_ANILLO: Record<Anillo["tono"], { color: string; dash?: string }> = {
  seleccion: { color: "var(--primary)" },
  pincel: { color: "var(--primary)" },
  aviso: { color: "var(--parcial)", dash: "5 4" },
};

export const Anillos = memo(function Anillos({ anillos }: { anillos: Anillo[] }) {
  return (
    <g pointerEvents="none">
      {anillos.map((a, i) => {
        const t = TONO_ANILLO[a.tono];
        const m = 4;
        return a.forma === "elipse" ? (
          <ellipse
            key={i}
            cx={a.rect.x + a.rect.w / 2}
            cy={a.rect.y + a.rect.h / 2}
            rx={a.rect.w / 2 + m}
            ry={a.rect.h / 2 + m}
            fill="none"
            stroke={t.color}
            strokeWidth={2.6}
            strokeDasharray={t.dash}
          />
        ) : (
          <rect
            key={i}
            x={a.rect.x - m}
            y={a.rect.y - m}
            width={a.rect.w + m * 2}
            height={a.rect.h + m * 2}
            rx={9}
            fill="none"
            stroke={t.color}
            strokeWidth={2.6}
            strokeDasharray={t.dash}
          />
        );
      })}
    </g>
  );
});

// ---------- Quinteros: fichas dentro de las zonas verdes ----------

export type FichaQuintero = {
  clienteId: string;
  texto: string;
  estado: EstadoBloque;
  rect: Rect;
  atenuado: boolean;
  seleccionado: boolean;
};

export const FichasQuinteros = memo(function FichasQuinteros({
  fichas,
  restos,
  alTocar,
  describir,
}: {
  fichas: FichaQuintero[];
  restos: Resto[];
  alTocar: (clienteId: string) => void;
  describir: (clienteId: string) => string;
}) {
  return (
    <g>
      {restos.map((r) => (
        <g key={`${r.rect.x}:${r.rect.y}`} aria-hidden>
          <rect
            x={r.rect.x}
            y={r.rect.y}
            width={r.rect.w}
            height={r.rect.h}
            rx={r.rect.h / 2}
            fill="var(--card)"
            stroke={ASPECTO.libre.stroke}
            strokeDasharray="3 3"
          />
          <text
            x={r.rect.x + r.rect.w / 2}
            y={r.rect.y + r.rect.h / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fill={ASPECTO.libre.texto}
            style={{ ...SANS, fontWeight: 700, fontSize: 10.5 }}
          >
            +{r.n}
          </text>
        </g>
      ))}
      {fichas.map((f) => {
        const a = ASPECTO[f.estado];
        const { x, y, w, h } = f.rect;
        return (
          <g
            key={f.clienteId}
            role="button"
            tabIndex={0}
            data-ficha={f.clienteId}
            aria-label={describir(f.clienteId)}
            className="mapa-foco cursor-pointer outline-none"
            style={{ opacity: f.atenuado ? 0.3 : 1, transition: "opacity 180ms ease" }}
            onClick={() => alTocar(f.clienteId)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                alTocar(f.clienteId);
              }
            }}
          >
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              rx={h / 2}
              fill={a.fill}
              stroke={f.seleccionado ? "var(--primary)" : a.stroke}
              strokeOpacity={f.seleccionado ? 1 : a.strokeOpacity}
              strokeWidth={f.seleccionado ? 2.4 : a.grosor}
            />
            <text
              x={x + w / 2}
              y={y + h / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill={a.texto}
              style={{ ...SANS, fontWeight: 600, fontSize: 10.5 }}
            >
              {f.texto}
            </text>
          </g>
        );
      })}
    </g>
  );
});

/** Reparte fichas de quinteros en filas dentro de una zona. */
export type Resto = { rect: Rect; n: number };

/** Reparte fichas de quinteros en filas dentro de una zona. Si no entran
 * todos, la última ficha pasa a ser "+N" (los demás se encuentran buscando). */
export function repartirFichas(
  zona: Rect,
  textos: { clienteId: string; texto: string }[]
): { fichas: { clienteId: string; texto: string; rect: Rect }[]; resto: Resto | null } {
  const alto = 22;
  const gap = 6;
  const pad = 12;
  const anchoResto = 46;
  const inicioY = zona.y + 36;
  const maxX = zona.x + zona.w - pad;
  const maxY = zona.y + zona.h - 8;
  const fichas: { clienteId: string; texto: string; rect: Rect }[] = [];
  let cx = zona.x + pad;
  let cy = inicioY;
  for (const t of textos) {
    const texto = recortar(t.texto, zona.w - pad * 2 - 20, 10.5);
    const w = Math.min(zona.w - pad * 2, Math.max(52, texto.length * 6.1 + 20));
    if (cx + w > maxX) {
      cx = zona.x + pad;
      cy += alto + gap;
    }
    if (cy + alto > maxY) break;
    fichas.push({ clienteId: t.clienteId, texto, rect: { x: cx, y: cy, w, h: alto } });
    cx += w + gap;
  }
  if (fichas.length === textos.length) return { fichas, resto: null };

  // No entraron todos: se hace lugar para la ficha "+N" al final.
  let n = textos.length - fichas.length;
  let x = cx;
  let y = cy + alto > maxY ? fichas[fichas.length - 1]?.rect.y ?? inicioY : cy;
  while (fichas.length > 0) {
    const ultima = fichas[fichas.length - 1];
    x = ultima.rect.x + ultima.rect.w + gap;
    y = ultima.rect.y;
    if (x + anchoResto <= maxX) break;
    fichas.pop();
    n++;
    x = ultima.rect.x;
    if (x + anchoResto <= maxX) break;
  }
  if (fichas.length === 0) {
    x = zona.x + pad;
    y = inicioY;
  }
  return { fichas, resto: { rect: { x, y, w: anchoResto, h: alto }, n } };
}
