"use client";

import { useMemo } from "react";
import { Check, History, Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { LABEL_ROL } from "@/lib/roles";
import { capitulosDeRol } from "@/lib/tour/capitulos";
import { CAPITULOS_META } from "@/lib/tour/indice";
import { useTour } from "@/components/tour/proveedor-tour";
import { FlujosProceso } from "@/components/tour/flujos";
import { PantallaComoFunciona } from "@/components/tour/pantallas/general";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";

/** Segundos que lleva leer un paso (para decir "unos N minutos"). */
const SEGUNDOS_POR_PASO = 12;

/**
 * La Guía de uso de cada rol: el recorrido completo (empezar o seguir donde quedó), las
 * partes de su trabajo en orden (cada una se puede ver sola) y cómo encaja lo suyo con
 * lo de los demás.
 */
export function GuiaHub() {
  const { rol, vistos, retomar, iniciarRecorrido, iniciarCapitulo, seguirRecorrido } = useTour();
  const caps = useMemo(() => capitulosDeRol(rol), [rol]);
  const pasosPorCap = useMemo(() => caps.map((c) => c.pasos(rol).length), [caps, rol]);
  const minutos = Math.max(1, Math.round((pasosPorCap.reduce((a, n) => a + n, 0) * SEGUNDOS_POR_PASO) / 60));
  const vistosN = caps.filter((c) => vistos.includes(c.id)).length;
  const capRetomar = retomar ? CAPITULOS_META[retomar.caps[retomar.iCap]] : null;

  return (
    <div className="space-y-10">
      <PageHeader
        titulo="Guía de uso"
        descripcion="Te muestro el sistema sobre la pantalla de verdad, señalando cada botón. Mientras mirás no se guarda, no se cobra y no se borra nada."
      />

      <section
        aria-labelledby="guia-recorrido"
        className="overflow-hidden rounded-2xl bg-sidebar text-sidebar-foreground shadow-[0_18px_40px_-24px_rgb(15_23_60/0.8)]"
      >
        <div className="grid gap-6 p-5 sm:p-7 md:grid-cols-[minmax(0,1fr)_18rem] md:items-center">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-sidebar-foreground/75">{LABEL_ROL[rol]}</p>
            <h2 id="guia-recorrido" className="font-display text-[1.7rem] leading-tight font-bold text-balance">
              Todo tu trabajo, paso a paso
            </h2>
            <p className="max-w-prose text-base leading-relaxed text-sidebar-foreground/85">
              {caps.length === 1 ? "Una parte corta" : `${caps.length} partes cortas, en el orden de tu trabajo`}.{" "}
              {minutos === 1 ? "Un minuto" : `Unos ${minutos} minutos`} en total, y podés cortar cuando quieras: después
              seguís donde quedaste.
            </p>
            {vistosN > 0 ? (
              <div className="max-w-sm space-y-1.5 pt-1">
                <p className="text-sm font-medium text-sidebar-foreground/85">
                  Ya viste {vistosN} de {caps.length} {caps.length === 1 ? "parte" : "partes"}
                </p>
                <div className="h-2 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full rounded-full bg-white" style={{ width: `${(vistosN / Math.max(caps.length, 1)) * 100}%` }} />
                </div>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2.5 pt-2">
              {capRetomar ? (
                <>
                  <Button
                    type="button"
                    onClick={seguirRecorrido}
                    className="h-12 gap-2 bg-white px-5 text-base text-primary hover:bg-white/90"
                  >
                    <History className="size-5" strokeWidth={2} />
                    Seguir donde quedaste: {capRetomar.titulo(rol)}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => iniciarRecorrido()}
                    className="h-12 gap-2 px-4 text-base text-sidebar-foreground hover:bg-white/10 hover:text-sidebar-foreground"
                  >
                    <RotateCcw className="size-5" strokeWidth={2} />
                    Empezar de nuevo
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  onClick={() => iniciarRecorrido()}
                  className="h-12 gap-2 bg-white px-6 text-base text-primary hover:bg-white/90"
                >
                  <Play className="size-5 fill-current" strokeWidth={2} />
                  {vistosN > 0 ? "Ver el recorrido de nuevo" : "Empezar el recorrido"}
                </Button>
              )}
            </div>
          </div>
          <div className="hidden md:block">
            <PantallaComoFunciona />
          </div>
        </div>
      </section>

      <section aria-labelledby="guia-partes" className="space-y-4">
        <div>
          <h2 id="guia-partes" className="font-display text-xl font-bold">
            Las partes de tu trabajo
          </h2>
          <p className="text-sm text-muted-foreground">Tocá «Ver cómo se usa» para ver una parte sola.</p>
        </div>
        <ol className="relative space-y-3 before:absolute before:top-6 before:bottom-6 before:left-[1.2rem] before:w-0.5 before:bg-border sm:before:left-[1.45rem]">
          {caps.map((c, i) => {
            const visto = vistos.includes(c.id);
            const Icono = c.icono;
            const Portada = c.portadaPorRol?.(rol) ?? c.portada;
            return (
              <li key={c.id} className="relative flex gap-3 sm:gap-4">
                <span
                  className={cn(
                    "relative z-10 mt-4 flex size-10 shrink-0 items-center justify-center rounded-full font-display text-base font-bold tabular ring-4 ring-background sm:size-12",
                    visto ? "bg-primary text-primary-foreground" : "bg-card text-primary ring-offset-0 outline-2 outline-primary/30"
                  )}
                  aria-hidden
                >
                  {visto ? <Check className="size-5" strokeWidth={2.6} /> : i + 1}
                </span>
                <article className="flex min-w-0 flex-1 flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                        <Icono className="size-5" strokeWidth={2} />
                      </span>
                      <h3 className="min-w-0 font-display text-lg leading-snug font-bold">
                        {c.titulo(rol)}
                        {visto ? <span className="sr-only"> (ya la viste)</span> : null}
                      </h3>
                    </div>
                    <p className="text-[0.95rem] leading-snug text-muted-foreground">{c.resumen(rol)}</p>
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <Button
                        type="button"
                        variant={visto ? "outline" : "default"}
                        onClick={() => iniciarCapitulo(c.id)}
                        className="h-11 gap-2 px-4 text-base"
                      >
                        <Play className="size-4 fill-current" strokeWidth={2} />
                        {visto ? "Verla de nuevo" : "Ver cómo se usa"}
                      </Button>
                      <span className="text-sm text-muted-foreground tabular">
                        {pasosPorCap[i]} pasos · {Math.max(1, Math.round((pasosPorCap[i] * SEGUNDOS_POR_PASO) / 60))} min
                      </span>
                    </div>
                  </div>
                  {Portada ? (
                    <div className="hidden w-[15rem] shrink-0 sm:block" aria-hidden>
                      <div className="w-[20rem] origin-top-left" style={{ zoom: 0.75 }}>
                        <Portada />
                      </div>
                    </div>
                  ) : null}
                </article>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="guia-encaja" className="space-y-4">
        <div>
          <h2 id="guia-encaja" className="font-display text-xl font-bold">
            Cómo encaja tu trabajo con el de los demás
          </h2>
          <p className="text-sm text-muted-foreground">
            Lo que hacés vos está resaltado. Así sabés de dónde viene cada cosa y a quién le llega después.
          </p>
        </div>
        <FlujosProceso rol={rol} />
      </section>
    </div>
  );
}
