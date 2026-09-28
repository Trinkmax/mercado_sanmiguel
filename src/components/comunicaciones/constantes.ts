/**
 * Constantes de Comunicaciones (panel, portal, ficha y exportación). Client-safe.
 * Registros = tabla `sanciones` (enum `tipo_sancion`): notificación, apercibimiento, sanción.
 * Reglas del portal (visto / respuesta nueva / espera descargo) en src/lib/segmentos.ts.
 */

export type TipoRegistro = "notificacion" | "apercibimiento" | "sancion";
export type EstadoRegistro = "notificado" | "descargo" | "respondido";

export const TIPOS_REGISTRO: readonly {
  valor: TipoRegistro;
  label: string;
  plural: string;
  /** Slug de la pestaña (?tab=) en /comunicaciones y en el portal. */
  pestana: "notificaciones" | "apercibimientos" | "sanciones";
  ayuda: string;
  llevaMulta: boolean;
  /** Texto del botón primario de la pestaña. */
  nuevo: string;
}[] = [
  {
    valor: "notificacion",
    label: "Notificación",
    plural: "Notificaciones",
    pestana: "notificaciones",
    ayuda: "Aviso formal que se le comunica. Puede responder.",
    llevaMulta: false,
    nuevo: "Nueva notificación",
  },
  {
    valor: "apercibimiento",
    label: "Apercibimiento",
    plural: "Apercibimientos",
    pestana: "apercibimientos",
    ayuda: "Llamado de atención por escrito. Puede llevar multa y presentar su descargo.",
    llevaMulta: true,
    nuevo: "Nuevo apercibimiento",
  },
  {
    valor: "sancion",
    label: "Sanción",
    plural: "Sanciones",
    pestana: "sanciones",
    ayuda: "Medida que decide la cooperativa, con su documento. Puede llevar multa.",
    llevaMulta: true,
    nuevo: "Nueva sanción",
  },
] as const;

export function esTipoRegistro(v: unknown): v is TipoRegistro {
  return v === "notificacion" || v === "apercibimiento" || v === "sancion";
}

export function labelTipoRegistro(tipo: string): string {
  return TIPOS_REGISTRO.find((t) => t.valor === tipo)?.label ?? tipo;
}

export function infoTipoRegistro(tipo: TipoRegistro) {
  return TIPOS_REGISTRO.find((t) => t.valor === tipo) ?? TIPOS_REGISTRO[0];
}

export function tipoDePestana(pestana: string | undefined): TipoRegistro | null {
  return TIPOS_REGISTRO.find((t) => t.pestana === pestana)?.valor ?? null;
}

/** "Apercibimiento N° 12" */
export function nombreRegistro(r: { tipo: string; numero: number }): string {
  return `${labelTipoRegistro(r.tipo)} N° ${r.numero}`;
}

/** Clave de <Sello> del estado del hilo. En una notificación, "descargo" se lee "Respondió". */
export function selloEstadoRegistro(r: { tipo: string; estado: string }): string {
  if (r.estado === "descargo" && r.tipo === "notificacion") return "respondio";
  return r.estado;
}

/** Cómo se llama lo que escribe el socio: descargo (apercibimiento/sanción) o respuesta. */
export function nombreMensajeSocio(tipo: string): { singular: string; verbo: string } {
  return tipo === "notificacion"
    ? { singular: "Respuesta", verbo: "respondió" }
    : { singular: "Descargo", verbo: "presentó su descargo" };
}

/** Pasos de la línea de estado (Notificado → Descargo presentado → Respondido). */
export function pasosRegistro(tipo: string, paraSocio = false): [string, string, string] {
  if (paraSocio) {
    return tipo === "notificacion"
      ? ["Te notificamos", "Tu respuesta", "Te respondimos"]
      : ["Te notificamos", "Tu descargo", "Te respondimos"];
  }
  return tipo === "notificacion"
    ? ["Notificado", "Respondió", "Respondido"]
    : ["Notificado", "Descargo presentado", "Respondido"];
}

