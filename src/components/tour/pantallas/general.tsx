import { HandCoins, Pointer, Store } from "lucide-react";
import { Money } from "@/components/shared/money";
import { BotonEjemplo, FilaEjemplo, MarcoPantalla, Resaltado } from "@/components/tour/pantalla";

/** Cómo es la guía: la pantalla se oscurece, lo señalado queda iluminado y abajo la tarjeta. */
export function PantallaComoFunciona() {
  return (
    <MarcoPantalla titulo="Así se ve la guía" contenidoClassName="p-0">
      <div className="bg-sidebar/55 p-3 pb-4">
        <div className="flex items-center gap-3 rounded-lg bg-card/70 px-2.5 py-2">
          <div className="min-w-0 flex-1 opacity-60">
            <p className="font-semibold">Pocho · Puesto 58</p>
            <Money monto={540000} className="text-[0.72rem] text-muted-foreground" />
          </div>
          <Resaltado className="ring-offset-card">
            <BotonEjemplo>
              <HandCoins /> Cobrar
            </BotonEjemplo>
          </Resaltado>
        </div>
      </div>
      <div className="mx-3 -mt-1.5 mb-3 rounded-lg border border-border bg-card p-2.5 shadow-sm">
        <p className="font-display text-[0.8rem] font-bold">Tocá «Cobrar»</p>
        <p className="text-[0.72rem] text-muted-foreground">Se abre la ventana para anotar el cobro.</p>
        <div className="mt-2 flex justify-end gap-1.5">
          <BotonEjemplo variante="contorno" className="min-h-6 px-2 text-[0.7rem]">
            Atrás
          </BotonEjemplo>
          <BotonEjemplo className="min-h-6 px-2 text-[0.7rem]">Siguiente</BotonEjemplo>
        </div>
      </div>
    </MarcoPantalla>
  );
}

/** Portada del capítulo "Cómo moverte": el menú con una sección señalada. */
export function PortadaComoMoverte() {
  return (
    <MarcoPantalla titulo="Mercado San Miguel" contenidoClassName="flex gap-2 p-2">
      <div className="w-24 shrink-0 space-y-1 rounded-md bg-sidebar p-1.5 text-[0.7rem] text-sidebar-foreground">
        <p className="rounded bg-white/15 px-1.5 py-1">Inicio</p>
        <Resaltado mano={false} className="ring-offset-sidebar">
          <p className="rounded bg-white px-1.5 py-1 font-semibold text-primary">Cobrar</p>
        </Resaltado>
        <p className="px-1.5 py-1">Caja del día</p>
        <p className="px-1.5 py-1">Mapa</p>
      </div>
      <div className="relative min-w-0 flex-1 space-y-1.5">
        <p className="font-display text-[0.8rem] font-bold">Cobrar</p>
        <FilaEjemplo>
          <p className="flex items-center gap-1 text-[0.72rem]">
            <Store className="size-3" /> Pocho · Puesto 58
          </p>
        </FilaEjemplo>
        <Pointer aria-hidden className="tour-toque absolute top-3 -left-3 size-6 fill-white text-primary" strokeWidth={1.8} />
      </div>
    </MarcoPantalla>
  );
}
