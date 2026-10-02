"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  etiquetaConcepto,
  hrefListado,
  type OpcionConcepto,
} from "@/components/clientes/segmentos-cliente";

/** Radix no acepta "" como valor de un ítem: «Todos» va con este. */
const TODOS = "todos";

/**
 * Filtro «Concepto» del listado (?concepto=EXCO): un desplegable con los conceptos mensuales
 * y cuántos los tienen. Se combina con la búsqueda y los chips (AND); «Todos» lo saca.
 * Con un concepto elegido se pinta como un chip marcado.
 */
export function FiltroConcepto({
  opciones,
  concepto,
  q,
  seg,
  estado,
}: {
  opciones: OpcionConcepto[];
  concepto: string | null;
  q: string;
  seg: string | null;
  estado: string | null;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  // Lo elegido se ve al toque, mientras el listado nuevo llega del servidor.
  const [elegido, setElegido] = useOptimistic(concepto);
  const actual = opciones.find((o) => o.codigo === elegido) ?? null;

  function elegir(valor: string) {
    const nuevo = valor === TODOS ? null : valor;
    if (nuevo === concepto) return;
    startTransition(() => {
      setElegido(nuevo);
      router.replace(hrefListado({ q, seg, estado, concepto: nuevo }), { scroll: false });
    });
  }

  return (
    <Select value={elegido ?? TODOS} onValueChange={elegir}>
      <SelectTrigger
        id="filtro-concepto"
        aria-busy={pendiente || undefined}
        className={cn(
          // Como los chips: píldora de 44 px (min-h: el alto fijo del trigger gana por especificidad);
          // en celular ocupa el ancho, sin pasarse.
          "min-h-11 w-full max-w-md min-w-0 gap-2 rounded-full px-4 text-sm font-medium pointer-coarse:min-h-[44px] sm:w-auto sm:min-w-64",
          actual
            ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-primary dark:hover:bg-primary/90 [&_svg]:text-primary-foreground/85"
            : "border-border bg-card hover:bg-accent dark:bg-card dark:hover:bg-accent",
          pendiente && "opacity-80"
        )}
      >
        {/* Con el texto puesto: se ve desde que llega la página, sin esperar al JavaScript. */}
        <SelectValue>
          {actual ? (
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate">{etiquetaConcepto(actual)}</span>
              <span className="tabular shrink-0 text-xs font-semibold text-primary-foreground/85">
                {actual.cantidad}
              </span>
            </span>
          ) : (
            "Todos"
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="start" className="max-w-[calc(100vw-2rem)]">
        <SelectItem value={TODOS} className="min-h-11 pr-8 text-sm">
          Todos
        </SelectItem>
        {opciones.map((o) => (
          <SelectItem
            key={o.codigo}
            value={o.codigo}
            className="min-h-11 pr-8 text-sm *:[span]:last:min-w-0 *:[span]:last:flex-1"
          >
            <span className="min-w-0 flex-1 whitespace-normal">{etiquetaConcepto(o)}</span>
            <span className="tabular shrink-0 text-xs font-semibold text-muted-foreground">{o.cantidad}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
