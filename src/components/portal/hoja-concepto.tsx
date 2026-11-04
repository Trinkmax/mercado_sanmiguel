"use client";

import { createContext, Suspense, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Building2,
  Car,
  ChevronRight,
  Container,
  Gavel,
  History,
  ReceiptText,
  Sprout,
  Store,
  Tag,
  Warehouse,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { formatFechaLarga } from "@/lib/format";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { Concepto, IconoConcepto } from "./armar-cuenta";
import { PlanoPortal, type LugarPlano } from "./plano-portal";

/**
 * La cuenta es el mapa: tocás un concepto y sube una hoja donde la cámara vuela hasta ese
 * lugar del mercado, prendido en el color de ese concepto. La hoja va en la dirección de la
 * página (?ver=…): el botón «atrás» del celular la cierra, en vez de sacarte de la cuenta.
 */

export const ICONO_CONCEPTO: Record<IconoConcepto, LucideIcon> = {
  puesto: Store,
  cochera: Car,
  quinta: Sprout,
  luz: Zap,
  galpon: Warehouse,
  conteiner: Container,
  local: Building2,
  deuda: History,
  multa: Gavel,
  otro: ReceiptText,
};

/** Hoja que vive en la dirección: se abre sin ir al servidor y «atrás» la cierra. */
export function useHojaEnUrl(param: string) {
  const parametros = useSearchParams();
  const empujada = useRef(false);
  const abrir = useCallback(
    (id: string) => {
      const url = new URL(window.location.href);
      // Un doble toque no apila dos veces la misma hoja.
      if (url.searchParams.get(param) === id) return;
      empujada.current = true;
      url.searchParams.set(param, id);
      window.history.pushState(null, "", url);
    },
    [param]
  );
  const cerrar = useCallback(() => {
    if (empujada.current) {
      empujada.current = false;
      window.history.back();
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete(param);
    window.history.replaceState(null, "", url);
  }, [param]);
  return { valor: parametros.get(param), abrir, cerrar };
}

/** Lo que tiene la hoja que sube: el plano arriba, si el concepto queda en algún lugar. */
export function HojaConPlano({
  abierta,
  onCerrar,
  titulo,
  descripcion,
  plano,
  children,
}: {
  abierta: boolean;
  onCerrar: () => void;
  titulo: string;
  descripcion?: string;
  plano?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Sheet open={abierta} onOpenChange={(v) => (v ? undefined : onCerrar())}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="portal-hoja-flotante max-h-[90svh] gap-0 overflow-y-auto rounded-t-[1.35rem] border-0 bg-porcelana p-0 text-base text-tinta sm:mx-auto sm:w-[36rem] sm:max-w-full"
      >
        {plano ? <div className="relative h-[12.5rem] shrink-0 overflow-hidden rounded-t-[1.35rem] bg-esmalte">{plano}</div> : null}
        <div className="flex flex-col gap-3 px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div>
            <SheetTitle className="text-[1.5rem] leading-tight font-extrabold text-tinta [font-family:inherit] [font-stretch:92%]">
              {titulo}
            </SheetTitle>
            {descripcion ? (
              <SheetDescription className="mt-0.5 text-[1.02rem] leading-snug text-tinta-2">
                {descripcion}
              </SheetDescription>
            ) : (
              <SheetDescription className="sr-only">{titulo}</SheetDescription>
            )}
          </div>
          {children}
          <button type="button" className="boton boton-suave mt-1 w-full" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

type ContextoHoja = { abrir: (id: string) => void };
const Contexto = createContext<ContextoHoja | null>(null);

function Hojas({
  conceptos,
  lugares,
  children,
}: {
  conceptos: Concepto[];
  lugares: LugarPlano[];
  children: React.ReactNode;
}) {
  const hoja = useHojaEnUrl("ver");
  const abierto = useMemo(() => conceptos.find((c) => c.id === hoja.valor) ?? null, [conceptos, hoja.valor]);
  // La hoja conserva lo último que mostró mientras se va, para que no se vacíe al cerrarse.
  const [ultimo, setUltimo] = useState<Concepto | null>(null);
  if (abierto && abierto !== ultimo) setUltimo(abierto);
  const c = abierto ?? ultimo;

  const enPlano = c ? lugares.filter((l) => c.lugares.includes(l.id)) : [];

  return (
    <Contexto.Provider value={{ abrir: hoja.abrir }}>
      {children}
      <HojaConPlano
        abierta={Boolean(abierto)}
        onCerrar={hoja.cerrar}
        titulo={c?.nombre ?? ""}
        descripcion={c?.lugaresTexto ?? undefined}
        plano={
          c && enPlano.length > 0 ? (
            <PlanoPortal
              key={c.id}
              lugares={enPlano}
              tono={c.tono}
              etiqueta={c.lugaresTexto}
              focoY={0.36}
              demora={200}
              duracion={1100}
            />
          ) : null
        }
      >
        {c ? <DetalleConcepto c={c} /> : null}
      </HojaConPlano>
    </Contexto.Provider>
  );
}

function DetalleConcepto({ c }: { c: Concepto }) {
  const pagado = c.sello === "pagado";
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <Money
          monto={pagado ? c.pagado : c.saldo}
          className="text-[2.3rem] leading-none font-extrabold tracking-[-0.015em] [font-stretch:88%]"
        />
        <Sello estado={c.sello} grande className="text-[0.92rem]" />
      </div>

      <div className="flex flex-col gap-1 text-[1.05rem] leading-snug">
        {pagado ? (
          <p>Ya está pagado. ¡Gracias!</p>
        ) : c.reconocimiento ? (
          <p>Lo que te queda por pagar de tu plan.</p>
        ) : c.sello === "vencido" ? (
          <p>
            Venció el <strong className="font-bold">{formatFechaLarga(c.vencimiento)}</strong>.
          </p>
        ) : (
          <p>
            Vence el <strong className="font-bold">{formatFechaLarga(c.vencimiento)}</strong>.
          </p>
        )}
        {!pagado && c.pagado > 0.009 ? (
          <p>
            Ya pagaste <Money monto={c.pagado} className="font-bold" />.
          </p>
        ) : null}
        {c.beneficio > 0.009 ? (
          <p className="flex items-start gap-1.5">
            <Tag aria-hidden className="mt-1 size-4 shrink-0" strokeWidth={2.4} />
            <span>
              Ya incluye tu beneficio de <Money monto={c.beneficio} className="font-bold" /> por pagar a tiempo. Si
              se pasa la fecha, lo perdés.
            </span>
          </p>
        ) : null}
        {c.detalle ? <p className="text-tinta-2">{c.detalle}</p> : null}
      </div>

      {c.ayuda ? <p className="text-[1rem] leading-snug text-tinta-2">{c.ayuda}</p> : null}
      {c.descripcion !== c.nombre ? (
        <p className="text-[0.92rem] leading-snug text-tinta-2">En tu carpeta figura como «{c.descripcion}».</p>
      ) : null}
    </>
  );
}

/** Envuelve las listas de conceptos de una pantalla: una sola hoja para todas. */
export function HojasConcepto(props: {
  conceptos: Concepto[];
  lugares: LugarPlano[];
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={props.children}>
      <Hojas {...props} />
    </Suspense>
  );
}

/** Un renglón de la cuenta: qué es, dónde queda, cuánto y cómo está. Se toca entero. */
export function FilaConcepto({ c, className }: { c: Concepto; className?: string }) {
  const contexto = useContext(Contexto);
  const Icono = ICONO_CONCEPTO[c.icono];
  const pagado = c.sello === "pagado";
  return (
    <button
      type="button"
      data-tour="portal-concepto"
      onClick={() => contexto?.abrir(c.id)}
      className={cn("fila-toque", className)}
    >
      <span className={cn("fila-icono", pagado && "opacity-55")} aria-hidden>
        <Icono strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="fila-titulo block">{c.nombre}</span>
        {c.lugaresTexto || c.detalle ? (
          <span className="fila-sub block">{c.lugaresTexto ?? c.detalle}</span>
        ) : null}
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <Money monto={pagado ? c.pagado : c.saldo} className={cn("fila-monto", pagado && "text-tinta-2")} />
          <Sello estado={c.sello} />
        </span>
      </span>
      <ChevronRight aria-hidden className="-mr-1.5 size-5 shrink-0 text-tinta-2" strokeWidth={2.2} />
    </button>
  );
}
