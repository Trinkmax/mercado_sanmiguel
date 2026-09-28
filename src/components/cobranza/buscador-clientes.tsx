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
  /** Puestos del plano ("52", "34½"): también se busca por ellos. */
  puestos: { numero: string; etiqueta: string }[];
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
    c.puestos.some((p) => normalizar(p.numero) === q)
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
  hoy,
}: {
  clientes: FilaCliente[];
  categorias: CategoriaCliente[];
  categoriaInicial: CategoriaCliente;
  placeholder: string;
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
          aria-label={placeholder.replace(/…$/, "")}
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
              : "Probá con otro nombre, el apodo o el número de carpeta."
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
          {filtrados.map((c) => (
            <li key={c.id}>
              <Link
                href={`/cobranza/${c.id}`}
                className="flex min-h-16 items-center gap-3 px-4 py-2 transition-colors hover:bg-muted/50 active:bg-muted"
              >
                <span className="w-10 shrink-0 text-right font-display text-base font-bold tabular">
                  {c.codigo}
                </span>
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block truncate text-base font-medium">
                    {c.nombre}
                    {c.apodo ? (
                      <span className="font-normal text-muted-foreground"> · {c.apodo}</span>
                    ) : null}
                  </span>
                  <DetalleFila c={c} hoy={hoy} />
                </span>
                {c.categoria !== "ambulante" || c.deuda > 0 ? (
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <Money
                      monto={c.deuda}
                      className={cn(
                        "text-base font-semibold",
                        c.nivel === "al_dia" ? "text-pagado" : c.nivel === "vencido" ? "text-pendiente" : "text-parcial"
                      )}
                    />
                    <Sello estado={SELLO_NIVEL_DEUDA[c.nivel]} className="max-[400px]:hidden" />
                  </span>
                ) : null}
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" strokeWidth={2} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DetalleFila({ c, hoy }: { c: FilaCliente; hoy: string }) {
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
  if (c.puestos.length === 0) return null;
  return (
    <span className="block truncate text-sm text-muted-foreground tabular">
      {c.puestos.length > 1 ? "Puestos" : "Puesto"} {c.puestos.map((p) => p.etiqueta).join(" · ")}
    </span>
  );
}
