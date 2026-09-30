// Genera `plano_mercado.sql`: el plano real del Mercado San Miguel (dibujo
// del predio, septiembre 2026) en unidades del plano.
//
//   node supabase/plano/generar.mjs > supabase/plano/plano_mercado.sql
//
// Convenciones del dibujo original:
//   · "52 - 50 - 48 - 46" = un puestero con varios puestos (grupo).
//   · "34 /2"             = medio puesto.
//   · Los círculos son contéiners (el valor interno sigue siendo "contenedor").
//   · { n, propio: true } = puesto propio de la cooperativa (C3; paga EXPP). Todavía no
//     se sabe cuáles son los 4 (FASE3 §9-P12): se marcan desde el mapa.
// Se respeta el dibujo tal cual, incluso lo que hay que revisar con el
// mercado: "63 - 63" (repetido), "5 /2" en la isla y "7 - 5" en la fila sur
// (el 5 aparece dos veces), un puesto con "?" y la falta del 17.
//
// Relevamiento del 29/09/2026 (dibujos de Ignacio, migración 0032):
//   · Galpón: el recinto de 9 contéiners es un galpón con 10 subgalpones. Cada uno lleva
//     el número del PUESTO de quien lo tiene ("el puesto 9 tiene 2 galpones ahí"), por
//     eso el 9 se repite. El de arriba se leyó "68".
//   · Locales 86 · 87 · 94 · 80 · 75 (de norte a sur), el invernadero 82 al lado y el
//     contéiner 3 suelto debajo. Siguen los dos invernaderos y el recinto de 3 contéiners.
//   · Los 10 contéiners bajo las 18 cocheras van en una sola hilera, del 1 al 10
//     empezando por la derecha.
//   · Playa de quintas = las dos zonas de quinteros: dos hileras con una calle en el
//     medio; numeración en U (abajo 1–17 | 18–37 de oeste a este, arriba 38–54 | 55–68
//     de este a oeste).
//   · Cada cochera se asigna a un cliente (paga su canon): 1–74 de corrido.
//
// Importado (`import { plano } from "./generar.mjs"`) devuelve los datos sin imprimir.

const ORG = "a0000000-0000-4000-8000-000000000001";

// ---------- Medidas base ----------
const S = 44; // puesto
const G = 4; // separación entre puestos
const M = (S - G) / 2; // medio puesto: dos medios + separación = un puesto
const A = S * 1.5 + G / 2; // puesto ancho (21 y 19, bar)
const D = 52; // profundidad de una fila de puestos

// ---------- Nave ----------
const NAVE = { x: 40, y: 250 };
const PAD_X = 16;
const PAD_Y = 14;
const PASILLO_ANCHO = 60;
const PASILLO_GAP = 14;
const OESTE_X = NAVE.x + PAD_X; // 56
const OESTE_W = 14 * S + 13 * G; // fila sur oeste: 668
const PASILLO_X = OESTE_X + OESTE_W + PASILLO_GAP; // 738
const ESTE_X = PASILLO_X + PASILLO_ANCHO + PASILLO_GAP; // 812
const ESTE_W = 14 * S + 2 * M + 15 * G; // fila norte este: 716
const NAVE_W = ESTE_X + ESTE_W + PAD_X - NAVE.x; // 1504

const PASILLO_LONG = 42; // pasillos longitudinales entre filas
const FILA_N_Y = NAVE.y + PAD_Y; // 264
const ISLA_Y = FILA_N_Y + D + PASILLO_LONG; // 358
const ISLA_ARRIBA = 52;
const ISLA_ABAJO = 40;
const ISLA_H = ISLA_ARRIBA + G + ISLA_ABAJO; // 96
const ISLA_ABAJO_Y = ISLA_Y + ISLA_ARRIBA + G; // 414
const FILA_S_Y = ISLA_Y + ISLA_H + PASILLO_LONG; // 496
const NAVE_H = FILA_S_Y + D + PAD_Y - NAVE.y; // 312

const espacios = [];
const elementos = [];

/** Fila de puestos de izquierda a derecha. Cada ítem:
 *  número | { n, medio?, propio?, ancho?, antes? (espacio extra previo), grupo?, nota?, tipo? } */
