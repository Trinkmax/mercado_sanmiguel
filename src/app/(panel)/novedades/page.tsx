import Link from "next/link";
import { ClipboardList, Plus, Printer, RotateCcw, UserPlus } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hoyISO, labelPeriodo, periodoActual } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { BotonExportar, type DatasetExportable } from "@/components/shared/boton-exportar";
import { LABEL_SECTOR, esSector } from "@/components/personal/constantes";
import { SelectorMes } from "@/components/novedades/selector-mes";
import { BandejaAprobacion, type PendienteBandeja } from "@/components/novedades/bandeja-aprobacion";
import { PlanillaMes, type FilaPlanilla } from "@/components/novedades/planilla-mes";
import {
  COLUMNAS_NOVEDAD,
  armarVistas,
  novedadesDelMes,
  type FilaNovedadBD,
} from "@/components/novedades/datos";
import {
  fraseNovedad,
  hrefNovedades,
  listaSectores,
  nombrePila,
  periodoDeParam,
  sectoresDeRol,
  sumarDias,
} from "@/components/novedades/constantes";

export const metadata = { title: "Novedades del personal" };

/** Dataset nuevo de exportación (§6 M9). Fundación suma el literal a `DatasetExportable` (§5.6). */
const DATASET_NOVEDADES: DatasetExportable = "novedades_personal";

type Props = {
  searchParams: Promise<{ mes?: string | string[]; sector?: string | string[] }>;
};

