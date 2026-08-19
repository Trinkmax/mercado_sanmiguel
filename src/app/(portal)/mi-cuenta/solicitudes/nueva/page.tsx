import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, UserX } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { FormSolicitudSocio } from "@/components/portal/form-solicitud-socio";
import { contarCircularesPendientes } from "@/components/portal/circulares-pendientes";

export const metadata = { title: "Nueva solicitud" };

export default async function NuevaSolicitudSocioPage() {
  const perfil = await requireRol("socio");
  const supabase = await createClient();

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, nombre, codigo")
    .eq("auth_user_id", perfil.user_id)
    .maybeSingle();

  // Con circulares obligatorias sin confirmar, el portal queda bloqueado en
  // /mi-cuenta hasta que el socio las confirme.
  if (cliente && (await contarCircularesPendientes(supabase, cliente.id)) > 0) {
    redirect("/mi-cuenta");
  }

  return (
    <div className="space-y-8">
      <Button asChild variant="ghost" className="-ml-2 min-h-11">
        <Link href="/mi-cuenta">
          <ArrowLeft className="size-4" />
          Volver a Mi cuenta
        </Link>
      </Button>

      {!cliente ? (
        <EmptyState
          icono={UserX}
          titulo="Tu usuario no está vinculado a un puesto"
          descripcion="Consultá en administración para que te asocien a tu carpeta."
        />
      ) : (
        <>
          <PageHeader
            titulo="Nueva solicitud"
            descripcion={`Para ${cliente.nombre} · Carpeta N° ${cliente.codigo}. La recibe el Líder de Procesos y te respondemos por acá.`}
            className="pb-0"
          />
          <FormSolicitudSocio />
        </>
      )}
    </div>
  );
}
