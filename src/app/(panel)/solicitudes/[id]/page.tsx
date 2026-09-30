import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Paperclip, Printer, Store } from "lucide-react";
import { requireRol, type Rol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SIN_CONEXION } from "@/lib/sesion";
import { formatFechaHora } from "@/lib/format";
import { LABEL_ROL } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Sello } from "@/components/shared/sello";
import { ChipTipo } from "@/components/solicitudes/chip-tipo";
import { LineaEstado } from "@/components/solicitudes/linea-estado";
import { HiloMensajes, type MensajeHilo } from "@/components/solicitudes/hilo-mensajes";
import { CajaMensaje } from "@/components/solicitudes/caja-mensaje";
import { AccionesSolicitud, type UsuarioAsignable } from "@/components/solicitudes/acciones-solicitud";
import { MarcarSolicitudVista } from "@/components/solicitudes/marcar-vista";
import {
  LABEL_ORIGEN,
  quienLaTiene,
  selloSolicitud,
  type EstadoSolicitud,
  type OrigenSolicitud,
} from "@/components/solicitudes/constantes";
import { accionesPara } from "@/components/solicitudes/acciones";

export const metadata = { title: "Solicitud" };

type Props = { params: Promise<{ id: string }> };

export default async function SolicitudPage({ params }: Props) {
  const perfil = await requireRol("admin", "guardia", "porteria", "tesoreria", "lider");
  const { id } = await params;
  const supabase = await createClient();

  const { data: s, error: errorSolicitud } = await supabase
    .from("solicitudes")
    .select(
      "id, numero, tipo, asunto, detalle, origen, estado, referencia, espacio_id, adjunto_path, resolucion, resolucion_de, nota_ejecucion, creada_por, creada_en, revisada_por, revisada_en, elevada_por, elevada_en, derivada_consejo_en, resuelta_por, resuelta_en, asignada_a, asignada_en, ejecutada_por, ejecutada_en, cerrada_en, actualizada_en, cliente:clientes(id, nombre, codigo, apodo)"
    )
    .eq("id", id)
    .maybeSingle();
  // Si la base no respondió no se muestra "no existe": la pantalla de error reintenta sola.
  if (errorSolicitud && errorSolicitud.code !== "22P02") throw new Error(SIN_CONEXION); // 22P02: id inválido → 404
  if (!s) notFound();

  const usuariosIds = [s.creada_por, s.revisada_por, s.elevada_por, s.resuelta_por, s.asignada_a, s.ejecutada_por].filter(
    (u): u is string => Boolean(u)
  );

  const [mensajesRes, perfilesRes, adminsRes] = await Promise.all([
    supabase
      .from("solicitud_mensajes")
      .select("id, autor_id, autor_nombre, autor_rol, mensaje, interno, creado_en, adjunto_path")
      .eq("solicitud_id", s.id)
      .order("creado_en", { ascending: true }),
    usuariosIds.length
      ? supabase.from("perfiles").select("user_id, nombre, rol").in("user_id", usuariosIds)
      : Promise.resolve({ data: [] as { user_id: string; nombre: string; rol: string }[] }),
    perfil.rol === "lider"
      ? supabase.from("perfiles").select("user_id, nombre").eq("rol", "admin").eq("activo", true).order("nombre")
      : Promise.resolve({ data: [] as UsuarioAsignable[] }),
  ]);

  const nombres = new Map<string, string>();
  for (const p of perfilesRes.data ?? []) nombres.set(p.user_id, p.nombre);
  const nombreDe = (uid: string | null) => (uid ? (nombres.get(uid) ?? "—") : null);

  // Links firmados (1 h) para el adjunto de la solicitud y los de los mensajes.
  const mensajesCrudos = mensajesRes.data ?? [];
  const paths = [s.adjunto_path, ...mensajesCrudos.map((m) => m.adjunto_path)].filter((p): p is string => Boolean(p));
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: firmadas } = await supabase.storage.from("documentos").createSignedUrls(paths, 3600);
    for (const f of firmadas ?? []) if (f.path && f.signedUrl) urls.set(f.path, f.signedUrl);
  }
  const mensajes: MensajeHilo[] = mensajesCrudos.map((m) => ({
    ...m,
    adjunto_url: m.adjunto_path ? (urls.get(m.adjunto_path) ?? null) : null,
  }));
  const adjuntoUrl = s.adjunto_path ? urls.get(s.adjunto_path) : undefined;

  // Tesorería no ve Clientes (J4); el Jefe y Portería no ven puesteros: sin link a la ficha.
  const puedeVerFicha = perfil.rol === "admin" || perfil.rol === "lider";
  const puedeVerMapa = perfil.rol === "admin" || perfil.rol === "lider";
  const esJefeDePorteria = perfil.rol === "guardia" && s.origen === "porteria";
  const puedeActuar = perfil.rol === "admin" || perfil.rol === "lider" || esJefeDePorteria;
  const hayAcciones = accionesPara(perfil.rol, s).length > 0;
  const laTiene = quienLaTiene(s);
  const asignadaA = s.estado === "asignada" && s.asignada_a ? ` (${nombreDe(s.asignada_a)})` : "";

  const tituloResolucion =
    s.estado === "rechazada"
      ? s.resolucion_de === "jefe"
        ? "Motivo del rechazo · Jefe de Portería"
        : "Motivo del rechazo"
      : s.resolucion_de === "jefe"
        ? "Resolución del Jefe de Portería"
        : s.resolucion_de === "consejo"
          ? `Resolución del Consejo${s.resuelta_por ? ` · registrada por ${nombreDe(s.resuelta_por)}` : ""}`
          : "Resolución";

  return (
    <div className="space-y-8">
      {/* Quien la cargó la está viendo: se apaga "Respuesta nueva". */}
      {s.creada_por === perfil.user_id ? <MarcarSolicitudVista solicitudId={s.id} /> : null}
      {/* "Volver" arriba a la izquierda, como en los demás detalles. */}
      <div className="space-y-3">
        <Button asChild variant="ghost" className="-ml-2 min-h-11">
          <Link href="/solicitudes">
            <ArrowLeft className="size-4" />
            Volver a Solicitudes
          </Link>
        </Button>
        <PageHeader titulo={`Solicitud N° ${s.numero}`} descripcion={s.asunto} className="pb-0">
          <Sello estado={selloSolicitud(s)} className="text-sm" />
          <Button asChild variant="outline" className="min-h-11">
            <Link href={`/solicitudes/${s.id}/imprimir`} data-tour="solicitudes-imprimir">
              <Printer className="size-4" strokeWidth={2} />
              Imprimir
            </Link>
          </Button>
        </PageHeader>
      </div>

      {/* Recorrido */}
      <Card data-tour="solicitudes-recorrido">
        <CardContent className="space-y-3">
          <LineaEstado solicitud={s} />
          {laTiene ? (
            <p className="border-t pt-3 text-sm md:border-t-0 md:pt-0 md:text-center">
              Ahora la tiene: <span className="font-semibold">{laTiene}{asignadaA}</span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* En pantalla ancha: detalle + hilo a la izquierda, acciones a la derecha. En tablet
          vertical: detalle → acciones → hilo, para que el botón principal no quede debajo de
          todos los mensajes. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <Card className="lg:col-start-1 lg:row-start-1" data-tour="solicitudes-detalle">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
              <ChipTipo tipo={s.tipo} />
              <span>Detalle</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{s.cliente ? "Cliente" : "Lugar"}</dt>
                <dd className="font-medium">
                  {s.cliente ? (
                    puedeVerFicha ? (
                      <Link href={`/clientes/${s.cliente.id}`} className="inline-flex min-h-11 items-center gap-1.5 hover:underline">
                        <Store className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
                        <span className="break-words">
                          Carpeta <span className="tabular">{s.cliente.codigo}</span> · {s.cliente.nombre}
                        </span>
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <Store className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
                        <span className="break-words">
                          Carpeta <span className="tabular">{s.cliente.codigo}</span> · {s.cliente.nombre}
                        </span>
                      </span>
                    )
                  ) : s.referencia ? (
                    s.espacio_id && puedeVerMapa ? (
                      <Link
                        href={`/mapa?espacio=${s.espacio_id}`}
                        className="inline-flex min-h-11 items-center gap-1.5 hover:underline"
                      >
                        <MapPin className="size-4 text-muted-foreground" strokeWidth={2} />
                        {s.referencia} · ver en el mapa
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        {s.espacio_id ? <MapPin className="size-4 text-muted-foreground" strokeWidth={2} /> : null}
                        {s.referencia}
                      </span>
                    )
                  ) : (
                    <span className="text-muted-foreground">General</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Origen</dt>
                <dd className="font-medium">{LABEL_ORIGEN[s.origen]}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">La cargó</dt>
                <dd className="font-medium">
                  {nombreDe(s.creada_por) ?? "—"}
                  <span className="tabular text-muted-foreground"> · {formatFechaHora(s.creada_en)}</span>
                </dd>
              </div>
              {s.asignada_a ? (
                <div>
                  <dt className="text-muted-foreground">Asignada a</dt>
                  <dd className="font-medium">
                    {nombreDe(s.asignada_a)} <span className="text-muted-foreground">({LABEL_ROL.admin})</span>
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="border-t pt-4">
              {s.detalle ? (
                <p className="whitespace-pre-line text-[15px] leading-relaxed">{s.detalle}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Sin detalle.</p>
              )}
              {adjuntoUrl ? (
                <Button asChild variant="outline" className="mt-3 min-h-11">
                  <a href={adjuntoUrl} target="_blank" rel="noopener noreferrer">
                    <Paperclip className="size-4" strokeWidth={2} />
                    Ver adjunto
                  </a>
                </Button>
              ) : null}
            </div>

            {s.resolucion ? (
              <div
                className={
                  s.estado === "rechazada"
                    ? "rounded-lg border border-pendiente/30 bg-pendiente-suave px-4 py-3"
                    : "rounded-lg border border-pagado/30 bg-pagado-suave px-4 py-3"
                }
              >
                <p className="text-sm font-semibold text-foreground/80">{tituloResolucion}</p>
                <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed">{s.resolucion}</p>
                {s.resuelta_por ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {nombreDe(s.resuelta_por)} · <span className="tabular">{formatFechaHora(s.resuelta_en)}</span>
                  </p>
                ) : null}
              </div>
            ) : null}

            {s.nota_ejecucion ? (
              <div className="rounded-lg border bg-muted/50 px-4 py-3">
                <p className="text-sm font-semibold text-foreground/80">Ejecución</p>
                <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed">{s.nota_ejecucion}</p>
                {s.ejecutada_por ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {nombreDe(s.ejecutada_por)} · <span className="tabular">{formatFechaHora(s.ejecutada_en)}</span>
                  </p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Columna lateral (en tablet vertical va entre el detalle y el hilo) */}
        <aside className="space-y-6 lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <Card data-tour={puedeActuar && hayAcciones ? "solicitudes-acciones" : "solicitudes-como-sigue"}>
            <CardHeader>
              <CardTitle className="text-lg">{puedeActuar && hayAcciones ? "Acciones" : "Cómo sigue"}</CardTitle>
            </CardHeader>
            <CardContent>
              {puedeActuar && hayAcciones ? (
                <AccionesSolicitud
                  solicitudId={s.id}
                  estado={s.estado}
                  origen={s.origen}
                  rol={perfil.rol}
                  tieneResolucion={Boolean(s.resolucion)}
                  admins={adminsRes.data ?? []}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {notaSinAcciones(perfil.rol, s.estado, s.origen, s.creada_por === perfil.user_id)}
                </p>
              )}
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle className="text-base">Seguimiento</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <Fila label="Creada" valor={formatFechaHora(s.creada_en)} />
                {s.elevada_en ? (
                  <Fila
                    label="Elevada al Líder"
                    valor={`${formatFechaHora(s.elevada_en)}${nombreDe(s.elevada_por) ? ` · ${nombreDe(s.elevada_por)}` : ""}`}
                  />
                ) : null}
                {s.revisada_en ? (
                  <Fila
                    label="Tomada"
                    valor={`${formatFechaHora(s.revisada_en)}${nombreDe(s.revisada_por) ? ` · ${nombreDe(s.revisada_por)}` : ""}`}
                  />
                ) : null}
                {s.derivada_consejo_en ? <Fila label="Al Consejo" valor={formatFechaHora(s.derivada_consejo_en)} /> : null}
                {s.resuelta_en && s.estado !== "rechazada" ? (
                  <Fila
                    label={s.resolucion_de === "jefe" ? "Resuelta por el Jefe" : "Resuelta"}
                    valor={formatFechaHora(s.resuelta_en)}
                  />
                ) : null}
                {s.asignada_en ? <Fila label="Asignada" valor={formatFechaHora(s.asignada_en)} /> : null}
                {s.ejecutada_en ? <Fila label="Ejecutada" valor={formatFechaHora(s.ejecutada_en)} /> : null}
                {s.cerrada_en ? (
                  <Fila label={s.estado === "rechazada" ? "Rechazada" : "Cerrada"} valor={formatFechaHora(s.cerrada_en)} />
                ) : null}
                <Fila label="Última actualización" valor={formatFechaHora(s.actualizada_en)} />
              </dl>
            </CardContent>
          </Card>
        </aside>

        {/* Hilo */}
        <section className="space-y-4 lg:col-start-1 lg:row-start-2" aria-label="Mensajes" data-tour="solicitudes-mensajes">
          <h2 className="font-display text-lg font-bold tracking-tight">
            Mensajes
            <span className="ml-2 text-base font-normal text-muted-foreground tabular">{mensajes.length}</span>
          </h2>
          <HiloMensajes mensajes={mensajes} usuarioId={perfil.user_id} />
          <CajaMensaje
            solicitudId={s.id}
            esStaff
            placeholder={
              s.cliente ? "Escribile al socio o dejá una nota interna…" : "Escribí un mensaje o dejá una nota interna…"
            }
          />
        </section>
      </div>
    </div>
  );
}

/** Qué decirle al rol cuando en este estado no le toca hacer nada. */
function notaSinAcciones(rol: Rol, estado: EstadoSolicitud, origen: OrigenSolicitud, esMia: boolean): string {
  const terminada = estado === "cerrada" || estado === "rechazada" || estado === "ejecutada";
  if (terminada)
    return rol === "lider" ? "Terminada." : "Terminada. Si hace falta, el Líder de Procesos la puede reabrir.";
  if (rol === "guardia") {
    if (origen === "porteria" && estado !== "con_jefe")
      return esMia
        ? "Le llegó al Líder de Procesos: acá ves cómo sigue y lo que te respondan."
        : "Ya la elevaste al Líder de Procesos: acá ves cómo sigue.";
    return "La tiene el Líder de Procesos.";
  }
  if (rol === "porteria")
    return estado === "con_jefe"
      ? "La tiene el Jefe de Portería: la resuelve o la eleva al Líder de Procesos."
      : "La está viendo el Líder de Procesos. Las respuestas te llegan en este hilo.";
  if (rol === "tesoreria") return "La está viendo el Líder de Procesos. Las respuestas te llegan en este hilo.";
  if (rol === "admin")
    return estado === "con_jefe"
      ? "Está con el Jefe de Portería."
      : estado === "nueva"
        ? "Le llegó al Líder de Procesos. Si te la asigna, vas a poder marcarla ejecutada."
        : "La está revisando el Líder de Procesos o el Consejo. Cuando te la asignen, vas a poder marcarla ejecutada.";
  return "No hay acciones disponibles en este estado.";
}

function Fila({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular">{valor}</dd>
    </div>
  );
}
