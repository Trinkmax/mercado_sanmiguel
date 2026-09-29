import Link from "next/link";
import { ArrowRight, CalendarRange, Store, Zap } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { ROLES_REPORTES } from "@/lib/roles";
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
  /** Fila del abono de energía que se genera sola (clientes con medidor activo). */
  automatica?: boolean;
};

export default async function FacturacionPage() {
  // J5: Tesorería no factura. Reportes solo el Líder (J7).
  const perfil = await requireRol("admin", "lider");
  const veReportes = ROLES_REPORTES.includes(perfil.rol);
  const supabase = await createClient();

  const [periodosRes, previewRes, configRes, abenRes, medidoresRes, filasAbenRes] = await Promise.all([
    supabase
      .from("periodos")
      .select("id, periodo, vencimiento, generado_en, generado_por")
      .eq("org_id", perfil.org_id)
      .not("generado_en", "is", null)
      .order("periodo", { ascending: false })
      .limit(24),
    supabase
      .from("cliente_conceptos")
      .select(
        "cantidad, cliente_id, conceptos!inner(codigo, nombre, precio, orden_imputacion), clientes!inner(activo)"
      )
      .eq("org_id", perfil.org_id)
      .eq("activo", true)
      .eq("clientes.activo", true)
      .eq("conceptos.activo", true)
      .eq("conceptos.tipo", "recurrente"),
    supabase
      .from("configuracion")
      .select("dia_vencimiento")
      .eq("org_id", perfil.org_id)
      .maybeSingle(),
    // I1: abono mensual de energía (ABEN) a cada cliente activo con medidor activo.
    supabase
      .from("conceptos")
      .select("id, codigo, nombre, precio, orden_imputacion, activo")
      .eq("org_id", perfil.org_id)
      .eq("codigo", "ABEN")
      .maybeSingle(),
    supabase
      .from("medidores")
      .select("cliente_id, clientes!inner(activo)")
      .eq("org_id", perfil.org_id)
      .eq("activo", true)
      .eq("clientes.activo", true),
    supabase
      .from("cliente_conceptos")
      .select("cliente_id, cantidad, activo, conceptos!inner(codigo)")
      .eq("org_id", perfil.org_id)
      .eq("conceptos.codigo", "ABEN"),
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
  // Abono de energía (se genera solo): clientes con medidor activo, salvo exentos; la
  // cantidad es la de su fila ABEN activa si la tiene (misma regla que la generación).
  const aben = abenRes.data;
  let abonosEstimados = 0;
  if (aben && aben.activo && Number(aben.precio) > 0) {
    const filaAben = new Map((filasAbenRes.data ?? []).map((f) => [f.cliente_id, f]));
    const conMedidor = new Set((medidoresRes.data ?? []).map((m) => m.cliente_id));
    const item: FilaPreview = {
      codigo: aben.codigo,
      nombre: aben.nombre,
      orden: Number(aben.orden_imputacion),
      clientes: new Set<string>(),
      subtotal: 0,
      automatica: true,
    };
    for (const clienteId of conMedidor) {
      const fila = filaAben.get(clienteId);
      if (fila && !fila.activo) continue; // exento
      const cantidad = fila ? Number(fila.cantidad) : 1;
      item.clientes.add(clienteId);
      item.subtotal += cantidad * Number(aben.precio);
    }
    if (item.clientes.size > 0) {
      abonosEstimados = item.clientes.size;
      cargosEstimados += item.clientes.size;
      porConcepto.set(item.codigo, item);
    }
  }

  const preview = [...porConcepto.values()].sort((a, b) => a.orden - b.orden);
  const totalEstimado = preview.reduce((acc, f) => acc + f.subtotal, 0);

  // Estimado y cobrado de cada período generado (resumen_conceptos por período). Sin BC:
  // el bono camioneros se cobra en la garita, no se factura.
  const resumenes = await Promise.all(
    historial.map((p) => supabase.rpc("resumen_conceptos", { p_periodo: p.periodo }))
  );
  const resumenPorPeriodo = new Map<string, { estimado: number; cobrado: number }>();
  historial.forEach((p, i) => {
    const filas = (resumenes[i].data ?? []).filter((f) => f.codigo !== "BC");
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

  // Cada período generado, listo para la ficha del celular y la tabla de tablet/escritorio.
  const periodos = historial.map((p) => {
    const clave = p.periodo.slice(0, 10);
    const resumen = resumenPorPeriodo.get(clave);
    return {
      id: p.id,
      clave,
      label: labelPeriodo(clave),
      vence: formatFecha(p.vencimiento),
      generado: formatFechaHora(p.generado_en),
      generadoPor: p.generado_por ? (nombrePorUsuario.get(p.generado_por) ?? null) : null,
      estimado: resumen?.estimado ?? 0,
      cobrado: resumen?.cobrado ?? 0,
    };
  });

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
                    <Codigo codigo={fila.codigo} className="shrink-0" />
                    <div className="min-w-0 flex-1">
                      {/* El nombre entero, en los renglones que haga falta */}
                      <p className="text-sm font-medium break-words">
                        {fila.automatica ? (
                          <Zap
                            className="mr-1.5 inline size-4 align-[-0.15em] text-primary"
                            strokeWidth={2}
                            aria-hidden
                          />
                        ) : null}
                        {fila.nombre}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {fila.clientes.size}{" "}
                        {fila.clientes.size === 1 ? "cliente" : "clientes"}
                        {fila.automatica ? " con medidor · se suma solo" : ""}
                      </p>
                    </div>
                    <Money monto={fila.subtotal} className="shrink-0 text-base font-medium" />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-t pt-4">
                <p className="font-medium">Total estimado</p>
                <Money monto={totalEstimado} className="text-2xl font-bold" />
              </div>
              <p className="text-sm text-muted-foreground">
                El consumo de luz (kWh) se suma con las lecturas del mes; el abono
                mensual de energía ya está incluido.
              </p>
              <GenerarPeriodoBoton
                periodo={proximo}
                label={labelPeriodo(proximo)}
                cargosEstimados={cargosEstimados}
                totalEstimado={totalEstimado}
                abonosEstimados={abonosEstimados}
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
            <>
              {/* Celular: cada período es una ficha apilada, con los montos a la vista */}
              <ul className="divide-y md:hidden">
                {periodos.map((p) => (
                  <li key={p.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
                    <div>
                      <p className="text-base font-semibold">{p.label}</p>
                      <p className="text-sm text-muted-foreground">
                        Vence el {p.vence} · generado el {p.generado}
                        {p.generadoPor ? <span className="break-words"> por {p.generadoPor}</span> : null}
                      </p>
                    </div>
                    <dl className="grid grid-cols-2 gap-3">
                      <div className="min-w-0">
                        <dt className="text-sm text-muted-foreground">Estimado</dt>
                        <dd>
                          <Money monto={p.estimado} className="text-base font-semibold break-words" />
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-sm text-muted-foreground">Cobrado</dt>
                        <dd>
                          <Money monto={p.cobrado} className="text-base font-semibold break-words text-pagado" />
                        </dd>
                      </div>
                    </dl>
                    {veReportes ? (
                      <Button asChild variant="outline" className="min-h-11 w-full text-sm">
                        <Link href={`/reportes?periodo=${p.clave}`}>
                          Ver reporte de {p.label}
                          <ArrowRight className="size-4" />
                        </Link>
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>

              {/* Desde tablet: tabla de cinco columnas que entra entera (el vencimiento va
                  debajo del mes y quién lo generó puede bajar de renglón). */}
              <Table className="text-sm max-md:hidden">
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead>Generado</TableHead>
                    <TableHead className="text-right">Estimado</TableHead>
                    <TableHead className="text-right">Cobrado</TableHead>
                    {veReportes ? (
                      <TableHead>
                        <span className="sr-only">Acciones</span>
                      </TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periodos.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <p className="font-medium">{p.label}</p>
                        <p className="text-muted-foreground">Vence el {p.vence}</p>
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <p>{p.generado}</p>
                        {p.generadoPor ? (
                          <p className="break-words text-muted-foreground">{p.generadoPor}</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular">
                        <Money monto={p.estimado} />
                      </TableCell>
                      <TableCell className="text-right tabular">
                        <Money monto={p.cobrado} className="font-semibold text-pagado" />
                      </TableCell>
                      {veReportes ? (
                        <TableCell className="text-right">
                          <Button asChild variant="ghost" className="min-h-11 px-3">
                            <Link href={`/reportes?periodo=${p.clave}`}>Ver reporte</Link>
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Estimado ≠ cobrado + lo que falta: la diferencia son los beneficios. */}
              <p className="mt-4 border-t pt-4 text-sm text-muted-foreground">
                Estimado es todo lo facturado en el mes, sin descontar los beneficios por pagar en
                término: por eso da más que lo cobrado más lo que falta cobrar.
                {veReportes ? " El detalle, en cada reporte." : null}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
