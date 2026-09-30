"use client";

import { useMemo, useState } from "react";
import { Search, UserPlus, Users, X } from "lucide-react";
import type { Rol } from "@/lib/auth";
import { LABEL_ROL, ORDEN_ROL, puedeGestionarRol } from "@/lib/roles";
import { normalizarDni } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { FilaUsuario } from "./fila-usuario";
import { NuevoUsuario } from "./nuevo-usuario";
import type { EmpleadoPadron, UsuarioFila } from "./tipos";

/** Sin tildes ni mayúsculas, para buscar "nunez" y encontrar "Núñez". */
function plano(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Usuarios del equipo (Líder) o de Portería (Jefe): alta arriba, lista abajo.
 * Filtros por rol (solo si hay más de uno) y buscador por nombre o DNI.
 */
export function ListaUsuarios({
  usuarios,
  miUserId,
  miRol,
  rolesCreables,
  empleados,
  nombresPorId,
  hayClaveAdmin,
}: {
  usuarios: UsuarioFila[];
  miUserId: string;
  miRol: Rol;
  /** Roles que este usuario puede crear (Jefe: solo Portería). */
  rolesCreables: Rol[];
  /** Padrón de Personal para elegir a quién se le crea el usuario. */
  empleados: EmpleadoPadron[];
  nombresPorId: Record<string, string>;
  hayClaveAdmin: boolean;
}) {
  const [creando, setCreando] = useState(false);
  const [filtroRol, setFiltroRol] = useState<Rol | "todos">("todos");
  const [busqueda, setBusqueda] = useState("");

  const esJefe = miRol === "guardia";
  const conteoPorRol = useMemo(() => {
    const m = new Map<Rol, number>();
    for (const u of usuarios) m.set(u.rol, (m.get(u.rol) ?? 0) + 1);
    return m;
  }, [usuarios]);
  const rolesPresentes = ORDEN_ROL.filter((r) => conteoPorRol.has(r));

  const visibles = useMemo(() => {
    const q = plano(busqueda.trim());
    const qDni = normalizarDni(busqueda);
    return usuarios.filter((u) => {
      if (filtroRol !== "todos" && u.rol !== filtroRol) return false;
      if (!q) return true;
      return plano(u.nombre).includes(q) || (qDni.length >= 3 && (u.dni ?? "").includes(qDni));
    });
  }, [usuarios, filtroRol, busqueda]);

  const activos = usuarios.filter((u) => u.activo).length;
  const rolesAsignables = miRol === "lider" ? rolesCreables : undefined;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3" data-tour="config-usuarios">
        <div>
          <h2 className="font-display text-lg font-bold">
            {esJefe ? "Usuarios de Portería" : "Equipo"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {usuarios.length === 0
              ? esJefe
                ? "Todavía no hay usuarios de Portería."
                : "Todavía no hay usuarios del equipo."
              : `${activos} ${activos === 1 ? "puede entrar" : "pueden entrar"}${
                  usuarios.length > activos ? ` · ${usuarios.length - activos} sin acceso` : ""
                }. Entran con su DNI.`}
          </p>
        </div>
        {creando ? null : (
          <Button
            size="lg"
            className="h-12 px-5 text-base font-semibold"
            onClick={() => setCreando(true)}
            disabled={!hayClaveAdmin}
            data-tour="config-nuevo-usuario"
          >
            <UserPlus className="size-5" strokeWidth={2} />
            {esJefe ? "Nuevo usuario de Portería" : "Nuevo usuario"}
          </Button>
        )}
      </div>

      {creando ? (
        <div className="relative rounded-xl border-2 border-primary/25 bg-card p-4 sm:p-5">
          <button
            type="button"
            onClick={() => setCreando(false)}
            aria-label="Cerrar el alta"
            className="absolute top-2 right-2 flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X className="size-5" strokeWidth={2} />
          </button>
          <NuevoUsuario
            rolesCreables={rolesCreables}
            empleados={empleados}
            onTerminar={() => setCreando(false)}
          />
        </div>
      ) : null}

      {usuarios.length > 0 ? (
        <>
          {(rolesPresentes.length > 1 || usuarios.length > 6) ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {rolesPresentes.length > 1 ? (
                <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por rol">
                  {(["todos", ...rolesPresentes] as const).map((r) => {
                    const activo = filtroRol === r;
                    const n = r === "todos" ? usuarios.length : (conteoPorRol.get(r) ?? 0);
                    return (
                      <button
                        key={r}
                        type="button"
                        aria-pressed={activo}
                        onClick={() => setFiltroRol(r)}
                        className={cn(
                          "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
                          activo ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"
                        )}
                      >
                        {r === "todos" ? "Todos" : LABEL_ROL[r]}
                        <span className={cn("tabular", activo ? "opacity-80" : "text-muted-foreground")}>{n}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {usuarios.length > 6 ? (
                <div className="relative sm:ml-auto sm:w-72">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscá por nombre o DNI"
                    aria-label="Buscar usuario"
                    className="h-12 bg-card pl-10 text-base md:text-base"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {visibles.length === 0 ? (
            <EmptyState
              icono={Search}
              titulo="No encontramos a nadie con eso"
              descripcion="Probá con otra parte del nombre o con el DNI sin puntos."
            />
          ) : (
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {visibles.map((u) => (
                <FilaUsuario
                  key={u.user_id}
                  usuario={u}
                  soyYo={u.user_id === miUserId}
                  puedeGestionar={puedeGestionarRol(miRol, u.rol)}
                  rolesAsignables={rolesAsignables}
                  nombresPorId={nombresPorId}
                  mostrarRol={!esJefe}
                />
              ))}
            </ul>
          )}
        </>
      ) : creando ? null : (
        <EmptyState
          icono={Users}
          titulo={esJefe ? "Todavía no hay usuarios de Portería" : "Todavía no hay usuarios"}
          descripcion={
            esJefe
              ? "Creá el primero: elegilo del personal de Portería o escaneale el DNI."
              : "Creá el primero con su DNI: le damos una contraseña para imprimir."
          }
        >
          <Button
            size="lg"
            className="mt-2 h-12 px-5 text-base font-semibold"
            onClick={() => setCreando(true)}
            disabled={!hayClaveAdmin}
            data-tour="config-crear-primero"
          >
            <UserPlus className="size-5" strokeWidth={2} />
            Crear el primero
          </Button>
        </EmptyState>
      )}
    </div>
  );
}
