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
              // La lista va por el último movimiento: se dice cuál fecha es.
              const fecha = fechaDeFila(s.creada_en, s.actualizada_en);
              return (
                <Link
                  key={s.id}
                  href={`/solicitudes/${s.id}`}
                  className={cn(
                    "flex min-h-14 items-start gap-3 px-4 py-3 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
                    esperaAlJefe && "bg-parcial-suave/50",
                    respuestaNueva && "bg-accent/60"
                  )}
                >
                  {/* El "N°" va en el número de la solicitud (antes estaba en la carpeta del socio). */}
                  <span className="flex min-w-12 shrink-0 items-baseline justify-end gap-0.5 font-display text-lg leading-snug font-bold tabular">
                    <span className="font-sans text-xs font-medium text-muted-foreground">N°</span>
                    {s.numero}
                  </span>

                  {/* Asunto y datos completos, en los renglones que haga falta: cortados con "…" se
                      perdían la hora, el origen o la fecha. */}
                  <div className="min-w-0 flex-1 space-y-1">
                    {/* Celular: el estado arriba del asunto, así el texto usa todo el ancho. */}
                    <div className="flex items-center gap-2 sm:hidden">
                      <Sello estado={selloSolicitud(s)} />
                      <CantidadMensajes n={mensajes} />
                    </div>
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <p
                        className={cn(
                          "min-w-0 text-base leading-snug break-words",
                          respuestaNueva ? "font-bold" : "font-medium"
                        )}
                      >
                        {s.asunto}
                      </p>
                      <ChipTipo tipo={s.tipo} />
                      {respuestaNueva ? (
                        <span className="inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                          Respuesta nueva
                        </span>
                      ) : null}
                    </div>
                    {s.cliente ? (
                      <p className="text-sm break-words text-foreground/80">
                        <span className="tabular text-muted-foreground">Carpeta {s.cliente.codigo}</span> ·{" "}
                        {s.cliente.nombre}
                      </p>
                    ) : s.referencia ? (
                      <p className="flex items-start gap-1 text-sm break-words text-foreground/80">
                        <MapPin className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden />
                        {s.referencia}
                      </p>
                    ) : null}
                    <p className="flex flex-wrap gap-x-1.5 text-sm text-muted-foreground">
                      <span>{s.cliente || s.referencia ? LABEL_ORIGEN[s.origen] : `General · ${LABEL_ORIGEN[s.origen]}`}</span>
                      <span aria-hidden>·</span>
                      <span className="whitespace-nowrap">
                        {fecha.label} <span className="tabular">{fecha.valor}</span>
                      </span>
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3 pt-0.5 max-sm:hidden">
                    <CantidadMensajes n={mensajes} />
                    <Sello estado={selloSolicitud(s)} />
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
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

/**
 * Fecha de la fila con su nombre: la lista va por el último movimiento (cualquier mensaje la
 * sube), así que se dice si es la de alta o la de la última actualización.
 */
function fechaDeFila(creada: string, actualizada: string): { label: string; valor: string } {
  const alta = formatFechaHora(creada);
  const ultima = formatFechaHora(actualizada);
  return alta === ultima ? { label: "Creada", valor: alta } : { label: "Actualizada", valor: ultima };
}

function CantidadMensajes({ n }: { n: number }) {
  const texto = n === 1 ? "1 mensaje" : `${n} mensajes`;
  return (
    <span
      className={cn(
        "inline-flex min-w-8 items-center justify-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular",
        n > 0 ? "bg-accent text-accent-foreground" : "text-muted-foreground"
      )}
      title={texto}
    >
      <MessageSquare className="size-3.5" strokeWidth={2} aria-hidden />
      {n}
      <span className="sr-only"> {n === 1 ? "mensaje" : "mensajes"}</span>
    </span>
  );
}
