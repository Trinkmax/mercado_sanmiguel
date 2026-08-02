"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { subirDocumento } from "@/lib/actions/documentos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ACCEPT_ARCHIVOS, CATEGORIAS_DOCUMENTO } from "./constantes";

/** Formulario para sumar un documento a la carpeta del cliente. */
export function SubirDocumento({ clienteId }: { clienteId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pendiente, startTransition] = useTransition();
  const [categoria, setCategoria] = useState<string>("otro");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("clienteId", clienteId);
    fd.set("categoria", categoria);
    startTransition(async () => {
      const res = await subirDocumento(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Documento guardado en la carpeta");
      formRef.current?.reset();
      setCategoria("otro");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Subir un documento</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={onSubmit} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="doc-titulo" className="text-base">
                Título
              </Label>
              <Input
                id="doc-titulo"
                name="titulo"
                placeholder="Ej.: Habilitación 2026"
                className="h-12 text-base"
                autoComplete="off"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base">Categoría</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger className="h-12 w-full text-base">
                  <SelectValue placeholder="Elegí la categoría" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_DOCUMENTO.map((c) => (
                    <SelectItem key={c.valor} value={c.valor}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-archivo" className="text-base">
              Archivo
            </Label>
            <Input
              id="doc-archivo"
              name="archivo"
              type="file"
              accept={ACCEPT_ARCHIVOS}
              className="h-12 pt-3 text-base"
              required
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
              <Upload className="size-5" />
            )}
            Subir documento
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
