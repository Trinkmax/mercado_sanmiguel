import Link from "next/link";
import { ChevronRight, ClipboardList, Clock, TriangleAlert, UserPlus, Users } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDni } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Sello } from "@/components/shared/sello";
import { EmptyState } from "@/components/shared/empty-state";
import { BotonExportar } from "@/components/shared/boton-exportar";
import { BuscadorEmpleados } from "@/components/personal/buscador-empleados";
import { FilaDeslizable } from "@/components/comunicaciones/fila-deslizable";
import {
  LABEL_SECTOR,
  LABEL_TIPO_CONTRATO,
  SECTORES_PERSONAL,
  esSector,
  formatHorasNumero,
  horasSemanalesDeFranjas,
  hrefPersonal,
  nombreCompleto,
  resumirHorarios,
} from "@/components/personal/constantes";

export const metadata = { title: "Personal" };

type Props = {
  searchParams: Promise<{ q?: string | string[]; filtro?: string | string[]; sector?: string | string[] }>;
};

const FILTROS = [
  { valor: "activos", label: "Activos" },
  { valor: "todos", label: "Todos" },
] as const;

export default async function PersonalPage({ searchParams }: Props) {
  const perfil = await requireRol("lider");
  const sp = await searchParams;
  const q = Array.isArray(sp.q) ? (sp.q[0] ?? "") : (sp.q ?? "");
  const filtroParam = Array.isArray(sp.filtro) ? sp.filtro[0] : sp.filtro;
  const texto = q.trim();
  const filtro = filtroParam === "todos" ? "todos" : "activos";
  const sectorParam = Array.isArray(sp.sector) ? sp.sector[0] : sp.sector;
  const sector = esSector(sectorParam) ? sectorParam : null;

  const supabase = await createClient();
  let consulta = supabase
    .from("empleados")
    .select(
      "id, nombre, apellido, dni, cargo, sector, horas_semanales, tipo_contrato, activo, empleado_horarios(dia_semana, hora_desde, hora_hasta)"
    )
    .eq("org_id", perfil.org_id)
    .order("apellido")
    .order("nombre");
  if (filtro === "activos") consulta = consulta.eq("activo", true);
  if (texto) {
    if (/^\d+$/.test(texto)) {
      consulta = consulta.like("dni", `${texto}%`);
    } else {
      const patron = `%${texto.replace(/[,()"\\%_]/g, " ").trim()}%`;
      consulta = consulta.or(`apellido.ilike.${patron},nombre.ilike.${patron}`);
    }
  }
  const { data } = await consulta;
  const todos = data ?? [];
  // Chips de sector con su conteo (sobre la búsqueda y el filtro activos/todos).
  const conteoSector = new Map<string, number>();
  for (const e of todos) conteoSector.set(e.sector, (conteoSector.get(e.sector) ?? 0) + 1);
  const empleados = sector ? todos.filter((e) => e.sector === sector) : todos;

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Personal"
        descripcion="Empleados de la cooperativa: sector, horas de contrato, horarios de trabajo y su contrato."
      >
        <BotonExportar dataset="empleados" />
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/novedades">
            <ClipboardList className="size-4" strokeWidth={2} />
            Novedades del mes
          </Link>
        </Button>
        <Button asChild size="lg" className="h-13 px-6 text-base font-semibold" data-tour="personal-nuevo">
          <Link href="/personal/nuevo">
            <UserPlus className="size-5" />
            Nuevo empleado
          </Link>
        </Button>
      </PageHeader>

      <div className="space-y-3" data-tour="personal-buscar">
        <BuscadorEmpleados inicial={texto} filtro={filtro} sector={sector} />
        {/* En el celular, un solo renglón que se desliza (antes los filtros ocupaban 3). */}
        <FilaDeslizable role="group" aria-label="Filtrar empleados">
          {FILTROS.map((f) => {
            const activo = f.valor === filtro;
            return (
              <Link
                key={f.valor}
                href={hrefPersonal(texto, f.valor, sector)}
                aria-current={activo ? "true" : undefined}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors",
                  activo
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {f.label}
              </Link>
            );
          })}
          {todos.length > 0 ? (
            <>
              <span className="mx-1 hidden h-11 w-px shrink-0 bg-border sm:block" aria-hidden />
              <Link
                href={hrefPersonal(texto, filtro)}
                aria-current={!sector ? "true" : undefined}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors",
                  !sector
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                Todos los sectores
              </Link>
              {SECTORES_PERSONAL.filter((sec) => conteoSector.has(sec)).map((sec) => {
                const activo = sec === sector;
                return (
                  <Link
                    key={sec}
                    href={hrefPersonal(texto, filtro, sec)}
                    aria-current={activo ? "true" : undefined}
                    className={cn(
                      "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors",
                      activo
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    {LABEL_SECTOR[sec]}
                    <span className={cn("text-xs font-semibold tabular", activo ? "text-primary-foreground/80" : "")}>
                      {conteoSector.get(sec)}
                    </span>
                  </Link>
                );
              })}
            </>
          ) : null}
        </FilaDeslizable>
      </div>

      {empleados.length === 0 ? (
        texto || filtro === "todos" || sector ? (
          <EmptyState
            icono={Users}
            titulo="No encontramos empleados"
            descripcion={
              texto
                ? "Probá con otra parte del apellido o con el DNI sin puntos."
                : "Todavía no hay nadie cargado en el padrón de personal."
            }
          />
        ) : (
          <EmptyState
            icono={Users}
            titulo="Todavía no hay empleados cargados"
            descripcion="Cargá el primero con sus datos, su contrato y sus horarios de trabajo."
          >
            <Button asChild size="lg" className="h-12 px-5 font-semibold" data-tour="personal-nuevo">
              <Link href="/personal/nuevo">
                <UserPlus className="size-5" />
                Nuevo empleado
              </Link>
            </Button>
          </EmptyState>
        )
      ) : (
        <Card className="gap-0 divide-y overflow-hidden py-0">
          {empleados.map((e) => {
            const horarios = resumirHorarios(e.empleado_horarios ?? []);
            const sinHorarios = (e.empleado_horarios ?? []).length === 0;
            const segunHorario = horasSemanalesDeFranjas(e.empleado_horarios ?? []);
            return (
              <Link
                key={e.id}
                href={`/personal/${e.id}`}
                data-tour="personal-fila"
                className="flex min-h-16 items-center gap-4 px-4 py-3 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                {/* Todo completo, en los renglones que haga falta: cortados con "…" se perdía el
                    nombre y el tipo de contrato ("Contr…"). El sello solo si está de baja: en
                    "Activos" decía "Activo" en todas las filas y le robaba ancho al texto. */}
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <p
                      className={cn(
                        "min-w-0 text-base leading-snug font-semibold break-words",
                        !e.activo && "text-muted-foreground"
                      )}
                    >
                      {nombreCompleto(e)}
                    </p>
                    {!e.activo ? <Sello estado="inactivo" texto="De baja" /> : null}
                  </div>
                  <p className="text-sm text-muted-foreground tabular">DNI {formatDni(e.dni)}</p>
                  <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="inline-flex items-center rounded-full border bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground/80">
                      {LABEL_SECTOR[e.sector]}
                    </span>
                    {e.horas_semanales ? (
                      <span className="text-sm font-semibold tabular">{formatHorasNumero(e.horas_semanales)} h/sem</span>
                    ) : segunHorario > 0 ? (
                      <span className="text-sm tabular text-foreground/80">
                        {formatHorasNumero(segunHorario)} h/sem según horario
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-parcial">
                        <TriangleAlert className="size-3.5" strokeWidth={2.2} />
                        Sin horas de contrato
                      </span>
                    )}
                    <span className="min-w-0 text-sm break-words text-muted-foreground">
                      {[e.cargo, LABEL_TIPO_CONTRATO[e.tipo_contrato]].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "mt-0.5 flex items-start gap-1.5 text-sm [&>svg]:mt-0.5",
                      sinHorarios ? "text-parcial" : "text-foreground/80"
                    )}
                  >
                    <Clock className="size-3.5 shrink-0" strokeWidth={2} />
                    <span className="min-w-0 break-words tabular">{horarios}</span>
                  </p>
                </div>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground max-sm:hidden"
                  strokeWidth={2}
                />
              </Link>
            );
          })}
        </Card>
      )}
    </div>
  );
}
