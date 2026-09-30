"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  FileText,
  Lock,
  PiggyBank,
  Plus,
  Repeat,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { cuitTieneOnceDigitos, formatARS, hoyISO, limpiarCuit } from "@/lib/format";
import type { AvanceMes } from "@/lib/segmentos";
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
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { AlertaError, esErrorDeCajaCerrada } from "@/components/cobranza/alerta-error";
import { BotonAplicarSaldoFavor } from "@/components/cobranza/aplicar-saldo-favor";
import { DatosCheque, cuitParaRevisar } from "@/components/cobranza/datos-cheque";
import { DatosTransferencia } from "@/components/cobranza/datos-transferencia";
import { PlanCuotas } from "@/components/cobranza/plan-cuotas";
import { ReciboRegistrado } from "@/components/cobranza/recibo-registrado";
import { SelectorMedio } from "@/components/cobranza/selector-medio";
import {
  LABEL_MEDIO,
  MAX_COMPROBANTE,
  MEDIOS,
  montoConMiles,
  nuevaLinea,
  parseMonto,
  redondear2,
  sanitizarMonto,
  uuidV4,
  type ChequeForm,
  type ErroresLinea,
  type LineaForm,
  type MedioPago,
} from "@/components/cobranza/tipos";
import { llamarAccion } from "@/lib/llamar-accion";

const MAX_LINEAS = 6;

export type PlanDelMes = {
  avance: AvanceMes | null;
  periodo: string;
  esQuintero: boolean;
  atrasado: { meses: string[]; monto: number } | null;
};

/** "efectivo + transferencia": solo los medios que traen plata (una parte en $ 0 no cuenta). */
function textoMedios(lineas: LineaForm[]): string {
  const vistos: MedioPago[] = [];
  for (const l of lineas) {
    if (parseMonto(l.monto) > 0 && !vistos.includes(l.medio)) vistos.push(l.medio);
  }
  return vistos.map((m) => LABEL_MEDIO[m].toLowerCase()).join(" + ");
}

function validarLineas(
  lineas: LineaForm[],
  mixto: boolean
): { errores: Record<string, ErroresLinea>; cuitSinConfirmar: string | null } {
  const errores: Record<string, ErroresLinea> = {};
  const cheques = new Set<string>();
  let cuitSinConfirmar: string | null = null;
  const hoy = hoyISO();
  for (const l of lineas) {
    const e: ErroresLinea = {};
    if (!(parseMonto(l.monto) > 0)) {
      e.monto = mixto ? "Poné cuánto paga con este medio" : "Poné cuánto te pagan";
    }
    if (l.medio === "transferencia" && !l.titular.trim()) {
      e.titular = "Poné a nombre de quién está la cuenta que transfirió";
    }
    if (l.medio === "cheque") {
      const c = l.cheque;
      if (!/^\d{1,20}$/.test(c.numero.trim())) e.chequeNumero = "Poné el número del cheque (solo números)";
      if (!cuitTieneOnceDigitos(c.cuit)) e.chequeCuit = "El CUIT del cheque tiene que tener 11 números";
      if (c.otraPersona && !c.recibidoDe.trim()) e.chequeRecibidoDe = "Poné quién te da el cheque";
      if (c.fechaRecepcion > hoy) e.chequeFechaRecepcion = "La fecha de recepción no puede ser futura";
      if (c.estado === "entregado" && !c.proveedor.trim()) {
        e.chequeProveedor = "Poné a qué proveedor se lo diste";
      }
      const clave = `${limpiarCuit(c.cuit)}:${c.numero.trim()}`;
      if (!e.chequeNumero && !e.chequeCuit) {
        if (cheques.has(clave)) e.chequeNumero = "Ese cheque ya está en otra parte del cobro";
        cheques.add(clave);
      }
      if (!e.chequeCuit && cuitParaRevisar(c) && !cuitSinConfirmar) cuitSinConfirmar = l.id;
    }
    if (Object.keys(e).length > 0) errores[l.id] = e;
  }
  return { errores, cuitSinConfirmar };
}

