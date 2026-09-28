"use client";

import { Check, Copy, Printer, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { formatDni } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Sello } from "@/components/shared/sello";

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Tarjeta que cierra toda alta o cambio de contraseña: con qué DNI y qué
 * contraseña entra la persona. Se imprime en una ventana aparte (la contraseña
 * nunca va en una URL) o se copia. No se puede volver a ver: se avisa.
 */
export function Credencial({
  nombre,
  dni,
  password,
  titulo,
  onListo,
  textoListo = "Listo",
}: {
  nombre: string;
  dni: string | null;
  password: string;
  /** "Usuario creado" · "Contraseña nueva" · "Acceso al portal". */
  titulo: string;
  onListo: () => void;
  textoListo?: string;
}) {
  const dniTexto = dni ? formatDni(dni) : "—";

  function imprimir() {
    const url = window.location.origin;
    const ventana = window.open("", "_blank", "width=520,height=640");
    if (!ventana) {
      toast.error("El navegador bloqueó la ventana de impresión. Copiala y anotala a mano.");
      return;
    }
    ventana.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Acceso de ${escaparHtml(nombre)}</title>
<style>
  body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;margin:32px;color:#111}
  .marco{border:2px solid #111;border-radius:12px;padding:6px}
  .interior{border:1px solid #111;border-radius:8px;padding:24px 28px}
  h1{font-size:18px;margin:0 0 4px}
  p{margin:0;font-size:14px;color:#444}
  dl{margin:22px 0 0}
  dt{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#555;margin-top:16px}
  dd{margin:4px 0 0;font-size:30px;font-weight:700;letter-spacing:.02em;font-variant-numeric:tabular-nums}
  .pie{margin-top:24px;font-size:13px;color:#444}
</style></head><body>
<div class="marco"><div class="interior">
  <h1>Mercado San Miguel · Cooperativa Frutihortícola</h1>
  <p>Acceso al sistema de ${escaparHtml(nombre)}</p>
  <dl><dt>Entrá con tu DNI</dt><dd>${escaparHtml(dniTexto)}</dd>
  <dt>Contraseña</dt><dd>${escaparHtml(password)}</dd></dl>
  <p class="pie">En ${escaparHtml(url)}. Guardá este papel: la contraseña no se puede volver a ver.
  Si la perdés, pedí una nueva.</p>
</div></div>
<script>window.onload=function(){window.print();}</script>
</body></html>`);
    ventana.document.close();
    ventana.focus();
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(`DNI ${dniTexto} · Contraseña ${password}`);
      toast.success("Copiado: pegalo en un mensaje para mandárselo.");
    } catch {
      toast.error("No se pudo copiar. Anotala a mano.");
    }
  }

  return (
    <div className="animate-in fade-in zoom-in-95 space-y-4 rounded-xl border-2 border-pagado/40 bg-pagado-suave/40 p-4 duration-200 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-lg font-bold">{titulo}</p>
          <p className="text-sm text-muted-foreground">{nombre}</p>
        </div>
        <Sello estado="activo" texto="Listo para entrar" grande className="animar-estampado" />
      </div>

      <dl className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">Entra con su DNI</dt>
          <dd className="font-display text-2xl font-bold tracking-wide tabular">{dniTexto}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Contraseña</dt>
          <dd className="font-display text-2xl font-bold tracking-wide break-all select-all">
            {password}
          </dd>
        </div>
      </dl>

      <p className="flex items-start gap-2 text-sm font-medium text-foreground">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-parcial" strokeWidth={2.2} />
        Anotala ahora: después no se puede volver a ver.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button size="lg" className="h-12 flex-1 px-5 text-base font-semibold sm:flex-none" onClick={imprimir}>
          <Printer className="size-5" strokeWidth={2} />
          Imprimir
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-12 flex-1 px-5 text-base sm:flex-none"
          onClick={copiar}
        >
          <Copy className="size-5" strokeWidth={2} />
          Copiar
        </Button>
        <Button
          size="lg"
          variant="ghost"
          className="h-12 flex-1 px-5 text-base sm:ml-auto sm:flex-none"
          onClick={onListo}
        >
          <Check className="size-5" strokeWidth={2} />
          {textoListo}
        </Button>
      </div>
    </div>
  );
}
