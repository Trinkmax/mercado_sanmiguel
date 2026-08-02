/** Armado server-side de la serie "cobranza por día".
 * Los pagos tienen fecha timestamptz: el día de negocio es SIEMPRE el día
 * argentino (igual que private.hoy_ar en SQL); el canon de camiones ya viene
 * con fecha date. Los días sin cobros quedan en 0. */

import { TZ_AR, fechaLocal, hoyISO, periodoActual, sumarMeses } from "@/lib/format";

export type PuntoCobranza = { fecha: string; monto: number };

const fmtDiaAR = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ_AR,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Día argentino "YYYY-MM-DD" de un timestamptz. */
export function diaArgentino(ts: string): string {
  return fmtDiaAR.format(new Date(ts));
}

function isoDe(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Rango de la serie de un período: del 1 al último día del mes,
 * o hasta hoy si es el mes en curso. */
export function rangoDelPeriodo(periodo: string): { desde: string; hasta: string } {
  const fin = fechaLocal(sumarMeses(periodo, 1));
  fin.setDate(0); // último día del mes del período
  const hasta = periodo === periodoActual() ? hoyISO() : isoDe(fin);
  return { desde: periodo, hasta };
}

/** Últimos N días argentinos, incluyendo hoy. */
export function rangoUltimosDias(dias: number): { desde: string; hasta: string } {
  const hoy = hoyISO();
  const d = fechaLocal(hoy);
  d.setDate(d.getDate() - (dias - 1));
  return { desde: isoDe(d), hasta: hoy };
}

/** Suma pagos (timestamptz) + canon (date) por día argentino, con días en 0. */
export function armarSerieDiaria(
  desde: string,
  hasta: string,
  pagos: { fecha: string; monto: number }[],
  canon: { fecha: string; monto: number }[]
): PuntoCobranza[] {
  const porDia = new Map<string, number>();
  const cursor = fechaLocal(desde);
  for (let iso = isoDe(cursor); iso <= hasta; ) {
    porDia.set(iso, 0);
    cursor.setDate(cursor.getDate() + 1);
    iso = isoDe(cursor);
  }
  for (const p of pagos) {
    const dia = diaArgentino(p.fecha);
    const previo = porDia.get(dia);
    if (previo !== undefined) porDia.set(dia, previo + Number(p.monto));
  }
  for (const c of canon) {
    const dia = c.fecha.slice(0, 10);
    const previo = porDia.get(dia);
    if (previo !== undefined) porDia.set(dia, previo + Number(c.monto));
  }
  return [...porDia.entries()].map(([fecha, monto]) => ({ fecha, monto }));
}