/**
 * Formulario de cobro (A1, A2, G2, G5). Una línea = la pantalla de siempre (monto grande,
 * "Cobrar todo", chips de medio). "Pagar una parte con otro medio" lo vuelve un cobro mixto:
 * varias líneas, UN recibo. El `loteId` hace idempotente el registro: doble toque, reintento
 * tras un corte de red o confirmar el saldo a favor usan el MISMO lote.
 *
 * Se monta SIEMPRE en el mismo lugar de la página: cuando la server action revalida, la
 * confirmación con el recibo sigue en pantalla.
 */
export function FormCobro({
  clienteId,
  clienteNombre,
  deudaTotal,
  deudaBruta = deudaTotal,
  saldoFavorPrevio = 0,
  medios,
  puestos = [],
  proveedores = [],
  plan = null,
  volverA = "/cobranza",
  cajaCerrada = false,
  irACaja = "/caja",
}: {
  clienteId: string;
  clienteNombre: string;
  /** Lo que tiene que pagar hoy (ya neto del saldo a favor que tuviera). */
  deudaTotal: number;
  /** Deuda exigible hoy ANTES de descontar el saldo a favor. */
  deudaBruta?: number;
  /** Crédito que ya tenía el cliente antes de este cobro (se aplica solo). */
  saldoFavorPrevio?: number;
  /** Medios que puede recibir quien cobra (el Jefe: sin cheque). */
  medios: MedioPago[];
  /** Espacios del cliente ("Puesto 52"): el puesto del cheque. */
  puestos?: string[];
  proveedores?: string[];
  /** Plan del mes para quien paga en cuotas (cuotas_mes > 1). */
  plan?: PlanDelMes | null;
  /** "Cobrar a otro cliente" vuelve a esta lista. */
  volverA?: string;
  /** La caja de hoy de quien cobra no está abierta: la página lo avisa arriba y acá no se cobra. */
  cajaCerrada?: boolean;
  /** Dónde se reabre / pide la reapertura de la caja (link del error "La caja ya está cerrada…"). */
  irACaja?: string;
}) {
  const router = useRouter();
  const [lineas, setLineas] = useState<LineaForm[]>(() => [nuevaLinea(medios[0] ?? "efectivo", 0, "l1")]);
  const [errores, setErrores] = useState<Record<string, ErroresLinea>>({});
  const [confirmarCuitEn, setConfirmarCuitEn] = useState<string | null>(null);
  const [notas, setNotas] = useState("");
  const [mostrarNotas, setMostrarNotas] = useState(false);
  const [errorRpc, setErrorRpc] = useState<string | null>(null);
  const [confirmarSaldo, setConfirmarSaldo] = useState(false);
  // Cliente al día que quiere adelantar plata: el cobro entero queda como saldo a favor.
  const [modoAdelanto, setModoAdelanto] = useState(false);
  const [resultado, setResultado] = useState<ResultadoCobro | null>(null);
  const [isPending, startTransition] = useTransition();
  const [refrescando, startRefresh] = useTransition();
  // Idempotencia: un lote por cobro (se crea al primer intento y se renueva al terminar).
  const loteRef = useRef<string | null>(null);
  // Líneas cuya foto del comprobante se está achicando: hasta que termine no se cobra
  // (si no, el cobro saldría sin la foto y la foto se perdería sin aviso).
  const [preparandoFotos, setPreparandoFotos] = useState<string[]>([]);
  const preparandoFoto = preparandoFotos.length > 0;
  function marcarPreparando(id: string, preparando: boolean) {
    setPreparandoFotos((prev) =>
      preparando ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id)
    );
  }

  const mixto = lineas.length > 1;
  const total = redondear2(lineas.reduce((acc, l) => acc + parseMonto(l.monto), 0));
  const resto = Math.max(redondear2(deudaTotal - total), 0);
  const sobrante = Math.max(redondear2(total - deudaTotal), 0);

  // ---------- edición de líneas ----------
  function cambiarLinea(id: string, parcial: Partial<LineaForm>) {
    setLineas((prev) => prev.map((l) => (l.id === id ? { ...l, ...parcial } : l)));
    setErrorRpc(null);
  }
  function cambiarCheque(id: string, parcial: Partial<ChequeForm>) {
    setLineas((prev) =>
      prev.map((l) => (l.id === id ? { ...l, cheque: { ...l.cheque, ...parcial } } : l))
    );
    setErrorRpc(null);
  }
  /** Al salir del campo, el monto queda escrito con sus puntos de miles ("2.332.000"). */
  function ordenarMonto(id: string) {
    setLineas((prev) =>
      prev.map((l) => (l.id === id && l.monto ? { ...l, monto: montoConMiles(parseMonto(l.monto)) } : l))
    );
  }
  function limpiarError(id: string, campo: keyof ErroresLinea) {
    setErrores((prev) => {
      if (!prev[id]?.[campo]) return prev;
      const siguiente = { ...prev, [id]: { ...prev[id], [campo]: undefined } };
      return siguiente;
    });
  }
  function agregarLinea() {
    if (lineas.length >= MAX_LINEAS) return;
    const usados = new Set(lineas.map((l) => l.medio));
    const medio = medios.find((m) => !usados.has(m)) ?? medios[medios.length > 1 ? 1 : 0];
    setLineas((prev) => [...prev, nuevaLinea(medio, resto)]);
  }
  function quitarLinea(id: string) {
    setLineas((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev));
    setErrores((prev) => {
      const siguiente = { ...prev };
      delete siguiente[id];
      return siguiente;
    });
  }
  /** "El resto": esta línea completa lo que falta para cubrir la deuda. */
  function elRestoEn(id: string) {
    const otros = lineas.filter((l) => l.id !== id).reduce((acc, l) => acc + parseMonto(l.monto), 0);
    cambiarLinea(id, { monto: montoConMiles(Math.max(redondear2(deudaTotal - otros), 0)) });
    limpiarError(id, "monto");
  }
  /** Un monto elegido desde el plan de cuotas: la última línea completa ese total. */
  function cobrarMonto(monto: number) {
    const ultima = lineas[lineas.length - 1];
    const otros = lineas.slice(0, -1).reduce((acc, l) => acc + parseMonto(l.monto), 0);
    cambiarLinea(ultima.id, { monto: montoConMiles(Math.max(redondear2(monto - otros), 0)) });
    limpiarError(ultima.id, "monto");
  }

  function reset() {
    setLineas([nuevaLinea(medios[0] ?? "efectivo")]);
    setErrores({});
    setConfirmarCuitEn(null);
    setNotas("");
    setMostrarNotas(false);
    setErrorRpc(null);
    setModoAdelanto(false);
    setResultado(null);
    loteRef.current = null;
  }

  // ---------- registro ----------
  function enviar(permitirSaldoFavor: boolean, lineasAEnviar: LineaForm[] = lineas) {
    if (preparandoFoto) return;
    setErrorRpc(null);
    // Las fotos ya vienen achicadas (DatosTransferencia); si igual suman más de 4 MB (un PDF
    // pesado) el pedido no llegaría al servidor: se avisa acá, sin perder nada de lo cargado.
    const pesoFotos = lineasAEnviar.reduce(
      (acc, l) => acc + (l.medio === "transferencia" && l.comprobante ? l.comprobante.size : 0),
      0
    );
    if (pesoFotos > MAX_COMPROBANTE) {
      setErrorRpc(
        "Los comprobantes juntos pesan más de 4 MB y no se pueden subir. Quitá alguno o, si es un PDF, mandá una captura de pantalla (foto) en vez del PDF, y tocá de nuevo."
      );
      return;
    }
    // Idempotencia: el MISMO lote hasta que el cobro termine bien (un corte de red no lo renueva).
    loteRef.current ??= uuidV4();
    const datos: InputCobro = {
      clienteId,
      loteId: loteRef.current,
      lineas: lineasAEnviar.map((l) => {
        const monto = parseMonto(l.monto);
        if (l.medio === "transferencia") {
          return { id: l.id, medio: "transferencia", monto, transferencia: { titular: l.titular.trim() } };
        }
        if (l.medio === "cheque") {
          const c = l.cheque;
          return {
            id: l.id,
            medio: "cheque",
            monto,
            cheque: {
              numero: c.numero.trim(),
              cuit: limpiarCuit(c.cuit),
              recibido_de: c.otraPersona ? c.recibidoDe.trim() : undefined,
              fecha_recepcion: c.fechaRecepcion || undefined,
              fecha_cobro: c.fechaCobro || hoyISO(),
              estado: c.estado,
              proveedor: c.estado === "entregado" ? c.proveedor.trim() : undefined,
            },
          };
        }
        return { id: l.id, medio: "efectivo", monto };
      }),
      notas: notas.trim() || undefined,
      permitirSaldoFavor,
    };
    const fd = new FormData();
    fd.set("datos", JSON.stringify(datos));
    for (const l of lineasAEnviar) {
      if (l.medio === "transferencia" && l.comprobante) {
        fd.set(`comprobante:${l.id}`, l.comprobante, l.comprobante.name);
      }
    }

    startTransition(async () => {
      const res = await llamarAccion(() => registrarCobro(fd));
      if (!res.ok) {
        setErrorRpc(res.error);
        return;
      }
      if (res.data.repetido) {
        toast.info(`Ese cobro ya estaba registrado (Recibo N° ${res.data.numero})`);
      } else {
        toast.success(`Cobro registrado — Recibo N° ${res.data.numero}`);
      }
      setResultado(res.data);
    });
  }

  function intentar(lineasActuales: LineaForm[] = lineas) {
    setErrorRpc(null);
    const { errores: nuevos, cuitSinConfirmar } = validarLineas(lineasActuales, lineasActuales.length > 1);
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) {
      setConfirmarCuitEn(null);
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>("[data-form-cobro] [aria-invalid=true]")?.focus();
      });
      return;
    }
    if (cuitSinConfirmar) {
      // Aviso, no bloqueo: un toque en "Está bien así, seguir" y se registra.
      setConfirmarCuitEn(cuitSinConfirmar);
      return;
    }
    setConfirmarCuitEn(null);
    const t = redondear2(lineasActuales.reduce((acc, l) => acc + parseMonto(l.monto), 0));
    if (t - deudaTotal > 0.009) {
      setConfirmarSaldo(true);
      return;
    }
    enviar(false, lineasActuales);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (cajaCerrada || isPending || preparandoFoto) return;
    intentar();
  }

  /** "Está bien así, seguir": confirma el CUIT de esa línea y, si se estaba registrando, sigue. */
  function seguirConCuit(id: string) {
    const actualizadas = lineas.map((l) =>
      l.id === id ? { ...l, cheque: { ...l.cheque, cuitConfirmado: true } } : l
    );
    setLineas(actualizadas);
    if (confirmarCuitEn === id) intentar(actualizadas);
  }

  // La RPC avisa si sobra plata y no se autorizó (p. ej. la deuda cambió mientras se cargaba).
  const errorPideSaldoFavor = Boolean(errorRpc && /saldo a favor/i.test(errorRpc));

  // ---------- trayendo la deuda nueva después de "Cobrar otra vez" ----------
  if (refrescando) {
    return (
      <section className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border bg-card p-6 text-center">
        <Spinner className="size-8 text-primary" />
        <p className="font-medium">Trayendo lo que debe {clienteNombre} ahora…</p>
      </section>
    );
  }

  // ---------- éxito ----------
  if (resultado) {
    return (
      <ReciboRegistrado resultado={resultado}>
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
          onClick={() => {
            reset();
            startRefresh(() => router.refresh());
          }}
        >
          <Repeat className="size-5" strokeWidth={2} />
          Cobrar otra vez a {clienteNombre}
        </Button>
        <Button asChild size="lg" variant="ghost" className="h-12 w-full text-base">
          <Link href={volverA}>
            <Users className="size-5" strokeWidth={2} />
            Cobrar a otro cliente
          </Link>
        </Button>
      </ReciboRegistrado>
    );
  }

  // ---------- sin nada que cobrar (o el saldo a favor cubre todo) ----------
  if (deudaTotal <= 0 && !modoAdelanto) {
    const cubreConSaldo = deudaBruta > 0 && saldoFavorPrevio > 0;
    return (
      <section
        data-tour={cubreConSaldo ? "cobranza-saldo-cubre" : "cobranza-al-dia"}
        className="space-y-4 rounded-lg border bg-card p-6 text-center"
      >
        {cubreConSaldo ? (
          <>
            <p className="text-muted-foreground">
              El saldo a favor cubre toda la deuda: no hace falta cobrar nada.
            </p>
            <BotonAplicarSaldoFavor clienteId={clienteId} saldoFavor={saldoFavorPrevio} />
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Sello grande estado="al_dia" />
            <p className="text-muted-foreground">No tiene nada para pagar hoy.</p>
          </div>
        )}
        <Button
          asChild
          size="lg"
          variant={cubreConSaldo ? "outline" : "default"}
          className="h-12 w-full text-base font-semibold"
        >
          <Link href={volverA}>
            <Users className="size-5" strokeWidth={2} />
            Cobrar a otro cliente
          </Link>
        </Button>
        {!cubreConSaldo ? (
          <Button
            type="button"
            variant="ghost"
            className="h-auto min-h-11 w-full text-sm whitespace-normal text-muted-foreground"
            onClick={() => setModoAdelanto(true)}
          >
            Quiere adelantar plata: registrar un pago a cuenta (queda como saldo a favor)
          </Button>
        ) : null}
      </section>
    );
  }

  const unaLinea = lineas[0];
  const mediosConPlata = textoMedios(lineas);
  const etiquetaBoton =
    total > 0
      ? `Registrar cobro de ${formatARS(total)}${mixto && mediosConPlata ? ` (${mediosConPlata})` : ""}`
      : "Registrar cobro";
  // Cobro mixto con una parte sin plata: se avisa antes de tocar el botón (al tocarlo, el
  // campo vacío se marca en rojo), y el botón no anuncia un medio que no trae nada.
  const partesSinMonto = mixto
    ? lineas.flatMap((l, i) => (parseMonto(l.monto) > 0 ? [] : [i + 1]))
    : [];

  function detalleMedio(l: LineaForm) {
    const e = errores[l.id] ?? {};
    if (l.medio === "transferencia") {
      return (
        <DatosTransferencia
          titular={l.titular}
          comprobante={l.comprobante}
          sugerenciaTitular={clienteNombre}
          errorTitular={e.titular}
          errorComprobante={e.comprobante}
          onTitular={(v) => {
            cambiarLinea(l.id, { titular: v });
            limpiarError(l.id, "titular");
          }}
          onComprobante={(archivo) => cambiarLinea(l.id, { comprobante: archivo })}
          onErrorComprobante={(error) =>
            setErrores((prev) => ({ ...prev, [l.id]: { ...prev[l.id], comprobante: error } }))
          }
          onPreparando={(preparando) => marcarPreparando(l.id, preparando)}
        />
      );
    }
    if (l.medio === "cheque") {
      return (
        <DatosCheque
          valor={l.cheque}
          onCambio={(parcial) => {
            cambiarCheque(l.id, parcial);
            for (const campo of Object.keys(parcial)) {
              const mapa: Record<string, keyof ErroresLinea> = {
                numero: "chequeNumero",
                cuit: "chequeCuit",
                recibidoDe: "chequeRecibidoDe",
                otraPersona: "chequeRecibidoDe",
                proveedor: "chequeProveedor",
                estado: "chequeProveedor",
                fechaRecepcion: "chequeFechaRecepcion",
              };
              if (mapa[campo]) limpiarError(l.id, mapa[campo]);
            }
          }}
          clienteNombre={clienteNombre}
          puestos={puestos}
          proveedores={proveedores}
          errores={e}
          pedirConfirmacionCuit={confirmarCuitEn === l.id}
          onSeguirConCuit={() => seguirConCuit(l.id)}
        />
      );
    }
    return null;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate data-form-cobro>
      {saldoFavorPrevio > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-pagado/40 bg-pagado-suave px-4 py-3">
          <Sello estado="saldo_favor" />
          <p className="min-w-0 flex-1 text-sm">
            Ya tiene <Money monto={saldoFavorPrevio} className="font-semibold" /> a favor: se
            aplican solos en este cobro. Hoy tiene que pagar{" "}
            <Money monto={deudaTotal} className="font-semibold" />.
          </p>
        </div>
      ) : null}

      {plan ? (
        <PlanCuotas
          avance={plan.avance}
          periodo={plan.periodo}
          esQuintero={plan.esQuintero}
          atrasado={plan.atrasado}
          onCobrar={cobrarMonto}
          deshabilitado={isPending}
        />
      ) : null}

      {!mixto ? (
        // ---------- camino simple: una línea ----------
        <>
          <div className="space-y-2" data-tour="cobranza-monto">
            <Label htmlFor="monto-cobro" className="text-base font-medium">
              ¿Cuánto te pagan?
            </Label>
            <div className="flex gap-2">
              <Input
                id="monto-cobro"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={unaLinea.monto}
                onChange={(e) => {
                  cambiarLinea(unaLinea.id, { monto: sanitizarMonto(e.target.value) });
                  limpiarError(unaLinea.id, "monto");
                }}
                onBlur={() => ordenarMonto(unaLinea.id)}
                aria-invalid={Boolean(errores[unaLinea.id]?.monto)}
                aria-describedby="monto-cobro-ayuda"
                className="h-14 flex-1 text-2xl font-semibold tabular md:text-2xl"
              />
              {deudaTotal > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-14 shrink-0 px-4 text-sm font-semibold"
                  onClick={() => {
                    cambiarLinea(unaLinea.id, { monto: montoConMiles(deudaTotal) });
                    limpiarError(unaLinea.id, "monto");
                  }}
                >
                  Cobrar todo
                </Button>
              ) : null}
            </div>
            {/* Renglón siempre presente: al escribir cambia el texto, no se corre la pantalla. */}
            <div id="monto-cobro-ayuda" className="min-h-5 text-sm">
              {errores[unaLinea.id]?.monto ? (
                <p className="font-medium text-destructive">{errores[unaLinea.id]?.monto}</p>
              ) : total > 0 ? (
                <p className="text-muted-foreground tabular">
                  Vas a cobrar <span className="font-semibold text-foreground">{formatARS(total)}</span>
                  {resto > 0 ? (
                    <>
                      {" · "}
                      <span className="whitespace-nowrap">queda debiendo {formatARS(resto)}</span>
                    </>
                  ) : null}
                </p>
              ) : (
                <p className="text-muted-foreground">
                  {deudaTotal > 0
                    ? "Escribí cuánto te paga, o tocá Cobrar todo."
                    : "Escribí cuánto te paga: queda a su favor."}
                </p>
              )}
            </div>
            {sobrante > 0 ? (
              <div className="flex items-start gap-2.5 rounded-lg border border-parcial bg-parcial-suave px-4 py-3 text-sm">
                <PiggyBank className="mt-0.5 size-5 shrink-0 text-parcial" strokeWidth={2} />
                <p>
                  Sobran <strong className="tabular">{formatARS(sobrante)}</strong>: quedan como
                  saldo a favor de {clienteNombre} y se aplican solos a lo próximo que deba.
                </p>
              </div>
            ) : null}
          </div>

          <div className="space-y-2" data-tour="cobranza-medio">
            <Label className="text-base font-medium">¿Cómo te paga?</Label>
            <SelectorMedio
              medios={medios}
              valor={unaLinea.medio}
              onCambio={(m) => cambiarLinea(unaLinea.id, { medio: m })}
            />
          </div>

          {unaLinea.medio !== "efectivo" ? (
            <div className="rounded-lg border bg-card p-4">{detalleMedio(unaLinea)}</div>
          ) : null}
        </>
      ) : (
        // ---------- cobro mixto: varias líneas, un recibo ----------
        <>
          <ResumenMixto lineas={lineas} total={total} deuda={deudaTotal} />
          <ol className="space-y-4">
            {lineas.map((l, i) => {
              const e = errores[l.id] ?? {};
              return (
                <li key={l.id} className="space-y-4 rounded-lg border bg-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-display text-lg font-bold">Parte {i + 1}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-11 px-3 text-sm text-muted-foreground"
                      onClick={() => quitarLinea(l.id)}
                    >
                      <X className="size-4" strokeWidth={2} />
                      Quitar
                    </Button>
                  </div>
                  <SelectorMedio
                    compacto
                    medios={medios}
                    valor={l.medio}
                    onCambio={(m) => cambiarLinea(l.id, { medio: m })}
                    etiqueta={`Medio de la parte ${i + 1}`}
                  />
                  <div className="space-y-2">
                    <Label htmlFor={`monto-${l.id}`} className="text-base font-medium">
                      ¿Cuánto paga con {LABEL_MEDIO[l.medio].toLowerCase()}?
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id={`monto-${l.id}`}
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="0"
                        value={l.monto}
                        onChange={(ev) => {
                          cambiarLinea(l.id, { monto: sanitizarMonto(ev.target.value) });
                          limpiarError(l.id, "monto");
                        }}
                        onBlur={() => ordenarMonto(l.id)}
                        aria-invalid={Boolean(e.monto)}
                        className="h-12 flex-1 text-xl font-semibold tabular md:text-xl"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 shrink-0 px-3 text-sm font-semibold"
                        onClick={() => elRestoEn(l.id)}
                      >
                        El resto
                      </Button>
                    </div>
                    <div className="min-h-5 text-sm">
                      {e.monto ? (
                        <p className="font-medium text-destructive">{e.monto}</p>
                      ) : parseMonto(l.monto) > 0 ? (
                        <p className="text-muted-foreground tabular">
                          {formatARS(parseMonto(l.monto))} en {LABEL_MEDIO[l.medio].toLowerCase()}
                        </p>
                      ) : (
                        <p className="text-muted-foreground">Escribí el monto o tocá El resto.</p>
                      )}
                    </div>
                  </div>
                  {detalleMedio(l)}
                </li>
              );
            })}
          </ol>
        </>
      )}

      {lineas.length < MAX_LINEAS ? (
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full border-dashed text-base font-semibold text-primary"
          onClick={agregarLinea}
        >
          <Plus className="size-5" strokeWidth={2} />
          {mixto ? "Agregar otro medio" : "Pagar una parte con otro medio"}
        </Button>
      ) : null}

      {mostrarNotas ? (
        <div className="space-y-2">
          <Label htmlFor="notas-cobro" className="text-base font-medium">
            Nota
          </Label>
          <Textarea
            id="notas-cobro"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Algo para acordarse de este cobro…"
            maxLength={500}
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
        <AlertaError error={errorRpc} titulo="No se pudo registrar el cobro">
          {errorPideSaldoFavor ? (
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-11 max-w-full bg-card px-4 py-2 text-left text-sm font-semibold whitespace-normal text-foreground"
              disabled={isPending || preparandoFoto}
              onClick={() => enviar(true)}
            >
              <PiggyBank className="size-4" strokeWidth={2} />
              Dejar el sobrante como saldo a favor y registrar
            </Button>
          ) : esErrorDeCajaCerrada(errorRpc) ? (
            <Button asChild variant="outline" className="h-11 bg-card px-4 text-sm font-semibold text-foreground">
              <Link href={irACaja}>
                Ir a Caja
                <ArrowRight className="size-4" strokeWidth={2} />
              </Link>
            </Button>
          ) : null}
        </AlertaError>
      ) : null}

      {partesSinMonto.length > 0 && total > 0 && !cajaCerrada ? (
        <p className="text-sm font-medium text-parcial">
          {partesSinMonto.length === 1
            ? `La parte ${partesSinMonto[0]} está en $ 0: poné cuánto paga con ese medio o quitala.`
            : `Las partes ${partesSinMonto.join(" y ")} están en $ 0: poné cuánto pagan o quitalas.`}
        </p>
      ) : null}

      {cajaCerrada ? (
        <p className="flex items-start gap-2 text-sm font-medium text-parcial">
          <Lock className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          No se puede cobrar: la caja de hoy no está abierta (mirá el aviso de arriba).
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        data-tour="cobranza-registrar"
        disabled={isPending || total <= 0 || cajaCerrada || preparandoFoto}
        className="h-auto min-h-14 w-full py-3 text-lg font-semibold whitespace-normal"
      >
        {isPending ? (
          <>
            <Spinner className="size-6" />
            Registrando…
          </>
        ) : preparandoFoto ? (
          <>
            <Spinner className="size-6" />
            Esperá, preparando la foto…
          </>
        ) : (
          etiquetaBoton
        )}
      </Button>

      {/* Plata de más: se confirma antes de dejarla a favor (mismo lote al reintentar). */}
      <Dialog open={confirmarSaldo} onOpenChange={setConfirmarSaldo}>
        <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">
              Sobran {formatARS(sobrante)}: ¿los dejamos como saldo a favor de {clienteNombre}?
            </DialogTitle>
            <DialogDescription className="text-base">
              Hoy debe {formatARS(deudaTotal)} y te paga {formatARS(total)}. Lo que sobra se
              aplica solo a lo próximo que deba.
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
              disabled={isPending || preparandoFoto}
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

/**
 * Cobro mixto: "Total del cobro" grande y una barra apilada contra "Debe hoy": cada medio es un
 * tramo verde sobre la pista roja suave de lo que falta; si sobra, la marca de "Debe hoy" queda
 * adentro de la barra y el excedente se ve pasando la marca.
 */
function ResumenMixto({
  lineas,
  total,
  deuda,
}: {
  lineas: LineaForm[];
  total: number;
  deuda: number;
}) {
  const escala = Math.max(total, deuda, 1);
  const falta = Math.max(redondear2(deuda - total), 0);
  const sobra = Math.max(redondear2(total - deuda), 0);
  const marca = deuda > 0 && sobra > 0 ? (deuda / escala) * 100 : null;
  return (
    <section className="space-y-3 rounded-lg border bg-card p-5" aria-live="polite">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Total del cobro</p>
          <Money monto={total} className="text-3xl font-bold" />
        </div>
        <p className="text-sm text-muted-foreground">
          Debe hoy <Money monto={deuda} className="font-semibold text-foreground" />
        </p>
      </div>
      <div className="relative">
        <div className="flex h-5 w-full overflow-hidden rounded-full bg-pendiente-suave" aria-hidden>
          {lineas.map((l) => {
            const m = parseMonto(l.monto);
            if (!(m > 0)) return null;
            return (
              <div
                key={l.id}
                className="h-full border-r-2 border-card bg-pagado last:border-r-0"
                style={{ width: `${(m / escala) * 100}%` }}
              />
            );
          })}
        </div>
        {marca !== null ? (
          <div
            className="absolute -top-1 -bottom-1 w-0.5 rounded bg-foreground"
            style={{ left: `${marca}%` }}
            aria-hidden
          />
        ) : null}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {lineas.map((l) => {
          const m = parseMonto(l.monto);
          const Icono = MEDIOS.find((x) => x.valor === l.medio)?.Icono;
          return (
            <span key={l.id} className="inline-flex items-center gap-1.5 text-muted-foreground">
              {Icono ? <Icono className="size-4" strokeWidth={2} /> : null}
              {LABEL_MEDIO[l.medio]}{" "}
              <Money monto={m} className="font-medium text-foreground" />
            </span>
          );
        })}
      </div>
      <p
        className={cn(
          "text-sm font-semibold",
          falta > 0 ? "text-pendiente" : sobra > 0 ? "text-parcial" : "text-pagado"
        )}
      >
        {falta > 0
          ? `Queda debiendo ${formatARS(falta)}`
          : sobra > 0
            ? `Sobran ${formatARS(sobra)}: quedan como saldo a favor`
            : "Cubre todo lo que debe hoy"}
      </p>
    </section>
  );
}
