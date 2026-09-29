"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Check, Hand, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BuscadorMapa } from "./buscador-mapa";
import {
  alturaDe,
  armarBloques,
  etiquetaEspacio,
  limitesPlano,
  nombreTipo,
  REPOSO,
  unir,
} from "./geometria";
import { LienzoPlano, type ControlLienzo } from "./lienzo-plano";
import { anilloDe, sembrarArboles, type Anillo, type EstiloBloque } from "./plano-svg";
import type { ElementoPlano, Espacio, Rect, TipoEspacio } from "./tipos";

/**
 * El plano dentro del selector de lugar (C8, H3). Se carga con next/dynamic desde
 * `selector-espacio.tsx`: el dibujo pesa y no hace falta hasta que se toca
 * "Elegir en el plano". Cada espacio es una pieza propia (sin agrupar por puestero),
 * todos en el mismo color neutro; los sugeridos (los del cliente) con anillo azul.
 */
export default function PlanoSelector({
  espacios,
  elementos,
  sugeridos,
  tipos,
  inicial,
  onUsar,
}: {
  espacios: Espacio[];
  elementos: ElementoPlano[];
  sugeridos: string[];
  tipos: TipoEspacio[] | null;
  inicial: string | null;
  onUsar: (espacio: Espacio) => void;
}) {
  const lienzo = useRef<ControlLienzo>(null);
  const [elegido, setElegido] = useState<string | null>(inicial);
  const [aviso, setAviso] = useState<string | null>(null);

  // Sin dueño ni grupo: cada espacio se dibuja y se elige solo.
  const plano = useMemo(
    () => espacios.map((e) => ({ ...e, grupo: null, clienteId: null, nota: null })),
    [espacios]
  );
  const porId = useMemo(() => new Map(plano.map((e) => [e.id, e])), [plano]);
  const limites = useMemo(() => limitesPlano(elementos, plano), [elementos, plano]);
  const arboles = useMemo(() => sembrarArboles(elementos, plano, limites), [elementos, plano, limites]);
  const bloques = useMemo(() => armarBloques(plano), [plano]);
  const permitido = useCallback((t: TipoEspacio) => !tipos || tipos.includes(t), [tipos]);
  const sugSet = useMemo(() => new Set(sugeridos), [sugeridos]);

  const estilos = useMemo(() => {
    const m = new Map<string, EstiloBloque>();
    for (const b of bloques) {
      const e = b.espacios[0];
      m.set(b.clave, {
        estado: "anonimo",
        atenuado: !permitido(b.tipo),
        marca: e.id === elegido ? "seleccion" : sugSet.has(e.id) ? "pincel" : null,
        etiqueta: null,
      });
    }
    return m;
  }, [bloques, permitido, elegido, sugSet]);

  const anillos = useMemo<Anillo[]>(() => {
    const a: Anillo[] = [];
    for (const b of bloques) {
      const estilo = estilos.get(b.clave);
      if (!estilo || estilo.marca === null) continue;
      a.push(anilloDe(b, b.rect, estilo.marca === "seleccion" ? "seleccion" : "pincel", alturaDe(b, estilo, REPOSO)));
    }
    return a;
  }, [bloques, estilos]);

  const enfoqueInicial = useMemo<Rect | null>(() => {
    const e = inicial ? porId.get(inicial) : null;
    if (e) return e;
    const suyos = sugeridos.flatMap((id) => porId.get(id) ?? []);
    return suyos.length > 0 ? unir(suyos) : null;
  }, [inicial, sugeridos, porId]);

  const elegir = useCallback(
    (e: Espacio) => {
      if (!permitido(e.tipo)) {
        const lista = (tipos ?? []).map((t) => nombreTipo(t, true).toLowerCase()).join(" o ");
        setAviso(`Acá se eligen ${lista || "espacios"}: tocá otro lugar.`);
        return;
      }
      setAviso(null);
      setElegido(e.id);
    },
    [permitido, tipos]
  );

  const acciones = useMemo(
    () => ({
      alTocar: (e: Espacio) => elegir(e),
      describir: (e: Espacio) =>
        `${etiquetaEspacio(e)}${sugSet.has(e.id) ? ", es de este cliente" : ""}${e.id === elegido ? ", elegido" : ""}`,
    }),
    [elegir, sugSet, elegido]
  );

  const actual = elegido ? porId.get(elegido) ?? null : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b px-4 pb-3">
        <BuscadorMapa
          clientes={[]}
          espacios={plano.filter((e) => permitido(e.tipo))}
          anonimo
          // Corto: entra entero en la hoja de un celular de 360 px.
          placeholder="Número (58, local 3, c 7)"
          vacio="No hay ningún lugar con"
          onElegir={(r) => {
            const e = r.tipo === "espacio" ? porId.get(r.id) : null;
            if (!e) return;
            elegir(e);
            lienzo.current?.enfocar(e);
          }}
        />
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <LienzoPlano
          ref={lienzo}
          limites={limites}
          elementos={elementos}
          bloques={bloques}
          estilos={estilos}
          anillos={anillos}
          arboles={arboles}
          acciones={acciones}
          onTocarFondo={() => setAviso(null)}
          enfoqueInicial={enfoqueInicial}
        >
          {sugeridos.length > 0 && !actual ? (
            <p className="pointer-events-none absolute top-3 right-3 left-3 mx-auto flex w-fit max-w-full items-center gap-2 rounded-2xl bg-primary px-3.5 py-2 text-sm leading-snug font-medium text-primary-foreground shadow-md">
              <MapPin className="size-4 shrink-0" strokeWidth={2} />
              <span className="min-w-0">Los marcados en azul son de este cliente</span>
            </p>
          ) : null}
        </LienzoPlano>
      </div>

      {/* Barra fija: lo elegido y el botón que lo confirma (una sola acción). */}
      <div className="border-t bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {aviso ? (
          <p role="status" className="mb-2 text-sm font-medium text-parcial">
            {aviso}
          </p>
        ) : null}
        {actual ? (
          <Button type="button" size="lg" className="h-12 w-full text-base font-semibold" onClick={() => onUsar(actual)}>
            <Check className="size-5" strokeWidth={2.2} />
            {etiquetaEspacio(actual)} — Usar esta ubicación
          </Button>
        ) : (
          <p className="flex min-h-12 items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <Hand className="size-4 shrink-0" strokeWidth={1.9} />
            Tocá el lugar en el plano o buscalo por número.
          </p>
        )}
      </div>
    </div>
  );
}
