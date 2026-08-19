"use client";

import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { hoyISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Para el Líder y Administración: ver los ingresos de otro día (?fecha=). */
export function SelectorFecha({ fecha }: { fecha: string }) {
  const router = useRouter();
  const hoy = hoyISO();

  function ir(valor: string) {
    if (!valor) return;
    router.push(valor === hoy ? "/porteria" : `/porteria?fecha=${valor}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="fecha-ingresos" className="sr-only">
        Ver ingresos del día
      </label>
      <div className="relative">
        <CalendarDays
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={2}
        />
        <Input
          id="fecha-ingresos"
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
