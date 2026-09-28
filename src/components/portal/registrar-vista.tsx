"use client";

import { useEffect, useRef } from "react";
import { marcarRegistroVisto } from "@/lib/actions/sanciones";
import { registrarVistaCircular } from "@/lib/actions/circulares";

/**
 * Registra que el socio abrió algo, una sola vez al montar (no en el render del server:
 * un prefetch no cuenta como "lo vio"). Silencioso: si falla, no molesta al socio.
 * - registro: marcar_registro_visto (primera vista + apaga "Respuesta nueva"), SIEMPRE.
 * - circular informativa: "la vio" (insert en circular_recepciones).
 */
export function RegistrarVista({
  tipo,
  id,
}: {
  tipo: "registro" | "circular";
  id: string;
}) {
  const hecho = useRef(false);
  useEffect(() => {
    if (hecho.current) return;
    hecho.current = true;
    const accion =
      tipo === "registro"
        ? marcarRegistroVisto({ registroId: id })
        : registrarVistaCircular({ circularId: id });
    accion.catch(() => {
      /* silencioso */
    });
  }, [tipo, id]);
  return null;
}
