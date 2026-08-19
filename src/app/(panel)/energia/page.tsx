import Link from "next/link";
import { Gauge, Printer } from "lucide-react";
import { aplicaDirecto, requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { periodoActual } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { BotonExportar } from "@/components/shared/boton-exportar";
import { PrecioKwh } from "@/components/energia/precio-kwh";
import { SelectorPeriodo } from "@/components/energia/selector-periodo";
import { CargaRapida, type FilaMedidor } from "@/components/energia/carga-rapida";

export const metadata = { title: "Energía" };

export default async function EnergiaPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const perfil = await requireRol("admin", "tesoreria", "consejo", "lider");
  const supabase = await createClient();
  const params = await searchParams;

  // Período elegido (?periodo=YYYY-MM-01), acotado al mes actual como máximo.
  const actual = periodoActual();
  let periodo = actual;
  const crudo = params.periodo ?? "";
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(crudo)) {
    const normalizado = `${crudo.slice(0, 7)}-01`;
    if (normalizado <= actual) periodo = normalizado;
  }

  const [conceptoRes, medidoresRes, lecturasRes, previasRes, pendientesRes] =
    await Promise.all([
      supabase
        .from("conceptos")
        .select("id, precio")
        .eq("org_id", perfil.org_id)
        .eq("codigo", "ENER")
        .maybeSingle(),
      supabase
        .from("medidores")
        .select("id, numero, ubicacion, cliente:clientes(nombre)")
        .eq("activo", true),
      supabase
        .from("lecturas")
        .select("medidor_id, lectura_anterior, lectura_actual, kwh, monto, precio_kwh")
        .eq("periodo", periodo),
      // Última lectura conocida de cada medidor ANTES del período elegido.
      supabase
        .from("lecturas")
        .select("medidor_id, lectura_actual")
        .lt("periodo", periodo)
        .order("periodo", { ascending: false }),
      // Cambios de conceptos que esperan la aprobación del Líder (buscamos ENER).
      supabase
        .from("cambios_pendientes")
        .select("entidad_id, datos")
        .eq("org_id", perfil.org_id)
        .eq("entidad", "concepto")
        .eq("estado", "pendiente")
        .order("solicitado_en", { ascending: false }),
    ]);

  const precioKwh = Number(conceptoRes.data?.precio ?? 0);

  // ¿Hay un precio del kWh propuesto, esperando aprobación?
  let precioPropuesto: number | null = null;
  const enerId = conceptoRes.data?.id ?? null;
  for (const p of pendientesRes.data ?? []) {
    if (!enerId || p.entidad_id !== enerId) continue;
    const datos = p.datos as { precio?: number | string } | null;
    if (datos && datos.precio !== undefined && datos.precio !== null) {
      precioPropuesto = Number(datos.precio);
      break;
    }
  }

  const lecturasPorMedidor = new Map(
    (lecturasRes.data ?? []).map((l) => [l.medidor_id, l])
  );
  const ultimaConocida = new Map<string, number>();
  for (const l of previasRes.data ?? []) {
    if (!ultimaConocida.has(l.medidor_id)) {
      ultimaConocida.set(l.medidor_id, Number(l.lectura_actual));
    }
  }

  const filas: FilaMedidor[] = (medidoresRes.data ?? [])
    .sort((a, b) => a.numero.localeCompare(b.numero, "es", { numeric: true }))
    .map((m) => {
      const lectura = lecturasPorMedidor.get(m.id);
      const anterior = lectura
        ? Number(lectura.lectura_anterior)
        : (ultimaConocida.get(m.id) ?? null);
      return {
        id: m.id,
        numero: m.numero,
        cliente: m.cliente?.nombre ?? "—",
        ubicacion: m.ubicacion,
        anteriorConocida: anterior,
        cargada: lectura
          ? {
              anterior: Number(lectura.lectura_anterior),
              actual: Number(lectura.lectura_actual),
              kwh:
                lectura.kwh !== null
                  ? Number(lectura.kwh)
                  : Number(lectura.lectura_actual) - Number(lectura.lectura_anterior),
              monto:
                lectura.monto !== null
                  ? Number(lectura.monto)
                  : (Number(lectura.lectura_actual) -
                      Number(lectura.lectura_anterior)) *
                    Number(lectura.precio_kwh),
            }
          : null,
      };
    });

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Energía"
        descripcion="Cargá las lecturas de los medidores: tipeás la actual, Enter, y seguís con el siguiente."
      >
        <PrecioKwh
          precio={precioKwh}
          propuesto={precioPropuesto}
          aplicaDirecto={aplicaDirecto(perfil.rol)}
        />
        <Button asChild variant="outline" className="h-11 px-4 text-sm">
          <Link href="/planilla-lecturas">
            <Printer className="size-5" strokeWidth={2} />
            Imprimir planilla para el electricista
          </Link>
        </Button>
        <BotonExportar dataset="lecturas" periodo={periodo} label="Exportar lecturas" />
      </PageHeader>

      <SelectorPeriodo periodo={periodo} />

      {filas.length === 0 ? (
        <EmptyState
          icono={Gauge}
          titulo="No hay medidores activos"
          descripcion="Cuando asocies medidores a los clientes desde su ficha, van a aparecer acá para cargarles la lectura."
        />
      ) : (
        <CargaRapida
          key={periodo}
          filas={filas}
          periodo={periodo}
          precioKwh={precioKwh}
        />
      )}

      <p className="text-sm text-muted-foreground">
        Al guardar cada lectura se genera solo el cargo de energía del cliente,
        y ya queda listo para cobrarse desde Cobranza.
      </p>
    </div>
  );
}
