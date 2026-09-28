import Link from "next/link";
import { ArrowRight, Banknote, Landmark } from "lucide-react";
import { formatFecha, formatFechaHora, formatMoneda, labelPeriodo, type Moneda } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { Sello } from "@/components/shared/sello";
import { hrefFiltroCheque } from "@/components/cheques/filtro-estado";
import { AnularMovimiento } from "@/components/tesoreria/anular-movimiento";
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

/**
 * Movimientos del mes (J6) con su cuenta, moneda y quién los cargó, y el efecto total
 * por cuenta. Los anulados quedan a la vista (tachados, con quién y por qué) y no suman.
 */
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

  // Efecto del mes por moneda y cuenta (sin los anulados).
  const totales: Record<Moneda, Record<Cuenta, number>> = {
    ARS: { efectivo: 0, banco: 0 },
    USD: { efectivo: 0, banco: 0 },
  };
  const vigentes = movimientos.filter((m) => !m.anulado);
  for (const m of vigentes) {
    const e = efectoMovimiento(m);
    totales[m.moneda].efectivo += e.efectivo;
    totales[m.moneda].banco += e.banco;
  }
  const monedas = (["ARS", "USD"] as const).filter((mo) => vigentes.some((m) => m.moneda === mo));
  const anulados = movimientos.length - vigentes.length;

  // Comisión vigente de cada depósito (mismo grupo), para avisar que se anula junto.
  const comisionPorGrupo = new Map<string, number>();
  for (const m of vigentes) {
    if (m.tipo === "comision" && m.grupoId) {
      comisionPorGrupo.set(m.grupoId, (comisionPorGrupo.get(m.grupoId) ?? 0) + m.monto);
    }
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {movimientos.map((m) => {
          const transferencia = m.tipo === "deposito" || m.tipo === "extraccion";
          const signo = m.tipo === "ajuste" ? Math.sign(m.monto) : m.tipo === "ingreso" ? 1 : -1;
          const descripcion = m.descripcion || DESCRIPCION_TIPO[m.tipo];
          const esComisionDeDeposito = m.tipo === "comision" && Boolean(m.grupoId);
          return (
            <li
              key={m.id}
              className={cn(
                "grid gap-2 px-4 py-3 xl:grid-cols-[5.5rem_minmax(0,1fr)_12rem_10rem_6.5rem] xl:items-center xl:gap-4",
                m.anulado && "bg-muted/40"
              )}
            >
              <span className="text-sm text-muted-foreground tabular">{formatFecha(m.fecha).slice(0, 5)}</span>
              <div className="min-w-0 space-y-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Sello
                    estado={m.anulado ? "anulado" : m.tipo}
                    texto={m.anulado ? "Anulado" : LABEL_TIPO_MOVIMIENTO[m.tipo]}
                  />
                  <span className={cn("min-w-0 text-base break-words", m.anulado && "text-muted-foreground line-through")}>
                    {descripcion}
                  </span>
                  {esComisionDeDeposito ? (
                    <span className="text-sm text-muted-foreground">(del depósito)</span>
                  ) : null}
                </div>
                {m.anulado ? (
                  <p className="text-sm break-words text-parcial">
                    Anulado por {m.anulado.por} el {formatFechaHora(m.anulado.en)}: {m.anulado.motivo}
                  </p>
                ) : m.cargadoPor ? (
                  <p className="text-sm text-muted-foreground">Cargó {m.cargadoPor}</p>
                ) : null}
              </div>
              <span className="flex flex-wrap items-center gap-1.5 text-sm">
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
                  "text-base font-semibold tabular xl:text-right",
                  m.anulado && "text-muted-foreground line-through",
                  !m.anulado && !transferencia && signo > 0 && "text-pagado",
                  !m.anulado && !transferencia && signo < 0 && "text-pendiente"
                )}
              >
                {transferencia ? formatMoneda(m.monto, m.moneda) : conSigno(signo * Math.abs(m.monto), m.moneda)}
              </span>
              <span className="xl:text-right">
                {puedeOperar && !m.cajaFecha && !m.anulado && m.vueltoDeCheque ? (
                  // El vuelto de un cheque entregado se deshace junto con el cheque.
                  <Link
                    href={hrefFiltroCheque("todos", m.vueltoDeCheque)}
                    aria-label={`Corregir en Cheques: es el vuelto del cheque N° ${m.vueltoDeCheque}`}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm leading-tight font-medium text-primary underline-offset-4 hover:underline xl:justify-end xl:text-right"
                  >
                    <Banknote className="size-4 shrink-0 xl:hidden" strokeWidth={2} />
                    Corregir en Cheques
                  </Link>
                ) : puedeOperar && !m.cajaFecha && !m.anulado ? (
                  <AnularMovimiento
                    id={m.id}
                    descripcion={descripcion}
                    monto={m.monto}
                    moneda={m.moneda}
                    comisionDelGrupo={
                      m.tipo === "deposito" && m.grupoId ? comisionPorGrupo.get(m.grupoId) ?? null : null
                    }
                    esComisionDeDeposito={esComisionDeDeposito}
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
        {anulados > 0 ? (
          <p className="w-full text-sm text-muted-foreground">
            {anulados === 1 ? "1 movimiento anulado no suma." : `${anulados} movimientos anulados no suman.`}
          </p>
        ) : null}
      </dl>
    </div>
  );
}
