"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Rol } from "@/lib/auth";
import { LABEL_GRUPO, NAVEGACION_SOCIO, navParaRol } from "@/lib/navegacion";
import { CAPITULOS_META, RECORRIDOS, capituloDeRuta, capituloSiguiente } from "@/lib/tour/indice";
import { memoria, type Retomar } from "@/lib/tour/memoria";
import {
  ATRIBUTO_CAPA,
  ancestrosQueRecortan,
  coincideRuta,
  esPatron,
  recortar,
  primeraVisible,
  resolverAnclas,
  rutaDeLink,
  ubicacionActual,
  type Resolucion,
} from "@/lib/tour/anclas";
import type { Capitulo, IdCapitulo, MetaCapitulo, Paso } from "@/lib/tour/tipos";
import { CapaTour } from "@/components/tour/capa-tour";

type Registro = typeof import("@/lib/tour/capitulos");

/** Paso del tour ya armado: los de contenido más los que agrega el motor. */
export type PasoTour = Paso & {
  /** "ir": llevar a la pantalla del capítulo. "fin": cierre (con "Seguir con…"). */
  especial?: "ir" | "fin";
};

type Modo = "capitulo" | "recorrido";

type Estado = {
  caps: IdCapitulo[];
  modo: Modo;
  iCap: number;
  iPaso: number;
  /** Por capítulo: si empieza con el paso "Vamos a…" (se decide al entrar al capítulo). */
  conIr: boolean[];
  /** Cuenta cada movimiento: un mismo paso visitado dos veces se resuelve de nuevo. */
  visita: number;
  /** Para dónde iba (un paso opcional sin ancla se saltea en esa dirección). */
  dir: 1 | -1;
};

type Fase = "navegando" | "buscando" | "listo";

type EstadoResolucion = {
  clave: string;
  fase: Fase;
  r: Resolucion | null;
};

type ApiTour = {
  rol: Rol;
  activo: boolean;
  /** `aqui`: «Cómo se usa esta pantalla»: arranca en el primer paso de la pantalla actual. */
  iniciarCapitulo: (id: IdCapitulo, opciones?: { aqui?: boolean }) => void;
  iniciarRecorrido: (desde?: IdCapitulo) => void;
  /** Recorrido cortado a la mitad (para ofrecer "Seguir donde quedaste"). */
  retomar: Retomar | null;
  seguirRecorrido: () => void;
  vistos: IdCapitulo[];
  /** El botón «Ayuda» late unos segundos (después de "Ahora no" en la bienvenida). */
  destacarAyuda: boolean;
  pedirDestacarAyuda: () => void;
  usuario: string;
};

const ContextoTour = createContext<ApiTour | null>(null);

export function useTour(): ApiTour {
  const api = useContext(ContextoTour);
  if (!api) throw new Error("useTour fuera de <ProveedorTour>");
  return api;
}

/** Cuánto se espera que aparezca lo que hay que señalar antes de mostrar el ejemplo. */
const ESPERA_ANCLA = 2200;
/** Recién llegada a otra pantalla (puede estar mostrando «cargando…»): se espera más. */
const ESPERA_ANCLA_NAVEGANDO = 6500;
/** Un paso opcional en la misma pantalla: si no está, se saltea rápido. */
const ESPERA_OPCIONAL = 900;
/** Después de mostrar el ejemplo, se sigue mirando un rato: si la pantalla llega tarde
 * (conexión lenta), se pasa a señalar lo real. */
const ESPERA_TARDIA = 12000;
/** Cuánto se espera una navegación que empezó la persona tocando un link. */
const ESPERA_NAVEGACION = 8000;
/** Lo que se puede tocar dentro de un ancla "tocá acá". */
const INTERACTIVOS = "a[href], button, [role='button'], [role='tab'], [role='link'], summary, label";

/** El link del menú que lleva a esa sección para ese rol (en el portal, las solicitudes
 * están dentro de «Mi cuenta»). */
