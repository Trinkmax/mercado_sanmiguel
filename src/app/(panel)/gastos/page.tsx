import Link from "next/link";
import { ChevronDown, Receipt, X } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  TZ_AR,
  formatARS,
  hoyISO,
  labelPeriodo,
  periodoActual,
  redondear2,
  sumarMeses,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { BotonExportar } from "@/components/shared/boton-exportar";
import { SelectorMes } from "@/components/gastos/selector-mes";
import { DialogNuevoGasto } from "@/components/gastos/dialog-nuevo-gasto";
import { TraerFijos, type FijoParaTraer } from "@/components/gastos/traer-fijos";
import { FilaGasto, type GastoFila } from "@/components/gastos/fila-gasto";
import { FiltroTipo, type FiltroTipoGasto } from "@/components/gastos/filtro-tipo";
import { GrupoPlegable } from "@/components/gastos/grupo-plegable";
import { cargarCajasElegibles } from "@/components/gastos/datos";
import {
  delDia,
  diasEntre,
  etiquetaGasto,
  sumarUnMes,
} from "@/components/gastos/tipos";

export const metadata = { title: "Gastos" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COLUMNAS_GASTO =
  "id, descripcion, tipo, monto, estado, vencimiento, periodo, fecha_pago, medio_pago, pagado_desde, pagado_por, pagado_en, factura_path, comprobante_validado, notas, origen_id, pago_revertido_por, pago_revertido_en, pago_revertido_motivo, rubro:rubros_gasto(codigo, nombre), caja:cajas(fecha)";

/** "YYYY-MM-DD" (Argentina) de un momento: ¿el pago se registró hoy? */
const diaAR = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ_AR,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function GrupoGastos({
  titulo,
  detalle,
  children,
}: {
  titulo: string;
  detalle: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3" aria-label={titulo}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-lg font-bold tracking-tight">{titulo}</h2>
        <p className="text-sm text-muted-foreground">{detalle}</p>
      </div>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">{children}</ul>
    </section>
  );
}

export default async function GastosPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; tipo?: string; caja?: string }>;
}) {
  const perfil = await requireRol("admin", "tesoreria", "lider");
  const sp = await searchParams;
  const periodo = /^\d{4}-\d{2}-01$/.test(sp.periodo ?? "") ? sp.periodo! : periodoActual();
  const filtro: FiltroTipoGasto =
    sp.tipo === "fijo" || sp.tipo === "variable" ? sp.tipo : "todos";
  const cajaParam = UUID.test(sp.caja ?? "") ? sp.caja! : null;
  const mesAnterior = sumarMeses(periodo, -1);
  // En el mes actual se ven también los impagos de meses anteriores: no quedan escondidos.
  const esMesActual = periodo === periodoActual();
  const hoy = hoyISO();
  // Tesorería paga casi siempre desde el banco; Administración y el Líder, de la caja.
  const preferirCaja = perfil.rol !== "tesoreria";
  const puedeOperar = true; // admin, tesorería y el Líder (§1.3) operan todo.
  // Un pago con cheque se deshace en Cheques, que ven Tesorería y el Líder.
  const verCheques = perfil.rol === "tesoreria" || perfil.rol === "lider";

  const supabase = await createClient();
  const [gastosRes, rubrosRes, anterioresRes, usoRes, cajas, impagosRes, pagadosHoyAntRes] = await Promise.all([
    supabase.from("gastos").select(COLUMNAS_GASTO).eq("periodo", periodo),
    supabase.from("rubros_gasto").select("id, codigo, nombre").eq("activo", true).order("nombre"),
    supabase
      .from("gastos")
      .select("id, descripcion, monto, vencimiento, rubro:rubros_gasto(codigo, nombre)")
      .eq("periodo", mesAnterior)
      .eq("tipo", "fijo")
      .neq("estado", "anulado")
      .order("vencimiento", { ascending: true, nullsFirst: false }),
    supabase
      .from("gastos")
      .select("rubro_id")
      .gte("periodo", sumarMeses(periodo, -3))
      .lte("periodo", periodo)
      .limit(2000),
    cargarCajasElegibles(supabase, perfil.rol, hoy),
    esMesActual
      ? supabase
          .from("gastos")
          .select(COLUMNAS_GASTO)
          .eq("estado", "pendiente")
          .lt("periodo", periodo)
          .order("periodo", { ascending: true })
          .order("vencimiento", { ascending: true, nullsFirst: false })
          .limit(300)
      : null,
    // Los de meses anteriores que se pagaron hoy siguen en su lugar hasta mañana: el
    // paso siguiente a pagar es adjuntar la factura, y así no desaparecen de la página.
    esMesActual
      ? supabase
          .from("gastos")
          .select(COLUMNAS_GASTO)
          .eq("estado", "pagado")
          .lt("periodo", periodo)
          .gte("pagado_en", `${hoy}T00:00:00-03:00`)
          .limit(100)
      : null,
  ]);

  const gastos = gastosRes.data ?? [];
  // Impagos de meses anteriores y los que se pagaron hoy, en el orden de la lista (mes y
  // vencimiento): el que se acaba de pagar no cambia de lugar.
  const deMesesAnteriores = [...(impagosRes?.data ?? []), ...(pagadosHoyAntRes?.data ?? [])].sort(
    (a, b) =>
      a.periodo.localeCompare(b.periodo) ||
      (a.vencimiento ?? "9999-12-31").localeCompare(b.vencimiento ?? "9999-12-31")
  );
  const rubros = rubrosRes.data ?? [];

  // Cheques que pagaron gastos de la lista ("Cheque N° 123 a Frutas del Sur").
  const idsConCheque = [...gastos, ...deMesesAnteriores]
    .filter((g) => g.pagado_desde === "cheque")
    .map((g) => g.id);
  const usuarios = [
    ...new Set(
      [...gastos, ...deMesesAnteriores]
        .flatMap((g) => [g.pagado_por, g.pago_revertido_por])
        .filter((x): x is string => Boolean(x))
    ),
  ];
  const [chequesRes, perfilesRes] = await Promise.all([
    idsConCheque.length
      ? supabase
          .from("cheques")
          .select("numero, proveedor, gasto_id")
          .in("gasto_id", idsConCheque)
          .eq("estado", "entregado")
      : Promise.resolve({ data: [] as { numero: string; proveedor: string | null; gasto_id: string | null }[] }),
    usuarios.length
      ? supabase.from("perfiles").select("user_id, nombre").in("user_id", usuarios)
      : Promise.resolve({ data: [] as { user_id: string; nombre: string }[] }),
  ]);
  const chequePorGasto = new Map((chequesRes.data ?? []).map((c) => [c.gasto_id, c]));
  const nombre = new Map((perfilesRes.data ?? []).map((p) => [p.user_id, p.nombre]));

  // Facturas: link firmado (1 h).
  const urls = new Map<string, string>();
  const paths = [...gastos, ...deMesesAnteriores]
    .map((g) => g.factura_path)
    .filter((p): p is string => Boolean(p));
  if (paths.length > 0) {
    const { data: firmadas } = await supabase.storage.from("documentos").createSignedUrls(paths, 3600);
    for (const f of firmadas ?? []) if (f.path && f.signedUrl) urls.set(f.path, f.signedUrl);
  }

  const aFila = (g: (typeof gastos)[number], conMes = false): GastoFila => ({
    id: g.id,
    etiqueta: etiquetaGasto(g.descripcion, g.rubro?.nombre),
    sinDescripcion: !g.descripcion?.trim(),
    rubroCodigo: g.rubro?.codigo ?? null,
    rubroNombre: g.rubro?.nombre ?? null,
    tipo: g.tipo,
    monto: Number(g.monto),
    estado: g.estado,
    vencimiento: g.vencimiento,
    fechaPago: g.fecha_pago,
    pagadoEn: g.pagado_en,
    medioPago: g.medio_pago,
    pagadoDesde: g.pagado_desde,
    cajaFecha: g.caja?.fecha ?? null,
    cheque: chequePorGasto.get(g.id) ?? null,
    pagadoPor: g.pagado_por ? nombre.get(g.pagado_por) ?? null : null,
    notas: g.notas,
    facturaPath: g.factura_path,
    facturaUrl: g.factura_path ? urls.get(g.factura_path) ?? null : null,
    comprobanteValidado: g.comprobante_validado,
    revertido:
      g.pago_revertido_en && g.pago_revertido_motivo
        ? {
            por: (g.pago_revertido_por && nombre.get(g.pago_revertido_por)) || "alguien del equipo",
            en: g.pago_revertido_en,
            motivo: g.pago_revertido_motivo,
          }
        : null,
    mes: conMes ? labelPeriodo(g.periodo) : null,
  });
  const filas: GastoFila[] = gastos.map((g) => aFila(g));
  const filasAnteriores: GastoFila[] = deMesesAnteriores.map((g) => aFila(g, true));
  // Solo los impagos cuentan en los totales y en "vencen en los próximos 7 días".
  const anteriores = filasAnteriores.filter((g) => g.estado === "pendiente");
  const pagadosHoyAnteriores = filasAnteriores.length - anteriores.length;

  // Fijos del mes anterior que todavía no se trajeron (E3).
  const yaTraidos = new Set(
    gastos.filter((g) => g.origen_id && g.estado !== "anulado").map((g) => g.origen_id)
  );
  const fijosParaTraer: FijoParaTraer[] = (anterioresRes.data ?? [])
    .filter((g) => !yaTraidos.has(g.id))
    .map((g) => ({
      id: g.id,
      etiqueta: etiquetaGasto(g.descripcion, g.rubro?.nombre),
      descripcion: g.descripcion,
      rubroCodigo: g.rubro?.codigo ?? null,
      rubroNombre: g.rubro?.nombre ?? null,
      monto: Number(g.monto),
      vencimientoSugerido: g.vencimiento ? sumarUnMes(g.vencimiento) : null,
    }));

  // Rubros más usados en los últimos meses (arriba en el selector).
  const uso = new Map<string, number>();
  for (const u of usoRes.data ?? []) uso.set(u.rubro_id, (uso.get(u.rubro_id) ?? 0) + 1);
  const frecuentes = [...uso.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, 8);

  const conteos: Record<FiltroTipoGasto, number> = {
    todos: filas.filter((g) => g.estado !== "anulado").length,
    fijo: filas.filter((g) => g.estado !== "anulado" && g.tipo === "fijo").length,
    variable: filas.filter((g) => g.estado !== "anulado" && g.tipo === "variable").length,
  };
  const visibles = filtro === "todos" ? filas : filas.filter((g) => g.tipo === filtro);

  const porPagar = visibles
    .filter((g) => g.estado === "pendiente")
    .sort((a, b) => (a.vencimiento ?? "9999-12-31").localeCompare(b.vencimiento ?? "9999-12-31"));
  const pagados = visibles
    .filter((g) => g.estado === "pagado")
    .sort((a, b) => (b.fechaPago ?? "").localeCompare(a.fechaPago ?? ""));
  const anulados = visibles.filter((g) => g.estado === "anulado");
  const pagadosSinFactura = pagados.filter((g) => !g.facturaPath).length;
  // Lo pagado hoy (el último arriba) queda a la vista aunque Pagados esté cerrado: el
  // paso siguiente a pagar es adjuntar la factura. El resto se pliega.
  const esDeHoy = (g: GastoFila) => g.pagadoEn !== null && diaAR.format(new Date(g.pagadoEn)) === hoy;
  const pagadosHoy = pagados
    .filter(esDeHoy)
    .sort((a, b) => (b.pagadoEn ?? "").localeCompare(a.pagadoEn ?? ""));
  const pagadosAntes = pagados.filter((g) => !esDeHoy(g));

  // Redondeado al centavo (sin el ruido de la coma flotante): el total es la suma exacta
  // de las filas, y con formatARS lleva centavos solo si alguna fila los tiene.
  const suma = (l: GastoFila[]) => redondear2(l.reduce((acc, g) => acc + g.monto, 0));
  const pendientesMes = filas.filter((g) => g.estado === "pendiente");
  const vencidos = pendientesMes.filter((g) => g.vencimiento && g.vencimiento < hoy);
  // "Vencen en los próximos 7 días" solo tiene sentido si esos días caen en el mes que se
  // mira: el actual (con sus impagos de antes) o el que viene si empieza en estos días.
  // En un mes que ya pasó diría "Ninguno" aunque todo esté vencido.
  const mostrarSemana = esMesActual || (periodo > periodoActual() && diasEntre(hoy, periodo) <= 7);
  const semana = [...pendientesMes, ...anteriores].filter(
    (g) => g.vencimiento && g.vencimiento >= hoy && diasEntre(hoy, g.vencimiento) <= 7
  );
  const totalPorPagar = suma(pendientesMes);
  const totalAnteriores = suma(anteriores);
  const totalPagado = suma(filas.filter((g) => g.estado === "pagado"));

  const cajaPreseleccionada = cajaParam ? cajas.find((c) => c.id === cajaParam) ?? null : null;
  const hrefBase = [`periodo=${periodo}`, cajaPreseleccionada ? `caja=${cajaPreseleccionada.id}` : ""]
    .filter(Boolean)
    .join("&");

  const filaProps = {
    hoy,
    puedeOperar,
    verCheques,
    cajas,
    preferirCaja,
    cajaPreseleccionadaId: cajaPreseleccionada?.id ?? null,
  };
  const filaGasto = (g: GastoFila) => <FilaGasto key={g.id} g={g} {...filaProps} />;
  const detallePagados = (
    <>
      {pagados.length} · <Money monto={suma(pagados)} className="font-semibold text-foreground" />
      {pagadosSinFactura > 0 ? (
        <span className="font-medium text-pendiente"> · {pagadosSinFactura} sin factura</span>
      ) : null}
    </>
  );
  const textoPagadosHoyAnt =
    pagadosHoyAnteriores === 1 ? "1 pago anotado hoy" : `${pagadosHoyAnteriores} pagos anotados hoy`;
  const detalleAnteriores =
    pagadosHoyAnteriores === 0 ? (
      <>
        {anteriores.length} · <Money monto={totalAnteriores} className="font-semibold text-pendiente" />
      </>
    ) : anteriores.length === 0 ? (
      textoPagadosHoyAnt
    ) : (
      <>
        {anteriores.length} sin pagar ·{" "}
        <Money monto={totalAnteriores} className="font-semibold text-pendiente" /> · {textoPagadosHoyAnt}
      </>
    );

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Gastos"
        descripcion="Lo que paga el mercado, mes a mes: cargalo, pagalo desde la caja del día o desde Tesorería, y guardá la factura."
      >
        <BotonExportar dataset="gastos" periodo={periodo} />
        <DialogNuevoGasto
          key={cajaPreseleccionada?.id ?? "sin-caja"}
          rubros={rubros}
          frecuentes={frecuentes}
          periodo={periodo}
          cajas={cajas}
          hoy={hoy}
          preferirCaja={preferirCaja}
          cajaPreseleccionadaId={cajaPreseleccionada?.id ?? null}
        />
      </PageHeader>

      {gastosRes.error ? (
        <p role="alert" className="rounded-lg bg-pendiente-suave px-4 py-3 text-base font-medium text-pendiente">
          No se pudieron cargar los gastos de {labelPeriodo(periodo)}. Actualizá la página; si sigue
          pasando, avisale al Líder de Procesos.
        </p>
      ) : null}

      {cajaPreseleccionada ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-accent/60 px-5 py-4">
          <p className="min-w-0 flex-1 basis-64 text-base">
            <strong>Pagás desde la caja {delDia(cajaPreseleccionada.fecha, hoy)}.</strong> Tocá{" "}
            <em>Pagar</em> en el gasto que salió de esa caja, o <em>Cargar gasto</em> si todavía no
            está en la lista
            {cajaPreseleccionada.efectivo !== null
              ? ` (tiene ${formatARS(cajaPreseleccionada.efectivo)} en efectivo).`
              : "."}
          </p>
          <div className="flex shrink-0 gap-2">
            <Button asChild variant="outline" className="h-11 px-4 text-base">
              <Link href={`/caja?fecha=${cajaPreseleccionada.fecha}&tipo=administracion`}>Volver a la caja</Link>
            </Button>
            <Button asChild variant="ghost" className="h-11 px-3 text-base">
              <Link href={`/gastos?periodo=${periodo}`} aria-label="Dejar de pagar desde esa caja">
                <X className="size-4" strokeWidth={2} />
              </Link>
            </Button>
          </div>
        </div>
      ) : null}

      <div data-tour="gastos-resumen" className="flex flex-wrap items-center justify-between gap-4">
        <SelectorMes periodo={periodo} caja={cajaPreseleccionada?.id ?? null} />
        {/* Cada dato lleva su borde arriba y a la izquierda, y el recuadro recorta los que
            caen sobre el borde: cuando en el celular pasan a otra línea, ocupan todo el
            ancho y no queda un casillero vacío. */}
        <div className="w-full overflow-hidden rounded-xl border bg-card sm:w-auto">
          <dl className="-mt-px -ml-px flex flex-wrap">
            <div className="grow border-t border-l px-4 py-3 sm:px-5">
              <dt className="text-sm text-muted-foreground">Por pagar</dt>
              <dd>
                <Money
                  monto={totalPorPagar}
                  className={totalPorPagar > 0 ? "text-2xl font-bold text-pendiente" : "text-2xl font-bold"}
                />
              </dd>
              {vencidos.length > 0 ? (
                <dd className="text-sm font-medium text-pendiente">
                  {vencidos.length === 1 ? "1 vencido" : `${vencidos.length} vencidos`}
                </dd>
              ) : null}
              {anteriores.length > 0 ? (
                <dd className="text-sm font-medium text-pendiente">
                  y {formatARS(totalAnteriores)} de meses anteriores
                </dd>
              ) : null}
            </div>
            <div className="grow border-t border-l px-4 py-3 sm:px-5">
              <dt className="text-sm text-muted-foreground">Pagado</dt>
              <dd>
                <Money monto={totalPagado} className="text-xl font-bold text-pagado sm:text-2xl" />
              </dd>
            </div>
            {mostrarSemana ? (
              <div className="grow border-t border-l px-4 py-3 sm:px-5">
                {/* Como en Tesorería: de hoy (incluido) a 7 días. */}
                <dt className="text-sm text-muted-foreground">Vencen en los próximos 7 días</dt>
                <dd className="text-lg font-semibold tabular">
                  {semana.length === 0 ? "Ninguno" : `${semana.length} · ${formatARS(suma(semana))}`}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>

      {filasAnteriores.length > 0 ? (
        <GrupoGastos
          titulo={pagadosHoyAnteriores > 0 ? "De meses anteriores" : "De meses anteriores, sin pagar"}
          detalle={detalleAnteriores}
        >
          {filasAnteriores.map(filaGasto)}
        </GrupoGastos>
      ) : null}

      {fijosParaTraer.length > 0 && filas.length > 0 ? (
        <TraerFijos items={fijosParaTraer} mesOrigen={mesAnterior} mesDestino={periodo} hoy={hoy} />
      ) : null}

      {filas.length === 0 ? (
        fijosParaTraer.length > 0 ? (
          <div className="space-y-4">
            <EmptyState
              icono={Receipt}
              titulo={`Todavía no hay gastos en ${labelPeriodo(periodo)}`}
              descripcion="Empezá trayendo los fijos del mes anterior: revisás los montos y quedan cargados."
            />
            <TraerFijos
              items={fijosParaTraer}
              mesOrigen={mesAnterior}
              mesDestino={periodo}
              hoy={hoy}
              abiertoInicial
            />
          </div>
        ) : (
          <EmptyState
            icono={Receipt}
            titulo={`Todavía no hay gastos en ${labelPeriodo(periodo)}`}
            descripcion="Cargá el primero con «Cargar gasto». Los fijos, el mes que viene los traés con un toque."
          />
        )
      ) : (
        <div className="space-y-6">
          <FiltroTipo activo={filtro} conteos={conteos} hrefBase={hrefBase} />

          {porPagar.length > 0 ? (
            <GrupoGastos
              titulo="Por pagar"
              detalle={
                <>
                  {porPagar.length} · <Money monto={suma(porPagar)} className="font-semibold text-foreground" />
                </>
              }
            >
              {porPagar.map((g) => (
                <FilaGasto key={g.id} g={g} {...filaProps} />
              ))}
            </GrupoGastos>
          ) : (
            <p className="rounded-xl border border-dashed bg-card px-5 py-4 text-base text-muted-foreground">
              No queda nada por pagar{filtro !== "todos" ? " en este filtro" : ""} en {labelPeriodo(periodo)}
              {anteriores.length > 0 ? " (los de meses anteriores están arriba)" : ""}.
            </p>
          )}

          {pagados.length === 0 ? null : pagadosAntes.length === 0 ? (
            // Todo lo pagado es de hoy: no hay nada que plegar.
            <GrupoGastos titulo="Pagados" detalle={detallePagados}>
              {pagadosHoy.map(filaGasto)}
            </GrupoGastos>
          ) : (
            // Cerrado mientras haya algo por pagar: lo que se hace acá es pagar. Se abre
            // solo cuando ya no queda nada, y no se vuelve a cerrar solo.
            <GrupoPlegable
              key={`pagados-${periodo}-${filtro}`}
              titulo="Pagados"
              detalle={detallePagados}
              abrir={porPagar.length === 0}
              textoVer={
                pagadosHoy.length > 0
                  ? pagadosAntes.length === 1
                    ? "Ver el otro pagado"
                    : `Ver los otros ${pagadosAntes.length} pagados`
                  : pagadosAntes.length === 1
                    ? "Ver el pagado"
                    : `Ver los ${pagadosAntes.length} pagados`
              }
              // Abierto, el botón queda entre los de hoy y el resto: dice qué hay debajo.
              textoOcultar={
                pagadosHoy.length > 0
                  ? pagadosAntes.length === 1
                    ? "Ocultar el de otro día"
                    : "Ocultar los de otros días"
                  : "Ocultar"
              }
              aLaVista={
                pagadosHoy.length > 0
                  ? { rotulo: "Pagos anotados hoy", filas: pagadosHoy.map(filaGasto) }
                  : null
              }
            >
              {pagadosAntes.map(filaGasto)}
            </GrupoPlegable>
          )}

          {anulados.length > 0 ? (
            <Collapsible>
              <CollapsibleTrigger className="group flex min-h-11 items-center gap-2 text-base font-medium text-muted-foreground hover:text-foreground">
                <ChevronDown
                  className="size-4 transition-transform group-data-[state=open]:rotate-180"
                  strokeWidth={2}
                />
                {anulados.length === 1 ? "Ver 1 gasto anulado" : `Ver ${anulados.length} gastos anulados`}
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                  {anulados.map((g) => (
                    <FilaGasto key={g.id} g={g} {...filaProps} />
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          ) : null}

        </div>
      )}
    </div>
  );
}
