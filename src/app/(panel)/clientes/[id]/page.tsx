import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileCheck, HandCoins, ReceiptText, ShieldQuestion, Zap } from "lucide-react";
import { aplicaDirecto, requireRol, type Rol } from "@/lib/auth";
import { ROLES_COBRAN } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import {
  formatARS,
  formatFecha,
  formatFechaHora,
  hoyISO,
  labelPeriodo,
  nivelDeuda,
  saldoCargo,
  SELLO_NIVEL_DEUDA,
} from "@/lib/format";
import { categoriasDeRol, type CategoriaCliente } from "@/lib/segmentos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { Codigo } from "@/components/shared/codigo";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { EmptyState } from "@/components/shared/empty-state";
import { BotonExportar } from "@/components/shared/boton-exportar";
import { EditarClienteDialog } from "@/components/clientes/editar-cliente-dialog";
import { BajaCliente } from "@/components/clientes/baja-cliente";
import { AplicarSaldoFavor } from "@/components/clientes/aplicar-saldo-favor";
import { BannerDeuda, resumenDeudaActiva } from "@/components/clientes/banner-deuda";
import {
  CambiosPendientesCliente,
  type CambioDeCliente,
} from "@/components/clientes/cambios-pendientes-cliente";
import { DeudaAnterior } from "@/components/clientes/deuda-anterior";
import { AnularDeuda } from "@/components/clientes/anular-deuda";
import { ConceptosCliente } from "@/components/clientes/conceptos-cliente";
import { DocumentosCliente } from "@/components/clientes/documentos-cliente";
import { PagosRecibidos } from "@/components/clientes/pagos-recibidos";
import { ChipCategoria } from "@/components/clientes/chip-categoria";
import { RegistrosCliente } from "@/components/clientes/registros-cliente";
import { CircularesCliente } from "@/components/clientes/circulares-cliente";
import {
  MedidoresCliente,
  type AbonoEnergia,
  type MedidorConLectura,
} from "@/components/clientes/medidores-cliente";
import {
  LABEL_TIPO_PERSONA,
  conceptoAsignablePorRol,
  conceptoSigueConCategoria,
  labelCategoria,
} from "@/components/clientes/constantes";
import { DescripcionCargo } from "@/components/cobranza/descripcion-cargo";
import { EnElPlano } from "@/components/mapa/en-el-plano";
import { etiquetaEspacio, etiquetaEspacios } from "@/components/mapa/geometria";
import type { TipoEspacio } from "@/components/mapa/tipos";

