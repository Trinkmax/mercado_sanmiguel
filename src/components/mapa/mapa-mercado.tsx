"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatNumero } from "@/lib/format";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import type { DepositoMapa, EspacioMapa, EstadoEspacio } from "./tipos";

/** Plano esquemático del predio: dos naves, quintas, galpones, cocheras,
 * locales y portería. Cada espacio se pinta según el estado de cobro del
 * cliente y clickea a su ficha (o a cobranza, para el guardia). */

const VB_W = 1000;
const VB_H = 640;

// Colores del terreno (paisaje, no estados: los estados usan los tokens).
const VERDE_PREDIO = "oklch(0.95 0.03 140)";
const VERDE_QUINTAS = "oklch(0.925 0.045 140)";
const BORDE_QUINTAS = "oklch(0.85 0.05 140)";
const GRIS_CALLE = "oklch(0.9 0.006 255)";
const ROJO_VENCIDO_BORDE = "oklch(0.38 0.16 27)";

const ESTILO_ESTADO: Record<
  EstadoEspacio,
  { fill: string; stroke: string; texto: string; grosor: number }
> = {
  al_dia: {
    fill: "var(--pagado-suave)",
    stroke: "var(--pagado)",
    texto: "var(--pagado)",
    grosor: 1,
  },
  debe: {
    fill: "var(--pendiente-suave)",
    stroke: "var(--pendiente)",
    texto: "var(--pendiente)",
    grosor: 1,
  },
  vencido: {
    fill: "var(--pendiente)",
    stroke: ROJO_VENCIDO_BORDE,
    texto: "#ffffff",
    grosor: 2,
  },
};

const LEYENDA: { label: string; fondo: string; borde: string }[] = [
  { label: "Al día", fondo: "var(--pagado-suave)", borde: "var(--pagado)" },
  { label: "Debe", fondo: "var(--pendiente-suave)", borde: "var(--pendiente)" },
  { label: "Deuda vencida", fondo: "var(--pendiente)", borde: ROJO_VENCIDO_BORDE },
];

const FUENTE_ROTULO: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 10,
  letterSpacing: "0.12em",
};

const FUENTE_CELDA: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 600,
};

type Rect = { x: number; y: number; w: number; h: number };

// Zonas fijas del plano (viewBox 1000×640).
const NAVE_A: Rect = { x: 128, y: 68, w: 610, h: 108 };
const NAVE_B: Rect = { x: 128, y: 248, w: 610, h: 108 };
const GALPONES: Rect = { x: 128, y: 420, w: 610, h: 72 };
const QUINTAS: Rect = { x: 880, y: 326, w: 104, h: 212 };
const PORTERIA: Rect = { x: 880, y: 556, w: 104, h: 66 };

/** Reparte n celdas dentro de una zona, centradas, en `filas` filas. */
function repartir(
  n: number,
  zona: Rect,
  opts: { filas?: number; maxW?: number; gap?: number; pad?: number } = {}
): Rect[] {
  if (n <= 0) return [];
  const gap = opts.gap ?? 6;
  const pad = opts.pad ?? 8;
  const filas = Math.min(opts.filas ?? 1, n);
  const cols = Math.ceil(n / filas);
  let w = (zona.w - pad * 2 - gap * (cols - 1)) / cols;
  if (opts.maxW) w = Math.min(w, opts.maxW);
  const h = (zona.h - pad * 2 - gap * (filas - 1)) / filas;
  const totalW = cols * w + (cols - 1) * gap;
  const x0 = zona.x + (zona.w - totalW) / 2;
  const y0 = zona.y + pad;
  return Array.from({ length: n }, (_, i) => ({
    x: x0 + (i % cols) * (w + gap),
    y: y0 + Math.floor(i / cols) * (h + gap),
    w,
    h,
  }));
}

