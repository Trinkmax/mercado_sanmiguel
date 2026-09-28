import Link from "next/link";
import { ChevronDown, ChevronRight, MapPin, MessageSquare, MessagesSquare, Plus } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SIN_CONEXION } from "@/lib/sesion";
import { formatFechaHora, formatNumero, periodoActual } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Sello } from "@/components/shared/sello";
import { BotonExportar } from "@/components/shared/boton-exportar";
import { ChipTipo } from "@/components/solicitudes/chip-tipo";
import { FiltrosSolicitudes, filtrosParaRol, type FiltroSolicitud } from "@/components/solicitudes/filtros-solicitudes";
import { LABEL_ORIGEN, selloSolicitud } from "@/components/solicitudes/constantes";

export const metadata = { title: "Solicitudes" };

/** De a cuántas se muestran (las más recientes primero); "Ver más" suma otras tantas. */
const POR_PAGINA = 100;
/** Tope de filas por consulta (max_rows de PostgREST en Supabase): más no llegan igual. */
const MAXIMO = 1000;

export default async function SolicitudesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; ver?: string }>;
}) {
  const perfil = await requireRol("admin", "guardia", "porteria", "tesoreria", "lider");
  const { estado, ver } = await searchParams;
  const filtros = filtrosParaRol(perfil.rol);
  const filtro = filtros.find((f) => f.valor === estado) ?? filtros[0];
  const cantidad = Math.min(MAXIMO, Math.max(POR_PAGINA, Math.ceil((Number(ver) || 0) / POR_PAGINA) * POR_PAGINA));

  const supabase = await createClient();

  // La RLS recorta: Portería y Tesorería ven las suyas; el Jefe, las de Portería y las suyas.
  // La bandeja se ordena por actualizada_en (cualquier mensaje la mueve: trigger tocar_solicitud).
  // Solo se traen las de la pestaña abierta (con tope); los números de las pestañas se cuentan
  // aparte, sin traer filas. La cantidad de mensajes viene en la misma consulta.
  let lista = supabase
    .from("solicitudes")
    .select(
      "id, numero, tipo, asunto, origen, estado, referencia, resolucion_de, creada_en, actualizada_en, cliente:clientes(nombre, codigo), solicitud_mensajes(count)"
    )
    .order("actualizada_en", { ascending: false })
    .limit(cantidad);
  if (filtro.estados) lista = lista.in("estado", filtro.estados);
  if (filtro.origen) lista = lista.eq("origen", filtro.origen);

  const contar = (f: FiltroSolicitud) => {
    let q = supabase.from("solicitudes").select("id", { count: "exact", head: true });
    if (f.estados) q = q.in("estado", f.estados);
    if (f.origen) q = q.eq("origen", f.origen);
    return q;
  };

  const [listaRes, conteosRes, conRespuestaRes] = await Promise.all([
    lista,
    Promise.all(filtros.map(contar)),
    supabase.rpc("solicitudes_con_respuesta"),
  ]);
  // Si la base no respondió, NO se muestra "Todavía no hay solicitudes": la pantalla de
  // error reintenta sola.
  if (listaRes.error) throw new Error(SIN_CONEXION);
  const filtradas = listaRes.data ?? [];
  const conRespuesta = new Set(conRespuestaRes.data ?? []);

  const conteos: Record<string, number> = {};
  filtros.forEach((f, i) => {
    conteos[f.valor] = conteosRes[i].count ?? 0;
  });
  const totalFiltro = Math.max(conteos[filtro.valor] ?? 0, filtradas.length);
  const quedanAfuera = totalFiltro > filtradas.length;
  const hayMas = quedanAfuera && cantidad < MAXIMO;
  const hayAlguna = Object.values(conteos).some((n) => n > 0) || filtradas.length > 0;
  const hrefMas = `/solicitudes?${new URLSearchParams({
    ...(filtro.valor !== filtros[0].valor ? { estado: filtro.valor } : {}),
    ver: String(cantidad + POR_PAGINA),
  }).toString()}`;

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
            {!hayAlguna ? (
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
              const mensajes = s.solicitud_mensajes?.[0]?.count ?? 0;
              const esperaAlJefe = perfil.rol === "guardia" && s.estado === "con_jefe" && s.origen === "porteria";
              const respuestaNueva = conRespuesta.has(s.id);
              return (
                <Link
                  key={s.id}
                  href={`/solicitudes/${s.id}`}
                  className={cn(
                    "flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
                    esperaAlJefe && "bg-parcial-suave/50",
                    respuestaNueva && "bg-accent/60"
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
                      <p className={cn("line-clamp-2 text-sm leading-snug break-words", respuestaNueva ? "font-bold" : "font-medium")}>
                        {s.asunto}
                      </p>
                      <ChipTipo tipo={s.tipo} />
                      {respuestaNueva ? (
                        <span className="inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                          Respuesta nueva
                        </span>
                      ) : null}
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
                        mensajes > 0 ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                      )}
                      aria-label={`${mensajes} mensajes`}
                      title={`${mensajes} mensajes`}
                    >
                      <MessageSquare className="size-3.5" strokeWidth={2} aria-hidden />
                      {mensajes}
                    </span>
                    <Sello estado={selloSolicitud(s)} />
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground max-sm:hidden" strokeWidth={2} />
                  </div>
                </Link>
              );
            })}
          </Card>
        )}

        {quedanAfuera && filtradas.length > 0 ? (
          <div className="flex flex-col items-center gap-2 pt-2 text-center">
            <p className="text-sm text-muted-foreground">
              Se ven las {formatNumero(filtradas.length)} más recientes de {formatNumero(totalFiltro)}.
            </p>
            {hayMas ? (
              <Button asChild variant="outline" size="lg" className="h-12 px-6 text-base">
                <Link href={hrefMas} scroll={false}>
                  <ChevronDown className="size-5" strokeWidth={2} />
                  Ver más viejas
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
