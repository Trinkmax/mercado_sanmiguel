import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hoyISO } from "@/lib/format";
import { categoriasDeRol } from "@/lib/segmentos";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { FormRegistro } from "@/components/comunicaciones/form-registro";
import { opcionesClientes } from "@/components/comunicaciones/opciones-clientes";
import { esTipoRegistro, infoTipoRegistro } from "@/components/comunicaciones/constantes";

export const metadata = { title: "Nuevo registro" };

export default async function NuevoRegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; cliente?: string }>;
}) {
  const perfil = await requireRol("admin", "lider");
  const { tipo: tipoParam, cliente } = await searchParams;
  const tipo = esTipoRegistro(tipoParam) ? tipoParam : "notificacion";
  const info = infoTipoRegistro(tipo);
  const supabase = await createClient();
  const clientes = await opcionesClientes(supabase, categoriasDeRol(perfil.rol));
  const clienteInicial = cliente && clientes.some((c) => c.id === cliente) ? cliente : null;

  return (
    <div className="space-y-8">
      <PageHeader
        titulo={info.nuevo}
        descripcion="Elegí a quién, contá qué pasó y mandalo. Le llega a su portal al instante."
      >
        <Button asChild variant="outline" className="min-h-11">
          <Link href={`/comunicaciones?tab=${info.pestana}`}>
            <ArrowLeft className="size-4" />
            Volver a {info.plural}
          </Link>
        </Button>
      </PageHeader>

      <div className="max-w-2xl">
        <FormRegistro
          clientes={clientes}
          clienteInicialId={clienteInicial}
          tipoInicial={tipo}
          fechaHoy={hoyISO()}
        />
      </div>
    </div>
  );
}
