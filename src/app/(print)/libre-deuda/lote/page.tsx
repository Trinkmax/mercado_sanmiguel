import Link from "next/link";
import { AlertTriangle, ArrowLeft, FileCheck2 } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { categoriasDeRol } from "@/lib/segmentos";
import { createClient } from "@/lib/supabase/server";
import { formatARS, labelPeriodo, periodoActual } from "@/lib/format";
import { cn } from "@/lib/utils";
import { armarLibresDeuda } from "@/lib/libre-deuda";
import { marcarLibresDeuda } from "@/lib/actions/libres-deuda";
import { Button } from "@/components/ui/button";
import { BotonImprimir } from "@/components/shared/boton-imprimir";
import { HojaLibreDeuda } from "@/components/libre-deuda/hoja-libre-deuda";

export const metadata = { title: "Libres deuda" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Varios libres deuda juntos, uno por hoja (pedido del 12/11/2026: «imprimirlos a todos, los
 * firman y se los reparten»). Llega desde «Libres deuda» con ?clientes=id,id,… Al imprimir
 * quedan anotados como impresos (0064). Si alguno volvió a deber, no sale y se avisa.
 */
export default async function LibresDeudaLotePage({
  searchParams,
}: {
  searchParams: Promise<{ clientes?: string }>;
}) {
  const perfil = await requireRol("admin", "guardia", "lider");
  const { clientes: param } = await searchParams;
  const ids = [...new Set((param ?? "").split(",").filter((id) => UUID.test(id)))].slice(0, 200);
  const periodo = periodoActual();
  const mes = labelPeriodo(periodo).toLowerCase();

  const supabase = await createClient();
  const [{ libres: todos, conDeuda }, configRes] = await Promise.all([
    armarLibresDeuda(supabase, perfil.org_id, ids, periodo),
    supabase.from("configuracion").select("impresion_directa").eq("org_id", perfil.org_id).maybeSingle(),
  ]);
  // Solo los que este rol gestiona (Administración: puesteros; el Jefe: quinteros).
  const categorias = categoriasDeRol(perfil.rol);
  const libres = todos.filter((l) => categorias.includes(l.categoria));

  if (libres.length === 0) {
    return (
      <div className="space-y-6 py-10">
        <div className="etiqueta">
          <div className="etiqueta-interior space-y-5 py-10 text-center">
            <FileCheck2 className="mx-auto size-10 text-muted-foreground" strokeWidth={1.6} />
            <h1 className="font-display text-2xl font-semibold">No hay libres deuda para imprimir</h1>
            <p className="text-lg">
              {conDeuda.length > 0
                ? "Los que elegiste deben algo: sin deuda saldada no hay libre deuda."
                : "Elegí en «Libres deuda» los que querés imprimir."}
            </p>
            <Button asChild variant="outline" size="lg" className="h-13 px-5 text-base">
              <Link href="/libres-deuda">
                <ArrowLeft className="size-5" />
                Volver
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <BotonImprimir
        volverA="/libres-deuda"
        autoImprimir={Boolean(configRes.data?.impresion_directa) && conDeuda.length === 0}
        etiquetaImprimir={libres.length === 1 ? "Imprimir libre deuda" : `Imprimir ${libres.length} libres deuda`}
        alImprimir={marcarLibresDeuda.bind(
          null,
          libres.map((l) => l.clienteId),
          periodo
        )}
      />

      <div className="no-print mb-6 space-y-3">
        <p className="text-lg">
          <span className="font-semibold">
            {libres.length === 1 ? "1 libre deuda" : `${libres.length} libres deuda`}
          </span>{" "}
          de {mes}, uno por hoja para firmar y entregar.
        </p>
        {conDeuda.length > 0 ? (
          <div className="flex items-start gap-3 rounded-lg border border-pendiente/40 bg-pendiente/5 px-4 py-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-pendiente" strokeWidth={2} />
            <p>
              <span className="font-semibold">
                {conDeuda.length === 1
                  ? `${conDeuda[0].nombre} no sale: debe ${formatARS(conDeuda[0].deuda)}`
                  : `${conDeuda.length} no salen porque deben algo`}
              </span>
              {conDeuda.length > 1 ? `: ${conDeuda.map((c) => c.nombre).join(", ")}` : ""}. Se les cargó algo
              después de que pagaron, o se anuló un cobro.
            </p>
          </div>
        ) : null}
      </div>

      <div>
        {libres.map((ld, i) => (
          <div
            key={ld.clienteId}
            className={cn(i < libres.length - 1 && "mb-10 print:mb-0 print:break-after-page")}
          >
            <HojaLibreDeuda ld={ld} />
          </div>
        ))}
      </div>
    </>
  );
}
