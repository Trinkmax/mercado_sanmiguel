"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Move, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumero } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { guardarPosicionMapa, restablecerPosicionMapa } from "@/lib/actions/mapa";
import type {
  DepositoMapa,
  EspacioMapa,
  EstadoEspacio,
  PosicionMapa,
  TipoEspacio,
} from "./tipos";

/** Plano esquemático del predio: dos naves, quintas, galpones, cocheras,
 * locales y portería. Cada espacio se pinta según el estado de cobro del
 * cliente y clickea a su ficha (o a cobranza, para el Jefe de Portería).
 * Administración y el Líder pueden arrastrar las celdas para reubicarlas:
 * la posición queda guardada en `mapa_posiciones` y las demás se reparten solas. */

const VB_W = 1000;
const VB_H = 640;
const SNAP = 4;

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

const LABEL_TIPO: Record<TipoEspacio, string> = {
  puesto: "Puesto",
  quinta: "Quinta",
  local: "Local",
  deposito: "Depósito",
};

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
const LOCALES_X = 880;
const LOCALES_Y = 66;
const LOCALES_W = 104;
const LOCALES_ALTO = 244;

/** Reparte n celdas dentro de una zona, centradas, en `filas` filas.
 * `tamano` fuerza el ancho/alto de cada celda (para que las celdas sueltas
 * y las repartidas midan lo mismo). */
