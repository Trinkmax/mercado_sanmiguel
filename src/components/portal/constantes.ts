/** Constantes del Portal del socio (compartidas entre server y client components). */

export const CATEGORIAS_DOCUMENTO = [
  { valor: "habilitacion_municipal", label: "Habilitación municipal" },
  { valor: "senasa", label: "SENASA" },
  { valor: "apto_electrico", label: "Apto eléctrico" },
  { valor: "otro", label: "Otro" },
] as const;

export function labelCategoria(categoria: string): string {
  return (
    CATEGORIAS_DOCUMENTO.find((c) => c.valor === categoria)?.label ?? categoria
  );
}

export const LABEL_MEDIO: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  cheque: "Cheque",
};

/** Pestañas de /mi-cuenta/comunicaciones (B2). `tipo` = tipo de registro (null = circulares). */
export const PESTANAS_PORTAL = [
  {
    valor: "circulares",
    label: "Circulares",
    tipo: null,
    vacioTitulo: "No hay circulares para vos",
    vacioTexto: "Cuando la cooperativa publique una circular para tu grupo, la vas a ver acá.",
  },
  {
    valor: "notificaciones",
    label: "Notificaciones",
    tipo: "notificacion",
    vacioTitulo: "No tenés notificaciones",
    vacioTexto: "Si la administración te manda un aviso formal, lo vas a ver acá y lo vas a poder responder.",
  },
  {
    valor: "apercibimientos",
    label: "Apercibimientos",
    tipo: "apercibimiento",
    vacioTitulo: "No tenés apercibimientos. ¡Bien!",
    vacioTexto: "Seguí así.",
  },
  {
    valor: "sanciones",
    label: "Sanciones",
    tipo: "sancion",
    vacioTitulo: "No tenés sanciones. ¡Bien!",
    vacioTexto: "Seguí así.",
  },
] as const;

export type PestanaPortal = (typeof PESTANAS_PORTAL)[number]["valor"];

/** Acepta pdf/jpg/png/webp (para el input de archivo). */
export const ACCEPT_ARCHIVOS =
  "application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp";
