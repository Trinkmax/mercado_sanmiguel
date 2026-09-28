/** Constantes del módulo Clientes (compartidas entre server y client components). */

/**
 * Categorías de documento que se sugieren siempre (C7). La categoría es texto
 * libre: además de estas aparecen como chip las que ya usó la cooperativa.
 * `valor` es el slug con el que se guardaban antes de la fase 3 (se siguen leyendo).
 */
export const CATEGORIAS_DOCUMENTO = [
  { valor: "habilitacion_municipal", label: "Habilitación municipal" },
  { valor: "senasa", label: "SENASA" },
  { valor: "apto_electrico", label: "Apto eléctrico" },
] as const;

/** Slugs viejos → texto. Lo nuevo ya se guarda como texto ("Contrato de alquiler"). */
const LABEL_SLUG_DOCUMENTO: Record<string, string> = {
  habilitacion_municipal: "Habilitación municipal",
  senasa: "SENASA",
  apto_electrico: "Apto eléctrico",
  otro: "Otro",
};

export function labelCategoria(categoria: string): string {
  return LABEL_SLUG_DOCUMENTO[categoria] ?? categoria;
}

/** Máximo de la categoría libre (check `documentos_cliente_categoria_largo`). */
export const CATEGORIA_DOCUMENTO_MAX = 60;

/**
 * "  contrato   de alquiler " → "Contrato de alquiler". Así "contrato de alquiler"
 * y "Contrato de alquiler" quedan en la misma carpeta. Respeta siglas ("SENASA").
 */
export function normalizarCategoriaDocumento(texto: string): string {
  const limpio = texto.replace(/\s+/g, " ").trim().slice(0, CATEGORIA_DOCUMENTO_MAX);
  if (!limpio) return "";
  const conocida = Object.entries(LABEL_SLUG_DOCUMENTO).find(
    ([slug, label]) =>
      slug === limpio.toLowerCase() || label.toLowerCase() === limpio.toLowerCase()
  );
  if (conocida) return conocida[1];
  return limpio.charAt(0).toLocaleUpperCase("es-AR") + limpio.slice(1);
}

/**
 * ¿Un concepto MENSUAL sigue facturándose si el cliente pasa a esta categoría?
 * Espejo de private.aplicar_cambio (0024) y de lo que la ficha ofrece en "Qué paga":
 * el ambulante no tiene mensuales (paga por día); el quintero, solo lo de quinteros;
 * el puestero, todo menos lo de quinteros y ambulantes. Energía (ABEN/ENER) no cuenta.
 */
export function conceptoSigueConCategoria(
  segmento: string | null,
  categoria: "puestero" | "quintero" | "ambulante"
): boolean {
  if (categoria === "ambulante") return false;
  if (categoria === "quintero") return segmento === "quinteros";
  return segmento !== "quinteros" && segmento !== "ambulantes";
}

export const LABEL_TIPO_PERSONA: Record<string, string> = {
  fisica: "Persona física",
  juridica: "Empresa",
};

export const LABEL_MEDIO: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  cheque: "Cheque",
};

/** Registros documentales del cliente (tabla `sanciones`, enum `tipo_sancion`).
 * DEPRECADO (fase 3): lo reemplaza `comunicaciones/constantes.ts` de M5. No se toca. */
export const TIPOS_REGISTRO = [
  {
    valor: "notificacion",
    label: "Notificación",
    ayuda: "Aviso formal que se le comunica",
  },
  {
    valor: "apercibimiento",
    label: "Apercibimiento",
    ayuda: "Llamado de atención por escrito",
  },
  {
    valor: "sancion",
    label: "Sanción",
    ayuda: "Resolución del Consejo con su documento",
  },
] as const;

export type TipoRegistro = (typeof TIPOS_REGISTRO)[number]["valor"];

export function labelTipoRegistro(tipo: string): string {
  return TIPOS_REGISTRO.find((t) => t.valor === tipo)?.label ?? tipo;
}

