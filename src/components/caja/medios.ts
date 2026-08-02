import { MEDIOS_PAGO } from "@/lib/format";
import type { Enums } from "@/lib/database.types";

export type MedioPago = Enums<"medio_pago">;

/** "efectivo" → "Efectivo". */
export function labelMedio(medio: MedioPago | null | undefined): string {
  if (!medio) return "—";
  return MEDIOS_PAGO.find((m) => m.valor === medio)?.label ?? medio;
}
