import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { hoyISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { FormCircular } from "@/components/comunicaciones/form-circular";

export const metadata = { title: "Nueva circular" };

export default async function NuevaCircularPage() {
  await requireRol("admin", "lider");

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Nueva circular"
        descripcion="Se publica en el portal de todos los socios. Si es de recepción obligatoria, cada uno tiene que confirmar que la recibió."
      >
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/comunicaciones">
            <ArrowLeft className="size-4" />
            Volver a Circulares
          </Link>
        </Button>
      </PageHeader>

      <div className="max-w-2xl">
        <FormCircular fechaHoy={hoyISO()} />
      </div>
    </div>
  );
}
