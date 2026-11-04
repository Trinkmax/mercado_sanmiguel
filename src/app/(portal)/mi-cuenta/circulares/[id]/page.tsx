import { notFound } from "next/navigation";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCircularesSocio } from "@/components/portal/datos-portal";
import { PantallaCircular } from "@/components/portal/pantallas/pantalla-circular";
import { RegistrarVista } from "@/components/portal/registrar-vista";

export const metadata = { title: "Circular" };

export default async function CircularSocioPage({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await requireRol("socio");
  const { id } = await params;

  // Solo las circulares activas de SU público (RLS + clienteEnPublico).
  const c = (await getCircularesSocio(perfil.user_id)).find((x) => x.id === id);
  if (!c) notFound();

  let pdfUrl: string | undefined;
  if (c.storage_path) {
    const supabase = await createClient();
    pdfUrl = (await supabase.storage.from("documentos").createSignedUrl(c.storage_path, 3600)).data?.signedUrl;
  }

  return (
    <>
      {/* Informativa: abrirla = "la vio". La obligatoria se confirma con el botón. */}
      {!c.obligatoria && !c.recibida_en ? <RegistrarVista tipo="circular" id={c.id} /> : null}
      <PantallaCircular c={c} pdfUrl={pdfUrl} />
    </>
  );
}
