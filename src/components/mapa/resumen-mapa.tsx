"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { formatFraccion, formatNumero } from "@/lib/format";
import { Money } from "@/components/shared/money";
import { MAT, RAYAS_DEBE } from "./plano-svg";

/** Estados de cobro que se pueden filtrar en el plano. */
export type FiltroEstado = "al_dia" | "debe" | "vencido" | "libre";
/** Filtro del plano: un estado o los puestos propios de la cooperativa (C3). */
export type Filtro = FiltroEstado | "propio";

/** Colores de la barra de ocupación. */
const BARRA: Record<Exclude<FiltroEstado, "libre">, string> = {
  al_dia: "var(--pagado)",
  debe: "var(--pendiente)",
  vencido: "oklch(0.4 0.15 27)",
};

/** Rayas del frente de la muestra de "debe", inclinadas como en el plano. */
const RAYAS_MUESTRA = [1.5, 4.5, 7.5, 10.5, 13.5].map((x) => `M${x} 11h1.5l1 4h-1.5z`).join("");

/** Cada estado como se ve en el plano (se distinguen por forma, no solo por
 * color): faldón liso verde, faldón a rayas rojo, bloque rojo lleno y lote
 * punteado blanco. Un bloque en relieve chiquito: tapa, frente y costado. */
function MuestraEstado({ estado }: { estado: FiltroEstado }) {
  const m = MAT[estado];
  const libre = estado === "libre";
  return (
    <svg aria-hidden viewBox="0 0 18 16" className="h-4 w-[18px] shrink-0">
      <path d="M15 1L16 5V15L15 11Z" fill={m.lado} />
      <path d="M1 11H15L16 15H2Z" fill={libre ? m.frente : m.faldon[1]} />
      {estado === "debe" ? <path d={RAYAS_MUESTRA} fill={RAYAS_DEBE} /> : null}
      <rect
        x={1}
        y={1}
        width={14}
        height={10}
        rx={2}
        fill={m.tapa[1]}
        stroke={m.bisel}
        strokeWidth={estado === "debe" ? 1.2 : 1}
      />
      {libre ? (
        <rect
          x={3.5}
          y={3.5}
          width={9}
          height={5}
          rx={1}
          fill="none"
          stroke={m.lote}
          strokeWidth={0.9}
          strokeDasharray="1.6 1.3"
        />
      ) : null}
    </svg>
  );
}

/** Muestra del banderín azul del puesto propio (la misma forma que en el plano). */
function MuestraPropio() {
  return (
    <svg aria-hidden viewBox="0 0 18 16" className="h-4 w-[18px] shrink-0">
      <rect x={1} y={6} width={14} height={9} rx={2} fill={MAT.libre.tapa[1]} stroke={MAT.libre.bisel} />
      <path d="M4 11V1.5" stroke="#fff" strokeWidth={3} strokeLinecap="round" />
      <path d="M4 1.5L12 4L4 6.5Z" fill="#fff" stroke="#fff" strokeWidth={2} strokeLinejoin="round" />
      <path d="M4 11V1.5" stroke="oklch(0.36 0.04 262)" strokeWidth={1.3} strokeLinecap="round" />
      <path d="M4 1.5L12 4L4 6.5Z" fill="var(--primary)" />
    </svg>
  );
}

/**
 * Fila que en el celular se desliza de costado: sabe si quedó algo sin ver a la
 * izquierda o a la derecha y esfuma ese borde, así se nota que la fila sigue (sin
 * barra de desplazamiento no había ningún indicio). Desde tablet la fila no se
 * desliza y no hay esfumado.
 */
function useFilaDeslizable<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [lados, setLados] = useState({ izq: false, der: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => {
      const izq = el.scrollLeft > 2;
      const der = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      setLados((p) => (p.izq === izq && p.der === der ? p : { izq, der }));
    };
    medir();
    el.addEventListener("scroll", medir, { passive: true });
    // La fila y lo de adentro (un chip nuevo o un número más largo cambian el ancho).
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    for (const hijo of Array.from(el.children)) ro.observe(hijo);
    return () => {
      el.removeEventListener("scroll", medir);
      ro.disconnect();
    };
  }, []);
  let estilo: CSSProperties | undefined;
  if (lados.izq || lados.der) {
    const g = `linear-gradient(to right, ${lados.izq ? "transparent, #000 2rem" : "#000"}, ${
      lados.der ? "#000 calc(100% - 3rem), transparent" : "#000"
    })`;
    estilo = { maskImage: g, WebkitMaskImage: g };
  }
  return { ref, estilo };
}

