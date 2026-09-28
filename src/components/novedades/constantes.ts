/** Constantes y textos de la planilla de Novedades del personal (H4). Server y client. */
import {
  CalendarCheck,
  Clock,
  Palmtree,
  StickyNote,
  Stethoscope,
  TimerReset,
  UserX,
  type LucideIcon,
} from "lucide-react";
import type { Enums } from "@/lib/database.types";
import type { Rol } from "@/lib/auth";
import {
  fechaLocal,
  formatFechaLarga,
  hoyISO,
  periodoActual,
} from "@/lib/format";
import {
  LABEL_SECTOR,
  SECTORES_PERSONAL,
  type SectorPersonal,
} from "@/components/personal/constantes";

export type TipoNovedad = Enums<"tipo_novedad">;
export type EstadoNovedad = Enums<"estado_novedad">;

/** Qué pide cada tipo en el formulario. */
export type DefTipoNovedad = {
  valor: TipoNovedad;
  /** Ficha del formulario ("Faltó"). */
  label: string;
  /** Sustantivo ("Falta") para listados y exportación. */
  nombre: string;
  icono: LucideIcon;
  /** Aclaración corta debajo de la ficha. */
  ayuda?: string;
  /** Un día o un período (desde–hasta). */
  fechas: "dia" | "rango";
  /** Minutos de tardanza, horas (obligatorias) u horas opcionales. */
  horas: "no" | "minutos" | "horas" | "horas_opcional";
  /** Pregunta "¿Justificada?" (faltas y llegadas tarde). */
  justificada: boolean;
  /** El detalle es obligatorio. */
  detalleObligatorio: boolean;
  /** Puede tener fecha futura (vacaciones y licencias se cargan antes). */
  futuro: boolean;
};

export const TIPOS_NOVEDAD: DefTipoNovedad[] = [
  { valor: "falta", label: "Faltó", nombre: "Falta", icono: UserX, fechas: "dia", horas: "no", justificada: true, detalleObligatorio: false, futuro: false },
  { valor: "llegada_tarde", label: "Llegó tarde", nombre: "Llegada tarde", icono: Clock, fechas: "dia", horas: "minutos", justificada: true, detalleObligatorio: false, futuro: false },
  { valor: "feriado_trabajado", label: "Trabajó un feriado", nombre: "Feriado trabajado", icono: CalendarCheck, ayuda: "Se paga doble", fechas: "dia", horas: "horas_opcional", justificada: false, detalleObligatorio: false, futuro: false },
  { valor: "vacaciones", label: "Vacaciones", nombre: "Vacaciones", icono: Palmtree, fechas: "rango", horas: "no", justificada: false, detalleObligatorio: false, futuro: true },
  { valor: "licencia", label: "Licencia", nombre: "Licencia", icono: Stethoscope, ayuda: "Enfermedad, examen, familiar…", fechas: "rango", horas: "no", justificada: false, detalleObligatorio: false, futuro: true },
  { valor: "horas_extra", label: "Horas extra", nombre: "Horas extra", icono: TimerReset, fechas: "dia", horas: "horas", justificada: false, detalleObligatorio: false, futuro: false },
  { valor: "otra", label: "Otra", nombre: "Otra novedad", icono: StickyNote, fechas: "dia", horas: "no", justificada: false, detalleObligatorio: true, futuro: false },
];

export const DEF_TIPO: Record<TipoNovedad, DefTipoNovedad> = Object.fromEntries(
  TIPOS_NOVEDAD.map((t) => [t.valor, t])
) as Record<TipoNovedad, DefTipoNovedad>;

export const LABEL_TIPO_NOVEDAD: Record<TipoNovedad, string> = Object.fromEntries(
  TIPOS_NOVEDAD.map((t) => [t.valor, t.nombre])
) as Record<TipoNovedad, string>;

export function esTipoNovedad(v: string | null | undefined): v is TipoNovedad {
  return typeof v === "string" && TIPOS_NOVEDAD.some((t) => t.valor === v);
}

export const LABEL_ESTADO_NOVEDAD: Record<EstadoNovedad, string> = {
  pendiente: "Esperando aprobación",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  anulada: "Anulada",
};

/** Clave de <Sello> para cada estado (verde aprobada, ámbar esperando, rojo rechazada, gris anulada). */
export function selloNovedad(estado: EstadoNovedad): string {
  return estado === "pendiente" ? "pendiente_aprobacion" : estado;
}

