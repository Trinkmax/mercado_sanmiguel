import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { FormCliente } from "@/components/clientes/form-cliente";

export const metadata = { title: "Nuevo cliente" };

export default async function NuevoClientePage() {
  await requireRol("admin", "tesoreria", "consejo");
  const supabase = await createClient();

  const [ultimoRes, conceptosRes] = await Promise.all([
    supabase
      .from("clientes")
      .select("codigo")
      .order("codigo", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("conceptos")
      .select("id, codigo, nombre")
      .eq("tipo", "recurrente")
      .eq("activo", true)
      .order("orden_imputacion"),
  ]);
  const codigoSugerido = Number(ultimoRes.data?.codigo ?? 0) + 1;

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Nuevo cliente"
        descripcion="Abrí la carpeta y marcá qué paga cada mes: expensas, cocheras, galpón… Documentos y medidores se cargan después desde su carpeta."
      />
      <div className="max-w-2xl">
        <FormCliente
          codigoSugerido={codigoSugerido}
          conceptos={conceptosRes.data ?? []}
        />
      </div>
    </div>
  );
}
