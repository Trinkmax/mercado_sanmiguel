"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Pointer, Sparkles } from "lucide-react";
import { memoria } from "@/lib/tour/memoria";
import { RECORRIDOS, nombreRol } from "@/lib/tour/indice";
import { useTour } from "@/components/tour/proveedor-tour";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * La primera vez que alguien entra con un rol (en ese dispositivo), se le ofrece el
 * recorrido completo. Si dice "Ahora no", el botón «Ayuda» late unos segundos para que
 * sepa dónde está.
 */
export function BienvenidaTour({ nombre }: { nombre: string }) {
  const { rol, usuario, activo, iniciarRecorrido, pedirDestacarAyuda } = useTour();
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const enGuia = pathname === "/guia" || pathname.startsWith("/mi-cuenta/guia");
  const partes = (RECORRIDOS[rol] ?? []).length;
  const primerNombre = nombre.trim().split(/\s+/)[0] ?? "";

  useEffect(() => {
    if (activo || enGuia || partes === 0) return;
    const t = window.setTimeout(() => {
      if (!memoria.bienvenidaVista(usuario, rol) && !memoria.activo()) setAbierto(true);
    }, 900);
    return () => window.clearTimeout(t);
  }, [activo, enGuia, partes, usuario, rol]);

  const cerrar = (mostrar: boolean) => {
    memoria.marcarBienvenida(usuario, rol);
    setAbierto(false);
    window.setTimeout(() => (mostrar ? iniciarRecorrido() : pedirDestacarAyuda()), 200);
  };

  return (
    <Dialog open={abierto} onOpenChange={(v) => (v ? setAbierto(true) : cerrar(false))}>
      <DialogContent className="gap-5 p-6 sm:max-w-md" showCloseButton={false}>
        <div
          aria-hidden
          className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-accent text-accent-foreground"
        >
          <Sparkles className="size-8" strokeWidth={1.8} />
        </div>
        <DialogHeader className="items-center text-center">
          <DialogTitle className="font-display text-2xl font-bold">
            {primerNombre ? `¡Hola, ${primerNombre}!` : "¡Hola!"}
          </DialogTitle>
          <DialogDescription className="text-base leading-relaxed text-balance">
            ¿Querés que te muestre cómo se usa el sistema para tu trabajo de {nombreRol(rol)}? Son {partes} partes
            cortas: lo ves sobre la pantalla de verdad, señalando cada botón. Mientras mirás no se guarda nada.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2.5">
          <Button type="button" onClick={() => cerrar(true)} className="h-13 gap-2 text-base">
            <Pointer className="size-5" strokeWidth={2} />
            Sí, mostrame
          </Button>
          <Button type="button" variant="outline" onClick={() => cerrar(false)} className="h-12 text-base">
            Ahora no
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Lo encontrás cuando quieras en el botón «Ayuda».
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
