import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import type { Rol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatARS, formatCuit, formatFecha } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Codigo } from "@/components/shared/codigo";
import { Money } from "@/components/shared/money";
import { AccionesGasto } from "@/components/gastos/acciones-gasto";
import { cargarCajasElegibles } from "@/components/gastos/datos";
import { etiquetaGasto } from "@/components/gastos/tipos";
import { FlujoFondos, type SinSaldoInicial } from "@/components/tesoreria/flujo-fondos";
import { AccionesRapidas } from "@/components/tesoreria/nuevo-movimiento";
import { CajasParaValidar } from "@/components/tesoreria/cajas-para-validar";
import { SaldosIniciales, type SaldoInicial } from "@/components/tesoreria/saldos-iniciales";
import {
  cargarCajasPendientes,
  cargarFlujo,
  saldosDesdeFlujo,
} from "@/components/tesoreria/datos";

function Bloque({
  id,
  tour,
  titulo,
  detalle,
  accion,
  children,
}: {
  /** Ancla para llegar directo (p. ej. "/tesoreria#cajas-para-validar" desde el Inicio). */
  id?: string;
  /** Ancla del tour guiado (`data-tour`). */
  tour?: string;
  titulo: string;
  detalle?: React.ReactNode;
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} data-tour={tour} className="scroll-mt-24 space-y-3" aria-label={titulo}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight">{titulo}</h2>
          {detalle ? <p className="text-sm text-muted-foreground">{detalle}</p> : null}
        </div>
        {accion}
      </div>
      {children}
    </section>
  );
}

function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const f = new Date(y, m - 1, d + dias);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
}

/**
 * Pestaña "Hoy" de Tesorería: la plata (pesos, dólares, cheques), las acciones
 * rápidas y lo que hay que hacer hoy (cajas para validar, cheques para depositar,
 * gastos que vencen). Sin saldos iniciales, lo primero es cargarlos.
 */
