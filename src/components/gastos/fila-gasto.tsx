import Link from "next/link";
import { FileText, Undo2 } from "lucide-react";
import { formatFecha, formatFechaHora } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Codigo } from "@/components/shared/codigo";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { AccionesGasto } from "@/components/gastos/acciones-gasto";
import { AdjuntarFactura } from "@/components/gastos/adjuntar-factura";
import { SelloComprobante } from "@/components/gastos/sello-comprobante";
import { LABEL_MEDIO_GASTO, type CajaElegible } from "@/components/gastos/tipos";

export type GastoFila = {
  id: string;
  etiqueta: string;
  /** true si no tiene descripción y se muestra el rubro. */
  sinDescripcion: boolean;
  rubroCodigo: string | null;
  rubroNombre: string | null;
  tipo: "fijo" | "variable";
  monto: number;
  estado: "pendiente" | "pagado" | "anulado";
  vencimiento: string | null;
  fechaPago: string | null;
  /** Momento en que se registró el pago (para dejar a la vista lo pagado hoy). */
  pagadoEn: string | null;
  medioPago: string | null;
  pagadoDesde: string | null;
  cajaFecha: string | null;
  cheque: { numero: string; proveedor: string | null } | null;
  pagadoPor: string | null;
  notas: string | null;
  facturaPath: string | null;
  facturaUrl: string | null;
  comprobanteValidado: boolean;
  revertido: { por: string; en: string; motivo: string } | null;
  /** "Agosto 2026" cuando se lista fuera de su mes (impagos de meses anteriores). */
  mes?: string | null;
};

/**
 * Columnas de la fila en pantallas anchas (la usa también el esqueleto de carga).
 * Monto y acciones tienen ancho fijo: así los montos y los sellos quedan en
 * columna en todas las filas, tengan o no botones. La del monto entra
 * "$ 123.456.789,50" en una línea. En tablet el vencimiento va debajo del nombre y
 * el detalle aprovecha ese lugar; desde xl tiene su columna.
 */
export const COLUMNAS_FILA_GASTO =
  "md:grid-cols-[minmax(0,1fr)_11rem_13rem] md:items-start md:gap-5 xl:grid-cols-[7rem_minmax(0,1fr)_11rem_13rem]";

/** "Caja del 25/09 · Efectivo" / "Tesorería · Banco" / "Cheque N° 123 a Frutas del Sur". */
export function textoPago(g: GastoFila): string {
  if (g.pagadoDesde === "cheque") {
    return g.cheque
      ? `Cheque N° ${g.cheque.numero}${g.cheque.proveedor ? ` a ${g.cheque.proveedor}` : ""}`
      : "Con un cheque";
  }
  const medio = g.medioPago ? LABEL_MEDIO_GASTO[g.medioPago] ?? g.medioPago : "";
  if (g.pagadoDesde === "caja") {
    return `Caja del ${g.cajaFecha ? formatFecha(g.cajaFecha).slice(0, 5) : "día"} · ${medio || "Efectivo"}`;
  }
  return `Tesorería · ${medio}`;
}

