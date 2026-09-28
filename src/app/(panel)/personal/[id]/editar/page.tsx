import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { FormEmpleado } from "@/components/personal/form-empleado";
import { horasSemanalesDeFranjas, nombreCompleto } from "@/components/personal/constantes";

export const metadata = { title: "Editar empleado" };

type Props = { params: Promise<{ id: string }> };

export default async function EditarEmpleadoPage({ params }: Props) {
  const perfil = await requireRol("lider");
  const { id } = await params;
  const supabase = await createClient();

  const { data: empleado } = await supabase
    .from("empleados")
    .select(
      "id, nombre, apellido, dni, cuil, cargo, telefono, email, sector, horas_semanales, tipo_contrato, fecha_ingreso, fecha_egreso, observaciones, contrato_path, empleado_horarios(dia_semana, hora_desde, hora_hasta)"
    )
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .maybeSingle();
  if (!empleado) notFound();
  const { empleado_horarios: franjas, ...datos } = empleado;
  const horasSegunHorario = horasSemanalesDeFranjas(franjas ?? []);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/personal/${empleado.id}`}
          className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" strokeWidth={2} />
          Ficha de {nombreCompleto(empleado)}
        </Link>
        <PageHeader
          titulo="Editar datos"
          descripcion={`${nombreCompleto(empleado)} · DNI ${empleado.dni}`}
          className="pb-2"
        />
      </div>
      <div className="max-w-2xl">
        <FormEmpleado
          empleado={{ ...datos, horas_semanales: datos.horas_semanales === null ? null : Number(datos.horas_semanales) }}
          cancelarHref={`/personal/${empleado.id}`}
          horasSegunHorario={horasSegunHorario}
        />
      </div>
    </div>
  );
}
