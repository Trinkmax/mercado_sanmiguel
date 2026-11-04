import { CartelCargando } from "@/components/portal/cartel-cuenta";

/** Mientras carga: el plano ya está (es de la plantilla) y el cartel ocupa su lugar. */
export default function LoadingMiCuenta() {
  return (
    <>
      <div className="portal-espacio" aria-hidden />
      <CartelCargando />
      <div className="portal-suelo">
        <div className="hoja hoja-filas" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex min-h-[4.6rem] items-center gap-3 px-4 py-3">
              <div className="esqueleto size-11 shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="esqueleto h-4 w-40 max-w-full" />
                <div className="esqueleto h-3.5 w-24" />
              </div>
              <div className="esqueleto h-5 w-20" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
