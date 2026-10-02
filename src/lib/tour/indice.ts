import {
  Banknote,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  Compass,
  DoorOpen,
  FileBarChart2,
  HandCoins,
  Landmark,
  LayoutDashboard,
  Map,
  Megaphone,
  MessagesSquare,
  Receipt,
  Settings,
  Store,
  Users,
  Wallet,
  Zap,
  Bell,
} from "lucide-react";
import type { Rol } from "@/lib/auth";
import { CajaRegistradora } from "@/components/shared/iconos";
import { LABEL_ROL } from "@/lib/roles";
import { navParaRol } from "@/lib/navegacion";
import type { IdCapitulo, MetaCapitulo } from "@/lib/tour/tipos";

/** Nombre de la sección como lo ve ese rol en su menú ("Caja de portería" para el Jefe). */
function nombreNav(href: string, rol: Rol, otro: string): string {
  return navParaRol(rol).find((i) => i.href === href)?.label ?? otro;
}

const STAFF: Rol[] = ["admin", "guardia", "porteria", "tesoreria", "lider"];

/**
 * Los capítulos del tour: qué pantalla enseña cada uno y a quién. Los pasos viven en
 * src/lib/tour/contenido/ (se cargan recién cuando empieza un tour).
 */
export const CAPITULOS_META: Record<IdCapitulo, MetaCapitulo> = {
  bienvenida: {
    id: "bienvenida",
    roles: STAFF,
    icono: Compass,
    titulo: () => "Cómo moverte",
    resumen: (rol) =>
      rol === "porteria" || rol === "guardia"
        ? "El menú, los avisos de pendientes y dónde pedir ayuda"
        : "El menú, los números de pendientes, la ayuda y cómo salir",
  },
  "bienvenida-socio": {
    id: "bienvenida-socio",
    roles: ["socio"],
    icono: Compass,
    titulo: () => "Cómo moverte",
    resumen: () => "Tus dos secciones, la ayuda y cómo salir",
  },
  inicio: {
    id: "inicio",
    ruta: "/inicio",
    roles: ["admin", "guardia", "tesoreria", "lider"],
    icono: LayoutDashboard,
    titulo: () => "Inicio",
    resumen: (rol) =>
      rol === "tesoreria"
        ? "Lo que te espera hoy: cajas por validar, transferencias y cheques"
        : rol === "lider"
          ? "Cómo viene el mes y lo que espera tu decisión"
          : "Cómo viene el día y lo que tenés pendiente",
  },
  mapa: {
    id: "mapa",
    ruta: "/mapa",
    roles: ["admin", "guardia", "lider"],
    icono: Map,
    titulo: () => "Mapa",
    resumen: (rol) =>
      rol === "guardia"
        ? "Cómo vienen tus quinteros y cómo avisarle algo al Líder sobre un puesto"
        : "El plano del mercado: quién está en cada lugar y quién debe",
  },
  cobrar: {
    id: "cobrar",
    ruta: "/cobranza",
    roles: ["admin", "guardia", "lider"],
    icono: HandCoins,
    titulo: () => "Cobrar",
    resumen: (rol) =>
      rol === "guardia"
        ? "Cobrarle a un quintero o a un ambulante y darle su recibo"
        : "Buscar al cliente, cobrarle y darle su recibo",
  },
  caja: {
    id: "caja",
    ruta: "/caja",
    roles: ["admin", "guardia", "tesoreria", "lider"],
    icono: CajaRegistradora,
    titulo: (rol) => nombreNav("/caja", rol, "Caja del día"),
    resumen: (rol) =>
      rol === "guardia"
        ? "Abrir tu caja, ver lo cobrado y rendirla a Administración"
        : rol === "tesoreria"
          ? "Revisar el arqueo de cada caja y darle el OK final"
          : rol === "lider"
            ? "Las cajas del día de todos: podés hacer cada paso y queda firmado a tu nombre"
            : "Lo cobrado en el día, la rendición de Portería y el cierre con arqueo",
  },
  cheques: {
    id: "cheques",
    ruta: "/cheques",
    roles: ["tesoreria", "lider"],
    icono: Banknote,
    titulo: () => "Cheques",
    resumen: () => "Los cheques recibidos, de la cartera al banco",
  },
  tesoreria: {
    id: "tesoreria",
    ruta: "/tesoreria",
    roles: ["tesoreria", "lider"],
    icono: Landmark,
    titulo: () => "Tesorería",
    resumen: () => "La plata real de la cooperativa: banco, transferencias y movimientos",
  },
  gastos: {
    id: "gastos",
    ruta: "/gastos",
    roles: ["admin", "tesoreria", "lider"],
    icono: Receipt,
    titulo: () => "Gastos",
    resumen: (rol) =>
      rol === "admin"
        ? "Cargar lo que se paga, pagarlo con la caja y guardar la factura"
        : rol === "tesoreria"
          ? "Pagar los gastos grandes y revisar las facturas"
          : "Cargar lo que hay que pagar y marcar lo que se pagó",
  },
  clientes: {
    id: "clientes",
    ruta: "/clientes",
    roles: ["admin", "guardia", "lider"],
    icono: Store,
    titulo: (rol) => nombreNav("/clientes", rol, "Clientes"),
    resumen: (rol) =>
      rol === "lider"
        ? "La carpeta de cada cliente: datos, qué paga, documentos y cuenta"
        : rol === "guardia"
          ? "La carpeta de cada quintero y ambulante, y cómo pedir un cambio"
          : "La carpeta de cada cliente y cómo pedir un cambio",
  },
  aprobaciones: {
    id: "aprobaciones",
    ruta: "/aprobaciones",
    roles: ["lider"],
    icono: ClipboardCheck,
    titulo: () => "Aprobaciones",
    resumen: () => "Los cambios que proponen Administración y el Jefe de Portería esperan tu OK",
  },
  porteria: {
    id: "porteria",
    ruta: "/porteria",
    roles: ["porteria", "lider"],
    icono: DoorOpen,
    titulo: () => "Portería",
    resumen: () => "Cobrar el canon de transporte y registrar el ingreso del personal",
  },
  personal: {
    id: "personal",
    ruta: "/personal",
    roles: ["lider"],
    icono: Users,
    titulo: () => "Personal",
    resumen: () => "Los empleados, sus contratos y sus horarios",
  },
  comunicaciones: {
    id: "comunicaciones",
    ruta: "/comunicaciones",
    roles: ["admin", "lider"],
    icono: Megaphone,
    titulo: () => "Comunicaciones",
    resumen: () => "Circulares para todos y avisos por escrito para un cliente",
  },
  novedades: {
    id: "novedades",
    ruta: "/novedades",
    roles: ["admin", "guardia", "lider"],
    icono: ClipboardList,
    titulo: () => "Novedades",
    resumen: (rol) =>
      rol === "guardia"
        ? "Faltas, llegadas tarde, vacaciones y horas extra del personal de Portería"
        : "Faltas, llegadas tarde, vacaciones y horas extra del personal, y la planilla del mes",
  },
  solicitudes: {
    id: "solicitudes",
    ruta: "/solicitudes",
    roles: ["admin", "guardia", "porteria", "tesoreria", "lider"],
    icono: MessagesSquare,
    titulo: () => "Solicitudes",
    resumen: (rol) =>
      rol === "lider"
        ? "Pedidos y reclamos: revisarlos, llevarlos al Consejo y asignarlos"
        : rol === "porteria"
          ? "Anotar un pedido o un aviso para el Jefe de Portería e imprimirlo"
          : "Pedidos, reclamos y consultas: contestar y seguir cada uno",
  },
  facturacion: {
    id: "facturacion",
    ruta: "/facturacion",
    roles: ["admin", "lider"],
    icono: CalendarRange,
    titulo: () => "Facturación",
    resumen: () => "Generar lo que cada cliente paga en el mes",
  },
  energia: {
    id: "energia",
    ruta: "/energia",
    roles: ["admin", "lider"],
    icono: Zap,
    titulo: () => "Energía",
    resumen: () => "La planilla del electricista y la carga de las lecturas de luz",
  },
  reportes: {
    id: "reportes",
    ruta: "/reportes",
    roles: ["lider"],
    icono: FileBarChart2,
    titulo: () => "Reportes",
    resumen: () => "Cuánto entró, cuánto falta y cuánto se gastó, mes a mes",
  },
  configuracion: {
    id: "configuracion",
    ruta: "/configuracion",
    roles: ["admin", "guardia", "lider"],
    icono: Settings,
    titulo: (rol) => nombreNav("/configuracion", rol, "Configuración"),
    resumen: (rol) =>
      rol === "guardia"
        ? "Los usuarios de Portería y el precio de la quinta"
        : rol === "admin"
          ? "Los precios, el vencimiento y el acceso de los clientes al portal"
          : "Usuarios, precios, beneficios y ajustes del sistema",
  },
  "socio-cuenta": {
    id: "socio-cuenta",
    ruta: "/mi-cuenta",
    roles: ["socio"],
    icono: Wallet,
    titulo: () => "Mi cuenta",
    resumen: () => "Cuánto debés, qué pagaste y cuánto te ahorrás pagando a tiempo",
  },
  "socio-comunicaciones": {
    id: "socio-comunicaciones",
    ruta: "/mi-cuenta/comunicaciones",
    cubre: ["/mi-cuenta/circulares"],
    roles: ["socio"],
    icono: Bell,
    titulo: () => "Comunicaciones",
    resumen: () => "Las circulares de la cooperativa y los avisos de tu carpeta",
  },
  "socio-solicitudes": {
    id: "socio-solicitudes",
    // /mi-cuenta/solicitudes lleva a «Mi cuenta»: ahí está la lista de sus pedidos.
    ruta: "/mi-cuenta",
    cubre: ["/mi-cuenta/solicitudes"],
    roles: ["socio"],
    icono: MessagesSquare,
    titulo: () => "Solicitudes",
    resumen: () => "Hacer un pedido o un reclamo y ver la respuesta",
  },
};

