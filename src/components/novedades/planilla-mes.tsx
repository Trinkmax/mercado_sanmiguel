"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, DoorOpen, IdCard, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Sello } from "@/components/shared/sello";
import {
  LABEL_SECTOR,
  nombreCompleto,
  type SectorPersonal,
} from "@/components/personal/constantes";
import { BarraHoras } from "./barra-horas";
import { Contadores, type ContadoresMes } from "./contadores";
import { FilaNovedad } from "./fila-novedad";
import { nombrePila, type NovedadVista } from "./constantes";

export type FilaPlanilla = ContadoresMes & {
  empleado_id: string;
  apellido: string;
  nombre: string;
  sector: SectorPersonal;
  activo: boolean;
  horas_semanales: number | null;
  horas_esperadas: number;
  horas_registradas: number;
  ingresos: number;
  ingresos_sin_salida: number;
  pendientes: number;
  novedades: NovedadVista[];
};

/**
 * Planilla del mes: una fila por empleado con "Registró X h de Y h", avisos y contadores.
 * Al tocar la fila se despliegan sus novedades con sus acciones y "Cargar novedad para …".
 */
export function PlanillaMes({
  filas,
  puedeRevisar,
  miUserId,
  hastaHoy,
  esLider,
  agrupar,
}: {
  filas: FilaPlanilla[];
  puedeRevisar: boolean;
  miUserId: string;
  hastaHoy: boolean;
  esLider: boolean;
  /** Con varios sectores a la vista, un subtítulo por sector. */
  agrupar: boolean;
}) {
  const grupos: { sector: SectorPersonal; filas: FilaPlanilla[] }[] = [];
  for (const f of filas) {
    const g = grupos.find((x) => x.sector === f.sector);
    if (g) g.filas.push(f);
    else grupos.push({ sector: f.sector, filas: [f] });
  }

  return (
    <div className="space-y-6">
      {grupos.map((g) => (
        <section key={g.sector} className="space-y-2" aria-label={LABEL_SECTOR[g.sector]}>
          {agrupar ? (
            <h2 className="px-1 font-display text-base font-bold tracking-tight text-foreground/80">
              {LABEL_SECTOR[g.sector]}{" "}
              <span className="font-sans text-sm font-normal text-muted-foreground tabular">({g.filas.length})</span>
            </h2>
          ) : null}
          <div className="divide-y overflow-hidden rounded-xl border bg-card">
            {g.filas.map((f) => (
              <FilaEmpleado
                key={f.empleado_id}
                f={f}
                puedeRevisar={puedeRevisar}
                miUserId={miUserId}
                hastaHoy={hastaHoy}
                esLider={esLider}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function FilaEmpleado({
  f,
  puedeRevisar,
  miUserId,
  hastaHoy,
  esLider,
}: {
  f: FilaPlanilla;
  puedeRevisar: boolean;
  miUserId: string;
  hastaHoy: boolean;
  esLider: boolean;
}) {
  const [abierta, setAbierta] = useState(false);
  const nombre = nombrePila(f);

  return (
    <Collapsible open={abierta} onOpenChange={setAbierta}>
      <div className={cn("relative px-4 py-4 transition-colors hover:bg-accent/40", abierta && "bg-accent/30")}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className={cn("text-base font-semibold", !f.activo && "text-muted-foreground")}>
                {nombreCompleto(f)}
              </p>
              <span className="inline-flex items-center rounded-full border bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground/80">
                {LABEL_SECTOR[f.sector]}
              </span>
              {!f.activo ? <Sello estado="inactivo" texto="De baja" /> : null}
              {f.pendientes > 0 ? (
                <Sello
                  estado="pendiente_aprobacion"
                  texto={f.pendientes === 1 ? "1 esperando OK" : `${f.pendientes} esperando OK`}
                />
              ) : null}
            </div>
            <BarraHoras
              registradas={Number(f.horas_registradas)}
              esperadas={Number(f.horas_esperadas)}
              horasSemanales={f.horas_semanales === null ? null : Number(f.horas_semanales)}
              hastaHoy={hastaHoy}
              className="max-w-xl"
            />
            {f.ingresos_sin_salida > 0 ? (
              <p className="flex items-center gap-1.5 text-sm font-medium text-parcial">
                <DoorOpen className="size-4 shrink-0" strokeWidth={2} />
                {f.ingresos_sin_salida === 1
                  ? "1 ingreso sin salida marcada (esas horas no suman)"
                  : `${f.ingresos_sin_salida} ingresos sin salida marcada (esas horas no suman)`}
              </p>
            ) : null}
            <Contadores contadores={f} />
          </div>
          <span className="mt-1 flex items-center gap-1 text-sm font-medium text-muted-foreground">
            <span className="max-sm:hidden">{f.novedades.length > 0 ? `${f.novedades.length} en el mes` : "Detalle"}</span>
            <ChevronDown className={cn("size-5 transition-transform", abierta && "rotate-180")} strokeWidth={2} />
          </span>
        </div>
        {/* Toda la fila se toca para abrir (la tablet no tiene "hover"). */}
        <CollapsibleTrigger
          className="absolute inset-0 rounded-none focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-ring"
          aria-label={abierta ? `Cerrar el detalle de ${nombre}` : `Ver las novedades de ${nombre}`}
        />
      </div>

      <CollapsibleContent>
        <div className="border-t bg-muted/30 px-4 pb-4">
          {f.novedades.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No hay novedades cargadas para {nombre} en este mes.</p>
          ) : (
            <div className="divide-y">
              {f.novedades.map((n) => (
                <FilaNovedad key={`${n.id}-${n.estado}`} n={n} puedeRevisar={puedeRevisar} miUserId={miUserId} />
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild variant="outline" size="lg" className="h-12 px-4 text-base">
              <Link href={`/novedades/nueva?empleado=${f.empleado_id}`}>
                <Plus className="size-5" strokeWidth={2.2} />
                Cargar novedad para {f.nombre}
              </Link>
            </Button>
            {esLider ? (
              <Button asChild variant="ghost" className="h-12 px-4">
                <Link href={`/personal/${f.empleado_id}`}>
                  <IdCard className="size-4" strokeWidth={2} />
                  Ver ficha
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
