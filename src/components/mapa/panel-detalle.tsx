"use client";

import Link from "next/link";
import { ArrowRight, Flag, HandCoins, MousePointerClick, TriangleAlert, UserPlus, X } from "lucide-react";
import { LABEL_CATEGORIA_PLURAL, textoAvance, type CategoriaCliente } from "@/lib/segmentos";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { AvisoPuesto } from "./aviso-puesto";
import {
  diferencias,
  espaciosPorTipo,
  etiquetaEspacio,
  NOMBRE_TIPO,
  nombreTipo,
  numeroVisible,
  textoDiferencia,
  unir,
} from "./geometria";
import type { AvisoPuestoPrevio, ClienteMapa, Destinos, Espacio, EstadoCobro, Rect, VistaMapa } from "./tipos";

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
            {nombreTipo(g.tipo, g.espacios.length > 1)}
          </span>
          {g.espacios.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onEnfocar(e)}
              className="inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-md border bg-card px-2.5 font-display text-[15px] font-bold tabular transition-colors hover:border-primary/40 hover:bg-accent"
              aria-label={`Ver ${etiquetaEspacio(e).toLowerCase()} en el plano`}
              title={e.propio ? "Puesto propio de la cooperativa (paga EXPP)" : undefined}
            >
              {e.propio ? <Flag className="size-3.5 text-primary" strokeWidth={2.2} aria-hidden /> : null}
              {numeroVisible(e)}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Avance del mes de un quintero (v_avance_mes): "2 de 4 · Falta $165.000" con barra. */
function AvanceQuintero({ cliente }: { cliente: ClienteMapa }) {
  const mes = cliente.mes;
  if (!mes) {
    return <p className="text-sm text-muted-foreground">Este mes todavía no se generó su quinta.</p>;
  }
  const total = Number(mes.total) || 0;
  const pct = total > 0 ? Math.min(100, Math.max(0, ((total - Number(mes.falta)) / total) * 100)) : 100;
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{textoAvance(mes)}</p>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-pendiente-suave ring-1 ring-foreground/5"
        role="img"
        aria-label={textoAvance(mes)}
      >
        <div className="h-full rounded-full bg-pagado transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        Del mes: <Money monto={total} className="font-medium text-foreground" />
      </p>
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
  vista = "completa",
  avisos = [],
  categoriasGestion,
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
  /** "porteria": mapa del Jefe (G11): tocar un puesto es avisarle al Líder. */
  vista?: VistaMapa;
  /** Avisos anteriores sobre el espacio elegido (mapa del Jefe). */
  avisos?: AvisoPuestoPrevio[];
  /** Categorías que el rol gestiona (Cobrar / Ver ficha solo para esas). */
  categoriasGestion?: CategoriaCliente[];
}) {
  if (cliente) {
    const sello = TEXTO_SELLO[cliente.estado];
    const difs = vista === "porteria" ? [] : diferencias(cliente, suyos);
    const esQuintero = cliente.categoria ? cliente.categoria === "quintero" : cliente.facturado.quintas > 0;
    const gestiona =
      !categoriasGestion || !cliente.categoria || categoriasGestion.includes(cliente.categoria);
    const puedeCobrar = gestiona && destinos.cobro !== null && (!soloQuinteros || esQuintero);
    const quienGestiona =
      cliente.categoria === "puestero" ? "Administración" : cliente.categoria ? "el Jefe de Portería" : null;
    return (
      <div className="relative flex flex-col gap-4 p-4 @2xl:flex-row @2xl:items-start @2xl:gap-6 @2xl:p-5 @2xl:pr-16">
        <BotonCerrar onCerrar={onCerrar} />
        <div className="min-w-0 space-y-1 @2xl:w-60 @2xl:shrink-0">
          <div className="flex flex-wrap items-center gap-2 pr-10 @2xl:pr-0">
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
          ) : esQuintero ? (
            <AvanceQuintero cliente={cliente} />
          ) : (
            <p className="text-sm text-muted-foreground">Todavía no tiene puestos asignados en el plano.</p>
          )}
          {!gestiona && quienGestiona ? (
            <p className="text-xs text-muted-foreground">
              {cliente.categoria ? `${LABEL_CATEGORIA_PLURAL[cliente.categoria]}: ` : ""}lo gestiona {quienGestiona}.
            </p>
          ) : null}
          {difs.map((d) => (
            <p key={d.tipo} className="flex items-start gap-1.5 text-sm text-parcial">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
              {textoDiferencia(d)}
            </p>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 @2xl:flex-col @2xl:items-end">
          <div className="@2xl:text-right">
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
            {destinos.ficha && gestiona ? (
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

  if (espacio && vista === "porteria") {
    return <AvisoPuesto key={espacio.id} espacio={espacio} avisos={avisos} onCerrar={onCerrar} />;
  }

  if (espacio) {
    const titulo =
      espacio.tipo === "bar" ? "Bar" : `${NOMBRE_TIPO[espacio.tipo]} ${numeroVisible(espacio)}`;
    return (
      <div className="relative flex flex-col gap-3 p-4 @xl:flex-row @xl:items-center @xl:gap-6 @xl:p-5 @xl:pr-16">
        <BotonCerrar onCerrar={onCerrar} />
        <div className="min-w-0 flex-1 space-y-1 pr-12 @xl:pr-0">
          <div className="flex flex-wrap items-center gap-2">
            <Sello estado="libre" texto="Libre" />
            {espacio.propio ? <Sello estado="propio" /> : null}
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
        {vista === "porteria"
          ? "Tocá un puesto para avisarle algo al Líder, o un quintero para ver cómo viene con la quinta."
          : "Tocá un puesto para ver quién lo ocupa y cuánto debe."}{" "}
        Arrastrá para moverte por el plano; pellizcá o usá los botones para acercar.
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
