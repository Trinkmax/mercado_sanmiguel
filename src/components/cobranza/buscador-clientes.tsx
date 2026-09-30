"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Search, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { SELLO_NIVEL_DEUDA, type NivelDeuda } from "@/lib/format";
import {
  LABEL_CATEGORIA_PLURAL,
  textoAvance,
  type AvanceMes,
  type CategoriaCliente,
} from "@/lib/segmentos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { EmptyState } from "@/components/shared/empty-state";
import { BarraAvance } from "@/components/cobranza/plan-cuotas";
import { diaCorto, diaMes } from "@/components/cobranza/tipos";

export type FilaCliente = {
  id: string;
  codigo: number;
  nombre: string;
  apodo: string | null;
  categoria: CategoriaCliente;
  /** Lo que debe hoy, neto del saldo a favor. */
  deuda: number;
  nivel: NivelDeuda;
  /** Números de sus lugares en el plano ("52", "3"): también se busca por ellos. */
  numerosPlano: string[];
  /** "Puestos 46 · 48 · 50 · 52", "Local 3", "1 galpón": lo mismo que dice Clientes. */
  lugares: string[];
  /** Quinteros: fila de v_avance_mes del mes (null = el mes no se generó). */
  avance: AvanceMes | null;
  /** Ambulantes: último día pago (null = nunca). */
  pagoHasta: string | null;
};

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function coincide(c: FilaCliente, q: string): boolean {
  if (q === "") return true;
  return (
    normalizar(c.nombre).includes(q) ||
    (c.apodo ? normalizar(c.apodo).includes(q) : false) ||
    String(c.codigo) === q ||
    c.numerosPlano.some((n) => normalizar(n) === q)
  );
}

/**
 * Buscador para tablet: control segmentado por categoría (si el rol cobra más de una),
 * input grande con autofocus y una fila por cliente con lo que importa para cobrarle:
 * deuda + semáforo, "2 de 4 · Falta $X" del quintero o "Pagó hoy" del ambulante.
 */
