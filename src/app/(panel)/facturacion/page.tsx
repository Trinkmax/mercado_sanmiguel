import Link from "next/link";
import { ArrowRight, CalendarRange, Store, Truck, Zap } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { ROLES_REPORTES } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import {
  centavosConBeneficio,
  fechaLocal,
  formatARS,
  formatFecha,
  formatFechaHora,
  labelPeriodo,
  montoConcepto,
  periodoActual,
  sumarMeses,
} from "@/lib/format";
import { montosEstimado, sumarEstimado, type MontosEstimado } from "@/lib/estimado";
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
  /** Centavos a precio completo: Σ cantidad × precio × porcentaje (el monto de cada cargo). */
  completoCents: number;
  /** Centavos pagando en término: Σ monto / (1 + beneficio %), redondeado cargo por cargo. */
  enTerminoCents: number;
  /** Fila del abono de energía que se genera sola (clientes con medidor activo). */
  automatica?: boolean;
};

/**
 * Un cargo del preview: su monto (como lo genera generar_periodo) y lo que paga en término
 * (private.monto_con_beneficio, redondeado igual que la base: round(monto / (1 + %), 2)).
 */
function sumarCargo(item: FilaPreview, monto: number, beneficioPct: number) {
  const cents = Math.round(monto * 100);
  item.completoCents += cents;
  item.enTerminoCents += centavosConBeneficio(cents, beneficioPct);
}

