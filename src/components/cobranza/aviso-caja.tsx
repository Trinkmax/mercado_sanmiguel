import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import type { Rol } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** La caja de HOY de quien cobra (Jefe: portería; Administración y Líder: administración). */
export type CajaDeHoy = {
  estado: "abierta" | "cerrada" | "integrada" | "validada";
  reaperturaPedida: boolean;
} | null;

/** Sin caja todavía o abierta: se cobra. Cerrada, rendida o validada: no. */
export function cajaNoDejaCobrar(caja: CajaDeHoy): boolean {
  return Boolean(caja && caja.estado !== "abierta");
}

function textos(caja: NonNullable<CajaDeHoy>, rol: Rol): { titulo: string; texto: string; boton: string } {
  if (caja.estado === "validada") {
    return {
      titulo: "Tesorería ya validó la caja de hoy",
      texto:
        rol === "lider"
          ? "Hoy no se puede cobrar más en esta caja."
          : "Hoy no se puede cobrar más en esta caja. Avisale al Líder de Procesos.",
      boton: "Ver la caja",
    };
  }
  if (rol === "guardia") {
    // Rendida (cerrada) la reabre Administración; ya recibida (integrada), solo Tesorería.
    const quienReabre = caja.estado === "integrada" ? "Tesorería" : "Administración";
    return caja.reaperturaPedida
      ? {
          titulo: "Ya rendiste la caja de portería de hoy",
          texto: `Ya pediste la reapertura: cuando ${quienReabre} la reabra, vas a poder cobrar de nuevo.`,
          boton: "Ver la caja",
        }
      : {
          titulo: "Ya rendiste la caja de portería de hoy",
          texto: "Para seguir cobrando, pedí la reapertura desde Caja.",
          boton: "Pedir la reapertura",
        };
  }
  return {
    titulo: rol === "lider" ? "La caja de administración de hoy está cerrada" : "Tu caja de hoy está cerrada",
    texto: "Para seguir cobrando, reabrila desde Caja (te pide el motivo).",
    boton: "Reabrir la caja",
  };
}

/**
 * Aviso ARRIBA de la lista y del formulario de cobro cuando la caja de hoy no está abierta:
 * se ve antes de cargar nada y lleva a donde se resuelve. El botón de cobrar queda apagado.
 */
export function AvisoCajaCerrada({
  caja,
  rol,
  className,
}: {
  caja: CajaDeHoy;
  rol: Rol;
  className?: string;
}) {
  if (!caja || !cajaNoDejaCobrar(caja)) return null;
  const t = textos(caja, rol);
  const href = rol === "lider" ? "/caja?tipo=administracion" : "/caja";
  return (
    <div
      role="status"
      data-tour="cobranza-aviso-caja"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-parcial bg-parcial-suave px-4 py-3",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 basis-60 items-start gap-3">
        <Lock className="mt-0.5 size-5 shrink-0 text-parcial" strokeWidth={2} />
        <div className="min-w-0 space-y-0.5">
          <p className="text-base font-semibold">{t.titulo}</p>
          <p className="text-sm">{t.texto}</p>
        </div>
      </div>
      <Button asChild className="h-11 px-4 text-sm font-semibold">
        <Link href={href}>
          {t.boton}
          <ArrowRight className="size-4" strokeWidth={2} />
        </Link>
      </Button>
    </div>
  );
}
