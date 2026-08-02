"use client";

import { useRouter } from "next/navigation";
import { labelPeriodo, periodoActual, sumarMeses } from "@/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Selector de mes para los movimientos bancarios: navega con ?mes=YYYY-MM-01. */
export function SelectorMes({ mes }: { mes: string }) {
  const router = useRouter();

  const opciones: string[] = [];
  const actual = periodoActual();
  for (let i = 0; i < 12; i++) {
    opciones.push(sumarMeses(actual, -i));
  }
  // Si el mes elegido no está en la lista (link viejo), lo sumamos igual.
  if (!opciones.includes(mes)) opciones.push(mes);

  return (
    <Select
      value={mes}
      onValueChange={(v) => router.replace(`/tesoreria?mes=${v}`, { scroll: false })}
    >
      <SelectTrigger
        className="h-11 min-w-44 px-3 text-base"
        aria-label="Elegí el mes"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {opciones.map((p) => (
          <SelectItem key={p} value={p} className="min-h-11 text-base">
            {labelPeriodo(p)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
