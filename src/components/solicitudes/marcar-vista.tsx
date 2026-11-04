"use client";

import { useEffect, useRef } from "react";
import { marcarSolicitudVista } from "@/lib/actions/solicitudes";
import { memoria } from "@/lib/tour/memoria";

/**
 * Quien cargó la solicitud la abrió: apaga "Respuesta nueva". Una sola vez al montar (no en
 * el render del server: un prefetch no cuenta como "la vio"). Silencioso: si falla (sin red),
 * el aviso queda y se apaga la próxima vez que la abra.
 */
export function MarcarSolicitudVista({ solicitudId }: { solicitudId: string }) {
  const hecho = useRef(false);
  useEffect(() => {
    if (hecho.current) return;
    hecho.current = true;
    // Mirando la guía no se cambia nada: la respuesta sigue sin leer.
    if (memoria.activo()) return;
    marcarSolicitudVista({ solicitudId }).catch(() => {
      /* silencioso */
    });
  }, [solicitudId]);
  return null;
}
