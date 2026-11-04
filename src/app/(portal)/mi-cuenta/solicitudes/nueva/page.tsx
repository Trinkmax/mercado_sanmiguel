import { UserX } from "lucide-react";
import { requireRol, filtroClientePortal } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EncabezadoDetalle } from "@/components/portal/encabezado-detalle";
import { FormSolicitudSocio } from "@/components/portal/form-solicitud-socio";

export const metadata = { title: "Escribirle a la cooperativa" };

export default async function NuevaSolicitudSocioPage() {
  const perfil = await requireRol("socio");
  const supabase = await createClient();

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, nombre, codigo")
    .eq(...filtroClientePortal(perfil))
    .maybeSingle();

  return (
    <>
      <EncabezadoDetalle
        volverA="/mi-cuenta/mensajes"
        volverTexto="Mensajes"
        titulo="Escribirle a la cooperativa"
        bajada="Te respondemos por acá, como en un chat."
      />
      <div className="chat-fondo">
        {!cliente ? (
          <div className="m-3 hoja flex flex-col items-center gap-2 px-6 py-9 text-center">
            <UserX aria-hidden className="size-9 text-esmalte" strokeWidth={1.8} />
            <p className="text-[1.15rem] font-extrabold">Tu usuario no está unido a tu carpeta</p>
            <p className="text-[1.02rem] leading-snug text-tinta-2">Pedí en Administración que te unan a tu carpeta.</p>
          </div>
        ) : (
          // Ancla del tour guiado (docs/GUIA-TOUR.md).
          <div data-tour="solicitudes-socio-formulario" className="flex flex-1 flex-col p-3">
            <FormSolicitudSocio />
          </div>
        )}
      </div>
    </>
  );
}
