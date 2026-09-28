"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Search, X } from "lucide-react";
import { crearRubro } from "@/lib/actions/gastos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Codigo } from "@/components/shared/codigo";
import type { Rubro } from "@/components/gastos/tipos";

function normalizar(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * Rubro con búsqueda (código o nombre), los más usados arriba y "Crear el rubro
 * «…»" si no existe (Tesorería ya no tiene Configuración). Botones grandes.
 */
export function SelectorRubro({
  rubros,
  frecuentes,
  valor,
  onCambiar,
}: {
  rubros: Rubro[];
  /** Ids de los rubros más usados (se muestran primero). */
  frecuentes: string[];
  valor: Rubro | null;
  onCambiar: (r: Rubro | null) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [creados, setCreados] = useState<Rubro[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creando, startTransition] = useTransition();

  const todos = useMemo(() => [...rubros, ...creados], [rubros, creados]);
  const q = normalizar(busqueda);
  const visibles = useMemo(() => {
    const orden = new Map(frecuentes.map((id, i) => [id, i]));
    const lista = q
      ? todos.filter((r) => normalizar(r.nombre).includes(q) || normalizar(r.codigo).includes(q))
      : [...todos].sort((a, b) => (orden.get(a.id) ?? 999) - (orden.get(b.id) ?? 999));
    return lista.slice(0, q ? 30 : 8);
  }, [todos, q, frecuentes]);
  const existeExacto = todos.some((r) => normalizar(r.nombre) === q);

  function crear() {
    setError(null);
    startTransition(async () => {
      const res = await crearRubro({ nombre: busqueda });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (!todos.some((r) => r.id === res.data.id)) setCreados((c) => [...c, res.data]);
      onCambiar(res.data);
      setBusqueda("");
    });
  }

  if (valor) {
    return (
      <div className="flex min-h-12 items-center justify-between gap-3 rounded-lg border bg-accent/40 px-3 py-2">
        <span className="flex items-center gap-2 text-base font-medium">
          <Codigo codigo={valor.codigo} />
          {valor.nombre}
        </span>
        <Button
          type="button"
          variant="ghost"
          className="h-11 px-3 text-base"
          onClick={() => onCambiar(null)}
        >
          <X className="size-4" strokeWidth={2} />
          Cambiar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.9}
        />
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscá: luz, limpieza, seguridad…"
          className="h-12 pl-10 text-base"
          aria-label="Buscar rubro"
        />
      </div>
      <div className="max-h-56 overflow-y-auto rounded-lg border">
        {!q ? (
          <p className="border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
            Los más usados
          </p>
        ) : null}
        <ul className="divide-y">
          {visibles.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onCambiar(r)}
                className="flex min-h-12 w-full items-center gap-3 px-3 text-left text-base hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                <Codigo codigo={r.codigo} />
                {r.nombre}
              </button>
            </li>
          ))}
          {visibles.length === 0 && !q ? (
            <li className="px-3 py-3 text-sm text-muted-foreground">Todavía no hay rubros: escribí uno para crearlo.</li>
          ) : null}
        </ul>
        {q && !existeExacto && busqueda.trim().length >= 2 ? (
          <button
            type="button"
            onClick={crear}
            disabled={creando}
            className={cn(
              "flex min-h-12 w-full items-center gap-2 border-t px-3 text-left text-base font-medium text-primary hover:bg-accent",
              creando && "opacity-60"
            )}
          >
            {creando ? <Spinner className="size-4" /> : <Plus className="size-4" strokeWidth={2.2} />}
            Crear el rubro «{busqueda.trim()}»
          </button>
        ) : null}
      </div>
      {error ? <p className="text-sm font-medium text-pendiente">{error}</p> : null}
    </div>
  );
}
