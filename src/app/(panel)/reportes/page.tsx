import Link from "next/link";
import { ArrowRight, Equal, FileText, Minus, Receipt, TrendingUp, type LucideIcon } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatARS, labelPeriodo, periodoActual } from "@/lib/format";
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
import { montosEstimado, sumarEstimado } from "@/lib/estimado";
import { ChartCobranzaDiaria } from "@/components/charts/chart-cobranza-diaria";
import { ChartGastosRubro, type GastoRubro } from "@/components/charts/chart-gastos-rubro";
import { rangoDelPeriodo, serieDesdeTotales } from "@/components/charts/serie-cobranza";

export const metadata = { title: "Reportes" };

const LABEL_TIPO_GASTO = { fijo: "Fijo", variable: "Variable" } as const;

/** Pagado y pendiente de un rubro (o de un subtotal) en la lista del celular. */
function MontosGasto({
  pagado,
  pendiente,
  fuerte = false,
}: {
  pagado: number | string;
  pendiente: number | string;
  fuerte?: boolean;
}) {
  return (
    <dl className="grid grid-cols-2 gap-3">
      <div className="min-w-0">
        <dt className="text-sm text-muted-foreground">Pagado</dt>
        <dd>
          <Money
            monto={pagado}
            className={cn("break-words", fuerte ? "text-lg font-bold" : "text-base font-medium")}
          />
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-sm text-muted-foreground">Pendiente</dt>
        <dd>
          <Money
            monto={pendiente}
            className={cn(
              "break-words",
              fuerte ? "text-lg font-bold" : "text-base font-medium",
              Number(pendiente) > 0 && "text-pendiente"
            )}
          />
        </dd>
      </div>
    </dl>
  );
}

/** Un término del balance con su signo (−, =) pegado adelante: si no entra en el
 * renglón, baja entero y el signo nunca queda colgando. */
