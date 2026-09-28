"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

/**
 * Búsqueda por nombre, apodo, N° de carpeta o N° de puesto.
 * Actualiza la URL (?q=…) con debounce y conserva los chips activos (?seg, ?estado):
 * el listado filtra en el servidor.
 */
export function BuscadorClientes({
  inicial,
  seg,
  estado,
  placeholder = "Buscá por nombre, apodo, N° de carpeta o de puesto",
}: {
  inicial: string;
  seg?: string | null;
  estado?: string | null;
  placeholder?: string;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(inicial);
  // "Ver todos" / "Sacar filtros" vacían la búsqueda desde un link: el campo acompaña.
  const [inicialPrevio, setInicialPrevio] = useState(inicial);
  if (inicial !== inicialPrevio) {
    setInicialPrevio(inicial);
    if (inicial === "") setValor("");
  }
  // Mientras la URL no refleja lo escrito, el listado todavía está buscando.
  const buscando = valor.trim() !== inicial.trim();

  useEffect(() => {
    // La URL ya refleja lo escrito (primer render, o se tocó un chip): no hay nada que hacer.
    if (valor.trim() === inicial.trim()) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (valor.trim()) params.set("q", valor.trim());
      if (seg) params.set("seg", seg);
      if (estado) params.set("estado", estado);
      const qs = params.toString();
      router.replace(qs ? `/clientes?${qs}` : "/clientes", { scroll: false });
    }, 350);
    return () => clearTimeout(timer);
  }, [valor, inicial, seg, estado, router]);

  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
        strokeWidth={2}
      />
      <Input
        type="search"
        inputMode="search"
        enterKeyHint="search"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-12 pr-12 pl-11 text-base [&::-webkit-search-cancel-button]:hidden"
      />
      {buscando ? (
        <Spinner className="absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground" />
      ) : valor ? (
        <button
          type="button"
          onClick={() => setValor("")}
          className="absolute top-1/2 right-1 flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          aria-label="Borrar la búsqueda"
        >
          <X className="size-4" strokeWidth={2.2} />
        </button>
      ) : null}
    </div>
  );
}
