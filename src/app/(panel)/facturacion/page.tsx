import Link from "next/link";
import { CalendarRange, Store } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  fechaLocal,
  formatFecha,
  formatFechaHora,
  labelPeriodo,
  periodoActual,
  sumarMeses,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Codigo } from "@/components/shared/codigo";
import { Money } from "@/components/shared/money";
import { GenerarPeriodoBoton } from "@/components/facturacion/generar-periodo-boton";

export const metadata = { title: "Facturación" };

type FilaPreview = {
  codigo: string;
  nombre: string;
  orden: number;
  clientes: Set<string>;
  subtotal: number;
};

export default async function FacturacionPage() {
  await requireRol("admin", "tesoreria", "consejo");
  const supabase = await createClient();

  const [periodosRes, previewRes, configRes] = await Promise.all([
    supabase
      .from("periodos")
      .select("id, periodo, vencimiento, generado_en, generado_por")
      .not("generado_en", "is", null)
      .order("periodo", { ascending: false })
      .limit(24),
    supabase
      .from("cliente_conceptos")
      .select(
        "cantidad, cliente_id, conceptos!inner(codigo, nombre, precio, orden_imputacion), clientes!inner(activo)"
      )
      .eq("activo", true)
      .eq("clientes.activo", true)
      .eq("conceptos.activo", true)
      .eq("conceptos.tipo", "recurrente"),
    supabase.from("configuracion").select("dia_vencimiento").maybeSingle(),
  ]);

  const historial = periodosRes.data ?? [];

  // Próximo período sin generar: el primer mes desde el actual sin fila generada.
  const generados = new Set(historial.map((p) => p.periodo.slice(0, 10)));
  let proximo = periodoActual();
  for (let i = 0; i < 36 && generados.has(proximo); i++) {
    proximo = sumarMeses(proximo, 1);
  }
  const esMesActual = proximo === periodoActual();

  // Vencimiento estimado del próximo período (mismo cálculo que la generación).
  const dProximo = fechaLocal(proximo);
  const ultimoDia = new Date(
    dProximo.getFullYear(),
    dProximo.getMonth() + 1,
    0
  ).getDate();
  const diaVenc = Math.min(configRes.data?.dia_vencimiento ?? 30, ultimoDia);
  const vencimientoProximo = `${dProximo.getFullYear()}-${String(dProximo.getMonth() + 1).padStart(2, "0")}-${String(diaVenc).padStart(2, "0")}`;

  // Preview del estimado: cantidad × precio actual, agrupado por concepto.
  const porConcepto = new Map<string, FilaPreview>();
  let cargosEstimados = 0;
  for (const fila of previewRes.data ?? []) {
    const subtotal = Number(fila.cantidad) * Number(fila.conceptos.precio);
    if (subtotal <= 0) continue;
    cargosEstimados += 1;
    const item = porConcepto.get(fila.conceptos.codigo) ?? {
      codigo: fila.conceptos.codigo,
      nombre: fila.conceptos.nombre,
      orden: Number(fila.conceptos.orden_imputacion),
      clientes: new Set<string>(),
      subtotal: 0,
    };
    item.clientes.add(fila.cliente_id);
    item.subtotal += subtotal;
    porConcepto.set(fila.conceptos.codigo, item);
  }
  const preview = [...porConcepto.values()].sort((a, b) => a.orden - b.orden);
  const totalEstimado = preview.reduce((acc, f) => acc + f.subtotal, 0);

  // Estimado y cobrado de cada período generado (resumen_conceptos por período).
  const resumenes = await Promise.all(
    historial.map((p) => supabase.rpc("resumen_conceptos", { p_periodo: p.periodo }))
  );
  const resumenPorPeriodo = new Map<string, { estimado: number; cobrado: number }>();
  historial.forEach((p, i) => {
    const filas = resumenes[i].data ?? [];
    resumenPorPeriodo.set(p.periodo.slice(0, 10), {
      estimado: filas.reduce((acc, f) => acc + Number(f.estimado), 0),
      cobrado: filas.reduce((acc, f) => acc + Number(f.cobrado), 0),
    });
  });

  // Nombre de quién generó cada período.
  const idsGeneradores = [
    ...new Set(historial.map((p) => p.generado_por).filter((id): id is string => !!id)),
  ];
  const { data: perfiles } =
    idsGeneradores.length > 0
      ? await supabase.from("perfiles").select("user_id, nombre").in("user_id", idsGeneradores)
      : { data: [] };
  const nombrePorUsuario = new Map((perfiles ?? []).map((p) => [p.user_id, p.nombre]));

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Facturación"
        descripcion="A principio de mes se generan los cargos de cada cliente según sus conceptos. Los cambios de precios y cantidades rigen desde la próxima generación."
      />

      {/* Tarjeta protagonista: el período que toca generar */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl font-bold tracking-tight">
            {labelPeriodo(proximo)}
          </CardTitle>
          <CardDescription className="text-sm/relaxed">
            {esMesActual
              ? "El mes en curso todavía no está generado."
              : "Es el próximo mes a generar."}{" "}
            Vence el {formatFecha(vencimientoProximo)}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {preview.length === 0 ? (
            <EmptyState
              icono={Store}
              titulo="No hay nada para facturar"
              descripcion="Ningún cliente activo tiene conceptos asignados. Cargá los conceptos de cada cliente desde su ficha y volvé acá."
            />
          ) : (
            <>
              <div className="divide-y">
                {preview.map((fila) => (
                  <div key={fila.codigo} className="flex items-center gap-4 py-3">
                    <Codigo codigo={fila.codigo} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{fila.nombre}</p>
                      <p className="text-sm text-muted-foreground">
                        {fila.clientes.size}{" "}
                        {fila.clientes.size === 1 ? "cliente" : "clientes"}
                      </p>
                    </div>
                    <Money monto={fila.subtotal} className="font-medium" />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-t pt-4">
                <p className="font-medium">Total estimado</p>
                <Money monto={totalEstimado} className="text-2xl font-bold" />
              </div>
              <p className="text-sm text-muted-foreground">
                La energía se suma aparte, según las lecturas de medidores
                cargadas en el mes.
              </p>
              <GenerarPeriodoBoton
                periodo={proximo}
                label={labelPeriodo(proximo)}
                cargosEstimados={cargosEstimados}
                totalEstimado={totalEstimado}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Historial de períodos generados */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Períodos generados</CardTitle>
        </CardHeader>
        <CardContent>
          {historial.length === 0 ? (
            <EmptyState
              icono={CalendarRange}
              titulo="Todavía no se generó ningún período"
              descripcion="Generá el primero con el botón de arriba: se crean los cargos del mes para todos los clientes."
            />
          ) : (
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Generado</TableHead>
                  <TableHead className="text-right">Estimado</TableHead>
                  <TableHead className="text-right">Cobrado</TableHead>
                  <TableHead className="sr-only">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historial.map((p) => {
                  const clave = p.periodo.slice(0, 10);
                  const resumen = resumenPorPeriodo.get(clave);
                  const generadoPor = p.generado_por
                    ? nombrePorUsuario.get(p.generado_por)
                    : null;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {labelPeriodo(clave)}
                      </TableCell>
                      <TableCell>{formatFecha(p.vencimiento)}</TableCell>
                      <TableCell>
                        {formatFechaHora(p.generado_en)}
                        {generadoPor ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · {generadoPor}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular">
                        <Money monto={resumen?.estimado ?? 0} />
                      </TableCell>
                      <TableCell className="text-right tabular">
                        <Money
                          monto={resumen?.cobrado ?? 0}
                          className="font-semibold text-pagado"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" className="min-h-11 px-3">
                          <Link href={`/reportes?periodo=${clave}`}>Ver reporte</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
