import { Landmark, ShieldCheck } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  formatARS,
  formatFecha,
  formatFechaLarga,
  labelPeriodo,
  periodoActual,
  sumarMeses,
} from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { SelectorMes } from "@/components/tesoreria/selector-mes";
import { NuevoMovimiento } from "@/components/tesoreria/nuevo-movimiento";
import { BorrarMovimiento } from "@/components/tesoreria/borrar-movimiento";
import { SaldoInicialForm } from "@/components/tesoreria/saldo-inicial-form";
import { ValidarCajaDialog } from "@/components/tesoreria/validar-caja-dialog";

export const metadata = { title: "Tesorería" };

type FlujoCaja = {
  efectivo: number;
  banco: number;
  cheques_en_cartera: number;
  total: number;
};

const TIPO_CAJA_LABEL: Record<string, string> = {
  administracion: "Administración",
  guardia: "Guardia",
};

const TIPO_MOV_LABEL: Record<string, string> = {
  impuesto: "Impuesto",
  comision: "Comisión",
  ajuste: "Ajuste",
};

function CeldaFlujo({
  label,
  monto,
  destacada = false,
}: {
  label: string;
  monto: number;
  destacada?: boolean;
}) {
  if (destacada) {
    return (
      <div className="bg-primary px-5 py-5 text-primary-foreground sm:px-6">
        <p className="font-display text-xs font-semibold uppercase tracking-widest opacity-85">
          {label}
        </p>
        <p className="mt-1 text-3xl font-bold tabular md:text-4xl">
          {formatARS(monto)}
        </p>
      </div>
    );
  }
  return (
    <div className="bg-card px-5 py-5 sm:px-6">
      <p className="font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular md:text-3xl">
        {formatARS(monto)}
      </p>
    </div>
  );
}

