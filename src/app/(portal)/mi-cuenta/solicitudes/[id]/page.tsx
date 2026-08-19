import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Paperclip } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatFechaHora } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Sello } from "@/components/shared/sello";
import { contarCircularesPendientes } from "@/components/portal/circulares-pendientes";
import { ChipTipo } from "@/components/solicitudes/chip-tipo";
import { LineaEstado } from "@/components/solicitudes/linea-estado";
import {
  HiloMensajes,
  type MensajeHilo,
} from "@/components/solicitudes/hilo-mensajes";
import { CajaMensaje } from "@/components/solicitudes/caja-mensaje";
import {
  ESTADOS_TERMINADOS,
  LABEL_ESTADO,
  selloEstado,
} from "@/components/solicitudes/constantes";

export const metadata = { title: "Solicitud" };

/** Qué significa el estado actual, en palabras del socio. */
const EXPLICACION: Record<string, string> = {
  nueva: "La recibimos. El Líder de Procesos la va a revisar.",
  en_revision: "La está revisando el Líder de Procesos.",
  en_consejo: "Pasó al Consejo para que decida.",
  resuelta: "Ya hay una resolución: la podés leer acá abajo.",
  asignada: "Administración está trabajando en lo que se resolvió.",
  ejecutada: "Lo resuelto ya se hizo.",
  rechazada: "No se pudo dar curso. El motivo está acá abajo.",
  cerrada: "Terminada.",
};

export default async function SolicitudSocioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const perfil = await requireRol("socio");
  const { id } = await params;
  const supabase = await createClient();

  // La RLS ya limita a las solicitudes del propio cliente.
  const { data: s } = await supabase
    .from("solicitudes")
    .select(
      "id, numero, tipo, asunto, detalle, estado, adjunto_path, resolucion, nota_ejecucion, creada_en, revisada_en, derivada_consejo_en, resuelta_en, asignada_en, ejecutada_en, cerrada_en, actualizada_en, cliente_id"
    )
    .eq("id", id)
    .maybeSingle();
  if (!s) notFound();

  // Con circulares obligatorias sin confirmar, el portal queda bloqueado en
  // /mi-cuenta hasta que el socio las confirme.
  if (
    s.cliente_id &&
    (await contarCircularesPendientes(supabase, s.cliente_id)) > 0
  ) {
    redirect("/mi-cuenta");
  }

  // Los mensajes internos no llegan: la RLS los filtra para el socio.
  const { data: mensajesCrudos } = await supabase
    .from("solicitud_mensajes")
    .select("id, autor_id, autor_nombre, autor_rol, mensaje, interno, creado_en, adjunto_path")
    .eq("solicitud_id", s.id)
    .order("creado_en", { ascending: true });

  const paths = [s.adjunto_path, ...(mensajesCrudos ?? []).map((m) => m.adjunto_path)].filter(
    (p): p is string => Boolean(p)
  );
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: firmadas } = await supabase.storage
      .from("documentos")
      .createSignedUrls(paths, 3600);
    for (const f of firmadas ?? []) {
      if (f.path && f.signedUrl) urls.set(f.path, f.signedUrl);
    }
  }
  const mensajes: MensajeHilo[] = (mensajesCrudos ?? []).map((m) => ({
    ...m,
    adjunto_url: m.adjunto_path ? (urls.get(m.adjunto_path) ?? null) : null,
  }));
  const adjuntoUrl = s.adjunto_path ? urls.get(s.adjunto_path) : undefined;
  const terminada = ESTADOS_TERMINADOS.includes(s.estado);

  return (
    <div className="space-y-8">
      <Button asChild variant="ghost" className="-ml-2 min-h-11">
        <Link href="/mi-cuenta">
          <ArrowLeft className="size-4" />
          Volver a Mi cuenta
        </Link>
      </Button>

      <PageHeader
        titulo={`Solicitud N° ${s.numero}`}
        descripcion={s.asunto}
        className="pb-0"
      >
        <Sello estado={selloEstado(s.estado)} className="text-sm" />
      </PageHeader>

      {/* Estado explicado + recorrido */}
      <Card>
        <CardContent className="space-y-4">
          <p className="text-[15px]">
            <span className="font-semibold">{LABEL_ESTADO[s.estado]}.</span>{" "}
            {EXPLICACION[s.estado]}
          </p>
          <LineaEstado solicitud={s} />
        </CardContent>
      </Card>

      {/* Lo que pediste */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
            <ChipTipo tipo={s.tipo} />
            <span>Lo que enviaste</span>
            <span className="ml-auto text-sm font-normal text-muted-foreground tabular">
              {formatFechaHora(s.creada_en)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {s.detalle ? (
            <p className="whitespace-pre-line text-[15px] leading-relaxed">{s.detalle}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Sin detalle.</p>
          )}
          {adjuntoUrl ? (
            <Button asChild variant="outline" className="min-h-11">
              <a href={adjuntoUrl} target="_blank" rel="noopener noreferrer">
                <Paperclip className="size-4" strokeWidth={2} />
                Ver tu adjunto
              </a>
            </Button>
          ) : null}

          {s.resolucion ? (
            <div
              className={
                s.estado === "rechazada"
                  ? "rounded-lg border border-pendiente/30 bg-pendiente-suave px-4 py-3"
                  : "rounded-lg border border-pagado/30 bg-pagado-suave px-4 py-3"
              }
            >
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {s.estado === "rechazada" ? "Motivo" : "Resolución"}
              </p>
              <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed">
                {s.resolucion}
              </p>
            </div>
          ) : null}
          {s.nota_ejecucion ? (
            <div className="rounded-lg border bg-muted/50 px-4 py-3">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Qué se hizo
              </p>
              <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed">
                {s.nota_ejecucion}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Hilo */}
      <section className="space-y-4" aria-label="Mensajes">
        <h2 className="font-display text-lg font-bold tracking-tight">Mensajes</h2>
        <HiloMensajes mensajes={mensajes} usuarioId={perfil.user_id} />
        <CajaMensaje
          solicitudId={s.id}
          esStaff={false}
          placeholder={
            terminada
              ? "¿Querés agregar algo? Podés seguir escribiendo."
              : "Escribile a la administración…"
          }
        />
      </section>
    </div>
  );
}
