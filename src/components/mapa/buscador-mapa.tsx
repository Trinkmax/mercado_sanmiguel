"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFraccion } from "@/lib/format";
import { textoAvance } from "@/lib/segmentos";
import { Input } from "@/components/ui/input";
import {
  compararNumero,
  etiquetaEspacio,
  normalizar,
  numeroVisible,
  sinLugarEnPlano,
  textoEspacios,
  unidadesPuestos,
} from "./geometria";
import type { ClienteMapa, Espacio, TipoEspacio } from "./tipos";

export type ResultadoBusqueda = { tipo: "cliente"; id: string } | { tipo: "espacio"; id: string };

type Fila = {
  clave: string;
  resultado: ResultadoBusqueda;
  insignia: string;
  titulo: string;
  detalle: string;
};

const MAX_RESULTADOS = 8;

/** "local 3", "l3", "conteiner 7", "contenedor 7", "c 7", "bar", "52" → qué espacio buscar. */
function leerEspacio(q: string): { tipo: TipoEspacio | null; numero: string } | null {
  const t = normalizar(q).replace(/\s+/g, " ").trim();
  if (t === "bar") return { tipo: "bar", numero: "" };
  const m = t.match(/^(puesto|p|local|l|conteiner|contenedor|cont|c)?\s*(\d{1,3})$/);
  if (!m) return null;
  const pref = m[1] ?? "";
  const tipo: TipoEspacio | null = pref.startsWith("l")
    ? "local"
    : pref.startsWith("c")
      ? "contenedor"
      : pref.startsWith("p")
        ? "puesto"
        : null;
  return { tipo, numero: m[2] };
}

/**
 * Buscador del plano: por nombre, apodo, N° de carpeta o N° de puesto
 * ("52", "local 3", "c 7", "bar"). Con `soloClientes` sirve para elegir a
 * quién asignarle puestos y muestra lo facturado contra lo que tiene en el plano.
 */
