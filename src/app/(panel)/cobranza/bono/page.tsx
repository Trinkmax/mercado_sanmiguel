import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatFecha, hoyISO } from "@/lib/format";
import { diaAnteriorValido } from "@/lib/dia-caja";
import { PageHeader } from "@/components/shared/page-header";
import { CanonTransporte, type PuestoPlano } from "@/components/porteria/canon-transporte";
import { CanonDelDia } from "@/components/porteria/canon-del-dia";
import { SELECT_CANON_ENTRADA, aCanonEntrada, aTarifaTransporte } from "@/components/porteria/tarifas";
import {
  AvisoCajaCerrada,
  AvisoDiaAnterior,
  cajaAnteriorNoDejaCobrar,
  cajaNoDejaCobrar,
  type CajaDeHoy,
} from "@/components/cobranza/aviso-caja";

export const metadata = { title: "Bono camioneros" };

type Sp = Promise<{ fecha?: string | string[] }>;

function primero(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * /cobranza/bono           → Administración cobra el bono camioneros (canon de transporte,
 *                            0052) en SU caja de hoy: el mismo talonario que Portería.
 * /cobranza/bono?fecha=…   → carga atrasada: en la caja de administración de ese día anterior.
 * Portería y el Líder lo siguen cobrando en /porteria (caja de portería).
 */
export default async function BonoAdministracionPage({ searchParams }: { searchParams: Sp }) {
  const perfil = await requireRol("admin");
  const params = await searchParams;
  const hoy = hoyISO();
  const diaCaja = diaAnteriorValido(primero(params.fecha), hoy);
  const fechaCaja = diaCaja ?? hoy;

  const supabase = await createClient();
  const [tarifasRes, planoRes, cajaRes] = await Promise.all([
    supabase
      .from("tarifas_transporte")
      .select("id, nombre, precio, unidad, icono, orden, activo")
      .eq("org_id", perfil.org_id)
      .order("orden", { ascending: true }),
    supabase.rpc("espacios_del_plano"),
    supabase
      .from("cajas")
      .select("id, estado, reapertura_solicitada_en")
      .eq("org_id", perfil.org_id)
      .eq("tipo", "administracion")
      .eq("fecha", fechaCaja)
      .maybeSingle(),
  ]);
  const caja = cajaRes.data;

  const { data: filas } = caja
    ? await supabase
        .from("canon_camiones")
        .select(SELECT_CANON_ENTRADA)
        .eq("caja_id", caja.id)
        .order("creado_en", { ascending: false })
    : { data: [] };
  const ids = [...new Set((filas ?? []).map((f) => f.creado_por).filter((v): v is string => Boolean(v)))];
  const { data: perfiles } =
    ids.length > 0 ? await supabase.from("perfiles").select("user_id, nombre").in("user_id", ids) : { data: [] };
  const nombres = new Map((perfiles ?? []).map((p) => [p.user_id, p.nombre]));
  const entradas = (filas ?? []).map((f) => aCanonEntrada(f, nombres));

  const tarifas = (tarifasRes.data ?? []).map(aTarifaTransporte);
  const puestos: PuestoPlano[] = ((planoRes.data ?? []) as { tipo: string; numero: string | null; medio: boolean }[])
    .filter((e) => e.tipo === "puesto" && e.numero)
    .map((e) => ({ numero: String(e.numero), medio: Boolean(e.medio) }));

  const cajaDelDia: CajaDeHoy = caja
    ? { estado: caja.estado, reaperturaPedida: Boolean(caja.reapertura_solicitada_en) }
    : null;
  const noDejaCobrar = diaCaja ? cajaAnteriorNoDejaCobrar(cajaDelDia) : cajaNoDejaCobrar(cajaDelDia);
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
          titulo="Bono camioneros"
          descripcion={
            diaCaja
              ? `El canon de transporte, como en la garita. Va a la caja de administración del ${formatFecha(diaCaja)}.`
              : "El canon de transporte, como en la garita. Lo que cobres acá va a tu caja de hoy (no a la de portería)."
          }
          className="pb-0"
        />
      </div>

      {diaCaja ? (
        <AvisoDiaAnterior
          fecha={diaCaja}
          caja={cajaDelDia}
          rol={perfil.rol}
          volverAHoy="/cobranza/bono"
          className="-mt-4"
        />
      ) : (
        <AvisoCajaCerrada caja={cajaDelDia} rol={perfil.rol} className="-mt-4" />
      )}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] xl:items-start">
        <CanonTransporte
          key={fechaCaja}
          tarifas={tarifas.filter((t) => t.activo)}
          puestos={puestos}
          fecha={diaCaja ?? undefined}
          bloqueo={noDejaCobrar ? { titulo: "No se puede cobrar: la caja no está abierta (mirá el aviso de arriba)." } : null}
        />
        <section className="space-y-4" aria-labelledby="titulo-bono-dia">
          <div className="space-y-0.5">
            <h2 id="titulo-bono-dia" className="font-display text-xl font-bold tracking-tight">
              {diaCaja ? `Bono cobrado el ${formatFecha(diaCaja)}` : "Bono cobrado hoy en Administración"}
            </h2>
            <p className="text-sm text-muted-foreground">
              El de la garita va a la caja de portería; este, a la de administración.
            </p>
          </div>
          <CanonDelDia
            entradas={entradas}
            modo={caja?.estado === "abierta" ? "jefe" : "lectura"}
            cajaAbierta={caja?.estado === "abierta"}
            cajaValidada={caja?.estado === "validada"}
            miUserId={perfil.user_id}
            esHoy={!diaCaja}
            tarifas={tarifas}
            textoVacio="Cuando cobres el primero, aparece acá con su número."
          />
        </section>
      </div>
    </div>
  );
}
