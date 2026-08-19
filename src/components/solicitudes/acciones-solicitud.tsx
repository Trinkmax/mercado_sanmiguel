"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Rol } from "@/lib/auth";
import { avanzarSolicitud } from "@/lib/actions/solicitudes";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { LABEL_ESTADO, type EstadoSolicitud } from "./constantes";
import { accionesPara, type DefAccion } from "./acciones";

export type UsuarioAsignable = { user_id: string; nombre: string };

/**
 * Panel "Acciones" del detalle de una solicitud. Muestra solo lo que el rol
 * puede hacer en el estado actual; las que necesitan texto abren un Dialog
 * corto. Todo pasa por la RPC `avanzar_solicitud`.
 */
export function AccionesSolicitud({
  solicitudId,
  estado,
  rol,
  tieneResolucion,
  admins,
}: {
  solicitudId: string;
  estado: EstadoSolicitud;
  rol: Rol;
  tieneResolucion: boolean;
  admins: UsuarioAsignable[];
}) {
  const router = useRouter();
  const [abierta, setAbierta] = useState<DefAccion | null>(null);
  const [texto, setTexto] = useState("");
  const [usuarioId, setUsuarioId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const acciones = accionesPara(rol, estado);
  if (acciones.length === 0) return null;

  function ejecutar(def: DefAccion, conTexto?: string, conUsuario?: string) {
    startTransition(async () => {
      const res = await avanzarSolicitud({
        solicitudId,
        accion: def.accion,
        texto: conTexto,
        usuarioId: conUsuario,
      });
      if (!res.ok) {
        if (abierta) setError(res.error);
        else toast.error(res.error);
        return;
      }
      toast.success(`${def.exito} · ${LABEL_ESTADO[res.data.estado]}`);
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

  function confirmarDialogo() {
    if (!abierta) return;
    const t = texto.trim();
    const textoObligatorio =
      abierta.conTexto === "obligatorio" ||
      (abierta.accion === "asignar" && !tieneResolucion);
    if (textoObligatorio && !t) {
      setError(
        abierta.accion === "rechazar"
          ? "Contá por qué se rechaza."
          : abierta.accion === "asignar"
            ? "Escribí qué tiene que hacer Administración."
            : "Escribí la resolución."
      );
      return;
    }
    ejecutar(
      abierta,
      t || undefined,
      abierta.accion === "asignar" && usuarioId ? usuarioId : undefined
    );
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
              {pendiente && !abierta ? (
                <Spinner className="size-4" />
              ) : (
                <Icono className="size-5" strokeWidth={2} />
              )}
              {def.label}
            </Button>
          );
        })}
      </div>

      <Dialog open={abierta !== null} onOpenChange={(o) => !o && cerrarDialogo()}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          {abierta ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg">{abierta.titulo}</DialogTitle>
                <DialogDescription className="text-sm">
                  {abierta.descripcion}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="accion-texto" className="text-base">
                    {abierta.conTexto === "obligatorio" ||
                    (abierta.accion === "asignar" && !tieneResolucion)
                      ? "Texto"
                      : "Texto (opcional)"}
                  </Label>
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
                  {error ? (
                    <p className="text-sm font-medium text-pendiente">{error}</p>
                  ) : null}
                </div>

                {abierta.accion === "asignar" && admins.length > 0 ? (
                  <div className="space-y-2">
                    <Label htmlFor="accion-usuario" className="text-base">
                      ¿A quién de Administración? (opcional)
                    </Label>
                    <Select value={usuarioId} onValueChange={setUsuarioId}>
                      <SelectTrigger id="accion-usuario" className="h-12 w-full text-base">
                        <SelectValue placeholder="Cualquiera de Administración" />
                      </SelectTrigger>
                      <SelectContent>
                        {admins.map((a) => (
                          <SelectItem
                            key={a.user_id}
                            value={a.user_id}
                            className="min-h-11"
                          >
                            {a.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  className="h-12"
                  disabled={pendiente}
                  onClick={cerrarDialogo}
                >
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
