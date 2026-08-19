import Link from "next/link";
import { ChevronRight, MessageSquare, MessagesSquare, Plus } from "lucide-react";
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
  filtrosParaRol,
} from "@/components/solicitudes/filtros-solicitudes";
import {
  LABEL_ORIGEN,
  selloEstado,
} from "@/components/solicitudes/constantes";

export const metadata = { title: "Solicitudes" };

export default async function SolicitudesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const perfil = await requireRol(
    "admin",
    "guardia",
    "porteria",
    "tesoreria",
    "consejo",
    "lider"
  );
  const { estado } = await searchParams;
  const filtros = filtrosParaRol(perfil.rol);
  const filtro = filtros.find((f) => f.valor === estado) ?? filtros[0];

  const supabase = await createClient();

  // La RLS ya recorta: portería y el Jefe de Portería ven solo las suyas.
  const { data: filas } = await supabase
    .from("solicitudes")
    .select(
      "id, numero, tipo, asunto, origen, estado, referencia, creada_en, actualizada_en, cliente:clientes(nombre, codigo)"
    )
    .order("actualizada_en", { ascending: false });
  const solicitudes = filas ?? [];

  // Mensajes: cantidad y última actividad por solicitud (una sola consulta).
  const ids = solicitudes.map((s) => s.id);
  const { data: mensajes } = ids.length
    ? await supabase
        .from("solicitud_mensajes")
        .select("solicitud_id, creado_en")
        .in("solicitud_id", ids)
    : { data: [] as { solicitud_id: string; creado_en: string }[] };

  const conteoMensajes = new Map<string, number>();
  const ultimoMensaje = new Map<string, string>();
  for (const m of mensajes ?? []) {
    conteoMensajes.set(m.solicitud_id, (conteoMensajes.get(m.solicitud_id) ?? 0) + 1);
    const prev = ultimoMensaje.get(m.solicitud_id);
    if (!prev || m.creado_en > prev) ultimoMensaje.set(m.solicitud_id, m.creado_en);
  }
  const ultimaActividad = (s: { id: string; actualizada_en: string }) => {
    const um = ultimoMensaje.get(s.id);
    return um && um > s.actualizada_en ? um : s.actualizada_en;
  };

  const conteos: Record<string, number> = {};
  for (const f of filtros) {
    conteos[f.valor] = f.estados
      ? solicitudes.filter((s) => f.estados!.includes(s.estado)).length
      : solicitudes.length;
  }

  const filtradas = (
    filtro.estados
      ? solicitudes.filter((s) => filtro.estados!.includes(s.estado))
      : solicitudes
  ).sort((a, b) => (ultimaActividad(a) < ultimaActividad(b) ? 1 : -1));

  const esPorteria = perfil.rol === "porteria" || perfil.rol === "guardia";

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Solicitudes"
        descripcion={
          esPorteria
            ? "Tus solicitudes, informes y reclamos. Se imprimen para derivarlos a Administración y desde acá seguís cómo van."
            : "Solicitudes, informes y reclamos de socios, portería y administración. Pueden o no estar asociadas a un puesto."
        }
      >
        {!esPorteria ? (
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
          <EmptyState
            icono={MessagesSquare}
            titulo={filtro.vacio.titulo}
            descripcion={filtro.vacio.descripcion}
          >
            {conteos[filtro.valor] === 0 && solicitudes.length === 0 ? (
              <Button asChild size="lg" className="mt-2 h-12 px-5 font-semibold">
                <Link href="/solicitudes/nueva">
                  <Plus className="size-5" strokeWidth={2.2} />
                  Nueva solicitud
                </Link>
              </Button>
            ) : null}
          </EmptyState>
        ) : (
          /* Filas-enlace (como la lista de clientes): el estado siempre a la
             vista, aunque la tablet esté en vertical. */
          <Card className="gap-0 divide-y overflow-hidden py-0">
            {filtradas.map((s) => {
              const cantidad = conteoMensajes.get(s.id) ?? 0;
              const quien = s.cliente
                ? `N° ${s.cliente.codigo} · ${s.cliente.nombre}`
                : (s.referencia ?? "Sin puesto asociado");
              return (
                <Link
                  key={s.id}
                  href={`/solicitudes/${s.id}`}
                  className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
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
                      <span className={s.cliente ? "text-foreground/80" : undefined}>
                        {quien}
                      </span>
                      {" · "}
                      {LABEL_ORIGEN[s.origen]}
                      {" · "}
                      <span className="tabular">{formatFechaHora(ultimaActividad(s))}</span>
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                    <span
                      className={cn(
                        "inline-flex min-w-8 items-center justify-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular",
                        cantidad > 0
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground"
                      )}
                      aria-label={`${cantidad} mensajes`}
                      title={`${cantidad} mensajes`}
                    >
                      <MessageSquare className="size-3.5" strokeWidth={2} aria-hidden />
                      {cantidad}
                    </span>
                    <Sello estado={selloEstado(s.estado)} />
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground max-sm:hidden"
                      strokeWidth={2}
                    />
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
