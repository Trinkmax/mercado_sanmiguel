import type { Rol } from "@/lib/auth";

/** Etiqueta visible de cada rol. El valor del enum NO cambia (RPC/RLS);
 * `guardia` es el Jefe de Portería (el único de portería que cobra). */
export const LABEL_ROL: Record<Rol, string> = {
  admin: "Administración",
  guardia: "Jefe de Portería",
  porteria: "Portería",
  tesoreria: "Tesorería",
  consejo: "Consejo",
  lider: "Líder de Procesos",
  socio: "Socio",
};

/** Qué hace cada rol, en una línea (login demo, configuración → usuarios). */
export const DESCRIPCION_ROL: Record<Rol, string> = {
  admin: "Cobra, carga cheques, integra la caja de portería y ejecuta resoluciones",
  guardia: "Cobra quinteros y canon en portería; rinde la caja",
  porteria: "Registra el ingreso de personal y genera solicitudes",
  tesoreria: "Arquea, concilia el banco, valida cajas y maneja cheques",
  consejo: "Reportes y resolución de solicitudes",
  lider: "Aprueba cambios, personal, reportes y deriva al Consejo",
  socio: "El portal del puestero",
};

/** Orden canónico para listados de usuarios. */
export const ORDEN_ROL: Rol[] = [
  "lider",
  "admin",
  "tesoreria",
  "consejo",
  "guardia",
  "porteria",
  "socio",
];

/** Roles de staff (todo menos socio). */
export const ROLES_STAFF: Rol[] = [
  "admin",
  "guardia",
  "porteria",
  "tesoreria",
  "consejo",
  "lider",
];

/** Roles que pueden registrar cobros (el Jefe de Portería sí; Portería no). */
export const ROLES_COBRAN: Rol[] = ["admin", "guardia", "tesoreria"];

/** Roles que ven el módulo global de Reportes (oculto para Administración). */
export const ROLES_REPORTES: Rol[] = ["lider", "consejo", "tesoreria"];

/** Roles que gestionan clientes/conceptos: el líder aplica directo; el resto
 * propone un cambio que el Líder de Procesos aprueba. */
export const ROLES_GESTION_CLIENTES: Rol[] = ["admin", "tesoreria", "consejo", "lider"];
