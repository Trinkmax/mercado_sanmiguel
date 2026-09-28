"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { CircleAlert, CircleCheck, Minus, Plus, TriangleAlert, Truck } from "lucide-react";
import { anularCanon, registrarCanon } from "@/lib/actions/porteria";
import { formatARS } from "@/lib/format";
import { cn, uuidV4 } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { EmptyState } from "@/components/shared/empty-state";
import { AlertaError } from "@/components/cobranza/alerta-error";
import { DibujoTarifa } from "@/components/porteria/dibujo-tarifa";
import {
  DESTINOS,
  LABEL_DESTINO,
  LABEL_MEDIO_CANON,
  LABEL_UNIDAD,
  MEDIOS_CANON,
  esPatenteValida,
  formatPatente,
  normalizarPatente,
  preguntaCantidad,
  textoEntrada,
  type DestinoCanon,
  type MedioCanon,
  type TarifaTransporte,
} from "@/components/porteria/tarifas";
import { llamarAccion } from "@/lib/llamar-accion";

/** Segundos que queda el sello "Cobrado N° X" antes de volver al total. */
const SEGUNDOS_SELLO = 4;

/** Un puesto del plano, tal como lo devuelve espacios_del_plano() (sin datos de clientes). */
export type PuestoPlano = { numero: string; medio: boolean };

const nuevoRef = uuidV4;

type Exito = { id: string; numero: number; monto: number; texto: string };

/**
 * Talonario del canon de transporte (H1, H2): "¿Qué entró?" → "Cobrar $6.000".
 * Dos toques en el caso común; cantidad, medio, patente y "¿A quién viene?" son ajustes.
 * El monto lo pone la tarifa (nadie tipea montos). Después de cobrar conserva la tarifa y
 * el medio (los vehículos llegan en tandas) y limpia el resto.
 */
