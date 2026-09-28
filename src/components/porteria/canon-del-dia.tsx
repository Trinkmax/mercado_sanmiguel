import { Banknote, ChevronDown, Smartphone, Truck, UserRound } from "lucide-react";
import { formatSoloHora } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { EmptyState } from "@/components/shared/empty-state";
import { AnularCanon } from "@/components/porteria/anular-canon";
import { DibujoTarifa } from "@/components/porteria/dibujo-tarifa";
import {
  LABEL_MEDIO_CANON,
  MINUTOS_PARA_ANULAR,
  formatPatente,
  textoConteoTarifa,
  textoDestino,
  textoEntrada,
  totalesCanon,
  type CanonEntrada,
  type TarifaTransporte,
} from "@/components/porteria/tarifas";

/** Filas visibles antes de "Ver los N anteriores". */
const FILAS_VISIBLES = 15;

/**
 * Canon de transporte de un día (bono camioneros): cuánto tiene que haber en la garita, conteo
 * por tarifa y la lista de cobros (anulados tachados, con motivo). Sirve en /porteria y en la
 * caja de portería (M2). Sin hooks: se usa como Server Component o dentro de uno de cliente.
 *
 * Anular (las reglas finales las impone anular_canon):
 *  - modo "porteria": sus propios cobros, con la caja abierta, durante 15 minutos.
 *  - modo "jefe": cualquiera con la caja abierta; con `anularConCajaCerrada` (Tesorería y el
 *    Líder) también con la caja cerrada o integrada, nunca validada.
 *  - modo "lectura": nunca.
 */
