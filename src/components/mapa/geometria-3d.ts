import type { Rect } from "./tipos";

/* Plano en relieve: proyección oblicua (x, y, z) → (x − K·z, y − z). Nada rota:
 * la huella queda donde está y los textos son horizontales. Se ven la tapa, la
 * cara sur (frente) y la cara este. La luz viene del noroeste. */

export const K = 0.25;
const RAD = Math.PI / 180;
/** Tangente del contorno en la esquina SO (165,96°) y en la NE (−14,04°). */
export const A_SO = 180 - Math.atan(K) / RAD;
export const A_NE = -Math.atan(K) / RAD;
/** skewX de las rayas: siguen las aristas "verticales" de la cara sur (14,04°). */
export const SESGO_RAYAS = Math.atan(K) / RAD;

export type Pt = [number, number];

export const P = (x: number, y: number, z: number): Pt => [x - K * z, y - z];
/** Redondeo a centésimas: paths más cortos. */
export const f = (n: number) => Math.round(n * 100) / 100;
export const pt = (p: Pt) => `${f(p[0])} ${f(p[1])}`;
export const poly = (ps: Pt[]) => "M" + ps.map(pt).join("L") + "Z";
/** Punto del borde de una esquina redondeada (centro c, radio r, ángulo a) a la altura z. */
export const esq = (c: Pt, r: number, a: number, z: number) =>
  P(c[0] + r * Math.cos(a * RAD), c[1] + r * Math.sin(a * RAD), z);
export const arco = (r: number, p: Pt, s: 0 | 1) => `A${f(r)} ${f(r)} 0 0 ${s} ${pt(p)}`;

/** Festones que cuelgan del borde inferior del faldón (recorren de este a oeste). */
export function festones(x0: number, x1: number, yb: number, z: number, paso: number, caida: number) {
  const n = Math.max(1, Math.round((x1 - x0) / paso));
  const c = (x1 - x0) / n;
  let d = "";
  for (let i = 1; i <= n; i++) d += `A${f(c / 2)} ${f(caida)} 0 0 1 ${pt(P(x1 - i * c, yb, z))}`;
  return d;
}

/** Cara SUR de un prisma de huella redondeada (radio r) entre zB (abajo) y zA
 * (arriba). Con `fest`, el borde inferior es festoneado (faldón). */
export function caraSur(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  zA: number,
  zB: number,
  fest?: { paso: number; caida: number }
) {
  const so: Pt = [x + r, y + h - r];
  const se: Pt = [x + w - r, y + h - r];
  let d = `M${pt(esq(so, r, A_SO, zA))}${arco(r, esq(so, r, 90, zA), 0)}`;
  d += `L${pt(esq(se, r, 90, zA))}${arco(r, esq(se, r, 45, zA), 0)}`;
  d += `L${pt(esq(se, r, 45, zB))}${arco(r, esq(se, r, 90, zB), 1)}`;
  d += fest ? festones(x + r, x + w - r, y + h, zB, fest.paso, fest.caida) : `L${pt(esq(so, r, 90, zB))}`;
  return d + `${arco(r, esq(so, r, A_SO, zB), 1)}Z`;
}

/** Cara ESTE (de 45° en la esquina SE hasta la tangente en la NE). */
export function caraEste(x: number, y: number, w: number, h: number, r: number, zA: number, zB: number) {
  const se: Pt = [x + w - r, y + h - r];
  const ne: Pt = [x + w - r, y + r];
  return (
    `M${pt(esq(se, r, 45, zA))}${arco(r, esq(se, r, 0, zA), 0)}` +
    `L${pt(esq(ne, r, 0, zA))}${arco(r, esq(ne, r, A_NE, zA), 0)}` +
    `L${pt(esq(ne, r, A_NE, zB))}${arco(r, esq(ne, r, 0, zB), 1)}` +
    `L${pt(esq(se, r, 0, zB))}${arco(r, esq(se, r, 45, zB), 1)}Z`
  );
}

/** Silueta de un cilindro elíptico (tambor) entre z0 y z1. */
export function barridoElipse(cx: number, cy: number, rx: number, ry: number, z0: number, z1: number) {
  const t1 = Math.atan2(-K * ry, rx);
  const t2 = t1 + Math.PI;
  const p = (t: number, z: number) => P(cx + rx * Math.cos(t), cy + ry * Math.sin(t), z);
  return `M${pt(p(t1, z1))}A${rx} ${ry} 0 0 0 ${pt(p(t2, z1))}L${pt(p(t2, z0))}A${rx} ${ry} 0 0 0 ${pt(p(t1, z0))}Z`;
}

/** Canto iluminado: borde oeste + borde norte de una tapa en (tx, ty). */
export const canto = (tx: number, ty: number, w: number, h: number, r: number) =>
  `M${f(tx + 0.9)} ${f(ty + h - r)}V${f(ty + r)}Q${f(tx + 0.9)} ${f(ty + 0.9)} ${f(tx + r)} ${f(ty + 0.9)}H${f(tx + w - r)}`;

/** Rect redondeado como subpath (para juntar sombras en un solo <path>). */
export function rrPath(x: number, y: number, w: number, h: number, radio: number) {
  const r = Math.min(radio, w / 2, h / 2);
  const a = `A${f(r)} ${f(r)} 0 0 1`;
  return (
    `M${f(x + r)} ${f(y)}H${f(x + w - r)}${a} ${f(x + w)} ${f(y + r)}` +
    `V${f(y + h - r)}${a} ${f(x + w - r)} ${f(y + h)}` +
    `H${f(x + r)}${a} ${f(x)} ${f(y + h - r)}` +
    `V${f(y + r)}${a} ${f(x + r)} ${f(y)}Z`
  );
}

/** Elipse como subpath. */
export const elPath = (cx: number, cy: number, rx: number, ry: number) =>
  `M${f(cx - rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 0 ${f(cx + rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 0 ${f(cx - rx)} ${f(cy)}Z`;

/** Círculo como subpath relativo (copas de los árboles). */
export const circulo = (cx: number, cy: number, r: number) =>
  `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;

/** Envolvente proyectada de un bloque o espacio con la tapa a zTop (cámara,
 * zona táctil, pastilla), con margen m. */
export const envolvente = (r: Rect, zTop: number, m = 0): Rect => ({
  x: r.x - K * zTop - m,
  y: r.y - zTop - m,
  w: r.w + K * zTop + 2 * m,
  h: r.h + zTop + 2 * m,
});

/** Ruido determinístico en [0, 1) (siembra de árboles). Aritmética entera:
 * da exactamente lo mismo en el servidor y en el navegador (con `Math.sin`
 * de argumentos grandes no, y la hidratación no coincidía). */
export function hash(a: number, b: number) {
  let h = (Math.imul(Math.round(a * 100), 374761393) + Math.imul(Math.round(b * 100), 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
