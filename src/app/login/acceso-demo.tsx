"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ClipboardCheck,
  DoorOpen,
  HandCoins,
  Landmark,
  Loader2,
  Store,
  Tractor,
} from "lucide-react";
import { entrarComoDemo, type RolDemo } from "@/lib/actions/auth";
import { formatDni } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Seis roles (el Consejo ya no tiene usuario, F5). El DNI es el de login de cada demo. */
const ROLES: {
  rol: RolDemo;
  label: string;
  detalle: string;
  dni: string;
  icono: typeof HandCoins;
}[] = [
  { rol: "lider", label: "Líder de Procesos", detalle: "Aprueba y puede hacer todo", dni: "20111111", icono: ClipboardCheck },
  { rol: "admin", label: "Administración", detalle: "Cobra y arma la caja mayor", dni: "20222222", icono: HandCoins },
  { rol: "tesoreria", label: "Tesorería", detalle: "Valida, concilia, cheques y gastos", dni: "20333333", icono: Landmark },
  { rol: "guardia", label: "Jefe de Portería", detalle: "Quinteros y ambulantes, rinde la caja", dni: "20444444", icono: Tractor },
  { rol: "porteria", label: "Portería", detalle: "Canon de transporte e ingresos", dni: "20555555", icono: DoorOpen },
  { rol: "socio", label: "Socio", detalle: "Su cuenta y sus recibos", dni: "20666666", icono: Store },
];

/** Modo maqueta: entrar con un toque a cualquier rol para recorrer el sistema. */
export function AccesoDemo() {
  const [pendiente, startTransition] = useTransition();
  const [rolActivo, setRolActivo] = useState<RolDemo | null>(null);

  function entrar(rol: RolDemo) {
    setRolActivo(rol);
    startTransition(async () => {
      const res = await entrarComoDemo(rol);
      if (res?.error) {
        toast.error(res.error);
        setRolActivo(null);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium text-muted-foreground">
          Modo demo · entrá como (contraseña SanMiguel2026)
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {ROLES.map(({ rol, label, detalle, dni, icono: Icono }) => (
          <button
            key={rol}
            type="button"
            disabled={pendiente}
            onClick={() => entrar(rol)}
            className={cn(
              "flex min-h-16 flex-col items-start justify-center gap-0.5 rounded-lg border bg-card px-2.5 py-2 text-left transition-colors",
              "hover:border-primary/40 hover:bg-accent disabled:opacity-60",
              rolActivo === rol && "border-primary bg-accent"
            )}
          >
            <span className="flex items-center gap-1.5 text-[13px] font-semibold">
              {pendiente && rolActivo === rol ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Icono className="size-3.5 text-primary" strokeWidth={2} />
              )}
              {label}
            </span>
            <span className="text-xs text-muted-foreground">{detalle}</span>
            <span className="text-[11px] text-muted-foreground/80 tabular">
              DNI {formatDni(dni)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
