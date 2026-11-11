import { formatARS, formatFecha, formatNumero } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Marca } from "@/components/shared/marca";
import { Sello } from "@/components/shared/sello";

export type RenglonCedulon = {
  numero: string;
  lugar: string | null;
  /** null = el medidor está activo pero todavía no tiene la lectura de este mes. */
  lectura: { anterior: number; actual: number; kwh: number; precio: number; monto: number } | null;
};

export type Cedulon = {
  clienteId: string;
  codigo: number;
  nombre: string;
  lugares: string;
  renglones: RenglonCedulon[];
  abono: number;
  pagado: number;
  vencimiento: string | null;
  /** Para ordenarlos como el recorrido del electricista (y, x del plano). */
  orden: [number, number];
};

function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

const th =
  "py-1.5 print:py-[0.6mm] text-[0.68rem] print:text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground";
const td = "py-1.5 print:py-[0.6mm]";

/** Hasta cuántos medidores entra en un tercio de hoja; con más, ocupa dos tercios. */
export const MEDIDORES_POR_TERCIO = 7;

/** Cuántos tercios de la hoja A4 ocupa al imprimirse. */
export function tercios(c: Pick<Cedulon, "renglones">): 1 | 2 {
  return c.renglones.length > MEDIDORES_POR_TERCIO ? 2 : 1;
}

/**
 * Un cedulón de energía (pedido del 09/11/2026): el cliente, cada medidor con su consumo
 * («Medidor 1 = tanto, Medidor 2 = tanto»), el abono y el total. Va a mes vencido (0063).
 * Impreso mide un tercio de hoja A4 (11/11/2026: «que entren 3 en una hoja, para no
 * desperdiciar»): la tabla y la cuenta van lado a lado. Con más de MEDIDORES_POR_TERCIO
 * medidores ocupa dos tercios (/cedulones lo acomoda solo).
 */
