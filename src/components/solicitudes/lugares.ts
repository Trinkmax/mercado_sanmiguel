/** Lugares del plano para solicitudes (TS puro, server y client).
 *  Los datos salen de `rpc('espacios_del_plano')`: número, tipo y medio, sin clientes.
 *  El texto coincide con el que arma el trigger `preparar_solicitud` ("Puesto 58"). */

export type LugarSimple = {
  id: string;
  tipo: string;
  numero: string | null;
  medio: boolean;
};

export type TipoLugar = "puesto" | "local" | "contenedor";

export const TIPOS_LUGAR: { valor: TipoLugar; label: string }[] = [
  { valor: "puesto", label: "Puesto" },
  { valor: "local", label: "Local" },
  { valor: "contenedor", label: "Contéiner" },
];

/** "Puesto 58" · "Puesto 34½" · "Local 3" · "Contéiner 7" · "Bar". */
export function etiquetaLugar(e: Pick<LugarSimple, "tipo" | "numero" | "medio">): string {
  const n = e.numero ?? "?";
  switch (e.tipo) {
    case "puesto":
      return `Puesto ${n}${e.medio ? "½" : ""}`;
    case "local":
      return `Local ${n}`;
    case "contenedor":
      return `Contéiner ${n}`;
    case "bar":
      return e.numero ?? "Bar";
    default:
      return `${e.tipo.charAt(0).toUpperCase()}${e.tipo.slice(1)} ${e.numero ?? ""}`.trim();
  }
}

/**
 * Busca los lugares de un tipo con ese número. Los medios puestos del mismo número son un
 * solo lugar para quien avisa: se devuelve uno por etiqueta.
 */
export function buscarLugar(lugares: LugarSimple[], tipo: TipoLugar, numero: string): LugarSimple[] {
  const n = numero.trim().replace(/^0+(?=\d)/, "");
  if (!n) return [];
  const vistos = new Set<string>();
  const res: LugarSimple[] = [];
  for (const l of lugares) {
    if (l.tipo !== tipo || (l.numero ?? "").replace(/^0+(?=\d)/, "") !== n) continue;
    const et = etiquetaLugar(l);
    if (vistos.has(et)) continue;
    vistos.add(et);
    res.push(l);
  }
  return res;
}
