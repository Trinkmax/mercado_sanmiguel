import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { FormSolicitud } from "@/components/solicitudes/form-solicitud";
import {
  ORIGENES_SOLICITUD,
  type OrigenSolicitud,
} from "@/components/solicitudes/constantes";

export const metadata = { title: "Nueva solicitud" };

export default async function NuevaSolicitudPage({
  searchParams,
}: {
  searchParams: Promise<{ origen?: string; cliente?: string }>;
}) {
  const perfil = await requireRol(
    "admin",
    "guardia",
    "porteria",
    "tesoreria",
    "consejo",
    "lider"
  );
  const { origen, cliente } = await searchParams;
  const supabase = await createClient();

  const { data: clientes } = await supabase
    .from("clientes")
    .select("id, codigo, nombre, apodo")
    .eq("activo", true)
    .order("codigo");

  // Origen por rol; admin y líder pueden cambiarlo (formularios en papel) y
  // la query ?origen=porteria lo preselecciona (llega desde Portería).
  const porRol: OrigenSolicitud =
    perfil.rol === "porteria" || perfil.rol === "guardia"
      ? "porteria"
      : perfil.rol === "lider" || perfil.rol === "consejo"
        ? "lider"
        : "administracion";
  const origenQuery = ORIGENES_SOLICITUD.find((o) => o === origen);
  const puedeElegir = perfil.rol === "admin" || perfil.rol === "lider";
  const origenInicial = puedeElegir && origenQuery ? origenQuery : porRol;

  const clienteInicialId = (clientes ?? []).some((c) => c.id === cliente)
    ? cliente
    : undefined;

  const esPorteria = porRol === "porteria";

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Nueva solicitud"
        descripcion={
          esPorteria
            ? "Cargá la solicitud, informe o reclamo. Al crearla la imprimís para derivarla a Administración."
            : "Cargá una solicitud, informe, reclamo o consulta. Puede ser sobre un puesto o general."
        }
      >
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/solicitudes">
            <ArrowLeft className="size-4" />
            Volver a Solicitudes
          </Link>
        </Button>
      </PageHeader>

      <div className="max-w-2xl">
        <FormSolicitud
          rol={perfil.rol}
          clientes={clientes ?? []}
          origenInicial={origenInicial}
          clienteInicialId={clienteInicialId}
        />
      </div>
    </div>
  );
}
