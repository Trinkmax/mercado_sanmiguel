import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, MessagesSquare } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatFecha, formatFechaHora } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Sello } from "@/components/shared/sello";
import { ConfirmarCircular } from "@/components/portal/confirmar-circular";
import { RegistrarVista } from "@/components/portal/registrar-vista";
import { getCircularesSocio } from "@/components/portal/datos-portal";

export const metadata = { title: "Circular" };

export default async function CircularSocioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const perfil = await requireRol("socio");
  const { id } = await params;

  // Solo las circulares activas de SU público (RLS + clienteEnPublico).
  const c = (await getCircularesSocio(perfil.user_id)).find((x) => x.id === id);
  if (!c) notFound();

  let pdfUrl: string | undefined;
  if (c.storage_path) {
    const supabase = await createClient();
    pdfUrl = (await supabase.storage.from("documentos").createSignedUrl(c.storage_path, 3600)).data
      ?.signedUrl;
  }

  return (
    <div className="space-y-6">
      {/* Informativa: abrirla = "la vio". La obligatoria se confirma con el botón. */}
      {!c.obligatoria && !c.recibida_en ? <RegistrarVista tipo="circular" id={c.id} /> : null}

      <Button asChild variant="ghost" className="-ml-2 min-h-11">
        <Link href="/mi-cuenta/comunicaciones?tab=circulares">
          <ArrowLeft className="size-4" />
          Volver a Circulares
        </Link>
      </Button>

      <PageHeader titulo={`Circular N° ${c.numero}`} descripcion={c.titulo} className="pb-0">
        {c.recibida_en ? (
          <Sello estado="recibida" texto={c.obligatoria ? "Confirmada" : "Leída"} />
        ) : (
          <Sello estado="circular" />
        )}
      </PageHeader>

      <Card>
        <CardContent className="space-y-4">
          <p className="text-sm tabular text-muted-foreground">
            {formatFecha(c.fecha)}
            {c.recibida_en && c.obligatoria
              ? ` · confirmaste el ${formatFechaHora(c.recibida_en)}`
              : ""}
          </p>
          {c.detalle ? (
            <p className="whitespace-pre-line text-base leading-relaxed">{c.detalle}</p>
          ) : pdfUrl ? (
            <p className="text-muted-foreground">El contenido está en el PDF.</p>
          ) : null}
          {c.storage_path && !pdfUrl ? (
            <p className="rounded-md bg-parcial-suave px-3 py-2 text-sm">
              No pudimos abrir el PDF de esta circular. Actualizá la página; si sigue igual, consultá en
              administración.
            </p>
          ) : null}
          {pdfUrl ? (
            <Button asChild variant="outline" className="min-h-12 w-full text-base">
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                <FileText className="size-5" strokeWidth={2} />
                Abrir el PDF de la circular
              </a>
            </Button>
          ) : null}
          {c.obligatoria && !c.recibida_en ? (
            <ConfirmarCircular circularId={c.id} numero={c.numero} />
          ) : null}
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 rounded-lg bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
        <MessagesSquare className="mt-0.5 size-5 shrink-0" strokeWidth={1.8} />
        <p>
          Las circulares no se responden. ¿Tenés una duda?{" "}
          <Link
            href="/mi-cuenta/solicitudes/nueva"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Hacé una solicitud
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