/**
 * El recorrido completo de cada rol: sus capítulos en el orden de su trabajo
 * (primero lo de todos los días, después lo del mes y lo de gestión).
 */
export const RECORRIDOS: Record<Rol, IdCapitulo[]> = {
  porteria: ["bienvenida", "porteria", "solicitudes"],
  guardia: [
    "bienvenida",
    "inicio",
    "cobrar",
    "caja",
    "clientes",
    "novedades",
    "mapa",
    "solicitudes",
    "configuracion",
  ],
  admin: [
    "bienvenida",
    "inicio",
    "cobrar",
    "caja",
    "mapa",
    "clientes",
    "solicitudes",
    "comunicaciones",
    "novedades",
    "facturacion",
    "energia",
    "gastos",
    "configuracion",
  ],
  tesoreria: ["bienvenida", "inicio", "caja", "tesoreria", "cheques", "gastos", "solicitudes"],
  lider: [
    "bienvenida",
    "inicio",
    "aprobaciones",
    "clientes",
    "solicitudes",
    "comunicaciones",
    "novedades",
    "facturacion",
    "energia",
    "reportes",
    "personal",
    "porteria",
    "cobrar",
    "caja",
    "mapa",
    "cheques",
    "gastos",
    "tesoreria",
    "configuracion",
  ],
  consejo: [],
  socio: ["bienvenida-socio", "socio-cuenta", "socio-comunicaciones", "socio-solicitudes"],
};

