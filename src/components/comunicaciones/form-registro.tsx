"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Check, Eye, MapPin, Search, Send, UserX, X } from "lucide-react";
import { emitirRegistro } from "@/lib/actions/sanciones";
import { formatARS, formatFecha } from "@/lib/format";
import { cn, uuidV4 } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import {
  ACCEPT_ADJUNTO_REGISTRO,
  DIAS_VENCIMIENTO_MULTA,
  infoTipoRegistro,
  MULTAS_RAPIDAS,
  TIPOS_REGISTRO,
  TITULOS_SUGERIDOS,
  type TipoRegistro,
} from "./constantes";
import { llamarAccion } from "@/lib/llamar-accion";
import { AYUDA_PESO_ADJUNTO, errorPesoAdjunto, explicarFalloEnvio, prepararAdjuntos } from "./adjuntos";
import { AvisoError, irAlCampo } from "./aviso-error";

export type ClienteOpcion = {
  id: string;
  codigo: number;
  nombre: string;
  apodo: string | null;
  lugares: { id: string; etiqueta: string; numero: string | null }[];
  deuda: number;
  tienePortal: boolean;
};

const nuevoRef = uuidV4;

function sumarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const f = new Date(y, m - 1, d + dias);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
}

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Nuevo registro (D3, D4): ¿A quién? → ¿Qué es? → título + detalle + foto/PDF → multa (si es
 * apercibimiento o sanción) → "Así lo ve el socio" → "Notificar a {nombre} (Puesto N)".
 * `ref` por intento: un doble toque manda la misma clave y la base crea UN registro y UNA multa.
 * Si falla (o se corta el wifi) se conserva todo lo cargado y la MISMA clave: el reintento
 * devuelve "repetido" si el primero había llegado. La clave cambia recién al terminar bien.
 */
