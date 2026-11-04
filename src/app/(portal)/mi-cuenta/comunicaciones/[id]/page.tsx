import { notFound } from "next/navigation";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LABEL_ROL } from "@/lib/roles";
import type { ItemChat } from "@/components/portal/hilo-portal";
import { PantallaAviso } from "@/components/portal/pantallas/pantalla-aviso";
import { RegistrarVista } from "@/components/portal/registrar-vista";
import { fechasDelHilo } from "@/components/comunicaciones/linea-estado-registro";

export const metadata = { title: "Aviso" };

export default async function RegistroSocioPage({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await requireRol("socio");
  const { id } = await params;
  const supabase = await createClient();

  // La RLS solo devuelve los registros propios: uno ajeno es un 404.
  const { data: r } = await supabase
    .from("sanciones")
    .select(
      "id, numero, tipo, titulo, detalle, fecha, storage_path, estado, multa, multa_vencimiento, multa_sin_efecto_en, creado_en, cargos(estado, monto, monto_pagado), espacios(tipo, numero, medio)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!r) notFound();

  const { data: crudos } = await supabase
    .from("registro_mensajes")
    .select("id, autor_id, autor_nombre, autor_rol, mensaje, es_descargo, creado_en, adjunto_path")
    .eq("registro_id", r.id)
    .order("creado_en", { ascending: true });

  const paths = [r.storage_path, ...(crudos ?? []).map((m) => m.adjunto_path)].filter((p): p is string => Boolean(p));
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await supabase.storage.from("documentos").createSignedUrls(paths, 3600);
    for (const f of data ?? []) if (f.path && f.signedUrl) urls.set(f.path, f.signedUrl);
  }

  const mensajes = crudos ?? [];
  const { descargoEn, respondidoEn } = fechasDelHilo(mensajes);
  const cargoRaw = Array.isArray(r.cargos) ? r.cargos[0] : r.cargos;
  const cargo = cargoRaw
    ? { estado: cargoRaw.estado, monto: Number(cargoRaw.monto), monto_pagado: Number(cargoRaw.monto_pagado) }
    : null;
  const espacio = Array.isArray(r.espacios) ? r.espacios[0] : r.espacios;
  const multa = r.multa === null ? null : Number(r.multa);
  const datosMulta = { multa, multa_sin_efecto_en: r.multa_sin_efecto_en, cargo };
  const docUrl = r.storage_path ? urls.get(r.storage_path) : undefined;
  const yaEscribio = mensajes.some((m) => m.autor_rol === "socio");

  const items: ItemChat[] = mensajes.map((m) => {
    const mio = m.autor_id === perfil.user_id;
    return {
      clase: "mensaje",
      id: m.id,
      mio,
      autor: mio ? null : LABEL_ROL[m.autor_rol],
      texto: m.mensaje,
      fecha: m.creado_en,
      adjunto: m.adjunto_path ? (urls.get(m.adjunto_path) ?? null) : null,
    };
  });
  if (r.multa_sin_efecto_en) {
    items.push({
      clase: "hecho",
      id: "multa",
      fecha: r.multa_sin_efecto_en,
      texto: "La multa quedó sin efecto: no la tenés que pagar.",
    });
  }

  return (
    <>
      <RegistrarVista tipo="registro" id={r.id} />
      <PantallaAviso
      r={r}
      espacio={espacio ?? null}
      docUrl={docUrl}
      datosMulta={datosMulta}
      items={items}
      descargoEn={descargoEn}
      respondidoEn={respondidoEn}
      yaEscribio={yaEscribio}
      />
    </>
  );
}
