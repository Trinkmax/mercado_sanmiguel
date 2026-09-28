import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hoyISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { FormNovedad, type EmpleadoElegible } from "@/components/novedades/form-novedad";
import { esTipoNovedad, sectoresDeRol } from "@/components/novedades/constantes";

export const metadata = { title: "Cargar novedad" };

type Props = {
  searchParams: Promise<{ empleado?: string | string[]; tipo?: string | string[] }>;
};

export default async function NuevaNovedadPage({ searchParams }: Props) {
  const perfil = await requireRol("admin", "guardia", "lider");
  const sp = await searchParams;
  const rol = perfil.rol as "admin" | "guardia" | "lider";

  const supabase = await createClient();
  const { data } = await supabase
    .from("empleados")
    .select("id, nombre, apellido, sector, cargo")
    .eq("org_id", perfil.org_id)
    .eq("activo", true)
    .in("sector", sectoresDeRol(rol))
    .order("apellido")
    .order("nombre");
  const empleados: EmpleadoElegible[] = data ?? [];

  const pedidos = Array.isArray(sp.empleado) ? sp.empleado : sp.empleado ? [sp.empleado] : [];
  const inicialEmpleadoIds = pedidos.filter((id) => empleados.some((e) => e.id === id));
  const tipoParam = Array.isArray(sp.tipo) ? sp.tipo[0] : sp.tipo;
  const inicialTipo = esTipoNovedad(tipoParam) ? tipoParam : undefined;

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Cargar novedad"
        descripcion={
          rol === "guardia"
            ? "Faltas, llegadas tarde, feriados, vacaciones, licencias u horas extra del personal de Portería. Le llega a Administración para aprobar."
            : "Elegí a quién, qué pasó y cuándo. Queda aprobada y cuenta en la planilla del mes."
        }
      >
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/novedades">
            <ArrowLeft className="size-4" />
            Volver a la planilla
          </Link>
        </Button>
      </PageHeader>

      <div className="max-w-4xl">
        <FormNovedad
          rol={rol}
          empleados={empleados}
          hoy={hoyISO()}
          inicialEmpleadoIds={inicialEmpleadoIds}
          inicialTipo={inicialTipo}
        />
      </div>
    </div>
  );
}
