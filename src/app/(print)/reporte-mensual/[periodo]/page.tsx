import { notFound } from "next/navigation";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatFecha, hoyISO, labelPeriodo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BotonImprimir } from "@/components/shared/boton-imprimir";
import { Marca } from "@/components/shared/marca";
import { Money } from "@/components/shared/money";

export const metadata = { title: "Reporte mensual" };

const LABEL_TIPO_GASTO = { fijo: "Fijo", variable: "Variable" } as const;

const th = "py-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground";
const td = "py-1.5 align-top";

export default async function ReporteMensualPage({
  params,
}: {
  params: Promise<{ periodo: string }>;
}) {
  const { periodo } = await params;
  if (!/^\d{4}-\d{2}-01$/.test(periodo)) notFound();

  const perfil = await requireRol("tesoreria", "consejo", "lider");
  const supabase = await createClient();

  const [ingresosRes, gastosRes] = await Promise.all([
    supabase.rpc("resumen_conceptos", { p_periodo: periodo }),
    supabase.rpc("resumen_gastos", { p_periodo: periodo }),
  ]);

  const ingresos = ingresosRes.data ?? [];
  const gastos = [...(gastosRes.data ?? [])].sort((a, b) =>
    a.tipo === b.tipo ? a.codigo.localeCompare(b.codigo) : a.tipo === "fijo" ? -1 : 1
  );

  const totIngresos = ingresos.reduce(
    (acc, f) => ({
      estimado: acc.estimado + Number(f.estimado),
      cobrado: acc.cobrado + Number(f.cobrado),
      descuentos: acc.descuentos + Number(f.descuentos),
      pendiente: acc.pendiente + Number(f.pendiente),
    }),
    { estimado: 0, cobrado: 0, descuentos: 0, pendiente: 0 }
  );
  const totGastos = gastos.reduce(
    (acc, g) => ({
      pagado: acc.pagado + Number(g.pagado),
      pendiente: acc.pendiente + Number(g.pendiente),
    }),
    { pagado: 0, pendiente: 0 }
  );
  const resultado = totIngresos.cobrado - totGastos.pagado;

  return (
    <>
      {/* Sin impresión directa: este reporte suele guardarse como PDF para la contadora. */}
      <BotonImprimir volverA="/reportes" />

      <div className="etiqueta">
        <div className="etiqueta-interior space-y-7">
          {/* Cabecera */}
          <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-foreground pb-4">
            <Marca />
            <div className="text-right">
              <h1 className="font-display text-2xl font-semibold uppercase tracking-wide">
                Reporte mensual
              </h1>
              <p className="font-display text-lg uppercase tracking-wide text-muted-foreground">
                {labelPeriodo(periodo)}
              </p>
            </div>
          </header>

          {/* Ingresos por concepto */}
          <section className="space-y-2">
            <h2 className="font-display text-sm font-semibold uppercase tracking-[0.15em]">
              Ingresos por concepto
            </h2>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-foreground/60 text-left">
                  <th className={cn(th, "pr-3")}>Código</th>
                  <th className={cn(th, "pr-3")}>Concepto</th>
                  <th className={cn(th, "pl-3 text-right")}>Estimado</th>
                  <th className={cn(th, "pl-3 text-right")}>Cobrado</th>
                  <th className={cn(th, "pl-3 text-right")}>Beneficios</th>
                  <th className={cn(th, "pl-3 text-right")}>Pendiente</th>
                </tr>
              </thead>
              <tbody>
                {ingresos.length === 0 ? (
                  <tr className="border-b border-border">
                    <td className={cn(td, "text-muted-foreground")} colSpan={6}>
                      Sin cargos generados en este período.
                    </td>
                  </tr>
                ) : (
                  ingresos.map((f) => (
                    <tr key={f.codigo} className="border-b border-border">
                      <td className={cn(td, "pr-3 font-display tracking-widest")}>
                        {f.codigo}
                      </td>
                      <td className={cn(td, "pr-3")}>{f.nombre}</td>
                      <td className={cn(td, "pl-3 text-right")}>
                        <Money monto={f.estimado} />
                      </td>
                      <td className={cn(td, "pl-3 text-right")}>
                        <Money monto={f.cobrado} />
                      </td>
                      <td className={cn(td, "pl-3 text-right")}>
                        <Money monto={f.descuentos} />
                      </td>
                      <td className={cn(td, "pl-3 text-right")}>
                        <Money monto={f.pendiente} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-foreground font-semibold">
                  <td className="py-2 pr-3" colSpan={2}>
                    Total ingresos
                  </td>
                  <td className="py-2 pl-3 text-right">
                    <Money monto={totIngresos.estimado} />
                  </td>
                  <td className="py-2 pl-3 text-right">
                    <Money monto={totIngresos.cobrado} />
                  </td>
                  <td className="py-2 pl-3 text-right">
                    <Money monto={totIngresos.descuentos} />
                  </td>
                  <td className="py-2 pl-3 text-right">
                    <Money monto={totIngresos.pendiente} />
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>

          {/* Gastos por rubro */}
          <section className="space-y-2">
            <h2 className="font-display text-sm font-semibold uppercase tracking-[0.15em]">
              Gastos por rubro
            </h2>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-foreground/60 text-left">
                  <th className={cn(th, "pr-3")}>Código</th>
                  <th className={cn(th, "pr-3")}>Rubro</th>
                  <th className={cn(th, "pr-3")}>Tipo</th>
                  <th className={cn(th, "pl-3 text-right")}>Pagado</th>
                  <th className={cn(th, "pl-3 text-right")}>Pendiente</th>
                </tr>
              </thead>
              <tbody>
                {gastos.length === 0 ? (
                  <tr className="border-b border-border">
                    <td className={cn(td, "text-muted-foreground")} colSpan={5}>
                      Sin gastos cargados en este período.
                    </td>
                  </tr>
                ) : (
                  gastos.map((g) => (
                    <tr key={g.codigo} className="border-b border-border">
                      <td className={cn(td, "pr-3 font-display tracking-widest")}>
                        {g.codigo}
                      </td>
                      <td className={cn(td, "pr-3")}>{g.nombre}</td>
                      <td className={cn(td, "pr-3")}>{LABEL_TIPO_GASTO[g.tipo]}</td>
                      <td className={cn(td, "pl-3 text-right")}>
                        <Money monto={g.pagado} />
                      </td>
                      <td className={cn(td, "pl-3 text-right")}>
                        <Money monto={g.pendiente} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-foreground font-semibold">
                  <td className="py-2 pr-3" colSpan={3}>
                    Total gastos
                  </td>
                  <td className="py-2 pl-3 text-right">
                    <Money monto={totGastos.pagado} />
                  </td>
                  <td className="py-2 pl-3 text-right">
                    <Money monto={totGastos.pendiente} />
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>

          {/* Resumen */}
          <section className="space-y-1.5 border-t-2 border-foreground pt-4">
            <h2 className="font-display text-sm font-semibold uppercase tracking-[0.15em]">
              Resumen del mes
            </h2>
            <div className="flex items-baseline justify-between">
              <p>Total percibido</p>
              <Money monto={totIngresos.cobrado} className="font-semibold" />
            </div>
            <div className="flex items-baseline justify-between">
              <p>Total gastado</p>
              <Money monto={totGastos.pagado} className="font-semibold" />
            </div>
            <div className="flex items-baseline justify-between text-lg font-bold">
              <p>Resultado del mes</p>
              <Money
                monto={resultado}
                className={resultado >= 0 ? "text-pagado" : "text-pendiente"}
              />
            </div>
          </section>

          {/* Pie */}
          <footer className="flex flex-wrap items-baseline justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
            <p>
              Emitido el {formatFecha(hoyISO())} por {perfil.nombre}.
            </p>
            <p>Documento interno — sin validez fiscal.</p>
          </footer>
        </div>
      </div>
    </>
  );
}
