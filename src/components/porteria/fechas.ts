import { fechaLocal, formatFechaHora, formatSoloHora } from "@/lib/format";

const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Argentina no tiene horario de verano: el día "YYYY-MM-DD" va de las 00:00
 * a las 24:00 en UTC−3. Devuelve [inicio, fin) como ISO para filtrar timestamptz. */
export function rangoDiaAR(fecha: string): { inicio: string; fin: string } {
  const d = fechaLocal(fecha);
  d.setDate(d.getDate() + 1);
  const siguiente = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { inicio: `${fecha}T00:00:00-03:00`, fin: `${siguiente}T00:00:00-03:00` };
}

export function esFechaISO(valor: string | undefined): valor is string {
  return typeof valor === "string" && REGEX_FECHA.test(valor) && !Number.isNaN(fechaLocal(valor).getTime());
}

/** Hora argentina en 24 h ("04:05", "15:26"). Alias del helper compartido. */
export function horaAR(iso: string | null | undefined): string {
  return formatSoloHora(iso);
}

/** "19/08 15:26" — fecha y hora argentinas en 24 h. Alias del helper compartido. */
export function fechaHoraAR(iso: string | null | undefined): string {
  return formatFechaHora(iso);
}