function fila(items, x0, y, h = D) {
  let x = x0;
  for (const it of items) {
    const p = typeof it === "object" && it !== null ? it : { n: it };
    x += p.antes ?? 0;
    const w = p.medio ? M : p.ancho ?? S;
    espacios.push({
      tipo: p.tipo ?? "puesto",
      numero: p.n,
      medio: Boolean(p.medio),
      propio: Boolean(p.propio) && (p.tipo ?? "puesto") === "puesto",
      grupo: p.grupo ?? null,
      nota: p.nota ?? null,
      x,
      y,
      w,
      h,
    });
    x += w + G;
  }
  return x - G;
}

const g = (grupo, ...nums) => nums.map((n) => ({ n: String(n), grupo }));

// ---------- Fila norte (pares) ----------
// Oeste: 58-56 · 54 · 52-50-48-46 · 44-42 · 40 · 38 · 36 · 34/2 · 32/2
fila(
  [
    ...g("g58", 58, 56),
    { n: "54" },
    ...g("g52", 52, 50, 48, 46),
    ...g("g44", 44, 42),
    { n: "40" },
    { n: "38" },
    { n: "36" },
    // En el dibujo los medios puestos van separados, contra el pasillo.
    { n: "34", medio: true, antes: 16 },
    { n: "32", medio: true, antes: 16 },
  ],
  OESTE_X,
  FILA_N_Y
);
// Este: 30 · 28 · 26 · 22-24 · 20-18 · 16 · 14-12 · 10/2 · 8/2 · 4-6 · 2-0
fila(
  [
    { n: "30" },
    { n: "28" },
    { n: "26" },
    ...g("g22", 22, 24),
    ...g("g20", 20, 18),
    { n: "16" },
    ...g("g14", 14, 12),
    { n: "10", medio: true },
    { n: "8", medio: true },
    ...g("g4", 4, 6),
    ...g("g2", 2, 0),
  ],
  ESTE_X,
  FILA_N_Y
);

// ---------- Isla central ----------
// Oeste: Bar · 76 (Quiniela) · ? · 62 · 64 · 68 · 72, con el 66 debajo de 68-72.
const finIslaOeste = fila(
  [
    { n: null, tipo: "bar", ancho: A },
    { n: "76", nota: "Quiniela" },
    { n: null }, // "?" en el dibujo
    { n: "62" },
    { n: "64" },
    { n: "68" },
    { n: "72" },
  ],
  OESTE_X,
  ISLA_Y,
  ISLA_ARRIBA
);
{
  const p68 = espacios.find((e) => e.numero === "68");
  espacios.push({
    tipo: "puesto",
    numero: "66",
    medio: false,
    grupo: null,
    nota: null,
    x: p68.x,
    y: ISLA_ABAJO_Y,
    w: 2 * S + G,
    h: ISLA_ABAJO,
  });
}
const QUINTEROS_GAP = 24;
const quintasOeste = {
  tipo: "quinteros",
  etiqueta: "Playa de quintas",
  x: finIslaOeste + QUINTEROS_GAP,
  y: ISLA_Y,
  w: OESTE_X + OESTE_W - (finIslaOeste + QUINTEROS_GAP),
  h: ISLA_H,
};
elementos.push(quintasOeste);

// Este (alineada a la derecha, contra Administración):
// Quinteros · 71 · 63-63 (69 debajo) · 61 · 59 · 5/2 · Administración
const ADMIN_W = 2 * S + G;
const adminX = ESTE_X + ESTE_W - ADMIN_W;
const islaEste = [
  { n: "71" },
  ...g("g63", 63, 63),
  { n: "61" },
  { n: "59" },
  { n: "5", medio: true },
];
const anchoIslaEste = islaEste.reduce((acc, p) => acc + (p.medio ? M : S) + G, 0);
const inicioIslaEste = adminX - anchoIslaEste;
fila(islaEste, inicioIslaEste, ISLA_Y, ISLA_ARRIBA);
{
  // 69 debajo del segundo 63
  const segundo63 = espacios.filter((e) => e.numero === "63")[1];
  espacios.push({
    tipo: "puesto",
    numero: "69",
    medio: false,
    grupo: null,
    nota: null,
    x: segundo63.x,
    y: ISLA_ABAJO_Y,
    w: S,
    h: ISLA_ABAJO,
  });
}
const quintasEste = {
  tipo: "quinteros",
  etiqueta: "Playa de quintas",
  x: ESTE_X,
  y: ISLA_Y,
  w: inicioIslaEste - QUINTEROS_GAP - ESTE_X,
  h: ISLA_H,
};
elementos.push(quintasEste);
elementos.push({
  tipo: "administracion",
  etiqueta: "Administración",
  x: adminX,
  y: ISLA_Y,
  w: ADMIN_W,
  h: ISLA_H,
});

