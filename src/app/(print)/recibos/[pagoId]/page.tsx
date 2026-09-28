import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Banknote, FileText, Landmark, Paperclip } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  formatCuit,
  formatFecha,
  formatFechaHora,
  labelPeriodo,
} from "@/lib/format";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { BotonImprimir } from "@/components/shared/boton-imprimir";

type Medio = "efectivo" | "transferencia" | "cheque";

type LineaRecibo = {
  pago_id: string;
  linea: number;
  medio: Medio;
  monto: number;
  anulado: boolean;
  motivo_anulacion: string | null;
  titular_transferencia: string | null;
  tiene_comprobante: boolean;
  comprobante_path: string | null;
  cheque: {
    numero: string;
    cuit: string | null;
    recibido_de: string | null;
    fecha_recibido: string | null;
    fecha_cobro: string | null;
    puesto: string | null;
    estado: string | null;
    proveedor: string | null;
  } | null;
};

/** Lo que devuelve datos_recibo (contrato fase 3, §4.3): el lote completo del pago. */
type DatosRecibo = {
  numero: number;
  lote_id: string;
  fecha: string;
  anulado: boolean;
  cliente: { id: string; codigo: number; nombre: string; apodo: string | null };
  caja: { tipo: string; label: string; fecha: string };
  recibio: string | null;
  notas: string | null;
  total: number;
  lineas: LineaRecibo[];
  imputaciones: {
    cargo_id: string;
    codigo: string;
    descripcion: string;
    periodo: string;
    monto: number;
    beneficio: number;
  }[];
  saldo_favor: number;
};

const ICONO: Record<Medio, typeof Banknote> = {
  efectivo: Banknote,
  transferencia: Landmark,
  cheque: FileText,
};

/** Una sola llamada por request (la usan generateMetadata y la página). */
const leerRecibo = cache(async (pagoId: string): Promise<DatosRecibo | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(pagoId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("datos_recibo", { p_pago: pagoId });
  if (error || !data) return null;
  return data as unknown as DatosRecibo;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pagoId: string }>;
}): Promise<Metadata> {
  const { pagoId } = await params;
  const r = await leerRecibo(pagoId);
  // Es el nombre del PDF al "Guardar como PDF".
  return { title: { absolute: r ? `Recibo N° ${r.numero} — ${r.cliente.nombre}` : "Recibo" } };
}

function textoLinea(l: LineaRecibo, esSocio: boolean): { titulo: string; detalle: string | null } {
  if (l.medio === "efectivo") return { titulo: "Efectivo", detalle: null };
  if (l.medio === "transferencia") {
    const partes = [
      l.titular_transferencia ? `de ${l.titular_transferencia}` : null,
      l.tiene_comprobante ? "comprobante adjunto" : null,
    ].filter(Boolean);
    return { titulo: "Transferencia", detalle: partes.length ? partes.join(" · ") : null };
  }
  const c = l.cheque;
  if (!c) return { titulo: "Cheque", detalle: null };
  const partes = [
    c.cuit ? `CUIT ${formatCuit(c.cuit)}` : null,
    c.recibido_de ? `entregó ${c.recibido_de}` : null,
    c.fecha_cobro ? `se cobra desde ${formatFecha(c.fecha_cobro)}` : null,
    c.puesto,
    !esSocio && c.estado === "entregado" && c.proveedor ? `entregado a ${c.proveedor}` : null,
  ].filter(Boolean);
  return { titulo: `Cheque N° ${c.numero}`, detalle: partes.join(" · ") };
}

