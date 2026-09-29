/**
 * Descripción de un cargo como se lee en la carpeta, sin partir lo que explica el importe:
 * "N° QA-104521" (el medidor), "(1.240 kWh)" (el consumo) y "× 4" (la cantidad) nunca se
 * cortan a la mitad en un celular. Sirve en server y client (no tiene estado).
 *
 * El consumo lo guarda la base ya en formato argentino (trigger de cargos); si llega un
 * cargo viejo con "(1240.00 kWh)", se muestra igual como "(1.240 kWh)".
 */

const kwh = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

/** Piezas que no se parten: medidor, consumo y cantidad. */
const INSEPARABLE = /(N° \S+|\([^()]*kWh\)|× \d+(?:[.,]\d+)?)/;

/** "(1240.00 kWh)" → "(1.240 kWh)"; lo que ya viene en es-AR queda igual. */
function consumoArgentino(texto: string): string {
  return texto.replace(/\((\d+\.\d{2}) kWh\)/, (_, n: string) => `(${kwh.format(Number(n))} kWh)`);
}

/** El texto plano, para un `title` o un export. */
export function textoCargo(descripcion: string): string {
  return consumoArgentino(descripcion);
}

export function DescripcionCargo({ texto }: { texto: string }) {
  const partes = textoCargo(texto).split(INSEPARABLE);
  return (
    <>
      {partes.map((p, i) =>
        i % 2 === 1 ? (
          <span key={i} className="whitespace-nowrap">
            {p}
          </span>
        ) : (
          p
        )
      )}
    </>
  );
}
