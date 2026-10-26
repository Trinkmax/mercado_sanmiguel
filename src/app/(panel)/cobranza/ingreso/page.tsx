import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatFecha, hoyISO } from "@/lib/format";
import { diaAnteriorValido } from "@/lib/dia-caja";
import { PageHeader } from "@/components/shared/page-header";
import { CobroIngreso } from "@/components/cobranza/cobro-ingreso";
import {
  AvisoCajaCerrada,
  AvisoDiaAnterior,
  cajaAnteriorNoDejaCobrar,
  cajaNoDejaCobrar,
  type CajaDeHoy,
} from "@/components/cobranza/aviso-caja";
import { IngresosDelDia } from "@/components/caja/ingresos-caja";
import type { IngresoCaja } from "@/components/caja/datos";

export const metadata = { title: "Cobrar sin cliente" };

type Sp = Promise<{ concepto?: string | string[]; fecha?: string | string[] }>;

function primero(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * /cobranza/ingreso                 → lo que entra sin ser el cobro de un cliente (venta de
 *                                     vacíos y tarimas…, 0053), en la caja de administración de hoy.
 * /cobranza/ingreso?concepto=VVT    → con ese concepto elegido (código o id).
 * /cobranza/ingreso?fecha=…         → carga atrasada: en la caja de ese día anterior.
 * Administración y el Líder.
 */
export default async function CobroIngresoPage({ searchParams }: { searchParams: Sp }) {
  const perfil = await requireRol("admin", "lider");
  const params = await searchParams;
  const hoy = hoyISO();
  const diaCaja = diaAnteriorValido(primero(params.fecha), hoy);
  const fechaCaja = diaCaja ?? hoy;
  const conceptoPedido = primero(params.concepto);

  const supabase = await createClient();
  const [conceptosRes, cajaRes] = await Promise.all([
    supabase
      .from("conceptos")
      .select("id, codigo, nombre")
      .eq("org_id", perfil.org_id)
      .eq("tipo", "ingreso")
      .eq("activo", true)
      .order("orden_imputacion")
      .order("nombre"),
    supabase
      .from("cajas")
      .select("id, estado, reapertura_solicitada_en")
      .eq("org_id", perfil.org_id)
      .eq("tipo", "administracion")
      .eq("fecha", fechaCaja)
      .maybeSingle(),
  ]);
  const conceptos = conceptosRes.data ?? [];
  const caja = cajaRes.data;

  // Lo cobrado sin cliente en esa caja (con quién lo cobró).
  const { data: filas } = caja
    ? await supabase
        .from("ingresos_varios")
        .select("id, numero, creado_en, creado_por, concepto_nombre, detalle, monto, medio, titular_transferencia, anulado, motivo_anulacion")
        .eq("caja_id", caja.id)
        .order("creado_en", { ascending: true })
    : { data: [] };
  const ids = [...new Set((filas ?? []).map((f) => f.creado_por).filter((v): v is string => Boolean(v)))];
  const { data: perfiles } =
    ids.length > 0 ? await supabase.from("perfiles").select("user_id, nombre").in("user_id", ids) : { data: [] };
  const nombre = new Map((perfiles ?? []).map((p) => [p.user_id, p.nombre]));
  const ingresos: IngresoCaja[] = (filas ?? []).map((f) => ({
    id: f.id,
    numero: Number(f.numero),
    creadoEn: f.creado_en,
    creadoPor: f.creado_por,
    creadoPorNombre: f.creado_por ? (nombre.get(f.creado_por) ?? null) : null,
    concepto: f.concepto_nombre,
    detalle: f.detalle,
    monto: Number(f.monto),
    medio: f.medio === "transferencia" ? "transferencia" : "efectivo",
    titular: f.titular_transferencia,
    anulado: f.anulado,
    motivoAnulacion: f.motivo_anulacion,
  }));

  const cajaDelDia: CajaDeHoy = caja
    ? { estado: caja.estado, reaperturaPedida: Boolean(caja.reapertura_solicitada_en) }
    : null;
  const noDejaCobrar = diaCaja ? cajaAnteriorNoDejaCobrar(cajaDelDia) : cajaNoDejaCobrar(cajaDelDia);
  // Administración anula con su caja abierta; el Líder, hasta que Tesorería la valida.
  const puedeAnular = caja
    ? perfil.rol === "lider"
      ? caja.estado !== "validada"
      : caja.estado === "abierta"
    : false;

  const elegido =
    conceptos.find((c) => c.id === conceptoPedido) ??
    conceptos.find((c) => c.codigo.toLowerCase() === (conceptoPedido ?? "").toLowerCase()) ??
    null;
  const titulo = conceptos.length === 1 ? conceptos[0].nombre : "Cobrar sin cliente";
  const sufijo = diaCaja ? `?fecha=${diaCaja}` : "";

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/cobranza${sufijo}`}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" strokeWidth={2} />
          Volver a Cobrar
        </Link>
        <PageHeader
          titulo={titulo}
          descripcion={
            diaCaja
              ? `Lo que entra sin ser el cobro de un cliente. Va a la caja de administración del ${formatFecha(diaCaja)}.`
              : "Lo que entra sin ser el cobro de un cliente (no se le carga a nadie). Va a la caja de administración de hoy."
          }
          className="pb-0"
        />
      </div>

      {diaCaja ? (
        <AvisoDiaAnterior
          fecha={diaCaja}
          caja={cajaDelDia}
          rol={perfil.rol}
          volverAHoy={`/cobranza/ingreso${elegido ? `?concepto=${elegido.codigo}` : ""}`}
          className="-mt-4"
        />
      ) : (
        <AvisoCajaCerrada caja={cajaDelDia} rol={perfil.rol} className="-mt-4" />
      )}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] xl:items-start">
        <CobroIngreso
          key={fechaCaja}
          conceptos={conceptos}
          conceptoInicial={elegido?.id ?? null}
          fechaCaja={diaCaja ?? undefined}
          bloqueo={noDejaCobrar ? { titulo: "No se puede cobrar: la caja no está abierta (mirá el aviso de arriba)." } : null}
        />
        <section className="space-y-4" aria-labelledby="titulo-ingresos-dia">
          <div className="space-y-0.5">
            <h2 id="titulo-ingresos-dia" className="font-display text-xl font-bold tracking-tight">
              {diaCaja ? `Cobrado sin cliente el ${formatFecha(diaCaja)}` : "Cobrado sin cliente hoy"}
            </h2>
            <p className="text-sm text-muted-foreground">Entra en la caja de administración y en sus totales.</p>
          </div>
          <IngresosDelDia ingresos={ingresos} puedeAnular={puedeAnular} esHoy={!diaCaja} />
        </section>
      </div>
    </div>
  );
}
