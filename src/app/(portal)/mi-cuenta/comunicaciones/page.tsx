import { redirect } from "next/navigation";

/** Las comunicaciones del socio ahora viven en Mensajes, junto con sus consultas. */
export default function ComunicacionesSocioIndex() {
  redirect("/mi-cuenta/mensajes");
}