export default async function TesoreriaPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const perfil = await requireRol("tesoreria", "consejo");
  const esTesoreria = perfil.rol === "tesoreria";
  const supabase = await createClient();

  const { mes: mesParam } = await searchParams;
  const mes = /^\d{4}-\d{2}-01$/.test(mesParam ?? "")
    ? (mesParam as string)
    : periodoActual();
  const mesSiguiente = sumarMeses(mes, 1);

  const [flujoRes, cerradasRes, validadasRes, movimientosRes, saldosRes, perfilesRes] =
    await Promise.all([
      supabase.rpc("flujo_caja"),
      supabase
        .from("cajas")
        .select(
          "id, fecha, tipo, cerrada_por, total_efectivo, total_transferencia, total_cheques, total_canon, total_gastos"
        )
        .eq("estado", "cerrada")
        .order("fecha", { ascending: true }),
      supabase
        .from("cajas")
        .select(
          "id, fecha, tipo, total_efectivo, total_transferencia, total_cheques, total_canon, validada_por, validada_en"
        )
        .eq("estado", "validada")
        .order("validada_en", { ascending: false })
        .limit(6),
      supabase
        .from("movimientos_tesoreria")
        .select("id, fecha, tipo, descripcion, monto")
        .gte("fecha", mes)
        .lt("fecha", mesSiguiente)
        .order("fecha", { ascending: false })
        .order("creado_en", { ascending: false }),
      supabase.from("saldos_iniciales").select("medio, monto, fecha, notas"),
      supabase.from("perfiles").select("user_id, nombre"),
    ]);

  const flujoRaw = (flujoRes.data ?? {}) as Partial<FlujoCaja>;
  const flujo: FlujoCaja = {
    efectivo: Number(flujoRaw.efectivo ?? 0),
    banco: Number(flujoRaw.banco ?? 0),
    cheques_en_cartera: Number(flujoRaw.cheques_en_cartera ?? 0),
    total: Number(flujoRaw.total ?? 0),
  };

  const cerradas = cerradasRes.data ?? [];
  const validadas = validadasRes.data ?? [];
  const movimientos = movimientosRes.data ?? [];
  const saldos = saldosRes.data ?? [];

  const nombres = new Map(
    (perfilesRes.data ?? []).map((p) => [p.user_id, p.nombre])
  );
  const nombreDe = (userId: string | null) =>
    (userId && nombres.get(userId)) || "—";

  const saldoEfectivo = saldos.find((s) => s.medio === "efectivo") ?? null;
  const saldoBanco = saldos.find((s) => s.medio === "transferencia") ?? null;

  const totalMovimientosMes = movimientos.reduce((acc, m) => {
    const monto = Number(m.monto);
    return acc + (m.tipo === "ajuste" ? monto : -monto);
  }, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Tesorería"
        descripcion="El control de la plata de la cooperativa: cajas, banco y flujo de caja."
      />

      {/* 1. Flujo de caja: cuánta plata tiene la cooperativa hoy, en vivo */}
      <section aria-label="Flujo de caja">
        <div className="overflow-hidden rounded-xl border bg-border shadow-xs">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 bg-card px-5 py-3.5 sm:px-6">
            <h2 className="font-display text-lg font-bold tracking-tight">
              Flujo de caja
            </h2>
            <p className="text-sm text-muted-foreground">
              Cuánta plata tiene la cooperativa hoy, en vivo
            </p>
          </div>
          <div className="grid gap-px border-t sm:grid-cols-2 lg:grid-cols-4">
            <CeldaFlujo label="Efectivo" monto={flujo.efectivo} />
            <CeldaFlujo label="Banco" monto={flujo.banco} />
            <CeldaFlujo label="Cheques en cartera" monto={flujo.cheques_en_cartera} />
            <CeldaFlujo label="Total" monto={flujo.total} destacada />
          </div>
        </div>
      </section>

      {/* 2. Cajas para validar */}
      <section className="space-y-4" aria-label="Cajas para validar">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight">
            Cajas para validar
          </h2>
          <p className="text-sm text-muted-foreground">
            {esTesoreria
              ? "Controlá cada caja cerrada contra el banco y dale el OK."
              : "Cajas cerradas que esperan el OK de tesorería."}
          </p>
        </div>

        {cerradas.length === 0 ? (
          <EmptyState
            icono={ShieldCheck}
            titulo="No hay cajas pendientes"
            descripcion="Todo controlado."
          />
        ) : (
          <div className="space-y-3">
            {cerradas.map((caja) => {
              const efectivo = Number(caja.total_efectivo ?? 0);
              const transferencia = Number(caja.total_transferencia ?? 0);
              const cheques = Number(caja.total_cheques ?? 0);
              const canon = Number(caja.total_canon ?? 0);
              const gastos = Number(caja.total_gastos ?? 0);
              const total = efectivo + transferencia + cheques;
              const tipoLabel = TIPO_CAJA_LABEL[caja.tipo] ?? caja.tipo;
              return (
                <div
                  key={caja.id}
                  className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 rounded-xl border bg-card p-5"
                >
                  <div className="min-w-44">
                    <p className="font-semibold first-letter:uppercase">
                      {formatFechaLarga(caja.fecha)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {tipoLabel} · La cerró {nombreDe(caja.cerrada_por)}
                    </p>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm sm:grid-cols-4">
                    {[
                      ["Efectivo", efectivo],
                      ["Transferencias", transferencia],
                      ["Cheques", cheques],
                      ["Canon", canon],
                    ].map(([label, monto]) => (
                      <div key={label as string}>
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd>
                          <Money monto={monto as number} className="font-medium" />
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <div className="flex items-center gap-5">
                    <div className="text-right">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Total
                      </p>
                      <p className="text-xl font-bold tabular">{formatARS(total)}</p>
                    </div>
                    {esTesoreria ? (
                      <ValidarCajaDialog
                        caja={{
                          id: caja.id,
                          fecha: caja.fecha,
                          tipoLabel,
                          cerradaPor: nombreDe(caja.cerrada_por),
                          efectivo,
                          transferencia,
                          cheques,
                          canon,
                          gastos,
                        }}
                      />
                    ) : (
                      <Sello estado="cerrada" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Últimas validadas */}
        {validadas.length > 0 ? (
          <Card className="text-sm">
            <CardHeader>
              <CardTitle className="text-base">Últimas validadas</CardTitle>
            </CardHeader>
            <CardContent>
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Efectivo</TableHead>
                    <TableHead className="text-right">Transf.</TableHead>
                    <TableHead className="text-right">Cheques</TableHead>
                    <TableHead className="text-right">Canon</TableHead>
                    <TableHead>Validó</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validadas.map((caja) => (
                    <TableRow key={caja.id}>
                      <TableCell className="py-3 font-medium">
                        {formatFecha(caja.fecha)}
                      </TableCell>
                      <TableCell className="py-3">
                        {TIPO_CAJA_LABEL[caja.tipo] ?? caja.tipo}
                      </TableCell>
                      <TableCell className="py-3 text-right tabular">
                        <Money monto={caja.total_efectivo} />
                      </TableCell>
                      <TableCell className="py-3 text-right tabular">
                        <Money monto={caja.total_transferencia} />
                      </TableCell>
                      <TableCell className="py-3 text-right tabular">
                        <Money monto={caja.total_cheques} />
                      </TableCell>
                      <TableCell className="py-3 text-right tabular">
                        <Money monto={caja.total_canon} />
                      </TableCell>
                      <TableCell className="py-3">
                        {nombreDe(caja.validada_por)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}
      </section>

      {/* 3. Movimientos bancarios */}
      <section className="space-y-4" aria-label="Movimientos bancarios">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight">
              Movimientos bancarios
            </h2>
            <p className="text-sm text-muted-foreground">
              Impuestos y comisiones que descuenta el banco, y ajustes del saldo.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SelectorMes mes={mes} />
            {esTesoreria ? <NuevoMovimiento /> : null}
          </div>
        </div>

        {movimientos.length === 0 ? (
          <EmptyState
            icono={Landmark}
            titulo={`Sin movimientos en ${labelPeriodo(mes)}`}
            descripcion={
              esTesoreria
                ? "Registrá los impuestos y comisiones del resumen bancario del mes."
                : "Tesorería todavía no registró movimientos este mes."
            }
          />
        ) : (
          <Card className="text-sm">
            <CardContent>
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    {esTesoreria ? (
                      <TableHead className="w-14">
                        <span className="sr-only">Acciones</span>
                      </TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimientos.map((m) => {
                    const monto = Number(m.monto);
                    const visual = m.tipo === "ajuste" ? monto : -monto;
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="py-3 font-medium">
                          {formatFecha(m.fecha)}
                        </TableCell>
                        <TableCell className="py-3">
                          <Sello
                            estado={m.tipo}
                            texto={TIPO_MOV_LABEL[m.tipo] ?? m.tipo}
                          />
                        </TableCell>
                        <TableCell className="max-w-72 truncate py-3">
                          {m.descripcion}
                        </TableCell>
                        <TableCell className="py-3 text-right tabular">
                          <Money
                            monto={visual}
                            className={visual > 0 ? "text-pagado" : undefined}
                          />
                        </TableCell>
                        {esTesoreria ? (
                          <TableCell className="py-1 text-right">
                            <BorrarMovimiento
                              id={m.id}
                              descripcion={m.descripcion}
                              monto={monto}
                            />
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={3} className="py-3 font-semibold">
                      Total de {labelPeriodo(mes)}
                    </TableCell>
                    <TableCell className="py-3 text-right tabular font-bold">
                      <Money monto={totalMovimientosMes} />
                    </TableCell>
                    {esTesoreria ? <TableCell /> : null}
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      {/* 4. Saldos iniciales */}
      <section className="space-y-4" aria-label="Saldos iniciales">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight">
            Saldos iniciales
          </h2>
          <p className="text-sm text-muted-foreground">
            La plata que había al empezar a usar el sistema. Se carga una sola vez.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              { medio: "efectivo", titulo: "Efectivo", saldo: saldoEfectivo },
              { medio: "transferencia", titulo: "Banco", saldo: saldoBanco },
            ] as const
          ).map(({ medio, titulo, saldo }) => (
            <Card key={medio} className="text-sm">
              <CardHeader>
                <CardTitle className="text-base">{titulo}</CardTitle>
              </CardHeader>
              <CardContent>
                {esTesoreria ? (
                  <SaldoInicialForm
                    medio={medio}
                    monto={saldo ? Number(saldo.monto) : null}
                    fecha={saldo?.fecha ?? null}
                    notas={saldo?.notas ?? null}
                  />
                ) : saldo ? (
                  <div className="space-y-1">
                    <p className="text-2xl font-semibold tabular">
                      {formatARS(saldo.monto)}
                    </p>
                    <p className="text-muted-foreground">
                      Al {formatFecha(saldo.fecha)}
                      {saldo.notas ? ` · ${saldo.notas}` : ""}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    Tesorería todavía no cargó este saldo.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