function Rotulo({
  x,
  y,
  texto,
  anchor = "start",
  tamano = 10,
}: {
  x: number;
  y: number;
  texto: string;
  anchor?: "start" | "middle" | "end";
  tamano?: number;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fill="var(--muted-foreground)"
      style={{ ...FUENTE_ROTULO, fontSize: tamano }}
    >
      {texto}
    </text>
  );
}

type DatosTooltip = {
  nombre: string;
  detalle: string;
  deuda: number;
  estado: EstadoEspacio;
};

type Tooltip = DatosTooltip & { x: number; y: number };

export function MapaMercado({
  puesteros,
  quinteros,
  locales,
  depositos,
  cocheras,
  hrefBase,
}: {
  puesteros: EspacioMapa[];
  quinteros: EspacioMapa[];
  locales: EspacioMapa[];
  depositos: DepositoMapa[];
  cocheras: number;
  /** "/clientes" (staff) o "/cobranza" (guardia). */
  hrefBase: string;
}) {
  const router = useRouter();
  const contRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tooltip | null>(null);

  const mostrarTooltip = (
    ev: React.MouseEvent,
    datos: DatosTooltip
  ) => {
    const rect = contRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(Math.max(ev.clientX - rect.left, 110), rect.width - 110);
    const y = ev.clientY - rect.top;
    setTip({ ...datos, x, y });
  };

  /** Celda clickeable de un espacio, pintada según su estado de cobro. */
  const celda = (
    e: EspacioMapa,
    tipo: string,
    r: Rect,
    opts: { tamano?: number; sub?: string } = {}
  ) => {
    const st = ESTILO_ESTADO[e.estado];
    const detalle = `${tipo} · Carpeta ${e.codigo}`;
    const datos: DatosTooltip = {
      nombre: e.nombre,
      detalle: opts.sub ? `${detalle} · ${opts.sub}` : detalle,
      deuda: e.deuda,
      estado: e.estado,
    };
    const ir = () => router.push(`${hrefBase}/${e.id}`);
    const cy = r.y + r.h / 2;
    return (
      <g
        key={`${tipo}-${e.id}`}
        role="link"
        tabIndex={0}
        aria-label={`${e.nombre}, carpeta ${e.codigo}`}
        className="cursor-pointer outline-none transition-opacity hover:opacity-80 focus-visible:opacity-80"
        onClick={ir}
        onKeyDown={(ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            ir();
          }
        }}
        onMouseEnter={(ev) => mostrarTooltip(ev, datos)}
        onMouseMove={(ev) => mostrarTooltip(ev, datos)}
        onMouseLeave={() => setTip(null)}
      >
        <rect
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          rx={4}
          fill={st.fill}
          stroke={st.stroke}
          strokeWidth={st.grosor}
        />
        <text
          x={r.x + r.w / 2}
          y={opts.sub ? cy - 6 : cy}
          textAnchor="middle"
          dominantBaseline="central"
          fill={st.texto}
          className="tabular"
          style={{ ...FUENTE_CELDA, fontSize: opts.tamano ?? 13 }}
        >
          {e.codigo}
        </text>
        {opts.sub ? (
          <text
            x={r.x + r.w / 2}
            y={cy + 12}
            textAnchor="middle"
            dominantBaseline="central"
            fill={st.texto}
            opacity={0.85}
            style={{ ...FUENTE_CELDA, fontWeight: 500, fontSize: 8 }}
          >
            {opts.sub}
          </text>
        ) : null}
      </g>
    );
  };

  // Puesteros en orden de carpeta: primera mitad Nave A, el resto Nave B.
  const mitad = Math.ceil(puesteros.length / 2);
  const enNaveA = puesteros.slice(0, mitad);
  const enNaveB = puesteros.slice(mitad);
  const rectsA = repartir(enNaveA.length, NAVE_A, {
    filas: enNaveA.length > 8 ? 2 : 1,
    maxW: 88,
  });
  const rectsB = repartir(enNaveB.length, NAVE_B, {
    filas: enNaveB.length > 8 ? 2 : 1,
    maxW: 88,
  });
  const rectsQuintas = repartir(quinteros.length, QUINTAS, {
    filas: Math.ceil(quinteros.length / (quinteros.length > 8 ? 3 : 2)),
  });
  const rectsDepositos = repartir(depositos.length, GALPONES, {
    filas: depositos.length > 6 ? 2 : 1,
    maxW: 96,
    pad: 9,
  });
  const nLoc = locales.length;
  const hLocal = nLoc > 0 ? Math.min(38, (244 - 6 * (nLoc - 1)) / nLoc) : 0;

  const tamanoPuesto = (rects: Rect[]) =>
    rects.length > 0 && rects[0].h < 50 ? 13 : 15;

  // El tooltip se da vuelta cerca del borde superior para no quedar cortado.
  const tooltipAbajo = tip !== null && tip.y < 130;

  return (
    <div>
      {/* Leyenda */}
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        {LEYENDA.map((l) => (
          <span
            key={l.label}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground"
          >
            <span
              aria-hidden
              className="size-2.5 rounded-[3px]"
              style={{
                background: l.fondo,
                boxShadow: `inset 0 0 0 1.5px ${l.borde}`,
              }}
            />
            {l.label}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto">
        <div ref={contRef} className="relative min-w-[680px]">
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            className="block h-auto w-full"
            role="img"
            aria-label="Plano esquemático del Mercado San Miguel"
          >
            {/* Terreno y playón */}
            <rect x={0} y={0} width={VB_W} height={VB_H} rx={14} fill={VERDE_PREDIO} />
            <rect
              x={88}
              y={18}
              width={754}
              height={604}
              rx={12}
              fill="var(--muted)"
              stroke="var(--border)"
              strokeWidth={1}
            />

            {/* Acceso este (calle) */}
            <rect x={848} y={18} width={22} height={604} fill={GRIS_CALLE} />
            <line
              x1={859}
              y1={28}
              x2={859}
              y2={612}
              stroke="var(--card)"
              strokeWidth={1.5}
              strokeDasharray="10 8"
            />

            {/* Cocheras (borde oeste) */}
            <Rotulo x={48} y={56} texto="COCHERAS" anchor="middle" tamano={8.5} />
            {Array.from({ length: 10 }, (_, i) => (
              <rect
                key={i}
                x={20}
                y={70 + i * 30}
                width={56}
                height={24}
                rx={3}
                fill="var(--card)"
                stroke="var(--border)"
                strokeWidth={1}
              />
            ))}
            <text
              x={48}
              y={392}
              textAnchor="middle"
              fill="var(--foreground)"
              className="tabular"
              style={{ ...FUENTE_CELDA, fontWeight: 700, fontSize: 15 }}
            >
              {formatNumero(cocheras)}
            </text>
            <text
              x={48}
              y={406}
              textAnchor="middle"
              fill="var(--muted-foreground)"
              style={{ fontFamily: "var(--font-sans)", fontSize: 8 }}
            >
              alquiladas
            </text>

            {/* Nave A */}
            <Rotulo x={NAVE_A.x} y={NAVE_A.y - 8} texto="NAVE A" />
            <rect
              x={NAVE_A.x}
              y={NAVE_A.y}
              width={NAVE_A.w}
              height={NAVE_A.h}
              rx={6}
              fill="var(--card)"
              stroke="var(--border)"
              strokeWidth={1}
            />
            {enNaveA.map((e, i) =>
              celda(e, "Puesto", rectsA[i], { tamano: tamanoPuesto(rectsA) })
            )}

            {/* Nave B */}
            <Rotulo x={NAVE_B.x} y={NAVE_B.y - 8} texto="NAVE B" />
            <rect
              x={NAVE_B.x}
              y={NAVE_B.y}
              width={NAVE_B.w}
              height={NAVE_B.h}
              rx={6}
              fill="var(--card)"
              stroke="var(--border)"
              strokeWidth={1}
            />
            {enNaveB.map((e, i) =>
              celda(e, "Puesto", rectsB[i], { tamano: tamanoPuesto(rectsB) })
            )}

            {/* Galpones y contenedores */}
            <Rotulo x={GALPONES.x} y={GALPONES.y - 8} texto="GALPONES Y CONTENEDORES" />
            <rect
              x={GALPONES.x}
              y={GALPONES.y}
              width={GALPONES.w}
              height={GALPONES.h}
              rx={6}
              fill="var(--background)"
              stroke="var(--border)"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
            {depositos.map((e, i) => {
              const partes: string[] = [];
              if (e.galpones > 0) partes.push(`${formatNumero(e.galpones)} galp`);
              if (e.contenedores > 0)
                partes.push(`${formatNumero(e.contenedores)} cont`);
              return celda(e, "Depósito", rectsDepositos[i], {
                sub: partes.join(" · "),
              });
            })}

            {/* Playón */}
            <text
              x={NAVE_A.x + NAVE_A.w / 2}
              y={575}
              textAnchor="middle"
              fill="var(--muted-foreground)"
              opacity={0.75}
              style={{ ...FUENTE_ROTULO, fontSize: 9.5, letterSpacing: "0.2em" }}
            >
              PLAYÓN DE MANIOBRAS
            </text>

            {/* Locales (acceso este) */}
            <Rotulo x={880} y={56} texto="LOCALES" />
            {locales.map((e, i) =>
              celda(
                e,
                "Local",
                { x: 880, y: 66 + i * (hLocal + 6), w: 104, h: hLocal },
                { tamano: 13 }
              )
            )}

            {/* Quintas (zona verde sur-este) */}
            <Rotulo x={880} y={318} texto="QUINTAS" />
            <rect
              x={QUINTAS.x}
              y={QUINTAS.y}
              width={QUINTAS.w}
              height={QUINTAS.h}
              rx={8}
              fill={VERDE_QUINTAS}
              stroke={BORDE_QUINTAS}
              strokeWidth={1}
            />
            {quinteros.map((e, i) =>
              celda(e, "Quinta", rectsQuintas[i], { tamano: 11 })
            )}

            {/* Portería */}
            <rect
              x={PORTERIA.x}
              y={PORTERIA.y}
              width={PORTERIA.w}
              height={PORTERIA.h}
              rx={8}
              fill="var(--card)"
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={PORTERIA.x + PORTERIA.w / 2}
              y={PORTERIA.y + 26}
              textAnchor="middle"
              fill="var(--foreground)"
              style={{ ...FUENTE_ROTULO, fontSize: 9.5, letterSpacing: "0.1em" }}
            >
              PORTERÍA
            </text>
            <text
              x={PORTERIA.x + PORTERIA.w / 2}
              y={PORTERIA.y + 44}
              textAnchor="middle"
              fill="var(--muted-foreground)"
              style={{ fontFamily: "var(--font-sans)", fontSize: 8 }}
            >
              Canon de camiones
            </text>
          </svg>

          {/* Tooltip */}
          {tip ? (
            <div
              className="pointer-events-none absolute z-10 w-52 rounded-lg border bg-popover p-3 text-popover-foreground shadow-md"
              style={{
                left: tip.x,
                top: tip.y,
                transform: tooltipAbajo
                  ? "translate(-50%, 16px)"
                  : "translate(-50%, calc(-100% - 12px))",
              }}
            >
              <p className="text-sm leading-tight font-semibold">{tip.nombre}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{tip.detalle}</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <Sello estado={tip.estado} />
                <Money
                  monto={tip.deuda}
                  className={cn(
                    "text-sm font-semibold",
                    tip.deuda > 0 ? "text-pendiente" : "text-muted-foreground"
                  )}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
