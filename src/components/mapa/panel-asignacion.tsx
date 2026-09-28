"use client";

import { useState } from "react";
import {
  CircleCheck,
  Hash,
  Loader2,
  Paintbrush,
  TriangleAlert,
  Unlink,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFraccion } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { BuscadorMapa } from "./buscador-mapa";
import { ChipsEspacios } from "./panel-detalle";
import {
  cantidad,
  NOMBRE_TIPO,
  objetivoPlano,
  numeroVisible,
  textoDiferencia,
  unidades,
  type Diferencia,
} from "./geometria";
import type { ClienteMapa, Espacio, Rect } from "./tipos";

const BOTON = "min-h-11 px-4 text-sm font-semibold";

export type Confirmacion = { espacioId: string; deClienteId: string; aClienteId: string };
export type Sugerencia = { espacioIds: string[]; clienteId: string; baseId: string };

/** Algo del plano que conviene revisar (cruce con la facturación y datos). */
export type Revision =
  | { tipo: "falta" | "sobra"; cliente: ClienteMapa; dif: Diferencia }
  | { tipo: "repetido"; numero: string; espacios: Espacio[] }
  | { tipo: "sin_numero"; espacio: Espacio };

function nombreCorto(c: ClienteMapa): string {
  return c.apodo ?? c.nombre;
}

/** Panel del modo "Asignar puestos": el pincel (a quién se le asigna), el
 * editor de un espacio suelto y la lista de cosas para revisar. */
export function PanelAsignacion({
  clientes,
  clientePorId,
  espacios,
  porCliente,
  pincel,
  espacioSel,
  confirmacion,
  sugerencia,
  revisiones,
  guardando,
  onPincel,
  onAsignar,
  onEditar,
  onConfirmar,
  onCancelarConfirmacion,
  onAceptarSugerencia,
  onDescartarSugerencia,
  onSeleccionarEspacio,
  onCerrarEspacio,
  onEnfocar,
}: {
  clientes: ClienteMapa[];
  clientePorId: Map<string, ClienteMapa>;
  espacios: Espacio[];
  porCliente: Map<string, Espacio[]>;
  pincel: string | null;
  espacioSel: Espacio | null;
  confirmacion: Confirmacion | null;
  sugerencia: Sugerencia | null;
  revisiones: Revision[];
  guardando: boolean;
  onPincel: (clienteId: string | null) => void;
  onAsignar: (espacioIds: string[], clienteId: string | null) => void;
  onEditar: (espacio: Espacio, datos: { numero: string | null; medio: boolean; nota: string | null }) => void;
  onConfirmar: () => void;
  onCancelarConfirmacion: () => void;
  onAceptarSugerencia: () => void;
  onDescartarSugerencia: () => void;
  onSeleccionarEspacio: (espacioId: string) => void;
  onCerrarEspacio: () => void;
  onEnfocar: (r: Rect) => void;
}) {
  const cliPincel = pincel ? clientePorId.get(pincel) ?? null : null;
  const espacioPorId = new Map(espacios.map((e) => [e.id, e]));

  return (
    <div className="grid gap-5 p-4 @xl:p-5 @4xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-4">
        {/* Avisos que piden una respuesta */}
        {confirmacion ? (
          <AvisoConfirmacion
            confirmacion={confirmacion}
            espacio={espacioPorId.get(confirmacion.espacioId) ?? null}
            de={clientePorId.get(confirmacion.deClienteId) ?? null}
            a={clientePorId.get(confirmacion.aClienteId) ?? null}
            onConfirmar={onConfirmar}
            onCancelar={onCancelarConfirmacion}
          />
        ) : null}
        {sugerencia && !confirmacion ? (
          <AvisoSugerencia
            base={espacioPorId.get(sugerencia.baseId) ?? null}
            otros={sugerencia.espacioIds.flatMap((id) => espacioPorId.get(id) ?? [])}
            cliente={clientePorId.get(sugerencia.clienteId) ?? null}
            onAceptar={onAceptarSugerencia}
            onDescartar={onDescartarSugerencia}
          />
        ) : null}

        {cliPincel ? (
          <PincelActivo
            cliente={cliPincel}
            suyos={porCliente.get(cliPincel.id) ?? []}
            guardando={guardando}
            onSoltar={() => onPincel(null)}
            onEnfocar={onEnfocar}
          />
        ) : espacioSel ? (
          <EditorEspacio
            key={`${espacioSel.id}:${espacioSel.numero}:${espacioSel.medio}:${espacioSel.nota}`}
            espacio={espacioSel}
            duenio={espacioSel.clienteId ? clientePorId.get(espacioSel.clienteId) ?? null : null}
            clientes={clientes}
            espacios={espacios}
            guardando={guardando}
            onAsignar={(clienteId) => {
              onAsignar([espacioSel.id], clienteId);
              if (clienteId) onPincel(clienteId);
            }}
            onEditar={(datos) => onEditar(espacioSel, datos)}
            onCerrar={onCerrarEspacio}
          />
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Paintbrush className="size-5" strokeWidth={1.9} />
              </span>
              <div>
                <p className="font-display text-base font-bold">¿A quién le asignás puestos?</p>
                <p className="text-sm text-muted-foreground">
                  Elegí un puestero y después tocá sus puestos en el plano. Cada toque se guarda solo.
                  Para corregir el número de un puesto, tocalo sin elegir a nadie.
                </p>
              </div>
            </div>
            {clientes.length > 0 ? (
              <BuscadorMapa
                clientes={clientes}
                espacios={espacios}
                soloClientes
                placeholder="Buscá el puestero por nombre, apodo o carpeta"
                onElegir={(r) => r.tipo === "cliente" && onPincel(r.id)}
              />
            ) : (
              <p className="rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                Todavía no hay clientes cargados. Dalos de alta en Clientes (con sus expensas) y
                volvé para ubicarlos en el plano.
              </p>
            )}
          </div>
        )}
      </div>

      <ListaRevision
        revisiones={revisiones}
        onPincel={onPincel}
        onSeleccionarEspacio={onSeleccionarEspacio}
      />
    </div>
  );
}

