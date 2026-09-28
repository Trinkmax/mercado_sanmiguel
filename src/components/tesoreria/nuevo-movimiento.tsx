"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Banknote,
  CircleMinus,
  CirclePlus,
  Landmark,
  Percent,
  Plus,
  Scale,
  type LucideIcon,
} from "lucide-react";
import { crearMovimiento } from "@/lib/actions/tesoreria";
import { formatMoneda, hoyISO, type Moneda } from "@/lib/format";
import { cn } from "@/lib/utils";
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
import { Spinner } from "@/components/ui/spinner";
import {
  DESCRIPCION_TIPO,
  LABEL_TIPO_MOVIMIENTO,
  efectoMovimiento,
  type Cuenta,
  type TipoMovimiento,
} from "@/components/tesoreria/tipos";
import { llamarAccion } from "@/lib/llamar-accion";

/** Saldos actuales por moneda (para la vista previa "antes → después"). */
export type SaldosCuentas = Record<Moneda, Record<Cuenta, number>>;

type Accion = "deposito" | "extraccion" | "banco" | "ajuste" | "ingreso" | "egreso";

const ACCIONES: { valor: Accion; titulo: string; ayuda: string; icono: LucideIcon }[] = [
  { valor: "deposito", titulo: "Deposité efectivo en el banco", ayuda: "Sale del efectivo y entra al banco", icono: Landmark },
  { valor: "extraccion", titulo: "Saqué plata del banco", ayuda: "Sale del banco y entra al efectivo", icono: Banknote },
  { valor: "banco", titulo: "Comisión o impuesto", ayuda: "Lo que descuenta el banco", icono: Percent },
  { valor: "ajuste", titulo: "Ajuste", ayuda: "Corregir un saldo que no da", icono: Scale },
  { valor: "ingreso", titulo: "Ingreso", ayuda: "Entró plata que no es un cobro", icono: CirclePlus },
  { valor: "egreso", titulo: "Egreso", ayuda: "Salió plata que no es un gasto", icono: CircleMinus },
];

const SUBTIPOS_BANCO: { valor: TipoMovimiento; label: string }[] = [
  { valor: "comision", label: "Comisión" },
  { valor: "impuesto", label: "Impuesto" },
  { valor: "debito_fiscal", label: "IVA (débito fiscal)" },
];

function tipoDeAccion(a: Accion, sub: TipoMovimiento): TipoMovimiento {
  if (a === "banco") return sub;
  return a;
}

function cuentaInicial(a: Accion): Cuenta {
  return a === "ingreso" || a === "egreso" ? "efectivo" : "banco";
}

function restarDia(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const f = new Date(y, m - 1, d - 1);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
}

function Opcion({
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
        "min-h-12 rounded-lg border px-4 text-base font-medium transition-colors",
        activo ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-accent",
        className
      )}
    >
      {children}
    </button>
  );
}

/**
 * Acciones rápidas de Tesorería (J6): cada una abre el formulario corto del
 * movimiento con el tipo ya elegido y una vista previa de cómo quedan las cuentas.
 * `variante="boton"` muestra un solo botón "Registrar movimiento".
 */
