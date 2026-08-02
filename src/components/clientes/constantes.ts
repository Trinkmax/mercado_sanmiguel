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

/** Acepta pdf/jpg/png/webp (para el input de archivo). */
export const ACCEPT_ARCHIVOS =
  "application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp";
