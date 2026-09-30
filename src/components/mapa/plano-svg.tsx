"use client";

import { Fragment, memo, useMemo, type CSSProperties, type ReactNode } from "react";
import {
  ALT,
  alturaDe,
  radioTapa,
  REPOSO,
  type Alturas,
  type Bloque,
  type EstadoBloque,
  type Marca,
  type Material,
} from "./geometria";
import {
  A_NE,
  A_SO,
  arco,
  canto,
  caraEste,
  caraSur,
  circulo,
  elPath,
  envolvente,
  esq,
  f,
  hash,
  K,
  P,
  poly,
  pt,
  rrPath,
  SESGO_RAYAS,
  type Pt,
} from "./geometria-3d";
import type { ElementoPlano, Espacio, EstadoCobro, Rect } from "./tipos";

/* Piezas de dibujo del plano en relieve (SVG puro, sin estado). El orquestador
 * (`mapa-mercado.tsx`) decide estados, atenuados y marcas; el lienzo, la cámara,
 * el hover y el foco; acá solo se pinta. */

// ---------- Materiales (oklch precalculado: nada de color-mix en atributos) ----------

type Pintura = {
  tapa: [string, string];
  bisel: string;
  grosor: number;
  faldon: [string, string];
  faldonBorde: string;
  lado: string;
  /** Cara sur sin faldón (libre o atenuado). */
  frente: string;
  lote: string;
  texto: string;
  halo: string;
  /** Opacidad del canto iluminado. */
  canto: number;
  ranura: string;
  tambor: [string, string, string];
  disco: [string, string, string];
};

export const MAT: Record<Material, Pintura> = {
  al_dia: {
    tapa: ["oklch(0.972 0.028 148)", "oklch(0.946 0.046 148)"],
    bisel: "oklch(0.64 0.1 148)",
    grosor: 1.2,
    faldon: ["oklch(0.62 0.13 148)", "oklch(0.51 0.12 150)"],
    faldonBorde: "oklch(0.42 0.1 150)",
    lado: "oklch(0.45 0.1 150)",
    frente: "oklch(0.51 0.12 150)",
    lote: "oklch(0.64 0.1 148)",
    texto: "oklch(0.46 0.12 148)",
    halo: "oklch(0.96 0.036 148)",
    canto: 0.85,
    ranura: "oklch(0.58 0.1 148)",
    tambor: ["oklch(0.72 0.11 148)", "oklch(0.58 0.12 150)", "oklch(0.45 0.1 152)"],
    disco: ["oklch(0.985 0.02 148)", "oklch(0.957 0.04 148)", "oklch(0.93 0.055 148)"],
  },
  debe: {
    tapa: ["oklch(0.982 0.013 27)", "oklch(0.962 0.026 27)"],
    bisel: "oklch(0.6 0.17 27)",
    grosor: 1.5,
    faldon: ["oklch(0.99 0.006 27)", "oklch(0.95 0.018 27)"],
    faldonBorde: "oklch(0.5 0.16 27)",
    lado: "oklch(0.56 0.15 27)",
    frente: "oklch(0.95 0.018 27)",
    lote: "oklch(0.6 0.17 27)",
    texto: "oklch(0.52 0.19 27)",
    halo: "oklch(0.972 0.018 27)",
    canto: 0.85,
    ranura: "oklch(0.62 0.15 27)",
    tambor: ["oklch(0.99 0.006 27)", "oklch(0.95 0.016 27)", "oklch(0.86 0.035 27)"],
    disco: ["oklch(0.99 0.008 27)", "oklch(0.972 0.02 27)", "oklch(0.95 0.032 27)"],
  },
  vencido: {
    tapa: ["oklch(0.595 0.19 27)", "oklch(0.525 0.19 27)"],
    bisel: "oklch(0.42 0.15 27)",
    grosor: 1.2,
    faldon: ["oklch(0.46 0.155 27)", "oklch(0.385 0.13 27)"],
    faldonBorde: "oklch(0.3 0.1 27)",
    lado: "oklch(0.34 0.11 27)",
    frente: "oklch(0.385 0.13 27)",
    lote: "oklch(0.42 0.15 27)",
    texto: "#ffffff",
    halo: "oklch(0.55 0.19 27)",
    canto: 0.35,
    ranura: "oklch(0.42 0.14 27)",
    tambor: ["oklch(0.54 0.17 27)", "oklch(0.45 0.15 27)", "oklch(0.34 0.11 27)"],
    disco: ["oklch(0.63 0.19 27)", "oklch(0.56 0.19 27)", "oklch(0.5 0.185 27)"],
  },
  libre: {
    tapa: ["#ffffff", "oklch(0.978 0.004 258)"],
    bisel: "oklch(0.79 0.014 258)",
    grosor: 1,
    faldon: ["oklch(0.885 0.01 258)", "oklch(0.885 0.01 258)"],
    faldonBorde: "oklch(0.79 0.014 258)",
    lado: "oklch(0.8 0.013 260)",
    frente: "oklch(0.885 0.01 258)",
    lote: "oklch(0.74 0.018 258)",
    texto: "oklch(0.5 0.022 262)",
    halo: "#ffffff",
    canto: 1,
    ranura: "oklch(0.84 0.01 258)",
    tambor: ["oklch(0.965 0.004 258)", "oklch(0.9 0.008 258)", "oklch(0.8 0.013 260)"],
    disco: ["#ffffff", "oklch(0.985 0.003 258)", "oklch(0.965 0.005 258)"],
  },
  // Atenuado: "sin pintura".
  neutro: {
    tapa: ["oklch(0.972 0.004 258)", "oklch(0.958 0.005 258)"],
    bisel: "oklch(0.86 0.008 258)",
    grosor: 1,
    faldon: ["oklch(0.9 0.006 258)", "oklch(0.9 0.006 258)"],
    faldonBorde: "oklch(0.86 0.008 258)",
    lado: "oklch(0.845 0.008 258)",
    frente: "oklch(0.9 0.006 258)",
    lote: "oklch(0.84 0.01 258)",
    texto: "oklch(0.6 0.014 262)",
    halo: "oklch(0.965 0.004 258)",
    canto: 0.6,
    ranura: "oklch(0.89 0.006 258)",
    tambor: ["oklch(0.95 0.004 258)", "oklch(0.9 0.006 258)", "oklch(0.84 0.008 258)"],
    disco: ["oklch(0.975 0.003 258)", "oklch(0.965 0.004 258)", "oklch(0.952 0.005 258)"],
  },
  // Jefe de Portería (G11): el puesto se ve (con su número) pero no dice nada de quién lo
  // ocupa: cartón cálido, parejo para todos, lejos del verde/rojo del cobro y del gris del atenuado.
  anonimo: {
    tapa: ["oklch(0.962 0.009 78)", "oklch(0.938 0.013 74)"],
    bisel: "oklch(0.74 0.02 70)",
    grosor: 1.1,
    faldon: ["oklch(0.82 0.02 72)", "oklch(0.74 0.024 68)"],
    faldonBorde: "oklch(0.62 0.024 64)",
    lado: "oklch(0.68 0.022 66)",
    frente: "oklch(0.74 0.024 68)",
    lote: "oklch(0.74 0.02 70)",
    texto: "oklch(0.38 0.03 262)",
    halo: "oklch(0.962 0.009 78)",
    canto: 0.9,
    ranura: "oklch(0.8 0.016 70)",
    tambor: ["oklch(0.9 0.014 76)", "oklch(0.8 0.02 72)", "oklch(0.68 0.022 66)"],
    disco: ["oklch(0.975 0.007 78)", "oklch(0.955 0.01 76)", "oklch(0.935 0.013 74)"],
  },
  // Cliente sin estado de cobro: el azul de la marca, con la misma regla.
  ocupado: {
    tapa: ["oklch(0.955 0.02 262)", "oklch(0.93 0.03 262)"],
    bisel: "oklch(0.6 0.08 265)",
    grosor: 1.2,
    faldon: ["oklch(0.62 0.08 265)", "oklch(0.52 0.09 266)"],
    faldonBorde: "oklch(0.42 0.08 266)",
    lado: "oklch(0.48 0.08 266)",
    frente: "oklch(0.52 0.09 266)",
    lote: "oklch(0.6 0.08 265)",
    texto: "var(--accent-foreground)",
    halo: "oklch(0.95 0.02 262)",
    canto: 0.85,
    ranura: "oklch(0.6 0.07 265)",
    tambor: ["oklch(0.74 0.07 262)", "oklch(0.6 0.08 265)", "oklch(0.48 0.08 266)"],
    disco: ["oklch(0.975 0.012 262)", "oklch(0.955 0.02 262)", "oklch(0.93 0.03 262)"],
  },
};

const MATERIALES: Material[] = ["al_dia", "debe", "vencido", "libre", "neutro", "ocupado", "anonimo"];
/** Los que llevan faldón (los demás son lotes o están sin pintura). */
const CON_FALDON: Material[] = ["al_dia", "debe", "vencido", "ocupado", "anonimo"];
/** Banderín del puesto propio de la cooperativa (C3): se distingue por FORMA, no por color. */
const BANDERA = { mastil: "oklch(0.36 0.04 262)", pano: "var(--primary)" } as const;
/** Rayas del faldón de "debe" (el blanco lo pone el faldón de abajo). */
export const RAYAS_DEBE = "oklch(0.6 0.17 27)";
const TINTA_SOMBRA = "oklch(0.3 0.035 262)";
const TINTA_ROTULO = "oklch(0.5 0.02 262)";
const PUNTO_ESTADO: Record<EstadoCobro, string> = {
  al_dia: "oklch(0.8 0.15 148)",
  debe: "oklch(0.72 0.17 27)",
  vencido: "oklch(0.66 0.2 27)",
};

// ---------- Texto (siempre horizontal; el halo es un trazo debajo del relleno) ----------

type ClaseTexto = "num" | "apodo" | "rot" | "rot7";

