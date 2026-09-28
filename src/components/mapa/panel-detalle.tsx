"use client";

import Link from "next/link";
import { ArrowRight, HandCoins, MousePointerClick, TriangleAlert, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import {
  diferencias,
  espaciosPorTipo,
  NOMBRE_TIPO,
  numeroVisible,
  textoDiferencia,
  unir,
} from "./geometria";
import type { ClienteMapa, Destinos, Espacio, EstadoCobro, Rect } from "./tipos";

const TEXTO_SELLO: Record<EstadoCobro, { estado: string; texto?: string }> = {
  al_dia: { estado: "al_dia" },
  debe: { estado: "debe", texto: "Debe el mes" },
  vencido: { estado: "vencido", texto: "Deuda atrasada" },
};

/** Botón grande de panel (target ≥ 44 px, como pide la tablet). */
const BOTON = "min-h-11 px-4 text-sm font-semibold";

export function ChipsEspacios({
  espacios,
  onEnfocar,
}: {
  espacios: Espacio[];
  onEnfocar: (r: Rect) => void;
}) {
  const grupos = espaciosPorTipo(espacios);
  return (
    <div className="space-y-1.5">
      {grupos.map((g) => (
        <div key={g.tipo} className="flex flex-wrap items-center gap-1.5">
          <span className="w-24 shrink-0 text-xs text-muted-foreground">
            {g.tipo === "puesto"
              ? g.espacios.length > 1
                ? "Puestos"
                : "Puesto"
              : g.tipo === "local"
                ? g.espacios.length > 1
                  ? "Locales"
                  : "Local"
                : g.tipo === "contenedor"
                  ? g.espacios.length > 1
                    ? "Contenedores"
                    : "Contenedor"
                  : "Bar"}
          </span>
          {g.espacios.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onEnfocar(e)}
              className="inline-flex h-11 min-w-11 items-center justify-center rounded-md border bg-card px-2.5 font-display text-[15px] font-bold tabular transition-colors hover:border-primary/40 hover:bg-accent"
              aria-label={`Ver ${NOMBRE_TIPO[e.tipo].toLowerCase()} ${numeroVisible(e)} en el plano`}
            >
              {numeroVisible(e)}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Panel de consulta bajo el plano: quién ocupa lo que se tocó. */
export function PanelDetalle({
  cliente,
  suyos,
  espacio,
  destinos,
  soloQuinteros,
  puedeEditar,
  onAsignarCliente,
  onAsignarEspacio,
  onEnfocar,
  onCerrar,
}: {
  cliente: ClienteMapa | null;
  suyos: Espacio[];
  espacio: Espacio | null;
  destinos: Destinos;
  soloQuinteros: boolean;
  puedeEditar: boolean;
  onAsignarCliente: (clienteId: string) => void;
  onAsignarEspacio: (espacioId: string) => void;
  onEnfocar: (r: Rect) => void;
  onCerrar: () => void;
}) {
  if (cliente) {
    const sello = TEXTO_SELLO[cliente.estado];
    const difs = diferencias(cliente, suyos);
    const esQuintero = cliente.facturado.quintas > 0;
    const puedeCobrar = destinos.cobro !== null && (!soloQuinteros || esQuintero);
    return (
      <div className="relative flex flex-col gap-4 p-4 md:flex-row md:items-start md:gap-6 md:p-5">
        <BotonCerrar onCerrar={onCerrar} />
        <div className="min-w-0 space-y-1 md:w-64 md:shrink-0 lg:w-72">
          <div className="flex flex-wrap items-center gap-2 pr-10 md:pr-0">
            <Sello estado={sello.estado} texto={sello.texto} />
            <span className="text-xs text-muted-foreground tabular">Carpeta N° {cliente.codigo}</span>
          </div>
          <p className="truncate font-display text-lg leading-snug font-bold">{cliente.nombre}</p>
          {cliente.apodo ? (
            <p className="truncate text-sm text-muted-foreground">Le dicen “{cliente.apodo}”</p>
          ) : null}
        </div>

        <div className="min-w-0 flex-1 space-y-2.5">
          {suyos.length > 0 ? (
            <ChipsEspacios espacios={suyos} onEnfocar={onEnfocar} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {esQuintero
                ? "Vende en la zona de quinteros: no tiene puestos numerados."
                : "Todavía no tiene puestos asignados en el plano."}
            </p>
          )}
          {difs.map((d) => (
            <p key={d.tipo} className="flex items-start gap-1.5 text-sm text-parcial">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
              {textoDiferencia(d)}
            </p>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 md:flex-col md:items-end md:pr-8">
          <div className="md:text-right">
            <p className="text-xs text-muted-foreground">Deuda</p>
            {cliente.deuda > 0 ? (
              <Money monto={cliente.deuda} className="font-display text-xl font-bold text-pendiente" />
            ) : (
              <p className="font-display text-xl font-bold text-pagado">Sin deuda</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {puedeEditar && suyos.length === 0 && !esQuintero ? (
              <Button type="button" variant="outline" className={BOTON} onClick={() => onAsignarCliente(cliente.id)}>
                <UserPlus className="size-4" strokeWidth={2} />
                Ubicar en el plano
              </Button>
            ) : null}
            {destinos.ficha ? (
              <Button asChild variant="outline" className={BOTON}>
                <Link href={`${destinos.ficha}/${cliente.id}`}>
                  Ver ficha
                  <ArrowRight className="size-4" strokeWidth={2} />
                </Link>
              </Button>
            ) : null}
            {puedeCobrar && destinos.cobro ? (
              <Button asChild className={BOTON}>
                <Link href={`${destinos.cobro}/${cliente.id}`}>
                  <HandCoins className="size-4" strokeWidth={2} />
                  Cobrar
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (espacio) {
    const titulo =
      espacio.tipo === "bar" ? "Bar" : `${NOMBRE_TIPO[espacio.tipo]} ${numeroVisible(espacio)}`;
    return (
      <div className="relative flex flex-col gap-3 p-4 md:flex-row md:items-center md:gap-6 md:p-5">
        <BotonCerrar onCerrar={onCerrar} />
        <div className="min-w-0 flex-1 space-y-1 pr-10">
          <div className="flex flex-wrap items-center gap-2">
            <Sello estado="libre" texto="Libre" />
            {espacio.medio ? <span className="text-xs text-muted-foreground">Medio puesto</span> : null}
          </div>
          <p className="font-display text-lg font-bold">{titulo}</p>
          <p className="text-sm text-muted-foreground">
            {espacio.nota
              ? `${espacio.nota}. Sin puestero asignado en el sistema.`
              : "Sin puestero asignado en el sistema."}
          </p>
        </div>
        {puedeEditar ? (
          <Button type="button" className={BOTON} onClick={() => onAsignarEspacio(espacio.id)}>
            <UserPlus className="size-4" strokeWidth={2} />
            Asignar puestero
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 text-sm text-muted-foreground md:px-5">
      <MousePointerClick className="size-5 shrink-0" strokeWidth={1.8} />
      <p>
        Tocá un puesto para ver quién lo ocupa y cuánto debe. Arrastrá para moverte por el
        plano; pellizcá o usá los botones para acercar.
      </p>
    </div>
  );
}

function BotonCerrar({ onCerrar }: { onCerrar: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-lg"
      className="absolute top-3 right-3 size-11"
      onClick={onCerrar}
      aria-label="Cerrar"
    >
      <X className="size-5" strokeWidth={2} />
    </Button>
  );
}

/** Rectángulo que abarca todos los espacios (para enfocar la cámara). */
export function areaDe(espacios: Espacio[]): Rect | null {
  return espacios.length > 0 ? unir(espacios) : null;
}
