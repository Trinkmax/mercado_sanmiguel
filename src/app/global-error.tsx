"use client";

import "./globals.css";
import { PantallaError } from "@/components/shared/pantalla-error";

/** Error en el layout raíz: reemplaza al "This page couldn't load" de Next (en inglés
 * y sin salida). Tiene que traer su propio <html> y los estilos. */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="es">
      <body className="min-h-svh bg-background text-foreground antialiased">
        <title>Se cortó un momento · Mercado San Miguel</title>
        <PantallaError error={error} reintentar={unstable_retry} />
      </body>
    </html>
  );
}
