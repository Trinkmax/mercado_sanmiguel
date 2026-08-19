import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  formatARS,
  hoyISO,
  labelPeriodo,
  periodoActual,
  saldoCargo,
} from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { Codigo } from "@/components/shared/codigo";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { FormCobro } from "@/components/cobranza/form-cobro";
import { AvisoDeuda } from "@/components/cobranza/aviso-deuda";

export const metadata = { title: "Cobrar" };

function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Beneficio por pago en término de un cargo (monto − objetivo con beneficio),
 * en centavos enteros con el mismo redondeo que saldoCargo y la RPC.
 */
function beneficioCargo(monto: number, descuentoPct: number): number {
  const montoCents = Math.round(monto * 100);
  const descCentesimas = Math.round(descuentoPct * 100);
  const objetivoCents = Math.floor((montoCents * (10000 - descCentesimas) + 5000) / 10000);
  return Math.max((montoCents - objetivoCents) / 100, 0);
}

export default async function CobrarClientePage({
  params,
}: {
  params: Promise<{ clienteId: string }>;
}) {
  const { clienteId } = await params;
  await requireRol("admin", "guardia", "tesoreria");
  const supabase = await createClient();

  const [clienteRes, cargosRes, saldoFavorRes] = await Promise.all([
    supabase
      .from("clientes")
      .select("id, codigo, nombre, cuotas_mes")
      .eq("id", clienteId)
      .maybeSingle(),
    supabase
      .from("cargos")
      .select(
        "id, codigo, descripcion, periodo, vencimiento, estado, monto, monto_pagado, descuento_pronto_pago, conceptos(orden_imputacion)"
      )
      .eq("cliente_id", clienteId)
      .neq("estado", "anulado"),
    supabase
      .from("v_saldo_favor")
      .select("saldo_favor")
      .eq("cliente_id", clienteId)
      .maybeSingle(),
  ]);

  const cliente = clienteRes.data;
  if (!cliente) notFound();

  const hoy = hoyISO();
  const periodo = periodoActual();

  // Saldo exigible hoy de cada cargo, ordenado por período y orden de imputación
  // (el mismo orden en que la RPC imputa los cobros).
  const todos = (cargosRes.data ?? []).map((c) => ({
    id: c.id,
    codigo: c.codigo,
    descripcion: c.descripcion,
    periodo: c.periodo,
    vencimiento: c.vencimiento,
    orden: Number(c.conceptos?.orden_imputacion ?? 0),
    saldo: saldoCargo(c),
    pagado: Number(c.monto_pagado),
    monto: Number(c.monto),
    descuento: Number(c.descuento_pronto_pago ?? 0),
    vencido: c.vencimiento < hoy,
    enTermino: hoy <= c.vencimiento,
  }));

  const items = todos
    .filter((c) => c.saldo > 0)
    .sort((a, b) => a.periodo.localeCompare(b.periodo) || a.orden - b.orden);

  const deudaTotal = redondear2(items.reduce((acc, c) => acc + c.saldo, 0));
  // Total ORIGINAL del período (pagado + saldo): la cuota sugerida no se achica
  // a medida que el cliente va pagando; siempre es total / N.
  const totalPeriodoActual = redondear2(
    todos
      .filter((c) => c.periodo === periodo)
      .reduce((acc, c) => acc + c.pagado + c.saldo, 0)
  );

  // Crédito del cliente: la RPC lo aplica solo antes de imputar el cobro, así que
  // lo que tiene que pagar hoy es la deuda neta de ese saldo.
  const saldoFavor = Number(saldoFavorRes.data?.saldo_favor ?? 0);
  const deudaNeta = Math.max(redondear2(deudaTotal - saldoFavor), 0);

  // Aviso de deuda activa: beneficio que mantiene (en término) o que perdió (mora).
  const enTerminoConBeneficio = items.filter((c) => c.enTermino && c.descuento > 0);
  const ahorroEnTermino = redondear2(
    enTerminoConBeneficio.reduce(
      (acc, c) => acc + beneficioCargo(c.monto, c.descuento),
      0
    )
  );
  const vencimientoBeneficio = enTerminoConBeneficio.length
    ? enTerminoConBeneficio.map((c) => c.vencimiento).sort()[0]
    : null;
  const vencidos = items.filter((c) => c.vencido);
  const recargoPerdido = redondear2(
    vencidos.reduce((acc, c) => acc + beneficioCargo(c.monto, c.descuento), 0)
  );

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <div>
        <Link
          href="/cobranza"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" strokeWidth={2} />
          Volver a la lista
        </Link>
        <PageHeader
          titulo={cliente.nombre}
          descripcion={`Carpeta N° ${cliente.codigo}`}
          className="pb-0"
        />
      </div>

      {deudaTotal > 0 ? (
        <AvisoDeuda
          hayVencidos={vencidos.length > 0}
          recargoPerdido={recargoPerdido}
          ahorroEnTermino={ahorroEnTermino}
          vencimientoBeneficio={vencimientoBeneficio}
        />
      ) : null}

      {/* Deuda total HOY + desglose */}
      <section className="rounded-lg border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
          <div>
            <p className="text-sm text-muted-foreground">Debe hoy</p>
            {deudaTotal > 0 ? (
              <p className="text-3xl font-bold tabular text-pendiente">
                {formatARS(deudaTotal)}
              </p>
            ) : (
              <p className="text-3xl font-bold tabular text-pagado">
                $ 0 — Al día
              </p>
            )}
          </div>
          <Sello grande estado={deudaTotal > 0 ? "debe" : "al_dia"} />
        </div>

        {items.length > 0 ? (
          <div className="divide-y px-5">
            {items.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-3">
                <Codigo codigo={c.codigo} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.descripcion}</p>
                  <p className="text-sm text-muted-foreground">
                    {labelPeriodo(c.periodo)}
                  </p>
                </div>
                {c.vencido ? <Sello estado="vencido" className="shrink-0" /> : null}
                <Money monto={c.saldo} className="shrink-0 font-semibold" />
              </div>
            ))}
          </div>
        ) : null}

        {saldoFavor > 0 ? (
          <div className="space-y-2 border-t bg-pagado-suave/60 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Sello estado="saldo_favor" />
                <p className="text-sm">Crédito del cliente, se aplica solo</p>
              </div>
              <Money monto={-saldoFavor} className="font-semibold text-pagado" />
            </div>
            {deudaTotal > 0 ? (
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="font-medium">Tiene que pagar hoy</p>
                <p className="text-2xl font-bold tabular">{formatARS(deudaNeta)}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* Siempre montado en la misma posición: tras registrar el cobro, la
          server action revalida y Next re-renderiza esta página; si el
          componente cambiara de rama se perdería la confirmación con el
          sello y el botón "Ver recibo". Con deuda 0 muestra "nada para pagar". */}
      <FormCobro
        clienteId={cliente.id}
        deudaTotal={deudaNeta}
        deudaBruta={deudaTotal}
        cuotasMes={cliente.cuotas_mes}
        totalPeriodoActual={totalPeriodoActual}
        saldoFavorPrevio={saldoFavor}
      />
    </div>
  );
}
