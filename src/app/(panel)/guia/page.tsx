import { requireStaff } from "@/lib/auth";
import { GuiaHub } from "@/components/tour/guia-hub";

export const metadata = { title: "Guía de uso" };

/** La Guía de uso del rol (se llega desde «Ayuda»). */
export default async function GuiaPage() {
  await requireStaff();
  return <GuiaHub />;
}
