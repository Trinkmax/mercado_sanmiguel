"use client";

import { AlertTriangle, Landmark, Wallet } from "lucide-react";
import { formatARS, formatFecha } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CajaRegistradora } from "@/components/shared/iconos";
import {
  delDia,
  diasEntre,
  etiquetaCaja,
  type CajaElegible,
  type OrigenPago,
} from "@/components/gastos/tipos";

/** Chip grande de una opción (≥ 44 px). */
function Chip({
  activo,
  onClick,
  children,
  className,
  disabled,
  ...rest
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
} & Omit<React.ComponentProps<"button">, "onClick">) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={activo}
      className={cn(
        "min-h-12 rounded-lg border px-4 py-2 text-left text-base font-medium transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
        activo
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-card hover:bg-accent",
        disabled && "cursor-not-allowed opacity-50 hover:bg-card",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** "YYYY-MM-DD" del día anterior. */
function restarDia(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const f = new Date(y, m - 1, d - 1);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
}

/** Origen por defecto al abrir el selector. */
export function origenInicial({
  cajas,
  preferirCaja,
  cajaPreseleccionadaId,
  hoy,
}: {
  cajas: CajaElegible[];
  preferirCaja: boolean;
  cajaPreseleccionadaId?: string | null;
  hoy: string;
}): OrigenPago {
  const preseleccionada = cajaPreseleccionadaId
    ? cajas.find((c) => c.id === cajaPreseleccionadaId) ?? null
    : null;
  if (preseleccionada) {
    return { origen: "caja", caja: preseleccionada, medio: "efectivo", fecha: hoy };
  }
  const deHoy = cajas.find((c) => c.fecha === hoy) ?? null;
  if (preferirCaja && deHoy) {
    return { origen: "caja", caja: deHoy, medio: "efectivo", fecha: hoy };
  }
  return { origen: "tesoreria", caja: null, medio: preferirCaja ? "efectivo" : "transferencia", fecha: hoy };
}

/** ¿El origen elegido está completo para pagar? */
export function origenCompleto(v: OrigenPago, hoy: string): boolean {
  if (v.origen === "caja") return v.caja !== null;
  return /^\d{4}-\d{2}-\d{2}$/.test(v.fecha) && v.fecha <= hoy;
}

/** Texto del botón de pago: "Pagar $ 50.000 con la caja del 27/09". */
export function textoBotonPago(v: OrigenPago, monto: number, hoy: string): string {
  if (v.origen === "caja" && v.caja) {
    return `Pagar ${formatARS(monto)} con la caja ${delDia(v.caja.fecha, hoy)}`;
  }
  return `Pagar ${formatARS(monto)} desde Tesorería (${v.medio === "efectivo" ? "efectivo" : "banco"})`;
}

/**
 * "¿De dónde sale la plata?" (E4): Caja del día (eligiendo el día; siempre
 * efectivo) o Tesorería (efectivo o banco, con fecha). Muestra cómo queda la
 * caja y avisa si ya se cerró o si no alcanza.
 */
export function SelectorOrigen({
  valor,
  onCambiar,
  cajas,
  monto,
  hoy,
  idBase,
}: {
  valor: OrigenPago;
  onCambiar: (v: OrigenPago) => void;
  cajas: CajaElegible[];
  monto: number;
  hoy: string;
  idBase: string;
}) {
  const hayCajas = cajas.length > 0;
  const caja = valor.origen === "caja" ? valor.caja : null;
  const efectivoAntes = caja?.efectivo ?? null;
  const efectivoDespues = efectivoAntes === null ? null : efectivoAntes - monto;

  return (
    <div className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-base font-medium">¿De dónde sale la plata?</legend>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            aria-pressed={valor.origen === "caja"}
            disabled={!hayCajas}
            onClick={() =>
              onCambiar({
                ...valor,
                origen: "caja",
                medio: "efectivo",
                caja: valor.caja ?? cajas.find((c) => c.fecha === hoy) ?? cajas[0] ?? null,
              })
            }
            className={cn(
              "flex min-h-24 flex-col items-start gap-1.5 rounded-xl border-2 p-4 text-left transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
              valor.origen === "caja"
                ? "border-primary bg-accent"
                : "border-input bg-card hover:bg-accent/60",
              !hayCajas && "cursor-not-allowed opacity-50 hover:bg-card"
            )}
          >
            <CajaRegistradora className="size-7 text-primary" strokeWidth={1.9} />
            <span className="text-base font-semibold">Caja del día</span>
            <span className="text-sm text-muted-foreground">
              {hayCajas ? "Efectivo del cajón de Administración" : "No hay cajas sin validar"}
            </span>
          </button>
          <button
            type="button"
            aria-pressed={valor.origen === "tesoreria"}
            onClick={() => onCambiar({ ...valor, origen: "tesoreria", caja: null })}
            className={cn(
              "flex min-h-24 flex-col items-start gap-1.5 rounded-xl border-2 p-4 text-left transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
              valor.origen === "tesoreria"
                ? "border-primary bg-accent"
                : "border-input bg-card hover:bg-accent/60"
            )}
          >
            <Landmark className="size-7 text-primary" strokeWidth={1.9} />
            <span className="text-base font-semibold">Tesorería</span>
            <span className="text-sm text-muted-foreground">Efectivo o banco</span>
          </button>
        </div>
      </fieldset>

      {valor.origen === "caja" ? (
        <div className="space-y-3">
          <p className="text-base font-medium">¿De qué día es la caja?</p>
          <div className="flex flex-wrap gap-2">
            {cajas.map((c) => {
              const activo = caja?.fecha === c.fecha && caja?.id === c.id;
              return (
                <Chip
                  key={c.id ?? "nueva"}
                  activo={activo}
                  onClick={() => onCambiar({ ...valor, caja: c, medio: "efectivo" })}
                  className="flex flex-col items-start gap-0"
                >
                  <span>{etiquetaCaja(c, hoy)}</span>
                  <span
                    className={cn(
                      "text-sm font-normal tabular",
                      activo ? "text-primary-foreground/85" : "text-muted-foreground"
                    )}
                  >
                    {c.estado === "nueva"
                      ? "todavía sin movimientos"
                      : c.efectivo === null
                        ? "efectivo sin calcular"
                        : `tiene ${formatARS(c.efectivo)}`}
                  </span>
                </Chip>
              );
            })}
          </div>

          {caja ? (
            <div className="space-y-2">
              {efectivoAntes !== null && caja.estado !== "nueva" ? (
                <p className="rounded-lg bg-muted/60 px-4 py-3 text-base tabular">
                  Tiene {formatARS(efectivoAntes)} − este gasto {formatARS(monto)} ={" "}
                  <strong className={cn(efectivoDespues !== null && efectivoDespues < 0 && "text-pendiente")}>
                    queda {formatARS(efectivoDespues ?? 0)}
                  </strong>
                </p>
              ) : caja.estado === "nueva" ? (
                <p className="rounded-lg bg-muted/60 px-4 py-3 text-base">
                  La caja de hoy se abre con este pago y arranca debiendo {formatARS(monto)} en efectivo
                  hasta que entren cobros.
                </p>
              ) : null}
              {caja.estado === "cerrada" ? (
                <p className="flex gap-2 rounded-lg bg-parcial-suave px-4 py-3 text-sm font-medium text-parcial">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
                  <span>
                    Esa caja ya se cerró
                    {efectivoAntes !== null
                      ? `: su arqueo baja de ${formatARS(efectivoAntes)} a ${formatARS(efectivoDespues ?? 0)}`
                      : ""}{" "}
                    y queda anotado en su historial.
                  </span>
                </p>
              ) : null}
              {efectivoDespues !== null && efectivoDespues < 0 && caja.estado !== "nueva" ? (
                <p className="flex gap-2 rounded-lg bg-pendiente-suave px-4 py-3 text-sm font-medium text-pendiente">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
                  <span>
                    La caja tiene {formatARS(efectivoAntes ?? 0)} en efectivo: no alcanza para
                    este gasto. Elegí otro día o pagalo desde Tesorería.
                  </span>
                </p>
              ) : null}
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wallet className="size-4" strokeWidth={1.9} />
                De la caja sale siempre efectivo, con la fecha de esa caja.
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-base font-medium">¿En efectivo o por banco?</p>
            <div className="grid grid-cols-2 gap-2">
              <Chip
                activo={valor.medio === "efectivo"}
                onClick={() => onCambiar({ ...valor, medio: "efectivo" })}
                className="text-center"
              >
                Efectivo
              </Chip>
              <Chip
                activo={valor.medio === "transferencia"}
                onClick={() => onCambiar({ ...valor, medio: "transferencia" })}
                className="text-center"
              >
                Banco
              </Chip>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-base font-medium">¿Qué día se pagó?</p>
            <div className="flex flex-wrap items-center gap-2">
              <Chip activo={valor.fecha === hoy} onClick={() => onCambiar({ ...valor, fecha: hoy })}>
                Hoy
              </Chip>
              <Chip
                activo={diasEntre(valor.fecha, hoy) === 1}
                onClick={() => onCambiar({ ...valor, fecha: restarDia(hoy) })}
              >
                Ayer
              </Chip>
              <Label htmlFor={`${idBase}-fecha`} className="sr-only">
                Otro día
              </Label>
              <Input
                id={`${idBase}-fecha`}
                type="date"
                max={hoy}
                value={valor.fecha}
                onChange={(e) => onCambiar({ ...valor, fecha: e.target.value })}
                className="h-12 w-auto text-base"
              />
            </div>
            {valor.fecha > hoy ? (
              <p className="text-sm font-medium text-pendiente">La fecha de pago no puede ser futura.</p>
            ) : valor.fecha !== hoy && diasEntre(valor.fecha, hoy) !== 1 && valor.fecha ? (
              <p className="text-sm text-muted-foreground">Se registra como pagado el {formatFecha(valor.fecha)}.</p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
