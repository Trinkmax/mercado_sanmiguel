import { notFound } from "next/navigation";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SIN_CONEXION } from "@/lib/sesion";
import { formatFechaHora, labelPeriodo, periodoActual } from "@/lib/format";
import { Marca } from "@/components/shared/marca";
import { BotonImprimir } from "@/components/shared/boton-imprimir";
import { LABEL_SECTOR, formatHorasNumero, nombreCompleto } from "@/components/personal/constantes";
import { horasCortas } from "@/components/novedades/barra-horas";
import { armarVistas, novedadesDelMes } from "@/components/novedades/datos";
import {
  fraseNovedad,
  hrefNovedades,
  listaSectores,
  sectoresDeRol,
  textoHoras,
} from "@/components/novedades/constantes";

type Props = { params: Promise<{ periodo: string }> };

function leerPeriodo(v: string): string | null {
  const m = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(v);
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return null;
  return `${m[1]}-${m[2]}-01`;
}

export async function generateMetadata({ params }: Props) {
  const { periodo } = await params;
  const p = leerPeriodo(periodo);
  return { title: p ? `Novedades del personal — ${labelPeriodo(p)}` : "Novedades del personal" };
}

/**
 * Planilla del mes para liquidar sueldos (la contadora): por empleado, horas que debería
 * tener contra las registradas en Portería y las novedades APROBADAS; detalle y firmas.
 */
