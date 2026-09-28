import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hoyISO, periodoActual, sumarMeses } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { BotonExportar } from "@/components/shared/boton-exportar";
import {
  PESTANAS_TESORERIA,
  PestanasTesoreria,
  type PestanaTesoreria,
} from "@/components/tesoreria/pestanas";
import { PestanaHoy } from "@/components/tesoreria/pestana-hoy";
import { PestanaConciliar } from "@/components/tesoreria/pestana-conciliar";
import { SaldosIniciales } from "@/components/tesoreria/saldos-iniciales";
import { MovimientosMes } from "@/components/tesoreria/movimientos-mes";
import { SelectorMes } from "@/components/tesoreria/selector-mes";
import { AccionesRapidas } from "@/components/tesoreria/nuevo-movimiento";
import {
  cargarFlujo,
  cargarMovimientos,
  cargarSaldosIniciales,
  saldosDesdeFlujo,
} from "@/components/tesoreria/datos";

export const metadata = { title: "Tesorería" };

export default async function TesoreriaPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; mes?: string }>;
}) {
  // Tesorería y el Líder de Procesos, con todas las acciones (§1.3 D-P2).
  const perfil = await requireRol("tesoreria", "lider");
  const { tab, mes: mesParam } = await searchParams;
  const pestana: PestanaTesoreria = PESTANAS_TESORERIA.includes(tab as PestanaTesoreria)
    ? (tab as PestanaTesoreria)
    : "hoy";
  const mes = /^\d{4}-\d{2}-01$/.test(mesParam ?? "") ? (mesParam as string) : periodoActual();
  const hoy = hoyISO();

  const supabase = await createClient();
  const [saldos, transferenciasRes, facturasRes] = await Promise.all([
    cargarSaldosIniciales(supabase),
    supabase
      .from("pagos")
      .select("id", { count: "exact", head: true })
      .eq("medio", "transferencia")
      .eq("anulado", false)
      .eq("conciliado", false),
    supabase
      .from("gastos")
      .select("id", { count: "exact", head: true })
      .eq("estado", "pagado")
      .eq("comprobante_validado", false)
      .not("factura_path", "is", null),
  ]);

  const pendientes = {
    conciliar: (transferenciasRes.count ?? 0) + (facturasRes.count ?? 0),
    saldos: 4 - saldos.length,
  };

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Tesorería"
        descripcion="La plata de la cooperativa: efectivo, banco, dólares y cheques; las cajas para validar y los movimientos del banco."
      >
        <BotonExportar dataset="cajas" periodo={mes} label="Cajas del mes (.xlsx)" />
      </PageHeader>

      <PestanasTesoreria activa={pestana} pendientes={pendientes} />

      {pestana === "hoy" ? <PestanaHoy rol={perfil.rol} hoy={hoy} saldos={saldos} /> : null}

      {pestana === "movimientos" ? (
        <PestanaMovimientos mes={mes} />
      ) : null}

      {pestana === "conciliar" ? <PestanaConciliar puedeOperar /> : null}

      {pestana === "saldos" ? (
        <section className="space-y-4" aria-label="Saldos iniciales">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight">Saldos iniciales</h2>
            <p className="max-w-prose text-sm text-muted-foreground">
              Cuánta plata había al comenzar un día, en cada cuenta. Desde ese día el flujo suma y
              resta solo. Se carga una vez; si te equivocaste, corregilo.
            </p>
          </div>
          <SaldosIniciales saldos={saldos} />
        </section>
      ) : null}
    </div>
  );
}

async function PestanaMovimientos({ mes }: { mes: string }) {
  const supabase = await createClient();
  const [{ flujo }, movimientos] = await Promise.all([
    cargarFlujo(supabase),
    cargarMovimientos(supabase, mes, sumarMeses(mes, 1)),
  ]);
  return (
    <div className="space-y-6">
      <section className="space-y-3" aria-label="Registrar un movimiento">
        <h2 className="font-display text-lg font-bold tracking-tight">Registrar un movimiento</h2>
        <AccionesRapidas saldos={saldosDesdeFlujo(flujo)} />
      </section>
      <section className="space-y-3" aria-label="Movimientos del mes">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold tracking-tight">Movimientos del mes</h2>
          <div className="flex flex-wrap items-center gap-2">
            <SelectorMes mes={mes} />
            <BotonExportar dataset="movimientos_tesoreria" periodo={mes} label="Exportar" />
          </div>
        </div>
        <MovimientosMes movimientos={movimientos} mes={mes} puedeOperar />
      </section>
    </div>
  );
}