export function CanonTransporte({
  tarifas,
  puestos,
  bloqueo,
}: {
  /** Tarifas ACTIVAS, en el orden de la tabla. */
  tarifas: TarifaTransporte[];
  /** Puestos del plano para validar "Puesto 58 ✓" al instante. */
  puestos: PuestoPlano[];
  /** Caja de portería rendida: el formulario queda bloqueado con este aviso. */
  bloqueo: { titulo: string; detalle?: string } | null;
}) {
  const primeraConPrecio = tarifas.find((t) => t.precio > 0) ?? null;
  const [tarifaId, setTarifaId] = useState<string | null>(primeraConPrecio?.id ?? null);
  const [cantidad, setCantidad] = useState(1);
  const [cantidadTexto, setCantidadTexto] = useState("1");
  const [medio, setMedio] = useState<MedioCanon>("efectivo");
  const [patente, setPatente] = useState("");
  const [destino, setDestino] = useState<DestinoCanon | null>(null);
  const [puesto, setPuesto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<Exito | null>(null);
  const [pendiente, startTransition] = useTransition();
  const refIntento = useRef<string | null>(null);

  const tarifa = tarifas.find((t) => t.id === tarifaId) ?? null;
  const monto = tarifa ? Math.round(tarifa.precio * cantidad * 100) / 100 : 0;

  // ---------- Validaciones en vivo (prevenir, no explicar después)
  const patenteNorm = normalizarPatente(patente);
  const patenteInvalida = patenteNorm.length > 0 && !esPatenteValida(patenteNorm);

  const puestoNorm = puesto.trim();
  const coincidencias = useMemo(
    () => (puestoNorm ? puestos.filter((p) => p.numero.toLowerCase() === puestoNorm.toLowerCase()) : []),
    [puestos, puestoNorm]
  );
  const puestoInvalido = destino === "puesto" && puestoNorm.length > 0 && coincidencias.length === 0;
  const puestoEtiqueta =
    coincidencias.length === 0
      ? null
      : coincidencias.some((p) => !p.medio)
        ? `Puesto ${puestoNorm}`
        : `Puesto ${puestoNorm}½`;

  const motivoBloqueo = bloqueo
    ? null
    : !tarifa
      ? "Elegí qué entró."
      : tarifa.precio <= 0
        ? `La tarifa de ${tarifa.nombre} no tiene precio: pedile al Líder que la cargue.`
        : patenteInvalida
          ? "Revisá la patente o borrala: es opcional."
          : puestoInvalido
            ? `No existe el puesto ${puestoNorm}: corregilo o borralo.`
            : null;
  const puedeCobrar = !bloqueo && !pendiente && motivoBloqueo === null;

  // El sello "Cobrado" se va solo y vuelve el total.
  useEffect(() => {
    if (!exito) return;
    const t = setTimeout(() => setExito(null), SEGUNDOS_SELLO * 1000);
    return () => clearTimeout(t);
  }, [exito]);

  function cambiarCantidad(n: number) {
    const v = Math.min(99, Math.max(1, Math.round(n)));
    setCantidad(v);
    setCantidadTexto(String(v));
    setError(null);
  }

  function elegirTarifa(id: string) {
    setTarifaId(id);
    setError(null);
    setExito(null);
  }

  function deshacer(e: Exito) {
    toast.promise(
      (async () => {
        const res = await llamarAccion(() => anularCanon({ id: e.id, motivo: "Deshecho al instante" }));
        if (!res.ok) throw new Error(res.error);
      })(),
      {
        loading: `Deshaciendo el cobro N° ${e.numero}…`,
        success: `Cobro N° ${e.numero} deshecho: no cuenta en la caja.`,
        error: (err: unknown) => (err instanceof Error ? err.message : "No se pudo deshacer. Anulalo desde la lista."),
      }
    );
  }

  function cobrar(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!puedeCobrar || !tarifa) {
      if (motivoBloqueo) setError(motivoBloqueo);
      return;
    }
    if (!refIntento.current) refIntento.current = nuevoRef();
    const ref = refIntento.current;
    const texto = textoEntrada({ tarifa_nombre: tarifa.nombre, unidad: tarifa.unidad, cantidad });

    startTransition(async () => {
      const res = await llamarAccion(() => registrarCanon({
        tarifaId: tarifa.id,
        cantidad,
        medio,
        patente: patenteNorm || undefined,
        destino,
        puesto: destino === "puesto" && puestoNorm ? puestoNorm : undefined,
        ref,
      }));
      if (!res.ok) {
        // Se conserva TODO y el MISMO ref (también si se cortó la red: si el primer intento sí
        // entró, el reintento devuelve ese cobro en vez de cobrar dos veces). Solo si la base
        // dice que con este ref ya se cobró OTRA cosa, el próximo intento es un cobro nuevo.
        if (res.error.startsWith("Ese cobro ya se registró")) refIntento.current = null;
        setError(res.error);
        return;
      }

      refIntento.current = null;
      setError(null);
      const hecho: Exito = { id: res.data.id, numero: res.data.numero, monto: res.data.monto, texto };
      setExito(hecho);
      if (res.data.repetido) {
        toast.info(`Ese cobro ya estaba registrado (N° ${res.data.numero}).`);
      } else {
        toast.success(`Cobrado N° ${res.data.numero} · ${texto} · ${formatARS(res.data.monto)}`, {
          description: LABEL_MEDIO_CANON[res.data.medio],
          duration: 10_000,
          action: { label: "Deshacer", onClick: () => deshacer(hecho) },
        });
      }
      // Conserva tarifa y medio; limpia lo del vehículo que ya pasó.
      setCantidad(1);
      setCantidadTexto("1");
      setPatente("");
      setDestino(null);
      setPuesto("");
    });
  }

  if (tarifas.length === 0) {
    return (
      <EmptyState
        icono={Truck}
        titulo="No hay tarifas de transporte cargadas"
        descripcion="Pedile al Líder de Procesos que cargue las tarifas (Camioneta, Chasis…) para poder cobrar."
      />
    );
  }

  return (
    <section className="rounded-lg border bg-card p-5 sm:p-6" aria-label="Cobrar canon de transporte">
      <form onSubmit={cobrar} className="space-y-6" autoComplete="off">
        {bloqueo ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-parcial bg-parcial-suave px-4 py-3"
          >
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-parcial" strokeWidth={2} />
            <div className="space-y-1">
              <p className="text-base font-semibold">{bloqueo.titulo}</p>
              {bloqueo.detalle ? <p className="text-sm text-muted-foreground">{bloqueo.detalle}</p> : null}
            </div>
          </div>
        ) : null}

        <fieldset disabled={Boolean(bloqueo) || pendiente} className="space-y-6 disabled:opacity-60">
          {/* ---------------------------------------------------- ¿Qué entró? */}
          <div className="space-y-2">
            <p id="que-entro" className="font-display text-xl font-bold tracking-tight">
              ¿Qué entró?
            </p>
            <div
              role="radiogroup"
              aria-labelledby="que-entro"
              className="grid grid-cols-2 gap-3 sm:grid-cols-3"
              onKeyDown={(e) => {
                const idx = tarifas.findIndex((t) => t.id === tarifaId);
                const paso = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
                if (!paso) return;
                e.preventDefault();
                const siguiente = tarifas[(idx + paso + tarifas.length) % tarifas.length];
                elegirTarifa(siguiente.id);
                document.getElementById(`tarifa-${siguiente.id}`)?.focus();
              }}
            >
              {tarifas.map((t) => {
                const elegida = t.id === tarifaId;
                const sinPrecio = t.precio <= 0;
                return (
                  <button
                    key={t.id}
                    id={`tarifa-${t.id}`}
                    type="button"
                    role="radio"
                    aria-checked={elegida}
                    tabIndex={elegida || (!tarifaId && t === tarifas[0]) ? 0 : -1}
                    disabled={sinPrecio}
                    onClick={() => elegirTarifa(t.id)}
                    className={cn(
                      "relative flex min-h-24 flex-col items-start justify-between gap-2 rounded-lg border-2 p-3 text-left transition-colors outline-none",
                      "focus-visible:ring-3 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-55",
                      elegida
                        ? "border-primary bg-primary/[0.06] text-primary"
                        : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/40"
                    )}
                  >
                    <span className="flex w-full items-start justify-between gap-2">
                      <DibujoTarifa icono={t.icono} className="size-8" />
                      {elegida ? <CircleCheck className="size-5 shrink-0" strokeWidth={2.2} aria-hidden /> : null}
                    </span>
                    <span className="space-y-0.5">
                      <span className="block text-lg leading-tight font-bold">{t.nombre}</span>
                      <span
                        className={cn(
                          "block text-sm tabular",
                          elegida ? "text-primary/85" : "text-muted-foreground"
                        )}
                      >
                        {sinPrecio ? (
                          "Sin precio: avisale al Líder"
                        ) : (
                          <>
                            <span className="font-semibold">{formatARS(t.precio)}</span> {LABEL_UNIDAD[t.unidad]}
                          </>
                        )}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ---------------------------------------------------- Cantidad y medio */}
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="canon-cantidad" className="text-base">
                {tarifa ? preguntaCantidad(tarifa.unidad) : "¿Cuántos?"}
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="size-14 shrink-0 rounded-lg"
                  onClick={() => cambiarCantidad(cantidad - 1)}
                  disabled={cantidad <= 1}
                  aria-label="Uno menos"
                >
                  <Minus className="size-6" strokeWidth={2.2} />
                </Button>
                <Input
                  id="canon-cantidad"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={cantidadTexto}
                  onChange={(e) => {
                    const limpio = e.target.value.replace(/\D/g, "").slice(0, 2);
                    setCantidadTexto(limpio);
                    if (limpio) {
                      setCantidad(Math.max(1, Number(limpio)));
                      setError(null);
                    }
                  }}
                  onBlur={() => cambiarCantidad(Number(cantidadTexto || 1))}
                  onFocus={(e) => e.target.select()}
                  className="h-14 min-w-0 flex-1 text-center font-display text-3xl font-bold tabular md:text-3xl"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="size-14 shrink-0 rounded-lg"
                  onClick={() => cambiarCantidad(cantidad + 1)}
                  disabled={cantidad >= 99}
                  aria-label="Uno más"
                >
                  <Plus className="size-6" strokeWidth={2.2} />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p id="como-paga" className="text-base font-medium">
                ¿Cómo paga?
              </p>
              <div role="radiogroup" aria-labelledby="como-paga" className="grid grid-cols-2 gap-2">
                {MEDIOS_CANON.map(({ valor, label, Icono }) => {
                  const activo = medio === valor;
                  return (
                    <button
                      key={valor}
                      type="button"
                      role="radio"
                      aria-checked={activo}
                      onClick={() => {
                        setMedio(valor);
                        setError(null);
                      }}
                      className={cn(
                        "flex h-14 items-center justify-center gap-2 rounded-lg border-2 px-3 text-base font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                        activo
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:bg-muted/50"
                      )}
                    >
                      <Icono className="size-5" strokeWidth={2} aria-hidden />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ---------------------------------------------------- Opcionales */}
          <div className="grid gap-6 border-t pt-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="canon-patente" className="text-base">
                Patente <span className="font-normal text-muted-foreground">(si querés)</span>
              </Label>
              <Input
                id="canon-patente"
                value={formatPatente(patente)}
                onChange={(e) => {
                  setPatente(normalizarPatente(e.target.value).slice(0, 8));
                  setError(null);
                }}
                placeholder="AB 123 CD"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                aria-invalid={patenteInvalida}
                aria-describedby="canon-patente-ayuda"
                className="h-12 text-lg font-semibold tracking-wider uppercase md:text-lg"
              />
              <p
                id="canon-patente-ayuda"
                className={cn("text-sm", patenteInvalida ? "font-medium text-pendiente" : "text-muted-foreground")}
              >
                {patenteInvalida
                  ? "Tiene que tener entre 5 y 8 letras y números (ej.: AB 123 CD)."
                  : "Letras y números, sin guiones."}
              </p>
            </div>

            <div className="space-y-2">
              <p id="a-quien-viene" className="text-base font-medium">
                ¿A quién viene? <span className="font-normal text-muted-foreground">(si querés)</span>
              </p>
              <div role="radiogroup" aria-labelledby="a-quien-viene" className="flex flex-wrap gap-2">
                {DESTINOS.map((d) => {
                  const activo = destino === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      role="radio"
                      aria-checked={activo}
                      onClick={() => {
                        setDestino(activo ? null : d);
                        if (d !== "puesto" || activo) setPuesto("");
                        setError(null);
                      }}
                      className={cn(
                        "h-12 min-w-24 flex-1 rounded-full border-2 px-4 text-base font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                        activo
                          ? "border-primary bg-primary/[0.08] text-primary"
                          : "border-border bg-card text-foreground hover:bg-muted/50"
                      )}
                    >
                      {LABEL_DESTINO[d]}
                    </button>
                  );
                })}
              </div>
              {destino === "puesto" ? (
                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="canon-puesto" className="text-sm">
                    N° de puesto <span className="font-normal text-muted-foreground">(si lo sabés)</span>
                  </Label>
                  <Input
                    id="canon-puesto"
                    inputMode="numeric"
                    value={puesto}
                    onChange={(e) => {
                      setPuesto(e.target.value.replace(/[^0-9A-Za-z]/g, "").slice(0, 6));
                      setError(null);
                    }}
                    placeholder="Ej.: 58"
                    aria-invalid={puestoInvalido}
                    className="h-12 w-40 text-lg font-semibold tabular md:text-lg"
                  />
                  {puestoNorm ? (
                    puestoInvalido ? (
                      <p className="flex items-center gap-1.5 text-sm font-medium text-pendiente">
                        <CircleAlert className="size-4 shrink-0" strokeWidth={2.2} />
                        No existe el puesto {puestoNorm}
                      </p>
                    ) : (
                      <p className="flex items-center gap-1.5 text-sm font-medium text-pagado">
                        <CircleCheck className="size-4 shrink-0" strokeWidth={2.2} />
                        {puestoEtiqueta}
                      </p>
                    )
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </fieldset>

        {/* ---------------------------------------------------- Total y cobrar (siempre a la vista) */}
        <div className="sticky bottom-[calc(var(--nav-inferior)+0.75rem)] z-10 -mx-2 space-y-3 rounded-xl border bg-card/95 p-3 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.25)] backdrop-blur supports-[backdrop-filter]:bg-card/85 sm:mx-0 xl:static xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none xl:backdrop-blur-none">
          <div className="flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-1" aria-live="polite">
            {exito ? (
              <div className="flex flex-wrap items-center gap-3">
                <Sello
                  key={exito.numero}
                  grande
                  estado="pagado"
                  texto={`Cobrado N° ${exito.numero}`}
                  className="animar-estampado"
                />
                <span className="text-base text-muted-foreground">
                  {exito.texto} · <Money monto={exito.monto} />
                </span>
              </div>
            ) : (
              <>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {tarifa
                      ? `${textoEntrada({ tarifa_nombre: tarifa.nombre, unidad: tarifa.unidad, cantidad })} · ${LABEL_MEDIO_CANON[medio]}`
                      : "Elegí qué entró"}
                  </p>
                </div>
                <Money monto={monto} className="font-display text-3xl font-bold tracking-tight" />
              </>
            )}
          </div>

          {error ? <AlertaError error={error} titulo="No se pudo cobrar" /> : null}

          <Button
            type="submit"
            size="lg"
            disabled={!puedeCobrar}
            className="h-14 w-full text-lg font-semibold"
          >
            {pendiente ? <Spinner className="size-6" /> : null}
            {pendiente ? "Cobrando…" : monto > 0 ? `Cobrar ${formatARS(monto)}` : "Cobrar"}
          </Button>
          {!bloqueo && !pendiente && motivoBloqueo && tarifa ? (
            <p className="text-center text-sm text-muted-foreground">{motivoBloqueo}</p>
          ) : null}
        </div>
      </form>
    </section>
  );
}
