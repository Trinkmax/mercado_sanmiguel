"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { LUGARES_PLANO, ZONAS_PLANO, type FilaPlano } from "./silueta-plano";

/**
 * El mercado desde el aire, con los lugares del socio prendidos en el color de su cuenta.
 * La silueta es un archivo (geometría, sin datos de nadie); sus lugares llegan de la base.
 *
 * Rendimiento: cada tipo de lugar es UN solo <path> y no hay filtros ni sombras, así el vuelo
 * de la cámara (cambiar el viewBox cuadro a cuadro) anda en un celular de gama media y en
 * Safari. Los números de los vecinos aparecen recién al aterrizar y solo los que entran en
 * cuadro. Sin JavaScript se ve el mercado entero con los lugares prendidos.
 */

export type LugarPlano = {
  id: string;
  tipo: string;
  /** El número ya listo para leer ("58", "34½"). */
  numero: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type TonoPlano = "al_dia" | "en_termino" | "vencido" | "neutro";

type Rect = { x: number; y: number; w: number; h: number };
type Camara = { cx: number; cy: number; k: number };

/** Todo el predio (unidades del plano). */
const TODO: Rect = { x: 20, y: 20, w: 2050, h: 900 };
const VISTA_TODO = `${TODO.x} ${TODO.y} ${TODO.w} ${TODO.h}`;

/** Píxeles por unidad del plano al aterrizar: en cuadro entran varios vecinos, para ubicarse. */
const ACERCAMIENTO: Record<string, number> = {
  quinta: 1.5,
  cochera: 1.02,
  puesto: 1.02,
  local: 0.95,
  bar: 0.95,
  contenedor: 0.95,
  galpon: 0.85,
  invernadero: 0.62,
};

function rectRedondo({ x, y, w, h }: Rect, radio = 3): string {
  const r = Math.min(radio, w / 2, h / 2);
  const f = (n: number) => Math.round(n * 100) / 100;
  return `M${f(x + r)} ${f(y)}h${f(w - 2 * r)}a${r} ${r} 0 0 1 ${r} ${r}v${f(h - 2 * r)}a${r} ${r} 0 0 1 -${r} ${r}h-${f(w - 2 * r)}a${r} ${r} 0 0 1 -${r} -${r}v-${f(h - 2 * r)}a${r} ${r} 0 0 1 ${r} -${r}z`;
}

function caminoDe(filas: readonly FilaPlano[], tipos: string[], radio = 3): string {
  return filas
    .filter((f) => tipos.includes(f[0]))
    .map((f) => rectRedondo({ x: f[2], y: f[3], w: f[4], h: f[5] }, radio))
    .join("");
}

const CAMINOS = {
  edificios: caminoDe(ZONAS_PLANO, ["nave", "galpon", "recinto"], 8),
  zonasClaras: caminoDe(ZONAS_PLANO, ["cocheras", "quinteros", "administracion"], 5),
  pasillo: caminoDe(ZONAS_PLANO, ["pasillo"], 0),
  puestos: caminoDe(LUGARES_PLANO, ["puesto", "local", "bar", "contenedor", "galpon", "invernadero"]),
  menores: caminoDe(LUGARES_PLANO, ["cochera", "quinta"], 2),
};

/** Carteles fijos del predio: sirven para ubicarse de lejos (de cerca quedarían cortados). */
const ROTULOS: { texto: string; x: number; y: number; rota?: number }[] = [
  { texto: "Administración", x: 1482, y: 406 },
  { texto: "Playa de quintas", x: 575, y: 406 },
  { texto: "Playa de quintas", x: 980, y: 406 },
  { texto: "Pasillo", x: 768, y: 450, rota: -90 },
  { texto: "Cocheras", x: 790, y: 128 },
  { texto: "Cocheras", x: 380, y: 690 },
  { texto: "Cocheras", x: 1170, y: 690 },
  { texto: "Contenedores", x: 1170, y: 796 },
  { texto: "Contenedores", x: 1765, y: 30 },
  { texto: "Locales", x: 1645, y: 730 },
  { texto: "Galpón", x: 1965, y: 30 },
  { texto: "Invernadero", x: 1792, y: 710 },
];

/** La parte quieta del dibujo: no vuelve a renderizar nunca. */
const Silueta = memo(function Silueta() {
  return (
    <>
      <path className="plano-edificios" d={CAMINOS.edificios} />
      <path className="plano-cocheras" d={CAMINOS.zonasClaras} />
      <path className="plano-pasillo" d={CAMINOS.pasillo} />
      <path className="plano-cocheras" d={CAMINOS.menores} />
      <path className="plano-puestos" d={CAMINOS.puestos} />
      <g className="plano-rotulos">
        {ROTULOS.map((r) => (
          <text
            key={`${r.texto}-${r.x}`}
            x={r.x}
            y={r.y}
            transform={r.rota ? `rotate(${r.rota} ${r.x} ${r.y})` : undefined}
          >
            {r.texto}
          </text>
        ))}
      </g>
    </>
  );
});

function unir(rects: Rect[]): Rect {
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w));
  const y1 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Lo que se encuadra de verdad: si los lugares están muy lejos entre sí, los más cercanos al primero. */
