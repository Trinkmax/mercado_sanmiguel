"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import type { Rol } from "@/lib/auth";
import { avanzarSolicitud } from "@/lib/actions/solicitudes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { LABEL_ESTADO, type EstadoSolicitud, type OrigenSolicitud } from "./constantes";
import { accionesPara, type DefAccion } from "./acciones";
import { llamarAccion, SIN_RESPUESTA } from "@/lib/llamar-accion";
import { AlertaError } from "@/components/cobranza/alerta-error";

export type UsuarioAsignable = { user_id: string; nombre: string };

/**
 * Panel "Acciones" del detalle de una solicitud. Muestra solo lo que el rol puede hacer en
 * el estado actual; las que necesitan texto abren un Dialog corto. Todo pasa por la RPC
 * `avanzar_solicitud`, que es la autoridad.
 */
export function AccionesSolicitud({
  solicitudId,
  estado,
  origen,
  rol,
  tieneResolucion,
  admins,
}: {
  solicitudId: string;
  estado: EstadoSolicitud;
  origen?: OrigenSolicitud;
  rol: Rol;
  tieneResolucion: boolean;
  admins: UsuarioAsignable[];
}) {
  const router = useRouter();
  const [abierta, setAbierta] = useState<DefAccion | null>(null);
  const [texto, setTexto] = useState("");
  const [usuarioId, setUsuarioId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  // Error de una acción sin diálogo ("Tomarla para revisar"): se ve debajo de los botones.
  const [errorPanel, setErrorPanel] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const acciones = accionesPara(rol, { estado, origen });
  if (acciones.length === 0) return null;

  function ejecutar(def: DefAccion, conTexto?: string, conUsuario?: string) {
    setErrorPanel(null);
    startTransition(async () => {
      const res = await llamarAccion(() => avanzarSolicitud({
        solicitudId,
        accion: def.accion,
        texto: conTexto,
        usuarioId: conUsuario,
      }));
      if (!res.ok) {
        if (abierta) setError(res.error);
        else setErrorPanel(res.error);
        // Si no fue un corte, puede que otro ya la haya movido (o que el primer intento sí
        // llegó): se actualiza la pantalla para mostrar cómo está ahora.
        if (res.error !== SIN_RESPUESTA) router.refresh();
        return;
      }
      toast.success(
        def.accion === "resolver_jefe" || def.accion === "elevar"
          ? def.exito
          : `${def.exito} · ${LABEL_ESTADO[res.data.estado]}`
      );
      cerrarDialogo();
      router.refresh();
    });
  }

  function onClick(def: DefAccion) {
    if (def.conTexto) {
      setTexto("");
      setUsuarioId("");
      setError(null);
      setAbierta(def);
      return;
    }
    ejecutar(def);
  }

  function cerrarDialogo() {
    setAbierta(null);
    setTexto("");
    setUsuarioId("");
    setError(null);
  }

  const textoObligatorio = (def: DefAccion) =>
    def.conTexto === "obligatorio" || (def.accion === "asignar" && !tieneResolucion);

  function confirmarDialogo() {
    if (!abierta) return;
    const t = texto.trim();
    if (textoObligatorio(abierta) && !t) {
      setError(abierta.faltaTexto ?? "Escribí el texto.");
      return;
    }
    ejecutar(abierta, t || undefined, abierta.accion === "asignar" && usuarioId ? usuarioId : undefined);
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {acciones.map((def) => {
          const Icono = def.icono;
          return (
            <Button
              key={def.accion}
              size="lg"
              variant={def.primaria ? "default" : "outline"}
              disabled={pendiente}
              onClick={() => onClick(def)}
              className={
                def.primaria
                  ? "h-12 w-full justify-start px-4 text-base font-semibold"
                  : def.destructiva
                    ? "h-11 w-full justify-start px-4 text-sm font-medium text-destructive hover:text-destructive"
                    : "h-11 w-full justify-start px-4 text-sm font-medium"
              }
            >
              {pendiente && !abierta ? <Spinner className="size-4" /> : <Icono className="size-5" strokeWidth={2} />}
              {def.label}
            </Button>
          );
        })}
      </div>
      {errorPanel ? <AlertaError error={errorPanel} titulo="No se pudo hacer" className="mt-3" /> : null}

      <Dialog open={abierta !== null} onOpenChange={(o) => !o && !pendiente && cerrarDialogo()}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          {abierta ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg">{abierta.titulo}</DialogTitle>
                <DialogDescription className="text-sm">{abierta.descripcion}</DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="accion-texto" className="text-base">
                    {textoObligatorio(abierta) ? "Texto" : "Texto (opcional)"}
                  </Label>
                  {abierta.sugerencias?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {abierta.sugerencias.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setTexto(s);
                            setError(null);
                          }}
                          className="inline-flex min-h-11 items-center rounded-full border bg-card px-4 text-sm font-medium hover:bg-accent"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <Textarea
                    id="accion-texto"
                    rows={4}
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    placeholder={abierta.placeholder}
                    aria-invalid={Boolean(error)}
                    className="min-h-28 text-base md:text-base"
                    autoFocus
                  />
                  {error ? <AlertaError error={error} titulo="No se pudo hacer" /> : null}
                </div>

                {abierta.accion === "asignar" && admins.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-base font-medium">¿A quién de Administración? (opcional)</p>
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Persona de Administración">
                      {[{ user_id: "", nombre: "Cualquiera de Administración" }, ...admins].map((a) => {
                        const activo = usuarioId === a.user_id;
                        return (
                          <button
                            key={a.user_id || "cualquiera"}
                            type="button"
                            role="radio"
                            aria-checked={activo}
                            onClick={() => setUsuarioId(a.user_id)}
                            className={cn(
                              "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors",
                              activo
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-card hover:bg-accent"
                            )}
                          >
                            {activo ? <Check className="size-4" strokeWidth={2.5} /> : null}
                            {a.nombre}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" className="h-12" disabled={pendiente} onClick={cerrarDialogo}>
                  Volver
                </Button>
                <Button
                  size="lg"
                  variant={abierta.destructiva ? "destructive" : "default"}
                  className="h-12 font-semibold"
                  disabled={pendiente}
                  onClick={confirmarDialogo}
                >
                  {pendiente ? <Spinner /> : null}
                  {abierta.confirmar ?? abierta.label}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
