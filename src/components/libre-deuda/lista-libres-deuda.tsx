"use client";

import { useState } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Codigo } from "@/components/shared/codigo";

export type FilaLibreDeuda = {
  clienteId: string;
  codigo: number;
  nombre: string;
  /** "Puesto 58 · Cochera 3" o la categoría (quinteros). */
  lugares: string;
  /** Cuándo terminó de pagar el mes ("12/11"), si se sabe. */
  completo: string | null;
  /** Cuándo se imprimió ("12/11"), o null si todavía no. */
  impreso: string | null;
  veces: number;
};

/**
 * Los libres deuda del mes para elegir e imprimir juntos. Arrancan marcados los que todavía
 * no se imprimieron; los ya impresos se pueden volver a marcar para reimprimir.
 */
export function ListaLibresDeuda({ filas }: { filas: FilaLibreDeuda[] }) {
  const pendientes = filas.filter((f) => !f.impreso);
  const impresos = filas.filter((f) => f.impreso);
  const [seleccion, setSeleccion] = useState<Set<string>>(() => new Set(pendientes.map((f) => f.clienteId)));

  // En el orden de la lista: así salen impresos.
  const elegidos = filas.filter((f) => seleccion.has(f.clienteId));
  const href = `/libre-deuda/lote?clientes=${elegidos.map((f) => f.clienteId).join(",")}`;

  const alternar = (ids: string[], marcar: boolean) =>
    setSeleccion((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (marcar) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl border bg-card px-4 py-3">
        <p className="text-base font-medium">
          {elegidos.length === 0
            ? "Marcá los que querés imprimir"
            : elegidos.length === 1
              ? "1 libre deuda elegido"
              : `${elegidos.length} libres deuda elegidos`}
        </p>
        {elegidos.length > 0 ? (
          <Button asChild size="lg" className="h-auto min-h-12 px-5 py-2 text-base font-semibold whitespace-normal max-sm:w-full">
            <Link href={href} data-tour="libres-imprimir">
              <Printer className="size-5" />
              {elegidos.length === 1 ? "Imprimir libre deuda" : `Imprimir ${elegidos.length} libres deuda`}
            </Link>
          </Button>
        ) : (
          <Button size="lg" disabled className="min-h-12 px-5 text-base font-semibold" data-tour="libres-imprimir">
            <Printer className="size-5" />
            Imprimir
          </Button>
        )}
      </div>

      {pendientes.length > 0 ? (
        <Grupo
          titulo="Para imprimir"
          filas={pendientes}
          seleccion={seleccion}
          alternar={alternar}
          detalle={(f) => (f.completo ? `Pagó todo el ${f.completo}` : "Pagó todo el mes")}
          tour="libres-para-imprimir"
        />
      ) : null}

      {impresos.length > 0 ? (
        <Grupo
          titulo="Ya impresos"
          filas={impresos}
          seleccion={seleccion}
          alternar={alternar}
          detalle={(f) => `Impreso el ${f.impreso}${f.veces > 1 ? ` (${f.veces} veces)` : ""}`}
          tour="libres-impresos"
        />
      ) : null}
    </div>
  );
}

function Grupo({
  titulo,
  filas,
  seleccion,
  alternar,
  detalle,
  tour,
}: {
  titulo: string;
  filas: FilaLibreDeuda[];
  seleccion: Set<string>;
  alternar: (ids: string[], marcar: boolean) => void;
  detalle: (f: FilaLibreDeuda) => string;
  tour: string;
}) {
  const ids = filas.map((f) => f.clienteId);
  const marcados = ids.filter((id) => seleccion.has(id)).length;
  const todos = marcados === ids.length;
  return (
    <section className="space-y-2" data-tour={tour}>
      <div className="overflow-hidden rounded-xl border bg-card">
        <label className="flex min-h-11 cursor-pointer items-center gap-4 border-b bg-muted/40 px-4 py-2 pointer-coarse:min-h-[44px]">
          <span className="inline-flex size-11 shrink-0 items-center justify-center pointer-coarse:size-[44px]">
            <Checkbox
              checked={todos ? true : marcados > 0 ? "indeterminate" : false}
              onCheckedChange={(v) => alternar(ids, v === true)}
              aria-label={`Marcar todos: ${titulo.toLowerCase()}`}
              className="size-6 [&_svg]:size-4"
            />
          </span>
          <span className="font-display text-lg font-semibold">
            {titulo} <span className="tabular text-base font-medium text-muted-foreground">{filas.length}</span>
          </span>
        </label>
        <ul className="divide-y">
          {filas.map((f) => {
            const marcada = seleccion.has(f.clienteId);
            return (
              <li key={f.clienteId} className={cn(marcada && "bg-accent/50")}>
                <label className="flex min-h-16 cursor-pointer items-center gap-4 px-4 py-2.5">
                  <span className="inline-flex size-11 shrink-0 items-center justify-center pointer-coarse:size-[44px]">
                    <Checkbox
                      checked={marcada}
                      onCheckedChange={(v) => alternar([f.clienteId], v === true)}
                      aria-label={`Imprimir el libre deuda de ${f.nombre}`}
                      className="size-6 [&_svg]:size-4"
                    />
                  </span>
                  <Codigo codigo={String(f.codigo)} className="shrink-0" />
                  <span className="min-w-0 flex-1 space-y-0.5">
                    <span className="block text-base leading-snug font-medium break-words">{f.nombre}</span>
                    <span className="block text-sm leading-snug break-words text-muted-foreground">
                      {[f.lugares, detalle(f)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