export default async function ReciboPage({
  params,
}: {
  params: Promise<{ pagoId: string }>;
}) {
  const { pagoId } = await params;
  const perfil = await requireRol("admin", "guardia", "tesoreria", "lider", "socio");
  const esSocio = perfil.rol === "socio";

  const recibo = await leerRecibo(pagoId);
  if (!recibo) notFound();

  const supabase = await createClient();
  const conComprobante = esSocio ? [] : recibo.lineas.filter((l) => l.comprobante_path);
  const [configRes, ...firmadas] = await Promise.all([
    supabase
      .from("configuracion")
      .select("impresion_directa")
      .eq("org_id", perfil.org_id)
      .maybeSingle(),
    // Link al comprobante de cada transferencia (1 hora), solo en pantalla y solo para el staff.
    ...conComprobante.map((l) =>
      supabase.storage.from("documentos").createSignedUrl(l.comprobante_path as string, 3600)
    ),
  ]);
  const urlComprobante = new Map<string, string>();
  conComprobante.forEach((l, i) => {
    const url = firmadas[i]?.data?.signedUrl;
    if (url) urlComprobante.set(l.pago_id, url);
  });

  const vigentes = recibo.lineas.filter((l) => !l.anulado);
  const anuladas = recibo.lineas.filter((l) => l.anulado);
  const parcialmenteAnulado = !recibo.anulado && anuladas.length > 0;
  const beneficio = recibo.imputaciones.reduce((acc, i) => acc + Number(i.beneficio ?? 0), 0);
  const autoImprimir = !esSocio && Boolean(configRes.data?.impresion_directa) && !recibo.anulado;

  return (
    <>
      {esSocio ? (
        <>
          <BotonImprimir volverA="/mi-cuenta" etiquetaImprimir="Descargar recibo (PDF)" />
          <p className="no-print -mt-4 mb-6 text-right text-sm text-muted-foreground">
            Elegí &quot;Guardar como PDF&quot;. En el celular: Compartir → Imprimir → Guardar como PDF.
          </p>
        </>
      ) : (
        <BotonImprimir autoImprimir={autoImprimir} />
      )}

      {urlComprobante.size > 0 ? (
        <div className="no-print mb-4 flex flex-wrap gap-x-5 gap-y-1">
          {[...urlComprobante.entries()].map(([id, url], i) => (
            <a
              key={id}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              <Paperclip className="size-4" strokeWidth={2} />
              Ver comprobante de la transferencia{urlComprobante.size > 1 ? ` ${i + 1}` : ""}
            </a>
          ))}
        </div>
      ) : null}

      <div className="etiqueta">
        <div className="etiqueta-interior space-y-6">
          {/* Cabecera */}
          <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
            <div>
              <p className="font-display text-xl font-semibold uppercase tracking-wide">
                Cooperativa Mercado San Miguel
              </p>
              <p className="text-sm text-muted-foreground">Malagueño, Córdoba</p>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl font-semibold uppercase tracking-wide">
                Recibo N° {recibo.numero}
              </p>
              <p className="text-sm text-muted-foreground">{formatFechaHora(recibo.fecha)}</p>
            </div>
          </header>

          <p>
            <span className="text-muted-foreground">Recibimos de:</span>{" "}
            <strong>{recibo.cliente.nombre}</strong> (Carpeta N° {recibo.cliente.codigo})
          </p>

          {/* Cómo pagó: una fila por medio */}
          <section className="space-y-2">
            <h2 className="font-display text-base font-semibold">Cómo pagó</h2>
            <div className="divide-y rounded-md border">
              {recibo.lineas.map((l) => {
                const Icono = ICONO[l.medio] ?? Banknote;
                const { titulo, detalle } = textoLinea(l, esSocio);
                return (
                  <div key={l.pago_id} className="flex items-start gap-3 px-4 py-3">
                    <Icono className="mt-0.5 size-5 shrink-0 text-muted-foreground" strokeWidth={2} />
                    <div className={`min-w-0 flex-1 ${l.anulado ? "text-muted-foreground" : ""}`}>
                      <p className={`font-medium ${l.anulado ? "line-through" : ""}`}>{titulo}</p>
                      {detalle ? (
                        <p className={`text-sm text-muted-foreground ${l.anulado ? "line-through" : ""}`}>
                          {detalle}
                        </p>
                      ) : null}
                      {l.anulado ? (
                        <p className="text-sm">
                          Anulada{l.motivo_anulacion ? `: ${l.motivo_anulacion}` : ""}
                        </p>
                      ) : null}
                    </div>
                    <Money
                      monto={l.monto}
                      className={`shrink-0 font-semibold ${l.anulado ? "text-muted-foreground line-through" : ""}`}
                    />
                  </div>
                );
              })}
            </div>
          </section>

          {!esSocio && recibo.notas ? (
            <p className="text-sm text-muted-foreground">Nota: {recibo.notas}</p>
          ) : null}

          {/* Detalle: a qué se aplicó, agrupado por cargo */}
          {recibo.imputaciones.length > 0 || recibo.saldo_favor > 0.009 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-medium">Detalle</th>
                  <th className="py-2 font-medium">Período</th>
                  <th className="py-2 text-right font-medium">Monto</th>
                </tr>
              </thead>
              <tbody>
                {recibo.imputaciones.map((imp) => (
                  <tr key={imp.cargo_id} className="border-b border-dashed">
                    <td className="py-2">
                      {imp.descripcion}
                      {Number(imp.beneficio) > 0.009 ? (
                        <span className="block text-xs text-muted-foreground">
                          Con beneficio por pago en término de <Money monto={imp.beneficio} />
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2">{labelPeriodo(imp.periodo)}</td>
                    <td className="py-2 text-right tabular">
                      <Money monto={imp.monto} />
                    </td>
                  </tr>
                ))}
                {recibo.saldo_favor > 0.009 ? (
                  <tr className="border-b border-dashed">
                    <td className="py-2" colSpan={2}>
                      Saldo a favor{" "}
                      <span className="text-muted-foreground">(se aplica a lo próximo que deba)</span>
                    </td>
                    <td className="py-2 text-right tabular">
                      <Money monto={recibo.saldo_favor} />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          ) : null}

          {/* Total (líneas vigentes) */}
          <div className="space-y-1">
            <div className="flex items-baseline justify-between border-t-2 border-foreground pt-3">
              <p className="font-display font-semibold uppercase tracking-wide">Total</p>
              <Money monto={recibo.total} className="text-3xl font-bold" />
            </div>
            {beneficio > 0.009 ? (
              <p className="text-right text-sm text-muted-foreground">
                Incluye beneficio por pago en término de{" "}
                <Money monto={beneficio} className="font-medium text-foreground" /> (ya aplicado en
                el importe).
              </p>
            ) : null}
            {vigentes.length > 1 ? (
              <p className="text-right text-sm text-muted-foreground">
                Pagado con {vigentes.length} medios en un mismo recibo.
              </p>
            ) : null}
          </div>

          {/* Sello y firma */}
          <div className="flex flex-wrap items-end justify-between gap-6 pt-2">
            <div className="space-y-2">
              {recibo.anulado ? (
                <>
                  <Sello grande estado="pendiente" texto="ANULADO" />
                  <p className="text-sm text-muted-foreground">
                    Motivo: {recibo.lineas[0]?.motivo_anulacion ?? "—"}
                  </p>
                </>
              ) : (
                <>
                  <Sello grande estado="pagado" texto="Pago recibido" />
                  {parcialmenteAnulado ? (
                    <p className="text-sm text-muted-foreground">
                      Una parte de este recibo se anuló (ver arriba).
                    </p>
                  ) : null}
                </>
              )}
              <p className="text-sm">
                Recibió: {recibo.recibio ?? "—"} · {recibo.caja.label}
              </p>
            </div>
            <div className="w-56 text-center">
              <div className="border-t border-foreground pt-1.5 text-sm text-muted-foreground">
                Firma
              </div>
            </div>
          </div>

          <p className="border-t pt-3 text-center text-xs text-muted-foreground">
            Comprobante interno — sin validez fiscal
          </p>
        </div>
      </div>
    </>
  );
}
