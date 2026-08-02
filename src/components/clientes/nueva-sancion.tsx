"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import { crearSancion } from "@/lib/actions/sanciones";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ACCEPT_ARCHIVOS } from "./constantes";

/** Alta de sanción o notificación (solo administración y consejo). */
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
  const [tipo, setTipo] = useState<string>("notificacion");

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
      toast.success(
        tipo === "sancion" ? "Sanción registrada" : "Notificación registrada"
      );
      formRef.current?.reset();
      setTipo("notificacion");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Registrar sanción o notificación
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={onSubmit} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-base">Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="h-12 w-full text-base">
                  <SelectValue placeholder="Elegí el tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="notificacion">Notificación</SelectItem>
                  <SelectItem value="sancion">Sanción</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
              <ShieldAlert className="size-5" />
            )}
            Registrar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