/** Motivos de licencia: chips que completan el detalle. */
export const MOTIVOS_LICENCIA = ["Enfermedad", "Examen", "Familiar", "Maternidad / paternidad"];

/** Chips de tardanza (minutos) y de horas. */
export const CHIPS_MINUTOS = [5, 10, 15, 30, 60];
export const CHIPS_HORAS = [1, 2, 3, 4, 8];

// ---------------------------------------------------------------------------
// Alcance por rol: espejo de private.sectores_novedades() (la base es la autoridad).
// ---------------------------------------------------------------------------

export function sectoresDeRol(rol: Rol): SectorPersonal[] {
  if (rol === "lider") return SECTORES_PERSONAL;
  if (rol === "admin") return ["porteria", "limpieza", "mantenimiento"];
  if (rol === "guardia") return ["porteria"];
  return [];
}

/** "Portería, Limpieza y Mantenimiento". */
export function listaSectores(sectores: SectorPersonal[]): string {
  const labels = sectores.map((s) => LABEL_SECTOR[s]);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}`;
}

// ---------------------------------------------------------------------------
// Horas, días y frases
// ---------------------------------------------------------------------------

/** Minutos de tardanza → horas con 2 decimales (lo que guarda la base). */
export function minutosAHoras(min: number): number {
  return Math.round((min / 60) * 100) / 100;
}

export function horasAMinutos(horas: number | string | null | undefined): number {
  return Math.round(Number(horas ?? 0) * 60);
}

/** 8 → "8 h" · 1.5 → "1 h 30 min" · 0.25 → "15 min". */
export function textoHoras(horas: number | string | null | undefined): string {
  const total = horasAMinutos(horas);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/** Días corridos entre dos fechas "YYYY-MM-DD", ambos inclusive. */
export function diasCorridos(desde: string, hasta: string | null | undefined): number {
  const a = fechaLocal(desde).getTime();
  const b = fechaLocal(hasta ?? desde).getTime();
  return Math.round((b - a) / 86_400_000) + 1;
}

/** Suma días a una fecha "YYYY-MM-DD". */
export function sumarDias(fecha: string, dias: number): string {
  const d = fechaLocal(fecha);
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Último día del mes de un período "YYYY-MM-01". */
export function finDeMes(periodo: string): string {
  const d = fechaLocal(periodo);
  const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, "0")}-${String(fin.getDate()).padStart(2, "0")}`;
}

/** Lee `?mes=` ("2026-09" o "2026-09-01"); nunca pasa del mes actual. */
export function periodoDeParam(mes: string | string[] | undefined): string {
  const v = Array.isArray(mes) ? mes[0] : mes;
  const actual = periodoActual();
  const m = typeof v === "string" ? /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(v) : null;
  if (!m) return actual;
  const mesNum = Number(m[2]);
  if (mesNum < 1 || mesNum > 12) return actual;
  const periodo = `${m[1]}-${m[2]}-01`;
  return periodo > actual ? actual : periodo;
}

export type NovedadFrase = {
  tipo: TipoNovedad;
  fecha_desde: string;
  fecha_hasta: string | null;
  horas: number | null;
  justificada: boolean | null;
  detalle?: string | null;
  conAdjunto?: boolean;
};

/**
 * Frase de una novedad, para leer de un vistazo.
 * Con nombre: "Juan Pérez faltó el martes 23 de septiembre (justificada, con certificado)".
 * Sin nombre: "Faltó el martes 23 de septiembre (justificada)".
 * `varios` conjuga en plural ("faltaron", "trabajaron el feriado…").
 */
