// Genera `plano_mercado.sql`: el plano real del Mercado San Miguel (dibujo
// del predio, septiembre 2026) en unidades del plano.
//
//   node supabase/plano/generar.mjs > supabase/plano/plano_mercado.sql
//
// Convenciones del dibujo original:
//   · "52 - 50 - 48 - 46" = un puestero con varios puestos (grupo).
//   · "34 /2"             = medio puesto.
//   · Los círculos son contenedores.
// Se respeta el dibujo tal cual, incluso lo que hay que revisar con el
// mercado: "63 - 63" (repetido), "5 /2" en la isla y "7 - 5" en la fila sur
// (el 5 aparece dos veces), un puesto con "?" y la falta del 17.

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
 *  número | { n, medio?, ancho?, antes? (espacio extra previo), grupo?, nota?, tipo? } */
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
elementos.push({
  tipo: "quinteros",
  etiqueta: "Quinteros",
  x: finIslaOeste + QUINTEROS_GAP,
  y: ISLA_Y,
  w: OESTE_X + OESTE_W - (finIslaOeste + QUINTEROS_GAP),
  h: ISLA_H,
});

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
elementos.push({
  tipo: "quinteros",
  etiqueta: "Quinteros",
  x: ESTE_X,
  y: ISLA_Y,
  w: inicioIslaEste - QUINTEROS_GAP - ESTE_X,
  h: ISLA_H,
});
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
elementos.push({
  tipo: "cocheras",
  etiqueta: "36 cocheras",
  capacidad: 36,
  x: NAVE.x,
  y: cocheraNorteY,
  w: NAVE_W,
  h: COCHERA_H,
});
const cocheraSurY = NAVE.y + NAVE_H + 58; // 620
elementos.push({
  tipo: "cocheras",
  etiqueta: "20 cocheras",
  capacidad: 20,
  x: NAVE.x,
  y: cocheraSurY,
  w: PASILLO_X - PASILLO_GAP - NAVE.x,
  h: COCHERA_H - 2,
});
elementos.push({
  tipo: "cocheras",
  etiqueta: "18 cocheras",
  capacidad: 18,
  x: ESTE_X,
  y: cocheraSurY,
  w: ESTE_W,
  h: COCHERA_H - 2,
});

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

// ---------- Contenedores ----------
const C = 46; // diámetro
const CG = 12;
let nContenedor = 0;
const contenedor = (x, y, w = C, h = C) =>
  espacios.push({
    tipo: "contenedor",
    numero: String(++nContenedor),
    medio: false,
    grupo: null,
    nota: null,
    x,
    y,
    w,
    h,
  });

const DERECHA_X = NAVE.x + NAVE_W + 70; // columna de locales: 1614
const RECINTO_X = DERECHA_X + 66; // 1680

// Recinto norte: 3 contenedores
const recA = { x: RECINTO_X, y: 40, w: 170, h: 150 };
elementos.push({ tipo: "recinto", etiqueta: "Contenedores", ...recA });
contenedor(recA.x + 22, recA.y + 16);
contenedor(recA.x + 96, recA.y + 52);
contenedor(recA.x + 22, recA.y + 88);

// Recinto este: 1 grande + 8
const recB = { x: RECINTO_X, y: 232, w: 0, h: 160 };
const grandeW = 86;
const grandeH = 52;
const filasH = 2 * C + CG;
const filaY0 = recB.y + (recB.h - filasH) / 2;
contenedor(recB.x + 18, recB.y + (recB.h - grandeH) / 2, grandeW, grandeH);
const colX0 = recB.x + 18 + grandeW + 20;
for (let fi = 0; fi < 2; fi++) {
  for (let co = 0; co < 4; co++) {
    contenedor(colX0 + co * (C + CG), filaY0 + fi * (C + CG));
  }
}
recB.w = colX0 + 4 * C + 3 * CG + 18 - recB.x;
elementos.push({ tipo: "recinto", etiqueta: "Contenedores", ...recB });

