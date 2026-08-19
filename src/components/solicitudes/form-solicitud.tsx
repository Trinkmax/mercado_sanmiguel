"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Paperclip, Printer, Search, Store, X } from "lucide-react";
import type { Rol } from "@/lib/auth";
import { crearSolicitud } from "@/lib/actions/solicitudes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Sello } from "@/components/shared/sello";
import {
  ACCEPT_ADJUNTO,
  LABEL_ORIGEN,
  ORIGENES_SOLICITUD,
  TIPOS_SOLICITUD,
  type OrigenSolicitud,
  type TipoSolicitud,
} from "./constantes";

export type ClienteBuscable = {
  id: string;
  codigo: number;
  nombre: string;
  apodo: string | null;
};

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Alta de solicitud desde el panel. Un solo camino: tipo → asunto → detalle →
 * ¿sobre un puesto? → adjunto → crear. Si el origen es portería, al crear se
 * ofrece imprimirla para derivarla en papel a Administración.
 */
export function FormSolicitud({
  rol,
  clientes,
  origenInicial,
  clienteInicialId,
}: {
  rol: Rol;
  clientes: ClienteBuscable[];
  origenInicial: OrigenSolicitud;
  clienteInicialId?: string;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [tipo, setTipo] = useState<TipoSolicitud>("solicitud");
  const [sobrePuesto, setSobrePuesto] = useState<boolean>(
    Boolean(clienteInicialId)
  );
  const [busqueda, setBusqueda] = useState("");
  const [clienteId, setClienteId] = useState<string | null>(
    clienteInicialId ?? null
  );
  const [origen, setOrigen] = useState<OrigenSolicitud>(origenInicial);
  const [nombreAdjunto, setNombreAdjunto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creada, setCreada] = useState<{
    id: string;
    numero: number;
    origen: OrigenSolicitud;
  } | null>(null);

  const puedeElegirOrigen = rol === "admin" || rol === "lider";
  const clienteElegido = clientes.find((c) => c.id === clienteId) ?? null;

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
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("tipo", tipo);
    fd.set("origen", origen);
    if (sobrePuesto) {
      if (!clienteId) {
        setError("Elegí el puesto, o marcá que no es sobre un puesto.");
        return;
      }
      fd.set("clienteId", clienteId);
      fd.delete("referencia");
    } else {
      fd.delete("clienteId");
    }
    startTransition(async () => {
      const res = await crearSolicitud(fd);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success(`Solicitud N° ${res.data.numero} creada`);
      if (res.data.origen === "porteria") {
        setCreada(res.data);
        return;
      }
      router.push(`/solicitudes/${res.data.id}`);
    });
  }

  if (creada) {
    return (
      <div className="etiqueta">
        <div className="etiqueta-interior flex flex-col items-center gap-5 py-10 text-center">
          <Sello grande estado="nueva" className="animar-estampado" />
          <div className="space-y-1">
            <p className="font-display text-2xl font-bold tracking-tight">
              Solicitud N° {creada.numero} creada
            </p>
            <p className="max-w-md text-muted-foreground">
              Imprimila para derivarla a Administración en papel. Administración
              firma el recibido y la sigue desde el sistema.
            </p>
          </div>
          <div className="flex w-full max-w-sm flex-col gap-2">
            <Button asChild size="lg" className="h-12 text-base font-semibold">
              <Link href={`/solicitudes/${creada.id}/imprimir`}>
                <Printer className="size-5" strokeWidth={2} />
                Imprimir para derivar a Administración
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11">
              <Link href={`/solicitudes/${creada.id}`}>Ver la solicitud</Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11"
              onClick={() => {
                // Mismo componente montado: volver al formulario limpio.
                setCreada(null);
                setTipo("solicitud");
                setSobrePuesto(false);
                setBusqueda("");
                setClienteId(null);
                setNombreAdjunto(null);
                setError(null);
              }}
            >
              Cargar otra
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-7">
      {/* Tipo */}
      <fieldset className="space-y-2">
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
                  activo
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-accent"
                )}
              >
                {activo ? <Check className="size-4" strokeWidth={2.5} /> : null}
                {t.label}
              </button>
            );
          })}
        </div>
        <p className="text-sm text-muted-foreground">
          {TIPOS_SOLICITUD.find((t) => t.valor === tipo)?.ayuda}
        </p>
      </fieldset>

      {/* Asunto */}
      <div className="space-y-2">
        <Label htmlFor="sol-asunto" className="text-base">
          Asunto
        </Label>
        <Input
          id="sol-asunto"
          name="asunto"
          required
          maxLength={200}
          autoComplete="off"
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

      {/* ¿Sobre un puesto? */}
      <fieldset className="space-y-3">
        <legend className="text-base font-medium">¿Es sobre un puesto?</legend>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSobrePuesto(true)}
            aria-pressed={sobrePuesto}
            className={cn(
              "flex min-h-12 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition-colors",
              sobrePuesto
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-accent"
            )}
          >
            <Store className="size-4" strokeWidth={2} />
            Sí, sobre un puesto
          </button>
          <button
            type="button"
            onClick={() => {
              setSobrePuesto(false);
              setClienteId(null);
            }}
            aria-pressed={!sobrePuesto}
            className={cn(
              "flex min-h-12 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition-colors",
              !sobrePuesto
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-accent"
            )}
          >
            No, es general
          </button>
        </div>

        {sobrePuesto ? (
          clienteElegido ? (
            <div className="flex items-center justify-between gap-3 rounded-md border bg-accent/50 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="font-display text-lg font-bold tabular">
                  {clienteElegido.codigo}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{clienteElegido.nombre}</p>
                  {clienteElegido.apodo ? (
                    <p className="truncate text-sm text-muted-foreground">
                      {clienteElegido.apodo}
                    </p>
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
                  placeholder="Buscá por N° de carpeta o nombre"
                  aria-label="Buscar puesto por número de carpeta o nombre"
                  className="h-12 pl-11 text-base md:text-base"
                  autoComplete="off"
                />
              </div>
              {busqueda.trim() ? (
                resultados.length === 0 ? (
                  <p className="px-1 text-sm text-muted-foreground">
                    No encontramos ese puesto. Probá con el N° de carpeta.
                  </p>
                ) : (
                  <ul className="divide-y overflow-hidden rounded-md border bg-card">
                    {resultados.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setClienteId(c.id);
                            setBusqueda("");
                          }}
                          className="flex min-h-12 w-full items-center gap-3 px-4 text-left transition-colors hover:bg-muted/60"
                        >
                          <span className="w-9 shrink-0 text-right font-display text-base font-bold tabular">
                            {c.codigo}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-medium">
                            {c.nombre}
                            {c.apodo ? (
                              <span className="ml-2 text-sm font-normal text-muted-foreground">
                                {c.apodo}
                              </span>
                            ) : null}
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
              Referencia (opcional)
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
          Adjunto (opcional)
        </Label>
        <div className="flex flex-wrap items-center gap-3">
          <Label
            htmlFor="sol-adjunto"
            className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-md border bg-card px-4 text-sm font-medium hover:bg-muted"
          >
            <Paperclip className="size-4" strokeWidth={2} />
            {nombreAdjunto ?? "Elegir foto o PDF"}
          </Label>
          {nombreAdjunto ? (
            <span className="text-sm text-muted-foreground">
              Se adjunta al crear.
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              PDF o foto (JPG, PNG, WEBP), hasta 20 MB.
            </span>
          )}
        </div>
        <Input
          id="sol-adjunto"
          name="adjunto"
          type="file"
          accept={ACCEPT_ADJUNTO}
          className="sr-only"
          onChange={(e) => setNombreAdjunto(e.target.files?.[0]?.name ?? null)}
        />
      </div>

      {/* Origen (solo quien carga formularios de otros) */}
      {puedeElegirOrigen ? (
        <div className="space-y-2">
          <Label htmlFor="sol-origen" className="text-base">¿De dónde viene?</Label>
          <Select
            value={origen}
            onValueChange={(v) => setOrigen(v as OrigenSolicitud)}
          >
            <SelectTrigger id="sol-origen" className="h-12 w-full text-base sm:max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORIGENES_SOLICITUD.map((o) => (
                <SelectItem key={o} value={o} className="min-h-11">
                  {LABEL_ORIGEN[o]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Si estás cargando un formulario en papel, elegí de dónde vino.
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-md bg-pendiente-suave px-4 py-3 text-sm font-medium text-pendiente">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={pendiente}
        className="h-12 w-full text-base font-semibold sm:w-auto sm:px-8"
      >
        {pendiente ? <Spinner className="size-5" /> : null}
        Crear solicitud
      </Button>
    </form>
  );
}
