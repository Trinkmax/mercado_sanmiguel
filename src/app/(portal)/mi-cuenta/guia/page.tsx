import { requireRol } from "@/lib/auth";
import { GuiaHub } from "@/components/tour/guia-hub";

export const metadata = { title: "Guía de uso" };

/** La Guía de uso del portal (se llega desde «Ayuda»). */
export default async function GuiaSocioPage() {
  await requireRol("socio");
  return (
    <>
      <div className="portal-espacio-chico !min-h-[5.5rem] !pb-0" aria-hidden />
      <div className="chat-fondo p-4 sm:p-5">
        <GuiaHub />
      </div>
    </>
  );
}
