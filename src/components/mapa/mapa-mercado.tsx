"use client";

import { useCallback, useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Maximize2, Minimize2, Paintbrush } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFraccion, formatNumero } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { asignarEspacios, editarEspacio } from "@/lib/actions/mapa";
import { BuscadorMapa, type ResultadoBusqueda } from "./buscador-mapa";
import {
  alturaDe,
  armarBloques,
  cantidad,
  diferencias,
  etiquetaEspacios,
  limitesPlano,
  NOMBRE_TIPO,
  numeroVisible,
  REPOSO,
  unidades,
  unir,
  type Bloque,
  type EstadoBloque,
  type Marca,
} from "./geometria";
import { LienzoPlano, type ControlLienzo } from "./lienzo-plano";
import { PanelAsignacion, type Confirmacion, type Revision, type Sugerencia } from "./panel-asignacion";
import { PanelDetalle } from "./panel-detalle";
import {
  anilloDe,
  repartirFichas,
  sembrarArboles,
  type Anillo,
  type DatosPastilla,
  type EstiloBloque,
  type FichaQuintero,
} from "./plano-svg";
import { deTotal, ResumenMapa, type Filtro, type Resumen } from "./resumen-mapa";
import type { ClienteMapa, Destinos, ElementoPlano, Espacio, EstadoCobro, Rect } from "./tipos";

/** Plano real del mercado: cada puesto pintado según el estado de cobro de
 * quien lo ocupa. Tocar un puesto ilumina todos los espacios de ese puestero.
 * Administración y el Líder cargan la ocupación con "Asignar puestos": eligen
 * un puestero (el pincel) y tocan sus puestos; cada toque se guarda solo. */

type Seleccion = { tipo: "cliente"; id: string } | { tipo: "espacio"; id: string } | null;
type Modo = "ver" | "asignar";

type Cambio =
  | { tipo: "asignar"; ids: string[]; clienteId: string | null }
  | { tipo: "editar"; id: string; numero: string | null; medio: boolean; nota: string | null };

function aplicarCambio(actual: Espacio[], c: Cambio): Espacio[] {
  if (c.tipo === "asignar") {
    const ids = new Set(c.ids);
    return actual.map((e) => (ids.has(e.id) ? { ...e, clienteId: c.clienteId } : e));
  }
  return actual.map((e) =>
    e.id === c.id ? { ...e, numero: c.numero, medio: c.medio, nota: c.nota } : e
  );
}

const TEXTO_ESTADO: Record<EstadoCobro, string> = {
  al_dia: "al día",
  debe: "debe el mes",
  vencido: "con deuda atrasada",
};

/** Estado en la pastilla de la selección ("Don Pedro · 4 puestos · al día"). */
const ESTADO_PASTILLA: Record<EstadoCobro, string> = {
  al_dia: "al día",
  debe: "debe el mes",
  vencido: "deuda atrasada",
};

const SELLO: Record<EstadoCobro, { estado: string; texto?: string }> = {
  al_dia: { estado: "al_dia" },
  debe: { estado: "debe", texto: "Debe el mes" },
  vencido: { estado: "vencido", texto: "Deuda atrasada" },
};

type PasoAsignacion = { ids: string[]; clienteId: string | null; actual: string | null };

/** Espacios agrupados por quién los tiene hoy: [dueño (null = libre), ids]. */
function agruparPorDuenio(espacios: Espacio[]): [string | null, string[]][] {
  const m = new Map<string | null, string[]>();
  for (const e of espacios) {
    const l = m.get(e.clienteId);
    if (l) l.push(e.id);
    else m.set(e.clienteId, [e.id]);
  }
  return [...m.entries()];
}

function nombreEspacio(e: Espacio): string {
  return e.tipo === "bar" ? "Bar" : `${NOMBRE_TIPO[e.tipo]} ${numeroVisible(e)}`;
}

/** "Puesto 52", "Puestos 50 · 48 · 46", "3 espacios". */
function nombreVarios(espacios: Espacio[]): string {
  if (espacios.length === 1) return nombreEspacio(espacios[0]);
  const tipos = new Set(espacios.map((e) => e.tipo));
  return tipos.size === 1 ? etiquetaEspacios(espacios) : `${espacios.length} espacios`;
}

