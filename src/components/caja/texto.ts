/**
 * Textos que arma la base ("Efectivo $ 702.500 — Quintas $ 1.072.500 · …", private.caja_pesos)
 * llevan un espacio común entre "$" y el número: en un celular el renglón se cortaba ahí
 * ("efectivo $" / "702.500"). Acá ese espacio pasa a ser duro, como el de formatARS.
 */
export function montosSinCortar(texto: string): string {
  return texto.replace(/\$ (?=[\d−-])/g, "$ ");
}
