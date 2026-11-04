// Genera src/components/portal/silueta-plano.ts: la silueta del mercado que se dibuja de fondo
// en el portal del socio (solo geometría y números de lugar, ningún dato de clientes).
// El socio solo puede leer SUS lugares (RLS de `espacios`); el resto del plano es contexto y
// casi nunca cambia, por eso va como archivo. Sus propios lugares salen siempre de la base.
//
// Uso (cuando cambia el dibujo del mercado):
//   node --env-file=.env.local supabase/plano/silueta-portal.mjs
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

const { data: espacios, error: e1 } = await supabase
  .from("espacios")
  .select("tipo, numero, medio, x, y, w, h")
  .order("tipo")
  .order("y")
  .order("x");
if (e1) throw e1;
const { data: elementos, error: e2 } = await supabase
  .from("plano_elementos")
  .select("tipo, etiqueta, x, y, w, h")
  .order("tipo")
  .order("y")
  .order("x");
if (e2) throw e2;

const n = (v) => Math.round(Number(v) * 100) / 100;

const lugares = espacios.map((e) => [
  e.tipo,
  e.numero === null ? null : `${e.numero}${e.medio ? "½" : ""}`,
  n(e.x),
  n(e.y),
  n(e.w),
  n(e.h),
]);
const zonas = elementos.map((e) => [e.tipo, e.etiqueta, n(e.x), n(e.y), n(e.w), n(e.h)]);

const salida = `// Generado por supabase/plano/silueta-portal.mjs: no editar a mano.
// Silueta del mercado para el portal del socio: geometría y números de lugar, sin datos de clientes.

export type FilaPlano = readonly [tipo: string, texto: string | null, x: number, y: number, w: number, h: number];

export const LUGARES_PLANO: readonly FilaPlano[] = ${JSON.stringify(lugares)};

export const ZONAS_PLANO: readonly FilaPlano[] = ${JSON.stringify(zonas)};
`;
writeFileSync(new URL("../../src/components/portal/silueta-plano.ts", import.meta.url), salida);
console.log(`Listo: ${lugares.length} lugares, ${zonas.length} zonas.`);
