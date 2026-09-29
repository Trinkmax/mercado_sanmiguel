"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Search, UserX, Users } from "lucide-react";
import { formatFechaHora } from "@/lib/format";
import { LABEL_SEGMENTO, SEGMENTOS, type Segmento } from "@/lib/segmentos";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Sello } from "@/components/shared/sello";
import { FilaDeslizable } from "./fila-deslizable";
import type { Lector } from "./publico";

/**
 * D1: quién vio la circular y quién no. "La vieron (N)" con fecha y hora; "Todavía no (M)"
 * con el subgrupo "Sin usuario del portal (K) — avisales en persona". Filtro por grupo y buscador.
 */
export function ListaLectores({
  lectores,
  obligatoria,
}: {
  lectores: Lector[];
  obligatoria: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [grupo, setGrupo] = useState<Segmento | null>(null);

  const gruposPresentes = useMemo(() => {
    const s = new Set<string>();
    for (const l of lectores) for (const g of l.segmentos) s.add(g);
    return SEGMENTOS.filter((g) => s.has(g.valor));
  }, [lectores]);

  const filtrados = useMemo(() => {
    const q = texto.trim().toLowerCase();
    return lectores.filter((l) => {
      if (grupo && !l.segmentos.includes(grupo)) return false;
      if (!q) return true;
      return (
        l.nombre.toLowerCase().includes(q) ||
        (l.apodo ?? "").toLowerCase().includes(q) ||
        String(l.codigo) === q
      );
    });
  }, [lectores, texto, grupo]);

  const vieron = filtrados
    .filter((l) => l.vio_en)
    .sort((a, b) => (b.vio_en ?? "").localeCompare(a.vio_en ?? ""));
  const faltan = filtrados.filter((l) => !l.vio_en && l.tiene_portal).sort((a, b) => a.codigo - b.codigo);
  const sinPortal = filtrados.filter((l) => !l.vio_en && !l.tiene_portal).sort((a, b) => a.codigo - b.codigo);

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
            strokeWidth={2}
          />
          <Input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscá por nombre, apodo o N° de carpeta…"
            className="h-12 pl-10 text-base md:text-base"
            aria-label="Buscar cliente"
          />
        </div>
        {gruposPresentes.length > 1 ? (
          <FilaDeslizable role="group" aria-label="Filtrar por grupo">
            <FiltroChip activo={grupo === null} onClick={() => setGrupo(null)}>
              Todos los grupos
            </FiltroChip>
            {gruposPresentes.map((g) => (
              <FiltroChip key={g.valor} activo={grupo === g.valor} onClick={() => setGrupo(g.valor)}>
                {LABEL_SEGMENTO[g.valor]}
              </FiltroChip>
            ))}
          </FilaDeslizable>
        ) : null}
      </div>

      {/* grid-cols-1 + min-w-0: sin eso la columna tomaba el ancho del nombre más largo y la
          página se corría de costado en el celular. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <section className="min-w-0 space-y-3" aria-label="La vieron">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
            <Eye className="size-5 text-pagado" strokeWidth={2} />
            La vieron
            <span className="tabular font-normal text-muted-foreground">({vieron.length})</span>
          </h3>
          <p className="-mt-2 text-sm text-muted-foreground">
            {obligatoria
              ? "Confirmaron que la recibieron, con fecha y hora."
              : "La abrieron en el portal, con fecha y hora."}
          </p>
          {vieron.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              Todavía nadie{texto || grupo ? " de este filtro" : ""}.
            </p>
          ) : (
            <Lista items={vieron} />
          )}
        </section>

        <section className="min-w-0 space-y-3" aria-label="Todavía no">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
            <Users className="size-5 text-pendiente" strokeWidth={2} />
            Todavía no
            <span className="tabular font-normal text-muted-foreground">
              ({faltan.length + sinPortal.length})
            </span>
          </h3>
          {faltan.length === 0 && sinPortal.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              {texto || grupo ? "Nadie de este filtro." : "¡Todos la vieron!"}
            </p>
          ) : null}
          {faltan.length > 0 ? <Lista items={faltan} /> : null}
          {sinPortal.length > 0 ? (
            <div className="space-y-2 pt-1">
              <p className="flex items-center gap-2 text-sm font-semibold text-parcial">
                <UserX className="size-4" strokeWidth={2} />
                Sin usuario del portal ({sinPortal.length}) — avisales en persona
              </p>
              <Lista items={sinPortal} />
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function Lista({ items }: { items: Lector[] }) {
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">
      {items.map((l) => (
        <li key={l.cliente_id}>
          <Link
            href={`/clientes/${l.cliente_id}`}
            className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent"
          >
            <span className="w-10 shrink-0 text-right font-display text-base font-bold tabular">
              {l.codigo}
            </span>
            {/* El nombre completo, en los renglones que haga falta (cortado no se sabía quién era). */}
            <span className="min-w-0 flex-1">
              <span className="block leading-snug font-medium break-words">{l.nombre}</span>
              {l.apodo ? (
                <span className="block text-sm break-words text-muted-foreground">{l.apodo}</span>
              ) : null}
            </span>
            {l.vio_en ? (
              <span className="shrink-0 text-right">
                <Sello estado="la_vio" />
                <span className="mt-0.5 block text-xs tabular text-muted-foreground">
                  {formatFechaHora(l.vio_en)}
                </span>
              </span>
            ) : (
              <Sello estado={l.tiene_portal ? "no_la_vio" : "sin_portal"} className="shrink-0" />
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function FiltroChip({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors",
        activo ? "border-primary bg-accent ring-2 ring-primary/25" : "bg-card hover:bg-accent/60"
      )}
    >
      {children}
    </button>
  );
}
