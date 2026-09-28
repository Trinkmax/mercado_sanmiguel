import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatNumero, labelPeriodo, periodoActual } from "@/lib/format";
import { BotonImprimir } from "@/components/shared/boton-imprimir";
import { etiquetaEspacio } from "@/components/mapa/geometria";

export const metadata = { title: "Planilla de lecturas" };

type EspacioMedidor = {
  tipo: string;
  numero: string | null;
  medio: boolean;
  propio: boolean;
  x: number;
  y: number;
} | null;

/**
 * La planilla PAPEL que se lleva el electricista: todos los medidores activos en el
 * orden en que se recorre el mercado (según su lugar en el plano; los que no tienen
 * lugar, al final), la última lectura conocida impresa y una columna ancha vacía para
 * anotar la lectura actual con lapicera.
 */
export default async function PlanillaLecturasPage() {
  // J5: Tesorería ya no carga lecturas.
  const perfil = await requireRol("admin", "lider");
  const supabase = await createClient();
  const periodo = periodoActual();

  const [orgRes, medidoresRes, lecturasMesRes, previasRes, configRes] = await Promise.all([
    supabase
      .from("organizaciones")
      .select("nombre")
      .eq("id", perfil.org_id)
      .maybeSingle(),
    supabase
      .from("medidores")
      .select("id, numero, ubicacion, espacio:espacios(tipo, numero, medio, propio, x, y), cliente:clientes(nombre)")
      .eq("org_id", perfil.org_id)
      .eq("activo", true),
    supabase
      .from("lecturas")
      .select("medidor_id, lectura_anterior")
      .eq("periodo", periodo),
    supabase
      .from("lecturas")
      .select("medidor_id, lectura_actual")
      .lt("periodo", periodo)
      .order("periodo", { ascending: false }),
    // Impresión directa (Configuración → General): abre el diálogo solo.
    supabase
      .from("configuracion")
      .select("impresion_directa")
      .eq("org_id", perfil.org_id)
      .maybeSingle(),
  ]);
  const autoImprimir = Boolean(configRes.data?.impresion_directa);

  // Última lectura conocida por medidor: si este mes ya tiene lectura cargada,
  // su "anterior"; si no, la lectura actual más reciente de meses previos.
  const anteriorDelMes = new Map(
    (lecturasMesRes.data ?? []).map((l) => [l.medidor_id, Number(l.lectura_anterior)])
  );
  const ultimaConocida = new Map<string, number>();
  for (const l of previasRes.data ?? []) {
    if (!ultimaConocida.has(l.medidor_id)) {
      ultimaConocida.set(l.medidor_id, Number(l.lectura_actual));
    }
  }

  // Recorrido: fila norte → isla → fila sur → contéiners (y, x del plano); sin lugar al final.
  const medidores = [...(medidoresRes.data ?? [])].sort((a, b) => {
    const ea = a.espacio as EspacioMedidor;
    const eb = b.espacio as EspacioMedidor;
    if (ea && eb) return Number(ea.y) - Number(eb.y) || Number(ea.x) - Number(eb.x);
    if (ea) return -1;
    if (eb) return 1;
    return a.numero.localeCompare(b.numero, "es", { numeric: true });
  });
  const ubicacionDe = (m: (typeof medidores)[number]) => {
    const e = m.espacio as EspacioMedidor;
    return e ? etiquetaEspacio(e) : m.ubicacion ?? "Sin lugar en el plano";
  };

  return (
    <div>
      <BotonImprimir volverA="/energia" autoImprimir={autoImprimir} />

      <div className="etiqueta mb-6">
        <div className="etiqueta-interior space-y-1 text-center">
          <p className="font-display text-sm uppercase tracking-widest text-muted-foreground">
            {orgRes.data?.nombre ?? "Cooperativa Mercado San Miguel"}
          </p>
          <h1 className="font-display text-3xl font-semibold uppercase tracking-wide">
            Planilla de lecturas — {labelPeriodo(periodo)}
          </h1>
          <p className="text-sm text-muted-foreground">
            {medidores.length} medidores, en el orden del recorrido · Anotá la lectura
            actual de cada uno en la última columna.
          </p>
        </div>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-foreground text-left">
            <th className="py-2 pr-2 font-display text-xs uppercase tracking-widest">
              N° medidor
            </th>
            <th className="py-2 pr-2 font-display text-xs uppercase tracking-widest">
              Cliente
            </th>
            <th className="py-2 pr-2 font-display text-xs uppercase tracking-widest">
              Ubicación
            </th>
            <th className="py-2 pr-3 text-right font-display text-xs uppercase tracking-widest">
              Lectura anterior
            </th>
            <th className="w-44 border-2 border-foreground px-2 py-2 text-center font-display text-xs uppercase tracking-widest">
              Lectura actual
            </th>
          </tr>
        </thead>
        <tbody>
          {medidores.map((m) => {
            const anterior =
              anteriorDelMes.get(m.id) ?? ultimaConocida.get(m.id) ?? null;
            return (
              <tr key={m.id} className="border-b border-foreground/30">
                <td className="h-14 pr-2 font-display text-xl tracking-wide">
                  {m.numero}
                </td>
                <td className="pr-2 font-medium">{m.cliente?.nombre ?? "—"}</td>
                <td className="pr-2 text-muted-foreground">{ubicacionDe(m)}</td>
                <td className="pr-3 text-right text-base tabular">
                  {anterior !== null ? formatNumero(anterior) : "—"}
                </td>
                <td className="border-2 border-foreground" />
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} className="pt-10">
              <div className="flex flex-wrap items-end justify-between gap-6 text-base">
                <p>
                  Leído por:{" "}
                  <span aria-hidden="true">
                    ______________________________
                  </span>
                </p>
                <p>
                  Fecha: <span aria-hidden="true">______ / ______ / ______</span>
                </p>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
