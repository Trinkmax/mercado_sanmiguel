import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hoyISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { FormCircular } from "@/components/comunicaciones/form-circular";
import { cargarClientesPublico } from "@/components/comunicaciones/datos";

export const metadata = { title: "Nueva circular" };

export default async function NuevaCircularPage() {
  await requireRol("admin", "lider");
  const supabase = await createClient();
  // Para contar el público en vivo: clientes activos con sus segmentos y si ven el portal.
  const clientes = (await cargarClientesPublico(supabase)).filter((c) => c.activo);

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Nueva circular"
        descripcion="Elegí a quién le llega. Si es de recepción obligatoria, cada uno tiene que confirmar que la recibió."
      >
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/comunicaciones">
            <ArrowLeft className="size-4" />
            Volver a Circulares
          </Link>
        </Button>
      </PageHeader>

      <div className="max-w-2xl">
        <FormCircular fechaHoy={hoyISO()} clientes={clientes} />
      </div>
    </div>
  );
}
