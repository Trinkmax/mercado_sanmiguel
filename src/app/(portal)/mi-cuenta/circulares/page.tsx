import { redirect } from "next/navigation";

/** Las circulares del socio viven en Comunicaciones → Circulares. */
export default function CircularesSocioIndex() {
  redirect("/mi-cuenta/comunicaciones?tab=circulares");
}