// 10 contenedores bajo las 18 cocheras
const diezW = 5 * C + 4 * CG;
const diezX = ESTE_X + ESTE_W / 2 - diezW / 2;
const diezY = cocheraSurY + COCHERA_H - 2 + 32;
for (let fi = 0; fi < 2; fi++) {
  for (let co = 0; co < 5; co++) {
    contenedor(diezX + co * (C + CG), diezY + fi * (C + CG));
  }
}
elementos.push({
  tipo: "rotulo",
  etiqueta: "Contenedores",
  x: diezX,
  y: diezY + 2 * C + CG + 10,
  w: diezW,
  h: 20,
});

// ---------- Locales (1 abajo, 5 arriba) ----------
const LOCAL_H = 40;
const localesY0 = 470;
for (let i = 0; i < 5; i++) {
  espacios.push({
    tipo: "local",
    numero: String(5 - i),
    medio: false,
    grupo: null,
    nota: null,
    x: DERECHA_X,
    y: localesY0 + i * (LOCAL_H + 14),
    w: S,
    h: LOCAL_H,
  });
}
elementos.push({
  tipo: "rotulo",
  etiqueta: "Locales",
  x: DERECHA_X - 18,
  y: localesY0 + 5 * (LOCAL_H + 14) + 2,
  w: S + 36,
  h: 20,
});

// ---------- Invernaderos ----------
const INV_W = 86;
const INV_H = 260;
const inv1X = RECINTO_X + 94;
const inv2X = inv1X + INV_W + 30;
elementos.push({ tipo: "invernadero", etiqueta: "Invernadero", x: inv1X, y: localesY0, w: INV_W, h: INV_H });
elementos.push({ tipo: "invernadero", etiqueta: "Invernadero", x: inv2X, y: localesY0, w: INV_W, h: INV_H });

// Contenedor grande suelto, entre los invernaderos y abajo
contenedor(inv1X + INV_W + 15 - grandeW / 2, localesY0 + INV_H + 40, grandeW, grandeH);

// ---------- SQL ----------
const q = (v) => (v === null || v === undefined ? "null" : `'${String(v).replaceAll("'", "''")}'`);
const num = (v) => Number(v.toFixed(2));

const filasElementos = elementos.map(
  (e, i) =>
    `  ('${ORG}', ${q(e.tipo)}, ${q(e.etiqueta)}, ${e.capacidad ?? "null"}, ${num(e.x)}, ${num(e.y)}, ${num(e.w)}, ${num(e.h)}, ${i})`
);
const filasEspacios = espacios.map(
  (e) =>
    `  ('${ORG}', ${q(e.tipo)}, ${q(e.numero)}, ${e.medio}, ${q(e.grupo)}, ${q(e.nota)}, ${num(e.x)}, ${num(e.y)}, ${num(e.w)}, ${num(e.h)})`
);

const puestos = espacios.filter((e) => e.tipo === "puesto");
console.log(`-- ============================================================
-- Plano real del Mercado San Miguel — generado por supabase/plano/generar.mjs
-- ${puestos.length} puestos (${puestos.filter((p) => p.medio).length} medios), 1 bar, 5 locales, ${nContenedor} contenedores.
-- Carga inicial: BORRA el plano de la organización (y sus asignaciones)
-- antes de insertarlo. Correr una sola vez, con el rol postgres.
-- ============================================================
begin;

delete from public.espacios where org_id = '${ORG}';
delete from public.plano_elementos where org_id = '${ORG}';

insert into public.plano_elementos (org_id, tipo, etiqueta, capacidad, x, y, w, h, orden) values
${filasElementos.join(",\n")};

insert into public.espacios (org_id, tipo, numero, medio, grupo, nota, x, y, w, h) values
${filasEspacios.join(",\n")};

commit;`);
