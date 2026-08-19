import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatFechaHora } from "@/lib/format";
import { LABEL_ROL } from "@/lib/roles";
import { Marca } from "@/components/shared/marca";
import { Sello } from "@/components/shared/sello";
import { BotonImprimir } from "@/components/shared/boton-imprimir";
import {
  LABEL_ORIGEN,
  LABEL_TIPO,
  selloEstado,
} from "@/components/solicitudes/constantes";

export const metadata = { title: "Solicitud — formulario" };

/**
 * Formulario imprimible de una solicitud: lo que portería genera en papel
 * para derivar a Administración (con lugar para el "recibido" y la resolución).
 */
export default async function ImprimirSolicitudPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const perfil = await requireStaff();
  const supabase = await createClient();

  const { data: s } = await supabase
    .from("solicitudes")
    .select(
      "id, numero, tipo, asunto, detalle, origen, estado, referencia, resolucion, creada_por, creada_en, resuelta_en, cliente:clientes(nombre, codigo, apodo)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!s) notFound();

  const [orgRes, autorRes, configRes] = await Promise.all([
    supabase
      .from("organizaciones")
      .select("nombre")
      .eq("id", perfil.org_id)
      .maybeSingle(),
    s.creada_por
      ? supabase
          .from("perfiles")
          .select("nombre, rol")
          .eq("user_id", s.creada_por)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("configuracion")
      .select("impresion_directa")
      .eq("org_id", perfil.org_id)
      .maybeSingle(),
  ]);

  const autor = autorRes.data;

  return (
    <>
      <BotonImprimir
        volverA={`/solicitudes/${s.id}`}
        autoImprimir={Boolean(configRes.data?.impresion_directa)}
        etiquetaImprimir="Imprimir formulario"
      />

      <div className="etiqueta">
        <div className="etiqueta-interior space-y-6">
          {/* Cabecera */}
          <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-foreground pb-4">
            <div className="space-y-1">
              <Marca />
              <p className="text-sm text-muted-foreground">
                {orgRes.data?.nombre ?? "Cooperativa Mercado San Miguel"}
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl font-semibold uppercase tracking-wide">
                Solicitud N° {s.numero}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatFechaHora(s.creada_en)}
              </p>
              <div className="mt-2">
                <Sello estado={selloEstado(s.estado)} />
              </div>
            </div>
          </header>

          {/* Datos */}
          <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <Dato label="Tipo" valor={LABEL_TIPO[s.tipo]} />
            <Dato label="Origen" valor={LABEL_ORIGEN[s.origen]} />
            <Dato
              label="La generó"
              valor={
                autor
                  ? `${autor.nombre} (${LABEL_ROL[autor.rol]})`
                  : "—"
              }
            />
            <Dato
              label="Cliente / referencia"
              valor={
                s.cliente
                  ? `Carpeta N° ${s.cliente.codigo} — ${s.cliente.nombre}${s.cliente.apodo ? ` (${s.cliente.apodo})` : ""}`
                  : (s.referencia ?? "Sin puesto asociado")
              }
            />
          </dl>

          {/* Asunto y detalle */}
          <section className="space-y-2">
            <h2 className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Asunto
            </h2>
            <p className="text-lg font-semibold">{s.asunto}</p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Detalle
            </h2>
            {s.detalle ? (
              <p className="whitespace-pre-line text-[15px] leading-relaxed">
                {s.detalle}
              </p>
            ) : (
              <div className="space-y-5 pt-1" aria-hidden>
                <div className="border-b border-foreground/40" />
                <div className="border-b border-foreground/40" />
                <div className="border-b border-foreground/40" />
              </div>
            )}
          </section>

          {/* Recibido por administración */}
          <section className="rounded-md border border-foreground/60 p-4">
            <h2 className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Recibido por Administración
            </h2>
            <div className="mt-8 grid grid-cols-2 gap-8">
              <div className="border-t border-foreground pt-1.5 text-center text-sm text-muted-foreground">
                Firma y aclaración
              </div>
              <div className="border-t border-foreground pt-1.5 text-center text-sm text-muted-foreground">
                Fecha
              </div>
            </div>
          </section>

          {/* Resolución */}
          <section className="rounded-md border border-foreground/60 p-4">
            <h2 className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Resolución
            </h2>
            {s.resolucion ? (
              <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed">
                {s.resolucion}
              </p>
            ) : (
              <div className="mt-3 space-y-5">
                <div className="border-b border-foreground/40" />
                <div className="border-b border-foreground/40" />
                <div className="border-b border-foreground/40" />
                <div className="border-b border-foreground/40" />
              </div>
            )}
            <div className="mt-8 grid grid-cols-2 gap-8">
              <div className="border-t border-foreground pt-1.5 text-center text-sm text-muted-foreground">
                Firma
              </div>
              <div className="border-t border-foreground pt-1.5 text-center text-sm text-muted-foreground">
                Fecha
              </div>
            </div>
          </section>

          <p className="border-t pt-3 text-center text-xs text-muted-foreground">
            Formulario interno de solicitud — sin validez fiscal · Impreso el{" "}
            {formatFechaHora(new Date().toISOString())} por {perfil.nombre}
          </p>
        </div>
      </div>
    </>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-muted-foreground">{label}:</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  );
}