export function AccionesRapidas({
  saldos,
  variante = "tiles",
}: {
  saldos: SaldosCuentas;
  variante?: "tiles" | "boton";
}) {
  const [accion, setAccion] = useState<Accion | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [sub, setSub] = useState<TipoMovimiento>("comision");
  const [moneda, setMoneda] = useState<Moneda>("ARS");
  const [cuenta, setCuenta] = useState<Cuenta>("banco");
  const [resta, setResta] = useState(true);
  const [monto, setMonto] = useState("");
  const [conComision, setConComision] = useState(false);
  const [comision, setComision] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const hoy = hoyISO();

  function abrir(a: Accion | null) {
    setAccion(a);
    setSub("comision");
    setMoneda("ARS");
    setCuenta(a ? cuentaInicial(a) : "banco");
    setResta(true);
    setMonto("");
    setConComision(false);
    setComision("");
    setFecha(hoyISO());
    setDescripcion("");
    setError(null);
    setAbierto(true);
  }

  const tipo = accion ? tipoDeAccion(accion, sub) : null;
  const montoNum = Number(monto || 0);
  const comisionNum = conComision ? Number(comision || 0) : 0;
  const cuentaEfectiva: Cuenta = tipo === "deposito" ? "efectivo" : tipo === "extraccion" ? "banco" : cuenta;
  const destino: Cuenta | null = tipo === "deposito" ? "banco" : tipo === "extraccion" ? "efectivo" : null;

  // Vista previa: cómo quedan efectivo y banco en la moneda elegida.
  const antes = saldos[moneda];
  const despues = { ...antes };
  if (tipo && montoNum > 0) {
    const e = efectoMovimiento({
      tipo,
      monto: tipo === "ajuste" && resta ? -montoNum : montoNum,
      cuenta: cuentaEfectiva,
      cuentaDestino: destino,
    });
    despues.efectivo += e.efectivo;
    despues.banco += e.banco;
    if (tipo === "deposito" && comisionNum > 0) despues.banco -= comisionNum;
  }

  const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(fecha) && fecha <= hoy;
  const listo =
    tipo !== null &&
    montoNum > 0 &&
    fechaValida &&
    (!(tipo === "deposito" && conComision) || (comisionNum > 0 && comisionNum < montoNum));

  function guardar() {
    if (!tipo) return;
    setError(null);
    startTransition(async () => {
      const res = await llamarAccion(() => crearMovimiento({
        tipo,
        moneda,
        cuenta: cuentaEfectiva,
        monto: montoNum,
        resta: tipo === "ajuste" ? resta : undefined,
        fecha,
        descripcion: descripcion.trim() || undefined,
        comision: tipo === "deposito" && conComision ? comisionNum : undefined,
      }));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setAbierto(false);
      toast.success(
        `Registraste ${LABEL_TIPO_MOVIMIENTO[tipo].toLowerCase()} de ${formatMoneda(montoNum, moneda)}` +
          (res.data.filas > 1 ? ` y la comisión de ${formatMoneda(comisionNum, moneda)}.` : ".")
      );
    });
  }

  const textoBoton = !tipo
    ? "Elegí qué pasó"
    : `Registrar ${LABEL_TIPO_MOVIMIENTO[tipo].toLowerCase()}${montoNum > 0 ? ` de ${formatMoneda(montoNum, moneda)}` : ""}`;

  return (
    <>
      {variante === "tiles" ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Registrar un movimiento">
          {ACCIONES.map((a) => {
            const Icono = a.icono;
            return (
              <Button
                key={a.valor}
                variant="outline"
                onClick={() => abrir(a.valor)}
                className="h-12 gap-2 bg-card px-4 text-base font-medium"
              >
                <Icono className="size-5 text-primary" strokeWidth={1.9} />
                {a.titulo}
              </Button>
            );
          })}
        </div>
      ) : (
        <Button className="h-11 px-5 text-base font-semibold" onClick={() => abrir(null)}>
          <Plus className="size-5" strokeWidth={2} />
          Registrar movimiento
        </Button>
      )}

      <Dialog open={abierto} onOpenChange={(v) => !pendiente && setAbierto(v)}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {accion ? ACCIONES.find((a) => a.valor === accion)?.titulo : "¿Qué pasó?"}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {accion ? ACCIONES.find((a) => a.valor === accion)?.ayuda : "Elegí el movimiento y completá el monto."}
            </DialogDescription>
          </DialogHeader>

          {!accion ? (
            <ul className="divide-y overflow-hidden rounded-xl border">
              {ACCIONES.map((a) => {
                const Icono = a.icono;
                return (
                  <li key={a.valor}>
                    <button
                      type="button"
                      onClick={() => {
                        setAccion(a.valor);
                        setCuenta(cuentaInicial(a.valor));
                      }}
                      className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                    >
                      <Icono className="size-6 shrink-0 text-primary" strokeWidth={1.9} />
                      <span>
                        <span className="block text-base font-semibold">{a.titulo}</span>
                        <span className="block text-sm text-muted-foreground">{a.ayuda}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="space-y-5">
              {accion === "banco" ? (
                <div className="space-y-2">
                  <p className="text-base font-medium">¿Qué descontó el banco?</p>
                  <div className="flex flex-wrap gap-2">
                    {SUBTIPOS_BANCO.map((s) => (
                      <Opcion key={s.valor} activo={sub === s.valor} onClick={() => setSub(s.valor)}>
                        {s.label}
                      </Opcion>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <p className="text-base font-medium">¿En qué moneda?</p>
                <div className="grid grid-cols-2 gap-2">
                  <Opcion activo={moneda === "ARS"} onClick={() => setMoneda("ARS")}>
                    Pesos
                  </Opcion>
                  <Opcion activo={moneda === "USD"} onClick={() => setMoneda("USD")}>
                    Dólares
                  </Opcion>
                </div>
              </div>

              {accion !== "deposito" && accion !== "extraccion" ? (
                <div className="space-y-2">
                  <p className="text-base font-medium">¿En qué cuenta?</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Opcion activo={cuenta === "efectivo"} onClick={() => setCuenta("efectivo")}>
                      Efectivo
                    </Opcion>
                    <Opcion activo={cuenta === "banco"} onClick={() => setCuenta("banco")}>
                      Banco
                    </Opcion>
                  </div>
                </div>
              ) : null}

              {accion === "ajuste" ? (
                <div className="space-y-2">
                  <p className="text-base font-medium">¿Sobra o falta plata?</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Opcion activo={resta} onClick={() => setResta(true)}>
                      Falta (−)
                    </Opcion>
                    <Opcion activo={!resta} onClick={() => setResta(false)}>
                      Sobra (+)
                    </Opcion>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="mov-monto" className="text-base">
                  Monto
                </Label>
                <Input
                  id="mov-monto"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="0"
                  value={monto}
                  onChange={(e) => {
                    setMonto(e.target.value.replace(/\D/g, "").slice(0, 12));
                    setError(null);
                  }}
                  className="h-13 text-xl font-semibold tabular"
                />
                <p className="min-h-5 text-base font-semibold tabular text-muted-foreground">
                  {montoNum > 0 ? formatMoneda(montoNum, moneda) : ""}
                </p>
              </div>

              {accion === "deposito" ? (
                <div className="space-y-2 rounded-xl border p-3">
                  <p className="text-base font-medium">¿El banco cobró comisión por el depósito?</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Opcion activo={!conComision} onClick={() => setConComision(false)}>
                      No
                    </Opcion>
                    <Opcion activo={conComision} onClick={() => setConComision(true)}>
                      Sí
                    </Opcion>
                  </div>
                  {conComision ? (
                    <div className="space-y-1 pt-1">
                      <Label htmlFor="mov-comision" className="text-sm">
                        ¿Cuánto cobró?
                      </Label>
                      <Input
                        id="mov-comision"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="0"
                        value={comision}
                        onChange={(e) => setComision(e.target.value.replace(/\D/g, "").slice(0, 12))}
                        className="h-12 text-lg tabular"
                      />
                      {comisionNum > 0 && montoNum > 0 && comisionNum >= montoNum ? (
                        <p className="text-sm font-medium text-pendiente">
                          La comisión no puede ser mayor que el depósito.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-2">
                <p className="text-base font-medium">¿Qué día?</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Opcion activo={fecha === hoy} onClick={() => setFecha(hoy)}>
                    Hoy
                  </Opcion>
                  <Opcion activo={fecha === restarDia(hoy)} onClick={() => setFecha(restarDia(hoy))}>
                    Ayer
                  </Opcion>
                  <Label htmlFor="mov-fecha" className="sr-only">
                    Otro día
                  </Label>
                  <Input
                    id="mov-fecha"
                    type="date"
                    max={hoy}
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="h-12 w-auto text-base"
                  />
                </div>
                {!fechaValida ? (
                  <p className="text-sm font-medium text-pendiente">Elegí un día de hoy para atrás.</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="mov-descripcion" className="text-base">
                  Descripción <span className="font-normal text-muted-foreground">(opcional)</span>
                </Label>
                <Input
                  id="mov-descripcion"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder={tipo ? DESCRIPCION_TIPO[tipo] : ""}
                  className="h-12 text-base"
                  maxLength={200}
                />
              </div>

              {montoNum > 0 ? (
                <div className="rounded-xl bg-muted/60 px-4 py-3" aria-live="polite">
                  <p className="text-sm font-medium text-muted-foreground">Así quedan las cuentas</p>
                  <ul className="mt-1 space-y-1 text-base tabular">
                    {(["efectivo", "banco"] as const).map((c) =>
                      antes[c] !== despues[c] ? (
                        <li key={c} className="flex flex-wrap items-center gap-x-2">
                          <span className="w-20 font-medium">{c === "efectivo" ? "Efectivo" : "Banco"}</span>
                          <span className="text-muted-foreground">{formatMoneda(antes[c], moneda)}</span>
                          <ArrowRight className="size-4 text-muted-foreground" strokeWidth={2} />
                          <span className={cn("font-bold", despues[c] < antes[c] ? "text-pendiente" : "text-pagado")}>
                            {formatMoneda(despues[c], moneda)}
                          </span>
                        </li>
                      ) : null
                    )}
                  </ul>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => setAccion(null)}
                className="min-h-11 text-sm font-medium text-primary hover:underline"
              >
                Elegir otro movimiento
              </button>
            </div>
          )}

          {error ? (
            <p role="alert" className="rounded-lg bg-pendiente-suave px-4 py-3 text-sm font-medium text-pendiente">
              {error}
            </p>
          ) : null}

          {accion ? (
            <DialogFooter>
              <Button
                size="lg"
                className="h-13 w-full text-base font-semibold"
                disabled={pendiente || !listo}
                onClick={guardar}
              >
                {pendiente ? <Spinner className="size-5" /> : null}
                {textoBoton}
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
