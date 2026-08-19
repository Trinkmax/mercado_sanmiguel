"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { hrefPersonal } from "@/components/personal/constantes";

/** Búsqueda por apellido, nombre o DNI. Actualiza ?q= con debounce; el
 * listado filtra en el servidor y conserva el filtro activos/todos. */
export function BuscadorEmpleados({
  inicial,
  filtro,
}: {
  inicial: string;
  filtro?: string;
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
      router.replace(hrefPersonal(valor.trim(), filtro));
    }, 350);
    return () => clearTimeout(timer);
  }, [valor, filtro, router]);

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
        placeholder="Buscá por apellido, nombre o DNI"
        aria-label="Buscar empleado por apellido, nombre o DNI"
        className="h-11 pl-10 text-base md:text-base"
      />
    </div>
  );
}
