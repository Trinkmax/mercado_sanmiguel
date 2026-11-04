import { ImageResponse } from "next/og";
import { formatARS, formatFechaTS, formatSoloHora, labelPeriodo } from "@/lib/format";
import { textoCargo } from "@/components/cobranza/descripcion-cargo";

/** El recibo dibujado como imagen (ver /api/recibo-imagen). */

export type DatosRecibo = {
  numero: number;
  fecha: string;
  anulado: boolean;
  cliente: { codigo: number; nombre: string };
  caja: { label: string };
  recibio: string | null;
  total: number;
  total_original?: number;
  lineas: { pago_id: string; medio: string; monto: number; anulado: boolean; titular_transferencia: string | null }[];
  imputaciones: { cargo_id: string; descripcion: string; periodo: string; monto: number; beneficio: number }[];
  saldo_favor: number;
  aplicado_despues?: { cargo_id: string }[];
};

const MEDIO: Record<string, string> = { efectivo: "Efectivo", transferencia: "Transferencia", cheque: "Cheque" };
const AZUL = "#253b8a";
const TINTA = "#141a33";
const GRIS = "#5b6275";
const VERDE = "#177245";

/** La misma letra del portal. Si Google Fonts no responde o tarda, sale con la letra de base. */
async function cargarLetra(familia: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(`https://fonts.googleapis.com/css2?family=${familia}`, {
      // Con un navegador viejo Google responde con WOFF (satori no lee WOFF2).
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8) AppleWebKit/533.21.1 Safari/533.21.1" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    // Solo el subconjunto latino (trae la ñ, los acentos, el ° y el ×).
    const url = /\/\* latin \*\/[\s\S]*?src: url\((.+?)\) format\('(?:woff|opentype|truetype)'\)/.exec(await res.text())?.[1];
    if (!url) return null;
    const letra = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return letra.ok ? await letra.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/** Renglones que ocupa un texto de 31 px en el ancho de la columna (aproximado, de más). */
function renglones(texto: string, porRenglon: number): number {
  return Math.max(1, Math.ceil(texto.length / porRenglon));
}

function Fila({ izquierda, derecha, sub }: { izquierda: string; derecha: string; sub?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 28, paddingTop: 15, paddingBottom: 15, borderBottom: "2px dashed #d9dde8" }}>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 31, color: TINTA }}>{izquierda}</span>
        {sub ? <span style={{ fontSize: 26, color: GRIS, marginTop: 3 }}>{sub}</span> : null}
      </div>
      <span style={{ fontSize: 33, fontWeight: 800, color: TINTA, whiteSpace: "nowrap" }}>{derecha}</span>
    </div>
  );
}