export function fraseNovedad(n: NovedadFrase, nombre?: string, varios = false): string {
  const dia = formatFechaLarga(n.fecha_desde);
  const hasta = n.fecha_hasta && n.fecha_hasta !== n.fecha_desde ? n.fecha_hasta : null;
  const dias = diasCorridos(n.fecha_desde, hasta);
  const rango = hasta
    ? `del ${formatFechaLarga(n.fecha_desde)} al ${formatFechaLarga(hasta)} (${dias} días corridos)`
    : `el ${dia}`;
  const v = (uno: string, muchos: string) => (varios ? muchos : uno);

  let cuerpo: string;
  switch (n.tipo) {
    case "falta":
      cuerpo = `${v("faltó", "faltaron")} el ${dia}`;
      break;
    case "llegada_tarde":
      cuerpo = n.horas
        ? `${v("llegó", "llegaron")} ${textoHoras(n.horas)} tarde el ${dia}`
        : `${v("llegó", "llegaron")} tarde el ${dia}`;
      break;
    case "feriado_trabajado":
      cuerpo = `${v("trabajó", "trabajaron")} el feriado del ${dia}${n.horas ? ` (${textoHoras(n.horas)})` : ""} · se paga doble`;
      break;
    case "vacaciones":
      cuerpo = `${v("está", "están")} de vacaciones ${rango}`;
      break;
    case "licencia":
      cuerpo = `${v("tiene", "tienen")} licencia ${rango}`;
      break;
    case "horas_extra":
      cuerpo = `${v("hizo", "hicieron")} ${n.horas ? textoHoras(n.horas) : "horas"} extra el ${dia}`;
      break;
    case "otra":
      cuerpo = `${n.detalle?.trim() ? n.detalle.trim() : "otra novedad"} (${dia})`;
      break;
  }

  const extras: string[] = [];
  if (DEF_TIPO[n.tipo].justificada && n.justificada !== null) {
    extras.push(n.justificada ? v("justificada", "justificadas") : v("sin justificar", "sin justificar"));
  }
  if (n.conAdjunto) extras.push(n.tipo === "falta" || n.tipo === "licencia" ? "con certificado" : "con adjunto");
  const cola = extras.length ? ` (${extras.join(", ")})` : "";

  if (nombre) return `${nombre} ${cuerpo}${cola}`;
  return `${cuerpo.charAt(0).toUpperCase()}${cuerpo.slice(1)}${cola}`;
}

/** "Juan Pérez" · "Juan Pérez y Ana Gómez" · "Juan Pérez, Ana Gómez y 2 más". */
export function nombresJuntos(nombres: string[]): string {
  if (nombres.length <= 1) return nombres.join("");
  if (nombres.length === 2) return `${nombres[0]} y ${nombres[1]}`;
  return `${nombres[0]}, ${nombres[1]} y ${nombres.length - 2} más`;
}

/** Nombre corto para frases: "Pedro Portero". */
export function nombrePila(e: { nombre: string; apellido: string }): string {
  return `${e.nombre} ${e.apellido}`;
}

// ---------------------------------------------------------------------------
// Semáforo de horas: verde ≥ 100 %, ámbar ≥ 90 %, rojo < 90 %.
// ---------------------------------------------------------------------------

export type NivelHoras = "pagado" | "parcial" | "pendiente";

export function nivelHoras(registradas: number, esperadas: number): NivelHoras | null {
  if (!(esperadas > 0)) return null;
  const pct = registradas / esperadas;
  if (pct >= 1) return "pagado";
  if (pct >= 0.9) return "parcial";
  return "pendiente";
}

export function porcentajeHoras(registradas: number, esperadas: number): number {
  if (!(esperadas > 0)) return 0;
  return Math.round((registradas / esperadas) * 100);
}

/** URL de la planilla conservando mes y sector. */
export function hrefNovedades(opts: { periodo?: string; sector?: string | null } = {}): string {
  const params = new URLSearchParams();
  if (opts.periodo && opts.periodo !== periodoActual()) params.set("mes", opts.periodo.slice(0, 7));
  if (opts.sector) params.set("sector", opts.sector);
  const qs = params.toString();
  return qs ? `/novedades?${qs}` : "/novedades";
}

/** ¿La fecha "YYYY-MM-DD" es futura (huso AR)? */
export function esFutura(fecha: string): boolean {
  return fecha > hoyISO();
}

/** Una novedad lista para mostrar (con nombres de quién la cargó/revisó y el link del adjunto). */
export type NovedadVista = {
  id: string;
  empleado_id: string;
  tipo: TipoNovedad;
  estado: EstadoNovedad;
  fecha_desde: string;
  fecha_hasta: string | null;
  horas: number | null;
  justificada: boolean | null;
  detalle: string | null;
  adjuntoUrl: string | null;
  tieneAdjunto: boolean;
  motivo_rechazo: string | null;
  motivo_anulacion: string | null;
  cargada_por: string | null;
  cargadaPor: string | null;
  cargada_en: string;
  revisadaPor: string | null;
  revisada_en: string | null;
  anuladaPor: string | null;
  anulada_en: string | null;
};
