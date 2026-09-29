"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Upload } from "lucide-react";
import { subirDocumento } from "@/lib/actions/documentos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  ACCEPT_ARCHIVOS,
  CATEGORIA_DOCUMENTO_MAX,
  CATEGORIAS_DOCUMENTO,
  normalizarCategoriaDocumento,
} from "./constantes";
import {
  AYUDA_PESO_ADJUNTO,
  errorPesoAdjunto,
  explicarFalloEnvio,
  prepararAdjuntos,
} from "@/components/comunicaciones/adjuntos";
import { AlertaError } from "@/components/cobranza/alerta-error";
import { llamarAccion } from "@/lib/llamar-accion";

/**
 * Sumar un documento a la carpeta (C7): la categoría se elige con un toque entre las
 * sugeridas (Habilitación municipal · SENASA · Apto eléctrico) y las que ya usó la
 * cooperativa, o se escribe una nueva ("+ Otra categoría", con sugerencias al escribir).
 */
export function SubirDocumento({
  clienteId,
  usadas = [],
  categoriaInicial,
}: {
  clienteId: string;
  /** Categorías que ya se usaron en la cooperativa (texto, sin repetir). */
  usadas?: string[];
  categoriaInicial?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const listaId = useId();
  const [pendiente, startTransition] = useTransition();
  const sugeridas: string[] = CATEGORIAS_DOCUMENTO.map((c) => c.label);
  const chips = [...sugeridas, ...usadas.filter((u) => !sugeridas.includes(u))];
  const [categoria, setCategoria] = useState<string>(categoriaInicial ?? "");
  const [otra, setOtra] = useState(false);
  const [textoOtra, setTextoOtra] = useState("");
  const [error, setError] = useState<string | null>(null);

  const categoriaFinal = otra ? normalizarCategoriaDocumento(textoOtra) : categoria;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!categoriaFinal) {
      setError(otra ? "Escribí la categoría (ej.: Contrato de alquiler)" : "Elegí la categoría del documento");
      return;
    }
    const fd = new FormData(e.currentTarget);
    const archivo = fd.get("archivo");
    if (!String(fd.get("titulo") ?? "").trim()) {
      setError("Poné un título para el documento (ej.: Habilitación 2026).");
      document.getElementById("doc-titulo")?.focus();
      return;
    }
    if (!(archivo instanceof File) || archivo.size === 0) {
      setError("Elegí el archivo: tocá “Archivo” y sacá una foto o elegí un PDF.");
      document.getElementById("doc-archivo")?.focus();
      return;
    }
    fd.set("clienteId", clienteId);
    fd.set("categoria", categoriaFinal);
    setError(null);
    startTransition(async () => {
      // Las fotos se achican (~400 KB) antes de subir; el total no puede pasar de 4 MB.
      const errorPeso = await prepararAdjuntos(fd, ["archivo"]);
      if (errorPeso) {
        setError(errorPeso);
        return;
      }
      const res = await llamarAccion(() => subirDocumento(fd));
      if (!res.ok) {
        // Lo cargado queda en el formulario. Sin respuesta, que se fije antes de repetir; y si el
        // archivo es pesado, que puede ser eso (el servidor corta pedidos grandes sin avisar).
        setError(
          explicarFalloEnvio(
            res.error,
            fd,
            ["archivo"],
            "Se cortó la conexión y no sabemos si se subió. Revisá internet y fijate en la lista de documentos antes de subirlo de nuevo."
          )
        );
        return;
      }
      toast.success(`Documento guardado en "${res.data.categoria}"`);
      formRef.current?.reset();
      setCategoria("");
      setOtra(false);
      setTextoOtra("");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Subir un documento</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={onSubmit} className="space-y-5" noValidate>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-base font-medium">¿Qué es?</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Categoría del documento">
              {chips.map((c) => {
                const activo = !otra && categoria === c;
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={activo}
                    onClick={() => {
                      setOtra(false);
                      setCategoria(c);
                      setError(null);
                    }}
                    className={cn(
                      "h-11 rounded-full border px-4 text-sm font-medium transition-colors",
                      activo
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:bg-accent"
                    )}
                  >
                    {c}
                  </button>
                );
              })}
              <button
                type="button"
                role="radio"
                aria-checked={otra}
                onClick={() => {
                  setOtra(true);
                  setError(null);
                }}
                className={cn(
                  "inline-flex h-11 items-center gap-1.5 rounded-full border border-dashed px-4 text-sm font-medium transition-colors",
                  otra
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card text-primary hover:bg-accent"
                )}
              >
                <Plus className="size-4" strokeWidth={2.2} />
                Otra categoría
              </button>
            </div>
            {otra ? (
              <div className="space-y-1 pt-1">
                <Input
                  autoFocus
                  value={textoOtra}
                  onChange={(e) => setTextoOtra(e.target.value.slice(0, CATEGORIA_DOCUMENTO_MAX))}
                  list={listaId}
                  placeholder="Ej.: Contrato de alquiler"
                  aria-label="Nombre de la categoría nueva"
                  className="h-12 text-base"
                  autoComplete="off"
                />
                <datalist id={listaId}>
                  {chips.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <p className="text-sm text-muted-foreground">
                  {categoriaFinal
                    ? `Se va a guardar como "${categoriaFinal}" y la próxima vez aparece como opción.`
                    : "La próxima vez aparece como opción."}
                </p>
              </div>
            ) : null}
          </fieldset>

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
                maxLength={200}
              />
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
                className="h-12 pt-2.5 text-base"
                required
                onChange={(e) => {
                  const pesado = errorPesoAdjunto(e.target.files?.[0]);
                  if (pesado) e.target.value = "";
                  setError(pesado);
                }}
              />
              <p className="text-sm text-muted-foreground">
                PDF o foto (JPG, PNG o WEBP). {AYUDA_PESO_ADJUNTO}
              </p>
            </div>
          </div>

          {error ? <AlertaError error={error} titulo="No se pudo subir" /> : null}

          <Button
            type="submit"
            size="lg"
            disabled={pendiente}
            className="h-12 w-full px-5 text-base font-semibold sm:w-auto"
          >
            {pendiente ? <Spinner className="size-5" /> : <Upload className="size-5" />}
            {categoriaFinal ? `Guardar en "${categoriaFinal}"` : "Subir documento"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
