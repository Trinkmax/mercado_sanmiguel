"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MessageSquareText,
  PackageOpen,
  Send,
  ShieldAlert,
  Trash2,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn, uuidV4 } from "@/lib/utils";
import { formatFechaTS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Sello } from "@/components/shared/sello";
import { avisarSobrePuesto } from "@/lib/actions/solicitudes";
import { selloEstado, type EstadoSolicitud } from "@/components/solicitudes/constantes";
import { etiquetaEspacio } from "./geometria";
import type { AvisoPuestoPrevio, Espacio } from "./tipos";
import { llamarAccion } from "@/lib/llamar-accion";
import { AlertaError } from "@/components/cobranza/alerta-error";

const MOTIVOS: { valor: string; icono: LucideIcon }[] = [
  { valor: "Luz / electricidad", icono: Zap },
  { valor: "Limpieza / residuos", icono: Trash2 },
  { valor: "Mercadería en el pasillo", icono: PackageOpen },
  { valor: "Seguridad", icono: ShieldAlert },
  { valor: "Otro", icono: MessageSquareText },
];

/**
 * Mapa del Jefe de Portería (G11): tocó un puesto → le avisa al Líder de Procesos.
 * No muestra nada de quién ocupa el puesto (el Jefe no lo sabe). Crea una solicitud tipo
 * informe con el puesto (`avisarSobrePuesto` de M7), que va directo a la bandeja del Líder.
 * Abajo, los avisos que ya se hicieron sobre ese puesto (para no repetirlos).
 */
export function AvisoPuesto({
  espacio,
  avisos,
  onCerrar,
}: {
  espacio: Espacio;
  avisos: AvisoPuestoPrevio[];
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [motivo, setMotivo] = useState<string | null>(null);
  const [detalle, setDetalle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, startTransition] = useTransition();
  // Clave de idempotencia: la misma hasta que el aviso se guarde (un corte no lo duplica);
  // otro puesto u otro texto es otro aviso: otra clave.
  const claveRef = useRef<{ firma: string; ref: string } | null>(null);
  const lugar = etiquetaEspacio(espacio);
  const numero = lugar.replace(/^(Puesto propio|Puesto|Local|Contéiner)\s+/, "");
  const sujeto = espacio.tipo === "puesto" ? `el puesto ${numero}` : lugar.toLowerCase();

  function avisar() {
    if (!motivo) return;
    if (motivo === "Otro" && detalle.trim().length < 3) {
      setError("Contá en pocas palabras qué viste.");
      return;
    }
    setError(null);
    const firma = JSON.stringify([espacio.id, motivo, detalle.trim()]);
    if (claveRef.current?.firma !== firma) claveRef.current = { firma, ref: uuidV4() };
    const ref = claveRef.current.ref;
    startTransition(async () => {
      const res = await llamarAccion(() => avisarSobrePuesto({
        espacioId: espacio.id,
        motivo,
        detalle: detalle.trim() || undefined,
        ref,
      }));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      claveRef.current = null;
      setMotivo(null);
      setDetalle("");
      toast.success(`Listo: el Líder recibió tu aviso (solicitud N° ${res.data.numero})`, {
        action: { label: "Ver", onClick: () => router.push(`/solicitudes/${res.data.id}`) },
      });
    });
  }

  return (
    <div className="relative space-y-4 p-4 @xl:p-5">
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        className="absolute top-3 right-3 size-11"
        onClick={onCerrar}
        aria-label="Cerrar"
      >
        <X className="size-5" strokeWidth={2} />
      </Button>

      <div className="pr-12">
        <p className="font-display text-lg font-bold">{lugar}</p>
        <p className="text-sm text-muted-foreground">¿Viste algo en este puesto? Avisale al Líder de Procesos.</p>
      </div>

      <div className="grid gap-4 @2xl:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="¿Qué viste?">
            {MOTIVOS.map((m) => {
              const activo = motivo === m.valor;
              const Icono = m.icono;
              return (
                <button
                  key={m.valor}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => {
                    setMotivo(activo ? null : m.valor);
                    setError(null);
                  }}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
                    activo
                      ? "border-primary bg-accent text-accent-foreground ring-1 ring-primary/30"
                      : "bg-card hover:border-primary/40 hover:bg-accent/50"
                  )}
                >
                  <Icono className="size-4" strokeWidth={2} />
                  {m.valor}
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`aviso-${espacio.id}`} className="text-sm">
              {motivo === "Otro" ? "Contá qué viste" : "Contá qué pasó (si querés)"}
            </Label>
            <Textarea
              id={`aviso-${espacio.id}`}
              value={detalle}
              maxLength={600}
              rows={2}
              placeholder="Por ejemplo: el cable del tablero está suelto"
              onChange={(e) => {
                setDetalle(e.target.value);
                setError(null);
              }}
              className="min-h-16 text-base"
            />
          </div>

          {error ? <AlertaError error={error} titulo="No se pudo avisar" /> : null}

          {/* En el celular la tarjeta tiene alto máximo y se desplaza por dentro: el botón
              queda fijo abajo mientras se completa el aviso (nunca cortado por el borde). */}
          <div className="sticky bottom-0 z-10 -mx-4 space-y-1.5 border-t bg-card px-4 pt-3 pb-4 @xl:-mx-5 @xl:px-5 @2xl:static @2xl:z-auto @2xl:m-0 @2xl:border-t-0 @2xl:bg-transparent @2xl:p-0">
            <Button
              type="button"
              size="lg"
              className="h-12 w-full text-base font-semibold @md:w-auto"
              disabled={!motivo || enviando}
              onClick={avisar}
            >
              {enviando ? <Spinner className="size-5" /> : <Send className="size-5" strokeWidth={2} />}
              Avisar al Líder sobre {sujeto}
            </Button>
            {!motivo ? <p className="text-xs text-muted-foreground">Elegí qué viste para poder avisar.</p> : null}
          </div>
        </div>

        <div className="space-y-2 @2xl:border-l @2xl:pl-4">
          <p className="text-sm font-semibold">Avisos anteriores de este puesto</p>
          {avisos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía nadie avisó nada de este puesto.</p>
          ) : (
            <ul className="space-y-1.5">
              {avisos.slice(0, 4).map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/solicitudes/${a.id}`}
                    className="flex min-h-11 items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 transition-colors hover:border-primary/35 hover:bg-accent/50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm leading-snug font-medium break-words">
                        {a.asunto.replace(/^[^:]+:\s*/, "")}
                      </span>
                      <span className="block text-xs text-muted-foreground tabular">
                        N° {a.numero} · {formatFechaTS(a.creadaEn)}
                      </span>
                    </span>
                    <Sello estado={selloEstado(a.estado as EstadoSolicitud)} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
