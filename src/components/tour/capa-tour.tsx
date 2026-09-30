"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Info, Lightbulb, Loader2, PartyPopper, Pointer, X } from "lucide-react";
import type { Rol } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ATRIBUTO_CAPA, ancestrosQueRecortan, recortar } from "@/lib/tour/anclas";
import type { Capitulo, MetaCapitulo, IdCapitulo } from "@/lib/tour/tipos";
import type { PasoTour } from "@/components/tour/proveedor-tour";
import { Button } from "@/components/ui/button";

type Rect = { top: number; left: number; width: number; height: number };
type Medida = Rect & { de: HTMLElement };

/** Oscuro de fondo: el azul profundo de la barra lateral, translúcido. */
const OSCURO = "rgb(15 23 60 / 0.62)";
const MARGEN = 16;
const SEPARACION = 18;
/** Debajo de este ancho la tarjeta va pegada arriba o abajo (celular y tablet chica). */
const ANCHO_COMPACTO = 640;

/** Tamaño de la ventana y la parte que se ve (el teclado en pantalla la achica; el zoom
 * con dos dedos también, pero eso no es teclado). */
function medirVista() {
  const vv = window.visualViewport;
  const escala = vv?.scale ?? 1;
  return {
    w: window.innerWidth,
    h: window.innerHeight,
    teclado: vv ? escala < 1.05 && vv.height < window.innerHeight * 0.75 : false,
    vvTop: vv?.offsetTop ?? 0,
    vvH: vv?.height ?? window.innerHeight,
  };
}

/** Después de que aparece un paso, los toques se ignoran un momento: el segundo toque de un
 * doble toque (muy común) no saltea el paso nuevo. */
const PAUSA_TOQUE = 400;

function radioDe(el: HTMLElement): number {
  const r = parseFloat(window.getComputedStyle(el).borderTopLeftRadius || "0");
  return Math.min(Number.isFinite(r) ? r : 0, 18);
}

/**
 * Lo que se ve durante el tour: la pantalla oscurecida con lo señalado iluminado (un
 * "agujero" que se desliza de un elemento al otro), un anillo que late, la manito que
 * toca y la tarjeta con el paso. Afuera de lo señalado no se puede tocar nada; adentro,
 * solo en los pasos "tocá acá".
 */
