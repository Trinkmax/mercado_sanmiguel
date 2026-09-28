"use client";

import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { hoyISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Para el Líder: ver la garita de otro día (?fecha=), sin perder la pestaña (?vista=). */
export function SelectorFecha({ fecha }: { fecha: string }) {
  const router = useRouter();
  const hoy = hoyISO();

  function ir(valor: string) {
    if (!valor) return;
    const params = new URLSearchParams();
    try {
      const vista = new URL(window.location.href).searchParams.get("vista");
      if (vista) params.set("vista", vista);
    } catch {
      // sin URL: se pierde solo la pestaña
    }
    if (valor !== hoy) params.set("fecha", valor);
    const qs = params.toString();
    router.push(qs ? `/porteria?${qs}` : "/porteria");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="fecha-porteria" className="sr-only">
        Ver la garita de otro día
      </label>
      <div className="relative">
        <CalendarDays
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={2}
        />
        <Input
          id="fecha-porteria"
          type="date"
          value={fecha}
          max={hoy}
          onChange={(e) => ir(e.target.value)}
          className="h-12 w-44 pl-9 text-base tabular md:text-base"
        />
      </div>
      {fecha !== hoy ? (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-12 px-4 text-base"
          onClick={() => ir(hoy)}
        >
          Volver a hoy
        </Button>
      ) : null}
    </div>
  );
}
