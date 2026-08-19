"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileSignature, LogIn } from "lucide-react";
import { aceptarTerminos } from "@/lib/actions/terminos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";

/**
 * Pantalla de aceptación de términos: bloquea TODO el portal hasta que el
 * socio marque la casilla y toque "Aceptar y entrar".
 */
export function AceptarTerminos({
  terminosId,
  titulo,
  contenido,
  version,
  nombre,
}: {
  terminosId: string;
  titulo: string;
  contenido: string;
  version: number;
  nombre: string;
}) {
  const router = useRouter();
  const [acepta, setAcepta] = useState(false);
  const [pendiente, startTransition] = useTransition();

  function confirmar() {
    if (!acepta) return;
    startTransition(async () => {
      const res = await aceptarTerminos({ terminosId, acepta: true });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Términos aceptados. ¡Bienvenido!");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-muted-foreground">Hola, {nombre}</p>
        <h1 className="font-display text-2xl font-bold tracking-tight text-balance">
          Antes de entrar, leé y aceptá los términos y condiciones
        </h1>
        <p className="text-sm text-muted-foreground">
          {version > 1
            ? `Hay una versión nueva (v${version}). Tenés que aceptarla para seguir usando el portal.`
            : "Es un paso único: la próxima vez entrás directo."}
        </p>
      </div>

      <div className="etiqueta">
        <div className="etiqueta-interior space-y-4">
          <div className="flex items-center gap-2.5 border-b pb-3">
            <FileSignature className="size-5 text-primary" strokeWidth={2} />
            <h2 className="font-display text-lg font-bold">{titulo}</h2>
          </div>
          <div className="max-h-[45svh] overflow-y-auto pr-2">
            <p className="whitespace-pre-line text-[15px] leading-relaxed">
              {contenido}
            </p>
          </div>
        </div>
      </div>

      <label
        className={cn(
          "flex cursor-pointer items-start gap-4 rounded-lg border bg-card p-4 transition-colors select-none",
          acepta && "border-primary bg-accent/50"
        )}
      >
        <Checkbox
          checked={acepta}
          onCheckedChange={(v) => setAcepta(v === true)}
          className="mt-0.5 size-6 [&_svg]:size-4"
          aria-label="Leí y acepto los términos y condiciones"
        />
        <span className="text-base font-medium leading-snug">
          Leí y acepto los términos y condiciones
        </span>
      </label>

      <Button
        size="lg"
        className="h-14 w-full text-lg font-semibold"
        disabled={!acepta || pendiente}
        onClick={confirmar}
      >
        {pendiente ? (
          <Spinner className="size-5" />
        ) : (
          <LogIn className="size-5" strokeWidth={2} />
        )}
        Aceptar y entrar
      </Button>
    </div>
  );
}
