import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, MessageSquareOff } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatFecha, formatFechaHora } from "@/lib/format";
import { textoPublico } from "@/lib/segmentos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Sello } from "@/components/shared/sello";
import { BarraRecepcion } from "@/components/comunicaciones/barra-recepcion";
import { DesactivarCircular } from "@/components/comunicaciones/desactivar-circular";
import { ListaLectores } from "@/components/comunicaciones/lista-lectores";
import { cargarClientesPublico } from "@/components/comunicaciones/datos";
import { resumenLectura } from "@/components/comunicaciones/publico";

export const metadata = { title: "Circular" };

export default async function CircularPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRol("admin", "lider");
  const { id } = await params;
  const supabase = await createClient();

  const { data: c } = await supabase
    .from("circulares")
    .select("id, numero, titulo, detalle, fecha, obligatoria, activa, storage_path, creada_en, creada_por, publico")
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();

  const [clientes, recepcionesRes, autorRes] = await Promise.all([
    cargarClientesPublico(supabase),
    supabase.from("circular_recepciones").select("cliente_id, recibida_en").eq("circular_id", c.id),
    c.creada_por
      ? supabase.from("perfiles").select("nombre").eq("user_id", c.creada_por).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const recepciones = new Map<string, string>();
  for (const r of recepcionesRes.data ?? []) recepciones.set(r.cliente_id, r.recibida_en);
  const res = resumenLectura(c.publico, clientes, recepciones);
  const faltan = res.total - res.vieron;

  const pdfUrl = c.storage_path
    ? (await supabase.storage.from("documentos").createSignedUrl(c.storage_path, 3600)).data?.signedUrl
    : undefined;

  return (
    <div className="space-y-8">
      <PageHeader titulo={`Circular N° ${c.numero}`} descripcion={c.titulo}>
        {!c.activa ? <Sello estado="inactivo" texto="Desactivada" /> : null}
        {pdfUrl ? (
          <Button asChild variant="outline" className="min-h-11">
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
              <FileText className="size-4" strokeWidth={2} />
              Ver PDF
            </a>
          </Button>
        ) : null}
        {c.activa ? <DesactivarCircular id={c.id} numero={c.numero} titulo={c.titulo} /> : null}
        <Button asChild variant="ghost" className="min-h-11">
          <Link href="/comunicaciones">
            <ArrowLeft className="size-4" />
            Volver
          </Link>
        </Button>
      </PageHeader>

      {/* El número que importa, grande */}
      <section
        aria-label="Quién la vio"
        className="space-y-3 rounded-xl border bg-card p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="font-display text-3xl font-bold tracking-tight tabular">
            La vieron{" "}
            <span className={cn(res.total > 0 && res.vieron >= res.total ? "text-pagado" : "text-foreground")}>
              {res.vieron}
            </span>{" "}
            <span className="text-muted-foreground">de {res.total}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border bg-muted/60 px-3 py-1 text-sm font-medium">
              {textoPublico(c.publico)}
            </span>
            <span
              className={cn(
                "rounded-full border px-3 py-1 text-sm font-medium",
                c.obligatoria ? "border-parcial/40 bg-parcial-suave text-parcial" : "bg-muted"
              )}
            >
              {c.obligatoria ? "Obligatoria" : "Informativa"}
            </span>
          </div>
        </div>
        <BarraRecepcion recibidas={res.vieron} total={res.total} sinPortal={res.sinPortal} soloBarra />
        <p className="text-sm text-muted-foreground">
          {res.total === 0
            ? "Nadie entra en este público por ahora."
            : faltan === 0
              ? "Todos la vieron."
              : `Faltan ${faltan}${
                  res.sinPortal > 0 ? `: ${res.sinPortal} no tienen usuario del portal (avisales en persona)` : ""
                }.${c.obligatoria ? " Al entrar al portal no ven su cuenta hasta confirmarla." : ""}`}
        </p>
      </section>

      <ListaLectores lectores={res.lectores} obligatoria={c.obligatoria} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lo que dice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Fecha</dt>
              <dd className="font-medium tabular">{formatFecha(c.fecha)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">La publicó</dt>
              <dd className="font-medium">
                {autorRes.data?.nombre ?? "—"}
                <span className="tabular text-muted-foreground"> · {formatFechaHora(c.creada_en)}</span>
              </dd>
            </div>
          </dl>
          <div className="border-t pt-4">
            {c.detalle ? (
              <p className="whitespace-pre-line text-[15px] leading-relaxed">{c.detalle}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Sin texto: el contenido está en el PDF adjunto.</p>
            )}
          </div>
          <p className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
            <MessageSquareOff className="size-4 shrink-0" strokeWidth={1.8} />
            Las circulares no se responden. Si un socio tiene una duda, la manda como solicitud.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
