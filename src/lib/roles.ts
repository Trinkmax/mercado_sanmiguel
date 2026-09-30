import type { Rol } from "@/lib/auth";

/** Etiqueta visible de cada rol. El valor del enum NO cambia (RPC/RLS);
 * `guardia` es el Jefe de Portería. `consejo` queda solo para leer hilos viejos
 * de solicitudes: el Consejo ya no tiene usuario ni pantalla (F5). */
export const LABEL_ROL: Record<Rol, string> = {
  admin: "Administración",
  guardia: "Jefe de Portería",
  porteria: "Portería",
  tesoreria: "Tesorería",
  consejo: "Consejo",
  lider: "Líder de Procesos",
  socio: "Socio",
};

/** Qué hace cada rol, en una línea (alta de usuarios). */
export const DESCRIPCION_ROL: Record<Rol, string> = {
  admin: "Cobra a los puesteros, integra la caja de portería y da acceso a los socios",
  guardia:
    "Cobra a quinteros y ambulantes, rinde la caja de portería y gestiona los usuarios de Portería",
  porteria: "Cobra el canon de transporte, registra el ingreso del personal y genera solicitudes",
  tesoreria: "Valida cajas, concilia el banco y maneja cheques, gastos y el flujo de fondos",
  consejo: "Ya no se usa: lo que resuelve el Consejo lo registra el Líder de Procesos",
  lider:
    "Aprueba cambios, gestiona usuarios y personal, mira reportes y registra lo que resuelve el Consejo. Puede hacer todo lo de los demás",
  socio: "El portal del socio: su cuenta, recibos y comunicaciones",
};

/** Orden canónico para listados de usuarios (sin Consejo). */
export const ORDEN_ROL: Rol[] = ["lider", "admin", "tesoreria", "guardia", "porteria", "socio"];

/** Roles de staff (todo menos socio; el Consejo ya no entra, F5). */
export const ROLES_STAFF: Rol[] = ["admin", "guardia", "porteria", "tesoreria", "lider"];

/** Roles que cobran. El Líder de Procesos cobra a cualquier categoría (§1.3 D-P2);
 * Tesorería no cobra (J1); Portería cobra solo el canon de transporte (no cuenta acá). */
export const ROLES_COBRAN: Rol[] = ["admin", "guardia", "lider"];

/** Roles que ven el módulo global de Reportes (J7: solo el Líder). */
export const ROLES_REPORTES: Rol[] = ["lider"];

/** Roles que gestionan clientes: el Líder aplica directo; Administración (puesteros)
 * y el Jefe de Portería (quinteros y ambulantes) proponen y el Líder aprueba. */
export const ROLES_GESTION_CLIENTES: Rol[] = ["admin", "guardia", "lider"];

/** Roles de staff que se pueden asignar al crear un usuario (nunca Consejo). */
export const ROLES_ASIGNABLES_STAFF: Rol[] = ["lider", "admin", "tesoreria", "guardia", "porteria"];

/**
 * Qué roles gestiona cada rol (crear, quitar/devolver acceso, nueva contraseña, editar).
 * Espejo de `private.puede_gestionar_rol` (0011): Líder → todo el staff y socios;
 * Administración → socios (F2); Jefe de Portería → Portería (F3); resto → nadie.
 */
export function rolesQueGestiona(rol: Rol): Rol[] {
  switch (rol) {
    case "lider":
      return [...ROLES_ASIGNABLES_STAFF, "socio"];
    case "admin":
      return ["socio"];
    case "guardia":
      return ["porteria"];
    default:
      return [];
  }
}

/** ¿`actor` puede gestionar a un usuario con rol `objetivo`? (nunca Consejo) */
export function puedeGestionarRol(actor: Rol, objetivo: Rol): boolean {
  if (objetivo === "consejo") return false;
  return rolesQueGestiona(actor).includes(objetivo);
}
