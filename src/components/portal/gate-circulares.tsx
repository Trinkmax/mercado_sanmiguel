import { FileText, Megaphone } from "lucide-react";
import type { Perfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatFecha } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sello } from "@/components/shared/sello";
import { ConfirmarCircular } from "@/components/portal/confirmar-circular";
import { getResumenComunicaciones } from "@/components/portal/datos-portal";

/**
 * Bloqueo por circulares obligatorias (va después de GateTerminos, en el layout): mientras
 * haya alguna de SU público sin confirmar, el portal entero muestra solo esas circulares.
 */
export async function GateCirculares({
  perfil,
  children,
}: {
  perfil: Perfil;
  children: React.ReactNode;
}) {
  const { obligatoriasPendientes: pendientes } = await getResumenComunicaciones(perfil.user_id);
  if (pendientes.length === 0) return <>{children}</>;

  const paths = pendientes.map((c) => c.storage_path).filter((p): p is string => Boolean(p));
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const supabase = await createClient();
    const { data } = await supabase.storage.from("documentos").createSignedUrls(paths, 3600);
    for (const f of data ?? []) if (f.path && f.signedUrl) urls.set(f.path, f.signedUrl);
  }

  return (
    <section className="space-y-6" aria-label="Circulares para confirmar">
      <div className="flex items-start gap-3" data-tour="encabezado socio-comunicaciones-bloqueo">
        <Megaphone className="mt-1 size-7 shrink-0 text-parcial" strokeWidth={2} />
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {pendientes.length === 1
              ? "Tenés una circular para leer"
              : `Tenés ${pendientes.length} circulares para leer`}
          </h1>
          <p className="text-[15px] text-muted-foreground">
            Leela y tocá <span className="font-semibold text-foreground">Confirmo que la recibí</span>.
            Después vas a ver tu cuenta como siempre.
          </p>
        </div>
      </div>

      {pendientes.map((c) => {
        const url = c.storage_path ? urls.get(c.storage_path) : undefined;
        return (
          <Card key={c.id} className="border-2 border-parcial bg-parcial-suave/40 ring-0">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-lg leading-snug">
                  Circular N° {c.numero} · {c.titulo}
                </CardTitle>
                <Sello estado="sin_recibir" />
              </div>
              <p className="text-sm tabular text-muted-foreground">{formatFecha(c.fecha)}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {c.detalle ? (
                <p className="whitespace-pre-line text-base leading-relaxed">{c.detalle}</p>
              ) : null}
              {url ? (
                <Button asChild variant="outline" className="min-h-12 w-full bg-card text-base">
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <FileText className="size-5" strokeWidth={2} />
                    Abrir el PDF de la circular
                  </a>
                </Button>
              ) : null}
              <ConfirmarCircular circularId={c.id} numero={c.numero} />
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