// ---------- Fila sur (impares) ----------
// Oeste: 57 · 55 · … · 37 · 35-33 · 31
fila(
  [57, 55, 53, 51, 49, 47, 45, 43, 41, 39, 37].map((n) => ({ n: String(n) }))
    .concat(g("g35", 35, 33), [{ n: "31" }]),
  OESTE_X,
  FILA_S_Y
);
// Este: 29 · 27-25 · 23 · 21 · 19 · 15 · 13 · 11 · 9 · 7-5 · 3 · 1
// (21 y 19 son más anchos en el dibujo: ocupan el lugar del 17, que no figura)
fila(
  [
    { n: "29" },
    ...g("g27", 27, 25),
    { n: "23" },
    { n: "21", ancho: A },
    { n: "19", ancho: A },
    { n: "15" },
    { n: "13" },
    { n: "11" },
    { n: "9" },
    ...g("g7", 7, 5),
    { n: "3" },
    { n: "1" },
  ],
  ESTE_X,
  FILA_S_Y
);

// ---------- Nave y pasillo ----------
elementos.unshift({
  tipo: "nave",
  etiqueta: "Nave",
  x: NAVE.x,
  y: NAVE.y,
  w: NAVE_W,
  h: NAVE_H,
});

// ---------- Cocheras ----------
const COCHERA_H = 50;
const cocheraNorteY = NAVE.y - 54 - COCHERA_H; // 146
const cocherasNorte = {
  tipo: "cocheras",
  etiqueta: "36 cocheras",
  capacidad: 36,
  x: NAVE.x,
  y: cocheraNorteY,
  w: NAVE_W,
  h: COCHERA_H,
};
const cocheraSurY = NAVE.y + NAVE_H + 58; // 620
const cocherasSurOeste = {
  tipo: "cocheras",
  etiqueta: "20 cocheras",
  capacidad: 20,
  x: NAVE.x,
  y: cocheraSurY,
  w: PASILLO_X - PASILLO_GAP - NAVE.x,
  h: COCHERA_H - 2,
};
const cocherasSurEste = {
  tipo: "cocheras",
  etiqueta: "18 cocheras",
  capacidad: 18,
  x: ESTE_X,
  y: cocheraSurY,
  w: ESTE_W,
  h: COCHERA_H - 2,
};
elementos.push(cocherasNorte, cocherasSurOeste, cocherasSurEste);

// Cada cochera es un lugar que se asigna (EXPC: se paga por cochera). Van entre las
// líneas de la franja, un poco más profundas que anchas (el auto se estaciona de
// frente), numeradas de corrido: 1–36 arriba, 37–56 abajo al oeste y 57–74 al este.
let nCochera = 0;
for (const franja of [cocherasNorte, cocherasSurOeste, cocherasSurEste]) {
  const paso = franja.w / franja.capacidad;
  for (let i = 0; i < franja.capacidad; i++) {
    espacios.push({
      tipo: "cochera",
      numero: String(++nCochera),
      medio: false,
      propio: false,
      grupo: null,
      nota: null,
      x: franja.x + i * paso + 2,
      y: franja.y + 2,
      w: paso - 4,
      h: franja.h - 4,
    });
  }
}

// Pasillo central: cruza la nave de punta a punta (líneas punteadas del dibujo).
const pasilloFin = cocheraSurY + COCHERA_H - 2 + 50;
elementos.push({
  tipo: "pasillo",
  etiqueta: "Pasillo",
  x: PASILLO_X,
  y: cocheraNorteY + COCHERA_H,
  w: PASILLO_ANCHO,
  h: pasilloFin - (cocheraNorteY + COCHERA_H),
});

// ---------- Playa de quintas ----------
// Las dos zonas de quinteros de la isla: dos hileras por zona con una calle en el
// medio (la otra calle de la cruz es el pasillo central). Numeración en U: abajo de
// oeste a este (1–17 | 18–37), arriba de este a oeste (38–54 | 55–68).
const QUINTA_FONDO = 34;
const QUINTA_BORDE = 4;
function hileraQuintas(zona, arriba, numeros) {
  const paso = (zona.w - 2 * QUINTA_BORDE) / numeros.length;
  const y = arriba ? zona.y + QUINTA_BORDE : zona.y + zona.h - QUINTA_BORDE - QUINTA_FONDO;
  numeros.forEach((n, i) =>
    espacios.push({
      tipo: "quinta",
      numero: String(n),
      medio: false,
      propio: false,
      grupo: null,
      nota: null,
      x: zona.x + QUINTA_BORDE + i * paso + 1,
      y,
      w: paso - 2,
      h: QUINTA_FONDO,
    })
  );
}
const desde = (a, b) => Array.from({ length: Math.abs(b - a) + 1 }, (_, i) => (b >= a ? a + i : a - i));
hileraQuintas(quintasOeste, false, desde(1, 17));
hileraQuintas(quintasEste, false, desde(18, 37));
hileraQuintas(quintasEste, true, desde(54, 38));
hileraQuintas(quintasOeste, true, desde(68, 55));

