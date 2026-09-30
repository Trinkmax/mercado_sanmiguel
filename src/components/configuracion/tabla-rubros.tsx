"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Plus, Receipt, Repeat, Shuffle } from "lucide-react";
import { toast } from "sonner";
import {
  cambiarActivoRubro,
  configurarRubroGasto,
  crearRubro,
  type ResultadoConfigurarRubro,
} from "@/lib/actions/configuracion";
import {
  formatARS,
  formatFecha,
  hoyISO,
  labelPeriodo,
  montoATexto,
  parseMonto,
  periodoActual,
  sanitizarMonto,
  sumarMeses,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Codigo } from "@/components/shared/codigo";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { llamarAccion } from "@/lib/llamar-accion";

export type RubroFila = {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
  /** Fijo: se carga solo en Gastos todos los meses, con su monto y su vencimiento (0037). */
  tipo: "fijo" | "variable";
  montoFijo: number | null;
  diaVencimiento: number | null;
  /** Primer mes en que se carga solo ("YYYY-MM-01"), si es fijo. */
  fijoDesde: string | null;
};

/** "septiembre de 2026" (en medio de una frase). */
function mesEnFrase(periodo: string): string {
  return labelPeriodo(periodo).toLowerCase();
}

/** Vencimiento de ese día en el mes ("YYYY-MM-DD"; 31 en un mes de 30 → el 30). */
function vencimientoEnMes(periodo: string, dia: number): string {
  const [y, m] = periodo.split("-").map(Number);
  const ultimo = new Date(y, m, 0).getDate();
  return `${periodo.slice(0, 8)}${String(Math.min(dia, ultimo)).padStart(2, "0")}`;
}

