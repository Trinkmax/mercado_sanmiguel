import { FileText } from "lucide-react";
import { formatFecha, formatFechaHora } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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
};

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
}: {
  g: GastoFila;
  hoy: string;
  puedeOperar: boolean;
  cajas: CajaElegible[];
  preferirCaja: boolean;
  cajaPreseleccionadaId: string | null;
}) {
  const vencido = g.estado === "pendiente" && g.vencimiento !== null && g.vencimiento < hoy;
  const venceHoy = g.estado === "pendiente" && g.vencimiento === hoy;

  const vencimiento = g.vencimiento ? (
    <span
      className={cn(
        "tabular",
        vencido ? "font-semibold text-pendiente" : venceHoy ? "font-semibold text-parcial" : "text-muted-foreground"
      )}
    >
      {vencido ? "Venció " : venceHoy ? "Vence hoy " : "Vence "}
      {formatFecha(g.vencimiento).slice(0, 5)}
    </span>
  ) : (
    <span className="text-muted-foreground">Sin vencimiento</span>
  );

  return (
    <li
      className={cn(
        "grid gap-3 px-4 py-4 md:grid-cols-[7rem_minmax(0,1fr)_auto_minmax(12rem,auto)] md:items-center md:gap-5",
        vencido && "bg-pendiente-suave/50"
      )}
    >
      <div className="hidden text-sm md:block">{vencimiento}</div>

      <div className="min-w-0 space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            {g.rubroCodigo ? <Codigo codigo={g.rubroCodigo} /> : null}
            <p className={cn("text-base font-semibold", g.estado === "anulado" && "text-muted-foreground line-through")}>
              {g.etiqueta}
            </p>
            <Badge variant="outline" className="h-6 text-xs">
              {g.tipo === "fijo" ? "Fijo" : "Variable"}
            </Badge>
          </div>
          <Money
            monto={g.monto}
            className={cn("shrink-0 text-lg font-bold md:hidden", vencido && "text-pendiente")}
          />
        </div>
        <p className="text-sm md:hidden">{vencimiento}</p>
        {g.notas ? <p className="line-clamp-2 text-sm text-muted-foreground">{g.notas}</p> : null}
        {g.estado === "pagado" ? (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{textoPago(g)}</span>
            {g.fechaPago ? ` · pagado el ${formatFecha(g.fechaPago).slice(0, 5)}` : ""}
            {g.pagadoPor ? ` por ${g.pagadoPor}` : ""}
          </p>
        ) : null}
        {g.estado === "pendiente" && g.revertido ? (
          <p className="text-sm text-parcial">
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

      <Money
        monto={g.monto}
        className={cn("hidden text-right text-lg font-bold md:block", vencido && "text-pendiente")}
      />

      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        <Sello estado={vencido ? "vencido" : g.estado} />
        {puedeOperar ? (
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
        ) : null}
      </div>
    </li>
  );
}
