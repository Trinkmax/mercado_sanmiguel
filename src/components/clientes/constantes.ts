/** Constantes del módulo Clientes (compartidas entre server y client components). */

export const CATEGORIAS_DOCUMENTO = [
  { valor: "habilitacion_municipal", label: "Habilitación municipal" },
  { valor: "senasa", label: "SENASA" },
  { valor: "apto_electrico", label: "Apto eléctrico" },
  { valor: "otro", label: "Otro" },
] as const;

export type CategoriaDocumento = (typeof CATEGORIAS_DOCUMENTO)[number]["valor"];

export function labelCategoria(categoria: string): string {
  return (
    CATEGORIAS_DOCUMENTO.find((c) => c.valor === categoria)?.label ?? categoria
  );
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

/** Registros documentales del cliente (tabla `sanciones`, enum `tipo_sancion`). */
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
