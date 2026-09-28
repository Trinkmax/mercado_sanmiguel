import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  ClipboardList,
  Footprints,
  Landmark,
  MessagesSquare,
  Truck,
} from "lucide-react";
import type { Perfil } from "@/lib/auth";
import { labelPeriodo, periodoActual } from "@/lib/format";
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
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { ChartCobranzaDiaria } from "@/components/charts/chart-cobranza-diaria";
import {
  cajaDeHoy,
  contar,
  resumenDelMes,
  serieUltimos14,
  type CajaHoy,
  type Supabase,
} from "./datos";
import { BarraConcepto, FilaEscritorio, TarjetaAviso, type Aviso } from "./bloques";
import { Correcciones } from "./correcciones";
import { PlataDeHoy } from "./plata-hoy";

/**
 * Inicio de Administración y del Líder de Procesos.
 * - Administración: su caja de hoy, la cobranza del mes y lo que espera su acción
 *   (rendiciones de portería, reaperturas, solicitudes asignadas, novedades del Jefe).
 * - Líder (control del dueño): su escritorio de decisiones, la plata de hoy de las
 *   dos cajas y las correcciones de la última semana; la cobranza del mes abajo.
 */
export async function InicioGestion({ perfil, supabase }: { perfil: Perfil; supabase: Supabase }) {
  const org = perfil.org_id;
  const rol = perfil.rol;
  const esLider = rol === "lider";
  const periodo = periodoActual();
  const cero = Promise.resolve(0);

  const [
    resumen,
    serie,
    cajaAdmin,
    vencidosRes,
    cajasSinValidar,
    rendicionesSinIntegrar,
    pedidosReapertura,
    novedadesJefe,
    cambiosPorAprobar,
    altasJefe,
    solicitudesRes,
  ] = await Promise.all([
    resumenDelMes(supabase, periodo),
    serieUltimos14(supabase, org),
    esLider ? Promise.resolve(null) : cajaDeHoy(supabase, org, "administracion"),
    supabase.from("v_deuda_clientes").select("cliente_id").eq("org_id", org).gt("deuda_vencida", 0),
    esLider
      ? contar(
          supabase
            .from("cajas")
            .select("id", { count: "exact", head: true })
            .eq("org_id", org)
            .in("estado", ["cerrada", "integrada"])
        )
      : cero,
    contar(
      supabase
        .from("cajas")
        .select("id", { count: "exact", head: true })
        .eq("org_id", org)
        .eq("tipo", "guardia")
        .eq("estado", "cerrada")
    ),
    rol === "admin"
      ? contar(
          supabase
            .from("cajas")
            .select("id", { count: "exact", head: true })
            .eq("org_id", org)
            .not("reapertura_solicitada_en", "is", null)
        )
      : cero,
    rol === "admin"
      ? contar(
          supabase
            .from("novedades_personal")
            .select("id", { count: "exact", head: true })
            .eq("org_id", org)
            .eq("estado", "pendiente")
        )
      : cero,
    esLider
      ? contar(
          supabase
            .from("cambios_pendientes")
            .select("id", { count: "exact", head: true })
            .eq("org_id", org)
            .eq("estado", "pendiente")
        )
      : cero,
    esLider
      ? contar(
          supabase
            .from("cambios_pendientes")
            .select("id", { count: "exact", head: true })
            .eq("org_id", org)
            .eq("estado", "aprobado")
            .eq("revisar_despues", true)
            .is("revisado_por", null)
        )
      : cero,
    supabase
      .from("solicitudes")
      .select("estado")
      .eq("org_id", org)
      .in("estado", ["nueva", "en_revision", "en_consejo", "resuelta", "asignada"]),
  ]);

  // Clientes con deuda vencida: Administración ve solo los puesteros (los demás son de Portería).
  let clientesVencidos = (vencidosRes.data ?? []).length;
  if (rol === "admin" && clientesVencidos > 0) {
    const ids = (vencidosRes.data ?? []).map((v) => v.cliente_id).filter((id): id is string => Boolean(id));
    clientesVencidos = await contar(
      supabase
        .from("clientes")
        .select("id", { count: "exact", head: true })
        .in("id", ids)
        .eq("categoria", "puestero")
    );
  }

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

  const conceptos = resumen.filter((f) => f.codigo !== "BC");
  const bono = resumen.find((f) => f.codigo === "BC");
  const totalCobrado = conceptos.reduce((a, f) => a + f.cobrado, 0);
  const totalPendiente = conceptos.reduce((a, f) => a + f.pendiente, 0);

  // ---------- Avisos (solo los que tienen algo) ----------
  const avisos: Aviso[] = [];
  if (rol === "admin") {
    avisos.push(
      {
        clave: "rendiciones",
        n: rendicionesSinIntegrar,
        singular: "caja de portería por recibir",
        plural: "cajas de portería por recibir",
        descripcion: "Sumalas a la caja de Administración para que el día cierre completo.",
        href: "/caja",
        cta: "Recibir",
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
        clave: "novedades",
        n: novedadesJefe,
        singular: "novedad del Jefe de Portería para aprobar",
        plural: "novedades del Jefe de Portería para aprobar",
        descripcion: "Faltas, llegadas tarde y demás del personal de Portería.",
        href: "/novedades",
        cta: "Revisar",
        icono: ClipboardList,
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
  if (esLider) {
    avisos.push(
      {
        clave: "validar",
        n: cajasSinValidar,
        singular: "caja sin validar",
        plural: "cajas sin validar",
        descripcion: "Tesorería todavía no les dio el OK (o validalas vos).",
        href: "/caja",
        cta: "Ver cajas",
        icono: Landmark,
        tono: "parcial",
      },
      {
        clave: "rendiciones",
        n: rendicionesSinIntegrar,
        singular: "caja de portería sin recibir",
        plural: "cajas de portería sin recibir",
        descripcion: "Administración todavía no las sumó a su caja.",
        href: "/caja",
        cta: "Ver cajas",
        icono: CajaRegistradora,
        tono: "parcial",
      }
    );
  }
  avisos.push({
    clave: "vencidos",
    n: clientesVencidos,
    singular: "cliente con deuda vencida",
    plural: "clientes con deuda vencida",
    descripcion: "Perdieron el beneficio por pagar en término.",
    href: "/clientes?tipo=vencidos",
    cta: "Ver clientes",
    tono: "pendiente",
  });
  const avisosVisibles = avisos.filter((a) => a.n > 0);

  const escritorioVacio = cambiosPorAprobar + altasJefe + solPorRevisar + solEnConsejo === 0;

  return (
    <div className="space-y-8">
      {esLider ? (
        <>
          <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tu escritorio</CardTitle>
                <CardDescription>
                  {escritorioVacio ? "Nada espera tu decisión por ahora." : "Lo que espera tu decisión, en orden."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  <FilaEscritorio
                    n={cambiosPorAprobar}
                    titulo="Cambios por aprobar"
                    detalle="Altas, bajas y cambios de clientes y precios que propuso el equipo."
                    href="/aprobaciones"
                    cta="Revisar"
                    icono={ClipboardCheck}
                  />
                  {altasJefe > 0 ? (
                    <FilaEscritorio
                      n={altasJefe}
                      titulo={altasJefe === 1 ? "Alta de ambulante para revisar" : "Altas de ambulantes para revisar"}
                      detalle="El Jefe de Portería las dio de alta para cobrarles en el acto: miralas."
                      href="/aprobaciones"
                      cta="Revisar"
                      icono={Footprints}
                    />
                  ) : null}
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
                    detalle="Solicitudes que esperan lo que resuelva el Consejo: registralo vos."
                    href="/solicitudes?estado=consejo"
                    cta="Ver"
                    icono={Landmark}
                  />
                </div>
              </CardContent>
            </Card>
            <PlataDeHoy org={org} supabase={supabase} />
          </div>
          <Correcciones org={org} supabase={supabase} />
        </>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cobranza de {labelPeriodo(periodo)}</CardTitle>
            {esLider ? (
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
            {conceptos.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <p className="font-medium text-foreground">Todavía no se generó {labelPeriodo(periodo)}.</p>
                <p className="mt-1 text-sm">Generá el mes desde Facturación para ver lo que hay para cobrar.</p>
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
                  {conceptos.map((fila) => (
                    <BarraConcepto
                      key={fila.codigo}
                      fila={fila}
                      objetivo={fila.cobrado + fila.pendiente}
                      faltaTexto={fila.pendiente}
                    />
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-t pt-4">
                  <p className="text-muted-foreground">Total del mes</p>
                  <p className="text-lg tabular">
                    <Money monto={totalCobrado} className="font-bold text-pagado" />{" "}
                    <span className="text-muted-foreground">cobrado ·</span>{" "}
                    <Money monto={totalPendiente} className="font-bold text-pendiente" />{" "}
                    <span className="text-muted-foreground">por cobrar</span>
                  </p>
                </div>
              </>
            )}
            {bono && bono.cobrado > 0 ? (
              <p className="mt-4 flex items-center gap-2 border-t pt-4 text-sm text-muted-foreground">
                <Truck className="size-4" strokeWidth={2} />
                Bono camioneros del mes (portería):{" "}
                <Money monto={bono.cobrado} className="font-semibold text-foreground" />
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-6 max-lg:order-first">
          {rol === "admin" ? <CajaAdministracionHoy caja={cajaAdmin} /> : null}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Últimos 14 días</CardTitle>
              <CardDescription>Cobranza por día</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartCobranzaDiaria data={serie} mini />
            </CardContent>
          </Card>
          {avisosVisibles.map((aviso) => (
            <TarjetaAviso key={aviso.clave} aviso={aviso} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** La caja de Administración de hoy: lo juntado y lo que tiene que haber en efectivo. */
function CajaAdministracionHoy({ caja }: { caja: CajaHoy | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Caja de hoy</CardTitle>
        {caja ? (
          <CardAction>
            <Sello estado={caja.estado} />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {caja ? (
          <>
            {caja.arqueo ? (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Juntaste hoy</p>
                <Money monto={caja.arqueo.juntado} className="font-display text-3xl font-extrabold" />
                <p className="text-sm text-muted-foreground">
                  Tenés que tener <Money monto={caja.arqueo.efectivo} className="font-semibold text-foreground" /> en
                  efectivo
                </p>
              </div>
            ) : null}
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
              Todavía no abriste la caja de hoy. Se abre sola con el primer cobro.
            </p>
            <Button asChild variant="outline" className="min-h-11 w-full text-base">
              <Link href="/caja">
                <CajaRegistradora className="size-5" />
                Ir a la caja
              </Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