/** Lo que pasó con el gasto del mes en curso, para el aviso después de guardar. */
function avisoEsteMes(
  r: ResultadoConfigurarRubro,
  monto: number
): string {
  const mes = mesEnFrase(r.periodo || periodoActual());
  const siguiente = mesEnFrase(sumarMeses(r.periodo || periodoActual(), 1));
  const vence = r.vencimientoEsteMes ? formatFecha(r.vencimientoEsteMes).slice(0, 5) : "";
  switch (r.esteMes) {
    case "cargado":
      return `Ya está en los gastos de ${mes}: ${formatARS(monto)}, vence el ${vence}.`;
    case "actualizado":
      return `El de ${mes}, que todavía no se pagó, quedó con el monto y el vencimiento nuevos.`;
    case "pagado":
      return `El de ${mes} ya se pagó: el monto nuevo rige desde ${siguiente}.`;
    case "anulado":
      return `El de ${mes} se había anulado, así que no vuelve a cargarse solo. Si hace falta, cargalo a mano en Gastos.`;
    case "ya_cargado_solo":
      return `El de ${mes} ya estaba cargado.`;
    case "a_mano":
      return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ya tenía este gasto cargado a mano: se carga solo desde ${siguiente}.`;
    case "desde_el_proximo":
      return `Empieza a cargarse solo en ${siguiente}.`;
    default:
      return `Se carga solo el 1° de cada mes.`;
  }
}

/** "el 10" · "el último día" (31 en un mes de 30). */
function textoDia(dia: number): string {
  return dia >= 29 ? `el ${dia} (o el último día, si el mes es más corto)` : `el ${dia}`;
}

/**
 * Un rubro de la lista: variable (se carga a medida que pasa) o fijo (monto y día en que
 * vence; se carga solo todos los meses). Los cambios se guardan con «Guardar».
 */
function FilaRubro({
  rubro,
  pendienteActivo,
  onCambiarActivo,
}: {
  rubro: RubroFila;
  pendienteActivo: boolean;
  onCambiarActivo: (activo: boolean) => void;
}) {
  const [tipo, setTipo] = useState(rubro.tipo);
  const [monto, setMonto] = useState(montoATexto(rubro.montoFijo ?? 0));
  const [dia, setDia] = useState(rubro.diaVencimiento ? String(rubro.diaVencimiento) : "");
  const [guardando, startGuardar] = useTransition();
  // El vencimiento de este mes ya pasó: se pregunta si cargar también el de este mes.
  const [preguntar, setPreguntar] = useState(false);
  const montoNumero = parseMonto(monto);
  const diaNumero = Number(dia);
  const diaValido = Number.isInteger(diaNumero) && diaNumero >= 1 && diaNumero <= 31;
  const cambio =
    tipo !== rubro.tipo ||
    (tipo === "fijo" && (montoNumero !== (rubro.montoFijo ?? 0) || diaNumero !== (rubro.diaVencimiento ?? 0)));
  const completo = tipo === "variable" || (montoNumero > 0 && diaValido);
  const mesActual = periodoActual();
  const idBase = `rubro-${rubro.id}`;
  const vencimientoEsteMes = diaValido ? vencimientoEnMes(mesActual, diaNumero) : null;
  const vencePasado =
    tipo === "fijo" && rubro.tipo !== "fijo" && vencimientoEsteMes !== null && vencimientoEsteMes < hoyISO();
  const desdeFuturo = rubro.tipo === "fijo" && rubro.fijoDesde !== null && rubro.fijoDesde > mesActual;

  function deshacer() {
    setPreguntar(false);
    setTipo(rubro.tipo);
    setMonto(montoATexto(rubro.montoFijo ?? 0));
    setDia(rubro.diaVencimiento ? String(rubro.diaVencimiento) : "");
  }

  function intentarGuardar() {
    if (vencePasado) setPreguntar(true);
    else guardar();
  }

  function guardar(cargarEsteMes?: boolean) {
    setPreguntar(false);
    startGuardar(async () => {
      const res = await llamarAccion(() =>
        configurarRubroGasto(
          tipo === "fijo"
            ? { id: rubro.id, tipo, monto: montoNumero, dia: diaNumero, ...(cargarEsteMes === undefined ? {} : { cargarEsteMes }) }
            : { id: rubro.id, tipo }
        )
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const periodo = res.data.periodo || mesActual;
      // Avisos más largos que los de siempre: dicen qué pasó con el gasto de este mes.
      if (tipo === "variable") {
        toast.success(`${rubro.nombre} ahora es variable`, {
          duration: 10_000,
          description:
            res.data.esteMes === "queda_pendiente"
              ? `Desde ${mesEnFrase(sumarMeses(periodo, 1))} no se carga solo. El de ${mesEnFrase(periodo)} quedó en Gastos: si no va, anulalo ahí.`
              : `Desde ${mesEnFrase(sumarMeses(periodo, 1))} no se carga solo: se carga en Gastos cada vez que pasa.`,
        });
      } else {
        toast.success(`${rubro.nombre}: se carga solo todos los meses`, {
          duration: 10_000,
          description: avisoEsteMes(res.data, montoNumero),
        });
      }
    });
  }

  return (
    <li className={cn("space-y-3 px-4 py-4", !rubro.activo && "bg-muted/40")} data-tour="config-rubro-fila">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-56 items-center gap-2.5">
          <Codigo codigo={rubro.codigo} />
          <p className={cn("min-w-0 text-base font-medium break-words", !rubro.activo && "text-muted-foreground")}>
            {rubro.nombre}
          </p>
        </div>
        {/* Variable o fijo: dos botones grandes, el elegido en azul. */}
        <div
          role="group"
          aria-label={`${rubro.nombre}: variable o fijo`}
          className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
          data-tour="config-rubro-tipo"
        >
          {(["variable", "fijo"] as const).map((t) => (
            <button
              key={t}
              type="button"
              disabled={!rubro.activo || guardando}
              aria-pressed={tipo === t}
              onClick={() => setTipo(t)}
              className={cn(
                "flex min-h-10 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-colors disabled:opacity-60",
                tipo === t ? "bg-card text-primary shadow-sm ring-1 ring-primary/30" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "fijo" ? <Repeat className="size-4" strokeWidth={2} /> : <Shuffle className="size-4" strokeWidth={2} />}
              {t === "fijo" ? "Fijo" : "Variable"}
            </button>
          ))}
        </div>
        {/* Con su rótulo al lado: se ve qué se prende y se apaga, y la zona para tocar es más grande. */}
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <Switch
            checked={rubro.activo}
            disabled={pendienteActivo}
            onCheckedChange={onCambiarActivo}
            aria-label={`${rubro.nombre} activo`}
          />
          {rubro.activo ? "Activo" : "Apagado"}
        </label>
      </div>

      {tipo === "fijo" && rubro.activo ? (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-primary/20 bg-accent/40 p-3" data-tour="config-rubro-fijo">
          <div className="space-y-1.5">
            <Label htmlFor={`${idBase}-monto`} className="text-sm">
              Monto de cada mes
            </Label>
            <Input
              id={`${idBase}-monto`}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={monto}
              onChange={(e) => setMonto(sanitizarMonto(e.target.value).slice(0, 15))}
              className="h-12 w-44 text-lg font-semibold tabular md:text-lg"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idBase}-dia`} className="text-sm">
              Vence el día
            </Label>
            <Input
              id={`${idBase}-dia`}
              inputMode="numeric"
              autoComplete="off"
              value={dia}
              onChange={(e) => setDia(e.target.value.replace(/\D/g, "").slice(0, 2))}
              aria-invalid={dia !== "" && !diaValido ? true : undefined}
              className="h-12 w-20 text-center text-lg font-semibold tabular md:text-lg"
            />
          </div>
          <p className="min-w-0 flex-1 basis-56 pb-1 text-sm leading-snug text-muted-foreground">
            {montoNumero > 0 && diaValido ? (
              <>
                Todos los meses se carga solo en «Gastos»: <strong className="text-foreground">{formatARS(montoNumero)}</strong>,
                vence {textoDia(diaNumero)}.
              </>
            ) : dia !== "" && !diaValido ? (
              <span className="font-medium text-destructive">El día va del 1 al 31.</span>
            ) : (
              "Poné cuánto se paga cada mes y qué día vence: después se carga solo todos los meses."
            )}
          </p>
        </div>
      ) : null}

      {!rubro.activo ? (
        <p className="text-sm text-muted-foreground">Apagado: no aparece al cargar gastos y no se carga solo.</p>
      ) : tipo === "variable" && !cambio ? (
        <p className="text-sm text-muted-foreground">Variable: se carga en «Gastos» cada vez que pasa.</p>
      ) : desdeFuturo && !cambio && rubro.fijoDesde ? (
        <p className="text-sm font-medium text-primary">Se carga solo desde {mesEnFrase(rubro.fijoDesde)}.</p>
      ) : null}

      {cambio && rubro.activo && preguntar && vencimientoEsteMes ? (
        // El vencimiento de este mes ya pasó: ¿cargarlo igual (si todavía no se pagó) o empezar el que viene?
        <div className="space-y-3 rounded-xl border border-parcial/40 bg-parcial-suave p-3" role="group" aria-label="¿Cargar también el de este mes?">
          <p className="text-base leading-snug">
            El de {mesEnFrase(mesActual)} vencía el <strong>{formatFecha(vencimientoEsteMes).slice(0, 5)}</strong> y ese
            día ya pasó. ¿Lo cargamos igual? Si ya se pagó o no corresponde, empezá en{" "}
            {mesEnFrase(sumarMeses(mesActual, 1))}.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => guardar(false)} disabled={guardando} className="h-11 px-4 text-base font-semibold">
              Empezar en {mesEnFrase(sumarMeses(mesActual, 1))}
            </Button>
            <Button type="button" variant="outline" onClick={() => guardar(true)} disabled={guardando} className="h-11 px-4 text-base">
              Cargar también el de {mesEnFrase(mesActual)}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPreguntar(false)} disabled={guardando} className="h-11 px-3 text-base">
              Volver
            </Button>
          </div>
        </div>
      ) : cambio && rubro.activo ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={intentarGuardar}
            disabled={guardando || !completo}
            className="h-11 gap-2 px-5 text-base font-semibold"
          >
            {guardando ? <Spinner className="size-4" /> : null}
            {tipo === "fijo" ? "Guardar fijo" : "Guardar: pasa a variable"}
          </Button>
          <Button type="button" variant="ghost" onClick={deshacer} disabled={guardando} className="h-11 px-4 text-base">
            Deshacer
          </Button>
        </div>
      ) : null}
    </li>
  );
}

