"use client";

import { useEffect, useRef } from "react";
import { formatFechaTS, formatSoloHora } from "@/lib/format";

/**
 * "Impreso el 29/09/2026, 09:12 por Marta": la hora en que de verdad sale la hoja. Solo se ve
 * en el papel (en pantalla, abrir la página no es imprimir) y se pone al momento de imprimir
 * (evento beforeprint, también con "Imprimir" y la impresión directa).
 */
export function FechaImpresion({ por }: { por: string }) {
  const hora = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const poner = () => {
      if (!hora.current) return;
      const ahora = new Date().toISOString();
      hora.current.textContent = `${formatFechaTS(ahora)}, ${formatSoloHora(ahora)}`;
    };
    poner();
    window.addEventListener("beforeprint", poner);
    return () => window.removeEventListener("beforeprint", poner);
  }, []);

  return (
    <span className="hidden print:inline">
      Impreso el <span ref={hora} /> por {por}
    </span>
  );
}
