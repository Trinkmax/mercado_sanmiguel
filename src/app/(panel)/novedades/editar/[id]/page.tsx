import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hoyISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { FormNovedad } from "@/components/novedades/form-novedad";
import { COLUMNAS_NOVEDAD, armarVistas, type FilaNovedadBD } from "@/components/novedades/datos";
import { LABEL_ESTADO_NOVEDAD, hrefNovedades, nombrePila } from "@/components/novedades/constantes";

export const metadata = { title: "Corregir novedad" };

type Props = { params: Promise<{ id: string }> };

/** Corregir una novedad que todavía espera aprobación. Lo aprobado no se edita: se anula. */
export default async function EditarNovedadPage({ params }: Props) {
  const perfil = await requireRol("admin", "guardia", "lider");
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("novedades_personal")
    .select(`${COLUMNAS_NOVEDAD}, empleado:empleados(id, nombre, apellido, sector, cargo)`)
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .maybeSingle();
  if (!data || !data.empleado) notFound();
  const fila = data as FilaNovedadBD & {
    empleado: { id: string; nombre: string; apellido: string; sector: "porteria" | "limpieza" | "mantenimiento" | "administracion" | "otro"; cargo: string | null };
  };
  const [vista] = await armarVistas(supabase, [fila]);
  const volver = hrefNovedades({ periodo: `${fila.fecha_desde.slice(0, 7)}-01` });

  const puedeEditar =
    fila.estado === "pendiente" &&
    (perfil.rol === "admin" || perfil.rol === "lider" || fila.cargada_por === perfil.user_id);

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Corregir novedad"
        descripcion={
          fila.estado === "pendiente"
            ? `${nombrePila(fila.empleado)} · todavía espera la aprobación de Administración.`
            : `${nombrePila(fila.empleado)} · ${LABEL_ESTADO_NOVEDAD[fila.estado]}.`
        }
      >
        <Button asChild variant="outline" className="min-h-11">
          <Link href={volver}>
            <ArrowLeft className="size-4" />
            Volver a la planilla
          </Link>
        </Button>
      </PageHeader>

      {puedeEditar ? (
        <div className="max-w-4xl">
          <FormNovedad
            rol={perfil.rol as "admin" | "guardia" | "lider"}
            empleados={[fila.empleado]}
            hoy={hoyISO()}
            editar={{
              id: fila.id,
              empleado: fila.empleado,
              tipo: fila.tipo,
              fecha_desde: fila.fecha_desde,
              fecha_hasta: fila.fecha_hasta,
              horas: fila.horas === null ? null : Number(fila.horas),
              justificada: fila.justificada,
              detalle: fila.detalle,
              tieneAdjunto: Boolean(fila.adjunto_path),
              adjuntoUrl: vista?.adjuntoUrl ?? null,
            }}
          />
        </div>
      ) : (
        <EmptyState
          icono={Lock}
          titulo={
            fila.estado === "pendiente"
              ? "Solo quien la cargó la puede corregir"
              : `Esta novedad ya está ${LABEL_ESTADO_NOVEDAD[fila.estado].toLowerCase()}`
          }
          descripcion={
            fila.estado === "aprobada"
              ? "Lo aprobado no se cambia: Administración o el Líder la anulan con el motivo y se carga de nuevo."
              : "Volvé a la planilla para ver cómo quedó."
          }
        >
          <Button asChild variant="outline" className="mt-2 h-12 px-5">
            <Link href={volver}>Volver a la planilla</Link>
          </Button>
        </EmptyState>
      )}
    </div>
  );
}
