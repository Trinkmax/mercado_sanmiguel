import { ArrowLeftRight, FileCheck2, FileWarning, Landmark, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatARS, formatFecha, formatFechaHora } from "@/lib/format";
import { EmptyState } from "@/components/shared/empty-state";
import { Codigo } from "@/components/shared/codigo";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import {
  ConciliacionTransferencias,
  type FilaTransferencia,
} from "@/components/tesoreria/conciliacion-transferencias";
import { BotonDesconciliar } from "@/components/tesoreria/boton-desconciliar";
import {
  BotonDesconciliarCanon,
  ConciliacionCanon,
  type FilaCanon,
} from "@/components/tesoreria/conciliacion-canon";
import { ValidarComprobanteGasto } from "@/components/tesoreria/validar-comprobante-gasto";
import { SelloComprobante } from "@/components/gastos/sello-comprobante";
import { etiquetaGasto, LABEL_MEDIO_GASTO } from "@/components/gastos/tipos";

function esImagen(path: string): boolean {
  return /\.(jpe?g|png|webp)$/i.test(path);
}

function Titulo({ titulo, descripcion, children }: { titulo: string; descripcion: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div>
        <h2 className="font-display text-lg font-bold tracking-tight">{titulo}</h2>
        <p className="text-sm text-muted-foreground">{descripcion}</p>
      </div>
      {children}
    </div>
  );
}

function comoSePago(g: { pagado_desde: string | null; medio_pago: string | null; caja: { fecha: string } | null }): string {
  if (g.pagado_desde === "cheque") return "Con un cheque";
  if (g.pagado_desde === "caja") return `Caja del ${g.caja ? formatFecha(g.caja.fecha).slice(0, 5) : "día"}`;
  return `Tesorería · ${g.medio_pago ? LABEL_MEDIO_GASTO[g.medio_pago] ?? g.medio_pago : ""}`;
}

/**
 * "[SEGUV] Seguros Varios · " al comienzo del renglón de detalle: el código solo no se
 * entiende. Si el gasto no tiene descripción, el título ya es el nombre del rubro.
 */
function Rubro({
  rubro,
  conDescripcion,
}: {
  rubro: { codigo: string; nombre: string } | null;
  conDescripcion: boolean;
}) {
  if (!rubro) return null;
  return (
    <>
      <Codigo codigo={rubro.codigo} className="mr-1.5 align-middle" />
      {conDescripcion ? `${rubro.nombre} · ` : null}
    </>
  );
}

/** "Camión grande × 2" · "Bono camioneros". */
function detalleCanon(c: { tarifa_nombre: string | null; cantidad: number; tipo: string }): string {
  const nombre = c.tarifa_nombre ?? (c.tipo === "camion" ? "Bono camioneros" : "Ingreso de transporte");
  return c.cantidad > 1 ? `${nombre} × ${c.cantidad}` : nombre;
}

/**
 * Pestaña Conciliar: transferencias de cobros y de bono camioneros contra el banco
 * (J2), y facturas de gastos pagados.
 */
