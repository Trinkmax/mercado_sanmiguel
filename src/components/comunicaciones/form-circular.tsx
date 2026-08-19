"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Megaphone } from "lucide-react";
import { crearCircular } from "@/lib/actions/circulares";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

/** Alta de circular: título, detalle, fecha, PDF opcional y recepción obligatoria. */
export function FormCircular({ fechaHoy }: { fechaHoy: string }) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [obligatoria, setObligatoria] = useState(true);
  const [nombrePdf, setNombrePdf] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("obligatoria", obligatoria ? "true" : "false");
    startTransition(async () => {
      const res = await crearCircular(fd);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success(`Circular N° ${res.data.numero} publicada`);
      router.push(`/comunicaciones/${res.data.id}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-7">
      <div className="space-y-2">
        <Label htmlFor="circ-titulo" className="text-base">
          Título
        </Label>
        <Input
          id="circ-titulo"
          name="titulo"
          required
          maxLength={200}
          autoComplete="off"
          placeholder="Ej.: Horario de ingreso de camiones — temporada alta"
          className="h-12 text-base md:text-base"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="circ-detalle" className="text-base">
          Detalle
        </Label>
        <Textarea
          id="circ-detalle"
          name="detalle"
          rows={6}
          maxLength={8000}
          placeholder="El texto que va a leer cada socio en el portal."
          className="min-h-36 text-base md:text-base"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="circ-fecha" className="text-base">
            Fecha
          </Label>
          <Input
            id="circ-fecha"
            name="fecha"
            type="date"
            defaultValue={fechaHoy}
            required
            className="h-12 text-base md:text-base"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="circ-archivo" className="text-base">
            PDF adjunto (opcional)
          </Label>
          <Label
            htmlFor="circ-archivo"
            className="inline-flex h-12 w-full cursor-pointer items-center gap-2 rounded-md border bg-card px-4 text-sm font-medium hover:bg-muted"
          >
            <FileText className="size-4" strokeWidth={2} />
            <span className="truncate">{nombrePdf ?? "Elegir PDF"}</span>
          </Label>
          <Input
            id="circ-archivo"
            name="archivo"
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(e) => setNombrePdf(e.target.files?.[0]?.name ?? null)}
          />
        </div>
      </div>

      <label
        className={cn(
          "flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors select-none",
          obligatoria ? "border-parcial/50 bg-parcial-suave/60" : "bg-card"
        )}
      >
        <Switch
          checked={obligatoria}
          onCheckedChange={setObligatoria}
          className="mt-1"
        />
        <span className="space-y-0.5">
          <span className="block text-base font-semibold">Recepción obligatoria</span>
          <span className="block text-sm text-muted-foreground">
            {obligatoria
              ? "Cada socio tiene que confirmar que la recibió para seguir usando el portal. Vas a ver quién la confirmó y quién no."
              : "Se muestra en el portal como información, sin pedir confirmación."}
          </span>
        </span>
      </label>

      {error ? (
        <p className="rounded-md bg-pendiente-suave px-4 py-3 text-sm font-medium text-pendiente">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={pendiente}
        className="h-12 w-full text-base font-semibold sm:w-auto sm:px-8"
      >
        {pendiente ? (
          <Spinner className="size-5" />
        ) : (
          <Megaphone className="size-5" strokeWidth={2} />
        )}
        Publicar circular
      </Button>
    </form>
  );
}
