/**
 * "Tu sesión se cerró… y seguís donde estabas": el proxy manda al login con
 * `?volver=<ruta y query>` y, después de entrar, se vuelve ahí.
 * Solo rutas RELATIVAS de esta app: nada de "//otro-sitio", "https://…",
 * barras invertidas ni caracteres de control (el navegador los saltea y
 * "/\t/sitio" terminaría en otro dominio). Client-safe y sin dependencias:
 * lo usa el proxy.
 */

const LARGO_MAXIMO = 1000;

/** La ruta si es segura para redirigir; si no, null. */
export function rutaVolverSegura(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const ruta = valor.trim();
  if (!ruta || ruta.length > LARGO_MAXIMO) return null;
  if (!ruta.startsWith("/") || ruta.startsWith("//")) return null;
  if (ruta.includes("://") || ruta.includes("\\")) return null;
  if (/[\u0000-\u001f\u007f\s]/.test(ruta)) return null;
  // Volver al login o a la raíz no lleva a ningún lado.
  const pathname = ruta.split(/[?#]/)[0];
  if (pathname === "/" || pathname === "/login" || pathname.startsWith("/login/")) return null;
  return ruta;
}

/** Ruta + query de un pedido, sin los parámetros internos de Next (`_rsc`). */
export function rutaDelPedido(url: { pathname: string; search: string }): string | null {
  const params = new URLSearchParams(url.search);
  params.delete("_rsc");
  const query = params.toString();
  return rutaVolverSegura(query ? `${url.pathname}?${query}` : url.pathname);
}
