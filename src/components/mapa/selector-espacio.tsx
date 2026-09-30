"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Check, Map as MapIcon, MapPin, PenLine, RotateCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { planoParaSelector } from "@/lib/actions/mapa";
import type { ActionResult } from "@/lib/actions/result";
import { etiquetaEspacio } from "./geometria";
import type { ElementoPlano, Espacio, TipoEspacio } from "./tipos";

/** Un lugar del plano elegido: el id del espacio y cómo se lee ("Puesto 58"). */
export type LugarPlano = { espacioId: string; etiqueta: string };

type DatosPlano = { espacios: Espacio[]; elementos: ElementoPlano[] };

// El dibujo del plano pesa: se baja recién cuando se abre la hoja.
const PlanoSelector = dynamic(() => import("./plano-selector"), {
  ssr: false,
  loading: () => <SiluetaPlano />,
});

// Una sola carga por página aunque haya varios selectores (p. ej. varios medidores). Se
// renueva a los pocos minutos: si alguien corrige un número en el mapa, el selector lo ve.
const VIGENCIA_MS = 5 * 60 * 1000;
let pedido: Promise<ActionResult<DatosPlano>> | null = null;
let pedidoEn = 0;
function traerPlano(): Promise<ActionResult<DatosPlano>> {
  if (pedido && Date.now() - pedidoEn > VIGENCIA_MS) pedido = null;
  if (!pedido) {
    pedidoEn = Date.now();
    pedido = planoParaSelector().then(
      (r) => {
        if (!r.ok) pedido = null; // un error no queda guardado: el reintento vuelve a pedir
        return r;
      },
      () => {
        pedido = null;
        return { ok: false as const, error: "No pudimos cargar el plano. Revisá la conexión y probá de nuevo." };
      }
    );
  }
  return pedido;
}

/**
 * Elegir un lugar del plano en 1 toque (C8: dónde está el medidor; H3: el puesto de una
 * solicitud). Arriba, chips con los lugares sugeridos (los del cliente); "Elegir en el
 * plano" abre una hoja con el plano entero y la barra "Puesto 58 — Usar esta ubicación";
 * y, si se permite, "Otro lugar (sin plano)" para lo que no está dibujado (tableros,
 * la quinta, administración). Interfaz congelada (FASE3 §6.10).
 */
