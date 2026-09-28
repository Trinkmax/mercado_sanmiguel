"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { Check, Loader2, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { crearUsuario, type UsuarioCreado } from "@/lib/actions/usuarios";
import type { Rol } from "@/lib/auth";
import { DESCRIPCION_ROL, LABEL_ROL } from "@/lib/roles";
import { esDniValido, formatDni } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EscanerDni, type DatosDni } from "@/components/porteria/escaner-dni";
import { CampoContrasena, CampoDni, CampoEmailOpcional } from "./campos";
import { Credencial } from "./credencial";
import { generarContrasena } from "./contrasena";
import type { EmpleadoPadron } from "./tipos";
import { llamarAccion } from "@/lib/llamar-accion";

function plano(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

type Errores = Partial<Record<"dni" | "nombre" | "rol" | "general", string>>;

/**
 * Alta de un usuario del equipo, en una sola columna y sin ventanas:
 * ¿Quién es? (del padrón de Personal, escaneando el DNI o a mano) → ¿Qué hace?
 * (el Jefe no elige: es Portería) → contraseña legible → Crear. Termina en la
 * Credencial para imprimir.
 */
export function NuevoUsuario({
  rolesCreables,
  empleados,
  onTerminar,
}: {
  rolesCreables: Rol[];
  empleados: EmpleadoPadron[];
  onTerminar: () => void;
}) {
  const rolFijo = rolesCreables.length === 1 ? rolesCreables[0] : null;
  const [dni, setDni] = useState("");
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<Rol | null>(rolFijo);
  const [password, setPassword] = useState(() => generarContrasena());
  const [email, setEmail] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [errores, setErrores] = useState<Errores>({});
  const [creado, setCreado] = useState<UsuarioCreado | null>(null);
  const [pendiente, startTransition] = useTransition();

  const elegibles = useMemo(() => {
    const q = plano(busqueda.trim());
    const lista = empleados.filter((e) =>
      q ? plano(`${e.nombre} ${e.apellido} ${e.dni}`).includes(q) : true
    );
    return lista.slice(0, q ? 8 : 6);
  }, [empleados, busqueda]);

  const alLeerDni = useCallback((datos: DatosDni) => {
    setDni(datos.dni);
    setNombre(`${datos.nombre} ${datos.apellido}`.trim());
    setErrores({});
    toast.success(`Leímos el DNI ${formatDni(datos.dni)}.`);
  }, []);

  function elegirEmpleado(e: EmpleadoPadron) {
    setDni(e.dni);
    setNombre(`${e.nombre} ${e.apellido}`.trim());
    setErrores({});
  }

  function reiniciar() {
    setDni("");
    setNombre("");
    setRol(rolFijo);
    setPassword(generarContrasena());
    setEmail("");
    setBusqueda("");
    setErrores({});
    setCreado(null);
  }

  function crear() {
    const e: Errores = {};
    if (!esDniValido(dni)) e.dni = "El DNI tiene 7 u 8 números.";
    if (nombre.trim().length < 3) e.nombre = "Poné el nombre y apellido.";
    if (!rol) e.rol = "Elegí qué hace en la cooperativa.";
    if (password.length < 8) e.general = "La contraseña tiene que tener al menos 8 letras o números.";
    setErrores(e);
    if (Object.keys(e).length > 0 || !rol) return;

    startTransition(async () => {
      const res = await llamarAccion(() => crearUsuario({ nombre: nombre.trim(), dni, rol, password, email: email || undefined }));
      if (!res.ok) {
        setErrores({ general: res.error });
        return;
      }
      toast.success(`Listo. ${res.data.nombre} ya puede entrar con su DNI ${formatDni(res.data.dni)}.`);
      setCreado(res.data);
    });
  }

  if (creado) {
    return (
      <div className="space-y-3">
        <Credencial
          titulo="Usuario creado"
          nombre={creado.nombre}
          dni={creado.dni}
          password={password}
          onListo={onTerminar}
        />
        <Button variant="outline" className="min-h-11 px-4 text-sm" onClick={reiniciar}>
          <UserPlus className="size-4" strokeWidth={2} />
          Crear otro usuario
        </Button>
      </div>
    );
  }

  const nombreCorto = nombre.trim().split(" ")[0];

  return (
    <div className="space-y-6">
      <div className="pr-10">
        <h3 className="font-display text-lg font-bold">
          {rolFijo === "porteria" ? "Nuevo usuario de Portería" : "Nuevo usuario"}
        </h3>
        <p className="text-sm text-muted-foreground">
          Entra con su DNI y la contraseña que le damos acá.
        </p>
      </div>

      {/* 1. ¿Quién es? */}
      <section className="space-y-4">
        <h4 className="text-base font-semibold">¿Quién es?</h4>

        {empleados.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Elegilo del personal{rolFijo === "porteria" ? " de Portería" : ""} y se completa solo:
            </p>
            {empleados.length > 6 ? (
              <div className="relative max-w-sm">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscá por nombre o DNI"
                  aria-label="Buscar en el personal"
                  className="h-12 bg-card pl-10 text-base md:text-base"
                />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {elegibles.map((e) => {
                const elegido = dni === e.dni;
                return (
                  <button
                    key={e.id}
                    type="button"
                    disabled={e.conUsuario}
                    onClick={() => elegirEmpleado(e)}
                    aria-pressed={elegido}
                    className={cn(
                      "flex min-h-12 flex-col items-start justify-center rounded-lg border px-3 py-1.5 text-left transition-colors",
                      elegido ? "border-primary bg-accent" : "bg-card hover:bg-accent",
                      e.conUsuario && "cursor-not-allowed opacity-55"
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                      {elegido ? <Check className="size-4 text-primary" strokeWidth={2.4} /> : null}
                      {e.apellido}, {e.nombre}
                    </span>
                    <span className="text-xs text-muted-foreground tabular">
                      DNI {formatDni(e.dni)}
                      {e.conUsuario ? " · ya tiene usuario" : e.cargo ? ` · ${e.cargo}` : ""}
                    </span>
                  </button>
                );
              })}
              {elegibles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay nadie con ese nombre en el personal.</p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <EscanerDni onLeido={alLeerDni} disabled={pendiente} />
          <p className="text-sm text-muted-foreground">
            {empleados.length > 0 ? "O escaneale el DNI, o completalo a mano:" : "Escaneale el DNI o completalo a mano:"}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <CampoDni id="nuevo-dni" valor={dni} onCambiar={setDni} error={errores.dni} ayuda="Con este DNI va a entrar." />
          <div className="space-y-2">
            <Label htmlFor="nuevo-nombre" className="text-base font-semibold">
              Nombre y apellido
            </Label>
            <Input
              id="nuevo-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoComplete="off"
              aria-invalid={errores.nombre ? true : undefined}
              placeholder="Ej.: Luis Aguirre"
              className="h-14 bg-card text-lg md:text-lg"
            />
            {errores.nombre ? <p className="text-sm font-medium text-destructive">{errores.nombre}</p> : null}
          </div>
        </div>
      </section>

      {/* 2. ¿Qué hace? */}
      <section className="space-y-3">
        <h4 className="text-base font-semibold">¿Qué hace en la cooperativa?</h4>
        {rolFijo ? (
          <p className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
            <span className="font-semibold">{LABEL_ROL[rolFijo]}:</span> {DESCRIPCION_ROL[rolFijo].toLowerCase()}.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Rol">
            {rolesCreables.map((r) => {
              const elegido = rol === r;
              return (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={elegido}
                  onClick={() => setRol(r)}
                  className={cn(
                    "flex min-h-16 items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                    elegido ? "border-primary bg-accent ring-2 ring-primary/25" : "bg-card hover:bg-accent/60"
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                      elegido ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                    )}
                  >
                    {elegido ? <Check className="size-3" strokeWidth={3} /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-base font-semibold">{LABEL_ROL[r]}</span>
                    <span className="block text-sm text-muted-foreground">{DESCRIPCION_ROL[r]}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {errores.rol ? <p className="text-sm font-medium text-destructive">{errores.rol}</p> : null}
      </section>

      {/* 3. Contraseña y email */}
      <section className="space-y-4">
        <CampoContrasena id="nuevo-pass" valor={password} onCambiar={setPassword} />
        <CampoEmailOpcional id="nuevo-email" valor={email} onCambiar={setEmail} />
      </section>

      {errores.general ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
          {errores.general}
        </p>
      ) : null}

      <Button
        size="lg"
        className="h-12 w-full text-base font-semibold sm:w-auto sm:px-8"
        onClick={crear}
        disabled={pendiente}
      >
        {pendiente ? <Loader2 className="size-5 animate-spin" /> : <UserPlus className="size-5" strokeWidth={2} />}
        {pendiente
          ? "Creando usuario…"
          : nombreCorto
            ? `Crear el usuario de ${nombreCorto}`
            : "Crear usuario"}
      </Button>
    </div>
  );
}
