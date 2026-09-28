/**
 * Canon de transporte (bono camioneros, código BC): tipos, íconos, textos y helpers
 * compartidos por Portería (/porteria), la caja de portería (M2) y Configuración (M8).
 * TS puro: sirve en server y client. Contrato: docs/FASE3-CONTRATO.md §6 M3 / §6.10.
 */
import {
  Banknote,
  Caravan,
  Container,
  Smartphone,
  SquareParking,
  Truck,
  Van,
  type LucideIcon,
} from "lucide-react";
import { formatARS } from "@/lib/format";

export type UnidadTarifa = "vehiculo" | "dia";
export type IconoTarifa = "camioneta" | "camion" | "balancin" | "equipo" | "estadia";
export type DestinoCanon = "puesto" | "verdulero" | "ambulante";
export type MedioCanon = "efectivo" | "transferencia";

export type TarifaTransporte = {
  id: string;
  nombre: string;
  precio: number;
  unidad: UnidadTarifa;
  icono: IconoTarifa;
  orden: number;
  activo: boolean;
};

export type CanonEntrada = {
  id: string;
  numero: number;
  creado_en: string;
  creado_por: string | null;
  creadoPorNombre: string | null;
  tarifa_nombre: string | null;
  unidad: UnidadTarifa | null;
  cantidad: number;
  precio_unitario: number | null;
  monto: number;
  medio: MedioCanon;
  patente: string | null;
  destino: DestinoCanon | null;
  destino_detalle: string | null;
  anulado: boolean;
  motivo_anulacion: string | null;
};

/** Minutos en los que Portería puede anular (o "Deshacer") su propio cobro. Igual que anular_canon. */
export const MINUTOS_PARA_ANULAR = 15;

export const ICONOS_TARIFA: { valor: IconoTarifa; label: string; Icono: LucideIcon }[] = [
  { valor: "camioneta", label: "Camioneta", Icono: Van },
  { valor: "camion", label: "Camión", Icono: Truck },
  { valor: "balancin", label: "Con acoplado", Icono: Caravan },
  { valor: "equipo", label: "Equipo grande", Icono: Container },
  { valor: "estadia", label: "Estadía", Icono: SquareParking },
];

export const ICONO_TARIFA: Record<IconoTarifa, LucideIcon> = {
  camioneta: Van,
  camion: Truck,
  balancin: Caravan,
  equipo: Container,
  estadia: SquareParking,
};

export const LABEL_UNIDAD: Record<UnidadTarifa, string> = {
  vehiculo: "por vehículo",
  dia: "por día",
};

export const LABEL_DESTINO: Record<DestinoCanon, string> = {
  puesto: "Puesto",
  verdulero: "Verdulero",
  ambulante: "Ambulante",
};

export const DESTINOS: DestinoCanon[] = ["puesto", "verdulero", "ambulante"];

export const MEDIOS_CANON: { valor: MedioCanon; label: string; Icono: LucideIcon }[] = [
  { valor: "efectivo", label: "Efectivo", Icono: Banknote },
  { valor: "transferencia", label: "Transferencia", Icono: Smartphone },
];

export const LABEL_MEDIO_CANON: Record<MedioCanon, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
};

function esIcono(v: string): v is IconoTarifa {
  return v in ICONO_TARIFA;
}

/** Ícono de una tarifa (o de un cobro viejo sin tarifa). */
export function iconoDeTarifa(icono: string | null | undefined): LucideIcon {
  return icono && esIcono(icono) ? ICONO_TARIFA[icono] : Truck;
}

/** "$6.000 por vehículo" · "$12.000 por día". */
export function textoPrecioTarifa(t: { precio: number; unidad: UnidadTarifa }): string {
  return `${formatARS(t.precio)} ${LABEL_UNIDAD[t.unidad]}`;
}

/** "¿Cuántos vehículos?" / "¿Cuántos días?". */
export function preguntaCantidad(unidad: UnidadTarifa): string {
  return unidad === "dia" ? "¿Cuántos días?" : "¿Cuántos vehículos?";
}

/** "1 vehículo" · "3 vehículos" · "1 día" · "2 días". */
export function textoCantidad(unidad: UnidadTarifa | null, n: number): string {
  if (unidad === "dia") return `${n} ${n === 1 ? "día" : "días"}`;
  return `${n} ${n === 1 ? "vehículo" : "vehículos"}`;
}

/** "Camioneta × 2" · "Estadía diaria · 3 días" (así se lee en la lista y en el resumen). */
export function textoEntrada(e: { tarifa_nombre: string | null; unidad: UnidadTarifa | null; cantidad: number }): string {
  const nombre = e.tarifa_nombre ?? "Canon";
  if (e.unidad === "dia") return `${nombre} · ${textoCantidad("dia", e.cantidad)}`;
  return e.cantidad > 1 ? `${nombre} × ${e.cantidad}` : nombre;
}

/** "Puesto 58" · "Puesto" · "Verdulero" · "Ambulante" · null. */
export function textoDestino(destino: DestinoCanon | null, detalle: string | null): string | null {
  if (!destino) return null;
  if (destino === "puesto" && detalle) return `Puesto ${detalle}`;
  return LABEL_DESTINO[destino];
}

// ---------------------------------------------------------------- patentes

/** Mayúsculas, sin espacios, puntos ni guiones: "ab 123-cd" → "AB123CD" (lo mismo que registrar_canon). */
export function normalizarPatente(v: string): string {
  return v.replace(/[\s.\-]/g, "").toUpperCase();
}

