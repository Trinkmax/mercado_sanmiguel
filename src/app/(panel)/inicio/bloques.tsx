import Link from "next/link";
import { Footprints, Tractor, Truck, type LucideIcon } from "lucide-react";
import { formatARS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Codigo } from "@/components/shared/codigo";
import { Money } from "@/components/shared/money";
import { BarraIngreso, MontosIngreso } from "@/components/reportes/fila-ingreso";
import { montosEstimado, porcentajeCobrado, type MontosEstimado } from "@/lib/estimado";
import type { ResumenConcepto } from "./datos";

/**
 * Un concepto contra su estimado pagando en término (el mismo de Facturación y Reportes), con
 * la misma barra y los mismos nombres que Reportes: verde lo cobrado y la pista roja lo que
 * falta. Debajo, "$ cobrado de $ estimado" (bajo el verde), en chico el tope si pagan fuera de
 * término y los beneficios otorgados, y "Faltan $X" a la derecha (bajo el rojo): la cuenta
 * cierra en el renglón (cobrado + faltan = estimado).
 */
export function BarraConcepto({ fila }: { fila: ResumenConcepto }) {
  const { cobrado, estimado } = montosEstimado(fila);
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
              <span className="font-semibold whitespace-nowrap text-pagado">{formatARS(cobrado)}</span>{" "}
              <span className="whitespace-nowrap">de {formatARS(estimado)}</span>
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
 * El estimado del mes (pagando en término, src/lib/estimado.ts) en dos tramos, con los
 * mismos nombres que Reportes, la impresión y el Excel: cobrado (verde) y falta cobrar (rojo
 * suave, lo que se debe hoy). Los dos suman el estimado: la barra no muestra plata que no va a
 * entrar. Debajo, en chico, el tope si los que están en término pagan tarde y los beneficios
 * ya otorgados.
 */
export function BarraEstimado({ montos, etiqueta }: { montos: MontosEstimado; etiqueta: string }) {
  const pc = porcentajeCobrado(montos);
  const tramos: { clave: string; label: string; monto: number; muestra: React.ReactNode; fuerte: string }[] = [
    {
      clave: "cobrado",
      label: "Cobrado",
      monto: montos.cobrado,
      muestra: <span className="size-3 rounded-full bg-pagado" />,
      fuerte: "text-pagado",
    },
    {
      clave: "falta",
      label: "Falta cobrar",
      monto: montos.falta,
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
        <div className="h-full rounded-full bg-pagado" style={{ width: `${pc}%` }} />
      </div>
      {/* Cada tramo: su muestra de color y su nombre arriba, el monto debajo (nunca se parte). */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-8">
        {tramos.map((t) => (
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
