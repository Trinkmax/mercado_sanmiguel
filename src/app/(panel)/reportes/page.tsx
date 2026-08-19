import Link from "next/link";
import { ArrowRight, Equal, FileText, Minus, Receipt, TrendingUp } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { labelPeriodo, periodoActual, sumarMeses } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Codigo } from "@/components/shared/codigo";
import { Money } from "@/components/shared/money";
import { BotonExportar } from "@/components/shared/boton-exportar";
import { SelectorPeriodo } from "@/components/reportes/selector-periodo";
import { MenuExportar } from "@/components/reportes/menu-exportar";
import { FilaIngreso, type ResumenConcepto } from "@/components/reportes/fila-ingreso";
import { ChartCobranzaDiaria } from "@/components/charts/chart-cobranza-diaria";
import { ChartGastosRubro, type GastoRubro } from "@/components/charts/chart-gastos-rubro";
import { armarSerieDiaria, rangoDelPeriodo } from "@/components/charts/serie-cobranza";

export const metadata = { title: "Reportes" };

const LABEL_TIPO_GASTO = { fijo: "Fijo", variable: "Variable" } as const;

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string | string[] }>;
}) {
  // Reportes es de Dirección: Tesorería, Consejo y Líder de Procesos (sin Administración).
  const perfil = await requireRol("tesoreria", "consejo", "lider");
  const sp = await searchParams;
  const crudo = typeof sp.periodo === "string" ? sp.periodo : "";
  const periodo = /^\d{4}-\d{2}-01$/.test(crudo) ? crudo : periodoActual();

  const supabase = await createClient();
  const siguiente = sumarMeses(periodo, 1);
  // Los pagos son timestamptz: el rango del mes es en hora argentina (UTC-3
  // fijo, sin DST); el día exacto se deriva en memoria con el huso argentino.
  const [ingresosRes, gastosRes, pagosMesRes, canonMesRes] = await Promise.all([
    supabase.rpc("resumen_conceptos", { p_periodo: periodo }),
    supabase.rpc("resumen_gastos", { p_periodo: periodo }),
    supabase
      .from("pagos")
      .select("fecha, monto")
      .eq("anulado", false)
      .gte("fecha", `${periodo}T00:00:00-03:00`)
      .lt("fecha", `${siguiente}T00:00:00-03:00`),
    supabase
      .from("canon_camiones")
      .select("fecha, monto")
      .gte("fecha", periodo)
      .lt("fecha", siguiente),
  ]);

  const rango = rangoDelPeriodo(periodo);
  const serieCobranza = armarSerieDiaria(
    rango.desde,
    rango.hasta,
    pagosMesRes.data ?? [],
    canonMesRes.data ?? []
  );
  const hayCobros = serieCobranza.some((p) => p.monto > 0);

  const ingresos = (ingresosRes.data ?? []) as ResumenConcepto[];
  const gastos = [...(gastosRes.data ?? [])].sort((a, b) =>
    a.tipo === b.tipo ? a.codigo.localeCompare(b.codigo) : a.tipo === "fijo" ? -1 : 1
  );

  // Total por rubro (pagado + pendiente) para el gráfico de barras.
  const totalesRubro = new Map<string, GastoRubro>();
  for (const g of gastos) {
    const total = Number(g.pagado) + Number(g.pendiente);
    const previo = totalesRubro.get(g.codigo);
    if (previo) previo.total += total;
    else totalesRubro.set(g.codigo, { codigo: g.codigo, nombre: g.nombre, total });
  }
  const gastosGrafico = [...totalesRubro.values()];
  const hayGastosConMonto = gastosGrafico.some((g) => g.total > 0);

  const totIngresos = ingresos.reduce(
    (acc, f) => ({
      estimado: acc.estimado + Number(f.estimado),
      cobrado: acc.cobrado + Number(f.cobrado),
      descuentos: acc.descuentos + Number(f.descuentos),
      pendiente: acc.pendiente + Number(f.pendiente),
    }),
    { estimado: 0, cobrado: 0, descuentos: 0, pendiente: 0 }
  );

  const subtotalGastos = (tipo: "fijo" | "variable") =>
    gastos
      .filter((g) => g.tipo === tipo)
      .reduce(
        (acc, g) => ({
          pagado: acc.pagado + Number(g.pagado),
          pendiente: acc.pendiente + Number(g.pendiente),
        }),
        { pagado: 0, pendiente: 0 }
      );
  const totFijos = subtotalGastos("fijo");
  const totVariables = subtotalGastos("variable");
  const totGastos = {
    pagado: totFijos.pagado + totVariables.pagado,
    pendiente: totFijos.pendiente + totVariables.pendiente,
  };

  const resultado = totIngresos.cobrado - totGastos.pagado;

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Reportes"
        descripcion="Cuánto se estimó, cuánto entró y cuánto se gastó en el mes. Todo se puede bajar a Excel."
      >
        <MenuExportar rol={perfil.rol} periodo={periodo} />
        <BotonExportar
          dataset="balance_mensual"
          periodo={periodo}
          label="Balance del mes (.xlsx)"
        />
        <Button asChild size="lg" className="h-13 px-6 text-base font-semibold">
          <Link href={`/reporte-mensual/${periodo}`}>
            <FileText className="size-5" strokeWidth={2} />
            Reporte para la contadora
          </Link>
        </Button>
      </PageHeader>

      <SelectorPeriodo periodo={periodo} />

      {/* Cobranza día a día */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cobranza día a día</CardTitle>
        </CardHeader>
        <CardContent>
          {hayCobros ? (
            <ChartCobranzaDiaria data={serieCobranza} />
          ) : (
            <p className="py-6 text-sm text-muted-foreground">
              Sin cobros registrados en {labelPeriodo(periodo)}. Cuando entren
              cobros vas a ver acá cuánto se cobró cada día.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Ingresos por concepto */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ingresos de {labelPeriodo(periodo)}</CardTitle>
        </CardHeader>
        <CardContent>
          {ingresos.length === 0 ? (
            <EmptyState
              icono={TrendingUp}
              titulo={`Todavía no se generó ${labelPeriodo(periodo)}`}
              descripcion="Cuando se genere el período vas a ver acá lo estimado, lo cobrado y lo que falta, concepto por concepto."
            >
              <Button asChild variant="outline" className="h-11 px-5">
                <Link href="/facturacion">
                  Ir a Facturación
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </EmptyState>
          ) : (
            <>
              <div className="divide-y">
                {ingresos.map((fila) => (
                  <FilaIngreso key={fila.codigo} fila={fila} />
                ))}
              </div>
              <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-4">
                <div>
                  <p className="text-sm text-muted-foreground">Estimado</p>
                  <Money monto={totIngresos.estimado} className="text-lg font-semibold" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cobrado</p>
                  <Money
                    monto={totIngresos.cobrado}
                    className="text-lg font-bold text-pagado"
                  />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Beneficios otorgados</p>
                  <Money monto={totIngresos.descuentos} className="text-lg font-semibold" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Falta cobrar</p>
                  <Money
                    monto={totIngresos.pendiente}
                    className="text-lg font-bold text-pendiente"
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Gastos por rubro */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Gastos de {labelPeriodo(periodo)}</CardTitle>
        </CardHeader>
        <CardContent>
          {gastos.length === 0 ? (
            <EmptyState
              icono={Receipt}
              titulo="Sin gastos este mes"
              descripcion={`No hay gastos cargados en ${labelPeriodo(periodo)}.`}
            />
          ) : (
            <>
              {hayGastosConMonto ? (
                <div className="mb-6 border-b pb-6">
                  <ChartGastosRubro data={gastosGrafico} />
                </div>
              ) : null}
              <Table className="text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead>Rubro</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Pagado</TableHead>
                    <TableHead className="text-right">Pendiente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gastos.map((g) => (
                    <TableRow key={`${g.codigo}-${g.tipo}`}>
                      <TableCell>
                        <span className="flex items-center gap-3">
                          <Codigo codigo={g.codigo} />
                          <span className="font-medium">{g.nombre}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {LABEL_TIPO_GASTO[g.tipo]}
                      </TableCell>
                      <TableCell className="text-right tabular">
                        <Money monto={g.pagado} />
                      </TableCell>
                      <TableCell className="text-right tabular">
                        <Money
                          monto={g.pendiente}
                          className={Number(g.pendiente) > 0 ? "text-pendiente" : undefined}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2}>Subtotal fijos</TableCell>
                    <TableCell className="text-right tabular">
                      <Money monto={totFijos.pagado} />
                    </TableCell>
                    <TableCell className="text-right tabular">
                      <Money monto={totFijos.pendiente} />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={2}>Subtotal variables</TableCell>
                    <TableCell className="text-right tabular">
                      <Money monto={totVariables.pagado} />
                    </TableCell>
                    <TableCell className="text-right tabular">
                      <Money monto={totVariables.pendiente} />
                    </TableCell>
                  </TableRow>
                  <TableRow className="text-base font-bold">
                    <TableCell colSpan={2}>Total del mes</TableCell>
                    <TableCell className="text-right tabular">
                      <Money monto={totGastos.pagado} />
                    </TableCell>
                    <TableCell className="text-right tabular">
                      <Money monto={totGastos.pendiente} />
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {/* Balance simple del mes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Balance de {labelPeriodo(periodo)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Cobrado</p>
              <Money
                monto={totIngresos.cobrado}
                className="text-2xl font-bold text-pagado"
              />
            </div>
            <Minus className="size-5 text-muted-foreground max-sm:hidden" strokeWidth={2} />
            <div>
              <p className="text-sm text-muted-foreground">Gastado (pagado)</p>
              <Money monto={totGastos.pagado} className="text-2xl font-bold" />
            </div>
            <Equal className="size-5 text-muted-foreground max-sm:hidden" strokeWidth={2} />
            <div>
              <p className="text-sm text-muted-foreground">Resultado del mes</p>
              <Money
                monto={resultado}
                className={cn(
                  "text-2xl font-bold",
                  resultado >= 0 ? "text-pagado" : "text-pendiente"
                )}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
