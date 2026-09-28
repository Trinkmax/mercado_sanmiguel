import type { ReactNode } from "react";
import { AlertCircle, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { SIN_RESPUESTA } from "@/lib/llamar-accion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Error de una acción de plata (cobro, caja, portería): cartel rojo con letra legible y el
 * texto que dice qué hacer. Si se cortó la red lo dice así ("Se cortó la conexión"): el
 * formulario conserva lo cargado y la misma clave, así que tocar de nuevo no duplica nada.
 * `children` va debajo del texto (p. ej. un botón para resolverlo).
 */
export function AlertaError({
  error,
  titulo = "No se pudo guardar",
  children,
  className,
}: {
  error: string;
  titulo?: string;
  children?: ReactNode;
  className?: string;
}) {
  const sinRed = error === SIN_RESPUESTA;
  const Icono = sinRed ? WifiOff : AlertCircle;
  return (
    <Alert
      aria-live="assertive"
      className={cn("border-pendiente/40 bg-pendiente-suave px-4 py-3 text-pendiente", className)}
    >
      <Icono className="size-5" strokeWidth={2} />
      <AlertTitle className="text-base font-semibold">
        {sinRed ? "Se cortó la conexión" : titulo}
      </AlertTitle>
      <AlertDescription className="text-[15px] leading-relaxed font-medium text-pendiente [&_p:not(:last-child)]:mb-3">
        <p>{error}</p>
        {children}
      </AlertDescription>
    </Alert>
  );
}

/** El error dice que la caja no está abierta (registrar_cobro / cobrar_diario, 0023). */
export function esErrorDeCajaCerrada(error: string | null): boolean {
  return Boolean(error && error.startsWith("La caja ya está cerrada"));
}
