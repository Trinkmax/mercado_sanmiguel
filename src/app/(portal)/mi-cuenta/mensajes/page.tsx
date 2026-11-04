import { requireRol } from "@/lib/auth";
import {
  getCircularesSocio,
  getRegistrosSocio,
  getSolicitudesConRespuesta,
  getSolicitudesSocio,
} from "@/components/portal/datos-portal";
import { PantallaMensajes } from "@/components/portal/pantallas/pantalla-mensajes";

export const metadata = { title: "Mensajes" };

export default async function MensajesPage() {
  const perfil = await requireRol("socio");
  const [circulares, registros, solicitudes, respondidas] = await Promise.all([
    getCircularesSocio(perfil.user_id),
    getRegistrosSocio(perfil.user_id),
    getSolicitudesSocio(perfil.user_id),
    getSolicitudesConRespuesta(),
  ]);
  return (
    <PantallaMensajes
      circulares={circulares}
      registros={registros}
      solicitudes={solicitudes}
      respondidas={respondidas}
    />
  );
}
