import { Pointer } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Piezas para dibujar las "pantallas de ejemplo" del tour (docs/GUIA-TOUR.md): dibujos
 * quietos, con datos inventados, de una pantalla o de lo que se abre al tocar un botón.
 * Se muestran dentro de la tarjeta del tour (≈ 360 px de ancho) y como portada del
 * capítulo en la Guía. No se pueden tocar ni los lee el lector de pantalla (el texto
 * del paso ya lo cuenta).
 */

/** Marco de una pantalla de ejemplo: una ventanita con la barra azul del sistema. */
export function MarcoPantalla({
  titulo,
  children,
  className,
  contenidoClassName,
}: {
  /** Lo que diría la barra de arriba ("Cobrar a Pocho", "Caja del día"). */
  titulo: string;
  children: React.ReactNode;
  className?: string;
  contenidoClassName?: string;
}) {
  return (
    <div
      aria-hidden
      inert
      className={cn(
        "pointer-events-none w-full overflow-hidden rounded-xl border border-border bg-background text-[0.8rem] leading-snug text-foreground shadow-[0_8px_24px_-16px_rgb(15_23_60/0.45)] select-none",
        className
      )}
    >
      <div className="flex items-center gap-2 bg-sidebar px-3 py-1.5 text-sidebar-foreground">
        <span className="flex gap-1" aria-hidden>
          <span className="size-1.5 rounded-full bg-white/35" />
          <span className="size-1.5 rounded-full bg-white/35" />
          <span className="size-1.5 rounded-full bg-white/35" />
        </span>
        <span className="min-w-0 flex-1 truncate font-display text-[0.78rem] font-bold">{titulo}</span>
      </div>
      <div className={cn("space-y-2 p-3", contenidoClassName)}>{children}</div>
    </div>
  );
}

/**
 * Señala una parte de la pantalla de ejemplo: un anillo azul que late y una manito,
 * igual que el tour sobre la pantalla real.
 */
export function Resaltado({
  children,
  className,
  mano = true,
}: {
  children: React.ReactNode;
  className?: string;
  /** La manito abajo a la derecha (sacala si hay dos resaltados juntos). */
  mano?: boolean;
}) {
  return (
    <div className={cn("relative rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background", className)}>
      {children}
      {mano ? (
        <Pointer
          aria-hidden
          className="tour-toque absolute -right-2 -bottom-4 size-6 fill-white text-primary drop-shadow-[0_2px_3px_rgb(15_23_60/0.35)]"
          strokeWidth={1.8}
        />
      ) : null}
    </div>
  );
}

/** Un botón dibujado (no se toca): primario (azul lleno) o de contorno. */
export function BotonEjemplo({
  children,
  variante = "primario",
  className,
}: {
  children: React.ReactNode;
  variante?: "primario" | "contorno";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md px-3 text-[0.8rem] font-semibold [&_svg]:size-3.5",
        variante === "primario"
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-card text-foreground",
        className
      )}
    >
      {children}
    </span>
  );
}

/** Un campo de formulario dibujado, con su etiqueta y lo que tiene escrito. */
export function CampoEjemplo({
  etiqueta,
  valor,
  className,
}: {
  etiqueta: string;
  valor?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-[0.72rem] font-medium text-muted-foreground">{etiqueta}</p>
      <div className="flex min-h-8 items-center rounded-md border border-border bg-card px-2.5 text-[0.8rem]">
        {valor ?? <span className="text-muted-foreground/60">…</span>}
      </div>
    </div>
  );
}

/** Una fila de lista dibujada: a la izquierda lo principal, a la derecha el monto o sello. */
export function FilaEjemplo({
  children,
  derecha,
  className,
}: {
  children: React.ReactNode;
  derecha?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-2.5 py-2", className)}>
      <div className="min-w-0 flex-1">{children}</div>
      {derecha ? <div className="shrink-0 text-right">{derecha}</div> : null}
    </div>
  );
}
