"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogIn } from "lucide-react";
import { aceptarTerminos } from "@/lib/actions/terminos";
import { Spinner } from "@/components/ui/spinner";
import { AvisoError } from "@/components/comunicaciones/aviso-error";
import { BotonSalir } from "./boton-salir";
import { llamarAccion } from "@/lib/llamar-accion";

/**
 * La primera pantalla que ve cada socio: la bienvenida y los términos, enteros y de corrido.
 * Bloquea el portal hasta que los acepte. Tocar el botón es aceptar: lo dice bien claro y no
 * hace falta marcar además una casilla.
 */
export function AceptarTerminos({
  terminosId,
  titulo,
  contenido,
  version,
  nombre,
}: {
  terminosId: string;
  titulo: string;
  contenido: string;
  version: number;
  nombre: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function confirmar() {
    setError(null);
    startTransition(async () => {
      const res = await llamarAccion(() => aceptarTerminos({ terminosId, acepta: true }));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("¡Listo! Ya podés ver tu cuenta.");
      router.refresh();
    });
  }

  return (
    <>
      <div className="portal-espacio-chico !min-h-[11rem]">
        <h1 className="portal-titulo">{nombre ? `¡Hola, ${nombre}!` : "¡Hola!"}</h1>
        <p className="portal-bajada">
          {version > 1
            ? `Hay una versión nueva de los términos (v${version}). Para seguir, hay que aceptarla.`
            : "Este es tu portal del mercado. Antes de entrar, leé esto una sola vez: la próxima entrás directo."}
        </p>
      </div>
      <div className="portal-suelo !gap-3 !pt-1">
        <section className="hoja flex flex-col gap-3 px-4 py-4">
          <h2 className="text-[1.3rem] leading-tight font-extrabold [font-stretch:92%] text-balance">{titulo}</h2>
          <p className="text-[1.05rem] leading-relaxed whitespace-pre-line">{contenido}</p>
        </section>
        {error ? <AvisoError mensaje={error} /> : null}
        <button type="button" disabled={pendiente} onClick={confirmar} className="boton boton-claro min-h-[3.9rem] w-full !text-[1.18rem]">
          {pendiente ? <Spinner className="size-5" /> : <LogIn aria-hidden strokeWidth={2.3} />}
          Leí y acepto: quiero entrar
        </button>
        <BotonSalir />
      </div>
    </>
  );
}
