import Link from "next/link";
import { ArrowRight, HandCoins, Vault, Wallet } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  formatARS,
  formatFechaLarga,
  hoyISO,
  labelPeriodo,
  periodoActual,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Codigo } from "@/components/shared/codigo";
import { Sello } from "@/components/shared/sello";
import { ChartCobranzaDiaria } from "@/components/charts/chart-cobranza-diaria";
import {
  armarSerieDiaria,
  rangoUltimosDias,
  type PuntoCobranza,
} from "@/components/charts/serie-cobranza";

export const metadata = { title: "Inicio" };

type ResumenConcepto = {
  codigo: string;
  nombre: string;
  estimado: number;
  cobrado: number;
  descuentos: number;
  pendiente: number;
};

function BarraConcepto({ fila }: { fila: ResumenConcepto }) {
  const objetivo = fila.cobrado + fila.pendiente;
  const pct = objetivo > 0 ? Math.min((fila.cobrado / objetivo) * 100, 100) : 100;
  const completo = fila.pendiente <= 0;
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5 py-3 sm:grid-cols-[5rem_1fr_11rem]">
      <Codigo codigo={fila.codigo} />
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate font-medium">{fila.nombre}</p>
          <p className="text-sm text-muted-foreground tabular sm:hidden">
            {formatARS(fila.cobrado)} / {formatARS(objetivo)}
          </p>
        </div>
        <div
          className="mt-1.5 h-3 overflow-hidden rounded-full bg-pendiente-suave"
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${fila.nombre}: cobrado ${formatARS(fila.cobrado)} de ${formatARS(objetivo)}`}
        >
          <div
            className="h-full rounded-full bg-pagado transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="col-start-2 text-sm text-muted-foreground tabular max-sm:hidden sm:col-start-3 sm:text-right">
        <span className="font-semibold text-pagado">{formatARS(fila.cobrado)}</span>
        {" de "}
        {formatARS(objetivo)}
        {completo ? null : (
          <span className="block text-pendiente">
            faltan {formatARS(fila.pendiente)}
          </span>
        )}
      </div>
    </div>
  );
}

export default async function InicioPage() {
  const perfil = await requireStaff();
  const supabase = await createClient();
  const periodo = periodoActual();
  const hoy = hoyISO();

  const tipoCajaPropia =
    perfil.rol === "guardia" ? "guardia" : "administracion";

  const [cajaHoyRes, resumenRes, pendientesValidarRes, deudaVencidaRes] =
    await Promise.all([
      supabase
        .from("cajas")
        .select("id, tipo, estado, total_efectivo, total_transferencia, total_cheques")
        .eq("fecha", hoy)
        .eq("tipo", tipoCajaPropia)
        .maybeSingle(),
      perfil.rol === "guardia"
        ? Promise.resolve({ data: null })
        : supabase.rpc("resumen_conceptos", { p_periodo: periodo }),
      perfil.rol === "tesoreria" || perfil.rol === "consejo"
        ? supabase.from("cajas").select("id", { count: "exact", head: true }).eq("estado", "cerrada")
        : Promise.resolve({ count: null }),
      perfil.rol === "guardia"
        ? Promise.resolve({ data: null })
        : supabase
            .from("v_deuda_clientes")
            .select("cliente_id, deuda, periodo_mas_viejo")
            .lt("periodo_mas_viejo", periodo)
            .gt("deuda", 0),
    ]);

  const cajaHoy = cajaHoyRes.data;
  const resumen = (resumenRes.data ?? []) as ResumenConcepto[];
  const pendientesValidar = pendientesValidarRes.count ?? 0;
  const clientesVencidos = deudaVencidaRes.data?.length ?? 0;

  // Cobrado hoy en la caja propia: siempre desde los pagos, esté la caja
  // abierta o cerrada (los totales del arqueo mezclan canon y gastos).
  let cobradoHoy = 0;
  if (cajaHoy) {
    const { data: pagosHoy } = await supabase
      .from("pagos")
      .select("monto")
      .eq("caja_id", cajaHoy.id)
      .eq("anulado", false);
    cobradoHoy = (pagosHoy ?? []).reduce((acc, p) => acc + Number(p.monto), 0);
  }

  // Cobranza de los últimos 14 días (solo roles que ven reportería).
  const veGrafico = ["admin", "tesoreria", "consejo"].includes(perfil.rol);
  let serie14: PuntoCobranza[] = [];
  if (veGrafico) {
    const rango14 = rangoUltimosDias(14);
    const [pagos14Res, canon14Res] = await Promise.all([
      supabase
        .from("pagos")
        .select("fecha, monto")
        .eq("anulado", false)
        .gte("fecha", `${rango14.desde}T00:00:00-03:00`),
      supabase
        .from("canon_camiones")
        .select("fecha, monto")
        .gte("fecha", rango14.desde),
    ]);
    serie14 = armarSerieDiaria(
      rango14.desde,
      rango14.hasta,
      pagos14Res.data ?? [],
      canon14Res.data ?? []
    );
  }

  const totales = resumen.reduce(
    (acc, fila) => ({
      cobrado: acc.cobrado + Number(fila.cobrado),
      pendiente: acc.pendiente + Number(fila.pendiente),
    }),
    { cobrado: 0, pendiente: 0 }
  );

  const puedeCobrar = ["admin", "guardia", "tesoreria"].includes(perfil.rol);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground first-letter:uppercase">
            {formatFechaLarga(hoy)}
          </p>
          <h1 className="font-display text-[1.7rem] font-extrabold tracking-tight">
            Hola, {perfil.nombre.split(" ")[0]}
          </h1>
        </div>
        {puedeCobrar ? (
          <Button asChild size="lg" className="h-13 px-6 text-base font-semibold">
            <Link href="/cobranza">
              <HandCoins className="size-5" />
              Cobrar
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        {/* Columna principal: la cobranza del período */}
        {perfil.rol === "guardia" ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tu día</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Cobrá a los quinteros y cargá el canon de camiones desde{" "}
                <strong>Cobrar</strong>. Al terminar el día, cerrá tu caja: el
                sistema te dice cuánta plata tenés que rendir.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/cobranza">
                    <HandCoins className="size-5" />
                    Cobrar quinteros
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/caja">
                    <Wallet className="size-5" />
                    Mi caja
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Cobranza de {labelPeriodo(periodo)}
              </CardTitle>
              <CardAction>
                <Link
                  href="/reportes"
                  className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
                >
                  Ver reportes
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent>
              {resumen.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <p className="font-medium text-foreground">
                    Todavía no se generó {labelPeriodo(periodo)}.
                  </p>
                  <p className="mt-1 text-sm">
                    Generá el período desde Facturación para ver los ingresos
                    estimados del mes.
                  </p>
                  <Button asChild variant="outline" className="mt-4 min-h-11 text-base">
                    <Link href="/facturacion">
                      Ir a Facturación
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <>
                  <div className="divide-y">
                    {resumen.map((fila) => (
                      <BarraConcepto key={fila.codigo} fila={fila} />
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-t pt-4">
                    <p className="text-muted-foreground">Total del mes</p>
                    <p className="text-lg tabular">
                      <span className="font-bold text-pagado">
                        {formatARS(totales.cobrado)}
                      </span>{" "}
                      <span className="text-muted-foreground">cobrado ·</span>{" "}
                      <span className="font-bold text-pendiente">
                        {formatARS(totales.pendiente)}
                      </span>{" "}
                      <span className="text-muted-foreground">por cobrar</span>
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Columna lateral: la caja de hoy y avisos.
            En tablet vertical va primero: la caja no puede quedar bajo el pliegue. */}
        <div className="space-y-6 max-lg:order-first">
          {puedeCobrar ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Caja de hoy</CardTitle>
                {cajaHoy ? (
                  <CardAction>
                    <Sello estado={cajaHoy.estado} />
                  </CardAction>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-4">
                {cajaHoy ? (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">Cobrado hoy</p>
                      <p className="text-2xl font-bold tabular">
                        {formatARS(cobradoHoy)}
                      </p>
                    </div>
                    <Button asChild variant="outline" className="min-h-11 w-full text-base">
                      <Link href="/caja">
                        Ir a la caja
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Todavía no abriste la caja de hoy. Se abre sola con el
                      primer cobro, o desde la pantalla de caja.
                    </p>
                    <Button asChild variant="outline" className="min-h-11 w-full text-base">
                      <Link href="/caja">
                        <Wallet className="size-5" />
                        Abrir caja
                      </Link>
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}

          {veGrafico ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Últimos 14 días</CardTitle>
                <CardDescription>Cobranza por día</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartCobranzaDiaria data={serie14} mini />
              </CardContent>
            </Card>
          ) : null}

          {(perfil.rol === "tesoreria" || perfil.rol === "consejo") &&
          pendientesValidar > 0 ? (
            <Card className="border-parcial bg-parcial-suave">
              <CardContent className="flex items-center justify-between gap-3 pt-6">
                <div>
                  <p className="font-semibold">
                    {pendientesValidar}{" "}
                    {pendientesValidar === 1 ? "caja cerrada" : "cajas cerradas"}{" "}
                    sin validar
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Controlalas y dales el OK.
                  </p>
                </div>
                <Button asChild className="min-h-11 text-base">
                  <Link href="/tesoreria">
                    <Vault className="size-5" />
                    Validar
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {perfil.rol !== "guardia" && clientesVencidos > 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="font-semibold">
                  <span className="text-pendiente">{clientesVencidos}</span>{" "}
                  {clientesVencidos === 1
                    ? "cliente con deuda vencida"
                    : "clientes con deuda vencida"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Deben meses anteriores a {labelPeriodo(periodo)}.
                </p>
                <Button asChild variant="outline" className="mt-3 min-h-11 text-base">
                  <Link href="/clientes?filtro=vencidos">Ver clientes</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
