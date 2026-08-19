import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { FormEmpleado } from "@/components/personal/form-empleado";

export const metadata = { title: "Nuevo empleado" };

export default async function NuevoEmpleadoPage() {
  await requireRol("lider");

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/personal"
          className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" strokeWidth={2} />
          Personal
        </Link>
        <PageHeader
          titulo="Nuevo empleado"
          descripcion="Cargá sus datos y el contrato. Los horarios de trabajo se arman después, desde su ficha."
          className="pb-2"
        />
      </div>
      <div className="max-w-2xl">
        <FormEmpleado cancelarHref="/personal" />
      </div>
    </div>
  );
}
