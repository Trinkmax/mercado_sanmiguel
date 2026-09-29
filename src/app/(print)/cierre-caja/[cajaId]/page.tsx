import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPerfil, requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  formatARS,
  formatCuit,
  formatFecha,
  formatFechaLarga,
  formatFechaTS,
  formatSoloHora,
} from "@/lib/format";
import { Marca } from "@/components/shared/marca";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { BotonImprimir } from "@/components/shared/boton-imprimir";
import { CuentaCajon } from "@/components/caja/cuenta-cajon";
import { LABEL_EVENTO } from "@/components/caja/historial-caja";
import { labelMedio } from "@/components/caja/medios";
import { cargarDatosCajaPorId } from "@/components/caja/datos";
import { FechaImpresion } from "@/components/caja/fecha-impresion";
import { montosSinCortar } from "@/components/caja/texto";

type Props = {
  params: Promise<{ cajaId: string }>;
  /** `auto=1`: imprimir al abrir. `ver=1`: solo mirar (nunca imprime sola, aunque esté la impresión directa). */
  searchParams: Promise<{ auto?: string | string[]; ver?: string | string[] }>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "28/09/2026, 18:32": en un papel que se archiva, la fecha va con año. */
function fechaHora(iso: string): string {
  return `${formatFechaTS(iso)}, ${formatSoloHora(iso)}`;
}

/**
 * Tablas del imprimible: aire entre columnas (sin él se leía "ReciboCliente") y montos sin
 * partirse. En un celular algunas columnas se esconden y su dato baja a la celda principal
 * (clase SOLO_ANCHO en la columna, SOLO_CELULAR en el dato que baja); en tablet, escritorio
 * y en el papel se ven todas.
 */
const TABLA =
  "w-full text-sm [&_td]:py-1 [&_td]:pr-3 [&_td]:align-top [&_td:last-child]:pr-0 [&_th]:py-1.5 [&_th]:pr-3 [&_th]:font-medium [&_th:last-child]:pr-0";
const SOLO_ANCHO = "hidden sm:table-cell print:table-cell";
const SOLO_CELULAR = "block text-xs text-muted-foreground sm:hidden print:hidden";

/** "Efectivo contado $ 2.572.000 (coincide)": lo que dejó la validación de Tesorería. */
function conteoValidado(detalle: string | null | undefined): { contado: string; resultado: string } | null {
  const m = /Efectivo contado (\$\s?[\d.,]+) \(([^)]*)\)/.exec(detalle ?? "");
  return m ? { contado: m[1], resultado: m[2] } : null;
}

/** El título es el nombre del PDF al "Guardar como PDF". */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cajaId } = await params;
  const perfil = await getPerfil();
  if (!perfil || !UUID.test(cajaId)) return { title: "Cierre de caja" };
  const supabase = await createClient();
  const { data } = await supabase.from("cajas").select("tipo, fecha, estado").eq("id", cajaId).maybeSingle();
  if (!data) return { title: "Cierre de caja" };
  const fecha = formatFecha(data.fecha);
  const parcial = data.estado === "abierta" ? " (parcial)" : "";
  return {
    title:
      data.tipo === "guardia"
        ? `Rendición caja de portería ${fecha}${parcial}`
        : `Cierre de caja ${fecha} — Administración${parcial}`,
  };
}

function Titulo({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-b border-foreground/40 pb-1 font-display text-sm font-bold tracking-wider uppercase">
      {children}
    </h2>
  );
}

/**
 * Imprimible del cierre de caja (I2): la cuenta completa, el detalle de lo que entró
 * y salió, el recuadro para el conteo a mano, firmas y bitácora. Con la caja abierta
 * sale marcado PARCIAL. `?auto=1` (desde "Imprimir cierre") abre el diálogo de impresión;
 * `?ver=1` (el detalle desde la bandeja de Administración) es solo para mirar: no imprime solo.
 */
