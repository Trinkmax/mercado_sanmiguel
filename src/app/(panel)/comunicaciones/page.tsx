import Link from "next/link";
import { ChevronRight, FileSignature, Megaphone, Plus } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatFecha, formatFechaTS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Sello } from "@/components/shared/sello";
import { BotonExportar } from "@/components/shared/boton-exportar";
import {
  PestanasComunicaciones,
  type PestanaComunicaciones,
} from "@/components/comunicaciones/pestanas";
import { BarraRecepcion } from "@/components/comunicaciones/barra-recepcion";
import { PublicarTerminos } from "@/components/comunicaciones/publicar-terminos";

export const metadata = { title: "Comunicaciones" };

export default async function ComunicacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const perfil = await requireRol("admin", "consejo", "lider");
  const { tab } = await searchParams;
  const pestana: PestanaComunicaciones = tab === "terminos" ? "terminos" : "circulares";
  const supabase = await createClient();

  const [circularesRes, recepcionesRes, conPortalRes, terminosRes] =
    await Promise.all([
      supabase
        .from("circulares")
        .select("id, numero, titulo, fecha, obligatoria, activa, storage_path")
        .order("numero", { ascending: false }),
      supabase.from("circular_recepciones").select("circular_id, cliente_id"),
      supabase
        .from("clientes")
        .select("id", { count: "exact", head: true })
        .eq("activo", true)
        .not("auth_user_id", "is", null),
      supabase
        .from("terminos")
        .select("id, version, titulo, contenido, creado_en, vigente")
        .eq("vigente", true)
        .maybeSingle(),
    ]);

  const circulares = circularesRes.data ?? [];
  const totalPortal = conPortalRes.count ?? 0;
  const recibidasPor = new Map<string, number>();
  for (const r of recepcionesRes.data ?? []) {
    recibidasPor.set(r.circular_id, (recibidasPor.get(r.circular_id) ?? 0) + 1);
  }

  const terminos = terminosRes.data;
  const { count: aceptaron } = terminos
    ? await supabase
        .from("aceptaciones_terminos")
        .select("id", { count: "exact", head: true })
        .eq("terminos_id", terminos.id)
    : { count: 0 };

  const puedeCrear = perfil.rol === "admin" || perfil.rol === "lider";

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Comunicaciones"
        descripcion="Circulares para los socios (con recepción obligatoria o informativa) y los términos y condiciones del portal."
      >
        {pestana === "circulares" ? (
          <>
            <BotonExportar dataset="circulares" />
            {puedeCrear ? (
              <Button asChild size="lg" className="h-12 px-5 text-base font-semibold">
                <Link href="/comunicaciones/nueva">
                  <Plus className="size-5" strokeWidth={2.2} />
                  Nueva circular
                </Link>
              </Button>
            ) : null}
          </>
        ) : null}
      </PageHeader>

      <PestanasComunicaciones activa={pestana} />

      {pestana === "circulares" ? (
        circulares.length === 0 ? (
          <EmptyState
            icono={Megaphone}
            titulo="Todavía no hay circulares"
            descripcion="Publicá la primera: los socios la ven al entrar al portal y, si es obligatoria, tienen que confirmar que la recibieron."
          >
            {puedeCrear ? (
              <Button asChild size="lg" className="mt-2 h-12 px-5 font-semibold">
                <Link href="/comunicaciones/nueva">
                  <Plus className="size-5" strokeWidth={2.2} />
                  Nueva circular
                </Link>
              </Button>
            ) : null}
          </EmptyState>
        ) : (
          /* Filas-enlace: título, recepción y estado siempre a la vista. */
          <Card className="gap-0 divide-y overflow-hidden py-0">
            {circulares.map((c) => {
              const recibidas = recibidasPor.get(c.id) ?? 0;
              return (
                <Link
                  key={c.id}
                  href={`/comunicaciones/${c.id}`}
                  className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                >
                  <span
                    className="w-9 shrink-0 text-right font-display text-lg font-bold tabular"
                    aria-label={`Circular N° ${c.numero}`}
                  >
                    {c.numero}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <p
                        className={cn(
                          "line-clamp-2 text-sm font-medium leading-snug",
                          !c.activa && "text-muted-foreground"
                        )}
                      >
                        {c.titulo}
                      </p>
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-2 py-px text-xs font-medium",
                          c.obligatoria
                            ? "border-parcial/40 bg-parcial-suave text-parcial"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {c.obligatoria ? "Obligatoria" : "Informativa"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <span className="tabular">{formatFecha(c.fecha)}</span>
                      {c.obligatoria ? " · Recibida por " : " · Leída por "}
                      <span
                        className={cn(
                          "font-semibold tabular",
                          totalPortal > 0 && recibidas >= totalPortal
                            ? "text-pagado"
                            : recibidas === 0 && c.obligatoria
                              ? "text-pendiente"
                              : "text-foreground"
                        )}
                      >
                        {recibidas}
                      </span>
                      {` de ${totalPortal} socios`}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <BarraRecepcion
                      recibidas={recibidas}
                      total={totalPortal}
                      compacta
                      soloBarra
                      className="w-24 max-md:hidden"
                    />
                    <Sello
                      estado={c.activa ? "activo" : "inactivo"}
                      texto={c.activa ? "Activa" : "Inactiva"}
                    />
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground max-sm:hidden"
                      strokeWidth={2}
                    />
                  </div>
                </Link>
              );
            })}
          </Card>
        )
      ) : (
        <div className="space-y-6">
          {terminos ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg leading-snug">{terminos.titulo}</CardTitle>
                <CardDescription className="text-sm">
                  Versión {terminos.version} · vigente desde{" "}
                  <span className="tabular">{formatFechaTS(terminos.creado_en)}</span>
                </CardDescription>
                <CardAction>
                  <Sello estado="activo" texto="Vigente" />
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground">Aceptada por</p>
                  <p className="mt-0.5 text-2xl font-bold tabular">
                    {aceptaron ?? 0}
                    <span className="text-base font-normal text-muted-foreground">
                      {" "}de {totalPortal} socios con acceso al portal
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Los que faltan la van a aceptar la próxima vez que entren: sin
                    aceptar no ven su cuenta.
                  </p>
                </div>
                <div className="max-h-[28rem] overflow-y-auto rounded-lg border bg-card p-5">
                  <p className="whitespace-pre-line text-[15px] leading-relaxed">
                    {terminos.contenido}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <EmptyState
              icono={FileSignature}
              titulo="Todavía no hay términos y condiciones publicados"
              descripcion="Mientras no haya una versión vigente, el portal no pide aceptación."
            />
          )}

          {perfil.rol === "lider" ? (
            <PublicarTerminos
              tituloActual={terminos?.titulo ?? "Términos y condiciones del portal de socios"}
              contenidoActual={terminos?.contenido ?? ""}
              versionActual={terminos?.version ?? 0}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Solo el Líder de Procesos publica versiones nuevas.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