export function BuscadorMapa({
  clientes,
  espacios,
  onElegir,
  soloClientes = false,
  placeholder = "Buscá puestero o puesto",
  autoFocus = false,
  anonimo = false,
  vacio,
  className,
}: {
  clientes: ClienteMapa[];
  espacios: Espacio[];
  onElegir: (r: ResultadoBusqueda) => void;
  soloClientes?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  /** Sin datos de ocupación (Jefe de Portería, selector de lugar): no dice "Libre" ni de quién es. */
  anonimo?: boolean;
  /** Texto cuando no hay resultados (sin la búsqueda, que se agrega sola). */
  vacio?: string;
  className?: string;
}) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaId = useId();

  const porCliente = useMemo(() => {
    const m = new Map<string, Espacio[]>();
    for (const e of espacios) {
      if (!e.clienteId) continue;
      const l = m.get(e.clienteId);
      if (l) l.push(e);
      else m.set(e.clienteId, [e]);
    }
    return m;
  }, [espacios]);
  const clientePorId = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);

  const filas = useMemo<Fila[]>(() => {
    const q = normalizar(texto.trim());
    if (q === "" && !soloClientes) return [];
    const salida: Fila[] = [];

    if (!soloClientes && q !== "") {
      const pedido = leerEspacio(q);
      if (pedido) {
        const encontrados = espacios
          .filter(
            (e) =>
              (pedido.tipo === null || e.tipo === pedido.tipo) &&
              (pedido.tipo === "bar" || e.numero === pedido.numero)
          )
          .sort((a, b) => a.tipo.localeCompare(b.tipo) || compararNumero(a.numero, b.numero));
        for (const e of encontrados) {
          const duenio = e.clienteId ? clientePorId.get(e.clienteId) : null;
          salida.push({
            clave: `e:${e.id}`,
            resultado: { tipo: "espacio", id: e.id },
            insignia: numeroVisible(e),
            titulo: etiquetaEspacio(e),
            detalle: anonimo
              ? e.propio
                ? "De la cooperativa"
                : e.medio
                  ? "Medio puesto"
                  : "Tocá para verlo en el plano"
              : duenio
                ? duenio.apodo ?? duenio.nombre
                : e.clienteId
                  ? "Ocupado"
                  : "Libre",
          });
        }
      }
    }

    const coinciden = clientes.filter((c) => {
      if (q === "") return true;
      return (
        normalizar(c.nombre).includes(q) ||
        (c.apodo !== null && normalizar(c.apodo).includes(q)) ||
        String(c.codigo) === q
      );
    });
    // En modo asignar, primero los que tienen puestos facturados sin ubicar.
    const faltan = (c: ClienteMapa) => {
      const suyos = porCliente.get(c.id) ?? [];
      return (
        c.facturado.puestos - unidadesPuestos(suyos, false) > 0 ||
        (c.facturado.propios ?? 0) - unidadesPuestos(suyos, true) > 0
      );
    };
    const ordenados = soloClientes
      ? [...coinciden].sort((a, b) => Number(faltan(b)) - Number(faltan(a)) || a.codigo - b.codigo)
      : coinciden;

    for (const c of ordenados) {
      const suyos = porCliente.get(c.id) ?? [];
      let detalle: string;
      if (soloClientes) {
        const comunes = c.facturado.puestos;
        const propios = c.facturado.propios ?? 0;
        const factura = [
          comunes > 0 ? `${formatFraccion(comunes)} EXME` : null,
          propios > 0 ? `${formatFraccion(propios)} EXPP` : null,
        ]
          .filter(Boolean)
          .join(" + ");
        const enPlano = unidadesPuestos(suyos, false) + unidadesPuestos(suyos, true);
        detalle = factura
          ? `Factura ${factura} · en el plano ${formatFraccion(enPlano)}`
          : suyos.length > 0
            ? textoEspacios(suyos)
            : "Sin expensas de puesto facturadas";
      } else if (anonimo) {
        detalle = c.mes ? `Quintero · ${textoAvance(c.mes)}` : "Quintero";
      } else {
        // Todo lo que tiene, como en Clientes: lo ubicado y lo que no se marca en el plano.
        const sinLugar = sinLugarEnPlano(c.facturado);
        detalle =
          suyos.length > 0
            ? [textoEspacios(suyos), ...sinLugar].join(" · ")
            : sinLugar.length > 0
              ? `${sinLugar.join(" · ")} · sin lugar en el plano`
              : "Sin puestos en el plano";
      }
      salida.push({
        clave: `c:${c.id}`,
        resultado: { tipo: "cliente", id: c.id },
        insignia: String(c.codigo),
        titulo: c.apodo ? `${c.nombre} · “${c.apodo}”` : c.nombre,
        detalle,
      });
    }
    return salida.slice(0, soloClientes ? 40 : MAX_RESULTADOS);
  }, [texto, soloClientes, anonimo, espacios, clientes, clientePorId, porCliente]);

  const elegir = (f: Fila) => {
    onElegir(f.resultado);
    setTexto("");
    setAbierto(false);
    setActivo(0);
  };

  const mostrar = abierto && (filas.length > 0 || texto.trim() !== "");

  return (
    <div className={cn("relative", className)}>
      {/* La lupa y la X se centran en el campo, no en el bloque: con la lista en línea
          (dentro de un panel) el bloque crece hacia abajo y se le subirían encima. */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-[1.1rem] -translate-y-1/2 text-muted-foreground"
          strokeWidth={2}
        />
        <Input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={mostrar}
          aria-controls={listaId}
          aria-autocomplete="list"
          aria-activedescendant={mostrar && filas[activo] ? `${listaId}-${activo}` : undefined}
          autoFocus={autoFocus}
          value={texto}
          placeholder={placeholder}
          aria-label={
            soloClientes
              ? "Buscá un puestero por nombre, apodo o número de carpeta"
              : "Buscá un puestero o un número de puesto"
          }
          // Sin texto no hay X: el lugar a la derecha es del texto de ayuda.
          className={cn("h-11 rounded-lg pl-9 text-[15px] md:text-[15px]", texto ? "pr-11" : "pr-3")}
          onChange={(e) => {
            setTexto(e.target.value);
            setAbierto(true);
            setActivo(0);
          }}
          onFocus={() => setAbierto(true)}
          onBlur={() => window.setTimeout(() => setAbierto(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setAbierto(true);
              setActivo((a) => Math.min(a + 1, Math.max(0, filas.length - 1)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActivo((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              const f = filas[activo];
              if (f) {
                e.preventDefault();
                elegir(f);
              }
            } else if (e.key === "Escape") {
              if (texto) setTexto("");
              else inputRef.current?.blur();
              setAbierto(false);
            }
          }}
        />
        {texto ? (
          <button
            type="button"
            aria-label="Borrar búsqueda"
            className="absolute top-1/2 right-0.5 flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setTexto("");
              inputRef.current?.focus();
            }}
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        ) : null}
      </div>

      {mostrar ? (
        <ul
          id={listaId}
          role="listbox"
          className={cn(
            "mt-1.5 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground",
            // Dentro de un panel (elegir puestero) la lista va en línea: flotando
            // la cortaría el scroll del panel.
            soloClientes ? "max-h-72" : "absolute top-full right-0 left-0 z-40 max-h-80 shadow-lg"
          )}
        >
          {filas.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted-foreground">
              {vacio ?? "No encontramos a nadie con"} “{texto.trim()}”.
            </li>
          ) : (
            filas.map((f, i) => (
              <li
                key={f.clave}
                id={`${listaId}-${i}`}
                role="option"
                aria-selected={i === activo}
                className={cn(
                  "flex min-h-12 cursor-pointer items-center gap-3 rounded-md px-2.5 py-1.5",
                  i === activo ? "bg-muted" : "hover:bg-muted/60"
                )}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActivo(i)}
                onClick={() => elegir(f)}
              >
                <span
                  className={cn(
                    "flex h-8 min-w-9 shrink-0 items-center justify-center rounded-md px-1.5 font-display text-sm font-bold tabular",
                    f.resultado.tipo === "espacio"
                      ? "bg-accent text-accent-foreground"
                      : "bg-secondary text-secondary-foreground"
                  )}
                >
                  {f.insignia}
                </span>
                {/* Nombres largos (razones sociales): hasta dos renglones y, si ni así
                    entran, el nombre completo al pasar el mouse. */}
                <span className="min-w-0 flex-1" title={`${f.titulo}\n${f.detalle}`}>
                  <span className="line-clamp-2 text-sm leading-snug font-medium break-words">{f.titulo}</span>
                  <span className="line-clamp-2 text-xs break-words text-muted-foreground">{f.detalle}</span>
                </span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
