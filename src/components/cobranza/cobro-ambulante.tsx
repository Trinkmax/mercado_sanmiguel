"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CalendarDays,
  Check,
  FileText,
  Footprints,
  Minus,
  Plus,
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
import { Chip } from "@/components/cobranza/datos-cheque";
import { DatosTransferencia } from "@/components/cobranza/datos-transferencia";
import { ReciboRegistrado } from "@/components/cobranza/recibo-registrado";
import { SelectorMedio } from "@/components/cobranza/selector-medio";
import {
  diaCorto,
  diaMes,
  diaSemanaCorto,
  diasEntre,
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
 */
export function CobroAmbulante({
  clienteId,
  clienteNombre,
  precioDia,
  pagados,
  volverA = "/cobranza",
}: {
  clienteId: string;
  clienteNombre: string;
  /** Precio del concepto AMB (null o 0 = falta configurarlo). */
  precioDia: number | null;
  /** Rangos ya pagados (cargos AMB vigentes). */
  pagados: { desde: string; hasta: string }[];
  volverA?: string;
}) {
  const hoy = hoyISO();
  const pagoHasta = pagados.reduce<string | null>((max, p) => (!max || p.hasta > max ? p.hasta : max), null);
  const arranque = pagoHasta && pagoHasta >= hoy ? sumarDias(pagoHasta, 1) : hoy;

  const [dias, setDias] = useState(1);
  const [desde, setDesde] = useState(arranque);
  const [otroDia, setOtroDia] = useState(false);
  const [medio, setMedio] = useState<Medio>("efectivo");
  const [titular, setTitular] = useState("");
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [errorTitular, setErrorTitular] = useState<string | undefined>();
  const [errorComprobante, setErrorComprobante] = useState<string | undefined>();
  const [errorRpc, setErrorRpc] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoCobroDiario | null>(null);
  const [isPending, startTransition] = useTransition();
  const loteRef = useRef<string | null>(null);

  const precio = Number(precioDia ?? 0);
  const hasta = sumarDias(desde, dias - 1);
  const total = Math.round(dias * precio * 100) / 100;

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

  function elegirDias(n: number) {
    setDias(Math.min(31, Math.max(1, n)));
    setErrorRpc(null);
  }
  function elegirDesde(iso: string) {
    setDesde(iso);
    setErrorRpc(null);
  }

  function registrar() {
    setErrorRpc(null);
    if (medio === "transferencia" && !titular.trim()) {
      setErrorTitular("Poné a nombre de quién está la cuenta que transfirió");
      return;
    }
    loteRef.current ??= uuidV4();
    const datos: InputCobroDiario = {
      clienteId,
      loteId: loteRef.current,
      dias,
      desde,
      lineas: [
        medio === "transferencia"
          ? { id: "l1", medio: "transferencia", monto: total, transferencia: { titular: titular.trim() } }
          : { id: "l1", medio: "efectivo", monto: total },
      ],
    };
    const fd = new FormData();
    fd.set("datos", JSON.stringify(datos));
    if (medio === "transferencia" && comprobante) fd.set("comprobante:l1", comprobante, comprobante.name);

    startTransition(async () => {
      const res = await llamarAccion(() => cobrarDiario(fd));
      if (!res.ok) {
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
        <Button asChild size="lg" variant="outline" className="h-12 w-full text-base font-semibold">
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
        <Alert variant="destructive">
          <AlertCircle strokeWidth={2} />
          <AlertTitle>Falta el precio por día</AlertTitle>
          <AlertDescription>
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
        <div>
          <p className="text-sm text-muted-foreground">Total</p>
          <Money monto={total} className="text-3xl font-bold" />
        </div>
        {!sinPrecio ? (
          <p className="text-sm text-muted-foreground tabular">
            {dias} {dias === 1 ? "día" : "días"} × {formatARS(precio)}
          </p>
        ) : null}
      </div>

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
      {medio === "transferencia" ? (
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
          />
        </div>
      ) : null}

      {errorRpc ? (
        <Alert variant="destructive">
          <AlertCircle strokeWidth={2} />
          <AlertTitle>No se pudo cobrar</AlertTitle>
          <AlertDescription>{errorRpc}</AlertDescription>
        </Alert>
      ) : null}

      <Button
        type="button"
        size="lg"
        onClick={registrar}
        disabled={isPending || sinPrecio || choques.length > 0 || fueraDeRango}
        className="h-auto min-h-14 w-full py-3 text-lg font-semibold whitespace-normal"
      >
        {isPending ? (
          <>
            <Spinner className="size-6" />
            Cobrando…
          </>
        ) : (
          `Cobrar ${dias} ${dias === 1 ? "día" : "días"} — ${formatARS(total)}`
        )}
      </Button>
    </section>
  );
}
