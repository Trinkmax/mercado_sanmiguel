"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Banknote,
  Check,
  FileText,
  Landmark,
  Plus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatARS, hoyISO, labelPeriodo } from "@/lib/format";
import {
  registrarCobro,
  type ResultadoCobro,
} from "@/lib/actions/cobranza";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Codigo } from "@/components/shared/codigo";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";

type MedioPago = "efectivo" | "transferencia" | "cheque";

const MEDIOS: { valor: MedioPago; label: string; Icono: typeof Banknote }[] = [
  { valor: "efectivo", label: "Efectivo", Icono: Banknote },
  { valor: "transferencia", label: "Transferencia", Icono: Landmark },
  { valor: "cheque", label: "Cheque", Icono: FileText },
];

type Errores = {
  monto?: string;
  chequeNumero?: string;
  chequeTitular?: string;
};

/** "12345,5" → 12345.5 (coma como separador decimal, es-AR). */
function parseMonto(texto: string): number {
  if (!texto) return 0;
  return Number(texto.replace(",", "."));
}

/** Deja solo dígitos y una única coma decimal. */
function sanitizarMonto(texto: string): string {
  const limpio = texto.replace(/[^\d,]/g, "");
  const [entero, ...resto] = limpio.split(",");
  return resto.length > 0 ? `${entero},${resto.join("").slice(0, 2)}` : entero;
}

/** Número → texto del input (coma decimal). */
function montoATexto(n: number): string {
  return String(n).replace(".", ",");
}

