import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Paperclip, Printer, Store } from "lucide-react";
import { requireRol, type Rol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatFechaHora } from "@/lib/format";
import { LABEL_ROL } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Sello } from "@/components/shared/sello";
import { ChipTipo } from "@/components/solicitudes/chip-tipo";
import { LineaEstado } from "@/components/solicitudes/linea-estado";
import {
  HiloMensajes,
  type MensajeHilo,
} from "@/components/solicitudes/hilo-mensajes";
import { CajaMensaje } from "@/components/solicitudes/caja-mensaje";
import {
  AccionesSolicitud,
  type UsuarioAsignable,
} from "@/components/solicitudes/acciones-solicitud";
import {
  LABEL_ORIGEN,
  selloEstado,
  type EstadoSolicitud,
} from "@/components/solicitudes/constantes";
import { accionesPara } from "@/components/solicitudes/acciones";

export const metadata = { title: "Solicitud" };

type Props = { params: Promise<{ id: string }> };

export default async function SolicitudPage({ params }: Props) {
  const perfil = await requireRol(
    "admin",
    "guardia",
    "porteria",
    "tesoreria",
    "consejo",
    "lider"
  );
  const { id } = await params;
  const supabase = await createClient();

  const { data: s } = await supabase
    .from("solicitudes")
    .select(
      "id, numero, tipo, asunto, detalle, origen, estado, referencia, adjunto_path, resolucion, nota_ejecucion, creada_por, creada_en, revisada_por, revisada_en, derivada_consejo_en, resuelta_por, resuelta_en, asignada_a, asignada_en, ejecutada_por, ejecutada_en, cerrada_en, actualizada_en, cliente:clientes(id, nombre, codigo, apodo)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!s) notFound();

  const usuariosIds = [
    s.creada_por,
    s.revisada_por,
    s.resuelta_por,
    s.asignada_a,
    s.ejecutada_por,
  ].filter((u): u is string => Boolean(u));

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
      ? supabase
          .from("perfiles")
          .select("user_id, nombre")
          .eq("rol", "admin")
          .eq("activo", true)
          .order("nombre")
      : Promise.resolve({ data: [] as UsuarioAsignable[] }),
  ]);

  const nombres = new Map<string, string>();
  for (const p of perfilesRes.data ?? []) nombres.set(p.user_id, p.nombre);
  const nombreDe = (uid: string | null) =>
    uid ? (nombres.get(uid) ?? "—") : null;

  // Links firmados (1 h) para el adjunto de la solicitud y los de los mensajes.
  const mensajesCrudos = mensajesRes.data ?? [];
  const paths = [
    s.adjunto_path,
    ...mensajesCrudos.map((m) => m.adjunto_path),
  ].filter((p): p is string => Boolean(p));
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: firmadas } = await supabase.storage
      .from("documentos")
      .createSignedUrls(paths, 3600);
    for (const f of firmadas ?? []) {
      if (f.path && f.signedUrl) urls.set(f.path, f.signedUrl);
    }
  }
  const mensajes: MensajeHilo[] = mensajesCrudos.map((m) => ({
    ...m,
    adjunto_url: m.adjunto_path ? (urls.get(m.adjunto_path) ?? null) : null,
  }));
  const adjuntoUrl = s.adjunto_path ? urls.get(s.adjunto_path) : undefined;

  const puedeVerFicha =
    perfil.rol === "admin" ||
    perfil.rol === "tesoreria" ||
    perfil.rol === "consejo" ||
    perfil.rol === "lider";
  const puedeActuar =
    perfil.rol === "admin" || perfil.rol === "consejo" || perfil.rol === "lider";
  const hayAcciones = accionesPara(perfil.rol, s.estado).length > 0;

  return (
    <div className="space-y-8">
      <PageHeader
        titulo={`Solicitud N° ${s.numero}`}
        descripcion={s.asunto}
      >
        <Sello estado={selloEstado(s.estado)} className="text-sm" />
        <Button asChild variant="outline" className="min-h-11">
          <Link href={`/solicitudes/${s.id}/imprimir`}>
            <Printer className="size-4" strokeWidth={2} />
            Imprimir
          </Link>
        </Button>
        <Button asChild variant="ghost" className="min-h-11">
          <Link href="/solicitudes">
            <ArrowLeft className="size-4" />
            Volver
          </Link>
        </Button>
      </PageHeader>

      {/* Recorrido */}
      <Card>
        <CardContent>
          <LineaEstado solicitud={s} />
        </CardContent>
      </Card>

      {/* En pantalla ancha: detalle + hilo a la izquierda, acciones a la
          derecha. En tablet vertical: detalle → acciones → hilo, para que el
          botón principal no quede debajo de todos los mensajes. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <Card className="lg:col-start-1 lg:row-start-1">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
              <ChipTipo tipo={s.tipo} />
              <span>Detalle</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Cliente</dt>
                <dd className="font-medium">
                  {s.cliente ? (
                    puedeVerFicha ? (
                      <Link
                        href={`/clientes/${s.cliente.id}`}
                        className="inline-flex items-center gap-1.5 hover:underline"
                      >
                        <Store className="size-4 text-muted-foreground" strokeWidth={2} />
                        N° {s.cliente.codigo} · {s.cliente.nombre}
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <Store className="size-4 text-muted-foreground" strokeWidth={2} />
                        N° {s.cliente.codigo} · {s.cliente.nombre}
                      </span>
                    )
                  ) : s.referencia ? (
                    <span>{s.referencia}</span>
                  ) : (
                    <span className="text-muted-foreground">Sin puesto asociado</span>
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
                  <span className="tabular text-muted-foreground">
                    {" "}· {formatFechaHora(s.creada_en)}
                  </span>
                </dd>
              </div>
              {s.asignada_a ? (
                <div>
                  <dt className="text-muted-foreground">Asignada a</dt>
                  <dd className="font-medium">
                    {nombreDe(s.asignada_a)}{" "}
                    <span className="text-muted-foreground">({LABEL_ROL.admin})</span>
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="border-t pt-4">
              {s.detalle ? (
                <p className="whitespace-pre-line text-[15px] leading-relaxed">
                  {s.detalle}
                </p>
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
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {s.estado === "rechazada" ? "Motivo del rechazo" : "Resolución"}
                </p>
                <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed">
                  {s.resolucion}
                </p>
                {s.resuelta_por ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {nombreDe(s.resuelta_por)} ·{" "}
                    <span className="tabular">{formatFechaHora(s.resuelta_en)}</span>
                  </p>
                ) : null}
              </div>
            ) : null}

            {s.nota_ejecucion ? (
              <div className="rounded-lg border bg-muted/50 px-4 py-3">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Ejecución
                </p>
                <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed">
                  {s.nota_ejecucion}
                </p>
                {s.ejecutada_por ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {nombreDe(s.ejecutada_por)} ·{" "}
                    <span className="tabular">{formatFechaHora(s.ejecutada_en)}</span>
                  </p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Columna lateral (en tablet vertical va entre el detalle y el hilo) */}
        <aside className="space-y-6 lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          {puedeActuar ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Acciones</CardTitle>
              </CardHeader>
              <CardContent>
                {hayAcciones ? (
                  <AccionesSolicitud
                    solicitudId={s.id}
                    estado={s.estado}
                    rol={perfil.rol}
                    tieneResolucion={Boolean(s.resolucion)}
                    admins={adminsRes.data ?? []}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {notaSinAcciones(perfil.rol, s.estado)}
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card size="sm">
            <CardHeader>
              <CardTitle className="text-base">Seguimiento</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <Fila label="Creada" valor={formatFechaHora(s.creada_en)} />
                {s.revisada_en ? (
                  <Fila
                    label="Tomada"
                    valor={`${formatFechaHora(s.revisada_en)}${nombreDe(s.revisada_por) ? ` · ${nombreDe(s.revisada_por)}` : ""}`}
                  />
                ) : null}
                {s.derivada_consejo_en ? (
                  <Fila label="Al Consejo" valor={formatFechaHora(s.derivada_consejo_en)} />
                ) : null}
                {s.resuelta_en && s.estado !== "rechazada" ? (
                  <Fila label="Resuelta" valor={formatFechaHora(s.resuelta_en)} />
                ) : null}
                {s.asignada_en ? (
                  <Fila label="Asignada" valor={formatFechaHora(s.asignada_en)} />
                ) : null}
                {s.ejecutada_en ? (
                  <Fila label="Ejecutada" valor={formatFechaHora(s.ejecutada_en)} />
                ) : null}
                {s.cerrada_en ? (
                  <Fila
                    label={s.estado === "rechazada" ? "Rechazada" : "Cerrada"}
                    valor={formatFechaHora(s.cerrada_en)}
                  />
                ) : null}
                <Fila label="Última actualización" valor={formatFechaHora(s.actualizada_en)} />
              </dl>
            </CardContent>
          </Card>
        </aside>

        {/* Hilo */}
        <section
          className="space-y-4 lg:col-start-1 lg:row-start-2"
          aria-label="Mensajes"
        >
          <h2 className="font-display text-lg font-bold tracking-tight">
            Mensajes
            <span className="ml-2 text-base font-normal text-muted-foreground tabular">
              {mensajes.length}
            </span>
          </h2>
          <HiloMensajes mensajes={mensajes} usuarioId={perfil.user_id} />
          <CajaMensaje
            solicitudId={s.id}
            esStaff
            placeholder={
              s.cliente
                ? "Escribile al socio o dejá una nota interna…"
                : "Escribí un mensaje o dejá una nota interna…"
            }
          />
        </section>
      </div>
    </div>
  );
}

/** Qué decirle al rol cuando en este estado no le toca hacer nada. */
function notaSinAcciones(rol: Rol, estado: EstadoSolicitud): string {
  if (estado === "cerrada" || estado === "rechazada")
    return rol === "lider"
      ? "Terminada."
      : "Terminada. Solo el Líder de Procesos la puede reabrir.";
  if (rol === "admin")
    return estado === "ejecutada"
      ? "Ya está ejecutada."
      : "La está revisando el Líder de Procesos o el Consejo. Cuando te la asignen, vas a poder marcarla ejecutada.";
  if (rol === "consejo")
    return estado === "resuelta"
      ? "Resolución registrada. El Líder de Procesos la asigna a Administración."
      : "Por ahora no hay nada que hacer desde el Consejo.";
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