export async function PestanaConciliar({ puedeOperar }: { puedeOperar: boolean }) {
  const supabase = await createClient();
  const [transferenciasRes, conciliadasRes, gastosRes, perfilesRes, canonRes, canonConciliadosRes] = await Promise.all([
    supabase
      .from("pagos")
      .select("id, numero, fecha, monto, titular_transferencia, comprobante_path, cliente:clientes(nombre, codigo)")
      .eq("medio", "transferencia")
      .eq("anulado", false)
      .eq("conciliado", false)
      .order("fecha", { ascending: true }),
    supabase
      .from("pagos")
      .select("id, numero, monto, titular_transferencia, conciliado_por, conciliado_en, cliente:clientes(nombre, codigo)")
      .eq("medio", "transferencia")
      .eq("anulado", false)
      .eq("conciliado", true)
      .order("conciliado_en", { ascending: false })
      .limit(10),
    supabase
      .from("gastos")
      .select("id, descripcion, monto, fecha_pago, medio_pago, pagado_desde, factura_path, rubro:rubros_gasto(codigo, nombre), caja:cajas(fecha)")
      .eq("estado", "pagado")
      .eq("comprobante_validado", false)
      .order("fecha_pago", { ascending: false }),
    supabase.from("perfiles").select("user_id, nombre"),
    supabase
      .from("canon_camiones")
      .select("id, numero, fecha, tarifa_nombre, tipo, cantidad, patente, monto, creado_por")
      .eq("medio", "transferencia")
      .eq("anulado", false)
      .eq("conciliado", false)
      .order("fecha", { ascending: true })
      .order("numero", { ascending: true }),
    supabase
      .from("canon_camiones")
      .select("id, numero, tarifa_nombre, tipo, cantidad, monto, conciliado_por, conciliado_en")
      .eq("medio", "transferencia")
      .eq("anulado", false)
      .eq("conciliado", true)
      .order("conciliado_en", { ascending: false })
      .limit(5),
  ]);

  const transferencias = transferenciasRes.data ?? [];
  const conciliadas = conciliadasRes.data ?? [];
  const gastos = gastosRes.data ?? [];
  const nombres = new Map((perfilesRes.data ?? []).map((p) => [p.user_id, p.nombre]));

  const urls = new Map<string, string>();
  const paths = [
    ...transferencias.map((t) => t.comprobante_path),
    ...gastos.map((g) => g.factura_path),
  ].filter((p): p is string => Boolean(p));
  if (paths.length > 0) {
    const { data: firmadas } = await supabase.storage.from("documentos").createSignedUrls(paths, 3600);
    for (const f of firmadas ?? []) if (f.path && f.signedUrl) urls.set(f.path, f.signedUrl);
  }

  const filas: FilaTransferencia[] = transferencias.map((t) => ({
    id: t.id,
    numero: t.numero,
    fecha: t.fecha,
    monto: Number(t.monto),
    clienteNombre: t.cliente?.nombre ?? "—",
    clienteCodigo: t.cliente?.codigo ?? null,
    titular: t.titular_transferencia,
    comprobanteUrl: t.comprobante_path ? urls.get(t.comprobante_path) ?? null : null,
    comprobanteEsImagen: t.comprobante_path ? esImagen(t.comprobante_path) : false,
  }));
  const totalSinConciliar = filas.reduce((acc, t) => acc + t.monto, 0);
  const filasCanon: FilaCanon[] = (canonRes.data ?? []).map((c) => ({
    id: c.id,
    numero: c.numero,
    fecha: c.fecha,
    detalle: detalleCanon(c),
    patente: c.patente,
    cobro: c.creado_por ? nombres.get(c.creado_por) ?? null : null,
    monto: Number(c.monto),
  }));
  const totalCanon = filasCanon.reduce((acc, c) => acc + c.monto, 0);
  const canonConciliados = canonConciliadosRes.data ?? [];
  const conFactura = gastos.filter((g) => g.factura_path);
  const sinFactura = gastos.filter((g) => !g.factura_path);
  const totalSinFactura = sinFactura.reduce((acc, g) => acc + Number(g.monto), 0);

  return (
    <div className="space-y-10">
      <section className="space-y-4" aria-label="Transferencias sin conciliar">
        <Titulo
          titulo="Transferencias contra el banco"
          descripcion="Marcá cada transferencia cuando la veas acreditada en el resumen del banco."
        >
          {filas.length > 0 ? (
            <p className="flex items-center gap-2 rounded-lg bg-parcial-suave px-3 py-2 text-sm font-semibold text-parcial">
              <ArrowLeftRight className="size-4 shrink-0" strokeWidth={2} />
              {filas.length === 1
                ? `1 transferencia por ${formatARS(totalSinConciliar)} sin conciliar`
                : `${filas.length} transferencias por ${formatARS(totalSinConciliar)} sin conciliar`}
            </p>
          ) : null}
        </Titulo>
        {filas.length === 0 ? (
          <EmptyState
            icono={Landmark}
            titulo="No hay transferencias sin conciliar"
            descripcion="Cada transferencia que se cobre aparece acá hasta que la cruces con el banco."
          />
        ) : (
          <ConciliacionTransferencias filas={filas} puedeOperar={puedeOperar} />
        )}

        {conciliadas.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-base font-semibold">Últimas conciliadas</h3>
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {conciliadas.map((t) => (
                <li
                  key={t.id}
                  className="grid gap-x-4 gap-y-2 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0 text-sm">
                    <p className="font-medium break-words">
                      Recibo N° {t.numero} · {t.cliente?.nombre ?? "—"}
                    </p>
                    <p className="break-words text-muted-foreground">
                      {formatFechaHora(t.conciliado_en)} · {(t.conciliado_por && nombres.get(t.conciliado_por)) || "—"}
                      {t.titular_transferencia ? ` · Titular: ${t.titular_transferencia}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    <Money monto={t.monto} className="font-semibold" />
                    <Sello estado="conciliado" />
                    {puedeOperar ? <BotonDesconciliar id={t.id} numero={t.numero} /> : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="space-y-4" aria-label="Bono camioneros por transferencia">
        <Titulo
          titulo="Bono camioneros por transferencia"
          descripcion="Lo que Portería cobró por transferencia: marcalo cuando lo veas en el resumen del banco."
        >
          {filasCanon.length > 0 ? (
            <p className="flex items-center gap-2 rounded-lg bg-parcial-suave px-3 py-2 text-sm font-semibold text-parcial">
              <Truck className="size-4 shrink-0" strokeWidth={2} />
              {filasCanon.length === 1
                ? `1 cobro por ${formatARS(totalCanon)} sin conciliar`
                : `${filasCanon.length} cobros por ${formatARS(totalCanon)} sin conciliar`}
            </p>
          ) : null}
        </Titulo>
        {filasCanon.length === 0 ? (
          <EmptyState
            icono={Truck}
            titulo="No hay bono camioneros por transferencia sin conciliar"
            descripcion="Cada vez que Portería cobre el bono por transferencia, aparece acá hasta que lo cruces con el banco."
          />
        ) : puedeOperar ? (
          <ConciliacionCanon filas={filasCanon} />
        ) : null}

        {canonConciliados.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-base font-semibold">Últimos conciliados</h3>
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {canonConciliados.map((c) => (
                <li
                  key={c.id}
                  className="grid gap-x-4 gap-y-2 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0 text-sm">
                    <p className="font-medium break-words">
                      Bono N° {c.numero} · {detalleCanon(c)}
                    </p>
                    <p className="text-muted-foreground">
                      {formatFechaHora(c.conciliado_en)} · {(c.conciliado_por && nombres.get(c.conciliado_por)) || "—"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    <Money monto={c.monto} className="font-semibold" />
                    <Sello estado="conciliado" texto="Conciliado" />
                    {puedeOperar ? <BotonDesconciliarCanon id={c.id} numero={c.numero} /> : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="space-y-4" aria-label="Facturas de gastos pagados">
        <Titulo
          titulo="Facturas de gastos pagados"
          descripcion={
            conFactura.length > 0
              ? "Revisá la factura de cada gasto pagado y validala."
              : sinFactura.length > 0
                ? "Todavía no hay facturas para revisar: a estos gastos les falta la factura."
                : "Cuando se adjunte la factura de un gasto pagado, la validás acá."
          }
        />
        {gastos.length === 0 ? (
          <EmptyState
            icono={FileCheck2}
            titulo="No hay facturas para revisar"
            descripcion="Cuando se pague un gasto, su factura aparece acá para que la valides."
          />
        ) : null}

        {conFactura.length > 0 ? (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {conFactura.map((g) => {
              const etiqueta = etiquetaGasto(g.descripcion, g.rubro?.nombre);
              const url = g.factura_path ? urls.get(g.factura_path) : undefined;
              return (
                <li
                  key={g.id}
                  className="grid gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-base font-medium break-words">{etiqueta}</p>
                    <p className="text-sm break-words text-muted-foreground">
                      <Rubro rubro={g.rubro} conDescripcion={Boolean(g.descripcion?.trim())} />
                      {comoSePago(g)} · pagado el {formatFecha(g.fecha_pago).slice(0, 5)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 md:justify-end">
                    <Money monto={g.monto} className="text-base font-semibold" />
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center gap-1.5 font-medium text-primary hover:underline pointer-coarse:min-h-[44px]"
                      >
                        <FileCheck2 className="size-4" strokeWidth={2} />
                        Ver factura
                      </a>
                    ) : null}
                    {puedeOperar ? (
                      <ValidarComprobanteGasto id={g.id} descripcion={etiqueta} />
                    ) : (
                      <SelloComprobante estadoGasto="pagado" tieneFactura validado={false} />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}

        {sinFactura.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-parcial/40 bg-parcial-suave/60">
            <div className="flex items-start gap-3 px-4 py-3.5">
              <FileWarning className="mt-0.5 size-5 shrink-0 text-parcial" strokeWidth={1.9} />
              <div>
                <p className="font-semibold">
                  {sinFactura.length === 1
                    ? `1 gasto pagado sin factura por ${formatARS(totalSinFactura)}`
                    : `${sinFactura.length} gastos pagados sin factura por ${formatARS(totalSinFactura)}`}
                </p>
                <p className="text-sm text-muted-foreground">
                  Pedile la factura a quien lo pagó: se adjunta desde Gastos y después la validás acá.
                </p>
              </div>
            </div>
            <ul className="divide-y border-t bg-card">
              {sinFactura.map((g) => (
                // El monto siempre a la derecha, aunque la descripción ocupe dos renglones.
                <li
                  key={g.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 px-4 py-2.5 text-sm"
                >
                  <span className="min-w-0 space-y-0.5">
                    <span className="block font-medium break-words">{etiquetaGasto(g.descripcion, g.rubro?.nombre)}</span>
                    <span className="block break-words text-muted-foreground">
                      <Rubro rubro={g.rubro} conDescripcion={Boolean(g.descripcion?.trim())} />
                      {comoSePago(g)}
                    </span>
                  </span>
                  <Money monto={g.monto} className="font-semibold" />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
