import Link from "next/link";
import { CalendarClock, ChevronDown, Plus, Receipt, Settings, Shuffle, X } from "lucide-react";
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
import { FilaGasto, type GastoFila } from "@/components/gastos/fila-gasto";
import { FiltroTipo, type FiltroTipoGasto } from "@/components/gastos/filtro-tipo";
import { GrupoPlegable } from "@/components/gastos/grupo-plegable";
import { cargarCajasElegibles } from "@/components/gastos/datos";
import {
  delDia,
  diasEntre,
  etiquetaGasto,
  type Rubro,
} from "@/components/gastos/tipos";

export const metadata = { title: "Gastos" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COLUMNAS_GASTO =
  "id, descripcion, tipo, automatico, monto, estado, vencimiento, periodo, fecha_pago, medio_pago, pagado_desde, pagado_por, pagado_en, factura_path, comprobante_validado, notas, pago_revertido_por, pago_revertido_en, pago_revertido_motivo, rubro:rubros_gasto(codigo, nombre), caja:cajas(fecha)";

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
  // En el mes actual se ven también los impagos de meses anteriores: no quedan escondidos.
  const esMesActual = periodo === periodoActual();
  const hoy = hoyISO();
  // Tesorería paga casi siempre desde el banco; Administración y el Líder, de la caja.
  const preferirCaja = perfil.rol !== "tesoreria";
  const puedeOperar = true; // admin, tesorería y el Líder (§1.3) operan todo.
  // Un pago con cheque se deshace en Cheques, que ven Tesorería y el Líder.
  const verCheques = perfil.rol === "tesoreria" || perfil.rol === "lider";

  // Los administra Administración y el Líder (Configuración → Rubros de gasto).
  const puedeConfigurar = perfil.rol === "admin" || perfil.rol === "lider";

  const supabase = await createClient();
  // Los fijos del mes se cargan solos (tarea programada del día 1, 0037). Por si todavía no
  // corrió, o se configuró un fijo hoy, la pantalla los carga al abrirse: nunca duplica.
  if (esMesActual) {
    const { error: errorFijos } = await supabase.rpc("generar_gastos_fijos");
    if (errorFijos) console.error("generar_gastos_fijos", errorFijos.message);
  }
  const [gastosRes, rubrosRes, usoRes, cajas, impagosRes, pagadosHoyAntRes] = await Promise.all([
    supabase.from("gastos").select(COLUMNAS_GASTO).eq("periodo", periodo),
    supabase
      .from("rubros_gasto")
      .select("id, codigo, nombre, tipo, monto_fijo, dia_vencimiento, fijo_desde")
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("gastos")
      .select("rubro_id, periodo")
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
  const rubrosConfig = rubrosRes.data ?? [];
  const rubros: Rubro[] = rubrosConfig.map((r) => ({ id: r.id, codigo: r.codigo, nombre: r.nombre, tipo: r.tipo }));

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
    automatico: g.automatico,
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

  // Rubros más usados en los últimos meses (arriba en el selector).
  const uso = new Map<string, number>();
  for (const u of usoRes.data ?? []) uso.set(u.rubro_id, (uso.get(u.rubro_id) ?? 0) + 1);
  const frecuentes = [...uso.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, 8);

  // Fijos (se cargan solos) y variables (se imputan cuando pasan), para el panel del mes.
  const rubrosFijos = rubrosConfig.filter((r) => r.tipo === "fijo");
  const fijosDelMes = filas.filter((g) => g.automatico && g.estado !== "anulado");
  const esFuturo = periodo > periodoActual();
  const totalPorRubro = new Map<string, number>();
  for (const g of filas) {
    if (g.estado === "anulado" || !g.rubroCodigo) continue;
    totalPorRubro.set(g.rubroCodigo, redondear2((totalPorRubro.get(g.rubroCodigo) ?? 0) + g.monto));
  }
  // Los variables más usados en los meses anteriores primero (un orden que no cambia al
  // cargar: el botón no se mueve bajo el dedo); después, por nombre.
  const usoPrevio = new Map<string, number>();
  for (const u of usoRes.data ?? []) {
    if (u.periodo < periodo) usoPrevio.set(u.rubro_id, (usoPrevio.get(u.rubro_id) ?? 0) + 1);
  }
  const variables = rubros
    .filter((r) => r.tipo !== "fijo")
    .sort((a, b) => (usoPrevio.get(b.id) ?? 0) - (usoPrevio.get(a.id) ?? 0) || a.nombre.localeCompare(b.nombre));
  const VARIABLES_A_LA_VISTA = 10;

  // Cada fijo configurado y qué pasó con él en el mes que se mira.
  const estadoFijo = (r: (typeof rubrosFijos)[number]): string => {
    const delRubro = filas.filter((g) => g.rubroCodigo === r.codigo);
    const auto = delRubro.find((g) => g.automatico);
    const aMano = delRubro.find((g) => !g.automatico && g.tipo === "fijo" && g.estado !== "anulado");
    if (auto?.estado === "pagado") return "Pagado";
    if (auto?.estado === "pendiente") return "Por pagar";
    if (auto?.estado === "anulado") return "Anulado";
    if (aMano) return aMano.estado === "pagado" ? "Pagado (cargado a mano)" : "Cargado a mano";
    if (r.fijo_desde && r.fijo_desde > periodo) return `Desde ${labelPeriodo(r.fijo_desde).toLowerCase()}`;
    if (esFuturo) return "Se carga el 1°";
    return "No se cargó";
  };
  // Para avisar en «Cargar gasto» si ese fijo ya se cargó solo este mes (no duplicarlo).
  const fijosCargados: Record<string, { monto: number; vencimiento: string | null; estado: string }> = {};
  for (const g of filas) {
    if (!g.automatico || g.estado === "anulado" || !g.rubroCodigo) continue;
    const r = rubros.find((x) => x.codigo === g.rubroCodigo);
    if (r) fijosCargados[r.id] = { monto: g.monto, vencimiento: g.vencimiento, estado: g.estado };
  }

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
  const mesEnFrase = labelPeriodo(periodo).toLowerCase();
  const propsDialogo = {
    rubros,
    frecuentes,
    periodo,
    cajas,
    hoy,
    preferirCaja,
    cajaPreseleccionadaId: cajaPreseleccionada?.id ?? null,
    fijosCargados,
    puedeConfigurar,
  };
  const chipVariable = (r: Rubro) => {
    const total = totalPorRubro.get(r.codigo) ?? 0;
    return (
      <li key={r.id}>
        <DialogNuevoGasto
          {...propsDialogo}
          rubroInicial={{ ...r, tipo: "variable" }}
          trigger={
            <button
              type="button"
              className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-semibold transition-colors hover:border-primary/40 hover:bg-accent active:scale-[0.98]"
              aria-label={`Cargar un gasto de ${r.nombre}${total > 0 ? ` (lleva ${formatARS(total)} en ${mesEnFrase})` : ""}`}
            >
              <Plus className="size-4 shrink-0 text-primary" strokeWidth={2.4} />
              <span className="truncate">{r.nombre}</span>
              {total > 0 ? <span className="shrink-0 font-medium text-muted-foreground tabular">{formatARS(total)}</span> : null}
            </button>
          }
        />
      </li>
    );
  };

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
        <DialogNuevoGasto key={cajaPreseleccionada?.id ?? "sin-caja"} {...propsDialogo} />
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

      {/* Los fijos se cargan solos; los variables se imputan a medida que pasan. */}
      <section
        aria-label="Fijos y variables del mes"
        className="grid overflow-hidden rounded-xl border bg-card lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
        data-tour="gastos-fijos-variables"
      >
        <div className="space-y-2 border-b p-4 sm:p-5 lg:border-r lg:border-b-0" data-tour="gastos-fijos">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <CalendarClock className="size-5 text-primary" strokeWidth={2} />
            Fijos: se cargan solos
          </h2>
          {rubrosFijos.length === 0 ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {puedeConfigurar
                ? "Todavía no hay rubros fijos. Marcá como fijo lo que se paga todos los meses (el alquiler, internet, los sueldos) con su monto y el día que vence, y aparece solo el 1° de cada mes, listo para pagar."
                : "Todavía no hay rubros fijos. Cuando Administración o el Líder marquen uno como fijo, con su monto y el día que vence, aparece solo acá el 1° de cada mes, listo para pagar."}
            </p>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {esFuturo
                  ? `El 1° de ${labelPeriodo(periodo).toLowerCase()} se cargan solos, con su monto y su vencimiento.`
                  : fijosDelMes.length > 0
                    ? `Se cargaron solos en ${labelPeriodo(periodo).toLowerCase()}: están en la lista, con su vencimiento, para pagarlos como cualquier gasto.`
                    : esMesActual
                      ? "Este mes los fijos no se cargaron solos (ya estaban cargados a mano, o empiezan el mes que viene)."
                      : `En ${labelPeriodo(periodo).toLowerCase()} los fijos todavía no se cargaban solos.`}
              </p>
              <ul className="divide-y rounded-lg border bg-background text-sm" data-tour="gastos-fijos-lista">
                {rubrosFijos.map((r) => {
                  const estado = estadoFijo(r);
                  return (
                    <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-2">
                      <span className="min-w-0 font-medium break-words">{r.nombre}</span>
                      <span className="text-muted-foreground tabular">
                        {formatARS(Number(r.monto_fijo ?? 0))} · vence el {r.dia_vencimiento} ·{" "}
                        <span
                          className={
                            estado === "Por pagar"
                              ? "font-semibold text-pendiente"
                              : estado.startsWith("Pagado")
                                ? "font-semibold text-pagado"
                                : "font-medium text-foreground"
                          }
                        >
                          {estado}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {puedeConfigurar ? (
            <Button asChild variant="outline" className="h-11 gap-2 px-4 text-base">
              <Link href="/configuracion?tab=rubros" data-tour="gastos-configurar-fijos">
                <Settings className="size-4" strokeWidth={2} />
                {rubrosFijos.length === 0 ? "Configurar los fijos" : "Cambiar los fijos"}
              </Link>
            </Button>
          ) : null}
        </div>
        <div className="space-y-3 p-4 sm:p-5" data-tour="gastos-variables">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <Shuffle className="size-5 text-primary" strokeWidth={2} />
              Variables: cargalos cuando pasan
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Tocá el rubro, poné el monto y listo. Al lado de cada uno ves lo que lleva {labelPeriodo(periodo).toLowerCase()}.
            </p>
          </div>
          {variables.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todos los rubros son fijos: para otro gasto, usá «Cargar gasto».</p>
          ) : (
            <>
              <ul className="flex flex-wrap gap-2">
                {variables.slice(0, VARIABLES_A_LA_VISTA).map(chipVariable)}
              </ul>
              {variables.length > VARIABLES_A_LA_VISTA ? (
                <details className="group">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-base font-medium text-primary">
                    <ChevronDown className="size-4 transition-transform group-open:rotate-180" strokeWidth={2} />
                    Ver los otros {variables.length - VARIABLES_A_LA_VISTA} rubros
                  </summary>
                  <ul className="flex flex-wrap gap-2 pt-2">
                    {variables.slice(VARIABLES_A_LA_VISTA).map(chipVariable)}
                  </ul>
                </details>
              ) : null}
            </>
          )}
        </div>
      </section>

      {filas.length === 0 ? (
        <EmptyState
          icono={Receipt}
          titulo={`Todavía no hay gastos en ${labelPeriodo(periodo)}`}
          descripcion={
            esFuturo && rubrosFijos.length > 0
              ? `Los fijos aparecen solos el 1° de ${labelPeriodo(periodo).toLowerCase()}. Si ya sabés de un gasto, cargalo con «Cargar gasto».`
              : "Cargá el primero con «Cargar gasto» o tocando un rubro en «Variables». Los fijos se cargan solos el 1° de cada mes."
          }
        />
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
