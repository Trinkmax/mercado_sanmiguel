"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Info, Pencil, Send } from "lucide-react";
import { toast } from "sonner";
import {
  actualizarConcepto,
  cambiarActivoConcepto,
  type EstadoSolicitud,
} from "@/lib/actions/configuracion";
import { formatARS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Codigo } from "@/components/shared/codigo";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { llamarAccion } from "@/lib/llamar-accion";

export type TipoConcepto =
  | "recurrente"
  | "energia"
  | "canon_diario"
  | "deuda"
  | "diario"
  | "abono_energia"
  | "eventual";

export type ConceptoFila = {
  id: string;
  codigo: string;
  nombre: string;
  tipo: TipoConcepto;
  segmento: string | null;
  precio: number;
  descuento_pronto_pago: number;
  orden_imputacion: number;
  activo: boolean;
};

/** Cambio que espera la aprobación del Líder para un concepto. */
export type CambioPendienteConcepto = {
  resumen: string;
  solicitadoEn: string;
};

const LABEL_TIPO: Record<TipoConcepto, string> = {
  recurrente: "Por mes",
  energia: "Por kWh consumido",
  canon_diario: "Por vehículo (tarifas)",
  deuda: "Deuda anterior",
  diario: "Por día",
  abono_energia: "Abono de energía, por mes",
  eventual: "Eventual",
};

/** Unidad que acompaña al precio. */
const UNIDAD: Partial<Record<TipoConcepto, string>> = {
  recurrente: "por mes",
  energia: "por kWh",
  diario: "por día",
  abono_energia: "por mes",
};

/** Conceptos cuyo monto no sale del precio del catálogo. */
const SIN_PRECIO: TipoConcepto[] = ["deuda", "eventual", "canon_diario"];
const TEXTO_SIN_PRECIO: Partial<Record<TipoConcepto, string>> = {
  deuda: "Según cada deuda",
  eventual: "Según cada registro",
  canon_diario: "Por tarifa",
};

type Grupo = { clave: string; titulo: string; ayuda: string };
const GRUPOS: Grupo[] = [
  { clave: "puestos", titulo: "Puestos y espacios", ayuda: "Lo que paga cada mes quien ocupa un puesto, local, galpón, contéiner o cochera." },
  { clave: "quintas", titulo: "Quintas y ambulantes", ayuda: "Los propone el Jefe de Portería." },
  { clave: "energia", titulo: "Energía", ayuda: "Abono mensual a quien tiene medidor, más el consumo." },
  { clave: "otros", titulo: "Otros", ayuda: "Montos que no salen de esta lista: deudas, multas y el bono camioneros." },
];

function grupoDe(c: ConceptoFila): string {
  if (c.segmento === "quinteros" || c.segmento === "ambulantes") return "quintas";
  if (c.tipo === "energia" || c.tipo === "abono_energia") return "energia";
  if (c.tipo === "recurrente") return "puestos";
  return "otros";
}

const TOAST_ENVIADO = "Enviado al Líder de Procesos para su aprobación.";

function soloDigitos(valor: string): string {
  return valor.replace(/\D+/g, "");
}

/** Beneficio mientras se tipea: números y UNA coma (el punto también vale), hasta 3 enteros y 2 decimales ("12,5"). */
function porcentajeTipeado(valor: string): string {
  const [entero = "", ...resto] = valor.replace(/\./g, ",").replace(/[^0-9,]/g, "").split(",");
  const ent = entero.slice(0, 3);
  return resto.length === 0 ? ent : `${ent},${resto.join("").slice(0, 2)}`;
}

/** 12.5 → "12,5" (así se lee en castellano y así se precarga). */
function porcentajeTexto(n: number): string {
  return String(Number(n)).replace(".", ",");
}

/** "12,5" → 12.5 ("" = 0). */
function porcentajeNumero(texto: string): number {
  return Number((texto || "0").replace(",", "."));
}

