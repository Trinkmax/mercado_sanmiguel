import Link from "next/link";
import { ChevronRight, MapPin, MessageSquare, MessagesSquare, Plus } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatFechaHora, periodoActual } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Sello } from "@/components/shared/sello";
import { BotonExportar } from "@/components/shared/boton-exportar";
import { ChipTipo } from "@/components/solicitudes/chip-tipo";
import {
  FiltrosSolicitudes,
  cumpleFiltro,
  filtrosParaRol,
} from "@/components/solicitudes/filtros-solicitudes";
import { LABEL_ORIGEN, selloSolicitud } from "@/components/solicitudes/constantes";

export const metadata = { title: "Solicitudes" };

export default async function SolicitudesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const perfil = await requireRol("admin", "guardia", "porteria", "tesoreria", "lider");
  const { estado } = await searchParams;
  const filtros = filtrosParaRol(perfil.rol);
  const filtro = filtros.find((f) => f.valor === estado) ?? filtros[0];

  const supabase = await createClient();

  // La RLS recorta: Portería y Tesorería ven las suyas; el Jefe, las de Portería y las suyas.
  // La bandeja se ordena por actualizada_en (cualquier mensaje la mueve: trigger tocar_solicitud).
  const { data: filas } = await supabase
    .from("solicitudes")
    .select(
      "id, numero, tipo, asunto, origen, estado, referencia, resolucion_de, creada_en, actualizada_en, cliente:clientes(nombre, codigo)"
    )
    .order("actualizada_en", { ascending: false });
  const solicitudes = filas ?? [];

  // Cantidad de mensajes por solicitud (una sola consulta).
  const ids = solicitudes.map((s) => s.id);
  const { data: mensajes } = ids.length
    ? await supabase.from("solicitud_mensajes").select("solicitud_id").in("solicitud_id", ids)
    : { data: [] as { solicitud_id: string }[] };
  const conteoMensajes = new Map<string, number>();
  for (const m of mensajes ?? []) conteoMensajes.set(m.solicitud_id, (conteoMensajes.get(m.solicitud_id) ?? 0) + 1);

  const conteos: Record<string, number> = {};
  for (const f of filtros) conteos[f.valor] = solicitudes.filter((s) => cumpleFiltro(f, s)).length;
  const filtradas = solicitudes.filter((s) => cumpleFiltro(filtro, s));

  const exporta = perfil.rol === "admin" || perfil.rol === "lider";
  const descripcion =
    perfil.rol === "porteria"
      ? "Tus solicitudes van primero al Jefe de Portería: él las resuelve o las eleva al Líder de Procesos. Acá ves cómo sigue cada una."
      : perfil.rol === "guardia"
        ? "Las solicitudes de Portería llegan acá: resolvelas o elevalas al Líder de Procesos. También ves tus avisos sobre puestos."
        : perfil.rol === "tesoreria"
          ? "Tus solicitudes al Líder de Procesos. Acá ves las respuestas y cómo sigue cada una."
          : "Solicitudes, informes y reclamos de socios, Portería, Tesorería y Administración.";

  return (
    <div className="space-y-8">
      <PageHeader titulo="Solicitudes" descripcion={descripcion}>
        {exporta ? (
          <BotonExportar dataset="solicitudes" periodo={periodoActual()} label="Solicitudes del mes (.xlsx)" />
        ) : null}
        <Button asChild size="lg" className="h-12 px-5 text-base font-semibold">
          <Link href="/solicitudes/nueva">
            <Plus className="size-5" strokeWidth={2.2} />
            Nueva solicitud
          </Link>
        </Button>
      </PageHeader>

      <div className="space-y-4">
        <FiltrosSolicitudes filtros={filtros} activo={filtro.valor} conteos={conteos} />

        {filtradas.length === 0 ? (
          <EmptyState icono={MessagesSquare} titulo={filtro.vacio.titulo} descripcion={filtro.vacio.descripcion}>
            {solicitudes.length === 0 ? (
              <Button asChild size="lg" className="mt-2 h-12 px-5 font-semibold">
                <Link href="/solicitudes/nueva">
                  <Plus className="size-5" strokeWidth={2.2} />
                  Nueva solicitud
                </Link>
              </Button>
            ) : null}
          </EmptyState>
        ) : (
          /* Filas-enlace (como la lista de clientes): el estado siempre a la vista, aunque la
             tablet esté en vertical. */
          <Card className="gap-0 divide-y overflow-hidden py-0">
            {filtradas.map((s) => {
              const cantidad = conteoMensajes.get(s.id) ?? 0;
              const esperaAlJefe = perfil.rol === "guardia" && s.estado === "con_jefe" && s.origen === "porteria";
              return (
                <Link
                  key={s.id}
                  href={`/solicitudes/${s.id}`}
                  className={cn(
                    "flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
                    esperaAlJefe && "bg-parcial-suave/50"
                  )}
                >
                  <span
                    className="w-9 shrink-0 text-right font-display text-lg font-bold tabular"
                    aria-label={`Solicitud N° ${s.numero}`}
                  >
                    {s.numero}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="line-clamp-2 text-sm font-medium leading-snug">{s.asunto}</p>
                      <ChipTipo tipo={s.tipo} />
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {s.cliente ? (
                        <span className="text-foreground/80">
                          N° {s.cliente.codigo} · {s.cliente.nombre}
                        </span>
                      ) : s.referencia ? (
                        <span className="inline-flex items-center gap-1 text-foreground/80">
                          <MapPin className="size-3" strokeWidth={2} aria-hidden />
                          {s.referencia}
                        </span>
                      ) : (
                        <span>General</span>
                      )}
                      {" · "}
                      {LABEL_ORIGEN[s.origen]}
                      {" · "}
                      <span className="tabular">{formatFechaHora(s.actualizada_en)}</span>
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                    <span
                      className={cn(
                        "inline-flex min-w-8 items-center justify-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular",
                        cantidad > 0 ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                      )}
                      aria-label={`${cantidad} mensajes`}
                      title={`${cantidad} mensajes`}
                    >
                      <MessageSquare className="size-3.5" strokeWidth={2} aria-hidden />
                      {cantidad}
                    </span>
                    <Sello estado={selloSolicitud(s)} />
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground max-sm:hidden" strokeWidth={2} />
                  </div>
                </Link>
              );
            })}
          </Card>
        )}
      </div>
    </div>
  );
}
