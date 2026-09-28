import Link from "next/link";
import { FilePlus2, MessagesSquare, Settings2 } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { pendientesNav } from "@/lib/pendientes";
import { formatARS, formatFecha, formatFechaLarga, hoyISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { BotonExportar } from "@/components/shared/boton-exportar";
import { RegistroIngreso } from "@/components/porteria/registro-ingreso";
import { SelectorFecha } from "@/components/porteria/selector-fecha";
import { esFechaISO, rangoDiaAR } from "@/components/porteria/fechas";
import { CanonTransporte, type PuestoPlano } from "@/components/porteria/canon-transporte";
import { CanonDelDia } from "@/components/porteria/canon-del-dia";
import { IngresosDelDia, type IngresoFila } from "@/components/porteria/ingresos-del-dia";
import { PestanasPorteria, type VistaPorteria } from "@/components/porteria/pestanas-porteria";
import { RefrescoAutomatico } from "@/components/porteria/refresco-automatico";
import {
  SELECT_CANON_ENTRADA,
  aCanonEntrada,
  aTarifaTransporte,
  totalesCanon,
} from "@/components/porteria/tarifas";

export const metadata = { title: "Portería" };

/** Mismo texto que registrar_canon (contrato §4.6). */
const TEXTO_CAJA_RENDIDA =
  "La caja de portería de hoy ya se rindió. Avisale al Jefe de Portería: él pide la reapertura a Administración.";

const SELECT_INGRESO =
  "id, dni, nombre, apellido, ingreso_en, egreso_en, fuera_de_horario, firma_path, empleado_id, empleados(cargo)";

type Props = { searchParams: Promise<{ fecha?: string | string[]; vista?: string | string[] }> };

type EstadoCaja = "abierta" | "cerrada" | "integrada" | "validada";

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function primero(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function aEstado(v: unknown): EstadoCaja | null {
  return v === "abierta" || v === "cerrada" || v === "integrada" || v === "validada" ? v : null;
}

type FilaIngresoDb = Omit<IngresoFila, "cargo"> & { empleados: { cargo: string | null } | null };

function aIngresoFila(f: FilaIngresoDb): IngresoFila {
  return {
    id: f.id,
    dni: f.dni,
    nombre: f.nombre,
    apellido: f.apellido,
    ingreso_en: f.ingreso_en,
    egreso_en: f.egreso_en,
    fuera_de_horario: f.fuera_de_horario,
    firma_path: f.firma_path,
    empleado_id: f.empleado_id,
    cargo: f.empleados?.cargo ?? null,
  };
}

/**
 * /porteria — la garita. Portería (y el Líder, §1.3) cobra el canon de transporte en la caja de
 * portería del día y registra el ingreso del personal. Administración y el Jefe rebotan a su
 * inicio (A4, G10). El Líder además elige el día y tiene el atajo a las tarifas.
 */
export default async function PorteriaPage({ searchParams }: Props) {
  const perfil = await requireRol("porteria", "lider");
  const params = await searchParams;
  const fechaParam = primero(params.fecha);
  const vista: VistaPorteria = primero(params.vista) === "personal" ? "personal" : "canon";
  const esLider = perfil.rol === "lider";
  const hoy = hoyISO();
  const fecha = esLider && esFechaISO(fechaParam) && fechaParam <= hoy ? fechaParam : hoy;
  const esHoy = fecha === hoy;
  const { inicio, fin } = rangoDiaAR(fecha);
  // Solicitudes del portero con respuesta nueva (mismo cálculo, cacheado, que la navegación).
  const pendientesPromesa = perfil.rol === "porteria" ? pendientesNav(perfil) : null;

  const supabase = await createClient();
  const [ingresosRes, anterioresRes, canonRes, tarifasRes, estadoRes, planoRes, cajaDiaRes] = await Promise.all([
    supabase
      .from("ingresos_personal")
      .select(SELECT_INGRESO)
      .eq("org_id", perfil.org_id)
      .gte("ingreso_en", inicio)
      .lt("ingreso_en", fin)
      .order("ingreso_en", { ascending: true }),
    esHoy
      ? supabase
          .from("ingresos_personal")
          .select(SELECT_INGRESO)
          .eq("org_id", perfil.org_id)
          .is("egreso_en", null)
          .lt("ingreso_en", inicio)
          .order("ingreso_en", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] as FilaIngresoDb[] }),
    supabase
      .from("canon_camiones")
      .select(SELECT_CANON_ENTRADA)
      .eq("org_id", perfil.org_id)
      .eq("fecha", fecha)
      .order("creado_en", { ascending: false }),
    supabase
      .from("tarifas_transporte")
      .select("id, nombre, precio, unidad, icono, orden, activo")
      .eq("org_id", perfil.org_id)
      .order("orden", { ascending: true }),
    esHoy ? supabase.rpc("estado_caja_porteria") : Promise.resolve({ data: null }),
    esHoy ? supabase.rpc("espacios_del_plano") : Promise.resolve({ data: [] }),
    // Otro día (solo el Líder, que lee cajas): el estado de esa caja de portería.
    !esHoy
      ? supabase
          .from("cajas")
          .select("estado")
          .eq("org_id", perfil.org_id)
          .eq("tipo", "guardia")
          .eq("fecha", fecha)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const respuestasNuevas = pendientesPromesa ? ((await pendientesPromesa)["/solicitudes"] ?? 0) : 0;

  // ---------------------------------------------------------------- canon
  const filasCanon = canonRes.data ?? [];
  const idsCobradores = [...new Set(filasCanon.map((c) => c.creado_por).filter((v): v is string => Boolean(v)))];
  const nombres = new Map<string, string>();
  if (idsCobradores.length > 0) {
    const { data: perfiles } = await supabase
      .from("perfiles")
      .select("user_id, nombre")
      .in("user_id", idsCobradores);
    for (const p of perfiles ?? []) nombres.set(p.user_id, p.nombre);
  }
  const entradas = filasCanon.map((f) => aCanonEntrada(f, nombres));
  const totales = totalesCanon(entradas);
  const tarifas = (tarifasRes.data ?? []).map(aTarifaTransporte);
  const tarifasActivas = tarifas.filter((t) => t.activo);

  const estadoHoy = (estadoRes.data ?? null) as { estado?: unknown; reapertura_pedida?: unknown } | null;
  const estadoCaja: EstadoCaja | null = esHoy
    ? aEstado(estadoHoy?.estado)
    : aEstado((cajaDiaRes.data as { estado?: unknown } | null)?.estado);
  const reaperturaPedida = esHoy && estadoHoy?.reapertura_pedida === true;
  const cajaRendida = estadoCaja !== null && estadoCaja !== "abierta";

  const puestos: PuestoPlano[] = ((planoRes.data ?? []) as { tipo: string; numero: string | null; medio: boolean }[])
    .filter((e) => e.tipo === "puesto" && e.numero)
    .map((e) => ({ numero: String(e.numero), medio: Boolean(e.medio) }));

  // ---------------------------------------------------------------- personal
  const ingresos = ((ingresosRes.data ?? []) as FilaIngresoDb[]).map(aIngresoFila);
  const anteriores = ((anterioresRes.data ?? []) as FilaIngresoDb[]).map(aIngresoFila);
  const adentro = ingresos.filter((i) => !i.egreso_en).length;

  // Miniaturas de las firmas (URL firmada, 1 h).
  const firmas: Record<string, string> = {};
  if (ingresos.length > 0) {
    const { data: firmadas } = await supabase.storage
      .from("documentos")
      .createSignedUrls(
        ingresos.map((i) => i.firma_path),
        3600
      );
    for (const f of firmadas ?? []) {
      if (f.path && f.signedUrl) firmas[f.path] = f.signedUrl;
    }
  }

  const fechaTexto = capitalizar(formatFechaLarga(fecha));

  // ---------------------------------------------------------------- vistas
  const vistaCanon = (
    <div
      className={cn(
        "grid gap-8",
        esHoy && "xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] xl:items-start"
      )}
    >
      {esHoy ? (
        <CanonTransporte
          tarifas={tarifasActivas}
          puestos={puestos}
          bloqueo={
            cajaRendida
              ? {
                  titulo: TEXTO_CAJA_RENDIDA,
                  detalle: reaperturaPedida
                    ? "El Jefe ya pidió la reapertura: cuando Administración la reabra, vas a poder cobrar de nuevo."
                    : undefined,
                }
              : null
          }
        />
      ) : null}

      <section className="space-y-4" aria-labelledby="titulo-cobros">
        <div className="space-y-0.5">
          <h2 id="titulo-cobros" className="font-display text-xl font-bold tracking-tight">
            {esHoy ? "Cobros de hoy" : `Canon del ${formatFecha(fecha)}`}
          </h2>
          <p className="text-sm text-muted-foreground">
            {esHoy
              ? estadoCaja === null
                ? "La caja de portería de hoy se abre sola con el primer cobro."
                : cajaRendida
                  ? "La caja de portería de hoy ya se rindió."
                  : "Van a la caja de portería de hoy: la rinde el Jefe de Portería."
              : fechaTexto}
          </p>
        </div>
        <CanonDelDia
          entradas={entradas}
          modo={esLider ? "jefe" : "porteria"}
          cajaAbierta={estadoCaja === "abierta"}
          cajaValidada={estadoCaja === "validada"}
          anularConCajaCerrada={esLider}
          miUserId={perfil.user_id}
          esHoy={esHoy}
          tarifas={tarifas}
        />
      </section>
    </div>
  );

  const vistaPersonal = (
    <div
      className={cn(
        "grid gap-8",
        esHoy && "xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] xl:items-start"
      )}
    >
      {esHoy ? <RegistroIngreso /> : null}

      <section className="space-y-4" aria-labelledby="titulo-ingresos">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-0.5">
            <h2 id="titulo-ingresos" className="font-display text-xl font-bold tracking-tight">
              {esHoy ? "Ingresos de hoy" : `Ingresos del ${formatFecha(fecha)}`}
            </h2>
            <p className="text-sm text-muted-foreground">{fechaTexto}</p>
          </div>
          <BotonExportar
            dataset="ingresos_personal"
            periodo={`${fecha.slice(0, 7)}-01`}
            label="Exportar el mes a Excel"
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-card px-4 py-3">
          <p className="flex items-baseline gap-2">
            <span
              className={cn(
                "font-display text-3xl font-bold tabular",
                adentro > 0 ? "text-accent-foreground" : "text-muted-foreground"
              )}
            >
              {adentro}
            </span>
            <span className="text-base font-medium">{adentro === 1 ? "persona adentro" : "personas adentro"}</span>
          </p>
          <p className="text-sm text-muted-foreground tabular">
            {ingresos.length === 0
              ? "Sin ingresos registrados"
              : `${ingresos.length} ${ingresos.length === 1 ? "ingreso registrado" : "ingresos registrados"}`}
            {ingresos.some((i) => i.fuera_de_horario)
              ? ` · ${ingresos.filter((i) => i.fuera_de_horario).length} fuera de horario`
              : ""}
          </p>
        </div>

        <IngresosDelDia
          ingresos={ingresos}
          anteriores={anteriores}
          firmas={firmas}
          esHoy={esHoy}
          puedeCorregir={esLider}
        />
      </section>
    </div>
  );

  return (
    <div className="space-y-8">
      {esHoy ? <RefrescoAutomatico segundos={60} /> : null}
      <PageHeader
        titulo="Portería"
        descripcion={
          esHoy
            ? "Cobrá el canon de transporte y registrá el ingreso del personal."
            : `Estás viendo el ${formatFecha(fecha)}. Para cobrar, volvé a hoy.`
        }
      >
        {esLider ? (
          <>
            <SelectorFecha fecha={fecha} />
            <Button asChild variant="outline" size="lg" className="h-12 px-4 text-base">
              <Link href="/configuracion?tab=tarifas">
                <Settings2 className="size-5" strokeWidth={2} />
                Editar tarifas
              </Link>
            </Button>
            <BotonExportar
              dataset="canon"
              periodo={`${fecha.slice(0, 7)}-01`}
              label="Canon del mes (.xlsx)"
              className="h-12"
            />
          </>
        ) : null}
      </PageHeader>

      <PestanasPorteria
        vistaInicial={vista}
        resumenCanon={formatARS(totales.total)}
        resumenPersonal={esHoy ? `${adentro} adentro` : `${ingresos.length} ${ingresos.length === 1 ? "ingreso" : "ingresos"}`}
        canon={vistaCanon}
        personal={vistaPersonal}
      />

      {perfil.rol === "porteria" ? (
        <Card className="text-base">
          <CardHeader>
            <CardTitle className="font-display text-lg font-bold">Solicitudes e informes</CardTitle>
            <CardDescription className="text-sm">
              Si pasa algo en la garita o alguien pide algo, dejalo por escrito: le llega al Jefe de
              Portería y queda registrado.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild variant="secondary" size="lg" className="h-12 px-5 text-base font-semibold">
              <Link href="/solicitudes/nueva?origen=porteria">
                <FilePlus2 className="size-5" strokeWidth={2} />
                Generar solicitud o informe
              </Link>
            </Button>
            <Button
              asChild
              variant={respuestasNuevas > 0 ? "outline" : "ghost"}
              size="lg"
              className={cn(
                "h-auto min-h-12 flex-wrap px-4 py-2 text-base whitespace-normal",
                respuestasNuevas > 0 && "border-primary/40 bg-accent"
              )}
            >
              <Link href="/solicitudes">
                <MessagesSquare className="size-5" strokeWidth={2} />
                Ver mis solicitudes
                {respuestasNuevas > 0 ? (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground tabular">
                    {respuestasNuevas === 1 ? "1 respuesta nueva" : `${respuestasNuevas} respuestas nuevas`}
                  </span>
                ) : null}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
