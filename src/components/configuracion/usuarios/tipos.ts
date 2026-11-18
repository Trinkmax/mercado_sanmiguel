import type { Rol } from "@/lib/auth";

/** Un usuario del sistema tal como lo ve quien gestiona (nunca con su email). */
export type UsuarioFila = {
  user_id: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  dni: string | null;
  /** Rastro de "Quitar acceso" (lo escribe la base): cuándo y quién. */
  desactivadoEn: string | null;
  desactivadoPor: string | null;
};

/** Persona del padrón de Personal que todavía se puede convertir en usuario. */
export type EmpleadoPadron = {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  sector: string;
  cargo: string | null;
  /** Ya tiene usuario con ese DNI (se muestra, no se elige). */
  conUsuario: boolean;
};

/** Cliente que puede tener acceso al portal (puesteros y quinteros; nunca ambulantes ni empleados). */
export type ClienteAcceso = {
  id: string;
  codigo: number;
  nombre: string;
  apodo: string | null;
  cuit: string | null;
  tipoPersona: "fisica" | "juridica";
  /** Socio de la cooperativa (clientes.es_socio). El portal no es solo para socios. */
  esSocio: boolean;
  /** "Puesto 58 · 60 · Local 3" (para buscar y reconocerlo). */
  lugares: string | null;
  acceso: UsuarioFila | null;
  /**
   * 0066: la carpeta está unida al usuario de alguien del equipo (Gerardo, Jefe de Portería, es
   * la carpeta 82): la ve en «Mi lugar en el mercado». Su acceso se gestiona como equipo.
   */
  equipo: PersonaEquipo | null;
  /** Solo para el Líder: alguien del equipo entra con el DNI de esta carpeta (se puede unir). */
  equipoConSuDni: PersonaEquipo | null;
  /** Cliente dado de baja que todavía tiene usuario del portal activo (hay que quitárselo). */
  dadoDeBaja: boolean;
};

/** Alguien del equipo relacionado con una carpeta (unida o para unir). */
export type PersonaEquipo = {
  nombre: string;
  rol: Rol;
  /** Tiene acceso al sistema hoy. */
  activo: boolean;
  /** Ya tiene otra carpeta unida (no se le puede unir una segunda). */
  conOtraCarpeta?: boolean;
};
