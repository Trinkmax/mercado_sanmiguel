import { Banknote, PackageOpen, Smartphone, UserRound } from "lucide-react";
import { formatSoloHora } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { EmptyState } from "@/components/shared/empty-state";
import { AnularIngreso } from "@/components/caja/anular-ingreso";
import type { IngresoCaja } from "@/components/caja/datos";

/** "Venta de vacíos y tarimas: 30 vacíos a Juan" (lo que se vendió, si lo anotaron). */
export function textoIngreso(i: { concepto: string; detalle: string | null }): string {
  return i.detalle?.trim() ? `${i.concepto}: ${i.detalle.trim()}` : i.concepto;
}

/**
 * Ventas y otros ingresos sin cliente de una caja (0053): cuánto entró (efectivo y
 * transferencia) y la lista, con los anulados tachados y su motivo. Sin hooks: sirve en la
 * pantalla de cobro y en la caja del día.
 */
export function IngresosDelDia({
  ingresos,
  puedeAnular,
  esHoy = true,
  mostrarQuien = true,
}: {
  ingresos: IngresoCaja[];
  /** Quien mira puede anular (Administración con la caja abierta; Tesorería y el Líder hasta validarla). */
  puedeAnular: boolean;
  esHoy?: boolean;
  /** Nombre de quien cobró en cada fila. */
  mostrarQuien?: boolean;
}) {
  if (ingresos.length === 0) {
    return (
      <EmptyState
        icono={PackageOpen}
        titulo={esHoy ? "Hoy todavía no se cobró nada sin cliente" : "Ese día no se cobró nada sin cliente"}
        descripcion="Lo que se venda (vacíos, tarimas…) aparece acá con su número."
      />
    );
  }

  const vigentes = ingresos.filter((i) => !i.anulado);
  const efectivo = vigentes.filter((i) => i.medio === "efectivo").reduce((acc, i) => acc + i.monto, 0);
  const transferencia = vigentes.filter((i) => i.medio === "transferencia").reduce((acc, i) => acc + i.monto, 0);
  const ordenados = [...ingresos].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 rounded-lg border bg-card px-4 py-3">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <Money monto={efectivo} className="font-display text-2xl font-bold tracking-tight" />
          <span className="text-base font-medium">en efectivo</span>
          {transferencia > 0.009 ? (
            <span className="text-base text-muted-foreground">
              y <Money monto={transferencia} className="font-semibold text-foreground" /> por transferencia
            </span>
          ) : null}
        </p>
        <p className="text-sm text-muted-foreground tabular">
          {vigentes.length} {vigentes.length === 1 ? "cobro" : "cobros"}
          {ingresos.length > vigentes.length
            ? ` · ${ingresos.length - vigentes.length} ${ingresos.length - vigentes.length === 1 ? "anulado" : "anulados"}`
            : ""}
        </p>
      </div>
      <Card className="gap-0 divide-y overflow-hidden py-0 text-base">
        {ordenados.map((i) => {
          const texto = textoIngreso(i);
          return (
            <div
              key={i.id}
              className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3", i.anulado && "bg-muted/40")}
            >
              <div className="w-14 shrink-0">
                <p className="font-display text-lg leading-tight font-bold tabular">{formatSoloHora(i.creadoEn)}</p>
                <p className="text-xs text-muted-foreground tabular">N° {i.numero}</p>
              </div>
              <div className="min-w-0 flex-1 basis-44 space-y-0.5">
                <p className={cn("font-semibold break-words", i.anulado && "text-muted-foreground line-through")}>
                  {texto}
                </p>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    {i.medio === "efectivo" ? (
                      <Banknote className="size-4" strokeWidth={1.9} aria-hidden />
                    ) : (
                      <Smartphone className="size-4" strokeWidth={1.9} aria-hidden />
                    )}
                    {i.medio === "efectivo" ? "Efectivo" : "Transferencia"}
                    {i.titular ? ` · ${i.titular}` : ""}
                  </span>
                  {mostrarQuien && i.creadoPorNombre ? (
                    <span className="inline-flex items-center gap-1">
                      <UserRound className="size-4" strokeWidth={1.9} aria-hidden />
                      {i.creadoPorNombre}
                    </span>
                  ) : null}
                </p>
                {i.anulado ? (
                  <p className="flex flex-wrap items-center gap-2 pt-1 text-sm">
                    <Sello estado="anulado" />
                    {i.motivoAnulacion ? <span className="text-muted-foreground">{i.motivoAnulacion}</span> : null}
                  </p>
                ) : null}
              </div>
              <div className="ml-auto flex items-center gap-3">
                <Money
                  monto={i.monto}
                  className={cn("text-lg font-bold", i.anulado && "text-muted-foreground line-through")}
                />
                {puedeAnular && !i.anulado ? (
                  <AnularIngreso id={i.id} numero={i.numero} texto={texto} monto={i.monto} creadoEn={i.creadoEn} />
                ) : null}
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
