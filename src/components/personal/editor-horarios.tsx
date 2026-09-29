"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleAlert, Copy, Moon, Plus, Save, X } from "lucide-react";
import { guardarHorarios } from "@/lib/actions/personal";
import { DIAS_SEMANA } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  cruzaMedianoche,
  diaSiguiente,
  erroresDeFranjas,
  type Franja,
} from "@/components/personal/constantes";
import { llamarAccion } from "@/lib/llamar-accion";
import { AlertaError } from "@/components/cobranza/alerta-error";

type FranjaEditable = { clave: number; desde: string; hasta: string };
type Semana = Record<number, FranjaEditable[]>;

let contadorClave = 0;
function nuevaClave() {
  contadorClave += 1;
  return contadorClave;
}

function semanaDesde(franjas: Franja[]): Semana {
  const semana: Semana = {};
  for (let d = 1; d <= 7; d++) semana[d] = [];
  for (const f of franjas) {
    semana[f.dia_semana]?.push({
      clave: nuevaClave(),
      desde: f.hora_desde.slice(0, 5),
      hasta: f.hora_hasta.slice(0, 5),
    });
  }
  for (let d = 1; d <= 7; d++) semana[d].sort((a, b) => a.desde.localeCompare(b.desde));
  return semana;
}

function firmaSemana(semana: Semana): string {
  return DIAS_SEMANA.map((d) =>
    semana[d.valor]
      .map((f) => `${f.desde}-${f.hasta}`)
      .sort()
      .join(",")
  ).join("|");
}

/**
 * Errores de validación por día (null = bien). Una salida anterior a la entrada es un turno de
 * noche (termina al día siguiente); se controla que no se pise con la franja del otro día.
 */
function erroresSemana(semana: Semana): Record<number, string | null> {
  const e: Record<number, string | null> = {};
  const completas: Franja[] = [];
  for (let d = 1; d <= 7; d++) {
    e[d] = null;
    for (const f of semana[d]) {
      if (!f.desde || !f.hasta) e[d] ??= "Completá la hora de entrada y de salida (por ejemplo 08:00)";
      else completas.push({ dia_semana: d, hora_desde: f.desde, hora_hasta: f.hasta });
    }
  }
  const cruzadas = erroresDeFranjas(completas);
  for (let d = 1; d <= 7; d++) e[d] ??= cruzadas[d] ?? null;
  return e;
}

/**
 * Editor de horarios de trabajo: una fila por día de la semana, con una o
 * más franjas (entrada – salida). Guarda todo junto (reemplaza lo anterior).
 */
