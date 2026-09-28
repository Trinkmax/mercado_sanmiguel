import Link from "next/link";
import { Truck, Users } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { periodoActual } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { BotonExportar } from "@/components/shared/boton-exportar";
import {
  BuscadorClientes,
  type FilaCliente,
} from "@/components/cobranza/buscador-clientes";

export const metadata = { title: "Cobrar" };

export default async function CobranzaPage() {
  const perfil = await requireRol("admin", "guardia", "tesoreria");
  const supabase = await createClient();
  const esGuardia = perfil.rol === "guardia";

  const [clientesRes, deudaRes, quinterosRes, espaciosRes] = await Promise.all([
    supabase
      .from("clientes")
      .select("id, codigo, nombre")
      .eq("activo", true)
      .order("codigo"),
    supabase.from("v_deuda_clientes").select("cliente_id, deuda"),
    esGuardia
      ? supabase
          .from("cliente_conceptos")
          .select("cliente_id, conceptos!inner(codigo)")
          .eq("activo", true)
          .eq("conceptos.codigo", "EXPQ")
      : Promise.resolve({ data: null }),
    supabase
      .from("espacios")
      .select("cliente_id, tipo, numero, medio, x, y")
      .not("cliente_id", "is", null),
  ]);

  const deudaPorCliente = new Map<string, number>();
  for (const fila of deudaRes.data ?? []) {
    if (fila.cliente_id) deudaPorCliente.set(fila.cliente_id, Number(fila.deuda ?? 0));
  }

  let clientes = clientesRes.data ?? [];
  if (esGuardia) {
    const quinteros = new Set(
      (quinterosRes.data ?? []).map((q) => q.cliente_id)
    );
    clientes = clientes.filter((c) => quinteros.has(c.id));
  }

  // Puestos del plano de cada cliente: se busca también por N° de puesto.
  const puestosPorCliente = new Map<string, { numero: string; etiqueta: string }[]>();
  for (const e of (espaciosRes.data ?? []).sort((a, b) => Number(a.y) - Number(b.y) || Number(a.x) - Number(b.x))) {
    if (!e.cliente_id || e.tipo !== "puesto" || !e.numero) continue;
    const l = puestosPorCliente.get(e.cliente_id) ?? [];
    l.push({ numero: e.numero, etiqueta: e.medio ? `${e.numero}½` : e.numero });
    puestosPorCliente.set(e.cliente_id, l);
  }

  const filas: FilaCliente[] = clientes.map((c) => ({
    id: c.id,
    codigo: c.codigo,
    nombre: c.nombre,
    deuda: deudaPorCliente.get(c.id) ?? 0,
    puestos: puestosPorCliente.get(c.id) ?? [],
  }));
  // Primero los que deben (mayor deuda arriba); los al día, por número de carpeta.
  filas.sort((a, b) => b.deuda - a.deuda || a.codigo - b.codigo);

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Cobrar"
        descripcion={
          esGuardia
            ? "Buscá la quinta y cobrá en tres toques."
            : "Buscá el puesto y cobrá en tres toques."
        }
      >
        {esGuardia ? (
          <Button asChild size="lg" variant="outline" className="h-12 px-5 text-base">
            <Link href="/caja">
              <Truck className="size-5" strokeWidth={2} />
              Canon de portería
            </Link>
          </Button>
        ) : (
          <BotonExportar
            dataset="pagos"
            periodo={periodoActual()}
            label="Cobros del mes (.xlsx)"
          />
        )}
      </PageHeader>

      {filas.length === 0 ? (
        <EmptyState
          icono={Users}
          titulo={
            esGuardia
              ? "Todavía no hay quinteros activos"
              : "Todavía no hay clientes activos"
          }
          descripcion={
            esGuardia
              ? "Cuando se carguen quinteros con expensas EXPQ, van a aparecer acá."
              : "Cargá los clientes desde la ficha de clientes para empezar a cobrar."
          }
        />
      ) : (
        <BuscadorClientes clientes={filas} />
      )}
    </div>
  );
}
