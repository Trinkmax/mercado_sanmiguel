import type { Rol } from "@/lib/auth";
import type { DatasetExportable as DatasetBoton } from "@/components/shared/boton-exportar";

/** Datasets exportables. Suma los nuevos de fase 3 (registros y novedades del personal)
 * aunque el tipo del botón compartido todavía no los tenga (pedido a Fundación §5.6). */
export type DatasetExportable = DatasetBoton;

/** Qué es cada dataset exportable, quién puede bajarlo y si se filtra por mes.
 * Es la ÚNICA fuente de autorización del route handler `/api/exportar` y de los
 * menús que lo linkean (FASE3 §6 M9-8). Los catálogos (clientes, empleados,
 * circulares) ignoran el período; el resto exporta lo del mes elegido. Las consultas
 * pasan además por la RLS (el Jefe solo ve a sus quinteros y ambulantes). */
export type DefinicionDataset = {
  label: string;
  descripcion: string;
  roles: Rol[];
  mensual: boolean;
  /** Para agrupar el menú de exportación. */
  grupo: "cobranza" | "plata" | "gestion" | "personal";
};

/** Cada rol ve SUS clientes: Administración puesteros, el Jefe quinteros y ambulantes. */
const CLIENTES: Rol[] = ["admin", "guardia", "lider"];

export const DATASETS: Record<DatasetExportable, DefinicionDataset> = {
  balance_mensual: {
    label: "Balance del mes",
    descripcion: "Ingresos por concepto, gastos por rubro y resumen",
    roles: ["lider"],
    mensual: true,
    grupo: "plata",
  },
  clientes: {
    label: "Clientes",
    descripcion: "Padrón con categoría, socio, qué tiene y deuda de hoy",
    roles: CLIENTES,
    mensual: false,
    grupo: "cobranza",
  },
  cuenta_corriente: {
    label: "Cuenta corriente",
    descripcion: "Cargos del mes por cliente y concepto",
    roles: CLIENTES,
    mensual: true,
    grupo: "cobranza",
  },
  pagos: {
    label: "Pagos",
    descripcion: "Recibos del mes con sus medios (pago mixto) y quién cobró",
    roles: ["admin", "guardia", "lider", "tesoreria"],
    mensual: true,
    grupo: "cobranza",
  },
  cheques: {
    label: "Cheques",
    descripcion: "Cheques recibidos en el mes: CUIT, puesto, estado y proveedor",
    roles: ["tesoreria", "lider"],
    mensual: true,
    grupo: "plata",
  },
  gastos: {
    label: "Gastos",
    descripcion: "Gastos del mes por rubro, de qué caja salieron",
    roles: ["admin", "tesoreria", "lider"],
    mensual: true,
    grupo: "plata",
  },
  cajas: {
    label: "Cajas",
    descripcion: "Arqueos diarios: cobros, quintas, ambulantes, bono camioneros y ajustes",
    roles: ["admin", "tesoreria", "lider"],
    mensual: true,
    grupo: "plata",
  },
  canon: {
    label: "Bono camioneros",
    descripcion: "Canon de transporte cobrado en portería, vehículo por vehículo",
    roles: ["admin", "tesoreria", "lider"],
    mensual: true,
    grupo: "cobranza",
  },
  lecturas: {
    label: "Lecturas de energía",
    descripcion: "Medidores, ubicación, kWh y monto del mes",
    roles: ["admin", "lider"],
    mensual: true,
    grupo: "cobranza",
  },
  movimientos_tesoreria: {
    label: "Movimientos de tesorería",
    descripcion: "Depósitos, extracciones, comisiones y ajustes por moneda y cuenta",
    roles: ["tesoreria", "lider"],
    mensual: true,
    grupo: "plata",
  },
  solicitudes: {
    label: "Solicitudes",
    descripcion: "Solicitudes, informes y reclamos del mes, con puesto y quién resolvió",
    roles: ["admin", "lider"],
    mensual: true,
    grupo: "gestion",
  },
  circulares: {
    label: "Circulares",
    descripcion: "Todas las circulares con cuántos socios las vieron",
    roles: ["admin", "lider"],
    mensual: false,
    grupo: "gestion",
  },
  registros: {
    label: "Registros",
    descripcion: "Notificaciones, apercibimientos y sanciones del mes, con sus multas",
    roles: ["admin", "lider"],
    mensual: true,
    grupo: "gestion",
  },
  empleados: {
    label: "Empleados",
    descripcion: "Personal con sector, horas de contrato y horarios",
    roles: ["lider", "admin"],
    mensual: false,
    grupo: "personal",
  },
  ingresos_personal: {
    label: "Ingresos de personal",
    descripcion: "Entradas y salidas registradas en portería en el mes",
    roles: ["lider", "admin", "porteria"],
    mensual: true,
    grupo: "personal",
  },
  novedades_personal: {
    label: "Novedades del personal",
    descripcion: "Horas del mes, faltas, feriados y vacaciones por empleado",
    roles: ["lider", "admin", "guardia"],
    mensual: true,
    grupo: "personal",
  },
};

/** Orden de presentación en los menús. */
export const ORDEN_DATASETS: DatasetExportable[] = [
  "clientes",
  "cuenta_corriente",
  "pagos",
  "canon",
  "lecturas",
  "cheques",
  "gastos",
  "cajas",
  "movimientos_tesoreria",
  "solicitudes",
  "circulares",
  "registros",
  "empleados",
  "ingresos_personal",
  "novedades_personal",
];

export const LABEL_GRUPO_DATASET: Record<DefinicionDataset["grupo"], string> = {
  cobranza: "Cobranza",
  plata: "Plata",
  gestion: "Gestión",
  personal: "Personal",
};

export function esDataset(valor: string): valor is DatasetExportable {
  return Object.prototype.hasOwnProperty.call(DATASETS, valor);
}

export function puedeExportar(rol: Rol, dataset: DatasetExportable): boolean {
  return DATASETS[dataset].roles.includes(rol);
}

/** Datasets (sin el balance, que tiene su propio botón) que el rol puede bajar. */
export function datasetsParaRol(rol: Rol): DatasetExportable[] {
  return ORDEN_DATASETS.filter((d) => puedeExportar(rol, d));
}