function TerminoBalance({
  signo: Signo,
  etiqueta,
  children,
}: {
  signo?: LucideIcon;
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-end gap-3">
      {Signo ? (
        <Signo className="mb-2 size-5 shrink-0 text-muted-foreground" strokeWidth={2} aria-hidden />
      ) : (
        <span aria-hidden className="size-5 shrink-0 sm:hidden" />
      )}
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{etiqueta}</p>
        {children}
      </div>
    </div>
  );
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string | string[] }>;
}) {
  // J7: Reportes es solo del Líder de Procesos.
  const perfil = await requireRol("lider");
  const sp = await searchParams;
  const crudo = typeof sp.periodo === "string" ? sp.periodo : "";
  const periodo = /^\d{4}-\d{2}-01$/.test(crudo) ? crudo : periodoActual();

  const supabase = await createClient();
  const rango = rangoDelPeriodo(periodo);
  // Cobros + bono camioneros por día argentino, sumados en SQL (cobranza_diaria, 0024):
  // traer las filas se cortaba en 1000 y el gráfico daba menos que la tabla.
  const [ingresosRes, gastosRes, cobranzaRes] = await Promise.all([
    supabase.rpc("resumen_conceptos", { p_periodo: periodo }),
    supabase.rpc("resumen_gastos", { p_periodo: periodo }),
    supabase.rpc("cobranza_diaria", { p_desde: rango.desde, p_hasta: rango.hasta }),
  ]);

  const serieCobranza = serieDesdeTotales(rango.desde, rango.hasta, cobranzaRes.data ?? []);
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

  // Estimado = cobrado + falta cobrar: lo que se espera cobrar si los que están en término
  // pagan en término (src/lib/estimado.ts, igual en todo el sistema). Aparte, el tope si pagan
  // fuera de término y los "Beneficios otorgados" (los descuentos ya hechos a quienes pagaron
  // en término, como en la impresión y el Excel).
  const totIngresos = sumarEstimado(ingresos);
  const hayEnTermino = totIngresos.enTermino > 0.5;
  const hayOtorgados = totIngresos.otorgados > 0.5;
  const columnasTotales = 3 + (hayEnTermino ? 1 : 0) + (hayOtorgados ? 1 : 0);
  // El bono camioneros entra en el estimado de acá (se cobra en portería) pero no en el de
  // Facturación, que no lo factura: se aclara para que los dos cuadren.
  const bono = ingresos.find((f) => f.codigo === "BC");
  const bonoCamioneros = bono ? montosEstimado(bono).estimado : 0;

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
        <Button asChild size="lg" className="h-13 px-6 text-base font-semibold" data-tour="reportes-contadora">
          <Link href={`/reporte-mensual/${periodo}`}>
            <FileText className="size-5" strokeWidth={2} />
            Reporte para la contadora
          </Link>
        </Button>
      </PageHeader>

      <SelectorPeriodo periodo={periodo} />

      {/* Cobranza día a día */}
      <Card data-tour="reportes-cobranza">
        <CardHeader>
          <CardTitle className="text-base">Cobranza día a día</CardTitle>
        </CardHeader>
        <CardContent>
          {hayCobros ? (
            <div data-tour="reportes-grafico">
              <ChartCobranzaDiaria data={serieCobranza} />
            </div>
          ) : (
            <p className="py-6 text-sm text-muted-foreground">
              Sin cobros registrados en {labelPeriodo(periodo)}. Cuando entren
              cobros vas a ver acá cuánto se cobró cada día.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Ingresos por concepto */}
      <Card data-tour="reportes-ingresos">
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
              <div className="divide-y" data-tour="reportes-conceptos">
                {ingresos.map((fila) => (
                  <FilaIngreso key={fila.codigo} fila={fila} />
                ))}
              </div>
              <div
                data-tour="reportes-totales"
                className={cn(
                  "mt-4 grid grid-cols-2 gap-4 border-t pt-4",
                  columnasTotales === 5
                    ? "sm:grid-cols-3 xl:grid-cols-5"
                    : columnasTotales === 4
                      ? "sm:grid-cols-4"
                      : "sm:grid-cols-3"
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Estimado</p>
                  <Money monto={totIngresos.estimado} className="text-lg font-semibold break-words" />
                  <p className="text-sm text-muted-foreground">pagando en término</p>
                  {bonoCamioneros > 0 ? (
                    <p className="text-sm text-muted-foreground">
                      incluye <span className="whitespace-nowrap">{formatARS(bonoCamioneros)}</span>{" "}
                      de bono camioneros
                    </p>
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Cobrado</p>
                  <Money
                    monto={totIngresos.cobrado}
                    className="text-lg font-bold break-words text-pagado"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Falta cobrar</p>
                  <Money
                    monto={totIngresos.falta}
                    className="text-lg font-bold break-words text-pendiente"
                  />
                </div>
                {hayEnTermino ? (
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Si pagan fuera de término</p>
                    <p className="text-lg font-semibold break-words">
                      <span className="text-base font-normal text-muted-foreground">hasta </span>
                      <Money monto={totIngresos.fueraDeTermino} />
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <span className="whitespace-nowrap">{formatARS(totIngresos.enTermino)}</span> más
                    </p>
                  </div>
                ) : null}
                {hayOtorgados ? (
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Beneficios otorgados</p>
                    <Money monto={totIngresos.otorgados} className="text-lg font-semibold break-words" />
                    <p className="text-sm text-muted-foreground">ya descontados</p>
                  </div>
                ) : null}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Estimado = cobrado + falta cobrar: lo que se espera cobrar si los que están en
                término pagan en término.
                {hayEnTermino
                  ? " Si pagan después del vencimiento, pierden el beneficio y se cobra más, hasta lo que dice «Si pagan fuera de término»."
                  : ""}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Gastos por rubro */}
      <Card data-tour="reportes-gastos">
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
              {/* Celular: cada rubro es una ficha con sus dos montos a la vista */}
              <div className="md:hidden">
                <ul className="divide-y">
                  {gastos.map((g) => (
                    <li
                      key={`${g.codigo}-${g.tipo}`}
                      className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 py-3 first:pt-0"
                    >
                      <Codigo codigo={g.codigo} className="mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium break-words">{g.nombre}</p>
                        <p className="text-sm text-muted-foreground">{LABEL_TIPO_GASTO[g.tipo]}</p>
                      </div>
                      <div className="col-start-2">
                        <MontosGasto pagado={g.pagado} pendiente={g.pendiente} />
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 space-y-4 rounded-lg bg-muted/50 p-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Subtotal fijos</p>
                    <MontosGasto pagado={totFijos.pagado} pendiente={totFijos.pendiente} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Subtotal variables</p>
                    <MontosGasto pagado={totVariables.pagado} pendiente={totVariables.pendiente} />
                  </div>
                  <div className="space-y-1 border-t pt-3">
                    <p className="text-base font-bold">Total del mes</p>
                    <MontosGasto pagado={totGastos.pagado} pendiente={totGastos.pendiente} fuerte />
                  </div>
                </div>
              </div>

              {/* Desde tablet: la tabla de cuatro columnas entra entera */}
              <Table className="text-sm max-md:hidden">
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
                      <TableCell className="whitespace-normal">
                        <span className="flex items-center gap-3">
                          <Codigo codigo={g.codigo} className="shrink-0" />
                          <span className="min-w-0 font-medium break-words">{g.nombre}</span>
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
      <Card data-tour="reportes-balance">
        <CardHeader>
          <CardTitle className="text-lg">Balance de {labelPeriodo(periodo)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-end sm:gap-x-6">
            <TerminoBalance etiqueta="Cobrado">
              <Money
                monto={totIngresos.cobrado}
                className="text-2xl font-bold text-pagado"
              />
            </TerminoBalance>
            <TerminoBalance signo={Minus} etiqueta="Gastado (pagado)">
              <Money monto={totGastos.pagado} className="text-2xl font-bold" />
            </TerminoBalance>
            <TerminoBalance signo={Equal} etiqueta="Resultado del mes">
              <Money
                monto={resultado}
                className={cn(
                  "text-2xl font-bold",
                  resultado >= 0 ? "text-pagado" : "text-pendiente"
                )}
              />
            </TerminoBalance>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