export function CapaTour({
  clave,
  rol,
  paso,
  fase,
  objetivo,
  pista,
  permitirToque,
  capitulo,
  modo,
  iCap,
  totalCaps,
  iPaso,
  totalPasos,
  siguienteCapitulo,
  onSiguiente,
  onAnterior,
  onCerrar,
  onSeguirCon,
  onPerdido,
}: {
  clave: string;
  rol: Rol;
  paso: PasoTour;
  fase: "navegando" | "buscando" | "listo";
  objetivo: HTMLElement | null;
  pista: string | null;
  permitirToque: boolean;
  capitulo: Capitulo;
  modo: "capitulo" | "recorrido";
  iCap: number;
  totalCaps: number;
  iPaso: number;
  totalPasos: number;
  siguienteCapitulo: MetaCapitulo | null;
  onSiguiente: () => void;
  onAnterior: () => void;
  onCerrar: () => void;
  onSeguirCon: (id: IdCapitulo) => void;
  onPerdido: () => void;
}) {
  const [vista, setVista] = useState(() => medirVista());
  const [medida, setMedida] = useState<Medida | null>(null);
  const [tam, setTam] = useState({ w: 400, h: 320 });
  const [llamar, setLlamar] = useState(0);
  const [animarHueco, setAnimarHueco] = useState(false);
  const refTarjeta = useRef<HTMLDivElement>(null);
  const refCuerpo = useRef<HTMLDivElement>(null);
  const refContenido = useRef<HTMLDivElement>(null);
  const refPerdido = useRef(onPerdido);
  const listoDesde = useRef(0);

  useEffect(() => {
    refPerdido.current = onPerdido;
  }, [onPerdido]);

  useEffect(() => {
    const alCambiar = () => setVista(medirVista());
    window.addEventListener("resize", alCambiar);
    // El teclado del celular achica la parte visible (visualViewport).
    window.visualViewport?.addEventListener("resize", alCambiar);
    return () => {
      window.removeEventListener("resize", alCambiar);
      window.visualViewport?.removeEventListener("resize", alCambiar);
    };
  }, []);

  // Seguir al elemento cuadro a cuadro (se mueve al desplazar la página o al cambiar algo).
  // Se ilumina solo la parte que se ve: si una lista con scroll lo recorta, no se ilumina
  // lo que queda por debajo (por ejemplo, «Salir» al pie de la barra lateral).
  useEffect(() => {
    if (!objetivo) return;
    let id = 0;
    let ultimo = "";
    const ancestros = ancestrosQueRecortan(objetivo);
    const medir = () => {
      if (!objetivo.isConnected) {
        refPerdido.current();
        return;
      }
      const v = recortar(objetivo.getBoundingClientRect(), ancestros);
      const k = v ? `${Math.round(v.top)}|${Math.round(v.left)}|${Math.round(v.width)}|${Math.round(v.height)}` : "oculto";
      if (k !== ultimo) {
        ultimo = k;
        setMedida(v ? { ...v, de: objetivo } : null);
      }
      id = window.requestAnimationFrame(medir);
    };
    id = window.requestAnimationFrame(medir);
    return () => window.cancelAnimationFrame(id);
  }, [objetivo]);

  // Alto natural de la tarjeta (sin recortar): con él se elige el lado, así no salta de un
  // lado al otro cuando el lugar la achica.
  useLayoutEffect(() => {
    const el = refTarjeta.current;
    const cuerpo = refCuerpo.current;
    const contenido = refContenido.current;
    if (!el || !cuerpo || !contenido) return;
    const medirTam = () => {
      const w = el.getBoundingClientRect().width;
      const h = el.offsetHeight - cuerpo.clientHeight + cuerpo.scrollHeight;
      setTam((prev) => (Math.abs(prev.w - w) > 1 || Math.abs(prev.h - h) > 1 ? { w, h } : prev));
    };
    const obs = new ResizeObserver(medirTam);
    obs.observe(el);
    obs.observe(contenido);
    return () => obs.disconnect();
  }, [fase, clave]);

  // El foco va a la tarjeta en cada paso (el lector de pantalla lee título y texto).
  useEffect(() => {
    if (fase !== "listo") return;
    listoDesde.current = performance.now();
    refTarjeta.current?.focus({ preventScroll: true });
  }, [clave, fase]);

  // El agujero se desliza al cambiar de paso; mientras sigue al scroll, va pegado (sin demora).
  useEffect(() => {
    const a = window.setTimeout(() => setAnimarHueco(true), 0);
    const b = window.setTimeout(() => setAnimarHueco(false), 520);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [clave]);

  /** Los botones de la tarjeta, con la pausa contra el doble toque. */
  const conPausa = (fn: () => void) => () => {
    if (performance.now() - listoDesde.current < PAUSA_TOQUE) return;
    fn();
  };

  // Teclado: → o Enter sigue, ← vuelve, Escape cierra. Tab queda dentro de la tarjeta
  // (la pantalla de atrás está "tapada" también para el teclado).
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === "Tab" && refTarjeta.current && !(t && objetivo?.contains(t))) {
        const enfocables = [
          ...refTarjeta.current.querySelectorAll<HTMLElement>("button:not([disabled]), summary, a[href]"),
        ];
        if (enfocables.length > 0) {
          const i = t ? enfocables.indexOf(t) : -1;
          const siguiente = e.shiftKey
            ? enfocables[i <= 0 ? enfocables.length - 1 : i - 1]
            : enfocables[i === -1 || i === enfocables.length - 1 ? 0 : i + 1];
          e.preventDefault();
          siguiente.focus();
        }
        return;
      }
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      // Las flechas dentro de lo señalado (un plano, unas pestañas) son de la pantalla.
      if (t && objetivo?.contains(t) && e.key !== "Escape") return;
      if (e.key === "Escape") {
        e.preventDefault();
        onCerrar();
      } else if (e.key === "ArrowRight" && paso.especial !== "fin") {
        e.preventDefault();
        onSiguiente();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onAnterior();
      } else if (e.key === "Enter" && t === refTarjeta.current) {
        e.preventDefault();
        onSiguiente();
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onSiguiente, onAnterior, onCerrar, paso.especial, objetivo]);

  const listo = fase === "listo";
  const hayFoco = listo && objetivo !== null && medida !== null && medida.de === objetivo;
  const compacto = vista.w < ANCHO_COMPACTO;

  // El agujero: el elemento con un poco de aire, sin salirse de la pantalla.
  const aire = hayFoco && Math.min(medida.width, medida.height) < 40 ? 5 : 8;
  const agujero: Rect | null = hayFoco
    ? (() => {
        const top = Math.max(medida.top - aire, 4);
        const left = Math.max(medida.left - aire, 4);
        const bottom = Math.min(medida.top + medida.height + aire, vista.h - 4);
        const right = Math.min(medida.left + medida.width + aire, vista.w - 4);
        return { top, left, width: Math.max(right - left, 0), height: Math.max(bottom - top, 0) };
      })()
    : null;
  const radio = hayFoco ? radioDe(medida.de) + aire : 14;

  // ---- Ubicación de la tarjeta ------------------------------------------------------
  const anchoTarjeta = compacto ? vista.w - 16 : Math.min(420, vista.w - MARGEN * 2);
  let estiloTarjeta: React.CSSProperties;
  if (vista.teclado) {
    // Teclado abierto: la tarjeta va dentro de lo que se ve, del lado contrario al campo.
    const centroCampo = agujero ? agujero.top + agujero.height / 2 - vista.vvTop : 0;
    const alto = Math.min(tam.h, vista.vvH * 0.5);
    const arriba = agujero !== null && centroCampo > vista.vvH / 2;
    estiloTarjeta = {
      ...(compacto ? { left: 8, right: 8 } : { width: anchoTarjeta, left: (vista.w - anchoTarjeta) / 2 }),
      top: arriba ? vista.vvTop + 8 : vista.vvTop + vista.vvH - alto - 8,
      maxHeight: vista.vvH * 0.5,
    };
  } else if (compacto) {
    // Celular: pegada abajo (o arriba si lo señalado está abajo). El tour lleva lo señalado
    // arriba de la pantalla antes de mostrarlo.
    const abajo = !agujero || agujero.top + agujero.height / 2 < vista.h * 0.5;
    estiloTarjeta = abajo
      ? { left: 8, right: 8, bottom: "max(8px, env(safe-area-inset-bottom))", maxHeight: "52svh" }
      : { left: 8, right: 8, top: "max(8px, env(safe-area-inset-top))", maxHeight: "52svh" };
  } else if (!agujero) {
    estiloTarjeta = {
      width: anchoTarjeta,
      left: (vista.w - anchoTarjeta) / 2,
      top: Math.max(MARGEN, (vista.h - Math.min(tam.h, vista.h - MARGEN * 2)) / 2),
      maxHeight: vista.h - MARGEN * 2,
    };
  } else {
    const h = tam.h;
    const w = anchoTarjeta;
    const espacio = {
      abajo: vista.h - (agujero.top + agujero.height) - SEPARACION - MARGEN,
      arriba: agujero.top - SEPARACION - MARGEN,
      derecha: vista.w - (agujero.left + agujero.width) - SEPARACION - MARGEN,
      izquierda: agujero.left - SEPARACION - MARGEN,
    };
    const ancho = agujero.width > vista.w * 0.5;
    const aLaIzquierda = agujero.left + agujero.width < vista.w * 0.3;
    const orden: (keyof typeof espacio)[] = ancho
      ? ["abajo", "arriba", "derecha", "izquierda"]
      : aLaIzquierda
        ? ["derecha", "abajo", "arriba", "izquierda"]
        : ["abajo", "arriba", "izquierda", "derecha"];
    // Se elige con el alto natural (fijo para el paso): la decisión no cambia al achicarse.
    let lado: keyof typeof espacio | undefined = orden.find((l) =>
      l === "abajo" || l === "arriba" ? espacio[l] >= h : espacio[l] >= w
    );
    // Si no entra entera en ningún lado, va arriba o abajo (donde haya más lugar) con su
    // contenido desplazable, siempre sin tapar lo señalado.
    if (!lado) {
      const mejor = espacio.abajo >= espacio.arriba ? "abajo" : "arriba";
      if (espacio[mejor] >= 240) lado = mejor;
    }
    const centroX = Math.min(Math.max(agujero.left + agujero.width / 2 - w / 2, MARGEN), vista.w - w - MARGEN);
    const altoLado = Math.min(h, vista.h - MARGEN * 2);
    const centroY = Math.min(Math.max(agujero.top + agujero.height / 2 - altoLado / 2, MARGEN), vista.h - altoLado - MARGEN);
    switch (lado) {
      case "abajo":
        estiloTarjeta = {
          width: w,
          left: centroX,
          top: agujero.top + agujero.height + SEPARACION,
          maxHeight: Math.max(espacio.abajo, 240),
        };
        break;
      case "arriba": {
        const alto = Math.min(h, espacio.arriba);
        estiloTarjeta = { width: w, left: centroX, top: agujero.top - SEPARACION - alto, maxHeight: espacio.arriba };
        break;
      }
      case "derecha":
        estiloTarjeta = { width: w, left: agujero.left + agujero.width + SEPARACION, top: centroY, maxHeight: vista.h - MARGEN * 2 };
        break;
      case "izquierda":
        estiloTarjeta = { width: w, left: agujero.left - SEPARACION - w, top: centroY, maxHeight: vista.h - MARGEN * 2 };
        break;
      default: {
        // Lo señalado ocupa casi toda la pantalla: la tarjeta va a una esquina, encima.
        const abajo = agujero.top + agujero.height / 2 < vista.h * 0.5;
        estiloTarjeta = {
          width: w,
          right: MARGEN,
          ...(abajo ? { bottom: MARGEN } : { top: MARGEN }),
          maxHeight: vista.h * 0.6,
        };
      }
    }
  }

  // ---- La manito ----------------------------------------------------------------------
  // La punta del dedo del ícono (24×24) está en (8, 2): se ubica justo adentro del borde.
  const TAM_MANO = 46;
  const punta = { x: (8 / 24) * TAM_MANO, y: (2 / 24) * TAM_MANO };
  let mano: { left: number; top: number; invertida: boolean; px: number; py: number } | null = null;
  if (agujero && medida) {
    const px = medida.left + medida.width / 2 + Math.min(medida.width / 4, 22);
    // La punta del dedo toca el borde (apenas adentro): no tapa lo que dice el botón.
    const debajo = medida.top + medida.height - Math.min(medida.height * 0.12, 4);
    const invertida = debajo + TAM_MANO + 6 > vista.h;
    if (!invertida) {
      mano = { left: px - punta.x, top: debajo - punta.y, invertida, px, py: debajo };
    } else {
      const arriba = medida.top + Math.min(medida.height * 0.12, 4);
      mano = { left: px - (TAM_MANO - punta.x), top: arriba - (TAM_MANO - punta.y), invertida, px, py: arriba };
    }
  }

  const tocar = paso.accion === "tocar";
  const alTocarAfuera = () => setLlamar((n) => n + 1);
  const siguienteConPausa = conPausa(onSiguiente);
  const anteriorConPausa = conPausa(onAnterior);
  const titulo = capitulo.titulo(rol);
  const Icono = capitulo.icono;
  const Pantalla = paso.pantalla;
  const esFin = paso.especial === "fin";
  const mostrarAtras = !esFin && (iPaso > 0 || iCap > 0);
  const progreso = totalPasos > 0 ? ((iPaso + 1) / totalPasos) * 100 : 100;

  return (
    <div {...{ [ATRIBUTO_CAPA]: "" }} className="no-print pointer-events-none fixed inset-0 z-[80]">
      {/* Oscuro de toda la pantalla cuando no hay nada señalado (se funde con el agujero). */}
      <div
        aria-hidden
        className="tour-foco absolute inset-0"
        style={{ background: OSCURO, opacity: agujero ? 0 : 1 }}
      />
      {/* El agujero: su sombra enorme oscurece todo lo demás. */}
      <div
        aria-hidden
        className={cn("absolute", animarHueco && "tour-foco")}
        style={
          agujero
            ? {
                top: agujero.top,
                left: agujero.left,
                width: agujero.width,
                height: agujero.height,
                borderRadius: radio,
                boxShadow: `0 0 0 3px rgb(255 255 255 / 0.95), 0 0 0 9999px ${OSCURO}`,
                opacity: 1,
              }
            : { top: vista.h / 2, left: vista.w / 2, width: 0, height: 0, opacity: 0 }
        }
      >
        {agujero ? (
          <span className="tour-anillo absolute -inset-1 rounded-[inherit] border-[3px] border-white" />
        ) : null}
      </div>

      {/* Afuera no se toca nada (un toque llama la atención sobre «Siguiente»). */}
      {agujero ? (
        <>
          <div className="pointer-events-auto absolute inset-x-0 top-0" style={{ height: agujero.top }} onClick={alTocarAfuera} />
          <div
            className="pointer-events-auto absolute inset-x-0 bottom-0"
            style={{ top: agujero.top + agujero.height }}
            onClick={alTocarAfuera}
          />
          <div
            className="pointer-events-auto absolute left-0"
            style={{ top: agujero.top, height: agujero.height, width: agujero.left }}
            onClick={alTocarAfuera}
          />
          <div
            className="pointer-events-auto absolute right-0"
            style={{ top: agujero.top, height: agujero.height, left: agujero.left + agujero.width }}
            onClick={alTocarAfuera}
          />
          {permitirToque ? null : (
            <div
              className="pointer-events-auto absolute"
              style={{ top: agujero.top, left: agujero.left, width: agujero.width, height: agujero.height }}
              onClick={alTocarAfuera}
            />
          )}
        </>
      ) : (
        <div className="pointer-events-auto absolute inset-0" onClick={alTocarAfuera} />
      )}

      {/* La manito que señala (y la onda del toque en los pasos "tocá acá"). */}
      {mano ? (
        <>
          {tocar && permitirToque ? (
            <span
              aria-hidden
              className="tour-onda absolute size-8 rounded-full bg-white/70"
              style={{ left: mano.px - 16, top: mano.py - 16 }}
            />
          ) : null}
          <div
            aria-hidden
            className="absolute transition-[left,top] duration-300 ease-out motion-reduce:transition-none"
            style={{
              left: mano.left,
              top: mano.top,
              width: TAM_MANO,
              height: TAM_MANO,
              transform: mano.invertida ? "rotate(180deg)" : undefined,
            }}
          >
            <Pointer
              className={cn(
                "size-full fill-white text-primary drop-shadow-[0_3px_6px_rgb(15_23_60/0.45)]",
                tocar ? "tour-toque" : "tour-flota"
              )}
              strokeWidth={1.6}
            />
          </div>
        </>
      ) : null}

      {listo ? (
        <div
          ref={refTarjeta}
          key={clave}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-titulo"
          aria-describedby="tour-texto"
          tabIndex={-1}
          className={cn(
            "tour-entra pointer-events-auto absolute flex flex-col overflow-hidden rounded-2xl bg-card text-card-foreground shadow-[0_24px_60px_-20px_rgb(15_23_60/0.6)] ring-1 ring-black/5 outline-none",
            compacto ? "rounded-[1.4rem]" : ""
          )}
          style={estiloTarjeta}
        >
          <div className="flex items-start gap-3 px-5 pt-4">
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl",
                esFin ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
              )}
            >
              {esFin ? <PartyPopper className="size-5" strokeWidth={2} /> : <Icono className="size-5" strokeWidth={2} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-muted-foreground">
                {modo === "recorrido" && totalCaps > 1 ? `Parte ${iCap + 1} de ${totalCaps} · ` : ""}
                {titulo}
              </p>
              <h2 id="tour-titulo" className="font-display text-xl leading-snug font-bold text-balance">
                {paso.titulo}
              </h2>
            </div>
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar la guía"
              className="-mt-1 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-5" strokeWidth={2} />
            </button>
          </div>

          <div ref={refCuerpo} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-2 pb-1">
            <div ref={refContenido} className="space-y-3">
            <p id="tour-texto" className="text-[1.05rem] leading-relaxed">
              {paso.texto}
            </p>
            {llamar >= 2 ? (
              <p className="rounded-lg bg-accent px-3 py-2 text-[0.95rem] leading-snug font-medium text-accent-foreground">
                Mientras dura la guía, la pantalla de atrás no se toca. Para seguir, tocá «Siguiente»; para salir, la
                X de arriba.
              </p>
            ) : null}
            {pista ? (
              <p className="flex items-start gap-2 rounded-lg bg-accent px-3 py-2 text-[0.95rem] leading-snug text-accent-foreground">
                <Info className="mt-0.5 size-4 shrink-0" strokeWidth={2.2} />
                <span>{pista}</span>
              </p>
            ) : tocar && permitirToque && objetivo ? (
              <p className="flex items-center gap-2 text-[0.95rem] font-semibold text-primary">
                <Pointer className="size-4 shrink-0" strokeWidth={2.2} />
                Podés tocarlo vos, o seguir con «Siguiente».
              </p>
            ) : null}
            {Pantalla ? (
              compacto && objetivo ? (
                <details className="group rounded-xl border border-border bg-muted/40">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-[0.95rem] font-semibold text-primary">
                    Ver cómo se ve
                    <ArrowRight className="size-4 transition-transform group-open:rotate-90" strokeWidth={2.2} />
                  </summary>
                  <div className="px-2 pb-2">
                    <Pantalla />
                  </div>
                </details>
              ) : (
                <Pantalla />
              )
            ) : null}
            {paso.consejo ? (
              <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-[0.95rem] leading-snug">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2.2} />
                <span>{paso.consejo}</span>
              </p>
            ) : null}
            </div>
          </div>

          <div className="px-5 pt-3 pb-4">
            {esFin ? null : (
              <div
                className="h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Avance de esta parte"
                aria-valuemin={1}
                aria-valuemax={totalPasos}
                aria-valuenow={iPaso + 1}
              >
                <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${progreso}%` }} />
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {esFin ? null : (
                <span className="mr-auto text-sm text-muted-foreground tabular">
                  Paso {iPaso + 1} de {totalPasos}
                </span>
              )}
              {mostrarAtras ? (
                <Button type="button" variant="outline" onClick={anteriorConPausa} className="h-12 gap-1.5 px-4 text-base">
                  <ArrowLeft className="size-5" strokeWidth={2} />
                  Atrás
                </Button>
              ) : null}
              {esFin && siguienteCapitulo ? (
                <div className="flex w-full flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={conPausa(() => onSeguirCon(siguienteCapitulo.id))}
                    className="h-12 min-w-0 flex-1 gap-1.5 px-4 text-base"
                  >
                    <span className="truncate">Seguir con «{siguienteCapitulo.titulo(rol)}»</span>
                    <ArrowRight className="size-5" strokeWidth={2} />
                  </Button>
                  <Button type="button" variant="outline" onClick={siguienteConPausa} className="h-12 px-4 text-base">
                    Terminar
                  </Button>
                </div>
              ) : (
                <Button
                  key={llamar}
                  type="button"
                  onClick={siguienteConPausa}
                  className={cn("h-12 gap-1.5 px-5 text-base", esFin && "w-full", llamar > 0 && "tour-llamar")}
                >
                  {esFin ? "Terminar" : "Siguiente"}
                  {esFin ? null : <ArrowRight className="size-5" strokeWidth={2} />}
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div
          className="tour-entra pointer-events-auto absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-full bg-card py-2 pr-2 pl-5 shadow-[0_24px_60px_-20px_rgb(15_23_60/0.6)]"
          style={{ animationDelay: "250ms" }}
          role="status"
        >
          <Loader2 className="size-5 animate-spin text-primary motion-reduce:animate-none" strokeWidth={2.2} />
          <span className="text-base font-medium">
            {fase === "navegando" ? `Abriendo «${titulo}»…` : "Un momento…"}
          </span>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar la guía"
            className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X className="size-5" strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  );
}