export type Resumen = {
  /** Unidades de puesto por estado (medio puesto = ½). */
  puestos: Record<FiltroEstado, number>;
  totalPuestos: number;
  secundarios: { label: string; valor: string }[];
  /** Puestos propios de la cooperativa marcados en el plano (C3). */
  propios?: number;
};

const LEYENDA: { filtro: FiltroEstado; label: string }[] = [
  { filtro: "al_dia", label: "Al día" },
  { filtro: "debe", label: "Debe el mes" },
  { filtro: "vencido", label: "Deuda atrasada" },
  { filtro: "libre", label: "Libres" },
];

/** Ocupación de puestos (barra + leyenda que filtra el plano) y el resto del predio. */
export function ResumenMapa({
  resumen,
  filtro,
  onFiltro,
  className,
}: {
  resumen: Resumen;
  filtro: Filtro | null;
  onFiltro: (f: Filtro | null) => void;
  className?: string;
}) {
  const ocupados = resumen.totalPuestos - resumen.puestos.libre;
  const total = resumen.totalPuestos || 1;
  const { ref: filaRef, estilo: estiloFila } = useFilaDeslizable<HTMLDivElement>();

  return (
    <div className={cn("space-y-2.5", className)} data-tour="mapa-resumen">
      {/* En el celular es una sola fila que se desliza de costado (el borde se esfuma
          mientras quede algo sin ver). El resumen toma el ancho que necesita: con uno
          fijo, el primer chip le pisaba "ocupados". */}
      <div
        ref={filaRef}
        style={estiloFila}
        className="flex items-center gap-3 overflow-x-auto [scrollbar-width:none] max-md:-mx-3 max-md:px-3 md:gap-5 md:overflow-visible [&::-webkit-scrollbar]:hidden"
      >
        <div className="shrink-0 space-y-1.5 md:w-56">
          <p className="text-sm whitespace-nowrap">
            <span className="font-display text-lg font-bold tabular">{formatFraccion(ocupados)}</span>
            <span className="text-muted-foreground">
              {" "}
              de {formatFraccion(resumen.totalPuestos)} <span className="max-md:hidden">puestos </span>ocupados
            </span>
          </p>
          <div
            className="flex h-2.5 overflow-hidden rounded-full bg-muted ring-1 ring-foreground/5"
            role="img"
            aria-label={`${formatFraccion(ocupados)} de ${formatFraccion(resumen.totalPuestos)} puestos ocupados`}
          >
            {(["al_dia", "debe", "vencido"] as const).map((f) =>
              resumen.puestos[f] > 0 ? (
                <span
                  key={f}
                  className="h-full transition-[width] duration-500"
                  style={{
                    width: `${(resumen.puestos[f] / total) * 100}%`,
                    background: BARRA[f],
                  }}
                />
              ) : null
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 md:flex-1 md:flex-wrap" role="group" aria-label="Filtrar el plano">
          {LEYENDA.map((l) => {
            const activo = filtro === l.filtro;
            return (
              <button
                key={l.filtro}
                type="button"
                aria-pressed={activo}
                onClick={() => onFiltro(activo ? null : l.filtro)}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors",
                  activo
                    ? "border-primary bg-accent text-accent-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <MuestraEstado estado={l.filtro} />
                {l.label}
                <span className="tabular font-semibold text-foreground">
                  {formatFraccion(resumen.puestos[l.filtro])}
                </span>
              </button>
            );
          })}
          {(resumen.propios ?? 0) > 0 ? (
            <button
              type="button"
              aria-pressed={filtro === "propio"}
              onClick={() => onFiltro(filtro === "propio" ? null : "propio")}
              title="Puestos propios de la cooperativa (pagan EXPP)"
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors",
                filtro === "propio"
                  ? "border-primary bg-accent text-accent-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <MuestraPropio />
              Propios
              <span className="tabular font-semibold text-foreground">{formatFraccion(resumen.propios)}</span>
            </button>
          ) : null}
        </div>

        {/* Celular: locales, contéiners, cocheras… al final de la misma fila (desde
            tablet van en su renglón, abajo). */}
        {resumen.secundarios.length > 0 ? (
          <div className="flex shrink-0 items-center gap-4 border-l pl-3 md:hidden">
            {resumen.secundarios.map((s) => (
              <p key={s.label} className="text-xs leading-tight whitespace-nowrap text-muted-foreground">
                {s.label}
                <span className="block text-sm font-semibold text-foreground tabular">{s.valor}</span>
              </p>
            ))}
          </div>
        ) : null}
      </div>

      {resumen.secundarios.length > 0 ? (
        <p className="hidden flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground md:flex">
          {resumen.secundarios.map((s) => (
            <span key={s.label} className="whitespace-nowrap">
              {s.label} <span className="font-semibold text-foreground tabular">{s.valor}</span>
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}

/** "3 de 23" */
export function deTotal(n: number, total: number): string {
  return `${formatNumero(n)} de ${formatNumero(total)}`;
}

/** Cómo vienen los quinteros este mes (mapa del Jefe de Portería, G11). */
export type ResumenQuinteros = {
  total: number;
  alDia: number;
  debe: number;
  vencido: number;
  /** Lo que falta cobrar del mes (Σ `falta` de v_avance_mes). */
  porCobrar: number;
};

const LEYENDA_QUINTEROS: { filtro: Exclude<FiltroEstado, "libre">; label: string; clave: keyof ResumenQuinteros }[] = [
  { filtro: "al_dia", label: "Al día", clave: "alDia" },
  { filtro: "debe", label: "Deben el mes", clave: "debe" },
  { filtro: "vencido", label: "Deuda atrasada", clave: "vencido" },
];

/** Resumen del mapa del Jefe: sus quinteros (nada de puesteros) y lo que falta cobrar del
 * mes, con la leyenda que filtra las fichas de la zona de quinteros. */
export function ResumenQuintas({
  resumen,
  filtro,
  onFiltro,
  className,
}: {
  resumen: ResumenQuinteros;
  filtro: Filtro | null;
  onFiltro: (f: Filtro | null) => void;
  className?: string;
}) {
  const { ref: filaRef, estilo: estiloFila } = useFilaDeslizable<HTMLDivElement>();
  // La fila va DENTRO del bloque (que trae el padding y el borde del mapa), como en
  // ResumenMapa: con los márgenes negativos en el bloque mismo quedaba más ancho que la
  // pantalla, y el esfumado se comía el borde de abajo.
  return (
    <div className={className} data-tour="mapa-resumen">
      <div
        ref={filaRef}
        style={estiloFila}
        className="flex items-center gap-3 overflow-x-auto [scrollbar-width:none] max-md:-mx-3 max-md:px-3 md:gap-5 [&::-webkit-scrollbar]:hidden"
      >
        <div className="shrink-0">
          <p className="text-sm whitespace-nowrap">
            <span className="font-display text-lg font-bold tabular">{formatNumero(resumen.total)}</span>
            <span className="text-muted-foreground"> {resumen.total === 1 ? "quintero" : "quinteros"}</span>
          </p>
          <p className="text-xs whitespace-nowrap text-muted-foreground">
            {resumen.porCobrar > 0 ? (
              <>
                <Money monto={resumen.porCobrar} className="font-semibold text-pendiente" /> por cobrar este mes
              </>
            ) : (
              "Nada por cobrar este mes"
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5 md:flex-1 md:flex-wrap" role="group" aria-label="Filtrar quinteros">
          {LEYENDA_QUINTEROS.map((l) => {
            const activo = filtro === l.filtro;
            return (
              <button
                key={l.filtro}
                type="button"
                aria-pressed={activo}
                onClick={() => onFiltro(activo ? null : l.filtro)}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors",
                  activo
                    ? "border-primary bg-accent text-accent-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <MuestraEstado estado={l.filtro} />
                {l.label}
                <span className="tabular font-semibold text-foreground">{formatNumero(resumen[l.clave])}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