export function FormCobro({
  clienteId,
  deudaTotal,
  cuotasMes,
  totalPeriodoActual,
}: {
  clienteId: string;
  deudaTotal: number;
  cuotasMes: number;
  totalPeriodoActual: number;
}) {
  const [monto, setMonto] = useState("");
  const [medio, setMedio] = useState<MedioPago>("efectivo");
  const [chequeNumero, setChequeNumero] = useState("");
  const [chequeBanco, setChequeBanco] = useState("");
  const [chequeTitular, setChequeTitular] = useState("");
  const [esTercero, setEsTercero] = useState(false);
  const [fechaCobro, setFechaCobro] = useState(hoyISO());
  const [notas, setNotas] = useState("");
  const [mostrarNotas, setMostrarNotas] = useState(false);
  const [errores, setErrores] = useState<Errores>({});
  const [errorRpc, setErrorRpc] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoCobro | null>(null);
  const [isPending, startTransition] = useTransition();

  const montoNumero = parseMonto(monto);
  const superaDeuda = montoNumero > deudaTotal;
  // Cuota fija: total del período / N, topeada por lo que realmente debe.
  const cuotaSugerida =
    cuotasMes > 1 && totalPeriodoActual > 0
      ? Math.min(Math.round(totalPeriodoActual / cuotasMes), deudaTotal)
      : 0;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorRpc(null);

    const nuevos: Errores = {};
    if (!(montoNumero > 0)) nuevos.monto = "Poné cuánto te pagan";
    if (medio === "cheque") {
      if (!chequeNumero.trim())
        nuevos.chequeNumero = "Poné el número del cheque";
      if (!chequeTitular.trim())
        nuevos.chequeTitular = "Poné a nombre de quién está el cheque";
    }
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    startTransition(async () => {
      const res = await registrarCobro({
        clienteId,
        monto: montoNumero,
        medio,
        cheque:
          medio === "cheque"
            ? {
                numero: chequeNumero.trim(),
                banco: chequeBanco.trim() || undefined,
                titular: chequeTitular.trim(),
                es_tercero: esTercero,
                fecha_cobro: fechaCobro,
              }
            : undefined,
        notas: notas.trim() || undefined,
      });
      if (!res.ok) {
        setErrorRpc(res.error);
        return;
      }
      toast.success(`Cobro registrado — Recibo N° ${res.data.numero}`);
      setResultado(res.data);
    });
  }

  // ---------- Éxito: la confirmación reemplaza al formulario ----------
  if (resultado) {
    return (
      <section className="space-y-6 rounded-lg border bg-card p-5 sm:p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Sello
            grande
            estado="pagado"
            texto="Cobro registrado"
            className="animar-estampado"
          />
          <p className="text-lg">
            Recibo{" "}
            <span className="font-display text-xl font-bold">
              N° {resultado.numero}
            </span>
          </p>
        </div>

        <div className="divide-y rounded-md border">
          {resultado.imputaciones.map((imp) => (
            <div key={imp.cargo_id} className="flex items-center gap-3 px-4 py-3">
              <Codigo codigo={imp.codigo} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{imp.descripcion}</p>
                <p className="text-sm text-muted-foreground">
                  {labelPeriodo(imp.periodo)}
                </p>
              </div>
              {imp.saldado ? (
                <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-pagado">
                  <Check className="size-4" strokeWidth={2.2} />
                  Saldado
                </span>
              ) : null}
              <Money monto={imp.monto} className="shrink-0 font-semibold" />
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <Button asChild size="lg" className="h-14 w-full text-lg font-semibold">
            <Link href={`/recibos/${resultado.pago_id}`}>
              <FileText className="size-5" strokeWidth={2} />
              Ver recibo
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-12 w-full text-base"
          >
            <Link href="/cobranza">
              <Users className="size-5" strokeWidth={2} />
              Cobrar a otro cliente
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  // ---------- Formulario de cobro ----------
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {cuotaSugerida > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-parcial bg-parcial-suave px-4 py-3">
          <p className="text-sm">
            Paga en <strong>{cuotasMes} veces</strong> — cuota sugerida ≈{" "}
            <strong className="tabular">{formatARS(cuotaSugerida)}</strong>
          </p>
          <Button
            type="button"
            variant="outline"
            className="h-11 shrink-0 bg-card px-4 text-sm font-semibold"
            onClick={() => {
              setMonto(montoATexto(cuotaSugerida));
              setErrores((prev) => ({ ...prev, monto: undefined }));
            }}
          >
            Usar
          </Button>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="monto" className="text-base font-medium">
          ¿Cuánto te pagan?
        </Label>
        <div className="flex gap-2">
          <Input
            id="monto"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={monto}
            onChange={(e) => {
              setMonto(sanitizarMonto(e.target.value));
              setErrores((prev) => ({ ...prev, monto: undefined }));
            }}
            aria-invalid={Boolean(errores.monto) || superaDeuda}
            className="h-14 flex-1 text-2xl font-semibold tabular"
          />
          <Button
            type="button"
            variant="outline"
            className="h-14 shrink-0 px-4 text-sm font-semibold"
            onClick={() => {
              setMonto(montoATexto(deudaTotal));
              setErrores((prev) => ({ ...prev, monto: undefined }));
            }}
          >
            Cobrar todo
          </Button>
        </div>
        {errores.monto ? (
          <p className="text-sm font-medium text-destructive">{errores.monto}</p>
        ) : superaDeuda ? (
          <p className="text-sm font-medium text-destructive">
            Supera la deuda de {formatARS(deudaTotal)}. Cobrá hasta el total
            adeudado.
          </p>
        ) : montoNumero > 0 ? (
          <p className="text-sm text-muted-foreground tabular">
            Vas a cobrar {formatARS(montoNumero)}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label className="text-base font-medium">¿Cómo te pagan?</Label>
        <div role="radiogroup" aria-label="Medio de pago" className="grid grid-cols-3 gap-2">
          {MEDIOS.map(({ valor, label, Icono }) => (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={medio === valor}
              onClick={() => setMedio(valor)}
              className={cn(
                "flex h-14 flex-col items-center justify-center gap-1 rounded-lg border-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                medio === valor
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/50"
              )}
            >
              <Icono className="size-5" strokeWidth={2} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {medio === "cheque" ? (
        <div className="space-y-5 rounded-lg border bg-card p-4">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cheque-numero" className="text-base font-medium">
                Número del cheque
              </Label>
              <Input
                id="cheque-numero"
                inputMode="numeric"
                autoComplete="off"
                value={chequeNumero}
                onChange={(e) => {
                  setChequeNumero(e.target.value);
                  setErrores((prev) => ({ ...prev, chequeNumero: undefined }));
                }}
                aria-invalid={Boolean(errores.chequeNumero)}
                className="h-12 text-base md:text-base"
              />
              {errores.chequeNumero ? (
                <p className="text-sm font-medium text-destructive">
                  {errores.chequeNumero}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cheque-banco" className="text-base font-medium">
                Banco
              </Label>
              <Input
                id="cheque-banco"
                autoComplete="off"
                value={chequeBanco}
                onChange={(e) => setChequeBanco(e.target.value)}
                className="h-12 text-base md:text-base"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cheque-titular" className="text-base font-medium">
              A nombre de quién
            </Label>
            <Input
              id="cheque-titular"
              autoComplete="off"
              value={chequeTitular}
              onChange={(e) => {
                setChequeTitular(e.target.value);
                setErrores((prev) => ({ ...prev, chequeTitular: undefined }));
              }}
              aria-invalid={Boolean(errores.chequeTitular)}
              className="h-12 text-base md:text-base"
            />
            {errores.chequeTitular ? (
              <p className="text-sm font-medium text-destructive">
                {errores.chequeTitular}
              </p>
            ) : null}
          </div>

          <div className="flex min-h-11 items-center justify-between gap-3">
            <Label htmlFor="cheque-tercero" className="text-base font-medium">
              Es cheque de tercero
            </Label>
            <Switch
              id="cheque-tercero"
              checked={esTercero}
              onCheckedChange={setEsTercero}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cheque-fecha" className="text-base font-medium">
              Fecha en que se puede cobrar
            </Label>
            <Input
              id="cheque-fecha"
              type="date"
              value={fechaCobro}
              onChange={(e) => setFechaCobro(e.target.value)}
              className="h-12 text-base md:text-base"
            />
          </div>
        </div>
      ) : null}

      {mostrarNotas ? (
        <div className="space-y-2">
          <Label htmlFor="notas" className="text-base font-medium">
            Nota
          </Label>
          <Textarea
            id="notas"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Algo para acordarse de este cobro…"
            className="min-h-20 text-base md:text-base"
          />
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          className="h-11 px-3 text-sm text-muted-foreground"
          onClick={() => setMostrarNotas(true)}
        >
          <Plus className="size-4" strokeWidth={2} />
          Agregar nota
        </Button>
      )}

      {errorRpc ? (
        <Alert variant="destructive">
          <AlertCircle strokeWidth={2} />
          <AlertTitle>No se pudo registrar el cobro</AlertTitle>
          <AlertDescription>{errorRpc}</AlertDescription>
        </Alert>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={isPending || montoNumero <= 0 || superaDeuda}
        className="h-13 w-full text-lg font-semibold"
      >
        {isPending ? (
          <>
            <Spinner className="size-6" />
            Registrando…
          </>
        ) : (
          <>Registrar cobro{montoNumero > 0 ? ` de ${formatARS(montoNumero)}` : ""}</>
        )}
      </Button>
    </form>
  );
}