const FUENTE: Record<ClaseTexto, CSSProperties> = {
  num: { fontFamily: "var(--font-sans)", fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  apodo: { fontFamily: "var(--font-sans)", fontWeight: 600 },
  rot: { fontFamily: "var(--font-display)", fontWeight: 800, letterSpacing: "0.01em" },
  rot7: { fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.01em" },
};

function Texto({
  x,
  y,
  t,
  clase = "num",
  tam,
  fill,
  halo,
  grosorHalo = 3,
  anchor = "middle",
  vertical = false,
  opacidad,
  espaciado,
}: {
  x: number;
  y: number;
  t: string;
  clase?: ClaseTexto;
  tam: number;
  fill: string;
  halo?: string;
  grosorHalo?: number;
  anchor?: "start" | "middle" | "end";
  vertical?: boolean;
  opacidad?: number;
  espaciado?: number;
}) {
  const fx = f(x);
  const fy = f(y);
  return (
    <text
      x={fx}
      y={fy}
      textAnchor={anchor}
      dominantBaseline="central"
      fill={fill}
      stroke={halo}
      strokeWidth={halo ? grosorHalo : undefined}
      strokeLinejoin={halo ? "round" : undefined}
      paintOrder={halo ? "stroke" : undefined}
      opacity={opacidad}
      transform={vertical ? `rotate(-90 ${fx} ${fy})` : undefined}
      style={
        espaciado === undefined
          ? { ...FUENTE[clase], fontSize: tam }
          : { ...FUENTE[clase], fontSize: tam, letterSpacing: espaciado }
      }
    >
      {t}
    </text>
  );
}

/** Recorta un texto al ancho disponible (aprox. por cantidad de caracteres). */
function recortar(texto: string, ancho: number, tamano: number): string {
  const max = Math.max(3, Math.floor(ancho / (tamano * 0.56)));
  const limpio = texto.trim();
  return limpio.length <= max ? limpio : `${limpio.slice(0, max - 1).trimEnd()}…`;
}

/** Ancho de cada letra del apodo (Inter 600), en em. Contar letras a 0,56 em recortaba
 * de más lo que tiene letras angostas ("Quiniela" quedaba "Quinie…" con lugar de sobra). */
const ANCHO_LETRA: Record<string, number> = {
  " ": 0.28, ".": 0.28, ",": 0.28, "·": 0.28, "'": 0.24, "’": 0.24, '"': 0.4, "“": 0.4, "”": 0.4,
  "-": 0.45, "(": 0.36, ")": 0.36, "/": 0.4, "&": 0.7,
  i: 0.25, j: 0.25, l: 0.25, f: 0.37, t: 0.37, r: 0.39, s: 0.52, c: 0.55, z: 0.53, a: 0.56, e: 0.57,
  k: 0.54, v: 0.55, x: 0.54, y: 0.55, m: 0.88, w: 0.8,
  I: 0.28, J: 0.52, L: 0.56, F: 0.58, E: 0.6, S: 0.63, T: 0.63, Z: 0.63, C: 0.72, D: 0.72, U: 0.73,
  G: 0.74, H: 0.74, N: 0.75, O: 0.77, Q: 0.77, M: 0.9, W: 0.98,
};

/** Ancho aproximado de un apodo a `tam` u (+5 %: el semibold y el halo). */
function anchoApodo(texto: string, tam: number): number {
  let em = 0;
  for (const ch of texto) {
    const base = ch.normalize("NFD")[0] ?? ch;
    em += ANCHO_LETRA[base] ?? (/\d/.test(base) ? 0.62 : base !== base.toLowerCase() ? 0.68 : 0.58);
  }
  return em * tam * 1.05;
}

/** Recorta con "…" al ancho: entre palabras si así queda casi todo el lugar usado
 * ("La Coope…"), si no, dentro de la palabra. */
function recortarApodo(texto: string, ancho: number, tam: number): string {
  if (anchoApodo(texto, tam) <= ancho) return texto;
  let letras = texto;
  while (letras.length > 1 && anchoApodo(`${letras}…`, tam) > ancho) letras = letras.slice(0, -1);
  const porLetras = `${letras.trimEnd()}…`;
  const palabras = texto.split(" ");
  for (let n = palabras.length - 1; n >= 1; n--) {
    const t = `${palabras.slice(0, n).join(" ")}…`;
    if (anchoApodo(t, tam) <= ancho) return anchoApodo(t, tam) >= ancho * 0.6 ? t : porLetras;
  }
  return porLetras;
}

type LineasApodo = { lineas: string[]; tam: number };

/**
 * Apodo en la tapa: en un renglón, achicándolo hasta `minimo` (así entra "Bar de Mary");
 * si no entra y hay alto (`dosLineas`), en dos renglones cortados entre palabras
 * ("La Coope / Hortícola"); recién si tampoco, recortado con "…". El nombre completo
 * está siempre en el cartel del mouse, en el globo y en la tarjeta.
 */
function apodoEnLineas(
  texto: string,
  ancho: number,
  { minimo = 9, dosLineas = false }: { minimo?: number; dosLineas?: boolean } = {}
): LineasApodo {
  const limpio = texto.trim().replace(/\s+/g, " ");
  for (let tam = 10.5; tam >= minimo; tam -= 0.5) {
    if (anchoApodo(limpio, tam) <= ancho) return { lineas: [limpio], tam };
  }
  const palabras = limpio.split(" ");
  if (!dosLineas || palabras.length < 2) return { lineas: [recortarApodo(limpio, ancho, minimo)], tam: minimo };
  const minimo2 = Math.min(minimo, 8.5);
  // El corte más parejo: el renglón más largo, lo más corto posible.
  let corte = 1;
  let largo = Number.POSITIVE_INFINITY;
  for (let i = 1; i < palabras.length; i++) {
    const m = Math.max(anchoApodo(palabras.slice(0, i).join(" "), 1), anchoApodo(palabras.slice(i).join(" "), 1));
    if (m < largo) {
      largo = m;
      corte = i;
    }
  }
  for (let tam = 9.5; tam >= minimo2; tam -= 0.5) {
    if (largo * tam <= ancho) return { lineas: [palabras.slice(0, corte).join(" "), palabras.slice(corte).join(" ")], tam };
  }
  // Ni en dos renglones: arriba las palabras que entren enteras; abajo, el resto recortado.
  let n = 0;
  while (n < palabras.length - 1 && anchoApodo(palabras.slice(0, n + 1).join(" "), minimo2) <= ancho) n++;
  if (n === 0) return { lineas: [recortarApodo(limpio, ancho, minimo2)], tam: minimo2 };
  return {
    lineas: [palabras.slice(0, n).join(" "), recortarApodo(palabras.slice(n).join(" "), ancho, minimo2)],
    tam: minimo2,
  };
}

/** Apodo en un solo renglón (tambores y fichas de quinteros). */
function apodoAjustado(texto: string, ancho: number, minimo = 9): { t: string; tam: number } {
  const a = apodoEnLineas(texto, ancho, { minimo });
  return { t: a.lineas[0], tam: a.tam };
}

/** Interlineado del apodo en dos renglones (en unidades de su tamaño). */
const INTERLINEA_APODO = 1.1;

// ---------- Defs compartidas (una sola vez, prefijo mapa-) ----------

function Lineal({
  id,
  stops,
  horizontal = false,
}: {
  id: string;
  stops: [number, string, number?][];
  horizontal?: boolean;
}) {
  return (
    <linearGradient id={id} x1={0} y1={0} x2={horizontal ? 1 : 0} y2={horizontal ? 0 : 1}>
      {stops.map(([o, c, op]) => (
        <stop key={o} offset={o} stopColor={c} stopOpacity={op} />
      ))}
    </linearGradient>
  );
}

/** Mercadería bajo el faldón: naranja, amarillo, verdura, berenjena y papa (sin rojos). */
const MERCADERIA = [
  "oklch(0.76 0.14 62)",
  "oklch(0.86 0.13 95)",
  "oklch(0.74 0.12 130)",
  "oklch(0.52 0.1 310)",
  "oklch(0.8 0.05 75)",
];

export const DefsPlano = memo(function DefsPlano() {
  return (
    <defs>
      {MATERIALES.map((k) => {
        const m = MAT[k];
        return (
          <Fragment key={k}>
            <Lineal id={`mapa-tapa-${k}`} stops={[[0, m.tapa[0]], [1, m.tapa[1]]]} />
            <Lineal
              id={`mapa-tambor-${k}`}
              horizontal
              stops={[[0, m.tambor[0]], [0.3, m.tambor[1]], [1, m.tambor[2]]]}
            />
            <radialGradient id={`mapa-disco-${k}`} cx={0.36} cy={0.3} r={0.8}>
              <stop offset={0} stopColor={m.disco[0]} />
              <stop offset={0.55} stopColor={m.disco[1]} />
              <stop offset={1} stopColor={m.disco[2]} />
            </radialGradient>
            {CON_FALDON.includes(k) ? (
              <Lineal id={`mapa-faldon-${k}`} stops={[[0, m.faldon[0]], [1, m.faldon[1]]]} />
            ) : null}
          </Fragment>
        );
      })}
      {/* "Debe": rayas que siguen la arista inclinada de la cara sur */}
      <pattern
        id="mapa-rayas-debe"
        width={8}
        height={8}
        patternUnits="userSpaceOnUse"
        patternTransform={`skewX(${f(SESGO_RAYAS)})`}
      >
        <rect width={4} height={8} fill={RAYAS_DEBE} />
      </pattern>
      <linearGradient
        id="mapa-mercaderia"
        gradientUnits="userSpaceOnUse"
        x1={0}
        y1={0}
        x2={35}
        y2={0}
        spreadMethod="repeat"
      >
        {MERCADERIA.flatMap((c, i) => [
          <stop key={`${i}a`} offset={i / 5} stopColor={c} />,
          <stop key={`${i}b`} offset={(i + 1) / 5} stopColor={c} />,
        ])}
      </linearGradient>
      <Lineal id="mapa-mostrador" stops={[[0, "oklch(0.78 0.06 66)"], [1, "oklch(0.63 0.065 56)"]]} />
      <Lineal id="mapa-hueco" stops={[[0, "oklch(0.3 0.04 50)"], [1, "oklch(0.42 0.05 55)"]]} />
      {/* Terreno */}
      <pattern id="mapa-puntos" width={22} height={22} patternUnits="userSpaceOnUse">
        <circle cx={1.4} cy={1.4} r={1.25} fill="oklch(0.87 0.01 258)" />
      </pattern>
      <radialGradient id="mapa-luz" cx={0.18} cy={0.02} r={1}>
        <stop offset={0} stopColor="#fff" stopOpacity={0.9} />
        <stop offset={0.5} stopColor="#fff" stopOpacity={0.25} />
        <stop offset={1} stopColor="#fff" stopOpacity={0} />
      </radialGradient>
      <Lineal id="mapa-canto-predio" stops={[[0, "oklch(0.9 0.01 82)"], [1, "oklch(0.8 0.016 75)"]]} />
      {/* Nave */}
      <Lineal id="mapa-piso" stops={[[0, "oklch(0.968 0.006 82)"], [1, "oklch(0.956 0.007 80)"]]} />
      <pattern id="mapa-juntas" width={48} height={48} patternUnits="userSpaceOnUse">
        <path d="M48 0H0V48" fill="none" stroke="oklch(0.935 0.008 80)" strokeWidth={0.9} />
      </pattern>
      <Lineal id="mapa-zocalo" stops={[[0, "oklch(0.86 0.014 78)"], [1, "oklch(0.76 0.018 72)"]]} />
      <Lineal id="mapa-muro" stops={[[0, "oklch(0.985 0.005 85)"], [1, "oklch(0.93 0.011 80)"]]} />
      <Lineal id="mapa-ventana" stops={[[0, "oklch(0.9 0.03 228)"], [1, "oklch(0.79 0.045 240)"]]} />
      <pattern id="mapa-adoquin" width={15} height={10} patternUnits="userSpaceOnUse">
        <rect width={15} height={10} fill="oklch(0.925 0.01 75)" />
        <path d="M0 10H15M0 5H15M7.5 0V5M0 5V10M15 5V10" stroke="oklch(0.885 0.012 70)" strokeWidth={0.9} />
      </pattern>
      {/* Cocheras */}
      <Lineal id="mapa-asfalto" stops={[[0, "oklch(0.83 0.009 258)"], [1, "oklch(0.865 0.008 258)"]]} />
      <Lineal id="mapa-hundido" stops={[[0, TINTA_SOMBRA, 0.16], [1, TINTA_SOMBRA, 0]]} />
      {/* Recintos */}
      <pattern id="mapa-ripio" width={12} height={12} patternUnits="userSpaceOnUse">
        <rect width={12} height={12} fill="oklch(0.95 0.006 80)" />
        <circle cx={3} cy={3} r={1.1} fill="oklch(0.86 0.01 75)" />
        <circle cx={9} cy={8.5} r={1.2} fill="oklch(0.88 0.01 70)" />
        <circle cx={8} cy={2} r={0.8} fill="oklch(0.84 0.012 70)" />
      </pattern>
      <pattern id="mapa-malla" width={6} height={6} patternUnits="userSpaceOnUse">
        <path d="M0 0L6 6M6 0L0 6" stroke="oklch(0.55 0.015 262)" strokeWidth={0.55} />
      </pattern>
      {/* Canteros de quinteros: tierra, no el verde de los estados */}
      <Lineal id="mapa-tierra" stops={[[0, "oklch(0.925 0.03 80)"], [1, "oklch(0.9 0.037 74)"]]} />
      <pattern id="mapa-surcos" width={14} height={12} patternUnits="userSpaceOnUse">
        <rect y={7.5} width={14} height={3.2} rx={1.6} fill="oklch(0.83 0.045 70)" />
        <rect y={6.6} width={14} height={1} fill="oklch(0.95 0.02 82)" />
      </pattern>
      <pattern id="mapa-brotes" width={14} height={12} patternUnits="userSpaceOnUse">
        <circle cx={4} cy={6.4} r={2.3} fill="oklch(0.74 0.075 128)" />
        <circle cx={11} cy={6.4} r={2.1} fill="oklch(0.7 0.07 132)" />
      </pattern>
      <Lineal id="mapa-madera" stops={[[0, "oklch(0.72 0.06 62)"], [1, "oklch(0.6 0.06 55)"]]} />
      {/* Invernaderos */}
      <Lineal
        id="mapa-vidrio"
        horizontal
        stops={[
          [0, "#ffffff", 0.78],
          [0.3, "oklch(0.95 0.03 185)", 0.5],
          [0.46, "#ffffff", 0.86],
          [0.64, "oklch(0.92 0.04 185)", 0.46],
          [1, "oklch(0.8 0.05 195)", 0.62],
        ]}
      />
      <pattern id="mapa-plantas" width={21.5} height={13} patternUnits="userSpaceOnUse">
        <ellipse cx={10.75} cy={6.5} rx={6.2} ry={4.2} fill="oklch(0.72 0.08 130)" />
        <ellipse cx={9.4} cy={5.3} rx={2.6} ry={1.7} fill="oklch(0.84 0.07 125)" />
      </pattern>
      {/* Administración: la marca solo en la puerta y el isotipo */}
      <Lineal id="mapa-admin-frente" stops={[[0, "oklch(0.95 0.02 262)"], [1, "oklch(0.9 0.03 262)"]]} />
      {/* Árboles: salvia apagado, lejos del verde de "al día" */}
      <radialGradient id="mapa-copa" cx={0.34} cy={0.28} r={0.78}>
        <stop offset={0} stopColor="oklch(0.88 0.05 118)" />
        <stop offset={0.55} stopColor="oklch(0.78 0.06 124)" />
        <stop offset={1} stopColor="oklch(0.67 0.06 130)" />
      </radialGradient>
      {/* El único filtro del plano: las sombras de lo fijo */}
      <filter id="mapa-desenfoque" x="-2%" y="-2%" width="104%" height="104%">
        <feGaussianBlur stdDeviation={4.5} />
      </filter>
      {/* Plano girado (pantalla vertical): las texturas que tienen dirección, a 90° */}
      <pattern id="mapa-adoquin-girado" width={15} height={10} patternUnits="userSpaceOnUse" patternTransform="rotate(90)">
        <rect width={15} height={10} fill="oklch(0.925 0.01 75)" />
        <path d="M0 10H15M0 5H15M7.5 0V5M0 5V10M15 5V10" stroke="oklch(0.885 0.012 70)" strokeWidth={0.9} />
      </pattern>
      <Lineal id="mapa-hundido-oeste" horizontal stops={[[0, TINTA_SOMBRA, 0.16], [1, TINTA_SOMBRA, 0]]} />
      <pattern id="mapa-surcos-girado" width={14} height={12} patternUnits="userSpaceOnUse" patternTransform="rotate(90)">
        <rect y={7.5} width={14} height={3.2} rx={1.6} fill="oklch(0.83 0.045 70)" />
        <rect y={6.6} width={14} height={1} fill="oklch(0.95 0.02 82)" />
      </pattern>
      <pattern id="mapa-brotes-girado" width={14} height={12} patternUnits="userSpaceOnUse" patternTransform="rotate(90)">
        <circle cx={4} cy={6.4} r={2.3} fill="oklch(0.74 0.075 128)" />
        <circle cx={11} cy={6.4} r={2.1} fill="oklch(0.7 0.07 132)" />
      </pattern>
      {/* Bóveda acostada: el brillo sigue la cresta (a un cuarto del alto de la silueta) */}
      <Lineal
        id="mapa-vidrio-acostado"
        stops={[
          [0, "#ffffff", 0.78],
          [0.12, "oklch(0.95 0.03 185)", 0.5],
          [0.24, "#ffffff", 0.86],
          [0.46, "oklch(0.92 0.04 185)", 0.46],
          [1, "oklch(0.8 0.05 195)", 0.62],
        ]}
      />
      <pattern id="mapa-plantas-girado" width={21.5} height={13} patternUnits="userSpaceOnUse" patternTransform="rotate(90)">
        <ellipse cx={10.75} cy={6.5} rx={6.2} ry={4.2} fill="oklch(0.72 0.08 130)" />
        <ellipse cx={9.4} cy={5.3} rx={2.6} ry={1.7} fill="oklch(0.84 0.07 125)" />
      </pattern>
    </defs>
  );
});

// ---------- Fondo: placa del predio + todo lo fijo ----------

/** Árbol sembrado en el espacio libre (pie del tronco y radio de la copa). */
export type Arbol = { x: number; y: number; r: number };

/** Pieza con volumen del fondo: se pinta por su base sur (z) y de oeste a este. */
type Objeto = { z: number; x: number; k: string; n: ReactNode };
type Capas = { suelos: ReactNode[]; sombras: ReactNode[]; objetos: Objeto[]; rotulos: ReactNode[] };

function placa(lim: Rect): ReactNode {
  // El predio como maqueta: una placa apenas cálida, con canto (sur y este) y sombra suave.
  const bx = lim.x + 4;
  const by = lim.y + 4;
  const bw = lim.w - 8;
  const bh = lim.h - 8;
  const r = 22;
  return (
    <>
      <rect x={bx + 3} y={by + 6} width={bw + 5} height={bh + 12} rx={r + 4} fill={TINTA_SOMBRA} fillOpacity={0.05} />
      <rect x={bx + 7} y={by + 12} width={bw + 9} height={bh + 18} rx={r + 8} fill={TINTA_SOMBRA} fillOpacity={0.04} />
      <path d={caraSur(bx, by, bw, bh, r, 0, -9)} fill="url(#mapa-canto-predio)" />
      <path d={caraEste(bx, by, bw, bh, r, 0, -9)} fill="oklch(0.84 0.012 80)" />
      <rect x={bx} y={by} width={bw} height={bh} rx={r} fill="oklch(0.972 0.005 88)" />
      <rect x={bx} y={by} width={bw} height={bh} rx={r} fill="url(#mapa-puntos)" />
      <rect x={bx} y={by} width={bw} height={bh} rx={r} fill="url(#mapa-luz)" />
      <rect
        x={f(bx + 0.6)}
        y={f(by + 0.6)}
        width={f(bw - 1.2)}
        height={f(bh - 1.2)}
        rx={r}
        fill="none"
        stroke="#fff"
        strokeWidth={1.4}
      />
    </>
  );
}

function cocheras(el: ElementoPlano, norte: boolean, c: Capas) {
  const { x, y, w, h } = el;
  const n = Math.max(0, el.capacidad ?? 0);
  const horizontal = w >= h;
  let lineas = "";
  for (let i = 1; i < n; i++) {
    lineas += horizontal
      ? `M${f(x + (w * i) / n)} ${y + 7}V${y + h - 7}`
      : `M${x + 7} ${f(y + (h * i) / n)}H${x + w - 7}`;
  }
  // Tachas azules sobre el borde que mira a la nave (la marca, sutil).
  const yl = norte ? y + h - 4.5 : y + 4.5;
  const tachas = `M${x + 12} ${yl}H${x + w - 12}`;
  c.suelos.push(
    <Fragment key={el.id}>
      <rect x={x} y={y} width={w} height={h} rx={6} fill="url(#mapa-asfalto)" />
      <rect x={x + 3} y={y} width={w - 6} height={7} rx={3} fill="url(#mapa-hundido)" />
      {lineas ? <path d={lineas} stroke="#fff" strokeWidth={1.8} strokeLinecap="round" /> : null}
      {horizontal && n > 0 ? (
        <>
          <path d={tachas} stroke="var(--primary)" strokeOpacity={0.1} strokeWidth={5} strokeLinecap="round" />
          <path
            d={tachas}
            stroke="oklch(0.6 0.15 262)"
            strokeWidth={3}
            strokeDasharray={`0.1 ${f(w / n)}`}
            strokeDashoffset={f(-(w / n) / 2 + 12)}
            strokeLinecap="round"
          />
        </>
      ) : null}
    </Fragment>
  );
  if (horizontal) {
    // Cordones norte y sur: bordes elevados 3 u.
    for (const [lado, cy] of [
      ["n", y - 4],
      ["s", y + h],
    ] as const) {
      const yb = cy + 4;
      c.objetos.push({
        z: yb,
        x,
        k: `${el.id}:${lado}`,
        n: (
          <>
            <path
              d={poly([P(x, yb, 0), P(x + w, yb, 0), P(x + w, yb, ALT.cordon), P(x, yb, ALT.cordon)])}
              fill="oklch(0.83 0.008 80)"
            />
            <rect
              x={f(x - K * ALT.cordon)}
              y={cy - ALT.cordon}
              width={w}
              height={4}
              rx={1.5}
              fill="oklch(0.955 0.005 85)"
            />
          </>
        ),
      });
    }
  }
  // El cartel va afuera, contra la punta oeste y del lado opuesto a la nave: adentro
  // están las cocheras, que se asignan una por una (0032).
  c.rotulos.push(
    <Texto
      key={el.id}
      x={x + 6}
      y={norte ? y - 14 : y + h + 15}
      t={el.etiqueta ?? `${n} cocheras`}
      clase="rot7"
      tam={14}
      fill={TINTA_ROTULO}
      halo="var(--background)"
      grosorHalo={4}
      anchor="start"
    />
  );
}

/** Cocheras en una franja parada (plano girado): demarcación a lo ancho, cordones al
 * oeste y al este, tachas del lado que mira a la nave y el cartel parado. */
function cocherasParadas(el: ElementoPlano, naveAlEste: boolean, c: Capas) {
  const { x, y, w, h } = el;
  const n = Math.max(0, el.capacidad ?? 0);
  let lineas = "";
  for (let i = 1; i < n; i++) lineas += `M${x + 7} ${f(y + (h * i) / n)}H${x + w - 7}`;
  const xl = naveAlEste ? x + w - 4.5 : x + 4.5;
  const tachas = `M${xl} ${y + 12}V${y + h - 12}`;
  c.suelos.push(
    <Fragment key={el.id}>
      <rect x={x} y={y} width={w} height={h} rx={6} fill="url(#mapa-asfalto)" />
      {/* La sombra del cordón oeste (la luz viene del noroeste) */}
      <rect x={x} y={y + 3} width={7} height={h - 6} rx={3} fill="url(#mapa-hundido-oeste)" />
      {lineas ? <path d={lineas} stroke="#fff" strokeWidth={1.8} strokeLinecap="round" /> : null}
      {n > 0 ? (
        <>
          <path d={tachas} stroke="var(--primary)" strokeOpacity={0.1} strokeWidth={5} strokeLinecap="round" />
          <path
            d={tachas}
            stroke="oklch(0.6 0.15 262)"
            strokeWidth={3}
            strokeDasharray={`0.1 ${f(h / n)}`}
            strokeDashoffset={f(-(h / n) / 2 + 12)}
            strokeLinecap="round"
          />
        </>
      ) : null}
    </Fragment>
  );
  // Cordones oeste y este: bordes elevados 3 u (tapa, cara este y cabeza sur).
  for (const [lado, cx] of [
    ["o", x - 4],
    ["e", x + w],
  ] as const) {
    const xb = cx + 4;
    c.objetos.push({
      z: y + h,
      x: cx,
      k: `${el.id}:${lado}`,
      n: (
        <>
          <path
            d={
              poly([P(xb, y, 0), P(xb, y + h, 0), P(xb, y + h, ALT.cordon), P(xb, y, ALT.cordon)]) +
              poly([P(cx, y + h, 0), P(xb, y + h, 0), P(xb, y + h, ALT.cordon), P(cx, y + h, ALT.cordon)])
            }
            fill="oklch(0.83 0.008 80)"
          />
          <rect
            x={f(cx - K * ALT.cordon)}
            y={y - ALT.cordon}
            width={4}
            height={h}
            rx={1.5}
            fill="oklch(0.955 0.005 85)"
          />
        </>
      ),
    });
  }
  // El cartel, parado y afuera de la franja (se lee de abajo hacia arriba, como
  // "Pasillo" en el plano horizontal), del lado opuesto a la nave y contra la punta norte.
  c.rotulos.push(
    <Texto
      key={el.id}
      x={naveAlEste ? x - 15 : x + w + 15}
      y={y + 6}
      t={el.etiqueta ?? `${n} cocheras`}
      clase="rot7"
      tam={14}
      fill={TINTA_ROTULO}
      halo="var(--background)"
      grosorHalo={4}
      anchor="end"
      vertical
    />
  );
}

/** Tramo de cerco de malla (10 u) con postes, baranda y brillo. */
function tramoCerco(x0: number, y0: number, x1: number, y1: number): ReactNode {
  const z = ALT.cerco;
  const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 22));
  let postes = "";
  for (let i = 0; i <= n; i++) {
    const px = x0 + ((x1 - x0) * i) / n;
    const py = y0 + ((y1 - y0) * i) / n;
    postes += `M${pt(P(px, py, 0))}L${pt(P(px, py, z + 1))}`;
  }
  return (
    <>
      <path d={poly([P(x0, y0, 0), P(x1, y1, 0), P(x1, y1, z), P(x0, y0, z)])} fill="url(#mapa-malla)" fillOpacity={0.8} />
      <path d={postes} stroke="oklch(0.52 0.016 262)" strokeWidth={1.4} strokeLinecap="round" />
      <path
        d={`M${pt(P(x0, y0, z))}L${pt(P(x1, y1, z))}`}
        stroke="oklch(0.56 0.016 262)"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <path d={`M${pt(P(x0, y0, z + 0.8))}L${pt(P(x1, y1, z + 0.8))}`} stroke="#fff" strokeOpacity={0.8} strokeWidth={0.6} />
    </>
  );
}

