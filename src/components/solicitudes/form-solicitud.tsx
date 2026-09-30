"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, MapPin, Paperclip, Printer, Search, Store, X } from "lucide-react";
import type { Rol } from "@/lib/auth";
import { crearSolicitud } from "@/lib/actions/solicitudes";
import { cn, uuidV4 } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Sello } from "@/components/shared/sello";
import {
  ACCEPT_ADJUNTO,
  LABEL_ORIGEN,
  firmaFormulario,
  ORIGENES_SOLICITUD,
  TIPOS_SOLICITUD,
  type EstadoSolicitud,
  type OrigenSolicitud,
  type TipoSolicitud,
} from "./constantes";
import { etiquetaLugar, type LugarSimple } from "./lugares";
import { SelectorPuesto } from "./selector-puesto";
import { llamarAccion } from "@/lib/llamar-accion";
import { AlertaError } from "@/components/cobranza/alerta-error";
import {
  AYUDA_PESO_ADJUNTO,
  errorPesoAdjunto,
  explicarFalloEnvio,
  prepararAdjuntos,
} from "@/components/comunicaciones/adjuntos";

export type ClienteBuscable = {
  id: string;
  codigo: number;
  nombre: string;
  apodo: string | null;
};

type SobreQue = "cliente" | "puesto" | "general";

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Alta de solicitud desde el panel. Un solo camino: tipo → asunto → detalle → ¿sobre qué? →
 * adjunto → crear. Portería, el Jefe de Portería y Tesorería eligen el puesto por número (no
 * ven clientes); Administración y el Líder pueden además buscar un cliente. Al crear dice a
 * quién le llegó ("Le llegó al Jefe de Portería" / "Le llegó al Líder de Procesos").
 */
export function FormSolicitud(props: {
  rol: Rol;
  clientes: ClienteBuscable[];
  lugares: LugarSimple[];
  origenInicial: OrigenSolicitud;
  clienteInicialId?: string;
  espacioInicialId?: string;
  tipoInicial?: TipoSolicitud;
}) {
  // Remonta el formulario limpio con "Cargar otra".
  const [vuelta, setVuelta] = useState(0);
  return <Formulario key={vuelta} {...props} onOtra={() => setVuelta((v) => v + 1)} primera={vuelta === 0} />;
}

