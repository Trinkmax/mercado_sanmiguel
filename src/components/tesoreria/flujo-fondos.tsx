import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Moneda } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Money } from "@/components/shared/money";
import { MontoMoneda } from "@/components/tesoreria/monto";
import type { Cuenta, Flujo } from "@/components/tesoreria/tipos";

/** Cuentas sin saldo inicial cargado: su número no es un saldo real (puede decir 0 y no serlo). */
export type SinSaldoInicial = Record<Moneda, Record<Cuenta, boolean>>;

function Dato({
  label,
  children,
  nota,
  sinSaldo = false,
}: {
  label: string;
  children: React.ReactNode;
  nota?: React.ReactNode;
  sinSaldo?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className={cn("mt-0.5", sinSaldo && "text-muted-foreground")}>{children}</div>
      {sinSaldo ? (
        <Link
          href="/tesoreria?tab=saldos"
          className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-parcial hover:underline pointer-coarse:min-h-[44px]"
        >
          Falta cargar el saldo inicial
        </Link>
      ) : null}
      {nota ? <div className="mt-1 text-sm">{nota}</div> : null}
    </div>
  );
}

/**
 * La plata de la cooperativa hoy (J2): PESOS (efectivo y banco, con lo que sigue
 * en cajas sin validar), DÓLARES (en US$, nunca sumados a los pesos) y CHEQUES.
 * Una cuenta sin saldo inicial lo avisa en lugar de mostrar su número como real.
 */
export function FlujoFondos({ flujo, sinSaldo }: { flujo: Flujo; sinSaldo: SinSaldoInicial }) {
  return (
    <section aria-label="Plata de la cooperativa hoy" className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 bg-primary px-5 py-4 text-primary-foreground sm:px-6">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight">Plata de la cooperativa hoy</h2>
          <p className="text-sm opacity-85">Efectivo + banco + cheques, en pesos</p>
        </div>
        <Money monto={flujo.total_pesos} className="text-3xl font-bold" />
      </div>

      <div className="grid divide-y lg:grid-cols-[1.3fr_1fr_1fr] lg:divide-x lg:divide-y-0">
        <div className="space-y-4 px-5 py-5 sm:px-6">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Pesos</p>
          <div className="grid grid-cols-2 gap-4">
            <Dato
              label="Efectivo"
              sinSaldo={sinSaldo.ARS.efectivo}
              nota={
                // Incluye las cajas abiertas (la de hoy): la lista "Cajas para contar y
                // validar" muestra solo las cerradas, por eso el texto lo dice.
                flujo.pesos.efectivo_en_cajas !== 0 ? (
                  <Link href="/caja" className="font-medium text-parcial hover:underline">
                    <Money monto={flujo.pesos.efectivo_en_cajas} /> en cajas abiertas o sin validar
                  </Link>
                ) : (
                  <span className="text-muted-foreground">Todo validado</span>
                )
              }
            >
              <Money monto={flujo.pesos.efectivo} className="text-2xl font-bold" />
            </Dato>
            <Dato label="Banco" sinSaldo={sinSaldo.ARS.banco}>
              <Money monto={flujo.pesos.banco} className="text-2xl font-bold" />
            </Dato>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5 sm:px-6">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Dólares</p>
          <div className="grid grid-cols-2 gap-4">
            <Dato label="Efectivo" sinSaldo={sinSaldo.USD.efectivo}>
              <MontoMoneda monto={flujo.dolares.efectivo} moneda="USD" className="text-2xl font-bold" />
            </Dato>
            <Dato label="Banco" sinSaldo={sinSaldo.USD.banco}>
              <MontoMoneda monto={flujo.dolares.banco} moneda="USD" className="text-2xl font-bold" />
            </Dato>
          </div>
          <p className="text-sm text-muted-foreground">Los dólares no se suman a los pesos.</p>
        </div>

        <div className="space-y-4 px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Cheques</p>
            <Link
              href="/cheques"
              className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline pointer-coarse:min-h-[44px]"
            >
              Ver cheques
              <ArrowRight className="size-4" strokeWidth={2} />
            </Link>
          </div>
          <Dato label="Por cobrar">
            <Money monto={flujo.cheques.por_cobrar} className="text-2xl font-bold" />
          </Dato>
          <dl className="grid grid-cols-2 gap-4 text-base">
            <div>
              <dt className="text-sm text-muted-foreground">Listos para depositar</dt>
              <dd>
                <Money
                  monto={flujo.cheques.listos}
                  className={flujo.cheques.listos > 0 ? "font-semibold text-parcial" : "font-semibold"}
                />
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Depositados</dt>
              <dd>
                <Money monto={flujo.cheques.depositados} className="font-semibold" />
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
