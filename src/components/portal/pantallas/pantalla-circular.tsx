import Link from "next/link";
import { formatFecha, formatFechaHora } from "@/lib/format";
import { Sello } from "@/components/shared/sello";
import { ConfirmarCircular } from "@/components/portal/confirmar-circular";
import type { CircularPortal } from "@/components/portal/datos-portal";
import { EncabezadoDetalle } from "@/components/portal/encabezado-detalle";
import { BotonDocumento } from "@/components/portal/hilo-portal";

/** Una circular: se lee entera; la obligatoria se confirma con el botón. */
export function PantallaCircular({ c, pdfUrl }: { c: CircularPortal; pdfUrl?: string }) {
  return (
    <>
      <EncabezadoDetalle
        volverA="/mi-cuenta/mensajes"
        volverTexto="Mensajes"
        titulo={c.titulo}
        bajada={`Circular N° ${c.numero}`}
      />

      <div className="chat-fondo">
        <div className="flex flex-col gap-3 p-3 pb-6">
          <section className="hoja flex flex-col gap-3 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {c.recibida_en ? (
                <Sello estado="recibida" texto={c.obligatoria ? "Confirmada" : "Leída"} />
              ) : (
                <Sello estado="circular" />
              )}
              <p className="text-[0.98rem] text-tinta-2 tabular">{formatFecha(c.fecha)}</p>
            </div>
            {c.detalle ? (
              <p className="text-[1.1rem] leading-relaxed whitespace-pre-line">{c.detalle}</p>
            ) : pdfUrl ? (
              <p className="text-[1.05rem] text-tinta-2">Lo que dice la circular está en el PDF.</p>
            ) : null}
            {c.storage_path && !pdfUrl ? (
              <p className="rounded-xl bg-parcial-suave px-3 py-2.5 text-[1rem] leading-snug">
                No pudimos abrir el PDF de esta circular. Actualizá la página; si sigue igual, preguntá en Administración.
              </p>
            ) : null}
            {pdfUrl ? <BotonDocumento href={pdfUrl}>Abrir el PDF de la circular</BotonDocumento> : null}
            {c.obligatoria && !c.recibida_en ? <ConfirmarCircular circularId={c.id} numero={c.numero} /> : null}
            {c.recibida_en && c.obligatoria ? (
              <p className="text-[0.98rem] text-tinta-2 tabular">Confirmaste el {formatFechaHora(c.recibida_en)}.</p>
            ) : null}
          </section>
          <p className="px-1.5 text-[1.02rem] leading-snug text-pretty">
            Las circulares no se responden. ¿Tenés una duda?{" "}
            <Link href="/mi-cuenta/solicitudes/nueva" className="font-extrabold text-esmalte underline underline-offset-4">
              Escribile a la cooperativa
            </Link>
            .
          </p>
        </div>
      </div>
    </>
  );
}
