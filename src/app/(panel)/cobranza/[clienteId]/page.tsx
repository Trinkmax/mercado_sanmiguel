import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgePercent, Users } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatARS, hoyISO, labelPeriodo, periodoActual, saldoCargo } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Codigo } from "@/components/shared/codigo";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { FormCobro } from "@/components/cobranza/form-cobro";

export const metadata = { title: "Cobrar" };

export default async function CobrarClientePage({
  params,
}: {
  params: Promise<{ clienteId: string }>;
}) {
  const { clienteId } = await params;
  await requireRol("admin", "guardia", "tesoreria");
  const supabase = await createClient();

  const [clienteRes, cargosRes] = await Promise.all([
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
    vencido: c.vencimiento < hoy,
    enTermino: hoy <= c.vencimiento,
  }));

  const items = todos
    .filter((c) => c.saldo > 0)
    .sort((a, b) => a.periodo.localeCompare(b.periodo) || a.orden - b.orden);

  const deudaTotal = Math.round(items.reduce((acc, c) => acc + c.saldo, 0) * 100) / 100;
  // Total ORIGINAL del período (pagado + saldo): la cuota sugerida no se achica
  // a medida que el cliente va pagando; siempre es total / N.
  const totalPeriodoActual =
    Math.round(
      todos
        .filter((c) => c.periodo === periodo)
        .reduce((acc, c) => acc + c.pagado + c.saldo, 0) * 100
    ) / 100;
  const hayExppEnTermino = items.some(
    (c) => c.codigo === "EXPP" && c.enTermino
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

        {hayExppEnTermino ? (
          <p className="flex items-start gap-1.5 border-t px-5 py-3 text-sm text-muted-foreground">
            <BadgePercent
              className="mt-0.5 size-4 shrink-0 text-pagado"
              strokeWidth={2}
            />
            Pagando hoy mantiene el descuento por pago en término.
          </p>
        ) : null}
      </section>

      {deudaTotal > 0 ? (
        <FormCobro
          clienteId={cliente.id}
          deudaTotal={deudaTotal}
          cuotasMes={cliente.cuotas_mes}
          totalPeriodoActual={totalPeriodoActual}
        />
      ) : (
        <section className="space-y-4 rounded-lg border bg-card p-6 text-center">
          <p className="text-muted-foreground">
            No tiene nada para pagar hoy.
          </p>
          <Button asChild size="lg" className="h-12 w-full text-base font-semibold">
            <Link href="/cobranza">
              <Users className="size-5" strokeWidth={2} />
              Cobrar a otro cliente
            </Link>
          </Button>
        </section>
      )}
    </div>
  );
}