function PincelActivo({
  cliente,
  suyos,
  guardando,
  onSoltar,
  onEnfocar,
}: {
  cliente: ClienteMapa;
  suyos: Espacio[];
  guardando: boolean;
  onSoltar: () => void;
  onEnfocar: (r: Rect) => void;
}) {
  const enPlano = unidades(suyos);
  const facturado = cliente.facturado.puestos;
  const completo = facturado > 0 && Math.abs(enPlano - objetivoPlano(facturado, "puesto")) < 0.001;
  const pct = facturado > 0 ? Math.min(100, (enPlano / facturado) * 100) : enPlano > 0 ? 100 : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Paintbrush className="size-5" strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Asignando a · Carpeta N° {cliente.codigo}</p>
          <p className="truncate font-display text-lg leading-snug font-bold">
            {cliente.nombre}
            {cliente.apodo ? (
              <span className="font-sans text-sm font-normal text-muted-foreground"> · “{cliente.apodo}”</span>
            ) : null}
          </p>
          <p className="text-sm text-muted-foreground">
            Tocá un puesto libre para sumárselo; tocá uno suyo para sacárselo.
          </p>
        </div>
        <Button type="button" variant="outline" className={BOTON} onClick={onSoltar}>
          Elegir a otro
        </Button>
      </div>

      <div className="rounded-lg border bg-muted/30 p-3">
        <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
          <span>
            <span className="font-display text-base font-bold tabular">{formatFraccion(enPlano)}</span>
            <span className="text-muted-foreground">
              {facturado > 0
                ? ` de ${cantidad(facturado, "puesto")} facturados`
                : " puestos en el plano · no factura expensa de puestos"}
            </span>
          </span>
          <span
            role="status"
            aria-live="polite"
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-medium",
              guardando ? "text-muted-foreground" : completo ? "text-pagado" : "text-transparent"
            )}
          >
            {guardando ? (
              <>
                <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                Guardando…
              </>
            ) : completo ? (
              <>
                <CircleCheck className="size-3.5" strokeWidth={2.2} />
                Coincide con lo facturado
              </>
            ) : (
              "·"
            )}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted ring-1 ring-foreground/5">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-300",
              enPlano > facturado && facturado > 0 ? "bg-parcial" : "bg-primary"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        {suyos.length > 0 ? (
          <div className="mt-3">
            <ChipsEspacios espacios={suyos} onEnfocar={onEnfocar} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AvisoConfirmacion({
  espacio,
  de,
  a,
  onConfirmar,
  onCancelar,
}: {
  confirmacion: Confirmacion;
  espacio: Espacio | null;
  de: ClienteMapa | null;
  a: ClienteMapa | null;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  if (!espacio) return null;
  const nombreEspacio = espacio.tipo === "bar" ? "El bar" : `El ${NOMBRE_TIPO[espacio.tipo].toLowerCase()} ${numeroVisible(espacio)}`;
  return (
    <div
      role="alertdialog"
      aria-label="Confirmar cambio de puestero"
      className="flex flex-col gap-3 rounded-lg border border-parcial/40 bg-parcial-suave px-4 py-3 sm:flex-row sm:items-center"
    >
      <TriangleAlert className="hidden size-5 shrink-0 text-parcial sm:block" strokeWidth={2} />
      <p className="flex-1 text-sm">
        {nombreEspacio} es de <strong>{de ? nombreCorto(de) : "otro cliente"}</strong>. ¿Se lo pasás a{" "}
        <strong>{a ? nombreCorto(a) : "este cliente"}</strong>?
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className={BOTON} onClick={onCancelar}>
          No
        </Button>
        <Button type="button" className={BOTON} onClick={onConfirmar} autoFocus>
          Pasárselo
        </Button>
      </div>
    </div>
  );
}

function AvisoSugerencia({
  base,
  otros,
  cliente,
  onAceptar,
  onDescartar,
}: {
  base: Espacio | null;
  otros: Espacio[];
  cliente: ClienteMapa | null;
  onAceptar: () => void;
  onDescartar: () => void;
}) {
  if (!base || otros.length === 0) return null;
  const lista = otros.map(numeroVisible);
  const texto = lista.length === 1 ? `el ${lista[0]}` : `${lista.slice(0, -1).join(", ")} y ${lista[lista.length - 1]}`;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-primary/25 bg-accent px-4 py-3 sm:flex-row sm:items-center">
      <p className="flex-1 text-sm text-accent-foreground">
        En el plano original el {numeroVisible(base)} va junto con {texto}. ¿Se {otros.length === 1 ? "lo" : "los"}{" "}
        asignás también a <strong>{cliente ? nombreCorto(cliente) : "este puestero"}</strong>?
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className={cn(BOTON, "bg-card")} onClick={onDescartar}>
          No
        </Button>
        <Button type="button" className={BOTON} onClick={onAceptar}>
          Sumar {otros.length === 1 ? "el" : "los"} {otros.length}
        </Button>
      </div>
    </div>
  );
}

function EditorEspacio({
  espacio,
  duenio,
  clientes,
  espacios,
  guardando,
  onAsignar,
  onEditar,
  onCerrar,
}: {
  espacio: Espacio;
  duenio: ClienteMapa | null;
  clientes: ClienteMapa[];
  espacios: Espacio[];
  guardando: boolean;
  onAsignar: (clienteId: string | null) => void;
  onEditar: (datos: { numero: string | null; medio: boolean; nota: string | null }) => void;
  onCerrar: () => void;
}) {
  const [numero, setNumero] = useState(espacio.numero ?? "");
  const [medio, setMedio] = useState(espacio.medio);
  const [nota, setNota] = useState(espacio.nota ?? "");
  const cambio =
    numero.trim() !== (espacio.numero ?? "") ||
    medio !== espacio.medio ||
    nota.trim() !== (espacio.nota ?? "");
  const titulo =
    espacio.tipo === "bar" ? "Bar" : `${NOMBRE_TIPO[espacio.tipo]} ${numeroVisible(espacio)}`;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-bold">{titulo}</p>
          <p className="text-sm text-muted-foreground">
            {duenio ? (
              <>
                Lo ocupa <strong className="text-foreground">{duenio.nombre}</strong> (carpeta N° {duenio.codigo}).
              </>
            ) : (
              "Libre."
            )}
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon-lg" className="size-11" onClick={onCerrar} aria-label="Cerrar">
          <X className="size-5" strokeWidth={2} />
        </Button>
      </div>

      <form
        className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-end"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (!cambio) return;
          onEditar({
            numero: numero.trim() || null,
            medio: espacio.tipo === "puesto" ? medio : false,
            nota: nota.trim() || null,
          });
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="espacio-numero">Número</Label>
          <Input
            id="espacio-numero"
            value={numero}
            maxLength={12}
            inputMode="text"
            placeholder="Sin número"
            onChange={(e) => setNumero(e.target.value)}
            className="h-11 font-display text-base font-bold tabular"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="espacio-nota">Nota</Label>
          <Input
            id="espacio-nota"
            value={nota}
            maxLength={60}
            placeholder="Por ejemplo: Quiniela"
            onChange={(e) => setNota(e.target.value)}
            className="h-11"
          />
        </div>
        <Button type="submit" className={BOTON} disabled={!cambio || guardando}>
          Guardar
        </Button>
        {espacio.tipo === "puesto" ? (
          <label className="flex min-h-11 cursor-pointer items-center gap-3 sm:col-span-3">
            <Switch checked={medio} onCheckedChange={setMedio} aria-label="Medio puesto" />
            <span className="text-sm">
              Medio puesto <span className="text-muted-foreground">(cuenta ½ en la expensa de puestos)</span>
            </span>
          </label>
        ) : null}
      </form>

      <div className="space-y-2 border-t pt-4">
        <p className="text-sm font-medium">{duenio ? "Pasárselo a otro puestero" : "Asignárselo a un puestero"}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <BuscadorMapa
            clientes={clientes}
            espacios={espacios}
            soloClientes
            placeholder="Buscá por nombre, apodo o carpeta"
            onElegir={(r) => r.tipo === "cliente" && onAsignar(r.id)}
            className="flex-1"
          />
          {duenio ? (
            <Button type="button" variant="outline" className={BOTON} onClick={() => onAsignar(null)}>
              <Unlink className="size-4" strokeWidth={2} />
              Liberar
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ListaRevision({
  revisiones,
  onPincel,
  onSeleccionarEspacio,
}: {
  revisiones: Revision[];
  onPincel: (clienteId: string) => void;
  onSeleccionarEspacio: (espacioId: string) => void;
}) {
  const faltan = revisiones.filter((r) => r.tipo === "falta");
  const sobran = revisiones.filter((r) => r.tipo === "sobra");
  const plano = revisiones.filter((r) => r.tipo === "repetido" || r.tipo === "sin_numero");

  return (
    <aside className="space-y-4 rounded-lg border bg-muted/25 p-3.5">
      <p className="font-display text-sm font-bold">Para revisar</p>
      {revisiones.length === 0 ? (
        <p className="flex items-start gap-2 text-sm text-pagado">
          <CircleCheck className="mt-0.5 size-4 shrink-0" strokeWidth={2.2} />
          Todo en orden: el plano coincide con lo que se factura.
        </p>
      ) : null}

      {faltan.length > 0 ? (
        <GrupoRevision titulo="Por ubicar" descripcion="Facturan más de lo que tienen en el plano.">
          {faltan.map((r) =>
            r.tipo === "falta" ? (
              <FilaRevision
                key={`${r.cliente.id}:${r.dif.tipo}`}
                titulo={nombreCorto(r.cliente)}
                detalle={textoDiferencia(r.dif)}
                onClick={() => onPincel(r.cliente.id)}
              />
            ) : null
          )}
        </GrupoRevision>
      ) : null}

      {sobran.length > 0 ? (
        <GrupoRevision titulo="Ocupan de más" descripcion="Tienen en el plano más de lo que se les factura.">
          {sobran.map((r) =>
            r.tipo === "sobra" ? (
              <FilaRevision
                key={`${r.cliente.id}:${r.dif.tipo}`}
                titulo={nombreCorto(r.cliente)}
                detalle={textoDiferencia(r.dif)}
                aviso
                onClick={() => onPincel(r.cliente.id)}
              />
            ) : null
          )}
        </GrupoRevision>
      ) : null}

      {plano.length > 0 ? (
        <GrupoRevision titulo="Números del plano" descripcion="Así vienen del dibujo original: corregilos tocándolos.">
          {plano.map((r) =>
            r.tipo === "repetido" ? (
              <FilaRevision
                key={`rep:${r.numero}`}
                icono
                titulo={`El ${r.numero} aparece ${r.espacios.length} veces`}
                detalle="Tocá para corregir uno."
                onClick={() => onSeleccionarEspacio(r.espacios[r.espacios.length - 1].id)}
              />
            ) : r.tipo === "sin_numero" ? (
              <FilaRevision
                key={`sn:${r.espacio.id}`}
                icono
                titulo="Un puesto sin número"
                detalle="Figura con “?” en el plano."
                onClick={() => onSeleccionarEspacio(r.espacio.id)}
              />
            ) : null
          )}
        </GrupoRevision>
      ) : null}
    </aside>
  );
}

function GrupoRevision({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div>
        <p className="text-xs font-semibold text-foreground">{titulo}</p>
        <p className="text-xs text-muted-foreground">{descripcion}</p>
      </div>
      <ul className="space-y-1">{children}</ul>
    </div>
  );
}

function FilaRevision({
  titulo,
  detalle,
  aviso = false,
  icono = false,
  onClick,
}: {
  titulo: string;
  detalle: string;
  aviso?: boolean;
  icono?: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-11 w-full items-center gap-2.5 rounded-md border bg-card px-3 py-1.5 text-left transition-colors hover:border-primary/35 hover:bg-accent/60"
      >
        {icono ? <Hash className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} /> : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{titulo}</span>
          <span className={cn("block truncate text-xs", aviso ? "text-parcial" : "text-muted-foreground")}>
            {detalle}
          </span>
        </span>
      </button>
    </li>
  );
}
