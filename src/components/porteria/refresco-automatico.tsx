"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Mantiene los totales de la garita al día cuando hay más de un portero (o el Jefe anula algo):
 * cada tanto vuelve a pedir los datos del servidor, solo con la pantalla visible. No pierde lo
 * que se está cargando (el estado de los formularios se conserva en un refresh).
 */
export function RefrescoAutomatico({ segundos = 60 }: { segundos?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, segundos * 1000);
    const alVolver = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [router, segundos]);

  return null;
}
