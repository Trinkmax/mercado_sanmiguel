"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus, Search } from "lucide-react";
import type { CategoriaCliente } from "@/lib/segmentos";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ChipCategoria } from "@/components/clientes/chip-categoria";
import { normalizarBusqueda } from "@/components/clientes/segmentos-cliente";

export type ClienteParaMedidor = {
  id: string;
  codigo: number;
  nombre: string;
  apodo: string | null;
  categoria: CategoriaCliente;
};

/** Cuántos resultados se muestran a la vez (con más, que escriba un poco más). */
const MAXIMO = 8;

/**
 * "Agregar un medidor" desde Energía (I1, §4.7: Energía es de Administración para TODAS
 * las categorías): se elige el cliente —puestero o quintero— y se abre su ficha en la
 * pestaña Medidores, donde se carga el número, el lugar del plano y el abono.
 */
export function AgregarMedidor({ clientes }: { clientes: ClienteParaMedidor[] }) {
  const [texto, setTexto] = useState("");
  const buscado = normalizarBusqueda(texto);

  const resultados = useMemo(() => {
    if (!buscado) return [];
    return clientes.filter(
      (c) =>
        normalizarBusqueda(c.nombre).includes(buscado) ||
        (c.apodo ? normalizarBusqueda(c.apodo).includes(buscado) : false) ||
        String(c.codigo) === buscado
    );
  }, [clientes, buscado]);

  return (
    <Dialog onOpenChange={(abierto) => !abierto && setTexto("")}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-11 px-4 text-sm" data-tour="energia-agregar-medidor">
          <Plus className="size-5" strokeWidth={2} />
          Agregar un medidor
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-lg font-semibold">¿A qué cliente le ponés el medidor?</DialogTitle>
          <DialogDescription className="text-base">
            Buscalo y tocalo: se abre su carpeta en Medidores para cargar el número y el lugar.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
            strokeWidth={2}
          />
          <Input
            type="search"
            inputMode="search"
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Nombre, apodo o N° de carpeta"
            aria-label="Buscar cliente"
            className="h-12 pl-11 text-base"
            autoComplete="off"
          />
        </div>
        {!buscado ? (
          <p className="text-sm text-muted-foreground">
            Escribí el nombre, el apodo o el N° de carpeta (puesteros y quinteros).
          </p>
        ) : resultados.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No encontramos a nadie con “{texto.trim()}”. Fijate cómo está escrito o probá con el N° de
            carpeta.
          </p>
        ) : (
          <ul className="max-h-[50vh] divide-y overflow-y-auto rounded-lg border">
            {resultados.slice(0, MAXIMO).map((c) => (
              <li key={c.id}>
                <Link
                  href={`/clientes/${c.id}?tab=medidores`}
                  className="flex min-h-14 items-center gap-3 px-3 py-2 transition-colors hover:bg-accent"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium break-words">{c.nombre}</span>
                    <span className="block text-sm text-muted-foreground">
                      N° {c.codigo}
                      {c.apodo ? ` · “${c.apodo}”` : ""}
                    </span>
                  </span>
                  <ChipCategoria categoria={c.categoria} className="shrink-0" />
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
                </Link>
              </li>
            ))}
            {resultados.length > MAXIMO ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                Hay {resultados.length - MAXIMO} más: escribí un poco más para encontrarlo.
              </li>
            ) : null}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
