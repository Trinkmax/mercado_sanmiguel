import type { Rol } from "@/lib/auth";
import {
  Banknote,
  ClipboardCheck,
  DoorOpen,
  FileBarChart2,
  HandCoins,
  LayoutDashboard,
  Map,
  Megaphone,
  MessagesSquare,
  Receipt,
  Settings,
  Store,
  Landmark,
  Users,
  Vault,
  Wallet,
  Zap,
  CalendarRange,
  type LucideIcon,
} from "lucide-react";

export type GrupoNav = "hoy" | "gestion" | "direccion";

export type ItemNav = {
  href: string;
  label: string;
  icono: LucideIcon;
  roles: Rol[];
  /** Agrupa el menú cuando un rol ve muchas entradas (líder, tesorería). */
  grupo: GrupoNav;
};

export const LABEL_GRUPO: Record<GrupoNav, string> = {
  hoy: "Hoy",
  gestion: "Gestión",
  direccion: "Dirección",
};

/** Navegación del panel: cada rol ve solo lo que usa.
 * - `guardia` es el Jefe de Portería (cobra); `porteria` no cobra.
 * - Reportes: oculto para Administración (pedido del cliente).
 * - Aprobaciones y Personal: solo el Líder de Procesos. */
export const NAVEGACION: ItemNav[] = [
  { href: "/inicio", label: "Inicio", icono: LayoutDashboard, grupo: "hoy", roles: ["admin", "guardia", "tesoreria", "consejo", "lider"] },
  { href: "/cobranza", label: "Cobrar", icono: HandCoins, grupo: "hoy", roles: ["admin", "guardia", "tesoreria"] },
  { href: "/caja", label: "Caja del día", icono: Wallet, grupo: "hoy", roles: ["admin", "guardia", "tesoreria"] },
  { href: "/porteria", label: "Portería", icono: DoorOpen, grupo: "hoy", roles: ["porteria", "guardia", "admin", "lider"] },
  { href: "/mapa", label: "Mapa", icono: Map, grupo: "hoy", roles: ["admin", "guardia", "tesoreria", "consejo", "lider"] },
  { href: "/clientes", label: "Clientes", icono: Store, grupo: "gestion", roles: ["admin", "tesoreria", "consejo", "lider"] },
  { href: "/solicitudes", label: "Solicitudes", icono: MessagesSquare, grupo: "gestion", roles: ["admin", "guardia", "porteria", "tesoreria", "consejo", "lider"] },
  { href: "/aprobaciones", label: "Aprobaciones", icono: ClipboardCheck, grupo: "gestion", roles: ["lider"] },
  { href: "/comunicaciones", label: "Comunicaciones", icono: Megaphone, grupo: "gestion", roles: ["admin", "consejo", "lider"] },
  { href: "/personal", label: "Personal", icono: Users, grupo: "gestion", roles: ["lider"] },
  { href: "/cheques", label: "Cheques", icono: Banknote, grupo: "gestion", roles: ["admin", "tesoreria", "consejo", "lider"] },
  { href: "/energia", label: "Energía", icono: Zap, grupo: "gestion", roles: ["admin", "tesoreria", "consejo", "lider"] },
  { href: "/gastos", label: "Gastos", icono: Receipt, grupo: "gestion", roles: ["admin", "tesoreria", "consejo", "lider"] },
  { href: "/facturacion", label: "Facturación", icono: CalendarRange, grupo: "gestion", roles: ["admin", "tesoreria", "consejo", "lider"] },
  { href: "/tesoreria", label: "Tesorería", icono: Vault, grupo: "direccion", roles: ["tesoreria", "consejo", "lider"] },
  { href: "/reportes", label: "Reportes", icono: FileBarChart2, grupo: "direccion", roles: ["tesoreria", "consejo", "lider"] },
  { href: "/configuracion", label: "Configuración", icono: Settings, grupo: "direccion", roles: ["admin", "tesoreria", "consejo", "lider"] },
];

export const NAVEGACION_SOCIO: ItemNav[] = [
  { href: "/mi-cuenta", label: "Mi cuenta", icono: Landmark, grupo: "hoy", roles: ["socio"] },
];

export function navParaRol(rol: Rol): ItemNav[] {
  return NAVEGACION.filter((item) => item.roles.includes(rol));
}

/** Contadores de pendientes por ruta (badge en la navegación). */
export type BadgesNav = Partial<Record<string, number>>;
