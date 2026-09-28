"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Mantiene la sesión viva mientras la app está abierta (tablet en el mostrador todo el
 * día, pestaña que vuelve después de horas). El cliente de Supabase del navegador renueva
 * el token solo, antes de que venza, y al volver a la pestaña se renueva enseguida: así
 * el servidor siempre recibe una sesión vigente y nadie queda afuera por inactividad.
 * Si la sesión se cerró de verdad (Salir en este dispositivo, acceso quitado), se le pide
 * al servidor que decida adónde ir: nada de pantallas rotas.
 */
export function SesionViva() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "SIGNED_OUT") router.refresh();
    });

    // Al volver a la pestaña (o al desbloquear la tablet) se renueva la sesión en el acto.
    const alVolver = () => {
      if (document.visibilityState === "visible") void supabase.auth.getSession();
    };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alVolver);

    return () => {
      data.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", alVolver);
    };
  }, [router]);

  return null;
}
