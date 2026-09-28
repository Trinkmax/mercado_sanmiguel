"use client";

import { useState } from "react";
import { CircleCheck, CircleX, MapPin, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TIPOS_LUGAR,
  buscarLugar,
  etiquetaLugar,
  type LugarSimple,
  type TipoLugar,
} from "./lugares";

/**
 * Elegir un puesto del plano por su número, sin ver a quién pertenece (Portería, el Jefe y
 * Tesorería no ven clientes). Chips Puesto · Local · Contéiner + teclado numérico; se valida
 * en el momento: "Puesto 58 ✓" o "No existe el puesto 158".
 */
export function SelectorPuesto({
  lugares,
  valor,
  onCambiar,
}: {
  lugares: LugarSimple[];
  valor: LugarSimple | null;
  onCambiar: (lugar: LugarSimple | null) => void;
}) {
  const [tipo, setTipo] = useState<TipoLugar>((valor?.tipo as TipoLugar) ?? "puesto");
  const [numero, setNumero] = useState(valor?.numero ?? "");
  const tiposConLugares = TIPOS_LUGAR.filter((t) => lugares.some((l) => l.tipo === t.valor));
  const encontrados = buscarLugar(lugares, tipo, numero);
  const nombreTipo = TIPOS_LUGAR.find((t) => t.valor === tipo)?.label.toLowerCase() ?? "lugar";

  if (valor) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-pagado/40 bg-pagado-suave px-4 py-3">
        <p className="flex items-center gap-2 text-lg font-semibold">
          <CircleCheck className="size-5 text-pagado" strokeWidth={2.2} />
          {etiquetaLugar(valor)}
        </p>
        <Button
          type="button"
          variant="outline"
          className="h-11 shrink-0"
          onClick={() => {
            onCambiar(null);
            setNumero("");
          }}
        >
          <X className="size-4" />
          Cambiar
        </Button>
      </div>
    );
  }

  if (lugares.length === 0) {
    return (
      <p className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
        El plano todavía no tiene puestos cargados. Escribí el lugar en la referencia.
      </p>
    );
  }

  function elegir(l: LugarSimple) {
    onCambiar(l);
  }

  return (
    <div className="space-y-3">
      {tiposConLugares.length > 1 ? (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de lugar">
          {tiposConLugares.map((t) => {
            const activo = t.valor === tipo;
            return (
              <button
                key={t.valor}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => setTipo(t.valor)}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors",
                  activo
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-accent"
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <MapPin className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" strokeWidth={2} />
          <Input
            inputMode="numeric"
            value={numero}
            onChange={(e) => setNumero(e.target.value.replace(/[^\d]/g, "").slice(0, 5))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (encontrados.length === 1) elegir(encontrados[0]);
              }
            }}
            placeholder={`N° de ${nombreTipo}`}
            aria-label={`Número de ${nombreTipo}`}
            className="h-12 w-44 pl-11 font-display text-lg font-bold tabular md:text-lg"
            autoComplete="off"
          />
        </div>
        {numero && encontrados.length === 0 ? (
          <p className="flex items-center gap-1.5 text-sm font-medium text-pendiente" role="status">
            <CircleX className="size-4" strokeWidth={2.2} />
            No existe el {nombreTipo} {numero}
          </p>
        ) : null}
      </div>

      {encontrados.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {encontrados.map((l) => (
            <Button
              key={l.id}
              type="button"
              size="lg"
              className="h-12 px-5 text-base font-semibold"
              onClick={() => elegir(l)}
            >
              <CircleCheck className="size-5" strokeWidth={2.2} />
              Es el {etiquetaLugar(l)}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
