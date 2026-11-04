import Link from "next/link";
import { Store } from "lucide-react";

/** Algo que ya no está (una circular dada de baja) o que no es de este socio. */
export default function NoEncontrado() {
  return (
    <>
      <div className="portal-espacio-chico" aria-hidden />
      <div className="portal-suelo !pt-1">
        <div className="hoja flex flex-col items-center gap-3 px-6 py-9 text-center">
          <p className="text-[1.3rem] font-extrabold">Esto ya no está acá</p>
          <p className="max-w-[24rem] text-[1.02rem] leading-snug text-tinta-2 text-pretty">
            Puede ser que lo hayan sacado o que el enlace sea viejo. Tu cuenta sigue igual.
          </p>
          <Link href="/mi-cuenta" className="boton boton-primario w-full">
            <Store aria-hidden strokeWidth={2.3} />
            Volver a Mi cuenta
          </Link>
        </div>
      </div>
    </>
  );
}
