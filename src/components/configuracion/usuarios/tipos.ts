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

/** Cliente que puede tener acceso al portal (puesteros y quinteros; nunca ambulantes). */
export type ClienteAcceso = {
  id: string;
  codigo: number;
  nombre: string;
  apodo: string | null;
  cuit: string | null;
  tipoPersona: "fisica" | "juridica";
  /** "Puesto 58 · 60 · Local 3" (para buscar y reconocerlo). */
  lugares: string | null;
  acceso: UsuarioFila | null;
};
