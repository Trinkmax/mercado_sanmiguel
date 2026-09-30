import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList, DoorOpen, FileText, Pencil, Plus } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SIN_CONEXION } from "@/lib/sesion";
import {
  formatCuit,
  formatDni,
  formatFecha,
  formatFechaTS,
  hoyISO,
  labelPeriodo,
  periodoActual,
} from "@/lib/format";
import { fechaHoraAR, horaAR } from "@/components/porteria/fechas";
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
import { EditorHorarios } from "@/components/personal/editor-horarios";
import { DarDeBaja } from "@/components/personal/dar-de-baja";
import {
  LABEL_SECTOR,
  LABEL_TIPO_CONTRATO,
  formatDuracion,
  formatHorasNumero,
  horasSemanalesDeFranjas,
  minutosTrabajados,
  nombreCompleto,
  resumirHorarios,
} from "@/components/personal/constantes";
import { BarraHoras } from "@/components/novedades/barra-horas";
import { Contadores } from "@/components/novedades/contadores";
import { FilaNovedad } from "@/components/novedades/fila-novedad";
import { armarVistas, novedadesDelMes } from "@/components/novedades/datos";

export const metadata = { title: "Ficha del empleado" };

type Props = { params: Promise<{ id: string }> };

function Dato({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-base font-medium">{valor ?? "—"}</dd>
    </div>
  );
}

