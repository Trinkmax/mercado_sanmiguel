"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Loader2, MapPin, X } from "lucide-react";
import { formatARS, formatNumero } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Sello } from "@/components/shared/sello";
import { registrarLectura } from "@/lib/actions/energia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { llamarAccion } from "@/lib/llamar-accion";

export type FilaMedidor = {
  id: string;
  numero: string;
  cliente: string;
  /** Para ir a su ficha (pestaña Medidores): abono, exención y ubicación. */
  clienteId?: string | null;
  /** "Puesto 58" (desde el plano) o el texto libre del medidor. */
  ubicacion: string | null;
  /** Lugar del plano: la ubicación se ve como chip con link a /mapa?espacio= (C8). */
  espacioId?: string | null;
  /** I1: abono mensual del cliente (solo en su primer medidor) o "exento". */
  abono?: { monto: number } | "exento" | null;
  /** Última lectura conocida de períodos anteriores (su lectura_actual). */
  anteriorConocida: number | null;
  /** Lectura ya cargada en este período, si existe. */
  cargada: {
    anterior: number;
    actual: number;
    kwh: number;
    monto: number;
  } | null;
};

/** Columnas de la vista ancha (lista de ≥ 64rem): las mismas en el encabezado y en cada fila.
 * Medidor y lugar · Cliente (se estira) · Anterior · Actual · kWh · Importe · Acción. */
const COLUMNAS_ANCHAS = "@5xl:grid-cols-[8.5rem_minmax(0,1fr)_7rem_7.5rem_4.5rem_7.5rem_9rem]";

type EstadoFila = {
  modo: "pendiente" | "cargada" | "corrigiendo";
  anterior: string;
  actual: string;
  error: string | null;
  guardando: boolean;
  valores: { anterior: number; actual: number; kwh: number; monto: number } | null;
};

function estadoInicial(filas: FilaMedidor[]): Record<string, EstadoFila> {
  const estado: Record<string, EstadoFila> = {};
  for (const fila of filas) {
    estado[fila.id] = fila.cargada
      ? {
          modo: "cargada",
          anterior: "",
          actual: "",
          error: null,
          guardando: false,
          valores: fila.cargada,
        }
      : {
          modo: "pendiente",
          anterior: fila.anteriorConocida !== null ? String(fila.anteriorConocida) : "",
          actual: "",
          error: null,
          guardando: false,
          valores: null,
        };
  }
  return estado;
}

/**
 * Carga rápida de lecturas: solo se tipea la lectura actual y Enter guarda
 * y pasa al medidor siguiente. kWh y $ se calculan en vivo.
 */
