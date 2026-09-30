"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  ClipboardCheck,
  DoorOpen,
  HandCoins,
  Landmark,
  Loader2,
  Search,
  ShieldCheck,
  Store,
  Tractor,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LABEL_ROL } from "@/lib/roles";
import type { Rol } from "@/lib/auth";
import { llamarAccion } from "@/lib/llamar-accion";
import {
  buscarClientesVista,
  cambiarVista,
  type ClienteVista,
  type RolVista,
} from "@/lib/actions/vista";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const ROLES: { rol: RolVista; label: string; detalle: string; icono: LucideIcon }[] = [
  { rol: "lider", label: "Líder de Procesos", detalle: "Aprueba y opera todo", icono: ClipboardCheck },
  { rol: "admin", label: "Administración", detalle: "Cobra y arma la caja mayor", icono: HandCoins },
  { rol: "tesoreria", label: "Tesorería", detalle: "Valida, concilia, cheques y gastos", icono: Landmark },
  { rol: "guardia", label: "Jefe de Portería", detalle: "Quinteros y ambulantes, rinde la caja", icono: Tractor },
  { rol: "porteria", label: "Portería", detalle: "Canon de transporte e ingresos", icono: DoorOpen },
  { rol: "socio", label: "Portal de un socio", detalle: "Vista previa de solo lectura", icono: Store },
];

/**
 * "Ver el sistema como": solo para el superadministrador. Cambia su rol de verdad (mismo
 * panel y mismos permisos que ese rol) o abre el portal de un cliente como vista previa.
 */
export function SelectorVista({
  rolActual,
  clienteVista,
  variante = "claro",
  className,
}: {
  rolActual: Rol;
  /** Nombre del cliente cuyo portal se está viendo (solo con rol socio). */
  clienteVista?: string | null;
  variante?: "barra" | "claro";
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [paso, setPaso] = useState<"roles" | "socio">("roles");
  const [buscar, setBuscar] = useState("");
  const [clientes, setClientes] = useState<ClienteVista[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const [eligiendo, setEligiendo] = useState<string | null>(null);
  const pedidoRef = useRef(0);

  // Lista de clientes para el portal: al entrar al paso y al escribir (con una pausa).
  useEffect(() => {
    if (!abierto || paso !== "socio") return;
    const n = ++pedidoRef.current;
    const t = setTimeout(async () => {
      const res = await llamarAccion(() => buscarClientesVista(buscar));
      if (n !== pedidoRef.current) return;
      if (res.ok) {
        setClientes(res.data);
        setError(null);
      } else {
        setError(res.error);
      }
    }, buscar ? 300 : 0);
    return () => clearTimeout(t);
  }, [abierto, paso, buscar]);

  function cambiar(rol: RolVista, clienteId?: string) {
    setError(null);
    setEligiendo(clienteId ?? rol);
    startTransition(async () => {
      const res = await llamarAccion(() => cambiarVista({ rol, clienteId: clienteId ?? null }));
      if (!res.ok) {
        setError(res.error);
        setEligiendo(null);
        return;
      }
      // Recarga completa: todo el panel (navegación, permisos, datos) pasa al rol nuevo.
      window.location.assign(res.data.ruta);
    });
  }

  const actual =
    rolActual === "socio" && clienteVista
      ? `Portal de ${clienteVista}`
      : LABEL_ROL[rolActual] ?? rolActual;

  return (
    <Dialog
      open={abierto}
      onOpenChange={(o) => {
        if (pendiente) return;
        setAbierto(o);
        if (!o) {
          setPaso("roles");
          setBuscar("");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-h-11 w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors outline-none focus-visible:ring-2",
            variante === "barra"
              ? "border-sidebar-border bg-sidebar-accent/40 text-sidebar-foreground hover:bg-sidebar-accent focus-visible:ring-sidebar-ring"
              : "border-primary/30 bg-accent text-accent-foreground hover:bg-accent/80 focus-visible:ring-ring",
            className
          )}
        >
          <ShieldCheck className="size-5 shrink-0" strokeWidth={1.8} />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block text-xs opacity-80">Ver el sistema como</span>
            <span className="block text-sm font-semibold break-words">{actual}</span>
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {paso === "roles" ? "Ver el sistema como…" : "¿El portal de qué cliente?"}
          </DialogTitle>
          <DialogDescription>
            {paso === "roles"
              ? "Entrás al panel de ese rol con sus mismos permisos. Podés volver cuando quieras."
              : "Lo ves como lo ve el socio, sin guardar nada: no marca nada como visto ni acepta nada en su nombre."}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle className="text-sm">{error}</AlertTitle>
          </Alert>
        ) : null}

        {paso === "roles" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {ROLES.map(({ rol, label, detalle, icono: Icono }) => {
              const esActual = rol === rolActual && rol !== "socio";
              const cargando = pendiente && eligiendo === rol;
              return (
                <button
                  key={rol}
                  type="button"
                  disabled={pendiente || esActual}
                  aria-current={esActual ? "true" : undefined}
                  onClick={() => (rol === "socio" ? setPaso("socio") : cambiar(rol))}
                  className={cn(
                    "flex min-h-16 items-start gap-3 rounded-xl border bg-card p-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    esActual
                      ? "border-primary bg-accent text-accent-foreground"
                      : "hover:border-primary/40 hover:bg-accent/50 disabled:opacity-60"
                  )}
                >
                  {cargando ? (
                    <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin" />
                  ) : (
                    <Icono className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.8} />
                  )}
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">
                      {label}
                      {esActual ? " · ahora" : ""}
                    </span>
                    <span className="block text-sm text-muted-foreground">{detalle}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 gap-2 px-2"
              disabled={pendiente}
              onClick={() => {
                setPaso("roles");
                setError(null);
              }}
            >
              <ArrowLeft className="size-4" />
              Volver a los roles
            </Button>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
                placeholder="Nombre, apodo o N° de carpeta"
                aria-label="Buscar cliente por nombre, apodo o número de carpeta"
                className="h-12 pl-9"
              />
            </div>
            <ul className="max-h-[45dvh] space-y-1.5 overflow-y-auto overscroll-contain">
              {clientes === null ? (
                <li className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Buscando…
                </li>
              ) : clientes.length === 0 ? (
                <li className="p-3 text-sm text-muted-foreground">
                  {buscar ? "No encontramos ese cliente." : "Todavía no hay clientes cargados."}
                </li>
              ) : (
                clientes.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      disabled={pendiente}
                      onClick={() => cambiar("socio", c.id)}
                      className="flex min-h-12 w-full items-center gap-3 rounded-lg border bg-card px-3 py-2 text-left hover:bg-accent/50 disabled:opacity-60 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="shrink-0 font-display text-sm font-bold tabular text-muted-foreground">
                        {c.codigo}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold break-words">{c.nombre}</span>
                        <span className="block text-sm text-muted-foreground">
                          {[c.apodo ? `“${c.apodo}”` : null, c.activo ? null : "dado de baja"]
                            .filter(Boolean)
                            .join(" · ") || " "}
                        </span>
                      </span>
                      {pendiente && eligiendo === c.id ? (
                        <Loader2 className="size-4 shrink-0 animate-spin" />
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
