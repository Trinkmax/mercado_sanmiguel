import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Banknote, FileText, Landmark, Paperclip } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  formatARS,
  formatCuit,
  formatFecha,
  formatFechaTS,
  formatSoloHora,
  labelPeriodo,
} from "@/lib/format";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { BotonImprimir } from "@/components/shared/boton-imprimir";
import { DescripcionCargo, textoCargo } from "@/components/cobranza/descripcion-cargo";
import { resumirLugares } from "@/components/cobranza/tipos";

type Medio = "efectivo" | "transferencia" | "cheque";

type LineaRecibo = {
  pago_id: string;
  linea: number;
  medio: Medio;
  monto: number;
  anulado: boolean;
  /** 0023 (puede faltar con la base vieja). */
  anulado_en?: string | null;
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
  /** 0023: lo que decía el recibo antes de anularse (con la base vieja, se suma de las líneas). */
  total_original?: number;
  /** 0023: a qué fue DESPUÉS el saldo a favor de este recibo (el detalle de arriba no cambia). */
  aplicado_despues?: {
    cargo_id: string;
    codigo: string;
    descripcion: string;
    periodo: string;
    monto: number;
    fecha: string | null;
  }[];
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

/** "29/09/2026, 03:49": el recibo es un papel que se guarda, la fecha va con año. */
function fechaHora(iso: string): string {
  return `${formatFechaTS(iso)}, ${formatSoloHora(iso)}`;
}

/**
 * Título y detalle de un medio. El detalle son pedazos que no se parten por dentro ("CUIT
 * 20-17894561-2", "se cobra desde 14/10/2026"); entre pedazo y pedazo sí baja de renglón.
 */
function textoLinea(l: LineaRecibo, esSocio: boolean): { titulo: string; detalle: string[] } {
  if (l.medio === "efectivo") return { titulo: "Efectivo", detalle: [] };
  if (l.medio === "transferencia") {
    const partes = [
      l.titular_transferencia ? `de ${l.titular_transferencia}` : null,
      l.tiene_comprobante ? "comprobante adjunto" : null,
    ].filter((p): p is string => Boolean(p));
    return { titulo: "Transferencia", detalle: partes };
  }
  const c = l.cheque;
  if (!c) return { titulo: "Cheque", detalle: [] };
  const partes = [
    c.cuit ? `CUIT ${formatCuit(c.cuit)}` : null,
    c.recibido_de ? `entregó ${c.recibido_de}` : null,
    c.fecha_cobro ? `se cobra desde ${formatFecha(c.fecha_cobro)}` : null,
    // "Puesto 22 · Puesto 24 · Puesto 26" (así lo guarda la base) → "Puestos 22 · 24 · 26".
    c.puesto ? resumirLugares(c.puesto.split(" · ")) : null,
    !esSocio && c.estado === "entregado" && c.proveedor ? `entregado a ${c.proveedor}` : null,
  ].filter((p): p is string => Boolean(p));
  return { titulo: `Cheque N° ${c.numero}`, detalle: partes };
}

/** Pedazos cortos (CUIT, fechas, puestos) enteros; los largos (nombres) bajan como texto. */
function Detalle({ partes }: { partes: string[] }) {
  return (
    <>
      {partes.map((p, i) => (
        <span key={i}>
          {i > 0 ? " · " : null}
          <span className={p.length <= 32 ? "whitespace-nowrap" : undefined}>{p}</span>
        </span>
      ))}
    </>
  );
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
  // Un recibo anulado entero no dice "Total $ 0": muestra lo que decía, tachado.
  const totalOriginal = Number(
    recibo.total_original ?? recibo.lineas.reduce((acc, l) => acc + Number(l.monto), 0)
  );
  const anuladoEn = recibo.lineas.find((l) => l.anulado && l.anulado_en)?.anulado_en ?? null;
  const aplicadoDespues = recibo.aplicado_despues ?? [];
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
          {/* El N° y la fecha van juntos y del mismo lado: en celular abajo a la izquierda; desde
              tablet (y en el papel) contra el borde derecho, aunque bajen de renglón. */}
          <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b pb-4">
            <div className="min-w-0">
              <p className="font-display text-xl font-semibold uppercase tracking-wide">
                Cooperativa Mercado San Miguel
              </p>
              <p className="text-sm text-muted-foreground">Malagueño, Córdoba</p>
            </div>
            <div className="sm:ml-auto sm:text-right print:ml-auto print:text-right">
              <h1 className="font-display text-2xl font-semibold uppercase tracking-wide">
                Recibo N° {recibo.numero}
              </h1>
              <p className="text-sm text-muted-foreground tabular">{fechaHora(recibo.fecha)}</p>
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
                  // El monto va en el renglón del título; el detalle (del cheque, largo) usa todo el
                  // ancho debajo, no una columna angosta al lado del monto.
                  <div key={l.pago_id} className="flex items-start gap-3 px-4 py-3">
                    <Icono className="mt-0.5 size-5 shrink-0 text-muted-foreground" strokeWidth={2} />
                    <div className={`min-w-0 flex-1 space-y-0.5 ${l.anulado ? "text-muted-foreground" : ""}`}>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <p className={`font-medium ${l.anulado ? "line-through" : ""}`}>{titulo}</p>
                        <Money
                          monto={l.monto}
                          className={`ml-auto font-semibold ${l.anulado ? "text-muted-foreground line-through" : ""}`}
                        />
                      </div>
                      {detalle.length > 0 ? (
                        <p className={`text-sm break-words text-muted-foreground ${l.anulado ? "line-through" : ""}`}>
                          <Detalle partes={detalle} />
                        </p>
                      ) : null}
                      {l.anulado ? (
                        <p className="text-sm break-words">
                          Anulada{l.motivo_anulacion ? `: ${l.motivo_anulacion}` : ""}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {!esSocio && recibo.notas ? (
            <p className="text-sm text-muted-foreground">Nota: {recibo.notas}</p>
          ) : null}

          {/* Detalle: a qué se aplicó, agrupado por cargo. En un celular la columna Período se
              esconde y el mes baja bajo la descripción: con las tres columnas, al detalle le
              quedaban ~50 px (una palabra por renglón). En tablet y en el papel, las tres. */}
          {recibo.imputaciones.length > 0 || recibo.saldo_favor > 0.009 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Detalle</th>
                  <th className="hidden py-2 pr-3 font-medium sm:table-cell print:table-cell">Período</th>
                  <th className="py-2 text-right font-medium">Monto</th>
                </tr>
              </thead>
              <tbody>
                {recibo.imputaciones.map((imp) => (
                  <tr key={imp.cargo_id} className="border-b border-dashed">
                    <td className="py-2 pr-3 align-top break-words">
                      <DescripcionCargo texto={imp.descripcion} />
                      <span className="block text-muted-foreground sm:hidden print:hidden">
                        {labelPeriodo(imp.periodo)}
                      </span>
                      {Number(imp.beneficio) > 0.009 ? (
                        <span className="block text-xs text-muted-foreground">
                          Con beneficio por pago en término de <Money monto={imp.beneficio} />
                        </span>
                      ) : null}
                    </td>
                    <td className="hidden py-2 pr-3 align-top whitespace-nowrap sm:table-cell print:table-cell">
                      {labelPeriodo(imp.periodo)}
                    </td>
                    <td className="py-2 text-right align-top whitespace-nowrap tabular">
                      <Money monto={imp.monto} />
                    </td>
                  </tr>
                ))}
                {recibo.saldo_favor > 0.009 ? (
                  <tr className="border-b border-dashed">
                    {/* Sin colSpan: en celular la columna Período no está, y una celda que la
                        abarcara correría el monto fuera de su columna. */}
                    <td className="py-2 pr-3 align-top break-words">
                      Saldo a favor{" "}
                      <span className="text-muted-foreground">(se aplica a lo próximo que deba)</span>
                      {aplicadoDespues.length > 0 ? (
                        <span className="block text-xs text-muted-foreground">
                          Luego aplicado a:{" "}
                          {aplicadoDespues
                            .map(
                              (a) =>
                                `${textoCargo(a.descripcion)} · ${labelPeriodo(a.periodo)} ${formatARS(Number(a.monto))}${a.fecha ? ` (el ${formatFechaTS(a.fecha)})` : ""}`
                            )
                            .join(" — ")}
                        </span>
                      ) : null}
                    </td>
                    <td className="hidden sm:table-cell print:table-cell" />
                    <td className="py-2 text-right align-top whitespace-nowrap tabular">
                      <Money monto={recibo.saldo_favor} />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          ) : null}

          {/* Total (líneas vigentes) */}
          <div className="space-y-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-t-2 border-foreground pt-3">
              <p className="font-display font-semibold uppercase tracking-wide">
                {recibo.anulado ? "Total (anulado)" : "Total"}
              </p>
              {recibo.anulado ? (
                <Money monto={totalOriginal} className="text-3xl font-bold text-muted-foreground line-through" />
              ) : (
                <Money monto={recibo.total} className="text-3xl font-bold" />
              )}
            </div>
            {recibo.anulado ? (
              <p className="text-right text-sm font-medium">
                Anulado{anuladoEn ? ` el ${fechaHora(anuladoEn)}` : ""}: no vale como pago.
              </p>
            ) : null}
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
