"use client";

import { ArrowLeft, Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/** Barra de acciones de los documentos imprimibles (no sale en el papel). */
export function BotonImprimir({ volverA }: { volverA?: string }) {
  const router = useRouter();
  return (
    <div className="no-print mb-6 flex items-center justify-between gap-3">
      <Button
        variant="outline"
        onClick={() => (volverA ? router.push(volverA) : router.back())}
      >
        <ArrowLeft className="size-4" />
        Volver
      </Button>
      <Button onClick={() => window.print()} size="lg" className="font-semibold">
        <Printer className="size-5" />
        Imprimir / Guardar PDF
      </Button>
    </div>
  );
}
