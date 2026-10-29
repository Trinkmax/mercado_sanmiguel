import Link from "next/link";
import { ArrowUpRight, Info, ReceiptText } from "lucide-react";
import type { Rol } from "@/lib/auth";
import type { Enums } from "@/lib/database.types";
import { formatARS, formatFechaHora } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { EmptyState } from "@/components/shared/empty-state";
import { LABEL_MEDIO } from "@/components/clientes/constantes";
import { BotonAnularCobro } from "@/components/caja/anular-cobro";
import { permisosCaja } from "@/components/caja/permisos";

export type PagoFicha = {
  id: string;
  numero: number;
  lote_id: string;
  linea: number;
  fecha: string;
  medio: string;
  monto: number;
  recibido_por: string | null;
  anulado: boolean;
  motivo_anulacion: string | null;
  titular_transferencia: string | null;
  imputado: number;
  /** La caja donde entró. null si el rol no la ve (el Jefe no lee la caja de Administración). */
  caja: {
    tipo: Enums<"tipo_caja">;
    estado: Enums<"estado_caja">;
    fecha: string;
    reapertura_solicitada_en: string | null;
  } | null;
};

/**
 * "Pagos recibidos" de la ficha: una fila por RECIBO (lote), con sus medios apilados
 * ("Efectivo $100.000 + Transferencia de Juan Pérez $100.000"), el total y "Ver recibo".
 * La ruta /recibos/{pagoId} acepta cualquier línea del lote (M1).
 *
 * «Anular» (pedido del 28/10/2026: "entrar a los pagos y anular") con las mismas reglas que
 * en la Caja (permisosCaja, espejo de anular_pago): mientras su caja está abierta; el Líder,
 * mientras Tesorería no la validó. Una caja validada se reabre primero (0056).
 * Lo que quedó a favor porque era para una deuda de antes del sistema no se anula: se carga la
 * «Deuda pasada» y se descuenta sola.
 */
