"use client";

import { useId, useState } from "react";
import { AlertTriangle, CalendarClock, Check, ChevronDown, Handshake, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { esCuitValido, formatFecha, hoyISO, limpiarCuit } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  diaRelativo,
  diasEntre,
  mascaraCuit,
  resumirLugares,
  sumarDias,
  type ChequeForm,
  type ErroresLinea,
} from "@/components/cobranza/tipos";

/** Chip de una opción (≥ 44 px). */
export function Chip({
  activo,
  onClick,
  children,
  className,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border-2 px-3.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        activo
          ? "border-primary bg-primary/5 text-primary"
          : "border-border bg-card text-foreground hover:bg-muted/50",
        className
      )}
    >
      {children}
    </button>
  );
}

/**
 * N° y CUIT del cheque: lo tipeado va grande y en negrita; el ejemplo ("Ej.: …") en letra
 * normal y más clara, para que no parezca un dato ya cargado.
 */
const CAMPO_CHEQUE =
  "h-12 text-lg font-semibold tabular md:text-lg placeholder:text-base placeholder:font-normal placeholder:text-muted-foreground/70";

const PLAZOS = [
  { dias: 0, label: "Hoy" },
  { dias: 30, label: "30 días" },
  { dias: 60, label: "60 días" },
  { dias: 90, label: "90 días" },
];

/** ¿El CUIT tiene 11 números pero el dígito verificador no da? (aviso, nunca bloqueo definitivo) */
export function cuitParaRevisar(c: ChequeForm): boolean {
  const d = limpiarCuit(c.cuit);
  return d.length === 11 && !esCuitValido(d) && !c.cuitConfirmado;
}

/**
 * Datos del cheque (A2), en el orden en que se lee el papel: N° · CUIT · se cobra desde.
 * El resto (quién lo entrega, cuándo llegó, puesto, qué pasa con el cheque) va resumido en
 * una línea con "Cambiar": casi siempre es el cliente, hoy y queda en la cooperativa.
 */
