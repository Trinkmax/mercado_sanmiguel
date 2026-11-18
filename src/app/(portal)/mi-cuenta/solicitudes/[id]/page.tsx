import { notFound } from "next/navigation";
import { requirePortal } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LABEL_ROL } from "@/lib/roles";
import { fraseAutomatica } from "@/components/solicitudes/hilo-mensajes";
import { esMensajeAutomatico } from "@/components/solicitudes/constantes";
import type { ItemChat } from "@/components/portal/hilo-portal";
import { PantallaSolicitud } from "@/components/portal/pantallas/pantalla-solicitud";
import { MarcarSolicitudVista } from "@/components/solicitudes/marcar-vista";
import { getClienteSocio } from "@/components/portal/datos-portal";
import { describirAdjunto } from "@/lib/storage";

export const metadata = { title: "Conversación" };

export default async function SolicitudSocioPage({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await requirePortal();
  const { id } = await params;
  const cliente = await getClienteSocio(perfil.user_id);
  if (!cliente) notFound();
  const supabase = await createClient();

  // Solo las de SU carpeta: al socio la RLS ya no le da otras, pero alguien del equipo con
  // carpeta propia (0066) lee también las de su trabajo.
  const { data: s } = await supabase
    .from("solicitudes")
    .select(
      "id, numero, tipo, asunto, detalle, estado, adjunto_path, resolucion, nota_ejecucion, creada_en, revisada_en, derivada_consejo_en, resuelta_en, asignada_en, ejecutada_en, cerrada_en, actualizada_en, cliente_id, creada_por"
    )
    .eq("id", id)
    .eq("cliente_id", cliente.id)
    .maybeSingle();
  if (!s) notFound();

  // Los mensajes internos no llegan: la RLS los filtra para el cliente (y acá tampoco se piden).
  const { data: crudos } = await supabase
    .from("solicitud_mensajes")
    .select("id, autor_id, autor_nombre, autor_rol, mensaje, interno, creado_en, adjunto_path")
    .eq("solicitud_id", s.id)
    .eq("interno", false)
    .order("creado_en", { ascending: true });

  const paths = [s.adjunto_path, ...(crudos ?? []).map((m) => m.adjunto_path)].filter((p): p is string => Boolean(p));
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: firmadas } = await supabase.storage.from("documentos").createSignedUrls(paths, 3600);
    for (const f of firmadas ?? []) if (f.path && f.signedUrl) urls.set(f.path, f.signedUrl);
  }

  const mio = s.creada_por === perfil.user_id;
  const tipoDe = (path: string): "foto" | "pdf" => (describirAdjunto(path).esPdf ? "pdf" : "foto");

  const items: ItemChat[] = [];
  if (s.detalle || s.adjunto_path) {
    items.push({
      clase: "mensaje",
      id: "inicial",
      mio,
      autor: mio ? null : "Administración",
      texto: s.detalle ?? s.asunto,
      fecha: s.creada_en,
      adjunto: s.adjunto_path ? (urls.get(s.adjunto_path) ?? null) : null,
      adjuntoTipo: s.adjunto_path ? tipoDe(s.adjunto_path) : undefined,
    });
  } else {
    items.push({ clase: "mensaje", id: "inicial", mio, autor: mio ? null : "Administración", texto: s.asunto, fecha: s.creada_en });
  }
  for (const m of crudos ?? []) {
    if (esMensajeAutomatico(m.mensaje) && !m.interno) {
      items.push({
        clase: "hecho",
        id: m.id,
        texto: `${LABEL_ROL[m.autor_rol]} ${fraseAutomatica(m.mensaje)}`,
        fecha: m.creado_en,
      });
      continue;
    }
    const delSocio = m.autor_id === perfil.user_id;
    items.push({
      clase: "mensaje",
      id: m.id,
      mio: delSocio,
      autor: delSocio ? null : LABEL_ROL[m.autor_rol],
      texto: m.mensaje,
      fecha: m.creado_en,
      adjunto: m.adjunto_path ? (urls.get(m.adjunto_path) ?? null) : null,
      adjuntoTipo: m.adjunto_path ? tipoDe(m.adjunto_path) : undefined,
    });
  }

  return (
    <>
      {/* Lo está viendo: se apaga "Respuesta nueva" (y el número de Mensajes). */}
      {mio ? <MarcarSolicitudVista solicitudId={s.id} /> : null}
      <PantallaSolicitud s={s} items={items} />
    </>
  );
}
