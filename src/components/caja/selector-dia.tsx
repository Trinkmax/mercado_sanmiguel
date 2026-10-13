"use client";

import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { hoyISO } from "@/lib/format";
import { Input } from "@/components/ui/input";

/**
 * Ir a la caja de otro día (?fecha=), sin perder la pestaña (?tipo=). Sirve para mirar un día
 * viejo y para la carga atrasada: si ese día no tiene caja, la pantalla ofrece abrirla.
 */
export function SelectorDiaCaja({ fecha, tipo }: { fecha: string; tipo?: "administracion" | "guardia" }) {
  const router = useRouter();
  const hoy = hoyISO();

  function ir(valor: string) {
    if (!valor || valor > hoy) return;
    const params = new URLSearchParams();
    if (valor !== hoy) params.set("fecha", valor);
    if (tipo) params.set("tipo", tipo);
    const qs = params.toString();
    router.push(qs ? `/caja?${qs}` : "/caja");
  }

  return (
    <div className="relative" data-tour="caja-otro-dia-selector">
      <label htmlFor="fecha-caja" className="sr-only">
        Ver o cargar la caja de otro día
      </label>
      <CalendarDays
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        strokeWidth={2}
      />
      <Input
        id="fecha-caja"
        type="date"
        value={fecha}
        max={hoy}
        onChange={(e) => ir(e.target.value)}
        title="Ver o cargar la caja de otro día"
        className="h-11 w-44 pl-9 text-base tabular md:text-base"
      />
    </div>
  );
}
