import { Banknote, Landmark, Receipt, Truck } from "lucide-react";
import type { Perfil } from "@/lib/auth";
import { formatARS, hoyISO, labelPeriodo, periodoActual } from "@/lib/format";
import { CajaRegistradora } from "@/components/shared/iconos";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Money } from "@/components/shared/money";
import { ChartCobranzaDiaria } from "@/components/charts/chart-cobranza-diaria";
import { cajasParaValidar, contar, resumenDelMes, serieUltimos14, type Supabase } from "./datos";
import { BarraConcepto, BarraEstimado, TarjetaAviso, type Aviso } from "./bloques";

/**
 * Inicio de Tesorería (J1, J4, J5, J7): no cobra ni tiene caja propia. Lo que
 * importa es cuánto se tendría que cobrar en el mes y cuánto se cobró (estimado
 * vs cobrado), el bono camioneros aparte, y lo que espera su control: cajas para
 * validar, transferencias sin conciliar y cheques para depositar.
 */
export async function InicioTesoreria({ perfil, supabase }: { perfil: Perfil; supabase: Supabase }) {
  const org = perfil.org_id;
  const periodo = periodoActual();
  const hoy = hoyISO();

  const [resumen, serie, cajasValidar, transferenciasCobros, chequesListos, gastosVencidos, transferenciasBono] =
    await Promise.all([
      resumenDelMes(supabase, periodo),
      serieUltimos14(supabase),
      cajasParaValidar(supabase, org),
      contar(
        supabase
          .from("pagos")
          .select("id", { count: "exact", head: true })
          .eq("org_id", org)
          .eq("medio", "transferencia")
          .eq("anulado", false)
          .eq("conciliado", false)
      ),
      contar(
        supabase
          .from("cheques")
          .select("id", { count: "exact", head: true })
          .eq("org_id", org)
          .eq("estado", "en_cartera")
          .lte("fecha_cobro", hoy)
      ),
      contar(
        supabase
          .from("gastos")
          .select("id", { count: "exact", head: true })
          .eq("org_id", org)
          .eq("estado", "pendiente")
          .lt("vencimiento", hoy)
      ),
      // Bono camioneros cobrado por transferencia: también se cruza con el banco (J2).
      contar(
        supabase
          .from("canon_camiones")
          .select("id", { count: "exact", head: true })
          .eq("org_id", org)
          .eq("medio", "transferencia")
          .eq("anulado", false)
          .eq("conciliado", false)
      ),
    ]);
  const transferencias = transferenciasCobros + transferenciasBono;

  // El bono camioneros (BC) no tiene "estimado": se cobra en el momento. Va aparte.
  const conceptos = resumen.filter((f) => f.codigo !== "BC");
  const bono = resumen.find((f) => f.codigo === "BC");
  const estimado = conceptos.reduce((a, f) => a + f.estimado, 0);
  const cobrado = conceptos.reduce((a, f) => a + f.cobrado, 0);
  const beneficios = conceptos.reduce((a, f) => a + f.descuentos, 0);
  const falta = Math.max(estimado - cobrado - beneficios, 0);
  const debenHoy = conceptos.reduce((a, f) => a + f.pendiente, 0);
  const pct = estimado > 0 ? Math.round((cobrado / estimado) * 100) : 0;

  const avisos: Aviso[] = [
    {
      clave: "validar",
      n: cajasValidar.n,
      singular: "caja para contar y validar",
      plural: "cajas para contar y validar",
      descripcion:
        cajasValidar.n === 1
          ? "Contá el efectivo y dale el OK definitivo."
          : "Contá el efectivo de cada una y dales el OK definitivo.",
      href: cajasValidar.href,
      cta: cajasValidar.n === 1 ? "Validar" : "Ver cajas",
      icono: CajaRegistradora,
      tono: "parcial" as const,
    },
    {
      clave: "transferencias",
      n: transferencias,
      singular: "transferencia sin conciliar",
      plural: "transferencias sin conciliar",
      descripcion: "Cotejalas con el banco y marcalas conciliadas.",
      href: "/tesoreria?tab=conciliar",
      cta: "Conciliar",
      icono: Landmark,
      tono: "parcial" as const,
    },
    {
      clave: "cheques",
      n: chequesListos,
      singular: "cheque para depositar",
      plural: "cheques para depositar",
      descripcion: "Ya se pueden cobrar: llevalos al banco.",
      href: "/cheques",
      cta: "Ver cheques",
      icono: Banknote,
      tono: "parcial" as const,
    },
    {
      clave: "gastos",
      n: gastosVencidos,
      singular: "gasto vencido sin pagar",
      plural: "gastos vencidos sin pagar",
      descripcion: "Pagalos desde Tesorería o desde la caja de un día.",
      href: "/gastos",
      cta: "Ver gastos",
      icono: Receipt,
      tono: "pendiente" as const,
    },
  ].filter((a) => a.n > 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Estimado y cobrado de {labelPeriodo(periodo)}</CardTitle>
          <CardDescription>Lo que se tendría que cobrar en el mes y lo que ya entró.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {conceptos.length === 0 ? (
            <p className="rounded-lg bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
              Administración todavía no generó {labelPeriodo(periodo)}. Cuando lo genere, vas a ver
              acá cuánto se tendría que cobrar.
            </p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Se tendría que cobrar</p>
                  <Money monto={estimado} className="font-display text-3xl font-extrabold" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Se cobró</p>
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <Money monto={cobrado} className="font-display text-3xl font-extrabold text-pagado" />
                    <span className="text-lg font-semibold text-muted-foreground tabular">{pct} %</span>
                  </p>
                </div>
              </div>
              <BarraEstimado
                cobrado={cobrado}
                beneficios={beneficios}
                falta={falta}
                etiqueta={`Cobrado ${formatARS(cobrado)} de ${formatARS(estimado)}`}
              />
              {Math.abs(debenHoy - falta) > 1 ? (
                <p className="text-sm text-muted-foreground">
                  Hoy se deben <Money monto={debenHoy} className="font-semibold text-foreground" />{" "}
                  (los que todavía pagan en término conservan el beneficio).
                </p>
              ) : null}

              <div className="divide-y border-t">
                {conceptos.map((fila) => (
                  <BarraConcepto
                    key={fila.codigo}
                    fila={fila}
                    objetivo={fila.estimado}
                    faltaTexto={Math.max(fila.estimado - fila.cobrado - fila.descuentos, 0)}
                  />
                ))}
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-primary">
                <Truck className="size-5" strokeWidth={2} />
              </span>
              <div>
                <p className="text-sm text-muted-foreground">Bono camioneros del mes (cobrado en portería)</p>
                <Money monto={Number(bono?.cobrado ?? 0)} className="font-display text-2xl font-bold" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6 max-lg:order-first">
        {avisos.map((aviso) => (
          <TarjetaAviso key={aviso.clave} aviso={aviso} />
        ))}
        {avisos.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Nada espera tu control por ahora: no hay cajas para validar, transferencias sin
              conciliar ni cheques para depositar.
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos 14 días</CardTitle>
            <CardDescription>Lo que entró por día (cobros y bono camioneros)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartCobranzaDiaria data={serie} mini />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
