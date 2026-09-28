import { ArrowRight, Landmark } from "lucide-react";
import { formatFecha, formatMoneda, labelPeriodo, type Moneda } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { Sello } from "@/components/shared/sello";
import { BorrarMovimiento } from "@/components/tesoreria/borrar-movimiento";
import {
  DESCRIPCION_TIPO,
  LABEL_CUENTA,
  LABEL_TIPO_MOVIMIENTO,
  efectoMovimiento,
  type Cuenta,
  type Movimiento,
} from "@/components/tesoreria/tipos";

function conSigno(n: number, moneda: Moneda): string {
  if (n === 0) return formatMoneda(0, moneda);
  return `${n > 0 ? "+" : "−"}${formatMoneda(Math.abs(n), moneda)}`;
}

/** Movimientos del mes (J6) con su cuenta y moneda, y el efecto total por cuenta. */
export function MovimientosMes({
  movimientos,
  mes,
  puedeOperar,
}: {
  movimientos: Movimiento[];
  mes: string;
  puedeOperar: boolean;
}) {
  if (movimientos.length === 0) {
    return (
      <EmptyState
        icono={Landmark}
        titulo={`Sin movimientos en ${labelPeriodo(mes)}`}
        descripcion="Depósitos, extracciones, comisiones e impuestos del banco, ingresos y egresos: registralos con los botones de arriba."
      />
    );
  }

  // Efecto del mes por moneda y cuenta.
  const totales: Record<Moneda, Record<Cuenta, number>> = {
    ARS: { efectivo: 0, banco: 0 },
    USD: { efectivo: 0, banco: 0 },
  };
  for (const m of movimientos) {
    const e = efectoMovimiento(m);
    totales[m.moneda].efectivo += e.efectivo;
    totales[m.moneda].banco += e.banco;
  }
  const monedas = (["ARS", "USD"] as const).filter((mo) => movimientos.some((m) => m.moneda === mo));

  return (
    <div className="space-y-3">
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {movimientos.map((m) => {
          const transferencia = m.tipo === "deposito" || m.tipo === "extraccion";
          const signo = m.tipo === "ajuste" ? Math.sign(m.monto) : m.tipo === "ingreso" ? 1 : -1;
          const descripcion = m.descripcion || DESCRIPCION_TIPO[m.tipo];
          return (
            <li
              key={m.id}
              className="grid gap-2 px-4 py-3 md:grid-cols-[5.5rem_minmax(0,1fr)_12rem_10rem_2.75rem] md:items-center md:gap-4"
            >
              <span className="text-sm text-muted-foreground tabular">{formatFecha(m.fecha).slice(0, 5)}</span>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Sello estado={m.tipo} texto={LABEL_TIPO_MOVIMIENTO[m.tipo]} />
                <span className="truncate text-base">{descripcion}</span>
                {m.grupoId && m.tipo === "comision" ? (
                  <span className="text-sm text-muted-foreground">(del depósito)</span>
                ) : null}
              </div>
              <span className="flex items-center gap-1.5 text-sm">
                {m.cajaFecha ? (
                  <>Caja del {formatFecha(m.cajaFecha).slice(0, 5)} · {LABEL_CUENTA[m.cuenta]}</>
                ) : transferencia && m.cuentaDestino ? (
                  <>
                    {LABEL_CUENTA[m.cuenta]}
                    <ArrowRight className="size-4 text-muted-foreground" strokeWidth={2} />
                    {LABEL_CUENTA[m.cuentaDestino]}
                  </>
                ) : (
                  LABEL_CUENTA[m.cuenta]
                )}
                {m.moneda === "USD" ? <span className="font-semibold text-primary">· US$</span> : null}
              </span>
              <span
                className={cn(
                  "text-base font-semibold tabular md:text-right",
                  !transferencia && signo > 0 && "text-pagado",
                  !transferencia && signo < 0 && "text-pendiente"
                )}
              >
                {transferencia ? formatMoneda(m.monto, m.moneda) : conSigno(signo * Math.abs(m.monto), m.moneda)}
              </span>
              <span className="md:text-right">
                {puedeOperar && !m.cajaFecha ? (
                  <BorrarMovimiento
                    id={m.id}
                    descripcion={descripcion}
                    monto={m.monto}
                    moneda={m.moneda}
                    enGrupo={Boolean(m.grupoId)}
                  />
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>

      <dl className="flex flex-wrap gap-x-8 gap-y-2 rounded-xl border bg-muted/40 px-4 py-3 text-base">
        {monedas.map((mo) => (
          <div key={mo} className="flex flex-wrap items-baseline gap-x-3">
            <dt className="font-semibold">
              {mo === "ARS" ? "Pesos" : "Dólares"} en {labelPeriodo(mes).toLowerCase()}:
            </dt>
            <dd className="tabular">
              Efectivo {conSigno(totales[mo].efectivo, mo)} · Banco {conSigno(totales[mo].banco, mo)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