/** Arriba de la lista: cuántos fijos hay y cuánto suman por mes. */
function ResumenFijos({ rubros }: { rubros: RubroFila[] }) {
  const fijos = rubros.filter((r) => r.activo && r.tipo === "fijo");
  const total = fijos.reduce((acc, r) => acc + (r.montoFijo ?? 0), 0);
  return (
    <div className="flex flex-wrap items-start gap-4 rounded-xl border bg-card p-4" data-tour="config-rubros-fijos">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        <CalendarClock className="size-5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1 basis-64 space-y-1">
        <p className="font-display text-lg leading-snug font-bold">
          {fijos.length === 0
            ? "Todavía no hay gastos fijos"
            : fijos.length === 1
              ? "1 gasto fijo se carga solo cada mes"
              : `${fijos.length} gastos fijos se cargan solos cada mes`}
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Marcá como <strong className="text-foreground">Fijo</strong> lo que se paga todos los meses (el alquiler, internet,
          los sueldos) con su monto y el día que vence: el 1° de cada mes aparece solo en «Gastos», listo para pagar. Lo{" "}
          <strong className="text-foreground">Variable</strong> se carga cada vez que pasa.
        </p>
      </div>
      {fijos.length > 0 ? (
        <div className="shrink-0 text-right">
          <p className="text-sm text-muted-foreground">Por mes</p>
          <Money monto={total} className="text-xl font-bold" />
        </div>
      ) : null}
    </div>
  );
}

