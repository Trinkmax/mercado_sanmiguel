import { ChevronDown } from "lucide-react";
import { formatFecha, formatFechaHora, type Moneda } from "@/lib/format";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Sello } from "@/components/shared/sello";
import { MontoMoneda } from "@/components/tesoreria/monto";
import { SaldoInicialForm } from "@/components/tesoreria/saldo-inicial-form";

export type SaldoInicial = {
  medio: "efectivo" | "transferencia";
  moneda: Moneda;
  monto: number;
  fecha: string;
  notas: string | null;
  /** Última corrección de monto o fecha (rastro: quién, cuándo, por qué). */
  corregido: { por: string; en: string; motivo: string } | null;
};

const CUENTAS: { medio: "efectivo" | "transferencia"; moneda: Moneda; titulo: string }[] = [
  { medio: "efectivo", moneda: "ARS", titulo: "Pesos en efectivo" },
  { medio: "transferencia", moneda: "ARS", titulo: "Pesos en el banco" },
  { medio: "efectivo", moneda: "USD", titulo: "Dólares en efectivo" },
  { medio: "transferencia", moneda: "USD", titulo: "Dólares en el banco" },
];

/** El día en que arranca la mayoría de los saldos ya cargados (a igual cantidad, el más viejo). */
function diaDeInicio(saldos: SaldoInicial[]): string | null {
  const cuenta = new Map<string, number>();
  for (const s of saldos) cuenta.set(s.fecha, (cuenta.get(s.fecha) ?? 0) + 1);
  let mejor: string | null = null;
  for (const [fecha, n] of cuenta) {
    const m = mejor === null ? 0 : cuenta.get(mejor) ?? 0;
    if (mejor === null || n > m || (n === m && fecha < mejor)) mejor = fecha;
  }
  return mejor;
}

/**
 * Los 4 saldos iniciales (pesos/dólares × efectivo/banco). Los que faltan se
 * muestran abiertos para cargar (proponiendo el mismo día que los ya cargados);
 * los cargados, compactos con "Corregir".
 */
export function SaldosIniciales({ saldos }: { saldos: SaldoInicial[] }) {
  const fechaSugerida = diaDeInicio(saldos);
  return (
    // items-start: una tarjeta cargada no se estira hasta el alto del formulario de al lado.
    <div className="grid gap-4 md:grid-cols-2 md:items-start">
      {CUENTAS.map((c) => {
        const s = saldos.find((x) => x.medio === c.medio && x.moneda === c.moneda) ?? null;
        return (
          <section key={`${c.medio}-${c.moneda}`} className="rounded-xl border bg-card p-5" aria-label={c.titulo}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-base font-bold tracking-tight">{c.titulo}</h3>
              {s ? <Sello estado="pagado" texto="Cargado" /> : <Sello estado="pendiente" texto="Falta cargar" />}
            </div>
            {s ? (
              <div className="space-y-2">
                <MontoMoneda monto={s.monto} moneda={c.moneda} className="block text-2xl font-bold" />
                <p className="text-sm break-words text-muted-foreground">
                  Al comenzar el {formatFecha(s.fecha)}
                  {s.notas ? ` · ${s.notas}` : ""}
                </p>
                {s.corregido ? (
                  <p className="text-sm break-words text-parcial">
                    Corregido por {s.corregido.por} el {formatFechaHora(s.corregido.en)}: {s.corregido.motivo}
                  </p>
                ) : null}
                <Collapsible>
                  <CollapsibleTrigger className="group flex min-h-11 items-center gap-1.5 text-base font-medium text-primary pointer-coarse:min-h-[44px]">
                    <ChevronDown
                      className="size-4 transition-transform group-data-[state=open]:rotate-180"
                      strokeWidth={2}
                    />
                    Corregir
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3">
                    <SaldoInicialForm
                      medio={c.medio}
                      moneda={c.moneda}
                      monto={s.monto}
                      fecha={s.fecha}
                      notas={s.notas}
                    />
                  </CollapsibleContent>
                </Collapsible>
              </div>
            ) : (
              <SaldoInicialForm
                medio={c.medio}
                moneda={c.moneda}
                monto={null}
                fecha={null}
                notas={null}
                fechaSugerida={fechaSugerida}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}
