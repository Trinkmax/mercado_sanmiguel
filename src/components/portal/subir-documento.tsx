"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Camera, Upload, X } from "lucide-react";
import { subirDocumentoSocio } from "@/lib/actions/portal";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { ACCEPT_ARCHIVOS, CATEGORIAS_DOCUMENTO } from "@/components/portal/constantes";
import { errorPesoAdjunto, explicarFalloEnvio, prepararAdjuntos } from "@/components/comunicaciones/adjuntos";
import { AvisoError } from "@/components/comunicaciones/aviso-error";
import { llamarAccion } from "@/lib/llamar-accion";

/**
 * Subir un papel a la carpeta: qué papel es y la foto, nada más. El título sale solo del tipo
 * de papel (solo «Otro» pide escribirlo). La foto se achica antes de subirla; si algo falla, el
 * cartel rojo dice qué hacer y lo cargado queda en el formulario.
 */
export function SubirDocumento() {
  const [abierto, setAbierto] = useState(false);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [archivo, setArchivo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function cambiar(abrir: boolean) {
    if (pendiente) return;
    setAbierto(abrir);
    if (!abrir) {
      setCategoria(null);
      setArchivo(null);
      setError(null);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente) return;
    setError(null);
    const fd = new FormData(e.currentTarget);
    const cat = CATEGORIAS_DOCUMENTO.find((c) => c.valor === categoria);
    if (!cat) {
      setError("Elegí qué papel es.");
      return;
    }
    const f = fd.get("archivo");
    if (!(f instanceof File) || f.size === 0) {
      setError("Falta la foto: tocá «Sacar una foto o elegir archivo».");
      return;
    }
    const escrito = String(fd.get("titulo") ?? "").trim();
    if (cat.valor === "otro" && !escrito) {
      setError("Contanos qué papel es (por ejemplo: Seguro del puesto).");
      document.getElementById("doc-titulo")?.focus();
      return;
    }
    fd.set("titulo", cat.valor === "otro" ? escrito : `${cat.label} ${new Date().getFullYear()}`);
    fd.set("categoria", cat.valor);
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
            "Se cortó la conexión y no sabemos si se subió. Revisá internet y fijate en «Tus papeles» antes de subirlo de nuevo."
          )
        );
        return;
      }
      toast.success("Listo: tu papel quedó en la carpeta. ¡Gracias!");
      setAbierto(false);
      setCategoria(null);
      setArchivo(null);
    });
  }

  return (
    <>
      <button type="button" className="boton boton-claro w-full" onClick={() => setAbierto(true)}>
        <Upload aria-hidden strokeWidth={2.3} />
        Subir un papel
      </button>
      <Sheet open={abierto} onOpenChange={cambiar}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="portal-hoja-flotante max-h-[92svh] gap-0 overflow-y-auto rounded-t-[1.35rem] border-0 bg-porcelana p-0 text-base text-tinta sm:mx-auto sm:w-[36rem] sm:max-w-full"
        >
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div>
              <SheetTitle className="text-[1.5rem] leading-tight font-extrabold text-tinta [font-family:inherit] [font-stretch:92%]">
                Subir un papel
              </SheetTitle>
              <SheetDescription className="mt-0.5 text-[1.02rem] leading-snug text-tinta-2">
                Le sacás una foto y queda guardado en tu carpeta. Administración lo ve.
              </SheetDescription>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-[1.08rem] font-extrabold">¿Qué papel es?</legend>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIAS_DOCUMENTO.map((c) => (
                  <button
                    key={c.valor}
                    type="button"
                    aria-pressed={categoria === c.valor}
                    onClick={() => {
                      setCategoria(c.valor);
                      setError(null);
                    }}
                    className={cn(
                      "min-h-[3.6rem] rounded-[0.85rem] px-3 py-2 text-[1.02rem] leading-tight font-bold transition-colors",
                      categoria === c.valor
                        ? "bg-esmalte text-porcelana shadow-[inset_0_0_0_0.14rem_var(--esmalte),inset_0_0_0_0.21rem_oklch(1_0_0/0.85)]"
                        : "bg-porcelana-2 text-tinta hover:bg-[oklch(0.91_0.02_265)]"
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </fieldset>

            {categoria === "otro" ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="doc-titulo" className="text-[1.08rem] font-extrabold">
                  ¿Cómo se llama?
                </label>
                <input
                  id="doc-titulo"
                  name="titulo"
                  maxLength={200}
                  placeholder="Por ejemplo: Seguro del puesto"
                  className="campo-portal"
                />
              </div>
            ) : null}

            <div className="flex items-stretch gap-2">
              <label htmlFor="doc-archivo" className="boton boton-suave min-w-0 flex-1 cursor-pointer !text-[1.02rem]">
                <Camera aria-hidden strokeWidth={2.2} />
                <span className="truncate">{archivo ?? "Sacar una foto o elegir archivo"}</span>
              </label>
              {archivo ? (
                <button
                  type="button"
                  aria-label="Quitar el archivo"
                  className="boton boton-suave !px-3"
                  onClick={() => {
                    const el = document.getElementById("doc-archivo") as HTMLInputElement | null;
                    if (el) el.value = "";
                    setArchivo(null);
                  }}
                >
                  <X aria-hidden strokeWidth={2.4} />
                </button>
              ) : null}
              <input
                id="doc-archivo"
                name="archivo"
                type="file"
                accept={ACCEPT_ARCHIVOS}
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  const pesado = errorPesoAdjunto(f);
                  if (pesado) {
                    e.target.value = "";
                    setArchivo(null);
                    setError(pesado);
                    return;
                  }
                  setError(null);
                  setArchivo(f?.name ?? null);
                }}
              />
            </div>

            {error ? <AvisoError mensaje={error} /> : null}

            <button type="submit" disabled={pendiente} className="boton boton-primario w-full">
              {pendiente ? <Spinner className="size-5" /> : <Upload aria-hidden strokeWidth={2.3} />}
              Subir
            </button>
            <button type="button" disabled={pendiente} className="boton boton-suave w-full" onClick={() => cambiar(false)}>
              Cancelar
            </button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
