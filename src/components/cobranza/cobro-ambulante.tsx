"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  CalendarDays,
  Check,
  FileText,
  Footprints,
  Landmark,
  Lock,
  Minus,
  Plus,
  Repeat,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatARS, hoyISO } from "@/lib/format";
import {
  cobrarDiario,
  type InputCobroDiario,
  type ResultadoCobroDiario,
} from "@/lib/actions/cobranza";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Money } from "@/components/shared/money";
import { AlertaError, esErrorDeCajaCerrada } from "@/components/cobranza/alerta-error";
import { Chip } from "@/components/cobranza/datos-cheque";
import { DatosTransferencia } from "@/components/cobranza/datos-transferencia";
import { ReciboRegistrado } from "@/components/cobranza/recibo-registrado";
import { SelectorMedio } from "@/components/cobranza/selector-medio";
import {
  MAX_COMPROBANTE,
  MENSAJE_COMPROBANTE_PESADO,
  diaCorto,
  diaMes,
  diaSemanaCorto,
  diasEntre,
  montoConMiles,
  parseMonto,
  redondear2,
  sanitizarMonto,
  sumarDias,
  uuidV4,
} from "@/components/cobranza/tipos";
import { llamarAccion } from "@/lib/llamar-accion";

type Medio = "efectivo" | "transferencia";

const ATAJOS = [
  { dias: 1, label: "Solo hoy" },
  { dias: 2, label: "2 días" },
  { dias: 3, label: "3 días" },
  { dias: 7, label: "Semana (7)" },
];

/**
 * Cobro por días del ambulante (G5, G6): "$15.000 por día", cuántos días (stepper + atajos),
 * desde qué día (la tira marca lo ya pagado), total grande y un botón que dice lo que hace.
 * El cargo AMB y su pago se crean juntos en la base (cobrar_diario).
 *
 * A1: un mismo cobro puede ir parte en efectivo y parte por transferencia (UN recibo): se
 * escribe cuánto va por transferencia y el efectivo es el resto (la suma siempre da el total).
 * El `loteId` hace idempotente el registro: un corte de red o un doble toque usan el MISMO
 * lote hasta que el cobro termina bien.
 */
