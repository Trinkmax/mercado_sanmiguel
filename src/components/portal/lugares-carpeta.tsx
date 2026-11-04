"use client";

import { Suspense, useState } from "react";
import { Car, ChevronRight, Container, Building2, Sprout, Store, Warehouse, type LucideIcon } from "lucide-react";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { HojaConPlano, useHojaEnUrl } from "./hoja-concepto";
import { PlanoPortal, type LugarPlano, type TonoPlano } from "./plano-portal";

export type LugarCarpeta = {
  plano: LugarPlano;
  etiqueta: string;
  /** En qué color se prende: el peor de lo que se paga por este lugar. */
  tono: TonoPlano;
  conceptos: {
    id: string;
    nombre: string;
    sello: string;
    monto: number;
    /** Entre cuántos lugares se reparte ese monto (el cargo es uno solo). */
    entre: number;
    /** De un mes anterior: "octubre". */
    mes: string | null;
  }[];
};

const ICONO: Record<string, LucideIcon> = {
  puesto: Store,
  bar: Store,
  local: Building2,
  contenedor: Container,
  galpon: Warehouse,
  invernadero: Sprout,
  cochera: Car,
  quinta: Sprout,
};

function Lista({ lugares }: { lugares: LugarCarpeta[] }) {
  const hoja = useHojaEnUrl("lugar");
  const abierto = lugares.find((l) => l.plano.id === hoja.valor) ?? null;
  // La hoja conserva lo último que mostró mientras se va, para que no se vacíe al cerrarse.
  const [ultimo, setUltimo] = useState<LugarCarpeta | null>(null);
  if (abierto && abierto !== ultimo) setUltimo(abierto);
  const l = abierto ?? ultimo;

  return (
    <>
      <ul className="hoja hoja-filas">
        {lugares.map((x) => {
          const Icono = ICONO[x.plano.tipo] ?? Store;
          return (
            <li key={x.plano.id}>
              <button
                type="button"
                data-tour="carpeta-lugar"
                className="fila-toque rounded-[inherit]"
                onClick={() => hoja.abrir(x.plano.id)}
              >
                <span className="fila-icono" aria-hidden>
                  <Icono strokeWidth={2} />
                </span>
                <span className="fila-titulo min-w-0 flex-1">{x.etiqueta}</span>
                <ChevronRight aria-hidden className="-mr-1.5 size-5 shrink-0 text-tinta-2" strokeWidth={2.2} />
              </button>
            </li>
          );
        })}
      </ul>
      <HojaConPlano
        abierta={Boolean(abierto)}
        onCerrar={hoja.cerrar}
        titulo={l?.etiqueta ?? ""}
        plano={
          l ? (
            <PlanoPortal
              key={l.plano.id}
              lugares={[l.plano]}
              tono={l.tono}
              etiqueta={l.etiqueta}
              focoY={0.36}
              demora={200}
              duracion={1100}
            />
          ) : null
        }
      >
        {l && l.conceptos.length > 0 ? (
          <ul className="flex flex-col gap-2 text-[1.05rem]">
            {l.conceptos.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block font-semibold">
                    {c.nombre}
                    {c.mes ? ` de ${c.mes}` : ""}
                  </span>
                  {c.entre > 1 ? (
                    <span className="block text-[0.94rem] leading-tight text-tinta-2">Entre tus {c.entre} lugares</span>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Money monto={c.monto} className="font-extrabold" />
                  <Sello estado={c.sello} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[1.05rem] leading-snug text-tinta-2">Este mes no hay nada para pagar por este lugar.</p>
        )}
      </HojaConPlano>
    </>
  );
}

/** Sus lugares: tocás uno y la cámara vuela hasta ahí, con lo que paga por ese lugar. */
export function LugaresCarpeta({ lugares }: { lugares: LugarCarpeta[] }) {
  return (
    <Suspense fallback={null}>
      <Lista lugares={lugares} />
    </Suspense>
  );
}
