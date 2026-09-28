/**
 * Utilidades del alta de usuarios (client-safe).
 * Contraseñas legibles para gente mayor: una palabra del mercado + 4 números
 * ("Tomate-4821"). Sin tildes ni letras parecidas, fáciles de dictar e imprimir.
 */

const PALABRAS = [
  "Tomate", "Lechuga", "Papa", "Cebolla", "Zapallo", "Morron", "Naranja", "Limon",
  "Manzana", "Banana", "Pera", "Durazno", "Choclo", "Batata", "Acelga", "Zanahoria",
  "Pepino", "Melon", "Sandia", "Uva", "Frutilla", "Ciruela", "Kiwi", "Palta",
  "Rabanito", "Espinaca", "Ajo", "Perejil", "Albahaca", "Mandarina", "Pomelo", "Anana",
  "Remolacha", "Berenjena", "Zapallito", "Radicheta", "Rucula", "Puerro", "Apio", "Coliflor",
  "Brocoli", "Repollo", "Arveja", "Chaucha", "Mango", "Cereza", "Damasco", "Membrillo",
  "Nuez", "Almendra", "Higo", "Granada", "Frambuesa", "Mora", "Tuna", "Mamon",
];

function aleatorio(max: number): number {
  const r = new Uint32Array(1);
  crypto.getRandomValues(r);
  return r[0] % max;
}

/** "Tomate-4821" (≥ 8 caracteres, lo que exige el servidor). */
export function generarContrasena(): string {
  const palabra = PALABRAS[aleatorio(PALABRAS.length)];
  const numero = String(1000 + aleatorio(9000));
  return `${palabra}-${numero}`;
}

/** "12345678" → "12.345.678" mientras se tipea (puntos de a tres desde la derecha). */
export function dniConPuntos(valor: string): string {
  return valor
    .replace(/\D/g, "")
    .slice(0, 8)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * DNI a partir del CUIT de una persona física ("20-12345678-3" → "12345678";
 * "20-07123456-3" → "7123456"). Null si no se puede.
 */
export function dniDesdeCuit(cuit: string | null | undefined): string | null {
  const c = (cuit ?? "").replace(/\D/g, "");
  if (c.length !== 11) return null;
  const dni = c.slice(2, 10).replace(/^0+/, "");
  return /^[0-9]{7,8}$/.test(dni) ? dni : null;
}

/** Inicial para el círculo de la fila. */
export function inicial(nombre: string): string {
  return nombre.trim().charAt(0).toUpperCase() || "?";
}
