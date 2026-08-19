import { Sello } from "@/components/shared/sello";

/**
 * Estado del comprobante (factura) de un gasto, como sello de goma:
 *  - Validado por tesorería → verde "Comprobante OK"
 *  - Con factura, sin validar → ámbar "Sin validar"
 *  - Sin factura → rojo si el gasto ya se pagó (falta el respaldo), gris si
 *    todavía está pendiente (no es un problema hasta que se paga).
 * Los anulados no muestran nada.
 */
export function SelloComprobante({
  estadoGasto,
  tieneFactura,
  validado,
  className,
}: {
  estadoGasto: string;
  tieneFactura: boolean;
  validado: boolean;
  className?: string;
}) {
  if (estadoGasto === "anulado") return null;
  if (validado && tieneFactura) {
    return <Sello estado="pagado" texto="Comprobante OK" className={className} />;
  }
  if (tieneFactura) {
    return <Sello estado="parcial" texto="Sin validar" className={className} />;
  }
  if (estadoGasto === "pagado") {
    return <Sello estado="pendiente" texto="Sin factura" className={className} />;
  }
  return <Sello estado="sin_factura" texto="Sin factura" className={className} />;
}