export function TablaRubros({ rubros }: { rubros: RubroFila[] }) {
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [creando, startCrear] = useTransition();
  const [pendiente, setPendiente] = useState<string | null>(null);
  const [, startToggle] = useTransition();
  // Aviso en el acto si el código ya existe (antes el ejemplo "AGUA" era justo uno cargado).
  const repetido = codigo ? rubros.find((r) => r.codigo.toUpperCase() === codigo.toUpperCase()) : undefined;

  function crear() {
    startCrear(async () => {
      const res = await llamarAccion(() => crearRubro({ codigo, nombre }));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Rubro ${codigo.toUpperCase()} agregado.`);
      setCodigo("");
      setNombre("");
    });
  }

  function cambiarActivo(rubro: RubroFila, activo: boolean) {
    setPendiente(rubro.id);
    startToggle(async () => {
      const res = await llamarAccion(() => cambiarActivoRubro({ id: rubro.id, activo }));
      if (!res.ok) toast.error(res.error);
      else
        toast.success(
          activo
            ? `${rubro.nombre} quedó activo.`
            : rubro.tipo === "fijo"
              ? `${rubro.nombre} quedó apagado: no aparece al cargar gastos y deja de cargarse solo cada mes.`
              : `${rubro.nombre} quedó apagado: no aparece más al cargar gastos.`
        );
      setPendiente(null);
    });
  }

  return (
    <div className="space-y-6">
      <Card data-tour="config-rubro-nuevo">
        <CardHeader>
          <CardTitle className="text-lg">Nuevo rubro</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="codigo-rubro" className="text-sm">
                Código
              </Label>
              {/* Los ejemplos van con "Ej.:" y de un rubro que no existe: en gris parecían datos cargados. */}
              <Input
                id="codigo-rubro"
                autoComplete="off"
                maxLength={8}
                placeholder="Ej.: PAPEL"
                aria-invalid={repetido ? true : undefined}
                aria-describedby="codigo-rubro-ayuda"
                className="h-12 w-36 text-base uppercase placeholder:normal-case md:text-base"
                value={codigo}
                onChange={(e) =>
                  setCodigo(
                    e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
                  )
                }
              />
            </div>
            <div className="min-w-56 flex-1 space-y-2">
              <Label htmlFor="nombre-rubro" className="text-sm">
                Nombre
              </Label>
              <Input
                id="nombre-rubro"
                autoComplete="off"
                placeholder="Ej.: Papelería y librería"
                className="h-12 text-base md:text-base"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>
            <Button
              size="lg"
              className="h-12 px-6 text-base font-semibold"
              disabled={creando || !codigo.trim() || !nombre.trim() || Boolean(repetido)}
              onClick={crear}
            >
              <Plus className="size-5" strokeWidth={2} />
              {creando ? "Agregando…" : "Agregar rubro"}
            </Button>
          </div>
          <p
            id="codigo-rubro-ayuda"
            className={repetido ? "mt-2 text-sm font-medium text-destructive" : "mt-2 text-sm text-muted-foreground"}
          >
            {repetido
              ? `El código ${repetido.codigo} ya es de "${repetido.nombre}". Elegí otro.`
              : "Un código corto (hasta 8 letras o números) y el nombre como lo van a ver al cargar un gasto."}
          </p>
        </CardContent>
      </Card>

      {rubros.length === 0 ? (
        <EmptyState
          icono={Receipt}
          titulo="Todavía no hay rubros de gasto"
          descripcion="Agregá el primero acá arriba: un código corto (AGUA, ALQ…) y su nombre."
        />
      ) : (
        <>
          <ResumenFijos rubros={rubros} />
          <ul className="divide-y overflow-hidden rounded-xl border bg-card" data-tour="config-rubros-lista">
            {rubros.map((rubro) => (
              <FilaRubro
                // Cuando se guarda, la fila vuelve a arrancar con lo guardado.
                key={`${rubro.id}-${rubro.tipo}-${rubro.montoFijo ?? 0}-${rubro.diaVencimiento ?? 0}-${rubro.fijoDesde}-${rubro.activo}`}
                rubro={rubro}
                pendienteActivo={pendiente === rubro.id}
                onCambiarActivo={(activo) => cambiarActivo(rubro, activo)}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
