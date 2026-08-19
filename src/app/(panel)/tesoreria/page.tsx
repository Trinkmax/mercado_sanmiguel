import {
  ArrowLeftRight,
  FileCheck2,
  FileWarning,
  Landmark,
  ShieldCheck,
} from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  formatARS,
  formatFecha,
  formatFechaHora,
  formatFechaLarga,
  labelPeriodo,
  periodoActual,
  sumarMeses,
} from "@/lib/format";
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
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { Codigo } from "@/components/shared/codigo";
import { BotonExportar } from "@/components/shared/boton-exportar";
import { SelectorMes } from "@/components/tesoreria/selector-mes";
import { NuevoMovimiento } from "@/components/tesoreria/nuevo-movimiento";
import { BorrarMovimiento } from "@/components/tesoreria/borrar-movimiento";
import { SaldoInicialForm } from "@/components/tesoreria/saldo-inicial-form";
import { ValidarCajaDialog } from "@/components/tesoreria/validar-caja-dialog";
import {
  ConciliacionTransferencias,
  type FilaTransferencia,
} from "@/components/tesoreria/conciliacion-transferencias";
import { BotonDesconciliar } from "@/components/tesoreria/boton-desconciliar";
import { ValidarComprobanteGasto } from "@/components/tesoreria/validar-comprobante-gasto";
import { SelloComprobante } from "@/components/gastos/sello-comprobante";

export const metadata = { title: "Tesorería" };

type FlujoCaja = {
  efectivo: number;
  banco: number;
  cheques_en_cartera: number;
  total: number;
};

/** Label visible del tipo de caja (el valor del enum no cambia). */
const TIPO_CAJA_LABEL: Record<string, string> = {
  administracion: "Administración",
  guardia: "Portería",
};

const TIPO_MOV_LABEL: Record<string, string> = {
  impuesto: "Impuesto",
  debito_fiscal: "Débito fiscal (IVA)",
  comision: "Comisión",
  ajuste: "Ajuste",
};

/** Impuestos, débito fiscal y comisiones restan del banco; el ajuste ya trae signo. */
function montoVisualMovimiento(tipo: string, monto: number): number {
  return tipo === "ajuste" ? monto : -monto;
}

const LABEL_MEDIO: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  cheque: "Cheque",
};

const LABEL_ORIGEN_PAGO: Record<string, string> = {
  caja: "desde la caja",
  tesoreria: "desde tesorería",
};

const SIGNED_URL_SEGUNDOS = 3600;

function esImagen(path: string): boolean {
  return /\.(jpe?g|png|webp)$/i.test(path);
}

function CeldaFlujo({
  label,
  monto,
  destacada = false,
}: {
  label: string;
  monto: number;
  destacada?: boolean;
}) {
  if (destacada) {
    return (
      <div className="bg-primary px-5 py-5 text-primary-foreground sm:px-6">
        <p className="font-display text-xs font-semibold uppercase tracking-widest opacity-85">
          {label}
        </p>
        <p className="mt-1 text-3xl font-bold tabular md:text-4xl">
          {formatARS(monto)}
        </p>
      </div>
    );
  }
  return (
    <div className="bg-card px-5 py-5 sm:px-6">
      <p className="font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular md:text-3xl">
        {formatARS(monto)}
      </p>
    </div>
  );
}

