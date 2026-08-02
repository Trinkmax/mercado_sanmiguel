"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { guardarConfiguracionGeneral } from "@/lib/actions/configuracion";
import { formatARS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function soloDigitos(valor: string): string {
  return valor.replace(/\D+/g, "");
}

export function FormGeneral({
  diaVencimiento,
  precioCanonCamion,
}: {
  diaVencimiento: number;
  precioCanonCamion: number;
}) {
  const [dia, setDia] = useState(String(diaVencimiento));
  const [canon, setCanon] = useState(String(Math.round(precioCanonCamion)));
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
      const res = await guardarConfiguracionGeneral({
        dia_vencimiento: diaNum,
        precio_canon_camion: Number(canon || 0),
      });
      if (!res.ok) toast.error(res.error);
      else toast.success("Configuración guardada.");
    });
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-lg">Vencimiento y canon</CardTitle>
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
              Los cargos del mes vencen ese día (1 a 31). Hasta esa fecha vale
              el descuento por pago en término.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="precio-canon" className="text-sm">
            Precio del canon por camión
          </Label>
          <Input
            id="precio-canon"
            inputMode="numeric"
            autoComplete="off"
            className="h-12 text-base md:text-base"
            value={canon}
            onChange={(e) => setCanon(soloDigitos(e.target.value))}
          />
          <p className="text-sm text-muted-foreground tabular">
            {formatARS(Number(canon || 0))} por camión. Lo cobra el guardia en
            portería.
          </p>
        </div>

        <Button
          size="lg"
          className="h-12 w-full text-base font-semibold sm:w-auto sm:px-8"
          disabled={guardando || !dia || !canon}
          onClick={guardar}
        >
          {guardando ? "Guardando…" : "Guardar cambios"}
        </Button>
      </CardContent>
    </Card>
  );
}
