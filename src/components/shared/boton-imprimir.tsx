"use client";

import { useCallback, useEffect, useRef } from "react";
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
 *
 * `alImprimir`: lo que se anota al imprimir (p. ej. el libre deuda como impreso). Corre una
 * sola vez por carga, aunque se vuelva a tocar «Imprimir».
 */
export function BotonImprimir({
  volverA,
  autoImprimir = false,
  etiquetaImprimir = "Imprimir / Guardar PDF",
  alImprimir,
}: {
  volverA?: string;
  autoImprimir?: boolean;
  etiquetaImprimir?: string;
  alImprimir?: () => Promise<unknown>;
}) {
  const router = useRouter();
  const disparado = useRef(false);
  const anotado = useRef(false);

  const imprimir = useCallback(() => {
    if (alImprimir && !anotado.current) {
      anotado.current = true;
      // Sale antes del diálogo de impresión (que frena la página): si falla, no se reintenta
      // solo, pero el documento se imprime igual.
      alImprimir().catch(() => {
        anotado.current = false;
      });
    }
    window.print();
  }, [alImprimir]);

  useEffect(() => {
    if (!autoImprimir || disparado.current) return;
    disparado.current = true;
    // Esperar un frame para que las fuentes y el layout estén listos.
    const t = window.setTimeout(imprimir, 350);
    return () => window.clearTimeout(t);
  }, [autoImprimir, imprimir]);

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
      <Button onClick={imprimir} size="lg" className="min-h-12 font-semibold">
        <Printer className="size-5" />
        {etiquetaImprimir}
      </Button>
    </div>
  );
}
