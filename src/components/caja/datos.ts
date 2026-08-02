import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Perfil } from "@/lib/auth";
import { hoyISO } from "@/lib/format";
import type { Enums, Tables } from "@/lib/database.types";
import type { MedioPago } from "@/components/caja/medios";

export type TipoCaja = Enums<"tipo_caja">;
export type Caja = Tables<"cajas">;

export type CobroDia = {
  id: string;
  numero: number;
  monto: number;
  medio: MedioPago;
  fecha: string;
  anulado: boolean;
  motivo_anulacion: string | null;
  cliente: { nombre: string; codigo: number } | null;
};

export type CanonDia = {
  id: string;
  cantidad: number;
  monto: number;
  medio: MedioPago;
  notas: string | null;
  creado_en: string;
};

export type GastoCaja = {
  id: string;
  descripcion: string;
  monto: number;
  medio_pago: MedioPago | null;
  rubro: { codigo: string; nombre: string } | null;
};

export type CajaPrevia = {
  id: string;
  fecha: string;
  estado: Enums<"estado_caja">;
  total_efectivo: number | null;
  total_transferencia: number | null;
  total_cheques: number | null;
};

export type TotalesCaja = {
  efectivo: number;
  transferencia: number;
  cheques: number;
  canon: number;
  gastos: number;
};

export type DatosCaja = {
  tipo: TipoCaja;
  caja: Caja | null;
  cobros: CobroDia[];
  canon: CanonDia[];
  gastos: GastoCaja[];
  precioCanon: number;
  previas: CajaPrevia[];
  validadaPorNombre: string | null;
  totales: TotalesCaja;
};

function sumar<T>(filas: T[], filtro: (f: T) => boolean, monto: (f: T) => number) {
  return filas.reduce((acc, f) => (filtro(f) ? acc + Number(monto(f)) : acc), 0);
}

/** Junta todo lo que necesita la pantalla de la caja de un tipo, para hoy. */
export async function cargarDatosCaja(
  perfil: Perfil,
  tipo: TipoCaja
): Promise<DatosCaja> {
  const supabase = await createClient();
  const hoy = hoyISO();

  const { data: caja } = await supabase
    .from("cajas")
    .select("*")
    .eq("org_id", perfil.org_id)
    .eq("tipo", tipo)
    .eq("fecha", hoy)
    .maybeSingle();

  const [cobrosRes, canonRes, gastosRes, configRes, previasRes, validadaRes] =
    await Promise.all([
      caja
        ? supabase
            .from("pagos")
            .select(
              "id, numero, monto, medio, fecha, anulado, motivo_anulacion, cliente:clientes(nombre, codigo)"
            )
            .eq("caja_id", caja.id)
            .order("fecha", { ascending: true })
        : Promise.resolve({ data: null }),
      caja && tipo === "guardia"
        ? supabase
            .from("canon_camiones")
            .select("id, cantidad, monto, medio, notas, creado_en")
            .eq("caja_id", caja.id)
            .order("creado_en", { ascending: true })
        : Promise.resolve({ data: null }),
      // El guardia no tiene permiso de lectura sobre gastos (y su caja no paga gastos).
      caja && perfil.rol !== "guardia"
        ? supabase
            .from("gastos")
            .select(
              "id, descripcion, monto, medio_pago, rubro:rubros_gasto(codigo, nombre)"
            )
            .eq("caja_id", caja.id)
            .eq("estado", "pagado")
            .order("creado_en", { ascending: true })
        : Promise.resolve({ data: null }),
      tipo === "guardia"
        ? supabase
            .from("configuracion")
            .select("precio_canon_camion")
            .eq("org_id", perfil.org_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("cajas")
        .select(
          "id, fecha, estado, total_efectivo, total_transferencia, total_cheques"
        )
        .eq("org_id", perfil.org_id)
        .eq("tipo", tipo)
        .lt("fecha", hoy)
        .order("fecha", { ascending: false })
        .limit(7),
      caja?.estado === "validada" && caja.validada_por
        ? supabase
            .from("perfiles")
            .select("nombre")
            .eq("user_id", caja.validada_por)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const cobros: CobroDia[] = (cobrosRes.data ?? []).map((p) => ({
    id: p.id,
    numero: Number(p.numero),
    monto: Number(p.monto),
    medio: p.medio,
    fecha: p.fecha,
    anulado: p.anulado,
    motivo_anulacion: p.motivo_anulacion,
    cliente: p.cliente ?? null,
  }));

  const canon: CanonDia[] = (canonRes.data ?? []).map((c) => ({
    id: c.id,
    cantidad: Number(c.cantidad),
    monto: Number(c.monto),
    medio: c.medio,
    notas: c.notas,
    creado_en: c.creado_en,
  }));

  const gastos: GastoCaja[] = (gastosRes.data ?? []).map((g) => ({
    id: g.id,
    descripcion: g.descripcion,
    monto: Number(g.monto),
    medio_pago: g.medio_pago,
    rubro: g.rubro ?? null,
  }));

  // Totales por medio: en vivo si está abierta; congelados si ya cerró.
  // Mismo criterio que la RPC cerrar_caja: el canon suma a su medio y los
  // gastos pagados en efectivo desde esta caja se restan del efectivo.
  let totales: TotalesCaja;
  if (caja && caja.estado !== "abierta") {
    totales = {
      efectivo: Number(caja.total_efectivo ?? 0),
      transferencia: Number(caja.total_transferencia ?? 0),
      cheques: Number(caja.total_cheques ?? 0),
      canon: Number(caja.total_canon ?? 0),
      gastos: Number(caja.total_gastos ?? 0),
    };
  } else {
    const vigentes = cobros.filter((c) => !c.anulado);
    const gastosEfectivo = sumar(
      gastos,
      (g) => g.medio_pago === "efectivo",
      (g) => g.monto
    );
    totales = {
      efectivo:
        sumar(vigentes, (c) => c.medio === "efectivo", (c) => c.monto) +
        sumar(canon, (c) => c.medio === "efectivo", (c) => c.monto) -
        gastosEfectivo,
      transferencia:
        sumar(vigentes, (c) => c.medio === "transferencia", (c) => c.monto) +
        sumar(canon, (c) => c.medio === "transferencia", (c) => c.monto),
      cheques: sumar(vigentes, (c) => c.medio === "cheque", (c) => c.monto),
      canon: sumar(canon, () => true, (c) => c.monto),
      gastos: gastosEfectivo,
    };
  }

  return {
    tipo,
    caja: caja ?? null,
    cobros,
    canon,
    gastos,
    precioCanon: Number(configRes.data?.precio_canon_camion ?? 0),
    previas: (previasRes.data ?? []) as CajaPrevia[],
    validadaPorNombre: validadaRes.data?.nombre ?? null,
    totales,
  };
}
