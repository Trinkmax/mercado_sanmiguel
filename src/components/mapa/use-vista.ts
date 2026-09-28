"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Rect } from "./tipos";

/** Cámara del plano: centro (unidades del plano) y escala (px por unidad). */
type Camara = { cx: number; cy: number; k: number };
type Tam = { w: number; h: number };

type Gesto =
  | { tipo: "nada" }
  | { tipo: "posible" | "pan"; x0: number; y0: number; cam0: Camara }
  | { tipo: "pinch"; d0: number; m0: { x: number; y: number }; cam0: Camara };

/** Más allá de esto un toque pasa a ser arrastre. */
const UMBRAL_ARRASTRE = 6;
/** Hasta cuánto se puede acercar respecto del encuadre completo. */
const ZOOM_MAXIMO = 7;
/** Enfocar a alguien acerca como mucho esto (se sigue viendo el contexto). */
const ZOOM_ENFOQUE = 2.6;

const acotar = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

function encuadre(lim: Rect, tam: Tam): Camara {
  return {
    cx: lim.x + lim.w / 2,
    cy: lim.y + lim.h / 2,
    k: Math.min(tam.w / lim.w, tam.h / lim.h),
  };
}

/** Encuadre al abrir: todo el predio; en pantallas angostas (celular
 * vertical) el plano entero quedaría como una tira, así que se arranca más
 * cerca, centrado en la nave, llenando el alto disponible. */
function encuadreInicial(lim: Rect, tam: Tam): Camara {
  const todo = encuadre(lim, tam);
  const angosta = tam.w / tam.h < lim.w / lim.h / 1.6;
  if (!angosta) return todo;
  const llenarAlto = tam.h / lim.h;
  return { ...todo, k: Math.min(llenarAlto, todo.k * 2.6) };
}

function reduceMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Zoom y desplazamiento del plano: arrastrar para mover, pellizcar (tablet) o
 * ⌘/Ctrl + rueda (y el pellizco del trackpad) para acercar, más botones y
 * teclado. La cámara siempre mantiene el plano a la vista.
 */