function TituloSeccion({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div>
        <h2 className="font-display text-lg font-bold tracking-tight">{titulo}</h2>
        <p className="text-sm text-muted-foreground">{descripcion}</p>
      </div>
      {children ? (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}

export default async function TesoreriaPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const perfil = await requireRol("tesoreria", "consejo", "lider");
  // Consejo y Líder de Procesos ven todo en solo lectura.
  const esTesoreria = perfil.rol === "tesoreria";
  const supabase = await createClient();

  const { mes: mesParam } = await searchParams;
  const mes = /^\d{4}-\d{2}-01$/.test(mesParam ?? "")
    ? (mesParam as string)
    : periodoActual();
  const mesSiguiente = sumarMeses(mes, 1);

  const [
    flujoRes,
    pendientesRes,
    validadasRes,
    movimientosRes,
    saldosRes,
    perfilesRes,
    transferenciasRes,
    conciliadasRes,
    gastosRes,
  ] = await Promise.all([
    supabase.rpc("flujo_caja"),
    supabase
      .from("cajas")
      .select(
        "id, fecha, tipo, estado, cerrada_por, total_efectivo, total_transferencia, total_cheques, total_canon, total_gastos, total_rendido_efectivo, total_rendido_transferencia, reapertura_solicitada_en, reapertura_motivo, caja_destino_id"
      )
      .in("estado", ["cerrada", "integrada"])
      .order("fecha", { ascending: true })
      .order("tipo", { ascending: true }),
    supabase
      .from("cajas")
      .select(
        "id, fecha, tipo, total_efectivo, total_transferencia, total_cheques, total_canon, validada_por, validada_en"
      )
      .eq("estado", "validada")
      .order("validada_en", { ascending: false })
      .limit(6),
    supabase
      .from("movimientos_tesoreria")
      .select("id, fecha, tipo, descripcion, monto")
      .gte("fecha", mes)
      .lt("fecha", mesSiguiente)
      .order("fecha", { ascending: false })
      .order("creado_en", { ascending: false }),
    supabase.from("saldos_iniciales").select("medio, monto, fecha, notas"),
    supabase.from("perfiles").select("user_id, nombre"),
    supabase
      .from("pagos")
      .select(
        "id, numero, fecha, monto, titular_transferencia, comprobante_path, cliente:clientes(nombre, codigo)"
      )
      .eq("medio", "transferencia")
      .eq("anulado", false)
      .eq("conciliado", false)
      .order("fecha", { ascending: true }),
    supabase
      .from("pagos")
      .select(
        "id, numero, fecha, monto, titular_transferencia, conciliado_por, conciliado_en, cliente:clientes(nombre, codigo)"
      )
      .eq("medio", "transferencia")
      .eq("anulado", false)
      .eq("conciliado", true)
      .order("conciliado_en", { ascending: false })
      .limit(10),
    supabase
      .from("gastos")
      .select(
        "id, descripcion, monto, fecha_pago, medio_pago, pagado_desde, factura_path, rubro:rubros_gasto(codigo, nombre)"
      )
      .eq("estado", "pagado")
      .eq("comprobante_validado", false)
      .order("fecha_pago", { ascending: false }),
  ]);

  const flujoRaw = (flujoRes.data ?? {}) as Partial<FlujoCaja>;
  const flujo: FlujoCaja = {
    efectivo: Number(flujoRaw.efectivo ?? 0),
    banco: Number(flujoRaw.banco ?? 0),
    cheques_en_cartera: Number(flujoRaw.cheques_en_cartera ?? 0),
    total: Number(flujoRaw.total ?? 0),
  };

  const pendientes = pendientesRes.data ?? [];
  const validadas = validadasRes.data ?? [];
  const movimientos = movimientosRes.data ?? [];
  const saldos = saldosRes.data ?? [];
  const transferencias = transferenciasRes.data ?? [];
  const conciliadas = conciliadasRes.data ?? [];
  const gastosSinValidar = gastosRes.data ?? [];

  const nombres = new Map(
    (perfilesRes.data ?? []).map((p) => [p.user_id, p.nombre])
  );
  const nombreDe = (userId: string | null) =>
    (userId && nombres.get(userId)) || "—";

  // Fecha de la caja de administración que absorbió cada caja de portería integrada.
  const destinoIds = [
    ...new Set(
      pendientes
        .map((c) => c.caja_destino_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const fechaDestino = new Map<string, string>();
  if (destinoIds.length > 0) {
    const { data: destinos } = await supabase
      .from("cajas")
      .select("id, fecha")
      .in("id", destinoIds);
    for (const d of destinos ?? []) fechaDestino.set(d.id, d.fecha);
  }

  // Links firmados (1 h) para comprobantes de transferencias y facturas de gastos.
  const urlsFirmadas = new Map<string, string>();
  const pathsFirmar = [
    ...transferencias.map((t) => t.comprobante_path),
    ...gastosSinValidar.map((g) => g.factura_path),
  ].filter((p): p is string => Boolean(p));
  if (pathsFirmar.length > 0) {
    const { data: firmadas } = await supabase.storage
      .from("documentos")
      .createSignedUrls(pathsFirmar, SIGNED_URL_SEGUNDOS);
    for (const f of firmadas ?? []) {
      if (f.path && f.signedUrl) urlsFirmadas.set(f.path, f.signedUrl);
    }
  }

  const filasTransferencias: FilaTransferencia[] = transferencias.map((t) => ({
    id: t.id,
    numero: t.numero,
    fecha: t.fecha,
    monto: Number(t.monto),
    clienteNombre: t.cliente?.nombre ?? "—",
    clienteCodigo: t.cliente?.codigo ?? null,
    titular: t.titular_transferencia,
    comprobanteUrl: t.comprobante_path
      ? (urlsFirmadas.get(t.comprobante_path) ?? null)
      : null,
    comprobanteEsImagen: t.comprobante_path ? esImagen(t.comprobante_path) : false,
  }));
  const totalSinConciliar = filasTransferencias.reduce((acc, t) => acc + t.monto, 0);

  const gastosConFactura = gastosSinValidar.filter((g) => Boolean(g.factura_path));
  const gastosSinFactura = gastosSinValidar.filter((g) => !g.factura_path);
  const totalSinFactura = gastosSinFactura.reduce((acc, g) => acc + Number(g.monto), 0);

  const saldoEfectivo = saldos.find((s) => s.medio === "efectivo") ?? null;
  const saldoBanco = saldos.find((s) => s.medio === "transferencia") ?? null;

  const totalMovimientosMes = movimientos.reduce(
    (acc, m) => acc + montoVisualMovimiento(m.tipo, Number(m.monto)),
    0
  );

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Tesorería"
        descripcion="El control de la plata de la cooperativa: cajas, banco, transferencias y comprobantes."
      />

      {/* 1. Flujo de caja: cuánta plata tiene la cooperativa hoy, en vivo */}
      <section aria-label="Flujo de caja">
        <div className="overflow-hidden rounded-xl border bg-border shadow-xs">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 bg-card px-5 py-3.5 sm:px-6">
            <h2 className="font-display text-lg font-bold tracking-tight">
              Flujo de caja
            </h2>
            <p className="text-sm text-muted-foreground">
              Cuánta plata tiene la cooperativa hoy, en vivo
            </p>
          </div>
          <div className="grid gap-px border-t sm:grid-cols-2 lg:grid-cols-4">
            <CeldaFlujo label="Efectivo" monto={flujo.efectivo} />
            <CeldaFlujo label="Banco" monto={flujo.banco} />
            <CeldaFlujo label="Cheques en cartera" monto={flujo.cheques_en_cartera} />
            <CeldaFlujo label="Total" monto={flujo.total} destacada />
          </div>
        </div>
      </section>

      {/* 2. Cajas para validar (cerradas o ya integradas en la caja mayor) */}
      <section className="space-y-4" aria-label="Cajas para validar">
        <TituloSeccion
          titulo="Cajas para validar"
          descripcion={
            esTesoreria
              ? "Controlá cada caja contra el banco y dale el cierre definitivo."
              : "Cajas cerradas que esperan el cierre definitivo de tesorería."
          }
        >
          <BotonExportar dataset="cajas" periodo={mes} label="Cajas del mes (.xlsx)" />
        </TituloSeccion>

        {pendientes.length === 0 ? (
          <EmptyState
            icono={ShieldCheck}
            titulo="No hay cajas pendientes"
            descripcion="Todo controlado."
          />
        ) : (
          <div className="space-y-3">
            {pendientes.map((caja) => {
              const efectivo = Number(caja.total_efectivo ?? 0);
              const transferencia = Number(caja.total_transferencia ?? 0);
              const cheques = Number(caja.total_cheques ?? 0);
              const canon = Number(caja.total_canon ?? 0);
              const gastos = Number(caja.total_gastos ?? 0);
              const rendidoEfectivo = Number(caja.total_rendido_efectivo ?? 0);
              const rendidoTransferencia = Number(caja.total_rendido_transferencia ?? 0);
              const total = efectivo + transferencia + cheques;
              const tipoLabel = TIPO_CAJA_LABEL[caja.tipo] ?? caja.tipo;
              const esAdministracion = caja.tipo === "administracion";
              const integrada = caja.estado === "integrada";
              const fechaCajaDestino = caja.caja_destino_id
                ? (fechaDestino.get(caja.caja_destino_id) ?? null)
                : null;
              const pideReapertura = Boolean(caja.reapertura_solicitada_en);
              return (
                <div
                  key={caja.id}
                  className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4 rounded-xl border bg-card p-5"
                >
                  <div className="min-w-48 space-y-1.5">
                    <p className="font-semibold first-letter:uppercase">
                      {formatFechaLarga(caja.fecha)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {tipoLabel} · La cerró {nombreDe(caja.cerrada_por)}
                    </p>
                    {integrada ? (
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        <Sello estado="integrada" />
                        <span className="text-xs text-muted-foreground">
                          Se valida junto con la caja de administración
                          {fechaCajaDestino ? ` del ${formatFecha(fechaCajaDestino)}` : ""}
                        </span>
                      </div>
                    ) : !esAdministracion ? (
                      <p className="text-xs text-muted-foreground">
                        Sin integrar en la caja de administración
                      </p>
                    ) : null}
                    {pideReapertura ? (
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        <Sello estado="reapertura_pedida" />
                        <span className="text-xs text-parcial">
                          {caja.reapertura_motivo || "Sin motivo"}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-1.5">
                    <dl className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm sm:grid-cols-4">
                      {[
                        ["Efectivo", efectivo],
                        ["Transferencias", transferencia],
                        ["Cheques", cheques],
                        ["Canon", canon],
                      ].map(([label, monto]) => (
                        <div key={label as string}>
                          <dt className="text-muted-foreground">{label}</dt>
                          <dd>
                            <Money monto={monto as number} className="font-medium" />
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {esAdministracion && rendidoEfectivo > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Incluye {formatARS(rendidoEfectivo)} rendidos por portería
                        {rendidoTransferencia > 0
                          ? ` (y ${formatARS(rendidoTransferencia)} por transferencia)`
                          : ""}
                      </p>
                    ) : null}
                    {gastos > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Gastos pagados desde la caja: {formatARS(gastos)} (ya restados)
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-5">
                    <div className="text-right">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Total
                      </p>
                      <p className="text-xl font-bold tabular">{formatARS(total)}</p>
                    </div>
                    {esTesoreria ? (
                      <ValidarCajaDialog
                        caja={{
                          id: caja.id,
                          fecha: caja.fecha,
                          tipoLabel,
                          cerradaPor: nombreDe(caja.cerrada_por),
                          efectivo,
                          transferencia,
                          cheques,
                          canon,
                          gastos,
                          rendidoEfectivo: esAdministracion ? rendidoEfectivo : 0,
                          rendidoTransferencia: esAdministracion ? rendidoTransferencia : 0,
                          integradaEnCajaDel: integrada ? fechaCajaDestino : null,
                          reaperturaMotivo: pideReapertura
                            ? (caja.reapertura_motivo ?? "")
                            : null,
                        }}
                      />
                    ) : (
                      <Sello estado={integrada ? "integrada" : "cerrada"} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Últimas validadas */}
        {validadas.length > 0 ? (
          <Card className="text-sm">
            <CardHeader>
              <CardTitle className="text-base">Últimas validadas</CardTitle>
            </CardHeader>
            <CardContent>
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Efectivo</TableHead>
                    <TableHead className="text-right">Transf.</TableHead>
                    <TableHead className="text-right">Cheques</TableHead>
                    <TableHead className="text-right">Canon</TableHead>
                    <TableHead>Validó</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validadas.map((caja) => (
                    <TableRow key={caja.id}>
                      <TableCell className="py-3 font-medium">
                        {formatFecha(caja.fecha)}
                      </TableCell>
                      <TableCell className="py-3">
                        {TIPO_CAJA_LABEL[caja.tipo] ?? caja.tipo}
                      </TableCell>
                      <TableCell className="py-3 text-right tabular">
                        <Money monto={caja.total_efectivo} />
                      </TableCell>
                      <TableCell className="py-3 text-right tabular">
                        <Money monto={caja.total_transferencia} />
                      </TableCell>
                      <TableCell className="py-3 text-right tabular">
                        <Money monto={caja.total_cheques} />
                      </TableCell>
                      <TableCell className="py-3 text-right tabular">
                        <Money monto={caja.total_canon} />
                      </TableCell>
                      <TableCell className="py-3">
                        {nombreDe(caja.validada_por)}
                        {caja.validada_en ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · {formatFechaHora(caja.validada_en)}
                          </span>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}
      </section>

      {/* 3. Conciliación bancaria: transferencias recibidas vs. resumen del banco */}
      <section className="space-y-4" aria-label="Conciliación bancaria de transferencias">
        <TituloSeccion
          titulo="Conciliación bancaria — transferencias"
          descripcion={
            esTesoreria
              ? "Marcá cada transferencia cuando la veas acreditada en el resumen del banco."
              : "Transferencias cobradas que tesorería todavía no cruzó con el banco."
          }
        >
          {filasTransferencias.length > 0 ? (
            <p className="flex items-center gap-2 rounded-md bg-parcial-suave px-3 py-2 text-sm font-semibold text-parcial">
              <ArrowLeftRight className="size-4 shrink-0" strokeWidth={2} />
              {filasTransferencias.length === 1
                ? `1 transferencia por ${formatARS(totalSinConciliar)} sin conciliar`
                : `${filasTransferencias.length} transferencias por ${formatARS(totalSinConciliar)} sin conciliar`}
            </p>
          ) : null}
        </TituloSeccion>

        {filasTransferencias.length === 0 ? (
          <EmptyState
            icono={Landmark}
            titulo="No hay transferencias sin conciliar"
            descripcion="Cada transferencia que se cobre va a aparecer acá hasta que la cruces con el banco."
          />
        ) : (
          <ConciliacionTransferencias
            filas={filasTransferencias}
            puedeOperar={esTesoreria}
          />
        )}

        {conciliadas.length > 0 ? (
          <Card className="text-sm">
            <CardHeader>
              <CardTitle className="text-base">Últimas conciliadas</CardTitle>
            </CardHeader>
            <CardContent>
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Conciliada</TableHead>
                    <TableHead>Recibo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Titular</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Estado</TableHead>
                    {esTesoreria ? (
                      <TableHead className="w-28 text-right">
                        <span className="sr-only">Acciones</span>
                      </TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conciliadas.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="py-3 tabular">
                        {formatFechaHora(t.conciliado_en)}
                        <span className="text-muted-foreground">
                          {" "}
                          · {nombreDe(t.conciliado_por)}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 tabular font-medium">N° {t.numero}</TableCell>
                      <TableCell className="py-3">
                        {t.cliente?.nombre ?? "—"}
                        {t.cliente ? (
                          <span className="text-muted-foreground tabular">
                            {" "}
                            · Carpeta N° {t.cliente.codigo}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="py-3">
                        {t.titular_transferencia ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-right tabular">
                        <Money monto={t.monto} />
                      </TableCell>
                      <TableCell className="py-3">
                        <Sello estado="conciliado" />
                      </TableCell>
                      {esTesoreria ? (
                        <TableCell className="py-1 text-right">
                          <BotonDesconciliar id={t.id} numero={t.numero} />
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}
      </section>

      {/* 4. Comprobantes de gastos pagados */}
      <section className="space-y-4" aria-label="Comprobantes de gastos">
        <TituloSeccion
          titulo="Comprobantes de gastos"
          descripcion={
            esTesoreria
              ? "Revisá la factura de cada gasto pagado y dale el OK."
              : "Facturas de gastos pagados que esperan el OK de tesorería."
          }
        />

        {gastosConFactura.length === 0 && gastosSinFactura.length === 0 ? (
          <EmptyState
            icono={FileCheck2}
            titulo="No hay comprobantes para revisar"
            descripcion="Cuando se pague un gasto, su factura aparece acá para que la valides."
          />
        ) : null}

        {gastosConFactura.length > 0 ? (
          <Card className="py-0">
            <CardContent className="px-0">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">Pagado</TableHead>
                    <TableHead>Rubro</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Cómo se pagó</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Factura</TableHead>
                    <TableHead className="pr-4 text-right">
                      {esTesoreria ? "Acción" : "Estado"}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gastosConFactura.map((g) => {
                    const url = g.factura_path ? urlsFirmadas.get(g.factura_path) : undefined;
                    return (
                      <TableRow key={g.id}>
                        <TableCell className="pl-4 tabular">{formatFecha(g.fecha_pago)}</TableCell>
                        <TableCell>
                          {g.rubro ? <Codigo codigo={g.rubro.codigo} /> : "—"}
                        </TableCell>
                        <TableCell className="font-medium">{g.descripcion}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {g.medio_pago ? (LABEL_MEDIO[g.medio_pago] ?? g.medio_pago) : "—"}
                          {g.pagado_desde
                            ? ` ${LABEL_ORIGEN_PAGO[g.pagado_desde] ?? ""}`.trimEnd()
                            : ""}
                        </TableCell>
                        <TableCell className="text-right">
                          <Money monto={g.monto} className="font-semibold" />
                        </TableCell>
                        <TableCell>
                          {url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-11 items-center gap-1.5 font-medium text-primary hover:underline"
                            >
                              <FileCheck2 className="size-4" strokeWidth={2} />
                              Ver factura
                            </a>
                          ) : (
                            <span className="text-muted-foreground">No se pudo abrir</span>
                          )}
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          {esTesoreria ? (
                            <ValidarComprobanteGasto id={g.id} descripcion={g.descripcion} />
                          ) : (
                            <SelloComprobante
                              estadoGasto="pagado"
                              tieneFactura
                              validado={false}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}

        {gastosSinFactura.length > 0 ? (
          <Card className="bg-parcial-suave/60 py-0 ring-parcial/50">
            <CardContent className="px-0">
              <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                <FileWarning className="size-5 shrink-0 text-parcial" strokeWidth={1.9} />
                <div>
                  <p className="font-semibold">
                    {gastosSinFactura.length === 1
                      ? `1 gasto pagado sin comprobante por ${formatARS(totalSinFactura)}`
                      : `${gastosSinFactura.length} gastos pagados sin comprobante por ${formatARS(totalSinFactura)}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Pedile la factura a quien lo pagó: se adjunta desde Gastos y
                    después la validás acá.
                  </p>
                </div>
              </div>
              <Table className="border-t bg-card text-sm">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">Pagado</TableHead>
                    <TableHead>Rubro</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Cómo se pagó</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="pr-4 text-right">Comprobante</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gastosSinFactura.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="pl-4 tabular">{formatFecha(g.fecha_pago)}</TableCell>
                      <TableCell>
                        {g.rubro ? <Codigo codigo={g.rubro.codigo} /> : "—"}
                      </TableCell>
                      <TableCell className="font-medium">{g.descripcion}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {g.medio_pago ? (LABEL_MEDIO[g.medio_pago] ?? g.medio_pago) : "—"}
                        {g.pagado_desde
                          ? ` ${LABEL_ORIGEN_PAGO[g.pagado_desde] ?? ""}`.trimEnd()
                          : ""}
                      </TableCell>
                      <TableCell className="text-right">
                        <Money monto={g.monto} className="font-semibold" />
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <SelloComprobante
                          estadoGasto="pagado"
                          tieneFactura={false}
                          validado={false}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}
      </section>

      {/* 5. Flujo de fondos y movimientos bancarios (por mes) */}
      <section className="space-y-4" aria-label="Flujo de fondos y movimientos bancarios">
        <TituloSeccion
          titulo="Flujo de fondos y movimientos bancarios"
          descripcion="Impuestos, débito fiscal (IVA) y comisiones que cobra el banco, y ajustes del saldo."
        >
          <SelectorMes mes={mes} />
          <BotonExportar
            dataset="movimientos_tesoreria"
            periodo={mes}
            label="Exportar movimientos"
          />
          {esTesoreria ? <NuevoMovimiento /> : null}
        </TituloSeccion>

        {movimientos.length === 0 ? (
          <EmptyState
            icono={Landmark}
            titulo={`Sin movimientos en ${labelPeriodo(mes)}`}
            descripcion={
              esTesoreria
                ? "Registrá los impuestos, el débito fiscal y las comisiones del resumen bancario del mes."
                : "Tesorería todavía no registró movimientos este mes."
            }
          />
        ) : (
          <Card className="text-sm">
            <CardContent>
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    {esTesoreria ? (
                      <TableHead className="w-14">
                        <span className="sr-only">Acciones</span>
                      </TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimientos.map((m) => {
                    const monto = Number(m.monto);
                    const visual = montoVisualMovimiento(m.tipo, monto);
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="py-3 font-medium">
                          {formatFecha(m.fecha)}
                        </TableCell>
                        <TableCell className="py-3">
                          <Sello
                            estado={m.tipo}
                            texto={TIPO_MOV_LABEL[m.tipo] ?? m.tipo}
                          />
                        </TableCell>
                        <TableCell className="max-w-72 truncate py-3">
                          {m.descripcion}
                        </TableCell>
                        <TableCell className="py-3 text-right tabular">
                          <Money
                            monto={visual}
                            className={visual > 0 ? "text-pagado" : undefined}
                          />
                        </TableCell>
                        {esTesoreria ? (
                          <TableCell className="py-1 text-right">
                            <BorrarMovimiento
                              id={m.id}
                              descripcion={m.descripcion}
                              monto={monto}
                            />
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={3} className="py-3 font-semibold">
                      Total de {labelPeriodo(mes)}
                    </TableCell>
                    <TableCell className="py-3 text-right tabular font-bold">
                      <Money monto={totalMovimientosMes} />
                    </TableCell>
                    {esTesoreria ? <TableCell /> : null}
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      {/* 6. Saldos iniciales */}
      <section className="space-y-4" aria-label="Saldos iniciales">
        <TituloSeccion
          titulo="Saldos iniciales"
          descripcion="La plata que había al empezar a usar el sistema. Se carga una sola vez."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              { medio: "efectivo", titulo: "Efectivo", saldo: saldoEfectivo },
              { medio: "transferencia", titulo: "Banco", saldo: saldoBanco },
            ] as const
          ).map(({ medio, titulo, saldo }) => (
            <Card key={medio} className="text-sm">
              <CardHeader>
                <CardTitle className="text-base">{titulo}</CardTitle>
              </CardHeader>
              <CardContent>
                {esTesoreria ? (
                  <SaldoInicialForm
                    medio={medio}
                    monto={saldo ? Number(saldo.monto) : null}
                    fecha={saldo?.fecha ?? null}
                    notas={saldo?.notas ?? null}
                  />
                ) : saldo ? (
                  <div className="space-y-1">
                    <p className="text-2xl font-semibold tabular">
                      {formatARS(saldo.monto)}
                    </p>
                    <p className="text-muted-foreground">
                      Al {formatFecha(saldo.fecha)}
                      {saldo.notas ? ` · ${saldo.notas}` : ""}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    Tesorería todavía no cargó este saldo.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