/** 5 a 8 letras y números (AB123CD, ABC123, motos A123BCD…). */
export function esPatenteValida(v: string): boolean {
  return /^[A-Z0-9]{5,8}$/.test(normalizarPatente(v));
}

/** Cómo se lee en la chapa: "AB123CD" → "AB 123 CD", "ABC123" → "ABC 123"; el resto, tal cual. */
export function formatPatente(v: string | null | undefined): string {
  if (!v) return "";
  const p = normalizarPatente(v);
  let m = /^([A-Z]{2})(\d{3})([A-Z]{2})$/.exec(p);
  if (m) return `${m[1]} ${m[2]} ${m[3]}`;
  m = /^([A-Z]{3})(\d{3})$/.exec(p);
  if (m) return `${m[1]} ${m[2]}`;
  m = /^([A-Z]\d{3})([A-Z]{3})$/.exec(p);
  if (m) return `${m[1]} ${m[2]}`;
  return p;
}

// ---------------------------------------------------------------- filas de la base

/** Columnas de canon_camiones que arman un CanonEntrada (para `.select(SELECT_CANON_ENTRADA)`). */
export const SELECT_CANON_ENTRADA =
  "id, numero, creado_en, creado_por, tarifa_nombre, unidad, cantidad, precio_unitario, monto, medio, patente, destino, destino_detalle, anulado, motivo_anulacion";

type FilaCanon = {
  id: string;
  numero: number;
  creado_en: string;
  creado_por: string | null;
  tarifa_nombre: string | null;
  unidad: string | null;
  cantidad: number;
  precio_unitario: number | null;
  monto: number;
  medio: string;
  patente: string | null;
  destino: string | null;
  destino_detalle: string | null;
  anulado: boolean;
  motivo_anulacion: string | null;
};

/** Fila de canon_camiones → CanonEntrada (nombres de quién cobró por user_id). */
export function aCanonEntrada(f: FilaCanon, nombres?: Map<string, string>): CanonEntrada {
  return {
    id: f.id,
    numero: Number(f.numero),
    creado_en: f.creado_en,
    creado_por: f.creado_por,
    creadoPorNombre: f.creado_por ? (nombres?.get(f.creado_por) ?? null) : null,
    tarifa_nombre: f.tarifa_nombre,
    unidad: f.unidad === "dia" ? "dia" : f.unidad === "vehiculo" ? "vehiculo" : null,
    cantidad: Number(f.cantidad),
    precio_unitario: f.precio_unitario === null ? null : Number(f.precio_unitario),
    monto: Number(f.monto),
    medio: f.medio === "transferencia" ? "transferencia" : "efectivo",
    patente: f.patente,
    destino:
      f.destino === "puesto" || f.destino === "verdulero" || f.destino === "ambulante" ? f.destino : null,
    destino_detalle: f.destino_detalle,
    anulado: Boolean(f.anulado),
    motivo_anulacion: f.motivo_anulacion,
  };
}

/** Fila de tarifas_transporte → TarifaTransporte. */
export function aTarifaTransporte(f: {
  id: string;
  nombre: string;
  precio: number;
  unidad: string;
  icono: string;
  orden: number;
  activo: boolean;
}): TarifaTransporte {
  return {
    id: f.id,
    nombre: f.nombre,
    precio: Number(f.precio),
    unidad: f.unidad === "dia" ? "dia" : "vehiculo",
    icono: esIcono(f.icono) ? f.icono : "camion",
    orden: Number(f.orden),
    activo: Boolean(f.activo),
  };
}

// ---------------------------------------------------------------- totales

export type TotalesCanon = {
  efectivo: number;
  transferencia: number;
  total: number;
  cobros: number;
  anulados: number;
  /** "Camioneta ×6" · "Estadía diaria 2 días", en orden de monto. */
  porTarifa: { nombre: string; unidad: UnidadTarifa | null; cantidad: number; monto: number }[];
};

/** Suma lo NO anulado (lo mismo que cuenta el arqueo). */
export function totalesCanon(entradas: CanonEntrada[]): TotalesCanon {
  const vigentes = entradas.filter((e) => !e.anulado);
  const porTarifa = new Map<string, { nombre: string; unidad: UnidadTarifa | null; cantidad: number; monto: number }>();
  let efectivo = 0;
  let transferencia = 0;
  for (const e of vigentes) {
    if (e.medio === "efectivo") efectivo += e.monto;
    else transferencia += e.monto;
    const clave = `${e.tarifa_nombre ?? "Canon"}|${e.unidad ?? ""}`;
    const t = porTarifa.get(clave) ?? { nombre: e.tarifa_nombre ?? "Canon", unidad: e.unidad, cantidad: 0, monto: 0 };
    t.cantidad += e.cantidad;
    t.monto += e.monto;
    porTarifa.set(clave, t);
  }
  return {
    efectivo,
    transferencia,
    total: efectivo + transferencia,
    cobros: vigentes.length,
    anulados: entradas.length - vigentes.length,
    porTarifa: [...porTarifa.values()].sort((a, b) => b.monto - a.monto),
  };
}

/** "Camioneta ×6" · "Estadía diaria 2 días". */
export function textoConteoTarifa(t: { nombre: string; unidad: UnidadTarifa | null; cantidad: number }): string {
  return t.unidad === "dia" ? `${t.nombre} ${textoCantidad("dia", t.cantidad)}` : `${t.nombre} ×${t.cantidad}`;
}