export function CargaRapida({
  filas,
  periodo,
  precioKwh,
}: {
  filas: FilaMedidor[];
  periodo: string;
  precioKwh: number;
}) {
  const [estado, setEstado] = useState<Record<string, EstadoFila>>(() =>
    estadoInicial(filas)
  );
  const inputsActual = useRef(new Map<string, HTMLInputElement>());
  const inputsAnterior = useRef(new Map<string, HTMLInputElement>());

  const cargadas = filas.filter((f) => estado[f.id]?.modo !== "pendiente").length;
  const total = filas.length;
  const pct = total > 0 ? Math.round((cargadas / total) * 100) : 0;

  function enfocarFila(fila: FilaMedidor, est: EstadoFila) {
    const anteriorEditable = fila.anteriorConocida === null;
    const input =
      anteriorEditable && est.anterior === ""
        ? inputsAnterior.current.get(fila.id)
        : inputsActual.current.get(fila.id);
    input?.focus();
    input?.select();
  }

  // Al entrar, el foco va directo al primer medidor sin lectura.
  useEffect(() => {
    const primera = filas.find((f) => estado[f.id]?.modo === "pendiente");
    if (primera) enfocarFila(primera, estado[primera.id]);
    // Solo al montar: después el foco lo maneja cada guardado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setCampo(id: string, campo: "anterior" | "actual", valor: string) {
    const limpio = valor.replace(/\D/g, "");
    setEstado((prev) => ({
      ...prev,
      [id]: { ...prev[id], [campo]: limpio, error: null },
    }));
  }

  function corregir(id: string) {
    setEstado((prev) => {
      const v = prev[id].valores;
      return {
        ...prev,
        [id]: {
          ...prev[id],
          modo: "corrigiendo",
          anterior: v ? String(v.anterior) : "",
          actual: v ? String(v.actual) : "",
          error: null,
        },
      };
    });
    requestAnimationFrame(() => {
      inputsActual.current.get(id)?.focus();
      inputsActual.current.get(id)?.select();
    });
  }

  function cancelarCorreccion(id: string) {
    setEstado((prev) => ({
      ...prev,
      [id]: { ...prev[id], modo: "cargada", error: null },
    }));
  }

  async function confirmar(fila: FilaMedidor) {
    const est = estado[fila.id];
    if (!est || est.guardando) return;
    const anteriorEditable = fila.anteriorConocida === null;

    const anterior = anteriorEditable
      ? est.anterior === ""
        ? null
        : Number(est.anterior)
      : est.modo === "corrigiendo" && est.valores
        ? est.valores.anterior
        : fila.anteriorConocida;
    const actual = est.actual === "" ? null : Number(est.actual);

    const marcarError = (mensaje: string) =>
      setEstado((prev) => ({
        ...prev,
        [fila.id]: { ...prev[fila.id], error: mensaje },
      }));

    if (anterior === null) {
      marcarError(
        "Poné la lectura anterior: es la primera vez que se carga este medidor."
      );
      inputsAnterior.current.get(fila.id)?.focus();
      return;
    }
    if (actual === null) {
      marcarError("Poné la lectura actual del medidor.");
      inputsActual.current.get(fila.id)?.focus();
      return;
    }
    if (actual < anterior) {
      marcarError(
        `La lectura actual (${formatNumero(actual)}) no puede ser menor que la anterior (${formatNumero(anterior)}).`
      );
      inputsActual.current.get(fila.id)?.focus();
      return;
    }

    setEstado((prev) => ({
      ...prev,
      [fila.id]: { ...prev[fila.id], guardando: true, error: null },
    }));

    const res = await llamarAccion(() => registrarLectura({
      medidorId: fila.id,
      periodo,
      anterior,
      actual,
    }));

    if (!res.ok) {
      setEstado((prev) => ({
        ...prev,
        [fila.id]: { ...prev[fila.id], guardando: false, error: res.error },
      }));
      return;
    }

    const kwh = actual - anterior;
    setEstado((prev) => ({
      ...prev,
      [fila.id]: {
        modo: "cargada",
        anterior: "",
        actual: "",
        error: null,
        guardando: false,
        valores: { anterior, actual, kwh, monto: kwh * precioKwh },
      },
    }));

    // El foco salta al siguiente medidor sin lectura.
    const desde = filas.findIndex((f) => f.id === fila.id);
    const siguiente = filas.find(
      (f, i) => i > desde && estado[f.id]?.modo === "pendiente"
    );
    if (siguiente) {
      const estadoSiguiente = estado[siguiente.id];
      requestAnimationFrame(() => enfocarFila(siguiente, estadoSiguiente));
    }
  }

  return (
    <Card>
      <CardContent className="space-y-5">
        {/* Progreso del período */}
        <div className="space-y-2" data-tour="energia-progreso">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-semibold">
              <span className={cargadas > 0 ? "text-pagado" : undefined}>
                {cargadas}
              </span>{" "}
              de {total} lecturas cargadas
            </p>
            <p className="text-sm text-muted-foreground tabular">{pct}%</p>
          </div>
          <div
            className="h-3 overflow-hidden rounded-full bg-pendiente-suave"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${cargadas} de ${total} lecturas cargadas`}
          >
            <div
              className="h-full rounded-full bg-pagado transition-[width]"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Una sola lista para todos los anchos (los inputs tienen una ref por medidor):
            en celular y tablet cada medidor es una tarjeta (dos por fila desde 42rem de ancho
            útil: más angostas no entran Guardar + la X ni un importe de 9 cifras); desde 64rem,
            filas alineadas como una tabla. Nada queda fuera de pantalla. */}
        <div className="@container">
          <div
            aria-hidden
            className={cn(
              "hidden gap-x-3 border-b px-2 pb-2 text-sm font-medium text-muted-foreground @5xl:grid",
              COLUMNAS_ANCHAS
            )}
          >
            <span>Medidor y lugar</span>
            <span>Cliente</span>
            <span className="text-right">Anterior</span>
            <span className="text-right">Actual</span>
            <span className="text-right">kWh</span>
            <span className="text-right">Importe</span>
            <span />
          </div>
          <ul className="grid gap-3 @2xl:grid-cols-2 @5xl:grid-cols-1 @5xl:gap-0">
            {filas.map((fila) => {
              const est = estado[fila.id];
              if (!est) return null;
              const editando = est.modo !== "cargada";
              const anteriorEditable = fila.anteriorConocida === null;

              // Cálculo en vivo mientras se tipea (gris hasta guardar)
              const anteriorNum = editando
                ? anteriorEditable
                  ? est.anterior === ""
                    ? null
                    : Number(est.anterior)
                  : est.modo === "corrigiendo" && est.valores
                    ? est.valores.anterior
                    : fila.anteriorConocida
                : null;
              const actualNum =
                editando && est.actual !== "" ? Number(est.actual) : null;
              const kwhVivo =
                anteriorNum !== null && actualNum !== null && actualNum >= anteriorNum
                  ? actualNum - anteriorNum
                  : null;
              const kwh = editando ? kwhVivo : (est.valores?.kwh ?? 0);
              const importe = editando
                ? kwhVivo !== null
                  ? kwhVivo * precioKwh
                  : null
                : (est.valores?.monto ?? 0);

              return (
                <li
                  key={fila.id}
                  className={cn(
                    "grid grid-cols-2 gap-x-3 gap-y-3 rounded-lg border p-3",
                    "[grid-template-areas:'num_ubi'_'cli_cli'_'ant_act'_'res_acc']",
                    "@5xl:items-center @5xl:gap-y-1 @5xl:rounded-none @5xl:border-x-0 @5xl:border-t-0 @5xl:px-2 @5xl:py-2.5",
                    "@5xl:[grid-template-areas:'num_cli_ant_act_kwh_imp_acc'_'ubi_cli_ant_act_kwh_imp_acc']",
                    COLUMNAS_ANCHAS,
                    est.modo === "cargada" && "border-pagado/30 bg-pagado-suave/40"
                  )}
                >
                  <p className="self-center font-display text-lg tracking-wide break-words [grid-area:num] @5xl:self-end">
                    {fila.numero}
                  </p>

                  {/* Lugar: chip al plano o el texto libre del medidor, siempre entero */}
                  <div className="min-w-0 self-center justify-self-end text-right [grid-area:ubi] @5xl:self-start @5xl:justify-self-start @5xl:text-left">
                    {fila.espacioId ? (
                      <Link
                        href={`/mapa?espacio=${fila.espacioId}`}
                        className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-left text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-accent"
                        title="Ver en el plano"
                      >
                        <MapPin className="size-3.5 shrink-0 text-primary" strokeWidth={2} />
                        <span className="min-w-0 break-words">{fila.ubicacion ?? "En el plano"}</span>
                      </Link>
                    ) : (
                      <span className="block text-sm break-words text-muted-foreground">
                        {fila.ubicacion ?? "Sin lugar en el plano"}
                      </span>
                    )}
                  </div>

                  {/* Cliente: el nombre completo, en los renglones que haga falta */}
                  <div className="min-w-0 [grid-area:cli]">
                    {fila.clienteId ? (
                      <Link
                        href={`/clientes/${fila.clienteId}?tab=medidores`}
                        className="flex min-h-11 items-center text-base font-medium underline-offset-4 hover:text-primary hover:underline"
                        title="Ver sus medidores y el abono"
                      >
                        <span className="min-w-0 break-words">{fila.cliente}</span>
                      </Link>
                    ) : (
                      <p className="text-base font-medium break-words">{fila.cliente}</p>
                    )}
                    {fila.abono === "exento" ? (
                      <Sello estado="exento" texto="Exento de abono" className="mt-0.5" />
                    ) : fila.abono ? (
                      <p className="text-sm text-muted-foreground">
                        + abono {formatARS(fila.abono.monto)}
                      </p>
                    ) : null}
                  </div>

                  {/* Anterior */}
                  <div className="min-w-0 [grid-area:ant] @5xl:text-right">
                    <p className="mb-1 text-sm text-muted-foreground @5xl:sr-only">Anterior</p>
                    {editando && anteriorEditable ? (
                      <Input
                        ref={(el) => {
                          if (el) inputsAnterior.current.set(fila.id, el);
                          else inputsAnterior.current.delete(fila.id);
                        }}
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="Primera vez"
                        aria-label={`Lectura anterior del medidor ${fila.numero}`}
                        className="h-11 w-full text-base tabular md:text-base @5xl:text-right"
                        value={est.anterior}
                        disabled={est.guardando}
                        onChange={(e) => setCampo(fila.id, "anterior", e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            confirmar(fila);
                          }
                        }}
                      />
                    ) : (
                      <p className="flex min-h-11 items-center text-base tabular text-muted-foreground @5xl:justify-end">
                        {formatNumero(
                          editando ? anteriorNum : (est.valores?.anterior ?? 0)
                        )}
                      </p>
                    )}
                  </div>

                  {/* Actual */}
                  <div
                    className="min-w-0 [grid-area:act] @5xl:text-right"
                    data-tour={editando ? "energia-actual energia-actual-pendiente" : "energia-actual"}
                  >
                    <p className="mb-1 text-sm text-muted-foreground @5xl:sr-only">Actual</p>
                    {editando ? (
                      <Input
                        ref={(el) => {
                          if (el) inputsActual.current.set(fila.id, el);
                          else inputsActual.current.delete(fila.id);
                        }}
                        inputMode="numeric"
                        autoComplete="off"
                        aria-label={`Lectura actual del medidor ${fila.numero}`}
                        aria-invalid={est.error ? true : undefined}
                        className="h-11 w-full text-base font-semibold tabular md:text-base @5xl:text-right"
                        value={est.actual}
                        disabled={est.guardando}
                        onChange={(e) => setCampo(fila.id, "actual", e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            confirmar(fila);
                          }
                        }}
                      />
                    ) : (
                      <p className="flex min-h-11 items-center text-base font-semibold tabular @5xl:justify-end">
                        {formatNumero(est.valores?.actual ?? 0)}
                      </p>
                    )}
                  </div>

                  {/* kWh e importe: en la tarjeta van juntos (el importe arriba, grande);
                      en la vista ancha, cada uno en su columna. */}
                  <div className="flex min-w-0 flex-col justify-center [grid-area:res] @5xl:contents">
                    <p
                      className={cn(
                        "order-2 text-sm tabular text-muted-foreground @5xl:order-none @5xl:text-right @5xl:text-base @5xl:[grid-area:kwh]",
                        !editando && "@5xl:text-foreground"
                      )}
                    >
                      {kwh !== null ? formatNumero(kwh) : "—"}{" "}
                      <span className="@5xl:sr-only">kWh</span>
                    </p>
                    <p
                      className={cn(
                        "order-1 text-lg tabular break-words @5xl:order-none @5xl:text-right @5xl:text-base @5xl:[grid-area:imp]",
                        editando ? "text-muted-foreground" : "font-semibold"
                      )}
                    >
                      <span className="sr-only">Importe </span>
                      {importe !== null ? formatARS(importe) : "—"}
                    </p>
                  </div>

                  {/* Acción: siempre a la vista, con su propio lugar */}
                  <div className="flex items-center justify-end gap-1 self-center [grid-area:acc]">
                    {est.modo === "cargada" ? (
                      <>
                        <Check
                          className="size-5 shrink-0 text-pagado"
                          strokeWidth={2.2}
                          aria-label="Lectura cargada"
                        />
                        <Button
                          variant="ghost"
                          className="h-11 px-3 text-sm"
                          onClick={() => corregir(fila.id)}
                          aria-label={`Corregir la lectura del medidor ${fila.numero}`}
                        >
                          Corregir
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          className="min-h-11 px-4 text-sm font-semibold"
                          disabled={est.guardando}
                          onClick={() => confirmar(fila)}
                          aria-label={`Guardar lectura del medidor ${fila.numero}`}
                        >
                          {est.guardando ? (
                            <Loader2 className="size-5 animate-spin" />
                          ) : (
                            "Guardar"
                          )}
                        </Button>
                        {est.modo === "corrigiendo" ? (
                          <Button
                            variant="ghost"
                            size="icon-lg"
                            className="size-11"
                            disabled={est.guardando}
                            onClick={() => cancelarCorreccion(fila.id)}
                            aria-label="Cancelar corrección"
                          >
                            <X className="size-5" strokeWidth={2.2} />
                          </Button>
                        ) : null}
                      </>
                    )}
                  </div>

                  {est.error ? (
                    <p
                      role="alert"
                      className="col-span-full rounded-md bg-pendiente-suave/60 px-3 py-2.5 text-sm font-medium text-pendiente"
                    >
                      {est.error}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