export default async function FichaEmpleadoPage({ params }: Props) {
  const perfil = await requireRol("lider");
  const { id } = await params;
  const supabase = await createClient();

  const { data: empleado } = await supabase
    .from("empleados")
    .select(
      "id, nombre, apellido, dni, cuil, cargo, telefono, email, sector, horas_semanales, tipo_contrato, fecha_ingreso, fecha_egreso, observaciones, contrato_path, activo, creado_en"
    )
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .maybeSingle();
  if (!empleado) notFound();

  const periodo = periodoActual();
  const [horariosRes, ingresosRes, resumenRes, novedadesMes, bajasRes] = await Promise.all([
    supabase
      .from("empleado_horarios")
      .select("dia_semana, hora_desde, hora_hasta")
      .eq("empleado_id", id)
      .order("dia_semana")
      .order("hora_desde"),
    supabase
      .from("ingresos_personal")
      .select("id, ingreso_en, egreso_en, fuera_de_horario")
      .eq("empleado_id", id)
      .order("ingreso_en", { ascending: false })
      .limit(8),
    supabase.rpc("resumen_novedades", { p_periodo: periodo }),
    novedadesDelMes(supabase, periodo, id),
    supabase
      .from("empleado_bajas")
      .select("id, desde, hasta")
      .eq("empleado_id", id)
      .order("desde"),
  ]);
  const bajas = bajasRes.data ?? [];
  const horarios = horariosRes.data ?? [];
  const ingresos = ingresosRes.data ?? [];
  // Sin respuesta de la base no se dice "no figura como vigente": la pantalla de error reintenta.
  if (resumenRes.error) throw new Error(SIN_CONEXION);
  const delMes = (resumenRes.data ?? []).find((r) => r.empleado_id === id) ?? null;
  const vistas = await armarVistas(supabase, novedadesMes);
  const segunHorario = horasSemanalesDeFranjas(horarios);
  const hoy = hoyISO();
  const mes = labelPeriodo(periodo).split(" ")[0].toLowerCase();

  let urlContrato: string | null = null;
  if (empleado.contrato_path) {
    const { data } = await supabase.storage
      .from("documentos")
      .createSignedUrl(empleado.contrato_path, 3600);
    urlContrato = data?.signedUrl ?? null;
  }

  const nombre = nombreCompleto(empleado);
  const subtitulo = [
    empleado.cargo,
    LABEL_TIPO_CONTRATO[empleado.tipo_contrato],
    `DNI ${formatDni(empleado.dni)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/personal"
          className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" strokeWidth={2} />
          Personal
        </Link>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Sello estado={empleado.activo ? "activo" : "inactivo"} />
          {empleado.activo && horarios.length === 0 ? (
            <Sello estado="fuera_horario" texto="Sin horarios" />
          ) : null}
        </div>
        <PageHeader titulo={nombre} descripcion={subtitulo} className="pb-2">
          <Button asChild variant="outline" size="lg" className="h-12 px-5 text-base" data-tour="personal-editar">
            <Link href={`/personal/${empleado.id}/editar`}>
              <Pencil className="size-5" strokeWidth={2} />
              Editar datos
            </Link>
          </Button>
          <DarDeBaja
            empleadoId={empleado.id}
            nombre={nombre}
            activo={empleado.activo}
            fechaIngreso={empleado.fecha_ingreso}
            fechaEgreso={empleado.fecha_egreso}
          />
        </PageHeader>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="text-base">
          <CardHeader>
            <CardTitle className="font-display text-lg font-bold">Datos</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              {/* Con puntos y guiones, como en el resto del sistema. */}
              <Dato label="DNI" valor={<span className="tabular">{formatDni(empleado.dni)}</span>} />
              <Dato
                label="CUIL"
                valor={empleado.cuil ? <span className="tabular">{formatCuit(empleado.cuil)}</span> : null}
              />
              <Dato label="Sector" valor={LABEL_SECTOR[empleado.sector]} />
              <Dato label="Cargo" valor={empleado.cargo} />
              <Dato label="Teléfono" valor={empleado.telefono} />
              <Dato label="Email" valor={empleado.email} />
            </dl>
          </CardContent>
        </Card>

        <Card className="text-base" data-tour="personal-contrato">
          <CardHeader>
            <CardTitle className="font-display text-lg font-bold">Contrato laboral</CardTitle>
            <CardDescription className="text-sm">
              {LABEL_TIPO_CONTRATO[empleado.tipo_contrato]}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Dato label="Fecha de ingreso" valor={formatFecha(empleado.fecha_ingreso)} />
              <Dato
                label="Fecha de egreso"
                valor={
                  empleado.fecha_egreso
                    ? formatFecha(empleado.fecha_egreso)
                    : empleado.activo
                      ? "Sigue trabajando"
                      : "Dado de baja (sin fecha)"
                }
              />
              {bajas.length > 0 ? (
                <Dato
                  label="Estuvo de baja"
                  valor={
                    <span className="block space-y-0.5 tabular">
                      {bajas.map((b) => (
                        <span key={b.id} className="block">
                          Del {formatFecha(b.desde)} al {formatFecha(b.hasta)}
                        </span>
                      ))}
                    </span>
                  }
                />
              ) : null}
              <Dato
                label="Horas por semana"
                valor={
                  empleado.horas_semanales ? (
                    <span className="tabular">{formatHorasNumero(empleado.horas_semanales)} h (contrato)</span>
                  ) : segunHorario > 0 ? (
                    <span className="tabular">{formatHorasNumero(segunHorario)} h según sus horarios</span>
                  ) : (
                    <span className="text-parcial">Sin horas de contrato</span>
                  )
                }
              />
            </dl>
            <div className="flex flex-wrap items-center gap-3">
              {urlContrato ? (
                <Button asChild variant="outline" size="lg" className="h-12 px-5 text-base">
                  <a href={urlContrato} target="_blank" rel="noreferrer">
                    <FileText className="size-5" strokeWidth={2} />
                    Ver contrato
                  </a>
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Todavía no hay un contrato cargado.{" "}
                  <Link
                    href={`/personal/${empleado.id}/editar`}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Subirlo desde Editar datos
                  </Link>
                  .
                </p>
              )}
            </div>
            {empleado.observaciones ? (
              <div className="space-y-0.5">
                <p className="text-sm text-muted-foreground">Observaciones</p>
                <p className="whitespace-pre-line">{empleado.observaciones}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4" data-tour="personal-horarios">
        <div className="space-y-0.5">
          <h2 className="font-display text-xl font-bold tracking-tight">Horarios de trabajo</h2>
          <p className="text-sm text-muted-foreground tabular">{resumirHorarios(horarios)}</p>
        </div>
        <EditorHorarios empleadoId={empleado.id} inicial={horarios} />
      </section>

      <Card className="text-base" data-tour="personal-novedades">
        <CardHeader>
          <CardTitle className="font-display text-lg font-bold">Novedades de {mes}</CardTitle>
          <CardDescription className="text-sm">
            Horas que debería tener contra las que registró en Portería, y lo que se cargó en el mes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {delMes ? (
            <>
              <BarraHoras
                registradas={Number(delMes.horas_registradas)}
                esperadas={Number(delMes.horas_esperadas)}
                horasSemanales={delMes.horas_semanales === null ? null : Number(delMes.horas_semanales)}
                hastaHoy
                className="max-w-xl"
              />
              {delMes.ingresos_sin_salida > 0 ? (
                <p className="flex items-center gap-1.5 text-sm font-medium text-parcial">
                  <DoorOpen className="size-4 shrink-0" strokeWidth={2} />
                  {delMes.ingresos_sin_salida === 1
                    ? "1 ingreso sin salida marcada: esas horas no suman"
                    : `${delMes.ingresos_sin_salida} ingresos sin salida marcada: esas horas no suman`}
                </p>
              ) : null}
              <Contadores
                contadores={{
                  ...delMes,
                  horas_tarde: Number(delMes.horas_tarde),
                  horas_feriado: Number(delMes.horas_feriado),
                  horas_extra: Number(delMes.horas_extra),
                }}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No figura como vigente este mes (revisá las fechas de ingreso y egreso).</p>
          )}
          {vistas.length > 0 ? (
            <div className="divide-y border-t">
              {vistas.map((n) => (
                <FilaNovedad key={`${n.id}-${n.estado}`} n={n} puedeRevisar miUserId={perfil.user_id} />
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild size="lg" className="h-12 px-5 text-base font-semibold">
              <Link href={`/novedades/nueva?empleado=${empleado.id}`}>
                <Plus className="size-5" strokeWidth={2.2} />
                Cargar novedad
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-12 px-4">
              <Link href="/novedades">
                <ClipboardList className="size-4" strokeWidth={2} />
                Ver la planilla del mes
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="text-base" data-tour="personal-ingresos">
        <CardHeader>
          <CardTitle className="font-display text-lg font-bold">Últimos ingresos por portería</CardTitle>
          <CardDescription className="text-sm">
            Lo que registró la garita con su firma. Los últimos {ingresos.length || 8}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ingresos.length === 0 ? (
            <p className="flex items-center gap-2 py-2 text-muted-foreground">
              <DoorOpen className="size-5" strokeWidth={1.8} />
              Todavía no registró ingresos por portería.
            </p>
          ) : (
            <div className="divide-y">
              {ingresos.map((i) => {
                const minutos = minutosTrabajados(i.ingreso_en, i.egreso_en);
                const deOtroDia = !i.egreso_en && formatFechaTS(i.ingreso_en) !== formatFecha(hoy);
                return (
                  <div key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                    <p className="min-w-0 flex-1 font-medium tabular">
                      {fechaHoraAR(i.ingreso_en)}
                      <span className="text-muted-foreground">
                        {" "}
                        {i.egreso_en ? `· salió ${horaAR(i.egreso_en)}` : deOtroDia ? "· no marcó la salida" : "· sigue adentro"}
                      </span>
                    </p>
                    {minutos !== null ? (
                      <span className="text-base font-semibold tabular">{formatDuracion(minutos)}</span>
                    ) : deOtroDia ? (
                      <Sello estado="parcial" texto="Sin salida marcada" />
                    ) : (
                      <Sello estado="adentro" />
                    )}
                    <Sello estado={i.fuera_de_horario ? "fuera_horario" : "en_horario"} />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