// ---------- Contéiners ----------
// Cajas de contéiner (20 pies): 84 × 30 acostadas, 34 × 76 paradas.
const CONT_L = 84;
const CONT_A = 30;
const contenedor = (numero, x, y, w, h) =>
  espacios.push({
    tipo: "contenedor",
    numero: String(numero),
    medio: false,
    propio: false,
    grupo: null,
    nota: null,
    x,
    y,
    w,
    h,
  });

const DERECHA_X = NAVE.x + NAVE_W + 70; // columna de locales: 1614
const RECINTO_X = DERECHA_X + 66; // 1680

// Recinto norte: 3 contéiners, uno arriba del otro.
const recA = { x: RECINTO_X, y: 40, w: 170, h: 150 };
elementos.push({ tipo: "recinto", etiqueta: "Contéiners", ...recA });
for (let i = 0; i < 3; i++) contenedor(i + 1, recA.x + 22, recA.y + 24 + i * (CONT_A + 12), CONT_L, CONT_A);

// Una sola hilera de 10 bajo las 18 cocheras, parados, del 1 al 10 desde la derecha.
const FILA_W = 34;
const FILA_H = 76;
const FILA_G = 10;
const filaAncho = 10 * FILA_W + 9 * FILA_G;
const filaX = ESTE_X + ESTE_W / 2 - filaAncho / 2;
const filaY = cocheraSurY + COCHERA_H - 2 + 32;
for (let i = 0; i < 10; i++) contenedor(10 - i, filaX + i * (FILA_W + FILA_G), filaY, FILA_W, FILA_H);
elementos.push({
  tipo: "rotulo",
  etiqueta: "Contéiners",
  x: filaX,
  y: filaY + FILA_H + 10,
  w: filaAncho,
  h: 20,
});

// ---------- Galpón (10 subgalpones) ----------
// Un galpón grande dividido como en el dibujo: arriba uno grande y uno ancho, después
// cuatro filas de dos. Cada subgalpón lleva el número del puesto de quien lo tiene.
const galpon = { tipo: "galpon", etiqueta: "Galpón", x: RECINTO_X + 200, y: 40, w: 170, h: 420 };
elementos.push(galpon);
{
  const x0 = galpon.x + 12;
  const ancho = galpon.w - 24;
  const medio = (ancho - G) / 2;
  let y = galpon.y + 14;
  const filas = [
    { alto: 96, nums: ["68"] },
    { alto: 50, nums: ["9"] },
    { alto: 56, nums: ["9", "29"] },
    { alto: 56, nums: ["1", "26"] },
    { alto: 56, nums: ["69", "54"] },
    { alto: 56, nums: ["63", "33"] },
  ];
  for (const f of filas) {
    f.nums.forEach((n, i) =>
      espacios.push({
        tipo: "galpon",
        numero: n,
        medio: false,
        propio: false,
        grupo: null,
        nota: `Del puesto ${n}`,
        x: f.nums.length === 1 ? x0 : x0 + i * (medio + G),
        y,
        w: f.nums.length === 1 ? ancho : medio,
        h: f.alto,
      })
    );
    y += f.alto + G;
  }
}

// ---------- Locales (86 arriba, 75 abajo) ----------
const LOCAL_W = 62;
const LOCAL_H = 46;
const localesY0 = 470;
[
  ["86", "Aug."],
  ["87", "Vill."],
  ["94", "Luc."],
  ["80", null],
  ["75", null],
].forEach(([n, nota], i) =>
  espacios.push({
    tipo: "local",
    numero: n,
    medio: false,
    propio: false,
    grupo: null,
    nota,
    x: DERECHA_X,
    y: localesY0 + i * (LOCAL_H + 3),
    w: LOCAL_W,
    h: LOCAL_H,
  })
);
elementos.push({
  tipo: "rotulo",
  etiqueta: "Locales",
  x: DERECHA_X + LOCAL_W / 2 - 40,
  y: localesY0 + 5 * LOCAL_H + 4 * 3 + 8,
  w: 80,
  h: 20,
});

