import type { Rol } from "@/lib/auth";
import { CajaRegistradora } from "@/components/shared/iconos";
import {
  Banknote,
  ClipboardCheck,
  ClipboardList,
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
  Zap,
  CalendarRange,
  type LucideIcon,
} from "lucide-react";

export type GrupoNav = "hoy" | "gestion" | "plata" | "direccion";

export type ItemNav = {
  href: string;
  label: string;
  icono: LucideIcon;
  roles: Rol[];
  /** Grupo plegable del menú. "hoy" (lo operativo del día) siempre queda abierto;
   * los demás se pliegan y se abren solos cuando contienen la ruta actual. */
  grupo: GrupoNav;
  /** Etiqueta corta para la barra inferior del celular (si la común no entra). */
  corto?: string;
  /** Nombre distinto según quién mira (lo aplica `navParaRol`): p. ej. `/caja`
   * del Jefe = "Caja de portería"; `/clientes` del Jefe = "Quinteros y ambulantes". */
  porRol?: Partial<Record<Rol, { label?: string; corto?: string }>>;
};

/** Con esta cantidad de entradas o menos el menú va plano (sin grupos), en la
 * barra lateral y en la hoja "Menú" del celular. El Jefe de Portería tiene 8. */
export const MAX_PLANO = 8;

export const LABEL_GRUPO: Record<GrupoNav, string> = {
  hoy: "Hoy",
  gestion: "Gestión",
  plata: "Plata",
  direccion: "Dirección",
};

/** Orden de los grupos en el menú. */
export const ORDEN_GRUPOS: GrupoNav[] = ["hoy", "gestion", "plata", "direccion"];

/** Navegación del panel: cada rol ve solo lo que usa (contrato fase 3, §7.1).
 * - `guardia` es el Jefe de Portería: cobra quinteros y ambulantes, sin canon ni /porteria.
 * - `porteria` cobra el canon de transporte y registra ingresos (arranca en /porteria).
 * - El Líder de Procesos ve y opera todo (§1.3 D-P2), incluido Cobrar y Portería.
 * - Tesorería: sin Cobrar, Clientes, Mapa, Facturación, Energía, Reportes ni Configuración.
 * - El Consejo no tiene pantallas (F5): su perfil está desactivado.
 * Con MAX_PLANO entradas o menos (Portería, Jefe de Portería, Tesorería) el menú es
 * una lista plana; con más, se agrupa en Hoy / Gestión / Plata / Dirección. */
export const NAVEGACION: ItemNav[] = [
  // Hoy: lo que se usa todos los días, a un toque.
  { href: "/inicio", label: "Inicio", icono: LayoutDashboard, grupo: "hoy", roles: ["admin", "guardia", "tesoreria", "lider"] },
  { href: "/cobranza", label: "Cobrar", icono: HandCoins, grupo: "hoy", roles: ["admin", "guardia", "lider"] },
  {
    href: "/caja",
    label: "Caja del día",
    corto: "Caja",
    icono: CajaRegistradora,
    grupo: "hoy",
    roles: ["admin", "guardia", "tesoreria", "lider"],
    porRol: {
      guardia: { label: "Caja de portería", corto: "Caja" },
      tesoreria: { label: "Cajas del día", corto: "Cajas" },
    },
  },
  { href: "/porteria", label: "Portería", icono: DoorOpen, grupo: "hoy", roles: ["porteria", "lider"] },
  { href: "/mapa", label: "Mapa", icono: Map, grupo: "hoy", roles: ["admin", "guardia", "lider"] },
  // Gestión: la carpeta del cliente y la comunicación con él.
  {
    href: "/clientes",
    label: "Clientes",
    icono: Store,
    grupo: "gestion",
    roles: ["admin", "guardia", "lider"],
    porRol: { guardia: { label: "Quinteros y ambulantes", corto: "Quintas" } },
  },
  { href: "/solicitudes", label: "Solicitudes", icono: MessagesSquare, grupo: "gestion", roles: ["admin", "guardia", "porteria", "tesoreria", "lider"] },
  { href: "/aprobaciones", label: "Aprobaciones", corto: "Aprobar", icono: ClipboardCheck, grupo: "gestion", roles: ["lider"] },
  { href: "/comunicaciones", label: "Comunicaciones", corto: "Avisos", icono: Megaphone, grupo: "gestion", roles: ["admin", "lider"] },
  { href: "/novedades", label: "Novedades", icono: ClipboardList, grupo: "gestion", roles: ["admin", "guardia", "lider"] },
  // Plata: lo que entra y lo que sale.
  { href: "/facturacion", label: "Facturación", icono: CalendarRange, grupo: "plata", roles: ["admin", "lider"] },
  { href: "/energia", label: "Energía", icono: Zap, grupo: "plata", roles: ["admin", "lider"] },
  { href: "/cheques", label: "Cheques", icono: Banknote, grupo: "plata", roles: ["tesoreria", "lider"] },
  { href: "/gastos", label: "Gastos", icono: Receipt, grupo: "plata", roles: ["admin", "tesoreria", "lider"] },
  { href: "/tesoreria", label: "Tesorería", icono: Landmark, grupo: "plata", roles: ["tesoreria", "lider"] },
  // Dirección: mirar, decidir, configurar.
  { href: "/reportes", label: "Reportes", icono: FileBarChart2, grupo: "direccion", roles: ["lider"] },
  { href: "/personal", label: "Personal", icono: Users, grupo: "direccion", roles: ["lider"] },
  { href: "/configuracion", label: "Configuración", corto: "Ajustes", icono: Settings, grupo: "direccion", roles: ["admin", "guardia", "lider"] },
];

export const NAVEGACION_SOCIO: ItemNav[] = [
  { href: "/mi-cuenta", label: "Mi cuenta", icono: Landmark, grupo: "hoy", roles: ["socio"] },
];

/** Barra inferior del celular/tablet: las (hasta 4) secciones que cada rol usa
 * a diario; el resto queda en "Menú". Portería y Jefe de Portería viven acá. */
export const TABS_MOVIL: Record<Rol, string[]> = {
  porteria: ["/porteria", "/solicitudes"],
  guardia: ["/inicio", "/cobranza", "/caja", "/clientes"],
  admin: ["/inicio", "/cobranza", "/caja", "/mapa"],
  tesoreria: ["/inicio", "/caja", "/tesoreria", "/cheques"],
  consejo: [],
  lider: ["/inicio", "/aprobaciones", "/mapa", "/clientes"],
  socio: ["/mi-cuenta"],
};

/** Entradas del menú de un rol, con los nombres propios de ese rol (`porRol`). */
export function navParaRol(rol: Rol): ItemNav[] {
  return NAVEGACION.filter((item) => item.roles.includes(rol)).map((item) => {
    const propio = item.porRol?.[rol];
    if (!propio) return item;
    return {
      ...item,
      label: propio.label ?? item.label,
      corto: propio.corto ?? item.corto,
    };
  });
}

/** Contadores de pendientes por ruta (badge en la navegación). */
export type BadgesNav = Partial<Record<string, number>>;