export default async function NovedadesPage({ searchParams }: Props) {
  const perfil = await requireRol("admin", "guardia", "lider");
  const sp = await searchParams;
  const periodo = periodoDeParam(sp.mes);
  const sectorParam = Array.isArray(sp.sector) ? sp.sector[0] : sp.sector;
  const alcance = sectoresDeRol(perfil.rol);
  const sector = esSector(sectorParam) && alcance.includes(sectorParam) ? sectorParam : null;
  const puedeRevisar = perfil.rol === "admin" || perfil.rol === "lider";
  const esMesActual = periodo === periodoActual();

  const supabase = await createClient();
  const hace15 = sumarDias(hoyISO(), -15);

  const [resumenRes, delMes, pendientesRes, rechazadasRes] = await Promise.all([
    supabase.rpc("resumen_novedades", { p_periodo: periodo }),
    novedadesDelMes(supabase, periodo),
    puedeRevisar
      ? supabase
          .from("novedades_personal")
          .select(`${COLUMNAS_NOVEDAD}, empleado:empleados(nombre, apellido)`)
          .eq("estado", "pendiente")
          .order("fecha_desde")
      : Promise.resolve({ data: [] }),
    perfil.rol === "guardia"
      ? supabase
          .from("novedades_personal")
          .select(`${COLUMNAS_NOVEDAD}, empleado:empleados(nombre, apellido)`)
          .eq("estado", "rechazada")
          .eq("cargada_por", perfil.user_id)
          .gte("revisada_en", hace15)
          .order("revisada_en", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const resumen = resumenRes.data ?? [];
  type ConEmpleado = FilaNovedadBD & { empleado: { nombre: string; apellido: string } | null };
  const pendientesBD = (pendientesRes.data ?? []) as ConEmpleado[];
  const rechazadasBD = (rechazadasRes.data ?? []) as ConEmpleado[];

  const [vistasMes, vistasPendientes] = await Promise.all([
    armarVistas(supabase, delMes),
    armarVistas(supabase, pendientesBD),
  ]);

  const porEmpleado = new Map<string, typeof vistasMes>();
  for (const v of vistasMes) {
    const lista = porEmpleado.get(v.empleado_id) ?? [];
    lista.push(v);
    porEmpleado.set(v.empleado_id, lista);
  }

  const todas: FilaPlanilla[] = resumen.map((r) => ({
    ...r,
    horas_semanales: r.horas_semanales === null ? null : Number(r.horas_semanales),
    horas_esperadas: Number(r.horas_esperadas),
    horas_registradas: Number(r.horas_registradas),
    horas_tarde: Number(r.horas_tarde),
    horas_feriado: Number(r.horas_feriado),
    horas_extra: Number(r.horas_extra),
    novedades: porEmpleado.get(r.empleado_id) ?? [],
  }));
  const filas = sector ? todas.filter((f) => f.sector === sector) : todas;

  const pendientes: PendienteBandeja[] = vistasPendientes.map((v, i) => ({
    ...v,
    nombre: pendientesBD[i].empleado ? nombrePila(pendientesBD[i].empleado!) : "Empleado",
  }));

  // Chips de sector: solo si el rol ve más de uno. Conteo = empleados vigentes en el mes.
  const conteoSector = new Map<string, number>();
  for (const f of todas) conteoSector.set(f.sector, (conteoSector.get(f.sector) ?? 0) + 1);
  const hrefMes = (p: string) => hrefNovedades({ periodo: p, sector });

  const descripcion =
    perfil.rol === "guardia"
      ? "Faltas, llegadas tarde, feriados, vacaciones y horas extra del personal de Portería. Lo que cargás lo aprueba Administración."
      : perfil.rol === "admin"
        ? "Portería, Limpieza y Mantenimiento: lo que cargás queda aprobado; lo del Jefe de Portería espera tu OK."
        : "Todo el personal: horas que debería tener contra las que registró en Portería, y sus novedades del mes.";

  return (
    <div className="space-y-8">
      <PageHeader titulo="Novedades del personal" descripcion={descripcion}>
        <BotonExportar dataset={DATASET_NOVEDADES} periodo={periodo} label="Exportar el mes" />
        <Button asChild variant="outline" className="min-h-11">
          <Link href={`/novedades/${periodo}`}>
            <Printer className="size-4" strokeWidth={2} />
            Imprimir planilla
          </Link>
        </Button>
        <Button asChild size="lg" className="h-12 px-5 text-base font-semibold">
          <Link href="/novedades/nueva">
            <Plus className="size-5" strokeWidth={2.2} />
            Cargar novedad
          </Link>
        </Button>
      </PageHeader>

      {puedeRevisar ? <BandejaAprobacion pendientes={pendientes} miUserId={perfil.user_id} /> : null}

      {rechazadasBD.length > 0 ? (
        <section className="space-y-3 rounded-xl border border-pendiente/30 bg-pendiente-suave/70 p-4 sm:p-5" aria-label="Novedades rechazadas">
          <h2 className="font-display text-lg font-bold tracking-tight">
            {rechazadasBD.length === 1
              ? "Administración rechazó 1 novedad que cargaste"
              : `Administración rechazó ${rechazadasBD.length} novedades que cargaste`}
          </h2>
          <ul className="divide-y rounded-lg border bg-card px-4">
            {rechazadasBD.map((r) => {
              const nombre = r.empleado ? nombrePila(r.empleado) : "Empleado";
              return (
                <li key={r.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-[15px] font-medium">{fraseNovedad({ ...r, horas: r.horas === null ? null : Number(r.horas) }, nombre)}</p>
                    <p className="text-sm">
                      <span className="font-semibold">Motivo:</span> {r.motivo_rechazo}
                    </p>
                  </div>
                  <Button asChild variant="outline" className="h-11 shrink-0 px-4">
                    <Link href={`/novedades/nueva?empleado=${r.empleado_id}&tipo=${r.tipo}`}>
                      <RotateCcw className="size-4" strokeWidth={2} />
                      Cargarla de nuevo
                    </Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SelectorMes periodo={periodo} hrefMes={hrefMes} />
          {alcance.length > 1 && todas.length > 0 ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por sector">
              <ChipSector href={hrefNovedades({ periodo })} activo={!sector} label="Todos" cantidad={todas.length} />
              {alcance
                .filter((s) => conteoSector.has(s))
                .map((s) => (
                  <ChipSector
                    key={s}
                    href={hrefNovedades({ periodo, sector: s })}
                    activo={sector === s}
                    label={LABEL_SECTOR[s]}
                    cantidad={conteoSector.get(s) ?? 0}
                  />
                ))}
            </div>
          ) : null}
        </div>

        {todas.length === 0 ? (
          perfil.rol === "lider" ? (
            <EmptyState
              icono={ClipboardList}
              titulo={`No hay empleados vigentes en ${labelPeriodo(periodo)}`}
              descripcion="Cargá el personal en Personal, con su sector y sus horas de contrato: acá aparece solo."
            >
              <Button asChild size="lg" className="mt-2 h-12 px-5 font-semibold">
                <Link href="/personal/nuevo">
                  <UserPlus className="size-5" strokeWidth={2} />
                  Cargar empleado
                </Link>
              </Button>
            </EmptyState>
          ) : (
            <EmptyState
              icono={ClipboardList}
              titulo={`No hay empleados de ${listaSectores(alcance)} en ${labelPeriodo(periodo)}`}
              descripcion="Pedile al Líder de Procesos que los cargue en Personal, con su sector y sus horas de contrato."
            />
          )
        ) : filas.length === 0 ? (
          <EmptyState
            icono={ClipboardList}
            titulo={`No hay empleados de ${sector ? LABEL_SECTOR[sector] : "ese sector"} en ${labelPeriodo(periodo)}`}
            descripcion="Elegí otro sector o mirá todos."
          />
        ) : (
          <PlanillaMes
            filas={filas}
            puedeRevisar={puedeRevisar}
            miUserId={perfil.user_id}
            hastaHoy={esMesActual}
            esLider={perfil.rol === "lider"}
            agrupar={!sector && new Set(filas.map((f) => f.sector)).size > 1}
          />
        )}
      </div>
    </div>
  );
}

function ChipSector({
  href,
  activo,
  label,
  cantidad,
}: {
  href: string;
  activo: boolean;
  label: string;
  cantidad: number;
}) {
  return (
    <Link
      href={href}
      aria-current={activo ? "true" : undefined}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
        activo
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:bg-accent"
      )}
    >
      {label}
      <span className={cn("text-xs font-semibold tabular", activo ? "text-primary-foreground/80" : "text-muted-foreground")}>
        {cantidad}
      </span>
    </Link>
  );
}