export function MapaMercado({
  espacios,
  elementos,
  clientes,
  puedeEditar,
  destinos,
  soloQuinteros,
  inicial,
}: {
  espacios: Espacio[];
  elementos: ElementoPlano[];
  clientes: ClienteMapa[];
  puedeEditar: boolean;
  destinos: Destinos;
  /** Jefe de Portería: solo cobra quinteros. */
  soloQuinteros: boolean;
  inicial: { clienteId: string | null; puesto: string | null; editar: boolean };
}) {
  const [plano, cambiarPlano] = useOptimistic(espacios, aplicarCambio);
  const [guardando, startTransition] = useTransition();
  const lienzo = useRef<ControlLienzo>(null);

  const clientePorId = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);
  const clienteInicial =
    inicial.clienteId && clientePorId.has(inicial.clienteId) ? inicial.clienteId : null;
  const espacioInicial = useMemo(
    () =>
      inicial.puesto
        ? espacios.find((e) => e.tipo === "puesto" && e.numero === inicial.puesto) ?? null
        : null,
    [espacios, inicial.puesto]
  );

  const [modo, setModo] = useState<Modo>(() =>
    inicial.editar && puedeEditar ? "asignar" : "ver"
  );
  const [pincel, setPincel] = useState<string | null>(() =>
    inicial.editar && puedeEditar ? clienteInicial : null
  );
  const [seleccion, setSeleccion] = useState<Seleccion>(() => {
    if (clienteInicial && !(inicial.editar && puedeEditar)) return { tipo: "cliente", id: clienteInicial };
    if (espacioInicial) {
      return espacioInicial.clienteId
        ? { tipo: "cliente", id: espacioInicial.clienteId }
        : { tipo: "espacio", id: espacioInicial.id };
    }
    return null;
  });
  const [filtro, setFiltro] = useState<Filtro | null>(null);
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);
  const [sugerencia, setSugerencia] = useState<Sugerencia | null>(null);
  const [pantallaCompleta, setPantallaCompleta] = useState(false);

  // ---------- Derivados ----------
  const limites = useMemo(() => limitesPlano(elementos, espacios), [elementos, espacios]);
  // Decorado del fondo: árboles en el espacio libre (no dependen de la ocupación).
  const arboles = useMemo(() => sembrarArboles(elementos, espacios, limites), [elementos, espacios, limites]);
  const bloques = useMemo(() => armarBloques(plano), [plano]);
  const espacioPorId = useMemo(() => new Map(plano.map((e) => [e.id, e])), [plano]);
  const bloquePorEspacio = useMemo(() => {
    const m = new Map<string, Bloque>();
    for (const b of bloques) for (const e of b.espacios) m.set(e.id, b);
    return m;
  }, [bloques]);
  const porCliente = useMemo(() => {
    const m = new Map<string, Espacio[]>();
    for (const e of plano) {
      if (!e.clienteId) continue;
      const l = m.get(e.clienteId);
      if (l) l.push(e);
      else m.set(e.clienteId, [e]);
    }
    return m;
  }, [plano]);

  const estadoDe = useCallback(
    (clienteId: string | null): EstadoBloque => {
      if (!clienteId) return "libre";
      return clientePorId.get(clienteId)?.estado ?? "ocupado";
    },
    [clientePorId]
  );

  // Quinteros: fichas repartidas en las zonas verdes (no tienen puesto numerado).
  const { fichasBase, restos } = useMemo(() => {
    const quinteros = clientes.filter((c) => c.facturado.quintas > 0);
    const zonas = elementos.filter((e) => e.tipo === "quinteros").sort((a, b) => a.x - b.x);
    if (zonas.length === 0 || quinteros.length === 0) return { fichasBase: [], restos: [] };
    const porZona = Math.ceil(quinteros.length / zonas.length);
    const repartos = zonas.map((z, i) =>
      repartirFichas(
        z,
        quinteros
          .slice(i * porZona, (i + 1) * porZona)
          .map((c) => ({ clienteId: c.id, texto: c.apodo ?? c.nombre }))
      )
    );
    return {
      fichasBase: repartos.flatMap((r) => r.fichas),
      restos: repartos.flatMap((r) => (r.resto ? [r.resto] : [])),
    };
  }, [clientes, elementos]);

  // Hasta dónde llegan las fichas en cada cantero: debajo, el plano dibuja surcos.
  const finFichas = useMemo(() => {
    const m = new Map<string, number>();
    const rects = [...fichasBase.map((f) => f.rect), ...restos.map((r) => r.rect)];
    for (const z of elementos) {
      if (z.tipo !== "quinteros") continue;
      for (const r of rects) {
        if (r.x < z.x || r.x >= z.x + z.w || r.y < z.y || r.y >= z.y + z.h) continue;
        m.set(z.id, Math.max(m.get(z.id) ?? r.y + r.h, r.y + r.h));
      }
    }
    return m;
  }, [fichasBase, restos, elementos]);

  const clienteSel = seleccion?.tipo === "cliente" ? seleccion.id : null;
  const espacioSelId = seleccion?.tipo === "espacio" ? seleccion.id : null;
  // Con selección o filtro, lo que no coincide pierde la pintura (y el fondo se vela).
  const atenuar = filtro !== null || (modo === "ver" && clienteSel !== null);

  const estilos = useMemo(() => {
    const avisos = new Set(confirmacion ? [confirmacion.espacioId] : sugerencia?.espacioIds ?? []);
    const m = new Map<string, EstiloBloque>();
    for (const b of bloques) {
      const cli = b.clienteId ? clientePorId.get(b.clienteId) ?? null : null;
      const estado = estadoDe(b.clienteId);
      let atenuado = false;
      if (filtro) atenuado = estado !== filtro;
      else if (modo === "ver" && clienteSel) atenuado = b.clienteId !== clienteSel;
      let marca: Marca = null;
      if (
        (modo === "ver" && clienteSel !== null && b.clienteId === clienteSel) ||
        (espacioSelId !== null && b.espacios.some((e) => e.id === espacioSelId))
      ) {
        marca = "seleccion";
      } else if (modo === "asignar" && pincel !== null && b.clienteId === pincel) {
        marca = "pincel";
      } else if (b.espacios.some((e) => avisos.has(e.id))) {
        marca = "aviso";
      }
      m.set(b.clave, {
        estado,
        atenuado,
        marca,
        etiqueta: cli ? cli.apodo ?? cli.nombre : b.espacios.find((e) => e.nota)?.nota ?? null,
      });
    }
    return m;
  }, [bloques, clientePorId, estadoDe, filtro, modo, clienteSel, espacioSelId, pincel, confirmacion, sugerencia]);

  const fichas = useMemo<FichaQuintero[]>(
    () =>
      fichasBase.map((f) => {
        const estado = estadoDe(f.clienteId);
        return {
          ...f,
          estado,
          atenuado: filtro ? estado !== filtro : modo === "ver" && clienteSel !== null && clienteSel !== f.clienteId,
          seleccionado: clienteSel === f.clienteId,
          pincel: modo === "asignar" && pincel === f.clienteId,
        };
      }),
    [fichasBase, estadoDe, filtro, modo, clienteSel, pincel]
  );

  // Anillos sobre la tapa de cada bloque destacado, a su altura en reposo (el
  // lienzo los levanta con el hover y el foco de teclado).
  const anillos = useMemo<Anillo[]>(() => {
    const a: Anillo[] = [];
    const poner = (b: Bloque | undefined, rect: Rect, tono: Anillo["tono"]) => {
      const estilo = b ? estilos.get(b.clave) : undefined;
      if (b && estilo) a.push(anilloDe(b, rect, tono, alturaDe(b, estilo, REPOSO)));
    };
    const destacado = modo === "asignar" ? pincel : clienteSel;
    if (destacado) {
      for (const b of bloques) {
        if (b.clienteId === destacado) poner(b, b.rect, modo === "asignar" ? "pincel" : "seleccion");
      }
    }
    if (espacioSelId) {
      const e = espacioPorId.get(espacioSelId);
      if (e) poner(bloquePorEspacio.get(e.id), e, "seleccion");
    }
    if (confirmacion) {
      const e = espacioPorId.get(confirmacion.espacioId);
      if (e) poner(bloquePorEspacio.get(e.id), e, "aviso");
    }
    if (sugerencia && !confirmacion) {
      for (const id of sugerencia.espacioIds) {
        const e = espacioPorId.get(id);
        if (e) poner(bloquePorEspacio.get(e.id), e, "aviso");
      }
    }
    return a;
  }, [bloques, bloquePorEspacio, espacioPorId, estilos, modo, pincel, clienteSel, espacioSelId, confirmacion, sugerencia]);

  // Pastilla de la selección: "Don Pedro · 4 puestos · al día".
  const pastilla = useMemo<DatosPastilla | null>(() => {
    if (modo !== "ver" || !clienteSel) return null;
    const cli = clientePorId.get(clienteSel);
    const suyos = porCliente.get(clienteSel);
    if (!cli || !suyos?.length) return null;
    const partes = (
      [
        ["puesto", unidades(suyos)],
        // El bar se concesiona como un local.
        ["local", suyos.filter((e) => e.tipo === "local" || e.tipo === "bar").length],
        ["contenedor", suyos.filter((e) => e.tipo === "contenedor").length],
      ] as const
    )
      .filter(([, n]) => n > 0)
      .map(([tipo, n]) => cantidad(n, tipo));
    return {
      texto: `${cli.apodo ?? cli.nombre} · ${partes.join(" + ")} · ${ESTADO_PASTILLA[cli.estado]}`,
      estado: cli.estado,
    };
  }, [modo, clienteSel, clientePorId, porCliente]);

  const resumen = useMemo<Resumen>(() => {
    const puestos: Record<Filtro, number> = { al_dia: 0, debe: 0, vencido: 0, libre: 0 };
    let totalPuestos = 0;
    let locales = 0;
    let localesOcupados = 0;
    let contenedores = 0;
    let contenedoresOcupados = 0;
    for (const e of plano) {
      if (e.tipo === "puesto") {
        const u = e.medio ? 0.5 : 1;
        totalPuestos += u;
        const est = estadoDe(e.clienteId);
        puestos[est === "ocupado" ? "al_dia" : est] += u;
      } else if (e.tipo === "local") {
        locales++;
        if (e.clienteId) localesOcupados++;
      } else if (e.tipo === "contenedor") {
        contenedores++;
        if (e.clienteId) contenedoresOcupados++;
      }
    }
    const capacidadCocheras = elementos
      .filter((el) => el.tipo === "cocheras")
      .reduce((acc, el) => acc + (el.capacidad ?? 0), 0);
    const cocheras = clientes.reduce((acc, c) => acc + c.facturado.cocheras, 0);
    const quinteros = clientes.filter((c) => c.facturado.quintas > 0).length;
    const galpones = clientes.reduce((acc, c) => acc + c.facturado.galpones, 0);
    const secundarios = [
      { label: "Locales", valor: deTotal(localesOcupados, locales) },
      { label: "Contenedores", valor: deTotal(contenedoresOcupados, contenedores) },
      ...(capacidadCocheras > 0
        ? [{ label: "Cocheras", valor: `${formatFraccion(cocheras)} de ${formatNumero(capacidadCocheras)}` }]
        : []),
      { label: "Quinteros", valor: formatNumero(quinteros) },
      ...(galpones > 0 ? [{ label: "Galpones", valor: formatFraccion(galpones) }] : []),
    ];
    return { puestos, totalPuestos, secundarios };
  }, [plano, elementos, clientes, estadoDe]);

  const revisiones = useMemo<Revision[]>(() => {
    const r: Revision[] = [];
    for (const c of clientes) {
      for (const d of diferencias(c, porCliente.get(c.id) ?? [])) {
        r.push({ tipo: d.enPlano < d.facturado ? "falta" : "sobra", cliente: c, dif: d });
      }
    }
    const porNumero = new Map<string, Espacio[]>();
    for (const e of plano) {
      if (e.tipo === "bar") continue;
      if (e.numero === null) {
        if (e.tipo === "puesto") r.push({ tipo: "sin_numero", espacio: e });
        continue;
      }
      const clave = `${e.tipo}:${e.numero}`;
      const l = porNumero.get(clave);
      if (l) l.push(e);
      else porNumero.set(clave, [e]);
    }
    for (const l of porNumero.values()) {
      if (l.length < 2) continue;
      const e = l[0];
      r.push({
        tipo: "repetido",
        numero: e.tipo === "puesto" ? e.numero ?? "?" : `${NOMBRE_TIPO[e.tipo].toLowerCase()} ${e.numero}`,
        espacios: l,
      });
    }
    return r;
  }, [clientes, porCliente, plano]);

  // ---------- Acciones ----------

  const enfocarCliente = useCallback(
    (clienteId: string) => {
      const suyos = porCliente.get(clienteId);
      if (suyos?.length) {
        lienzo.current?.enfocar(unir(suyos));
        return;
      }
      const ficha = fichasBase.find((f) => f.clienteId === clienteId);
      if (ficha) {
        lienzo.current?.enfocar(ficha.rect);
        return;
      }
      // Quintero que no entró en las fichas: se muestra la zona de quinteros.
      if ((clientePorId.get(clienteId)?.facturado.quintas ?? 0) > 0) {
        const zonas = elementos.filter((el) => el.tipo === "quinteros");
        if (zonas.length > 0) lienzo.current?.enfocar(unir(zonas));
      }
    },
    [porCliente, fichasBase, clientePorId, elementos]
  );

  /** Guarda uno o más cambios de dueño (optimistas) en una sola transición y
   * avisa cuando terminan todos. Cada paso dice a quién le figuraban hoy esos
   * espacios: si otra persona los cambió, el servidor rechaza en vez de pisar. */
  const guardarAsignacion = useCallback(
    (pasos: PasoAsignacion[], alTerminar: (error: string | null) => void) => {
      startTransition(async () => {
        for (const p of pasos) cambiarPlano({ tipo: "asignar", ids: p.ids, clienteId: p.clienteId });
        const resultados = await Promise.all(
          pasos.map((p) =>
            asignarEspacios({ espacios: p.ids, cliente_id: p.clienteId, actual: p.actual })
          )
        );
        const falla = resultados.find((r) => !r.ok);
        alTerminar(falla && !falla.ok ? falla.error : null);
      });
    },
    [cambiarPlano]
  );

  const asignar = useCallback(
    (ids: string[], clienteId: string | null) => {
      const afectados = ids.flatMap((id) => espacioPorId.get(id) ?? []);
      if (afectados.length === 0) return;
      const pasos = agruparPorDuenio(afectados).map(([actual, lista]) => ({
        ids: lista,
        clienteId,
        actual,
      }));
      guardarAsignacion(pasos, (error) => {
        if (error) {
          toast.error(error, { id: "mapa-asignacion" });
          return;
        }
        const cli = clienteId ? clientePorId.get(clienteId) : null;
        const que = nombreVarios(afectados);
        toast.success(cli ? `${que} → ${cli.apodo ?? cli.nombre}` : `${que}: quedó libre`, {
          id: "mapa-asignacion",
          action: {
            label: "Deshacer",
            onClick: () => {
              // Cada espacio vuelve a quien lo tenía antes.
              const vuelta = agruparPorDuenio(afectados).map(([previo, lista]) => ({
                ids: lista,
                clienteId: previo,
                actual: clienteId,
              }));
              guardarAsignacion(vuelta, (err) => {
                if (err) toast.error(err, { id: "mapa-asignacion" });
                else toast("Listo, quedó como estaba.", { id: "mapa-asignacion" });
              });
            },
          },
        });
      });
    },
    [espacioPorId, clientePorId, guardarAsignacion]
  );

  const tocarConPincel = useCallback(
    (e: Espacio, duenioPincel: string) => {
      if (e.clienteId === duenioPincel) {
        setSugerencia(null);
        asignar([e.id], null);
        return;
      }
      if (e.clienteId) {
        setSugerencia(null);
        setConfirmacion({ espacioId: e.id, deClienteId: e.clienteId, aClienteId: duenioPincel });
        return;
      }
      setConfirmacion(null);
      asignar([e.id], duenioPincel);
      // El plano original junta este puesto con otros: se ofrece sumarlos.
      const otros = e.grupo
        ? plano.filter((x) => x.grupo === e.grupo && x.id !== e.id && x.clienteId === null)
        : [];
      setSugerencia(
        otros.length > 0
          ? { espacioIds: otros.map((o) => o.id), clienteId: duenioPincel, baseId: e.id }
          : null
      );
    },
    [asignar, plano]
  );

  const tocarEspacio = useCallback(
    (e: Espacio) => {
      if (modo === "asignar") {
        if (pincel) {
          tocarConPincel(e, pincel);
          return;
        }
        setConfirmacion(null);
        setSugerencia(null);
        setSeleccion((s) => (s?.tipo === "espacio" && s.id === e.id ? null : { tipo: "espacio", id: e.id }));
        return;
      }
      setFiltro(null);
      if (e.clienteId) {
        const id = e.clienteId;
        setSeleccion((s) => (s?.tipo === "cliente" && s.id === id ? null : { tipo: "cliente", id }));
      } else {
        setSeleccion((s) => (s?.tipo === "espacio" && s.id === e.id ? null : { tipo: "espacio", id: e.id }));
      }
    },
    [modo, pincel, tocarConPincel]
  );

  const describir = useCallback(
    (e: Espacio) => {
      const nombre = nombreEspacio(e);
      if (!e.clienteId) return `${nombre}, libre${e.nota ? ` (${e.nota})` : ""}`;
      const c = clientePorId.get(e.clienteId);
      return c ? `${nombre}, ${c.nombre}, ${TEXTO_ESTADO[c.estado]}` : `${nombre}, ocupado`;
    },
    [clientePorId]
  );

  const acciones = useMemo(
    () => ({ alTocar: (e: Espacio) => tocarEspacio(e), describir }),
    [tocarEspacio, describir]
  );

  const describirFicha = useCallback(
    (clienteId: string) => {
      const c = clientePorId.get(clienteId);
      return c ? `Quintero ${c.nombre}, ${TEXTO_ESTADO[c.estado]}` : "Quintero";
    },
    [clientePorId]
  );

  const tocarFicha = useCallback(
    (clienteId: string) => {
      if (modo === "asignar") {
        setPincel(clienteId);
        setSeleccion(null);
        return;
      }
      setFiltro(null);
      setSeleccion((s) => (s?.tipo === "cliente" && s.id === clienteId ? null : { tipo: "cliente", id: clienteId }));
    },
    [modo]
  );

  const limpiar = useCallback(() => {
    setConfirmacion(null);
    setSugerencia(null);
    setSeleccion(null);
  }, []);

  const entrarAsignar = (opciones: { pincel?: string | null; espacio?: string | null } = {}) => {
    setModo("asignar");
    setFiltro(null);
    setConfirmacion(null);
    setSugerencia(null);
    const nuevoPincel =
      opciones.pincel !== undefined ? opciones.pincel : clienteSel;
    setPincel(nuevoPincel);
    setSeleccion(opciones.espacio ? { tipo: "espacio", id: opciones.espacio } : null);
  };

  const salirAsignar = () => {
    setModo("ver");
    setPincel(null);
    setConfirmacion(null);
    setSugerencia(null);
    setSeleccion(pincel ? { tipo: "cliente", id: pincel } : null);
  };

  const elegirBusqueda = (r: ResultadoBusqueda) => {
    if (r.tipo === "cliente") {
      if (modo === "asignar") {
        setPincel(r.id);
        setSeleccion(null);
        setConfirmacion(null);
        setSugerencia(null);
      } else {
        setFiltro(null);
        setSeleccion({ tipo: "cliente", id: r.id });
      }
      enfocarCliente(r.id);
      return;
    }
    const e = espacioPorId.get(r.id);
    if (!e) return;
    if (modo === "ver" && e.clienteId) setSeleccion({ tipo: "cliente", id: e.clienteId });
    else {
      if (modo === "asignar") setPincel(null);
      setSeleccion({ tipo: "espacio", id: e.id });
    }
    setFiltro(null);
    lienzo.current?.enfocar(e);
  };

  const editar = (e: Espacio, datos: { numero: string | null; medio: boolean; nota: string | null }) => {
    startTransition(async () => {
      cambiarPlano({ tipo: "editar", id: e.id, ...datos });
      const res = await editarEspacio({ id: e.id, ...datos });
      if (!res.ok) toast.error(res.error);
      else toast.success("Listo, quedó corregido.");
    });
  };

  // Escape: cierra lo último que se abrió.
  useEffect(() => {
    const alTeclado = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      const t = ev.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (confirmacion) setConfirmacion(null);
      else if (sugerencia) setSugerencia(null);
      else if (seleccion) setSeleccion(null);
      else if (pincel) setPincel(null);
      else if (pantallaCompleta) setPantallaCompleta(false);
    };
    window.addEventListener("keydown", alTeclado);
    return () => window.removeEventListener("keydown", alTeclado);
  }, [confirmacion, sugerencia, seleccion, pincel, pantallaCompleta]);

  // Asignando con el dedo (tablet): el plano se acerca hasta que cada puesto
  // sea un blanco cómodo, centrado en los puestos del elegido si ya tiene.
  useEffect(() => {
    if (modo !== "asignar" || !pincel) return;
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    const suyos = porCliente.get(pincel);
    lienzo.current?.asegurarZoom(1, suyos?.length ? unir(suyos) : null);
    // Solo al cambiar de pincel: asignarle puestos no tiene que mover la cámara.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, pincel]);

  // Pantalla completa: la página de atrás no se desplaza.
  useEffect(() => {
    if (!pantallaCompleta) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, [pantallaCompleta]);

  // Enfoque inicial por link (?cliente= / ?puesto=).
  const enfoqueInicial = useMemo<Rect | null>(() => {
    if (clienteInicial) {
      const suyos = espacios.filter((e) => e.clienteId === clienteInicial);
      return suyos.length > 0 ? unir(suyos) : null;
    }
    return espacioInicial;
  }, [clienteInicial, espacioInicial, espacios]);

  // ---------- Tooltip (mouse) ----------
  const tooltip = useCallback(
    (e: Espacio, b: Bloque) => {
      const cli = e.clienteId ? clientePorId.get(e.clienteId) : null;
      if (!cli) {
        return (
          <>
            <p className="text-sm font-semibold">{nombreEspacio(e)}</p>
            <p className="text-xs text-muted-foreground">
              {e.clienteId ? "Ocupado" : "Libre"}
              {e.medio ? " · medio puesto" : ""}
              {e.nota ? ` · ${e.nota}` : ""}
            </p>
          </>
        );
      }
      const sello = SELLO[cli.estado];
      return (
        <>
          <p className="text-sm leading-tight font-semibold">{cli.nombre}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {b.espacios.length > 1 ? etiquetaEspacios(b.espacios) : nombreEspacio(e)}
            {cli.apodo ? ` · “${cli.apodo}”` : ""}
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <Sello estado={sello.estado} texto={sello.texto} />
            <Money
              monto={cli.deuda}
              className={cn("text-sm font-semibold", cli.deuda > 0 ? "text-pendiente" : "text-muted-foreground")}
            />
          </div>
        </>
      );
    },
    [clientePorId]
  );

  const cliPincel = pincel ? clientePorId.get(pincel) ?? null : null;
  const espacioSel = seleccion?.tipo === "espacio" ? espacioPorId.get(seleccion.id) ?? null : null;
  const clienteDetalle = clienteSel ? clientePorId.get(clienteSel) ?? null : null;

  return (
    <section
      aria-label="Mapa del mercado"
      className={cn(pantallaCompleta && "fixed inset-0 z-50 flex flex-col bg-background p-2 sm:p-4")}
    >
      <Card className={cn("gap-0 py-0", pantallaCompleta && "flex min-h-0 flex-1 flex-col")}>
        {/* Barra superior: buscar + acciones */}
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <BuscadorMapa
            clientes={clientes}
            espacios={plano}
            onElegir={elegirBusqueda}
            className="min-w-0 flex-1 basis-60 sm:max-w-md"
          />
          <div className="ml-auto flex items-center gap-2">
            {puedeEditar ? (
              modo === "ver" ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 px-4 text-sm font-semibold"
                  onClick={() => entrarAsignar()}
                >
                  <Paintbrush className="size-4" strokeWidth={2} />
                  Asignar puestos
                </Button>
              ) : (
                <Button type="button" className="min-h-11 px-4 text-sm font-semibold" onClick={salirAsignar}>
                  <Check className="size-4" strokeWidth={2.2} />
                  Listo
                </Button>
              )
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              className="size-11"
              onClick={() => setPantallaCompleta((v) => !v)}
              aria-label={pantallaCompleta ? "Salir de pantalla completa" : "Ver en pantalla completa"}
              title={pantallaCompleta ? "Salir de pantalla completa" : "Pantalla completa"}
            >
              {pantallaCompleta ? (
                <Minimize2 className="size-[1.1rem]" strokeWidth={2} />
              ) : (
                <Maximize2 className="size-[1.1rem]" strokeWidth={2} />
              )}
            </Button>
          </div>
        </div>

        <ResumenMapa
          resumen={resumen}
          filtro={filtro}
          onFiltro={(f) => {
            setFiltro(f);
            if (f) setSeleccion(null);
          }}
          className="border-b px-3 py-3 sm:px-4"
        />

        <LienzoPlano
          ref={lienzo}
          limites={limites}
          elementos={elementos}
          bloques={bloques}
          estilos={estilos}
          anillos={anillos}
          fichas={fichas}
          restos={restos}
          atenuar={atenuar}
          pastilla={pastilla}
          arboles={arboles}
          finFichas={finFichas}
          acciones={acciones}
          onTocarFicha={tocarFicha}
          describirFicha={describirFicha}
          onTocarFondo={() => {
            if (modo === "asignar" && pincel) return;
            limpiar();
          }}
          tooltip={tooltip}
          enfoqueInicial={enfoqueInicial}
          pantallaCompleta={pantallaCompleta}
          resaltarBorde={modo === "asignar"}
        >
          {modo === "asignar" ? (
            <div className="pointer-events-none absolute top-3 right-3 left-3 flex justify-center">
              <p className="flex max-w-full items-center gap-2 truncate rounded-full bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-md">
                <Paintbrush className="size-4 shrink-0" strokeWidth={2} />
                <span className="truncate">
                  {cliPincel
                    ? `Asignando a ${cliPincel.apodo ?? cliPincel.nombre}: tocá sus puestos`
                    : "Elegí un puestero abajo, o tocá un puesto para corregirlo"}
                </span>
              </p>
            </div>
          ) : null}
        </LienzoPlano>

        <div
          className={cn(
            "border-t",
            pantallaCompleta && "max-h-[45vh] shrink-0 overflow-y-auto"
          )}
        >
          {modo === "asignar" ? (
            <PanelAsignacion
              clientes={clientes}
              clientePorId={clientePorId}
              espacios={plano}
              porCliente={porCliente}
              pincel={pincel}
              espacioSel={espacioSel}
              confirmacion={confirmacion}
              sugerencia={sugerencia}
              revisiones={revisiones}
              guardando={guardando}
              onPincel={(id) => {
                setPincel(id);
                setSeleccion(null);
                setConfirmacion(null);
                setSugerencia(null);
                if (id) enfocarCliente(id);
              }}
              onAsignar={asignar}
              onEditar={editar}
              onConfirmar={() => {
                if (!confirmacion) return;
                asignar([confirmacion.espacioId], confirmacion.aClienteId);
                setConfirmacion(null);
              }}
              onCancelarConfirmacion={() => setConfirmacion(null)}
              onAceptarSugerencia={() => {
                if (!sugerencia) return;
                asignar(sugerencia.espacioIds, sugerencia.clienteId);
                setSugerencia(null);
              }}
              onDescartarSugerencia={() => setSugerencia(null)}
              onSeleccionarEspacio={(id) => {
                setPincel(null);
                setConfirmacion(null);
                setSugerencia(null);
                setSeleccion({ tipo: "espacio", id });
                const e = espacioPorId.get(id);
                if (e) lienzo.current?.enfocar(e);
              }}
              onCerrarEspacio={() => setSeleccion(null)}
              onEnfocar={(r) => lienzo.current?.enfocar(r)}
            />
          ) : (
            <PanelDetalle
              cliente={clienteDetalle}
              suyos={clienteSel ? porCliente.get(clienteSel) ?? [] : []}
              espacio={espacioSel}
              destinos={destinos}
              soloQuinteros={soloQuinteros}
              puedeEditar={puedeEditar}
              onAsignarCliente={(id) => entrarAsignar({ pincel: id })}
              onAsignarEspacio={(id) => entrarAsignar({ pincel: null, espacio: id })}
              onEnfocar={(r) => lienzo.current?.enfocar(r)}
              onCerrar={limpiar}
            />
          )}
        </div>
      </Card>
    </section>
  );
}
