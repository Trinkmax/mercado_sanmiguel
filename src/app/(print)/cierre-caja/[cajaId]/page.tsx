import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPerfil, requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  formatARS,
  formatCuit,
  formatFecha,
  formatFechaHora,
  formatFechaLarga,
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

type Props = {
  params: Promise<{ cajaId: string }>;
  /** `auto=1`: imprimir al abrir. `ver=1`: solo mirar (nunca imprime sola, aunque esté la impresión directa). */
  searchParams: Promise<{ auto?: string | string[]; ver?: string | string[] }>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
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
  const impresoEn = formatFechaHora(new Date().toISOString());

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
          {/* Cabecera */}
          <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-foreground pb-4">
            <div className="space-y-1">
              <Marca />
              <p className="text-sm text-muted-foreground">
                {orgRes.data?.nombre ?? "Cooperativa Mercado San Miguel"} · Malagueño, Córdoba
              </p>
            </div>
            <div className="space-y-1 text-right">
              <p className="font-display text-xl font-semibold tracking-wide uppercase">
                {porteria ? "Rendición — Caja de portería" : "Cierre de caja — Administración"}
              </p>
              <p className="text-sm">{capitalizar(formatFechaLarga(caja.fecha))} de {caja.fecha.slice(0, 4)}</p>
              <div className="flex justify-end gap-2 pt-1">
                {caja.reapertura_solicitada_en ? <Sello estado="reapertura_pedida" /> : null}
                <Sello grande estado={caja.estado} />
              </div>
            </div>
          </header>

          <p className="text-xs text-muted-foreground">
            Impreso el {impresoEn} por {perfil.nombre}
            {caja.cerrada_en
              ? ` · ${porteria ? "Rendida" : "Cerrada"} el ${formatFechaHora(caja.cerrada_en)}${datos.nombres.cerrada ? ` por ${datos.nombres.cerrada}` : ""}`
              : ""}
            {caja.integrada_en ? ` · Recibida en la caja mayor el ${formatFechaHora(caja.integrada_en)}` : ""}
            {caja.validada_en
              ? ` · Validada el ${formatFechaHora(caja.validada_en)}${datos.nombres.validada ? ` por ${datos.nombres.validada}` : ""}`
              : ""}
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

          {/* Recuadro para contar a mano */}
          <section className="break-inside-avoid grid gap-4 rounded-md border-2 border-foreground p-4 sm:grid-cols-2">
            <p className="flex items-end gap-2">
              <span className="shrink-0 font-semibold">Efectivo contado $</span>
              <span className="mb-1 flex-1 border-b border-foreground" />
            </p>
            <p className="flex items-end gap-2">
              <span className="shrink-0 font-semibold">Diferencia $</span>
              <span className="mb-1 flex-1 border-b border-foreground" />
            </p>
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-1.5 font-medium">Hora</th>
                    <th className="py-1.5 font-medium">Recibo</th>
                    <th className="py-1.5 font-medium">Cliente</th>
                    <th className="py-1.5 font-medium">Medio</th>
                    <th className="py-1.5 text-right font-medium">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.recibos.flatMap((r) =>
                    r.lineas.map((l, i) => (
                      <tr
                        key={l.pagoId}
                        className={`break-inside-avoid ${i === r.lineas.length - 1 ? "border-b border-dashed" : ""} ${l.anulado ? "text-muted-foreground line-through" : ""}`}
                      >
                        <td className="py-1 tabular">{i === 0 ? formatSoloHora(r.fecha) : ""}</td>
                        <td className="py-1 tabular">{i === 0 ? `N° ${r.numero}` : ""}</td>
                        <td className="py-1">
                          {i === 0 ? `${r.cliente?.nombre ?? "—"}${r.cliente ? ` (${r.cliente.codigo})` : ""}` : ""}
                        </td>
                        <td className="py-1">
                          {labelMedio(l.medio)}
                          {l.cheque ? ` N° ${l.cheque.numero}` : ""}
                        </td>
                        <td className="py-1 text-right tabular">{formatARS(l.monto)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-foreground">
                    <td colSpan={5} className="pt-2 text-right">
                      Efectivo {formatARS(porMedio.efectivo)} · Transferencia {formatARS(porMedio.transferencia)}
                      {!porteria ? ` · Cheques ${formatARS(porMedio.cheque)}` : ""}
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
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-1.5 font-medium">N°</th>
                      <th className="py-1.5 font-medium">CUIT</th>
                      <th className="py-1.5 font-medium">Recibido de</th>
                      <th className="py-1.5 font-medium">Se cobra desde</th>
                      <th className="py-1.5 text-right font-medium">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chequesEnCaja.map((c, i) => (
                      <tr key={`${c.numero}-${i}`} className="border-b border-dashed">
                        <td className="py-1 tabular">{c.numero}</td>
                        <td className="py-1 tabular">{formatCuit(c.cuit)}</td>
                        <td className="py-1">{c.recibidoDe ?? c.cliente}</td>
                        <td className="py-1 tabular">{formatFecha(c.fechaCobro)}</td>
                        <td className="py-1 text-right tabular">{formatARS(c.monto)}</td>
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
                      <li key={`${c.numero}-${i}`}>
                        Cheque N° {c.numero} · CUIT {formatCuit(c.cuit)} · a {c.proveedor ?? "—"} · {formatARS(c.monto)}
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
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-1.5 font-medium">Tarifa</th>
                      <th className="py-1.5 text-right font-medium">Cobros</th>
                      <th className="py-1.5 text-right font-medium">Cantidad</th>
                      <th className="py-1.5 text-right font-medium">Efectivo</th>
                      <th className="py-1.5 text-right font-medium">Transferencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tarifas.map((t) => (
                      <tr key={`${t.nombre}-${t.unidad}`} className="border-b border-dashed">
                        <td className="py-1">{t.nombre}</td>
                        <td className="py-1 text-right tabular">{t.entradas}</td>
                        <td className="py-1 text-right tabular">
                          {t.cantidad} {t.unidad === "dia" ? (t.cantidad === 1 ? "día" : "días") : t.cantidad === 1 ? "vehículo" : "vehículos"}
                        </td>
                        <td className="py-1 text-right tabular">{formatARS(t.efectivo)}</td>
                        <td className="py-1 text-right tabular">{formatARS(t.transferencia)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {canonAnulados.length > 0 ? (
                <ul className="space-y-0.5 text-xs text-muted-foreground">
                  {canonAnulados.map((e) => (
                    <li key={e.id}>
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-1.5 font-medium">Día</th>
                    <th className="py-1.5 text-right font-medium">Quintas</th>
                    <th className="py-1.5 text-right font-medium">Ambulantes</th>
                    <th className="py-1.5 text-right font-medium">Bono camioneros</th>
                    <th className="py-1.5 text-right font-medium">En mano</th>
                    <th className="py-1.5 text-right font-medium">Transferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.rendidas.map((r) => (
                    <tr key={r.id} className="border-b border-dashed">
                      <td className="py-1 tabular">{formatFecha(r.fecha)}</td>
                      <td className="py-1 text-right tabular">{formatARS(r.total_quintas)}</td>
                      <td className="py-1 text-right tabular">{formatARS(r.total_ambulantes)}</td>
                      <td className="py-1 text-right tabular">{formatARS(r.total_canon)}</td>
                      <td className="py-1 text-right tabular">{formatARS(r.total_efectivo)}</td>
                      <td className="py-1 text-right tabular">{formatARS(r.total_transferencia)}</td>
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
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-1.5 font-medium">Gasto pagado desde la caja</th>
                      <th className="py-1.5 font-medium">Pagó</th>
                      <th className="py-1.5 text-right font-medium">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.gastos.map((g) => (
                      <tr key={g.id} className="border-b border-dashed">
                        <td className="py-1">
                          {g.descripcion}
                          {g.despuesDelCierre ? " (después del cierre)" : ""}
                        </td>
                        <td className="py-1">
                          {g.pagadoPorNombre ?? "—"}
                          {g.pagadoEn ? ` · ${formatFechaHora(g.pagadoEn)}` : ""}
                        </td>
                        <td className="py-1 text-right tabular">−{formatARS(g.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
              {datos.ajustes.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-1.5 font-medium">Ajuste de tesorería</th>
                      <th className="py-1.5 font-medium">Cargó</th>
                      <th className="py-1.5 text-right font-medium">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.ajustes.map((a) => (
                      <tr key={a.id} className="border-b border-dashed">
                        <td className="py-1">
                          {a.monto < 0 ? "Faltante" : "Sobrante"} {a.cuenta === "efectivo" ? "en efectivo" : "en el banco"}
                          {a.descripcion ? ` — ${a.descripcion}` : ""}
                        </td>
                        <td className="py-1">
                          {a.creadoPorNombre ?? "—"} · {formatFechaHora(a.creadoEn)}
                        </td>
                        <td className="py-1 text-right tabular">
                          {a.monto < 0 ? "−" : "+"}
                          {formatARS(Math.abs(a.monto))}
                        </td>
                      </tr>
                    ))}
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
                  <li key={e.id} className="break-inside-avoid">
                    <span className="tabular text-muted-foreground">{formatFechaHora(e.creado_en)}</span> ·{" "}
                    <span className="font-semibold">{LABEL_EVENTO[e.tipo] ?? e.tipo}</span>
                    {e.detalle ? ` — ${e.detalle}` : ""}
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
