import type { ElementoPlano, Espacio, Rect } from "./tipos";

/** Cómo se muestra el plano: "horizontal" es el croquis tal cual (compu, tablet o
 * celular acostados); "vertical", girado 90° para una pantalla parada. */
export type Orientacion = "horizontal" | "vertical";

/** Giro horario de 90° de un rectángulo: (x, y, w, h) → (C − (y + h), x, h, w). */
function girar<T extends Rect>(r: T, c: number): T {
  return { ...r, x: c - (r.y + r.h), y: r.x, w: r.h, h: r.w };
}

/**
 * El plano girado 90° en sentido horario, a nivel de DATOS (el dibujo en relieve
 * no se rota: la cámara sigue mirando desde el sur, así que los volúmenes, las
 * sombras y los textos siguen derechos). El borde oeste del croquis (58, 57, el
 * Bar) queda arriba, la fila norte (pares y las 36 cocheras) a la derecha, la fila
 * sur (impares) a la izquierda y lo del este (administración, locales, contéiners,
 * invernaderos) abajo. C = y mínima + y máxima: las x nuevas ocupan el mismo rango
 * que ocupaban las y (todo sigue en coordenadas positivas). Función pura: los ids y
 * los demás datos no cambian.
 */
export function rotarPlano(
  espacios: Espacio[],
  elementos: ElementoPlano[]
): { espacios: Espacio[]; elementos: ElementoPlano[] } {
  const todo: Rect[] = [...espacios, ...elementos];
  if (todo.length === 0) return { espacios, elementos };
  const c = Math.min(...todo.map((r) => r.y)) + Math.max(...todo.map((r) => r.y + r.h));
  return {
    espacios: espacios.map((e) => girar(e, c)),
    elementos: elementos.map((e) => girar(e, c)),
  };
}
