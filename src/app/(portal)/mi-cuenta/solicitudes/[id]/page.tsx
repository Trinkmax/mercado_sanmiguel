import { notFound } from "next/navigation";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LABEL_ROL } from "@/lib/roles";
import { fraseAutomatica } from "@/components/solicitudes/hilo-mensajes";
import { esMensajeAutomatico } from "@/components/solicitudes/constantes";
import type { ItemChat } from "@/components/portal/hilo-portal";
import { PantallaSolicitud } from "@/components/portal/pantallas/pantalla-solicitud";
import { MarcarSolicitudVista } from "@/components/solicitudes/marcar-vista";

export const metadata = { title: "Conversación" };

export default async function SolicitudSocioPage({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await requireRol("socio");
  const { id } = await params;
  const supabase = await createClient();

  // La RLS ya limita a las solicitudes del propio cliente.
  const { data: s } = await supabase
    .from("solicitudes")
    .select(
      "id, numero, tipo, asunto, detalle, estado, adjunto_path, resolucion, nota_ejecucion, creada_en, revisada_en, derivada_consejo_en, resuelta_en, asignada_en, ejecutada_en, cerrada_en, actualizada_en, cliente_id, creada_por"
    )
    .eq("id", id)
    .maybeSingle();
  if (!s) notFound();

  // Los mensajes internos no llegan: la RLS los filtra para el socio.
  const { data: crudos } = await supabase
    .from("solicitud_mensajes")
    .select("id, autor_id, autor_nombre, autor_rol, mensaje, interno, creado_en, adjunto_path")
    .eq("solicitud_id", s.id)
    .order("creado_en", { ascending: true });

  const paths = [s.adjunto_path, ...(crudos ?? []).map((m) => m.adjunto_path)].filter((p): p is string => Boolean(p));
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: firmadas } = await supabase.storage.from("documentos").createSignedUrls(paths, 3600);
    for (const f of firmadas ?? []) if (f.path && f.signedUrl) urls.set(f.path, f.signedUrl);
  }

  const mio = s.creada_por === perfil.user_id;

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