export function EditorHorarios({
  empleadoId,
  inicial,
}: {
  empleadoId: string;
  inicial: Franja[];
}) {
  const router = useRouter();
  const [semana, setSemana] = useState<Semana>(() => semanaDesde(inicial));
  const [guardada, setGuardada] = useState(() => firmaSemana(semanaDesde(inicial)));
  const [pendiente, startTransition] = useTransition();
  const [errorServidor, setErrorServidor] = useState<string | null>(null);

  const errores = useMemo(() => erroresSemana(semana), [semana]);
  const hayErrores = Object.values(errores).some(Boolean);
  const hayCambios = firmaSemana(semana) !== guardada;
  const lunesVacio = semana[1].length === 0;

  function actualizar(dia: number, fn: (lista: FranjaEditable[]) => FranjaEditable[]) {
    setSemana((prev) => ({ ...prev, [dia]: fn(prev[dia]) }));
  }

  function agregarFranja(dia: number) {
    actualizar(dia, (lista) => {
      // Sugerencia: el horario de la franja anterior, o el del lunes, o 07–15.
      const base = lista[lista.length - 1] ?? semana[1][0];
      const desde = lista.length > 0 ? base.hasta : (base?.desde ?? "07:00");
      const hasta = lista.length > 0 ? "" : (base?.hasta ?? "15:00");
      return [...lista, { clave: nuevaClave(), desde, hasta }];
    });
  }

  function quitarFranja(dia: number, clave: number) {
    actualizar(dia, (lista) => lista.filter((f) => f.clave !== clave));
  }

  function cambiarHora(dia: number, clave: number, campo: "desde" | "hasta", valor: string) {
    actualizar(dia, (lista) =>
      lista.map((f) => (f.clave === clave ? { ...f, [campo]: valor } : f))
    );
  }

  function copiarLunes() {
    setSemana((prev) => {
      const copia: Semana = { ...prev };
      // Martes a sábado: el mercado no suele trabajar el domingo; se carga aparte.
      for (let d = 2; d <= 6; d++) {
        copia[d] = prev[1].map((f) => ({ ...f, clave: nuevaClave() }));
      }
      return copia;
    });
  }

  function guardar() {
    if (hayErrores) return;
    setErrorServidor(null);
    const franjas = DIAS_SEMANA.flatMap((d) =>
      semana[d.valor].map((f) => ({
        dia_semana: d.valor,
        hora_desde: f.desde,
        hora_hasta: f.hasta,
      }))
    );
    startTransition(async () => {
      const res = await llamarAccion(() => guardarHorarios({ empleadoId, franjas }));
      if (!res.ok) {
        // Lo cargado queda en pantalla para volver a tocar "Guardar horarios".
        setErrorServidor(res.error);
        return;
      }
      setGuardada(firmaSemana(semana));
      toast.success(
        res.data.cantidad === 0
          ? "Horarios guardados: quedó sin franjas"
          : "Horarios de trabajo guardados"
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-2xl space-y-1 text-sm text-muted-foreground">
          <p>
            Cargá la entrada y la salida de cada día, en horario de 24 horas
            (14:00, no 2 p.m.). Portería compara el ingreso con estas franjas.
            «Copiar lunes» completa de martes a sábado; el domingo se carga aparte.
          </p>
          <p className="flex items-start gap-1.5">
            <Moon className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden />
            <span>
              Turno de noche (por ejemplo de 22:00 a 06:00): cargalo en el día que entra; la
              salida queda para el día siguiente.
            </span>
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-11 px-4 text-sm"
          onClick={copiarLunes}
          disabled={lunesVacio || Boolean(errores[1])}
          title={lunesVacio ? "Primero cargá el lunes" : undefined}
        >
          <Copy className="size-4" strokeWidth={2} />
          Copiar lunes a martes–sábado
        </Button>
      </div>

      <div className="divide-y rounded-lg border bg-card">
        {DIAS_SEMANA.map((dia) => {
          const franjas = semana[dia.valor];
          const error = errores[dia.valor];
          return (
            <div
              key={dia.valor}
              className="grid gap-3 px-4 py-3 sm:grid-cols-[7.5rem_1fr] sm:items-start"
            >
              <div className="pt-2.5">
                <p className="font-display text-base font-bold">{dia.label}</p>
                {franjas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No trabaja</p>
                ) : null}
              </div>
              <div className="space-y-2">
                {franjas.map((f) => (
                  <div key={f.clave} className="flex flex-wrap items-center gap-2">
                    <CampoHora
                      valor={f.desde}
                      ariaLabel={`${dia.label}: hora de entrada`}
                      onCambio={(v) => cambiarHora(dia.valor, f.clave, "desde", v)}
                    />
                    <span className="text-muted-foreground">a</span>
                    <CampoHora
                      valor={f.hasta}
                      ariaLabel={`${dia.label}: hora de salida`}
                      onCambio={(v) => cambiarHora(dia.valor, f.clave, "hasta", v)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="lg"
                      className="h-12 px-3 text-sm text-muted-foreground hover:text-pendiente"
                      onClick={() => quitarFranja(dia.valor, f.clave)}
                      aria-label={`Quitar franja del ${dia.label.toLowerCase()}`}
                    >
                      <X className="size-5" strokeWidth={2} />
                      Quitar
                    </Button>
                    {f.desde && f.hasta && f.desde !== f.hasta && cruzaMedianoche({ hora_desde: f.desde, hora_hasta: f.hasta }) ? (
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
                        <Moon className="size-4 shrink-0" strokeWidth={2} aria-hidden />
                        Sale el {diaSiguiente(dia.valor)}
                      </span>
                    ) : null}
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant={franjas.length === 0 ? "outline" : "ghost"}
                    size="lg"
                    className={cn(
                      "h-11 px-3 text-sm",
                      franjas.length > 0 && "text-primary"
                    )}
                    onClick={() => agregarFranja(dia.valor)}
                  >
                    <Plus className="size-4" strokeWidth={2.2} />
                    {franjas.length === 0 ? "Agregar horario" : "Agregar otra franja"}
                  </Button>
                  {error ? (
                    <p className="flex items-center gap-1.5 text-sm font-medium text-pendiente">
                      <CircleAlert className="size-4 shrink-0" strokeWidth={2} />
                      {error}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {errorServidor ? <AlertaError error={errorServidor} titulo="No se guardaron los horarios" /> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="lg"
          className="h-12 px-6 text-base font-semibold"
          onClick={guardar}
          disabled={pendiente || hayErrores || !hayCambios}
        >
          {pendiente ? <Spinner className="size-5" /> : <Save className="size-5" />}
          Guardar horarios
        </Button>
        {hayCambios && !pendiente ? (
          <p className="text-sm font-medium text-parcial">Tenés cambios sin guardar</p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * "08:00", "830", "8.30" o "14" → "08:00" / "08:30" / "14:00". null si no es una hora válida.
 * Con dos puntos (o punto) separa horas y minutos; sin separador, los dos últimos números son
 * los minutos cuando hay 3 o 4.
 */
function leerHora(texto: string): string | null {
  const t = texto.trim().replace(/[.,h ]/gi, ":");
  if (!t) return null;
  let h: number;
  let m: number;
  if (t.includes(":")) {
    const [a, b = ""] = t.split(":");
    if (!/^\d{1,2}$/.test(a) || !/^\d{0,2}$/.test(b)) return null;
    h = Number(a);
    m = b === "" ? 0 : Number(b.padEnd(2, "0"));
  } else {
    if (!/^\d{1,4}$/.test(t)) return null;
    if (t.length <= 2) {
      h = Number(t);
      m = 0;
    } else {
      h = Number(t.slice(0, -2));
      m = Number(t.slice(-2));
    }
  }
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Hora en 24 h, siempre ("14:00"). El <input type="time"> del navegador se muestra según el
 * idioma de la computadora ("02:00 p.m."), distinto del resumen y del resto del sistema.
 * Teclado numérico; al salir del campo se acomoda ("830" → "08:30").
 */
function CampoHora({
  valor,
  onCambio,
  ariaLabel,
}: {
  valor: string;
  onCambio: (hora: string) => void;
  ariaLabel: string;
}) {
  const [texto, setTexto] = useState(valor);
  const [anterior, setAnterior] = useState(valor);
  // Si el valor cambia desde afuera, se muestra el nuevo. Lo que se está tipeando y todavía
  // no es una hora ("14:") equivale a "" y no se pisa.
  if (valor !== anterior) {
    setAnterior(valor);
    if (valor !== (leerHora(texto) ?? "")) setTexto(valor);
  }
  const invalida = texto.trim() !== "" && leerHora(texto) === null;

  return (
    <Input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="08:00"
      maxLength={5}
      value={texto}
      aria-label={ariaLabel}
      aria-invalid={invalida || undefined}
      onChange={(e) => {
        const nuevo = e.target.value.replace(/[^\d:.,]/g, "").slice(0, 5);
        setTexto(nuevo);
        onCambio(leerHora(nuevo) ?? "");
      }}
      onBlur={() => {
        const hora = leerHora(texto);
        if (hora) setTexto(hora);
      }}
      className="h-12 w-24 text-center text-lg tabular md:text-lg"
    />
  );
}
