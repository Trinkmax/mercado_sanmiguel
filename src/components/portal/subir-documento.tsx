"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { subirDocumentoSocio } from "@/lib/actions/portal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  ACCEPT_ARCHIVOS,
  CATEGORIAS_DOCUMENTO,
} from "@/components/portal/constantes";

/** Botón + formulario corto para que el socio suba un documento a su carpeta. */
export function SubirDocumento() {
  const [abierto, setAbierto] = useState(false);
  const [categoria, setCategoria] = useState("");
  const [pendiente, startTransition] = useTransition();

  function cambiar(abrir: boolean) {
    setAbierto(abrir);
    if (!abrir) setCategoria("");
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("categoria", categoria);
    startTransition(async () => {
      const res = await subirDocumentoSocio(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Documento subido. ¡Gracias!");
      cambiar(false);
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={cambiar}>
      <DialogTrigger asChild>
        <Button size="lg" className="h-12 w-full text-base font-semibold">
          <Upload className="size-5" strokeWidth={2} />
          Subir documento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Subir documento</DialogTitle>
          <DialogDescription>
            Puede ser un PDF o una foto (JPG, PNG o WEBP), de hasta 20 MB.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="doc-titulo" className="text-base">
              Título
            </Label>
            <Input
              id="doc-titulo"
              name="titulo"
              className="h-12"
              placeholder="Ej.: Habilitación municipal 2026"
              maxLength={200}
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-base">Categoría</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger className="min-h-12 w-full">
                <SelectValue placeholder="Elegí la categoría" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS_DOCUMENTO.map((c) => (
                  <SelectItem key={c.valor} value={c.valor} className="min-h-11">
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              className="h-12 pt-3"
              required
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="h-12 w-full text-base font-semibold"
            disabled={pendiente || !categoria}
          >
            {pendiente ? <Spinner /> : null}
            Subir documento
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
