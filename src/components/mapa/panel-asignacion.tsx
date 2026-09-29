"use client";

import { useEffect, useState } from "react";
import {
  CircleCheck,
  FilePen,
  Flag,
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
import { Codigo } from "@/components/shared/codigo";
import { Sello } from "@/components/shared/sello";
import { BuscadorMapa } from "./buscador-mapa";
import { ChipsEspacios } from "./panel-detalle";
import {
  cantidad,
  CODIGO_DIFERENCIA,
  NOMBRE_TIPO,
  objetivoPlano,
  numeroVisible,
  textoDiferencia,
  unidadesPuestos,
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

/** Datos que se guardan del editor de un espacio. */
export type DatosEspacio = { numero: string | null; medio: boolean; nota: string | null; propio?: boolean };

/** "Facturar 1½ en la carpeta" · "Dejar de facturar en la carpeta". */
export function textoFacturar(d: Diferencia): string {
  return d.enPlano > 0 ? `Facturar ${formatFraccion(d.enPlano)} en la carpeta` : "Dejar de facturarlo en la carpeta";
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
  onFacturar,
  puedeFacturar,
  facturando = null,
  pedidoSalirEditor = false,
  onEditorSucio,
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
  onEditar: (espacio: Espacio, datos: DatosEspacio) => void;
  onConfirmar: () => void;
  onCancelarConfirmacion: () => void;
  onAceptarSugerencia: () => void;
  onDescartarSugerencia: () => void;
  onSeleccionarEspacio: (espacioId: string) => void;
  onCerrarEspacio: () => void;
  onEnfocar: (r: Rect) => void;
  /** C6: propone llevar la carpeta a lo que muestra el plano (EXME/EXPP/EXPL/EXPE). */
  onFacturar?: (cliente: ClienteMapa, dif: Diferencia) => void;
  /** ¿Este rol puede proponer el cambio en la carpeta de ese cliente? */
  puedeFacturar?: (cliente: ClienteMapa) => boolean;
  /** Clave "clienteId:tipo" de la propuesta que se está enviando. */
  facturando?: string | null;
  /** Se quiso salir del editor por otro lado (Escape, el fondo, otro puesto) con número o
   * nota sin guardar: el editor muestra el aviso "Salir sin guardar / Guardar y salir". */
  pedidoSalirEditor?: boolean;
  /** El editor avisa si tiene número o nota sin guardar. */
  onEditorSucio?: (sucio: boolean) => void;
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
            key={espacioSel.id}
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
            pedidoSalir={pedidoSalirEditor}
            onSucio={onEditorSucio}
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
              // Texto de ayuda corto: entra entero en el panel de 360 px del celular y en la
              // columna de 27 rem del escritorio (el pedido ya lo hace el título de arriba).
              <BuscadorMapa
                clientes={clientes}
                espacios={espacios}
                soloClientes
                placeholder="Nombre, apodo o N° de carpeta"
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
        onFacturar={onFacturar}
        puedeFacturar={puedeFacturar}
        facturando={facturando}
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
  const filas = (
    [
      { tipo: "puesto", codigo: "EXME", enPlano: unidadesPuestos(suyos, false), facturado: cliente.facturado.puestos },
      {
        tipo: "propio",
        codigo: "EXPP",
        enPlano: unidadesPuestos(suyos, true),
        facturado: cliente.facturado.propios ?? 0,
      },
    ] as const
  ).filter((f, i) => i === 0 || f.enPlano > 0 || f.facturado > 0);
  const completo =
    filas.some((f) => f.facturado > 0) &&
    filas.every((f) => Math.abs(f.enPlano - objetivoPlano(f.facturado, f.tipo)) < 0.001);

  return (
    <div className="space-y-3">
      {/* El nombre salta de renglón entero; si el panel es angosto, "Elegir a otro" baja
          a su propio renglón en vez de dejarle al nombre 150 px. */}
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Paintbrush className="size-5" strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1 basis-52">
          <p className="text-xs text-muted-foreground">Asignando a · Carpeta N° {cliente.codigo}</p>
          <p className="font-display text-lg leading-snug font-bold break-words">
            {cliente.nombre}
            {cliente.apodo ? (
              <span className="font-sans text-sm font-normal text-muted-foreground"> · “{cliente.apodo}”</span>
            ) : null}
          </p>
          <p className="text-sm text-muted-foreground">
            Tocá un puesto libre para sumárselo; tocá uno suyo para sacárselo.
          </p>
        </div>
        <Button type="button" variant="outline" className={cn(BOTON, "ml-[3.25rem] @md:ml-0")} onClick={onSoltar}>
          Elegir a otro
        </Button>
      </div>

      <div className="space-y-2.5 rounded-lg border bg-muted/30 p-3">
        <div className="flex justify-end">
          <span
            role="status"
            aria-live="polite"
            className={cn(
              "inline-flex min-h-4 items-center gap-1.5 text-xs font-medium",
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
        {filas.map((f) => {
          const pct = f.facturado > 0 ? Math.min(100, (f.enPlano / f.facturado) * 100) : f.enPlano > 0 ? 100 : 0;
          return (
            <div key={f.tipo} className="space-y-1.5">
              <div className="flex items-baseline gap-2 text-sm">
                <Codigo codigo={f.codigo} />
                <span className="font-display text-base font-bold tabular">{formatFraccion(f.enPlano)}</span>
                <span className="min-w-0 text-muted-foreground">
                  {f.facturado > 0
                    ? ` de ${cantidad(f.facturado, f.tipo)} facturados`
                    : f.tipo === "propio"
                      ? " puestos propios en el plano · no factura EXPP"
                      : " puestos en el plano · no factura expensa de puesto"}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted ring-1 ring-foreground/5">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-300",
                    f.enPlano > f.facturado && f.facturado > 0 ? "bg-parcial" : "bg-primary"
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        {suyos.length > 0 ? (
          <div className="pt-1">
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
      className="flex flex-col gap-3 rounded-lg border border-parcial/40 bg-parcial-suave px-4 py-3 @md:flex-row @md:items-center"
    >
      <TriangleAlert className="hidden size-5 shrink-0 text-parcial @md:block" strokeWidth={2} />
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
    <div className="flex flex-col gap-3 rounded-lg border border-primary/25 bg-accent px-4 py-3 @md:flex-row @md:items-center">
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
  pedidoSalir = false,
  onSucio,
}: {
  espacio: Espacio;
  duenio: ClienteMapa | null;
  clientes: ClienteMapa[];
  espacios: Espacio[];
  guardando: boolean;
  onAsignar: (clienteId: string | null) => void;
  onEditar: (datos: DatosEspacio) => void;
  onCerrar: () => void;
  /** Se quiso salir por fuera del editor (Escape, el fondo, otro puesto) con cambios. */
  pedidoSalir?: boolean;
  onSucio?: (sucio: boolean) => void;
}) {
  // Número y nota se tipean y van con "Guardar". Medio puesto y puesto propio se guardan
  // solos al tocar el switch (C3): se muestran tal cual está el espacio (optimista).
  const [numero, setNumero] = useState(espacio.numero ?? "");
  const [nota, setNota] = useState(espacio.nota ?? "");
  const [avisoSinGuardar, setAvisoSinGuardar] = useState(false);
  const cambio = numero.trim() !== (espacio.numero ?? "") || nota.trim() !== (espacio.nota ?? "");
  // El mapa pregunta antes de cerrar el editor por fuera (Escape, el fondo, otro puesto).
  useEffect(() => {
    onSucio?.(cambio);
  }, [cambio, onSucio]);
  useEffect(() => () => onSucio?.(false), [onSucio]);
  const mostrarAviso = cambio && (avisoSinGuardar || pedidoSalir);
  const esPuesto = espacio.tipo === "puesto";
  const propio = Boolean(espacio.propio);
  const titulo =
    espacio.tipo === "bar" ? "Bar" : `${NOMBRE_TIPO[espacio.tipo]} ${numeroVisible(espacio)}`;

  function guardarTexto() {
    if (!cambio) return;
    setAvisoSinGuardar(false);
    onEditar({ numero: numero.trim() || null, medio: esPuesto ? espacio.medio : false, nota: nota.trim() || null });
  }

  /** Switch: guarda ese dato solo, con el número y la nota que ya están guardados. */
  function guardarSwitch(datos: { medio?: boolean; propio?: boolean }) {
    onEditar({
      numero: espacio.numero,
      medio: datos.medio ?? espacio.medio,
      nota: espacio.nota,
      ...(datos.propio !== undefined ? { propio: datos.propio } : {}),
    });
  }

  function cerrar() {
    if (cambio && !avisoSinGuardar) {
      setAvisoSinGuardar(true);
      return;
    }
    onCerrar();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-display text-lg font-bold">
            {titulo}
            {espacio.propio ? <Sello estado="propio" /> : null}
          </p>
          <p className="text-sm break-words text-muted-foreground">
            {duenio ? (
              <>
                Lo ocupa <strong className="text-foreground">{duenio.nombre}</strong> (carpeta N° {duenio.codigo}).
              </>
            ) : espacio.clienteId ? (
              "A nombre de alguien que ya no está en el mapa."
            ) : (
              "Libre."
            )}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="size-11 shrink-0"
          onClick={cerrar}
          aria-label="Cerrar"
        >
          <X className="size-5" strokeWidth={2} />
        </Button>
      </div>

      {mostrarAviso ? (
        <div
          role="alertdialog"
          aria-label="Cambios sin guardar"
          className="flex flex-col gap-3 rounded-lg border border-parcial/40 bg-parcial-suave px-4 py-3 @md:flex-row @md:items-center"
        >
          <p className="flex-1 text-sm">Cambiaste el número o la nota y todavía no lo guardaste.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className={cn(BOTON, "bg-card")} onClick={onCerrar}>
              Salir sin guardar
            </Button>
            <Button
              type="button"
              className={BOTON}
              onClick={() => {
                guardarTexto();
                onCerrar();
              }}
              disabled={guardando}
            >
              Guardar y salir
            </Button>
          </div>
        </div>
      ) : null}

      <form
        className="grid gap-3 @md:grid-cols-[8rem_minmax(0,1fr)_auto] @md:items-end"
        onSubmit={(ev) => {
          ev.preventDefault();
          guardarTexto();
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
            className="h-11 text-[15px] md:text-[15px]"
          />
        </div>
        <Button type="submit" className={BOTON} disabled={!cambio || guardando}>
          Guardar
        </Button>
      </form>

      {esPuesto ? (
        <div className="space-y-2">
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <Switch
              checked={espacio.medio}
              disabled={guardando}
              onCheckedChange={(v) => guardarSwitch({ medio: v })}
              aria-label="Medio puesto"
            />
            <span className="text-sm">
              Medio puesto{" "}
              <span className="text-muted-foreground">(cuenta ½ en la expensa: EXME, o EXPP si es propio)</span>
            </span>
          </label>
          <label
            className={cn(
              "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2",
              propio ? "border-primary/40 bg-accent/60" : "bg-card"
            )}
          >
            <Switch
              checked={propio}
              disabled={guardando}
              onCheckedChange={(v) => guardarSwitch({ propio: v })}
              aria-label="Puesto propio de la cooperativa"
            />
            <Flag className={cn("size-4 shrink-0", propio ? "text-primary" : "text-muted-foreground")} strokeWidth={2} />
            <span className="text-sm">
              <span className="font-medium">Puesto propio de la cooperativa</span>{" "}
              <span className="text-muted-foreground">· paga EXPP (Expensas Puestos Propios)</span>
            </span>
          </label>
          <p className="text-xs text-muted-foreground">Los dos interruptores se guardan solos al tocarlos.</p>
        </div>
      ) : null}

      <div className="space-y-2 border-t pt-4">
        <p className="text-sm font-medium">{duenio ? "Pasárselo a otro puestero" : "Asignárselo a un puestero"}</p>
        {/* Arriba y no al centro: la lista de resultados se abre debajo del campo y
            Liberar tiene que quedar a la altura del campo, no a la mitad de la lista. */}
        <div className="flex flex-col gap-2 @md:flex-row @md:items-start">
          <BuscadorMapa
            clientes={clientes}
            espacios={espacios}
            soloClientes
            placeholder="Nombre, apodo o N° de carpeta"
            onElegir={(r) => r.tipo === "cliente" && onAsignar(r.id)}
            className="flex-1"
          />
          {espacio.clienteId ? (
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
  onFacturar,
  puedeFacturar,
  facturando,
}: {
  revisiones: Revision[];
  onPincel: (clienteId: string) => void;
  onSeleccionarEspacio: (espacioId: string) => void;
  onFacturar?: (cliente: ClienteMapa, dif: Diferencia) => void;
  puedeFacturar?: (cliente: ClienteMapa) => boolean;
  facturando?: string | null;
}) {
  const accion = (r: Extract<Revision, { tipo: "falta" | "sobra" }>) => {
    if (!onFacturar || (puedeFacturar && !puedeFacturar(r.cliente))) return undefined;
    if (r.cliente.cambioPendiente) return { pendiente: true as const };
    const clave = `${r.cliente.id}:${r.dif.tipo}`;
    return {
      pendiente: false as const,
      texto: textoFacturar(r.dif),
      codigo: CODIGO_DIFERENCIA[r.dif.tipo],
      enviando: facturando === clave,
      onClick: () => onFacturar(r.cliente, r.dif),
    };
  };
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
                facturar={accion(r)}
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
                facturar={accion(r)}
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

type AccionFacturar =
  | { pendiente: true }
  | { pendiente: false; texto: string; codigo: string; enviando: boolean; onClick: () => void };

function FilaRevision({
  titulo,
  detalle,
  aviso = false,
  icono = false,
  onClick,
  facturar,
}: {
  titulo: string;
  detalle: string;
  aviso?: boolean;
  icono?: boolean;
  onClick: () => void;
  /** C6: propuesta de ajuste de la carpeta (o "Esperando aprobación"). */
  facturar?: AccionFacturar;
}) {
  return (
    <li className="overflow-hidden rounded-md border bg-card">
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-11 w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-accent/60"
      >
        {icono ? <Hash className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} /> : null}
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-sm leading-snug font-medium break-words" title={titulo}>
            {titulo}
          </span>
          <span className={cn("block text-xs", aviso ? "text-parcial" : "text-muted-foreground")}>{detalle}</span>
        </span>
      </button>
      {facturar ? (
        <div className="flex min-h-11 items-center gap-2 border-t bg-muted/30 px-2 py-1">
          {facturar.pendiente ? (
            <Sello estado="pendiente_aprobacion" />
          ) : (
            <Button
              type="button"
              variant="ghost"
              className="min-h-10 flex-1 justify-start px-2 text-sm font-medium text-primary"
              onClick={facturar.onClick}
              disabled={facturar.enviando}
            >
              {facturar.enviando ? (
                <Loader2 className="size-4 animate-spin" strokeWidth={2} />
              ) : (
                <FilePen className="size-4" strokeWidth={2} />
              )}
              {facturar.texto}
              <span className="ml-auto">
                <Codigo codigo={facturar.codigo} />
              </span>
            </Button>
          )}
        </div>
      ) : null}
    </li>
  );
}
