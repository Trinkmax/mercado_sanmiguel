import { notFound } from "next/navigation";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  formatFecha,
  formatFechaHora,
  labelPeriodo,
  MEDIOS_PAGO,
} from "@/lib/format";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { BotonImprimir } from "@/components/shared/boton-imprimir";

export const metadata = { title: "Recibo" };

export default async function ReciboPage({
  params,
}: {
  params: Promise<{ pagoId: string }>;
}) {
  const { pagoId } = await params;
  // Consejo también puede ver comprobantes (es solo lectura).
  await requireRol("admin", "guardia", "tesoreria", "consejo");
  const supabase = await createClient();

  const { data: pago } = await supabase
    .from("pagos")
    .select(
      "id, numero, fecha, monto, medio, notas, anulado, motivo_anulacion, recibido_por, clientes(nombre, codigo), cheques(numero, banco, titular, es_tercero, fecha_cobro)"
    )
    .eq("id", pagoId)
    .maybeSingle();

  if (!pago) notFound();

  const [imputacionesRes, perfilRes] = await Promise.all([
    supabase
      .from("imputaciones")
      .select("id, monto, cargos(descripcion, periodo)")
      .eq("pago_id", pagoId),
    pago.recibido_por
      ? supabase
          .from("perfiles")
          .select("nombre")
          .eq("user_id", pago.recibido_por)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const imputaciones = (imputacionesRes.data ?? []).sort((a, b) =>
    (a.cargos?.periodo ?? "").localeCompare(b.cargos?.periodo ?? "")
  );
  const cliente = pago.clientes;
  const cheque = pago.cheques;
  const medioLabel =
    MEDIOS_PAGO.find((m) => m.valor === pago.medio)?.label ?? pago.medio;
  const nombreRecibio = perfilRes.data?.nombre ?? "—";

  return (
    <>
      <BotonImprimir volverA="/cobranza" />

      <div className="etiqueta">
        <div className="etiqueta-interior space-y-6">
          {/* Cabecera */}
          <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
            <div>
              <p className="font-display text-xl font-semibold uppercase tracking-wide">
                Cooperativa Mercado San Miguel
              </p>
              <p className="text-sm text-muted-foreground">
                Malagueño, Córdoba
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl font-semibold uppercase tracking-wide">
                Recibo N° {pago.numero}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatFechaHora(pago.fecha)}
              </p>
            </div>
          </header>

          {/* De quién y cómo */}
          <div className="space-y-1.5">
            <p>
              <span className="text-muted-foreground">Recibimos de:</span>{" "}
              <strong>{cliente?.nombre ?? "—"}</strong>
              {cliente ? ` (Carpeta N° ${cliente.codigo})` : null}
            </p>
            <p>
              <span className="text-muted-foreground">Medio de pago:</span>{" "}
              <strong>{medioLabel}</strong>
            </p>
            {cheque ? (
              <div className="mt-2 space-y-0.5 rounded-md border px-4 py-3 text-sm">
                <p className="font-medium">
                  Cheque N° {cheque.numero}
                  {cheque.banco ? ` — ${cheque.banco}` : ""}
                </p>
                <p>
                  A nombre de {cheque.titular} ·{" "}
                  {cheque.es_tercero ? "Cheque de tercero" : "Cheque propio"}
                </p>
                <p>Se puede cobrar desde el {formatFecha(cheque.fecha_cobro)}</p>
              </div>
            ) : null}
            {pago.notas ? (
              <p className="text-sm text-muted-foreground">Nota: {pago.notas}</p>
            ) : null}
          </div>

          {/* Detalle de imputaciones */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 font-medium">Detalle</th>
                <th className="py-2 font-medium">Período</th>
                <th className="py-2 text-right font-medium">Monto</th>
              </tr>
            </thead>
            <tbody>
              {imputaciones.map((imp) => (
                <tr key={imp.id} className="border-b border-dashed">
                  <td className="py-2">{imp.cargos?.descripcion ?? "—"}</td>
                  <td className="py-2">
                    {imp.cargos?.periodo ? labelPeriodo(imp.cargos.periodo) : "—"}
                  </td>
                  <td className="py-2 text-right tabular">
                    <Money monto={imp.monto} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Total */}
          <div className="flex items-baseline justify-between border-t-2 border-foreground pt-3">
            <p className="font-display font-semibold uppercase tracking-wide">
              Total
            </p>
            <Money monto={pago.monto} className="text-3xl font-bold" />
          </div>

          {/* Sello y firma */}
          <div className="flex flex-wrap items-end justify-between gap-6 pt-2">
            <div className="space-y-2">
              {pago.anulado ? (
                <>
                  <Sello grande estado="pendiente" texto="ANULADO" />
                  <p className="text-sm text-muted-foreground">
                    Motivo: {pago.motivo_anulacion ?? "—"}
                  </p>
                </>
              ) : (
                <Sello grande estado="pagado" texto="Pago recibido" />
              )}
              <p className="text-sm">Recibió: {nombreRecibio}</p>
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
