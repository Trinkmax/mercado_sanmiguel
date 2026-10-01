"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Flag,
  HandCoins,
  KeyRound,
  Link2,
  MousePointerClick,
  Pencil,
  TriangleAlert,
  Unlink,
  UserPlus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LABEL_CATEGORIA_PLURAL, textoAvance, type CategoriaCliente } from "@/lib/segmentos";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { AvisoPuesto } from "./aviso-puesto";
import {
  diferencias,
  espaciosPorTipo,
  etiquetaEspacio,
  listaConY,
  conArticulo,
  NOMBRE_TIPO,
  ocupante,
  nombreTipo,
  numeroVisible,
  sinLugarEnPlano,
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

/** "el puesto 58" · "el bar" · "la quinta 40" */
function nombreConArticulo(e: Espacio): string {
  return conArticulo(e);
}

/** Quien tiene puestos pegados a uno libre: se le puede sumar de un toque (queda unido). */
export type VecinoDuenio = { cliente: ClienteMapa; lugares: Espacio[]; faltanPuestos: boolean };

/** "PRODUCTOS DANIEL" o, sin apodo, el nombre (cortado por CSS si es largo). */
const nombreDe = (c: ClienteMapa) => c.apodo ?? c.nombre;

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
  onEditarEspacio,
  onLiberar,
  onEnfocar,
  onCerrar,
  vista = "completa",
  avisos = [],
  categoriasGestion,
  sumables = [],
  vecinos = [],
  onSumar,
}: {
  cliente: ClienteMapa | null;
  suyos: Espacio[];
  espacio: Espacio | null;
  destinos: Destinos;
  soloQuinteros: boolean;
  puedeEditar: boolean;
  onAsignarCliente: (clienteId: string) => void;
  onAsignarEspacio: (espacioId: string) => void;
  /** Abre el editor del espacio (número, nota, medio, puesto propio: C3). */
  onEditarEspacio?: (espacioId: string) => void;
  /** Deja libre un espacio que figura ocupado por alguien que no está en el mapa. */
  onLiberar?: (espacioId: string) => void;
  onEnfocar: (r: Rect) => void;
  onCerrar: () => void;
  /** "porteria": mapa del Jefe (G11): tocar un puesto es avisarle al Líder. */
  vista?: VistaMapa;
  /** Avisos anteriores sobre el espacio elegido (mapa del Jefe). */
  avisos?: AvisoPuestoPrevio[];
  /** Categorías que el rol gestiona (Cobrar / Ver ficha solo para esas). */
  categoriasGestion?: CategoriaCliente[];
  /** Puestos libres pegados a los del cliente que se le pueden sumar (quedan unidos). */
  sumables?: Espacio[];
  /** Quienes tienen los puestos pegados al libre que se tocó. */
  vecinos?: VecinoDuenio[];
  /** Asigna esos espacios al cliente (se guarda solo, con "Deshacer"). */
  onSumar?: (espacioIds: string[], clienteId: string) => void;
}) {
  // Con varios puestos, "Editar un puesto" pregunta cuál (el panel se remonta por selección).
  const [eligiendo, setEligiendo] = useState(false);
  const editarPuesto = puedeEditar && onEditarEspacio ? onEditarEspacio : null;

  if (cliente) {
    const sello = TEXTO_SELLO[cliente.estado];
    const difs = vista === "porteria" ? [] : diferencias(cliente, suyos);
    const esQuintero = cliente.categoria ? cliente.categoria === "quintero" : cliente.facturado.quintas > 0;
    const gestiona =
      !categoriasGestion || !cliente.categoria || categoriasGestion.includes(cliente.categoria);
    const puedeCobrar = gestiona && destinos.cobro !== null && (!soloQuinteros || esQuintero);
    const quienGestiona =
      cliente.categoria === "puestero" || cliente.categoria === "empleado"
        ? "Administración"
        : cliente.categoria
          ? "el Jefe de Portería"
          : null;
    // Cocheras y galpones que factura y todavía no se ubicaron en el plano: se nombran
    // igual, así la tarjeta dice lo mismo que su carpeta y que Clientes.
    const sinLugar = vista === "porteria" ? [] : sinLugarEnPlano(cliente.facturado, suyos);
    const f = cliente.facturado;
    const facturaLugares =
      f.puestos + (f.propios ?? 0) + f.locales + f.contenedores + f.galpones + f.cocheras + f.quintas > 0;

    // Orden en el celular: la deuda y Cobrar en el primer renglón; lo demás, abajo.
    // Desde @2xl (columna de la derecha) vuelven al orden del DOM.
    const botonEditar =
      editarPuesto && suyos.length > 0 ? (
        <Button
          type="button"
          variant="outline"
          className={cn(BOTON, "order-3 @2xl:order-none")}
          aria-expanded={suyos.length > 1 ? eligiendo : undefined}
          onClick={() => (suyos.length === 1 ? editarPuesto(suyos[0].id) : setEligiendo((v) => !v))}
        >
          <Pencil className="size-4" strokeWidth={2} />
          {suyos.length === 1 ? `Editar ${nombreConArticulo(suyos[0])}` : "Editar un puesto"}
        </Button>
      ) : null;
    const botonUbicar =
      puedeEditar && suyos.length === 0 && !esQuintero ? (
        <Button
          type="button"
          variant="outline"
          className={cn(BOTON, "order-3 @2xl:order-none")}
          onClick={() => onAsignarCliente(cliente.id)}
        >
          <UserPlus className="size-4" strokeWidth={2} />
          Ubicar en el plano
        </Button>
      ) : null;
    const botonFicha =
      destinos.ficha && gestiona ? (
        <Button asChild variant="outline" className={cn(BOTON, "order-3 @2xl:order-none")}>
          <Link href={`${destinos.ficha}/${cliente.id}`}>
            Ver ficha
            <ArrowRight className="size-4" strokeWidth={2} />
          </Link>
        </Button>
      ) : destinos.ficha && puedeEditar ? (
        // Administración y un quintero: la carpeta es del Jefe, pero la energía es suya (§4.7).
        <Button asChild variant="outline" className={cn(BOTON, "order-3 @2xl:order-none")}>
          <Link href={`${destinos.ficha}/${cliente.id}?tab=medidores`}>
            Ver sus medidores
            <ArrowRight className="size-4" strokeWidth={2} />
          </Link>
        </Button>
      ) : null;
    const hayOtros = botonEditar !== null || botonUbicar !== null || botonFicha !== null;

    return (
      <div className="relative flex flex-col gap-4 p-4 @2xl:flex-row @2xl:items-start @2xl:gap-6 @2xl:p-5 @2xl:pr-16">
        <BotonCerrar onCerrar={onCerrar} />
        {/* Quién es y qué ocupa, en una sola columna: el nombre usa todo el ancho que
            queda (en escritorio no se aprieta en 15 rem) y salta de renglón entero. */}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2 pr-12 @2xl:pr-0">
              <Sello estado={sello.estado} texto={sello.texto} />
              <span className="text-xs text-muted-foreground tabular">Carpeta N° {cliente.codigo}</span>
            </div>
            <p className="font-display text-lg leading-snug font-bold break-words">
              {/* La X llega hasta el primer renglón del nombre: ese renglón (solo ese)
                  corta antes, sin gastar alto en el celular. */}
              <span aria-hidden className="float-right h-3 w-10 @2xl:hidden" />
              {cliente.nombre}
            </p>
            {cliente.apodo ? (
              <p className="text-sm break-words text-muted-foreground">Le dicen “{cliente.apodo}”</p>
            ) : null}
          </div>

          <div className="min-w-0 space-y-2.5">
            {suyos.length > 0 ? (
              <ChipsEspacios espacios={suyos} onEnfocar={onEnfocar} />
            ) : esQuintero ? (
              <AvanceQuintero cliente={cliente} />
            ) : facturaLugares || sinLugar.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no tiene puestos asignados en el plano.</p>
            ) : null}
            {vista !== "porteria"
              ? suyos
                  .filter((e) => e.enAlquiler)
                  .map((e) => (
                    <p key={e.id} className="flex items-start gap-1.5 text-sm text-muted-foreground">
                      <KeyRound className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2} />
                      <span>
                        Alquila {conArticulo(e)}
                        {e.duenio ? (
                          <>
                            {" "}· dueño: <span className="font-medium text-foreground">{e.duenio}</span>
                          </>
                        ) : (
                          " · falta cargar el dueño"
                        )}
                      </span>
                    </p>
                  ))
              : null}
            {sinLugar.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                {suyos.length > 0 || esQuintero ? "También factura " : "Factura "}
                <span className="font-medium text-foreground">{listaConY(sinLugar)}</span>
                {" (todavía sin lugar en el plano)."}
              </p>
            ) : null}
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
            {puedeEditar && onSumar && sumables.length > 0 ? (
              // Unir puestos del mismo dueño sin pasar por "Asignar puestos": el libre de al
              // lado se le suma de un toque y el plano los dibuja en un solo bloque.
              <div className="space-y-2 rounded-lg border border-dashed border-primary/35 bg-accent/40 p-2.5">
                <p className="text-sm">
                  Al lado {sumables.length > 1 ? "quedan libres" : "queda libre"}{" "}
                  <span className="font-medium">{listaConY(sumables.map((e) => conArticulo(e)))}</span>.{" "}
                  {sumables.length > 1 ? "Si también son suyos, sumáselos:" : "Si también es suyo, sumáselo:"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {sumables.map((e) => (
                    <Button
                      key={e.id}
                      type="button"
                      variant="outline"
                      className={cn(BOTON, "bg-card")}
                      onClick={() => onSumar([e.id], cliente.id)}
                    >
                      <Link2 className="size-4" strokeWidth={2} />
                      Sumarle {conArticulo(e)}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
            {eligiendo && editarPuesto && suyos.length > 1 ? (
              <div className="space-y-1.5 rounded-lg border border-primary/25 bg-accent/60 p-2.5">
                <p className="text-sm font-medium">¿Cuál querés editar?</p>
                <div className="flex flex-wrap gap-1.5">
                  {suyos.map((e) => (
                    <Button
                      key={e.id}
                      type="button"
                      variant="outline"
                      className="min-h-11 min-w-11 bg-card px-3 font-display text-[15px] font-bold tabular"
                      onClick={() => editarPuesto(e.id)}
                      aria-label={`Editar ${nombreConArticulo(e)}`}
                    >
                      {e.propio ? <Flag className="size-3.5 text-primary" strokeWidth={2.2} aria-hidden /> : null}
                      {e.tipo === "puesto" ? numeroVisible(e) : etiquetaEspacio(e)}
                    </Button>
                  ))}
                  <Button type="button" variant="ghost" className="min-h-11 px-3 text-sm" onClick={() => setEligiendo(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Deuda y acciones. En el celular y la tablet la tarjeta tiene alto máximo y se
            desplaza por dentro: este pie queda FIJO abajo (Cobrar nunca queda cortado) y
            lo que sigue arriba se ve pasar por debajo de su borde. Desde @2xl es la
            columna de la derecha, como siempre. */}
        <div
          className={cn(
            "sticky bottom-0 z-10 -mx-4 -mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t bg-card px-4 pt-3 pb-4",
            "@2xl:static @2xl:z-auto @2xl:m-0 @2xl:shrink-0 @2xl:flex-col @2xl:items-end @2xl:gap-3 @2xl:border-t-0 @2xl:bg-transparent @2xl:p-0"
          )}
        >
          <div className="order-1 mr-auto @2xl:order-none @2xl:mr-0 @2xl:text-right">
            <p className="text-xs text-muted-foreground">Deuda</p>
            {cliente.deuda > 0 ? (
              <Money monto={cliente.deuda} className="font-display text-xl font-bold text-pendiente" />
            ) : (
              <p className="font-display text-xl font-bold text-pagado">Sin deuda</p>
            )}
          </div>
          {/* En el celular los botones son hijos directos del pie (contents) para que
              Cobrar vaya al lado de la deuda. Al costado (tablet ancha/escritorio) se apilan
              en una columna angosta: no aprietan la lista de puestos. */}
          <div className="contents @2xl:flex @2xl:max-w-60 @2xl:flex-wrap @2xl:justify-end @2xl:gap-2">
            {botonEditar}
            {botonUbicar}
            {botonFicha}
            {puedeCobrar && destinos.cobro ? (
              <Button asChild className={cn(BOTON, "order-2 @2xl:order-none")}>
                <Link href={`${destinos.cobro}/${cliente.id}`}>
                  <HandCoins className="size-4" strokeWidth={2} />
                  Cobrar
                </Link>
              </Button>
            ) : null}
          </div>
          {/* Corte de renglón (solo celular): lo secundario va debajo de la deuda y Cobrar. */}
          {hayOtros ? <span aria-hidden className="order-2 h-0 basis-full @2xl:hidden" /> : null}
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
    // Ocupado por alguien que no está en el mapa (dado de baja o ambulante): no hay ficha
    // que mostrar; se ofrece dejarlo libre.
    const huerfano = espacio.clienteId !== null;
    const sumarA = puedeEditar && onSumar && !huerfano ? vecinos : [];
    return (
      <div className="relative space-y-3 p-4 @xl:p-5 @xl:pr-16">
        <BotonCerrar onCerrar={onCerrar} />
        <div className="flex flex-col gap-3 @xl:flex-row @xl:items-center @xl:gap-6">
        <div className="min-w-0 flex-1 space-y-1 pr-12 @xl:pr-0">
          <div className="flex flex-wrap items-center gap-2">
            {huerfano ? <Sello estado="inactivo" texto="Ocupado" /> : <Sello estado="libre" texto="Libre" />}
            {espacio.propio ? <Sello estado="propio" /> : null}
            {espacio.medio ? <span className="text-xs text-muted-foreground">Medio puesto</span> : null}
            {espacio.enAlquiler ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <KeyRound className="size-3.5 text-primary" strokeWidth={2} />
                En alquiler{espacio.duenio ? ` · dueño: ${espacio.duenio}` : ""}
              </span>
            ) : null}
          </div>
          <p className="font-display text-lg font-bold">{titulo}</p>
          <p className="text-sm text-muted-foreground">
            {huerfano
              ? "Figura a nombre de un cliente que ya no está en el mapa (dado de baja o ambulante). Si quedó libre, liberalo."
              : espacio.nota
                ? `${espacio.nota}. Sin ${ocupante(espacio.tipo)} asignado en el sistema.`
                : `Sin ${ocupante(espacio.tipo)} asignado en el sistema.`}
          </p>
        </div>
        {puedeEditar ? (
          <div className="flex flex-wrap gap-2">
            {huerfano && onLiberar ? (
              <Button type="button" className={BOTON} onClick={() => onLiberar(espacio.id)}>
                <Unlink className="size-4" strokeWidth={2} />
                Liberar
              </Button>
            ) : !huerfano ? (
              <Button type="button" className={BOTON} onClick={() => onAsignarEspacio(espacio.id)}>
                <UserPlus className="size-4" strokeWidth={2} />
                Asignar {ocupante(espacio.tipo)}
              </Button>
            ) : null}
            {editarPuesto ? (
              <Button type="button" variant="outline" className={BOTON} onClick={() => editarPuesto(espacio.id)}>
                <Pencil className="size-4" strokeWidth={2} />
                Editar
              </Button>
            ) : null}
          </div>
        ) : null}
        </div>
        {sumarA.length > 0 && onSumar ? (
          // Lo más común al cargar el plano: el libre es de quien tiene el de al lado.
          <div className="space-y-2 rounded-lg border border-dashed border-primary/35 bg-accent/40 p-2.5">
            <p className="text-sm text-muted-foreground">
              ¿Es de quien tiene el de al lado? Se lo sumás y queda unido a su puesto.
            </p>
            <div className="flex flex-wrap gap-2">
              {sumarA.map((v) => (
                <Button
                  key={v.cliente.id}
                  type="button"
                  variant="outline"
                  className={cn(BOTON, "h-auto max-w-full bg-card py-2 text-left whitespace-normal")}
                  onClick={() => onSumar([espacio.id], v.cliente.id)}
                >
                  <Link2 className="size-4 shrink-0" strokeWidth={2} />
                  <span className="min-w-0">
                    <span className="block break-words">Sumárselo a {nombreDe(v.cliente)}</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      Tiene {listaConY(v.lugares.map((e) => conArticulo(e)))}
                      {v.faltanPuestos ? " · factura más puestos de los que tiene" : ""}
                    </span>
                  </span>
                </Button>
              ))}
            </div>
          </div>
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
