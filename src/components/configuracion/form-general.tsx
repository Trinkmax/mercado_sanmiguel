"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Printer, Wrench } from "lucide-react";
import { toast } from "sonner";
import { guardarConfiguracionGeneral } from "@/lib/actions/configuracion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { llamarAccion } from "@/lib/llamar-accion";

function soloDigitos(valor: string): string {
  return valor.replace(/\D+/g, "");
}

/**
 * Pestaña General: vencimiento del mes e impresión directa de recibos.
 * (El canon de transporte va en "Tarifas de transporte"; el ambulante y la
 * quinta, en "Quintas y ambulantes".)
 */
export function FormGeneral({
  diaVencimiento,
  impresionDirecta,
}: {
  diaVencimiento: number;
  impresionDirecta: boolean;
}) {
  return (
    <div className="max-w-2xl space-y-6">
      <CardVencimiento diaVencimiento={diaVencimiento} />
      <CardImpresionDirecta impresionDirecta={impresionDirecta} />
    </div>
  );
}

/* ---------- Vencimiento ---------- */

function CardVencimiento({ diaVencimiento }: { diaVencimiento: number }) {
  const [dia, setDia] = useState(String(diaVencimiento));
  const [errorDia, setErrorDia] = useState<string | null>(null);
  const [guardando, startGuardar] = useTransition();

  function guardar() {
    const diaNum = Number(dia || 0);
    if (diaNum < 1 || diaNum > 31) {
      setErrorDia("El día va de 1 a 31.");
      return;
    }
    setErrorDia(null);
    startGuardar(async () => {
      const res = await llamarAccion(() => guardarConfiguracionGeneral({ dia_vencimiento: diaNum }));
      if (!res.ok) toast.error(res.error);
      else toast.success(`Listo: los cargos del mes vencen el día ${diaNum}.`);
    });
  }

  return (
    <Card data-tour="config-vencimiento">
      <CardHeader>
        <CardTitle className="text-lg">Vencimiento</CardTitle>
        <CardDescription className="text-sm">
          Hasta ese día del mes los cargos se pagan con el beneficio por pago
          en término. Después, se debe el importe completo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="dia-vencimiento" className="text-sm">
            Día de vencimiento del mes
          </Label>
          <Input
            id="dia-vencimiento"
            inputMode="numeric"
            autoComplete="off"
            className="h-12 w-24 text-base md:text-base"
            value={dia}
            onChange={(e) => setDia(soloDigitos(e.target.value).slice(0, 2))}
            aria-invalid={errorDia ? true : undefined}
          />
          {errorDia ? (
            <p className="text-sm font-medium text-destructive">{errorDia}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              De 1 a 31. Si el mes es más corto, vence el último día.
            </p>
          )}
        </div>

        <Button
          size="lg"
          className="h-12 w-full text-base font-semibold sm:w-auto sm:px-8"
          disabled={guardando || !dia || Number(dia) === diaVencimiento}
          onClick={guardar}
        >
          {guardando ? "Guardando…" : "Guardar vencimiento"}
        </Button>
      </CardContent>
    </Card>
  );
}

/* ---------- Impresión directa ---------- */

function CardImpresionDirecta({ impresionDirecta }: { impresionDirecta: boolean }) {
  const [activa, setActiva] = useState(impresionDirecta);
  const [guardando, startGuardar] = useTransition();

  function cambiar(valor: boolean) {
    const anterior = activa;
    setActiva(valor);
    startGuardar(async () => {
      const res = await llamarAccion(() => guardarConfiguracionGeneral({ impresion_directa: valor }));
      if (!res.ok) {
        setActiva(anterior);
        toast.error(res.error);
        return;
      }
      toast.success(
        valor
          ? "Impresión directa activada: los recibos abren el diálogo de impresión solos."
          : "Impresión directa desactivada."
      );
    });
  }

  return (
    <Card data-tour="config-impresion">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Printer className="size-5 text-muted-foreground" strokeWidth={2} />
          Impresión directa
        </CardTitle>
        <CardDescription className="text-sm">
          Para imprimir el recibo apenas se emite, sin buscar el botón.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <label
          htmlFor="impresion-directa"
          className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-lg border px-4 py-3"
        >
          <span className="text-sm font-medium">
            Al emitir un recibo, abrir el cartel para imprimir automáticamente
          </span>
          <Switch
            id="impresion-directa"
            checked={activa}
            disabled={guardando}
            onCheckedChange={cambiar}
            aria-label="Impresión directa"
          />
        </label>

        {/* Lo técnico (atajos de Chrome) queda plegado, para quien instala las computadoras:
            a la vista confundía a quien usa el sistema. */}
        <p className="text-sm text-muted-foreground">
          Con esto prendido, al emitir un recibo aparece el cartel de impresión y alcanza con tocar
          &quot;Imprimir&quot;. Si querés que salga directo, sin ese cartel, pedíselo a quien les
          instala las computadoras.
        </p>
        <Collapsible>
          <CollapsibleTrigger className="group inline-flex min-h-11 items-center gap-2 rounded-md px-1 text-sm font-medium text-primary hover:underline">
            <Wrench className="size-4" strokeWidth={2} />
            Instrucciones para el técnico
            <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" strokeWidth={2} />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2 rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              Para que el recibo salga directo, sin cartel (en la tablet o PC de administración):
            </p>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Dejar como impresora predeterminada la del mostrador.</li>
              <li>
                Crear un acceso directo de Chrome con la opción{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 break-all text-foreground">--kiosk-printing</code> y
                entrar al sistema desde ahí.
                <ul className="mt-1.5 space-y-1 pl-4">
                  <li>
                    Windows:{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 break-all text-foreground">
                      chrome.exe --kiosk-printing
                    </code>
                  </li>
                  <li>
                    macOS:{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 break-all text-foreground">
                      open -a &quot;Google Chrome&quot; --args --kiosk-printing
                    </code>
                  </li>
                </ul>
              </li>
            </ol>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