export default async function CierreCajaPage({ params, searchParams }: Props) {
  const [{ cajaId }, { auto, ver }] = await Promise.all([params, searchParams]);
  const perfil = await requireRol("admin", "guardia", "tesoreria", "lider");
  // La RLS limita al Jefe a las cajas de portería: lo que no ve, no existe.
  const datos = await cargarDatosCajaPorId(perfil, cajaId);
  if (!datos || !datos.caja) notFound();
  const { caja, arqueo, tipo } = datos;

  const supabase = await createClient();
  const [orgRes, configRes] = await Promise.all([
    supabase.from("organizaciones").select("nombre").eq("id", perfil.org_id).maybeSingle(),
    supabase.from("configuracion").select("impresion_directa").eq("org_id", perfil.org_id).maybeSingle(),
  ]);

  const porteria = tipo === "guardia";
  const abierta = caja.estado === "abierta";
  const primero = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  // Mirar el detalle de una rendición antes de recibirla no tiene que sacar una hoja por la impresora.
  const soloMirar = primero(ver) === "1";
  const autoImprimir =
    primero(auto) === "1" || (Boolean(configRes.data?.impresion_directa) && !soloMirar);
  const validada = caja.estado === "validada";
  const conteo = validada
    ? conteoValidado([...datos.eventos].reverse().find((e) => e.tipo === "validacion")?.detalle)
    : null;
  const quienCuenta = porteria ? "Administración" : "Tesorería";
  const titulo = porteria ? "Rendición — Caja de portería" : "Cierre de caja — Administración";
  const pasos = [
    caja.cerrada_en
      ? `${porteria ? "Rendida" : "Cerrada"} el ${fechaHora(caja.cerrada_en)}${datos.nombres.cerrada ? ` por ${datos.nombres.cerrada}` : ""}`
      : null,
    caja.integrada_en ? `Recibida en la caja mayor el ${fechaHora(caja.integrada_en)}` : null,
    caja.validada_en
      ? `Validada el ${fechaHora(caja.validada_en)}${datos.nombres.validada ? ` por ${datos.nombres.validada}` : ""}`
      : null,
  ].filter(Boolean);

  // Cobros: una fila por línea (medio); las líneas de un mismo recibo van juntas.
  const porMedio = { efectivo: 0, transferencia: 0, cheque: 0 } as Record<string, number>;
  for (const r of datos.recibos) for (const l of r.lineas) if (!l.anulado) porMedio[l.medio] += l.monto;
  const anulados = datos.recibos.filter((r) => r.anulado || r.lineas.some((l) => l.anulado));

  // Cheques recibidos (en cartera) y entregados a un proveedor en el mismo cobro.
  const cheques = datos.recibos.flatMap((r) =>
    r.lineas
      .filter((l) => l.cheque && !l.anulado)
      .map((l) => ({ ...l.cheque!, monto: l.monto, recibo: r.numero, cliente: r.cliente?.nombre ?? "—" }))
  );
  const chequesEnCaja = cheques.filter((c) => !c.entregadoEnCobro);
  const chequesEntregados = cheques.filter((c) => c.entregadoEnCobro);

  // Bono camioneros por tarifa (sin anulados).
  const porTarifa = new Map<string, { nombre: string; unidad: string | null; entradas: number; cantidad: number; efectivo: number; transferencia: number }>();
  for (const e of datos.canon) {
    if (e.anulado) continue;
    const clave = `${e.tarifa_nombre ?? "Canon"}|${e.unidad ?? ""}`;
    const t = porTarifa.get(clave) ?? { nombre: e.tarifa_nombre ?? "Canon", unidad: e.unidad, entradas: 0, cantidad: 0, efectivo: 0, transferencia: 0 };
    t.entradas += 1;
    t.cantidad += e.cantidad;
    if (e.medio === "efectivo") t.efectivo += e.monto;
    else t.transferencia += e.monto;
    porTarifa.set(clave, t);
  }
  const tarifas = [...porTarifa.values()].sort((a, b) => b.efectivo + b.transferencia - (a.efectivo + a.transferencia));
  const canonAnulados = datos.canon.filter((e) => e.anulado);

  return (
    <>
      <BotonImprimir
        // Administración no tiene la pestaña de portería en /caja: vuelve a donde estaba.
        volverA={perfil.rol === "admin" && porteria ? undefined : `/caja?fecha=${caja.fecha}&tipo=${tipo}`}
        autoImprimir={autoImprimir}
        etiquetaImprimir={abierta ? "Imprimir parcial" : "Imprimir cierre"}
      />

      <div className="etiqueta">
        <div className="etiqueta-interior space-y-6">
          {/* Cabecera: la marca y el sello arriba; el título y el día juntos, a la izquierda
              (alineados a la derecha quedaban flotando en el medio de la hoja al bajar de renglón). */}
          <header className="space-y-3 border-b-2 border-foreground pb-4">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0 space-y-1">
                <Marca />
                <p className="text-sm text-muted-foreground">
                  {orgRes.data?.nombre ?? "Cooperativa Mercado San Miguel"} · Malagueño, Córdoba
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {caja.reapertura_solicitada_en ? <Sello estado="reapertura_pedida" /> : null}
                <Sello grande estado={caja.estado} />
              </div>
            </div>
            <div className="space-y-0.5">
              <h1 className="font-display text-xl font-semibold tracking-wide break-words uppercase">{titulo}</h1>
              <p className="text-sm">
                {capitalizar(formatFechaLarga(caja.fecha))} de {caja.fecha.slice(0, 4)}
              </p>
            </div>
          </header>

          <p className={`text-xs text-muted-foreground ${pasos.length === 0 ? "hidden print:block" : ""}`}>
            {pasos.join(" · ")}
            {pasos.length > 0 ? <span className="hidden print:inline"> · </span> : null}
            <FechaImpresion por={perfil.nombre} />
          </p>

          {abierta ? (
            <p className="rounded-md border-2 border-dashed border-foreground px-4 py-2 text-center font-display text-lg font-bold tracking-widest uppercase">
              Parcial — caja abierta: los números pueden cambiar
            </p>
          ) : null}

          {porteria ? (
            <p className="text-lg">
              Entrega en Administración: <Money monto={arqueo.efectivo} className="text-2xl font-bold" /> en efectivo
              {arqueo.transferencia > 0.009 ? ` (+${formatARS(arqueo.transferencia)} ya en el banco)` : ""}.
            </p>
          ) : null}

          {/* La cuenta */}
          <section className="break-inside-avoid space-y-2">
            <Titulo>La cuenta</Titulo>
            <CuentaCajon
              arqueo={arqueo}
              tipo={tipo}
              variante="papel"
              tituloResultado={abierta ? "Tiene que haber ahora" : "Tiene que haber"}
            />
          </section>

          {/* Recuadro del conteo: cerrar la caja no es contarla. Lo completa quien recibe la
              plata; con la caja validada, muestra lo que contó Tesorería. */}
          <section className="break-inside-avoid space-y-3 rounded-md border-2 border-foreground p-4">
            {validada ? (
              conteo ? (
                <>
                  <p className="text-sm text-muted-foreground">Conteo de {quienCuenta} al validar la caja</p>
                  <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 print:grid-cols-2">
                    <p>
                      <span className="font-semibold">Efectivo contado</span>{" "}
                      <span className="whitespace-nowrap tabular">{montosSinCortar(conteo.contado)}</span>
                    </p>
                    <p>
                      <span className="font-semibold">Diferencia</span>{" "}
                      {conteo.resultado === "coincide"
                        ? "no hubo: coincide"
                        : montosSinCortar(conteo.resultado)}
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-sm">
                  {quienCuenta} validó la caja sin cargar el efectivo contado.
                </p>
              )
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Para completar a mano: lo cuenta {quienCuenta} al recibir la plata.{" "}
                  <span className="whitespace-nowrap">
                    Tiene que haber <Money monto={arqueo.efectivo} className="font-semibold text-foreground" />
                  </span>{" "}
                  en efectivo.
                </p>
                <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
                  <p className="flex items-end gap-2">
                    <span className="shrink-0 font-semibold">Efectivo contado $</span>
                    <span className="mb-1 min-w-16 flex-1 border-b border-foreground" />
                  </p>
                  <p className="flex items-end gap-2">
                    <span className="shrink-0 font-semibold">Diferencia $</span>
                    <span className="mb-1 min-w-16 flex-1 border-b border-foreground" />
                  </p>
                </div>
              </>
            )}
          </section>

          {/* Cobros */}
          <section className="space-y-2">
            <Titulo>
              Cobros ({datos.recibos.filter((r) => !r.anulado).length}{" "}
              {datos.recibos.filter((r) => !r.anulado).length === 1 ? "recibo" : "recibos"})
            </Titulo>
            {datos.recibos.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hubo cobros en esta caja.</p>
            ) : (
              <table className={TABLA}>
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className={SOLO_ANCHO}>Hora</th>
                    <th>Recibo</th>
                    <th>Cliente</th>
                    <th className={SOLO_ANCHO}>Medio</th>
                    <th className="text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.recibos.flatMap((r) =>
                    r.lineas.map((l, i) => {
                      const medio = `${labelMedio(l.medio)}${l.cheque ? ` N° ${l.cheque.numero}` : ""}`;
                      return (
                        <tr
                          key={l.pagoId}
                          className={`break-inside-avoid ${i === r.lineas.length - 1 ? "border-b border-dashed" : ""} ${l.anulado ? "text-muted-foreground line-through" : ""}`}
                        >
                          <td className={`${SOLO_ANCHO} whitespace-nowrap tabular`}>
                            {i === 0 ? formatSoloHora(r.fecha) : ""}
                          </td>
                          <td className="whitespace-nowrap tabular">
                            {i === 0 ? (
                              <>
                                N° {r.numero}
                                <span className={SOLO_CELULAR}>{formatSoloHora(r.fecha)}</span>
                              </>
                            ) : (
                              ""
                            )}
                          </td>
                          <td className="break-words">
                            {i === 0 ? `${r.cliente?.nombre ?? "—"}${r.cliente ? ` (${r.cliente.codigo})` : ""}` : ""}
                            <span className={SOLO_CELULAR}>{medio}</span>
                          </td>
                          <td className={SOLO_ANCHO}>{medio}</td>
                          <td className="text-right whitespace-nowrap tabular">{formatARS(l.monto)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-foreground">
                    <td colSpan={5} className="pt-2! text-right">
                      <span className="whitespace-nowrap">Efectivo {formatARS(porMedio.efectivo)}</span> ·{" "}
                      <span className="whitespace-nowrap">Transferencia {formatARS(porMedio.transferencia)}</span>
                      {!porteria ? (
                        <>
                          {" · "}
                          <span className="whitespace-nowrap">Cheques {formatARS(porMedio.cheque)}</span>
                        </>
                      ) : null}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
            {anulados.length > 0 ? (
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {anulados.map((r) => (
                  <li key={r.loteId}>
                    Recibo N° {r.numero} {r.anulado ? "anulado" : "con una línea anulada"}
                    {r.motivoAnulacion ? `: ${r.motivoAnulacion}` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          {/* Cheques */}
          {cheques.length > 0 ? (
            <section className="break-inside-avoid space-y-2">
              <Titulo>Cheques recibidos</Titulo>
              {chequesEnCaja.length > 0 ? (
                <table className={TABLA}>
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th>N°</th>
                      <th className={SOLO_ANCHO}>CUIT</th>
                      <th>Recibido de</th>
                      <th className={SOLO_ANCHO}>Se cobra desde</th>
                      <th className="text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chequesEnCaja.map((c, i) => (
                      <tr key={`${c.numero}-${i}`} className="border-b border-dashed">
                        <td className="tabular">
                          {c.numero}
                          <span className={`${SOLO_CELULAR} whitespace-nowrap`}>CUIT {formatCuit(c.cuit)}</span>
                        </td>
                        <td className={`${SOLO_ANCHO} whitespace-nowrap tabular`}>{formatCuit(c.cuit)}</td>
                        <td className="break-words">
                          {c.recibidoDe ?? c.cliente}
                          <span className={SOLO_CELULAR}>Se cobra desde {formatFecha(c.fechaCobro)}</span>
                        </td>
                        <td className={`${SOLO_ANCHO} whitespace-nowrap tabular`}>{formatFecha(c.fechaCobro)}</td>
                        <td className="text-right whitespace-nowrap tabular">{formatARS(c.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
              {chequesEntregados.length > 0 ? (
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">Entregados a proveedores en el acto (no están en la caja):</p>
                  <ul>
                    {chequesEntregados.map((c, i) => (
                      <li key={`${c.numero}-${i}`} className="break-words">
                        <span className="whitespace-nowrap">Cheque N° {c.numero}</span> ·{" "}
                        <span className="whitespace-nowrap">CUIT {formatCuit(c.cuit)}</span> · a {c.proveedor ?? "—"} ·{" "}
                        <span className="whitespace-nowrap tabular">{formatARS(c.monto)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : null}

          {/* Bono camioneros por tarifa */}
          {porteria ? (
            <section className="break-inside-avoid space-y-2">
              <Titulo>Bono camioneros (canon de transporte)</Titulo>
              {tarifas.length === 0 ? (
                <p className="text-sm text-muted-foreground">No entró ningún vehículo.</p>
              ) : (
                <table className={TABLA}>
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th>Tarifa</th>
                      <th className={`${SOLO_ANCHO} text-right`}>Cobros</th>
                      <th className={`${SOLO_ANCHO} text-right`}>Cantidad</th>
                      <th className="text-right">Efectivo</th>
                      <th className="text-right">Transferencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tarifas.map((t) => {
                      const cantidad = `${t.cantidad} ${t.unidad === "dia" ? (t.cantidad === 1 ? "día" : "días") : t.cantidad === 1 ? "vehículo" : "vehículos"}`;
                      return (
                        <tr key={`${t.nombre}-${t.unidad}`} className="border-b border-dashed">
                          <td className="break-words">
                            {t.nombre}
                            <span className={SOLO_CELULAR}>
                              {t.entradas} {t.entradas === 1 ? "cobro" : "cobros"} · {cantidad}
                            </span>
                          </td>
                          <td className={`${SOLO_ANCHO} text-right tabular`}>{t.entradas}</td>
                          <td className={`${SOLO_ANCHO} text-right whitespace-nowrap tabular`}>{cantidad}</td>
                          <td className="text-right whitespace-nowrap tabular">{formatARS(t.efectivo)}</td>
                          <td className="text-right whitespace-nowrap tabular">{formatARS(t.transferencia)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {canonAnulados.length > 0 ? (
                <ul className="space-y-0.5 text-xs text-muted-foreground">
                  {canonAnulados.map((e) => (
                    <li key={e.id} className="break-words">
                      N° {e.numero} anulado ({e.tarifa_nombre ?? "Canon"} · {formatARS(e.monto)})
                      {e.motivo_anulacion ? `: ${e.motivo_anulacion}` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          {/* Cajas de portería recibidas */}
          {datos.rendidas.length > 0 ? (
            <section className="break-inside-avoid space-y-2">
              <Titulo>Cajas de portería recibidas</Titulo>
              <table className={TABLA}>
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th>Día</th>
                    <th className={`${SOLO_ANCHO} text-right`}>Quintas</th>
                    <th className={`${SOLO_ANCHO} text-right`}>Ambulantes</th>
                    <th className={`${SOLO_ANCHO} text-right`}>Bono camioneros</th>
                    <th className="text-right">En mano</th>
                    <th className="text-right">Transferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.rendidas.map((r) => (
                    <tr key={r.id} className="border-b border-dashed">
                      <td className="tabular">
                        {formatFecha(r.fecha)}
                        <span className={SOLO_CELULAR}>
                          <span className="whitespace-nowrap">Quintas {formatARS(r.total_quintas)}</span> ·{" "}
                          <span className="whitespace-nowrap">Ambulantes {formatARS(r.total_ambulantes)}</span> ·{" "}
                          <span className="whitespace-nowrap">Bono camioneros {formatARS(r.total_canon)}</span>
                        </span>
                      </td>
                      <td className={`${SOLO_ANCHO} text-right whitespace-nowrap tabular`}>{formatARS(r.total_quintas)}</td>
                      <td className={`${SOLO_ANCHO} text-right whitespace-nowrap tabular`}>{formatARS(r.total_ambulantes)}</td>
                      <td className={`${SOLO_ANCHO} text-right whitespace-nowrap tabular`}>{formatARS(r.total_canon)}</td>
                      <td className="text-right whitespace-nowrap tabular">{formatARS(r.total_efectivo)}</td>
                      <td className="text-right whitespace-nowrap tabular">{formatARS(r.total_transferencia)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          {/* Gastos y ajustes */}
          {datos.gastos.length > 0 || datos.ajustes.length > 0 ? (
            <section className="break-inside-avoid space-y-3">
              <Titulo>Gastos y ajustes</Titulo>
              {datos.gastos.length > 0 ? (
                <table className={TABLA}>
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th>Gasto pagado desde la caja</th>
                      <th className={SOLO_ANCHO}>Pagó</th>
                      <th className="text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.gastos.map((g) => {
                      const pago = `${g.pagadoPorNombre ?? "—"}${g.pagadoEn ? ` · ${fechaHora(g.pagadoEn)}` : ""}`;
                      return (
                        <tr key={g.id} className="border-b border-dashed">
                          <td className="break-words">
                            {g.descripcion}
                            {g.despuesDelCierre ? " (después del cierre)" : ""}
                            <span className={SOLO_CELULAR}>Pagó {pago}</span>
                          </td>
                          <td className={SOLO_ANCHO}>{pago}</td>
                          <td className="text-right whitespace-nowrap tabular">−{formatARS(g.monto)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : null}
              {datos.ajustes.length > 0 ? (
                <table className={TABLA}>
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th>Ajuste de tesorería</th>
                      <th className={SOLO_ANCHO}>Cargó</th>
                      <th className="text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.ajustes.map((a) => {
                      const cargo = `${a.creadoPorNombre ?? "—"} · ${fechaHora(a.creadoEn)}`;
                      return (
                        <tr key={a.id} className="border-b border-dashed">
                          <td className="break-words">
                            {a.monto < 0 ? "Faltante" : "Sobrante"} {a.cuenta === "efectivo" ? "en efectivo" : "en el banco"}
                            {a.descripcion ? ` — ${montosSinCortar(a.descripcion)}` : ""}
                            <span className={SOLO_CELULAR}>Cargó {cargo}</span>
                          </td>
                          <td className={SOLO_ANCHO}>{cargo}</td>
                          <td className="text-right whitespace-nowrap tabular">
                            {a.monto < 0 ? "−" : "+"}
                            {formatARS(Math.abs(a.monto))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : null}
            </section>
          ) : null}

          {/* Firmas */}
          <section className="break-inside-avoid grid grid-cols-2 gap-10 pt-8">
            <div className="text-center">
              <div className="border-t border-foreground pt-1.5 text-sm">Entregó</div>
              <p className="text-xs text-muted-foreground">
                {porteria ? "Jefe de Portería" : "Administración"} — firma y aclaración
              </p>
            </div>
            <div className="text-center">
              <div className="border-t border-foreground pt-1.5 text-sm">Recibió</div>
              <p className="text-xs text-muted-foreground">
                {porteria ? "Administración" : "Tesorería"} — firma y aclaración
              </p>
            </div>
          </section>

          {/* Bitácora */}
          {datos.eventos.length > 0 ? (
            <section className="space-y-2">
              <Titulo>Historial de la caja</Titulo>
              <ol className="space-y-0.5 text-xs">
                {datos.eventos.map((e) => (
                  <li key={e.id} className="break-inside-avoid break-words">
                    <span className="tabular whitespace-nowrap text-muted-foreground">{fechaHora(e.creado_en)}</span> ·{" "}
                    <span className="font-semibold">{LABEL_EVENTO[e.tipo] ?? e.tipo}</span>
                    {e.detalle ? ` — ${montosSinCortar(e.detalle)}` : ""}
                    {e.usuario ? ` (${e.usuario})` : ""}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <p className="border-t pt-3 text-center text-xs text-muted-foreground">
            Comprobante interno — sin validez fiscal
          </p>
        </div>
      </div>
    </>
  );
}
