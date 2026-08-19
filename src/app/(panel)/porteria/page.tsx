import Link from "next/link";
import { DoorOpen, FilePlus2, MessagesSquare, Wallet } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatFecha, formatFechaLarga, hoyISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Sello } from "@/components/shared/sello";
import { EmptyState } from "@/components/shared/empty-state";
import { BotonExportar } from "@/components/shared/boton-exportar";
import { RegistroIngreso } from "@/components/porteria/registro-ingreso";
import { BotonSalida } from "@/components/porteria/boton-salida";
import { SelectorFecha } from "@/components/porteria/selector-fecha";
import { esFechaISO, horaAR, rangoDiaAR } from "@/components/porteria/fechas";

export const metadata = { title: "Portería" };

type Props = { searchParams: Promise<{ fecha?: string }> };

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export default async function PorteriaPage({ searchParams }: Props) {
  const perfil = await requireRol("porteria", "guardia", "admin", "lider");
  const { fecha: fechaParam } = await searchParams;
  const hoy = hoyISO();
  const puedeElegirFecha = perfil.rol === "lider" || perfil.rol === "admin";
  const fecha = puedeElegirFecha && esFechaISO(fechaParam) && fechaParam <= hoy ? fechaParam : hoy;
  const esHoy = fecha === hoy;

  const supabase = await createClient();
  const { inicio, fin } = rangoDiaAR(fecha);
  const { data } = await supabase
    .from("ingresos_personal")
    .select(
      "id, dni, nombre, apellido, ingreso_en, egreso_en, fuera_de_horario, firma_path, empleado_id, empleados(cargo)"
    )
    .eq("org_id", perfil.org_id)
    .gte("ingreso_en", inicio)
    .lt("ingreso_en", fin)
    .order("ingreso_en", { ascending: true });
  const ingresos = data ?? [];
  const adentro = ingresos.filter((i) => !i.egreso_en).length;

  // Miniaturas de las firmas (URL firmada, 1 h).
  const urlPorRuta = new Map<string, string>();
  if (ingresos.length > 0) {
    const { data: firmadas } = await supabase.storage
      .from("documentos")
      .createSignedUrls(
        ingresos.map((i) => i.firma_path),
        3600
      );
    for (const f of firmadas ?? []) {
      if (f.path && f.signedUrl) urlPorRuta.set(f.path, f.signedUrl);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader titulo="Portería" descripcion="Registro de ingreso de personal y solicitudes.">
        {perfil.rol === "guardia" ? (
          <Button asChild variant="outline" size="lg" className="h-12 px-5 text-base">
            <Link href="/caja">
              <Wallet className="size-5" strokeWidth={2} />
              Canon y cobros → Caja del día
            </Link>
          </Button>
        ) : null}
      </PageHeader>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] xl:items-start">
        {/* ------------------------------------------------ 1) Registrar ingreso */}
        <RegistroIngreso />

        <div className="space-y-8">
          {/* ------------------------------------------------ 2) Ingresos de hoy */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="space-y-0.5">
                <h2 className="font-display text-xl font-bold tracking-tight">
                  {esHoy ? "Ingresos de hoy" : `Ingresos del ${formatFecha(fecha)}`}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {capitalizar(formatFechaLarga(fecha))}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {puedeElegirFecha ? <SelectorFecha fecha={fecha} /> : null}
                <BotonExportar
                  dataset="ingresos_personal"
                  periodo={`${fecha.slice(0, 7)}-01`}
                  label="Exportar el mes a Excel"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-card px-4 py-3">
              <p className="flex items-baseline gap-2">
                <span
                  className={cn(
                    "font-display text-3xl font-bold tabular",
                    adentro > 0 ? "text-accent-foreground" : "text-muted-foreground"
                  )}
                >
                  {adentro}
                </span>
                <span className="text-base font-medium">
                  {adentro === 1 ? "persona adentro" : "personas adentro"}
                </span>
              </p>
              <p className="text-sm text-muted-foreground tabular">
                {ingresos.length === 0
                  ? "Sin ingresos registrados"
                  : `${ingresos.length} ${ingresos.length === 1 ? "ingreso registrado" : "ingresos registrados"}`}
                {ingresos.some((i) => i.fuera_de_horario)
                  ? ` · ${ingresos.filter((i) => i.fuera_de_horario).length} fuera de horario`
                  : ""}
              </p>
            </div>

            {ingresos.length === 0 ? (
              <EmptyState
                icono={DoorOpen}
                titulo={esHoy ? "Todavía no entró nadie hoy" : "No hubo ingresos ese día"}
                descripcion={
                  esHoy
                    ? "El primer ingreso del día se registra con DNI y firma, en el bloque de arriba."
                    : "Probá con otra fecha."
                }
              />
            ) : (
              <Card className="gap-0 divide-y overflow-hidden py-0 text-base">
                {ingresos.map((i) => {
                  const url = urlPorRuta.get(i.firma_path);
                  const cargo = i.empleados?.cargo ?? null;
                  const salio = Boolean(i.egreso_en);
                  return (
                    <div
                      key={i.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
                    >
                      <p className="w-14 shrink-0 font-display text-lg font-bold tabular">
                        {horaAR(i.ingreso_en)}
                      </p>
                      {url ? (
                        // URL privada firmada: no pasa por el optimizador de imágenes.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={url}
                          alt={`Firma de ${i.apellido}, ${i.nombre}`}
                          className="h-12 w-24 shrink-0 rounded-md border bg-white object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-12 w-24 shrink-0 rounded-md border bg-muted" aria-hidden />
                      )}
                      <div className="min-w-0 flex-1 basis-40">
                        <p className="truncate font-semibold">
                          {i.apellido}, {i.nombre}
                        </p>
                        <p className="truncate text-sm text-muted-foreground tabular">
                          DNI {i.dni}
                          {cargo ? ` · ${cargo}` : ""}
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
                      {!salio ? (
                        <BotonSalida ingresoId={i.id} nombre={`${i.apellido}, ${i.nombre}`} />
                      ) : null}
                    </div>
                  );
                })}
              </Card>
            )}
          </section>

          {/* ------------------------------------------------ 3) Solicitudes e informes */}
          <Card className="text-base">
            <CardHeader>
              <CardTitle className="font-display text-lg font-bold">Solicitudes e informes</CardTitle>
              <CardDescription className="text-sm">
                Si pasa algo en la garita o alguien pide algo, dejalo por escrito: lo recibe el
                Líder de Procesos y queda registrado.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button asChild variant="secondary" size="lg" className="h-12 px-5 text-base font-semibold">
                <Link href="/solicitudes/nueva?origen=porteria">
                  <FilePlus2 className="size-5" strokeWidth={2} />
                  Generar solicitud o informe
                </Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="h-12 px-4 text-base">
                <Link href="/solicitudes">
                  <MessagesSquare className="size-5" strokeWidth={2} />
                  Ver mis solicitudes
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