export async function PestanaHoy({
  rol,
  hoy,
  saldos,
}: {
  rol: Rol;
  hoy: string;
  saldos: SaldoInicial[];
}) {
  if (saldos.length === 0) {
    // Sin saldos iniciales igual se ven las cajas para validar: el Inicio y el menú
    // mandan acá para validarlas (no dependen de los saldos).
    const cajasSinSaldos = await cargarCajasPendientes(await createClient());
    return (
      <div className="space-y-10">
        <section className="space-y-5" aria-label="Saldos iniciales">
          <div data-tour="tesoreria-saldos-aviso" className="rounded-xl border border-primary/30 bg-accent/60 px-5 py-4">
            <h2 className="font-display text-xl font-bold tracking-tight">Antes de empezar, cargá cuánta plata había</h2>
            <p className="mt-1 max-w-prose text-base text-muted-foreground">
              Poné el efectivo y el saldo del banco (en pesos y, si hay, en dólares) de un día. Desde ese
              día el sistema suma los cobros y resta los gastos solo. Si alguna cuenta no tiene plata,
              cargala en cero.
            </p>
          </div>
          <SaldosIniciales saldos={saldos} />
        </section>
        {cajasSinSaldos.length > 0 ? (
          <Bloque id="cajas-para-validar" tour="tesoreria-cajas" titulo="Cajas para contar y validar">
            <CajasParaValidar cajas={cajasSinSaldos} />
          </Bloque>
        ) : null}
      </div>
    );
  }

  const supabase = await createClient();
  const [{ flujo, error }, cajas, chequesRes, gastosRes, cajasElegibles] = await Promise.all([
    cargarFlujo(supabase),
    cargarCajasPendientes(supabase),
    supabase
      .from("cheques")
      .select("id, numero, monto, fecha_cobro, puesto, recibido_de, cuit")
      .eq("estado", "en_cartera")
      .lte("fecha_cobro", hoy)
      .order("fecha_cobro", { ascending: true }),
    supabase
      .from("gastos")
      .select("id, descripcion, monto, vencimiento, pagado_desde, rubro:rubros_gasto(codigo, nombre)")
      .eq("estado", "pendiente")
      .not("vencimiento", "is", null)
      .lte("vencimiento", sumarDias(hoy, 7))
      .order("vencimiento", { ascending: true }),
    cargarCajasElegibles(supabase, rol, hoy),
  ]);

  const listos = chequesRes.data ?? [];
  const totalListos = listos.reduce((acc, c) => acc + Number(c.monto), 0);
  // Todos los vencidos y por vencer (el total es el real); en la lista, los primeros 30.
  const gastos = gastosRes.data ?? [];
  const totalGastos = gastos.reduce((acc, g) => acc + Number(g.monto), 0);
  const GASTOS_VISIBLES = 30;
  const cajasAdmin = cajas.filter((c) => c.tipo === "administracion").length;
  const falta = (medio: "efectivo" | "transferencia", moneda: "ARS" | "USD") =>
    !saldos.some((x) => x.medio === medio && x.moneda === moneda);
  const sinSaldo: SinSaldoInicial = {
    ARS: { efectivo: falta("efectivo", "ARS"), banco: falta("transferencia", "ARS") },
    USD: { efectivo: falta("efectivo", "USD"), banco: falta("transferencia", "USD") },
  };

  return (
    <div className="space-y-10">
      {error ? (
        <p className="flex gap-2 rounded-lg bg-pendiente-suave px-4 py-3 text-sm font-medium text-pendiente">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          No se pudo calcular la plata de hoy: {error}. Actualizá la página.
        </p>
      ) : (
        <FlujoFondos flujo={flujo} sinSaldo={sinSaldo} />
      )}

      <Bloque titulo="Registrar un movimiento" detalle="Depósitos, extracciones y lo que cobra o descuenta el banco.">
        <AccionesRapidas saldos={saldosDesdeFlujo(flujo)} />
      </Bloque>

      <Bloque
        id="cajas-para-validar"
        tour="tesoreria-cajas"
        titulo="Cajas para contar y validar"
        detalle={
          cajas.length === 0
            ? "Todo validado."
            : `${cajasAdmin} de administración${cajas.length > cajasAdmin ? ` y ${cajas.length - cajasAdmin} de portería` : ""}`
        }
      >
        <CajasParaValidar cajas={cajas} />
      </Bloque>

      <Bloque
        titulo="Cheques para depositar"
        detalle={
          listos.length === 0
            ? "No hay cheques listos: los diferidos aparecen acá cuando llega su fecha."
            : `${listos.length} ${listos.length === 1 ? "cheque" : "cheques"} por ${formatARS(totalListos)}`
        }
        accion={
          listos.length > 0 ? (
            <Button asChild className="h-11 px-4 text-base font-semibold">
              <Link href="/cheques?estado=listos">
                Depositar en Cheques
                <ArrowRight className="size-4" strokeWidth={2} />
              </Link>
            </Button>
          ) : null
        }
      >
        {listos.length > 0 ? (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {listos.slice(0, 5).map((c) => (
              <li
                key={c.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-base font-semibold tabular">Cheque N° {c.numero}</p>
                  <p className="text-sm break-words text-muted-foreground">
                    {[c.puesto, c.recibido_de, c.cuit ? `CUIT ${formatCuit(c.cuit)}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                    {` · se cobra desde el ${formatFecha(c.fecha_cobro).slice(0, 5)}`}
                  </p>
                </div>
                <Money monto={c.monto} className="text-base font-semibold" />
              </li>
            ))}
            {listos.length > 5 ? (
              <li className="px-4 py-2.5 text-sm text-muted-foreground">
                y {listos.length - 5} más en Cheques.
              </li>
            ) : null}
          </ul>
        ) : null}
      </Bloque>

      <Bloque
        tour="tesoreria-gastos-pagar"
        titulo="Gastos a pagar"
        detalle={
          gastos.length === 0
            ? "Nada vencido ni por vencer en los próximos 7 días."
            : `${gastos.length === 1 ? "1 gasto vencido o por vencer" : `${gastos.length} gastos vencidos o por vencer`} en 7 días: ${formatARS(totalGastos)}`
        }
        accion={
          <Button asChild variant="outline" className="h-11 px-4 text-base">
            <Link href="/gastos">
              Ver todos los gastos
              <ArrowRight className="size-4" strokeWidth={2} />
            </Link>
          </Button>
        }
      >
        {gastos.length > 0 ? (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {gastos.slice(0, GASTOS_VISIBLES).map((g) => {
              const etiqueta = etiquetaGasto(g.descripcion, g.rubro?.nombre);
              // Rubro con su nombre (el código solo no se entiende), salvo que ya sea el título.
              const rubro = g.descripcion?.trim() && g.rubro?.nombre ? g.rubro.nombre : null;
              const vencido = (g.vencimiento ?? "") < hoy;
              return (
                // Monto y "Pagar" siempre en la misma columna (a la derecha desde 640 px;
                // abajo en el celular), aunque el título ocupe dos renglones.
                <li
                  key={g.id}
                  data-tour="tesoreria-gasto"
                  className={cn(
                    "grid gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center",
                    vencido && "bg-pendiente-suave/50"
                  )}
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-base font-semibold break-words">{etiqueta}</p>
                    <p className="text-sm break-words">
                      {g.rubro ? <Codigo codigo={g.rubro.codigo} className="mr-1.5 align-middle" /> : null}
                      {rubro ? <span className="text-muted-foreground">{rubro} · </span> : null}
                      <span className={vencido ? "font-semibold text-pendiente" : "text-muted-foreground"}>
                        {vencido ? "Venció" : g.vencimiento === hoy ? "Vence hoy" : "Vence"}{" "}
                        {formatFecha(g.vencimiento).slice(0, 5)}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <Money monto={g.monto} className={vencido ? "text-lg font-bold text-pendiente" : "text-lg font-bold"} />
                    <AccionesGasto
                      gasto={{
                        id: g.id,
                        etiqueta,
                        monto: Number(g.monto),
                        estado: "pendiente",
                        pagadoDesde: g.pagado_desde,
                      }}
                      cajas={cajasElegibles}
                      hoy={hoy}
                      preferirCaja={rol !== "tesoreria"}
                      soloPagar
                    />
                  </div>
                </li>
              );
            })}
            {gastos.length > GASTOS_VISIBLES ? (
              <li className="px-4 py-2.5 text-sm text-muted-foreground">
                y {gastos.length - GASTOS_VISIBLES} más en{" "}
                <Link href="/gastos" className="font-medium text-primary hover:underline">
                  Gastos
                </Link>
                .
              </li>
            ) : null}
          </ul>
        ) : null}
      </Bloque>
    </div>
  );
}
