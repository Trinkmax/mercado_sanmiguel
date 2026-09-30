import Link from "next/link";
import { Printer, ShieldCheck, Stamp } from "lucide-react";
import { formatARS, formatFecha, formatFechaLarga } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";

export type CajaPendiente = {
  id: string;
  fecha: string;
  tipo: "administracion" | "guardia";
  estado: "cerrada" | "integrada";
  cerradaPor: string | null;
  efectivo: number;
  transferencia: number;
  cheques: number;
  gastos: number;
  ajustes: number;
  quintas: number;
  ambulantes: number;
  canon: number;
  rendidoEfectivo: number;
  rendidoTransferencia: number;
  rendidoQuintas: number;
  rendidoAmbulantes: number;
  rendidoCanon: number;
  destinoFecha: string | null;
  /** La caja de administración que la recibió sigue abierta (por eso no está en la lista). */
  destinoAbierta: boolean;
  reaperturaMotivo: string | null;
  pideReapertura: boolean;
};

function capitalizar(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Cajas cerradas o integradas que esperan a Tesorería. Se cuentan y validan en
 * /caja ("Contar y validar"): acá está la lista para no olvidarse de ninguna.
 */
export function CajasParaValidar({ cajas }: { cajas: CajaPendiente[] }) {
  if (cajas.length === 0) {
    return (
      <EmptyState
        icono={ShieldCheck}
        titulo="No hay cajas para validar"
        descripcion="Cuando Administración o el Jefe de Portería cierren una caja, aparece acá para que la cuentes."
      />
    );
  }

  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">
      {cajas.map((c) => {
        const esPorteria = c.tipo === "guardia";
        const sinIntegrar = esPorteria && c.estado === "cerrada";
        const integrada = esPorteria && c.estado === "integrada";
        const hrefCaja = `/caja?fecha=${c.fecha}&tipo=${c.tipo}`;
        const rendido = c.rendidoEfectivo + c.rendidoTransferencia;
        return (
          // Primera columna de ancho fijo: "Tiene que haber…" empieza en el mismo lugar en
          // todas las filas (el sello "En caja mayor" ya no la corre).
          <li
            key={c.id}
            data-tour="tesoreria-caja-fila"
            className="grid gap-4 px-4 py-4 sm:px-5 md:grid-cols-[14rem_minmax(0,1fr)] md:items-center xl:grid-cols-[16rem_minmax(0,1fr)_auto]"
          >
            <div className="min-w-0 space-y-1">
              <p className="text-base font-semibold">{capitalizar(formatFechaLarga(c.fecha))}</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {esPorteria ? "Caja de portería" : "Administración"}
                </span>
                <Sello estado={c.estado} />
                {c.pideReapertura ? <Sello estado="reapertura_pedida" /> : null}
              </div>
              {c.cerradaPor ? (
                <p className="text-sm break-words text-muted-foreground">La cerró {c.cerradaPor}</p>
              ) : null}
              {c.pideReapertura && c.reaperturaMotivo ? (
                <p className="text-sm break-words text-parcial">«{c.reaperturaMotivo}»</p>
              ) : null}
            </div>

            <div className="min-w-0 space-y-1.5">
              <p className="text-base">
                Tiene que haber <Money monto={c.efectivo} className="text-xl font-bold" /> en efectivo
              </p>
              <p className="text-sm text-muted-foreground tabular">
                Banco {formatARS(c.transferencia)}
                {!esPorteria ? ` · Cheques ${formatARS(c.cheques)}` : ""}
                {c.gastos > 0 ? ` · Gastos pagados −${formatARS(c.gastos)}` : ""}
                {c.ajustes !== 0 ? ` · Ajustes ${c.ajustes > 0 ? "+" : "−"}${formatARS(Math.abs(c.ajustes))}` : ""}
              </p>
              {esPorteria ? (
                <p className="text-sm tabular">
                  Quintas {formatARS(c.quintas)} · Ambulantes {formatARS(c.ambulantes)} · Bono camioneros{" "}
                  {formatARS(c.canon)}
                </p>
              ) : rendido > 0 ? (
                <p className="text-sm tabular">
                  Caja de portería {formatARS(rendido)} — Quintas {formatARS(c.rendidoQuintas)} · Ambulantes{" "}
                  {formatARS(c.rendidoAmbulantes)} · Bono camioneros {formatARS(c.rendidoCanon)}
                </p>
              ) : null}
              {sinIntegrar ? (
                <p className="text-sm font-medium text-parcial">
                  Falta que Administración la reciba: después se valida junto con su caja.
                </p>
              ) : integrada ? (
                <p className="text-sm text-muted-foreground">
                  Ya está en la caja de administración
                  {c.destinoFecha ? ` del ${formatFecha(c.destinoFecha).slice(0, 5)}` : ""}
                  {c.destinoAbierta
                    ? ", que sigue abierta: se valida con esa cuando la cierren."
                    : ": se valida con esa."}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2 md:col-span-2 md:justify-end xl:col-span-1">
              <Button asChild variant="outline" size="icon" className="size-11" aria-label="Imprimir el cierre">
                <Link href={`/cierre-caja/${c.id}`}>
                  <Printer className="size-5" strokeWidth={1.9} />
                </Link>
              </Button>
              {esPorteria ? (
                <Button asChild variant="outline" className="h-11 px-4 text-base">
                  <Link href={hrefCaja}>Ver caja</Link>
                </Button>
              ) : (
                <Button asChild className="h-11 px-4 text-base font-semibold">
                  <Link href={hrefCaja}>
                    <Stamp className="size-4" strokeWidth={2} />
                    Contar y validar
                  </Link>
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
