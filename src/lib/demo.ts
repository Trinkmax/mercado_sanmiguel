import "server-only";

/**
 * Acceso demo del login (tarjetas "Modo demo · entrá como…" con los usuarios de
 * prueba). Ignacio lo usa para entrar rápido a cada rol y mostrar el sistema, así
 * que queda PRENDIDO salvo que el servidor tenga `MODO_DEMO=0`. Apagado, no se
 * muestran las tarjetas y la acción `entrarComoDemo` rechaza el pedido aunque
 * alguien la llame a mano.
 * Antes de salir a producción con datos reales: cargar `MODO_DEMO=0` en Vercel y
 * cambiarles la contraseña (o quitarles el acceso) a los usuarios demo desde
 * Configuración → Usuarios.
 */
export function modoDemoActivo(): boolean {
  return process.env.MODO_DEMO?.trim() !== "0";
}
