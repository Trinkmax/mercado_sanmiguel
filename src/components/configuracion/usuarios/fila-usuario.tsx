"use client";

import { useState, useTransition } from "react";
import { KeyRound, Loader2, Pencil, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import {
  cambiarActivoUsuario,
  editarUsuario,
  restablecerContrasena,
} from "@/lib/actions/usuarios";
import type { Rol } from "@/lib/auth";
import { LABEL_ROL } from "@/lib/roles";
import { formatDni, formatFechaTS, esDniValido } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sello } from "@/components/shared/sello";
import { CampoContrasena, CampoDni } from "./campos";
import { Credencial } from "./credencial";
import { generarContrasena, inicial } from "./contrasena";
import type { UsuarioFila } from "./tipos";
import { llamarAccion } from "@/lib/llamar-accion";

type Panel = "contrasena" | "editar" | "credencial" | null;

/**
 * Una persona con acceso al sistema y lo que se puede hacer con ella, en la misma
 * fila: nueva contraseña, editar, quitar o devolver el acceso. Los paneles se
 * abren debajo (nada de ventanas encima), de a uno.
 */
export function FilaUsuario({
  usuario,
  soyYo,
  puedeGestionar,
  rolesAsignables,
  nombresPorId,
  detalle,
  mostrarRol = true,
}: {
  usuario: UsuarioFila;
  soyYo: boolean;
  /** Lo decide el padre con `puedeGestionarRol` (la base lo vuelve a controlar). */
  puedeGestionar: boolean;
  /** Solo el Líder cambia roles (y nunca el propio ni el de un socio). */
  rolesAsignables?: Rol[];
  /** user_id → nombre, para "lo quitó Marta Núñez". */
  nombresPorId: Record<string, string>;
  /** Línea extra (p. ej. "N° 12 · Puesto 58" de un socio). */
  detalle?: React.ReactNode;
  mostrarRol?: boolean;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);
  const [pendiente, startTransition] = useTransition();

  // Panel de contraseña
  const [password, setPassword] = useState("");
  // Panel de edición
  const [nombre, setNombre] = useState(usuario.nombre);
  const [dni, setDni] = useState(usuario.dni ?? "");
  const [rol, setRol] = useState<Rol>(usuario.rol);
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);

  const quienQuito = usuario.desactivadoPor ? nombresPorId[usuario.desactivadoPor] : null;
  const puedeCambiarRol = Boolean(rolesAsignables?.length) && !soyYo && usuario.rol !== "socio";

  function abrir(p: Panel) {
    if (p === "contrasena") setPassword(generarContrasena());
    if (p === "editar") {
      setNombre(usuario.nombre);
      setDni(usuario.dni ?? "");
      setRol(usuario.rol);
      setErrorEdicion(null);
    }
    setPanel((actual) => (actual === p ? null : p));
  }

  function cambiarActivo(activo: boolean) {
    startTransition(async () => {
      const res = await llamarAccion(() => cambiarActivoUsuario({ user_id: usuario.user_id, activo }));
      setConfirmarQuitar(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (activo) {
        toast.success(
          usuario.dni
            ? `${usuario.nombre} puede volver a entrar con su DNI ${formatDni(usuario.dni)}.`
            : `${usuario.nombre} puede volver a entrar.`
        );
      } else {
        toast.success(
          res.data.sesionCortada
            ? `Listo: ${usuario.nombre} ya no puede entrar. Se le cerró la sesión.`
            : `Listo: ${usuario.nombre} ya no puede entrar.`
        );
      }
    });
  }

  function guardarContrasena() {
    if (password.length < 8) {
      toast.error("La contraseña tiene que tener al menos 8 letras o números.");
      return;
    }
    startTransition(async () => {
      const res = await llamarAccion(() => restablecerContrasena({ user_id: usuario.user_id, password }));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setPanel("credencial");
    });
  }

  function guardarEdicion() {
    if (nombre.trim().length < 3) {
      setErrorEdicion("Poné el nombre y apellido.");
      return;
    }
    if (dni && !esDniValido(dni)) {
      setErrorEdicion("El DNI tiene 7 u 8 números.");
      return;
    }
    setErrorEdicion(null);
    startTransition(async () => {
      const res = await llamarAccion(() => editarUsuario({
        user_id: usuario.user_id,
        nombre: nombre.trim(),
        dni: dni || undefined,
        rol: puedeCambiarRol && rol !== usuario.rol ? rol : undefined,
      }));
      if (!res.ok) {
        setErrorEdicion(res.error);
        return;
      }
      toast.success(`Guardado: ${nombre.trim()}.`);
      setPanel(null);
    });
  }

  return (
    <li className={cn("px-4 py-4 sm:px-5", !usuario.activo && "bg-muted/40")}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full font-display text-lg font-bold",
            usuario.activo ? "bg-accent text-primary" : "bg-muted text-muted-foreground"
          )}
        >
          {inicial(usuario.nombre)}
        </span>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="min-w-0 text-base font-semibold break-words">
              {usuario.nombre}
              {soyYo ? <span className="ml-1.5 font-normal text-muted-foreground">(vos)</span> : null}
            </p>
            <Sello estado={usuario.activo ? "activo" : "inactivo"} texto={usuario.activo ? "Puede entrar" : "Sin acceso"} />
          </div>
          <p className="text-sm text-muted-foreground">
            <span className={cn("tabular", usuario.dni ? "text-foreground" : "text-parcial")}>
              {usuario.dni ? `DNI ${formatDni(usuario.dni)}` : "Sin DNI cargado: editalo para que pueda entrar con el DNI"}
            </span>
            {mostrarRol ? <span> · {LABEL_ROL[usuario.rol]}</span> : null}
          </p>
          {detalle ? <div className="text-sm text-muted-foreground">{detalle}</div> : null}
          {!usuario.activo && usuario.desactivadoEn ? (
            <p className="text-sm text-muted-foreground">
              Sin acceso desde el {formatFechaTS(usuario.desactivadoEn).slice(0, 5)}
              {quienQuito ? ` (lo quitó ${quienQuito})` : ""}.
            </p>
          ) : null}

          {puedeGestionar ? (
            <div className="flex flex-wrap gap-2 pt-2">
              {usuario.activo ? (
                <Button
                  variant={panel === "contrasena" ? "secondary" : "outline"}
                  className="min-h-11 px-3 text-sm"
                  onClick={() => abrir("contrasena")}
                  aria-expanded={panel === "contrasena"}
                >
                  <KeyRound className="size-4" strokeWidth={2} />
                  Nueva contraseña
                </Button>
              ) : null}
              <Button
                variant={panel === "editar" ? "secondary" : "outline"}
                className="min-h-11 px-3 text-sm"
                onClick={() => abrir("editar")}
                aria-expanded={panel === "editar"}
              >
                <Pencil className="size-4" strokeWidth={2} />
                Editar
              </Button>
              {usuario.activo ? (
                soyYo ? null : (
                  <Button
                    variant="ghost"
                    className="min-h-11 px-3 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setConfirmarQuitar(true)}
                    disabled={pendiente}
                  >
                    <UserX className="size-4" strokeWidth={2} />
                    Quitar acceso
                  </Button>
                )
              ) : (
                <Button
                  className="min-h-11 px-3 text-sm"
                  onClick={() => cambiarActivo(true)}
                  disabled={pendiente}
                >
                  {pendiente ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <UserCheck className="size-4" strokeWidth={2} />
                  )}
                  Devolver acceso
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Paneles, debajo de la fila */}
      {panel === "contrasena" ? (
        <div className="mt-4 space-y-4 rounded-lg border bg-card p-4 sm:ml-14">
          <CampoContrasena
            id={`pass-${usuario.user_id}`}
            valor={password}
            onCambiar={setPassword}
            titulo={`Contraseña nueva para ${usuario.nombre.split(" ")[0]}`}
          />
          <p className="text-sm text-muted-foreground">
            La anterior deja de servir apenas guardás esta.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="lg"
              className="h-12 px-5 text-base font-semibold"
              onClick={guardarContrasena}
              disabled={pendiente || password.length < 8}
            >
              {pendiente ? <Loader2 className="size-5 animate-spin" /> : <KeyRound className="size-5" strokeWidth={2} />}
              Guardar contraseña nueva
            </Button>
            <Button size="lg" variant="ghost" className="h-12 px-4 text-base" onClick={() => setPanel(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {panel === "credencial" ? (
        <div className="mt-4 sm:ml-14">
          <Credencial
            titulo="Contraseña nueva"
            nombre={usuario.nombre}
            dni={usuario.dni}
            password={password}
            onListo={() => setPanel(null)}
          />
        </div>
      ) : null}

      {panel === "editar" ? (
        <div className="mt-4 space-y-5 rounded-lg border bg-card p-4 sm:ml-14">
          <div className="space-y-2">
            <Label htmlFor={`nombre-${usuario.user_id}`} className="text-base font-semibold">
              Nombre y apellido
            </Label>
            <Input
              id={`nombre-${usuario.user_id}`}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoComplete="off"
              className="h-14 max-w-md bg-card text-lg md:text-lg"
            />
          </div>
          <CampoDni
            id={`dni-${usuario.user_id}`}
            valor={dni}
            onCambiar={setDni}
            ayuda="Con este DNI entra al sistema."
          />
          {puedeCambiarRol && rolesAsignables ? (
            <fieldset className="space-y-2">
              <legend className="text-base font-semibold">¿Qué hace en la cooperativa?</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup">
                {rolesAsignables.map((r) => (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={rol === r}
                    onClick={() => setRol(r)}
                    className={cn(
                      "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors",
                      rol === r
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-card hover:bg-accent"
                    )}
                  >
                    {LABEL_ROL[r]}
                  </button>
                ))}
              </div>
              {rol !== usuario.rol ? (
                <p className="text-sm text-parcial">
                  Pasa de {LABEL_ROL[usuario.rol]} a {LABEL_ROL[rol]}: desde que guardes ve y hace lo de su rol nuevo.
                </p>
              ) : null}
            </fieldset>
          ) : null}
          {errorEdicion ? <p className="text-sm font-medium text-destructive">{errorEdicion}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button size="lg" className="h-12 px-5 text-base font-semibold" onClick={guardarEdicion} disabled={pendiente}>
              {pendiente ? <Loader2 className="size-5 animate-spin" /> : null}
              Guardar cambios
            </Button>
            <Button size="lg" variant="ghost" className="h-12 px-4 text-base" onClick={() => setPanel(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={confirmarQuitar} onOpenChange={(v) => !pendiente && setConfirmarQuitar(v)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">¿Le quitás el acceso a {usuario.nombre}?</DialogTitle>
            <DialogDescription className="text-base">
              {usuario.nombre} no va a poder entrar más. Sus datos quedan. Si hace falta,
              le devolvés el acceso con un toque.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-5 text-base"
              onClick={() => setConfirmarQuitar(false)}
              disabled={pendiente}
            >
              No, dejalo
            </Button>
            <Button
              size="lg"
              className="h-12 bg-destructive px-5 text-base font-semibold text-white hover:bg-destructive/90"
              onClick={() => cambiarActivo(false)}
              disabled={pendiente}
            >
              {pendiente ? <Loader2 className="size-5 animate-spin" /> : <UserX className="size-5" strokeWidth={2} />}
              Quitar acceso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}