export function FormRegistro({
  clientes,
  clienteInicialId = null,
  clienteFijo = false,
  tipoInicial = "notificacion",
  fechaHoy,
  alTerminar = "detalle",
}: {
  clientes: ClienteOpcion[];
  clienteInicialId?: string | null;
  /** En la ficha del cliente: sin buscador. */
  clienteFijo?: boolean;
  tipoInicial?: TipoRegistro;
  fechaHoy: string;
  /** "detalle" = ir al registro creado; "quedarse" = limpiar y seguir en la misma pantalla. */
  alTerminar?: "detalle" | "quedarse";
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const archivoRef = useRef<HTMLInputElement>(null);
  const [pendiente, startTransition] = useTransition();
  const [ref, setRef] = useState(nuevoRef);
  /** Cliente con el que ya se intentó mandar esta clave (null = todavía no se usó). */
  const refUsadaCon = useRef<string | null>(null);

  const [clienteId, setClienteId] = useState<string | null>(clienteInicialId);
  const cliente = clientes.find((c) => c.id === clienteId) ?? null;
  const [lugarId, setLugarId] = useState<string | null>(
    cliente && cliente.lugares.length === 1 ? cliente.lugares[0].id : null
  );
  const [busqueda, setBusqueda] = useState("");
  const [tipo, setTipo] = useState<TipoRegistro>(tipoInicial);
  const [titulo, setTitulo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [fecha, setFecha] = useState(fechaHoy);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [conMulta, setConMulta] = useState(false);
  const [multa, setMulta] = useState("");
  // La multa vence a los 10 días de HOY aunque el hecho sea de antes: nunca nace vencida.
  const [vence, setVence] = useState(sumarDias(fechaHoy, DIAS_VENCIMIENTO_MULTA));
  const [error, setError] = useState<string | null>(null);
  /** Campo al que corresponde el error (el aviso va debajo de ese campo); null = junto al botón. */
  const [campoError, setCampoError] = useState<string | null>(null);

  const info = infoTipoRegistro(tipo);
  const montoMulta = Number(multa || 0);
  const lleva = info.llevaMulta && conMulta && montoMulta > 0;
  const lugar = cliente?.lugares.find((l) => l.id === lugarId) ?? null;

  const resultados = useMemo(() => {
    const q = normalizar(busqueda);
    if (!q) return [];
    const esNumero = /^\d+$/.test(q);
    return clientes
      .filter((c) => {
        if (esNumero)
          return String(c.codigo) === q || c.lugares.some((l) => (l.numero ?? "").replace(/\D/g, "") === q);
        return normalizar(c.nombre).includes(q) || normalizar(c.apodo ?? "").includes(q);
      })
      .slice(0, 8);
  }, [busqueda, clientes]);

  function elegirCliente(c: ClienteOpcion) {
    setClienteId(c.id);
    setLugarId(c.lugares.length === 1 ? c.lugares[0].id : null);
    setBusqueda("");
    mostrarError(null);
    // Otro destinatario = otro registro: clave nueva. Si no, un envío que había llegado antes
    // de un corte trababa el formulario con "Ese registro ya se emitió para otro cliente".
    // Si vuelve a elegir al MISMO, se conserva la clave (el reintento no duplica).
    if (refUsadaCon.current && refUsadaCon.current !== c.id) {
      setRef(nuevoRef());
      refUsadaCon.current = null;
    }
  }

  function quitarCliente() {
    setClienteId(null);
    setLugarId(null);
    mostrarError(null);
  }

  function quitarArchivo() {
    if (archivoRef.current) archivoRef.current.value = "";
    setNombreArchivo(null);
  }

  function limpiar() {
    formRef.current?.reset();
    quitarArchivo();
    setTitulo("");
    setDetalle("");
    setConMulta(false);
    setMulta("");
    setFecha(fechaHoy);
    setVence(sumarDias(fechaHoy, DIAS_VENCIMIENTO_MULTA));
    setRef(nuevoRef());
    refUsadaCon.current = null;
  }

  function mostrarError(mensaje: string | null, campo: string | null = null) {
    setError(mensaje);
    setCampoError(mensaje ? campo : null);
  }

  /** Al corregir el campo marcado, el aviso se va. */
  function corrigio(campo: string) {
    if (campoError === campo) mostrarError(null);
  }

  /** Error de validación: el aviso va debajo del campo que falta y se lleva la pantalla ahí. */
  function falta(mensaje: string, campoId: string) {
    // Si el campo no está en pantalla, el aviso va junto al botón (nunca queda sin mostrarse).
    const visible = typeof document !== "undefined" && document.getElementById(campoId) !== null;
    mostrarError(mensaje, visible ? campoId : null);
    if (visible) irAlCampo(campoId);
  }

  /** Aviso debajo de un campo, si el error es de ese campo. */
  function avisoDe(campo: string) {
    return error && campoError === campo ? <AvisoError mensaje={error} /> : null;
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente) return;
    mostrarError(null);
    if (!cliente) {
      falta("Elegí a quién va dirigido: buscalo por nombre, apodo o número de puesto.", "reg-buscar");
      return;
    }
    if (!titulo.trim()) {
      falta("Poné un título (ej.: Falta de limpieza del puesto).", "reg-titulo");
      return;
    }
    if (fecha && fecha > fechaHoy) {
      falta("La fecha no puede ser de un día que todavía no llegó: elegí hoy o un día anterior.", "reg-fecha");
      return;
    }
    if (info.llevaMulta && conMulta && montoMulta <= 0) {
      falta("Poné el monto de la multa, o apagá “¿Lleva multa?”.", "reg-multa");
      return;
    }
    if (lleva && (!vence || vence < fechaHoy)) {
      falta("La multa tiene que vencer de hoy en adelante: elegí otra fecha en “Vence el”.", "reg-vence");
      return;
    }
    const fd = new FormData(e.currentTarget);
    fd.set("clienteId", cliente.id);
    fd.set("tipo", tipo);
    fd.set("titulo", titulo.trim());
    fd.set("detalle", detalle.trim());
    fd.set("fecha", fecha);
    fd.set("ref", ref);
    refUsadaCon.current = cliente.id;
    if (lugarId) fd.set("espacioId", lugarId);
    else fd.delete("espacioId");
    if (lleva) {
      fd.set("multa", String(montoMulta));
      fd.set("multaVencimiento", vence);
    } else {
      fd.delete("multa");
      fd.delete("multaVencimiento");
    }
    const nombre = cliente.nombre;
    startTransition(async () => {
      const errorPeso = await prepararAdjuntos(fd, ["archivo"]);
      if (errorPeso) {
        mostrarError(errorPeso);
        return;
      }
      const res = await llamarAccion(() => emitirRegistro(fd));
      if (!res.ok) {
        // Queda todo lo cargado y la misma clave: tocar de nuevo no duplica.
        mostrarError(explicarFalloEnvio(res.error, fd, ["archivo"]));
        return;
      }
      const etiqueta = `${infoTipoRegistro(res.data.tipo).label} N° ${res.data.numero}`;
      if (res.data.repetido) {
        toast.info(`Ese registro ya estaba enviado (${etiqueta})`);
      } else if (res.data.multa) {
        toast.success(`${etiqueta} enviado · multa de ${formatARS(res.data.multa)} sumada a su cuenta`);
      } else {
        toast.success(`${etiqueta} enviado a ${nombre}`);
      }
      if (alTerminar === "detalle") {
        router.push(`/comunicaciones/registros/${res.data.id}`);
      } else {
        limpiar();
        router.refresh();
      }
    });
  }

  const textoBoton = cliente
    ? `Notificar a ${cliente.nombre}${lugar ? ` (${lugar.etiqueta})` : ""}`
    : "Notificar";

  return (
    // noValidate: los min/max de las fechas quedan para el selector, pero el aviso lo da
    // onSubmit (fijo junto al botón y con foco) en vez del globo nativo que se va solo.
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-8">
      {/* 1. ¿A quién? */}
      {!clienteFijo ? (
        <section className="space-y-3" aria-labelledby="reg-quien">
          <h2 id="reg-quien" className="font-display text-lg font-bold tracking-tight">
            ¿A quién?
          </h2>
          {cliente ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-primary/40 bg-accent/50 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold leading-snug">
                  {cliente.nombre}
                  {cliente.apodo ? (
                    <span className="font-normal text-muted-foreground"> · {cliente.apodo}</span>
                  ) : null}
                </p>
                <p className="text-sm text-muted-foreground">
                  Carpeta N° <span className="tabular">{cliente.codigo}</span>
                  {cliente.deuda > 0 ? (
                    <>
                      {" · Debe "}
                      <Money monto={cliente.deuda} className="font-semibold text-pendiente" />
                    </>
                  ) : " · Al día"}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={quitarCliente}
              >
                Cambiar
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
                  strokeWidth={2}
                />
                <Input
                  id="reg-buscar"
                  autoFocus
                  type="search"
                  value={busqueda}
                  onChange={(e) => {
                    setBusqueda(e.target.value);
                    corrigio("reg-buscar");
                  }}
                  placeholder="N° de puesto, nombre, apodo o carpeta…"
                  aria-label="Buscar cliente"
                  className="h-14 pl-11 text-lg md:text-lg"
                />
              </div>
              {avisoDe("reg-buscar")}
              {busqueda && resultados.length === 0 ? (
                <p className="rounded-lg border border-dashed px-4 py-4 text-center text-sm text-muted-foreground">
                  No encontramos a nadie con eso. Probá con el número de puesto o parte del nombre.
                </p>
              ) : null}
              {resultados.length > 0 ? (
                <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                  {resultados.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => elegirCliente(c)}
                        className="flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent active:bg-accent"
                      >
                        <span className="w-10 shrink-0 text-right font-display text-base font-bold tabular">
                          {c.codigo}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {c.nombre}
                            {c.apodo ? <span className="text-muted-foreground"> · {c.apodo}</span> : null}
                          </span>
                          <span className="mt-0.5 flex flex-wrap gap-1">
                            {c.lugares.map((l) => (
                              <span key={l.id} className="rounded bg-muted px-1.5 py-px text-xs font-medium">
                                {l.etiqueta}
                              </span>
                            ))}
                            {!c.tienePortal ? <Sello estado="sin_portal" /> : null}
                          </span>
                        </span>
                        {c.deuda > 0 ? (
                          <Money monto={c.deuda} className="shrink-0 text-sm font-semibold text-pendiente" />
                        ) : (
                          <Sello estado="al_dia" className="shrink-0" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {cliente && cliente.lugares.length > 0 ? (
        <section className="space-y-2" aria-labelledby="reg-lugar">
          <h2 id="reg-lugar" className="text-base font-semibold">
            ¿Sobre qué lugar? <span className="font-normal text-muted-foreground">(opcional)</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {cliente.lugares.map((l) => {
              const activo = lugarId === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => setLugarId(activo ? null : l.id)}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
                    activo ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"
                  )}
                >
                  <MapPin className="size-4" strokeWidth={2} />
                  {l.etiqueta}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* 2. ¿Qué es? */}
      <section className="space-y-3" aria-labelledby="reg-tipo">
        <h2 id="reg-tipo" className="font-display text-lg font-bold tracking-tight">
          ¿Qué es?
        </h2>
        <div role="group" aria-label="Tipo de registro" className="grid gap-2 sm:grid-cols-3">
          {TIPOS_REGISTRO.map((t) => {
            const activo = tipo === t.valor;
            return (
              <button
                key={t.valor}
                type="button"
                aria-pressed={activo}
                onClick={() => {
                  setTipo(t.valor);
                  if (!t.llevaMulta) setConMulta(false);
                  corrigio("reg-multa");
                  corrigio("reg-vence");
                }}
                className={cn(
                  "flex min-h-16 flex-col items-start justify-center gap-1 rounded-lg border px-4 py-3 text-left transition-colors",
                  activo ? "border-primary bg-accent ring-2 ring-primary/30" : "bg-card hover:bg-accent/60"
                )}
              >
                <span className="flex items-center gap-2">
                  <Sello estado={t.valor} />
                  {activo ? <Check className="size-4 text-primary" strokeWidth={2.5} /> : null}
                </span>
                <span className="text-xs leading-snug text-muted-foreground">{t.ayuda}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. Qué pasó */}
      <section className="space-y-5" aria-label="Qué pasó">
        <div className="space-y-2">
          <Label htmlFor="reg-titulo" className="text-base">
            Título
          </Label>
          <Input
            id="reg-titulo"
            value={titulo}
            onChange={(e) => {
              setTitulo(e.target.value);
              corrigio("reg-titulo");
            }}
            maxLength={200}
            autoComplete="off"
            placeholder="Ej.: Falta de limpieza del puesto"
            className="h-12 text-base md:text-base"
          />
          {avisoDe("reg-titulo")}
          <div className="flex flex-wrap gap-2 pt-1">
            {TITULOS_SUGERIDOS[tipo].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setTitulo(s);
                  corrigio("reg-titulo");
                }}
                className={cn(
                  "min-h-11 rounded-full border px-3 text-sm transition-colors",
                  titulo === s ? "border-primary bg-accent" : "bg-card hover:bg-accent/60"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reg-detalle" className="text-base">
            Qué pasó <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Textarea
            id="reg-detalle"
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            rows={4}
            maxLength={8000}
            placeholder="Contalo como se lo dirías en persona: qué, cuándo y qué tiene que hacer."
            className="min-h-28 text-base md:text-base"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="reg-fecha" className="text-base">
              Fecha
            </Label>
            <Input
              id="reg-fecha"
              type="date"
              value={fecha}
              max={fechaHoy}
              onChange={(e) => {
                setFecha(e.target.value);
                corrigio("reg-fecha");
              }}
              className="h-12 text-base md:text-base"
            />
            {avisoDe("reg-fecha")}
          </div>
          <div className="space-y-2">
            <span className="block text-base font-medium">
              Foto o PDF <span className="font-normal text-muted-foreground">(opcional)</span>
            </span>
            <div className="flex gap-2">
              <Label
                htmlFor="reg-archivo"
                className="inline-flex h-12 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md border bg-card px-4 text-sm font-medium hover:bg-muted"
              >
                <Camera className="size-5 shrink-0" strokeWidth={2} />
                <span className="truncate">{nombreArchivo ?? "Sacar una foto o elegir archivo"}</span>
              </Label>
              {nombreArchivo ? (
                <Button type="button" variant="ghost" className="h-12" onClick={quitarArchivo} aria-label="Quitar el archivo">
                  <X className="size-4" strokeWidth={2} />
                </Button>
              ) : null}
            </div>
            <input
              ref={archivoRef}
              id="reg-archivo"
              name="archivo"
              type="file"
              accept={ACCEPT_ADJUNTO_REGISTRO}
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                const pesado = errorPesoAdjunto(f);
                if (pesado) {
                  quitarArchivo();
                  mostrarError(pesado, "reg-archivo");
                  return;
                }
                corrigio("reg-archivo");
                setNombreArchivo(f?.name ?? null);
              }}
            />
            <p className="text-sm text-muted-foreground">{AYUDA_PESO_ADJUNTO}</p>
            {avisoDe("reg-archivo")}
          </div>
        </div>
      </section>

      {/* 4. Multa (apercibimiento o sanción) */}
      {info.llevaMulta ? (
        <section className="space-y-4" aria-label="Multa">
          <label
            className={cn(
              "flex min-h-16 cursor-pointer items-center gap-4 rounded-lg border p-4 transition-colors select-none",
              conMulta ? "border-pendiente/40 bg-pendiente-suave/60" : "bg-card"
            )}
          >
            <Switch
              checked={conMulta}
              onCheckedChange={(v) => {
                setConMulta(v);
                corrigio("reg-multa");
                corrigio("reg-vence");
              }}
              className="scale-125"
            />
            <span className="space-y-0.5">
              <span className="block text-base font-semibold">¿Lleva multa?</span>
              <span className="block text-sm text-muted-foreground">
                Se suma a la cuenta del cliente como un cargo más (Multas).
              </span>
            </span>
          </label>

          {conMulta ? (
            <div className="grid gap-5 rounded-lg border p-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="reg-multa" className="text-base">
                  Monto de la multa
                </Label>
                <Input
                  id="reg-multa"
                  inputMode="numeric"
                  autoComplete="off"
                  value={multa}
                  onChange={(e) => {
                    setMulta(e.target.value.replace(/\D/g, "").slice(0, 10));
                    corrigio("reg-multa");
                  }}
                  placeholder="0"
                  className="h-12 text-lg tabular md:text-lg"
                />
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {montoMulta > 0 ? (
                    <>
                      Son <Money monto={montoMulta} className="font-semibold text-foreground" />
                    </>
                  ) : (
                    "Escribí solo números o elegí un monto:"
                  )}
                </p>
                {avisoDe("reg-multa")}
                <div className="flex flex-wrap gap-2">
                  {MULTAS_RAPIDAS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setMulta(String(m));
                        corrigio("reg-multa");
                      }}
                      className={cn(
                        "min-h-11 rounded-full border px-3 text-sm font-medium tabular transition-colors",
                        montoMulta === m ? "border-primary bg-accent" : "bg-card hover:bg-accent/60"
                      )}
                    >
                      {formatARS(m)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-vence" className="text-base">
                  Vence el
                </Label>
                <Input
                  id="reg-vence"
                  type="date"
                  value={vence}
                  min={fechaHoy}
                  onChange={(e) => {
                    setVence(e.target.value);
                    corrigio("reg-vence");
                  }}
                  className="h-12 text-base md:text-base"
                />
                {avisoDe("reg-vence")}
                <p className="text-sm text-muted-foreground">
                  Si no lo cambiás, vence en {DIAS_VENCIMIENTO_MULTA} días (contando desde hoy).
                </p>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* 5. Así lo ve el socio */}
      {cliente && titulo.trim() ? (
        <section className="space-y-2" aria-labelledby="reg-vista">
          <h2 id="reg-vista" className="flex items-center gap-2 text-base font-semibold">
            <Eye className="size-4 text-primary" strokeWidth={2} />
            Así lo ve el socio
          </h2>
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="space-y-3 rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Sello estado={tipo} />
                <Sello estado="nueva_comunicacion" />
                {tipo !== "notificacion" ? <Sello estado="a_responder" /> : null}
              </div>
              <p className="text-lg font-semibold leading-snug">{titulo.trim()}</p>
              <p className="text-sm text-muted-foreground">
                {info.label} · <span className="tabular">{formatFecha(fecha)}</span>
                {lugar ? ` · ${lugar.etiqueta}` : ""}
              </p>
              {detalle.trim() ? (
                <p className="line-clamp-4 whitespace-pre-line text-[15px] leading-relaxed">{detalle.trim()}</p>
              ) : null}
              {lleva ? (
                <p className="rounded-md bg-pendiente-suave px-3 py-2 text-[15px]">
                  Multa <Money monto={montoMulta} className="font-bold text-pendiente" /> · Se sumó a tu cuenta
                  · vence el <span className="tabular">{formatFecha(vence)}</span>
                </p>
              ) : null}
              <p className="text-sm text-muted-foreground">
                {tipo === "notificacion"
                  ? "Abajo tiene un botón para responder."
                  : "Abajo tiene el botón “Presentar mi descargo”."}
              </p>
            </div>
            {!cliente.tienePortal ? (
              <p className="mt-3 flex items-start gap-2 text-sm font-medium text-parcial">
                <UserX className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
                {cliente.nombre} no tiene usuario del portal: queda registrado, pero avisale en persona.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {error && !campoError ? <AvisoError mensaje={error} /> : null}

      {/* Siempre se puede tocar: si falta algo, el cartel de arriba dice qué. Un nombre
          largo baja de renglón en vez de cortarse (es a quién le llega). */}
      <Button
        type="submit"
        size="lg"
        disabled={pendiente}
        className="h-auto min-h-14 w-full gap-2 py-3 text-base font-semibold whitespace-normal"
      >
        {pendiente ? <Spinner className="size-5" /> : <Send className="size-5" strokeWidth={2} />}
        <span className="min-w-0 text-center leading-snug break-words">{textoBoton}</span>
      </Button>
    </form>
  );
}
