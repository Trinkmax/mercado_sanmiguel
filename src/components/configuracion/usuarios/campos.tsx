"use client";

import { useState } from "react";
import { Mail, PencilLine, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { dniConPuntos, generarContrasena } from "./contrasena";

/**
 * DNI con los puntos que se ponen solos. `valor` son solo dígitos. Mismo tamaño de letra que
 * el nombre de al lado (antes 22,5 px contra 15 px en el mismo formulario).
 */
export function CampoDni({
  id,
  valor,
  onCambiar,
  ayuda,
  error,
}: {
  id: string;
  valor: string;
  onCambiar: (digitos: string) => void;
  ayuda?: string;
  error?: string | null;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-base font-semibold">
        DNI
      </Label>
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        placeholder="Ej.: 12.345.678"
        value={dniConPuntos(valor)}
        onChange={(e) => onCambiar(e.target.value.replace(/\D/g, "").slice(0, 8))}
        aria-invalid={error ? true : undefined}
        className="h-14 max-w-xs bg-card text-lg font-semibold tracking-wide tabular md:text-lg"
      />
      {error ? (
        <p className="text-sm font-medium text-destructive">{error}</p>
      ) : ayuda ? (
        <p className="text-sm text-muted-foreground">{ayuda}</p>
      ) : null}
    </div>
  );
}

/**
 * Contraseña inicial: el sistema propone una legible ("Tomate-4821") y se puede
 * pedir otra o escribirla a mano. Se muestra siempre (hay que dársela a la persona).
 */
export function CampoContrasena({
  id,
  valor,
  onCambiar,
  titulo = "Contraseña para entrar",
}: {
  id: string;
  valor: string;
  onCambiar: (v: string) => void;
  titulo?: string;
}) {
  const [aMano, setAMano] = useState(false);
  const corta = valor.length > 0 && valor.length < 8;

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-base font-semibold">
        {titulo}
      </Label>
      {aMano ? (
        <Input
          id={id}
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={valor}
          onChange={(e) => onCambiar(e.target.value)}
          aria-invalid={corta ? true : undefined}
          placeholder="Mínimo 8 letras o números"
          className="h-14 max-w-xs bg-card text-lg md:text-lg"
        />
      ) : (
        <p
          id={id}
          className="flex h-14 max-w-xs items-center rounded-md border border-dashed bg-card px-3 font-display text-2xl font-bold tracking-wide select-all"
        >
          {valor}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {aMano ? null : (
          <button
            type="button"
            onClick={() => onCambiar(generarContrasena())}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border bg-card px-3 text-sm font-medium hover:bg-muted"
          >
            <RefreshCw className="size-4" strokeWidth={2} />
            Generar otra
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (aMano) onCambiar(generarContrasena());
            setAMano(!aMano);
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-primary hover:bg-accent"
        >
          <PencilLine className="size-4" strokeWidth={2} />
          {aMano ? "Mejor que la genere el sistema" : "Prefiero escribirla"}
        </button>
      </div>
      <p className={cn("text-sm", corta ? "font-medium text-destructive" : "text-muted-foreground")}>
        {corta
          ? "Tiene que tener al menos 8 letras o números."
          : "Al terminar te la mostramos para imprimirla o copiarla."}
      </p>
    </div>
  );
}

/** Email real opcional, plegado (casi nadie lo usa: se entra con el DNI). */
export function CampoEmailOpcional({
  id,
  valor,
  onCambiar,
}: {
  id: string;
  valor: string;
  onCambiar: (v: string) => void;
}) {
  return (
    <Collapsible defaultOpen={valor.length > 0}>
      <CollapsibleTrigger className="inline-flex min-h-11 items-center gap-2 rounded-md px-1 text-sm font-medium text-primary hover:underline data-[state=open]:hidden">
        <Mail className="size-4" strokeWidth={2} />
        Agregar email (opcional)
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2">
        <Label htmlFor={id} className="text-base font-semibold">
          Email (opcional)
        </Label>
        <Input
          id={id}
          type="email"
          inputMode="email"
          autoComplete="off"
          value={valor}
          onChange={(e) => onCambiar(e.target.value.trim())}
          placeholder="nombre@ejemplo.com"
          className="h-12 max-w-sm bg-card text-base md:text-base"
        />
        <p className="text-sm text-muted-foreground">
          Igual entra con el DNI. El email sirve solo si ya tiene uno y lo prefiere.
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}
