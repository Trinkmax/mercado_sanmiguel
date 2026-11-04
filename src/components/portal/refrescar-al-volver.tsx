"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/** Cada cuánto, como máximo, se vuelve a pedir la pantalla al volver a la pestaña. */
const CADA_MS = 60_000;

/**
 * «Apenas te anotan un pago, aparece acá»: el socio deja el portal abierto, paga en Administración
 * y vuelve al celular. Al volver a la pestaña se pide todo de nuevo (el cartel, el plano, el número
 * de Mensajes). Sin red no se pide nada: se queda con lo que ya ve.
 */
export function RefrescarAlVolver() {
  const router = useRouter();
  const ultima = useRef(0);

  useEffect(() => {
    ultima.current = Date.now();
    const alVolver = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      if (Date.now() - ultima.current < CADA_MS) return;
      ultima.current = Date.now();
      router.refresh();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [router]);

  return null;
}
