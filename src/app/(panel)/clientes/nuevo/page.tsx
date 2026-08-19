import { aplicaDirecto, requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { FormCliente } from "@/components/clientes/form-cliente";

export const metadata = { title: "Nuevo cliente" };

export default async function NuevoClientePage() {
  const perfil = await requireRol("admin", "tesoreria", "consejo", "lider");
  const supabase = await createClient();

  const [ultimoRes, altasPendientesRes, conceptosRes] = await Promise.all([
    supabase
      .from("clientes")
      .select("codigo")
      .order("codigo", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Altas que todavía espera aprobar el Líder: su N° de carpeta ya está
    // "reservado" aunque el cliente no exista; no lo volvemos a sugerir.
    supabase
      .from("cambios_pendientes")
      .select("datos")
      .eq("estado", "pendiente")
      .eq("entidad", "cliente")
      .eq("accion", "alta"),
    supabase
      .from("conceptos")
      .select("id, codigo, nombre")
      .eq("tipo", "recurrente")
      .eq("activo", true)
      .order("orden_imputacion"),
  ]);

  const codigosReservados = (altasPendientesRes.data ?? []).map((c) => {
    const datos = c.datos as { codigo?: number | string } | null;
    return Number(datos?.codigo ?? 0);
  });
  const codigoSugerido =
    Math.max(Number(ultimoRes.data?.codigo ?? 0), ...codigosReservados, 0) + 1;

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Nuevo cliente"
        descripcion={
          aplicaDirecto(perfil.rol)
            ? "Abrí la carpeta y marcá qué paga cada mes: expensas, cocheras, galpón… Documentos y medidores se cargan después desde su carpeta."
            : "Cargá los datos y qué paga cada mes; el alta la aprueba el Líder de Procesos. Documentos y medidores se cargan después desde su carpeta."
        }
      />
      <div className="max-w-2xl">
        <FormCliente
          codigoSugerido={codigoSugerido}
          conceptos={conceptosRes.data ?? []}
          rol={perfil.rol}
        />
      </div>
    </div>
  );
}