function recinto(el: ElementoPlano, c: Capas) {
  const { x, y, w, h } = el;
  c.suelos.push(<rect key={el.id} x={x} y={y} width={w} height={h} rx={5} fill="url(#mapa-ripio)" />);
  c.objetos.push({
    z: y,
    x,
    k: `${el.id}:no`,
    n: (
      <>
        {tramoCerco(x, y, x + w, y)}
        {tramoCerco(x, y, x, y + h)}
      </>
    ),
  });
  c.objetos.push({ z: y + h, x: x + w, k: `${el.id}:e`, n: tramoCerco(x + w, y, x + w, y + h) });
  // Sur, con portón.
  c.objetos.push({
    z: y + h,
    x,
    k: `${el.id}:s`,
    n: (
      <>
        {tramoCerco(x, y + h, x + w * 0.4, y + h)}
        {tramoCerco(x + w * 0.62, y + h, x + w, y + h)}
      </>
    ),
  });
  if (el.etiqueta) {
    c.rotulos.push(
      <Texto
        key={el.id}
        x={x - K * ALT.cerco + 2}
        y={y - ALT.cerco - 12}
        t={el.etiqueta}
        clase="rot7"
        tam={15}
        fill={TINTA_ROTULO}
        halo="var(--background)"
        grosorHalo={4}
        anchor="start"
      />
    );
  }
}

/** Dónde corta el pasillo a la nave (x de sus bordes), si la cruza de norte a sur. */
function cortePasillo(nave: ElementoPlano, pasillo: ElementoPlano | null): [number, number] | null {
  if (!pasillo) return null;
  const cruza =
    pasillo.h >= pasillo.w &&
    pasillo.x > nave.x &&
    pasillo.x + pasillo.w < nave.x + nave.w &&
    pasillo.y < nave.y + nave.h &&
    pasillo.y + pasillo.h > nave.y;
  return cruza ? [pasillo.x, pasillo.x + pasillo.w] : null;
}

/** Dónde corta un pasillo acostado (plano girado) a la nave (y de sus bordes), si
 * la cruza de oeste a este: parte los muros bajos y el zócalo del este. */
function cortePasilloAcostado(nave: ElementoPlano, pasillo: ElementoPlano): [number, number] | null {
  const cruza =
    pasillo.w > pasillo.h &&
    pasillo.y > nave.y &&
    pasillo.y + pasillo.h < nave.y + nave.h &&
    pasillo.x < nave.x + nave.w &&
    pasillo.x + pasillo.w > nave.x;
  return cruza ? [pasillo.y, pasillo.y + pasillo.h] : null;
}

const SOMBRA_NAVE: [number, number, number, number, number][] = [
  [3, 9, 4, 4, 0.06],
  [6, 13, 9, 8, 0.05],
  [10, 17, 15, 13, 0.04],
];

/** La nave es una plataforma: sombra (sin filtro), zócalo partido por el pasillo y piso.
 * `corte`: pasillo de norte a sur (parte la cara sur); `corteAcostado`: pasillo de
 * oeste a este, en el plano girado (parte la cara este). */
function nave(
  el: ElementoPlano,
  corte: [number, number] | null,
  c: Capas,
  corteAcostado: [number, number] | null = null
) {
  const { x, y, w, h } = el;
  const zc = -ALT.zocalo;
  const r = 6;
  const so: Pt = [x + r, y + h - r];
  const se: Pt = [x + w - r, y + h - r];
  const ne: Pt = [x + w - r, y + r];
  const este = corteAcostado ? (
    // Tramo norte (esquina NE redondeada) y tramo sur (esquina SE), con el pasillo en medio.
    <path
      d={
        `M${pt(P(x + w, corteAcostado[0], 0))}L${pt(esq(ne, r, 0, 0))}${arco(r, esq(ne, r, A_NE, 0), 0)}` +
        `L${pt(esq(ne, r, A_NE, zc))}${arco(r, esq(ne, r, 0, zc), 1)}L${pt(P(x + w, corteAcostado[0], zc))}Z` +
        `M${pt(esq(se, r, 45, 0))}${arco(r, esq(se, r, 0, 0), 0)}L${pt(P(x + w, corteAcostado[1], 0))}` +
        `L${pt(P(x + w, corteAcostado[1], zc))}L${pt(esq(se, r, 0, zc))}${arco(r, esq(se, r, 45, zc), 1)}Z`
      }
      fill="oklch(0.74 0.018 72)"
    />
  ) : (
    <path d={caraEste(x, y, w, h, r, 0, zc)} fill="oklch(0.74 0.018 72)" />
  );
  const zocalo = corte ? (
    <>
      {/* Tramo oeste (esquina SO redondeada), corte que mira al pasillo y tramo este */}
      <path
        d={
          `M${pt(esq(so, r, A_SO, 0))}${arco(r, esq(so, r, 90, 0), 0)}` +
          `L${pt(P(corte[0], y + h, 0))}L${pt(P(corte[0], y + h, zc))}` +
          `L${pt(esq(so, r, 90, zc))}${arco(r, esq(so, r, A_SO, zc), 1)}Z`
        }
        fill="url(#mapa-zocalo)"
      />
      <path
        d={poly([P(corte[0], y, 0), P(corte[0], y + h, 0), P(corte[0], y + h, zc), P(corte[0], y, zc)])}
        fill="oklch(0.74 0.018 72)"
      />
      <path
        d={
          `M${pt(P(corte[1], y + h, 0))}L${pt(esq(se, r, 90, 0))}${arco(r, esq(se, r, 45, 0), 0)}` +
          `L${pt(esq(se, r, 45, zc))}${arco(r, esq(se, r, 90, zc), 1)}L${pt(P(corte[1], y + h, zc))}Z`
        }
        fill="url(#mapa-zocalo)"
      />
    </>
  ) : (
    <path d={caraSur(x, y, w, h, r, 0, zc)} fill="url(#mapa-zocalo)" />
  );
  c.suelos.push(
    <Fragment key={el.id}>
      {SOMBRA_NAVE.map(([dx, dy, ew, eh, o]) => (
        <rect
          key={dx}
          x={x + dx}
          y={y + dy}
          width={w + ew}
          height={h + eh}
          rx={12 + dx}
          fill={TINTA_SOMBRA}
          fillOpacity={o}
        />
      ))}
      {zocalo}
      {este}
      <rect x={x} y={y} width={w} height={h} rx={r} fill="url(#mapa-piso)" />
      <rect x={x} y={y} width={w} height={h} rx={r} fill="url(#mapa-juntas)" />
      <path d={`M${x + r} ${f(y + h - 0.7)}H${x + w - r}`} stroke="#fff" strokeOpacity={0.9} strokeWidth={1.2} />
    </Fragment>
  );
}

function pasillo(el: ElementoPlano, nave: ElementoPlano | null, c: Capas) {
  const { x, w } = el;
  const y0 = el.y;
  const y1 = el.y + el.h;
  const cx = x + w / 2;
  const guia = `M${cx} ${y0 + 10}V${y1 - 10}`;
  c.suelos.push(
    <Fragment key={el.id}>
      <rect x={x} y={y0} width={w} height={y1 - y0} fill="url(#mapa-adoquin)" />
      <path d={`M${x + 1} ${y0}V${y1}M${x + w - 1} ${y0}V${y1}`} stroke="oklch(0.84 0.012 70)" strokeWidth={2} />
      <path d={`M${f(x + 2.6)} ${y0}V${y1}`} stroke="#fff" strokeOpacity={0.7} strokeWidth={1} />
      {/* Guía central: el azul de la marca, sutil */}
      <path d={guia} stroke="var(--primary)" strokeOpacity={0.1} strokeWidth={7} strokeLinecap="round" />
      <path
        d={guia}
        stroke="oklch(0.6 0.13 262)"
        strokeOpacity={0.8}
        strokeWidth={1.7}
        strokeDasharray="9 9"
        strokeLinecap="round"
      />
    </Fragment>
  );
  c.rotulos.push(
    <Texto
      key={el.id}
      x={cx}
      y={nave ? nave.y + nave.h / 2 + 4 : el.y + el.h / 2}
      t={el.etiqueta ?? "Pasillo"}
      clase="rot"
      tam={15}
      fill={TINTA_ROTULO}
      halo="oklch(0.925 0.01 75)"
      grosorHalo={4.5}
      vertical
    />
  );
}

/** Pasillo acostado (plano girado): el mismo solado, bordes y guía a lo largo de x. */
function pasilloAcostado(el: ElementoPlano, nave: ElementoPlano | null, c: Capas) {
  const { y, h } = el;
  const x0 = el.x;
  const x1 = el.x + el.w;
  const cy = y + h / 2;
  const guia = `M${x0 + 10} ${cy}H${x1 - 10}`;
  c.suelos.push(
    <Fragment key={el.id}>
      <rect x={x0} y={y} width={x1 - x0} height={h} fill="url(#mapa-adoquin-girado)" />
      <path d={`M${x0} ${y + 1}H${x1}M${x0} ${y + h - 1}H${x1}`} stroke="oklch(0.84 0.012 70)" strokeWidth={2} />
      <path d={`M${x0} ${f(y + 2.6)}H${x1}`} stroke="#fff" strokeOpacity={0.7} strokeWidth={1} />
      <path d={guia} stroke="var(--primary)" strokeOpacity={0.1} strokeWidth={7} strokeLinecap="round" />
      <path
        d={guia}
        stroke="oklch(0.6 0.13 262)"
        strokeOpacity={0.8}
        strokeWidth={1.7}
        strokeDasharray="9 9"
        strokeLinecap="round"
      />
    </Fragment>
  );
  c.rotulos.push(
    <Texto
      key={el.id}
      x={nave ? nave.x + nave.w / 2 : el.x + el.w / 2}
      y={cy}
      t={el.etiqueta ?? "Pasillo"}
      clase="rot"
      tam={15}
      fill={TINTA_ROTULO}
      halo="oklch(0.925 0.01 75)"
      grosorHalo={4.5}
    />
  );
}

/** Nave en corte: muro norte alto con ventanas, pilastras y cabriadas cortadas;
 * muros este y oeste bajos y antepecho sur (abiertos en el pasillo). */