export const metadata = { title: "Ficha del cliente" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Estado que se muestra en el sello de un cargo: vencido si pasó la fecha. */
function estadoCargo(cargo: { estado: string; vencimiento: string }, hoy: string): string {
  if ((cargo.estado === "pendiente" || cargo.estado === "parcial") && cargo.vencimiento < hoy) {
    return "vencido";
  }
  return cargo.estado;
}

/**
 * Beneficio por pago en término de un cargo, para que la fila cierre a la vista
 * (importe − beneficio − pagado = saldo):
 *  - pagado con beneficio: lo que no hizo falta pagar (monto − pagado);
 *  - pendiente o parcial en término: lo que se ahorra si termina de pagar antes del vencimiento.
 * Vencido: ya no hay beneficio (debe el importe completo, lo dice el aviso de arriba).
 */
function beneficioDelCargo(
  c: { estado: string; monto: number; monto_pagado: number; descuento_pronto_pago: number },
  saldo: number
): number {
  if (!(c.descuento_pronto_pago > 0)) return 0;
  const sinPagar = Math.max(c.monto - c.monto_pagado, 0);
  if (c.estado === "pagado") return Math.round(sinPagar * 100) / 100;
  if (c.estado === "pendiente" || c.estado === "parcial") return Math.round(Math.max(sinPagar - saldo, 0) * 100) / 100;
  return 0;
}

/** Pantalla simple (no 404) cuando el cliente es de otra categoría (§6 M4-2). */
function FueraDeAlcance({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <div className="space-y-8">
      <EmptyState icono={ShieldQuestion} titulo={titulo} descripcion={descripcion} className="py-16">
        <Button asChild size="lg" className="h-12 px-6 text-base font-semibold">
          <Link href="/clientes">
            <ArrowLeft className="size-5" />
            Volver
          </Link>
        </Button>
      </EmptyState>
    </div>
  );
}

/** "Rechazados hace poco" = revisados en los últimos 15 días. */
const DIAS_RECHAZADOS = 15;

function desdeRechazados(): string {
  return new Date(Date.now() - DIAS_RECHAZADOS * 86_400_000).toISOString();
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Pestaña Medidores (Energía, §4.7: de Administración para todas las categorías): los
 * medidores con su lugar del plano EN VIVO (si se renumera el puesto o se marca propio, la
 * ficha lo muestra igual que Energía), la última lectura y el estado del abono (ABEN).
 */
async function datosEnergia(
  supabase: Supabase,
  clienteId: string
): Promise<{ medidores: MedidorConLectura[]; abono: AbonoEnergia }> {
  const [medidoresRes, abenRes, pendientesRes] = await Promise.all([
    supabase
      .from("medidores")
      .select("id, numero, ubicacion, espacio_id, activo, espacio:espacios(tipo, numero, medio, propio)")
      .eq("cliente_id", clienteId)
      .order("numero"),
    supabase
      .from("conceptos")
      .select("id, precio, activo")
      .eq("codigo", "ABEN")
      .maybeSingle(),
    supabase
      .from("cambios_pendientes")
      .select("entidad_id, datos")
      .eq("cliente_id", clienteId)
      .eq("entidad", "cliente_concepto")
      .eq("estado", "pendiente"),
  ]);
  const medidores = medidoresRes.data ?? [];
  const aben = abenRes.data?.activo ? abenRes.data : null;

  const { data: itemAben } = aben
    ? await supabase
        .from("cliente_conceptos")
        .select("id, activo")
        .eq("cliente_id", clienteId)
        .eq("concepto_id", aben.id)
        .maybeSingle()
    : { data: null };
  const abonoPendiente = (pendientesRes.data ?? []).some(
    (c) =>
      (aben && (c.datos as { concepto_id?: string } | null)?.concepto_id === aben.id) ||
      (itemAben && c.entidad_id === itemAben.id)
  );

  // Última lectura conocida de cada medidor (pocos por cliente: sin tope de filas).
  const ultimaPorMedidor = new Map<string, { lectura_actual: number; periodo: string; fecha_lectura: string }>();
  if (medidores.length > 0) {
    const { data: lecturas } = await supabase
      .from("lecturas")
      .select("medidor_id, lectura_actual, periodo, fecha_lectura")
      .in(
        "medidor_id",
        medidores.map((m) => m.id)
      )
      .order("periodo", { ascending: false });
    for (const l of lecturas ?? []) {
      if (!ultimaPorMedidor.has(l.medidor_id)) {
        ultimaPorMedidor.set(l.medidor_id, {
          lectura_actual: Number(l.lectura_actual),
          periodo: l.periodo,
          fecha_lectura: l.fecha_lectura,
        });
      }
    }
  }

  return {
    medidores: medidores.map((m) => ({
      id: m.id,
      numero: m.numero,
      // El lugar del plano se calcula en vivo; el texto guardado queda para "otro lugar".
      ubicacion: m.espacio ? etiquetaEspacio(m.espacio) : m.ubicacion,
      espacioId: m.espacio_id,
      activo: m.activo,
      ultimaLectura: ultimaPorMedidor.get(m.id) ?? null,
    })),
    abono: {
      precio: aben ? Number(aben.precio) : null,
      exento: Boolean(itemAben && !itemAben.activo),
      pendiente: abonoPendiente,
    },
  };
}

/**
 * Administración y un quintero (o ambulante): la carpeta es del Jefe de Portería, pero
 * Energía es de Administración para todos (§4.7, I1/C8). Ficha reducida: solo medidores
 * y abono, en vez de "Este cliente es de Portería" sin salida.
 */
async function FichaSoloEnergia({
  supabase,
  cliente,
  categoria,
  rol,
}: {
  supabase: Supabase;
  cliente: { id: string; codigo: number; nombre: string; activo: boolean };
  categoria: CategoriaCliente;
  rol: Rol;
}) {
  const [{ medidores, abono }, espaciosRes] = await Promise.all([
    datosEnergia(supabase, cliente.id),
    supabase.from("espacios").select("id").eq("cliente_id", cliente.id),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Codigo codigo={`N° ${cliente.codigo}`} />
          <ChipCategoria categoria={categoria} className="py-1 text-sm" />
          {!cliente.activo ? <Sello estado="inactivo" texto="Dado de baja" /> : null}
        </div>
        <PageHeader
          titulo={cliente.nombre}
          descripcion="Su carpeta y sus cobros los maneja el Jefe de Portería. Desde acá manejás solo su energía: medidores y abono."
          className="pb-2"
        >
          <Button asChild variant="outline" size="lg" className="h-12 px-5 text-base">
            <Link href="/energia">
              <ArrowLeft className="size-5" />
              Volver a Energía
            </Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex items-center gap-2 text-lg font-semibold">
        <Zap className="size-5 text-muted-foreground" strokeWidth={1.9} />
        Medidores y abono de energía
      </div>
      <MedidoresCliente
        clienteId={cliente.id}
        medidores={medidores}
        espaciosCliente={(espaciosRes.data ?? []).map((e) => e.id)}
        abono={abono}
        rol={rol}
        ambulante={categoria === "ambulante"}
      />
    </div>
  );
}

export default async function FichaClientePage({ params, searchParams }: Props) {
  const perfil = await requireRol("admin", "guardia", "lider");
  const { id } = await params;
  const { tab } = await searchParams;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const hoy = hoyISO();
  const esLider = aplicaDirecto(perfil.rol);
  const esJefe = perfil.rol === "guardia";
  const veEnergia = perfil.rol === "admin" || perfil.rol === "lider";

  const { data: cliente } = await supabase
    .from("clientes")
    .select(
      "id, codigo, nombre, apodo, activo, tipo_persona, cuit, telefono, email, direccion, cuotas_mes, notas, categoria, es_socio"
    )
    .eq("id", id)
    .maybeSingle();

  if (!cliente) {
    // El Jefe no lee puesteros (RLS): no sabemos si existe, pero no es de Portería.
    if (esJefe)
      return (
        <FueraDeAlcance
          titulo="Este cliente lo gestiona Administración"
          descripcion="Desde Portería ves y gestionás solo a quinteros y ambulantes."
        />
      );
    notFound();
  }
  const categoria = cliente.categoria as CategoriaCliente;
  if (!categoriasDeRol(perfil.rol).includes(categoria)) {
    if (perfil.rol === "admin") {
      return (
        <FichaSoloEnergia supabase={supabase} cliente={cliente} categoria={categoria} rol={perfil.rol} />
      );
    }
    return (
      <FueraDeAlcance
        titulo="Este cliente es de Portería: lo gestiona el Jefe de Portería"
        descripcion={`${cliente.nombre} es ${categoria === "quintero" ? "quintero" : "ambulante"}. Su carpeta y sus cobros los maneja el Jefe de Portería.`}
      />
    );
  }

  const [
    cargosRes,
    pagosRes,
    itemsRes,
    conceptosRes,
    documentosRes,
    categoriasUsadasRes,
    perfilesRes,
    saldoFavorRes,
    cambiosRes,
    rechazadosRes,
    espaciosRes,
    energia,
    lugaresJefeRes,
    medidoresJefeRes,
  ] = await Promise.all([
    supabase
      .from("cargos")
      .select(
        "id, codigo, descripcion, periodo, vencimiento, estado, monto, monto_pagado, descuento_pronto_pago, origen, creado_por, creado_en, anulado_por, anulado_en, anulado_motivo"
      )
      .eq("cliente_id", id)
      .order("periodo", { ascending: false })
      .order("codigo"),
    supabase
      .from("pagos")
      .select(
        "id, numero, lote_id, linea, fecha, medio, monto, recibido_por, anulado, motivo_anulacion, titular_transferencia, imputaciones(monto)"
      )
      .eq("cliente_id", id)
      .order("fecha", { ascending: false })
      .order("linea"),
    supabase
      .from("cliente_conceptos")
      .select(
        "id, cantidad, activo, concepto_id, conceptos(codigo, nombre, tipo, precio, descuento_pronto_pago, segmento)"
      )
      .eq("cliente_id", id),
    supabase
      .from("conceptos")
      .select("id, codigo, nombre, tipo, precio, descuento_pronto_pago, segmento")
      .eq("activo", true)
      .order("orden_imputacion"),
    supabase
      .from("documentos_cliente")
      .select("id, titulo, categoria, creado_en, storage_path, subido_por")
      .eq("cliente_id", id)
      .order("creado_en", { ascending: false }),
    // Categorías que ya usó la cooperativa (las de los clientes que el rol ve).
    supabase.from("documentos_cliente").select("categoria").limit(2000),
    supabase.from("perfiles").select("user_id, nombre"),
    supabase.from("v_saldo_favor").select("saldo_favor").eq("cliente_id", id).maybeSingle(),
    // Lo que espera aprobación (todo) y lo rechazado en los últimos 15 días (los viejos
    // ya no confunden arriba de la ficha).
    supabase
      .from("cambios_pendientes")
      .select(
        "id, entidad, entidad_id, datos, resumen, estado, solicitado_por, solicitado_en, revisado_por, revisado_en, motivo_rechazo"
      )
      .or(`cliente_id.eq.${id},entidad_id.eq.${id}`)
      .eq("estado", "pendiente")
      .order("solicitado_en", { ascending: false }),
    supabase
      .from("cambios_pendientes")
      .select(
        "id, entidad, entidad_id, datos, resumen, estado, solicitado_por, solicitado_en, revisado_por, revisado_en, motivo_rechazo"
      )
      .or(`cliente_id.eq.${id},entidad_id.eq.${id}`)
      .eq("estado", "rechazado")
      .gte("revisado_en", desdeRechazados())
      .order("revisado_en", { ascending: false })
      .limit(5),
    // El Jefe no lee la tabla espacios (0022): lo que necesita sale de lugares_del_cliente.
    esJefe
      ? Promise.resolve({ data: [] as { id: string; tipo: string; numero: string | null; medio: boolean; propio: boolean; x: number; y: number }[] })
      : supabase.from("espacios").select("id, tipo, numero, medio, propio, x, y").eq("cliente_id", id),
    veEnergia ? datosEnergia(supabase, id) : Promise.resolve(null),
    // El Jefe y un quintero: qué lugares del plano y qué medidores tiene, para avisarle
    // ANTES de pasarlo a ambulante qué se libera y qué deja de facturarse (el Jefe no lee
    // espacios: lugares_del_cliente; los medidores de sus clientes sí los lee).
    esJefe && categoria === "quintero"
      ? supabase.rpc("lugares_del_cliente", { p_cliente: id })
      : Promise.resolve({ data: [] as { id: string; tipo: string; numero: string; medio: boolean; propio: boolean }[] }),
    esJefe && categoria === "quintero"
      ? supabase.from("medidores").select("numero").eq("cliente_id", id).eq("activo", true).order("numero")
      : Promise.resolve({ data: [] as { numero: string }[] }),
  ]);

  const cargos = (cargosRes.data ?? []).map((c) => ({
    ...c,
    monto: Number(c.monto),
    monto_pagado: Number(c.monto_pagado),
    descuento_pronto_pago: Number(c.descuento_pronto_pago),
  }));
  const items = itemsRes.data ?? [];
  const nombrePorUsuario = new Map((perfilesRes.data ?? []).map((p) => [p.user_id, p.nombre]));
  const nombreUsuario = (userId: string | null | undefined) =>
    userId ? (nombrePorUsuario.get(userId) ?? "—") : "—";

  // Deuda exigible hoy y semáforo (B3): verde al día · ámbar en término · rojo vencido.
  const deuda = cargos
    .filter((c) => c.estado === "pendiente" || c.estado === "parcial")
    .reduce((acc, c) => acc + saldoCargo(c), 0);
  const { deudaVencida, vencidoDesde } = resumenDeudaActiva(cargos, hoy);
  const saldoFavor = Number(saldoFavorRes.data?.saldo_favor ?? 0);
  const tieneSaldoFavor = saldoFavor > 0.009;
  const nivel = nivelDeuda({ deuda, deudaVencida, saldoFavor });
  const debe = deuda > 0.009;

  // Cambios de este cliente que esperan aprobación + rechazados en los últimos 15 días.
  const cambiosRaw = cambiosRes.data ?? [];
  const cambios: CambioDeCliente[] = [...cambiosRaw, ...(rechazadosRes.data ?? [])].map((c) => ({
    id: c.id,
    resumen: c.resumen,
    estado: c.estado,
    solicitadoPor: nombreUsuario(c.solicitado_por),
    solicitadoEn: c.solicitado_en,
    revisadoPor: c.revisado_por ? nombreUsuario(c.revisado_por) : null,
    revisadoEn: c.revisado_en,
    motivoRechazo: c.motivo_rechazo,
  }));
  const cambiosPendientes = cambios.filter((c) => c.estado === "pendiente");
  const cambiosRechazados = cambios.filter((c) => c.estado === "rechazado");

  // "Qué paga": lo que ya pidió y espera al Líder no se puede volver a mandar (ni duplicar
  // pedidos en Aprobaciones): altas pendientes por concepto y filas con un cambio pendiente.
  const conceptoPendiente = new Map<string, number>();
  const itemsConCambio = new Set<string>();
  let cuotasPedidas: number | null = null;
  for (const c of cambiosRaw) {
    const datos = (c.datos ?? {}) as { concepto_id?: string; cantidad?: number | string; cuotas_mes?: number | string };
    if (c.entidad === "cliente_concepto") {
      if (c.entidad_id) itemsConCambio.add(c.entidad_id);
      else if (datos.concepto_id) conceptoPendiente.set(datos.concepto_id, Number(datos.cantidad ?? 1) || 1);
    } else if (c.entidad === "cliente" && datos.cuotas_mes !== undefined && cuotasPedidas === null) {
      cuotasPedidas = Number(datos.cuotas_mes) || null;
    }
  }

  // Qué paga: lo mensual (sin energía, que va en Medidores) y lo que el rol puede sumar.
  const itemsConceptos = items
    .filter((i) => i.conceptos && i.conceptos.tipo === "recurrente")
    .map((i) => ({
      id: i.id,
      cantidad: Number(i.cantidad),
      activo: i.activo,
      codigo: i.conceptos?.codigo ?? "?",
      nombre: i.conceptos?.nombre ?? "Concepto",
      precio: Number(i.conceptos?.precio ?? 0),
      descuentoPp: Number(i.conceptos?.descuento_pronto_pago ?? 0),
      segmento: i.conceptos?.segmento ?? null,
      pendiente: itemsConCambio.has(i.id),
    }));
  const asignados = new Set(items.map((i) => i.concepto_id));
  const catalogo = conceptosRes.data ?? [];
  // Altas que esperan aprobación: se ven en la lista con su sello, no como chip para agregar.
  const altasPendientes = catalogo
    .filter((c) => c.tipo === "recurrente" && conceptoPendiente.has(c.id) && !asignados.has(c.id))
    .map((c) => ({
      id: c.id,
      codigo: c.codigo,
      nombre: c.nombre,
      precio: Number(c.precio),
      cantidad: conceptoPendiente.get(c.id) ?? 1,
    }));
  const disponibles = catalogo
    .filter(
      (c) =>
        !asignados.has(c.id) && !conceptoPendiente.has(c.id) && conceptoAsignablePorRol(c, perfil.rol)
    )
    .filter((c) => conceptoSigueConCategoria(c.segmento, categoria))
    .map((c) => ({
      id: c.id,
      codigo: c.codigo,
      nombre: c.nombre,
      precio: Number(c.precio),
      descuentoPp: Number(c.descuento_pronto_pago),
      segmento: c.segmento,
    }));
  const precioAmbulante = catalogo.find((c) => c.codigo === "AMB")?.precio ?? null;

  // URLs firmadas (1 h) para ver los documentos.
  const documentos = documentosRes.data ?? [];
  const urlPorRuta = new Map<string, string>();
  if (documentos.length > 0) {
    const { data: firmadas } = await supabase.storage
      .from("documentos")
      .createSignedUrls(
        documentos.map((d) => d.storage_path),
        3600
      );
    for (const f of firmadas ?? []) {
      if (f.path && f.signedUrl) urlPorRuta.set(f.path, f.signedUrl);
    }
  }
  const categoriasUsadas = [
    ...new Set((categoriasUsadasRes.data ?? []).map((d) => labelCategoria(d.categoria)).filter((c) => c !== "Otro")),
  ].sort((a, b) => a.localeCompare(b, "es"));

  // Cargos agrupados por período (más nuevo arriba: ya vienen ordenados).
  const cargosPorPeriodo = new Map<string, typeof cargos>();
  for (const c of cargos) {
    const lista = cargosPorPeriodo.get(c.periodo);
    if (lista) lista.push(c);
    else cargosPorPeriodo.set(c.periodo, [c]);
  }

  const contacto = [
    cliente.apodo ? `Le dicen “${cliente.apodo}”` : null,
    categoria === "ambulante" ? null : LABEL_TIPO_PERSONA[cliente.tipo_persona],
    cliente.cuit ? `${categoria === "ambulante" ? "DNI" : "CUIT/DNI"} ${cliente.cuit}` : null,
    cliente.telefono,
    cliente.email,
    cliente.direccion,
  ]
    .filter(Boolean)
    .join(" · ");

  // Dónde está en el plano y si factura espacios (EXME, EXPP, EXPL, EXPE).
  const espaciosPlano = (espaciosRes.data ?? [])
    .filter((e): e is typeof e & { tipo: TipoEspacio } =>
      ["puesto", "bar", "local", "contenedor"].includes(e.tipo)
    )
    .map((e) => ({ ...e, x: Number(e.x), y: Number(e.y) }));
  const facturaPuestos = items.some(
    (i) => i.activo && ["EXME", "EXPP", "EXPL", "EXPE"].includes(i.conceptos?.codigo ?? "")
  );
  // Cocheras (EXPC) y galpones (EXPG) no se marcan en el plano, pero la línea "dónde está" los
  // nombra igual: si no, dice menos que su carpeta y que la lista de Clientes.
  const facturado = (codigo: string) =>
    items
      .filter((i) => i.activo && i.conceptos?.codigo === codigo)
      .reduce((acc, i) => acc + Number(i.cantidad), 0);
  const sinLugar = { cocheras: facturado("EXPC"), galpones: facturado("EXPG") };
  const quinteroActivo = categoria === "quintero" && cliente.activo;
  // "Puestos 58 · 60" (o "Puesto 58 · Local 3"): se liberan al darlo de baja o pasarlo a ambulante.
  const lugaresAviso: { tipo: TipoEspacio; numero: string | null; medio: boolean; propio: boolean }[] = esJefe
    ? (lugaresJefeRes.data ?? []).filter((e): e is typeof e & { tipo: TipoEspacio } =>
        ["puesto", "bar", "local", "contenedor"].includes(e.tipo)
      )
    : espaciosPlano;
  const lugaresTexto =
    lugaresAviso.length === 0
      ? null
      : new Set(lugaresAviso.map((e) => e.tipo)).size === 1
        ? etiquetaEspacios(lugaresAviso)
        : lugaresAviso.map((e) => etiquetaEspacio(e)).join(" · ");
  // Medidores activos: al pasar a ambulante se desactivan (0024), y el formulario lo avisa.
  const medidoresActivos = esJefe
    ? (medidoresJefeRes.data ?? []).map((m) => m.numero)
    : (energia?.medidores ?? []).filter((m) => m.activo).map((m) => m.numero);
  // Lo mensual que factura hoy (para avisar qué deja de facturarse si cambia de categoría).
  const conceptosActivos = itemsConceptos
    .filter((i) => i.activo)
    .map((i) => ({ codigo: i.codigo, nombre: i.nombre, segmento: i.segmento }));

  const puedeCobrar = ROLES_COBRAN.includes(perfil.rol);
  const puedeRegistrar = perfil.rol === "admin" || perfil.rol === "lider";
  const puedeDeudaAnterior = perfil.rol === "admin" || perfil.rol === "lider";

  const solapas = [
    { valor: "cuenta", label: "Cuenta" },
    { valor: "paga", label: "Qué paga" },
    { valor: "documentos", label: "Documentos" },
    ...(puedeRegistrar ? [{ valor: "registros", label: "Registros" }] : []),
    ...(veEnergia ? [{ valor: "medidores", label: "Medidores" }] : []),
  ];
  const solapaInicial = solapas.some((p) => p.valor === tab) ? (tab as string) : "cuenta";

  return (
    <div className="space-y-8">
      <div className="space-y-5">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Codigo codigo={`N° ${cliente.codigo}`} />
            <ChipCategoria categoria={categoria} className="py-1 text-sm" />
            {cliente.es_socio ? <Sello estado="socio" /> : null}
            {!cliente.activo ? <Sello estado="inactivo" texto="Dado de baja" /> : null}
            <Sello estado={SELLO_NIVEL_DEUDA[nivel]} />
            {cambiosPendientes.length > 0 ? <Sello estado="pendiente_aprobacion" /> : null}
          </div>
          <PageHeader titulo={cliente.nombre} descripcion={contacto} className="pb-2">
            {puedeCobrar && cliente.activo ? (
              <Button asChild size="lg" className="h-12 px-6 text-base font-semibold">
                <Link href={`/cobranza/${cliente.id}`}>
                  <HandCoins className="size-5" />
                  Cobrar
                </Link>
              </Button>
            ) : null}
            {!debe ? (
              <Button asChild variant="outline" size="lg" className="h-12 px-5 text-base">
                <Link href={`/libre-deuda/${cliente.id}`}>
                  <FileCheck className="size-5" />
                  Libre deuda
                </Link>
              </Button>
            ) : null}
            <EditarClienteDialog
              cliente={{
                ...cliente,
                categoria,
                tipo_persona: cliente.tipo_persona,
              }}
              rol={perfil.rol}
              conceptosActivos={conceptosActivos}
              lugaresTexto={lugaresTexto}
              medidoresActivos={medidoresActivos}
            />
            <BajaCliente
              clienteId={cliente.id}
              nombre={cliente.nombre}
              activo={cliente.activo}
              rol={perfil.rol}
              lugaresTexto={lugaresTexto}
            />
          </PageHeader>
          {/* El Jefe no lee el plano con puesteros, pero sí ve a sus quinteros en la zona de
              quinteros del mapa de Portería (lo enfoca con ?cliente=). Dado de baja: el mapa no lo
              carga y sus conceptos siguen activos pero ya no se facturan, así que no se nombran. */}
          {!esJefe || quinteroActivo ? (
            <EnElPlano
              clienteId={cliente.id}
              espacios={espaciosPlano}
              facturaPuestos={facturaPuestos && cliente.activo}
              puedeUbicar={perfil.rol === "admin" || perfil.rol === "lider"}
              quintero={quinteroActivo}
              sinLugar={cliente.activo ? sinLugar : undefined}
            />
          ) : null}
        </div>

        {/* Debe hoy + Saldo a favor: el número que importa, grande */}
        <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Debe hoy</p>
            <p
              className={cn(
                "text-3xl font-bold tabular",
                nivel === "vencido" ? "text-pendiente" : nivel === "en_termino" ? "text-parcial" : "text-pagado"
              )}
            >
              {formatARS(deuda)}
            </p>
            {deudaVencida > 0.009 && vencidoDesde ? (
              <p className="text-sm font-medium text-pendiente">
                <Money monto={deudaVencida} /> vencido desde el {formatFecha(vencidoDesde)}
              </p>
            ) : null}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Saldo a favor</p>
            <Money
              monto={saldoFavor}
              className={cn(
                "block text-3xl font-bold",
                tieneSaldoFavor ? "text-pagado" : "text-muted-foreground/60"
              )}
            />
          </div>
          {tieneSaldoFavor && debe ? (
            <AplicarSaldoFavor clienteId={cliente.id} saldoFavor={saldoFavor} deuda={deuda} />
          ) : null}
        </div>

        <BannerDeuda cargos={cargos} hoy={hoy} />

        <CambiosPendientesCliente
          pendientes={cambiosPendientes}
          rechazados={cambiosRechazados}
          esLider={esLider}
        />
      </div>

      <Tabs defaultValue={solapaInicial}>
        <TabsList className="h-auto! w-full flex-wrap justify-start gap-1 p-1">
          {solapas.map((p) => (
            <TabsTrigger key={p.valor} value={p.valor} className="h-11 flex-none px-4 text-sm font-medium">
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ------------------------------------------------ Cuenta */}
        <TabsContent value="cuenta" className="space-y-6 pt-4 text-base">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <BotonExportar
              dataset="cuenta_corriente"
              extra={{ cliente: cliente.id }}
              label="Cuenta corriente de la carpeta (.xlsx)"
            />
            {puedeDeudaAnterior ? <DeudaAnterior clienteId={cliente.id} fechaHoy={hoy} /> : null}
          </div>
          {cargos.length === 0 ? (
            <EmptyState
              icono={ReceiptText}
              titulo="Todavía no tiene cargos"
              descripcion={
                categoria === "ambulante"
                  ? "Se le cobra por día: cada cobro deja su cargo y su recibo acá."
                  : "Se generan solos con la facturación mensual, según lo que paga."
              }
            />
          ) : (
            Array.from(cargosPorPeriodo.entries()).map(([periodo, lista]) => (
              <Card key={periodo} className="text-base">
                <CardHeader>
                  <CardTitle className="text-lg">{labelPeriodo(periodo)}</CardTitle>
                  <CardAction>
                    <p className="text-sm text-muted-foreground">
                      Vence el {formatFecha(lista[0].vencimiento)}
                    </p>
                  </CardAction>
                </CardHeader>
                <CardContent className="divide-y">
                  {lista.map((c) => {
                    const saldo = saldoCargo(c);
                    const anulado = c.estado === "anulado";
                    const cargadoAMano = c.origen === "deuda" || c.origen === "manual";
                    const beneficio = beneficioDelCargo(c, saldo);
                    return (
                      // Celular: código + descripción arriba y el saldo con su sello abajo a la
                      // derecha (en TODAS las filas, larga o corta). Desde tablet: saldo a la derecha.
                      <div
                        key={c.id}
                        className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-x-4"
                      >
                        <Codigo codigo={c.codigo} className="mt-0.5 self-start sm:mt-0 sm:self-center" />
                        <div className="min-w-0">
                          <p className={cn("font-medium break-words", anulado && "text-muted-foreground line-through")}>
                            <DescripcionCargo texto={c.descripcion} />
                          </p>
                          {/* La cuenta de la fila, en pedazos que no se parten: importe − beneficio − pagado = saldo. */}
                          <p className="text-sm text-muted-foreground tabular">
                            <span className="whitespace-nowrap">{formatARS(c.monto)}</span>
                            {beneficio > 0.009 ? (
                              <>
                                {" · "}
                                <span className="whitespace-nowrap">
                                  beneficio en término −{formatARS(beneficio)}
                                </span>
                              </>
                            ) : null}
                            {" · "}
                            <span className="whitespace-nowrap">pagado {formatARS(c.monto_pagado)}</span>
                          </p>
                          {cargadoAMano && c.creado_por ? (
                            <p className="text-sm text-muted-foreground">
                              Cargó {nombreUsuario(c.creado_por)} · {formatFechaHora(c.creado_en)}
                            </p>
                          ) : null}
                          {anulado && c.anulado_en ? (
                            <p className="text-sm break-words text-muted-foreground">
                              Anuló {nombreUsuario(c.anulado_por)} · {formatFechaHora(c.anulado_en)}
                              {c.anulado_motivo ? ` · ${c.anulado_motivo}` : ""}
                            </p>
                          ) : null}
                        </div>
                        <div className="col-start-2 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 sm:col-start-3 sm:flex-col sm:items-end sm:gap-1">
                          <p className="text-right whitespace-nowrap">
                            <span className="text-sm text-muted-foreground">Saldo </span>
                            <Money
                              monto={saldo}
                              className={cn("font-semibold", saldo > 0 ? "text-pendiente" : "text-pagado")}
                            />
                          </p>
                          <Sello estado={estadoCargo(c, hoy)} />
                        </div>
                        {puedeDeudaAnterior && cargadoAMano && !anulado ? (
                          <div className="col-span-full flex justify-end">
                            <AnularDeuda
                              cargoId={c.id}
                              clienteId={cliente.id}
                              descripcion={c.descripcion}
                              monto={c.monto}
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))
          )}

          <PagosRecibidos
            pagos={(pagosRes.data ?? []).map((p) => ({
              id: p.id,
              numero: p.numero,
              lote_id: p.lote_id,
              linea: p.linea,
              fecha: p.fecha,
              medio: p.medio,
              monto: Number(p.monto),
              recibido_por: p.recibido_por,
              anulado: p.anulado,
              motivo_anulacion: p.motivo_anulacion,
              titular_transferencia: p.titular_transferencia,
              imputado: (p.imputaciones ?? []).reduce((acc, i) => acc + Number(i.monto), 0),
            }))}
            nombreUsuario={nombreUsuario}
          />
        </TabsContent>

        {/* ------------------------------------------------ Qué paga */}
        <TabsContent value="paga" className="pt-4 text-base">
          <ConceptosCliente
            clienteId={cliente.id}
            categoria={categoria}
            cuotasMes={cliente.cuotas_mes}
            items={itemsConceptos}
            disponibles={disponibles}
            altasPendientes={altasPendientes}
            cuotasPedidas={cuotasPedidas}
            rol={perfil.rol}
            precioAmbulante={precioAmbulante !== null ? Number(precioAmbulante) : null}
          />
        </TabsContent>

        {/* ------------------------------------------------ Documentos */}
        <TabsContent value="documentos" className="pt-4 text-base">
          <DocumentosCliente
            clienteId={cliente.id}
            documentos={documentos.map((d) => ({
              id: d.id,
              titulo: d.titulo,
              categoria: d.categoria,
              creado_en: d.creado_en,
              subidoPor: nombreUsuario(d.subido_por),
              url: urlPorRuta.get(d.storage_path) ?? null,
            }))}
            usadas={categoriasUsadas}
            puedeBorrar
          />
        </TabsContent>

        {/* ------------------------------------------------ Registros (M5) */}
        {puedeRegistrar ? (
          <TabsContent value="registros" className="space-y-6 pt-4 text-base">
            <RegistrosCliente clienteId={cliente.id} puedeRegistrar={puedeRegistrar} />
            <CircularesCliente clienteId={cliente.id} />
          </TabsContent>
        ) : null}

        {/* ------------------------------------------------ Medidores */}
        {energia ? (
          <TabsContent value="medidores" className="pt-4 text-base">
            <MedidoresCliente
              clienteId={cliente.id}
              medidores={energia.medidores}
              espaciosCliente={espaciosPlano.map((e) => e.id)}
              abono={energia.abono}
              rol={perfil.rol}
              ambulante={categoria === "ambulante"}
            />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