function menuPara(rol: Rol, ruta: string): { href: string; label: string } | null {
  if (rol === "socio") {
    if (ruta.startsWith("/mi-cuenta/comunicaciones") || ruta.startsWith("/mi-cuenta/circulares"))
      return { href: "/mi-cuenta/comunicaciones", label: "Comunicaciones" };
    if (ruta.startsWith("/mi-cuenta")) return { href: "/mi-cuenta", label: NAVEGACION_SOCIO[0]?.label ?? "Mi cuenta" };
    return null;
  }
  const item = navParaRol(rol).find((i) => i.href === ruta);
  return item ? { href: item.href, label: item.label } : null;
}

function pasoIr(cap: Capitulo, rol: Rol): PasoTour {
  const titulo = cap.titulo(rol);
  const menu = cap.ruta ? menuPara(rol, cap.ruta) : null;
  const directo = menu !== null && menu.href === cap.ruta;
  return {
    id: "__ir",
    especial: "ir",
    ancla: menu ? `nav:${menu.href}` : undefined,
    accion: directo ? "tocar" : "mirar",
    titulo: `Vamos a «${titulo}»`,
    texto: !menu
      ? `${cap.resumen(rol)}. Tocá «Siguiente» y te llevo.`
      : directo
        ? `${cap.resumen(rol)}. Tocá «${menu.label}» en el menú, o tocá «Siguiente» y te llevo.`
        : `${cap.resumen(rol)}. Está dentro de «${menu.label}». Tocá «Siguiente» y te llevo.`,
  };
}

function pasoFin(cap: Capitulo, rol: Rol, modo: Modo): PasoTour {
  return modo === "recorrido"
    ? {
        id: "__fin",
        especial: "fin",
        ancla: "ayuda",
        titulo: "¡Terminaste el recorrido!",
        texto:
          "Ya conocés todo lo que usás en tu trabajo. Si algo no te acordás, tocá «Ayuda» en cualquier pantalla y te lo muestro de nuevo.",
      }
    : {
        id: "__fin",
        especial: "fin",
        ancla: "ayuda",
        titulo: `¡Listo! Ya conocés «${cap.titulo(rol)}»`,
        texto: "Cuando quieras repasarlo, tocá «Ayuda». Está siempre en el mismo lugar.",
      };
}

function armarPasos(reg: Registro, estado: Estado, i: number, rol: Rol): PasoTour[] {
  const cap = reg.capitulo(estado.caps[i]);
  const lista: PasoTour[] = [];
  if (estado.conIr[i]) lista.push(pasoIr(cap, rol));
  lista.push(...cap.pasos(rol));
  if (i === estado.caps.length - 1) lista.push(pasoFin(cap, rol, estado.modo));
  return lista;
}

/** La ruta con esos parámetros de query agregados o reemplazados ("?tab=paga"). */
function conQuery(ruta: string, query: string): string {
  const [path, actual = ""] = ruta.split("?");
  const params = new URLSearchParams(actual);
  for (const [clave, valor] of new URLSearchParams(query)) params.set(clave, valor);
  const q = params.toString();
  return q ? `${path}?${q}` : path;
}

/** El paso con los ajustes de la variante que corresponde (ancla encontrada o ninguna). */
function pasoEfectivo(paso: PasoTour, fase: Fase, r: Resolucion | null): PasoTour {
  if (fase !== "listo") return paso;
  if (r) return { ...paso, ...(paso.variantes?.[r.nombre] ?? {}) };
  if (paso.ancla) return { ...paso, ...(paso.sinAncla ?? {}) };
  return paso;
}

