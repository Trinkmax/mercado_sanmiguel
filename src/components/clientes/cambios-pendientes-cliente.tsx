import Link from "next/link";
import { ClipboardClock } from "lucide-react";
import { formatFechaHora } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sello } from "@/components/shared/sello";
import { cn } from "@/lib/utils";

export type CambioDeCliente = {
  id: string;
  resumen: string;
  estado: "pendiente" | "aprobado" | "rechazado";
  solicitadoPor: string;
  solicitadoEn: string;
  revisadoPor?: string | null;
  revisadoEn?: string | null;
  motivoRechazo?: string | null;
};

/**
 * Bloque de la ficha: cambios de este cliente que esperan la aprobación del
 * Líder de Procesos, y los rechazados hace poco (con su motivo) para que
 * quien los pidió sepa qué pasó.
 */
export function CambiosPendientesCliente({
  pendientes,
  rechazados,
  esLider,
  className,
}: {
  pendientes: CambioDeCliente[];
  rechazados: CambioDeCliente[];
  esLider: boolean;
  className?: string;
}) {
  if (pendientes.length === 0 && rechazados.length === 0) return null;

  return (
    <Card className={cn("text-base", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ClipboardClock className="size-5 text-muted-foreground" strokeWidth={1.9} />
          {pendientes.length > 0
            ? "Cambios esperando aprobación"
            : "Cambios revisados hace poco"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {pendientes.length > 0 ? (
          <div className="divide-y">
            {pendientes.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.resumen}</p>
                  <p className="text-sm text-muted-foreground">
                    Pidió {c.solicitadoPor} · {formatFechaHora(c.solicitadoEn)}
                  </p>
                </div>
                <Sello estado="pendiente_aprobacion" />
              </div>
            ))}
          </div>
        ) : null}

        {pendientes.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {esLider ? (
              <>
                Los aprobás o rechazás desde{" "}
                <Link
                  href="/aprobaciones"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  Aprobaciones
                </Link>
                .
              </>
            ) : (
              "Hasta que el Líder de Procesos los apruebe, la carpeta sigue como está."
            )}
          </p>
        ) : null}

        {rechazados.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Rechazados hace poco
            </p>
            <div className="divide-y rounded-lg border">
              {rechazados.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-wrap items-start gap-x-4 gap-y-1 px-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{c.resumen}</p>
                    {c.motivoRechazo ? (
                      <p className="text-sm text-pendiente">
                        Motivo: {c.motivoRechazo}
                      </p>
                    ) : null}
                    <p className="text-sm text-muted-foreground">
                      Pidió {c.solicitadoPor} · {formatFechaHora(c.solicitadoEn)}
                      {c.revisadoEn
                        ? ` · Rechazó ${c.revisadoPor ?? "el Líder de Procesos"} el ${formatFechaHora(c.revisadoEn)}`
                        : ""}
                    </p>
                  </div>
                  <Sello estado="rechazada" texto="Rechazado" />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
