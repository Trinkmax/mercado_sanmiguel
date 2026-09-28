"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Pantalla de error propia (reemplaza el "This page couldn't load" en inglés).
 * Casi todos los errores en uso real son pasajeros: se cortó internet un momento,
 * Supabase tardó, o se publicó una versión nueva y la pestaña tenía piezas viejas.
 * Por eso: primero se recupera sola (recarga o reintento automático), y si no puede,
 * ofrece un solo botón grande. Nunca cierra la sesión.
 */

/** Hora del último reintento automático (a nivel módulo: sobrevive a los remontajes,
 * así un error que persiste no queda reintentando en bucle). */
let ultimoAutomatico = 0;
const CLAVE_RECARGA = "msm-recarga-automatica";
const REINTENTO_CADA_MS = 20_000;
const RECARGA_CADA_MS = 30_000;

/** Errores que se arreglan con una recarga completa: versión nueva publicada o red cortada. */
function seArreglaRecargando(error: Error): boolean {
  const texto = `${error?.name ?? ""} ${error?.message ?? ""}`;
  return /ChunkLoadError|Loading (CSS )?chunk|dynamically imported module|Failed to find Server Action|Server Action .*(not found|was not found)|Failed to fetch|NetworkError|Load failed|network error/i.test(
    texto
  );
}

function ultimaRecarga(): number {
  try {
    return Number(sessionStorage.getItem(CLAVE_RECARGA) ?? 0);
  } catch {
    return 0; // sin sessionStorage (modo privado): se permite igual
  }
}

function puedeRecargarSola(error: Error, ahora: number): boolean {
  return seArreglaRecargando(error) && ahora - ultimaRecarga() > RECARGA_CADA_MS;
}

export function PantallaError({
  error,
  reintentar,
}: {
  error: Error & { digest?: string };
  /** `unstable_retry` del error boundary: vuelve a pedir y dibujar la pantalla. */
  reintentar: () => void;
}) {
  // Mientras se recupera sola se muestra "Volviendo a cargar…"; si no puede, el botón.
  const [esperando, setEsperando] = useState(() => {
    const ahora = Date.now();
    return puedeRecargarSola(error, ahora) || ahora - ultimoAutomatico > REINTENTO_CADA_MS;
  });
  const [recargando, setRecargando] = useState(false);

  useEffect(() => {
    console.error(error);
    const ahora = Date.now();

    // 1) Versión nueva o red cortada: recarga completa (como máximo una cada 30 s).
    if (puedeRecargarSola(error, ahora)) {
      try {
        sessionStorage.setItem(CLAVE_RECARGA, String(ahora));
      } catch {}
      window.location.reload();
      return;
    }

    // 2) Cualquier otro error: un reintento silencioso (un corte corto ni se ve).
    if (ahora - ultimoAutomatico > REINTENTO_CADA_MS) {
      ultimoAutomatico = ahora;
      const reintento = setTimeout(() => reintentar(), 1500);
      // Si después de unos segundos sigue acá, se muestra el botón.
      const plazo = setTimeout(() => setEsperando(false), 6000);
      return () => {
        clearTimeout(reintento);
        clearTimeout(plazo);
      };
    }

    const plazo = setTimeout(() => setEsperando(false), 0);
    return () => clearTimeout(plazo);
  }, [error, reintentar]);

  function volverACargar() {
    setRecargando(true);
    // Recarga completa: trae la versión más nueva y vuelve a leer la sesión (que sigue abierta).
    window.location.reload();
  }

  const ocupado = esperando || recargando;

  return (
    <div className="flex min-h-[60svh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-6 text-center shadow-sm sm:p-8">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <WifiOff className="size-7" strokeWidth={2} />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {ocupado ? "Volviendo a cargar…" : "Se cortó un momento"}
          </h1>
          <p className="text-balance text-muted-foreground">
            No perdiste nada y tu sesión sigue abierta.
            {ocupado ? " Esperá un segundo." : " Tocá el botón para volver a cargar la pantalla."}
          </p>
        </div>
        <Button
          size="lg"
          className="h-12 w-full gap-2 text-base font-semibold"
          onClick={volverACargar}
          disabled={recargando}
        >
          <RefreshCw className={cn("size-5", ocupado && "animate-spin")} strokeWidth={2} />
          Volver a cargar
        </Button>
        <Link
          href="/"
          prefetch={false}
          className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
        >
          Ir al inicio
        </Link>
        {error?.digest ? (
          <p className="text-xs text-muted-foreground">Código para soporte: {error.digest}</p>
        ) : null}
      </div>
    </div>
  );
}