export function ProveedorTour({
  rol,
  usuario,
  children,
}: {
  rol: Rol;
  /** user_id: la memoria del tour es por persona y rol. */
  usuario: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [registro, setRegistro] = useState<Registro | null>(null);
  const [resolucion, setResolucion] = useState<EstadoResolucion | null>(null);
  const [reintento, setReintento] = useState(0);
  const [retomar, setRetomar] = useState<Retomar | null>(null);
  const [vistos, setVistos] = useState<IdCapitulo[]>([]);
  const [destacarAyuda, setDestacarAyuda] = useState(false);
  const [montado, setMontado] = useState(false);

  const pathnameRef = useRef(pathname);
  const navPendiente = useRef<{ destino: string; t: number } | null>(null);
  /** Pasos (clave) para los que el tour ya navegó: no se insiste (evita idas y vueltas). */
  const intentos = useRef(new Set<string>());
  /** Pasos (clave) a los que se llegó navegando: se espera más a que cargue la pantalla. */
  const navegados = useRef(new Set<string>());
  /** Pantallas [id] sin nada que abrir en este capítulo ("iCap:ruta"). */
  const sinDatos = useRef(new Set<string>());

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const cargarRegistro = useCallback(async (): Promise<Registro | null> => {
    try {
      const mod = await import("@/lib/tour/capitulos");
      setRegistro(mod);
      return mod;
    } catch {
      // Tablet abierta desde antes de una actualización, o sin red.
      toast.error("No se pudo abrir la guía", { description: "Recargá la página y probá de nuevo." });
      return null;
    }
  }, []);

  // Al montar: memoria del dispositivo y, si se recargó la página con un tour en curso, seguirlo.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setMontado(true);
      setRetomar(memoria.retomar(usuario, rol));
      setVistos(memoria.vistos(usuario, rol));
      const guardado = memoria.activo();
      if (
        guardado &&
        guardado.rol === rol &&
        guardado.usuario === usuario &&
        guardado.caps.length > 0 &&
        guardado.caps.every((c) => c in CAPITULOS_META)
      ) {
        void cargarRegistro().then((reg) => {
          if (!reg) return;
          const conIr = guardado.caps.map((_, i) => Boolean(guardado.conIr?.[i]));
          const iCap = Math.min(guardado.iCap, guardado.caps.length - 1);
          const total = armarPasos(reg, { caps: guardado.caps, modo: guardado.modo, iCap, iPaso: 0, conIr, visita: 0, dir: 1 }, iCap, rol).length;
          setEstado({
            caps: guardado.caps,
            modo: guardado.modo,
            iCap,
            iPaso: Math.min(guardado.iPaso, Math.max(total - 1, 0)),
            conIr,
            visita: 0,
            dir: 1,
          });
        });
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [usuario, rol, cargarRegistro]);

  // El tour en curso sobrevive a recargar la página.
  useEffect(() => {
    if (!montado) return;
    memoria.guardarActivo(
      estado
        ? { rol, usuario, caps: estado.caps, conIr: estado.conIr, modo: estado.modo, iCap: estado.iCap, iPaso: estado.iPaso }
        : null
    );
  }, [estado, rol, usuario, montado]);

  const pasos = useMemo(
    () => (registro && estado ? armarPasos(registro, estado, estado.iCap, rol) : []),
    [registro, estado, rol]
  );
  const idCapActual = estado ? estado.caps[estado.iCap] : null;
  const capActual = useMemo(
    () => (registro && idCapActual ? registro.capitulo(idCapActual) : null),
    [registro, idCapActual]
  );
  const paso: PasoTour | null = estado ? (pasos[estado.iPaso] ?? null) : null;
  const clave = estado && paso ? `${estado.visita}:${estado.iCap}:${estado.iPaso}:${paso.id}` : "";

  // Un estado sin paso (quedó guardado de otra versión): se termina en silencio.
  useEffect(() => {
    if (!estado || !registro || paso) return;
    const t = window.setTimeout(() => setEstado(null), 0);
    return () => window.clearTimeout(t);
  }, [estado, registro, paso]);

  /** ¿Hace falta "Vamos a…"? Si la pantalla actual ya es de ese capítulo, no. */
  const necesitaIr = useCallback(
    (cap: Capitulo) => Boolean(cap.ruta) && capituloDeRuta(rol, pathnameRef.current)?.id !== cap.id,
    [rol]
  );

  const iniciar = useCallback(
    async (caps: IdCapitulo[], modo: Modo, iCap = 0, aqui = false) => {
      const lista = caps.filter((c) => CAPITULOS_META[c].roles.includes(rol));
      if (lista.length === 0) return;
      const reg = await cargarRegistro();
      if (!reg) return;
      // Sin pasos para este rol (capítulo todavía vacío): no se ofrece.
      const conContenido = lista.filter((c) => reg.capitulo(c).pasos(rol).length > 0);
      if (conContenido.length === 0) return;
      const inicio = Math.min(iCap, conContenido.length - 1);
      const primera = reg.capitulo(conContenido[inicio]);
      const conIr = conContenido.map(() => false);
      conIr[inicio] = necesitaIr(primera);
      // «Cómo se usa esta pantalla» desde una sub-pantalla (la cuenta de un cliente): se
      // arranca en su primer paso, sin sacar a la persona de donde está.
      let iPaso = 0;
      if (aqui && !conIr[inicio]) {
        const donde = ubicacionActual();
        const i = primera.pasos(rol).findIndex((p) => {
          const ruta = p.ruta ?? primera.ruta;
          return ruta ? coincideRuta(donde, ruta) : false;
        });
        if (i > 0) iPaso = i;
      }
      intentos.current.clear();
      navegados.current.clear();
      sinDatos.current.clear();
      navPendiente.current = null;
      setEstado((prev) => ({
        caps: conContenido,
        modo,
        iCap: inicio,
        iPaso,
        conIr,
        visita: (prev?.visita ?? 0) + 1,
        dir: 1,
      }));
      if (modo === "recorrido") {
        memoria.guardarRetomar(usuario, rol, null);
        setRetomar(null);
      }
    },
    [cargarRegistro, rol, usuario, necesitaIr]
  );

  const marcarVisto = useCallback(
    (id: IdCapitulo) => {
      memoria.marcarVisto(usuario, rol, id);
      setVistos(memoria.vistos(usuario, rol));
    },
    [usuario, rol]
  );

  const terminar = useCallback(
    (cortado: boolean) => {
      if (estado && cortado && estado.modo === "recorrido" && estado.caps.length > 1) {
        const r: Retomar = { caps: estado.caps, iCap: estado.iCap };
        memoria.guardarRetomar(usuario, rol, r);
        setRetomar(r);
        toast("Guardé dónde quedaste", {
          description: "Para seguir, tocá «Ayuda» y elegí «Seguir donde quedaste».",
        });
      }
      setEstado(null);
      setResolucion(null);
    },
    [estado, usuario, rol]
  );

  const siguiente = useCallback(() => {
    if (!estado || !registro) return;
    if (estado.iPaso + 1 < pasos.length) {
      if (pasos[estado.iPaso + 1]?.especial === "fin") marcarVisto(estado.caps[estado.iCap]);
      setEstado({ ...estado, iPaso: estado.iPaso + 1, visita: estado.visita + 1, dir: 1 });
      return;
    }
    marcarVisto(estado.caps[estado.iCap]);
    if (estado.iCap + 1 < estado.caps.length) {
      const iCap = estado.iCap + 1;
      const conIr = [...estado.conIr];
      conIr[iCap] = necesitaIr(registro.capitulo(estado.caps[iCap]));
      setEstado({ ...estado, iCap, iPaso: 0, conIr, visita: estado.visita + 1, dir: 1 });
      return;
    }
    if (estado.modo === "recorrido") {
      memoria.guardarRetomar(usuario, rol, null);
      setRetomar(null);
    }
    terminar(false);
  }, [estado, registro, pasos, marcarVisto, terminar, usuario, rol, necesitaIr]);

  const anterior = useCallback(() => {
    if (!estado || !registro) return;
    if (estado.iPaso > 0) {
      setEstado({ ...estado, iPaso: estado.iPaso - 1, visita: estado.visita + 1, dir: -1 });
      return;
    }
    if (estado.iCap > 0) {
      const iCap = estado.iCap - 1;
      const previos = armarPasos(registro, { ...estado, iCap }, iCap, rol);
      setEstado({ ...estado, iCap, iPaso: Math.max(previos.length - 1, 0), visita: estado.visita + 1, dir: -1 });
    }
  }, [estado, registro, rol]);

  // Paso opcional sin su ancla: se saltea hacia donde iba (si va para atrás y ya es el
  // primero, para adelante).
  const saltar = useRef<() => void>(() => {});
  useEffect(() => {
    saltar.current = () => {
      if (!estado) return;
      if (estado.dir === -1 && (estado.iPaso > 0 || estado.iCap > 0)) anterior();
      else siguiente();
    };
  }, [estado, anterior, siguiente]);

  // Resolver el paso: llegar a su pantalla y encontrar lo que hay que señalar.
  useEffect(() => {
    if (!estado || !paso || !capActual) return;
    let vivo = true;
    let timer: number | undefined;
    const fijar = (fase: Fase, r: Resolucion | null = null) => {
      if (vivo) setResolucion({ clave, fase, r });
    };
    const destino = paso.especial ? undefined : (paso.ruta ?? capActual.ruta);
    const nombres = paso.ancla ? (Array.isArray(paso.ancla) ? paso.ancla : [paso.ancla]) : [];
    const suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const claveSinDatos = (ruta: string) => `${estado.iCap}:${ruta}`;

    const mostrar = (r: Resolucion) => {
      const el = r.el;
      const rect = el.getBoundingClientRect();
      const alto = window.innerHeight;
      const compacto = window.innerWidth < 640;
      const visible = recortar(rect, ancestrosQueRecortan(el));
      // Recortado por una lista con scroll (la barra lateral): se trae a la vista ahí adentro.
      const recortado = !visible || visible.height < rect.height - 1 || visible.width < rect.width - 1;
      // En el celular la tarjeta ocupa media pantalla: lo señalado va arriba, a la vista.
      const aLaVista = compacto
        ? rect.top >= 64 && rect.bottom <= alto * 0.44
        : rect.top >= 72 && rect.bottom <= alto - 96;
      if (recortado || !aLaVista) {
        const grande = rect.height > alto * (compacto ? 0.4 : 0.7);
        const arriba = compacto || grande;
        const margen = el.style.scrollMarginTop;
        if (arriba) el.style.scrollMarginTop = "76px";
        el.scrollIntoView({
          block: recortado && aLaVista ? "nearest" : arriba ? "start" : "center",
          inline: "nearest",
          behavior: suave ? "smooth" : "auto",
        });
        if (arriba) window.setTimeout(() => (el.style.scrollMarginTop = margen), 900);
      }
      fijar("listo", r);
    };

    // Ya se mostró el ejemplo: si lo real aparece después (pantalla lenta), se señala.
    const tardia = (desde: number) => {
      if (!vivo || nombres.length === 0 || Date.now() - desde > ESPERA_TARDIA) return;
      const r = resolverAnclas(nombres);
      if (r) return mostrar(r);
      timer = window.setTimeout(() => tardia(desde), 450);
    };

    const sinEncontrar = () => {
      if (paso.opcional) {
        saltar.current();
        return;
      }
      fijar("listo");
      tardia(Date.now());
    };

    const espera = navegados.current.has(clave)
      ? ESPERA_ANCLA_NAVEGANDO
      : paso.opcional
        ? ESPERA_OPCIONAL
        : ESPERA_ANCLA;

    const buscar = (desde: number) => {
      if (!vivo) return;
      if (nombres.length === 0) return fijar("listo");
      const r = resolverAnclas(nombres);
      if (r) return mostrar(r);
      if (Date.now() - desde > espera) return sinEncontrar();
      timer = window.setTimeout(() => buscar(desde), 150);
    };

    // Después de navegar a la misma ruta con otra query (una pestaña), la ruta no cambia:
    // se espera a que la ubicación llegue.
    const esperarLlegada = (desde: number) => {
      if (!vivo || !destino) return;
      if (coincideRuta(ubicacionActual(), destino)) {
        fijar("buscando");
        return buscar(Date.now());
      }
      if (Date.now() - desde > ESPERA_NAVEGACION) {
        fijar("listo");
        return tardia(Date.now());
      }
      timer = window.setTimeout(() => esperarLlegada(desde), 120);
    };

    const navegar = (ruta: string) => {
      intentos.current.add(clave);
      navegados.current.add(clave);
      fijar("navegando");
      router.push(ruta);
      esperarLlegada(Date.now());
    };

    // El link para entrar a una pantalla [id] puede tardar (la lista carga): se espera un poco.
    const buscarEntrada = (desde: number, pathDestino: string, queryDestino: string | undefined) => {
      if (!vivo || !destino) return;
      const link = paso.entrar ? primeraVisible(paso.entrar) : null;
      const ruta = link ? rutaDeLink(link) : null;
      if (ruta) return navegar(queryDestino ? conQuery(ruta, queryDestino) : ruta);
      if (Date.now() - desde < espera) {
        timer = window.setTimeout(() => buscarEntrada(desde, pathDestino, queryDestino), 150);
        return;
      }
      // Sin nada que abrir (lista vacía): el paso se cuenta con su pantalla de ejemplo.
      sinDatos.current.add(claveSinDatos(destino));
      return paso.opcional ? saltar.current() : fijar("listo");
    };

    const arrancar = () => {
      if (!vivo) return;
      if (destino && !coincideRuta(ubicacionActual(), destino)) {
        // La persona ya tocó un link que lleva ahí: se espera esa navegación.
        const pendiente = navPendiente.current;
        if (pendiente && coincideRuta(pendiente.destino, destino)) {
          const falta = ESPERA_NAVEGACION - (Date.now() - pendiente.t);
          if (falta > 0) {
            navegados.current.add(clave);
            fijar("navegando");
            esperarLlegada(pendiente.t);
            return;
          }
        }
        // Ya se navegó para este paso y no se llegó (redirigió, o volvió con el botón del
        // teléfono): se muestra sin señalar, sin insistir.
        if (intentos.current.has(clave)) return fijar("listo");
        // Ya está en la pantalla pero no en la pestaña (la query de la ruta): se abre la pestaña.
        const [pathDestino, queryDestino] = destino.split("?");
        if (queryDestino && coincideRuta(window.location.pathname, pathDestino)) {
          return navegar(conQuery(ubicacionActual(), queryDestino));
        }
        if (esPatron(destino)) {
          if (sinDatos.current.has(claveSinDatos(destino))) return paso.opcional ? saltar.current() : fijar("listo");
          // El link para entrar está en la pantalla del capítulo: si la persona está en otra
          // (volvió con «Atrás» desde otro capítulo), primero se va ahí.
          const lista = capActual.ruta;
          if (paso.entrar && lista && !primeraVisible(paso.entrar) && !coincideRuta(window.location.pathname, lista)) {
            navegados.current.add(clave);
            fijar("navegando");
            router.push(lista);
            return;
          }
          fijar("buscando");
          return buscarEntrada(Date.now(), pathDestino, queryDestino);
        }
        return navegar(destino);
      }
      navPendiente.current = null;
      fijar("buscando");
      buscar(Date.now());
    };

    timer = window.setTimeout(arrancar, 0);
    return () => {
      vivo = false;
      window.clearTimeout(timer);
    };
    // `pathname` y `reintento` vuelven a resolver: llegó la pantalla o se perdió el elemento.
  }, [clave, pathname, reintento, estado, paso, capActual, router]);

  const res = resolucion && resolucion.clave === clave ? resolucion : null;
  const fase: Fase = res?.fase ?? "buscando";
  const r = res?.r ?? null;

  // Si se señaló "por dónde se llega" (grupo plegado), apenas aparece el link se pasa a él
  // (y se lo trae a la vista dentro de la lista, para no iluminar otra cosa).
  useEffect(() => {
    if (!r?.via || r.via.tipo !== "grupo") return;
    const id = window.setInterval(() => {
      const el = primeraVisible(r.nombre);
      if (!el) return;
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
      setResolucion((prev) => (prev && prev.clave === clave ? { ...prev, r: { el, nombre: r.nombre, via: null } } : prev));
    }, 250);
    return () => window.clearInterval(id);
  }, [r, clave]);

  // Si lo señalado cambia de estado (el plano abre una tarjeta y su ancla cambia), se vuelve
  // a resolver: puede corresponder otra variante (por ejemplo, pasar de «tocá» a «mirá»).
  useEffect(() => {
    if (!r?.el) return;
    const obs = new MutationObserver(() => setReintento((n) => n + 1));
    obs.observe(r.el, { attributes: true, attributeFilter: ["data-tour"] });
    return () => obs.disconnect();
  }, [r]);

  const efectivo = useMemo(() => {
    if (!paso) return null;
    const base = pasoEfectivo(paso, fase, r);
    // En la tablet la sección está dentro de «Menú» (una hoja que no se abre durante la
    // guía): no se invita a tocar; «Siguiente» lleva.
    if (r?.via?.tipo === "menu") {
      return {
        ...base,
        accion: "mirar" as const,
        texto: base.especial === "ir" && capActual ? `${capActual.resumen(rol)}. Tocá «Siguiente» y te llevo.` : base.texto,
      };
    }
    return base;
  }, [paso, fase, r, capActual, rol]);

  const permitirToque = Boolean(efectivo && efectivo.accion === "tocar" && r && (!r.via || r.via.tipo === "grupo"));

  // "Tocá acá": si toca lo señalado, el tour sigue solo (y espera la pantalla nueva). Lo
  // que no es lo señalado no se puede tocar aunque caiga adentro del hueco (un panel encima).
  useEffect(() => {
    if (!permitirToque || !r) return;
    const objetivo = r.el;
    let apoyo: { x: number; y: number } | null = null;
    const esAjeno = (t: EventTarget | null) =>
      t instanceof Element && !objetivo.contains(t) && !t.closest(`[${ATRIBUTO_CAPA}]`);
    const alApoyar = (e: PointerEvent) => {
      if (esAjeno(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        apoyo = null;
        return;
      }
      apoyo = e.target instanceof Node && objetivo.contains(e.target) ? { x: e.clientX, y: e.clientY } : null;
    };
    const alTocar = (e: MouseEvent) => {
      if (esAjeno(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (!(e.target instanceof Element) || !objetivo.contains(e.target)) return;
      // Un campo (buscar, filtrar): toca para escribir; el tour espera su «Siguiente».
      if (e.target.closest("input, textarea, select, [contenteditable='true']")) return;
      // Arrastró (mover el plano): no es un toque.
      if (apoyo && Math.hypot(e.clientX - apoyo.x, e.clientY - apoyo.y) > 10) return;
      // En un grupo de botones (pestañas, filtros), solo cuenta si tocó uno.
      const accionable = e.target.closest(INTERACTIVOS);
      const tieneInteractivos = objetivo.matches(INTERACTIVOS) || objetivo.querySelector(INTERACTIVOS) !== null;
      if (tieneInteractivos && (!accionable || !objetivo.contains(accionable))) return;
      // Por el grupo plegado se llega al link: tocar el grupo solo lo abre.
      if (r.via) return;
      const link = accionable?.closest<HTMLAnchorElement>("a[href]") ?? null;
      const destino = link && objetivo.contains(link) ? rutaDeLink(link) : null;
      if (destino) navPendiente.current = { destino, t: Date.now() };
      window.setTimeout(siguiente, 0);
    };
    document.addEventListener("pointerdown", alApoyar, true);
    document.addEventListener("click", alTocar, true);
    return () => {
      document.removeEventListener("pointerdown", alApoyar, true);
      document.removeEventListener("click", alTocar, true);
    };
  }, [permitirToque, r, siguiente]);

  const pista = useMemo(() => {
    if (!r?.via || !paso) return null;
    const label = paso.especial === "ir" && capActual?.ruta ? (menuPara(rol, capActual.ruta)?.label ?? null) : null;
    if (r.via.tipo === "grupo") {
      const grupo = LABEL_GRUPO[r.via.grupo];
      if (!permitirToque) return label ? `«${label}» está dentro de «${grupo}».` : `Está dentro de «${grupo}».`;
      return label ? `«${label}» está dentro de «${grupo}»: tocalo para abrirlo.` : `Está dentro de «${grupo}»: tocalo para abrirlo.`;
    }
    return label
      ? `En la tablet y el celular, «${label}» está dentro de «Menú», el último botón de abajo.`
      : "En la tablet y el celular, está dentro de «Menú», el último botón de abajo.";
  }, [r, paso, capActual, rol, permitirToque]);

  const iniciarCapitulo = useCallback(
    (id: IdCapitulo, opciones?: { aqui?: boolean }) => void iniciar([id], "capitulo", 0, Boolean(opciones?.aqui)),
    [iniciar]
  );
  const iniciarRecorrido = useCallback(
    (desde?: IdCapitulo) => {
      const caps = RECORRIDOS[rol] ?? [];
      void iniciar(caps, "recorrido", desde ? Math.max(caps.indexOf(desde), 0) : 0);
    },
    [iniciar, rol]
  );
  const seguirRecorrido = useCallback(() => {
    if (retomar) void iniciar(retomar.caps, "recorrido", retomar.iCap);
  }, [iniciar, retomar]);
  const pedirDestacarAyuda = useCallback(() => {
    setDestacarAyuda(true);
    window.setTimeout(() => setDestacarAyuda(false), 6000);
  }, []);

  const api = useMemo<ApiTour>(
    () => ({
      rol,
      usuario,
      activo: Boolean(estado),
      iniciarCapitulo,
      iniciarRecorrido,
      retomar,
      seguirRecorrido,
      vistos,
      destacarAyuda,
      pedirDestacarAyuda,
    }),
    [rol, usuario, estado, iniciarCapitulo, iniciarRecorrido, retomar, seguirRecorrido, vistos, destacarAyuda, pedirDestacarAyuda]
  );

  const siguienteCap: MetaCapitulo | null =
    estado && capActual && estado.modo === "capitulo" ? capituloSiguiente(rol, capActual.id) : null;

  // Durante el tour la pantalla de atrás no se puede usar tampoco con el teclado ni el lector
  // de pantalla; solo en los pasos "tocá acá" queda libre (lo demás lo frenan los bloqueadores).
  const fondoBloqueado = Boolean(estado) && !permitirToque;

  return (
    <ContextoTour.Provider value={api}>
      <div className="contents" inert={fondoBloqueado}>
        {children}
      </div>
      {montado && estado && capActual && efectivo
        ? createPortal(
            <CapaTour
              clave={clave}
              rol={rol}
              paso={efectivo}
              fase={fase}
              objetivo={r?.el ?? null}
              pista={pista}
              permitirToque={permitirToque}
              capitulo={capActual}
              modo={estado.modo}
              iCap={estado.iCap}
              totalCaps={estado.caps.length}
              iPaso={estado.iPaso}
              totalPasos={pasos.length}
              siguienteCapitulo={siguienteCap}
              onSiguiente={siguiente}
              onAnterior={anterior}
              onCerrar={() => terminar(efectivo.especial !== "fin")}
              onSeguirCon={(id) => void iniciar([id], "capitulo")}
              onPerdido={() => setReintento((n) => n + 1)}
            />,
            document.body
          )
        : null}
    </ContextoTour.Provider>
  );
}
