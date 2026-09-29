"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** La opción elegida de la fila (pestaña, chip de filtro). */
const ELEGIDA = '[aria-current]:not([aria-current="false"]),[aria-selected="true"],[aria-pressed="true"]';

/**
 * Fila de chips o pestañas. En el celular va en un solo renglón que se desliza de costado y,
 * si hay más para ver, lo avisa con un degradé y una flecha que se puede tocar; desde `sm` se
 * acomoda en renglones. Al entrar, la opción elegida queda a la vista aunque esté al final.
 * Los chips van con `shrink-0 whitespace-nowrap` para que no se aplasten.
 */
export function FilaDeslizable({
  children,
  className,
  classNameExterior,
  ...props
}: ComponentProps<"div"> & {
  /** Clases del contenedor de afuera (p. ej. `w-full` si la fila va dentro de un flex). */
  classNameExterior?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [lados, setLados] = useState({ izq: false, der: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => {
      const izq = el.scrollLeft > 4;
      const der = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
      setLados((p) => (p.izq === izq && p.der === der ? p : { izq, der }));
    };
    const elegida = el.querySelector<HTMLElement>(ELEGIDA);
    if (elegida && elegida.offsetLeft + elegida.offsetWidth > el.clientWidth - 48) {
      el.scrollLeft = elegida.offsetLeft - 48;
    }
    const raf = requestAnimationFrame(medir);
    el.addEventListener("scroll", medir, { passive: true });
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    for (const hijo of Array.from(el.children)) ro.observe(hijo);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", medir);
      ro.disconnect();
    };
  }, []);

  function correr(sentido: 1 | -1) {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: sentido * el.clientWidth * 0.7, behavior: "smooth" });
  }

  return (
    <div className={cn("relative -mx-4 min-w-0 sm:mx-0", classNameExterior)}>
      <div
        ref={ref}
        className={cn(
          "relative flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden",
          className
        )}
        {...props}
      >
        {children}
      </div>
      {lados.izq ? (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={() => correr(-1)}
          className="absolute inset-y-0 left-0 flex w-12 items-center justify-start bg-linear-to-r from-background via-background/90 to-transparent pb-1 pl-1.5 sm:hidden"
        >
          <span className="flex size-8 items-center justify-center rounded-full border bg-card text-foreground shadow-sm">
            <ChevronLeft className="size-5" strokeWidth={2.2} />
          </span>
        </button>
      ) : null}
      {lados.der ? (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={() => correr(1)}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-end bg-linear-to-l from-background via-background/90 to-transparent pr-1.5 pb-1 sm:hidden"
        >
          <span className="flex size-8 items-center justify-center rounded-full border bg-card text-foreground shadow-sm">
            <ChevronRight className="size-5" strokeWidth={2.2} />
          </span>
        </button>
      ) : null}
    </div>
  );
}