function Formulario({
  rol,
  clientes,
  lugares,
  origenInicial,
  clienteInicialId,
  espacioInicialId,
  tipoInicial,
  onOtra,
  primera,
}: {
  rol: Rol;
  clientes: ClienteBuscable[];
  lugares: LugarSimple[];
  origenInicial: OrigenSolicitud;
  clienteInicialId?: string;
  espacioInicialId?: string;
  tipoInicial?: TipoSolicitud;
  onOtra: () => void;
  primera: boolean;
}) {
  const [pendiente, startTransition] = useTransition();
  const conClientes = rol === "admin" || rol === "lider";
  const lugarInicial = primera ? (lugares.find((l) => l.id === espacioInicialId) ?? null) : null;
  const clienteInicial = primera && conClientes ? (clientes.find((c) => c.id === clienteInicialId) ?? null) : null;

  const [tipo, setTipo] = useState<TipoSolicitud>((primera && tipoInicial) || "solicitud");
  const [sobreQue, setSobreQue] = useState<SobreQue>(
    clienteInicial ? "cliente" : lugarInicial ? "puesto" : "general"
  );
  const [busqueda, setBusqueda] = useState("");
  const [clienteId, setClienteId] = useState<string | null>(clienteInicial?.id ?? null);
  const [lugar, setLugar] = useState<LugarSimple | null>(lugarInicial);
  const [origen, setOrigen] = useState<OrigenSolicitud>(origenInicial);
  const [nombreAdjunto, setNombreAdjunto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creada, setCreada] = useState<{ id: string; numero: number; estado: EstadoSolicitud } | null>(null);
  const adjuntoRef = useRef<HTMLInputElement>(null);
  // Clave de idempotencia: la misma mientras no cambie lo cargado y hasta que se guarde (un
  // corte de red no la renueva: tocar "Enviar" de nuevo no crea otra solicitud igual). Si la
  // persona corrige algo, es otro envío. "Cargar otra" remonta el formulario.
  const claveRef = useRef<{ firma: string; ref: string } | null>(null);

  function quitarAdjunto() {
    if (adjuntoRef.current) adjuntoRef.current.value = "";
    setNombreAdjunto(null);
  }

  const puedeElegirOrigen = conClientes;
  const clienteElegido = clientes.find((c) => c.id === clienteId) ?? null;
  const opciones: { valor: SobreQue; label: string }[] = [
    ...(conClientes ? [{ valor: "cliente" as const, label: "Un cliente" }] : []),
    { valor: "puesto", label: conClientes ? "Un lugar del plano" : "Un puesto" },
    { valor: "general", label: "Algo general" },
  ];

  const resultados = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (!q) return [];
    return clientes
      .filter(
        (c) =>
          String(c.codigo).includes(q) ||
          normalizar(c.nombre).includes(q) ||
          (c.apodo ? normalizar(c.apodo).includes(q) : false)
      )
      .slice(0, 8);
  }, [busqueda, clientes]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente) return;
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("tipo", tipo);
    fd.set("origen", origen);
    fd.delete("clienteId");
    fd.delete("espacioId");
    if (!String(fd.get("asunto") ?? "").trim()) {
      setError("Poné un asunto corto (ej.: Luminaria rota frente al puesto 7)");
      return;
    }
    if (sobreQue === "cliente") {
      if (!clienteId) {
        setError("Elegí el cliente, o marcá que es algo general.");
        return;
      }
      fd.set("clienteId", clienteId);
      fd.delete("referencia");
    } else if (sobreQue === "puesto") {
      if (!lugar) {
        setError("Escribí el número y tocá el puesto, o marcá que es algo general.");
        return;
      }
      fd.set("espacioId", lugar.id);
      fd.delete("referencia");
    }
    const firma = firmaFormulario(fd);
    if (claveRef.current?.firma !== firma) claveRef.current = { firma, ref: uuidV4() };
    fd.set("ref", claveRef.current.ref);
    startTransition(async () => {
      // Las fotos se achican antes de subir (una de la tablet pesa 3–8 MB).
      const errorPeso = await prepararAdjuntos(fd, ["adjunto"]);
      if (errorPeso) {
        setError(errorPeso);
        return;
      }
      const res = await llamarAccion(() => crearSolicitud(fd));
      if (!res.ok) {
        // Lo cargado queda en el formulario y la clave se conserva para el reintento.
        setError(explicarFalloEnvio(res.error, fd, ["adjunto"]));
        return;
      }
      toast.success(
        res.data.repetido
          ? `Ya se había enviado: es la solicitud N° ${res.data.numero}`
          : res.data.estado === "con_jefe"
            ? `Solicitud N° ${res.data.numero}: le llegó al Jefe de Portería`
            : `Solicitud N° ${res.data.numero}: le llegó al Líder de Procesos`
      );
      setCreada(res.data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  if (creada) {
    const alJefe = creada.estado === "con_jefe";
    return (
      <div className="etiqueta">
        <div className="etiqueta-interior flex flex-col items-center gap-5 py-10 text-center">
          <Sello grande estado={creada.estado} className="animar-estampado" />
          <div className="space-y-1">
            <p className="font-display text-2xl font-bold tracking-tight">
              {alJefe ? "Le llegó al Jefe de Portería" : "Le llegó al Líder de Procesos"}
            </p>
            <p className="max-w-md text-muted-foreground">
              Solicitud N° {creada.numero}.{" "}
              {alJefe
                ? "El Jefe la resuelve o, si hace falta, la eleva al Líder de Procesos. Las respuestas las ves en Solicitudes."
                : "Las respuestas y el avance los ves en Solicitudes."}
            </p>
          </div>
          <div className="flex w-full max-w-sm flex-col gap-2">
            <Button asChild size="lg" className="h-12 text-base font-semibold">
              <Link href={`/solicitudes/${creada.id}`}>Ver la solicitud</Link>
            </Button>
            <Button type="button" variant="outline" className="h-12 text-base" onClick={onOtra}>
              Cargar otra
            </Button>
            <Button asChild variant="ghost" className="h-11">
              <Link href={`/solicitudes/${creada.id}/imprimir`}>
                <Printer className="size-4" strokeWidth={2} />
                Imprimir
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-7" noValidate>
      {/* Tipo */}
      <fieldset className="space-y-2" data-tour="solicitudes-form-tipo">
        <legend className="text-base font-medium">¿Qué es?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TIPOS_SOLICITUD.map((t) => {
            const activo = tipo === t.valor;
            return (
              <button
                key={t.valor}
                type="button"
                onClick={() => setTipo(t.valor)}
                aria-pressed={activo}
                className={cn(
                  "flex min-h-12 items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-semibold transition-colors",
                  activo ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent"
                )}
              >
                {activo ? <Check className="size-4" strokeWidth={2.5} /> : null}
                {t.label}
              </button>
            );
          })}
        </div>
        <p className="text-sm text-muted-foreground">{TIPOS_SOLICITUD.find((t) => t.valor === tipo)?.ayuda}</p>
      </fieldset>

      {/* Asunto */}
      <div className="space-y-2" data-tour="solicitudes-form-asunto">
        <Label htmlFor="sol-asunto" className="text-base">
          Asunto
        </Label>
        <Input
          id="sol-asunto"
          name="asunto"
          required
          maxLength={200}
          autoComplete="off"
          defaultValue={lugarInicial ? `Aviso sobre el ${etiquetaLugar(lugarInicial)}` : undefined}
          placeholder="En pocas palabras, ¿de qué se trata?"
          className="h-12 text-base md:text-base"
        />
      </div>

      {/* Detalle */}
      <div className="space-y-2">
        <Label htmlFor="sol-detalle" className="text-base">
          Detalle
        </Label>
        <Textarea
          id="sol-detalle"
          name="detalle"
          rows={5}
          maxLength={6000}
          placeholder="Contá qué pasó o qué se pide, con fechas, lugar y quiénes estaban si aplica."
          className="min-h-32 text-base md:text-base"
        />
      </div>

      {/* ¿Sobre qué? */}
      <fieldset className="space-y-3" data-tour="solicitudes-form-sobre">
        <legend className="text-base font-medium">¿Sobre qué es?</legend>
        <div className={cn("grid gap-2", opciones.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
          {opciones.map((o) => {
            const activo = sobreQue === o.valor;
            return (
              <button
                key={o.valor}
                type="button"
                onClick={() => {
                  setSobreQue(o.valor);
                  setError(null);
                }}
                aria-pressed={activo}
                className={cn(
                  "flex min-h-12 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition-colors",
                  activo ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent"
                )}
              >
                {o.valor === "cliente" ? <Store className="size-4" strokeWidth={2} /> : null}
                {o.valor === "puesto" ? <MapPin className="size-4" strokeWidth={2} /> : null}
                {o.label}
              </button>
            );
          })}
        </div>

        {sobreQue === "puesto" ? (
          <SelectorPuesto lugares={lugares} valor={lugar} onCambiar={(l) => { setLugar(l); setError(null); }} />
        ) : sobreQue === "cliente" ? (
          clienteElegido ? (
            <div className="flex items-center justify-between gap-3 rounded-md border bg-accent/50 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="font-display text-lg font-bold tabular">{clienteElegido.codigo}</span>
                <div className="min-w-0">
                  <p className="leading-snug font-medium break-words">{clienteElegido.nombre}</p>
                  {clienteElegido.apodo ? (
                    <p className="text-sm break-words text-muted-foreground">{clienteElegido.apodo}</p>
                  ) : null}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-11 shrink-0"
                onClick={() => {
                  setClienteId(null);
                  setBusqueda("");
                }}
              >
                <X className="size-4" />
                Cambiar
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
                  strokeWidth={2}
                />
                <Input
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscá por N° de carpeta, nombre o apodo"
                  aria-label="Buscar cliente por número de carpeta, nombre o apodo"
                  className="h-12 pl-11 text-base md:text-base"
                  autoComplete="off"
                />
              </div>
              {busqueda.trim() ? (
                resultados.length === 0 ? (
                  <p className="px-1 text-sm text-muted-foreground">No encontramos ese cliente. Probá con el N° de carpeta.</p>
                ) : (
                  <ul className="divide-y overflow-hidden rounded-md border bg-card">
                    {resultados.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setClienteId(c.id);
                            setBusqueda("");
                            setError(null);
                          }}
                          className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-muted/60"
                        >
                          <span className="w-9 shrink-0 text-right font-display text-base font-bold tabular">{c.codigo}</span>
                          <span className="min-w-0 flex-1 leading-snug font-medium break-words">
                            {c.nombre}
                            {c.apodo ? <span className="ml-2 text-sm font-normal text-muted-foreground">{c.apodo}</span> : null}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
            </div>
          )
        ) : (
          <div className="space-y-2">
            <Label htmlFor="sol-referencia" className="text-base">
              ¿Dónde? (opcional)
            </Label>
            <Input
              id="sol-referencia"
              name="referencia"
              maxLength={200}
              autoComplete="off"
              placeholder="Ej.: Playón de maniobras, portón norte, baños"
              className="h-12 text-base md:text-base"
            />
          </div>
        )}
      </fieldset>

      {/* Adjunto */}
      <div className="space-y-2">
        <Label htmlFor="sol-adjunto" className="text-base">
          Foto o PDF (opcional)
        </Label>
        <div className="flex flex-wrap items-center gap-2">
          <Label
            htmlFor="sol-adjunto"
            className="inline-flex min-h-12 max-w-full min-w-0 cursor-pointer items-center gap-2 rounded-md border bg-card px-4 text-sm font-medium hover:bg-muted"
          >
            <Paperclip className="size-4 shrink-0" strokeWidth={2} />
            <span className="min-w-0 truncate">{nombreAdjunto ?? "Sacá una foto o elegí un PDF"}</span>
          </Label>
          {nombreAdjunto ? (
            <Button type="button" variant="ghost" className="h-12 px-3" onClick={quitarAdjunto}>
              <X className="size-4" strokeWidth={2} />
              Quitar
            </Button>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {nombreAdjunto ? "Se adjunta al enviar." : `Foto o PDF. ${AYUDA_PESO_ADJUNTO}`}
        </p>
        {/* <input> nativo: el Input de shadcn trae w-full y, oculto con sr-only, mide todo el ancho de la ventana. */}
        <input
          ref={adjuntoRef}
          id="sol-adjunto"
          name="adjunto"
          type="file"
          accept={ACCEPT_ADJUNTO}
          className="sr-only"
          onChange={(e) => {
            const archivo = e.target.files?.[0] ?? null;
            const pesado = errorPesoAdjunto(archivo);
            if (pesado) {
              e.target.value = "";
              setNombreAdjunto(null);
              setError(pesado);
              return;
            }
            setError(null);
            setNombreAdjunto(archivo?.name ?? null);
          }}
        />
      </div>

      {/* Origen (solo quien carga formularios de otros) */}
      {puedeElegirOrigen ? (
        <fieldset className="space-y-2" data-tour="solicitudes-form-origen">
          <legend className="text-base font-medium">¿De dónde viene?</legend>
          <div className="flex flex-wrap gap-2">
            {ORIGENES_SOLICITUD.map((o) => {
              const activo = origen === o;
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOrigen(o)}
                  aria-pressed={activo}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors",
                    activo ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent"
                  )}
                >
                  {activo ? <Check className="size-4" strokeWidth={2.5} /> : null}
                  {LABEL_ORIGEN[o]}
                </button>
              );
            })}
          </div>
          <p className="text-sm text-muted-foreground">Si estás cargando un formulario en papel, elegí de dónde vino.</p>
        </fieldset>
      ) : null}

      {error ? <AlertaError error={error} titulo="No se pudo enviar" /> : null}

      <Button
        type="submit"
        size="lg"
        disabled={pendiente}
        data-tour="solicitudes-form-enviar"
        className="h-12 w-full text-base font-semibold sm:w-auto sm:px-8"
      >
        {pendiente ? <Spinner className="size-5" /> : null}
        Enviar solicitud
      </Button>
    </form>
  );
}