function muros(
  el: ElementoPlano,
  corte: [number, number] | null,
  c: Capas,
  corteAcostado: [number, number] | null = null
) {
  const { x, y, w, h } = el;
  const t = 7;
  const tb = 5;
  const zN = ALT.muroNorte;
  const zB = ALT.muroBajo;
  const zA = ALT.antepecho;
  c.sombras.push(
    <path
      key={`${el.id}:muro`}
      d={poly([
        [x + t, y + t],
        [x + w, y + t],
        [x + w + 8, y + t + 14],
        [x + t + 8, y + t + 14],
      ])}
      fill={TINTA_SOMBRA}
      fillOpacity={0.16}
    />
  );
  const tramos: [number, number][] = corte ? [[x, corte[0]], [corte[1], x + w]] : [[x, x + w]];
  const norte = tramos.map(([a, b]) => {
    const bahias: number[] = [];
    for (let p = a + 10; p < b - 10; p += 94) bahias.push(p);
    let pil = "";
    let ven = "";
    let luz = "";
    let cab = "";
    for (const p of bahias) pil += poly([P(p, y + t, 0), P(p + 7, y + t, 0), P(p + 7, y + t, zN), P(p, y + t, zN)]);
    for (const p of bahias) {
      for (const u of [15, 53]) {
        const u0 = p + u;
        const u1 = Math.min(p + u + 32, b - 8);
        if (u1 - u0 < 12) continue;
        ven += poly([P(u0, y + t, 15), P(u1, y + t, 15), P(u1, y + t, 25), P(u0, y + t, 25)]);
        luz += `M${pt(P(u0, y + t, 24.6))}L${pt(P(u1, y + t, 24.6))}`;
      }
    }
    for (const p of bahias) {
      // Cabriada cortada: cordón superior, pendolón y dos diagonales.
      const cc = p + 3.5;
      if (cc - 34 < a || cc + 34 > b) continue;
      const ym = y + t / 2;
      const cu = P(cc, ym, zN + ALT.cabriada);
      const pie = P(cc, ym, zN);
      cab +=
        `M${pt(P(cc - 34, ym, zN))}L${pt(cu)}L${pt(P(cc + 34, ym, zN))}M${pt(cu)}L${pt(pie)}` +
        `M${pt(P(cc - 17, ym, zN + 6))}L${pt(pie)}L${pt(P(cc + 17, ym, zN + 6))}`;
    }
    return (
      <Fragment key={a}>
        <path d={poly([P(a, y + t, 0), P(b, y + t, 0), P(b, y + t, zN), P(a, y + t, zN)])} fill="url(#mapa-muro)" />
        {pil ? <path d={pil} fill="oklch(0.925 0.01 80)" stroke="oklch(0.88 0.012 78)" strokeWidth={0.6} /> : null}
        {ven ? <path d={ven} fill="url(#mapa-ventana)" stroke="oklch(0.74 0.02 250)" strokeWidth={0.7} /> : null}
        {luz ? <path d={luz} stroke="#fff" strokeOpacity={0.85} strokeWidth={0.9} /> : null}
        {cab ? (
          <path
            d={cab}
            fill="none"
            stroke="oklch(0.72 0.018 262)"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {/* Corte (poché) en gris medio y cabeza este del tramo */}
        <path d={poly([P(a, y, zN), P(b, y, zN), P(b, y + t, zN), P(a, y + t, zN)])} fill="oklch(0.76 0.016 262)" />
        <path d={poly([P(b, y, 0), P(b, y + t, 0), P(b, y + t, zN), P(b, y, zN)])} fill="oklch(0.86 0.012 80)" />
      </Fragment>
    );
  });
  c.objetos.push({ z: y + t, x, k: `${el.id}:muro-n`, n: norte });
  // Cara que se ve, cabeza sur y tapa (en corte), de y0 a y1.
  const bajo = (mx: number, cara: string, y0 = y + t, y1 = y + h) => {
    const x1 = mx + tb;
    return (
      <>
        <path d={poly([P(x1, y0, 0), P(x1, y1, 0), P(x1, y1, zB), P(x1, y0, zB)])} fill={cara} />
        <path d={poly([P(mx, y1, 0), P(x1, y1, 0), P(x1, y1, zB), P(mx, y1, zB)])} fill="oklch(0.91 0.01 80)" />
        <path
          d={poly([P(mx, y0, zB), P(x1, y0, zB), P(x1, y1, zB), P(mx, y1, zB)])}
          fill="oklch(0.83 0.012 262)"
        />
      </>
    );
  };
  if (corteAcostado) {
    // Plano girado: el pasillo cruza de oeste a este y abre los dos muros bajos.
    const tramos: [number, number][] = [
      [y + t, corteAcostado[0]],
      [corteAcostado[1], y + h],
    ];
    tramos.forEach(([y0, y1], i) => {
      c.objetos.push({ z: y1, x, k: `${el.id}:muro-o${i}`, n: bajo(x, "oklch(0.95 0.007 82)", y0, y1) });
      c.objetos.push({
        z: y1,
        x: x + w - tb,
        k: `${el.id}:muro-e${i}`,
        n: bajo(x + w - tb, "oklch(0.88 0.012 80)", y0, y1),
      });
    });
  } else {
    c.objetos.push({ z: y + h, x, k: `${el.id}:muro-o`, n: bajo(x, "oklch(0.95 0.007 82)") });
    c.objetos.push({ z: y + h, x: x + w - tb, k: `${el.id}:muro-e`, n: bajo(x + w - tb, "oklch(0.88 0.012 80)") });
  }
  const huecos: [number, number][] = corte ? [[x + tb, corte[0]], [corte[1], x + w - tb]] : [[x + tb, x + w - tb]];
  c.objetos.push({
    z: y + h,
    x: x + t,
    k: `${el.id}:antepecho`,
    n: huecos.map(([a, b]) => (
      <Fragment key={a}>
        <path d={poly([P(a, y + h, 0), P(b, y + h, 0), P(b, y + h, zA), P(a, y + h, zA)])} fill="oklch(0.92 0.009 80)" />
        <path
          d={poly([P(a, y + h - 4, zA), P(b, y + h - 4, zA), P(b, y + h, zA), P(a, y + h, zA)])}
          fill="oklch(0.84 0.012 262)"
        />
      </Fragment>
    )),
  });
}

/** Cantero de quinteros: cajón de madera con tierra y surcos (paleta de tierra). */
function cantero(el: ElementoPlano, finFichas: number | undefined, detalle: boolean, c: Capas) {
  const { x, y, w, h } = el;
  const H = ALT.cantero;
  const r = 8;
  const tx = x - K * H;
  const ty = y - H;
  c.sombras.push(
    <rect key={el.id} x={x + 1} y={y + 2} width={w + 4} height={h + 5} rx={r + 2} fill={TINTA_SOMBRA} fillOpacity={0.2} />
  );
  // Surcos (y brotes con zoom) en la franja libre bajo las fichas; a lo largo del
  // cantero (en el plano girado, el cantero parado lleva los surcos parados).
  const yc = (finFichas ?? y + 58) + 2;
  const hc = ty + h - 8 - yc;
  const girado = h > w ? "-girado" : "";
  c.objetos.push({
    z: y + h,
    x,
    k: el.id,
    n: (
      <>
        <path d={caraEste(x, y, w, h, r, H, 0)} fill="oklch(0.56 0.055 55)" />
        <path d={caraSur(x, y, w, h, r, H, 0)} fill="url(#mapa-madera)" />
        <path
          d={`M${pt(P(x + r, y + h, H * 0.5))}L${pt(P(x + w - r, y + h, H * 0.5))}`}
          stroke="oklch(0.55 0.05 55)"
          strokeOpacity={0.5}
          strokeWidth={0.8}
        />
        <rect
          x={f(tx)}
          y={ty}
          width={w}
          height={h}
          rx={r}
          fill="url(#mapa-tierra)"
          stroke="oklch(0.8 0.04 70)"
          strokeWidth={1}
        />
        {hc > 10 ? (
          <rect x={f(tx + 10)} y={f(yc)} width={w - 20} height={f(hc)} fill={`url(#mapa-surcos${girado})`} />
        ) : null}
        {hc > 10 && detalle ? (
          <rect x={f(tx + 10)} y={f(yc)} width={w - 20} height={f(hc)} fill={`url(#mapa-brotes${girado})`} />
        ) : null}
        <path d={canto(tx, ty, w, h, r)} fill="none" stroke="#fff" strokeOpacity={0.7} strokeWidth={1.1} />
      </>
    ),
  });
  c.rotulos.push(
    <Texto
      key={el.id}
      x={tx + 14}
      y={ty + 19}
      t={el.etiqueta ?? "Quinteros"}
      clase="rot"
      tam={16}
      fill="oklch(0.42 0.05 60)"
      halo="oklch(0.93 0.028 82)"
      grosorHalo={3.5}
      anchor="start"
    />
  );
}

/** Playa de quintas (0032): explanada de ripio con cordón y, a lo largo, la calle del
 * medio de tierra apisonada con su guía. Las quintas (espacios) van encima, en las dos
 * hileras; el cartel, en la calle, contra la punta oeste (o norte, en el plano girado). */
function playa(el: ElementoPlano, detalle: boolean, c: Capas) {
  const { x, y, w, h } = el;
  const acostada = w >= h;
  const ancho = 20;
  const calle = acostada
    ? { x: x + 3, y: y + h / 2 - ancho / 2, w: w - 6, h: ancho }
    : { x: x + w / 2 - ancho / 2, y: y + 3, w: ancho, h: h - 6 };
  const guia = acostada
    ? `M${x + 14} ${f(y + h / 2)}H${x + w - 14}`
    : `M${f(x + w / 2)} ${y + 14}V${y + h - 14}`;
  c.suelos.push(
    <Fragment key={el.id}>
      <rect x={x} y={y} width={w} height={h} rx={8} fill="url(#mapa-ripio)" />
      <rect x={calle.x} y={calle.y} width={calle.w} height={calle.h} rx={4} fill="url(#mapa-tierra)" />
      <path d={guia} stroke="oklch(0.78 0.05 70)" strokeWidth={1.4} strokeDasharray="7 7" strokeLinecap="round" />
      <rect
        x={x + 0.7}
        y={y + 0.7}
        width={w - 1.4}
        height={h - 1.4}
        rx={7.5}
        fill="none"
        stroke="oklch(0.84 0.03 72)"
        strokeWidth={1.4}
      />
    </Fragment>
  );
  if (detalle) {
    // En la mitad norte de la calle: la otra mitad la tapan las camionetas de abajo.
    c.rotulos.push(
      <Texto
        key={el.id}
        x={acostada ? x + 10 : calle.x + 5}
        y={acostada ? calle.y + 5 : y + 10}
        t={el.etiqueta ?? "Playa de quintas"}
        clase="rot7"
        tam={8}
        fill="oklch(0.45 0.05 60)"
        halo="oklch(0.93 0.028 82)"
        grosorHalo={2.5}
        anchor={acostada ? "start" : "end"}
        vertical={!acostada}
      />
    );
  }
}

/** Administración: casa a dos aguas (cumbrera este-oeste). Sin alero al oeste,
 * para no invadir el puesto vecino; el azul, solo en la puerta y el isotipo. */
function administracion(el: ElementoPlano, detalle: boolean, c: Capas) {
  const { x, y, w, h } = el;
  const zp = ALT.adminPared;
  const zc = ALT.adminCumbrera;
  const ym = y + h / 2;
  const al = 2.5;
  c.sombras.push(
    <path
      key={el.id}
      d={poly([
        [x, y],
        [x + w, y],
        [x + w + 9, y + 13],
        [x + w + 9, y + h + 13],
        [x + 9, y + h + 13],
        [x, y + h],
      ])}
      fill={TINTA_SOMBRA}
      fillOpacity={0.22}
    />
  );
  const fr = (u0: number, u1: number, z0: number, z1: number) =>
    poly([P(x + u0, y + h, z0), P(x + u1, y + h, z0), P(x + u1, y + h, z1), P(x + u0, y + h, z1)]);
  const NO = P(x, y - al, zp - 0.5);
  const NE = P(x + w + al, y - al, zp - 0.5);
  const SO = P(x, y + h + al, zp - 0.5);
  const SE = P(x + w + al, y + h + al, zp - 0.5);
  const CO = P(x, ym, zc);
  const CE = P(x + w + al, ym, zc);
  let tejas = "";
  for (let i = 1; i < 12; i++) {
    const xx = x + ((w + al) * i) / 12;
    tejas += `M${pt(P(xx, ym, zc))}L${pt(P(xx, y + h + al, zp - 0.5))}`;
  }
  // Isotipo en una placa blanca sobre el agua sur (se lee sin texto en la vista completa).
  const [bx, by] = P(x + w / 2, y + h * 0.74, zp + (zc - zp) * 0.48);
  // Frontón, tres columnas y base.
  const columnas = [-5, 0, 5].map((dx) => `M${f(bx + dx)} ${f(by - 1)}V${f(by + 4.6)}`).join("");
  const isotipo =
    `M${f(bx - 7.5)} ${f(by - 2)}L${f(bx)} ${f(by - 8)}L${f(bx + 7.5)} ${f(by - 2)}` +
    columnas +
    `M${f(bx - 8)} ${f(by + 6.6)}H${f(bx + 8)}`;
  c.objetos.push({
    z: y + h,
    x,
    k: el.id,
    n: (
      <>
        <path
          d={poly([P(x + w, y, 0), P(x + w, y + h, 0), P(x + w, y + h, zp), P(x + w, ym, zc), P(x + w, y, zp)])}
          fill="oklch(0.84 0.034 263)"
        />
        <path d={fr(0, w, 0, zp)} fill="url(#mapa-admin-frente)" />
        <path
          d={fr(8, 26, 4, 12) + fr(66, 84, 4, 12)}
          fill="url(#mapa-ventana)"
          stroke="oklch(0.72 0.03 255)"
          strokeWidth={0.7}
        />
        <path d={fr(38, 54, 0, 13)} fill="var(--primary)" />
        {/* Techo: agua norte (al sol) y agua sur (hacia la cámara) */}
        <path d={poly([NO, NE, CE, CO])} fill="oklch(0.91 0.022 262)" />
        <path d={poly([CO, CE, SE, SO])} fill="oklch(0.79 0.04 264)" />
        <path d={tejas} fill="none" stroke="oklch(0.66 0.045 265)" strokeOpacity={0.3} strokeWidth={0.8} />
        <path d={`M${pt(CO)}L${pt(CE)}`} stroke="oklch(0.97 0.01 262)" strokeWidth={1.8} strokeLinecap="round" />
        <path
          d={`M${pt(SO)}L${pt(SE)}L${pt(CE)}`}
          fill="none"
          stroke="oklch(0.6 0.05 265)"
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
        <circle cx={f(bx)} cy={f(by)} r={12} fill="#fff" stroke="var(--primary)" strokeOpacity={0.3} strokeWidth={1.2} />
        <path
          d={isotipo}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
  });
  if (detalle) {
    c.rotulos.push(
      <Texto
        key={el.id}
        x={x + w / 2}
        y={y + h + 13}
        t={el.etiqueta ?? "Administración"}
        clase="rot"
        tam={12}
        fill="var(--accent-foreground)"
        halo="oklch(0.96 0.006 80)"
        grosorHalo={3.5}
      />
    );
  }
}

/** Invernadero: bóveda de vidrio con costillas, plantas adentro y frente esmerilado. */
function invernadero(el: ElementoPlano, c: Capas) {
  const { x, y, w, h } = el;
  const H = ALT.invernadero;
  const cx = x + w / 2;
  const N = 18;
  const arcoEn = (yy: number, inverso: boolean) => {
    const pts: Pt[] = [];
    for (let i = 0; i <= N; i++) {
      const t = inverso ? 1 - i / N : i / N;
      const px = x + t * w;
      const u = (px - cx) / (w / 2);
      pts.push(P(px, yy, H * Math.sqrt(Math.max(0, 1 - u * u))));
    }
    return pts;
  };
  const tira = (ps: Pt[], m = "M") => ps.map((p, i) => `${i === 0 ? m : "L"}${pt(p)}`).join("");
  c.sombras.push(
    <rect
      key={el.id}
      x={x + 2}
      y={y + 6}
      width={w + 12}
      height={h + 10}
      rx={14}
      fill="oklch(0.3 0.04 200)"
      fillOpacity={0.2}
    />
  );
  let costillas = "";
  for (let yy = y + 26; yy < y + h - 4; yy += 26) costillas += tira(arcoEn(yy, false));
  const rx = cx - K * H;
  c.objetos.push({
    z: y + h,
    x,
    k: el.id,
    n: (
      <>
        <rect x={x} y={y} width={w} height={h} rx={3} fill="oklch(0.86 0.035 80)" />
        <rect x={x + 4} y={y + 4} width={w - 8} height={h - 8} fill="url(#mapa-plantas)" />
        <path
          d={`${tira(arcoEn(y, false)) + tira(arcoEn(y + h, true), "L")}Z`}
          fill="url(#mapa-vidrio)"
          stroke="oklch(0.76 0.05 190)"
          strokeWidth={1}
        />
        {costillas ? <path d={costillas} fill="none" stroke="#fff" strokeOpacity={0.95} strokeWidth={1.3} /> : null}
        <path
          d={`M${f(rx - 5)} ${y - H + 3}V${y + h - H - 3}`}
          stroke="#fff"
          strokeWidth={2.4}
          strokeOpacity={0.95}
          strokeLinecap="round"
        />
        <path
          d={`${tira(arcoEn(y + h, false))}Z`}
          fill="#fff"
          fillOpacity={0.5}
          stroke="oklch(0.72 0.06 190)"
          strokeWidth={1.1}
        />
        <path
          d={poly([P(cx - 8, y + h, 0), P(cx + 8, y + h, 0), P(cx + 8, y + h, 17), P(cx - 8, y + h, 17)])}
          fill="oklch(0.84 0.04 190)"
          fillOpacity={0.7}
          stroke="oklch(0.7 0.06 190)"
          strokeWidth={0.8}
        />
      </>
    ),
  });
  c.rotulos.push(
    <Texto
      key={el.id}
      x={rx + 11}
      y={y + h / 2 - H + 6}
      t={el.etiqueta ?? "Invernadero"}
      clase="rot"
      tam={15}
      fill="oklch(0.4 0.06 190)"
      halo="oklch(0.965 0.02 185)"
      grosorHalo={4}
      vertical
    />
  );
}

/** Invernadero acostado (plano girado): la bóveda corre de oeste a este. Se ven la
 * ladera norte hasta la cresta aparente, la ladera sur y el frente esmerilado del
 * este (el que mira a la cámara, con la puerta). */
function invernaderoAcostado(el: ElementoPlano, c: Capas) {
  const { x, y, w, h } = el;
  const H = ALT.invernadero;
  const cy = y + h / 2;
  const N = 24;
  // Perfil de la bóveda en x = xx, de norte a sur.
  const arcoEn = (xx: number) => {
    const pts: Pt[] = [];
    for (let i = 0; i <= N; i++) {
      const yy = y + (h * i) / N;
      const u = (yy - cy) / (h / 2);
      pts.push(P(xx, yy, H * Math.sqrt(Math.max(0, 1 - u * u))));
    }
    return pts;
  };
  const oeste = arcoEn(x);
  const este = arcoEn(x + w);
  // El punto del perfil más alto en pantalla: de ahí hacia el norte la bóveda da la espalda.
  const iTop = oeste.reduce((m, p, i) => (p[1] < oeste[m][1] ? i : m), 0);
  const lineas = (ps: Pt[]) => ps.map((p) => `L${pt(p)}`).join("");
  const tira = (ps: Pt[]) => `M${pt(ps[0])}${lineas(ps.slice(1))}`;
  // Silueta: cresta aparente → arco este hasta el pie norte → pie del frente → borde
  // sur → arco oeste de vuelta a la cresta.
  const silueta =
    `M${pt(oeste[iTop])}L${pt(este[iTop])}${lineas(este.slice(0, iTop).reverse())}` +
    `L${pt(P(x + w, y + h, 0))}${lineas(oeste.slice(iTop + 1).reverse())}Z`;
  let costillas = "";
  for (let xx = x + 26; xx < x + w - 4; xx += 26) costillas += tira(arcoEn(xx).slice(iTop));
  c.sombras.push(
    <rect
      key={el.id}
      x={x + 2}
      y={y + 6}
      width={w + 12}
      height={h + 10}
      rx={14}
      fill="oklch(0.3 0.04 200)"
      fillOpacity={0.2}
    />
  );
  c.objetos.push({
    z: y + h,
    x,
    k: el.id,
    n: (
      <>
        <rect x={x} y={y} width={w} height={h} rx={3} fill="oklch(0.86 0.035 80)" />
        <rect x={x + 4} y={y + 4} width={w - 8} height={h - 8} fill="url(#mapa-plantas-girado)" />
        <path d={silueta} fill="url(#mapa-vidrio-acostado)" stroke="oklch(0.76 0.05 190)" strokeWidth={1} />
        {costillas ? <path d={costillas} fill="none" stroke="#fff" strokeOpacity={0.95} strokeWidth={1.3} /> : null}
        <path
          d={`M${f(x - K * H + 3)} ${f(cy - H - 5)}H${f(x + w - K * H - 3)}`}
          stroke="#fff"
          strokeWidth={2.4}
          strokeOpacity={0.95}
          strokeLinecap="round"
        />
        <path d={`${tira(este)}Z`} fill="#fff" fillOpacity={0.5} stroke="oklch(0.72 0.06 190)" strokeWidth={1.1} />
        <path
          d={poly([P(x + w, cy - 8, 0), P(x + w, cy + 8, 0), P(x + w, cy + 8, 17), P(x + w, cy - 8, 17)])}
          fill="oklch(0.84 0.04 190)"
          fillOpacity={0.7}
          stroke="oklch(0.7 0.06 190)"
          strokeWidth={0.8}
        />
      </>
    ),
  });
  c.rotulos.push(
    <Texto
      key={el.id}
      x={x + w / 2 - K * H}
      y={cy - H + 12}
      t={el.etiqueta ?? "Invernadero"}
      clase="rot"
      tam={15}
      fill="oklch(0.4 0.06 190)"
      halo="oklch(0.965 0.02 185)"
      grosorHalo={4}
    />
  );
}

/** Árboles: sombras y troncos, un path cada uno; la copa, una por árbol. */
function arboledas(arboles: Arbol[], c: Capas) {
  if (arboles.length === 0) return;
  let sombras = "";
  let troncos = "";
  arboles.forEach((a, i) => {
    const r = a.r;
    const [cx, cy] = P(a.x, a.y, ALT.arbol);
    sombras += elPath(a.x + 8, a.y + 4, r * 1.35, r * 0.72);
    troncos += `M${f(a.x)} ${f(a.y)}L${f(cx)} ${f(cy + 0.3 * r)}`;
    const copa =
      circulo(cx - 0.5 * r, cy + 0.2 * r, 0.72 * r) +
      circulo(cx + 0.48 * r, cy + 0.26 * r, 0.68 * r) +
      circulo(cx, cy - 0.32 * r, 0.82 * r);
    c.objetos.push({ z: a.y, x: a.x, k: `arbol:${i}`, n: <path d={copa} fill="url(#mapa-copa)" /> });
  });
  c.sombras.push(<path key="arboles" d={sombras} fill="oklch(0.3 0.04 130)" fillOpacity={0.22} />);
  // Los troncos quedan debajo de todo lo que tiene volumen.
  c.objetos.push({
    z: -1e9,
    x: 0,
    k: "troncos",
    n: <path d={troncos} stroke="oklch(0.55 0.04 62)" strokeWidth={2.4} strokeLinecap="round" />,
  });
}

/** Siembra determinística de árboles en racimos, en el espacio libre del predio
 * (se descarta todo árbol que toque un elemento, un espacio u otro árbol). */
export function sembrarArboles(elementos: ElementoPlano[], espacios: Rect[], lim: Rect): Arbol[] {
  type Caja = [number, number, number, number];
  const env = (x: number, y: number, w: number, h: number, zMax: number, m: number): Caja => [
    x - K * zMax - m,
    y - zMax - m,
    x + w + m,
    y + h + m,
  ];
  const cajas: Caja[] = [];
  for (const el of elementos) {
    if (el.tipo === "nave" || el.tipo === "galpon")
      cajas.push(env(el.x, el.y, el.w, el.h, ALT.muroNorte + ALT.cabriada, 10));
    else if (el.tipo === "recinto") cajas.push(env(el.x, el.y - 26, el.w, el.h + 26, ALT.cerco, 10));
    else if (el.tipo === "invernadero") cajas.push(env(el.x, el.y, el.w, el.h, ALT.invernadero, 12));
    else if (el.tipo === "rotulo") cajas.push(env(el.x - 20, el.y, el.w + 40, el.h, 0, 8));
    else cajas.push(env(el.x, el.y, el.w, el.h, 8, 10));
  }
  for (const e of espacios) cajas.push(env(e.x, e.y, e.w, e.h, 26, 12));
  const cruza = (a: Caja, b: Caja) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
  const RACIMO: [number, number][] = [
    [0, 0],
    [21, 7],
    [-17, 11],
    [7, -15],
  ];
  const paso = 150;
  const out: Arbol[] = [];
  for (let gy = lim.y + 60; gy <= lim.y + lim.h; gy += paso / 1.6) {
    for (let gx = lim.x + 40; gx <= lim.x + lim.w; gx += paso) {
      const fila = Math.round((gy - lim.y) / (paso / 1.6));
      const bx = gx + (fila % 2 ? paso / 2 : 0) + (hash(gx, gy) - 0.5) * 60;
      const by = gy + (hash(gx + 7, gy) - 0.5) * 36;
      if (hash(gx + 3, gy + 5) < 0.4) continue;
      const n = 2 + Math.floor(hash(gx + 9, gy + 1) * 1.99);
      for (let k = 0; k < n; k++) {
        const tx = bx + RACIMO[k][0];
        const ty = by + RACIMO[k][1];
        const r = Math.round((8.5 + hash(tx, ty) * 4) * 4) / 4;
        const caja: Caja = [tx - K * ALT.arbol - 1.5 * r, ty - ALT.arbol - 1.4 * r, tx + 1.5 * r + 12, ty + 10];
        if (caja[0] < lim.x || caja[2] > lim.x + lim.w || caja[1] < lim.y || caja[3] > lim.y + lim.h) continue;
        if (cajas.some((c) => cruza(caja, c))) continue;
        if (out.some((o) => Math.hypot(o.x - tx, o.y - ty) < 16)) continue;
        out.push({ x: tx, y: ty, r });
      }
    }
  }
  return out;
}

/** Placa del predio + suelos + nave + todo lo fijo, en orden de pintado. Memo:
 * no se repinta al mover la cámara (solo al cruzar el umbral de `detalle`). */
export const Fondo = memo(function Fondo({
  elementos,
  limites,
  detalle,
  arboles,
  finFichas,
  playa: conPlaya = false,
}: {
  elementos: ElementoPlano[];
  limites: Rect;
  /** Con zoom: brotes en los canteros y el rótulo de Administración. */
  detalle: boolean;
  /** Árboles sembrados en el espacio libre (vacío: sin árboles). */
  arboles: Arbol[];
  /** Hasta dónde llegan las fichas de cada cantero (id → y): debajo van los surcos. */
  finFichas: Map<string, number>;
  /** Las zonas de quinteros tienen quintas numeradas (0032): se dibujan como playa,
   * no como canteros con fichas. */
  playa?: boolean;
}) {
  const c: Capas = { suelos: [], sombras: [], objetos: [], rotulos: [] };
  const naves = elementos.filter((el) => el.tipo === "nave");
  const pasillos = elementos.filter((el) => el.tipo === "pasillo");
  const nave0 = naves[0] ?? null;
  // Dónde corta el pasillo a cada nave (si la cruza): de norte a sur en el plano tal
  // cual, de oeste a este en el plano girado.
  const cortes = new Map(naves.map((n) => [n.id, pasillos.map((p) => cortePasillo(n, p)).find(Boolean) ?? null]));
  const cortesAcostados = new Map(
    naves.map((n) => [n.id, pasillos.map((p) => cortePasilloAcostado(n, p)).find(Boolean) ?? null])
  );

  // Las cocheras al norte de la nave llevan las tachas del lado que la mira (en el
  // plano girado, las franjas paradas: del lado este u oeste).
  for (const el of elementos) {
    if (el.tipo !== "cocheras") continue;
    if (el.h > el.w) cocherasParadas(el, nave0 !== null && el.x < nave0.x, c);
    else cocheras(el, nave0 !== null && el.y < nave0.y, c);
  }
  for (const el of elementos) if (el.tipo === "recinto") recinto(el, c);
  for (const n of naves) nave(n, cortes.get(n.id) ?? null, c, cortesAcostados.get(n.id) ?? null);
  for (const p of pasillos) {
    if (p.w > p.h) pasilloAcostado(p, naves.find((n) => cortePasilloAcostado(n, p)) ?? null, c);
    else pasillo(p, naves.find((n) => cortePasillo(n, p)) ?? null, c);
  }
  for (const n of naves) muros(n, cortes.get(n.id) ?? null, c, cortesAcostados.get(n.id) ?? null);
  // El galpón es una nave chica (plataforma, muro norte con cabriadas, muros bajos): sus
  // subgalpones son espacios y van encima, como los puestos.
  for (const g of elementos) {
    if (g.tipo !== "galpon") continue;
    nave(g, null, c);
    muros(g, null, c);
    c.rotulos.push(
      <Texto
        key={g.id}
        x={g.x + g.w / 2}
        y={g.y + g.h + 16}
        t={g.etiqueta ?? "Galpón"}
        clase="rot7"
        tam={16}
        fill={TINTA_ROTULO}
        halo="var(--background)"
        grosorHalo={4}
      />
    );
  }
  elementos
    .filter((el) => el.tipo === "quinteros")
    .sort((a, b) => a.x - b.x)
    .forEach((el) => (conPlaya ? playa(el, detalle, c) : cantero(el, finFichas.get(el.id), detalle, c)));
  for (const el of elementos) {
    if (el.tipo === "administracion") administracion(el, detalle, c);
    else if (el.tipo === "invernadero") {
      if (el.w > el.h) invernaderoAcostado(el, c);
      else invernadero(el, c);
    } else if (el.tipo === "rotulo" && el.etiqueta) {
      // Rótulo parado (plano girado): se lee de abajo hacia arriba, como el pasillo.
      const parado = el.h > el.w;
      c.rotulos.push(
        <Texto
          key={el.id}
          x={el.x + el.w / 2 + (parado ? 2 : 0)}
          y={el.y + el.h / 2 + (parado ? 0 : 2)}
          t={el.etiqueta}
          clase="rot7"
          tam={16}
          fill={TINTA_ROTULO}
          halo="var(--background)"
          grosorHalo={4}
          vertical={parado}
        />
      );
    }
  }
  arboledas(arboles, c);
  c.objetos.sort((a, b) => a.z - b.z || a.x - b.x);

  return (
    <g aria-hidden>
      <rect
        x={limites.x - 600}
        y={limites.y - 600}
        width={limites.w + 1200}
        height={limites.h + 1200}
        fill="var(--background)"
      />
      {placa(limites)}
      {c.suelos}
      {/* Sombras de lo fijo: el único filtro del plano (se apaga mientras se arrastra) */}
      <g className="mapa-sombras-fondo" filter="url(#mapa-desenfoque)">
        {c.sombras}
      </g>
      {c.objetos.map((o) => (
        <Fragment key={o.k}>{o.n}</Fragment>
      ))}
      {c.rotulos}
    </g>
  );
});

// ---------- Bloques (puestos, bar, locales, contenedores) ----------

export type EstiloBloque = {
  estado: EstadoBloque;
  /** No coincide con la selección o el filtro: pierde la pintura y baja. */
  atenuado: boolean;
  /** Seleccionado (flota), pincel de asignar o aviso (huella de su color). */
  marca: Marca;
  /** Segunda línea (apodo, nombre o nota) cuando el zoom lo permite. */
  etiqueta: string | null;
};

/** Despegue de un bloque: traslación pura, animada con CSS (`.mapa-mov`). */
function mover(z0: number): CSSProperties | undefined {
  return z0 ? { transform: `translate(${f(-K * z0)}px, ${f(-z0)}px)` } : undefined;
}

/** El paso a atenuado (14 → 5) cambia sin animación, igual que la sombra: el
 * bloque atenuado no lleva la transición (tampoco al bajar desde flotando). */
function claseMov(estilo: EstiloBloque): string | undefined {
  return estilo.atenuado ? undefined : "mapa-mov";
}

type Sombra = { k: string; d: string; opacidad: number };

/** Sombras de los bloques, sin filtro: contacto + proyectada, juntas en un
 * path por paso y opacidad (donde dos se pisan no se oscurece de más). */
function sombrasBloques(orden: Bloque[], alturas: Map<string, Alturas>): Sombra[] {
  const baldes = new Map<string, string>();
  const aBalde = (paso: string, op: number, d: string) => {
    const k = `${paso}|${f(op)}`;
    baldes.set(k, (baldes.get(k) ?? "") + d);
  };
  for (const b of orden) {
    const s = alturas.get(b.clave);
    if (!s) continue;
    const H = s.zTop;
    // Atenuado: más suave; flotando: sin contacto y la proyectada se despega.
    const o = s.material === "neutro" ? 0.55 : s.z0 > 0 ? 0.7 : 1;
    const d0 = s.z0 * 0.3;
    const e0 = s.z0 * 0.45;
    // Lo pintado en el piso (cochera o quinta libre) no hace sombra.
    if (s.zTop - s.z0 <= ALT.piso && !s.z0) continue;
    // Autos y camionetas: la sombra es la de la carrocería, no la del lugar.
    const { x: bx, y: by, w: bw, h: bh } = vehiculoDe(b) ?? b.rect;
    const r = radioTapa(b);
    if (!s.z0) aBalde("contacto", 0.16 * o, rrPath(bx - 0.5, by + 0.5, bw + 0.12 * H + 1, bh + 0.2 * H, r + 1));
    aBalde("proyectada", 0.09 * o, rrPath(bx + 0.5 + d0, by + 1.5 + e0, bw + 0.34 * H, bh + 0.52 * H, r + 3));
  }
  return [...baldes]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([k, d]) => ({ k, d, opacidad: Number(k.split("|")[1]) }));
}

/** Huella en el piso (seleccionado, pincel, aviso): la caja es la del piso, no la tapa. */
function Huella({ bloque, marca }: { bloque: Bloque; marca: Exclude<Marca, null> }) {
  const { x, y, w, h } = bloque.rect;
  const color = marca === "aviso" ? "var(--parcial)" : "var(--primary)";
  const m = 3;
  const trazo = {
    fill: color,
    fillOpacity: marca === "seleccion" ? 0.1 : 0.08,
    stroke: color,
    strokeOpacity: 0.55,
    strokeWidth: 1.3,
    strokeDasharray: "3 2.6",
  };
  const r = radioTapa(bloque);
  return (
    <>
      {marca === "seleccion" ? (
        <rect x={x - 7} y={y - 5} width={w + 16} height={h + 14} rx={f(r + 9)} fill={color} fillOpacity={0.07} />
      ) : null}
      <rect x={x - m} y={y - m} width={w + 2 * m} height={h + 2 * m} rx={f(r + m)} {...trazo} />
    </>
  );
}

/** Puesto o bar: mostrador de madera con faldón festoneado del color del estado
 * (a rayas si debe), tapa lisa, ranuras entre puestos y canto iluminado. En el
 * plano girado los puestos fundidos van en columna: las ranuras cruzan la tapa a
 * lo ancho y el frente (sur) es solo el del último puesto, sin costuras. */
function cuerpoPuesto(
  b: Bloque,
  mat: Material,
  H: number,
  pintado: boolean,
  libre: boolean,
  detalle: boolean,
  conApodo: boolean
) {
  const { x, y, w, h } = b.rect;
  const M = MAT[mat];
  const r = radioTapa(b);
  const tx = x - K * H;
  const ty = y - H;
  const columna = b.eje === "y";
  // Dónde se tocan dos puestos del bloque: x en una fila, y en una columna.
  const divisiones = b.espacios
    .slice(1)
    .map((e, i) =>
      columna ? (b.espacios[i].y + b.espacios[i].h + e.y) / 2 : (b.espacios[i].x + b.espacios[i].w + e.x) / 2
    );
  let caras: ReactNode;
  if (pintado) {
    const zf = detalle ? ALT.faldonDetalle : ALT.faldon;
    const dF = caraSur(x, y, w, h, r, H, zf, { paso: detalle ? 7.5 : 8, caida: 1.7 });
    // Mercadería (solo con zoom): óvalos centrados en las bandas de 7 u del degradé.
    let merc = "";
    if (detalle && b.tipo !== "bar") {
      const zm = ALT.mostrador + 1.6;
      const dz = K * zm;
      for (let sx = Math.ceil((x + r + 1 - dz) / 7) * 7 + 3.5; sx + dz < x + w - r - 2; sx += 7) {
        merc += `M${f(sx - 3.1)} ${f(y + h - zm)}a3.1 2.3 0 1 0 6.2 0a3.1 2.3 0 1 0 -6.2 0`;
      }
    }
    const costuras = columna ? "" : divisiones.map((lx) => `M${pt(P(lx, y + h, H))}L${pt(P(lx, y + h, zf))}`).join("");
    caras = (
      <>
        <path d={caraEste(x, y, w, h, r, H, 0)} fill={M.lado} />
        <path d={caraSur(x, y, w, h, r, H, 0)} fill="url(#mapa-mostrador)" />
        {detalle ? (
          <>
            <path d={caraSur(x, y, w, h, r, zf, ALT.mostrador)} fill="url(#mapa-hueco)" />
            {merc ? <path d={merc} fill="url(#mapa-mercaderia)" /> : null}
            <path
              d={`M${pt(P(x + r, y + h, ALT.mostrador))}L${pt(P(x + w - r, y + h, ALT.mostrador))}`}
              stroke="oklch(0.86 0.05 72)"
              strokeWidth={0.9}
            />
          </>
        ) : null}
        <path d={dF} fill={`url(#mapa-faldon-${mat})`} stroke={M.faldonBorde} strokeWidth={0.7} strokeLinejoin="round" />
        {mat === "debe" ? <path d={dF} fill="url(#mapa-rayas-debe)" /> : null}
        {costuras ? <path d={costuras} stroke={M.faldonBorde} strokeOpacity={0.8} strokeWidth={1} /> : null}
      </>
    );
  } else {
    caras = (
      <>
        <path d={caraEste(x, y, w, h, r, H, 0)} fill={M.lado} />
        <path d={caraSur(x, y, w, h, r, H, 0)} fill={M.frente} />
      </>
    );
  }
  // Ranuras entre los puestos fusionados (más cortas si abajo va el apodo); en una
  // columna, a lo ancho (el apodo va dentro del último puesto: no las cruza).
  const fin = conApodo ? ty + h * 0.56 : ty + h - 6;
  const ranuras = divisiones
    .map((d) => (columna ? `M${f(tx + 6)} ${f(d - H)}H${f(tx + w - 6)}` : `M${f(d - K * H)} ${f(ty + 6)}V${f(fin)}`))
    .join("");
  // El filo iluminado (luz del noroeste): al este de la ranura, o al sur en una columna.
  const luces = divisiones
    .map((d) =>
      columna ? `M${f(tx + 6)} ${f(d - H + 1)}H${f(tx + w - 6)}` : `M${f(d - K * H + 1)} ${f(ty + 6)}V${f(fin)}`
    )
    .join("");
  // Lote punteado: "disponible" se lee por forma, no solo por color.
  let lote = "";
  if (libre) {
    for (const e of b.espacios) {
      const ex = e.x - K * H;
      const x0 = ex + 4;
      const x1 = ex + e.w - 4;
      const y0 = (columna ? e.y - H : ty) + 4;
      const y1 = (columna ? e.y + e.h - H : ty + h) - 4;
      lote +=
        `M${f(x0 + 2)} ${f(y0)}H${f(x1 - 2)}Q${f(x1)} ${f(y0)} ${f(x1)} ${f(y0 + 2)}` +
        `V${f(y1 - 2)}Q${f(x1)} ${f(y1)} ${f(x1 - 2)} ${f(y1)}` +
        `H${f(x0 + 2)}Q${f(x0)} ${f(y1)} ${f(x0)} ${f(y1 - 2)}` +
        `V${f(y0 + 2)}Q${f(x0)} ${f(y0)} ${f(x0 + 2)} ${f(y0)}Z`;
    }
  }
  return (
    <>
      {caras}
      {tapa(tx, ty, w, h, r, mat)}
      {ranuras ? (
        <>
          <path d={ranuras} stroke={M.ranura} strokeWidth={1.1} />
          <path d={luces} stroke="#fff" strokeOpacity={mat === "vencido" ? 0.28 : 0.85} strokeWidth={1} />
        </>
      ) : null}
      {lote ? <path d={lote} fill="none" stroke={M.lote} strokeWidth={1} strokeDasharray="2.5 2.5" /> : null}
      {cantoTapa(tx, ty, w, h, r, mat)}
    </>
  );
}

/** Tapa lisa: detrás del número no va ninguna textura. */
function tapa(tx: number, ty: number, w: number, h: number, r: number, mat: Material) {
  return (
    <rect
      x={f(tx)}
      y={f(ty)}
      width={w}
      height={h}
      rx={f(r)}
      fill={`url(#mapa-tapa-${mat})`}
      stroke={MAT[mat].bisel}
      strokeWidth={MAT[mat].grosor}
    />
  );
}

/** Canto iluminado de la tapa (luz del noroeste). */
function cantoTapa(tx: number, ty: number, w: number, h: number, r: number, mat: Material) {
  return (
    <path
      d={canto(tx, ty, w, h, r)}
      fill="none"
      stroke="#fff"
      strokeOpacity={MAT[mat].canto}
      strokeWidth={1.1}
      strokeLinecap="round"
    />
  );
}

/** Local: fachada con vidriera, puerta y toldito del color del estado. */
function cuerpoLocal(b: Bloque, mat: Material, H: number, pintado: boolean, libre: boolean) {
  const { x, y, w, h } = b.rect;
  const M = MAT[mat];
  const r = 3;
  const tx = x - K * H;
  const ty = y - H;
  const fr = (u0: number, u1: number, za: number, zb: number) =>
    poly([P(x + u0, y + h, za), P(x + u1, y + h, za), P(x + u1, y + h, zb), P(x + u0, y + h, zb)]);
  let caras: ReactNode;
  if (pintado) {
    const toldo = fr(1.5, w - 1.5, H - 1, H - 5);
    caras = (
      <>
        <path d={caraEste(x, y, w, h, r, H, 0)} fill="oklch(0.86 0.016 80)" />
        <path d={caraSur(x, y, w, h, r, H, 0)} fill="oklch(0.955 0.012 85)" />
        <path d={fr(4, w - 17, 1.5, H - 5.5)} fill="url(#mapa-ventana)" />
        <path d={fr(w - 14, w - 5, 0, H - 5)} fill="oklch(0.42 0.03 260)" />
        <path d={toldo} fill={`url(#mapa-faldon-${mat})`} stroke={M.faldonBorde} strokeWidth={0.6} />
        {mat === "debe" ? <path d={toldo} fill="url(#mapa-rayas-debe)" /> : null}
      </>
    );
  } else {
    caras = (
      <>
        <path d={caraEste(x, y, w, h, r, H, 0)} fill={M.lado} />
        <path d={caraSur(x, y, w, h, r, H, 0)} fill={M.frente} />
        {libre && mat !== "neutro" && H >= 6 ? (
          // Persiana baja
          <path
            d={[2.2, 4.4].map((z) => `M${pt(P(x + 5, y + h, z))}L${pt(P(x + w - 5, y + h, z))}`).join("")}
            stroke="oklch(0.78 0.012 258)"
            strokeWidth={0.8}
          />
        ) : null}
      </>
    );
  }
  return (
    <>
      {caras}
      {tapa(tx, ty, w, h, r, mat)}
      {pintado ? (
        // Pretil
        <rect
          x={f(tx + 3.5)}
          y={f(ty + 3.5)}
          width={w - 7}
          height={h - 7}
          rx={1.5}
          fill="none"
          stroke={M.bisel}
          strokeOpacity={0.35}
        />
      ) : null}
      {libre ? (
        <rect
          x={f(tx + 4)}
          y={f(ty + 4)}
          width={w - 8}
          height={h - 8}
          rx={2}
          fill="none"
          stroke={M.lote}
          strokeDasharray="2.5 2.5"
        />
      ) : null}
      {cantoTapa(tx, ty, w, h, r, mat)}
    </>
  );
}

/** Contéiner: caja de chapa acanalada del color del estado, con las puertas (junta y
 * trabas) en la cabecera que mira a la cámara: sur si está parado, este si acostado. */
function cuerpoConteiner(b: Bloque, mat: Material, H: number, pintado: boolean, libre: boolean) {
  const { x, y, w, h } = b.rect;
  const M = MAT[mat];
  const r = radioTapa(b);
  const tx = x - K * H;
  const ty = y - H;
  const parado = h > w;
  const dSur = caraSur(x, y, w, h, r, H, 0);
  let canal = "";
  let puertas = "";
  let nervios = "";
  if (parado) {
    for (let yy = y + 4; yy < y + h - 2; yy += 4.5) canal += `M${pt(P(x + w, yy, 1))}L${pt(P(x + w, yy, H - 1))}`;
    for (const u of [0.26, 0.5, 0.74]) puertas += `M${pt(P(x + w * u, y + h, 1.2))}L${pt(P(x + w * u, y + h, H - 1.2))}`;
    for (let yy = y + 7; yy < y + h - 4; yy += 7) nervios += `M${f(tx + 3)} ${f(yy - H)}H${f(tx + w - 3)}`;
  } else {
    for (let xx = x + 4; xx < x + w - 2; xx += 4.5) canal += `M${pt(P(xx, y + h, 1))}L${pt(P(xx, y + h, H - 1))}`;
    for (const u of [0.26, 0.5, 0.74]) puertas += `M${pt(P(x + w, y + h * u, 1.2))}L${pt(P(x + w, y + h * u, H - 1.2))}`;
    for (let xx = x + 7; xx < x + w - 4; xx += 7) nervios += `M${f(xx - K * H)} ${f(ty + 3)}V${f(ty + h - 3)}`;
  }
  return (
    <>
      <path d={caraEste(x, y, w, h, r, H, 0)} fill={M.lado} />
      <path
        d={dSur}
        fill={pintado ? `url(#mapa-faldon-${mat})` : M.frente}
        stroke={pintado ? M.faldonBorde : M.bisel}
        strokeOpacity={0.5}
        strokeWidth={0.7}
      />
      {mat === "debe" ? <path d={dSur} fill="url(#mapa-rayas-debe)" /> : null}
      {H >= 6 ? (
        <>
          <path d={canal} stroke={TINTA_SOMBRA} strokeOpacity={0.16} strokeWidth={1.1} />
          <path d={puertas} stroke={TINTA_SOMBRA} strokeOpacity={0.36} strokeWidth={0.9} strokeLinecap="round" />
        </>
      ) : null}
      {tapa(tx, ty, w, h, r, mat)}
      {nervios ? <path d={nervios} stroke={M.bisel} strokeOpacity={0.22} strokeWidth={1} /> : null}
      {libre ? (
        <rect
          x={f(tx + 4)}
          y={f(ty + 4)}
          width={w - 8}
          height={h - 8}
          rx={1.5}
          fill="none"
          stroke={M.lote}
          strokeDasharray="2.5 2.5"
        />
      ) : null}
      {cantoTapa(tx, ty, w, h, r, mat)}
    </>
  );
}

/** Subgalpón: depósito con portón de enrollar en el frente, del color del estado (en uno
 * libre, la persiana gris y el lote punteado en el techo). */
function cuerpoGalpon(b: Bloque, mat: Material, H: number, pintado: boolean, libre: boolean) {
  const { x, y, w, h } = b.rect;
  const M = MAT[mat];
  const r = radioTapa(b);
  const tx = x - K * H;
  const ty = y - H;
  const m = Math.min(7, w * 0.1);
  const porton = poly([P(x + m, y + h, 0), P(x + w - m, y + h, 0), P(x + w - m, y + h, H - 3), P(x + m, y + h, H - 3)]);
  let lamas = "";
  for (let z = 1.8; z < H - 3.4; z += 1.8) lamas += `M${pt(P(x + m, y + h, z))}L${pt(P(x + w - m, y + h, z))}`;
  return (
    <>
      <path d={caraEste(x, y, w, h, r, H, 0)} fill={pintado ? "oklch(0.86 0.016 80)" : M.lado} />
      <path d={caraSur(x, y, w, h, r, H, 0)} fill={pintado ? "oklch(0.955 0.012 85)" : M.frente} />
      {H >= 6 ? (
        <>
          <path
            d={porton}
            fill={pintado ? `url(#mapa-faldon-${mat})` : "oklch(0.86 0.01 258)"}
            stroke={pintado ? M.faldonBorde : M.bisel}
            strokeWidth={0.6}
          />
          {mat === "debe" ? <path d={porton} fill="url(#mapa-rayas-debe)" /> : null}
          {lamas ? <path d={lamas} stroke={TINTA_SOMBRA} strokeOpacity={0.14} strokeWidth={0.6} /> : null}
        </>
      ) : null}
      {tapa(tx, ty, w, h, r, mat)}
      {pintado ? (
        <rect
          x={f(tx + 3.5)}
          y={f(ty + 3.5)}
          width={w - 7}
          height={h - 7}
          rx={1.5}
          fill="none"
          stroke={M.bisel}
          strokeOpacity={0.35}
        />
      ) : null}
      {libre ? (
        <rect
          x={f(tx + 4)}
          y={f(ty + 4)}
          width={w - 8}
          height={h - 8}
          rx={2}
          fill="none"
          stroke={M.lote}
          strokeDasharray="2.5 2.5"
        />
      ) : null}
      {cantoTapa(tx, ty, w, h, r, mat)}
    </>
  );
}

// ---------- Cocheras y quintas: el vehículo estacionado ----------

/** Huella de un vehículo: a lo largo del lado más largo de su lugar, con la trompa
 * hacia la cámara (al sur si el lugar está parado, al este si está acostado). */
type Vehiculo = Rect & { parado: boolean };

/** El auto de una cochera o la camioneta de una quinta, dentro de su lugar. */
function vehiculoDe(b: Pick<Bloque, "tipo" | "rect">): Vehiculo | null {
  if (b.tipo !== "cochera" && b.tipo !== "quinta") return null;
  const { x, y, w, h } = b.rect;
  const parado = h >= w;
  const lado = parado ? w : h;
  const largo = (parado ? h : w) - (b.tipo === "cochera" ? 7 : 3);
  const ancho = b.tipo === "cochera" ? Math.min(lado - 9, largo * 0.48) : lado - 3;
  return parado
    ? { x: x + (w - ancho) / 2, y: y + (h - largo) / 2, w: ancho, h: largo, parado }
    : { x: x + (w - largo) / 2, y: y + (h - ancho) / 2, w: largo, h: ancho, parado };
}

/** Un tramo del vehículo a lo largo (0 = cola, 1 = trompa), con `borde` a los costados. */
function tramo(v: Vehiculo, t0: number, t1: number, borde = 0): Rect {
  return v.parado
    ? { x: v.x + borde, y: v.y + v.h * t0, w: v.w - 2 * borde, h: v.h * (t1 - t0) }
    : { x: v.x + v.w * t0, y: v.y + borde, w: v.w * (t1 - t0), h: v.h - 2 * borde };
}

/** Dónde va el número: el techo del auto o la lona de la camioneta (z relativa a la tapa). */
function techoVehiculo(b: Pick<Bloque, "tipo" | "rect">): { r: Rect; dz: number } | null {
  const v = vehiculoDe(b);
  if (!v) return null;
  return b.tipo === "cochera" ? { r: tramo(v, 0.3, 0.72, 1.6), dz: 0 } : { r: tramo(v, 0.02, 0.6, 0.6), dz: -0.5 };
}

/** Caja de esquinas redondeadas entre z0 y z1: caras este y sur y la tapa. */
function caja(r: Rect, radio: number, z0: number, z1: number, p: { sur: string; este: string; tapa: string; borde?: string }) {
  const { x, y, w, h } = r;
  return (
    <>
      <path d={caraEste(x, y, w, h, radio, z1, z0)} fill={p.este} />
      <path d={caraSur(x, y, w, h, radio, z1, z0)} fill={p.sur} />
      <rect
        x={f(x - K * z1)}
        y={f(y - z1)}
        width={f(w)}
        height={f(h)}
        rx={f(radio)}
        fill={p.tapa}
        stroke={p.borde}
        strokeWidth={p.borde ? 0.8 : undefined}
      />
    </>
  );
}

/** Cochera o quinta sin vehículo: el lugar pintado en el piso (punteado si está libre;
 * en el mapa del Jefe, que no sabe si está ocupado, liso). */
function lugarPintado(b: Bloque, mat: Material, libre: boolean) {
  const { x, y, w, h } = b.rect;
  const M = MAT[mat];
  return (
    <rect
      x={f(x + 2)}
      y={f(y + 2)}
      width={f(w - 4)}
      height={f(h - 4)}
      rx={2.5}
      fill={libre ? "#fff" : M.tapa[1]}
      fillOpacity={libre ? 0.4 : 0.85}
      stroke={M.lote}
      strokeWidth={1}
      strokeDasharray={libre ? "2.5 2.5" : undefined}
    />
  );
}

/** Cochera ocupada: el auto, con la carrocería del color del estado (a rayas si debe),
 * cabina vidriada y el techo claro con el número. */
function cuerpoCochera(b: Bloque, mat: Material, H: number, libre: boolean) {
  const v = vehiculoDe(b);
  if (!v || H <= ALT.piso) return lugarPintado(b, mat, libre);
  const M = MAT[mat];
  const zc = H * 0.5;
  const radio = Math.min(4, Math.min(v.w, v.h) / 4);
  const vidrio = "url(#mapa-ventana)";
  const oscuro = "oklch(0.52 0.03 250)";
  return (
    <>
      {caja(v, radio, 0.8, zc, { sur: `url(#mapa-faldon-${mat})`, este: M.lado, tapa: M.faldon[0], borde: M.faldonBorde })}
      {mat === "debe" ? <path d={caraSur(v.x, v.y, v.w, v.h, radio, zc, 0.8)} fill="url(#mapa-rayas-debe)" /> : null}
      {caja(tramo(v, 0.3, 0.72, 1.6), 2.5, zc, H, {
        sur: v.parado ? vidrio : oscuro,
        este: v.parado ? oscuro : vidrio,
        tapa: `url(#mapa-tapa-${mat})`,
        borde: M.bisel,
      })}
    </>
  );
}

/** Quinta ocupada: la camioneta del quintero, con la carga tapada por una lona del color
 * del estado (ahí va el número) y la cabina adelante, del lado de la trompa. */
function cuerpoQuinta(b: Bloque, mat: Material, H: number, libre: boolean) {
  const v = vehiculoDe(b);
  if (!v || H <= ALT.piso) return lugarPintado(b, mat, libre);
  const M = MAT[mat];
  const zc = H * 0.55;
  const chapa = `url(#mapa-faldon-${mat})`;
  const carga = tramo(v, 0, 0.62);
  // Cabina adelante; el parabrisas, en la mitad de arriba del frente (sur o este).
  const cab = tramo(v, 0.66, 1, 0.8);
  const za = H * 0.5;
  const zb = H - 1;
  const parabrisas = v.parado
    ? poly([
        P(cab.x + 1.2, cab.y + cab.h, za),
        P(cab.x + cab.w - 1.2, cab.y + cab.h, za),
        P(cab.x + cab.w - 1.2, cab.y + cab.h, zb),
        P(cab.x + 1.2, cab.y + cab.h, zb),
      ])
    : poly([
        P(cab.x + cab.w, cab.y + 1.2, za),
        P(cab.x + cab.w, cab.y + cab.h - 1.2, za),
        P(cab.x + cab.w, cab.y + cab.h - 1.2, zb),
        P(cab.x + cab.w, cab.y + 1.2, zb),
      ]);
  return (
    <>
      {caja(carga, 1.5, 0.8, zc, { sur: chapa, este: M.lado, tapa: M.faldon[1] })}
      {mat === "debe" ? (
        <path d={caraSur(carga.x, carga.y, carga.w, carga.h, 1.5, zc, 0.8)} fill="url(#mapa-rayas-debe)" />
      ) : null}
      {caja(tramo(v, 0.02, 0.6, 0.6), 2, zc, H - 0.5, {
        sur: M.faldon[0],
        este: M.lado,
        tapa: `url(#mapa-tapa-${mat})`,
        borde: M.bisel,
      })}
      {caja(cab, 2, 0.8, H, { sur: chapa, este: M.lado, tapa: M.faldon[0], borde: M.faldonBorde })}
      <path d={parabrisas} fill="url(#mapa-ventana)" stroke={M.faldonBorde} strokeOpacity={0.5} strokeWidth={0.5} />
    </>
  );
}

/** El volumen de un bloque, dibujado en su lugar (z0 = 0): despegar es una
 * traslación del grupo que lo contiene. `alto` es la altura de la tapa. */
const Cuerpo = memo(function Cuerpo({
  bloque,
  material,
  alto,
  pintado,
  libre,
  detalle,
  conApodo,
}: {
  bloque: Bloque;
  material: Material;
  alto: number;
  pintado: boolean;
  libre: boolean;
  detalle: boolean;
  conApodo: boolean;
}) {
  if (bloque.tipo === "contenedor") return cuerpoConteiner(bloque, material, alto, pintado, libre);
  if (bloque.tipo === "local") return cuerpoLocal(bloque, material, alto, pintado, libre);
  if (bloque.tipo === "galpon") return cuerpoGalpon(bloque, material, alto, pintado, libre);
  if (bloque.tipo === "cochera") return cuerpoCochera(bloque, material, alto, libre);
  if (bloque.tipo === "quinta") return cuerpoQuinta(bloque, material, alto, libre);
  return cuerpoPuesto(bloque, material, alto, pintado, libre, detalle, conApodo);
});

type TextoPlano = {
  k: string;
  x: number;
  y: number;
  t: string;
  tam: number;
  clase: ClaseTexto;
  grosor: number;
  opacidad?: number;
  espaciado?: number;
  /** Apodo (más angosto por carácter). */
  apodo?: boolean;
};

const APODO = { k: "apodo", clase: "apodo", grosor: 2.5, opacidad: 0.9, apodo: true } as const;

/** En una columna (plano girado), el puesto que lleva el apodo debajo de su número:
 * el último (el de abajo) que tenga alto para dos líneas. */
function anfitrionApodo(b: Bloque): Espacio | null {
  for (let i = b.espacios.length - 1; i >= 0; i--) {
    const e = b.espacios[i];
    if (e.tipo !== "contenedor" && !e.medio && e.h >= 36) return e;
  }
  return null;
}

/** Números de una columna de puestos (plano girado): cada uno centrado en su parte y
 * el apodo debajo del número del último, dentro de ese puesto (no pisa otros números). */
function textosColumna(
  b: Bloque,
  zt: number,
  detalle: boolean,
  etiqueta: string | null,
  atenuado: boolean
): TextoPlano[] {
  const out: TextoPlano[] = [];
  const anfitrion = detalle && etiqueta !== null && !atenuado ? anfitrionApodo(b) : null;
  // La columna es angosta (un puesto de ancho): el apodo usa toda la tapa, baja a 8,5 u
  // y, si no entra, va en dos renglones (el número sube para dejarles lugar).
  const apodo =
    anfitrion && etiqueta !== null
      ? apodoEnLineas(etiqueta, anfitrion.w - 4, { minimo: 8.5, dosLineas: anfitrion.h >= 44 })
      : null;
  const dos = apodo !== null && apodo.lineas.length > 1;
  for (const e of b.espacios) {
    const ecx = e.x + e.w / 2;
    const [nx, ny] = P(ecx, e === anfitrion ? e.y + e.h * (dos ? 0.3 : 0.4) : e.y + e.h / 2 + 0.5, zt);
    if (e.tipo === "bar") {
      out.push({ k: e.id, x: nx, y: ny, t: e.numero ?? "Bar", tam: 18, clase: "rot", grosor: 3 });
    } else if (e.medio && e.w > e.h) {
      // Medio puesto acostado: número y "½" en una línea ("34½").
      const t = `${e.numero ?? "?"}½`;
      out.push({
        k: e.id,
        x: nx,
        y: ny,
        t,
        tam: f(Math.min(15, (e.w - 8) / (t.length * 0.62), e.h * 0.75)),
        clase: "num",
        grosor: 2.5,
        espaciado: -0.3,
      });
    } else if (e.medio) {
      const [mx, my] = P(ecx, e.y + e.h * 0.38, zt);
      const [hx, hy] = P(ecx, e.y + e.h * 0.7, zt);
      out.push({ k: e.id, x: mx, y: my, t: e.numero ?? "?", tam: 15, clase: "num", grosor: 2.5, espaciado: -0.3 });
      out.push({ k: `${e.id}:½`, x: hx, y: hy, t: "½", tam: 12, clase: "apodo", grosor: 2.5, opacidad: 0.85 });
    } else {
      out.push({
        k: e.id,
        x: nx,
        y: ny,
        t: e.numero ?? "?",
        // La profundidad del puesto (lo que en el plano tal cual es el alto) es el ancho.
        tam: e.tipo === "local" || e.w < 45 ? 19 : 22,
        clase: "num",
        grosor: 3,
        opacidad: e.numero === null ? 0.7 : undefined,
      });
    }
  }
  if (anfitrion && apodo) {
    const y0 = anfitrion.y + anfitrion.h * (dos ? 0.6 : 0.76);
    apodo.lineas.forEach((t, i) => {
      const [ax, ay] = P(anfitrion.x + anfitrion.w / 2, y0 + i * apodo.tam * INTERLINEA_APODO, zt);
      out.push({ ...APODO, k: i === 0 ? APODO.k : `${APODO.k}${i}`, x: ax, y: ay, t, tam: apodo.tam });
    });
  }
  return out;
}

/** Números y apodos de un bloque, a la altura zt (proyectados, horizontales). */
function textosBloque(
  b: Bloque,
  zt: number,
  detalle: boolean,
  etiqueta: string | null,
  atenuado: boolean
): TextoPlano[] {
  const { x, y, w, h } = b.rect;
  const out: TextoPlano[] = [];
  const e0 = b.espacios[0];
  if (b.tipo === "cochera" || b.tipo === "quinta") {
    // Números chicos: solo con zoom (de lejos alcanza el color). En el techo del auto,
    // en la lona de la camioneta o, si no hay vehículo, pintados en el piso.
    if (!detalle) return out;
    const t = e0.numero ?? "?";
    const techo = zt > ALT.piso ? techoVehiculo(b) : null;
    const r = techo?.r ?? { x: x + 2, y: y + 2, w: w - 4, h: h - 4 };
    const [cx, cy] = P(r.x + r.w / 2, r.y + r.h / 2, zt + (techo?.dz ?? 0));
    const tope = b.tipo === "cochera" ? 12 : 10;
    out.push({
      k: e0.id,
      x: cx,
      y: cy + 0.3,
      t,
      tam: f(Math.min(tope, (r.w - 1.5) / (t.length * 0.62), r.h * 0.8)),
      clase: "num",
      grosor: 1.8,
      espaciado: -0.2,
    });
    return out;
  }
  if (b.tipo === "contenedor") {
    // Caja angosta: el número solo (el nombre está en el cartel del mouse y la tarjeta).
    const [cx, cy] = P(x + w / 2, y + h / 2, zt);
    out.push({ k: e0.id, x: cx, y: cy + 0.5, t: e0.numero ?? "?", tam: f(Math.min(17, Math.min(w, h) * 0.56)), clase: "num", grosor: 2.5 });
    return out;
  }
  // El subgalpón es una caja sola: número y nota (o apodo) como un puesto de la fila.
  if (b.eje === "y" && b.tipo !== "galpon") return textosColumna(b, zt, detalle, etiqueta, atenuado);
  const apodo =
    detalle && etiqueta !== null && h >= 36 && !atenuado && !b.espacios.every((e) => e.medio)
      ? // Dos renglones solo en una tapa alta (puesto de 52 u) y sin medio puesto (su "½"
        // va a la altura del segundo renglón). El número sube para dejarles lugar.
        apodoEnLineas(etiqueta, w - 4, { dosLineas: h >= 48 && !b.espacios.some((e) => e.medio) })
      : null;
  const dos = apodo !== null && apodo.lineas.length > 1;
  for (const e of b.espacios) {
    const ecx = e.x + e.w / 2;
    const [nx, ny] = P(ecx, apodo ? y + h * (dos ? 0.33 : 0.4) : y + h / 2 + 0.5, zt);
    if (e.tipo === "bar") {
      out.push({ k: e.id, x: nx, y: ny, t: e.numero ?? "Bar", tam: 18, clase: "rot", grosor: 3 });
    } else if (e.medio) {
      const [mx, my] = P(ecx, y + h * 0.38, zt);
      const [hx, hy] = P(ecx, y + h * 0.7, zt);
      out.push({ k: e.id, x: mx, y: my, t: e.numero ?? "?", tam: 15, clase: "num", grosor: 2.5, espaciado: -0.3 });
      out.push({ k: `${e.id}:½`, x: hx, y: hy, t: "½", tam: 12, clase: "apodo", grosor: 2.5, opacidad: 0.85 });
    } else {
      out.push({
        k: e.id,
        x: nx,
        y: ny,
        t: e.numero ?? "?",
        tam: e.tipo === "local" || h < 45 ? 19 : 22,
        clase: "num",
        grosor: 3,
        opacidad: e.numero === null ? 0.7 : undefined,
      });
    }
  }
  if (apodo) {
    const y0 = y + h * (dos ? 0.635 : 0.76);
    apodo.lineas.forEach((t, i) => {
      const [ax, ay] = P(x + w / 2, y0 + i * apodo.tam * INTERLINEA_APODO, zt);
      out.push({ ...APODO, k: i === 0 ? APODO.k : `${APODO.k}${i}`, x: ax, y: ay, t, tam: apodo.tam });
    });
  }
  return out;
}

/** Números de un bloque: capa propia, encima de todos los cuerpos. */
const Numeros = memo(function Numeros({
  bloque,
  material,
  zt,
  detalle,
  etiqueta,
  atenuado,
}: {
  bloque: Bloque;
  material: Material;
  /** Altura de los números con el bloque en su lugar (z0 = 0). */
  zt: number;
  detalle: boolean;
  etiqueta: string | null;
  atenuado: boolean;
}) {
  const M = MAT[material];
  return (
    <>
      {textosBloque(bloque, zt, detalle, etiqueta, atenuado).map((t) => (
        <Texto
          key={t.k}
          x={t.x}
          y={t.y}
          t={t.t}
          clase={t.clase}
          tam={t.tam}
          fill={M.texto}
          halo={M.halo}
          grosorHalo={t.grosor}
          opacidad={t.opacidad}
          espaciado={t.espaciado}
        />
      ))}
    </>
  );
});

/** Banderín azul en la esquina de la tapa de cada puesto propio de la cooperativa (C3):
 * mástil + paño, con halo blanco para leerse sobre cualquier estado. Con zoom, si la tapa
 * no lleva apodo, además la micro-etiqueta "Propio". Va en la capa de números: se mueve
 * con el bloque (hover, selección) y queda arriba de todos los cuerpos. */
const Banderines = memo(function Banderines({
  bloque,
  alto,
  detalle,
  conApodo,
  atenuado,
}: {
  bloque: Bloque;
  /** Altura de la tapa con el bloque en su lugar (z0 = 0). */
  alto: number;
  detalle: boolean;
  conApodo: boolean;
  atenuado: boolean;
}) {
  const propios = bloque.espacios.filter((e) => e.propio);
  if (propios.length === 0) return null;
  // En una columna (plano girado) el apodo ocupa solo el puesto de abajo.
  const columna = bloque.eje === "y";
  const anfitrion = columna && conApodo ? anfitrionApodo(bloque) : null;
  return (
    <g opacity={atenuado ? 0.5 : undefined}>
      {propios.map((e) => {
        const x0 = e.x + 5;
        const y0 = e.y + 4;
        const base = P(x0, y0, alto);
        const tope = P(x0, y0, alto + 13);
        const punta = P(x0 + 9, y0, alto + 10);
        const bajo = P(x0, y0, alto + 7);
        const pano = `M${pt(tope)}L${pt(punta)}L${pt(bajo)}Z`;
        const etiqueta = columna
          ? detalle && e !== anfitrion && e.h >= 36 && bloque.tipo === "puesto"
          : detalle && !conApodo && bloque.rect.h >= 36 && bloque.tipo === "puesto";
        const [lx, ly] = P(e.x + e.w / 2, e.y + (columna ? e.h : bloque.rect.h) * 0.8, alto);
        return (
          <g key={e.id}>
            <path d={`M${pt(base)}L${pt(tope)}`} stroke="#fff" strokeWidth={3.2} strokeLinecap="round" />
            <path d={pano} fill="#fff" stroke="#fff" strokeWidth={2.4} strokeLinejoin="round" />
            <path d={`M${pt(base)}L${pt(tope)}`} stroke={BANDERA.mastil} strokeWidth={1.3} strokeLinecap="round" />
            <path d={pano} fill={BANDERA.pano} />
            {etiqueta ? (
              <Texto x={lx} y={ly} t="Propio" clase="apodo" tam={8.5} fill={BANDERA.pano} halo="#fff" grosorHalo={2.2} />
            ) : null}
          </g>
        );
      })}
    </g>
  );
});

export type AccionesEspacio = {
  alTocar: (espacio: Espacio, bloque: Bloque) => void;
  alEntrar: (espacio: Espacio, bloque: Bloque, ev: React.PointerEvent) => void;
  alSalir: () => void;
  /** Foco con teclado: el bloque despega y el plano se mueve para mostrarlo. */
  alEnfocar: (espacio: Espacio, bloque: Bloque, ev: React.FocusEvent<SVGGElement>) => void;
  alDesenfocar: () => void;
  describir: (espacio: Espacio) => string;
};

/** Zona táctil de un espacio: la envolvente proyectada (el dedo apunta al
 * número, que está sobre la tapa elevada). Transparente. */
const ZonaTactil = memo(function ZonaTactil({
  espacio: e,
  bloque: b,
  zTop,
  acciones,
}: {
  espacio: Espacio;
  bloque: Bloque;
  zTop: number;
  acciones: AccionesEspacio;
}) {
  const env = envolvente(e, zTop);
  return (
    <g
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
      onFocus={(ev) => acciones.alEnfocar(e, b, ev)}
      onBlur={acciones.alDesenfocar}
      data-espacio={e.id}
    >
      <rect
        x={f(env.x)}
        y={f(env.y)}
        width={f(env.w)}
        height={f(env.h)}
        fill="transparent"
      />
    </g>
  );
});

/** Todos los bloques en orden del pintor: sombras y huellas → cuerpos →
 * números → zonas táctiles (una por espacio: en un bloque de 4 puestos se
 * puede tocar cada uno). */
export const CapaBloques = memo(function CapaBloques({
  bloques,
  estilos,
  detalle,
  resaltado,
  foco,
  acciones,
}: {
  bloques: Bloque[];
  estilos: Map<string, EstiloBloque>;
  detalle: boolean;
  /** Clave del bloque bajo el puntero. */
  resaltado: string | null;
  /** Espacio con foco de teclado. */
  foco: string | null;
  acciones: AccionesEspacio;
}) {
  // Orden del pintor: base sur (y + h) ascendente y, a igual valor, de oeste a este.
  const orden = useMemo(
    () => [...bloques].sort((a, b) => a.rect.y + a.rect.h - (b.rect.y + b.rect.h) || a.rect.x - b.rect.x),
    [bloques]
  );
  const alturas = useMemo(() => {
    const m = new Map<string, Alturas>();
    for (const b of orden) {
      const estilo = estilos.get(b.clave);
      if (!estilo) continue;
      m.set(
        b.clave,
        alturaDe(b, estilo, {
          hover: resaltado === b.clave,
          foco: foco !== null && b.espacios.some((e) => e.id === foco),
        })
      );
    }
    return m;
  }, [orden, estilos, resaltado, foco]);
  // Las sombras no siguen al hover: son un par de trazos que cubren todo el plano y
  // cambiarlos obligaba a redibujarlo entero con cada puesto que pasaba el mouse. El
  // bloque igual despega (4 u) y lleva su contorno; selección y foco sí mueven la sombra.
  const alturasSombra = useMemo(() => {
    const m = new Map<string, Alturas>();
    for (const b of orden) {
      const estilo = estilos.get(b.clave);
      if (!estilo) continue;
      m.set(b.clave, alturaDe(b, estilo, { hover: false, foco: foco !== null && b.espacios.some((e) => e.id === foco) }));
    }
    return m;
  }, [orden, estilos, foco]);
  const sombras = useMemo(() => sombrasBloques(orden, alturasSombra), [orden, alturasSombra]);

  return (
    <g>
      <g aria-hidden>
        {sombras.map((s) => (
          <path key={s.k} d={s.d} fill={TINTA_SOMBRA} fillOpacity={s.opacidad} />
        ))}
        {orden.map((b) => {
          const marca = estilos.get(b.clave)?.marca ?? null;
          return marca ? <Huella key={b.clave} bloque={b} marca={marca} /> : null;
        })}
      </g>
      <g aria-hidden>
        {orden.map((b) => {
          const al = alturas.get(b.clave);
          const estilo = estilos.get(b.clave);
          if (!al || !estilo) return null;
          return (
            <g key={b.clave} data-bloque={b.clave} className={claseMov(estilo)} style={mover(al.z0)}>
              <Cuerpo
                bloque={b}
                material={al.material}
                alto={al.zTop - al.z0}
                pintado={al.pintado}
                libre={al.libre}
                detalle={detalle}
                conApodo={detalle && estilo.etiqueta !== null && b.rect.h >= 36 && !estilo.atenuado}
              />
            </g>
          );
        })}
      </g>
      <g aria-hidden>
        {orden.map((b) => {
          const al = alturas.get(b.clave);
          const estilo = estilos.get(b.clave);
          if (!al || !estilo) return null;
          return (
            <g key={b.clave} className={claseMov(estilo)} style={mover(al.z0)}>
              <Numeros
                bloque={b}
                material={al.material}
                zt={al.zTexto - al.z0}
                detalle={detalle}
                etiqueta={estilo.etiqueta}
                atenuado={estilo.atenuado}
              />
              <Banderines
                bloque={b}
                alto={al.zTop - al.z0}
                detalle={detalle}
                conApodo={detalle && estilo.etiqueta !== null && b.rect.h >= 36 && !estilo.atenuado}
                atenuado={estilo.atenuado}
              />
            </g>
          );
        })}
      </g>
      <g>
        {orden.flatMap((b) => {
          const al = alturas.get(b.clave);
          if (!al) return [];
          return b.espacios.map((e) => (
            <ZonaTactil key={e.id} espacio={e} bloque={b} zTop={al.zTop} acciones={acciones} />
          ));
        })}
      </g>
    </g>
  );
});

// ---------- Anillos (sobre la tapa elevada, arriba de todo) + pastilla ----------

export type Anillo = {
  /** Bloque al que pertenece: el anillo despega con él. */
  clave: string;
  /** Huella que rodea (el bloque o uno de sus espacios). */
  rect: Rect;
  forma: "rect" | "elipse";
  /** `focoSel`: foco de teclado sobre un espacio que ya tiene anillo de selección. */
  tono: "seleccion" | "pincel" | "aviso" | "foco" | "focoSel" | "hover";
  /** Traslación del bloque (el anillo se anima con él). */
  z0: number;
  /** Altura de la tapa que rodea. */
  zTop: number;
  /** Radio de las esquinas de la tapa. */
  r: number;
};

export function anilloDe(b: Bloque, rect: Rect, tono: Anillo["tono"], al: Alturas): Anillo {
  return {
    clave: b.clave,
    rect,
    forma: "rect",
    tono,
    z0: al.z0,
    zTop: al.zTop,
    r: radioTapa(b),
  };
}

type CapaAnillo = { color: string; ancho: number; opacidad?: number; trazos?: string };

/** Margen y capas de cada tono (blanca abajo, color encima): medidos para que
 * dos anillos vecinos no se pisen ni tapen el número del vecino. */
const TONO_ANILLO: Record<Anillo["tono"], { m: number; capas: CapaAnillo[] }> = {
  seleccion: {
    m: 2.5,
    capas: [
      { color: "#fff", ancho: 5, opacidad: 0.95 },
      { color: "var(--primary)", ancho: 2.2 },
    ],
  },
  pincel: {
    m: 1,
    capas: [
      { color: "#fff", ancho: 4.2, opacidad: 0.9 },
      { color: "var(--primary)", ancho: 2.4 },
    ],
  },
  aviso: {
    m: 0.6,
    capas: [
      { color: "#fff", ancho: 4, opacidad: 0.85 },
      { color: "var(--parcial)", ancho: 2.4, trazos: "5 3.5" },
    ],
  },
  foco: {
    m: 2,
    capas: [
      { color: "#fff", ancho: 6 },
      { color: "var(--primary)", ancho: 2.4 },
    ],
  },
  // El foco de "foco" taparía la selección y se vería igual: va por fuera de
  // ella (su trazo blanco empieza donde termina el de la selección).
  focoSel: {
    m: 7,
    capas: [
      { color: "#fff", ancho: 5 },
      { color: "var(--ring)", ancho: 2.4 },
    ],
  },
  hover: { m: 0, capas: [{ color: "var(--primary)", ancho: 1.6, opacidad: 0.55 }] },
};

/** Un anillo dibujado con el bloque en su lugar: la traslación la pone el
 * `<g>` de su bloque en `Anillos`. */
function AnilloTapa({ anillo: a }: { anillo: Anillo }) {
  const { m, capas } = TONO_ANILLO[a.tono];
  const alto = a.zTop - a.z0;
  const tx = a.rect.x - K * alto;
  const ty = a.rect.y - alto;
  return (
    <>
      {capas.map((c, i) =>
        a.forma === "elipse" ? (
          <ellipse
            key={i}
            cx={f(tx + a.rect.w / 2)}
            cy={f(ty + a.rect.h / 2)}
            rx={f(a.rect.w / 2 + m)}
            ry={f(a.rect.h / 2 + m)}
            fill="none"
            stroke={c.color}
            strokeWidth={c.ancho}
            strokeOpacity={c.opacidad}
            strokeDasharray={c.trazos}
          />
        ) : (
          <rect
            key={i}
            x={f(tx - m)}
            y={f(ty - m)}
            width={f(a.rect.w + 2 * m)}
            height={f(a.rect.h + 2 * m)}
            rx={f(a.r + m)}
            fill="none"
            stroke={c.color}
            strokeWidth={c.ancho}
            strokeOpacity={c.opacidad}
            strokeDasharray={c.trazos}
          />
        )
      )}
    </>
  );
}

/** Lo que dice la pastilla de la selección: "Don Pedro · 4 puestos · al día". `corto`
 * ("Don Pedro") es lo que dice si el texto entero taparía números de otros puestos. */
export type DatosPastilla = { texto: string; corto?: string; estado: EstadoCobro };

export type Pastilla = DatosPastilla & {
  tam: number;
  cx: number;
  cy: number;
  ancho: number;
  alto: number;
  lado: "arriba" | "abajo";
  /** x del pico: el centro de la tapa del ancla. */
  acx: number;
  /** Huella del bloque al que apunta. */
  ancla: Rect;
};

/** Ancho de un texto de la pastilla (Nunito 800) a un tamaño dado. */
export type MedirTexto = (texto: string, tam: number) => number;

/** Ubica la pastilla sobre (o bajo) el bloque seleccionado más al norte: entre
 * 10 candidatas, la que menos tapa números ajenos y tapas seleccionadas sin
 * salirse del predio. */
export function ubicarPastilla(
  datos: DatosPastilla | null,
  bloques: Bloque[],
  estilos: Map<string, EstiloBloque>,
  detalle: boolean,
  lim: Rect,
  medir: MedirTexto | null
): Pastilla | null {
  if (!datos) return null;
  type Caja = [number, number, number, number];
  const sel: { b: Bloque; zTop: number }[] = [];
  const numeros: Caja[] = [];
  for (const b of bloques) {
    const estilo = estilos.get(b.clave);
    if (!estilo) continue;
    // En reposo: la pastilla no se mueve con el hover.
    const al = alturaDe(b, estilo, REPOSO);
    if (estilo.marca === "seleccion") {
      sel.push({ b, zTop: al.zTop });
      continue;
    }
    for (const t of textosBloque(b, al.zTexto, detalle, estilo.etiqueta, estilo.atenuado)) {
      const an = t.apodo ? anchoApodo(t.t, t.tam) : t.t.length * 0.6 * t.tam;
      const at = 0.74 * t.tam;
      numeros.push([t.x - an / 2, t.y - at / 2, t.x + an / 2, t.y + at / 2]);
    }
  }
  if (sel.length === 0) return null;
  // Dos tamaños, por el umbral de detalle (nunca por la escala continua).
  const tam = detalle ? 12.5 : 17;
  const anchoDe = (texto: string) => (medir ? medir(texto, tam) : texto.length * 0.56 * tam) + tam * 2.6;
  // Primero el texto entero; el corto compite solo si el entero tapa algo (en el celular,
  // con el plano girado, "Los Fernández · 4 puestos · debe el mes" cruzaba tres columnas).
  const textos = datos.corto && datos.corto !== datos.texto ? [datos.texto, datos.corto] : [datos.texto];
  const alto = tam * 1.75;
  const u = tam / 20;
  const pico = 7 * u;
  const sep = 2.5;
  const ancla = sel.reduce((a, s) =>
    s.b.rect.y < a.b.rect.y || (s.b.rect.y === a.b.rect.y && s.b.rect.x < a.b.rect.x) ? s : a
  );
  const { x, y, w, h } = ancla.b.rect;
  const ty = y - ancla.zTop;
  const acx = x - K * ancla.zTop + w / 2;
  const tapas: Caja[] = sel.map(({ b, zTop }) => [
    b.rect.x - K * zTop - 4,
    b.rect.y - zTop - 4,
    b.rect.x + b.rect.w + 4,
    b.rect.y + b.rect.h + 4,
  ]);
  const pisa = (r: Caja, o: Caja) =>
    Math.max(0, Math.min(r[2], o[2]) - Math.max(r[0], o[0])) * Math.max(0, Math.min(r[3], o[3]) - Math.max(r[1], o[1]));
  // Plano girado (pantalla parada): la columna es angosta y, corrida al costado, la
  // pastilla quedaría fuera de cámara al enfocar la selección (la cámara deja 140 u a
  // cada lado); y va arriba, porque el detalle sube desde abajo y la taparía.
  const columna = ancla.b.eje === "y";
  const alcance = columna ? w / 2 + 140 : Number.POSITIVE_INFINITY;
  let mejor: { cx: number; cy: number; lado: "arriba" | "abajo"; pen: number; texto: string; ancho: number } | null =
    null;
  let orden = 0;
  for (const [i, texto] of textos.entries()) {
    const ancho = anchoDe(texto);
    for (const lado of ["arriba", "abajo"] as const) {
      for (const corrimiento of [0, -1, 1, -2, 2]) {
        const cx = acx + (corrimiento * (ancho / 2 - 14 * u)) / 2;
        const cy = lado === "arriba" ? ty - sep - pico - alto / 2 : y + h + 4 + sep + pico + alto / 2;
        const r: Caja = [cx - ancho / 2, cy - alto / 2, cx + ancho / 2, cy + alto / 2];
        let pen =
          numeros.reduce((s, o) => s + pisa(r, o), 0) * 10 + tapas.reduce((s, o) => s + pisa(r, o), 0) * 20;
        if (r[0] < lim.x || r[2] > lim.x + lim.w || r[1] < lim.y || r[3] > lim.y + lim.h) pen += 1e6;
        if (acx - r[0] > alcance || r[2] - acx > alcance) pen += 1e5;
        if (columna && lado === "abajo") pen += 5e4;
        // El corto pierde información: gana solo si evita tapar más que un roce (~40 u²).
        if (i > 0) pen += 400;
        pen += orden++ * 0.01; // a igual puntaje, el orden de preferencia
        if (!mejor || pen < mejor.pen) mejor = { cx, cy, lado, pen, texto, ancho };
      }
    }
  }
  if (!mejor) return null;
  return {
    ...datos,
    texto: mejor.texto,
    tam,
    cx: mejor.cx,
    cy: mejor.cy,
    ancho: mejor.ancho,
    alto,
    lado: mejor.lado,
    acx,
    ancla: ancla.b.rect,
  };
}

function PastillaSeleccion({ p }: { p: Pastilla }) {
  const u = p.tam / 20;
  const x0 = p.cx - p.ancho / 2;
  const y0 = p.cy - p.alto / 2;
  // El pico siempre apunta al centro de la tapa del ancla.
  const base = p.lado === "arriba" ? p.cy + p.alto / 2 - 1 : p.cy - p.alto / 2 + 1;
  const punta = p.lado === "arriba" ? p.cy + p.alto / 2 + 7 * u : p.cy - p.alto / 2 - 7 * u;
  return (
    <g>
      <rect
        x={f(x0 + 1.5 * u)}
        y={f(y0 + 3 * u)}
        width={f(p.ancho)}
        height={f(p.alto)}
        rx={f(p.alto / 2)}
        fill={TINTA_SOMBRA}
        fillOpacity={0.18}
      />
      <rect x={f(x0)} y={f(y0)} width={f(p.ancho)} height={f(p.alto)} rx={f(p.alto / 2)} fill="var(--primary)" />
      <path
        d={`M${f(p.acx - 7 * u)} ${f(base)}L${f(p.acx)} ${f(punta)}L${f(p.acx + 7 * u)} ${f(base)}Z`}
        fill="var(--primary)"
      />
      <circle
        cx={f(x0 + p.tam * 0.95)}
        cy={f(p.cy)}
        r={f(p.tam * 0.3)}
        fill={PUNTO_ESTADO[p.estado]}
        stroke="#fff"
        strokeWidth={f(1.2 * u)}
      />
      <Texto x={p.cx + p.tam * 0.45} y={p.cy + 0.5} t={p.texto} clase="rot" tam={p.tam} fill="#fff" />
    </g>
  );
}

export const Anillos = memo(function Anillos({
  anillos,
  pastilla,
}: {
  anillos: Anillo[];
  pastilla: Pastilla | null;
}) {
  // Un `<g>` por bloque con la traslación del bloque: un anillo que aparece en
  // un bloque que ya tenía otro (hover sobre el seleccionado) entra en su
  // lugar, y ambos acompañan la transición del cuerpo. Un bloque sin anillos
  // está en reposo (todo despegue lleva anillo), así que el `<g>` nuevo entra
  // desde z0 = 0 con la animación de `.mapa-mov-entra`.
  const grupos = new Map<string, Anillo[]>();
  for (const a of anillos) {
    const g = grupos.get(a.clave);
    if (g) g.push(a);
    else grupos.set(a.clave, [a]);
  }
  return (
    <g aria-hidden>
      <g pointerEvents="none">
        {[...grupos].map(([clave, lista]) => (
          <g key={clave} className="mapa-mov mapa-mov-entra" style={mover(lista[0].z0)}>
            {lista.map((a) => (
              <AnilloTapa key={`${a.tono}:${a.rect.x}:${a.rect.y}`} anillo={a} />
            ))}
          </g>
        ))}
      </g>
      {/* La pastilla recibe el puntero: tocarla no selecciona lo que tiene debajo
          ni limpia la selección (el lienzo la ignora). */}
      {pastilla ? (
        <g data-pastilla="" className="cursor-default">
          <PastillaSeleccion p={pastilla} />
        </g>
      ) : null}
    </g>
  );
});

// ---------- Quinteros: fichas sobre los canteros ----------

export type FichaQuintero = {
  clienteId: string;
  texto: string;
  estado: EstadoBloque;
  rect: Rect;
  atenuado: boolean;
  /** Cliente seleccionado: la ficha despega. */
  seleccionado: boolean;
  /** Pincel de asignar: borde de color, sin despegar (el pincel no levanta). */
  pincel: boolean;
  /** Tamaño del nombre si no es el de siempre (cantero angosto del plano girado). */
  tam?: number;
};

/** Pastilla baja sobre el cantero (base en zb, tapa 4 u más arriba). */
function cuerpoFicha(rect: Rect, mat: Material, zb: number, destacada: boolean): ReactNode {
  const { x, y, w, h } = rect;
  const M = MAT[mat];
  const r = h / 2;
  const zt = zb + ALT.ficha;
  const sur = caraSur(x, y, w, h, r, zt, zb);
  const [fx, fy] = P(x, y, zt);
  return (
    <>
      <path d={caraEste(x, y, w, h, r, zt, zb)} fill={M.lado} />
      <path d={sur} fill={mat === "neutro" || mat === "libre" ? M.frente : `url(#mapa-faldon-${mat})`} />
      {mat === "debe" ? <path d={sur} fill="url(#mapa-rayas-debe)" /> : null}
      <rect
        x={f(fx)}
        y={f(fy)}
        width={f(w)}
        height={h}
        rx={r}
        fill={`url(#mapa-tapa-${mat})`}
        stroke={destacada ? "var(--primary)" : M.bisel}
        strokeWidth={destacada ? 2.2 : M.grosor}
      />
    </>
  );
}

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
  const zTapa = ALT.cantero + ALT.ficha;
  return (
    <g>
      {restos.map((r) => (
        <g key={`${r.rect.x}:${r.rect.y}`} aria-hidden>
          {cuerpoFicha(r.rect, "libre", ALT.cantero, false)}
          <Texto
            x={r.rect.x - K * zTapa + r.rect.w / 2}
            y={r.rect.y - zTapa + r.rect.h / 2}
            t={`+${r.n}`}
            tam={10.5}
            fill={MAT.libre.texto}
          />
        </g>
      ))}
      {fichas.map((ficha) => {
        // Atenuada: sin pintura (sin opacity de grupo). Seleccionada: despega.
        const mat: Material = ficha.atenuado ? "neutro" : ficha.estado;
        const zb = ALT.cantero + (ficha.seleccionado ? ALT.fichaSel : 0);
        const [fx, fy] = P(ficha.rect.x, ficha.rect.y, zb + ALT.ficha);
        return (
          <g
            key={ficha.clienteId}
            role="button"
            tabIndex={0}
            data-ficha={ficha.clienteId}
            aria-label={describir(ficha.clienteId)}
            className="mapa-foco cursor-pointer outline-none"
            onClick={() => alTocar(ficha.clienteId)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                alTocar(ficha.clienteId);
              }
            }}
          >
            {cuerpoFicha(ficha.rect, mat, zb, ficha.seleccionado || ficha.pincel)}
            {/* Foco de teclado (solo con :focus-visible): anillo doble por fuera
                de la tapa, como el "foco" de los espacios. */}
            <g className="mapa-ficha-foco">
              {[
                { color: "#fff", ancho: 6 },
                { color: "var(--ring)", ancho: 2.4 },
              ].map((c) => (
                <rect
                  key={c.ancho}
                  x={f(fx - 2)}
                  y={f(fy - 2)}
                  width={f(ficha.rect.w + 4)}
                  height={f(ficha.rect.h + 4)}
                  rx={f(ficha.rect.h / 2 + 2)}
                  fill="none"
                  stroke={c.color}
                  strokeWidth={c.ancho}
                />
              ))}
            </g>
            <Texto
              x={fx + ficha.rect.w / 2}
              y={fy + ficha.rect.h / 2}
              t={ficha.texto}
              clase="apodo"
              tam={ficha.tam ?? 10.5}
              fill={MAT[mat].texto}
            />
          </g>
        );
      })}
    </g>
  );
});

