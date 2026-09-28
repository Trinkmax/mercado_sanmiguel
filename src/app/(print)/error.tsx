"use client";

import { PantallaError } from "@/components/shared/pantalla-error";

/** Error de una pantalla: se muestra dentro del layout (la navegación sigue a mano),
 * se recupera solo si puede y nunca cierra la sesión. */
export default function ErrorPantalla({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <PantallaError error={error} reintentar={unstable_retry} />;
}
