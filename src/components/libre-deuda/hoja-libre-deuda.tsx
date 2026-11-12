import { Fragment } from "react";
import { Check } from "lucide-react";
import { formatCuit, formatFecha, hoyISO, labelPeriodo } from "@/lib/format";
import type { LibreDeuda } from "@/lib/libre-deuda";
import { Marca } from "@/components/shared/marca";
import { Sello } from "@/components/shared/sello";
import { Codigo } from "@/components/shared/codigo";

/**
 * El libre deuda de un cliente, para firmar. Pedido del 12/11/2026: «deberían estar todos los
 * conceptos que él abona y que está pago» (antes faltaba la energía): lista lo del mes, la
 * energía con sus medidores, cada uno con «Pagado».
 */
export function HojaLibreDeuda({ ld }: { ld: LibreDeuda }) {
  const hoy = formatFecha(hoyISO());
  return (
    <div className="etiqueta break-inside-avoid">
      <div className="etiqueta-interior space-y-8 p-8">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b pb-6">
          <Marca />
          <div className="text-right text-sm text-muted-foreground">
            <p>Malagueño, Córdoba</p>
            <p>Emitido el {hoy}</p>
          </div>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-6">
          <h1 className="font-display text-5xl font-bold tracking-wide uppercase">Libre deuda</h1>
          <Sello grande estado="pagado" texto="Libre deuda" />
        </div>

        <section className="space-y-1">
          <p className="text-2xl font-semibold">{ld.nombre}</p>
          <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
            <Codigo codigo={`N° ${ld.codigo}`} />
            {ld.cuit ? <span>CUIT {formatCuit(ld.cuit)}</span> : null}
            {ld.lugares ? <span>{ld.lugares}</span> : null}
          </div>
        </section>

        <p className="text-lg leading-relaxed">
          No registra deudas con la Cooperativa Mercado San Miguel al <strong>{hoy}</strong>.
        </p>

        {ld.renglones.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              {ld.periodo ? `Lo que abona en ${labelPeriodo(ld.periodo).toLowerCase()}` : "Conceptos que abona"}
            </h2>
            <ul className="divide-y border-y">
              {ld.renglones.map((r, i) => (
                <li key={`${r.codigo}-${i}`} className="flex items-start gap-3 py-2.5">
                  <Codigo codigo={r.codigo} className="mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p>{r.nombre}</p>
                    {r.detalle.length > 0 ? (
                      // Cada medidor entero en su renglón: «Medidor N° 28M (1.120 kWh)» no se parte.
                      <p className="text-sm text-muted-foreground">
                        {r.detalle.map((d, j) => (
                          <Fragment key={j}>
                            {j > 0 ? " · " : null}
                            <span className="whitespace-nowrap">{d}</span>
                          </Fragment>
                        ))}
                      </p>
                    ) : null}
                  </div>
                  {ld.periodo ? (
                    <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-pagado">
                      <Check className="size-4" strokeWidth={2.6} />
                      Pagado
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="pt-16">
          <div className="mx-auto w-64 border-t border-foreground pt-2 text-center text-sm">Administración</div>
        </div>

        <p className="text-center text-xs text-muted-foreground">Comprobante interno — sin validez fiscal</p>
      </div>
    </div>
  );
}