export function HojaCedulon({
  c,
  periodo,
  mes,
  consumoLargo,
}: {
  c: Cedulon;
  periodo: string;
  mes: string;
  consumoLargo: string;
}) {
  const leidos = c.renglones.flatMap((r) => (r.lectura ? [r.lectura] : []));
  const kwh = leidos.reduce((a, l) => a + l.kwh, 0);
  const consumo = redondear2(leidos.reduce((a, l) => a + l.monto, 0));
  const total = redondear2(consumo + c.abono);
  const precios = new Set(leidos.map((l) => l.precio));
  const precio = precios.size === 1 ? [...precios][0] : null;
  const pagado = Math.min(redondear2(c.pagado), total);
  const falta = redondear2(total - pagado);
  const numero = `${periodo.slice(0, 4)}${periodo.slice(5, 7)}-${String(c.codigo).padStart(4, "0")}`;

  return (
    <article className="etiqueta break-inside-avoid" aria-label={`Cedulón de ${c.nombre}`}>
      <div className="etiqueta-interior space-y-4 p-5 print:space-y-[1.6mm] print:p-[3mm]">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-foreground pb-3 print:gap-3 print:pb-[1.5mm]">
          <Marca className="print:hidden" />
          <Marca compacta className="hidden print:flex" />
          <div className="text-right">
            <h2 className="font-display text-xl font-bold uppercase tracking-wide print:text-base print:leading-tight">
              Cedulón de energía
            </h2>
            <p className="text-sm text-muted-foreground tabular print:text-[0.65rem]">N° {numero}</p>
          </div>
        </header>

        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 print:gap-y-1">
          <div className="min-w-0">
            <p className="text-lg font-semibold leading-tight print:text-base">{c.nombre}</p>
            <p className="text-sm text-muted-foreground print:text-xs">
              Carpeta N° {c.codigo}
              {c.lugares ? ` · ${c.lugares}` : ""}
            </p>
          </div>
          <div className="text-sm sm:text-right print:text-right print:text-xs">
            <p>
              <span className="text-muted-foreground">Consumo de</span>{" "}
              <span className="font-semibold">{consumoLargo}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Se paga en</span> {mes.toLowerCase()}
              {c.vencimiento ? (
                <>
                  {" "}
                  · <span className="text-muted-foreground">vence el</span>{" "}
                  <span className="font-semibold">{formatFecha(c.vencimiento)}</span>
                </>
              ) : null}
            </p>
          </div>
        </div>

        {/* Los medidores y, al lado, la cuenta: consumo + abono = total. Lado a lado ocupa la
            mitad de alto, y así entran tres por hoja. */}
        <div className="grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_15rem] print:grid-cols-[minmax(0,1fr)_64mm] print:gap-[5mm]">
          <table className="w-full border-collapse text-sm print:text-xs">
            <thead>
              <tr className="border-b border-foreground text-left">
                <th className={th}>Medidor</th>
                <th className={cn(th, "max-sm:hidden print:table-cell")}>Lugar</th>
                <th className={cn(th, "text-right")}>Anterior</th>
                <th className={cn(th, "text-right")}>Actual</th>
                <th className={cn(th, "text-right")}>kWh</th>
                <th className={cn(th, "text-right")}>Importe</th>
              </tr>
            </thead>
            <tbody>
              {c.renglones.map((r) => (
                <tr key={r.numero} className="border-b border-foreground/20">
                  <td className={cn(td, "pr-2 font-display font-semibold tracking-wide")}>{r.numero}</td>
                  <td className={cn(td, "pr-2 text-muted-foreground max-sm:hidden print:table-cell")}>{r.lugar ?? "—"}</td>
                  {r.lectura ? (
                    <>
                      <td className={cn(td, "pl-2 text-right tabular")}>{formatNumero(r.lectura.anterior)}</td>
                      <td className={cn(td, "pl-2 text-right tabular")}>{formatNumero(r.lectura.actual)}</td>
                      <td className={cn(td, "pl-2 text-right tabular")}>{formatNumero(r.lectura.kwh)}</td>
                      <td className={cn(td, "pl-2 text-right font-medium tabular")}>{formatARS(r.lectura.monto)}</td>
                    </>
                  ) : (
                    <td colSpan={4} className={cn(td, "pl-2 text-right font-semibold text-pendiente italic")}>
                      Falta cargar la lectura
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          <dl className="w-full space-y-1 text-sm print:space-y-[0.6mm] print:text-xs">
            <div className="flex items-baseline justify-between gap-4 print:gap-2">
              <dt className="text-muted-foreground">
                Consumo · {formatNumero(kwh)} kWh{precio !== null ? ` a ${formatARS(precio)}` : ""}
              </dt>
              <dd className="font-medium tabular">{formatARS(consumo)}</dd>
            </div>
            {c.abono > 0 ? (
              <div className="flex items-baseline justify-between gap-4 print:gap-2">
                <dt className="text-muted-foreground">Abono mensual de energía</dt>
                <dd className="font-medium tabular">{formatARS(c.abono)}</dd>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between gap-4 border-t-2 border-foreground pt-1.5 print:gap-2 print:pt-[0.8mm]">
              <dt className="font-display font-bold uppercase tracking-wide">Total</dt>
              <dd className="font-display text-xl font-bold whitespace-nowrap tabular print:text-base">{formatARS(total)}</dd>
            </div>
          </dl>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground print:text-[0.6rem]">
          <span>Comprobante interno — sin validez fiscal</span>
          {total > 0.009 && falta <= 0.009 ? (
            <Sello estado="pagado" className="print:py-[0.3mm] print:text-[0.62rem]" />
          ) : pagado > 0.009 ? (
            <span className="text-sm text-foreground print:text-xs">
              Pagó {formatARS(pagado)} · falta <span className="font-semibold">{formatARS(falta)}</span>
            </span>
          ) : null}
        </footer>
      </div>
    </article>
  );
}