// ---------------------------------------------------------------------------
// Multa (cargo MULT)
// ---------------------------------------------------------------------------

export type CargoMulta = {
  estado: string;
  monto: number;
  monto_pagado: number;
  vencimiento?: string | null;
} | null;

export type EstadoMulta = "sin_multa" | "pendiente" | "parcial" | "pagada" | "sin_efecto";

export function estadoMulta(r: {
  multa: number | null;
  multa_sin_efecto_en: string | null;
  cargo: CargoMulta;
}): EstadoMulta {
  if (r.multa === null || Number(r.multa) <= 0) return "sin_multa";
  if (r.multa_sin_efecto_en || r.cargo?.estado === "anulado") return "sin_efecto";
  if (r.cargo?.estado === "pagado") return "pagada";
  if (r.cargo && Number(r.cargo.monto_pagado) > 0) return "parcial";
  return "pendiente";
}

/** Sello (clave + texto) del estado de la multa. */
export const SELLO_MULTA: Record<Exclude<EstadoMulta, "sin_multa">, { estado: string; texto: string }> = {
  pendiente: { estado: "multa", texto: "Multa pendiente" },
  parcial: { estado: "parcial", texto: "Multa: pagó una parte" },
  pagada: { estado: "multa_pagada", texto: "Multa pagada" },
  sin_efecto: { estado: "sin_efecto", texto: "Multa sin efecto" },
};

/** Lo que falta cobrar de la multa (0 si está pagada o sin efecto). */
export function saldoMulta(r: {
  multa: number | null;
  multa_sin_efecto_en: string | null;
  cargo: CargoMulta;
}): number {
  const e = estadoMulta(r);
  if (e === "sin_multa" || e === "sin_efecto" || e === "pagada") return 0;
  const monto = Number(r.cargo?.monto ?? r.multa ?? 0);
  return Math.max(Math.round((monto - Number(r.cargo?.monto_pagado ?? 0)) * 100) / 100, 0);
}

// ---------------------------------------------------------------------------
// Atajos del formulario
// ---------------------------------------------------------------------------

export const TITULOS_SUGERIDOS: Record<TipoRegistro, string[]> = {
  notificacion: [
    "Aviso de deuda atrasada",
    "Limpieza del puesto",
    "Horario de carga y descarga",
    "Documentación vencida",
  ],
  apercibimiento: [
    "Falta de limpieza del puesto",
    "Mercadería en el pasillo",
    "Carga y descarga fuera de horario",
    "Conexión eléctrica irregular",
  ],
  sancion: [
    "Reiteración de faltas",
    "Ocupación de espacio ajeno",
    "Conexión eléctrica irregular",
    "Falta de respeto al personal",
  ],
};

export const MULTAS_RAPIDAS = [10000, 25000, 50000, 100000];

export const MOTIVOS_SIN_EFECTO = [
  "Se aclaró con el socio",
  "Se cargó por error",
  "Lo resolvió el Líder de Procesos",
];

/** Días por defecto hasta el vencimiento de la multa (igual que la RPC). */
export const DIAS_VENCIMIENTO_MULTA = 10;

// ---------------------------------------------------------------------------
// Lugar del plano (etiqueta legible, sin depender del módulo Mapa)
// ---------------------------------------------------------------------------

const LABEL_TIPO_ESPACIO: Record<string, string> = {
  puesto: "Puesto",
  local: "Local",
  contenedor: "Contéiner",
  bar: "Bar",
};

/** "Puesto 58" · "Puesto 34½" · "Local 3" · "Contéiner 7" · "Bar" */
export function etiquetaLugar(e: {
  tipo: string;
  numero: string | null;
  medio?: boolean | null;
}): string {
  const base = LABEL_TIPO_ESPACIO[e.tipo] ?? e.tipo;
  if (!e.numero) return base;
  return `${base} ${e.numero}${e.medio ? "½" : ""}`;
}

/** Acepta pdf/jpg/png/webp (input de archivo). */
export const ACCEPT_ADJUNTO_REGISTRO =
  "application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp";
