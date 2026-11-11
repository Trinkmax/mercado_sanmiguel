import { cn } from "@/lib/utils";
import { HojaCedulon, tercios, type Cedulon } from "@/components/energia/hoja-cedulon";

/**
 * Los cedulones acomodados en hojas A4: tres por hoja (11/11/2026: «para no desperdiciar»), en el
 * orden del recorrido, con la línea de corte en cada tercio. El de un cliente con muchos
 * medidores ocupa dos tercios; si no entra en lo que queda de la hoja, pasa a la siguiente (nunca
 * se corta un cedulón por la mitad).
 */
export function HojasCedulones({
  cedulones,
  periodo,
  mes,
  consumoLargo,
}: {
  cedulones: Cedulon[];
  periodo: string;
  mes: string;
  consumoLargo: string;
}) {
  const hojas: { c: Cedulon; tercios: 1 | 2 }[][] = [];
  let hoja: { c: Cedulon; tercios: 1 | 2 }[] = [];
  let usados = 0;
  for (const c of cedulones) {
    const t = tercios(c);
    if (usados + t > 3) {
      hojas.push(hoja);
      hoja = [];
      usados = 0;
    }
    hoja.push({ c, tercios: t });
    usados += t;
  }
  if (hoja.length > 0) hojas.push(hoja);

  return (
    <>
      {/* A4 con márgenes de 10 mm: quedan 277 mm de alto, tres tercios de 92 mm. */}
      <style>{"@media print { @page { size: A4; margin: 10mm 12mm; } }"}</style>
      <div>
        {hojas.map((h, i) => {
          const ultimaHoja = i === hojas.length - 1;
          return (
            <section key={h[0].c.clienteId} className={cn(!ultimaHoja && "print:break-after-page")}>
              {h.map(({ c, tercios: t }, j) => {
                const ultimoDeLaHoja = j === h.length - 1;
                const ultimo = ultimaHoja && ultimoDeLaHoja;
                return (
                  <div
                    key={c.clienteId}
                    className={cn(
                      "print:box-border print:overflow-hidden print:py-[3mm]",
                      t === 2 ? "print:h-[184mm]" : "print:h-[92mm]",
                      // La línea de corte: en pantalla entre todos; en el papel, entre los de una hoja.
                      !ultimo && "mb-8 border-b-2 border-dashed border-foreground/40 pb-8 print:mb-0",
                      ultimoDeLaHoja
                        ? "print:border-b-0 print:pb-[3mm]"
                        : "print:border-b-[0.3mm] print:border-foreground/45 print:pb-[3mm]"
                    )}
                  >
                    <HojaCedulon c={c} periodo={periodo} mes={mes} consumoLargo={consumoLargo} />
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </>
  );
}
