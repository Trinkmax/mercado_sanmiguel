import "server-only";

/**
 * Acceso demo del login (tarjetas "Modo demo · entrá como…" con los usuarios de
 * prueba). Lo usa el dueño para mostrar el sistema. Queda APAGADO salvo que el
 * servidor tenga `MODO_DEMO=1` (falla cerrada: un deploy sin la variable no
 * muestra las tarjetas). Apagado, no se muestran las tarjetas y la acción
 * `entrarComoDemo` rechaza el pedido aunque alguien la llame a mano.
 * Para desarrollo va `MODO_DEMO=1` en `.env.local`; en Vercel se carga solo
 * mientras se muestre la demo.
 * Ojo: apagarlo no borra los usuarios demo. Antes de cargar datos reales,
 * cambiales la contraseña o quitales el acceso desde Configuración → Usuarios.
 */
export function modoDemoActivo(): boolean {
  return process.env.MODO_DEMO?.trim() === "1";
}
