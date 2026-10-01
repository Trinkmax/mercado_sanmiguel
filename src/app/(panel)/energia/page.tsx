import Link from "next/link";
import { ArrowRight, Equal, Gauge, Plus, Printer, type LucideIcon } from "lucide-react";
import { aplicaDirecto, requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { labelPeriodo, periodoActual } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { BotonExportar } from "@/components/shared/boton-exportar";
import { PrecioConcepto, PrecioKwh } from "@/components/energia/precio-kwh";
import { SelectorPeriodo } from "@/components/energia/selector-periodo";
import { CargaRapida, type FilaMedidor } from "@/components/energia/carga-rapida";
import { SumarAbonos, type AbonoFaltante } from "@/components/energia/sumar-abonos";
import { AgregarMedidor, type ClienteParaMedidor } from "@/components/energia/agregar-medidor";
import { etiquetaEspacio } from "@/components/mapa/geometria";

export const metadata = { title: "Energía" };

/** Un término de la cuenta de la energía, con su signo (+, =) pegado adelante. En el
 * celular los términos van uno debajo del otro, alineados (el primero deja el lugar
 * del signo vacío). */
function Termino({
  signo: Signo,
  etiqueta,
  children,
}: {
  signo?: LucideIcon;
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-end gap-3">
      {Signo ? (
        <Signo className="mb-1.5 size-5 shrink-0 text-muted-foreground" strokeWidth={2} aria-hidden />
      ) : (
        <span aria-hidden className="size-5 shrink-0 sm:hidden" />
      )}
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{etiqueta}</p>
        {children}
      </div>
    </div>
  );
}

type EspacioMedidor = {
  id: string;
  tipo: string;
  numero: string | null;
  medio: boolean;
  propio: boolean;
  x: number;
  y: number;
} | null;

export default async function EnergiaPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  // J5: Tesorería no carga lecturas ni ve Energía.
  const perfil = await requireRol("admin", "lider");
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

  const [
    conceptosRes,
    medidoresRes,
    lecturasRes,
    previasRes,
    pendientesRes,
    abenClientesRes,
    periodoRes,
    abonosCargadosRes,
    clientesRes,
  ] = await Promise.all([
      supabase
        .from("conceptos")
        .select("id, codigo, precio, activo")
        .eq("org_id", perfil.org_id)
        .in("codigo", ["ENER", "ABEN"]),
      supabase
        .from("medidores")
        .select(
          "id, numero, ubicacion, cliente_id, espacio:espacios(id, tipo, numero, medio, propio, x, y), cliente:clientes(nombre, activo, categoria)"
        )
        .eq("org_id", perfil.org_id)
        .eq("activo", true),
      supabase
        .from("lecturas")
        .select("medidor_id, lectura_anterior, lectura_actual, kwh, monto, precio_kwh")
        .eq("org_id", perfil.org_id)
        .eq("periodo", periodo),
      // Última lectura conocida de cada medidor ANTES del período elegido: una fila por
      // medidor, calculada en SQL (el historial entero pasaba el tope de 1000 filas).
      supabase.rpc("ultimas_lecturas", { p_antes: periodo }),
      // Cambios de conceptos que esperan la aprobación del Líder (buscamos ENER y ABEN).
      supabase
        .from("cambios_pendientes")
        .select("entidad_id, datos")
        .eq("org_id", perfil.org_id)
        .eq("entidad", "concepto")
        .eq("estado", "pendiente")
        .order("solicitado_en", { ascending: false }),
      // I1: filas ABEN de cada cliente (inactiva = exento; activa = su cantidad).
      supabase
        .from("cliente_conceptos")
        .select("cliente_id, cantidad, activo, conceptos!inner(codigo)")
        .eq("org_id", perfil.org_id)
        .eq("conceptos.codigo", "ABEN"),
      supabase
        .from("periodos")
        .select("generado_en")
        .eq("org_id", perfil.org_id)
        .eq("periodo", periodo)
        .maybeSingle(),
      // Abonos ya generados del mes: para avisar a quién le falta (medidor agregado después).
      supabase
        .from("cargos")
        .select("cliente_id")
        .eq("org_id", perfil.org_id)
        .eq("periodo", periodo)
        .eq("codigo", "ABEN")
        .eq("origen", "generacion")
        .neq("estado", "anulado"),
      // "Agregar un medidor": puesteros y quinteros activos (Energía es de Administración
      // para todas las categorías, §4.7). Ambulantes y empleados (solo cochera) no tienen medidor.
      supabase
        .from("clientes")
        .select("id, codigo, nombre, apodo, categoria")
        .eq("org_id", perfil.org_id)
        .eq("activo", true)
        .not("categoria", "in", "(ambulante,empleado)")
        .order("nombre"),
    ]);

  const conceptos = conceptosRes.data ?? [];
  const ener = conceptos.find((c) => c.codigo === "ENER") ?? null;
  const aben = conceptos.find((c) => c.codigo === "ABEN") ?? null;
  const precioKwh = Number(ener?.precio ?? 0);
  const precioAbono = aben?.activo ? Number(aben.precio ?? 0) : 0;

  // ¿Hay un precio propuesto esperando aprobación? (el más reciente de cada concepto)
  const propuestoDe = (id: string | null | undefined): number | null => {
    if (!id) return null;
    for (const p of pendientesRes.data ?? []) {
      if (p.entidad_id !== id) continue;
      const datos = p.datos as { precio?: number | string } | null;
      if (datos && datos.precio !== undefined && datos.precio !== null) return Number(datos.precio);
    }
    return null;
  };

  const lecturasPorMedidor = new Map((lecturasRes.data ?? []).map((l) => [l.medidor_id, l]));
  const ultimaConocida = new Map<string, number>();
  for (const l of previasRes.data ?? []) {
    if (!ultimaConocida.has(l.medidor_id)) {
      ultimaConocida.set(l.medidor_id, Number(l.lectura_actual));
    }
  }

  // Abono por cliente: misma regla que private.generar_abonos_energia (cliente activo con
  // medidor activo, salvo que tenga la fila ABEN inactiva; cantidad de su fila activa o 1;
  // nunca a un ambulante, que paga por día).
  const filaAben = new Map((abenClientesRes.data ?? []).map((f) => [f.cliente_id, f]));
  const abonoDe = (clienteId: string): { monto: number } | "exento" | null => {
    const fila = filaAben.get(clienteId);
    if (fila && !fila.activo) return "exento";
    if (precioAbono <= 0) return null;
    return { monto: (fila ? Number(fila.cantidad) : 1) * precioAbono };
  };

  // Orden del recorrido del electricista (fila norte → isla → fila sur → contéiners):
  // por la posición en el plano; los que no tienen lugar, al final por número.
  const medidores = [...(medidoresRes.data ?? [])].sort((a, b) => {
    const ea = a.espacio as EspacioMedidor;
    const eb = b.espacio as EspacioMedidor;
    if (ea && eb) return Number(ea.y) - Number(eb.y) || Number(ea.x) - Number(eb.x);
    if (ea) return -1;
    if (eb) return 1;
    return a.numero.localeCompare(b.numero, "es", { numeric: true });
  });

  // El abono es uno por cliente (supuesto §9-2): va en su primer medidor. Se calcula en una
  // pasada aparte (sin acumular dentro del render de las filas).
  const conAbonoGenerado = new Set((abonosCargadosRes.data ?? []).map((c) => c.cliente_id));
  const abonoPorMedidor = new Map<string, NonNullable<FilaMedidor["abono"]>>();
  const sinAbonoGenerado: AbonoFaltante[] = [];
  let clientesConAbono = 0;
  let totalAbonos = 0;
  {
    const clientesVistos = new Set<string>();
    for (const m of medidores) {
      if (
        m.cliente?.activo === false ||
        m.cliente?.categoria === "ambulante" ||
        m.cliente?.categoria === "empleado" ||
        clientesVistos.has(m.cliente_id)
      )
        continue;
      clientesVistos.add(m.cliente_id);
      const abono = abonoDe(m.cliente_id);
      if (!abono) continue;
      abonoPorMedidor.set(m.id, abono);
      if (abono === "exento") continue;
      clientesConAbono += 1;
      totalAbonos += abono.monto;
      if (!conAbonoGenerado.has(m.cliente_id))
        sinAbonoGenerado.push({ nombre: m.cliente?.nombre ?? "Sin nombre", monto: abono.monto });
    }
  }

  const filas: FilaMedidor[] = medidores.map((m) => {
    const lectura = lecturasPorMedidor.get(m.id);
    const anterior = lectura ? Number(lectura.lectura_anterior) : (ultimaConocida.get(m.id) ?? null);
    const espacio = m.espacio as EspacioMedidor;
    const abono = abonoPorMedidor.get(m.id) ?? null;
    return {
      id: m.id,
      numero: m.numero,
      cliente: m.cliente?.nombre ?? "—",
      clienteId: m.cliente_id,
      ubicacion: espacio ? etiquetaEspacio(espacio) : m.ubicacion,
      espacioId: espacio?.id ?? null,
      abono,
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
                : (Number(lectura.lectura_actual) - Number(lectura.lectura_anterior)) *
                  Number(lectura.precio_kwh),
          }
        : null,
    };
  });

  const consumoCargado = (lecturasRes.data ?? []).reduce((acc, l) => acc + Number(l.monto ?? 0), 0);
  const totalEnergia = totalAbonos + consumoCargado;
  const mesGenerado = Boolean(periodoRes.data?.generado_en);
  const mes = labelPeriodo(periodo);
  // Solo el mes en curso: sumarle el abono a un mes viejo sería cobrarlo retroactivo (§1.2-11).
  const esMesActual = periodo === actual;
  const abonosFaltantes = esMesActual && mesGenerado ? sinAbonoGenerado : [];
  const clientesParaMedidor: ClienteParaMedidor[] = (clientesRes.data ?? []).map((c) => ({
    id: c.id,
    codigo: c.codigo,
    nombre: c.nombre,
    apodo: c.apodo,
    categoria: c.categoria as ClienteParaMedidor["categoria"],
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Energía"
        descripcion="Cargá las lecturas de los medidores: tipeás la actual, Enter, y seguís con el siguiente."
      >
        <PrecioKwh
          precio={precioKwh}
          propuesto={propuestoDe(ener?.id)}
          aplicaDirecto={aplicaDirecto(perfil.rol)}
        />
        <Button asChild variant="outline" className="h-11 px-4 text-sm" data-tour="energia-planilla">
          <Link href="/planilla-lecturas">
            <Printer className="size-5" strokeWidth={2} />
            Imprimir planilla para el electricista
          </Link>
        </Button>
        <BotonExportar dataset="lecturas" periodo={periodo} label="Exportar lecturas" />
        <AgregarMedidor clientes={clientesParaMedidor} />
      </PageHeader>

      <SelectorPeriodo periodo={periodo} />

      {/* I1: la energía del mes. Arriba el abono (editable); abajo la cuenta, con cada
          signo pegado a su término: si no entra en un renglón, "+ Consumo" y "= Total"
          bajan enteros y nunca queda un signo colgando. */}
      <section
        aria-label={`Energía de ${mes}`}
        data-tour="energia-mes"
        className="space-y-4 rounded-xl border bg-card p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
          <div className="min-w-0">
            <p className="font-display text-base font-bold">Energía de {mes}</p>
            <p className="text-sm text-muted-foreground">
              {mesGenerado ? "Abonos generados con el mes" : "El abono se suma al generar el mes"}
            </p>
          </div>
          {aben ? (
            <PrecioConcepto
              codigo="ABEN"
              precio={Number(aben.precio ?? 0)}
              propuesto={propuestoDe(aben.id)}
              aplicaDirecto={aplicaDirecto(perfil.rol)}
            />
          ) : null}
        </div>
        <div className="grid gap-3 border-t pt-4 sm:flex sm:flex-wrap sm:items-end sm:gap-x-6">
          <Termino
            etiqueta={`Abono × ${clientesConAbono} ${clientesConAbono === 1 ? "cliente" : "clientes"} con medidor`}
          >
            <Money monto={totalAbonos} className="text-xl font-bold" />
          </Termino>
          <Termino signo={Plus} etiqueta="Consumo cargado">
            <Money monto={consumoCargado} className="text-xl font-bold" />
          </Termino>
          <Termino signo={Equal} etiqueta="Total de energía">
            <Money monto={totalEnergia} className="text-2xl font-bold text-primary" />
          </Termino>
        </div>
      </section>

      {abonosFaltantes.length > 0 ? (
        <SumarAbonos periodo={periodo} mes={mes} faltantes={abonosFaltantes} />
      ) : null}

      {filas.length === 0 ? (
        <div data-tour="energia-sin-medidores">
          <EmptyState
            icono={Gauge}
            titulo="No hay medidores activos"
            descripcion="Tocá “Agregar un medidor”, elegí el cliente y cargá el número. Después aparece acá para cargarle la lectura."
          >
            <AgregarMedidor clientes={clientesParaMedidor} />
          </EmptyState>
        </div>
      ) : (
        <CargaRapida key={periodo} filas={filas} periodo={periodo} precioKwh={precioKwh} />
      )}

      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          Al guardar cada lectura se genera solo el cargo del consumo del cliente, y ya queda listo
          para cobrarse.
        </p>
        {mesGenerado ? (
          <p>
            {esMesActual
              ? "Si agregás un medidor después de generar el mes, acá arriba aparece el botón para sumarle el abono (solo el abono, sin duplicar nada)."
              : "En los meses que ya pasaron no se agregan abonos."}
          </p>
        ) : (
          <p>
            El abono mensual se suma solo cuando se genera {mes}.{" "}
            <Link href="/facturacion" className="inline-flex min-h-11 items-center gap-1 font-medium text-primary">
              Ir a Facturación
              <ArrowRight className="size-3.5" strokeWidth={2} />
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
