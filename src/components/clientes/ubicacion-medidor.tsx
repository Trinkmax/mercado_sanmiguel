"use client";

import { useState } from "react";
import { MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SelectorEspacio,
  type LugarPlano,
} from "@/components/mapa/selector-espacio";

/** Dónde está el medidor: un lugar del plano (espacio_id + etiqueta) o un texto libre. */
export type UbicacionElegida =
  | { tipo: "plano"; lugar: LugarPlano }
  | { tipo: "texto"; texto: string }
  | { tipo: "nada" };

/** Lo que se manda a crearMedidor / editarMedidor. */
export function ubicacionParaGuardar(u: UbicacionElegida): {
  espacioId: string | null;
  ubicacion: string;
} {
  if (u.tipo === "plano")
    return { espacioId: u.lugar.espacioId, ubicacion: u.lugar.etiqueta };
  if (u.tipo === "texto") return { espacioId: null, ubicacion: u.texto.trim() };
  return { espacioId: null, ubicacion: "" };
}

/**
 * Ubicación del medidor (C8): se toca en el plano para que "ya quede". Chips de 1 toque
 * con los puestos del cliente, "Elegir en el plano" y "Otro lugar (sin plano)" para lo que
 * no es un espacio (tableros, la quinta, administración). El selector es de M9.
 */
export function UbicacionMedidor({
  valor,
  onCambiar,
  sugeridos,
}: {
  valor: UbicacionElegida;
  onCambiar: (u: UbicacionElegida) => void;
  /** ids de los espacios del cliente: se ofrecen primero. */
  sugeridos: string[];
}) {
  const [textoPrevio, setTextoPrevio] = useState(
    valor.tipo === "texto" ? valor.texto : "",
  );

  if (valor.tipo === "plano") {
    return (
      <div className="space-y-2.5">
        <p className="text-base font-medium">¿Dónde está el medidor?</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-primary/40 bg-accent px-3 text-base font-medium text-accent-foreground">
            <MapPin className="size-4 text-primary" strokeWidth={2} />
            {valor.lugar.etiqueta}
          </span>
          <Button
            type="button"
            variant="ghost"
            className="h-11 px-3 text-sm"
            onClick={() => onCambiar({ tipo: "nada" })}
          >
            <X className="size-4" />
            Cambiar lugar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SelectorEspacio
        valor={null}
        onCambiar={(lugar: LugarPlano | null) =>
          lugar
            ? onCambiar({ tipo: "plano", lugar })
            : onCambiar({ tipo: "texto", texto: textoPrevio })
        }
        sugeridos={sugeridos}
        titulo="¿Dónde está el medidor?"
        permitirSinLugar
      />
      {valor.tipo === "texto" ? (
        <Input
          value={valor.texto}
          onChange={(e) => {
            setTextoPrevio(e.target.value);
            onCambiar({ tipo: "texto", texto: e.target.value });
          }}
          placeholder="Ej.: Tablero de la nave 2, columna 5"
          aria-label="Dónde está el medidor (sin plano)"
          className="h-12 text-base"
          autoComplete="off"
          maxLength={300}
        />
      ) : null}
    </div>
  );
}
