import { redirect } from "next/navigation";

/** Las consultas y pedidos del socio viven en Mensajes. */
export default function SolicitudesSocioIndex() {
  redirect("/mi-cuenta/mensajes");
}
