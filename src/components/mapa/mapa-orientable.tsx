"use client";

import { useLayoutEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { MapaMercado } from "./mapa-mercado";
import { rotarPlano, type Orientacion } from "./orientacion";

/**
 * El mapa acompaña la forma de su lugar: si es más alto que ancho (celular o tablet
 * parados) el plano se muestra girado 90° (el oeste arriba); si no, como siempre.
 * Se gira a nivel de datos (orientacion.ts): el relieve y los textos siguen derechos.
 * MapaMercado no se vuelve a montar al girar (mismo componente en el mismo lugar):
 * conserva la selección, el modo y el pincel; la cámara se vuelve a encuadrar sola
 * porque cambian los límites del plano.
 */
export function MapaOrientable(props: ComponentProps<typeof MapaMercado>) {
  const ref = useRef<HTMLDivElement>(null);
  // En el servidor y en el primer render, horizontal (el plano de siempre).
  const [orientacion, setOrientacion] = useState<Orientacion>("horizontal");

  // Antes de pintar: al navegar dentro de la app el plano ya aparece bien orientado.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => {
      const r = el.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return;
      setOrientacion(r.height > r.width ? "vertical" : "horizontal");
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { espacios, elementos } = props;
  const girado = useMemo(
    () => (orientacion === "vertical" ? rotarPlano(espacios, elementos) : null),
    [orientacion, espacios, elementos]
  );

  return (
    <div ref={ref} className="flex min-h-0 flex-1 flex-col">
      <MapaMercado
        {...props}
        espacios={girado?.espacios ?? espacios}
        elementos={girado?.elementos ?? elementos}
      />
    </div>
  );
}