// ---------- Invernaderos ----------
// El 82 al lado de los locales (a la altura del 94), el otro a su derecha y el
// contéiner 3, solo, debajo del 82.
const INV_W = 86;
const INV_H = 260;
const invY = 580;
const inv1X = DERECHA_X + LOCAL_W + 30;
const inv2X = inv1X + INV_W + 30;
elementos.push({ tipo: "invernadero", etiqueta: "Invernadero 82", x: inv1X, y: invY, w: INV_W, h: INV_H });
elementos.push({ tipo: "invernadero", etiqueta: "Invernadero", x: inv2X, y: invY, w: INV_W, h: INV_H });
contenedor(3, inv1X + 1, invY + INV_H + 26, CONT_L, 34);

// ---------- SQL ----------
const q = (v) => (v === null || v === undefined ? "null" : `'${String(v).replaceAll("'", "''")}'`);
const num = (v) => Number(v.toFixed(2));

/** El plano (datos) y el SQL de la carga inicial. */
export function plano() {
  return { org: ORG, espacios, elementos, q, num };
}

function sql() {
  const filasElementos = elementos.map(
    (e, i) =>
      `  ('${ORG}', ${q(e.tipo)}, ${q(e.etiqueta)}, ${e.capacidad ?? "null"}, ${num(e.x)}, ${num(e.y)}, ${num(e.w)}, ${num(e.h)}, ${i})`
  );
  const filasEspacios = espacios.map(
    (e) =>
      `  ('${ORG}', ${q(e.tipo)}, ${q(e.numero)}, ${e.medio}, ${e.medio ? 0.5 : 1}, ${Boolean(e.propio)}, ${q(e.grupo)}, ${q(e.nota)}, ${num(e.x)}, ${num(e.y)}, ${num(e.w)}, ${num(e.h)})`
  );
  const cuenta = (tipo) => espacios.filter((e) => e.tipo === tipo).length;
  const puestos = espacios.filter((e) => e.tipo === "puesto");
  return `-- ============================================================
-- Plano real del Mercado San Miguel — generado por supabase/plano/generar.mjs
-- ${puestos.length} puestos (${puestos.filter((p) => p.medio).length} medios, ${puestos.filter((p) => p.propio).length} propios), 1 bar, ${cuenta("local")} locales,
-- ${cuenta("contenedor")} contéiners, ${cuenta("galpon")} subgalpones, ${cuenta("cochera")} cocheras y ${cuenta("quinta")} quintas.
-- Carga INICIAL: borra el plano de la organización antes de insertarlo. Correr una sola
-- vez, con el rol postgres. Si el plano ya está en uso (puestos asignados o marcados
-- como propios, medidores, solicitudes, canon o registros que apuntan a un lugar) NO
-- corre: esos vínculos se perderían (FASE3 §8). Los arreglos se hacen desde el mapa.
-- ============================================================
begin;

do $$
begin
  if exists (select 1 from public.espacios e
              where e.org_id = '${ORG}' and (e.cliente_id is not null or e.propio))
     or exists (select 1 from public.medidores m join public.espacios e on e.id = m.espacio_id
                 where e.org_id = '${ORG}')
     or exists (select 1 from public.solicitudes s join public.espacios e on e.id = s.espacio_id
                 where e.org_id = '${ORG}')
     or exists (select 1 from public.canon_camiones c join public.espacios e on e.id = c.espacio_id
                 where e.org_id = '${ORG}')
     or exists (select 1 from public.sanciones s join public.espacios e on e.id = s.espacio_id
                 where e.org_id = '${ORG}')
  then
    raise exception 'El plano ya está en uso (puestos asignados o propios, medidores, solicitudes, canon o registros con lugar): recrearlo borraría esos vínculos. Corregí los puestos desde el mapa (Asignar puestos → tocá el puesto).';
  end if;
end $$;

delete from public.espacios where org_id = '${ORG}';
delete from public.plano_elementos where org_id = '${ORG}';

insert into public.plano_elementos (org_id, tipo, etiqueta, capacidad, x, y, w, h, orden) values
${filasElementos.join(",\n")};

insert into public.espacios (org_id, tipo, numero, medio, tamano, propio, grupo, nota, x, y, w, h) values
${filasEspacios.join(",\n")};

commit;`;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) console.log(sql());
