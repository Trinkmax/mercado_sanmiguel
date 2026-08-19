"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * Barra de acciones de los documentos imprimibles (no sale en el papel).
 *
 * `autoImprimir`: "impresión directa" — abre el diálogo de impresión apenas
 * carga el documento (lo activa Configuración → Impresión directa). En un
 * Chrome de kiosco (`--kiosk-printing`) el diálogo se saltea y va derecho a la
 * impresora predeterminada: ese es el "driver" recomendado para la tablet de
 * administración. Se dispara una sola vez por carga.
 */
export function BotonImprimir({
  volverA,
  autoImprimir = false,
  etiquetaImprimir = "Imprimir / Guardar PDF",
}: {
  volverA?: string;
  autoImprimir?: boolean;
  etiquetaImprimir?: string;
}) {
  const router = useRouter();
  const disparado = useRef(false);

  useEffect(() => {
    if (!autoImprimir || disparado.current) return;
    disparado.current = true;
    // Esperar un frame para que las fuentes y el layout estén listos.
    const t = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(t);
  }, [autoImprimir]);

  return (
    <div className="no-print mb-6 flex items-center justify-between gap-3">
      <Button
        variant="outline"
        className="min-h-11"
        onClick={() => (volverA ? router.push(volverA) : router.back())}
      >
        <ArrowLeft className="size-4" />
        Volver
      </Button>
      <Button onClick={() => window.print()} size="lg" className="min-h-12 font-semibold">
        <Printer className="size-5" />
        {etiquetaImprimir}
      </Button>
    </div>
  );
}
