import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, ReceiptText } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatARS, labelPeriodo, mesDelConsumo, sumarMeses } from "@/lib/format";
import { etiquetaEspacio, textoEspacios } from "@/components/mapa/geometria";
import type { TipoEspacio } from "@/components/mapa/tipos";
import { periodoMaximoEnergia } from "@/components/energia/selector-periodo";
import { Button } from "@/components/ui/button";
import { BotonImprimir } from "@/components/shared/boton-imprimir";
import { type Cedulon } from "@/components/energia/hoja-cedulon";
import { HojasCedulones } from "@/components/energia/hojas-cedulones";

export const metadata = { title: "Cedulones de energía" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Espacio = {
  tipo: string;
  numero: string | null;
  medio: boolean;
  propio: boolean;
  x: number;
  y: number;
} | null;

function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Pedido del mercado (09/11/2026): «es por cliente, no por medidor, debe sumarse: Medidor 1 =
 * tanto, Medidor 2 = tanto. Que se imprima una vez. Cedulón se llama el tipo de comprobante.»
 *
 * Un cedulón por cliente con todos sus medidores y el abono, tres por hoja A4 para cortar. La
 * energía va a mes vencido (0063): el de noviembre es el consumo de octubre. Salen en el orden
 * del recorrido, como la planilla del electricista. Con ?cliente= sale solo el de ese cliente.
 */
export default async function CedulonesPage({
  params,
  searchParams,
}: {
  params: Promise<{ periodo: string }>;
  searchParams: Promise<{ cliente?: string }>;
}) {
  const { periodo } = await params;
  if (!/^\d{4}-\d{2}-01$/.test(periodo) || periodo > periodoMaximoEnergia()) notFound();
  const { cliente: clienteParam } = await searchParams;
  const soloCliente = clienteParam && UUID.test(clienteParam) ? clienteParam : null;

  // Energía es de Administración (y el Líder), igual que la pantalla de Energía.
  const perfil = await requireRol("admin", "lider");
  const supabase = await createClient();

  // Las lecturas del mes son una por medidor (unas cien): con ?cliente= se filtran acá abajo.
  const lecturasQ = supabase
    .from("lecturas")
    .select(
      "medidor_id, lectura_anterior, lectura_actual, kwh, precio_kwh, monto, medidor:medidores(numero, ubicacion, cliente_id, espacio:espacios(tipo, numero, medio, propio, x, y))"
    )
    .eq("org_id", perfil.org_id)
    .eq("periodo", periodo);
  let medidoresQ = supabase
    .from("medidores")
    .select("id, numero, ubicacion, cliente_id, espacio:espacios(tipo, numero, medio, propio, x, y)")
    .eq("org_id", perfil.org_id)
    .eq("activo", true);
  let cargosQ = supabase
    .from("cargos")
    .select("cliente_id, codigo, monto, monto_pagado, vencimiento")
    .eq("org_id", perfil.org_id)
    .eq("periodo", periodo)
    .in("codigo", ["ENER", "ABEN"])
    .neq("estado", "anulado");
  if (soloCliente) {
    medidoresQ = medidoresQ.eq("cliente_id", soloCliente);
    cargosQ = cargosQ.eq("cliente_id", soloCliente);
  }

  const [lecturasRes, medidoresRes, cargosRes, configRes] = await Promise.all([
    lecturasQ,
    medidoresQ,
    cargosQ,
    supabase.from("configuracion").select("impresion_directa").eq("org_id", perfil.org_id).maybeSingle(),
  ]);
  const autoImprimir = Boolean(configRes.data?.impresion_directa);
  const lecturas = (lecturasRes.data ?? []).flatMap((l) =>
    l.medidor && (!soloCliente || l.medidor.cliente_id === soloCliente) ? [{ ...l, medidor: l.medidor }] : []
  );
  const cargos = cargosRes.data ?? [];

  const mes = labelPeriodo(periodo);
  const consumo = mesDelConsumo(periodo);
  const consumoLargo = labelPeriodo(sumarMeses(periodo, -1)).toLowerCase();
  const volverA = soloCliente ? `/clientes/${soloCliente}` : `/energia?periodo=${periodo}`;

  // Sin ninguna lectura del mes no hay nada que imprimir (un abono solo no es un cedulón).
  if (lecturas.length === 0) {
    return (
      <div className="space-y-6 py-10">
        <div className="etiqueta">
          <div className="etiqueta-interior space-y-5 py-10 text-center">
            <ReceiptText className="mx-auto size-10 text-muted-foreground" strokeWidth={1.6} />
            <h1 className="font-display text-2xl font-semibold">Todavía no hay cedulones de {mes}</h1>
            <p className="text-lg">
              {soloCliente ? "A este cliente no se le cargó" : "No se cargó"} ninguna lectura de {mes} (consumo de{" "}
              {consumo}). Cuando estén cargadas en Energía, los cedulones salen de acá.
            </p>
            <Button asChild variant="outline" size="lg" className="h-13 px-5 text-base">
              <Link href={volverA}>
                <ArrowLeft className="size-5" />
                Volver
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Un cedulón por cliente: sus medidores con lectura, los activos que todavía no la tienen
  // (para que no salga incompleto sin avisar) y el abono del mes.
  const porCliente = new Map<string, Cedulon>();
  const cedulonDe = (clienteId: string): Cedulon => {
    let c = porCliente.get(clienteId);
    if (!c) {
      c = {
        clienteId,
        codigo: 0,
        nombre: "",
        lugares: "",
        renglones: [],
        abono: 0,
        pagado: 0,
        vencimiento: null,
        orden: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
      };
      porCliente.set(clienteId, c);
    }
    return c;
  };
  const anotarLugar = (c: Cedulon, e: Espacio) => {
    if (!e) return;
    const y = Number(e.y);
    const x = Number(e.x);
    if (y < c.orden[0] || (y === c.orden[0] && x < c.orden[1])) c.orden = [y, x];
  };

  const conLectura = new Set<string>();
  for (const l of lecturas) {
    const m = l.medidor;
    const e = m.espacio as Espacio;
    const c = cedulonDe(m.cliente_id);
    anotarLugar(c, e);
    conLectura.add(l.medidor_id);
    const kwh = Number(l.kwh ?? Number(l.lectura_actual) - Number(l.lectura_anterior));
    c.renglones.push({
      numero: m.numero,
      lugar: e ? etiquetaEspacio(e) : m.ubicacion,
      lectura: {
        anterior: Number(l.lectura_anterior),
        actual: Number(l.lectura_actual),
        kwh,
        precio: Number(l.precio_kwh),
        monto: Number(l.monto ?? kwh * Number(l.precio_kwh)),
      },
    });
  }
  for (const m of medidoresRes.data ?? []) {
    if (conLectura.has(m.id)) continue;
    const c = cedulonDe(m.cliente_id);
    const e = m.espacio as Espacio;
    anotarLugar(c, e);
    c.renglones.push({ numero: m.numero, lugar: e ? etiquetaEspacio(e) : m.ubicacion, lectura: null });
  }
  for (const cg of cargos) {
    const c = porCliente.get(cg.cliente_id);
    if (!c) continue;
    if (cg.codigo === "ABEN") c.abono += Number(cg.monto);
    c.pagado += Number(cg.monto_pagado);
    if (!c.vencimiento || cg.vencimiento < c.vencimiento) c.vencimiento = cg.vencimiento;
  }

  const ids = [...porCliente.keys()];
  const [clientesRes, espaciosRes] = await Promise.all([
    supabase.from("clientes").select("id, codigo, nombre").eq("org_id", perfil.org_id).in("id", ids),
    supabase
      .from("espacios")
      .select("cliente_id, tipo, numero, medio, propio, x, y")
      .eq("org_id", perfil.org_id)
      .in("cliente_id", ids),
  ]);
  for (const cl of clientesRes.data ?? []) {
    const c = porCliente.get(cl.id);
    if (!c) continue;
    c.codigo = cl.codigo;
    c.nombre = cl.nombre;
    c.lugares = textoEspacios(
      (espaciosRes.data ?? [])
        .filter((e) => e.cliente_id === cl.id)
        .map((e) => ({
          tipo: e.tipo as TipoEspacio,
          numero: e.numero,
          medio: e.medio,
          propio: e.propio,
          x: Number(e.x),
          y: Number(e.y),
        }))
    );
  }

  const cedulones = [...porCliente.values()]
    .filter((c) => c.nombre)
    .map((c) => ({
      ...c,
      renglones: [...c.renglones].sort((a, b) => a.numero.localeCompare(b.numero, "es", { numeric: true })),
    }))
    .sort((a, b) => a.orden[0] - b.orden[0] || a.orden[1] - b.orden[1] || a.codigo - b.codigo);
  const incompletos = cedulones.filter((c) => c.renglones.some((r) => r.lectura === null));
  const totalGeneral = cedulones.reduce(
    (acc, c) => acc + c.abono + c.renglones.reduce((s, r) => s + (r.lectura?.monto ?? 0), 0),
    0
  );

  return (
    <>
      <BotonImprimir
        volverA={volverA}
        autoImprimir={autoImprimir && incompletos.length === 0}
        etiquetaImprimir={cedulones.length === 1 ? "Imprimir cedulón" : `Imprimir ${cedulones.length} cedulones`}
      />

      <div className="no-print mb-6 space-y-3">
        <p className="text-lg">
          <span className="font-semibold">
            {cedulones.length === 1 ? "Cedulón" : `${cedulones.length} cedulones`} de {mes}
          </span>{" "}
          · consumo de {consumo} · total {formatARS(redondear2(totalGeneral))}
        </p>
        {cedulones.length > 1 ? (
          <p className="text-muted-foreground">
            Uno por cliente, con todos sus medidores sumados. Salen tres por hoja, en el orden del
            recorrido: se cortan por la línea punteada.
          </p>
        ) : null}
        {incompletos.length > 0 ? (
          <div className="flex items-start gap-3 rounded-lg border border-pendiente/40 bg-pendiente/5 px-4 py-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-pendiente" strokeWidth={2} />
            <p>
              <span className="font-semibold">
                {incompletos.length === 1
                  ? `A ${incompletos[0].nombre} le falta cargar alguna lectura`
                  : `A ${incompletos.length} clientes les falta cargar alguna lectura`}
              </span>{" "}
              de {mes}: {incompletos.length === 1 ? "su cedulón sale" : "sus cedulones salen"} con «Falta
              cargar» y sin ese consumo en el total. Cargala en Energía antes de imprimir.
            </p>
          </div>
        ) : null}
      </div>

      <HojasCedulones cedulones={cedulones} periodo={periodo} mes={mes} consumoLargo={consumoLargo} />
    </>
  );
}