/** Una fila de gasto: tarjeta en el celular, fila de planilla en pantallas anchas. */
export function FilaGasto({
  g,
  hoy,
  puedeOperar,
  cajas,
  preferirCaja,
  cajaPreseleccionadaId,
  verCheques,
}: {
  g: GastoFila;
  hoy: string;
  puedeOperar: boolean;
  cajas: CajaElegible[];
  preferirCaja: boolean;
  cajaPreseleccionadaId: string | null;
  /** Tesorería y el Líder entran a Cheques (ahí se deshace un pago con cheque). */
  verCheques: boolean;
}) {
  const vencido = g.estado === "pendiente" && g.vencimiento !== null && g.vencimiento < hoy;
  const venceHoy = g.estado === "pendiente" && g.vencimiento === hoy;
  const estadoSello = vencido ? "vencido" : g.estado;
  // El pago con cheque no se deshace acá (el cheque se corrige en Cheques).
  const pagadoConCheque = g.estado === "pagado" && g.pagadoDesde === "cheque";

  const vencimiento = g.vencimiento ? (
    <span
      className={cn(
        "tabular",
        vencido ? "font-semibold text-pendiente" : venceHoy ? "font-semibold text-parcial" : "text-muted-foreground"
      )}
    >
      {/* Pagado o anulado: ya no "vence", solo se recuerda cuándo vencía. */}
      {g.estado !== "pendiente" ? "Vencía " : vencido ? "Venció " : venceHoy ? "Vence hoy " : "Vence "}
      {formatFecha(g.vencimiento).slice(0, 5)}
    </span>
  ) : (
    <span className="text-muted-foreground">Sin vencimiento</span>
  );

  // Rubro con su nombre: el código solo (SEGUV, HONO…) no se entiende.
  const rubro = g.rubroNombre && !g.sinDescripcion ? g.rubroNombre : null;

  return (
    <li
      className={cn(
        "grid gap-3 px-4 py-4",
        COLUMNAS_FILA_GASTO,
        vencido && "bg-pendiente-suave/50"
      )}
    >
      <div className="hidden pt-0.5 text-sm xl:block">{vencimiento}</div>

      <div className="min-w-0 space-y-1.5">
        <p
          className={cn(
            "text-base font-semibold break-words",
            g.estado === "anulado" && "text-muted-foreground line-through"
          )}
        >
          {g.etiqueta}
        </p>
        {/* Celular: el monto debajo del nombre, así el nombre usa todo el ancho. */}
        <Money
          monto={g.monto}
          className={cn("block text-lg font-bold md:hidden", vencido && "text-pendiente")}
        />
        <p className="text-sm text-muted-foreground">
          {g.rubroCodigo ? <Codigo codigo={g.rubroCodigo} className="mr-1.5 align-middle" /> : null}
          {rubro ? `${rubro} · ` : ""}
          {g.tipo === "fijo" ? "Fijo" : "Variable"}
          <span className="xl:hidden">
            {" · "}
            {vencimiento}
          </span>
        </p>
        {g.mes ? (
          // En rojo mientras está sin pagar; pagado hoy, solo recuerda de qué mes es.
          <p
            className={cn(
              "text-sm font-medium",
              g.estado === "pendiente" ? "text-pendiente" : "text-muted-foreground"
            )}
          >
            Gasto de {g.mes.toLowerCase()}
          </p>
        ) : null}
        {g.notas ? <p className="line-clamp-2 text-sm break-words text-muted-foreground">{g.notas}</p> : null}
        {g.estado === "pagado" ? (
          <p className="text-sm break-words text-muted-foreground">
            <span className="font-medium text-foreground">{textoPago(g)}</span>
            {g.fechaPago ? ` · pagado el ${formatFecha(g.fechaPago).slice(0, 5)}` : ""}
            {g.pagadoPor ? ` por ${g.pagadoPor}` : ""}
          </p>
        ) : null}
        {g.estado === "pendiente" && g.revertido ? (
          <p className="text-sm break-words text-parcial">
            Pago deshecho por {g.revertido.por} el {formatFechaHora(g.revertido.en)}: {g.revertido.motivo}
          </p>
        ) : null}
        {g.estado !== "anulado" ? (
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <SelloComprobante
              estadoGasto={g.estado}
              tieneFactura={Boolean(g.facturaPath)}
              validado={g.comprobanteValidado}
            />
            {g.facturaUrl ? (
              <a
                href={g.facturaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <FileText className="size-4" strokeWidth={2} />
                Ver factura
              </a>
            ) : !g.facturaPath && puedeOperar ? (
              <AdjuntarFactura gasto={{ id: g.id, etiqueta: g.etiqueta, monto: g.monto }} />
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Monto y estado, en columna (pantallas anchas). */}
      <div className="hidden space-y-2 text-right md:block">
        <Money
          monto={g.monto}
          className={cn("block text-lg font-bold whitespace-nowrap", vencido && "text-pendiente")}
        />
        <Sello estado={estadoSello} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 md:justify-end">
        <Sello estado={estadoSello} className="md:hidden" />
        {!puedeOperar ? null : pagadoConCheque ? (
          verCheques ? (
            <Button asChild variant="ghost" className="h-11 px-3 text-base text-muted-foreground hover:text-foreground">
              <Link
                href={`/cheques?estado=entregado${g.cheque ? `&q=${encodeURIComponent(g.cheque.numero)}` : ""}`}
                aria-label={`Deshacer en Cheques el pago de ${g.etiqueta}`}
              >
                <Undo2 className="size-4" strokeWidth={2} />
                Deshacer en Cheques
              </Link>
            </Button>
          ) : (
            // Explica por qué no hay "Deshacer pago" (Administración no entra a Cheques).
            <p className="min-w-0 flex-1 text-right text-sm text-muted-foreground md:py-3">
              Para deshacerlo, avisá a Tesorería
            </p>
          )
        ) : (
          <AccionesGasto
            gasto={{
              id: g.id,
              etiqueta: g.etiqueta,
              monto: g.monto,
              estado: g.estado,
              pagadoDesde: g.pagadoDesde,
            }}
            cajas={cajas}
            hoy={hoy}
            preferirCaja={preferirCaja}
            cajaPreseleccionadaId={cajaPreseleccionadaId}
          />
        )}
      </div>
    </li>
  );
}