export function TablaConceptos({
  conceptos,
  pendientes,
  aplicaDirecto,
  verTarifas = false,
}: {
  conceptos: ConceptoFila[];
  /** Cambios pendientes por id de concepto (para el sello "Esperando aprobación"). */
  pendientes: Record<string, CambioPendienteConcepto[]>;
  /** true = Líder de Procesos: sus cambios se aplican en el acto. */
  aplicaDirecto: boolean;
  /** Muestra el link a Tarifas de transporte en el bono camioneros (Líder). */
  verTarifas?: boolean;
}) {
  const [editando, setEditando] = useState<ConceptoFila | null>(null);
  const [precio, setPrecio] = useState("");
  const [descuento, setDescuento] = useState("");
  const [orden, setOrden] = useState("");
  const [guardando, startGuardar] = useTransition();
  const [togglePendiente, setTogglePendiente] = useState<string | null>(null);
  const [, startToggle] = useTransition();

  function abrirEdicion(concepto: ConceptoFila) {
    setEditando(concepto);
    setPrecio(String(Math.round(concepto.precio)));
    setDescuento(porcentajeTexto(concepto.descuento_pronto_pago));
    setOrden(String(concepto.orden_imputacion));
  }

  function avisar(estado: EstadoSolicitud, aplicado: string) {
    if (estado === "sin_cambios") {
      toast.info("No había nada para cambiar.");
    } else if (estado === "pendiente") {
      toast.success(TOAST_ENVIADO);
    } else {
      toast.success(aplicado);
    }
  }

  function guardar() {
    if (!editando) return;
    startGuardar(async () => {
      const res = await llamarAccion(() => actualizarConcepto({
        id: editando.id,
        precio: Number(precio || 0),
        descuento_pronto_pago: porcentajeNumero(descuento),
        orden_imputacion: Number(orden || 0),
      }));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      avisar(res.data.estado, `Guardado. ${editando.nombre} quedó actualizado.`);
      setEditando(null);
    });
  }

  function cambiarActivo(concepto: ConceptoFila, activo: boolean) {
    setTogglePendiente(concepto.id);
    startToggle(async () => {
      const res = await llamarAccion(() => cambiarActivoConcepto({ id: concepto.id, activo }));
      if (!res.ok) toast.error(res.error);
      else
        avisar(
          res.data.estado,
          activo
            ? `${concepto.nombre} quedó activo.`
            : `${concepto.nombre} quedó inactivo: no se genera más.`
        );
      setTogglePendiente(null);
    });
  }

  const porGrupo = GRUPOS.map((g) => ({
    ...g,
    items: conceptos.filter((c) => grupoDe(c) === g.clave),
  })).filter((g) => g.items.length > 0);

  const sinPrecioEditando = editando ? SIN_PRECIO.includes(editando.tipo) : false;
  const descuentoFuera = porcentajeNumero(descuento) > 100;

  return (
    <div className="space-y-6">
      <Alert className="px-4 py-3" data-tour="config-orden">
        <Info strokeWidth={2} />
        <AlertTitle className="text-sm">
          Los precios nuevos rigen desde la próxima generación mensual. Lo ya
          generado no cambia.
        </AlertTitle>
        <AlertDescription className="text-sm">
          Cuando un cliente paga, la plata entra sola en el orden de esta lista
          (primero la deuda más vieja; dentro del mes, el número de orden más
          bajo cobra primero). Para que un concepto no se le cobre a un cliente
          puntual, sacáselo desde su carpeta.
          {aplicaDirecto
            ? ""
            : " Cada cambio queda esperando la aprobación del Líder de Procesos antes de aplicarse."}
        </AlertDescription>
      </Alert>

      {porGrupo.map((grupo) => (
        <section key={grupo.clave} className="space-y-2">
          <div>
            <h2 className="font-display text-lg font-bold">{grupo.titulo}</h2>
            <p className="text-sm text-muted-foreground">{grupo.ayuda}</p>
          </div>
          {/* Las filas comparten columnas (subgrid): el interruptor "Activo" queda alineado aunque
              una fila no tenga "Editar" (el bono camioneros lo tenía corrido ~100 px). */}
          <ul
            data-tour="config-conceptos"
            className="grid grid-cols-1 divide-y overflow-hidden rounded-xl border bg-card sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]"
          >
            {grupo.items.map((concepto) => {
              const enEspera = pendientes[concepto.id] ?? [];
              const sinPrecio = SIN_PRECIO.includes(concepto.tipo);
              const esBC = concepto.codigo === "BC";
              return (
                <li
                  key={concepto.id}
                  className={cn(
                    "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 px-4 py-4 sm:col-span-4 sm:grid-cols-subgrid sm:px-5",
                    !concepto.activo && "bg-muted/40"
                  )}
                >
                  <Codigo codigo={concepto.codigo} />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      <span className={cn(!concepto.activo && "text-muted-foreground")}>{concepto.nombre}</span>
                      {enEspera.length > 0 ? <Sello estado="pendiente_aprobacion" /> : null}
                      {!concepto.activo ? <Sello estado="inactivo" /> : null}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {LABEL_TIPO[concepto.tipo]}
                      {Number(concepto.descuento_pronto_pago) > 0
                        ? ` · ${porcentajeTexto(concepto.descuento_pronto_pago)} % de beneficio pagando en término`
                        : ""}
                      {` · orden ${concepto.orden_imputacion}`}
                    </p>
                    {enEspera.length > 0 ? (
                      <p className="mt-0.5 text-sm text-parcial">
                        Esperando al Líder: {enEspera.map((c) => c.resumen).join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="col-start-2 sm:col-start-3 sm:text-right">
                    {sinPrecio ? (
                      esBC && verTarifas ? (
                        <Link
                          href="/configuracion?tab=tarifas"
                          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                          Ver tarifas de transporte
                          <ArrowRight className="size-4" />
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">{TEXTO_SIN_PRECIO[concepto.tipo]}</span>
                      )
                    ) : (
                      <>
                        <Money monto={concepto.precio} className="font-display text-xl font-bold" />
                        <span className="block text-sm text-muted-foreground">{UNIDAD[concepto.tipo]}</span>
                      </>
                    )}
                  </div>
                  <div className="col-start-2 flex items-center gap-3 sm:col-start-4">
                    <label className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
                      <Switch
                        checked={concepto.activo}
                        disabled={togglePendiente === concepto.id}
                        onCheckedChange={(activo) => cambiarActivo(concepto, activo)}
                        aria-label={`${concepto.nombre} activo`}
                      />
                      Activo
                    </label>
                    {esBC ? null : (
                      <Button
                        variant="outline"
                        className="min-h-11 px-4 text-sm"
                        onClick={() => abrirEdicion(concepto)}
                        data-tour="config-editar"
                      >
                        <Pencil className="size-4" strokeWidth={2} />
                        Editar
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <Dialog
        open={editando !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setEditando(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {editando ? editando.nombre : ""}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {aplicaDirecto
                ? "El precio nuevo rige desde la próxima generación mensual."
                : "El cambio lo aprueba el Líder de Procesos; una vez aprobado, rige desde la próxima generación mensual."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {sinPrecioEditando ? null : (
              <div className="space-y-2">
                <Label htmlFor="precio-concepto" className="text-sm">
                  Precio
                </Label>
                <Input
                  id="precio-concepto"
                  inputMode="numeric"
                  autoComplete="off"
                  className="h-12 text-base md:text-base"
                  value={precio}
                  onChange={(e) => setPrecio(soloDigitos(e.target.value))}
                />
                <p className="text-sm text-muted-foreground tabular">
                  {formatARS(Number(precio || 0))}
                  {editando ? ` ${UNIDAD[editando.tipo] ?? ""}` : ""}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="descuento-concepto" className="text-sm">
                Beneficio por pago en término (%)
              </Label>
              <Input
                id="descuento-concepto"
                inputMode="decimal"
                autoComplete="off"
                aria-invalid={descuentoFuera || undefined}
                aria-describedby="descuento-ayuda"
                className="h-12 text-base md:text-base"
                value={descuento}
                onChange={(e) => setDescuento(porcentajeTipeado(e.target.value))}
              />
              <p
                id="descuento-ayuda"
                className={cn("text-sm", descuentoFuera ? "font-medium text-destructive" : "text-muted-foreground")}
              >
                {descuentoFuera
                  ? "Tiene que ser de 0 a 100 %."
                  : "0 si no tiene beneficio. Con coma si tiene decimales: 12,5."}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="orden-concepto" className="text-sm">
                Orden de imputación
              </Label>
              <Input
                id="orden-concepto"
                inputMode="numeric"
                autoComplete="off"
                className="h-12 w-24 text-base md:text-base"
                value={orden}
                onChange={(e) => setOrden(soloDigitos(e.target.value).slice(0, 3))}
              />
              <p className="text-sm text-muted-foreground">
                Más bajo = cobra primero.
              </p>
            </div>
          </div>

          {/* Una salida clara además de la X. */}
          <DialogFooter>
            <Button
              variant="outline"
              className="h-auto min-h-12 px-5 text-base"
              disabled={guardando}
              onClick={() => setEditando(null)}
            >
              No, volver
            </Button>
            <Button
              size="lg"
              className="h-12 w-full text-base font-semibold sm:w-auto sm:flex-1"
              disabled={guardando || (!sinPrecioEditando && !precio) || !orden || descuentoFuera}
              onClick={guardar}
            >
              {aplicaDirecto ? null : <Send className="size-5" strokeWidth={2} />}
              {guardando
                ? aplicaDirecto
                  ? "Guardando…"
                  : "Enviando…"
                : aplicaDirecto
                  ? "Guardar cambios"
                  : "Enviar a aprobación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
