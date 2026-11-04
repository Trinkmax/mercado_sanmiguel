import Link from "next/link";
import { Bell, ChevronRight, MessageSquareWarning, ReceiptText } from "lucide-react";
import { labelPeriodo } from "@/lib/format";
import type { CategoriaCliente } from "@/lib/segmentos";
import { Money } from "@/components/shared/money";
import { CartelCuenta, CuotasDelMes } from "@/components/portal/cartel-cuenta";
import { FilaConcepto, HojasConcepto } from "@/components/portal/hoja-concepto";
import { fechaLargaTS, type Cuenta } from "@/components/portal/armar-cuenta";
import { LABEL_MEDIO } from "@/components/portal/constantes";
import type { ReciboPortal } from "@/components/portal/datos-portal";
import type { LugarPlano } from "@/components/portal/plano-portal";

/** «Mi cuenta»: el cartel sobre el plano, tu último pago, lo del mes y lo atrasado. */
export function PantallaCuenta({
  cuenta,
  planoLugares,
  ultimo,
  nuevos,
  aResponder,
  avisoHref,
  categoria,
}: {
  cuenta: Cuenta;
  planoLugares: LugarPlano[];
  ultimo: ReciboPortal | null;
  /** Lo que lo espera en Mensajes. */
  nuevos: number;
  /** De eso, los avisos que esperan su versión. */
  aResponder: number;
  /** Adónde lleva el aviso: si hay una sola cosa, directo a ella. */
  avisoHref: string;
  categoria: CategoriaCliente;
}) {
  const conceptos = [
    ...cuenta.conceptosMes,
    ...cuenta.atrasados.flatMap((a) => a.conceptos),
    ...cuenta.conceptoPlan,
  ];

  return (
    <>
      <h1 className="sr-only">Mi cuenta</h1>
      <div className="portal-espacio" aria-hidden />
      {nuevos > 0 ? (
        <div className="pildora-avisos-lugar">
          <Link href={avisoHref} data-tour="portal-avisos" className="pildora-avisos">
            <span className="flex size-[2.15rem] shrink-0 items-center justify-center rounded-full bg-[oklch(0.56_0.215_27)] text-white">
              {aResponder > 0 ? (
                <MessageSquareWarning aria-hidden className="size-[1.2rem]" strokeWidth={2.3} />
              ) : (
                <Bell aria-hidden className="size-[1.2rem]" strokeWidth={2.3} />
              )}
            </span>
            <span className="min-w-0">
              {aResponder > 0
                ? aResponder === 1
                  ? "Respondé un aviso"
                  : `Respondé ${aResponder} avisos`
                : nuevos === 1
                  ? "Tenés un mensaje nuevo"
                  : `Tenés ${nuevos} mensajes nuevos`}
            </span>
            <ChevronRight aria-hidden className="size-5 shrink-0" strokeWidth={2.4} />
          </Link>
        </div>
      ) : null}

      <CartelCuenta cuenta={cuenta} />

      <div className="portal-suelo">
        {ultimo ? (
          <Link href={`/recibos/${ultimo.pagoId}`} data-tour="portal-ultimo-pago" className="hoja fila-toque">
            <span className="fila-icono" aria-hidden>
              <ReceiptText strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="fila-sub block">Tu último pago</span>
              <span className="fila-titulo block">
                <Money monto={ultimo.total} className="font-extrabold" /> · {fechaLargaTS(ultimo.fecha)}
              </span>
              <span className="fila-sub block">
                {ultimo.medios.map((m) => LABEL_MEDIO[m] ?? m).join(" + ")} · Ver el recibo
              </span>
            </span>
            <ChevronRight aria-hidden className="-mr-1.5 size-5 shrink-0 text-tinta-2" strokeWidth={2.2} />
          </Link>
        ) : null}

        <HojasConcepto conceptos={conceptos} lugares={planoLugares}>
          <section className="portal-seccion" data-tour={cuenta.conceptosMes.length === 0 ? "portal-conceptos portal-conceptos-vacio" : "portal-conceptos"}>
            <h2 className="portal-seccion-titulo">Lo de {cuenta.mes}</h2>
            {cuenta.conceptosMes.length === 0 ? (
              <p className="hoja px-4 py-4 text-[1.05rem] leading-snug">
                Todavía no se cargó {cuenta.mes}. Cuando se cargue, lo vas a ver acá.
              </p>
            ) : (
              <>
                {/* En rojo, las cuotas del mes van acá: el cartel habla de lo vencido. */}
                {cuenta.nivel === "vencido" && cuenta.avance && Number(cuenta.avance.falta) > 0.009 && Number(cuenta.avance.cuotas) > 1 ? (
                  <div className="px-1.5 pb-1 [--campo:var(--esmalte)]">
                    <CuotasDelMes avance={cuenta.avance} />
                  </div>
                ) : null}
                <p className="portal-seccion-nota">Tocá uno y te muestro dónde queda.</p>
                <div className="hoja hoja-filas">
                  {cuenta.conceptosMes.map((c) => (
                    <FilaConcepto key={c.id} c={c} />
                  ))}
                </div>
              </>
            )}
          </section>

          {cuenta.atrasados.length > 0 ? (
            <section className="portal-seccion" data-tour="portal-atrasados">
              <h2 className="portal-seccion-titulo">De meses anteriores</h2>
              <p className="portal-seccion-nota">Lo que pagás va primero a lo más viejo.</p>
              {cuenta.atrasados.map((a) => (
                <div key={a.periodo} className="hoja hoja-filas">
                  <p className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-[1.02rem] font-bold">
                    <span>{labelPeriodo(a.periodo)}</span>
                    <span className="text-tinta-2">
                      Falta <Money monto={a.total} className="font-extrabold text-pendiente" />
                    </span>
                  </p>
                  {a.conceptos.map((c) => (
                    <FilaConcepto key={c.id} c={c} />
                  ))}
                </div>
              ))}
            </section>
          ) : null}

          {cuenta.conceptoPlan.length > 0 ? (
            <section className="portal-seccion" data-tour="portal-plan">
              <h2 className="portal-seccion-titulo">Tu plan de pago</h2>
              <p className="portal-seccion-nota">No se vence y no te hace perder el beneficio.</p>
              <div className="hoja hoja-filas">
                {cuenta.conceptoPlan.map((c) => (
                  <FilaConcepto key={c.id} c={c} />
                ))}
              </div>
            </section>
          ) : null}
        </HojasConcepto>

        <p data-tour="portal-donde-pagar" className="px-1.5 text-[1.02rem] leading-snug text-pretty">
          <strong className="font-extrabold">¿Dónde pago?</strong>{" "}
          {categoria === "quintero"
            ? "Con el Jefe de Portería."
            : cuenta.conceptosMes.some((c) => c.codigo === "EXPC")
              ? "En Administración. La cochera también se paga en Portería."
              : "En Administración."}{" "}
          En cuanto te anotan el pago, aparece acá con su recibo.
        </p>
      </div>
    </>
  );
}
