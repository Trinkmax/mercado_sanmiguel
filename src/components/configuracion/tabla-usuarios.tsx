"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cambiarActivoUsuario } from "@/lib/actions/usuarios";
import { LABEL_ROL } from "@/lib/roles";
import type { Rol } from "@/lib/auth";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type UsuarioFila = {
  user_id: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
};

export function TablaUsuarios({
  usuarios,
  miUserId,
  miEmail,
  puedeGestionar,
}: {
  usuarios: UsuarioFila[];
  miUserId: string;
  miEmail: string;
  /** Solo admin/consejo pueden activar/desactivar (la RLS lo exige igual). */
  puedeGestionar: boolean;
}) {
  const [pendiente, setPendiente] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function cambiarActivo(usuario: UsuarioFila, activo: boolean) {
    setPendiente(usuario.user_id);
    startTransition(async () => {
      const res = await cambiarActivoUsuario({
        user_id: usuario.user_id,
        activo,
      });
      if (!res.ok) toast.error(res.error);
      else
        toast.success(
          activo
            ? `${usuario.nombre} puede volver a entrar.`
            : `${usuario.nombre} ya no puede entrar.`
        );
      setPendiente(null);
    });
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table className="text-sm">
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Nombre</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead className="pr-4">Activo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usuarios.map((usuario) => {
            const soyYo = usuario.user_id === miUserId;
            return (
              <TableRow key={usuario.user_id} className="h-14">
                <TableCell className="pl-4">
                  <p className="font-medium">
                    {usuario.nombre}
                    {soyYo ? (
                      <span className="ml-2 text-muted-foreground">(vos)</span>
                    ) : null}
                  </p>
                  {soyYo ? (
                    <p className="text-muted-foreground">{miEmail}</p>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {LABEL_ROL[usuario.rol]}
                </TableCell>
                <TableCell className="pr-4">
                  {puedeGestionar ? (
                    <Switch
                      checked={usuario.activo}
                      disabled={soyYo || pendiente === usuario.user_id}
                      onCheckedChange={(activo) => cambiarActivo(usuario, activo)}
                      aria-label={`${usuario.nombre} activo`}
                      title={
                        soyYo ? "No podés desactivar tu propio usuario." : undefined
                      }
                    />
                  ) : (
                    <span className="text-muted-foreground">
                      {usuario.activo ? "Activo" : "Inactivo"}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