export function PagosRecibidos({
  pagos,
  nombreUsuario,
  cliente,
  rol,
  hoy,
  puedeDeudaPasada,
}: {
  pagos: PagoFicha[];
  nombreUsuario: (userId: string | null) => string;
  /** Nombre del cliente, para el aviso al anular. */
  cliente: string;
  rol: Rol;
  /** Hoy en huso argentino ("YYYY-MM-DD"). */
  hoy: string;
  /** Administración y el Líder cargan la deuda pasada. */
  puedeDeudaPasada: boolean;
}) {
  // Los pagos vienen del más nuevo al más viejo: el orden de los lotes se conserva.
  const lotes = new Map<string, PagoFicha[]>();
  for (const p of pagos) {
    const lista = lotes.get(p.lote_id) ?? [];
    lista.push(p);
    lotes.set(p.lote_id, lista);
  }
  const recibos = [...lotes.values()].map((lineas) => {
    const ordenadas = [...lineas].sort((a, b) => a.linea - b.linea);
    const vigentes = ordenadas.filter((l) => !l.anulado);
    const total = vigentes.reduce((acc, l) => acc + Number(l.monto), 0);
    const sobrante = vigentes.reduce((acc, l) => acc + (Number(l.monto) - l.imputado), 0);
    const anulado = vigentes.length === 0;
    // Un lote entra entero en una caja.
    const caja = ordenadas[0].caja;
    return {
      primera: ordenadas[0],
      lineas: ordenadas,
      total: vigentes.length > 0 ? total : ordenadas.reduce((a, l) => a + Number(l.monto), 0),
      anulado,
      algunaAnulada: vigentes.length > 0 && vigentes.length < ordenadas.length,
      sobrante: Math.round(sobrante * 100) / 100,
      medios: vigentes.map((l) => (LABEL_MEDIO[l.medio] ?? l.medio).toLowerCase()).join(" + "),
      puedeAnular: !anulado && caja !== null && permisosCaja(rol, caja.tipo, caja, hoy).anularCobros,
    };
  });

  const algunoQuedoAFavor = recibos.some((r) => !r.anulado && r.sobrante > 0.009);
  const algunoSinAnular = recibos.some((r) => !r.anulado && !r.puedeAnular);
  // Por qué un recibo no tiene «Anular» (solo si alguno no lo tiene): la regla de la caja.
  const reglaAnular =
    rol === "lider"
      ? "Si Tesorería ya validó la caja de ese día, reabrila desde «Caja» para anular el cobro."
      : rol === "admin"
        ? "Un cobro se anula mientras su caja está abierta: si la de ese día ya se cerró (o Tesorería ya la validó), reabrila desde «Caja»."
        : rol === "guardia"
          ? "Un cobro se anula mientras la caja de portería de ese día está abierta."
          : null;

  return (
    <Card className="text-base">
      <CardHeader>
        <CardTitle className="text-lg">Pagos recibidos</CardTitle>
      </CardHeader>
      <CardContent>
        {recibos.length === 0 ? (
          <EmptyState
            icono={ReceiptText}
            titulo="Todavía no pagó nada"
            descripcion="Cuando le cobren, cada recibo aparece acá con cómo pagó."
          />
        ) : (
          <>
            <div className="divide-y">
              {recibos.map((r) => (
                // Celular: el recibo a todo el ancho y, abajo a la derecha, el total y los botones.
                // Desde tablet, todo en una fila.
                <div key={r.primera.lote_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <div className="min-w-0 flex-1 basis-64 space-y-0.5">
                    <p className={cn("font-medium", r.anulado && "text-muted-foreground line-through")}>
                      Recibo N° {r.primera.numero}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {r.lineas.map((l, i) => (
                        <span key={l.id} className={cn(l.anulado && "line-through")}>
                          {i > 0 ? " + " : ""}
                          {l.medio === "transferencia" && l.titular_transferencia
                            ? `Transferencia de ${l.titular_transferencia}`
                            : (LABEL_MEDIO[l.medio] ?? l.medio)}
                          {r.lineas.length > 1 ? ` ${formatARS(l.monto)}` : ""}
                        </span>
                      ))}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatFechaHora(r.primera.fecha)} · Cobró {nombreUsuario(r.primera.recibido_por)}
                    </p>
                    {r.anulado ? (
                      <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <Sello estado="anulado" />
                        {r.primera.motivo_anulacion ?? ""}
                      </p>
                    ) : r.sobrante > 0.009 ? (
                      <p className="flex flex-wrap items-center gap-2 pt-1 text-sm">
                        <Sello estado="saldo_favor" />
                        <Money monto={r.sobrante} className="font-semibold text-pagado" />
                        <span className="text-muted-foreground">quedó a favor</span>
                      </p>
                    ) : r.algunaAnulada ? (
                      <p className="text-sm text-muted-foreground">Una parte del recibo se anuló.</p>
                    ) : null}
                  </div>
                  <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                    <Money
                      monto={r.total}
                      className={cn("text-lg font-semibold", r.anulado && "text-muted-foreground line-through")}
                    />
                    <Link
                      href={`/recibos/${r.primera.id}`}
                      className="flex min-h-11 items-center gap-0.5 px-2 text-sm font-medium text-primary hover:underline"
                    >
                      Ver recibo
                      <ArrowUpRight className="size-4" strokeWidth={2} />
                    </Link>
                    {r.puedeAnular ? (
                      <BotonAnularCobro
                        pagoId={r.primera.id}
                        numero={r.primera.numero}
                        cliente={cliente}
                        total={r.total}
                        medios={r.medios}
                        aFavor={r.sobrante}
                      />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            {(algunoQuedoAFavor && puedeDeudaPasada) || (algunoSinAnular && reglaAnular) ? (
              <div className="mt-3 space-y-1.5 border-t pt-3 text-sm text-muted-foreground">
                {algunoQuedoAFavor && puedeDeudaPasada ? (
                  <p className="flex items-start gap-2">
                    <Info className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
                    <span>
                      ¿Lo que quedó a favor era para una deuda de antes del sistema? No anules el cobro:
                      cargá esa deuda en <strong className="font-semibold text-foreground">Deuda pasada</strong>{" "}
                      (arriba, junto a «Saldo a favor») y lo que quedó a favor se usa solo para pagarla.
                    </span>
                  </p>
                ) : null}
                {algunoSinAnular && reglaAnular ? (
                  <p className="flex items-start gap-2">
                    <Info className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
                    <span>{reglaAnular}</span>
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