export function recorridoDe(rol: Rol): MetaCapitulo[] {
  return (RECORRIDOS[rol] ?? []).map((id) => CAPITULOS_META[id]);
}

function coincide(pathname: string, ruta: string): boolean {
  return pathname === ruta || pathname.startsWith(`${ruta}/`);
}

/** Capítulo de la pantalla actual para ese rol (el prefijo más largo gana). */
export function capituloDeRuta(rol: Rol, pathname: string): MetaCapitulo | null {
  let mejor: MetaCapitulo | null = null;
  let largo = -1;
  for (const meta of recorridoDe(rol)) {
    for (const ruta of [meta.ruta, ...(meta.cubre ?? [])]) {
      if (ruta && coincide(pathname, ruta) && ruta.length > largo) {
        mejor = meta;
        largo = ruta.length;
      }
    }
  }
  return mejor;
}

/** El capítulo que sigue en el recorrido del rol (para ofrecer "Seguir con…"). */
export function capituloSiguiente(rol: Rol, id: IdCapitulo): MetaCapitulo | null {
  const lista = RECORRIDOS[rol] ?? [];
  const i = lista.indexOf(id);
  if (i < 0 || i + 1 >= lista.length) return null;
  return CAPITULOS_META[lista[i + 1]];
}

/** "Jefe de Portería", "Socio"… */
export function nombreRol(rol: Rol): string {
  return LABEL_ROL[rol];
}
