"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import Link from "next/link";
import {
  AlertCircle,
  Banknote,
  Camera,
  Check,
  FileText,
  Landmark,
  PiggyBank,
  Plus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatARS, hoyISO, labelPeriodo } from "@/lib/format";
import {
  registrarCobro,
  type InputCobro,
  type ResultadoCobro,
} from "@/lib/actions/cobranza";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Codigo } from "@/components/shared/codigo";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { BotonAplicarSaldoFavor } from "@/components/cobranza/aplicar-saldo-favor";

type MedioPago = "efectivo" | "transferencia" | "cheque";

const MEDIOS: { valor: MedioPago; label: string; Icono: typeof Banknote }[] = [
  { valor: "efectivo", label: "Efectivo", Icono: Banknote },
  { valor: "transferencia", label: "Transferencia", Icono: Landmark },
  { valor: "cheque", label: "Cheque", Icono: FileText },
];

const ACCEPT_COMPROBANTE = "image/*,application/pdf";
const MAX_COMPROBANTE = 20 * 1024 * 1024;

type Errores = {
  monto?: string;
  chequeNumero?: string;
  chequeTitular?: string;
  titularTransferencia?: string;
  comprobante?: string;
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

function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function FormCobro({
  clienteId,
  deudaTotal,
  deudaBruta = deudaTotal,
  cuotasMes,
  totalPeriodoActual,
  saldoFavorPrevio = 0,
}: {
  clienteId: string;
  /** Lo que tiene que pagar hoy (ya neto del saldo a favor que tuviera). */
  deudaTotal: number;
  /** Deuda exigible hoy ANTES de descontar el saldo a favor. */
  deudaBruta?: number;
  cuotasMes: number;
  totalPeriodoActual: number;
  /** Crédito que ya tenía el cliente antes de este cobro (se aplica solo). */
  saldoFavorPrevio?: number;
}) {
  const [monto, setMonto] = useState("");
  const [medio, setMedio] = useState<MedioPago>("efectivo");
  const [chequeNumero, setChequeNumero] = useState("");
  const [chequeBanco, setChequeBanco] = useState("");
  const [chequeTitular, setChequeTitular] = useState("");
  const [esTercero, setEsTercero] = useState(false);
  const [fechaCobro, setFechaCobro] = useState(hoyISO());
  const [titularTransferencia, setTitularTransferencia] = useState("");
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [notas, setNotas] = useState("");
  const [mostrarNotas, setMostrarNotas] = useState(false);
  const [errores, setErrores] = useState<Errores>({});
  const [errorRpc, setErrorRpc] = useState<string | null>(null);
  const [confirmarSaldo, setConfirmarSaldo] = useState(false);
  // Cliente al día que quiere adelantar plata: el cobro entero queda como saldo a favor.
  const [modoAdelanto, setModoAdelanto] = useState(false);
  const [resultado, setResultado] = useState<ResultadoCobro | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  const montoNumero = parseMonto(monto);
  const sobrante =
    montoNumero > deudaTotal ? redondear2(montoNumero - deudaTotal) : 0;
  // Cuota fija: total del período / N, topeada por lo que realmente debe.
  const cuotaSugerida =
    cuotasMes > 1 && totalPeriodoActual > 0
      ? Math.min(Math.round(totalPeriodoActual / cuotasMes), deudaTotal)
      : 0;

  // Vista previa de la foto del comprobante: un object URL por archivo, que se
  // libera al reemplazarlo, quitarlo o desmontar el formulario.
  const previewRef = useRef<string | null>(null);
  function actualizarPreview(archivo: File | null) {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    const url =
      archivo && archivo.type.startsWith("image/")
        ? URL.createObjectURL(archivo)
        : null;
    previewRef.current = url;
    setPreviewUrl(url);
  }
  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  function elegirComprobante(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0] ?? null;
    if (!archivo) return;
    if (archivo.size > MAX_COMPROBANTE) {
      setErrores((prev) => ({
        ...prev,
        comprobante: "La foto pesa más de 20 MB. Sacala de nuevo con menos calidad.",
      }));
      e.target.value = "";
      return;
    }
    setErrores((prev) => ({ ...prev, comprobante: undefined }));
    setComprobante(archivo);
    actualizarPreview(archivo);
  }

  function quitarComprobante() {
    setComprobante(null);
    actualizarPreview(null);
    if (inputArchivoRef.current) inputArchivoRef.current.value = "";
  }

  function validar(): boolean {
    const nuevos: Errores = {};
    if (!(montoNumero > 0)) nuevos.monto = "Poné cuánto te pagan";
    if (medio === "cheque") {
      if (!chequeNumero.trim())
        nuevos.chequeNumero = "Poné el número del cheque";
      if (!chequeTitular.trim())
        nuevos.chequeTitular = "Poné a nombre de quién está el cheque";
    }
    if (medio === "transferencia" && !titularTransferencia.trim()) {
      nuevos.titularTransferencia =
        "Poné a nombre de quién está la cuenta que transfirió";
    }
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  }

  function enviar(permitirSaldoFavor: boolean) {
    setErrorRpc(null);
    const datos: InputCobro = {
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
      transferencia:
        medio === "transferencia"
          ? { titular: titularTransferencia.trim() }
          : undefined,
      notas: notas.trim() || undefined,
      permitirSaldoFavor,
    };
    const fd = new FormData();
    fd.set("datos", JSON.stringify(datos));
    if (medio === "transferencia" && comprobante) {
      fd.set("comprobante", comprobante, comprobante.name);
    }

    startTransition(async () => {
      const res = await registrarCobro(fd);
      if (!res.ok) {
        setErrorRpc(res.error);
        return;
      }
      toast.success(`Cobro registrado — Recibo N° ${res.data.numero}`);
      setResultado(res.data);
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorRpc(null);
    if (!validar()) return;
    if (sobrante > 0) {
      // Plata de más: se confirma explícitamente antes de dejarla a favor.
      setConfirmarSaldo(true);
      return;
    }
    enviar(false);
  }

  // La RPC avisa si sobra plata y no se autorizó el saldo a favor (por ejemplo,
  // si la deuda cambió mientras se cargaba el cobro): se ofrece confirmar.
  const errorPideSaldoFavor = Boolean(errorRpc && /saldo a favor/i.test(errorRpc));

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

        {resultado.imputaciones.length > 0 ? (
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
        ) : null}

        {resultado.saldo_favor > 0 ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-pagado/40 bg-pagado-suave px-4 py-3">
            <Sello estado="saldo_favor" />
            <p className="min-w-0 flex-1 text-sm">
              Quedan{" "}
              <Money
                monto={resultado.saldo_favor}
                className="font-semibold text-foreground"
              />{" "}
              a favor del cliente. Se aplican solos al mes que viene.
            </p>
          </div>
        ) : null}

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

  // ---------- Sin nada que cobrar (o el saldo a favor cubre todo) ----------
  // Se resuelve acá y no en la página para que este componente quede montado
  // siempre en el mismo lugar: cuando la server action revalida y la página se
  // re-renderiza con deuda 0, la confirmación de arriba sigue en pantalla.
  if (deudaTotal <= 0 && !modoAdelanto) {
    const cubreConSaldo = deudaBruta > 0 && saldoFavorPrevio > 0;
    return (
      <section className="space-y-4 rounded-lg border bg-card p-6 text-center">
        {cubreConSaldo ? (
          <>
            <p className="text-muted-foreground">
              El saldo a favor cubre toda la deuda: no hace falta cobrar nada.
            </p>
            <BotonAplicarSaldoFavor
              clienteId={clienteId}
              saldoFavor={saldoFavorPrevio}
            />
          </>
        ) : (
          <p className="text-muted-foreground">No tiene nada para pagar hoy.</p>
        )}
        <Button
          asChild
          size="lg"
          variant={cubreConSaldo ? "outline" : "default"}
          className="h-12 w-full text-base font-semibold"
        >
          <Link href="/cobranza">
            <Users className="size-5" strokeWidth={2} />
            Cobrar a otro cliente
          </Link>
        </Button>
        {!cubreConSaldo ? (
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full text-sm text-muted-foreground"
            onClick={() => setModoAdelanto(true)}
          >
            Quiere adelantar plata: registrar un pago a cuenta (queda como saldo a favor)
          </Button>
        ) : null}
      </section>
    );
  }

  // ---------- Formulario de cobro ----------
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {saldoFavorPrevio > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-pagado/40 bg-pagado-suave px-4 py-3">
          <Sello estado="saldo_favor" />
          <p className="min-w-0 flex-1 text-sm">
            Ya tiene{" "}
            <Money monto={saldoFavorPrevio} className="font-semibold" /> a favor:
            se aplican solos en este cobro. Hoy tiene que pagar{" "}
            <Money monto={deudaTotal} className="font-semibold" />.
          </p>
        </div>
      ) : null}

      {cuotaSugerida > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-parcial bg-parcial-suave px-4 py-3">
          <p className="text-sm">
            Paga en <strong>{cuotasMes} veces</strong>{" "}
            <span className="text-muted-foreground">
              (frecuencia configurada en su ficha)
            </span>{" "}
            — cuota sugerida ≈{" "}
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
            aria-invalid={Boolean(errores.monto)}
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
        ) : montoNumero > 0 ? (
          <p className="text-sm text-muted-foreground tabular">
            Vas a cobrar {formatARS(montoNumero)}
          </p>
        ) : null}
        {sobrante > 0 ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-parcial bg-parcial-suave px-4 py-3 text-sm">
            <PiggyBank
              className="mt-0.5 size-5 shrink-0 text-parcial"
              strokeWidth={2}
            />
            <p>
              Sobran <strong className="tabular">{formatARS(sobrante)}</strong>.
              Quedan como saldo a favor del cliente y se aplican solos al mes
              que viene.
            </p>
          </div>
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

      {medio === "transferencia" ? (
        <div className="space-y-5 rounded-lg border bg-card p-4">
          <div className="space-y-2">
            <Label htmlFor="transferencia-titular" className="text-base font-medium">
              A nombre de quién está la cuenta
            </Label>
            <Input
              id="transferencia-titular"
              autoComplete="off"
              placeholder="Ej.: Juan Pérez"
              value={titularTransferencia}
              onChange={(e) => {
                setTitularTransferencia(e.target.value);
                setErrores((prev) => ({ ...prev, titularTransferencia: undefined }));
              }}
              aria-invalid={Boolean(errores.titularTransferencia)}
              className="h-12 text-base md:text-base"
            />
            {errores.titularTransferencia ? (
              <p className="text-sm font-medium text-destructive">
                {errores.titularTransferencia}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="comprobante" className="text-base font-medium">
              Foto del comprobante{" "}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <input
              ref={inputArchivoRef}
              id="comprobante"
              type="file"
              accept={ACCEPT_COMPROBANTE}
              capture="environment"
              className="sr-only"
              onChange={elegirComprobante}
            />
            {comprobante ? (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Vista previa del comprobante"
                    className="size-20 shrink-0 rounded-md border object-cover"
                  />
                ) : (
                  <div className="flex size-20 shrink-0 items-center justify-center rounded-md border bg-card">
                    <FileText className="size-8 text-muted-foreground" strokeWidth={1.8} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{comprobante.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Se guarda junto con el recibo.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 px-3 text-sm"
                  onClick={quitarComprobante}
                >
                  <X className="size-4" strokeWidth={2} />
                  Quitar
                </Button>
              </div>
            ) : (
              <label
                htmlFor="comprobante"
                className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 px-4 text-base font-semibold text-primary transition-colors hover:bg-primary/10"
              >
                <Camera className="size-6" strokeWidth={2} />
                Sacar foto del comprobante
              </label>
            )}
            {errores.comprobante ? (
              <p className="text-sm font-medium text-destructive">
                {errores.comprobante}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

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
          <AlertDescription>
            <p>{errorRpc}</p>
            {errorPideSaldoFavor ? (
              <Button
                type="button"
                variant="outline"
                className="mt-2 h-11 bg-card px-4 text-sm font-semibold text-foreground"
                disabled={isPending}
                onClick={() => enviar(true)}
              >
                <PiggyBank className="size-4" strokeWidth={2} />
                Dejar el sobrante como saldo a favor y registrar
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={isPending || montoNumero <= 0}
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

      {/* Confirmación corta: plata de más que queda a favor del cliente. */}
      <Dialog open={confirmarSaldo} onOpenChange={setConfirmarSaldo}>
        <DialogContent className="gap-5 p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">
              ¿Dejar {formatARS(sobrante)} como saldo a favor?
            </DialogTitle>
            <DialogDescription className="text-base">
              Hoy debe {formatARS(deudaTotal)} y te pagan {formatARS(montoNumero)}.
              Los {formatARS(sobrante)} de más quedan a favor del cliente y se
              aplican solos al mes que viene.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 px-5 text-base"
              disabled={isPending}
              onClick={() => setConfirmarSaldo(false)}
            >
              Corregir el monto
            </Button>
            <Button
              type="button"
              size="lg"
              className="h-12 px-5 text-base font-semibold"
              disabled={isPending}
              onClick={() => {
                setConfirmarSaldo(false);
                enviar(true);
              }}
            >
              <PiggyBank className="size-5" strokeWidth={2} />
              Sí, dejar a favor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
