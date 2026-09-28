import { uuidV4 } from "@/lib/utils";
/**
 * Tipos y helpers del cobro compartidos por FormCobro, CobroAmbulante y sus piezas.
 * Client-safe (sin datos): los números "de negocio" los calcula la base.
 */
import { Banknote, FileText, Landmark, type LucideIcon } from "lucide-react";
import {
  DIAS_SEMANA,
  fechaLocal,
  formatFecha,
  hoyISO,
  montoATexto,
  parseMonto,
  redondear2,
  sanitizarMonto,
} from "@/lib/format";
import type { MedioPago } from "@/lib/actions/cobranza";

export type { MedioPago };

export const MEDIOS: { valor: MedioPago; label: string; Icono: LucideIcon }[] = [
  { valor: "efectivo", label: "Efectivo", Icono: Banknote },
  { valor: "transferencia", label: "Transferencia", Icono: Landmark },
  { valor: "cheque", label: "Cheque", Icono: FileText },
];

export const LABEL_MEDIO: Record<MedioPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  cheque: "Cheque",
};

export const ICONO_MEDIO: Record<MedioPago, LucideIcon> = {
  efectivo: Banknote,
  transferencia: Landmark,
  cheque: FileText,
};

export const ACCEPT_COMPROBANTE = "image/*,application/pdf";
/**
 * Tope de los comprobantes de UN cobro (todos juntos). En producción (Vercel) un pedido no
 * puede pasar de 4,5 MB: si pasa, el servidor lo corta y la pantalla diría "Se cortó la
 * conexión", y el operador reintentaría creyendo que es el wifi. Las fotos ya se achican a
 * ~400 KB (comprimirImagen); lo que puede pasarse es un PDF o una foto que no se pudo achicar.
 */
export const MAX_COMPROBANTE = 4 * 1024 * 1024;
export const MENSAJE_COMPROBANTE_PESADO =
  "El archivo pesa más de 4 MB y no se puede subir. Si es un PDF, mandá una captura de pantalla (foto) del comprobante. También podés cobrar sin la foto.";

// Montos tipeados: viven en @/lib/format (los usan también Gastos y Tesorería).
export { parseMonto, sanitizarMonto, montoATexto, redondear2 };

/** "YYYY-MM-DD" + n días (huso de negocio: las fechas son puras, sin hora). */
export function sumarDias(iso: string, dias: number): string {
  const d = fechaLocal(iso);
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Días entre dos fechas "YYYY-MM-DD" (b − a). */
export function diasEntre(a: string, b: string): number {
  return Math.round((fechaLocal(b).getTime() - fechaLocal(a).getTime()) / 86_400_000);
}

/** "Mié" de una fecha "YYYY-MM-DD" (DIAS_SEMANA es ISO: 1 = lunes). */
export function diaSemanaCorto(iso: string): string {
  const js = fechaLocal(iso).getDay(); // 0 = domingo
  const isoDia = js === 0 ? 7 : js;
  return DIAS_SEMANA.find((d) => d.valor === isoDia)?.corto ?? "";
}

/** "30/09" */
export function diaMes(iso: string): string {
  return formatFecha(iso).slice(0, 5);
}

/** "mié 30/09" (en minúscula, para dentro de una frase). */
export function diaCorto(iso: string): string {
  return `${diaSemanaCorto(iso).toLowerCase()} ${diaMes(iso)}`;
}

/** "hoy" · "ayer" · "mañana" · "mié 30/09" */
export function diaRelativo(iso: string): string {
  const d = diasEntre(hoyISO(), iso);
  if (d === 0) return "hoy";
  if (d === -1) return "ayer";
  if (d === 1) return "mañana";
  return diaCorto(iso);
}

/** "20123456783" → "20-12345678-3" mientras se tipea. */
export function mascaraCuit(texto: string): string {
  const d = texto.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 10) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

/** UUID v4 para el lote del cobro (idempotencia); ver `uuidV4` en `@/lib/utils`. */
export { uuidV4 };

export function nuevoId(): string {
  return uuidV4().replace(/-/g, "").slice(0, 16);
}

// ---------------------------------------------------------------------------
// Estado de una línea del formulario
// ---------------------------------------------------------------------------

export type EstadoCheque = "en_cartera" | "entregado";

export type ChequeForm = {
  numero: string;
  /** Con máscara "20-12345678-3". */
  cuit: string;
  /** El que tocó "Está bien así, seguir" con un dígito verificador que no coincide. */
  cuitConfirmado: boolean;
  /** "" = lo entrega el cliente. */
  recibidoDe: string;
  otraPersona: boolean;
  fechaRecepcion: string;
  fechaCobro: string;
  estado: EstadoCheque;
  proveedor: string;
};

export type LineaForm = {
  id: string;
  medio: MedioPago;
  monto: string;
  titular: string;
  comprobante: File | null;
  cheque: ChequeForm;
};

export function chequeVacio(): ChequeForm {
  const hoy = hoyISO();
  return {
    numero: "",
    cuit: "",
    cuitConfirmado: false,
    recibidoDe: "",
    otraPersona: false,
    fechaRecepcion: hoy,
    fechaCobro: hoy,
    estado: "en_cartera",
    proveedor: "",
  };
}

export function nuevaLinea(medio: MedioPago, monto = 0, id: string = nuevoId()): LineaForm {
  return {
    id,
    medio,
    monto: montoATexto(monto),
    titular: "",
    comprobante: null,
    cheque: chequeVacio(),
  };
}

/** Errores por campo de una línea (inline, en rojo, con recuperación). */
export type ErroresLinea = Partial<
  Record<
    | "monto"
    | "titular"
    | "comprobante"
    | "chequeNumero"
    | "chequeCuit"
    | "chequeRecibidoDe"
    | "chequeProveedor"
    | "chequeFechaRecepcion",
    string
  >
>;
