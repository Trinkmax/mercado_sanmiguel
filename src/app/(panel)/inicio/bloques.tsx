import Link from "next/link";
import { Footprints, Tractor, Truck, type LucideIcon } from "lucide-react";
import { formatARS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Codigo } from "@/components/shared/codigo";
import { Money } from "@/components/shared/money";
import type { ResumenConcepto } from "./datos";

/**
 * Barra verde (cobrado) sobre pista roja suave (lo que falta), por concepto.
 * `objetivo` = contra qué se mide: lo que se tendría que cobrar (estimado) o
 * cobrado + lo que se debe hoy.
 */
export function BarraConcepto({
  fila,
  objetivo,
  faltaTexto,
}: {
  fila: ResumenConcepto;
  objetivo: number;
  /** Lo que se muestra en rojo debajo ("faltan $X"). */
  faltaTexto: number;
}) {
  const cobrado = Number(fila.cobrado);
  const pct = objetivo > 0 ? Math.min((cobrado / objetivo) * 100, 100) : 100;
  const completo = faltaTexto <= 0.009;
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5 py-3 sm:grid-cols-[5rem_1fr_11rem]">
      <Codigo codigo={fila.codigo} />
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate font-medium">{fila.nombre}</p>
          <p className="text-sm text-muted-foreground tabular sm:hidden">
            {formatARS(cobrado)} / {formatARS(objetivo)}
          </p>
        </div>
        <div
          className="mt-1.5 h-3 overflow-hidden rounded-full bg-pendiente-suave"
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${fila.nombre}: cobrado ${formatARS(cobrado)} de ${formatARS(objetivo)}`}
        >
          <div className="h-full rounded-full bg-pagado transition-[width]" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="col-start-2 text-sm text-muted-foreground tabular max-sm:hidden sm:col-start-3 sm:text-right">
        <span className="font-semibold text-pagado">{formatARS(cobrado)}</span>
        {" de "}
        {formatARS(objetivo)}
        {completo ? null : <span className="block text-pendiente">faltan {formatARS(faltaTexto)}</span>}
      </div>
    </div>
  );
}

/** Aviso lateral: qué hay pendiente, cuánto, y el botón que lo resuelve. */
export type Aviso = {
  clave: string;
  n: number;
  singular: string;
  plural: string;
  descripcion: string;
  href: string;
  cta: string;
  icono?: LucideIcon;
  /** "parcial" = espera una acción tuya (ámbar); "pendiente" = deuda (rojo). */
  tono: "parcial" | "pendiente";
};

export function TarjetaAviso({ aviso }: { aviso: Aviso }) {
  const Icono = aviso.icono;
  const titulo = aviso.n === 1 ? aviso.singular : aviso.plural;
  if (aviso.tono === "pendiente") {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="font-semibold">
            <span className="text-pendiente tabular">{aviso.n}</span> {titulo}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{aviso.descripcion}</p>
          <Button asChild variant="outline" className="mt-3 min-h-11 text-base">
            <Link href={aviso.href}>{aviso.cta}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="border-parcial bg-parcial-suave">
      <CardContent className="flex items-center justify-between gap-3 pt-6">
        <div>
          <p className="font-semibold">
            <span className="tabular">{aviso.n}</span> {titulo}
          </p>
          <p className="text-sm text-muted-foreground">{aviso.descripcion}</p>
        </div>
        <Button asChild className="min-h-11 shrink-0 text-base">
          <Link href={aviso.href}>
            {Icono ? <Icono className="size-5" strokeWidth={2} /> : null}
            {aviso.cta}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/** Fila del escritorio del Líder: número grande + qué es + botón. */
export function FilaEscritorio({
  n,
  titulo,
  detalle,
  href,
  cta,
  icono: Icono,
}: {
  n: number;
  titulo: string;
  detalle: string;
  href: string;
  cta: string;
  icono: LucideIcon;
}) {
  return (
    <div className="grid grid-cols-[4rem_1fr] items-center gap-x-4 gap-y-2 py-4 sm:grid-cols-[4rem_1fr_auto]">
      <p
        className={cn(
          "font-display text-3xl font-extrabold tabular",
          n > 0 ? "text-parcial" : "text-muted-foreground/60"
        )}
      >
        {n}
      </p>
      <div className="min-w-0">
        <p className="font-medium">{titulo}</p>
        <p className="text-sm text-muted-foreground">{detalle}</p>
      </div>
      <Button
        asChild
        variant={n > 0 ? "default" : "outline"}
        className="col-start-2 min-h-11 justify-self-start text-base sm:col-start-3 sm:justify-self-end"
      >
        <Link href={href}>
          <Icono className="size-5" strokeWidth={2} />
          {cta}
        </Link>
      </Button>
    </div>
  );
}

/**
 * Desglose de la caja de portería (A3): Quintas · Ambulantes · Bono camioneros,
 * con el ícono de cada uno (tractor, pisadas, camión).
 */
export function DesgloseCajaPorteria({
  quintas,
  ambulantes,
  canon,
  className,
}: {
  quintas: number;
  ambulantes: number;
  canon: number;
  className?: string;
}) {
  const partes: { icono: LucideIcon; label: string; monto: number }[] = [
    { icono: Tractor, label: "Quintas", monto: quintas },
    { icono: Footprints, label: "Ambulantes", monto: ambulantes },
    { icono: Truck, label: "Bono camioneros", monto: canon },
  ];
  return (
    <ul className={cn("space-y-1.5", className)}>
      {partes.map(({ icono: Icono, label, monto }) => (
        <li key={label} className="flex items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Icono className="size-4" strokeWidth={2} />
            {label}
          </span>
          <Money monto={monto} className={cn("font-semibold", monto > 0 ? "text-foreground" : "text-muted-foreground")} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Barra de tres tramos contra un total: cobrado (verde) · beneficios (gris) ·
 * falta (rojo suave). Con leyenda debajo.
 */
export function BarraEstimado({
  cobrado,
  beneficios,
  falta,
  etiqueta,
}: {
  cobrado: number;
  beneficios: number;
  falta: number;
  etiqueta: string;
}) {
  const total = Math.max(cobrado + beneficios + falta, 0.01);
  const pc = (cobrado / total) * 100;
  const pb = (beneficios / total) * 100;
  return (
    <div className="space-y-2.5">
      <div
        className="flex h-4 overflow-hidden rounded-full bg-pendiente-suave"
        role="img"
        aria-label={etiqueta}
      >
        <div className="h-full bg-pagado" style={{ width: `${pc}%` }} />
        {pb > 0 ? <div className="h-full bg-muted-foreground/30" style={{ width: `${pb}%` }} /> : null}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-full bg-pagado" />
          Cobrado <Money monto={cobrado} className="font-semibold" />
        </li>
        {beneficios > 0 ? (
          <li className="flex items-center gap-2">
            <span aria-hidden className="size-3 rounded-full bg-muted-foreground/30" />
            Beneficios por pagar en término <Money monto={beneficios} className="font-semibold" />
          </li>
        ) : null}
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-full bg-pendiente-suave ring-1 ring-pendiente/40" />
          Falta <Money monto={falta} className="font-semibold text-pendiente" />
        </li>
      </ul>
    </div>
  );
}