export function BuscadorClientes({
  clientes,
  categorias,
  categoriaInicial,
  placeholder,
  etiqueta,
  buscaPuestos,
  hoy,
}: {
  clientes: FilaCliente[];
  categorias: CategoriaCliente[];
  categoriaInicial: CategoriaCliente;
  /** Corto: tiene que entrar entero en un celular de 360 px. */
  placeholder: string;
  /** Lo que se lee en voz alta: puede ser más completo que el placeholder. */
  etiqueta: string;
  /** Quien cobra puesteros también busca por N° de puesto (el Jefe, no). */
  buscaPuestos: boolean;
  hoy: string;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState<CategoriaCliente>(categoriaInicial);

  function elegirCategoria(v: string) {
    if (!v) return;
    const c = v as CategoriaCliente;
    setCategoria(c);
    // Se recuerda en la URL: al volver de un cobro queda en el mismo grupo.
    window.history.replaceState(null, "", `?cat=${c}`);
  }

  const q = normalizar(busqueda.trim());
  const deLaCategoria = clientes.filter((c) => c.categoria === categoria);
  const filtrados = deLaCategoria.filter((c) => coincide(c, q));
  const enOtras =
    q !== "" && filtrados.length === 0
      ? categorias
          .filter((cat) => cat !== categoria)
          .map((cat) => ({ cat, n: clientes.filter((c) => c.categoria === cat && coincide(c, q)).length }))
          .filter((x) => x.n > 0)
      : [];

  return (
    <div className="space-y-4">
      {categorias.length > 1 ? (
        <ToggleGroup
          type="single"
          variant="outline"
          value={categoria}
          onValueChange={elegirCategoria}
          aria-label="Qué clientes ver"
          className="w-full"
        >
          {categorias.map((cat) => (
            <ToggleGroupItem
              key={cat}
              value={cat}
              className="h-14 flex-col gap-0 px-2 text-sm font-semibold sm:flex-row sm:gap-1.5 sm:text-base"
            >
              <span>{LABEL_CATEGORIA_PLURAL[cat]}</span>
              <span className="text-xs font-medium tabular opacity-80 sm:text-sm">
                ({clientes.filter((c) => c.categoria === cat).length})
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      ) : null}

      <div className="relative">
        <Search
          className="absolute top-1/2 left-4 size-6 -translate-y-1/2 text-muted-foreground"
          strokeWidth={2}
        />
        <Input
          type="search"
          autoFocus
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder={placeholder}
          aria-label={etiqueta}
          className="h-12 pl-12 text-base md:text-base"
        />
      </div>

      {filtrados.length === 0 ? (
        <EmptyState
          icono={SearchX}
          titulo={
            q === ""
              ? `Todavía no hay ${LABEL_CATEGORIA_PLURAL[categoria].toLowerCase()} activos`
              : "No encontramos a nadie con eso"
          }
          descripcion={
            q === ""
              ? undefined
              : buscaPuestos
                ? "Probá con otra parte del nombre, el apodo, el N° de puesto o el N° de carpeta (el número de la izquierda de cada fila)."
                : "Probá con otra parte del nombre, el apodo o el N° de carpeta (el número de la izquierda de cada fila)."
          }
        >
          {enOtras.map((x) => (
            <Button
              key={x.cat}
              type="button"
              variant="outline"
              className="h-11 px-4 text-sm font-semibold"
              onClick={() => elegirCategoria(x.cat)}
            >
              Ver {x.n} en {LABEL_CATEGORIA_PLURAL[x.cat]}
            </Button>
          ))}
        </EmptyState>
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {filtrados.map((c) => {
            const muestraDeuda = c.categoria !== "ambulante" || c.deuda > 0;
            return (
              <li key={c.id}>
                <Link
                  href={`/cobranza/${c.id}`}
                  className="flex min-h-16 items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50 active:bg-muted sm:items-center sm:py-2.5"
                >
                  <span className="w-10 shrink-0 pt-px text-right font-display text-base font-bold tabular sm:pt-0">
                    {c.codigo}
                  </span>
                  {/* Celular: nombre y apodo a todo el ancho, la deuda con su sello en el renglón
                      de abajo. Desde tablet: la deuda a la derecha. Nada se corta con "…". */}
                  <span className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-4">
                    <span className="block min-w-0 flex-1 space-y-1">
                      {/* Sin tope de renglones: con 70 letras en 360 px son tres, y a dos se cortaba con "…". */}
                      <span title={c.nombre} className="block text-base leading-snug font-medium break-words">
                        {c.nombre}
                      </span>
                      <DetalleFila c={c} hoy={hoy} />
                    </span>
                    {muestraDeuda ? (
                      <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 sm:mt-0 sm:shrink-0 sm:flex-col sm:items-end sm:gap-1">
                        <Money
                          monto={c.deuda}
                          className={cn(
                            "text-base font-semibold",
                            c.nivel === "al_dia" ? "text-pagado" : c.nivel === "vencido" ? "text-pendiente" : "text-parcial"
                          )}
                        />
                        <Sello estado={SELLO_NIVEL_DEUDA[c.nivel]} />
                      </span>
                    ) : null}
                  </span>
                  <ChevronRight className="size-5 shrink-0 self-center text-muted-foreground" strokeWidth={2} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** El apodo con el que lo conocen, entre comillas, antes de lo demás. */
function Apodo({ apodo }: { apodo: string | null }) {
  if (!apodo) return null;
  return <span className="block text-sm leading-snug break-words text-muted-foreground">“{apodo}”</span>;
}

function DetalleFila({ c, hoy }: { c: FilaCliente; hoy: string }) {
  return (
    <>
      {c.categoria === "puestero" ? null : <Apodo apodo={c.apodo} />}
      <DetalleCategoria c={c} hoy={hoy} />
    </>
  );
}

function DetalleCategoria({ c, hoy }: { c: FilaCliente; hoy: string }) {
  if (c.categoria === "quintero") {
    if (!c.avance) {
      return <span className="block text-sm text-muted-foreground">El mes todavía no se generó</span>;
    }
    // El dato para decidir a quién cobrar: en su propia línea, con letra legible.
    return (
      <span className="block space-y-1">
        {Number(c.avance.cuotas) > 1 ? (
          <BarraAvance avance={c.avance} alta="h-2" className="max-w-40" />
        ) : null}
        <span className="block text-sm font-medium text-muted-foreground tabular">
          {textoAvance(c.avance)}
        </span>
      </span>
    );
  }
  if (c.categoria === "ambulante") {
    const pagoHoy = c.pagoHasta !== null && c.pagoHasta >= hoy;
    return (
      <span className="flex flex-wrap items-center gap-2">
        <Sello estado={pagoHoy ? "pago_hoy" : "no_pago_hoy"} />
        <span className="text-sm text-muted-foreground tabular">
          {c.pagoHasta === null
            ? "Todavía no pagó nunca"
            : pagoHoy
              ? c.pagoHasta > hoy
                ? `Pagó hasta el ${diaCorto(c.pagoHasta)}`
                : "Pagó el día de hoy"
              : `Último: ${diaMes(c.pagoHasta)}`}
        </span>
      </span>
    );
  }
  // Puestero: apodo y lugares en un mismo renglón, como en Clientes ("“Los Fernández” · Puestos 46 · 48").
  const detalle = [c.apodo ? `“${c.apodo}”` : null, ...c.lugares].filter(Boolean).join(" · ");
  if (!detalle) return null;
  return (
    <span className="block text-sm leading-snug break-words text-muted-foreground tabular">{detalle}</span>
  );
}
