import { DoorOpen, History } from "lucide-react";
import { formatFechaHora } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Sello } from "@/components/shared/sello";
import { EmptyState } from "@/components/shared/empty-state";
import { BotonSalida } from "@/components/porteria/boton-salida";
import { SalidaConHora } from "@/components/porteria/salida-con-hora";
import { horaAR } from "@/components/porteria/fechas";

export type IngresoFila = {
  id: string;
  dni: string;
  nombre: string;
  apellido: string;
  ingreso_en: string;
  egreso_en: string | null;
  fuera_de_horario: boolean;
  firma_path: string;
  empleado_id: string | null;
  cargo: string | null;
};

/**
 * Ingresos del personal de un día (extraído de /porteria) + "Quedaron adentro de días
 * anteriores": sin su salida, las horas de Novedades (H4) quedan abiertas.
 * Portería marca salidas (ahora u otra hora); una salida ya marcada la corrige solo el Líder.
 */
export function IngresosDelDia({
  ingresos,
  anteriores,
  firmas,
  esHoy,
  puedeCorregir,
}: {
  ingresos: IngresoFila[];
  /** Sin salida, de días anteriores (solo se muestran mirando hoy). */
  anteriores: IngresoFila[];
  /** firma_path → URL firmada. */
  firmas: Record<string, string>;
  esHoy: boolean;
  /** El Líder corrige salidas ya marcadas. */
  puedeCorregir: boolean;
}) {
  return (
    <div className="space-y-6">
      {esHoy && anteriores.length > 0 ? (
        <section className="space-y-3 rounded-lg border border-parcial bg-parcial-suave/60 p-4" data-tour="porteria-quedaron">
          <div className="space-y-0.5">
            <h3 className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
              <History className="size-5 text-parcial" strokeWidth={2} />
              Quedaron adentro de días anteriores ({anteriores.length})
            </h3>
            <p className="text-sm text-muted-foreground">
              Marcá a qué hora salieron: si no, esas horas quedan abiertas en la planilla de Novedades.
            </p>
          </div>
          <Card className="gap-0 divide-y overflow-hidden py-0 text-base">
            {anteriores.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1 basis-48">
                  <p className="truncate font-semibold">
                    {i.apellido}, {i.nombre}
                  </p>
                  <p className="truncate text-sm text-muted-foreground tabular">
                    Entró el {formatFechaHora(i.ingreso_en)} · DNI {i.dni}
                  </p>
                </div>
                <SalidaConHora
                  ingresoId={i.id}
                  nombre={`${i.apellido}, ${i.nombre}`}
                  ingresoEn={i.ingreso_en}
                  modo="otro_dia"
                />
              </div>
            ))}
          </Card>
        </section>
      ) : null}

      {ingresos.length === 0 ? (
        <EmptyState
          icono={DoorOpen}
          titulo={esHoy ? "Todavía no entró nadie hoy" : "No hubo ingresos ese día"}
          descripcion={
            esHoy
              ? "El primer ingreso del día se registra con DNI y firma, en el bloque de al lado."
              : "Probá con otra fecha."
          }
        />
      ) : (
        <Card className="gap-0 divide-y overflow-hidden py-0 text-base">
          {ingresos.map((i) => {
            const url = firmas[i.firma_path];
            const salio = Boolean(i.egreso_en);
            const nombre = `${i.apellido}, ${i.nombre}`;
            return (
              <div key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3" data-tour="porteria-ingreso">
                <p className="w-14 shrink-0 font-display text-lg font-bold tabular">{horaAR(i.ingreso_en)}</p>
                {url ? (
                  // URL privada firmada: no pasa por el optimizador de imágenes.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={`Firma de ${nombre}`}
                    className="h-12 w-24 shrink-0 rounded-md border bg-white object-contain"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-12 w-24 shrink-0 rounded-md border bg-muted" aria-hidden />
                )}
                <div className="min-w-0 flex-1 basis-40">
                  <p className="truncate font-semibold">{nombre}</p>
                  <p className="truncate text-sm text-muted-foreground tabular">
                    DNI {i.dni}
                    {i.cargo ? ` · ${i.cargo}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {i.empleado_id ? (
                    <Sello estado={i.fuera_de_horario ? "fuera_horario" : "en_horario"} />
                  ) : (
                    <Sello estado="parcial" texto="Fuera del padrón" />
                  )}
                  {salio ? (
                    <Sello estado="salio" texto={`Salió ${horaAR(i.egreso_en)}`} />
                  ) : (
                    <Sello estado="adentro" />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {!salio && esHoy ? (
                    <>
                      <BotonSalida ingresoId={i.id} nombre={nombre} />
                      <SalidaConHora ingresoId={i.id} nombre={nombre} ingresoEn={i.ingreso_en} modo="hoy" />
                    </>
                  ) : null}
                  {!salio && !esHoy ? (
                    <SalidaConHora ingresoId={i.id} nombre={nombre} ingresoEn={i.ingreso_en} modo="otro_dia" />
                  ) : null}
                  {salio && puedeCorregir ? (
                    <SalidaConHora
                      ingresoId={i.id}
                      nombre={nombre}
                      ingresoEn={i.ingreso_en}
                      egresoEn={i.egreso_en}
                      modo="corregir"
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
