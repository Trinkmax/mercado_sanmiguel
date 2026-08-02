import type { Rol } from "@/lib/auth";
import {
  Banknote,
  FileBarChart2,
  HandCoins,
  LayoutDashboard,
  Map,
  Receipt,
  Settings,
  Store,
  Landmark,
  Vault,
  Wallet,
  Zap,
  CalendarRange,
  type LucideIcon,
} from "lucide-react";

export type ItemNav = {
  href: string;
  label: string;
  icono: LucideIcon;
  roles: Rol[];
};

/** Navegación del panel: cada rol ve solo lo que usa. */
export const NAVEGACION: ItemNav[] = [
  { href: "/inicio", label: "Inicio", icono: LayoutDashboard, roles: ["admin", "guardia", "tesoreria", "consejo"] },
  { href: "/cobranza", label: "Cobrar", icono: HandCoins, roles: ["admin", "guardia", "tesoreria"] },
  { href: "/caja", label: "Caja del día", icono: Wallet, roles: ["admin", "guardia", "tesoreria"] },
  { href: "/mapa", label: "Mapa", icono: Map, roles: ["admin", "guardia", "tesoreria", "consejo"] },
  { href: "/clientes", label: "Clientes", icono: Store, roles: ["admin", "tesoreria", "consejo"] },
  { href: "/cheques", label: "Cheques", icono: Banknote, roles: ["admin", "tesoreria", "consejo"] },
  { href: "/energia", label: "Energía", icono: Zap, roles: ["admin", "tesoreria", "consejo"] },
  { href: "/gastos", label: "Gastos", icono: Receipt, roles: ["admin", "tesoreria", "consejo"] },
  { href: "/tesoreria", label: "Tesorería", icono: Vault, roles: ["tesoreria", "consejo"] },
  { href: "/facturacion", label: "Facturación", icono: CalendarRange, roles: ["admin", "tesoreria", "consejo"] },
  { href: "/reportes", label: "Reportes", icono: FileBarChart2, roles: ["admin", "tesoreria", "consejo"] },
  { href: "/configuracion", label: "Configuración", icono: Settings, roles: ["admin", "tesoreria", "consejo"] },
];

export const NAVEGACION_SOCIO: ItemNav[] = [
  { href: "/mi-cuenta", label: "Mi cuenta", icono: Landmark, roles: ["socio"] },
];

export function navParaRol(rol: Rol): ItemNav[] {
  return NAVEGACION.filter((item) => item.roles.includes(rol));
}
