"use client";

import { useState, useTransition } from "react";
import { DoorOpen, Printer, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  guardarConfiguracionGeneral,
  guardarPreciosPorteria,
} from "@/lib/actions/configuracion";
import { formatARS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Money } from "@/components/shared/money";

function soloDigitos(valor: string): string {
  return valor.replace(/\D+/g, "");
}

export type PreciosPorteria = {
  camion: number;
  ambulante: number;
  quintero: number;
};

/**
 * Pestaña General: vencimiento del mes, precios del cobro por día en portería
 * (solo los edita el Líder de Procesos) e impresión directa de recibos.
 */
export function FormGeneral({
  diaVencimiento,
  preciosPorteria,
  impresionDirecta,
  esLider,
}: {
  diaVencimiento: number;
  preciosPorteria: PreciosPorteria;
  impresionDirecta: boolean;
  esLider: boolean;
}) {
  return (
    <div className="max-w-2xl space-y-6">
      <CardVencimiento diaVencimiento={diaVencimiento} />
      <CardPorteria precios={preciosPorteria} esLider={esLider} />
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
      const res = await guardarConfiguracionGeneral({ dia_vencimiento: diaNum });
      if (!res.ok) toast.error(res.error);
      else toast.success(`Listo: los cargos del mes vencen el día ${diaNum}.`);
    });
  }

  return (
    <Card>
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

/* ---------- Cobro por día en portería ---------- */

const CAMPOS_PORTERIA: {
  clave: keyof PreciosPorteria;
  label: string;
  ayuda: string;
}[] = [
  { clave: "camion", label: "Canon por camión", ayuda: "por camión que entra" },
  { clave: "ambulante", label: "Canon por ambulante", ayuda: "por ambulante, por día" },
  { clave: "quintero", label: "Canon por quintero (por día)", ayuda: "por quintero, por día" },
];

function CardPorteria({
  precios,
  esLider,
}: {
  precios: PreciosPorteria;
  esLider: boolean;
}) {
  const [valores, setValores] = useState<Record<keyof PreciosPorteria, string>>({
    camion: String(Math.round(precios.camion)),
    ambulante: String(Math.round(precios.ambulante)),
    quintero: String(Math.round(precios.quintero)),
  });
  const [guardando, startGuardar] = useTransition();

  const sinCambios =
    Number(valores.camion || 0) === Math.round(precios.camion) &&
    Number(valores.ambulante || 0) === Math.round(precios.ambulante) &&
    Number(valores.quintero || 0) === Math.round(precios.quintero);

  function guardar() {
    startGuardar(async () => {
      const res = await guardarPreciosPorteria({
        precio_canon_camion: Number(valores.camion || 0),
        precio_canon_ambulante: Number(valores.ambulante || 0),
        precio_canon_quintero_dia: Number(valores.quintero || 0),
      });
      if (!res.ok) toast.error(res.error);
      else toast.success("Precios de portería guardados. Rigen desde el próximo cobro.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <DoorOpen className="size-5 text-muted-foreground" strokeWidth={2} />
          Cobro por día en portería
        </CardTitle>
        <CardDescription className="text-sm">
          Lo cobra el Jefe de Portería en la garita: camiones que entran,
          ambulantes y quinteros que pagan por día.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {esLider ? (
          <>
            {CAMPOS_PORTERIA.map((campo) => (
              <div key={campo.clave} className="space-y-2">
                <Label htmlFor={`precio-${campo.clave}`} className="text-sm">
                  {campo.label}
                </Label>
                <Input
                  id={`precio-${campo.clave}`}
                  inputMode="numeric"
                  autoComplete="off"
                  className="h-12 text-base md:text-base"
                  value={valores[campo.clave]}
                  onChange={(e) =>
                    setValores((prev) => ({
                      ...prev,
                      [campo.clave]: soloDigitos(e.target.value),
                    }))
                  }
                />
                <p className="text-sm text-muted-foreground tabular">
                  {formatARS(Number(valores[campo.clave] || 0))} {campo.ayuda}.
                </p>
              </div>
            ))}
            <Button
              size="lg"
              className="h-12 w-full text-base font-semibold sm:w-auto sm:px-8"
              disabled={guardando || sinCambios}
              onClick={guardar}
            >
              {guardando ? "Guardando…" : "Guardar precios de portería"}
            </Button>
          </>
        ) : (
          <dl className="divide-y rounded-lg border">
            {CAMPOS_PORTERIA.map((campo) => (
              <div
                key={campo.clave}
                className="flex items-baseline justify-between gap-4 px-4 py-3"
              >
                <dt className="text-sm">{campo.label}</dt>
                <dd>
                  <Money monto={precios[campo.clave]} className="text-base font-semibold" />
                </dd>
              </div>
            ))}
          </dl>
        )}
        {esLider ? null : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="size-4" strokeWidth={2} />
            Lo configura el Líder de Procesos. Acá lo ves para consulta.
          </p>
        )}
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
      const res = await guardarConfiguracionGeneral({ impresion_directa: valor });
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Printer className="size-5 text-muted-foreground" strokeWidth={2} />
          Impresión directa
        </CardTitle>
        <CardDescription className="text-sm">
          Para que el recibo salga de la impresora del mostrador sin tocar nada más.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <label
          htmlFor="impresion-directa"
          className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-lg border px-4 py-3"
        >
          <span className="text-sm font-medium">
            Al emitir un recibo u otro documento, abrir el diálogo de impresión automáticamente
          </span>
          <Switch
            id="impresion-directa"
            checked={activa}
            disabled={guardando}
            onCheckedChange={cambiar}
            aria-label="Impresión directa"
          />
        </label>

        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">
            Para que salga directo, sin diálogo (recomendado en la tablet o PC de
            administración):
          </p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              Dejá como impresora predeterminada la del mostrador.
            </li>
            <li>
              Creá un acceso directo de Chrome con la opción{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                --kiosk-printing
              </code>{" "}
              y entrá al sistema desde ahí.
              <ul className="mt-1.5 space-y-1 pl-4">
                <li>
                  Windows:{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                    chrome.exe --kiosk-printing
                  </code>
                </li>
                <li>
                  macOS:{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                    open -a &quot;Google Chrome&quot; --args --kiosk-printing
                  </code>
                </li>
              </ul>
            </li>
          </ol>
          <p>
            Así el recibo va derecho a la impresora apenas se emite. Si abrís el
            sistema desde un Chrome común, igual se abre el diálogo de impresión
            solo y alcanza con tocar &quot;Imprimir&quot;.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