/** Ficha "+N": los quinteros que no entraron en su zona. */
export type Resto = { rect: Rect; n: number };

/** Cantero angosto (el plano girado lo deja parado): una ficha por renglón, de lado a
 * lado, con el nombre achicado antes de recortarlo. */
const CANTERO_ANGOSTO = 160;

/** Reparte fichas de quinteros en filas dentro de una zona. Si no entran
 * todos, la última ficha pasa a ser "+N" (los demás se encuentran buscando). */
export function repartirFichas(
  zona: Rect,
  textos: { clienteId: string; texto: string }[]
): { fichas: { clienteId: string; texto: string; rect: Rect; tam?: number }[]; resto: Resto | null } {
  const alto = 22;
  const gap = 6;
  const angosto = zona.w < CANTERO_ANGOSTO;
  const pad = angosto ? 8 : 12;
  const anchoResto = 46;
  const inicioY = zona.y + 36;
  const maxX = zona.x + zona.w - pad;
  const maxY = zona.y + zona.h - 8;
  const fichas: { clienteId: string; texto: string; rect: Rect; tam?: number }[] = [];
  let cx = zona.x + pad;
  let cy = inicioY;
  for (const t of textos) {
    const ajustado = angosto ? apodoAjustado(t.texto, zona.w - pad * 2 - 12, 8.5) : null;
    const texto = ajustado ? ajustado.t : recortar(t.texto, zona.w - pad * 2 - 20, 10.5);
    const w = angosto ? zona.w - pad * 2 : Math.min(zona.w - pad * 2, Math.max(52, texto.length * 6.1 + 20));
    if (cx + w > maxX) {
      cx = zona.x + pad;
      cy += alto + gap;
    }
    if (cy + alto > maxY) break;
    fichas.push(
      ajustado
        ? { clienteId: t.clienteId, texto, rect: { x: cx, y: cy, w, h: alto }, tam: ajustado.tam }
        : { clienteId: t.clienteId, texto, rect: { x: cx, y: cy, w, h: alto } }
    );
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
