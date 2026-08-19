"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * Búsqueda por nombre, apodo o número de carpeta.
 * Actualiza la URL (?q=…) con debounce y conserva el filtro de tipo activo:
 * el listado filtra en el servidor.
 */
export function BuscadorClientes({
  inicial,
  tipo,
}: {
  inicial: string;
  tipo?: string;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(inicial);
  const primerRender = useRef(true);

  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (valor.trim()) params.set("q", valor.trim());
      if (tipo) params.set("tipo", tipo);
      const qs = params.toString();
      router.replace(qs ? `/clientes?${qs}` : "/clientes");
    }, 350);
    return () => clearTimeout(timer);
  }, [valor, tipo, router]);

  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        strokeWidth={2}
      />
      <Input
        type="search"
        inputMode="search"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder="Buscá por nombre, apodo o N° de carpeta"
        aria-label="Buscar cliente por nombre, apodo o número de carpeta"
        className="h-11 pl-10 text-base"
      />
    </div>
  );
}