export function CobroAmbulante({
  clienteId,
  clienteNombre,
  precioDia,
  pagados,
  ultimoPagoHasta = null,
  volverA = "/cobranza",
  cajaCerrada = false,
  irACaja = "/caja",
}: {
  clienteId: string;
  clienteNombre: string;
  /** Precio del concepto AMB (null o 0 = falta configurarlo). */
  precioDia: number | null;
  /** Rangos ya pagados (cargos AMB vigentes de los últimos meses). */
  pagados: { desde: string; hasta: string }[];
  /** Último día pago de todos los tiempos (v_ultimo_pago_ambulante), aunque sea viejo. */
  ultimoPagoHasta?: string | null;
  volverA?: string;
  /** La caja de hoy de quien cobra no está abierta: la página lo avisa arriba y acá no se cobra. */
  cajaCerrada?: boolean;
  /** Dónde se reabre / pide la reapertura de la caja. */
  irACaja?: string;
}) {
  const router = useRouter();
  const hoy = hoyISO();
  const pagoHasta = pagados.reduce<string | null>(
    (max, p) => (!max || p.hasta > max ? p.hasta : max),
    ultimoPagoHasta
  );
  const arranque = pagoHasta && pagoHasta >= hoy ? sumarDias(pagoHasta, 1) : hoy;

  const [dias, setDias] = useState(1);
  const [desde, setDesde] = useState(arranque);
  const [otroDia, setOtroDia] = useState(false);
  const [medio, setMedio] = useState<Medio>("efectivo");
  // Parte en efectivo y parte por transferencia: se escribe la transferencia, el efectivo es el resto.
  const [mixto, setMixto] = useState(false);
  const [montoTransferencia, setMontoTransferencia] = useState("");
  const [titular, setTitular] = useState("");
  const [comprobante, setComprobante] = useState<File | null>(null);
  // La foto del comprobante se está achicando: hasta que termine no se cobra (si no, el cobro
  // saldría sin la foto y la foto se perdería sin aviso).
  const [preparandoFoto, setPreparandoFoto] = useState(false);
  const [errorTitular, setErrorTitular] = useState<string | undefined>();
  const [errorComprobante, setErrorComprobante] = useState<string | undefined>();
  const [errorMonto, setErrorMonto] = useState<string | undefined>();
  const [errorRpc, setErrorRpc] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoCobroDiario | null>(null);
  const [isPending, startTransition] = useTransition();
  const [refrescando, startRefresh] = useTransition();
  const loteRef = useRef<string | null>(null);

  const precio = Number(precioDia ?? 0);
  const hasta = sumarDias(desde, dias - 1);
  const total = Math.round(dias * precio * 100) / 100;
  const parteTransferencia = mixto ? redondear2(parseMonto(montoTransferencia)) : 0;
  const parteEfectivo = mixto ? redondear2(total - parteTransferencia) : 0;
  const pideTransferencia = mixto || medio === "transferencia";

  // Días ya pagados (de los rangos vigentes) y los elegidos.
  const diasPagados = useMemo(() => {
    const set = new Set<string>();
    for (const p of pagados) {
      const n = Math.min(diasEntre(p.desde, p.hasta), 400);
      for (let i = 0; i <= n; i++) set.add(sumarDias(p.desde, i));
    }
    return set;
  }, [pagados]);
  const elegidos = useMemo(() => {
    const lista: string[] = [];
    for (let i = 0; i < dias; i++) lista.push(sumarDias(desde, i));
    return lista;
  }, [desde, dias]);
  const choques = elegidos.filter((d) => diasPagados.has(d));

  // Tira de días: de anteayer a dos semanas, estirada si la elección cae afuera.
  const tira = useMemo(() => {
    const inicio = [sumarDias(hoy, -2), desde].sort()[0];
    const fin = [sumarDias(hoy, 11), hasta].sort()[1];
    const n = Math.min(diasEntre(inicio, fin), 40);
    return Array.from({ length: n + 1 }, (_, i) => sumarDias(inicio, i));
  }, [hoy, desde, hasta]);

  const fueraDeRango = diasEntre(hoy, desde) < -30 || diasEntre(hoy, desde) > 31;
  const sinPrecio = !(precio > 0);
  const hoyPagado = diasPagados.has(hoy);

  // Cobro mixto: la transferencia tiene que ser más que cero y no pasarse del total.
  const problemaMixto = !mixto
    ? null
    : !(parteTransferencia > 0)
      ? "Poné cuánto paga por transferencia"
      : parteTransferencia > total
        ? `La transferencia no puede ser más que el total (${formatARS(total)})`
        : null;

  function elegirDias(n: number) {
    setDias(Math.min(31, Math.max(1, n)));
    setErrorRpc(null);
  }
  function elegirDesde(iso: string) {
    setDesde(iso);
    setErrorRpc(null);
  }

  /** Líneas del cobro (suman exacto el total, como exige cobrar_diario). */
  function armarLineas(): InputCobroDiario["lineas"] {
    const transferencia = (monto: number, id: string) => ({
      id,
      medio: "transferencia" as const,
      monto,
      transferencia: { titular: titular.trim() },
    });
    if (!mixto) {
      return [
        medio === "transferencia"
          ? transferencia(total, "l1")
          : { id: "l1", medio: "efectivo" as const, monto: total },
      ];
    }
    // Todo por transferencia: una sola línea (no se manda un efectivo de $ 0).
    if (!(parteEfectivo > 0)) return [transferencia(total, "l2")];
    return [
      { id: "l1", medio: "efectivo" as const, monto: parteEfectivo },
      transferencia(parteTransferencia, "l2"),
    ];
  }

  function registrar() {
    if (isPending || cajaCerrada || preparandoFoto) return;
    setErrorRpc(null);
    if (problemaMixto) {
      setErrorMonto(problemaMixto);
      document.getElementById("monto-transferencia-amb")?.focus();
      return;
    }
    if (pideTransferencia && !titular.trim()) {
      setErrorTitular("Poné a nombre de quién está la cuenta que transfirió");
      return;
    }
    if (pideTransferencia && comprobante && comprobante.size > MAX_COMPROBANTE) {
      setErrorComprobante(MENSAJE_COMPROBANTE_PESADO);
      return;
    }
    const lineas = armarLineas();
    // Idempotencia: el MISMO lote hasta que el cobro termine bien (un corte de red no lo renueva).
    loteRef.current ??= uuidV4();
    const datos: InputCobroDiario = {
      clienteId,
      loteId: loteRef.current,
      dias,
      desde,
      lineas,
    };
    const fd = new FormData();
    fd.set("datos", JSON.stringify(datos));
    const lineaTransferencia = lineas.find((l) => l.medio === "transferencia");
    if (lineaTransferencia && comprobante) {
      fd.set(`comprobante:${lineaTransferencia.id}`, comprobante, comprobante.name);
    }

    startTransition(async () => {
      const res = await llamarAccion(() => cobrarDiario(fd));
      if (!res.ok) {
        // Se conserva todo lo cargado y el mismo lote: tocar de nuevo no cobra dos veces.
        setErrorRpc(res.error);
        return;
      }
      if (res.data.repetido) {
        toast.info(`Ese cobro ya estaba registrado (Recibo N° ${res.data.numero})`);
      } else {
        toast.success(`Cobrado: ${clienteNombre} pagó hasta el ${diaCorto(res.data.hasta || hasta)}`);
      }
      setResultado(res.data);
    });
  }

  /** "Cobrar otra vez a …": formulario limpio desde el día siguiente a lo que pagó. */
  function cobrarOtraVez(r: ResultadoCobroDiario) {
    const siguiente = sumarDias(r.hasta || hasta, 1);
    loteRef.current = null;
    setResultado(null);
    setDias(1);
    setDesde(siguiente);
    setOtroDia(false);
    setMedio("efectivo");
    setMixto(false);
    setMontoTransferencia("");
    setTitular("");
    setComprobante(null);
    setErrorTitular(undefined);
    setErrorComprobante(undefined);
    setErrorMonto(undefined);
    setErrorRpc(null);
    startRefresh(() => router.refresh());
  }

  // ---------- trayendo los días pagados después de "Cobrar otra vez" ----------
  if (refrescando) {
    return (
      <section className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border bg-card p-6 text-center">
        <Spinner className="size-8 text-primary" />
        <p className="font-medium">Trayendo los días que pagó {clienteNombre}…</p>
      </section>
    );
  }

  // ---------- éxito ----------
  if (resultado) {
    return (
      <ReciboRegistrado
        resultado={resultado}
        destacado={<>Pagó hasta el {diaCorto(resultado.hasta || hasta)}</>}
      >
        <Button asChild size="lg" className="h-14 w-full text-lg font-semibold">
          <Link href={`/recibos/${resultado.pago_id}`}>
            <FileText className="size-5" strokeWidth={2} />
            Ver recibo
          </Link>
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="h-auto min-h-12 w-full py-2 text-base font-semibold whitespace-normal"
          onClick={() => cobrarOtraVez(resultado)}
        >
          <Repeat className="size-5" strokeWidth={2} />
          Cobrar otra vez a {clienteNombre}
        </Button>
        <Button asChild size="lg" variant="ghost" className="h-12 w-full text-base">
          <Link href={volverA}>
            <Footprints className="size-5" strokeWidth={2} />
            Cobrar a otro ambulante
          </Link>
        </Button>
      </ReciboRegistrado>
    );
  }

  const estadoPago =
    pagoHasta && pagoHasta >= hoy
      ? `Pagó hasta el ${diaCorto(pagoHasta)}`
      : pagoHasta
        ? `Último día pago: ${diaCorto(pagoHasta)}`
        : "Todavía no pagó nunca";

  const bloqueado =
    isPending || cajaCerrada || sinPrecio || choques.length > 0 || fueraDeRango || preparandoFoto;
  // Se ve en vivo si se pasa del total; si falta el monto, recién al tocar "Cobrar".
  const mensajeMonto = errorMonto ?? (parteTransferencia > total ? problemaMixto : null);

  return (
    <section className="space-y-6 rounded-lg border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Cobro por día</p>
          <p className="text-2xl font-bold">
            {sinPrecio ? "Sin precio" : <Money monto={precio} />}{" "}
            <span className="text-base font-medium text-muted-foreground">por día</span>
          </p>
        </div>
        <p
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-semibold",
            pagoHasta && pagoHasta >= hoy ? "bg-pagado-suave text-pagado" : "bg-muted text-muted-foreground"
          )}
        >
          {estadoPago}
        </p>
      </div>

      {sinPrecio ? (
        <Alert className="border-pendiente/40 bg-pendiente-suave px-4 py-3 text-pendiente">
          <AlertCircle className="size-5" strokeWidth={2} />
          <AlertTitle className="text-base font-semibold">Falta el precio por día</AlertTitle>
          <AlertDescription className="text-[15px] leading-relaxed text-pendiente">
            Falta configurar el precio por día de los ambulantes (concepto AMB). Pedile al Líder de
            Procesos que lo cargue.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-3">
        <Label className="text-base font-medium">¿Cuántos días paga?</Label>
        <div className="flex items-center justify-center gap-4">
          <Button
            type="button"
            variant="outline"
            className="size-14 rounded-full"
            onClick={() => elegirDias(dias - 1)}
            disabled={dias <= 1}
            aria-label="Un día menos"
          >
            <Minus className="size-6" strokeWidth={2.2} />
          </Button>
          <p className="min-w-28 text-center" aria-live="polite">
            <span className="font-display text-3xl font-bold tabular">{dias}</span>{" "}
            <span className="text-lg text-muted-foreground">{dias === 1 ? "día" : "días"}</span>
          </p>
          <Button
            type="button"
            variant="outline"
            className="size-14 rounded-full"
            onClick={() => elegirDias(dias + 1)}
            disabled={dias >= 31}
            aria-label="Un día más"
          >
            <Plus className="size-6" strokeWidth={2.2} />
          </Button>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {ATAJOS.map((a) => {
            const label = a.dias === 1 && hoyPagado ? "1 día" : a.label;
            return (
              <Chip
                key={a.dias}
                activo={dias === a.dias}
                onClick={() => {
                  elegirDias(a.dias);
                  if (a.dias === 1 && !hoyPagado) elegirDesde(hoy);
                }}
              >
                {label}
              </Chip>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label className="text-base font-medium">
            {dias === 1 ? `Paga el ${diaCorto(desde)}` : `Paga del ${diaCorto(desde)} al ${diaCorto(hasta)}`}
          </Label>
          <Button
            type="button"
            variant="ghost"
            className="h-11 px-3 text-sm font-semibold text-primary"
            onClick={() => setOtroDia((v) => !v)}
          >
            <CalendarDays className="size-4" strokeWidth={2} />
            Empieza otro día
          </Button>
        </div>
        {otroDia ? (
          <Input
            type="date"
            value={desde}
            min={sumarDias(hoy, -30)}
            max={sumarDias(hoy, 31)}
            onChange={(e) => e.target.value && elegirDesde(e.target.value)}
            aria-label="Día en que empieza"
            className="h-12 w-auto min-w-44 text-base md:text-base"
          />
        ) : null}
        <div className="-mx-1 overflow-x-auto pb-1">
          <ol className="flex min-w-max gap-1.5 px-1" aria-label="Días">
            {tira.map((d) => {
              const pagado = diasPagados.has(d);
              const elegido = elegidos.includes(d);
              const esHoy = d === hoy;
              return (
                <li key={d}>
                  <button
                    type="button"
                    disabled={pagado && !elegido}
                    onClick={() => elegirDesde(d)}
                    aria-pressed={elegido}
                    aria-label={`${diaCorto(d)}${pagado ? ", ya pagado" : ""}${esHoy ? ", hoy" : ""}`}
                    className={cn(
                      "flex h-16 w-12 flex-col items-center justify-center rounded-lg border-2 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                      elegido && pagado && "border-pendiente bg-pendiente-suave text-pendiente",
                      elegido && !pagado && "border-primary bg-primary text-primary-foreground",
                      !elegido && pagado && "border-transparent bg-pagado-suave text-pagado",
                      !elegido && !pagado && "border-border bg-card text-foreground hover:bg-muted/50",
                      esHoy && !elegido && !pagado && "border-primary/50"
                    )}
                  >
                    <span>{esHoy ? "Hoy" : diaSemanaCorto(d)}</span>
                    <span className="text-base font-bold tabular">{diaMes(d).slice(0, 2)}</span>
                    {pagado && !elegido ? <Check className="size-3" strokeWidth={3} /> : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
        {choques.length > 0 ? (
          <p className="text-sm font-medium text-destructive">
            Ya pagó el {choques.map(diaMes).join(", ")}: elegí otros días o tocá un día libre para
            empezar ahí.
          </p>
        ) : fueraDeRango ? (
          <p className="text-sm font-medium text-destructive">Elegí un día cercano a hoy.</p>
        ) : (
          <p className="text-sm text-muted-foreground">Tocá un día libre para empezar ahí. En verde, lo ya pagado.</p>
        )}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg bg-muted/40 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Total</p>
          <Money monto={total} className="block text-3xl font-bold" />
        </div>
        {!sinPrecio ? (
          <p className="text-sm text-muted-foreground tabular">
            {dias} {dias === 1 ? "día" : "días"} × {formatARS(precio)}
          </p>
        ) : null}
      </div>

      {!mixto ? (
        <div className="space-y-2">
          <Label className="text-base font-medium">¿Cómo te paga?</Label>
          <SelectorMedio
            medios={["efectivo", "transferencia"]}
            valor={medio}
            onCambio={(m) => {
              setMedio(m === "transferencia" ? "transferencia" : "efectivo");
              setErrorRpc(null);
            }}
          />
        </div>
      ) : (
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-display text-lg font-bold">Parte en efectivo y parte por transferencia</p>
            <Button
              type="button"
              variant="ghost"
              className="h-11 px-3 text-sm text-muted-foreground"
              onClick={() => {
                setMixto(false);
                setMontoTransferencia("");
                setErrorMonto(undefined);
                setErrorRpc(null);
              }}
            >
              <X className="size-4" strokeWidth={2} />
              Quitar
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="monto-transferencia-amb" className="text-base font-medium">
              ¿Cuánto paga por transferencia?
            </Label>
            <Input
              id="monto-transferencia-amb"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={montoTransferencia}
              onChange={(e) => {
                setMontoTransferencia(sanitizarMonto(e.target.value));
                setErrorMonto(undefined);
                setErrorRpc(null);
              }}
              // Al salir del campo queda con sus puntos de miles ("12.000"), como en el cobro común.
              onBlur={() => setMontoTransferencia((v) => (v ? montoConMiles(parseMonto(v)) : v))}
              aria-invalid={Boolean(mensajeMonto)}
              className="h-12 text-xl font-semibold tabular md:text-xl"
            />
            {mensajeMonto ? (
              <p className="text-sm font-medium text-destructive">{mensajeMonto}</p>
            ) : (
              <p className="text-sm text-muted-foreground">El resto lo paga en efectivo.</p>
            )}
          </div>
          <dl className="grid gap-2 text-base sm:grid-cols-2">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 rounded-md bg-muted/40 px-3 py-2">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <Banknote className="size-4 shrink-0" strokeWidth={2} />
                En efectivo (el resto)
              </dt>
              <dd>
                <Money monto={Math.max(parteEfectivo, 0)} className="font-semibold" />
              </dd>
            </div>
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 rounded-md bg-muted/40 px-3 py-2">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <Landmark className="size-4 shrink-0" strokeWidth={2} />
                Por transferencia
              </dt>
              <dd>
                <Money monto={parteTransferencia} className="font-semibold" />
              </dd>
            </div>
          </dl>
        </div>
      )}

      {pideTransferencia ? (
        <div className="rounded-lg border p-4">
          <DatosTransferencia
            titular={titular}
            comprobante={comprobante}
            sugerenciaTitular={clienteNombre}
            errorTitular={errorTitular}
            errorComprobante={errorComprobante}
            onTitular={(v) => {
              setTitular(v);
              setErrorTitular(undefined);
            }}
            onComprobante={setComprobante}
            onErrorComprobante={setErrorComprobante}
            onPreparando={setPreparandoFoto}
          />
        </div>
      ) : null}

      {!mixto && !sinPrecio ? (
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full border-dashed text-base font-semibold text-primary"
          onClick={() => {
            setMixto(true);
            setErrorRpc(null);
          }}
        >
          <Plus className="size-5" strokeWidth={2} />
          Pagar una parte con otro medio
        </Button>
      ) : null}

      {errorRpc ? (
        <AlertaError error={errorRpc} titulo="No se pudo cobrar">
          {esErrorDeCajaCerrada(errorRpc) ? (
            <Button asChild variant="outline" className="h-11 bg-card px-4 text-sm font-semibold text-foreground">
              <Link href={irACaja}>
                Ir a Caja
                <ArrowRight className="size-4" strokeWidth={2} />
              </Link>
            </Button>
          ) : null}
        </AlertaError>
      ) : null}

      {cajaCerrada ? (
        <p className="flex items-start gap-2 text-sm font-medium text-parcial">
          <Lock className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          No se puede cobrar: la caja de hoy no está abierta (mirá el aviso de arriba).
        </p>
      ) : null}

      <Button
        type="button"
        size="lg"
        onClick={registrar}
        disabled={bloqueado}
        className="h-auto min-h-14 w-full py-3 text-lg font-semibold whitespace-normal"
      >
        {isPending ? (
          <>
            <Spinner className="size-6" />
            Cobrando…
          </>
        ) : preparandoFoto ? (
          <>
            <Spinner className="size-6" />
            Esperá, preparando la foto…
          </>
        ) : (
          `Cobrar ${dias} ${dias === 1 ? "día" : "días"} — ${formatARS(total)}`
        )}
      </Button>
    </section>
  );
}