export function SelectorEspacio({
  valor,
  onCambiar,
  sugeridos = [],
  tipos,
  titulo,
  permitirSinLugar = false,
}: {
  valor: LugarPlano | null;
  onCambiar: (lugar: LugarPlano | null) => void;
  /** ids de espacios que se ofrecen como chips (los del cliente). */
  sugeridos?: string[];
  /** Qué se puede elegir (default: todos). */
  tipos?: TipoEspacio[];
  /** "¿Dónde está el medidor?" */
  titulo?: string;
  /** Muestra "Otro lugar (sin plano)" → onCambiar(null). */
  permitirSinLugar?: boolean;
}) {
  const [datos, setDatos] = useState<DatosPlano | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);

  const cargar = useCallback(() => {
    setError(null);
    traerPlano().then((r) => {
      if (r.ok) setDatos(r.data);
      else setError(r.error);
    });
  }, []);

  useEffect(() => {
    let vigente = true;
    traerPlano().then((r) => {
      if (!vigente) return;
      if (r.ok) setDatos(r.data);
      else setError(r.error);
    });
    return () => {
      vigente = false;
    };
  }, []);

  const tiposPermitidos = useMemo<TipoEspacio[] | null>(() => (tipos && tipos.length > 0 ? tipos : null), [tipos]);
  const porId = useMemo(() => new Map((datos?.espacios ?? []).map((e) => [e.id, e])), [datos]);

  // Chips: los sugeridos que se pueden elegir, y lo elegido si vino de otro lado del plano.
  const chips = useMemo(() => {
    const lista: { id: string; etiqueta: string }[] = [];
    for (const id of sugeridos) {
      const e = porId.get(id);
      if (!e || (tiposPermitidos && !tiposPermitidos.includes(e.tipo))) continue;
      lista.push({ id, etiqueta: etiquetaEspacio(e) });
    }
    if (valor && !lista.some((c) => c.id === valor.espacioId)) {
      lista.push({ id: valor.espacioId, etiqueta: valor.etiqueta });
    }
    return lista;
  }, [sugeridos, porId, tiposPermitidos, valor]);

  const usar = (e: Espacio) => {
    onCambiar({ espacioId: e.id, etiqueta: etiquetaEspacio(e) });
    setAbierto(false);
  };

  const cargando = datos === null && error === null;

  return (
    <div className="space-y-2.5">
      {titulo ? <p className="text-base font-medium">{titulo}</p> : null}

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={titulo ?? "Elegí el lugar"}>
        {cargando && sugeridos.length > 0
          ? sugeridos.slice(0, 3).map((id) => <Skeleton key={id} className="h-11 w-28 rounded-lg" />)
          : chips.map((c) => {
              const activo = valor?.espacioId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => onCambiar({ espacioId: c.id, etiqueta: c.etiqueta })}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2 rounded-lg border px-3.5 text-base font-medium transition-colors",
                    activo
                      ? "border-primary bg-accent text-accent-foreground ring-1 ring-primary/30"
                      : "bg-card hover:border-primary/40 hover:bg-accent/50"
                  )}
                >
                  {activo ? (
                    <Check className="size-4 text-primary" strokeWidth={2.4} />
                  ) : (
                    <MapPin className="size-4 text-primary" strokeWidth={2} />
                  )}
                  {c.etiqueta}
                </button>
              );
            })}

        <Button
          type="button"
          variant="outline"
          className="min-h-11 px-3.5 text-base"
          onClick={() => setAbierto(true)}
          disabled={error !== null}
        >
          <MapIcon className="size-4" strokeWidth={2} />
          {chips.length > 0 ? "Otro lugar del plano" : "Elegir en el plano"}
        </Button>

        {permitirSinLugar ? (
          <Button type="button" variant="ghost" className="min-h-11 px-3.5 text-base" onClick={() => onCambiar(null)}>
            <PenLine className="size-4" strokeWidth={2} />
            Otro lugar (sin plano)
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="flex flex-wrap items-center gap-2 text-sm text-pendiente">
          {error}
          <Button type="button" variant="outline" className="min-h-11 px-3 text-sm" onClick={cargar}>
            <RotateCw className="size-4" strokeWidth={2} />
            Probar de nuevo
          </Button>
        </p>
      ) : null}

      <Sheet open={abierto} onOpenChange={setAbierto}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="h-[85dvh] gap-0 rounded-t-2xl p-0 text-sm"
        >
          <SheetHeader className="flex-row items-start justify-between gap-3 px-4 pt-4 pb-3">
            <div className="min-w-0">
              <SheetTitle className="font-display text-lg font-bold">{titulo ?? "Elegí el lugar"}</SheetTitle>
              <SheetDescription className="text-sm text-muted-foreground">
                Tocá el lugar en el plano. Podés acercar con los dedos o con + y −.
              </SheetDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              className="size-11 shrink-0"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar el plano"
            >
              <X className="size-5" strokeWidth={2} />
            </Button>
          </SheetHeader>
          {datos ? (
            <PlanoSelector
              espacios={datos.espacios}
              elementos={datos.elementos}
              sugeridos={sugeridos}
              tipos={tiposPermitidos}
              inicial={valor?.espacioId ?? null}
              onUsar={usar}
            />
          ) : (
            <SiluetaPlano />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** Silueta del plano mientras baja el dibujo (o los datos). */
function SiluetaPlano() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b px-4 pb-3">
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
      <Skeleton className="min-h-0 flex-1 rounded-none" />
      <div className="border-t px-4 py-3">
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
