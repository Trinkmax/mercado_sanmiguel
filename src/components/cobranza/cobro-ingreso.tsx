"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PackageOpen, TriangleAlert } from "lucide-react";
import { anularIngreso, registrarIngreso, type IngresoRegistrado } from "@/lib/actions/ingresos";
import { formatARS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { AlertaError } from "@/components/cobranza/alerta-error";
import { DatosTransferencia } from "@/components/cobranza/datos-transferencia";
import { SelectorMedio } from "@/components/cobranza/selector-medio";
import {
  MAX_COMPROBANTE,
  MENSAJE_COMPROBANTE_PESADO,
  montoConMiles,
  parseMonto,
  sanitizarMonto,
  uuidV4,
} from "@/components/cobranza/tipos";
import { llamarAccion } from "@/lib/llamar-accion";

/** Segundos que queda el sello "Cobrado N° X" antes de volver al total. */
const SEGUNDOS_SELLO = 4;

export type ConceptoIngreso = { id: string; codigo: string; nombre: string };

type Medio = "efectivo" | "transferencia";

/**
 * Cobro sin cliente (0053): "Venta de vacíos y tarimas" y cualquier otro concepto de ingreso
 * que cargue el Líder. Qué se cobra (si hay más de uno) → cuánto → cómo paga → Cobrar. El
 * monto se escribe (cada venta es distinta); el detalle ("30 vacíos a Juan") es opcional.
 * Después de cobrar conserva el concepto y el medio (las ventas vienen en tandas) y limpia el
 * resto. Idempotente: el mismo intento (doble toque o corte de red) no cobra dos veces.
 */
export function CobroIngreso({
  conceptos,
  conceptoInicial,
  fechaCaja,
  bloqueo,
}: {
  /** Conceptos de ingreso ACTIVOS. */
  conceptos: ConceptoIngreso[];
  conceptoInicial?: string | null;
  /** Carga atrasada: entra en la caja de administración de este día anterior. */
  fechaCaja?: string;
  /** La caja no deja cobrar (cerrada, sin abrir…): el formulario queda bloqueado con este aviso. */
  bloqueo: { titulo: string; detalle?: string; accion?: { href: string; label: string } } | null;
}) {
  const router = useRouter();
  const [conceptoId, setConceptoId] = useState<string | null>(
    conceptos.some((c) => c.id === conceptoInicial) ? (conceptoInicial ?? null) : (conceptos[0]?.id ?? null)
  );
  const [montoTexto, setMontoTexto] = useState("");
  const [detalle, setDetalle] = useState("");
  const [medio, setMedio] = useState<Medio>("efectivo");
  const [titular, setTitular] = useState("");
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [errorComprobante, setErrorComprobante] = useState<string | undefined>();
  const [preparandoFoto, setPreparandoFoto] = useState(false);
  const [tocoCobrar, setTocoCobrar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<IngresoRegistrado | null>(null);
  const [pendiente, startTransition] = useTransition();
  const refIntento = useRef<string | null>(null);

  const concepto = conceptos.find((c) => c.id === conceptoId) ?? null;
  const monto = parseMonto(montoTexto);
  const faltaMonto = !(monto > 0);
  const faltaTitular = medio === "transferencia" && !titular.trim();
  const motivoBloqueo = bloqueo
    ? null
    : !concepto
      ? "Elegí qué se cobra."
      : faltaMonto
        ? "Poné cuánto se cobró."
        : faltaTitular
          ? "Poné a nombre de quién está la cuenta que transfirió."
          : preparandoFoto
            ? "Esperá que termine de cargar la foto del comprobante."
            : null;
  const puedeCobrar = !bloqueo && !pendiente && motivoBloqueo === null;

  // El sello "Cobrado" se va solo y vuelve el total.
  useEffect(() => {
    if (!exito) return;
    const t = setTimeout(() => setExito(null), SEGUNDOS_SELLO * 1000);
    return () => clearTimeout(t);
  }, [exito]);

  function tocar() {
    setError(null);
    setExito(null);
  }

  function deshacer(hecho: IngresoRegistrado) {
    toast.promise(
      (async () => {
        const res = await llamarAccion(() => anularIngreso({ id: hecho.id, motivo: "Deshecho al instante" }));
        if (!res.ok) throw new Error(res.error);
        router.refresh();
      })(),
      {
        loading: `Deshaciendo el cobro N° ${hecho.numero}…`,
        success: `Cobro N° ${hecho.numero} deshecho: no cuenta en la caja.`,
        error: (err: unknown) => (err instanceof Error ? err.message : "No se pudo deshacer. Anulalo desde la lista."),
      }
    );
  }

  function cobrar(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setTocoCobrar(true);
    if (faltaMonto || faltaTitular) {
      // El aviso queda en el campo que falta (en rojo) y el cursor va ahí: no se repite arriba del botón.
      const form = ev.currentTarget;
      requestAnimationFrame(() => form.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }
    if (!puedeCobrar || !concepto) {
      if (motivoBloqueo) setError(motivoBloqueo);
      return;
    }
    if (comprobante && comprobante.size > MAX_COMPROBANTE) {
      setError(MENSAJE_COMPROBANTE_PESADO);
      return;
    }
    refIntento.current ??= uuidV4();
    const fd = new FormData();
    fd.set(
      "datos",
      JSON.stringify({
        conceptoId: concepto.id,
        monto,
        medio,
        titular: medio === "transferencia" ? titular.trim() : undefined,
        detalle: detalle.trim() || undefined,
        ref: refIntento.current,
        fechaCaja,
      })
    );
    if (medio === "transferencia" && comprobante) fd.set("comprobante", comprobante, comprobante.name);

    startTransition(async () => {
      const res = await llamarAccion(() => registrarIngreso(fd));
      if (!res.ok) {
        // Se conserva todo y el MISMO ref (si el primer intento sí entró, el reintento devuelve
        // ese cobro). Solo si con este ref ya se cobró OTRA cosa, el próximo es un cobro nuevo.
        if (res.error.startsWith("Ese cobro ya se registró")) refIntento.current = null;
        setError(res.error);
        return;
      }
      refIntento.current = null;
      setError(null);
      setTocoCobrar(false);
      setExito(res.data);
      const texto = res.data.detalle ? `${res.data.concepto}: ${res.data.detalle}` : res.data.concepto;
      if (res.data.repetido) {
        toast.info(`Ese cobro ya estaba registrado (N° ${res.data.numero}).`);
      } else {
        const hecho = res.data;
        toast.success(`Cobrado N° ${hecho.numero} · ${formatARS(hecho.monto)}`, {
          description: texto,
          duration: 10_000,
          action: { label: "Deshacer", onClick: () => deshacer(hecho) },
        });
      }
      // Conserva el concepto y el medio; limpia lo de esta venta.
      setMontoTexto("");
      setDetalle("");
      setTitular("");
      setComprobante(null);
      setErrorComprobante(undefined);
      router.refresh();
    });
  }

  if (conceptos.length === 0) {
    return (
      <section className="rounded-lg border bg-card p-6 text-center">
        <PackageOpen className="mx-auto size-10 text-muted-foreground" strokeWidth={1.7} />
        <p className="mt-3 text-lg font-semibold">No hay conceptos de ingreso sin cliente</p>
        <p className="text-sm text-muted-foreground">
          Pedile al Líder de Procesos que cargue o prenda uno en Configuración → Precios.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border bg-card p-5 sm:p-6" aria-label="Cobrar sin cliente" data-tour="ingreso-form">
      <form onSubmit={cobrar} className="space-y-6" autoComplete="off" noValidate>
        {bloqueo ? (
          <div role="alert" className="flex items-start gap-3 rounded-lg border border-parcial bg-parcial-suave px-4 py-3">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-parcial" strokeWidth={2} />
            <div className="space-y-1">
              <p className="text-base font-semibold">{bloqueo.titulo}</p>
              {bloqueo.detalle ? <p className="text-sm text-muted-foreground">{bloqueo.detalle}</p> : null}
              {bloqueo.accion ? (
                <Button asChild variant="outline" className="mt-1 h-11 bg-card px-4 text-sm font-semibold">
                  <Link href={bloqueo.accion.href}>{bloqueo.accion.label}</Link>
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        <fieldset disabled={Boolean(bloqueo) || pendiente} className="space-y-6 disabled:opacity-60">
          {conceptos.length > 1 ? (
            <div className="space-y-2">
              <p id="que-se-cobra" className="font-display text-xl font-bold tracking-tight">
                ¿Qué se cobra?
              </p>
              <div role="radiogroup" aria-labelledby="que-se-cobra" className="flex flex-wrap gap-2">
                {conceptos.map((c) => {
                  const activo = c.id === conceptoId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={activo}
                      onClick={() => {
                        setConceptoId(c.id);
                        tocar();
                      }}
                      className={cn(
                        "min-h-12 rounded-full border-2 px-4 text-base font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                        activo
                          ? "border-primary bg-primary/[0.08] text-primary"
                          : "border-border bg-card text-foreground hover:bg-muted/50"
                      )}
                    >
                      {c.nombre}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="flex items-center gap-3 font-display text-xl font-bold tracking-tight">
              <PackageOpen className="size-7 shrink-0 text-primary" strokeWidth={1.9} />
              {concepto?.nombre}
            </p>
          )}

          <div className="space-y-2" data-tour="ingreso-monto">
            <Label htmlFor="monto-ingreso" className="text-base font-medium">
              ¿Cuánto se cobra?
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-2xl font-semibold text-muted-foreground">
                $
              </span>
              <Input
                id="monto-ingreso"
                inputMode="decimal"
                placeholder="0"
                value={montoTexto}
                onChange={(e) => {
                  setMontoTexto(sanitizarMonto(e.target.value));
                  tocar();
                }}
                onBlur={() => setMontoTexto((v) => (v ? montoConMiles(parseMonto(v)) : v))}
                aria-invalid={tocoCobrar && faltaMonto}
                className="h-14 pl-10 text-2xl font-semibold tabular md:text-2xl"
              />
            </div>
            <p className={cn("min-h-5 text-sm", tocoCobrar && faltaMonto ? "font-medium text-destructive" : "text-muted-foreground")}>
              {tocoCobrar && faltaMonto
                ? "Poné cuánto se cobró."
                : "Cada venta es distinta: escribí el total que te pagan."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="detalle-ingreso" className="text-base font-medium">
              ¿Qué se vendió y a quién? <span className="font-normal text-muted-foreground">(si querés)</span>
            </Label>
            <Input
              id="detalle-ingreso"
              value={detalle}
              maxLength={200}
              onChange={(e) => {
                setDetalle(e.target.value);
                tocar();
              }}
              placeholder="Ej.: 30 vacíos y 2 tarimas a Juan Pérez"
              className="h-12 text-base md:text-base"
            />
          </div>

          <div className="space-y-2" data-tour="ingreso-medio">
            <p className="text-base font-medium">¿Cómo te paga?</p>
            <SelectorMedio
              medios={["efectivo", "transferencia"]}
              valor={medio}
              onCambio={(m) => {
                setMedio(m === "transferencia" ? "transferencia" : "efectivo");
                tocar();
              }}
              etiqueta="¿Cómo te paga?"
            />
          </div>

          {medio === "transferencia" ? (
            <div className="rounded-lg border bg-card p-4">
              <DatosTransferencia
                titular={titular}
                comprobante={comprobante}
                errorTitular={tocoCobrar && faltaTitular ? "Poné a nombre de quién está la cuenta que transfirió" : undefined}
                errorComprobante={errorComprobante}
                onTitular={(v) => {
                  setTitular(v);
                  tocar();
                }}
                onComprobante={setComprobante}
                onErrorComprobante={setErrorComprobante}
                onPreparando={setPreparandoFoto}
              />
            </div>
          ) : null}
        </fieldset>

        {/* Total y cobrar, siempre a la vista (en el celular queda pegado abajo). */}
        <div className="sticky bottom-[calc(var(--nav-inferior)+0.75rem)] z-10 -mx-2 space-y-3 rounded-xl border bg-card/95 p-3 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.25)] backdrop-blur supports-[backdrop-filter]:bg-card/85 sm:mx-0 xl:static xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none xl:backdrop-blur-none">
          <div className="flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-1" aria-live="polite">
            {exito ? (
              <div className="flex flex-wrap items-center gap-3">
                <Sello key={exito.numero} grande estado="pagado" texto={`Cobrado N° ${exito.numero}`} className="animar-estampado" />
                <span className="text-base text-muted-foreground">
                  {exito.concepto} · <Money monto={exito.monto} />
                </span>
              </div>
            ) : (
              <>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {concepto ? `${concepto.nombre} · ${medio === "efectivo" ? "Efectivo" : "Transferencia"}` : "Elegí qué se cobra"}
                  </p>
                </div>
                <Money monto={faltaMonto ? 0 : monto} className="font-display text-3xl font-bold tracking-tight" />
              </>
            )}
          </div>

          {error ? <AlertaError error={error} titulo="No se pudo cobrar" /> : null}

          <Button type="submit" size="lg" disabled={Boolean(bloqueo) || pendiente} className="h-14 w-full text-lg font-semibold">
            {pendiente ? <Spinner className="size-6" /> : null}
            {pendiente ? "Cobrando…" : !faltaMonto ? `Cobrar ${formatARS(monto)}` : "Cobrar"}
          </Button>
        </div>
      </form>
    </section>
  );
}
