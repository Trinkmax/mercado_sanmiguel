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

export type GrupoNav = "hoy" | "socios" | "plata" | "direccion";

export type ItemNav = {
  href: string;
  label: string;
  icono: LucideIcon;
  roles: Rol[];
  /** Grupo plegable del menú. "hoy" (lo operativo del día) siempre queda abierto;
   * los demás se pliegan y se abren solos cuando contienen la ruta actual. */
  grupo: GrupoNav;
};

export const LABEL_GRUPO: Record<GrupoNav, string> = {
  hoy: "Hoy",
  socios: "Socios",
  plata: "Plata",
  direccion: "Dirección",
};

/** Orden de los grupos en el menú. */
export const ORDEN_GRUPOS: GrupoNav[] = ["hoy", "socios", "plata", "direccion"];

/** Navegación del panel: cada rol ve solo lo que usa.
 * - `guardia` es el Jefe de Portería (cobra); `porteria` no cobra.
 * - Reportes: oculto para Administración (pedido del cliente).
 * - Aprobaciones y Personal: solo el Líder de Procesos.
 * Con 7 entradas o menos (Portería, Jefe de Portería) el menú es una lista plana;
 * con más, se agrupa en Hoy / Socios / Plata / Dirección. */
export const NAVEGACION: ItemNav[] = [
  // Hoy: lo que se usa todos los días, a un toque.
  { href: "/inicio", label: "Inicio", icono: LayoutDashboard, grupo: "hoy", roles: ["admin", "guardia", "tesoreria", "consejo", "lider"] },
  { href: "/cobranza", label: "Cobrar", icono: HandCoins, grupo: "hoy", roles: ["admin", "guardia", "tesoreria"] },
  { href: "/caja", label: "Caja del día", icono: Wallet, grupo: "hoy", roles: ["admin", "guardia", "tesoreria"] },
  { href: "/porteria", label: "Portería", icono: DoorOpen, grupo: "hoy", roles: ["porteria", "guardia", "admin", "lider"] },
  { href: "/mapa", label: "Mapa", icono: Map, grupo: "hoy", roles: ["admin", "guardia", "tesoreria", "consejo", "lider"] },
  // Socios: la carpeta del cliente y la comunicación con él.
  { href: "/clientes", label: "Clientes", icono: Store, grupo: "socios", roles: ["admin", "tesoreria", "consejo", "lider"] },
  { href: "/solicitudes", label: "Solicitudes", icono: MessagesSquare, grupo: "socios", roles: ["admin", "guardia", "porteria", "tesoreria", "consejo", "lider"] },
  { href: "/aprobaciones", label: "Aprobaciones", icono: ClipboardCheck, grupo: "socios", roles: ["lider"] },
  { href: "/comunicaciones", label: "Comunicaciones", icono: Megaphone, grupo: "socios", roles: ["admin", "consejo", "lider"] },
  // Plata: lo que entra y lo que sale.
  { href: "/facturacion", label: "Facturación", icono: CalendarRange, grupo: "plata", roles: ["admin", "tesoreria", "consejo", "lider"] },
  { href: "/energia", label: "Energía", icono: Zap, grupo: "plata", roles: ["admin", "tesoreria", "consejo", "lider"] },
  { href: "/cheques", label: "Cheques", icono: Banknote, grupo: "plata", roles: ["admin", "tesoreria", "consejo", "lider"] },
  { href: "/gastos", label: "Gastos", icono: Receipt, grupo: "plata", roles: ["admin", "tesoreria", "consejo", "lider"] },
  { href: "/tesoreria", label: "Tesorería", icono: Vault, grupo: "plata", roles: ["tesoreria", "consejo", "lider"] },
  // Dirección: mirar, decidir, configurar.
  { href: "/reportes", label: "Reportes", icono: FileBarChart2, grupo: "direccion", roles: ["tesoreria", "consejo", "lider"] },
  { href: "/personal", label: "Personal", icono: Users, grupo: "direccion", roles: ["lider"] },
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