export function CanonDelDia({
  entradas,
  modo,
  cajaAbierta,
  cajaValidada = false,
  miUserId,
  anularConCajaCerrada = false,
  esHoy = true,
  tarifas,
  sinResumen = false,
}: {
  entradas: CanonEntrada[];
  modo: "porteria" | "jefe" | "lectura";
  cajaAbierta: boolean;
  cajaValidada?: boolean;
  miUserId: string;
  /** Tesorería y el Líder: anulan también con la caja rendida (cerrada o integrada, no validada). */
  anularConCajaCerrada?: boolean;
  /** false si se mira otro día (cambia los textos). */
  esHoy?: boolean;
  /** Para dibujar el ícono de cada tarifa (si no viene, un camión). */
  tarifas?: Pick<TarifaTransporte, "nombre" | "icono">[];
  /** La pantalla ya muestra el resumen en otro lado. */
  sinResumen?: boolean;
}) {
  if (entradas.length === 0) {
    return (
      <EmptyState
        icono={Truck}
        titulo={esHoy ? "Todavía no entró ningún vehículo hoy" : "Ese día no entró ningún vehículo"}
        descripcion={
          modo === "porteria" && esHoy
            ? "Cuando cobres el primero, aparece acá con su número."
            : "Los cobros del canon de transporte los hace Portería en la garita."
        }
      />
    );
  }

  const totales = totalesCanon(entradas);
  const iconoPorNombre = new Map((tarifas ?? []).map((t) => [t.nombre, t.icono]));
  const ordenadas = [...entradas].sort((a, b) => b.creado_en.localeCompare(a.creado_en));
  const visibles = ordenadas.slice(0, FILAS_VISIBLES);
  const resto = ordenadas.slice(FILAS_VISIBLES);

  function puedeAnular(e: CanonEntrada): boolean {
    if (e.anulado || cajaValidada) return false;
    if (modo === "porteria") return cajaAbierta && e.creado_por === miUserId;
    if (modo === "jefe") return cajaAbierta || anularConCajaCerrada;
    return false;
  }

  const fila = (e: CanonEntrada) => {
    const destino = textoDestino(e.destino, e.destino_detalle);
    const texto = textoEntrada(e);
    const venceEn =
      modo === "porteria"
        ? new Date(new Date(e.creado_en).getTime() + MINUTOS_PARA_ANULAR * 60_000).toISOString()
        : null;
    return (
      <div
        key={e.id}
        className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3", e.anulado && "bg-muted/40")}
      >
        <div className="w-14 shrink-0">
          <p className="font-display text-lg leading-tight font-bold tabular">{formatSoloHora(e.creado_en)}</p>
          <p className="text-xs text-muted-foreground tabular">N° {e.numero}</p>
        </div>
        <div className="min-w-0 flex-1 basis-44 space-y-0.5">
          <p className={cn("flex items-center gap-2 font-semibold", e.anulado && "text-muted-foreground line-through")}>
            <DibujoTarifa icono={iconoPorNombre.get(e.tarifa_nombre ?? "")} className="size-5 shrink-0 text-muted-foreground" />
            <span className="truncate">{texto}</span>
          </p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
            {e.patente ? <span className="font-semibold tracking-wider text-foreground/80">{formatPatente(e.patente)}</span> : null}
            {destino ? <span>{destino}</span> : null}
            <span className="inline-flex items-center gap-1">
              {e.medio === "efectivo" ? (
                <Banknote className="size-4" strokeWidth={1.9} aria-hidden />
              ) : (
                <Smartphone className="size-4" strokeWidth={1.9} aria-hidden />
              )}
              {LABEL_MEDIO_CANON[e.medio]}
            </span>
            {e.creadoPorNombre && (modo !== "porteria" || e.creado_por !== miUserId) ? (
              <span className="inline-flex items-center gap-1">
                <UserRound className="size-4" strokeWidth={1.9} aria-hidden />
                {e.creadoPorNombre}
              </span>
            ) : null}
          </p>
          {e.anulado ? (
            <p className="flex flex-wrap items-center gap-2 pt-1 text-sm">
              <Sello estado="anulado" />
              {e.motivo_anulacion ? <span className="text-muted-foreground">{e.motivo_anulacion}</span> : null}
            </p>
          ) : null}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Money
            monto={e.monto}
            className={cn("text-lg font-bold", e.anulado && "text-muted-foreground line-through")}
          />
          {puedeAnular(e) ? (
            <AnularCanon
              id={e.id}
              numero={e.numero}
              texto={texto}
              monto={e.monto}
              creadoEn={e.creado_en}
              venceEn={venceEn}
            />
          ) : null}
        </div>
      </div>
    );
  };

  // Subtotal por quién cobró (el Jefe recibe la plata de cada portero).
  const porCobrador = new Map<string, { nombre: string; efectivo: number; transferencia: number; cobros: number }>();
  if (modo === "jefe") {
    for (const e of entradas) {
      if (e.anulado) continue;
      const clave = e.creado_por ?? "?";
      const c = porCobrador.get(clave) ?? {
        nombre: e.creadoPorNombre ?? "Sin nombre",
        efectivo: 0,
        transferencia: 0,
        cobros: 0,
      };
      if (e.medio === "efectivo") c.efectivo += e.monto;
      else c.transferencia += e.monto;
      c.cobros += 1;
      porCobrador.set(clave, c);
    }
  }

  return (
    <div className="space-y-4">
      {sinResumen ? null : (
        <div className="space-y-3 rounded-lg border bg-card px-4 py-4">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {modo === "porteria"
                  ? esHoy
                    ? "Tenés que tener en la garita"
                    : "Quedó en la garita"
                  : "Bono camioneros en efectivo"}
              </p>
              <p className="flex flex-wrap items-baseline gap-x-2">
                <Money monto={totales.efectivo} className="font-display text-3xl font-bold tracking-tight" />
                <span className="text-base font-medium">en efectivo</span>
              </p>
              <p className="text-base text-muted-foreground">
                {totales.transferencia > 0 ? (
                  <>
                    y <Money monto={totales.transferencia} className="font-semibold text-foreground" /> por transferencia
                  </>
                ) : (
                  "Sin transferencias"
                )}
              </p>
            </div>
            <p className="text-sm text-muted-foreground tabular">
              {totales.cobros} {totales.cobros === 1 ? "cobro" : "cobros"}
              {totales.anulados > 0
                ? ` · ${totales.anulados} ${totales.anulados === 1 ? "anulado" : "anulados"}`
                : ""}
            </p>
          </div>
          {totales.porTarifa.length > 0 ? (
            <ul className="flex flex-wrap gap-2" aria-label="Vehículos por tarifa">
              {totales.porTarifa.map((t) => {
                return (
                  <li
                    key={`${t.nombre}|${t.unidad}`}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-sm font-medium tabular"
                  >
                    <DibujoTarifa icono={iconoPorNombre.get(t.nombre)} className="size-4 text-muted-foreground" />
                    {textoConteoTarifa(t)}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {modo === "jefe" && porCobrador.size > 0 ? (
            <ul className="space-y-1 border-t pt-3 text-sm" aria-label="Por quién cobró">
              {[...porCobrador.values()].map((c) => (
                <li key={c.nombre} className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <UserRound className="size-4 text-muted-foreground" strokeWidth={1.9} aria-hidden />
                    {c.nombre}
                    <span className="font-normal text-muted-foreground">
                      · {c.cobros} {c.cobros === 1 ? "cobro" : "cobros"}
                    </span>
                  </span>
                  <span className="tabular">
                    <Money monto={c.efectivo} className="font-semibold" /> en efectivo
                    {c.transferencia > 0 ? (
                      <>
                        {" "}
                        · <Money monto={c.transferencia} /> por transferencia
                      </>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      <Card className="gap-0 divide-y overflow-hidden py-0 text-base">{visibles.map(fila)}</Card>

      {resto.length > 0 ? (
        <Collapsible className="space-y-3">
          <CollapsibleTrigger className="group flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border bg-card px-4 text-base font-medium hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none">
            <ChevronDown className="size-5 transition-transform group-data-[state=open]:rotate-180" strokeWidth={2} />
            <span className="group-data-[state=open]:hidden">
              Ver {resto.length === 1 ? "el cobro anterior" : `los ${resto.length} cobros anteriores`}
            </span>
            <span className="hidden group-data-[state=open]:inline">Ocultar los anteriores</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="gap-0 divide-y overflow-hidden py-0 text-base">{resto.map(fila)}</Card>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
}