/** Copy de la regla de aprobación, según quién está usando el sistema.
 * El Líder de Procesos aplica directo; los demás proponen y esperan su OK
 * (espejo client-safe de `aplicaDirecto` en src/lib/auth.ts, que es server-only). */
export function aplicaDirectoRol(rol: string | undefined): boolean {
  return rol === "lider";
}

export const TOAST_ENVIADO_APROBACION =
  "Enviado al Líder de Procesos para su aprobación";

/** Acepta pdf/jpg/png/webp (para el input de archivo). */
export const ACCEPT_ARCHIVOS =
  "application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp";

/* ------------------------------------------------------------------ */
/* ¿Qué paga? — agrupado y con una línea de ayuda por concepto (C6)    */
/* ------------------------------------------------------------------ */

/** Una línea que explica cada concepto, en lenguaje de mostrador. */
export const AYUDA_CONCEPTO: Record<string, string> = {
  EXME: "La expensa mensual del puesto — beneficio 15 % pagando en término",
  EXPP: "Solo los 4 puestos propios de la cooperativa",
  EXPL: "Por cada local",
  EXPG: "Por cada galpón (medio galpón = ½)",
  EXPE: "Por cada contéiner",
  EXPC: "Por cada cochera",
  EXCO: "Contribución mensual del puesto",
  EXPQ: "La quinta entera, por mes",
  AMB: "Se cobra por día, cuando viene",
  ABEN: "A todo el que tiene medidor de luz activo",
};

export type GrupoConcepto = "expensas" | "espacios" | "quintas" | "otros";

export const GRUPOS_CONCEPTO: { valor: GrupoConcepto; label: string }[] = [
  { valor: "expensas", label: "Expensas" },
  { valor: "espacios", label: "Espacios" },
  { valor: "quintas", label: "Quinta" },
  { valor: "otros", label: "Otros" },
];

/** En qué grupo de "¿Qué paga?" va cada concepto (por segmento; si no tiene, "Otros"). */
export function grupoDeConcepto(c: { codigo: string; segmento: string | null }): GrupoConcepto {
  switch (c.segmento) {
    case "puesteros":
    case "puestos_propios":
      return "expensas";
    case "locales":
    case "galpones":
    case "conteiners":
      return "espacios";
    case "quinteros":
    case "ambulantes":
      return "quintas";
    default:
      return "otros";
  }
}

/** Conceptos que el rol puede asignar a la carpeta (espejo de solicitar_cambio, §4.7).
 * Solo mensuales: los de energía van en Medidores; AMB, MULT, RD y BC se cobran en el momento. */
export function conceptoAsignablePorRol(
  c: { tipo: string; segmento: string | null },
  rol: string
): boolean {
  if (c.tipo !== "recurrente") return false;
  const dePorteria = c.segmento === "quinteros" || c.segmento === "ambulantes";
  if (rol === "lider") return true;
  if (rol === "guardia") return dePorteria;
  if (rol === "admin") return !dePorteria;
  return false;
}

/**
 * Total del mes de lo que paga (Σ cantidad × precio) y cuánto queda si paga en término
 * (con el beneficio de cada concepto). Es una vista previa: la cuenta real la hace la
 * facturación. Centavos enteros para no arrastrar errores de coma flotante.
 */
export function totalMensual(
  items: { cantidad: number; precio: number; descuentoPp: number }[]
): { total: number; conBeneficio: number } {
  let total = 0;
  let conBeneficio = 0;
  for (const i of items) {
    const cents = Math.round(Number(i.cantidad) * Number(i.precio) * 100);
    total += cents;
    conBeneficio += Math.round((cents * (100 - Number(i.descuentoPp || 0))) / 100);
  }
  return { total: total / 100, conBeneficio: conBeneficio / 100 };
}

/** Cuotas que se ofrecen según la categoría (C5, G7). El ambulante no elige: paga por día. */
export function cuotasDeCategoria(categoria: string): { opciones?: number[]; permitirOtra: boolean } {
  if (categoria === "quintero") return { opciones: [1, 2, 3, 4], permitirOtra: false };
  return { permitirOtra: true };
}
