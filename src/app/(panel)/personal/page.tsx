import Link from "next/link";
import { ChevronRight, Clock, UserPlus, Users } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Sello } from "@/components/shared/sello";
import { EmptyState } from "@/components/shared/empty-state";
import { BotonExportar } from "@/components/shared/boton-exportar";
import { BuscadorEmpleados } from "@/components/personal/buscador-empleados";
import {
  LABEL_TIPO_CONTRATO,
  hrefPersonal,
  nombreCompleto,
  resumirHorarios,
} from "@/components/personal/constantes";

export const metadata = { title: "Personal" };

type Props = {
  searchParams: Promise<{ q?: string | string[]; filtro?: string | string[] }>;
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

  const supabase = await createClient();
  let consulta = supabase
    .from("empleados")
    .select(
      "id, nombre, apellido, dni, cargo, tipo_contrato, activo, empleado_horarios(dia_semana, hora_desde, hora_hasta)"
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
  const empleados = data ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Personal"
        descripcion="Empleados de la cooperativa: contrato, franjas horarias y horarios de trabajo."
      >
        <BotonExportar dataset="empleados" />
        <Button asChild size="lg" className="h-13 px-6 text-base font-semibold">
          <Link href="/personal/nuevo">
            <UserPlus className="size-5" />
            Nuevo empleado
          </Link>
        </Button>
      </PageHeader>

      <div className="space-y-3">
        <BuscadorEmpleados inicial={texto} filtro={filtro} />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar empleados">
          {FILTROS.map((f) => {
            const activo = f.valor === filtro;
            return (
              <Link
                key={f.valor}
                href={hrefPersonal(texto, f.valor)}
                aria-current={activo ? "true" : undefined}
                className={cn(
                  "inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors",
                  activo
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
      </div>

      {empleados.length === 0 ? (
        texto || filtro === "todos" ? (
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
            <Button asChild size="lg" className="h-12 px-5 font-semibold">
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
            return (
              <Link
                key={e.id}
                href={`/personal/${e.id}`}
                className="flex min-h-16 items-center gap-4 px-4 py-3 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <p
                      className={cn(
                        "truncate text-base font-semibold",
                        !e.activo && "text-muted-foreground"
                      )}
                    >
                      {nombreCompleto(e)}
                    </p>
                    <span className="text-sm text-muted-foreground tabular">
                      DNI {e.dni}
                    </span>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {[e.cargo, LABEL_TIPO_CONTRATO[e.tipo_contrato]]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 flex items-center gap-1.5 text-sm",
                      sinHorarios ? "text-parcial" : "text-foreground/80"
                    )}
                  >
                    <Clock className="size-3.5 shrink-0" strokeWidth={2} />
                    <span className="truncate tabular">{horarios}</span>
                  </p>
                </div>
                <Sello estado={e.activo ? "activo" : "inactivo"} />
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
