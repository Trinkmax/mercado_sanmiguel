"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import { anularCanon, registrarCanon } from "@/lib/actions/porteria";
import { formatARS, parseMonto, sanitizarMonto } from "@/lib/format";
import { cn, uuidV4 } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { AlertaError } from "@/components/cobranza/alerta-error";
import {
  DESTINOS,
  LABEL_DESTINO,
  LABEL_MEDIO_CANON,
  MEDIOS_CANON,
  esPatenteValida,
  formatPatente,
  normalizarPatente,
  type DestinoCanon,
  type MedioCanon,
} from "@/components/porteria/tarifas";
import { llamarAccion } from "@/lib/llamar-accion";

/** Segundos que queda el sello "Cobrado N° X" antes de volver al total. */
const SEGUNDOS_SELLO = 4;

/** Un puesto del plano, tal como lo devuelve espacios_del_plano() (sin datos de clientes). */
export type PuestoPlano = { numero: string; medio: boolean };

const nuevoRef = uuidV4;

type Exito = { id: string; numero: number; monto: number; texto: string };

/** Lo que entra en el bono camioneros de una vez (como la base, 0062). */
const MONTO_MAXIMO = 99_999_999;

const TEXTO_BONO = "Bono camioneros";

/**
 * Talonario del bono camioneros (H1, H2): "¿Cuánto se cobró?" → "Cobrar $ 432.000".
 * Pedido del 06/11/2026: el monto se escribe a mano («no por balancín, no por camión»): con
 * tarifa × cantidad las cajas no cerraban. Medio, patente y "¿A quién viene?" son ajustes.
 * Después de cobrar conserva el medio y limpia el resto.
 */
export function CanonTransporte({
  puestos,
  bloqueo,
  fecha,
}: {
  /** Puestos del plano para validar "Puesto 58 ✓" al instante. */
  puestos: PuestoPlano[];
  /** Caja de portería rendida: el formulario queda bloqueado con este aviso. */
  bloqueo: { titulo: string; detalle?: string; accion?: { href: string; label: string } } | null;
  /** Carga atrasada (el Líder): el canon entra en la caja de portería de este día anterior. */
  fecha?: string;
}) {
  const [montoTexto, setMontoTexto] = useState("");
  const [medio, setMedio] = useState<MedioCanon>("efectivo");
  const [patente, setPatente] = useState("");
  const [destino, setDestino] = useState<DestinoCanon | null>(null);
  const [puesto, setPuesto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<Exito | null>(null);
  const [pendiente, startTransition] = useTransition();
  const refIntento = useRef<string | null>(null);

  const monto = Math.round(parseMonto(montoTexto) * 100) / 100;

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
    : monto <= 0
      ? "Escribí cuánto se cobró."
      : monto > MONTO_MAXIMO
        ? "Revisá el monto: es demasiado grande."
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
    if (!puedeCobrar) {
      if (motivoBloqueo) setError(motivoBloqueo);
      return;
    }
    if (!refIntento.current) refIntento.current = nuevoRef();
    const ref = refIntento.current;
    const texto = TEXTO_BONO;

    startTransition(async () => {
      const res = await llamarAccion(() => registrarCanon({
        monto,
        medio,
        patente: patenteNorm || undefined,
        destino,
        puesto: destino === "puesto" && puestoNorm ? puestoNorm : undefined,
        ref,
        fecha,
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
      // Conserva el medio; limpia lo que ya se cobró.
      setMontoTexto("");
      setPatente("");
      setDestino(null);
      setPuesto("");
    });
  }

  return (
    <section className="rounded-lg border bg-card p-5 sm:p-6" aria-label="Cobrar canon de transporte" data-tour="porteria-canon">
      <form onSubmit={cobrar} className="space-y-6" autoComplete="off">
        {bloqueo ? (
          <div
            role="alert"
            data-tour="porteria-caja-rendida"
            className="flex items-start gap-3 rounded-lg border border-parcial bg-parcial-suave px-4 py-3"
          >
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
          {/* ---------------------------------------------------- ¿Cuánto se cobró? y medio */}
          <div className="grid gap-6 sm:grid-cols-2" data-tour="porteria-cantidad-medio">
            <div className="space-y-2" data-tour="porteria-que-entro">
              <Label htmlFor="canon-monto" className="text-base font-medium">
                ¿Cuánto se cobró?
              </Label>
              <Input
                id="canon-monto"
                inputMode="decimal"
                value={montoTexto}
                onChange={(e) => {
                  setMontoTexto(sanitizarMonto(e.target.value).slice(0, 14));
                  setError(null);
                  setExito(null);
                }}
                placeholder="0"
                aria-describedby="canon-monto-ayuda"
                className="h-14 text-2xl font-bold tabular md:text-2xl"
              />
              <p id="canon-monto-ayuda" className="min-h-5 text-sm text-muted-foreground tabular">
                {montoTexto !== "" ? formatARS(monto) : "Todo lo que te pagaron de bono, junto."}
              </p>
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
          <div className="grid gap-6 border-t pt-5 sm:grid-cols-2" data-tour="porteria-opcionales">
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
        <div
          data-tour="porteria-cobrar"
          className="sticky bottom-[calc(var(--nav-inferior)+0.75rem)] z-10 -mx-2 space-y-3 rounded-xl border bg-card/95 p-3 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.25)] backdrop-blur supports-[backdrop-filter]:bg-card/85 sm:mx-0 xl:static xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none xl:backdrop-blur-none"
        >
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
                    {`${TEXTO_BONO} · ${LABEL_MEDIO_CANON[medio]}`}
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
          {!bloqueo && !pendiente && motivoBloqueo && montoTexto !== "" ? (
            <p className="text-center text-sm text-muted-foreground">{motivoBloqueo}</p>
          ) : null}
        </div>
      </form>
    </section>
  );
}
