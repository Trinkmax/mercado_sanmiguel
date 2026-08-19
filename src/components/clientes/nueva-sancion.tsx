"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FilePenLine } from "lucide-react";
import { crearSancion } from "@/lib/actions/sanciones";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Sello } from "@/components/shared/sello";
import { cn } from "@/lib/utils";
import { ACCEPT_ARCHIVOS, TIPOS_REGISTRO, type TipoRegistro } from "./constantes";

const TOAST_POR_TIPO: Record<TipoRegistro, string> = {
  notificacion: "Notificación registrada",
  apercibimiento: "Apercibimiento registrado",
  sancion: "Sanción registrada",
};

/** Alta de un registro documental (notificación, apercibimiento o sanción),
 * con documento adjunto opcional. Administración, Consejo y Líder. */
export function NuevaSancion({
  clienteId,
  fechaHoy,
}: {
  clienteId: string;
  fechaHoy: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pendiente, startTransition] = useTransition();
  const [tipo, setTipo] = useState<TipoRegistro>("notificacion");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("clienteId", clienteId);
    fd.set("tipo", tipo);
    startTransition(async () => {
      const res = await crearSancion(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(TOAST_POR_TIPO[tipo]);
      formRef.current?.reset();
      setTipo("notificacion");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Nuevo registro</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label className="text-base">¿Qué se registra?</Label>
            <div
              role="group"
              aria-label="Tipo de registro"
              className="grid gap-2 sm:grid-cols-3"
            >
              {TIPOS_REGISTRO.map((t) => {
                const activo = tipo === t.valor;
                return (
                  <button
                    key={t.valor}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => setTipo(t.valor)}
                    className={cn(
                      "flex min-h-16 flex-col items-start justify-center gap-1 rounded-lg border px-3 py-2 text-left transition-colors",
                      activo
                        ? "border-primary bg-accent ring-2 ring-primary/30"
                        : "border-border bg-card hover:bg-accent/60"
                    )}
                  >
                    <Sello estado={t.valor} />
                    <span className="text-xs leading-snug text-muted-foreground">
                      {t.ayuda}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sancion-fecha" className="text-base">
                Fecha
              </Label>
              <Input
                id="sancion-fecha"
                name="fecha"
                type="date"
                defaultValue={fechaHoy}
                className="h-12 text-base"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sancion-titulo" className="text-base">
                Título
              </Label>
              <Input
                id="sancion-titulo"
                name="titulo"
                placeholder="Ej.: Falta de limpieza del puesto"
                className="h-12 text-base"
                autoComplete="off"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sancion-detalle" className="text-base">
              Detalle
            </Label>
            <Textarea
              id="sancion-detalle"
              name="detalle"
              rows={3}
              placeholder="Qué pasó y qué se resolvió"
              className="text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sancion-archivo" className="text-base">
              Documento adjunto (opcional)
            </Label>
            <Input
              id="sancion-archivo"
              name="archivo"
              type="file"
              accept={ACCEPT_ARCHIVOS}
              className="h-12 pt-3 text-base"
            />
            <p className="text-sm text-muted-foreground">
              PDF o foto (JPG, PNG, WEBP), hasta 20 MB.
            </p>
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={pendiente}
            className="h-12 px-5 text-base font-semibold"
          >
            {pendiente ? (
              <Spinner className="size-5" />
            ) : (
              <FilePenLine className="size-5" />
            )}
            Registrar {TIPOS_REGISTRO.find((t) => t.valor === tipo)?.label.toLowerCase()}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