function repartir(
  n: number,
  zona: Rect,
  opts: {
    filas?: number;
    maxW?: number;
    gap?: number;
    pad?: number;
    tamano?: { w: number; h: number };
  } = {}
): Rect[] {
  if (n <= 0) return [];
  const gap = opts.gap ?? 6;
  const pad = opts.pad ?? 8;
  const filas = Math.min(opts.filas ?? 1, n);
  const cols = Math.ceil(n / filas);
  let w: number;
  let h: number;
  if (opts.tamano) {
    w = opts.tamano.w;
    h = opts.tamano.h;
  } else {
    w = (zona.w - pad * 2 - gap * (cols - 1)) / cols;
    if (opts.maxW) w = Math.min(w, opts.maxW);
    h = (zona.h - pad * 2 - gap * (filas - 1)) / filas;
  }
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

/** Abrevia el apodo para que entre en la celda (≈12 caracteres). */
function abreviar(texto: string, max: number): string {
  const limpio = texto.trim();
  if (limpio.length <= max) return limpio;
  return `${limpio.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

function clave(tipo: TipoEspacio, id: string): string {
  return `${tipo}:${id}`;
}

function snap(v: number): number {
  return Math.round(v / SNAP) * SNAP;
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
  apodo: string | null;
  detalle: string;
  deuda: number;
  estado: EstadoEspacio;
};

type Tooltip = DatosTooltip & { x: number; y: number };

/** Una celda lista para dibujar: espacio + rectángulo + si está "suelta". */
type Celda = {
  e: EspacioMapa;
  tipo: TipoEspacio;
  r: Rect;
  fija: boolean;
  tamano: number;
  sub?: string;
};

type Arrastre = {
  clave: string;
  pointerId: number;
  x: number;
  y: number;
  w: number;
  h: number;
  offX: number;
  offY: number;
  movido: boolean;
};

type EstadoGuardado = "quieto" | "guardando" | "guardado" | "error";

export function MapaMercado({
  puesteros,
  quinteros,
  locales,
  depositos,
  cocheras,
  hrefBase,
  posiciones: posicionesIniciales,
  puedeEditar,
}: {
  puesteros: EspacioMapa[];
  quinteros: EspacioMapa[];
  locales: EspacioMapa[];
  depositos: DepositoMapa[];
  cocheras: number;
  /** "/clientes" (staff) o "/cobranza" (Jefe de Portería). */
  hrefBase: string;
  /** Posiciones guardadas (mapa_posiciones). Las celdas sin fila se reparten solas. */
  posiciones: PosicionMapa[];
  /** Administración y Líder de Procesos pueden reubicar (drag & drop). */
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const contRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [tip, setTip] = useState<Tooltip | null>(null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const [guardado, setGuardado] = useState<EstadoGuardado>("quieto");
  const [, startTransition] = useTransition();
  // Las posiciones viven acá (optimistas): el server las confirma por detrás.
  const [posiciones, setPosiciones] = useState<Map<string, { x: number; y: number }>>(
    () =>
      new Map(
        posicionesIniciales.map((p) => [
          clave(p.tipo, p.cliente_id),
          { x: Number(p.x), y: Number(p.y) },
        ])
      )
  );
  const timerNudge = useRef<number | null>(null);

  // El cartel "Guardado" se apaga solo.
  useEffect(() => {
    if (guardado !== "guardado") return;
    const t = window.setTimeout(() => setGuardado("quieto"), 2200);
    return () => window.clearTimeout(t);
  }, [guardado]);

  const persistir = (tipo: TipoEspacio, id: string, x: number, y: number) => {
    setGuardado("guardando");
    startTransition(async () => {
      const res = await guardarPosicionMapa({ cliente_id: id, tipo, x, y });
      if (!res.ok) {
        setGuardado("error");
        toast.error(res.error);
        return;
      }
      setGuardado("guardado");
    });
  };

  const restablecer = (tipo: TipoEspacio, id: string) => {
    const k = clave(tipo, id);
    startTransition(async () => {
      const res = await restablecerPosicionMapa({ cliente_id: id, tipo });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setPosiciones((prev) => {
        const m = new Map(prev);
        m.delete(k);
        return m;
      });
      toast.success("Volvió a su lugar automático.");
    });
  };

  const salirEdicion = () => {
    setModoEdicion(false);
    setSeleccion(null);
    setArrastre(null);
  };

  /** Coordenadas del puntero en unidades del viewBox. */
  const aViewBox = (ev: { clientX: number; clientY: number }) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const mostrarTooltip = (ev: React.MouseEvent, datos: DatosTooltip) => {
    if (arrastre) return;
    const rect = contRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(Math.max(ev.clientX - rect.left, 110), rect.width - 110);
    const y = ev.clientY - rect.top;
    setTip({ ...datos, x, y });
  };

  // ---------- Reparto: las celdas con posición guardada no ocupan lugar ----------

  const ubicar = (
    lista: EspacioMapa[],
    tipo: TipoEspacio,
    zona: Rect,
    opts: { filas?: number; maxW?: number; pad?: number },
    extra: (e: EspacioMapa) => { tamano: number; sub?: string }
  ): Celda[] => {
    if (lista.length === 0) return [];
    // El tamaño sale del reparto completo (estable aunque se suelten celdas).
    const base = repartir(lista.length, zona, opts)[0];
    const tamano = { w: base.w, h: base.h };
    const sueltas = lista.filter((e) => !posiciones.has(clave(tipo, e.id)));
    const rectsSueltas = repartir(sueltas.length, zona, { ...opts, tamano });
    let i = 0;
    return lista.map((e) => {
      const pos = posiciones.get(clave(tipo, e.id));
      const r: Rect = pos
        ? { x: pos.x, y: pos.y, w: tamano.w, h: tamano.h }
        : rectsSueltas[i++];
      return { e, tipo, r, fija: Boolean(pos), ...extra(e) };
    });
  };

  // Puesteros en orden de carpeta: primera mitad Nave A, el resto Nave B.
  const mitad = Math.ceil(puesteros.length / 2);
  const enNaveA = puesteros.slice(0, mitad);
  const enNaveB = puesteros.slice(mitad);
  const tamanoPuesto = (n: number, zona: Rect) => {
    const base = repartir(n, zona, { filas: n > 8 ? 2 : 1, maxW: 88 })[0];
    return base && base.h < 50 ? 13 : 15;
  };
  const celdasA = ubicar(
    enNaveA,
    "puesto",
    NAVE_A,
    { filas: enNaveA.length > 8 ? 2 : 1, maxW: 88 },
    () => ({ tamano: tamanoPuesto(enNaveA.length, NAVE_A) })
  );
  const celdasB = ubicar(
    enNaveB,
    "puesto",
    NAVE_B,
    { filas: enNaveB.length > 8 ? 2 : 1, maxW: 88 },
    () => ({ tamano: tamanoPuesto(enNaveB.length, NAVE_B) })
  );
  const celdasQuintas = ubicar(
    quinteros,
    "quinta",
    QUINTAS,
    { filas: Math.ceil(quinteros.length / (quinteros.length > 8 ? 3 : 2)) },
    () => ({ tamano: 11 })
  );
  const celdasDepositos = ubicar(
    depositos,
    "deposito",
    GALPONES,
    { filas: depositos.length > 6 ? 2 : 1, maxW: 96, pad: 9 },
    (e) => {
      const d = e as DepositoMapa;
      const partes: string[] = [];
      if (d.galpones > 0) partes.push(`${formatNumero(d.galpones)} galp`);
      if (d.contenedores > 0) partes.push(`${formatNumero(d.contenedores)} cont`);
      return { tamano: 13, sub: partes.join(" · ") };
    }
  );

  // Locales: columna sobre el acceso este; la altura sale del total.
  const nLoc = locales.length;
  const hLocal = nLoc > 0 ? Math.min(38, (LOCALES_ALTO - 6 * (nLoc - 1)) / nLoc) : 0;
  let iLocal = 0;
  const celdasLocales: Celda[] = locales.map((e) => {
    const pos = posiciones.get(clave("local", e.id));
    const r: Rect = pos
      ? { x: pos.x, y: pos.y, w: LOCALES_W, h: hLocal }
      : { x: LOCALES_X, y: LOCALES_Y + iLocal++ * (hLocal + 6), w: LOCALES_W, h: hLocal };
    return { e, tipo: "local", r, fija: Boolean(pos), tamano: 13 };
  });

  const todas = [...celdasA, ...celdasB, ...celdasDepositos, ...celdasLocales, ...celdasQuintas];
  const celdaSeleccionada =
    seleccion !== null ? todas.find((c) => clave(c.tipo, c.e.id) === seleccion) ?? null : null;

  // ---------- Arrastre ----------

  const empezarArrastre = (ev: React.PointerEvent<SVGGElement>, c: Celda) => {
    if (!modoEdicion) return;
    if (ev.button !== 0 && ev.pointerType === "mouse") return;
    const p = aViewBox(ev);
    if (!p) return;
    ev.preventDefault();
    ev.currentTarget.setPointerCapture(ev.pointerId);
    setTip(null);
    const k = clave(c.tipo, c.e.id);
    setSeleccion(k);
    setArrastre({
      clave: k,
      pointerId: ev.pointerId,
      x: c.r.x,
      y: c.r.y,
      w: c.r.w,
      h: c.r.h,
      offX: p.x - c.r.x,
      offY: p.y - c.r.y,
      movido: false,
    });
  };

  const moverArrastre = (ev: React.PointerEvent<SVGGElement>) => {
    if (!arrastre || arrastre.pointerId !== ev.pointerId) return;
    const p = aViewBox(ev);
    if (!p) return;
    const nx = snap(Math.min(Math.max(p.x - arrastre.offX, 0), VB_W - arrastre.w));
    const ny = snap(Math.min(Math.max(p.y - arrastre.offY, 0), VB_H - arrastre.h));
    const movido =
      arrastre.movido || Math.abs(nx - arrastre.x) >= SNAP || Math.abs(ny - arrastre.y) >= SNAP;
    if (nx === arrastre.x && ny === arrastre.y && movido === arrastre.movido) return;
    setArrastre({ ...arrastre, x: nx, y: ny, movido });
  };

  const soltarArrastre = (ev: React.PointerEvent<SVGGElement>, c: Celda) => {
    if (!arrastre || arrastre.pointerId !== ev.pointerId) return;
    if (ev.currentTarget.hasPointerCapture(ev.pointerId)) {
      ev.currentTarget.releasePointerCapture(ev.pointerId);
    }
    const { x, y, movido } = arrastre;
    setArrastre(null);
    if (!movido) return; // fue un toque: solo selecciona
    const k = clave(c.tipo, c.e.id);
    setPosiciones((prev) => new Map(prev).set(k, { x, y }));
    persistir(c.tipo, c.e.id, x, y);
  };

  /** Flechas del teclado: mueve de a 4 px (Shift: 20) y guarda al soltar. */
  const moverConTeclado = (ev: React.KeyboardEvent<SVGGElement>, c: Celda) => {
    const paso = ev.shiftKey ? SNAP * 5 : SNAP;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-paso, 0],
      ArrowRight: [paso, 0],
      ArrowUp: [0, -paso],
      ArrowDown: [0, paso],
    };
    const d = delta[ev.key];
    if (!d) return false;
    ev.preventDefault();
    const k = clave(c.tipo, c.e.id);
    const nx = Math.min(Math.max(c.r.x + d[0], 0), VB_W - c.r.w);
    const ny = Math.min(Math.max(c.r.y + d[1], 0), VB_H - c.r.h);
    setSeleccion(k);
    setPosiciones((prev) => new Map(prev).set(k, { x: nx, y: ny }));
    if (timerNudge.current) window.clearTimeout(timerNudge.current);
    timerNudge.current = window.setTimeout(() => persistir(c.tipo, c.e.id, nx, ny), 350);
    return true;
  };

  // ---------- Dibujo de una celda ----------

  const dibujarCelda = (c: Celda) => {
    const { e, tipo } = c;
    const k = clave(tipo, e.id);
    const enArrastre = arrastre?.clave === k;
    const r: Rect = enArrastre ? { ...c.r, x: arrastre.x, y: arrastre.y } : c.r;
    const st = ESTILO_ESTADO[e.estado];
    const seleccionada = modoEdicion && seleccion === k;
    const detalle = `${LABEL_TIPO[tipo]} · Carpeta ${e.codigo}`;
    const datos: DatosTooltip = {
      nombre: e.nombre,
      apodo: e.apodo,
      detalle: c.sub ? `${detalle} · ${c.sub}` : detalle,
      deuda: e.deuda,
      estado: e.estado,
    };
    const ir = () => router.push(`${hrefBase}/${e.id}`);

    // Texto apilado: número grande, apodo chico, detalle (depósitos).
    const chica = r.h < 26;
    const mediana = r.h < 36;
    const tamPrincipal = chica ? Math.min(c.tamano, 10) : mediana ? Math.min(c.tamano, 12) : c.tamano;
    const tamSec = chica || mediana ? 7 : 8;
    const maxChars = Math.max(4, Math.min(12, Math.floor(r.w / (tamSec * 0.58))));
    const lineas: { texto: string; size: number; weight: number; opacity: number }[] = [
      { texto: String(e.codigo), size: tamPrincipal, weight: 700, opacity: 1 },
    ];
    if (e.apodo) {
      lineas.push({ texto: abreviar(e.apodo, maxChars), size: tamSec, weight: 500, opacity: 0.9 });
    }
    if (c.sub && !chica) {
      lineas.push({ texto: c.sub, size: tamSec, weight: 500, opacity: 0.85 });
    }
    const alturas = lineas.map((l) => l.size * 1.12);
    const totalAlto = alturas.reduce((a, b) => a + b, 0);
    const cx = r.x + r.w / 2;
    // Centro vertical de cada línea, apiladas y centradas en la celda.
    const centrosY: number[] = [];
    let acumulado = r.y + r.h / 2 - totalAlto / 2;
    for (const alto of alturas) {
      centrosY.push(acumulado + alto / 2);
      acumulado += alto;
    }

    return (
      <g
        key={k}
        role={modoEdicion ? "button" : "link"}
        tabIndex={0}
        aria-label={
          modoEdicion
            ? `${e.nombre}, carpeta ${e.codigo}. Arrastrá o usá las flechas para mover`
            : `${e.nombre}, carpeta ${e.codigo}`
        }
        aria-pressed={modoEdicion ? seleccionada : undefined}
        className={cn(
          "outline-none transition-opacity focus-visible:opacity-80",
          modoEdicion
            ? enArrastre
              ? "cursor-grabbing"
              : "cursor-grab"
            : "cursor-pointer hover:opacity-80"
        )}
        onClick={() => {
          if (modoEdicion) {
            setSeleccion(k);
            return;
          }
          ir();
        }}
        onKeyDown={(ev) => {
          if (modoEdicion && moverConTeclado(ev, c)) return;
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            if (modoEdicion) setSeleccion(k);
            else ir();
          }
        }}
        onPointerDown={(ev) => empezarArrastre(ev, c)}
        onPointerMove={moverArrastre}
        onPointerUp={(ev) => soltarArrastre(ev, c)}
        onPointerCancel={(ev) => soltarArrastre(ev, c)}
        onMouseEnter={(ev) => mostrarTooltip(ev, datos)}
        onMouseMove={(ev) => mostrarTooltip(ev, datos)}
        onMouseLeave={() => setTip(null)}
      >
        {enArrastre ? (
          // Sombra de la celda en movimiento (se nota que "flota").
          <rect
            x={r.x + 2}
            y={r.y + 3}
            width={r.w}
            height={r.h}
            rx={4}
            fill="var(--foreground)"
            opacity={0.18}
          />
        ) : null}
        <rect
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          rx={4}
          fill={st.fill}
          stroke={seleccionada ? "var(--primary)" : st.stroke}
          strokeWidth={seleccionada ? 2.5 : st.grosor}
        />
        {lineas.map((l, i) => {
          return (
            <text
              key={i}
              x={cx}
              y={centrosY[i]}
              textAnchor="middle"
              dominantBaseline="central"
              fill={st.texto}
              opacity={l.opacity}
              className={i === 0 ? "tabular" : undefined}
              style={{
                ...FUENTE_CELDA,
                fontWeight: l.weight,
                fontSize: l.size,
                pointerEvents: "none",
                userSelect: "none",
              }}
            >
              {l.texto}
            </text>
          );
        })}
        {modoEdicion && c.fija ? (
          // Chinche: esta celda tiene posición guardada.
          <circle
            cx={r.x + r.w - 5}
            cy={r.y + 5}
            r={2.6}
            fill="var(--primary)"
            stroke="var(--card)"
            strokeWidth={1}
          />
        ) : null}
      </g>
    );
  };

  // Orden de dibujo: todas las zonas y, al final (por encima de todo), la
  // celda que se está arrastrando.
  const ordenDibujo = arrastre
    ? [
        ...todas.filter((c) => clave(c.tipo, c.e.id) !== arrastre.clave),
        ...todas.filter((c) => clave(c.tipo, c.e.id) === arrastre.clave),
      ]
    : todas;

  // El tooltip se da vuelta cerca del borde superior para no quedar cortado.
  const tooltipAbajo = tip !== null && tip.y < 130;

  return (
    <div>
      {/* Cabecera del plano: modo reubicar (izquierda) y leyenda (derecha) */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {puedeEditar ? (
            modoEdicion ? (
              <Button
                type="button"
                variant="default"
                className="min-h-11 px-4 text-sm font-semibold"
                onClick={salirEdicion}
              >
                <Check className="size-4" strokeWidth={2.2} />
                Listo
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="min-h-11 px-4 text-sm font-semibold"
                onClick={() => setModoEdicion(true)}
              >
                <Move className="size-4" strokeWidth={2} />
                Reubicar puestos
              </Button>
            )
          ) : null}
          {modoEdicion ? (
            <p className="text-sm text-muted-foreground">
              Arrastrá un puesto para reubicarlo en el plano. Se guarda solo.
            </p>
          ) : null}
          {modoEdicion && guardado !== "quieto" ? (
            <span
              role="status"
              aria-live="polite"
              className={cn(
                "inline-flex items-center gap-1.5 text-sm font-medium",
                guardado === "guardado" && "text-pagado",
                guardado === "error" && "text-pendiente",
                guardado === "guardando" && "text-muted-foreground"
              )}
            >
              {guardado === "guardando" ? (
                <>
                  <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                  Guardando…
                </>
              ) : guardado === "guardado" ? (
                <>
                  <Check className="size-4" strokeWidth={2.2} />
                  Guardado
                </>
              ) : (
                <>
                  <X className="size-4" strokeWidth={2.2} />
                  No se guardó
                </>
              )}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
      </div>

      <div className="overflow-x-auto">
        <div
          ref={contRef}
          className={cn(
            "relative min-w-[680px] rounded-[14px]",
            modoEdicion && "ring-2 ring-primary/40 ring-offset-2 ring-offset-card"
          )}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            className="block h-auto w-full select-none"
            style={{ touchAction: modoEdicion ? "none" : "auto" }}
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
            <Rotulo x={LOCALES_X} y={56} texto="LOCALES" />

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

            {/* Celdas: todas las zonas dibujadas sobre el terreno, así una celda
                reubicada puede quedar en cualquier parte del plano. */}
            {ordenDibujo.map((c) => dibujarCelda(c))}
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
              {tip.apodo ? (
                <p className="mt-0.5 text-xs text-foreground/80">“{tip.apodo}”</p>
              ) : null}
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

      {/* Panel del modo reubicar: la celda elegida y su acción */}
      {modoEdicion ? (
        <div className="mt-3 flex min-h-14 flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed bg-muted/40 px-4 py-2.5">
          {celdaSeleccionada ? (
            <>
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {LABEL_TIPO[celdaSeleccionada.tipo]} {celdaSeleccionada.e.codigo} ·{" "}
                  {celdaSeleccionada.e.nombre}
                </p>
                <p className="text-xs text-muted-foreground">
                  {celdaSeleccionada.fija
                    ? "Tiene una posición guardada en el plano."
                    : "Está en su lugar automático. Arrastrala para ubicarla donde va."}
                </p>
              </div>
              {celdaSeleccionada.fija ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 px-4 text-sm"
                  onClick={() => restablecer(celdaSeleccionada.tipo, celdaSeleccionada.e.id)}
                >
                  <RotateCcw className="size-4" strokeWidth={2} />
                  Restablecer posición
                </Button>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Tocá una celda para seleccionarla, o arrastrala directo. Las que tienen
              posición guardada llevan un punto azul.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
