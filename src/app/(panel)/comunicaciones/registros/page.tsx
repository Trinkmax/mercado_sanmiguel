import { redirect } from "next/navigation";

/** Los registros viven en las pestañas de Comunicaciones (Notificaciones · Apercibimientos · Sanciones). */
export default function RegistrosIndex() {
  redirect("/comunicaciones?tab=notificaciones");
}