export default async function ImprimirNovedadesPage({ params }: Props) {
  const perfil = await requireRol("admin", "guardia", "lider");
  const { periodo: param } = await params;
  const periodo = leerPeriodo(param);
  if (!periodo || periodo > periodoActual()) notFound();

  const supabase = await createClient();
  const [resumenRes, delMes, orgRes, configRes] = await Promise.all([
    supabase.rpc("resumen_novedades", { p_periodo: periodo }),
    novedadesDelMes(supabase, periodo),
    supabase.from("organizaciones").select("nombre").eq("id", perfil.org_id).maybeSingle(),
    supabase.from("configuracion").select("impresion_directa").eq("org_id", perfil.org_id).maybeSingle(),
  ]);
  // Si la base no respondió no se imprime una planilla vacía con lugar para firmas: la
  // pantalla de error reintenta sola.
  if (resumenRes.error) throw new Error(SIN_CONEXION);
  const filas = resumenRes.data ?? [];
  const aprobadas = await armarVistas(
    supabase,
    delMes.filter((n) => n.estado === "aprobada")
  );
  const pendientes = delMes.filter((n) => n.estado === "pendiente").length;
  const nombrePorId = new Map(filas.map((f) => [f.empleado_id, nombreCompleto(f)]));
  const esMesActual = periodo === periodoActual();

  const th = "py-1.5 pr-2 text-left font-display text-[0.65rem] uppercase tracking-wider align-bottom";
  const thN = `${th} text-right`;

  return (
    <div>
      <style>{"@page { size: A4 landscape; margin: 12mm; }"}</style>
      <BotonImprimir
        volverA={hrefNovedades({ periodo })}
        autoImprimir={Boolean(configRes.data?.impresion_directa)}
        etiquetaImprimir="Imprimir planilla"
      />

      <header className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b-2 border-foreground pb-4">
        <div className="space-y-1">
          <Marca />
          <p className="text-sm text-muted-foreground">{orgRes.data?.nombre ?? "Cooperativa Mercado San Miguel"}</p>
        </div>
        <div className="text-right">
          <h1 className="font-display text-2xl font-semibold">Novedades del personal — {labelPeriodo(periodo)}</h1>
          <p className="text-sm text-muted-foreground">
            {listaSectores(sectoresDeRol(perfil.rol))} · {filas.length} empleados
            {esMesActual ? " · mes en curso: horas hasta hoy" : ""}
          </p>
        </div>
      </header>

      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full min-w-[56rem] border-collapse text-xs print:min-w-0">
          <thead>
            <tr className="border-b-2 border-foreground">
              <th className={th}>Empleado</th>
              <th className={th}>Sector</th>
              <th className={thN}>Contrato (h/sem)</th>
              <th className={thN}>Debería (h)</th>
              <th className={thN}>Registró (h)</th>
              <th className={thN}>Diferencia (h)</th>
              <th className={thN}>Faltas (sin just.)</th>
              <th className={thN}>Tardanzas</th>
              <th className={thN}>Feriados trab. (x2)</th>
              <th className={thN}>Vacaciones (días)</th>
              <th className={thN}>Licencia (días)</th>
              <th className={thN}>Horas extra</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const dif = Number(f.horas_registradas) - Number(f.horas_esperadas);
              return (
                <tr key={f.empleado_id} className="border-b border-foreground/25 align-top">
                  <td className="py-1.5 pr-2">
                    <span className="font-semibold">{nombreCompleto(f)}</span>
                    <span className="block text-[0.7rem] text-muted-foreground tabular">DNI {f.dni}</span>
                  </td>
                  <td className="py-1.5 pr-2">{LABEL_SECTOR[f.sector]}</td>
                  <td className="py-1.5 pr-2 text-right tabular">
                    {f.horas_semanales === null ? "—" : formatHorasNumero(f.horas_semanales)}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular">{horasCortas(f.horas_esperadas)}</td>
                  <td className="py-1.5 pr-2 text-right tabular">
                    {horasCortas(f.horas_registradas)}
                    {f.ingresos_sin_salida > 0 ? (
                      <span className="block text-[0.65rem] text-muted-foreground">{f.ingresos_sin_salida} sin salida</span>
                    ) : null}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-semibold tabular">
                    {dif > 0 ? "+" : ""}
                    {horasCortas(dif)}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular">
                    {f.faltas || "—"}
                    {f.faltas_injustificadas ? ` (${f.faltas_injustificadas})` : ""}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular">
                    {f.llegadas_tarde ? `${f.llegadas_tarde} · ${textoHoras(f.horas_tarde)}` : "—"}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular">
                    {f.feriados_trabajados
                      ? `${f.feriados_trabajados}${Number(f.horas_feriado) ? ` · ${textoHoras(f.horas_feriado)}` : ""}`
                      : "—"}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular">{f.dias_vacaciones || "—"}</td>
                  <td className="py-1.5 pr-2 text-right tabular">{f.dias_licencia || "—"}</td>
                  <td className="py-1.5 pr-2 text-right tabular">
                    {Number(f.horas_extra) ? textoHoras(f.horas_extra) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {filas.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No hay empleados vigentes en este mes.</p>
      ) : null}
      <p className="mt-2 text-[0.7rem] text-muted-foreground">
        Horas que debería: horas semanales del contrato ÷ 7 por cada día del mes (o su horario si no tiene contrato),
        sin contar vacaciones ni licencias aprobadas. Registró: ingresos y salidas firmados en Portería (tope 16 h por ingreso).
        {pendientes > 0 ? ` Hay ${pendientes} novedades esperando aprobación: no están incluidas.` : ""}
      </p>

      <section className="mt-6 space-y-2 break-inside-avoid-page">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider">Detalle de novedades aprobadas</h2>
        {aprobadas.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay novedades aprobadas en el mes.</p>
        ) : (
          <ol className="space-y-1 text-xs">
            {aprobadas.map((n) => (
              <li key={n.id} className="flex flex-wrap gap-x-2 border-b border-foreground/15 pb-1">
                <span className="font-semibold">{nombrePorId.get(n.empleado_id) ?? "—"}:</span>
                <span>{fraseNovedad({ ...n, conAdjunto: n.tieneAdjunto })}</span>
                {n.detalle && n.tipo !== "otra" ? <span className="text-muted-foreground">“{n.detalle}”</span> : null}
                <span className="text-muted-foreground">
                  · aprobó {n.revisadaPor ?? "—"}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mt-12 grid grid-cols-2 gap-12 break-inside-avoid-page">
        <div className="border-t border-foreground pt-1.5 text-center text-sm">
          Líder de Procesos
          <span className="block text-xs text-muted-foreground">Firma y aclaración</span>
        </div>
        <div className="border-t border-foreground pt-1.5 text-center text-sm">
          Administración
          <span className="block text-xs text-muted-foreground">Firma y aclaración</span>
        </div>
      </section>

      <p className="mt-6 border-t pt-3 text-center text-[0.7rem] text-muted-foreground">
        Planilla interna de novedades del personal · Impresa el {formatFechaHora(new Date().toISOString())} por {perfil.nombre}
      </p>
    </div>
  );
}
