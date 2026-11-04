import { LogOut } from "lucide-react";
import { cerrarSesion } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

/** «Salir»: abajo de «Mi carpeta» y también en lo que bloquea el portal (términos, circulares). */
export function BotonSalir({ className, ancla = false }: { className?: string; ancla?: boolean }) {
  return (
    <form action={cerrarSesion} className={className}>
      <button
        type="submit"
        data-tour={ancla ? "salir" : undefined}
        className={cn("boton w-full bg-transparent !text-porcelana shadow-[inset_0_0_0_0.13rem_oklch(1_0_0/0.7)] hover:bg-white/10")}
      >
        <LogOut aria-hidden strokeWidth={2.3} />
        Salir
      </button>
    </form>
  );
}
