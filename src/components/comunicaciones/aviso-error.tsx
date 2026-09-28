import { AlertCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Error de un formulario de Comunicaciones o del portal: cartel rojo con ícono, letra
 * legible y el texto que dice qué hacer. Va al lado del botón que lo provocó; no tapa nada.
 * `tono="atencion"` (ámbar) es para avisos que no son un error pero piden una decisión
 * (ej.: "tu mensaje anterior ya había llegado").
 */
export function AvisoError({
  mensaje,
  titulo,
  tono = "error",
  className,
}: {
  mensaje: string;
  titulo?: string;
  tono?: "error" | "atencion";
  className?: string;
}) {
  const atencion = tono === "atencion";
  const Icono = atencion ? AlertTriangle : AlertCircle;
  return (
    <Alert
      className={cn(
        "px-4 py-3 has-[>svg]:gap-x-2.5",
        atencion
          ? "border-parcial/50 bg-parcial-suave text-foreground *:[svg]:text-parcial"
          : "border-pendiente/40 bg-pendiente-suave text-pendiente",
        className
      )}
    >
      <Icono className="size-5" strokeWidth={2} />
      {titulo ? <AlertTitle className="text-base font-semibold">{titulo}</AlertTitle> : null}
      <AlertDescription
        className={cn(
          "text-[15px] leading-relaxed font-medium",
          atencion ? "text-foreground" : "text-pendiente"
        )}
      >
        {mensaje}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Lleva al campo que falta completar: lo centra en la pantalla (así el aviso que va debajo
 * se ve aunque se abra el teclado de la tablet) y le pone el foco. Solo desde un evento.
 */
export function irAlCampo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.focus({ preventScroll: true });
}
