import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  ClipboardCheck,
  DoorOpen,
  HandCoins,
  Landmark,
  MessagesSquare,
  Vault,
  type LucideIcon,
} from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  formatARS,
  formatFechaLarga,
  hoyISO,
  labelPeriodo,
  periodoActual,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { CajaRegistradora } from "@/components/shared/iconos";
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

/** Barra verde (cobrado) sobre pista roja suave (lo que falta), por concepto. */
function BarraConcepto({ fila }: { fila: ResumenConcepto }) {
  const cobrado = Number(fila.cobrado);
  const pendiente = Number(fila.pendiente);
  const objetivo = cobrado + pendiente;
  const pct = objetivo > 0 ? Math.min((cobrado / objetivo) * 100, 100) : 100;
  const completo = pendiente <= 0;
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5 py-3 sm:grid-cols-[5rem_1fr_11rem]">
      <Codigo codigo={fila.codigo} />
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate font-medium">{fila.nombre}</p>
          <p className="text-sm text-muted-foreground tabular sm:hidden">
            {formatARS(cobrado)} / {formatARS(objetivo)}
          </p>
        </div>
        <div
          className="mt-1.5 h-3 overflow-hidden rounded-full bg-pendiente-suave"
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${fila.nombre}: cobrado ${formatARS(cobrado)} de ${formatARS(objetivo)}`}
        >
          <div
            className="h-full rounded-full bg-pagado transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="col-start-2 text-sm text-muted-foreground tabular max-sm:hidden sm:col-start-3 sm:text-right">
        <span className="font-semibold text-pagado">{formatARS(cobrado)}</span>
        {" de "}
        {formatARS(objetivo)}
        {completo ? null : (
          <span className="block text-pendiente">faltan {formatARS(pendiente)}</span>
        )}
      </div>
    </div>
  );
}

/** Aviso lateral: qué hay pendiente, cuánto, y el botón que lo resuelve. */
type Aviso = {
  clave: string;
  n: number;
  singular: string;
  plural: string;
  descripcion: string;
  href: string;
  cta: string;
  icono?: LucideIcon;
  /** "parcial" = espera una acción tuya (ámbar); "pendiente" = deuda (rojo). */
  tono: "parcial" | "pendiente";
};

function TarjetaAviso({ aviso }: { aviso: Aviso }) {
  const Icono = aviso.icono;
  const titulo = aviso.n === 1 ? aviso.singular : aviso.plural;
  if (aviso.tono === "pendiente") {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="font-semibold">
            <span className="text-pendiente">{aviso.n}</span> {titulo}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{aviso.descripcion}</p>
          <Button asChild variant="outline" className="mt-3 min-h-11 text-base">
            <Link href={aviso.href}>{aviso.cta}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="border-parcial bg-parcial-suave">
      <CardContent className="flex items-center justify-between gap-3 pt-6">
        <div>
          <p className="font-semibold">
            {aviso.n} {titulo}
          </p>
          <p className="text-sm text-muted-foreground">{aviso.descripcion}</p>
        </div>
        <Button asChild className="min-h-11 shrink-0 text-base">
          <Link href={aviso.href}>
            {Icono ? <Icono className="size-5" strokeWidth={2} /> : null}
            {aviso.cta}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/** Fila del escritorio del Líder: número grande + qué es + botón. */
function FilaEscritorio({
  n,
  titulo,
  detalle,
  href,
  cta,
  icono: Icono,
}: {
  n: number;
  titulo: string;
  detalle: string;
  href: string;
  cta: string;
  icono: LucideIcon;
}) {
  return (
    <div className="grid grid-cols-[4rem_1fr] items-center gap-x-4 gap-y-2 py-4 sm:grid-cols-[4rem_1fr_auto]">
      <p
        className={cn(
          "font-display text-3xl font-extrabold tabular",
          n > 0 ? "text-parcial" : "text-muted-foreground/60"
        )}
      >
        {n}
      </p>
      <div className="min-w-0">
        <p className="font-medium">{titulo}</p>
        <p className="text-sm text-muted-foreground">{detalle}</p>
      </div>
      <Button
        asChild
        variant={n > 0 ? "default" : "outline"}
        className="col-start-2 min-h-11 justify-self-start text-base sm:col-start-3 sm:justify-self-end"
      >
        <Link href={href}>
          <Icono className="size-5" strokeWidth={2} />
          {cta}
        </Link>
      </Button>
    </div>
  );
}

export default async function InicioPage() {
  const perfil = await requireStaff();
  // Portería tiene su propia pantalla de inicio (rutaInicio ya apunta ahí).
  if (perfil.rol === "porteria") redirect("/porteria");

  const supabase = await createClient();
  const org = perfil.org_id;
  const rol = perfil.rol;
  const periodo = periodoActual();
  const hoy = hoyISO();

  const puedeCobrar = rol === "admin" || rol === "guardia" || rol === "tesoreria";
  const veCobranzaMes = rol !== "guardia";
  const veGrafico = veCobranzaMes;
  const veReportes = rol === "tesoreria" || rol === "consejo" || rol === "lider";
  const tipoCajaPropia = rol === "guardia" ? "guardia" : "administracion";

  const cuenta = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const cero = Promise.resolve(0);

  const [
    cajaHoyRes,
    resumenRes,
    deudaVencidaRes,
    cajasSinValidar,
    rendicionesSinIntegrar,
    pedidosReapertura,
    transferenciasSinConciliar,
    cambiosPorAprobar,
    solicitudesRes,
    ingresosHoyRes,
  ] = await Promise.all([
    puedeCobrar
      ? supabase
          .from("cajas")
          .select("id, tipo, estado")
          .eq("org_id", org)
          .eq("fecha", hoy)
          .eq("tipo", tipoCajaPropia)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    veCobranzaMes
      ? supabase.rpc("resumen_conceptos", { p_periodo: periodo })
      : Promise.resolve({ data: null }),
    veCobranzaMes
      ? supabase
          .from("v_deuda_clientes")
          .select("cliente_id")
          .eq("org_id", org)
          .lt("periodo_mas_viejo", periodo)
          .gt("deuda", 0)
      : Promise.resolve({ data: null }),
    // Cajas que esperan el OK de Tesorería (cerradas o ya integradas en la caja mayor).
    rol === "tesoreria" || rol === "consejo" || rol === "lider"
      ? cuenta(
          supabase
            .from("cajas")
            .select("id", { count: "exact", head: true })
            .eq("org_id", org)
            .in("estado", ["cerrada", "integrada"])
        )
      : cero,
    // Rendiciones de Portería cerradas que Administración todavía no integró.
    rol === "admin" || rol === "lider"
      ? cuenta(
          supabase
            .from("cajas")
            .select("id", { count: "exact", head: true })
            .eq("org_id", org)
            .eq("tipo", "guardia")
            .eq("estado", "cerrada")
        )
      : cero,
    rol === "admin"
      ? cuenta(
          supabase
            .from("cajas")
            .select("id", { count: "exact", head: true })
            .eq("org_id", org)
            .not("reapertura_solicitada_en", "is", null)
        )
      : cero,
    rol === "tesoreria"
      ? cuenta(
          supabase
            .from("pagos")
            .select("id", { count: "exact", head: true })
            .eq("org_id", org)
            .eq("medio", "transferencia")
            .eq("anulado", false)
            .eq("conciliado", false)
        )
      : cero,
    rol === "lider"
      ? cuenta(
          supabase
            .from("cambios_pendientes")
            .select("id", { count: "exact", head: true })
            .eq("org_id", org)
            .eq("estado", "pendiente")
        )
      : cero,
    rol === "lider" || rol === "admin" || rol === "consejo"
      ? supabase
          .from("solicitudes")
          .select("estado")
          .eq("org_id", org)
          .in("estado", ["nueva", "en_revision", "en_consejo", "resuelta", "asignada"])
      : Promise.resolve({ data: null }),
    rol === "guardia"
      ? supabase
          .from("ingresos_personal")
          .select("egreso_en")
          .eq("org_id", org)
          .gte("ingreso_en", `${hoy}T00:00:00-03:00`)
      : Promise.resolve({ data: null }),
  ]);

  const cajaHoy = cajaHoyRes.data;
  const resumen = (resumenRes.data ?? []) as ResumenConcepto[];
  const clientesVencidos = deudaVencidaRes.data?.length ?? 0;

  const porEstado = new Map<string, number>();
  for (const s of solicitudesRes.data ?? []) {
    porEstado.set(s.estado, (porEstado.get(s.estado) ?? 0) + 1);
  }
  const solNuevas = porEstado.get("nueva") ?? 0;
  const solEnRevision = porEstado.get("en_revision") ?? 0;
  const solResueltas = porEstado.get("resuelta") ?? 0;
  const solEnConsejo = porEstado.get("en_consejo") ?? 0;
  const solAsignadas = porEstado.get("asignada") ?? 0;
  const solPorRevisar = solNuevas + solEnRevision + solResueltas;

  const ingresosHoy = ingresosHoyRes.data?.length ?? 0;
  const adentroAhora = (ingresosHoyRes.data ?? []).filter((i) => !i.egreso_en).length;

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

  // Cobranza de los últimos 14 días (todos menos el Jefe de Portería).
  let serie14: PuntoCobranza[] = [];
  if (veGrafico) {
    const rango14 = rangoUltimosDias(14);
    const [pagos14Res, canon14Res] = await Promise.all([
      supabase
        .from("pagos")
        .select("fecha, monto")
        .eq("org_id", org)
        .eq("anulado", false)
        .gte("fecha", `${rango14.desde}T00:00:00-03:00`),
      supabase
        .from("canon_camiones")
        .select("fecha, monto")
        .eq("org_id", org)
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

  // ---------- Avisos por rol (solo se muestran los que tienen algo) ----------
  const avisos: Aviso[] = [];
  if (rol === "admin") {
    avisos.push(
      {
        clave: "rendiciones",
        n: rendicionesSinIntegrar,
        singular: "rendición de Portería por integrar",
        plural: "rendiciones de Portería por integrar",
        descripcion: "Sumalas a la caja mayor para que el día cierre completo.",
        href: "/caja",
        cta: "Integrar",
        icono: CajaRegistradora,
        tono: "parcial",
      },
      {
        clave: "reaperturas",
        n: pedidosReapertura,
        singular: "pedido de reapertura de caja",
        plural: "pedidos de reapertura de caja",
        descripcion: "Revisá el motivo y decidí si se reabre.",
        href: "/caja",
        cta: pedidosReapertura === 1 ? "Ver pedido" : "Ver pedidos",
        icono: CajaRegistradora,
        tono: "parcial",
      },
      {
        clave: "asignadas",
        n: solAsignadas,
        singular: "solicitud asignada a Administración",
        plural: "solicitudes asignadas a Administración",
        descripcion: "El Líder de Procesos te las pasó para ejecutar.",
        href: "/solicitudes?estado=asignadas",
        cta: "Ver solicitudes",
        icono: MessagesSquare,
        tono: "parcial",
      }
    );
  }
  if (rol === "tesoreria") {
    avisos.push(
      {
        clave: "validar",
        n: cajasSinValidar,
        singular: "caja para validar",
        plural: "cajas para validar",
        descripcion: "Controlalas y dales el OK definitivo.",
        href: "/tesoreria",
        cta: "Validar",
        icono: Vault,
        tono: "parcial",
      },
      {
        clave: "transferencias",
        n: transferenciasSinConciliar,
        singular: "transferencia sin conciliar",
        plural: "transferencias sin conciliar",
        descripcion: "Cotejalas con el banco y marcalas conciliadas.",
        href: "/tesoreria",
        cta: "Conciliar",
        icono: Landmark,
        tono: "parcial",
      }
    );
  }
  if (rol === "consejo") {
    avisos.push(
      {
        clave: "consejo",
        n: solEnConsejo,
        singular: "solicitud en el Consejo",
        plural: "solicitudes en el Consejo",
        descripcion: "Esperan la resolución del Consejo.",
        href: "/solicitudes?estado=consejo",
        cta: "Resolver",
        icono: MessagesSquare,
        tono: "parcial",
      },
      {
        clave: "validar",
        n: cajasSinValidar,
        singular: "caja sin validar",
        plural: "cajas sin validar",
        descripcion: "Tesorería todavía no les dio el OK.",
        href: "/tesoreria",
        cta: "Ver cajas",
        icono: Vault,
        tono: "parcial",
      }
    );
  }
  if (rol === "lider") {
    avisos.push(
      {
        clave: "validar",
        n: cajasSinValidar,
        singular: "caja sin validar",
        plural: "cajas sin validar",
        descripcion: "Tesorería todavía no les dio el OK.",
        href: "/tesoreria",
        cta: "Ver cajas",
        icono: Vault,
        tono: "parcial",
      },
      {
        clave: "rendiciones",
        n: rendicionesSinIntegrar,
        singular: "rendición de Portería sin integrar",
        plural: "rendiciones de Portería sin integrar",
        descripcion: "Administración todavía no las sumó a la caja mayor.",
        href: "/tesoreria",
        cta: "Ver cajas",
        icono: CajaRegistradora,
        tono: "parcial",
      }
    );
  }
  if (veCobranzaMes) {
    avisos.push({
      clave: "vencidos",
      n: clientesVencidos,
      singular: "cliente con deuda vencida",
      plural: "clientes con deuda vencida",
      descripcion: `Deben meses anteriores a ${labelPeriodo(periodo)}.`,
      href: "/clientes?tipo=vencidos",
      cta: "Ver clientes",
      tono: "pendiente",
    });
  }
  const avisosVisibles = avisos.filter((a) => a.n > 0);

  const escritorioVacio =
    rol === "lider" && cambiosPorAprobar + solPorRevisar + solEnConsejo === 0;

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

      {/* Escritorio del Líder de Procesos: lo que espera su decisión */}
      {rol === "lider" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tu escritorio</CardTitle>
            <CardDescription>
              {escritorioVacio
                ? "Nada espera tu decisión por ahora."
                : "Lo que espera tu decisión, en orden."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              <FilaEscritorio
                n={cambiosPorAprobar}
                titulo="Cambios por aprobar"
                detalle="Altas, bajas y modificaciones de clientes y conceptos que propuso el equipo."
                href="/aprobaciones"
                cta="Revisar"
                icono={ClipboardCheck}
              />
              <FilaEscritorio
                n={solPorRevisar}
                titulo="Solicitudes por revisar"
                detalle={
                  solPorRevisar > 0
                    ? [
                        solNuevas > 0 ? `${solNuevas} ${solNuevas === 1 ? "nueva" : "nuevas"}` : null,
                        solEnRevision > 0 ? `${solEnRevision} en revisión` : null,
                        solResueltas > 0
                          ? `${solResueltas} ${solResueltas === 1 ? "resuelta" : "resueltas"} para asignar`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : "Nuevas, en revisión o resueltas para asignar a Administración."
                }
                href="/solicitudes"
                cta="Ver solicitudes"
                icono={MessagesSquare}
              />
              <FilaEscritorio
                n={solEnConsejo}
                titulo="En el Consejo"
                detalle="Solicitudes derivadas que esperan la resolución del Consejo."
                href="/solicitudes?estado=consejo"
                cta="Ver"
                icono={Landmark}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        {/* Columna principal: el día de Portería o la cobranza del período */}
        {rol === "guardia" ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tu día en Portería</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Cobrá a los quinteros y cargá el canon de camiones desde{" "}
                <strong>Cobrar</strong>. Al terminar el día, rendí tu caja de
                Portería: el sistema te dice cuánta plata tenés que entregar en
                Administración.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" className="min-h-12 px-5 text-base font-semibold">
                  <Link href="/cobranza">
                    <HandCoins className="size-5" />
                    Cobrar quinteros
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="min-h-12 px-5 text-base">
                  <Link href="/caja">
                    <CajaRegistradora className="size-5" />
                    Mi caja
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cobranza de {labelPeriodo(periodo)}</CardTitle>
              {veReportes ? (
                <CardAction>
                  <Link
                    href="/reportes"
                    className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
                  >
                    Ver reportes
                  </Link>
                </CardAction>
              ) : null}
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
                <CardTitle className="text-lg">
                  {rol === "guardia" ? "Caja de Portería de hoy" : "Caja de hoy"}
                </CardTitle>
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
                      <p className="text-2xl font-bold tabular">{formatARS(cobradoHoy)}</p>
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
                        <CajaRegistradora className="size-5" />
                        Abrir caja
                      </Link>
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}

          {rol === "guardia" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ingresos de personal</CardTitle>
                <CardDescription>Hoy en Portería</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-baseline gap-2">
                  <p className="font-display text-3xl font-extrabold tabular">{ingresosHoy}</p>
                  <p className="text-sm text-muted-foreground">
                    {ingresosHoy === 1 ? "ingreso registrado" : "ingresos registrados"}
                    {adentroAhora > 0 ? ` · ${adentroAhora} adentro ahora` : ""}
                  </p>
                </div>
                <Button asChild className="min-h-11 w-full text-base">
                  <Link href="/porteria">
                    <DoorOpen className="size-5" strokeWidth={2} />
                    Registrar ingreso
                  </Link>
                </Button>
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

          {avisosVisibles.map((aviso) => (
            <TarjetaAviso key={aviso.clave} aviso={aviso} />
          ))}
        </div>
      </div>
    </div>
  );
}
