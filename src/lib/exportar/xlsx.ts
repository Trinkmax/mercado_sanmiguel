import "server-only";
import ExcelJS from "exceljs";
import { TZ_AR } from "@/lib/format";

/**
 * Armado de planillas .xlsx con exceljs, con un solo estilo para todo el sistema:
 * encabezados en negrita sobre azul claro, montos con formato de moneda,
 * fechas como fecha real (filtrables y sumables en Excel), primera fila fija.
 */

export type TipoColumna =
  | "texto"
  | "entero"
  | "numero"
  | "moneda"
  | "fecha"
  | "fechaHora"
  | "booleano";

export type Columna = { titulo: string; tipo?: TipoColumna; ancho?: number };

export type Celda = string | number | boolean | Date | null | undefined;

export type Hoja = {
  nombre: string;
  columnas: Columna[];
  filas: Celda[][];
  /** Filas de totales al pie (en negrita, con línea arriba). */
  totales?: Celda[][];
  /** Líneas de aclaración debajo de la tabla. */
  notas?: string[];
};

const AZUL_ENCABEZADO = "FFDCE5F7";
const FMT: Record<TipoColumna, string | null> = {
  texto: null,
  entero: "#,##0",
  numero: "#,##0.##",
  moneda: '"$ "#,##0.00',
  fecha: "dd/mm/yyyy",
  fechaHora: "dd/mm/yyyy hh:mm",
  booleano: null,
};
const ANCHO: Record<TipoColumna, number> = {
  texto: 24,
  entero: 10,
  numero: 12,
  moneda: 16,
  fecha: 12,
  fechaHora: 17,
  booleano: 10,
};

/** "YYYY-MM-DD" → fecha Excel (medianoche UTC: exceljs serializa en UTC). */
export function fechaExcel(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

const partesAR = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ_AR,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** timestamptz → fecha/hora Excel con la hora ARGENTINA (Excel no tiene huso:
 * se arma un Date cuyas partes UTC son las de la hora local de Córdoba). */
export function fechaHoraExcel(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p: Record<string, number> = {};
  for (const parte of partesAR.formatToParts(d)) {
    if (parte.type !== "literal") p[parte.type] = Number(parte.value);
  }
  return new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second));
}

export function siNo(valor: boolean | null | undefined): string {
  return valor ? "Sí" : "No";
}

/** Nombre de hoja válido para Excel (máx. 31 caracteres, sin []:*?/\). */
function nombreHoja(nombre: string): string {
  return nombre.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Hoja";
}

function agregarHoja(wb: ExcelJS.Workbook, hoja: Hoja) {
  const ws = wb.addWorksheet(nombreHoja(hoja.nombre), {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  ws.columns = hoja.columnas.map((c) => ({
    header: c.titulo,
    width: c.ancho ?? ANCHO[c.tipo ?? "texto"],
  }));

  const cab = ws.getRow(1);
  cab.font = { bold: true, color: { argb: "FF1F2A44" } };
  cab.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL_ENCABEZADO } };
  cab.alignment = { vertical: "middle", wrapText: true };
  cab.height = 22;
  cab.border = { bottom: { style: "thin", color: { argb: "FF8FA3CF" } } };

  const aplicarFormato = (fila: ExcelJS.Row) => {
    hoja.columnas.forEach((c, i) => {
      const tipo = c.tipo ?? "texto";
      const celda = fila.getCell(i + 1);
      const fmt = FMT[tipo];
      if (fmt) celda.numFmt = fmt;
      if (tipo === "moneda" || tipo === "numero" || tipo === "entero") {
        celda.alignment = { horizontal: "right" };
      }
    });
  };

  for (const datos of hoja.filas) {
    const fila = ws.addRow(datos.map((v) => (v === undefined ? null : v)));
    aplicarFormato(fila);
  }

  if (hoja.totales?.length) {
    for (const [idx, datos] of hoja.totales.entries()) {
      const fila = ws.addRow(datos.map((v) => (v === undefined ? null : v)));
      aplicarFormato(fila);
      fila.font = { bold: true };
      if (idx === 0) {
        fila.border = { top: { style: "medium", color: { argb: "FF1F2A44" } } };
      }
    }
  }

  if (hoja.filas.length > 0) {
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1 + hoja.filas.length, column: hoja.columnas.length },
    };
  }

  if (hoja.notas?.length) {
    ws.addRow([]);
    for (const nota of hoja.notas) {
      const fila = ws.addRow([nota]);
      fila.font = { italic: true, color: { argb: "FF5B6475" } };
    }
  }
}

/** Genera el .xlsx completo y lo devuelve como bytes listos para la Response. */
export async function generarXlsx(hojas: Hoja[]): Promise<Uint8Array<ArrayBuffer>> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Mercado San Miguel";
  wb.created = new Date();
  for (const hoja of hojas) agregarHoja(wb, hoja);
  const buffer = await wb.xlsx.writeBuffer();
  // En Node llega un Buffer (vista sobre un pool compartido): se copia a un
  // ArrayBuffer propio para entregarlo limpio como cuerpo de la Response.
  const vista = new Uint8Array(buffer as ArrayBuffer);
  const salida = new Uint8Array(new ArrayBuffer(vista.byteLength));
  salida.set(vista);
  return salida;
}
