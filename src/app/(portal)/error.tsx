"use client";

import { PantallaError } from "@/components/shared/pantalla-error";

/** Error de una pantalla: se muestra dentro del portal (la navegación sigue a mano),
 * se recupera solo si puede y nunca cierra la sesión. */
export default function ErrorPantalla({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <>
      <div className="portal-espacio-chico !min-h-[4.5rem] !p-0" aria-hidden />
      <PantallaError error={error} reintentar={unstable_retry} />
    </>
  );
}
