"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type Ref,
} from "react";
import { Eraser, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type FirmaPadHandle = {
  /** PNG de la firma (fondo blanco). Null si no firmó. */
  obtenerBlob: () => Promise<Blob | null>;
  limpiar: () => void;
  tieneTrazo: () => boolean;
};

type Punto = { x: number; y: number };

const ALTO = 180;
const TINTA = "#1c2333";
const GROSOR = 2.6;

function punto(e: ReactPointerEvent<HTMLCanvasElement>): Punto {
  const rect = e.currentTarget.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

/** Dibuja todos los trazos sobre un contexto ya escalado a unidades CSS. */
function pintarTrazos(ctx: CanvasRenderingContext2D, trazos: Punto[][]) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = TINTA;
  ctx.lineWidth = GROSOR;
  for (const t of trazos) {
    if (t.length === 0) continue;
    if (t.length === 1) {
      ctx.beginPath();
      ctx.arc(t[0].x, t[0].y, GROSOR / 2, 0, Math.PI * 2);
      ctx.fillStyle = TINTA;
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(t[0].x, t[0].y);
    for (let i = 1; i < t.length - 1; i++) {
      const mx = (t[i].x + t[i + 1].x) / 2;
      const my = (t[i].y + t[i + 1].y) / 2;
      ctx.quadraticCurveTo(t[i].x, t[i].y, mx, my);
    }
    const u = t[t.length - 1];
    ctx.lineTo(u.x, u.y);
    ctx.stroke();
  }
}

/**
 * Recuadro de firma con el dedo o lápiz: canvas con pointer events,
 * trazo suavizado, fondo blanco y línea base. Expone obtenerBlob() para
 * subir el PNG y limpiar() para empezar de nuevo.
 */
export function FirmaPad({
  ref,
  onCambio,
  disabled = false,
  className,
}: {
  ref?: Ref<FirmaPadHandle>;
  onCambio?: (tieneTrazo: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trazosRef = useRef<Punto[][]>([]);
  const dibujandoRef = useRef(false);
  const [tieneTrazo, setTieneTrazo] = useState(false);

  const redibujar = useCallback(() => {
    const canvas = canvasRef.current;
    const cont = contenedorRef.current;
    if (!canvas || !cont) return;
    const ancho = cont.clientWidth;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(ancho * dpr);
    canvas.height = Math.round(ALTO * dpr);
    canvas.style.width = `${ancho}px`;
    canvas.style.height = `${ALTO}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, ancho, ALTO);
    pintarTrazos(ctx, trazosRef.current);
  }, []);

  useEffect(() => {
    redibujar();
    const cont = contenedorRef.current;
    if (!cont || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => redibujar());
    ro.observe(cont);
    return () => ro.disconnect();
  }, [redibujar]);

  const marcar = useCallback(
    (valor: boolean) => {
      setTieneTrazo(valor);
      onCambio?.(valor);
    },
    [onCambio]
  );

  const limpiar = useCallback(() => {
    trazosRef.current = [];
    dibujandoRef.current = false;
    redibujar();
    marcar(false);
  }, [redibujar, marcar]);

  useImperativeHandle(
    ref,
    () => ({
      limpiar,
      tieneTrazo: () => trazosRef.current.some((t) => t.length > 0),
      obtenerBlob: () =>
        new Promise<Blob | null>((resolver) => {
          const trazos = trazosRef.current;
          const cont = contenedorRef.current;
          if (!cont || !trazos.some((t) => t.length > 0)) return resolver(null);
          // Exporta a 1x (liviano y suficiente para un comprobante).
          const salida = document.createElement("canvas");
          salida.width = Math.max(cont.clientWidth, 300);
          salida.height = ALTO;
          const ctx = salida.getContext("2d");
          if (!ctx) return resolver(null);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, salida.width, salida.height);
          pintarTrazos(ctx, trazos);
          salida.toBlob((b) => resolver(b), "image/png");
        }),
    }),
    [limpiar]
  );

  function alBajar(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dibujandoRef.current = true;
    trazosRef.current.push([punto(e)]);
    const ctx = e.currentTarget.getContext("2d");
    if (ctx) pintarTrazos(ctx, [trazosRef.current[trazosRef.current.length - 1]]);
    if (!tieneTrazo) marcar(true);
  }

  function alMover(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!dibujandoRef.current || disabled) return;
    e.preventDefault();
    const trazo = trazosRef.current[trazosRef.current.length - 1];
    if (!trazo) return;
    const p = punto(e);
    const anterior = trazo[trazo.length - 1];
    // Ignora micro-movimientos: trazo más limpio y menos puntos.
    if (anterior && Math.hypot(p.x - anterior.x, p.y - anterior.y) < 1.2) return;
    trazo.push(p);
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx || trazo.length < 2) return;
    // Dibuja solo el último segmento (suavizado por puntos medios).
    const n = trazo.length;
    const a = trazo[n - 2];
    const b = trazo[n - 1];
    const c = trazo[n - 3] ?? a;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = TINTA;
    ctx.lineWidth = GROSOR;
    ctx.beginPath();
    ctx.moveTo((c.x + a.x) / 2, (c.y + a.y) / 2);
    ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
    ctx.stroke();
  }

  function alSoltar(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!dibujandoRef.current) return;
    dibujandoRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ya liberado
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div
        ref={contenedorRef}
        className={cn(
          "relative overflow-hidden rounded-lg border-2 bg-white",
          tieneTrazo ? "border-primary/60" : "border-input",
          disabled && "opacity-60"
        )}
        style={{ height: ALTO }}
      >
        <canvas
          ref={canvasRef}
          className="block cursor-crosshair"
          style={{ touchAction: "none" }}
          aria-label="Recuadro para firmar con el dedo"
          onPointerDown={alBajar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerCancel={alSoltar}
          onPointerLeave={alSoltar}
          onContextMenu={(e) => e.preventDefault()}
        />
        {/* Línea base y la cruz, como en el papel. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-6 flex items-end gap-2"
          style={{ bottom: 34 }}
        >
          <span className="mb-[-6px] font-display text-lg text-muted-foreground/60">×</span>
          <span className="h-px flex-1 bg-muted-foreground/40" />
        </div>
        {!tieneTrazo ? (
          <p
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-center gap-2 text-base text-muted-foreground/70"
          >
            <PenLine className="size-5" strokeWidth={1.8} />
            Firmá acá con el dedo
          </p>
        ) : null}
      </div>
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-12 px-5 text-base"
          onClick={limpiar}
          disabled={!tieneTrazo || disabled}
        >
          <Eraser className="size-5" strokeWidth={2} />
          Borrar firma
        </Button>
      </div>
    </div>
  );
}
