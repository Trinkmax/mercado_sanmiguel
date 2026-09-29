"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, FileText, Megaphone, Users, UserX, X } from "lucide-react";
import { crearCircular } from "@/lib/actions/circulares";
import {
  armarPublico,
  OPCIONES_PUBLICO,
  type SegmentoPublico,
} from "@/lib/segmentos";
import { cn, uuidV4 } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { contarPublico, type ClientePublico } from "./publico";
import { llamarAccion } from "@/lib/llamar-accion";
import { AYUDA_PESO_PDF, errorPesoAdjunto, explicarFalloEnvio, prepararAdjuntos } from "./adjuntos";
import { AvisoError, irAlCampo } from "./aviso-error";

/**
 * Alta de circular (D2): qué dice, a quién le llega ("Todos" o grupos que se suman + filtro
 * "¿Solo a los socios?") con el conteo en vivo, y si hay que confirmarla.
 * `ref` por intento (0025): si se corta el wifi y se toca "Publicar" de nuevo, no sale una
 * segunda circular (la acción devuelve la que ya estaba). Si falla, queda todo lo escrito.
 */
export function FormCircular({
  fechaHoy,
  clientes,
}: {
  fechaHoy: string;
  clientes: ClientePublico[];
}) {
  const router = useRouter();
  const archivoRef = useRef<HTMLInputElement>(null);
  const [pendiente, startTransition] = useTransition();
  const [ref] = useState(uuidV4);
  const [todos, setTodos] = useState(true);
  const [segmentos, setSegmentos] = useState<SegmentoPublico[]>([]);
  const [soloSocios, setSoloSocios] = useState(false);
  const [obligatoria, setObligatoria] = useState(true);
  const [nombrePdf, setNombrePdf] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Campo al que corresponde el error (el aviso va debajo de ese campo); null = junto al botón. */
  const [campoError, setCampoError] = useState<string | null>(null);

  const cuenta = useMemo(
    () => contarPublico(armarPublico({ todos, segmentos, soloSocios }), clientes),
    [todos, segmentos, soloSocios, clientes]
  );

  // Cuántos hay en cada grupo (con el filtro de socios aplicado), para el chip.
  const porGrupo = useMemo(() => {
    const m = new Map<SegmentoPublico, number>();
    for (const o of OPCIONES_PUBLICO)
      m.set(o.valor, contarPublico(armarPublico({ todos: false, segmentos: [o.valor], soloSocios }), clientes).total);
    return m;
  }, [clientes, soloSocios]);
  const totalTodos = useMemo(
    () => contarPublico(armarPublico({ todos: true, segmentos: [], soloSocios }), clientes).total,
    [clientes, soloSocios]
  );

  function elegirTodos() {
    setTodos(true);
    setSegmentos([]);
  }

  function alternar(s: SegmentoPublico) {
    const siguiente = segmentos.includes(s) ? segmentos.filter((x) => x !== s) : [...segmentos, s];
    setSegmentos(siguiente);
    setTodos(siguiente.length === 0);
  }

  function quitarPdf() {
    if (archivoRef.current) archivoRef.current.value = "";
    setNombrePdf(null);
  }

  function mostrarError(mensaje: string | null, campo: string | null = null) {
    setError(mensaje);
    setCampoError(mensaje ? campo : null);
  }

  /** Al corregir el campo marcado, el aviso se va. */
  function corrigio(...campos: string[]) {
    if (campoError && campos.includes(campoError)) mostrarError(null);
  }

  /** Error de validación: el aviso va debajo del campo que falta y se lleva la pantalla ahí. */
  function falta(mensaje: string, campoId: string) {
    mostrarError(mensaje, campoId);
    irAlCampo(campoId);
  }

  /** Aviso debajo de un campo, si el error es de ese campo. */
  function avisoDe(campo: string) {
    return error && campoError === campo ? <AvisoError mensaje={error} /> : null;
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente) return;
    mostrarError(null);
    const fd = new FormData(e.currentTarget);
    const archivo = fd.get("archivo");
    const conPdf = archivo instanceof File && archivo.size > 0;
    if (!String(fd.get("titulo") ?? "").trim()) {
      falta("Poné el título de la circular (ej.: Horario de ingreso de camiones).", "circ-titulo");
      return;
    }
    if (!String(fd.get("detalle") ?? "").trim() && !conPdf) {
      falta("Escribí qué dice la circular o adjuntá el PDF: si no, el socio no tiene nada para leer.", "circ-detalle");
      return;
    }
    if (!String(fd.get("fecha") ?? "").trim()) {
      falta("Poné la fecha de la circular.", "circ-fecha");
      return;
    }
    if (cuenta.total === 0) {
      mostrarError("Nadie entra en ese público: elegí otros grupos.");
      return;
    }
    fd.set("obligatoria", obligatoria ? "true" : "false");
    fd.set("todos", todos ? "true" : "false");
    fd.set("segmentos", JSON.stringify(segmentos));
    fd.set("soloSocios", soloSocios ? "true" : "false");
    fd.set("ref", ref);
    startTransition(async () => {
      const errorPeso = await prepararAdjuntos(fd, ["archivo"], { soloPdf: true });
      if (errorPeso) {
        mostrarError(errorPeso);
        return;
      }
      const res = await llamarAccion(() => crearCircular(fd));
      if (!res.ok) {
        // Queda todo lo escrito y la misma clave: tocar de nuevo no la publica dos veces.
        mostrarError(explicarFalloEnvio(res.error, fd, ["archivo"]));
        return;
      }
      const para = `${res.data.destinatarios} ${res.data.destinatarios === 1 ? "cliente" : "clientes"}`;
      if (res.data.repetido) {
        toast.info(`La circular N° ${res.data.numero} ya estaba publicada para ${para}`);
      } else {
        toast.success(`Circular N° ${res.data.numero} publicada para ${para}`);
      }
      router.push(`/comunicaciones/${res.data.id}`);
    });
  }

  const grupoTexto = todos
    ? "todos"
    : segmentos
        .map((s) => OPCIONES_PUBLICO.find((o) => o.valor === s)?.label.toLowerCase() ?? s)
        .join(" y ");

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-8">
      {/* ¿Qué dice? */}
      <section className="space-y-5" aria-label="Contenido">
        <div className="space-y-2">
          <Label htmlFor="circ-titulo" className="text-base">
            Título
          </Label>
          <Input
            id="circ-titulo"
            name="titulo"
            maxLength={200}
            autoComplete="off"
            placeholder="Ej.: Horario de ingreso de camiones — temporada alta"
            className="h-12 text-base md:text-base"
            onChange={() => corrigio("circ-titulo")}
          />
          {avisoDe("circ-titulo")}
        </div>

        <div className="space-y-2">
          <Label htmlFor="circ-detalle" className="text-base">
            Qué dice{" "}
            <span className="font-normal text-muted-foreground">(o adjuntá el PDF)</span>
          </Label>
          <Textarea
            id="circ-detalle"
            name="detalle"
            rows={6}
            maxLength={8000}
            placeholder="El texto que va a leer cada socio en el portal."
            className="min-h-36 text-base md:text-base"
            onChange={() => corrigio("circ-detalle")}
          />
          {avisoDe("circ-detalle")}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="circ-fecha" className="text-base">
              Fecha
            </Label>
            <Input
              id="circ-fecha"
              name="fecha"
              type="date"
              defaultValue={fechaHoy}
              required
              className="h-12 text-base md:text-base"
              onChange={() => corrigio("circ-fecha")}
            />
            {avisoDe("circ-fecha")}
          </div>
          <div className="space-y-2">
            <Label htmlFor="circ-archivo" className="text-base">
              PDF adjunto (opcional)
            </Label>
            <div className="flex gap-2">
              <Label
                htmlFor="circ-archivo"
                className="inline-flex h-12 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md border bg-card px-4 text-sm font-medium hover:bg-muted"
              >
                <FileText className="size-4 shrink-0" strokeWidth={2} />
                <span className="truncate">{nombrePdf ?? "Elegir PDF"}</span>
              </Label>
              {nombrePdf ? (
                <Button type="button" variant="ghost" className="h-12" onClick={quitarPdf} aria-label="Quitar el PDF">
                  <X className="size-4" strokeWidth={2} />
                </Button>
              ) : null}
            </div>
            <Input
              ref={archivoRef}
              id="circ-archivo"
              name="archivo"
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                const pesado = errorPesoAdjunto(f, { soloPdf: true });
                if (pesado) {
                  quitarPdf();
                  mostrarError(pesado, "circ-archivo");
                  return;
                }
                setNombrePdf(f?.name ?? null);
                // Con el PDF ya hay algo para leer: se va el aviso de "sin texto ni PDF".
                if (f) corrigio("circ-archivo", "circ-detalle");
              }}
            />
            <p className="text-sm text-muted-foreground">{AYUDA_PESO_PDF}</p>
            {avisoDe("circ-archivo")}
          </div>
        </div>
      </section>

      {/* ¿A quién le llega? */}
      <section className="space-y-4" aria-labelledby="circ-publico">
        <div>
          <h2 id="circ-publico" className="font-display text-lg font-bold tracking-tight">
            ¿A quién le llega?
          </h2>
          <p className="text-sm text-muted-foreground">
            Tocá &ldquo;Todos&rdquo; o elegí uno o más grupos: se suman.
          </p>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Grupos">
          <ChipPublico activo={todos} onClick={elegirTodos} cantidad={totalTodos} grande>
            Todos
          </ChipPublico>
          {OPCIONES_PUBLICO.map((o) => (
            <ChipPublico
              key={o.valor}
              activo={!todos && segmentos.includes(o.valor)}
              onClick={() => alternar(o.valor)}
              cantidad={porGrupo.get(o.valor) ?? 0}
            >
              {o.label}
            </ChipPublico>
          ))}
        </div>

        <label
          className={cn(
            "flex min-h-16 cursor-pointer items-center gap-4 rounded-lg border p-4 transition-colors select-none",
            soloSocios ? "border-primary/50 bg-accent" : "bg-card"
          )}
        >
          <Switch checked={soloSocios} onCheckedChange={setSoloSocios} className="scale-125" />
          <span className="space-y-0.5">
            <span className="block text-base font-semibold">¿Solo a los socios?</span>
            <span className="block text-sm text-muted-foreground">
              {soloSocios
                ? todos
                  ? "Le llega a todos los socios de la cooperativa."
                  : `Le llega solo a los socios de ${grupoTexto}.`
                : "Le llega a todos los del grupo, sean socios o no."}
            </span>
          </span>
        </label>

        {/* Resumen en vivo */}
        <div
          aria-live="polite"
          className={cn(
            "rounded-xl border-2 p-4",
            cuenta.total === 0 ? "border-pendiente/40 bg-pendiente-suave" : "border-primary/20 bg-accent/40"
          )}
        >
          {cuenta.total === 0 ? (
            <p className="font-medium text-pendiente">
              Nadie entra en ese público: elegí otros grupos.
            </p>
          ) : (
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <p className="flex items-baseline gap-2">
                <Users className="size-5 self-center text-primary" strokeWidth={2} />
                <span>Le llega a</span>
                <span className="font-display text-2xl font-bold tabular">{cuenta.total}</span>
                <span>{cuenta.total === 1 ? "cliente" : "clientes"}</span>
              </p>
              <p className="text-sm">
                <span className="font-semibold tabular">{cuenta.conPortal}</span> lo ven en el portal
              </p>
              {cuenta.sinPortal > 0 ? (
                <p className="flex items-center gap-1.5 text-sm text-parcial">
                  <UserX className="size-4" strokeWidth={2} />
                  <span className="font-semibold tabular">{cuenta.sinPortal}</span> sin portal (avisales
                  en persona)
                </p>
              ) : null}
            </div>
          )}
        </div>
      </section>

      {/* ¿Tienen que confirmar? */}
      <label
        className={cn(
          "flex min-h-16 cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors select-none",
          obligatoria ? "border-parcial/50 bg-parcial-suave/60" : "bg-card"
        )}
      >
        <Switch checked={obligatoria} onCheckedChange={setObligatoria} className="mt-1 scale-125" />
        <span className="space-y-0.5">
          <span className="block text-base font-semibold">Recepción obligatoria</span>
          <span className="block text-sm text-muted-foreground">
            {obligatoria
              ? "Cada uno tiene que confirmar que la recibió: hasta que no la confirme, no ve su cuenta."
              : "Es informativa: vas a ver quién la abrió."}
          </span>
        </span>
      </label>

      {error && !campoError ? <AvisoError mensaje={error} /> : null}

      <Button
        type="submit"
        size="lg"
        disabled={pendiente || cuenta.total === 0}
        className="h-14 w-full text-base font-semibold sm:w-auto sm:px-8"
      >
        {pendiente ? <Spinner className="size-5" /> : <Megaphone className="size-5" strokeWidth={2} />}
        {cuenta.total > 0
          ? `Publicar para ${cuenta.total} ${cuenta.total === 1 ? "cliente" : "clientes"}`
          : "Publicar circular"}
      </Button>
    </form>
  );
}

function ChipPublico({
  activo,
  onClick,
  cantidad,
  grande = false,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  cantidad: number;
  grande?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-12 items-center gap-2 rounded-full border px-4 text-base font-medium transition-colors",
        grande && "px-5 font-semibold",
        activo
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:bg-accent",
        !activo && cantidad === 0 && "text-muted-foreground"
      )}
    >
      {activo ? <Check className="size-4" strokeWidth={2.5} /> : null}
      {children}
      <span
        className={cn(
          "rounded-full px-1.5 text-sm tabular",
          activo ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
        )}
      >
        {cantidad}
      </span>
    </button>
  );
}
