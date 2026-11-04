"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Download, Printer, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/**
 * Lo que puede hacer el socio con un recibo: mandarlo por WhatsApp o guardarlo en el celular,
 * de un toque (es una imagen), o imprimirlo. La imagen se trae al abrir: los celulares solo
 * dejan compartir justo después del toque, sin esperas.
 */
export function AccionesRecibo({ pagoId, numero, volverA }: { pagoId: string; numero: number; volverA: string }) {
  const archivo = useRef<File | null>(null);
  const [puedeCompartir, setPuedeCompartir] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const nombre = `Recibo ${numero} - Mercado San Miguel.png`;

  async function traer(): Promise<File | null> {
    if (archivo.current) return archivo.current;
    const res = await fetch(`/api/recibo-imagen/${pagoId}`);
    if (!res.ok) return null;
    const blob = await res.blob();
    // Si la imagen se cortó a mitad de camino, no se comparte un archivo roto.
    if (blob.size === 0) return null;
    const f = new File([blob], nombre, { type: "image/png" });
    archivo.current = f;
    return f;
  }

  useEffect(() => {
    let vivo = true;
    traer()
      .then((f) => {
        if (vivo) setPuedeCompartir(Boolean(f && navigator.canShare?.({ files: [f] })));
      })
      .catch(() => {
        if (vivo) setPuedeCompartir(typeof navigator.share === "function");
      });
    return () => {
      vivo = false;
    };
    // Una sola vez por recibo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagoId]);

  function descargar(f: File) {
    const url = URL.createObjectURL(f);
    const a = document.createElement("a");
    a.href = url;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    toast.success("Listo: el recibo quedó guardado en tus descargas.");
  }

  async function compartir() {
    if (ocupado) return;
    setOcupado(true);
    try {
      const f = await traer();
      if (!f) {
        toast.error("No pudimos preparar el recibo. Revisá internet y probá de nuevo.");
        return;
      }
      if (navigator.canShare?.({ files: [f] })) {
        await navigator.share({ files: [f], title: `Recibo N° ${numero}` });
      } else {
        descargar(f);
      }
    } catch (e) {
      // Cerrar el menú de compartir no es un error. Otro motivo: se guarda como imagen.
      if ((e as Error)?.name === "AbortError") return;
      if (archivo.current) descargar(archivo.current);
      else toast.error("No pudimos preparar el recibo. Revisá internet y probá de nuevo.");
    } finally {
      setOcupado(false);
    }
  }

  const Icono = puedeCompartir ? Share2 : Download;
  return (
    <div className="no-print mb-6 flex flex-col gap-2.5">
      <Button asChild variant="outline" className="min-h-12 self-start text-base">
        <Link href={volverA}>
          <ArrowLeft className="size-5" />
          Volver
        </Link>
      </Button>
      <Button type="button" size="lg" className="min-h-14 w-full text-lg font-bold" disabled={ocupado} onClick={compartir}>
        {ocupado ? <Spinner className="size-5" /> : <Icono className="size-5" />}
        {puedeCompartir ? "Compartir el recibo" : "Guardar el recibo como imagen"}
      </Button>
      {puedeCompartir ? (
        <p className="-mt-1 text-center text-sm text-muted-foreground">Lo mandás por WhatsApp o lo guardás en el celular.</p>
      ) : null}
      <Button type="button" variant="outline" className="min-h-12 w-full text-base" onClick={() => window.print()}>
        <Printer className="size-5" />
        Imprimir o guardar en PDF
      </Button>
    </div>
  );
}
