"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, FilePlus2 } from "lucide-react";
import { publicarTerminos } from "@/lib/actions/terminos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

/**
 * Publicar nueva versión de los términos (solo Líder de Procesos). Es una
 * sección inline: un botón grande la abre; nada de modales para escribir
 * un texto largo.
 */
export function PublicarTerminos({
  tituloActual,
  contenidoActual,
  versionActual,
}: {
  tituloActual: string;
  contenidoActual: string;
  versionActual: number;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [titulo, setTitulo] = useState(tituloActual);
  const [contenido, setContenido] = useState(contenidoActual);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await publicarTerminos({ titulo, contenido });
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success(`Versión ${res.data.version} publicada`);
      setAbierto(false);
      router.refresh();
    });
  }

  if (!abierto) {
    return (
      <Button
        size="lg"
        className="h-12 w-full text-base font-semibold sm:w-auto sm:px-6"
        onClick={() => {
          setTitulo(tituloActual);
          setContenido(contenidoActual);
          setAbierto(true);
        }}
      >
        <FilePlus2 className="size-5" strokeWidth={2} />
        Publicar nueva versión
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Nueva versión{versionActual > 0 ? ` (v${versionActual + 1})` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="terminos-titulo" className="text-base">
              Título
            </Label>
            <Input
              id="terminos-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              maxLength={200}
              className="h-12 text-base md:text-base"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="terminos-contenido" className="text-base">
              Texto completo
            </Label>
            <Textarea
              id="terminos-contenido"
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              required
              rows={16}
              className="min-h-80 text-base leading-relaxed md:text-base"
              placeholder="Escribí acá el texto completo. Podés separar en puntos numerados."
            />
            <p className="text-sm text-muted-foreground">
              Arranca con el texto de la versión vigente para que lo edites.
            </p>
          </div>

          <p className="flex items-start gap-2.5 rounded-md border border-parcial/50 bg-parcial-suave px-4 py-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-parcial" strokeWidth={2} />
            <span>
              <strong>Al publicar, cada socio tendrá que aceptarla la próxima vez
              que entre al portal.</strong>{" "}
              Hasta que no acepte, no ve su cuenta.
            </span>
          </p>

          {error ? (
            <p className="rounded-md bg-pendiente-suave px-4 py-3 text-sm font-medium text-pendiente">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              size="lg"
              disabled={pendiente}
              className="h-12 px-6 text-base font-semibold"
            >
              {pendiente ? <Spinner className="size-5" /> : null}
              Publicar versión nueva
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12"
              disabled={pendiente}
              onClick={() => setAbierto(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
