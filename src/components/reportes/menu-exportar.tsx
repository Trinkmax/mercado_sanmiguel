"use client";

import { useState } from "react";
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
 */
export function MenuExportar({ rol, periodo }: { rol: Rol; periodo: string }) {
  const [abierto, setAbierto] = useState(false);
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
      <PopoverContent align="end" className="w-80 gap-0 p-0">
        <div className="border-b px-4 py-3">
          <p className="font-display text-sm font-bold">Planillas de Excel</p>
          <p className="text-xs text-muted-foreground">
            Las mensuales salen con {labelPeriodo(periodo)}.
          </p>
        </div>
        <div className="max-h-[60svh] overflow-y-auto p-1.5">
          {grupos.map(({ grupo, items }) => (
            <div key={grupo} className="py-1">
              <p className="px-2.5 pt-1 pb-1 text-[0.7rem] font-semibold tracking-wide text-muted-foreground">
                {LABEL_GRUPO_DATASET[grupo]}
              </p>
              {items.map((d) => {
                const def = DATASETS[d];
                const params = new URLSearchParams({ dataset: d });
                if (def.mensual) params.set("periodo", periodo);
                return (
                  // Sin `download`: el server ya responde como adjunto y, si
                  // algo falla (400/403), el mensaje se lee en pantalla.
                  <a
                    key={d}
                    href={`/api/exportar?${params.toString()}`}
                    onClick={() => setAbierto(false)}
                    className="flex min-h-11 items-center gap-3 rounded-md px-2.5 py-1.5 text-left outline-none hover:bg-muted focus-visible:bg-muted"
                  >
                    <FileSpreadsheet
                      className="size-4 shrink-0 text-muted-foreground"
                      strokeWidth={1.8}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{def.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {def.descripcion}
                      </span>
                    </span>
                  </a>
                );
              })}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
