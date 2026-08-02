"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { formatARS, formatNumero } from "@/lib/format";
import { registrarLectura } from "@/lib/actions/energia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type FilaMedidor = {
  id: string;
  numero: string;
  cliente: string;
  ubicacion: string | null;
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

    const res = await registrarLectura({
      medidorId: fila.id,
      periodo,
      anterior,
      actual,
    });

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
      <CardContent className="space-y-5 pt-6">
        {/* Progreso del período */}
        <div className="space-y-2">
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

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-24">N° medidor</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="max-md:hidden">Ubicación</TableHead>
              <TableHead className="w-28 text-right">Anterior</TableHead>
              <TableHead className="w-32 text-right">Actual</TableHead>
              <TableHead className="w-20 text-right">kWh</TableHead>
              <TableHead className="w-28 text-right">Importe</TableHead>
              <TableHead className="w-28">
                <span className="sr-only">Acción</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
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

              return (
                <Fragment key={fila.id}>
                <TableRow
                  className={
                    est.modo === "cargada"
                      ? "bg-pagado-suave/40 hover:bg-pagado-suave/40"
                      : undefined
                  }
                >
                  <TableCell className="font-display text-lg tracking-wide">
                    {fila.numero}
                  </TableCell>
                  <TableCell className="max-w-44 truncate font-medium">
                    {fila.cliente}
                  </TableCell>
                  <TableCell className="max-w-36 truncate text-muted-foreground max-md:hidden">
                    {fila.ubicacion ?? "—"}
                  </TableCell>

                  {/* Anterior */}
                  <TableCell className="text-right">
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
                        className="h-11 w-24 text-right text-base tabular"
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
                      <span className="tabular text-muted-foreground">
                        {formatNumero(
                          editando ? anteriorNum : (est.valores?.anterior ?? 0)
                        )}
                      </span>
                    )}
                  </TableCell>

                  {/* Actual */}
                  <TableCell className="text-right">
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
                        className="h-11 w-28 text-right text-base font-semibold tabular"
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
                      <span className="font-semibold tabular">
                        {formatNumero(est.valores?.actual ?? 0)}
                      </span>
                    )}
                  </TableCell>

                  {/* kWh y $ */}
                  <TableCell className="text-right">
                    {editando ? (
                      <span className="tabular text-muted-foreground">
                        {kwhVivo !== null ? formatNumero(kwhVivo) : "—"}
                      </span>
                    ) : (
                      <span className="tabular">
                        {formatNumero(est.valores?.kwh ?? 0)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {editando ? (
                      <span className="tabular text-muted-foreground">
                        {kwhVivo !== null ? formatARS(kwhVivo * precioKwh) : "—"}
                      </span>
                    ) : (
                      <span className="font-semibold tabular">
                        {formatARS(est.valores?.monto ?? 0)}
                      </span>
                    )}
                  </TableCell>

                  {/* Acción */}
                  <TableCell>
                    {est.modo === "cargada" ? (
                      <div className="flex items-center justify-end gap-1">
                        <Check
                          className="size-5 text-pagado"
                          strokeWidth={2.2}
                          aria-label="Lectura cargada"
                        />
                        <Button
                          variant="ghost"
                          className="h-11 px-3 text-sm"
                          onClick={() => corregir(fila.id)}
                        >
                          Corregir
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
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
                      </div>
                    )}
                  </TableCell>
                </TableRow>
                {est.error ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={8}
                      className="whitespace-normal bg-pendiente-suave/60 py-2.5 text-sm font-medium text-pendiente"
                    >
                      {est.error}
                    </TableCell>
                  </TableRow>
                ) : null}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
