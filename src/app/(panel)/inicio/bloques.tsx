import Link from "next/link";
import { Footprints, Tractor, Truck, type LucideIcon } from "lucide-react";
import { formatARS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Codigo } from "@/components/shared/codigo";
import { Money } from "@/components/shared/money";
import {
  BarraIngreso,
  GRIS_BENEFICIO,
  MontosIngreso,
  MuestraBeneficio,
  RAYADO_EN_TERMINO,
} from "@/components/reportes/fila-ingreso";
import type { ResumenConcepto } from "./datos";

/**
 * Un concepto contra su estimado (el mismo de Facturación y Reportes), con la misma barra y
 * los mismos nombres que Reportes: verde lo cobrado, gris los beneficios otorgados, rayado el
 * beneficio en término y la pista roja lo que falta. Debajo, "$ cobrado de $ estimado" (bajo
 * el verde), cada beneficio con su monto y "Faltan $X" a la derecha (bajo el rojo): la cuenta
 * cierra en el renglón (cobrado + otorgados + en término + faltan = estimado).
 */
export function BarraConcepto({ fila }: { fila: ResumenConcepto }) {
  return (
    // Todos los anchos: código a la izquierda; el nombre entero, la barra a lo ancho y
    // debajo los montos. Si no entran en un renglón, cada uno baja entero.
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 py-3 sm:grid-cols-[5rem_minmax(0,1fr)]">
      <Codigo codigo={fila.codigo} className="mt-0.5" />
      <div className="min-w-0 space-y-1.5">
        <p className="text-sm font-medium break-words">{fila.nombre}</p>
        <BarraIngreso fila={fila} />
        <MontosIngreso
          fila={fila}
          antes={
            <span>
              <span className="font-semibold whitespace-nowrap text-pagado">{formatARS(Number(fila.cobrado))}</span>{" "}
              <span className="whitespace-nowrap">de {formatARS(Number(fila.estimado))}</span>
            </span>
          }
        />
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

// El título (text-base) siempre un paso arriba de su descripción (text-sm). El Card ya trae
// su relleno arriba y abajo: el contenido no suma otro.
export function TarjetaAviso({ aviso }: { aviso: Aviso }) {
  const Icono = aviso.icono;
  const titulo = aviso.n === 1 ? aviso.singular : aviso.plural;
  if (aviso.tono === "pendiente") {
    return (
      <Card data-tour="inicio-aviso">
        <CardContent>
          <p className="text-base leading-snug font-semibold">
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
    <Card className="border-parcial bg-parcial-suave" data-tour="inicio-aviso">
      {/* Si no entra al lado (columna angosta, celular), el botón baja: nunca aprieta el texto. */}
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-40 flex-1">
          <p className="text-base leading-snug font-semibold">
            <span className="tabular">{aviso.n}</span> {titulo}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{aviso.descripcion}</p>
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
 * El estimado del mes en cuatro tramos, con los mismos nombres que Reportes, la impresión y
 * el Excel: cobrado (verde) · beneficios otorgados (gris) · beneficio en término (gris
 * rayado) · falta cobrar (rojo suave, lo que se debe hoy). Los cuatro suman el estimado.
 */
export function BarraEstimado({
  cobrado,
  otorgados,
  enTermino,
  falta,
  etiqueta,
}: {
  cobrado: number;
  /** Beneficios ya descontados a quienes pagaron en término. */
  otorgados: number;
  /** Beneficio de quienes todavía no pagaron y siguen en término (si pagan tarde, pasa a falta). */
  enTermino: number;
  /** Lo que se debe hoy. */
  falta: number;
  etiqueta: string;
}) {
  const total = Math.max(cobrado + otorgados + enTermino + falta, 0.01);
  const pc = (cobrado / total) * 100;
  const po = (otorgados / total) * 100;
  const pt = (enTermino / total) * 100;
  const tramos: { clave: string; label: string; monto: number; muestra: React.ReactNode; fuerte?: string }[] = [
    {
      clave: "cobrado",
      label: "Cobrado",
      monto: cobrado,
      muestra: <span className="size-3 rounded-full bg-pagado" />,
      fuerte: "text-pagado",
    },
    {
      clave: "otorgados",
      label: "Beneficios otorgados",
      monto: otorgados,
      muestra: <MuestraBeneficio tipo="otorgados" className="size-3" />,
    },
    {
      clave: "en-termino",
      label: "Beneficio en término",
      monto: enTermino,
      muestra: <MuestraBeneficio tipo="en-termino" className="size-3" />,
    },
    {
      clave: "falta",
      label: "Falta cobrar",
      monto: falta,
      muestra: <span className="size-3 rounded-full bg-pendiente-suave ring-1 ring-pendiente/40" />,
      fuerte: "text-pendiente",
    },
  ];
  return (
    <div className="space-y-3">
      <div
        className="flex h-4 overflow-hidden rounded-full bg-pendiente-suave"
        role="img"
        aria-label={etiqueta}
      >
        <div className="h-full bg-pagado" style={{ width: `${pc}%` }} />
        {po > 0 ? <div className={cn("h-full", GRIS_BENEFICIO)} style={{ width: `${po}%` }} /> : null}
        {pt > 0 ? <div className="h-full bg-muted" style={{ width: `${pt}%`, ...RAYADO_EN_TERMINO }} /> : null}
      </div>
      {/* Cada tramo: su muestra de color y su nombre arriba, el monto debajo (nunca se parte). */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-8">
        {tramos
          .filter((t) => t.clave === "cobrado" || t.clave === "falta" || t.monto > 0.5)
          .map((t) => (
            <div key={t.clave} className="min-w-0">
              <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                <span aria-hidden className="flex shrink-0">
                  {t.muestra}
                </span>
                {t.label}
              </dt>
              <dd>
                <Money monto={t.monto} className={cn("text-base font-semibold", t.fuerte)} />
              </dd>
            </div>
          ))}
      </dl>
    </div>
  );
}
