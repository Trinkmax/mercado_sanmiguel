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

/** Mes de los movimientos: navega con ?tab=movimientos&mes=YYYY-MM-01. */
export function SelectorMes({ mes }: { mes: string }) {
  const router = useRouter();

  const opciones: string[] = [];
  const actual = periodoActual();
  for (let i = 0; i < 12; i++) opciones.push(sumarMeses(actual, -i));
  if (!opciones.includes(mes)) opciones.push(mes);

  return (
    <Select
      value={mes}
      onValueChange={(v) => router.replace(`/tesoreria?tab=movimientos&mes=${v}`, { scroll: false })}
    >
      <SelectTrigger className="h-11 min-w-48 px-3 text-base" aria-label="Elegí el mes">
        {/* Con el texto puesto: se ve desde que llega la página, sin esperar al JavaScript. */}
        <SelectValue>{labelPeriodo(mes)}</SelectValue>
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
