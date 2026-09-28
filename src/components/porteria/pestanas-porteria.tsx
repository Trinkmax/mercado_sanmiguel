"use client";

import { useState } from "react";
import { Truck, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type VistaPorteria = "canon" | "personal";

/**
 * Las dos tareas de la garita en pestañas grandes con el dato vivo en el rótulo
 * ("Canon de transporte · $98.000" · "Personal · 3 adentro"). La pestaña queda en la URL
 * (?vista=) sin recargar, así "volver" o recargar deja al portero donde estaba.
 */
export function PestanasPorteria({
  vistaInicial,
  resumenCanon,
  resumenPersonal,
  canon,
  personal,
}: {
  vistaInicial: VistaPorteria;
  /** "$98.000" */
  resumenCanon: string;
  /** "3 adentro" */
  resumenPersonal: string;
  canon: React.ReactNode;
  personal: React.ReactNode;
}) {
  const [vista, setVista] = useState<VistaPorteria>(vistaInicial);

  function cambiar(v: string) {
    const nueva: VistaPorteria = v === "personal" ? "personal" : "canon";
    setVista(nueva);
    try {
      const url = new URL(window.location.href);
      if (nueva === "canon") url.searchParams.delete("vista");
      else url.searchParams.set("vista", nueva);
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    } catch {
      // Sin URL no pasa nada: la pestaña igual cambia.
    }
  }

  return (
    <Tabs value={vista} onValueChange={cambiar} className="gap-6">
      <TabsList className="grid h-auto! w-full grid-cols-2 gap-1 p-1 sm:w-fit sm:min-w-[32rem]">
        <TabsTrigger
          value="canon"
          className="min-h-14 flex-col gap-0 px-4 py-2 text-base font-semibold whitespace-normal sm:flex-row sm:gap-2"
        >
          <span className="inline-flex items-center gap-2">
            <Truck className="size-5" strokeWidth={2} />
            Canon de transporte
          </span>
          <span className="font-display text-base font-bold tabular sm:before:mr-2 sm:before:content-['·']">
            {resumenCanon}
          </span>
        </TabsTrigger>
        <TabsTrigger
          value="personal"
          className="min-h-14 flex-col gap-0 px-4 py-2 text-base font-semibold whitespace-normal sm:flex-row sm:gap-2"
        >
          <span className="inline-flex items-center gap-2">
            <Users className="size-5" strokeWidth={2} />
            Personal
          </span>
          <span className="font-display text-base font-bold tabular sm:before:mr-2 sm:before:content-['·']">
            {resumenPersonal}
          </span>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="canon" forceMount className="text-base data-[state=inactive]:hidden">
        {canon}
      </TabsContent>
      <TabsContent value="personal" forceMount className="text-base data-[state=inactive]:hidden">
        {personal}
      </TabsContent>
    </Tabs>
  );
}
