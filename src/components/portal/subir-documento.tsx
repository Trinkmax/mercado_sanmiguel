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
import {
  adjuntoMuyPesado,
  ERROR_PESO_ADJUNTO,
  explicarFalloEnvio,
  prepararAdjuntos,
} from "@/components/comunicaciones/adjuntos";
import { AvisoError } from "@/components/comunicaciones/aviso-error";
import { llamarAccion } from "@/lib/llamar-accion";

/**
 * Botón + formulario corto para que el socio suba un documento a su carpeta.
 * La foto se achica antes de subirla; si algo falla, el cartel rojo dice qué hacer y lo
 * cargado queda en el formulario.
 */
export function SubirDocumento() {
  const [abierto, setAbierto] = useState(false);
  const [categoria, setCategoria] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function cambiar(abrir: boolean) {
    if (pendiente) return;
    setAbierto(abrir);
    if (!abrir) {
      setCategoria("");
      setError(null);
    }
  }

  function falta(mensaje: string, campoId: string) {
    setError(mensaje);
    document.getElementById(campoId)?.focus();
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente) return;
    setError(null);
    const fd = new FormData(e.currentTarget);
    const archivo = fd.get("archivo");
    if (!String(fd.get("titulo") ?? "").trim()) {
      falta("Poné un título para el documento (ej.: Habilitación 2026).", "doc-titulo");
      return;
    }
    if (!categoria) {
      falta("Elegí la categoría del documento.", "doc-categoria");
      return;
    }
    if (!(archivo instanceof File) || archivo.size === 0) {
      falta("Elegí el archivo: tocá “Archivo” y sacá una foto o elegí un PDF.", "doc-archivo");
      return;
    }
    fd.set("categoria", categoria);
    startTransition(async () => {
      const errorPeso = await prepararAdjuntos(fd, ["archivo"]);
      if (errorPeso) {
        setError(errorPeso);
        return;
      }
      const res = await llamarAccion(() => subirDocumentoSocio(fd));
      if (!res.ok) {
        // La subida no tiene clave de idempotencia: antes de repetirla, que se fije si llegó.
        setError(
          explicarFalloEnvio(
            res.error,
            fd,
            ["archivo"],
            "Se cortó la conexión y no sabemos si se subió. Revisá internet y fijate en “Tus documentos” antes de subirlo de nuevo."
          )
        );
        return;
      }
      toast.success("Documento subido. ¡Gracias!");
      setAbierto(false);
      setCategoria("");
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
          <DialogTitle className="pr-8">Subir documento</DialogTitle>
          <DialogDescription>
            Puede ser un PDF o una foto (JPG, PNG o WEBP), de hasta 20 MB.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-5">
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
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-categoria" className="text-base">
              Categoría
            </Label>
            <Select
              value={categoria}
              onValueChange={(v) => {
                setCategoria(v);
                setError(null);
              }}
            >
              <SelectTrigger id="doc-categoria" className="min-h-12 w-full">
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
              onChange={(e) => {
                if (adjuntoMuyPesado(e.target.files?.[0])) {
                  e.target.value = "";
                  setError(ERROR_PESO_ADJUNTO);
                } else {
                  setError(null);
                }
              }}
            />
          </div>

          {error ? <AvisoError mensaje={error} /> : null}

          <Button
            type="submit"
            size="lg"
            className="h-12 w-full text-base font-semibold"
            disabled={pendiente}
          >
            {pendiente ? <Spinner /> : null}
            Subir documento
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
