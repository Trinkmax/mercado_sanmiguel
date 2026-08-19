import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { FormEmpleado } from "@/components/personal/form-empleado";
import { nombreCompleto } from "@/components/personal/constantes";

export const metadata = { title: "Editar empleado" };

type Props = { params: Promise<{ id: string }> };

export default async function EditarEmpleadoPage({ params }: Props) {
  const perfil = await requireRol("lider");
  const { id } = await params;
  const supabase = await createClient();

  const { data: empleado } = await supabase
    .from("empleados")
    .select(
      "id, nombre, apellido, dni, cuil, cargo, telefono, email, tipo_contrato, fecha_ingreso, fecha_egreso, observaciones, contrato_path"
    )
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .maybeSingle();
  if (!empleado) notFound();

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
        <FormEmpleado empleado={empleado} cancelarHref={`/personal/${empleado.id}`} />
      </div>
    </div>
  );
}
