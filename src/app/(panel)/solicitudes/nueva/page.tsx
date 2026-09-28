import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { FormSolicitud, type ClienteBuscable } from "@/components/solicitudes/form-solicitud";
import type { LugarSimple } from "@/components/solicitudes/lugares";
import {
  ORIGENES_SOLICITUD,
  TIPOS_SOLICITUD,
  type OrigenSolicitud,
} from "@/components/solicitudes/constantes";

export const metadata = { title: "Nueva solicitud" };

type Props = {
  searchParams: Promise<{ origen?: string; cliente?: string; espacio?: string; tipo?: string }>;
};

export default async function NuevaSolicitudPage({ searchParams }: Props) {
  const perfil = await requireRol("admin", "guardia", "porteria", "tesoreria", "lider");
  const { origen, cliente, espacio, tipo } = await searchParams;
  const supabase = await createClient();
  const conClientes = perfil.rol === "admin" || perfil.rol === "lider";

  // Portería, el Jefe y Tesorería no ven clientes (G11, J4): eligen el puesto por número con
  // `espacios_del_plano()`, que no trae a quién pertenece.
  const [lugaresRes, clientesRes] = await Promise.all([
    supabase.rpc("espacios_del_plano"),
    conClientes
      ? supabase.from("clientes").select("id, codigo, nombre, apodo").eq("activo", true).order("codigo")
      : Promise.resolve({ data: [] as ClienteBuscable[] }),
  ]);
  const lugares: LugarSimple[] = (lugaresRes.data ?? []).map((e) => ({
    id: e.id,
    tipo: e.tipo,
    numero: e.numero,
    medio: e.medio,
  }));
  const clientes: ClienteBuscable[] = clientesRes.data ?? [];

  // Origen por rol; Administración y el Líder lo pueden cambiar (formularios en papel) y
  // ?origen=porteria lo preselecciona.
  const porRol: OrigenSolicitud =
    perfil.rol === "porteria" || perfil.rol === "guardia"
      ? "porteria"
      : perfil.rol === "tesoreria"
        ? "tesoreria"
        : perfil.rol === "lider"
          ? "lider"
          : "administracion";
  const origenQuery = ORIGENES_SOLICITUD.find((o) => o === origen);
  const origenInicial = conClientes && origenQuery ? origenQuery : porRol;
  const clienteInicialId = clientes.some((c) => c.id === cliente) ? cliente : undefined;
  const espacioInicialId = lugares.some((l) => l.id === espacio) ? espacio : undefined;
  const tipoInicial = TIPOS_SOLICITUD.find((t) => t.valor === tipo)?.valor;

  const descripcion =
    perfil.rol === "porteria"
      ? "Si pasa algo en la garita o alguien pide algo, dejalo por escrito: le llega al Jefe de Portería y, si hace falta, él lo eleva al Líder de Procesos."
      : perfil.rol === "guardia"
        ? "Mandale una solicitud o un aviso al Líder de Procesos. Si es sobre un puesto, elegilo por número."
        : perfil.rol === "tesoreria"
          ? "Tu solicitud le llega al Líder de Procesos. Si es sobre un puesto, elegilo por número."
          : "Cargá una solicitud, informe, reclamo o consulta. Puede ser sobre un cliente, un lugar del plano o algo general.";

  return (
    <div className="space-y-8">
      <PageHeader titulo="Nueva solicitud" descripcion={descripcion}>
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
          clientes={clientes}
          lugares={lugares}
          origenInicial={origenInicial}
          clienteInicialId={clienteInicialId}
          espacioInicialId={espacioInicialId}
          tipoInicial={tipoInicial}
        />
      </div>
    </div>
  );
}
