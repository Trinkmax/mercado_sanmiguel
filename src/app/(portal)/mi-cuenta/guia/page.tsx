import { requireRol } from "@/lib/auth";
import { GuiaHub } from "@/components/tour/guia-hub";

export const metadata = { title: "Guía de uso" };

/** La Guía de uso del portal (se llega desde «Ayuda»). */
export default async function GuiaSocioPage() {
  await requireRol("socio");
  return <GuiaHub />;
}