export function DatosCheque({
  valor,
  onCambio,
  clienteNombre,
  puestos,
  proveedores,
  errores,
  pedirConfirmacionCuit = false,
  onSeguirConCuit,
}: {
  valor: ChequeForm;
  onCambio: (parcial: Partial<ChequeForm>) => void;
  clienteNombre: string;
  /** Espacios del cliente en el plano ("Puesto 52"): el puesto del cheque sale solo. */
  puestos: string[];
  /** Proveedores usados antes (sugerencias). */
  proveedores: string[];
  errores: ErroresLinea;
  /** Se intentó registrar con el CUIT sin confirmar: el aviso se destaca. */
  pedirConfirmacionCuit?: boolean;
  /** "Está bien así, seguir": confirma el CUIT (y, si se estaba registrando, sigue). */
  onSeguirConCuit?: () => void;
}) {
  const id = useId();
  const hoy = hoyISO();
  const [abierto, setAbierto] = useState(false);
  const hayErrorPlegado = Boolean(
    errores.chequeProveedor || errores.chequeRecibidoDe || errores.chequeFechaRecepcion
  );
  const open = abierto || hayErrorPlegado;

  const revisarCuit = cuitParaRevisar(valor);
  const diasParaCobrar = diasEntre(hoy, valor.fechaCobro || hoy);
  const plazoActivo = PLAZOS.find((p) => sumarDias(hoy, p.dias) === valor.fechaCobro)?.dias;

  const quienEntrega = valor.otraPersona
    ? valor.recibidoDe.trim() || "otra persona"
    : clienteNombre;
  const textoPuestos = resumirLugares(puestos);
  const resumen = [
    `Lo entrega ${quienEntrega}`,
    `Recibido ${diaRelativo(valor.fechaRecepcion || hoy)}`,
    textoPuestos || "Sin puesto en el plano",
    valor.estado === "entregado"
      ? `Se lo di a ${valor.proveedor.trim() || "un proveedor"}`
      : "Queda en la cooperativa",
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${id}-numero`} className="text-base font-medium">
            N° de cheque
          </Label>
          <Input
            id={`${id}-numero`}
            inputMode="numeric"
            autoComplete="off"
            maxLength={20}
            placeholder="Ej.: 00012345"
            value={valor.numero}
            onChange={(e) => onCambio({ numero: e.target.value.replace(/\D/g, "").slice(0, 20) })}
            aria-invalid={Boolean(errores.chequeNumero)}
            className={CAMPO_CHEQUE}
          />
          {errores.chequeNumero ? (
            <p className="text-sm font-medium text-destructive">{errores.chequeNumero}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${id}-cuit`} className="text-base font-medium">
            CUIT del cheque
          </Label>
          <Input
            id={`${id}-cuit`}
            inputMode="numeric"
            autoComplete="off"
            placeholder="Ej.: 20-12345678-3"
            value={valor.cuit}
            onChange={(e) =>
              onCambio({ cuit: mascaraCuit(e.target.value), cuitConfirmado: false })
            }
            aria-invalid={Boolean(errores.chequeCuit)}
            className={CAMPO_CHEQUE}
          />
          {errores.chequeCuit ? (
            <p className="text-sm font-medium text-destructive">{errores.chequeCuit}</p>
          ) : null}
        </div>
      </div>

      {revisarCuit ? (
        <div
          role="status"
          className={cn(
            "flex flex-wrap items-center gap-3 rounded-lg border bg-parcial-suave px-4 py-3",
            pedirConfirmacionCuit ? "border-parcial ring-2 ring-parcial/30" : "border-parcial/60"
          )}
        >
          <AlertTriangle className="size-5 shrink-0 text-parcial" strokeWidth={2} />
          <p className="min-w-0 flex-1 text-sm">
            <strong>Revisá el CUIT: el último número no coincide.</strong>{" "}
            {pedirConfirmacionCuit ? "Si está bien así, seguí." : "Puede ser un error de tipeo."}
          </p>
          <Button
            type="button"
            variant="outline"
            className="h-11 bg-card px-4 text-sm font-semibold"
            onClick={() => {
              onCambio({ cuitConfirmado: true });
              onSeguirConCuit?.();
            }}
          >
            <Check className="size-4" strokeWidth={2.2} />
            Está bien así, seguir
          </Button>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`${id}-cobro`} className="text-base font-medium">
          ¿Desde cuándo se puede cobrar?
        </Label>
        <div className="flex flex-wrap gap-2">
          {PLAZOS.map((p) => (
            <Chip
              key={p.dias}
              activo={plazoActivo === p.dias}
              onClick={() => onCambio({ fechaCobro: sumarDias(hoy, p.dias) })}
            >
              {p.label}
            </Chip>
          ))}
          <Input
            id={`${id}-cobro`}
            type="date"
            value={valor.fechaCobro}
            onChange={(e) => onCambio({ fechaCobro: e.target.value || hoy })}
            aria-label="Otra fecha de cobro"
            className="h-11 w-auto min-w-40 text-base md:text-base"
          />
        </div>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarClock className="size-4 shrink-0" strokeWidth={2} />
          {diasParaCobrar > 0
            ? `Diferido: se cobra en ${diasParaCobrar} ${diasParaCobrar === 1 ? "día" : "días"} (el ${formatFecha(valor.fechaCobro)})`
            : "Se puede depositar ya"}
        </p>
      </div>

      <Collapsible open={open} onOpenChange={setAbierto}>
        <div className="flex items-start gap-3 rounded-lg bg-muted/40 px-4 py-3">
          <p className="min-w-0 flex-1 text-sm leading-relaxed text-muted-foreground">
            {resumen.join(" · ")}
          </p>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="h-11 shrink-0 px-3 text-sm font-semibold text-primary"
              disabled={hayErrorPlegado}
            >
              Cambiar
              <ChevronDown
                className={cn("size-4 transition-transform", open && "rotate-180")}
                strokeWidth={2}
              />
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="space-y-5 pt-5">
          <div className="space-y-2">
            <Label className="text-base font-medium">¿Quién te lo da?</Label>
            <div className="flex flex-wrap gap-2">
              <Chip
                activo={!valor.otraPersona}
                onClick={() => onCambio({ otraPersona: false, recibidoDe: "" })}
              >
                {clienteNombre}
              </Chip>
              <Chip activo={valor.otraPersona} onClick={() => onCambio({ otraPersona: true })}>
                Otra persona
              </Chip>
            </div>
            {valor.otraPersona ? (
              <Input
                autoComplete="off"
                placeholder="Nombre de quien lo entrega"
                value={valor.recibidoDe}
                onChange={(e) => onCambio({ recibidoDe: e.target.value })}
                aria-label="Nombre de quien entrega el cheque"
                aria-invalid={Boolean(errores.chequeRecibidoDe)}
                className="h-12 text-base md:text-base"
              />
            ) : null}
            {errores.chequeRecibidoDe ? (
              <p className="text-sm font-medium text-destructive">{errores.chequeRecibidoDe}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${id}-recepcion`} className="text-base font-medium">
              ¿Cuándo lo recibiste?
            </Label>
            <div className="flex flex-wrap gap-2">
              <Chip
                activo={valor.fechaRecepcion === hoy}
                onClick={() => onCambio({ fechaRecepcion: hoy })}
              >
                Hoy
              </Chip>
              <Chip
                activo={valor.fechaRecepcion === sumarDias(hoy, -1)}
                onClick={() => onCambio({ fechaRecepcion: sumarDias(hoy, -1) })}
              >
                Ayer
              </Chip>
              <Input
                id={`${id}-recepcion`}
                type="date"
                max={hoy}
                value={valor.fechaRecepcion}
                onChange={(e) => onCambio({ fechaRecepcion: e.target.value || hoy })}
                aria-label="Otra fecha de recepción"
                aria-invalid={Boolean(errores.chequeFechaRecepcion)}
                className="h-11 w-auto min-w-40 text-base md:text-base"
              />
            </div>
            {errores.chequeFechaRecepcion ? (
              <p className="text-sm font-medium text-destructive">{errores.chequeFechaRecepcion}</p>
            ) : null}
          </div>

          {/* Dato, no opción: texto plano (sin borde de botón) para que no parezca que hay que elegir. */}
          <div className="space-y-1">
            <p className="text-base font-medium">Puesto del cheque</p>
            <p className={cn("text-base break-words tabular", !textoPuestos && "text-muted-foreground")}>
              {textoPuestos || "Sin puesto en el plano"}
            </p>
            <p className="text-sm text-muted-foreground">
              Sale solo del plano: {puestos.length > 1 ? "van todos, no hay que elegir." : "no hay que elegirlo."}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-base font-medium">¿Qué pasa con el cheque?</p>
            <div role="radiogroup" aria-label="Qué pasa con el cheque" className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  {
                    valor: "en_cartera",
                    titulo: "Queda en la cooperativa",
                    ayuda: "Por cobrar: lo deposita Tesorería",
                    Icono: Landmark,
                  },
                  {
                    valor: "entregado",
                    titulo: "Se lo di a un proveedor",
                    ayuda: "No queda en la caja",
                    Icono: Handshake,
                  },
                ] as const
              ).map((o) => {
                const activo = valor.estado === o.valor;
                return (
                  <button
                    key={o.valor}
                    type="button"
                    role="radio"
                    aria-checked={activo}
                    onClick={() => onCambio({ estado: o.valor })}
                    className={cn(
                      "flex min-h-16 items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                      activo
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:bg-muted/50"
                    )}
                  >
                    <o.Icono
                      className={cn("size-6 shrink-0", activo ? "text-primary" : "text-muted-foreground")}
                      strokeWidth={2}
                    />
                    <span className="min-w-0">
                      <span className={cn("block font-semibold", activo && "text-primary")}>
                        {o.titulo}
                      </span>
                      <span className="block text-sm text-muted-foreground">{o.ayuda}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {valor.estado === "entregado" ? (
              <div className="space-y-2 pt-1">
                <Label htmlFor={`${id}-proveedor`} className="text-base font-medium">
                  ¿A qué proveedor?
                </Label>
                <Input
                  id={`${id}-proveedor`}
                  list={`${id}-proveedores`}
                  autoComplete="off"
                  placeholder="Ej.: Frutas del Sur"
                  value={valor.proveedor}
                  onChange={(e) => onCambio({ proveedor: e.target.value })}
                  aria-invalid={Boolean(errores.chequeProveedor)}
                  className="h-12 text-base md:text-base"
                />
                <datalist id={`${id}-proveedores`}>
                  {proveedores.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
                {errores.chequeProveedor ? (
                  <p className="text-sm font-medium text-destructive">{errores.chequeProveedor}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Después Tesorería lo une al gasto que pagó.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
