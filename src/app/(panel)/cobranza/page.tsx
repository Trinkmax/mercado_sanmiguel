import Link from "next/link";
import { Footprints, Users } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { hoyISO, nivelDeuda, periodoActual } from "@/lib/format";
import {
  categoriasDeRol,
  type AvanceMes,
  type CategoriaCliente,
} from "@/lib/segmentos";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { BotonExportar } from "@/components/shared/boton-exportar";
import { Money } from "@/components/shared/money";
import {
  BuscadorClientes,
  type FilaCliente,
} from "@/components/cobranza/buscador-clientes";
import { sumarDias } from "@/components/cobranza/tipos";

export const metadata = { title: "Cobrar" };

type Sp = Promise<{ cat?: string }>;

export default async function CobranzaPage({ searchParams }: { searchParams: Sp }) {
  const perfil = await requireRol("admin", "guardia", "lider");
  const { cat } = await searchParams;
  const supabase = await createClient();

  const esJefe = perfil.rol === "guardia";
  const categorias = categoriasDeRol(perfil.rol);
  const cobraPuesteros = categorias.includes("puestero");
  const cobraQuinteros = categorias.includes("quintero");
  const cobraAmbulantes = categorias.includes("ambulante");
  const hoy = hoyISO();
  const periodo = periodoActual();

  const [clientesRes, deudaRes, saldoRes, espaciosRes, avanceRes, diariosRes, cajaRes] =
    await Promise.all([
      supabase
        .from("clientes")
        .select("id, codigo, nombre, apodo, categoria")
        .eq("activo", true)
        .in("categoria", categorias)
        .order("codigo"),
      supabase.from("v_deuda_clientes").select("cliente_id, deuda, deuda_vencida"),
      supabase.from("v_saldo_favor").select("cliente_id, saldo_favor"),
      // El Jefe no lee el plano con clientes (0022): los puestos solo sirven para puesteros.
      cobraPuesteros
        ? supabase
            .from("espacios")
            .select("cliente_id, tipo, numero, medio, x, y")
            .not("cliente_id", "is", null)
        : Promise.resolve({ data: null }),
      // "2 de 4 · Falta $X": la cuenta es SIEMPRE la de v_avance_mes.
      cobraQuinteros
        ? supabase
            .from("v_avance_mes")
            .select("cliente_id, total, pagado, falta, cuotas, cuotas_cubiertas, cuota_sugerida")
            .eq("periodo", periodo)
        : Promise.resolve({ data: null }),
      // Último día pago de cada ambulante (cargos AMB vigentes de los últimos meses).
      cobraAmbulantes
        ? supabase
            .from("cargos")
            .select("cliente_id, hasta")
            .eq("origen", "diario")
            .neq("estado", "anulado")
            .gte("hasta", sumarDias(hoy, -180))
        : Promise.resolve({ data: null }),
      supabase
        .from("cajas")
        .select("id")
        .eq("tipo", esJefe ? "guardia" : "administracion")
        .eq("fecha", hoy)
        .maybeSingle(),
    ]);

  // Lo que cobró HOY quien está mirando (su caja del día).
  let hoyTotal = 0;
  const recibosHoy = new Set<string>();
  const quinterosHoy = new Set<string>();
  const ambulantesHoy = new Set<string>();
  if (cajaRes.data) {
    const { data: pagosHoy } = await supabase
      .from("pagos")
      .select("lote_id, monto, cliente_id, clientes(categoria)")
      .eq("caja_id", cajaRes.data.id)
      .eq("recibido_por", perfil.user_id)
      .eq("anulado", false);
    for (const p of pagosHoy ?? []) {
      hoyTotal += Number(p.monto);
      recibosHoy.add(p.lote_id);
      if (p.clientes?.categoria === "quintero") quinterosHoy.add(p.cliente_id);
      if (p.clientes?.categoria === "ambulante") ambulantesHoy.add(p.cliente_id);
    }
  }

  const deudaPorCliente = new Map<string, { deuda: number; vencida: number }>();
  for (const f of deudaRes.data ?? []) {
    if (f.cliente_id) {
      deudaPorCliente.set(f.cliente_id, {
        deuda: Number(f.deuda ?? 0),
        vencida: Number(f.deuda_vencida ?? 0),
      });
    }
  }
  const saldoPorCliente = new Map<string, number>();
  for (const f of saldoRes.data ?? []) {
    if (f.cliente_id) saldoPorCliente.set(f.cliente_id, Number(f.saldo_favor ?? 0));
  }

  const puestosPorCliente = new Map<string, { numero: string; etiqueta: string }[]>();
  for (const e of [...(espaciosRes.data ?? [])].sort(
    (a, b) => Number(a.y) - Number(b.y) || Number(a.x) - Number(b.x)
  )) {
    if (!e.cliente_id || e.tipo !== "puesto" || !e.numero) continue;
    const l = puestosPorCliente.get(e.cliente_id) ?? [];
    l.push({ numero: e.numero, etiqueta: e.medio ? `${e.numero}½` : e.numero });
    puestosPorCliente.set(e.cliente_id, l);
  }

  const avancePorCliente = new Map<string, AvanceMes>();
  for (const a of avanceRes.data ?? []) {
    if (!a.cliente_id) continue;
    avancePorCliente.set(a.cliente_id, {
      total: Number(a.total ?? 0),
      pagado: Number(a.pagado ?? 0),
      falta: Number(a.falta ?? 0),
      cuotas: Number(a.cuotas ?? 1),
      cuotas_cubiertas: Number(a.cuotas_cubiertas ?? 0),
      cuota_sugerida: Number(a.cuota_sugerida ?? 0),
    });
  }

  const pagoHastaPorCliente = new Map<string, string>();
  for (const c of diariosRes.data ?? []) {
    if (!c.cliente_id || !c.hasta) continue;
    const previo = pagoHastaPorCliente.get(c.cliente_id);
    if (!previo || c.hasta > previo) pagoHastaPorCliente.set(c.cliente_id, c.hasta);
  }

  const filas: FilaCliente[] = (clientesRes.data ?? []).map((c) => {
    const d = deudaPorCliente.get(c.id) ?? { deuda: 0, vencida: 0 };
    const saldo = saldoPorCliente.get(c.id) ?? 0;
    return {
      id: c.id,
      codigo: c.codigo,
      nombre: c.nombre,
      apodo: c.apodo,
      categoria: c.categoria as CategoriaCliente,
      deuda: Math.max(Math.round((d.deuda - saldo) * 100) / 100, 0),
      nivel: nivelDeuda({ deuda: d.deuda, deudaVencida: d.vencida, saldoFavor: saldo }),
      puestos: puestosPorCliente.get(c.id) ?? [],
      avance: avancePorCliente.get(c.id) ?? null,
      pagoHasta: pagoHastaPorCliente.get(c.id) ?? null,
    };
  });

  // Primero lo que hay que cobrar: los que deben (quinteros: lo que falta del mes;
  // ambulantes: los que hoy no pagaron), después por número de carpeta.
  const peso = (f: FilaCliente) =>
    f.categoria === "ambulante"
      ? (f.pagoHasta !== null && f.pagoHasta >= hoy ? 0 : 1)
      : f.categoria === "quintero"
        ? Math.max(f.avance?.falta ?? 0, f.deuda)
        : f.deuda;
  filas.sort((a, b) => peso(b) - peso(a) || a.codigo - b.codigo);

  const categoriaInicial: CategoriaCliente =
    cat && categorias.includes(cat as CategoriaCliente)
      ? (cat as CategoriaCliente)
      : categorias[0];

  const descripcion = esJefe
    ? "Buscá al quintero o ambulante y cobrá en tres toques."
    : perfil.rol === "lider"
      ? "Puesteros, quinteros y ambulantes. Lo que cobres va a la caja de Administración."
      : "Buscá el puesto y cobrá en tres toques.";

  return (
    <div className="space-y-8">
      <PageHeader titulo="Cobrar" descripcion={descripcion}>
        {esJefe || perfil.rol === "lider" ? (
          <Button asChild size="lg" variant="outline" className="h-12 px-5 text-base font-semibold">
            <Link href="/clientes/nuevo?categoria=ambulante">
              <Footprints className="size-5" strokeWidth={2} />
              Nuevo ambulante
            </Link>
          </Button>
        ) : null}
        {!esJefe ? (
          <BotonExportar dataset="pagos" periodo={periodo} label="Cobros del mes (.xlsx)" />
        ) : null}
      </PageHeader>

      {esJefe || hoyTotal > 0 ? (
        <div className="-mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg border bg-card px-4 py-3">
          {hoyTotal > 0 ? (
            <>
              <span className="text-muted-foreground">Hoy cobraste</span>
              <Money monto={hoyTotal} className="text-xl font-bold" />
              <span className="text-sm text-muted-foreground">
                {esJefe
                  ? `· ${ambulantesHoy.size} ${ambulantesHoy.size === 1 ? "ambulante" : "ambulantes"} · ${quinterosHoy.size} ${quinterosHoy.size === 1 ? "quintero" : "quinteros"}`
                  : `· ${recibosHoy.size} ${recibosHoy.size === 1 ? "recibo" : "recibos"}`}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">Hoy todavía no cobraste nada.</span>
          )}
        </div>
      ) : null}

      {filas.length === 0 ? (
        <EmptyState
          icono={Users}
          titulo={
            esJefe ? "Todavía no hay quinteros ni ambulantes" : "Todavía no hay clientes activos"
          }
          descripcion={
            esJefe
              ? "Cuando se carguen quinteros y ambulantes (Quinteros y ambulantes → Nuevo) van a aparecer acá."
              : "Cargá los clientes desde Clientes para empezar a cobrar."
          }
        >
          {esJefe ? (
            <Button asChild size="lg" className="h-12 px-5 text-base font-semibold">
              <Link href="/clientes/nuevo?categoria=ambulante">
                <Footprints className="size-5" strokeWidth={2} />
                Nuevo ambulante
              </Link>
            </Button>
          ) : null}
        </EmptyState>
      ) : (
        <BuscadorClientes
          clientes={filas}
          categorias={categorias}
          categoriaInicial={categoriaInicial}
          hoy={hoy}
          placeholder={
            esJefe
              ? "Buscá al quintero o ambulante por nombre o apodo…"
              : "Buscá por nombre, apodo o número de puesto…"
          }
        />
      )}
    </div>
  );
}
