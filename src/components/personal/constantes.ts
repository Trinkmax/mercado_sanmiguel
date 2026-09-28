import type { Enums } from "@/lib/database.types";
import { DIAS_SEMANA, formatHora, formatNumero } from "@/lib/format";

export type TipoContrato = Enums<"tipo_contrato">;

/** Etiqueta visible de cada tipo de contrato (el enum no cambia). */
export const LABEL_TIPO_CONTRATO: Record<TipoContrato, string> = {
  planta_permanente: "Planta permanente",
  contratado: "Contratado",
  eventual: "Eventual",
  monotributista: "Monotributista",
  pasantia: "Pasantía",
};

/** Orden de los chips del formulario. */
export const TIPOS_CONTRATO: TipoContrato[] = [
  "planta_permanente",
  "contratado",
  "eventual",
  "monotributista",
  "pasantia",
];

export type Franja = {
  dia_semana: number;
  hora_desde: string; // "HH:MM" o "HH:MM:SS"
  hora_hasta: string;
};

/** "Apellido, Nombre" — como figura en el padrón. */
export function nombreCompleto(e: { apellido: string; nombre: string }): string {
  return `${e.apellido}, ${e.nombre}`;
}

function labelDias(dias: number[]): string {
  // Comprime corridas consecutivas: [1,2,3,4,5,6] → "Lun–Sáb"; [1,3] → "Lun y Mié".
  const corto = (d: number) => DIAS_SEMANA.find((x) => x.valor === d)?.corto ?? "";
  const partes: string[] = [];
  let i = 0;
  while (i < dias.length) {
    let j = i;
    while (j + 1 < dias.length && dias[j + 1] === dias[j] + 1) j++;
    if (j - i >= 2) partes.push(`${corto(dias[i])}–${corto(dias[j])}`);
    else for (let k = i; k <= j; k++) partes.push(corto(dias[k]));
    i = j + 1;
  }
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

/**
 * Resume las franjas horarias de la semana en una línea legible:
 * "Lun–Sáb 04:00–12:00" · "Lun–Vie 07:00–15:00 · Sáb 07:00–11:00".
 * Días con el mismo horario se agrupan. Sin franjas → "Sin horarios cargados".
 */
export function resumirHorarios(franjas: Franja[]): string {
  if (franjas.length === 0) return "Sin horarios cargados";
  const porDia = new Map<number, string[]>();
  for (const f of franjas) {
    const lista = porDia.get(f.dia_semana) ?? [];
    lista.push(`${formatHora(f.hora_desde)}–${formatHora(f.hora_hasta)}`);
    porDia.set(f.dia_semana, lista);
  }
  // Agrupa días por su "firma" de franjas, conservando el orden del primer día.
  const grupos = new Map<string, number[]>();
  for (let d = 1; d <= 7; d++) {
    const lista = porDia.get(d);
    if (!lista) continue;
    const clave = [...lista].sort().join(" y ");
    const dias = grupos.get(clave) ?? [];
    dias.push(d);
    grupos.set(clave, dias);
  }
  return Array.from(grupos.entries())
    .map(([clave, dias]) => `${labelDias(dias)} ${clave}`)
    .join(" · ");
}

/** URL del listado de personal conservando búsqueda, filtro (activos por defecto) y sector. */
export function hrefPersonal(texto: string, filtro?: string, sector?: string | null): string {
  const params = new URLSearchParams();
  if (texto) params.set("q", texto);
  if (filtro && filtro !== "activos") params.set("filtro", filtro);
  if (sector) params.set("sector", sector);
  const qs = params.toString();
  return qs ? `/personal?${qs}` : "/personal";
}

// ---------------------------------------------------------------------------
// Fase 3 (H4): sector y horas de contrato
// ---------------------------------------------------------------------------

export type SectorPersonal = Enums<"sector_personal">;

/** Orden de los chips (el mismo del enum en la base). */
export const SECTORES_PERSONAL: SectorPersonal[] = [
  "porteria",
  "limpieza",
  "mantenimiento",
  "administracion",
  "otro",
];

export const LABEL_SECTOR: Record<SectorPersonal, string> = {
  porteria: "Portería",
  limpieza: "Limpieza",
  mantenimiento: "Mantenimiento",
  administracion: "Administración",
  otro: "Otro",
};

export function esSector(v: string | null | undefined): v is SectorPersonal {
  return typeof v === "string" && (SECTORES_PERSONAL as string[]).includes(v);
}

/** Cargos habituales: se ofrecen como chips que completan el campo. */
export const SUGERENCIAS_CARGO = ["Encargado de turno", "Sereno", "Peón"];

function aMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Horas por semana que suman sus franjas horarias (lo que usa la planilla si no hay contrato). */
export function horasSemanalesDeFranjas(franjas: Franja[]): number {
  const minutos = franjas.reduce(
    (acc, f) => acc + Math.max(aMinutos(f.hora_hasta) - aMinutos(f.hora_desde), 0),
    0
  );
  return Math.round((minutos / 60) * 100) / 100;
}

/** 44 → "44", 37.5 → "37,5" (horas sin ceros de más). */
export function formatHorasNumero(h: number | string | null | undefined): string {
  return formatNumero(Math.round(Number(h ?? 0) * 100) / 100);
}

/** Minutos entre la entrada y la salida (timestamptz). Null si todavía no salió. */
export function minutosTrabajados(ingreso: string, egreso: string | null): number | null {
  if (!egreso) return null;
  return Math.max(Math.round((new Date(egreso).getTime() - new Date(ingreso).getTime()) / 60000), 0);
}

/** 485 → "8 h 05 min" · 45 → "45 min". */
export function formatDuracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, "0")} min`;
}
