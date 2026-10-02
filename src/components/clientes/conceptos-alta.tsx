"use client";

import { Codigo } from "@/components/shared/codigo";
import { Money } from "@/components/shared/money";
import { StepperCantidad } from "@/components/clientes/stepper-cantidad";
import { CampoPorcentaje } from "@/components/clientes/campo-porcentaje";
import {
  AYUDA_CONCEPTO,
  GRUPOS_CONCEPTO,
  ayudaAlOfrecer,
  grupoDeConcepto,
  totalMensual,
} from "@/components/clientes/constantes";
import { cn } from "@/lib/utils";
import { montoConcepto } from "@/lib/format";
import type { CategoriaCliente } from "@/lib/segmentos";

export type ConceptoRecurrente = {
  id: string;
  codigo: string;
  nombre: string;
  precio: number;
  /** Beneficio por pago en término, en % (columna descuento_pronto_pago). */
  descuentoPp: number;
  segmento: string | null;
};

export { normalizarCantidad } from "@/components/clientes/stepper-cantidad";

/**
 * "¿Qué paga cada mes?" del alta: los conceptos que el rol puede asignar, agrupados
 * (Expensas · Espacios · Quinta · Otros), con su precio, una línea de ayuda y el total del
 * mes en vivo. Cantidad de cuarto en cuarto; 0 = no lo paga. Lo elegido puede pagarse
 * por un porcentaje del precio (70 % de la expensa, por ejemplo).
 */
export function ConceptosAlta({
  conceptos,
  categoria,
  cantidades,
  onCambiar,
  porcentajes = {},
  onCambiarPorcentaje,
}: {
  conceptos: ConceptoRecurrente[];
  /** Lo que se está dando de alta: al puestero, la quinta se le explica distinto (0046). */
  categoria?: CategoriaCliente;
  cantidades: Record<string, number>;
  onCambiar: (conceptoId: string, cantidad: number) => void;
  /** Porcentaje del precio por concepto (sin cargar = 100). */
  porcentajes?: Record<string, number>;
  onCambiarPorcentaje?: (conceptoId: string, porcentaje: number) => void;
}) {
  const elegidos = conceptos
    .filter((c) => (cantidades[c.id] ?? 0) > 0)
    .map((c) => ({
      cantidad: cantidades[c.id],
      precio: c.precio,
      descuentoPp: c.descuentoPp,
      porcentaje: porcentajes[c.id] ?? 100,
    }));
  const { total, conBeneficio } = totalMensual(elegidos);
  const grupos = GRUPOS_CONCEPTO.map((g) => ({
    ...g,
    conceptos: conceptos.filter((c) => grupoDeConcepto(c) === g.valor),
  })).filter((g) => g.conceptos.length > 0);

  return (
    <div className="space-y-3" data-tour="clientes-alta-conceptos">
      <div>
        <p className="text-base font-medium">¿Qué paga cada mes?</p>
        <p className="text-sm text-muted-foreground">
          Dejá en 0 lo que no paga. Se aceptan cuartos: ¼ · ½ · ¾ · 1 · 1¼… Si paga una parte
          del precio, poné el porcentaje (por ejemplo 70 %).
        </p>
      </div>

      <div className="divide-y rounded-lg border">
        {grupos.map((g) => (
          <div key={g.valor} className="divide-y">
            {grupos.length > 1 ? (
              <p className="bg-muted/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                {g.label}
              </p>
            ) : null}
            {g.conceptos.map((c) => {
              const cantidad = cantidades[c.id] ?? 0;
              const porcentaje = porcentajes[c.id] ?? 100;
              const paga = cantidad > 0;
              const ayuda = categoria ? ayudaAlOfrecer(c, categoria) : AYUDA_CONCEPTO[c.codigo];
              return (
                <div key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                  <div className="flex min-w-0 flex-1 basis-56 items-start gap-3">
                    <Codigo codigo={c.codigo} className="mt-0.5" />
                    <div className="min-w-0">
                      <p className={cn("text-sm", paga ? "font-medium" : "text-muted-foreground")}>
                        {c.nombre}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <Money monto={c.precio} /> por mes{ayuda ? ` · ${ayuda}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {paga && (cantidad !== 1 || porcentaje !== 100) ? (
                      <Money
                        monto={montoConcepto(cantidad, c.precio, porcentaje)}
                        className="text-sm font-semibold"
                      />
                    ) : null}
                    <StepperCantidad
                      valor={cantidad}
                      nombre={c.nombre}
                      onCambiar={(n) => onCambiar(c.id, n)}
                      className="shrink-0"
                    />
                    {paga && onCambiarPorcentaje ? (
                      <CampoPorcentaje
                        valor={porcentaje}
                        nombre={c.nombre}
                        onCambiar={(p) => onCambiarPorcentaje(c.id, p)}
                        className="shrink-0"
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div
        className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-lg bg-muted/50 px-4 py-3"
        aria-live="polite"
      >
        <span className="text-sm text-muted-foreground">Por mes</span>
        {total > 0 ? (
          <span className="text-right">
            <Money monto={total} className="text-xl font-bold" />
            {conBeneficio < total ? (
              <span className="block text-sm text-muted-foreground">
                con beneficio en término <Money monto={conBeneficio} className="font-semibold text-pagado" />
              </span>
            ) : null}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Todavía no marcaste nada</span>
        )}
      </div>
    </div>
  );
}
