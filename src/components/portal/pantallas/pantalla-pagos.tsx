import Link from "next/link";
import { ChevronRight, ReceiptText } from "lucide-react";
import { labelPeriodo, periodoActual, redondear2, saldoCargo } from "@/lib/format";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { diaYMesTS, nombreMes, type CargoCrudo } from "@/components/portal/armar-cuenta";
import { LABEL_MEDIO } from "@/components/portal/constantes";
import type { ReciboPortal } from "@/components/portal/datos-portal";

function comoPago(r: ReciboPortal): string {
  if (r.medios.length === 1 && r.titular) return `Transferencia de ${r.titular}`;
  return r.medios.map((m) => LABEL_MEDIO[m] ?? m).join(" + ");
}

/** El talonario: un talón por pago, agrupados por mes. Lo que antes eran «Meses anteriores». */
export function PantallaPagos({ recibos, cargos }: { recibos: ReciboPortal[]; cargos: CargoCrudo[] }) {
  const periodo = periodoActual();
  const porMes = new Map<string, ReciboPortal[]>();
  for (const r of recibos) {
    const clave = diaYMesTS(r.fecha).periodo;
    const lista = porMes.get(clave);
    if (lista) lista.push(r);
    else porMes.set(clave, [r]);
  }
  const meses = [...porMes.entries()].sort(([a], [b]) => (a < b ? 1 : -1));
  const delMes = redondear2((porMes.get(periodo) ?? []).reduce((a, r) => a + r.total, 0));

  return (
    <>
      <div className="portal-espacio-chico" data-tour="encabezado">
        <h1 className="portal-titulo">Mis pagos</h1>
        <p className="portal-bajada">
          {delMes > 0.009 ? (
            <>
              En {nombreMes(periodo)} pagaste <Money monto={delMes} className="font-extrabold text-white" />.
            </>
          ) : (
            `En ${nombreMes(periodo)} todavía no hay pagos anotados.`
          )}
        </p>
      </div>

      <div className="portal-suelo !pt-1">
        {meses.length === 0 ? (
          <div data-tour="portal-pagos portal-pagos-vacio" className="hoja flex flex-col items-center gap-2 px-6 py-9 text-center">
            <ReceiptText aria-hidden className="size-9 text-esmalte" strokeWidth={1.8} />
            <p className="text-[1.15rem] font-extrabold">Todavía no hay pagos</p>
            <p className="max-w-[24rem] text-[1.02rem] leading-snug text-tinta-2 text-pretty">
              Cuando pagues, cada pago aparece acá solo, con su recibo.
            </p>
          </div>
        ) : (
          <div data-tour="portal-pagos" className="flex flex-col gap-7">
            {meses.map(([per, lista]) => {
              const cargosMes = cargos.filter((c) => c.periodo === per);
              const todoPago = cargosMes.length > 0 && cargosMes.every((c) => c.estado === "pagado");
              const falta = redondear2(cargosMes.reduce((a, c) => a + saldoCargo(c), 0));
              const total = redondear2(lista.reduce((a, r) => a + r.total, 0));
              return (
                <section key={per} className="portal-seccion">
                  <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1 px-1.5">
                    <h2 className="portal-seccion-titulo !px-0">{labelPeriodo(per)}</h2>
                    {todoPago ? (
                      <Sello estado="pagado" texto="Todo pagado" />
                    ) : per < periodo && falta > 0.009 ? (
                      <span className="text-[0.98rem] font-bold">
                        Quedó faltando <Money monto={falta} className="font-extrabold" />
                      </span>
                    ) : null}
                  </div>
                  <p className="portal-seccion-nota">
                    {lista.length === 1 ? "Un pago" : `${lista.length} pagos`} por <Money monto={total} className="font-bold" />
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {lista.map((r) => {
                      const { dia, mes } = diaYMesTS(r.fecha);
                      return (
                        <li key={r.pagoId}>
                          <Link href={`/recibos/${r.pagoId}`} data-tour="portal-recibo" className="talon">
                            <span className="talon-fecha" aria-hidden>
                              <span className="talon-dia">{dia}</span>
                              <span className="talon-mes">{mes}</span>
                            </span>
                            <span className="flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-2.5 pl-4">
                              <span className="min-w-0 flex-1">
                                <Money monto={r.total} className="fila-monto block !text-[1.3rem]" />
                                <span className="fila-sub block">
                                  {comoPago(r)} · Recibo N° <span className="tabular">{r.numero}</span>
                                </span>
                              </span>
                              <ChevronRight aria-hidden className="size-5 shrink-0 text-tinta-2" strokeWidth={2.2} />
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
