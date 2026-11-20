import { formatPorcentaje, sumarMeses } from "@/lib/format";

/**
 * «Cargar un mes anterior» (pedido de Franco del 20/11/2026: "tengo un nuevo puestero que se
 * incorporó a la cooperativa desde octubre. No le habíamos generado las expensas y ahora en
 * noviembre tiene que pagar los dos meses juntos, pero no le puedo generar el concepto para el
 * mes anterior").
 *
 * A quien ya estaba en el mercado y un mes no se le facturó, se le carga ese mes con lo que dice
 * HOY su carpeta, como lo hubiera hecho la generación. Vence junto con el mes en curso (lo paga
 * con este mes y mantiene el beneficio si llega a tiempo): nadie pudo pagar en término algo que
 * no se le había cargado. Queda como un cargo cargado a mano (`origen = 'manual'`): en la cuenta
 * se ve quién lo cargó y se puede anular.
 *
 * TS puro (servidor y cliente): la ficha arma con esto lo que ofrece y la acción lo vuelve a
 * calcular antes de guardar.
 */

/** Hasta cuántos meses para atrás se ofrece cargar. */
export const MESES_ATRAS = 6;

/** Una fila de la carpeta (cliente_conceptos + conceptos) de algo que se paga por mes. */
export type FilaCarpeta = {
  conceptoId: string;
  codigo: string;
  nombre: string;
  segmento: string | null;
  precio: number;
  /** Beneficio por pago en término del concepto, en % (descuento_pronto_pago). */
  beneficio: number;
  cantidad: number;
  porcentaje: number;
  /** La fila del cliente, el concepto del catálogo y el cliente, los tres activos. */
  activo: boolean;
};

/** Lo que se carga de un concepto en un mes: igual a lo que arma `private.carpeta_concepto`. */
export type RenglonMes = {
  conceptoId: string;
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  monto: number;
  beneficio: number;
};

export type MesParaCargar = {
  /** "2026-10-01" */
  periodo: string;
  /** Lo que la carpeta paga por mes y ese mes no tiene cargado. */
  renglones: RenglonMes[];
};

/** Centavos enteros de un número con hasta dos decimales. */
function centavos(n: number): bigint {
  return BigInt(Math.round(n * 100));
}

/** División entera redondeando la mitad hacia arriba, como `round(numeric, 2)` con positivos. */
function dividir(numerador: bigint, divisor: bigint): bigint {
  return (numerador * BigInt(2) + divisor) / (divisor * BigInt(2));
}

/**
 * Lo que la carpeta factura por mes de un concepto, con la misma cuenta y el mismo texto que la
 * base (`private.carpeta_concepto`, la regla de generar_periodo). null = no se le factura: fila
 * apagada, monto en cero, o un ambulante con algo que no es cochera ni quinta.
 */
export function renglonDeCarpeta(fila: FilaCarpeta, categoria: string): RenglonMes | null {
  if (!fila.activo) return null;
  if (categoria === "ambulante" && fila.segmento !== "cocheras" && fila.segmento !== "quinteros") return null;

  const cantidad = centavos(fila.cantidad);
  const precio = centavos(fila.precio);
  const porcentaje = centavos(fila.porcentaje);
  // monto = cantidad × precio × porcentaje / 100, en centavos (cada factor viene × 100).
  const monto = Number(dividir(cantidad * precio * porcentaje, BigInt(1_000_000))) / 100;
  if (!(monto > 0)) return null;

  return {
    conceptoId: fila.conceptoId,
    codigo: fila.codigo,
    descripcion:
      fila.nombre +
      (fila.cantidad !== 1 ? ` × ${String(Number(fila.cantidad))}` : "") +
      (fila.porcentaje !== 100 ? ` · ${formatPorcentaje(fila.porcentaje)}` : ""),
    cantidad: fila.cantidad,
    precioUnitario: Number(dividir(precio * porcentaje, BigInt(10_000))) / 100,
    monto,
    beneficio: fila.beneficio,
  };
}

/**
 * Los meses anteriores que se le pueden cargar, del más nuevo al más viejo: los ya generados,
 * hasta `MESES_ATRAS` antes del mes en curso, en los que le falta algo de lo que paga por mes.
 * Un concepto «falta» si ese mes no tiene un cargo suyo: ni el de la generación (aunque después
 * se haya anulado: ese mes ya se resolvió) ni uno cargado a mano que siga en pie.
 */
export function mesesParaCargar(o: {
  /** El mes en curso ("2026-11-01"). */
  periodoActual: string;
  /** Los meses ya generados. */
  generados: string[];
  cargos: { periodo: string; codigo: string; origen: string; estado: string }[];
  /** Lo que dice hoy la carpeta (`renglonDeCarpeta` de cada fila). */
  renglones: RenglonMes[];
}): MesParaCargar[] {
  if (o.renglones.length === 0) return [];
  const desde = sumarMeses(o.periodoActual, -MESES_ATRAS);
  return [...new Set(o.generados)]
    .filter((p) => p < o.periodoActual && p >= desde)
    .sort()
    .reverse()
    .map((periodo) => {
      const yaTiene = new Set(
        o.cargos
          .filter(
            (c) =>
              c.periodo === periodo &&
              (c.origen === "generacion" || (c.origen === "manual" && c.estado !== "anulado"))
          )
          .map((c) => c.codigo)
      );
      return { periodo, renglones: o.renglones.filter((r) => !yaTiene.has(r.codigo)) };
    })
    .filter((m) => m.renglones.length > 0);
}
