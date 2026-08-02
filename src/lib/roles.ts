import type { Rol } from "@/lib/auth";

export const LABEL_ROL: Record<Rol, string> = {
  admin: "Administración",
  guardia: "Guardia",
  tesoreria: "Tesorería",
  consejo: "Consejo",
  socio: "Socio",
};