function grupoEnCuadro(lugares: LugarPlano[]): LugarPlano[] {
  if (lugares.length <= 1) return lugares;
  const [primero] = lugares;
  const cerca = lugares.filter(
    (l) => Math.abs(l.x - primero.x) < 620 && Math.abs(l.y - primero.y) < 320
  );
  return cerca.length > 0 ? cerca : [primero];
}

function camaraDe(foco: LugarPlano[], w: number, h: number, fx: number, fy: number) {
  const caja = unir(foco);
  // En una pantalla grande se ve más mercado, no un puesto gigante.
  const pantalla = Math.min(1.5, Math.max(1, Math.min(w, h) / 300));
  let k = (ACERCAMIENTO[foco[0]?.tipo ?? "puesto"] ?? 1) * pantalla;
  k = Math.min(k, (w * 0.74) / caja.w, (h * 0.46) / caja.h);
  k = Math.max(k, 0.26);
  return {
    camara: { cx: caja.x + caja.w / 2, cy: caja.y + caja.h / 2, k } as Camara,
    caja,
    /** Dónde cae la chapa: justo debajo de los lugares, en píxeles de la pantalla. */
    chapa: { x: w * fx, y: h * fy + (caja.h / 2) * k + 11 },
  };
}

function vistaDe(c: Camara, w: number, h: number, fx: number, fy: number): string {
  const vw = w / c.k;
  const vh = h / c.k;
  const f = (n: number) => Math.round(n * 100) / 100;
  return `${f(c.cx - fx * vw)} ${f(c.cy - fy * vh)} ${f(vw)} ${f(vh)}`;
}