export async function imagenRecibo(r: DatosRecibo, logoUrl: string): Promise<Response> {
  const vigentes = r.lineas.filter((l) => !l.anulado);
  const beneficio = r.imputaciones.reduce((a, i) => a + Number(i.beneficio ?? 0), 0);
  const anuladas = r.lineas.filter((l) => l.anulado).length;
  const parcial = !r.anulado && anuladas > 0;
  const favorAplicado = (r.aplicado_despues ?? []).length > 0;
  // Se calcula de más y sobra un poco de papel abajo: mejor eso que textos encimados.
  const altoFilas =
    vigentes.reduce((a, l) => a + 64 + (l.medio === "transferencia" && l.titular_transferencia ? 34 * renglones(l.titular_transferencia, 42) : 0), 0) +
    r.imputaciones.reduce((a, i) => a + 30 + 40 * renglones(textoCargo(i.descripcion), 36) + 34, 0) +
    (r.saldo_favor > 0.009 ? 100 : 0);
  const alto =
    590 +
    altoFilas +
    42 * renglones(`Recibimos de ${r.cliente.nombre} (Carpeta N° ${r.cliente.codigo})`, 52) +
    (beneficio > 0.009 ? 44 : 0) +
    (parcial ? 44 : 0) +
    36 * renglones(`Recibió: ${r.recibio ?? ""} · ${r.caja.label}`, 34);
  const total = r.anulado ? Number(r.total_original ?? 0) : Number(r.total);
  const [normal, fuerte] = await Promise.all([cargarLetra("Archivo:wght@500"), cargarLetra("Archivo+Black")]);

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#ffffff", color: TINTA, ...(normal ? { fontFamily: "Archivo" } : {}) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28, background: AZUL, color: "#ffffff", padding: "36px 56px" }}>
          <div style={{ display: "flex", background: "#ffffff", borderRadius: 16, padding: "12px 16px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} width={138} height={53} alt="" />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 38, fontWeight: 800 }}>Mercado San Miguel</span>
            <span style={{ fontSize: 26 }}>Cooperativa · Malagueño, Córdoba</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "42px 56px 36px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <span style={{ fontSize: 58, fontWeight: 800, letterSpacing: -1 }}>Recibo N° {r.numero}</span>
            <span style={{ fontSize: 29, color: GRIS }}>
              {formatFechaTS(r.fecha)}, {formatSoloHora(r.fecha)}
            </span>
          </div>
          <span style={{ fontSize: 32, marginTop: 18 }}>
            Recibimos de {r.cliente.nombre} (Carpeta N° {r.cliente.codigo})
          </span>

          <div style={{ display: "flex", flexDirection: "column", marginTop: 26 }}>
            {vigentes.map((l) => (
              <Fila
                key={l.pago_id}
                izquierda={MEDIO[l.medio] ?? l.medio}
                sub={l.medio === "transferencia" && l.titular_transferencia ? `De ${l.titular_transferencia}` : undefined}
                derecha={formatARS(l.monto)}
              />
            ))}
            {r.imputaciones.map((i) => (
              <Fila
                key={i.cargo_id}
                izquierda={textoCargo(i.descripcion)}
                sub={labelPeriodo(i.periodo)}
                derecha={formatARS(i.monto)}
              />
            ))}
            {r.saldo_favor > 0.009 ? (
              <Fila
                izquierda="Saldo a favor"
                sub={favorAplicado ? "Ya se aplicó a lo que debías" : "Se aplica a lo próximo que debas"}
                derecha={formatARS(r.saldo_favor)}
              />
            ) : null}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 30 }}>
            <span style={{ fontSize: 38, fontWeight: 800 }}>{r.anulado ? "Total (anulado)" : "Total"}</span>
            <span style={{ fontSize: 76, fontWeight: 800, letterSpacing: -2, ...(r.anulado ? { textDecoration: "line-through" } : {}) }}>
              {formatARS(total)}
            </span>
          </div>
          {beneficio > 0.009 ? (
            <span style={{ fontSize: 27, color: GRIS, marginTop: 6 }}>
              Incluye beneficio por pago en término de {formatARS(beneficio)}
            </span>
          ) : null}
          {parcial ? (
            <span style={{ fontSize: 27, color: GRIS, marginTop: 6 }}>Una parte de este recibo se anuló.</span>
          ) : null}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "auto", paddingTop: 28 }}>
            <div
              style={{
                display: "flex",
                fontSize: 36,
                fontWeight: 800,
                color: r.anulado ? "#c22a22" : VERDE,
                border: `5px solid ${r.anulado ? "#c22a22" : VERDE}`,
                borderRadius: 12,
                padding: "10px 20px",
                transform: "rotate(-3deg)",
              }}
            >
              {r.anulado ? "ANULADO" : "PAGO RECIBIDO"}
            </div>
            <span style={{ fontSize: 26, color: GRIS, maxWidth: 500, textAlign: "right" }}>
              Recibió: {r.recibio ?? "—"} · {r.caja.label}
            </span>
          </div>
          <span style={{ fontSize: 24, color: GRIS, marginTop: 22, textAlign: "center", alignSelf: "center" }}>
            Comprobante interno, sin validez fiscal
          </span>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: alto,
      fonts:
        normal && fuerte
          ? [
              { name: "Archivo", data: normal, weight: 500, style: "normal" },
              { name: "Archivo", data: fuerte, weight: 800, style: "normal" },
            ]
          : undefined,
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}
