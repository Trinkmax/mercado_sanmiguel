"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Search, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { EmptyState } from "@/components/shared/empty-state";

export type FilaCliente = {
  id: string;
  codigo: number;
  nombre: string;
  deuda: number;
};

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Buscador para tablet: input grande con autofocus y lista de clientes.
 * El filtro es en memoria sobre la lista ya cargada (son cientos, alcanza).
 */
export function BuscadorClientes({ clientes }: { clientes: FilaCliente[] }) {
  const [busqueda, setBusqueda] = useState("");

  const q = normalizar(busqueda.trim());
  const filtrados =
    q === ""
      ? clientes
      : clientes.filter(
          (c) => normalizar(c.nombre).includes(q) || String(c.codigo).includes(q)
        );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          className="absolute top-1/2 left-4 size-6 -translate-y-1/2 text-muted-foreground"
          strokeWidth={2}
        />
        <Input
          type="search"
          autoFocus
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscá por nombre o número de puesto…"
          aria-label="Buscá por nombre o número de puesto"
          className="h-12 pl-12 text-base md:text-base"
        />
      </div>

      {filtrados.length === 0 ? (
        <EmptyState
          icono={SearchX}
          titulo="No encontramos ese puesto"
          descripcion="Probá con otro nombre o con el número de carpeta."
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {filtrados.map((c) => (
            <li key={c.id}>
              <Link
                href={`/cobranza/${c.id}`}
                className="flex min-h-[3.25rem] items-center gap-3 px-4 py-1.5 transition-colors hover:bg-muted/50 active:bg-muted"
              >
                <span className="w-9 shrink-0 text-right font-display text-base font-bold tabular">
                  {c.codigo}
                </span>
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
                  {c.nombre}
                </span>
                <Money
                  monto={c.deuda}
                  className={cn(
                    "shrink-0 text-sm font-semibold",
                    c.deuda > 0 ? "text-pendiente" : "text-pagado"
                  )}
                />
                <Sello
                  estado={c.deuda > 0 ? "debe" : "al_dia"}
                  className="shrink-0 max-[400px]:hidden"
                />
                <ChevronRight
                  className="size-5 shrink-0 text-muted-foreground"
                  strokeWidth={2}
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