const suave = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function PlanoPortalBase({
  lugares,
  foco,
  tono,
  etiqueta,
  mostrarChapa = true,
  focoX = 0.5,
  focoY = 0.38,
  demora = 280,
  duracion = 1500,
  className,
}: {
  /** Todos los lugares del socio: van prendidos. */
  lugares: LugarPlano[];
  /** Los que encuadra la cámara (por defecto, los primeros). */
  foco?: LugarPlano[];
  tono: TonoPlano;
  /** Lo que dice la chapa ("Puesto 58"). */
  etiqueta?: string | null;
  mostrarChapa?: boolean;
  /** Dónde queda el lugar en el cuadro (fracción de ancho y alto). */
  focoX?: number;
  focoY?: number;
  demora?: number;
  duracion?: number;
  className?: string;
}) {
  const contRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [aterrizaje, setAterrizaje] = useState<{ chapa: { x: number; y: number }; vista: Rect } | null>(null);


  const enfocados = useMemo(() => {
    const base = foco && foco.length > 0 ? foco : lugares;
    return grupoEnCuadro(base);
  }, [foco, lugares]);
  const clave = enfocados.map((l) => l.id).join(",");

  useEffect(() => {
    const cont = contRef.current;
    const svg = svgRef.current;
    if (!cont || !svg || enfocados.length === 0) return;

    let cuadro = 0;
    let temporizador = 0;

    const aterrizar = (w: number, h: number) => {
      const { camara, chapa } = camaraDe(enfocados, w, h, focoX, focoY);
      svg.setAttribute("viewBox", vistaDe(camara, w, h, focoX, focoY));
      const vw = w / camara.k;
      const vh = h / camara.k;
      setAterrizaje({
        chapa,
        vista: { x: camara.cx - focoX * vw, y: camara.cy - focoY * vh, w: vw, h: vh },
      });
    };

    const { width: w, height: h } = cont.getBoundingClientRect();
    if (w < 10 || h < 10) return;
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducido) {
      aterrizar(w, h);
    } else {
      const { camara: destino } = camaraDe(enfocados, w, h, focoX, focoY);
      // Arranca viendo todo el mercado, sea cual sea el lugar en pantalla.
      const inicio: Camara = {
        cx: TODO.x + TODO.w / 2,
        cy: TODO.y + TODO.h / 2,
        k: Math.min(w / TODO.w, h / TODO.h) * 1.15,
      };
      svg.setAttribute("viewBox", vistaDe(inicio, w, h, 0.5, 0.5));
      temporizador = window.setTimeout(() => {
        const t0 = performance.now();
        const paso = (ahora: number) => {
          const t = Math.min(1, (ahora - t0) / duracion);
          const e = suave(t);
          const k = inicio.k * Math.pow(destino.k / inicio.k, e);
          const fx = 0.5 + (focoX - 0.5) * e;
          const fy = 0.5 + (focoY - 0.5) * e;
          const cam = {
            cx: inicio.cx + (destino.cx - inicio.cx) * e,
            cy: inicio.cy + (destino.cy - inicio.cy) * e,
            k,
          };
          svg.setAttribute("viewBox", vistaDe(cam, w, h, fx, fy));
          if (t < 1) cuadro = requestAnimationFrame(paso);
          else aterrizar(w, h);
        };
        cuadro = requestAnimationFrame(paso);
      }, demora);
    }

    // Girar el celular: sin volar de nuevo, se vuelve a encuadrar.
    let ultimoAncho = w;
    let ultimoAlto = h;
    const obs = new ResizeObserver(([entrada]) => {
      const nuevo = entrada.contentRect;
      if (nuevo.width < 10 || nuevo.height < 10) return;
      if (Math.abs(nuevo.width - ultimoAncho) < 2 && Math.abs(nuevo.height - ultimoAlto) < 2) return;
      ultimoAncho = nuevo.width;
      ultimoAlto = nuevo.height;
      cancelAnimationFrame(cuadro);
      window.clearTimeout(temporizador);
      aterrizar(nuevo.width, nuevo.height);
    });
    obs.observe(cont);

    return () => {
      cancelAnimationFrame(cuadro);
      window.clearTimeout(temporizador);
      obs.disconnect();
    };
    // `clave` resume `enfocados`: el vuelo se repite solo si cambia lo que se encuadra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, focoX, focoY, demora, duracion]);

  const vista = aterrizaje?.vista ?? null;
  const vecinos = useMemo(() => {
    if (!vista) return [];
    const margen = 20;
    return LUGARES_PLANO.filter((f) => {
      if (!f[1]) return false;
      if (f[0] === "cochera" && f[4] < 20) return false;
      const dentro =
        f[2] + f[4] > vista.x - margen &&
        f[2] < vista.x + vista.w + margen &&
        f[3] + f[5] > vista.y - margen &&
        f[3] < vista.y + vista.h + margen;
      if (!dentro) return false;
      // Sus lugares ya llevan su número.
      return !lugares.some((l) => Math.abs(l.x - f[2]) < 1 && Math.abs(l.y - f[3]) < 1);
    });
  }, [vista, lugares]);

  return (
    <div ref={contRef} className={cn("plano", `tono-${tono}`, className)} data-aterrizado={aterrizaje ? "" : undefined} aria-hidden>
      <svg
        ref={svgRef}
        className="plano-svg"
        viewBox={VISTA_TODO}
        preserveAspectRatio="xMidYMid meet"
        focusable="false"
      >
        <Silueta />
        {vecinos.length > 0 ? (
          <g className="plano-numeros">
            {vecinos.map((f) => {
              // El número entra en el lugar: en los angostos, más chico.
              const tamano = Math.min(13.5, (f[4] / Math.max(1, (f[1] ?? "").length)) * 1.05);
              return tamano < 6.5 ? null : (
                <text key={`${f[0]}-${f[2]}-${f[3]}`} x={f[2] + f[4] / 2} y={f[3] + f[5] / 2} style={{ fontSize: tamano }}>
                  {f[1]}
                </text>
              );
            })}
          </g>
        ) : null}
        <g>
          {lugares.map((l) => {
            const r = Math.min(4, l.w / 2, l.h / 2);
            return (
              <g key={l.id}>
                {aterrizaje && enfocados.some((e) => e.id === l.id) ? (
                  <rect className="plano-pulso" x={l.x} y={l.y} width={l.w} height={l.h} rx={r} />
                ) : null}
                <rect className="plano-mio" x={l.x} y={l.y} width={l.w} height={l.h} rx={r} />
                {l.numero ? (
                  <text
                    className="plano-mio-numero"
                    x={l.x + l.w / 2}
                    y={l.y + l.h / 2}
                    fontSize={Math.max(9, Math.min(19, l.w * 0.46, l.h * 0.5))}
                  >
                    {l.numero}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
      {mostrarChapa && etiqueta && aterrizaje ? (
        <div className="plano-chapa" style={{ left: aterrizaje.chapa.x, top: aterrizaje.chapa.y }}>
          <span className="chapa">{etiqueta}</span>
        </div>
      ) : null}
    </div>
  );
}

export const PlanoPortal = memo(PlanoPortalBase);