/** Una fila de `resumen_conceptos`: lo estimado y lo cobrado de un concepto en un mes. */
type FilaResumen = {
  codigo: string;
  nombre: string;
  estimado: number;
  cobrado: number;
  descuentos: number;
  pendiente: number;
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
        "cantidad, porcentaje, cliente_id, conceptos!inner(codigo, nombre, precio, orden_imputacion, descuento_pronto_pago, segmento), clientes!inner(activo, categoria)"
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
      .select("id, codigo, nombre, precio, orden_imputacion, activo, descuento_pronto_pago")
      .eq("org_id", perfil.org_id)
      .eq("codigo", "ABEN")
      .maybeSingle(),
    supabase
      .from("medidores")
      .select("cliente_id, clientes!inner(activo, categoria)")
      .eq("org_id", perfil.org_id)
      .eq("activo", true)
      .eq("clientes.activo", true),
    supabase
      .from("cliente_conceptos")
      .select("cliente_id, cantidad, porcentaje, activo, conceptos!inner(codigo)")
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

  // Preview del estimado: cantidad × precio actual × porcentaje, agrupado por concepto. El
  // estimado es pagando en término (con el beneficio de cada concepto, como el resto del
  // sistema, src/lib/estimado.ts); el precio completo va aparte, como tope.
  const porConcepto = new Map<string, FilaPreview>();
  let cargosEstimados = 0;
  for (const fila of previewRes.data ?? []) {
    // Misma regla que generar_periodo (0045, 0047): al ambulante solo se le genera la cochera
    // y la quinta, aunque le haya quedado activa otra fila.
    if (
      fila.clientes.categoria === "ambulante" &&
      fila.conceptos.segmento !== "cocheras" &&
      fila.conceptos.segmento !== "quinteros"
    )
      continue;
    const monto = montoConcepto(
      Number(fila.cantidad),
      Number(fila.conceptos.precio),
      Number(fila.porcentaje ?? 100)
    );
    if (monto <= 0) continue;
    cargosEstimados += 1;
    const item = porConcepto.get(fila.conceptos.codigo) ?? {
      codigo: fila.conceptos.codigo,
      nombre: fila.conceptos.nombre,
      orden: Number(fila.conceptos.orden_imputacion),
      clientes: new Set<string>(),
      completoCents: 0,
      enTerminoCents: 0,
    };
    item.clientes.add(fila.cliente_id);
    sumarCargo(item, monto, Number(fila.conceptos.descuento_pronto_pago ?? 0));
    porConcepto.set(fila.conceptos.codigo, item);
  }
  // Abono de energía (se genera solo): clientes con medidor activo, salvo exentos; la
  // cantidad es la de su fila ABEN activa si la tiene (misma regla que la generación).
  const aben = abenRes.data;
  let abonosEstimados = 0;
  if (aben && aben.activo && Number(aben.precio) > 0) {
    const filaAben = new Map((filasAbenRes.data ?? []).map((f) => [f.cliente_id, f]));
    // Ambulantes y empleados no pagan abono (generar_abonos_energia, 0024 y 0040).
    const conMedidor = new Set(
      (medidoresRes.data ?? [])
        .filter((m) => m.clientes.categoria !== "ambulante" && m.clientes.categoria !== "empleado")
        .map((m) => m.cliente_id)
    );
    const item: FilaPreview = {
      codigo: aben.codigo,
      nombre: aben.nombre,
      orden: Number(aben.orden_imputacion),
      clientes: new Set<string>(),
      completoCents: 0,
      enTerminoCents: 0,
      automatica: true,
    };
    for (const clienteId of conMedidor) {
      const fila = filaAben.get(clienteId);
      if (fila && !fila.activo) continue; // exento
      const cantidad = fila ? Number(fila.cantidad) : 1;
      const porcentaje = fila ? Number(fila.porcentaje ?? 100) : 100;
      const monto = montoConcepto(cantidad, Number(aben.precio), porcentaje);
      if (monto <= 0) continue;
      item.clientes.add(clienteId);
      sumarCargo(item, monto, Number(aben.descuento_pronto_pago ?? 0));
    }
    if (item.clientes.size > 0) {
      abonosEstimados = item.clientes.size;
      cargosEstimados += item.clientes.size;
      porConcepto.set(item.codigo, item);
    }
  }

  const preview = [...porConcepto.values()]
    .sort((a, b) => a.orden - b.orden)
    .map((f) => ({ ...f, estimado: f.enTerminoCents / 100, completo: f.completoCents / 100 }));
  // Total pagando en término (el principal) y a precio completo (el tope si pagan tarde).
  const totalEstimado = preview.reduce((acc, f) => acc + f.enTerminoCents, 0) / 100;
  const totalCompleto = preview.reduce((acc, f) => acc + f.completoCents, 0) / 100;

  // Estimado y cobrado de cada período generado (resumen_conceptos por período), con todo lo
  // que entra en el mes: los conceptos generados, el recupero de energía (los cargos que
  // dejan las lecturas) y el bono camioneros (no tiene estimado: suma lo que se cobra cada
  // día en portería). Estimado = cobrado + falta (pagando en término, src/lib/estimado.ts);
  // el precio completo va debajo, en chico.
  const mesActual = periodoActual();
  const mesGenerado = generados.has(mesActual);
  const [resumenes, resumenMesRes, otrosRes] = await Promise.all([
    Promise.all(historial.map((p) => supabase.rpc("resumen_conceptos", { p_periodo: p.periodo }))),
    // El mes en curso sin generar igual tiene ingresos (el canon de cada día, lecturas ya cargadas).
    mesGenerado
      ? Promise.resolve({ data: null })
      : supabase.rpc("resumen_conceptos", { p_periodo: mesActual }),
    // Energía y canon van siempre en los ingresos del mes, aunque todavía estén en cero.
    supabase
      .from("conceptos")
      .select("codigo, nombre, activo")
      .eq("org_id", perfil.org_id)
      .in("codigo", ["ENER", "BC"]),
  ]);
  const resumenPorPeriodo = new Map<string, MontosEstimado>();
  const filasPorPeriodo = new Map<string, FilaResumen[]>();
  historial.forEach((p, i) => {
    const filas = (resumenes[i].data ?? []) as FilaResumen[];
    filasPorPeriodo.set(p.periodo.slice(0, 10), filas);
    resumenPorPeriodo.set(p.periodo.slice(0, 10), sumarEstimado(filas));
  });

  // Ingresos del mes en curso, concepto por concepto. El recupero de energía y el canon de
  // camiones aparecen siempre: uno se suma con las lecturas de luz y el otro con lo que se
  // cobra cada día (resumen_conceptos solo los trae cuando ya tienen algo).
  const filasDelMes = (
    mesGenerado ? (filasPorPeriodo.get(mesActual) ?? []) : ((resumenMesRes.data ?? []) as FilaResumen[])
  ).map((f) => ({ ...f }));
  const otros = new Map((otrosRes.data ?? []).map((c) => [c.codigo, c]));
  const filaVacia = (codigo: "ENER" | "BC"): FilaResumen | null => {
    const c = otros.get(codigo);
    return c?.activo
      ? { codigo, nombre: c.nombre, estimado: 0, cobrado: 0, descuentos: 0, pendiente: 0 }
      : null;
  };
  const energiaDelMes = filasDelMes.find((f) => f.codigo === "ENER") ?? filaVacia("ENER");
  const canonDelMes = filasDelMes.find((f) => f.codigo === "BC") ?? filaVacia("BC");
  const ingresosDelMes = [
    ...filasDelMes.filter((f) => f.codigo !== "ENER" && f.codigo !== "BC"),
    ...(energiaDelMes ? [energiaDelMes] : []),
    ...(canonDelMes ? [canonDelMes] : []),
  ].map((f) => {
    const m = montosEstimado(f);
    const nota =
      f.codigo === "BC"
        ? "Sin estimado: se suma lo que se cobra cada día en portería."
        : f.codigo === "ENER"
          ? Number(f.estimado) > 0
            ? "Según las lecturas de luz cargadas este mes."
            : "Se suma cuando se cargan las lecturas de luz del mes."
          : null;
    return { codigo: f.codigo, nombre: f.nombre, estimado: m.estimado, cobrado: m.cobrado, nota };
  });
  const totalDelMes = sumarEstimado([
    ...filasDelMes.filter((f) => f.codigo !== "ENER" && f.codigo !== "BC"),
    ...(energiaDelMes ? [energiaDelMes] : []),
    ...(canonDelMes ? [canonDelMes] : []),
  ]);
  const canonCobrado = canonDelMes ? Number(canonDelMes.cobrado) : 0;

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
      completo: resumen?.completo ?? 0,
      cobrado: resumen?.cobrado ?? 0,
    };
  });

  // Ingresos del mes en curso: lo generado, el recupero de energía y el canon de camiones.
  const tarjetaIngresos = (
    <Card data-tour="facturacion-ingresos">
      <CardHeader>
        <CardTitle className="font-display text-2xl font-bold tracking-tight">
          Ingresos de {labelPeriodo(mesActual)}
        </CardTitle>
        <CardDescription className="text-sm/relaxed">
          Lo que se espera cobrar este mes y lo que ya entró, concepto por concepto. El recupero de
          energía se suma con las lecturas de luz y el canon de camiones con lo que se cobra cada día.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!mesGenerado ? (
          <p className="text-sm text-muted-foreground">
            Todavía no se generó {labelPeriodo(mesActual)}: los conceptos mensuales aparecen acá
            cuando lo generes.
          </p>
        ) : null}
        {ingresosDelMes.length > 0 ? (
          <div className="divide-y" data-tour="facturacion-ingresos-conceptos">
            {ingresosDelMes.map((fila) => (
              <div key={fila.codigo} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                <Codigo codigo={fila.codigo} className="shrink-0" />
                <div className="min-w-40 flex-1">
                  <p className="text-sm font-medium break-words">
                    {fila.codigo === "ENER" ? (
                      <Zap
                        className="mr-1.5 inline size-4 align-[-0.15em] text-primary"
                        strokeWidth={2}
                        aria-hidden
                      />
                    ) : fila.codigo === "BC" ? (
                      <Truck
                        className="mr-1.5 inline size-4 align-[-0.15em] text-primary"
                        strokeWidth={2}
                        aria-hidden
                      />
                    ) : null}
                    {fila.nombre}
                  </p>
                  {fila.nota ? <p className="text-sm text-muted-foreground">{fila.nota}</p> : null}
                </div>
                <dl className="grid w-full grid-cols-2 gap-x-6 sm:w-auto sm:grid-cols-[8.5rem_8.5rem] sm:text-right">
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Estimado</dt>
                    <dd>
                      {fila.codigo === "BC" ? (
                        <span className="text-sm text-muted-foreground">sin estimado</span>
                      ) : (
                        <Money monto={fila.estimado} className="text-base font-medium break-words" />
                      )}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Cobrado</dt>
                    <dd>
                      <Money monto={fila.cobrado} className="text-base font-semibold break-words text-pagado" />
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-3" data-tour="facturacion-ingresos-total">
          <div className="col-span-2 min-w-0 sm:col-span-1">
            <p className="text-sm text-muted-foreground">Estimado del mes</p>
            <Money monto={totalDelMes.estimado} className="text-2xl font-bold break-words" />
            <p className="text-sm text-muted-foreground">
              pagando en término
              {canonCobrado > 0 ? (
                <>
                  {" "}
                  · incluye <span className="whitespace-nowrap">{formatARS(canonCobrado)}</span> de canon
                </>
              ) : null}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Cobrado</p>
            <Money monto={totalDelMes.cobrado} className="text-2xl font-bold break-words text-pagado" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Falta cobrar</p>
            <Money monto={totalDelMes.falta} className="text-2xl font-bold break-words text-pendiente" />
          </div>
        </div>
        {totalDelMes.enTermino > 0.5 ? (
          <p className="text-sm text-muted-foreground">
            Si pagan fuera de término, a precio completo: hasta{" "}
            <Money monto={totalDelMes.fueraDeTermino} className="font-semibold text-foreground" />.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Facturación"
        descripcion="A principio de mes se generan los cargos de cada cliente según sus conceptos. Los cambios de precios y cantidades rigen desde la próxima generación."
      />

      {/* Con el mes en curso ya generado, lo primero son sus ingresos; si falta generarlo,
          primero la tarjeta para generarlo. */}
      {mesGenerado ? tarjetaIngresos : null}

      {/* Tarjeta protagonista: el período que toca generar */}
      <Card data-tour="facturacion-mes">
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
              <div className="divide-y" data-tour="facturacion-conceptos">
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
                      {fila.completo - fila.estimado > 0.5 ? (
                        <p className="text-sm text-muted-foreground tabular">
                          <span className="whitespace-nowrap">Si pagan fuera de término:</span>{" "}
                          <span className="whitespace-nowrap">
                            hasta <Money monto={fila.completo} />
                          </span>
                        </p>
                      ) : null}
                    </div>
                    <Money monto={fila.estimado} className="shrink-0 text-base font-medium" />
                  </div>
                ))}
              </div>
              <div className="space-y-1 border-t pt-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="font-medium">
                    Total estimado{" "}
                    <span className="font-normal whitespace-nowrap text-muted-foreground">pagando en término</span>
                  </p>
                  <Money monto={totalEstimado} className="text-2xl font-bold" />
                </div>
                {totalCompleto - totalEstimado > 0.5 ? (
                  <p className="text-sm text-muted-foreground">
                    Si pagan fuera de término, a precio completo: hasta{" "}
                    <Money monto={totalCompleto} className="font-semibold text-foreground" />.
                  </p>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                El consumo de luz (kWh) se suma con las lecturas del mes y el canon de camiones con
                lo que se cobra cada día: los dos se ven en los ingresos del mes. El abono mensual
                de energía ya está incluido.
              </p>
              <GenerarPeriodoBoton
                periodo={proximo}
                label={labelPeriodo(proximo)}
                cargosEstimados={cargosEstimados}
                totalEstimado={totalEstimado}
                totalCompleto={totalCompleto}
                abonosEstimados={abonosEstimados}
              />
            </>
          )}
        </CardContent>
      </Card>

      {mesGenerado ? null : tarjetaIngresos}

      {/* Historial de períodos generados */}
      <Card data-tour="facturacion-historial">
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
                  <li key={p.id} data-tour="facturacion-periodo" className="space-y-3 py-4 first:pt-0 last:pb-0">
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
                          {p.completo - p.estimado > 0.5 ? (
                            <p className="text-sm text-muted-foreground">
                              <span className="whitespace-nowrap">a precio completo</span>{" "}
                              <Money monto={p.completo} className="whitespace-nowrap" />
                            </p>
                          ) : null}
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
                      <Button asChild variant="outline" className="min-h-11 w-full text-sm" data-tour="facturacion-ver-reporte">
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
                    <TableRow key={p.id} data-tour="facturacion-periodo">
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
                        {p.completo - p.estimado > 0.5 ? (
                          <p className="text-muted-foreground">
                            a precio completo <Money monto={p.completo} />
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular">
                        <Money monto={p.cobrado} className="font-semibold text-pagado" />
                      </TableCell>
                      {veReportes ? (
                        <TableCell className="text-right">
                          <Button asChild variant="ghost" className="min-h-11 px-3" data-tour="facturacion-ver-reporte">
                            <Link href={`/reportes?periodo=${p.clave}`}>Ver reporte</Link>
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Estimado = cobrado + lo que falta (pagando en término), igual que en Inicio y
                  Reportes, con el recupero de energía y el bono camioneros adentro. */}
              <p className="mt-4 border-t pt-4 text-sm text-muted-foreground">
                Estimado es lo que se espera cobrar si los que están en término pagan en término: lo
                cobrado más lo que falta cobrar (la misma cuenta que en Inicio
                {veReportes ? " y en cada reporte" : ""}).
                Debajo, en chico, el precio completo: lo que suman los cargos sin ningún beneficio, si
                todos pagaran fuera de término. Incluye el recupero de energía (según las lecturas
                cargadas) y el canon de camiones (lo que se cobró cada día en portería).
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
