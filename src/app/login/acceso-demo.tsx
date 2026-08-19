"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ClipboardCheck,
  DoorOpen,
  FileBarChart2,
  HandCoins,
  Loader2,
  Store,
  Truck,
  Vault,
} from "lucide-react";
import { entrarComoDemo, type RolDemo } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

const ROLES: {
  rol: RolDemo;
  label: string;
  detalle: string;
  icono: typeof HandCoins;
}[] = [
  { rol: "admin", label: "Administración", detalle: "Cobra, cheques, caja mayor", icono: HandCoins },
  { rol: "lider", label: "Líder de Procesos", detalle: "Aprueba, personal, reportes", icono: ClipboardCheck },
  { rol: "guardia", label: "Jefe de Portería", detalle: "Quinteros, canon, rinde caja", icono: Truck },
  { rol: "porteria", label: "Portería", detalle: "Ingresos de personal", icono: DoorOpen },
  { rol: "tesoreria", label: "Tesorería", detalle: "Valida, concilia, cheques", icono: Vault },
  { rol: "consejo", label: "Consejo", detalle: "Reportes y resoluciones", icono: FileBarChart2 },
  { rol: "socio", label: "Socio", detalle: "El portal del puestero", icono: Store },
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
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Modo demo — entrá como
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {ROLES.map(({ rol, label, detalle, icono: Icono }) => (
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
          </button>
        ))}
      </div>
    </div>
  );
}
