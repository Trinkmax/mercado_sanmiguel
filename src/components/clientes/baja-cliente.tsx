"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleAlert, Send, UserCheck, UserX } from "lucide-react";
import type { Rol } from "@/lib/auth";
import { darDeBajaCliente, reactivarCliente } from "@/lib/actions/clientes";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { TOAST_ENVIADO_APROBACION, aplicaDirectoRol } from "./constantes";

/**
 * Baja lógica del cliente (con motivo) o reactivación. El Líder aplica
 * directo; los demás roles envían la propuesta a aprobación.
 */
export function BajaCliente({
  clienteId,
  nombre,
  activo,
  rol,
}: {
  clienteId: string;
  nombre: string;
  activo: boolean;
  rol: Rol;
}) {
  const router = useRouter();
  const directo = aplicaDirectoRol(rol);
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [toco, setToco] = useState(false);
  const [pendiente, startTransition] = useTransition();

  const motivoOk = motivo.trim().length >= 3;

  function darDeBaja() {
    setToco(true);
    if (!motivoOk) return;
    startTransition(async () => {
      const res = await darDeBajaCliente({ clienteId, motivo });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.data.estado === "aplicado") {
        toast.success(`${nombre} quedó dado de baja`);
      } else {
        toast.success(TOAST_ENVIADO_APROBACION, {
          description: `${nombre} sigue activo hasta que el Líder de Procesos apruebe la baja.`,
        });
      }
      setAbierto(false);
      setMotivo("");
      setToco(false);
      router.refresh();
    });
  }

  function reactivar() {
    startTransition(async () => {
      const res = await reactivarCliente({ clienteId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.data.estado === "aplicado") {
        toast.success(`${nombre} está activo de nuevo`);
      } else {
        toast.success(TOAST_ENVIADO_APROBACION, {
          description: "La reactivación se aplica cuando el Líder de Procesos la apruebe.",
        });
      }
      setAbierto(false);
      router.refresh();
    });
  }

  if (!activo) {
    return (
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogTrigger asChild>
          <Button variant="outline" size="lg" className="h-12 px-5 text-base">
            <UserCheck className="size-5" strokeWidth={2} />
            Reactivar
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Reactivar a {nombre}?</DialogTitle>
            <DialogDescription>
              Vuelve a la lista de clientes activos y a la facturación mensual
              con los conceptos que tenga cargados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="h-11 px-4"
              onClick={() => setAbierto(false)}
              disabled={pendiente}
            >
              No, dejarlo
            </Button>
            <Button
              className="h-11 px-4 font-semibold"
              onClick={reactivar}
              disabled={pendiente}
            >
              {pendiente ? (
                <Spinner className="size-4" />
              ) : directo ? (
                <UserCheck className="size-4" />
              ) : (
                <Send className="size-4" />
              )}
              {directo ? "Sí, reactivarlo" : "Enviar a aprobación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (!v) {
          setMotivo("");
          setToco(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="lg"
          className="h-12 px-4 text-base text-destructive hover:text-destructive"
        >
          <UserX className="size-5" strokeWidth={2} />
          Dar de baja
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dar de baja a {nombre}</DialogTitle>
          <DialogDescription>
            Deja de facturarse desde el próximo mes y sale de la lista de
            activos. Su cuenta y su carpeta quedan guardadas; se puede
            reactivar cuando haga falta.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="baja-motivo" className="text-base">
            ¿Por qué se da de baja?
          </Label>
          <Textarea
            id="baja-motivo"
            rows={3}
            placeholder="Ej.: dejó el puesto 14 a fin de mes"
            className="text-base"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            onBlur={() => setToco(true)}
            aria-invalid={toco && !motivoOk}
          />
          {toco && !motivoOk ? (
            <p className="flex items-center gap-1.5 text-sm font-medium text-pendiente">
              <CircleAlert className="size-4 shrink-0" strokeWidth={2} />
              Contá por qué se da de baja (queda en el registro del cambio).
            </p>
          ) : null}
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            className="h-11 px-4"
            onClick={() => setAbierto(false)}
            disabled={pendiente}
          >
            No, dejarlo
          </Button>
          <Button
            variant="destructive"
            className="h-11 px-4 font-semibold"
            onClick={darDeBaja}
            disabled={pendiente}
          >
            {pendiente ? (
              <Spinner className="size-4" />
            ) : directo ? (
              <UserX className="size-4" />
            ) : (
              <Send className="size-4" />
            )}
            {directo ? "Sí, darlo de baja" : "Enviar a aprobación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
