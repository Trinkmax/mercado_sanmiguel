import type { Rol } from "@/lib/auth";
import type { DatasetExportable } from "@/components/shared/boton-exportar";

export type { DatasetExportable };

/** Qué es cada dataset exportable, quién puede bajarlo y si se filtra por mes.
 * Es la ÚNICA fuente de autorización del route handler `/api/exportar` y de los
 * menús que lo linkean. Los catálogos (clientes, empleados, circulares) ignoran
 * el período; el resto exporta lo del mes elegido. */
export type DefinicionDataset = {
  label: string;
  descripcion: string;
  roles: Rol[];
  mensual: boolean;
  /** Para agrupar el menú de exportación. */
  grupo: "cobranza" | "plata" | "gestion" | "personal";
};

const GESTION: Rol[] = ["admin", "tesoreria", "consejo", "lider"];
const DIRECCION: Rol[] = ["tesoreria", "consejo", "lider"];
const PERSONAL: Rol[] = ["lider", "admin"];
/** Portería y el Jefe exportan sus propios ingresos del mes. */
const PORTERIA: Rol[] = ["lider", "admin", "porteria", "guardia"];

export const DATASETS: Record<DatasetExportable, DefinicionDataset> = {
  balance_mensual: {
    label: "Balance del mes",
    descripcion: "Ingresos por concepto, gastos por rubro y resumen",
    roles: DIRECCION,
    mensual: true,
    grupo: "plata",
  },
  clientes: {
    label: "Clientes",
    descripcion: "Padrón con deuda de hoy y saldo a favor",
    roles: GESTION,
    mensual: false,
    grupo: "cobranza",
  },
  cuenta_corriente: {
    label: "Cuenta corriente",
    descripcion: "Cargos del mes por cliente y concepto",
    roles: GESTION,
    mensual: true,
    grupo: "cobranza",
  },
  pagos: {
    label: "Pagos",
    descripcion: "Recibos del mes, con medio y quién cobró",
    roles: GESTION,
    mensual: true,
    grupo: "cobranza",
  },
  cheques: {
    label: "Cheques",
    descripcion: "Cheques recibidos en el mes y su estado",
    roles: GESTION,
    mensual: true,
    grupo: "plata",
  },
  gastos: {
    label: "Gastos",
    descripcion: "Gastos del mes por rubro, pagados y pendientes",
    roles: GESTION,
    mensual: true,
    grupo: "plata",
  },
  cajas: {
    label: "Cajas",
    descripcion: "Arqueos diarios de Administración y Portería",
    roles: GESTION,
    mensual: true,
    grupo: "plata",
  },
  canon: {
    label: "Canon diario",
    descripcion: "Camiones, ambulantes y quinteros cobrados en portería",
    roles: GESTION,
    mensual: true,
    grupo: "cobranza",
  },
  lecturas: {
    label: "Lecturas de energía",
    descripcion: "Medidores, kWh y monto del mes",
    roles: GESTION,
    mensual: true,
    grupo: "cobranza",
  },
  movimientos_tesoreria: {
    label: "Movimientos de tesorería",
    descripcion: "Impuestos, comisiones, débito fiscal y ajustes",
    roles: DIRECCION,
    mensual: true,
    grupo: "plata",
  },
  solicitudes: {
    label: "Solicitudes",
    descripcion: "Solicitudes, informes, reclamos y consultas del mes",
    roles: GESTION,
    mensual: true,
    grupo: "gestion",
  },
  circulares: {
    label: "Circulares",
    descripcion: "Todas las circulares con cuántos socios las recibieron",
    roles: GESTION,
    mensual: false,
    grupo: "gestion",
  },
  empleados: {
    label: "Empleados",
    descripcion: "Personal con contrato y horarios",
    roles: PERSONAL,
    mensual: false,
    grupo: "personal",
  },
  ingresos_personal: {
    label: "Ingresos de personal",
    descripcion: "Entradas y salidas registradas en portería en el mes",
    roles: PORTERIA,
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
  "empleados",
  "ingresos_personal",
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