export function useVista(limites: Rect, insetInferior = 0) {
  const contRef = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState<Tam | null>(null);
  const [cam, setCam] = useState<Camara | null>(null);
  const camRef = useRef<Camara | null>(null);
  const tamRef = useRef<Tam | null>(null);
  const limRef = useRef(limites);
  /** px de abajo del lienzo tapados por un panel flotante (la cámara los descuenta). */
  const insetRef = useRef(insetInferior);
  useEffect(() => {
    insetRef.current = insetInferior;
  }, [insetInferior]);
  // Mientras el usuario no toque el zoom, el plano sigue encuadrado al redimensionar.
  const ajustadoRef = useRef(true);
  const animRef = useRef<number | null>(null);
  const punteros = useRef(new Map<number, { x: number; y: number }>());
  const gesto = useRef<Gesto>({ tipo: "nada" });
  /** Verdadero si el último gesto movió el plano (para no tomarlo como toque). */
  const arrastro = useRef(false);
  /** Qué está moviendo la cámara cuadro a cuadro ahora: un gesto de punteros,
   * una animación o la rueda / el pellizco del trackpad (hasta un rato después
   * del último evento). */
  const moviendo = useRef({ gesto: false, anim: false, rueda: null as number | null });

  // Mientras la cámara se mueve cuadro a cuadro, el <svg> lleva
  // data-arrastrando (sin estado de React): el CSS apaga el desenfoque de las
  // sombras del fondo, que si no se volvería a rasterizar en cada cuadro.
  const marcarMovimiento = useCallback(() => {
    const svg = contRef.current?.querySelector(":scope > svg");
    if (!svg) return;
    const m = moviendo.current;
    if (m.gesto || m.anim || m.rueda !== null) svg.setAttribute("data-arrastrando", "");
    else svg.removeAttribute("data-arrastrando");
  }, []);

  /** Rueda y pellizco del trackpad: no tienen fin explícito, se da por
   * terminado 150 ms después del último evento. */
  const marcarRueda = useCallback(() => {
    const m = moviendo.current;
    if (m.rueda !== null) window.clearTimeout(m.rueda);
    m.rueda = window.setTimeout(() => {
      m.rueda = null;
      marcarMovimiento();
    }, 150);
    marcarMovimiento();
  }, [marcarMovimiento]);

  // Los límites se comparan por valor: datos nuevos del servidor (mismo plano)
  // no tienen que mover la cámara.
  const claveLimites = `${limites.x},${limites.y},${limites.w},${limites.h}`;

  const kMinMax = useCallback((): [number, number] => {
    const t = tamRef.current;
    if (!t) return [0.01, 10];
    const kFit = encuadre(limRef.current, t).k;
    return [kFit * 0.9, Math.max(kFit * ZOOM_MAXIMO, 1.6)];
  }, []);

  const normalizar = useCallback(
    (c: Camara): Camara => {
      const t = tamRef.current;
      if (!t) return c;
      const lim = limRef.current;
      const [kMin, kMax] = kMinMax();
      const k = acotar(c.k, kMin, kMax);
      const vw = t.w / k;
      const vh = t.h / k;
      // Con un panel flotante abajo, la cámara puede bajar un poco más para que
      // lo último del plano quede por encima del panel y no debajo.
      const limH = lim.h + insetRef.current / k;
      const cx =
        vw >= lim.w ? lim.x + lim.w / 2 : acotar(c.cx, lim.x + vw / 2, lim.x + lim.w - vw / 2);
      const cy =
        vh >= limH ? lim.y + limH / 2 : acotar(c.cy, lim.y + vh / 2, lim.y + limH - vh / 2);
      return { cx, cy, k };
    },
    [kMinMax]
  );

  const aplicar = useCallback(
    (c: Camara) => {
      const n = normalizar(c);
      // Un evento raro (sin coordenadas) no puede dejar la cámara en NaN.
      if (!Number.isFinite(n.cx) || !Number.isFinite(n.cy) || !Number.isFinite(n.k)) return;
      camRef.current = n;
      setCam(n);
    },
    [normalizar]
  );

  const cortarAnimacion = useCallback(() => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    animRef.current = null;
    if (moviendo.current.anim) {
      moviendo.current.anim = false;
      marcarMovimiento();
    }
  }, [marcarMovimiento]);

  const animarA = useCallback(
    (destino: Camara, ms = 420) => {
      cortarAnimacion();
      const ini = camRef.current;
      const fin = normalizar(destino);
      if (!ini || ms === 0 || reduceMotion()) {
        aplicar(fin);
        return;
      }
      const t0 = performance.now();
      const paso = (ahora: number) => {
        const t = Math.min(1, (ahora - t0) / ms);
        const e = 1 - Math.pow(1 - t, 3);
        aplicar({
          cx: ini.cx + (fin.cx - ini.cx) * e,
          cy: ini.cy + (fin.cy - ini.cy) * e,
          // Escala interpolada en logaritmo: el zoom se siente parejo.
          k: Math.exp(Math.log(ini.k) + (Math.log(fin.k) - Math.log(ini.k)) * e),
        });
        if (t < 1) animRef.current = requestAnimationFrame(paso);
        else {
          animRef.current = null;
          moviendo.current.anim = false;
          marcarMovimiento();
        }
      };
      animRef.current = requestAnimationFrame(paso);
      moviendo.current.anim = true;
      marcarMovimiento();
    },
    [aplicar, cortarAnimacion, normalizar, marcarMovimiento]
  );

  // Tamaño del contenedor: encuadra al montar y acompaña los cambios.
  useEffect(() => {
    const el = contRef.current;
    if (!el) return;
    const medir = () => {
      const r = el.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return;
      const t = { w: r.width, h: r.height };
      tamRef.current = t;
      setTam(t);
      if (ajustadoRef.current || !camRef.current) {
        aplicar(encuadreInicial(limRef.current, t));
      } else {
        aplicar(camRef.current);
      }
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [aplicar]);

  // Si cambian los límites (otro plano), se vuelve a encuadrar.
  useEffect(() => {
    const [x, y, w, h] = claveLimites.split(",").map(Number);
    const anterior = limRef.current;
    limRef.current = { x, y, w, h };
    const t = tamRef.current;
    if (!t) return;
    const igual =
      anterior.x === x && anterior.y === y && anterior.w === w && anterior.h === h;
    if (igual && camRef.current) return;
    ajustadoRef.current = true;
    aplicar(encuadreInicial(limRef.current, t));
  }, [claveLimites, aplicar]);

  /** Acerca/aleja con un factor, fijando el punto de pantalla (sx, sy). */
  const zoomEn = useCallback(
    (factor: number, sx?: number, sy?: number, animado = false) => {
      const c = camRef.current;
      const t = tamRef.current;
      if (!c || !t) return;
      ajustadoRef.current = false;
      const px = sx ?? t.w / 2;
      const py = sy ?? t.h / 2;
      const x0 = c.cx - t.w / (2 * c.k);
      const y0 = c.cy - t.h / (2 * c.k);
      const planoX = x0 + px / c.k;
      const planoY = y0 + py / c.k;
      const [kMin, kMax] = kMinMax();
      const k = acotar(c.k * factor, kMin, kMax);
      const destino = {
        cx: planoX - px / k + t.w / (2 * k),
        cy: planoY - py / k + t.h / (2 * k),
        k,
      };
      if (animado) animarA(destino, 260);
      else {
        cortarAnimacion();
        aplicar(destino);
      }
    },
    [aplicar, animarA, cortarAnimacion, kMinMax]
  );

  const acercar = useCallback(() => zoomEn(1.6, undefined, undefined, true), [zoomEn]);
  const alejar = useCallback(() => zoomEn(1 / 1.6, undefined, undefined, true), [zoomEn]);

  /** "Ver todo el predio": el plano entero, aunque la pantalla sea angosta. */
  const ajustar = useCallback(() => {
    const t = tamRef.current;
    if (!t) return;
    ajustadoRef.current = false;
    animarA(encuadre(limRef.current, t));
  }, [animarA]);

  /** Lleva la cámara a un área del plano (por ejemplo, los puestos de alguien). */
  const enfocar = useCallback(
    (r: Rect) => {
      const t = tamRef.current;
      if (!t) return;
      ajustadoRef.current = false;
      const kFit = encuadre(limRef.current, t).k;
      const margen = 140;
      // Se encuadra en la parte visible (arriba del panel flotante, si hay).
      const alto = Math.max(t.h - insetRef.current, t.h * 0.35);
      const k = acotar(
        Math.min(t.w / (r.w + margen * 2), alto / (r.h + margen * 2)),
        kFit,
        kFit * ZOOM_ENFOQUE
      );
      animarA({ cx: r.x + r.w / 2, cy: r.y + r.h / 2 + (t.h - alto) / (2 * k), k });
    },
    [animarA]
  );

  /** Si el área no está entera a la vista, la trae al centro (foco con teclado). */
  const asegurarVisible = useCallback(
    (r: Rect) => {
      const c = camRef.current;
      const t = tamRef.current;
      if (!c || !t) return;
      const x0 = c.cx - t.w / (2 * c.k);
      const y0 = c.cy - t.h / (2 * c.k);
      const alto = Math.max(t.h - insetRef.current, t.h * 0.35);
      const x1 = x0 + t.w / c.k;
      const y1 = y0 + alto / c.k;
      const margen = 24 / c.k;
      const visible =
        r.x >= x0 + margen && r.y >= y0 + margen && r.x + r.w <= x1 - margen && r.y + r.h <= y1 - margen;
      if (visible) return;
      ajustadoRef.current = false;
      animarA({ cx: r.x + r.w / 2, cy: r.y + r.h / 2 + (t.h - alto) / (2 * c.k), k: c.k }, 260);
    },
    [animarA]
  );

  /** Acerca hasta `k` (px por unidad) si hoy se ve más chico; no aleja. */
  const asegurarZoom = useCallback(
    (k: number, centro?: Rect | null) => {
      const c = camRef.current;
      const t = tamRef.current;
      if (!c || !t || c.k >= k) return;
      ajustadoRef.current = false;
      const alto = Math.max(t.h - insetRef.current, t.h * 0.35);
      animarA({
        cx: centro ? centro.x + centro.w / 2 : c.cx,
        cy: centro ? centro.y + centro.h / 2 + (t.h - alto) / (2 * k) : c.cy,
        k,
      });
    },
    [animarA]
  );

  // ---------- Gestos: rueda (⌘/Ctrl) y pellizco de Safari ----------
  useEffect(() => {
    const el = contRef.current;
    if (!el) return;
    /** Alto del lienzo (para la rueda que avanza "de a página"). */
    const t0Alto = () => tamRef.current?.h ?? 600;
    const alRodar = (ev: WheelEvent) => {
      // El mapa ocupa toda la pantalla: la rueda (o dos dedos en el trackpad)
      // mueve el plano, como en Figma; ⌘/Ctrl + rueda y el pellizco del
      // trackpad (llega como rueda con ctrlKey) acercan o alejan.
      ev.preventDefault();
      const escalaDelta = ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? t0Alto() : 1;
      const dx = ev.deltaX * escalaDelta;
      const dy = ev.deltaY * escalaDelta;
      marcarRueda();
      if (ev.ctrlKey || ev.metaKey) {
        const r = el.getBoundingClientRect();
        zoomEn(Math.exp(-dy * 0.0045), ev.clientX - r.left, ev.clientY - r.top);
        return;
      }
      const c = camRef.current;
      if (!c) return;
      cortarAnimacion();
      ajustadoRef.current = false;
      aplicar({ cx: c.cx + dx / c.k, cy: c.cy + dy / c.k, k: c.k });
    };
    let escala0 = 1;
    const gestoInicio = (ev: Event) => {
      ev.preventDefault();
      escala0 = 1;
    };
    const gestoCambio = (ev: Event) => {
      ev.preventDefault();
      // En iPad el pellizco con los dedos ya llega por pointer events: acá
      // solo se atiende el trackpad de Safari (sin punteros activos).
      if (punteros.current.size > 0) return;
      const g = ev as Event & { scale: number; clientX?: number; clientY?: number };
      if (!Number.isFinite(g.scale) || g.scale <= 0) return;
      const r = el.getBoundingClientRect();
      const sx = Number.isFinite(g.clientX) ? (g.clientX as number) - r.left : r.width / 2;
      const sy = Number.isFinite(g.clientY) ? (g.clientY as number) - r.top : r.height / 2;
      marcarRueda();
      zoomEn(g.scale / escala0, sx, sy);
      escala0 = g.scale;
    };
    el.addEventListener("wheel", alRodar, { passive: false });
    el.addEventListener("gesturestart", gestoInicio);
    el.addEventListener("gesturechange", gestoCambio);
    const m = moviendo.current;
    return () => {
      if (m.rueda !== null) window.clearTimeout(m.rueda);
      m.rueda = null;
      el.removeEventListener("wheel", alRodar);
      el.removeEventListener("gesturestart", gestoInicio);
      el.removeEventListener("gesturechange", gestoCambio);
    };
  }, [zoomEn, marcarRueda, aplicar, cortarAnimacion]);

  useEffect(() => cortarAnimacion, [cortarAnimacion]);

  // ---------- Gestos: arrastrar y pellizcar (pointer events) ----------
  // El rectángulo del contenedor se mide al empezar el gesto (medirlo en cada
  // movimiento forzaría un recálculo de layout por cuadro).
  const rectGesto = useRef<DOMRect | null>(null);
  // Mientras dura el gesto (arrastre o pellizco), el <svg> lleva data-arrastrando.
  const marcarArrastre = (activo: boolean) => {
    moviendo.current.gesto = activo;
    marcarMovimiento();
  };
  const posicion = (ev: React.PointerEvent) => {
    const r = rectGesto.current ?? contRef.current?.getBoundingClientRect() ?? null;
    return { x: ev.clientX - (r?.left ?? 0), y: ev.clientY - (r?.top ?? 0) };
  };

  const alBajar = (ev: React.PointerEvent<SVGSVGElement>) => {
    if (ev.pointerType === "mouse" && ev.button !== 0) return;
    const c = camRef.current;
    if (!c) return;
    cortarAnimacion();
    if (punteros.current.size === 0) {
      rectGesto.current = contRef.current?.getBoundingClientRect() ?? null;
    }
    const p = posicion(ev);
    punteros.current.set(ev.pointerId, p);
    if (punteros.current.size === 1) {
      arrastro.current = false;
      gesto.current = { tipo: "posible", x0: p.x, y0: p.y, cam0: c };
    } else if (punteros.current.size === 2) {
      const [a, b] = [...punteros.current.values()];
      arrastro.current = true;
      ev.currentTarget.setPointerCapture(ev.pointerId);
      marcarArrastre(true);
      gesto.current = {
        tipo: "pinch",
        d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        cam0: c,
      };
    }
  };

  const alMover = (ev: React.PointerEvent<SVGSVGElement>) => {
    if (!punteros.current.has(ev.pointerId)) return;
    const p = posicion(ev);
    punteros.current.set(ev.pointerId, p);
    const g = gesto.current;
    const t = tamRef.current;
    if (!t) return;
    if (g.tipo === "posible") {
      if (Math.hypot(p.x - g.x0, p.y - g.y0) < UMBRAL_ARRASTRE) return;
      arrastro.current = true;
      ajustadoRef.current = false;
      ev.currentTarget.setPointerCapture(ev.pointerId);
      marcarArrastre(true);
      gesto.current = { ...g, tipo: "pan" };
    }
    const actual = gesto.current;
    if (actual.tipo === "pan") {
      aplicar({
        cx: actual.cam0.cx - (p.x - actual.x0) / actual.cam0.k,
        cy: actual.cam0.cy - (p.y - actual.y0) / actual.cam0.k,
        k: actual.cam0.k,
      });
    } else if (actual.tipo === "pinch" && punteros.current.size >= 2) {
      ajustadoRef.current = false;
      const [a, b] = [...punteros.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const { cam0, d0, m0 } = actual;
      const [kMin, kMax] = kMinMax();
      const k = acotar((cam0.k * d) / d0, kMin, kMax);
      // El punto del plano que estaba bajo los dedos sigue bajo los dedos.
      const planoX = cam0.cx - t.w / (2 * cam0.k) + m0.x / cam0.k;
      const planoY = cam0.cy - t.h / (2 * cam0.k) + m0.y / cam0.k;
      aplicar({
        cx: planoX - m.x / k + t.w / (2 * k),
        cy: planoY - m.y / k + t.h / (2 * k),
        k,
      });
    }
  };

  const alSoltar = (ev: React.PointerEvent<SVGSVGElement>) => {
    punteros.current.delete(ev.pointerId);
    if (ev.currentTarget.hasPointerCapture(ev.pointerId)) {
      ev.currentTarget.releasePointerCapture(ev.pointerId);
    }
    const c = camRef.current;
    if (punteros.current.size === 1 && c) {
      // De pellizco a arrastre con el dedo que queda.
      const [p] = [...punteros.current.values()];
      gesto.current = { tipo: "pan", x0: p.x, y0: p.y, cam0: c };
    } else if (punteros.current.size === 0) {
      gesto.current = { tipo: "nada" };
      rectGesto.current = null;
      marcarArrastre(false);
      // El click llega justo después del pointerup: recién después se limpia
      // el flag, así Enter/Espacio sobre un puesto no quedan bloqueados.
      window.setTimeout(() => {
        if (punteros.current.size === 0) arrastro.current = false;
      }, 0);
    }
  };

  /** Teclado sobre el plano: + / − / 0 y flechas. */
  const alTeclado = (ev: React.KeyboardEvent) => {
    const c = camRef.current;
    const t = tamRef.current;
    if (!c || !t) return;
    // Ctrl/⌘ + y demás atajos son del navegador (zoom de la página).
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const paso = 80 / c.k;
    const mover: Record<string, [number, number]> = {
      ArrowLeft: [-paso, 0],
      ArrowRight: [paso, 0],
      ArrowUp: [0, -paso],
      ArrowDown: [0, paso],
    };
    if (ev.key === "+" || ev.key === "=") {
      ev.preventDefault();
      acercar();
    } else if (ev.key === "-" || ev.key === "_") {
      ev.preventDefault();
      alejar();
    } else if (ev.key === "0") {
      ev.preventDefault();
      ajustar();
    } else if (mover[ev.key] && ev.target === ev.currentTarget) {
      ev.preventDefault();
      ajustadoRef.current = false;
      const [dx, dy] = mover[ev.key];
      animarA({ cx: c.cx + dx, cy: c.cy + dy, k: c.k }, 160);
    }
  };

  /** ¿El último gesto movió el plano? (así un arrastre no cuenta como toque) */
  const fueArrastre = useCallback(() => arrastro.current, []);
  /** Rectángulo del contenedor en pantalla (para ubicar carteles). */
  const rectContenedor = useCallback(() => contRef.current?.getBoundingClientRect() ?? null, []);

  let viewBox: string | null = null;
  if (cam && tam) {
    const w = tam.w / cam.k;
    const h = tam.h / cam.k;
    viewBox = `${cam.cx - w / 2} ${cam.cy - h / 2} ${w} ${h}`;
  }

  return {
    contRef,
    viewBox,
    /** px de pantalla por unidad del plano (para el zoom semántico). */
    escala: cam?.k ?? null,
    fueArrastre,
    rectContenedor,
    onPointerDown: alBajar,
    onPointerMove: alMover,
    onPointerUp: alSoltar,
    onPointerCancel: alSoltar,
    alTeclado,
    acercar,
    alejar,
    ajustar,
    enfocar,
    asegurarVisible,
    asegurarZoom,
  };
}
