"use client";

import { useCallback, useRef, useState } from "react";
import { ChevronDown, FileSpreadsheet } from "lucide-react";
import type { Rol } from "@/lib/auth";
import { labelPeriodo } from "@/lib/format";
import {
  DATASETS,
  LABEL_GRUPO_DATASET,
  datasetsParaRol,
  type DefinicionDataset,
} from "@/lib/exportar/datasets";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const ORDEN_GRUPOS: DefinicionDataset["grupo"][] = ["cobranza", "plata", "gestion", "personal"];

/**
 * "Exportar planillas": lista de planillas .xlsx que el rol puede bajar,
 * agrupadas. Las mensuales llevan el período elegido en Reportes; los
 * catálogos (clientes, circulares, empleados) salen completos.
 * Ancha y en dos columnas cuando hay lugar (así entran todas sin scroll en escritorio);
 * si igual no entran (celular), abajo avisa que hay más para deslizar.
 */
export function MenuExportar({ rol, periodo }: { rol: Rol; periodo: string }) {
  const [abierto, setAbierto] = useState(false);
  const [hayMasAbajo, setHayMasAbajo] = useState(false);
  const lista = useRef<HTMLDivElement | null>(null);

  const medir = useCallback(() => {
    const el = lista.current;
    if (!el) return;
    setHayMasAbajo(el.scrollHeight - el.scrollTop - el.clientHeight > 8);
  }, []);

  // Al abrir (y si cambia el alto disponible) se mide si queda algo fuera de la vista.
  const refLista = useCallback(
    (el: HTMLDivElement | null) => {
      lista.current = el;
      if (!el) return;
      medir();
      const observador = new ResizeObserver(medir);
      observador.observe(el);
      return () => observador.disconnect();
    },
    [medir]
  );

  const disponibles = datasetsParaRol(rol);
  if (disponibles.length === 0) return null;

  const grupos = ORDEN_GRUPOS.map((g) => ({
    grupo: g,
    items: disponibles.filter((d) => DATASETS[d].grupo === g),
  })).filter((g) => g.items.length > 0);

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="min-h-11 px-4 text-sm">
          <FileSpreadsheet className="size-4" strokeWidth={1.9} />
          Exportar planillas
          <ChevronDown className="size-4 opacity-70" strokeWidth={2} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={16}
        // Nunca más ancho que el área de la página: en escritorio no pisa la barra lateral.
        className="max-h-(--radix-popover-content-available-height) w-[min(58rem,calc(100vw-2rem))] gap-0 p-0 lg:w-[min(58rem,calc(100vw-17rem))]"
      >
        <div className="shrink-0 border-b px-4 py-3">
          <p className="font-display text-sm font-bold">
            Planillas de Excel{" "}
            <span className="font-sans font-normal text-muted-foreground">
              ({disponibles.length})
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            Las mensuales salen con {labelPeriodo(periodo)}.
          </p>
        </div>
        <div
          ref={refLista}
          onScroll={medir}
          className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5"
        >
          {/* Columnas que se reparten las planillas; el título de cada grupo nunca queda
              solo al pie de una columna (va pegado a su primera planilla). */}
          <div className="sm:columns-2 sm:gap-2 lg:columns-3">
            {grupos.map(({ grupo, items }) => (
              <div key={grupo} className="pb-1">
                {items.map((d, i) => {
                  const def = DATASETS[d];
                  const params = new URLSearchParams({ dataset: d });
                  if (def.mensual) params.set("periodo", periodo);
                  return (
                    <div key={d} className="break-inside-avoid">
                      {i === 0 ? (
                        <p className="px-2.5 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground">
                          {LABEL_GRUPO_DATASET[grupo]}
                        </p>
                      ) : null}
                      {/* Sin `download`: el server ya responde como adjunto y, si
                          algo falla (400/403), el mensaje se lee en pantalla. */}
                      <a
                        href={`/api/exportar?${params.toString()}`}
                        onClick={() => setAbierto(false)}
                        className="flex min-h-11 items-start gap-3 rounded-md px-2.5 py-2 text-left outline-none hover:bg-muted focus-visible:bg-muted"
                      >
                        <FileSpreadsheet
                          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                          strokeWidth={1.8}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{def.label}</span>
                          <span className="block text-xs/relaxed break-words text-muted-foreground">
                            {def.descripcion}
                          </span>
                        </span>
                      </a>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          {/* Aviso pegado al borde de abajo mientras quede algo sin ver (se superpone, no
              suma alto: la lista no salta al aparecer o desaparecer). */}
          {hayMasAbajo ? (
            <div aria-hidden className="pointer-events-none sticky bottom-0 -mx-1.5 h-0">
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-center bg-linear-to-t from-popover from-50% to-transparent pt-10 pb-2 text-sm font-medium text-foreground">
                <span className="flex items-center gap-1">
                  Hay más planillas abajo
                  <ChevronDown className="size-4" strokeWidth={2} />
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
