"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, BookOpen, CircleHelp, History, Route, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CAPITULOS_META, RECORRIDOS, capituloDeRuta, nombreRol } from "@/lib/tour/indice";
import { useTour } from "@/components/tour/proveedor-tour";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function Opcion({
  icono: Icono,
  titulo,
  detalle,
  destacada = false,
  onClick,
}: {
  icono: LucideIcon;
  titulo: string;
  detalle: string;
  destacada?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3.5 rounded-xl border p-3.5 text-left transition-colors active:scale-[0.99]",
        destacada
          ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
          : "border-border bg-card hover:bg-accent"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl",
          destacada ? "bg-white/15" : "bg-accent text-accent-foreground"
        )}
      >
        <Icono className="size-5.5" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[1.05rem] leading-snug font-bold">{titulo}</span>
        <span className={cn("block text-sm leading-snug", destacada ? "text-primary-foreground/85" : "text-muted-foreground")}>
          {detalle}
        </span>
      </span>
      <ArrowRight className="size-5 shrink-0 opacity-70 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
    </button>
  );
}

/**
 * «Ayuda»: está en todas las pantallas (barra lateral, cabecera del celular, portal).
 * Ofrece la guía de la pantalla actual, el recorrido completo del rol (o seguir donde
 * quedó) y la página de la Guía.
 */
export function BotonAyuda({
  variante,
  className,
}: {
  /** "barra": barra lateral azul · "cabecera": barra de arriba del celular o del portal. */
  variante: "barra" | "cabecera";
  className?: string;
}) {
  const { rol, iniciarCapitulo, iniciarRecorrido, retomar, seguirRecorrido, destacarAyuda } = useTour();
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const aqui = capituloDeRuta(rol, pathname);
  const partes = (RECORRIDOS[rol] ?? []).length;
  const rutaGuia = rol === "socio" ? "/mi-cuenta/guia" : "/guia";
  const capRetomar = retomar ? CAPITULOS_META[retomar.caps[retomar.iCap]] : null;

  // Se cierra el diálogo y recién después arranca el tour (el foco vuelve a su lugar).
  const elegir = (accion: () => void) => {
    setAbierto(false);
    window.setTimeout(accion, 180);
  };

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <button
        type="button"
        data-tour="ayuda"
        onClick={() => setAbierto(true)}
        aria-label="Ayuda: cómo se usa el sistema, paso a paso"
        className={cn(
          "relative flex shrink-0 items-center gap-2 font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          variante === "barra"
            ? "min-h-11 w-full rounded-lg bg-white/10 px-3 text-sm text-sidebar-foreground hover:bg-white/16"
            : "min-h-11 rounded-full bg-white/12 px-3.5 text-sm text-sidebar-foreground hover:bg-white/20",
          destacarAyuda && "tour-pulso",
          className
        )}
      >
        <CircleHelp className="size-5 shrink-0" strokeWidth={2} />
        <span className={variante === "barra" ? "flex-1 text-left" : undefined}>Ayuda</span>
      </button>
      <DialogContent className="gap-5 p-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-bold">¿Qué querés aprender?</DialogTitle>
          <DialogDescription className="text-base leading-relaxed">
            Te lo muestro sobre la pantalla de verdad, señalando cada botón. Mientras mirás no se guarda nada.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2.5">
          {aqui ? (
            <Opcion
              icono={aqui.icono}
              destacada
              titulo={`Cómo se usa «${aqui.titulo(rol)}»`}
              detalle={aqui.resumen(rol)}
              onClick={() => elegir(() => iniciarCapitulo(aqui.id, { aqui: true }))}
            />
          ) : null}
          {capRetomar && retomar ? (
            <Opcion
              icono={History}
              destacada={!aqui}
              titulo="Seguir donde quedaste"
              detalle={`Parte ${retomar.iCap + 1} de ${retomar.caps.length}: ${capRetomar.titulo(rol)}`}
              onClick={() => elegir(seguirRecorrido)}
            />
          ) : null}
          <Opcion
            icono={Route}
            destacada={!aqui && !retomar}
            titulo="Todo mi trabajo, paso a paso"
            detalle={`${partes} partes cortas, en el orden de tu trabajo de ${nombreRol(rol)}`}
            onClick={() => elegir(() => iniciarRecorrido())}
          />
          <Link
            href={rutaGuia}
            onClick={() => setAbierto(false)}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-base font-semibold text-primary hover:bg-accent"
          >
            <BookOpen className="size-5" strokeWidth={2} />
            Ver la guía completa
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
