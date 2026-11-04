import { redirect } from "next/navigation";

/** Las circulares del socio viven en Mensajes. */
export default function CircularesSocioIndex() {
  redirect("/mi-cuenta/mensajes");
}
