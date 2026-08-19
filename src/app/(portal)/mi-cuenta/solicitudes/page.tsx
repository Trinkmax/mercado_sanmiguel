import { redirect } from "next/navigation";

/** La lista de solicitudes del socio vive en /mi-cuenta ("Tus solicitudes"). */
export default function SolicitudesSocioIndex() {
  redirect("/mi-cuenta");
}
