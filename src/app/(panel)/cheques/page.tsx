import Link from "next/link";
import { ArrowRight, Banknote, Landmark, Link2, Search } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatARS, formatCuit, formatFecha, hoyISO, periodoActual, redondear2 } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { BotonExportar } from "@/components/shared/boton-exportar";
import { AccionesCheque } from "@/components/cheques/acciones-cheque";
import { DatosCheques } from "@/components/cheques/datos-cheques";
import {
  FiltroEstado,
  FILTROS_CHEQUES,
  hrefFiltroCheque,
  type FiltroCheque,
} from "@/components/cheques/filtro-estado";
import { cargarGastosPendientes } from "@/components/gastos/datos";
import { etiquetaGasto } from "@/components/gastos/tipos";

export const metadata = { title: "Cheques" };

const VACIOS: Record<FiltroCheque, { titulo: string; descripcion: string }> = {
  listos: {
    titulo: "No hay cheques listos para depositar",
    descripcion: "Los diferidos quedan por cobrar y pasan a esta lista cuando llega su fecha de cobro.",
  },
  en_cartera: {
    titulo: "No hay cheques por cobrar",
    descripcion: "Los cheques que recibe Administración al cobrar llegan acá.",
  },
  sin_gasto: {
    titulo: "Todos los cheques entregados dicen qué gasto pagaron",
    descripcion: "Cuando en un cobro se entregue un cheque a un proveedor, aparece acá para elegir el gasto.",
  },
  entregado: {
    titulo: "Todavía no se entregó ningún cheque a un proveedor",
    descripcion: "Cuando le entregues un cheque a un proveedor, queda registrado acá.",
  },
  depositado: {
    titulo: "No hay cheques depositados",
    descripcion: "Cuando deposites un cheque, aparece acá hasta que se acredite.",
  },
  acreditado: {
    titulo: "Todavía no se acreditó ningún cheque",
    descripcion: "Cuando el banco acredite un depósito, marcalo y aparece acá.",
  },
  rechazado: {
    titulo: "No hay cheques rechazados",
    descripcion: "Si el banco rebota un cheque (o el proveedor lo devuelve porque rebotó), se marca como rechazado.",
  },
  todos: {
    titulo: "Todavía no se registró ningún cheque",
    descripcion: "Los cheques que recibe Administración al cobrar llegan acá.",
  },
};

function normalizar(t: string | null | undefined): string {
  return (t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Qué se hizo con la diferencia entre el cheque y el gasto que pagó ("dio $ 20.000 de vuelto…"). */
function textoDiferencia(
  diferencia: string | null,
  montoCheque: number,
  montoGasto: number | null,
  proveedor: string | null
): string | null {
  if (montoGasto === null) return null;
  const sobra = redondear2(montoCheque - montoGasto);
  if (diferencia === "vuelto_efectivo" && sobra > 0) return `dio ${formatARS(sobra)} de vuelto en efectivo`;
  if (diferencia === "a_favor" && sobra > 0) return `quedan ${formatARS(sobra)} a favor con ${proveedor ?? "el proveedor"}`;
  if (diferencia === "dividido") return "el resto del gasto quedó por pagar";
  return null;
}

export default async function ChequesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string }>;
}) {
  // Tesorería y el Líder, con todas las acciones (E1, §1.3 D-P2).
  await requireRol("tesoreria", "lider");
  const { estado, q: qParam } = await searchParams;
  const filtro: FiltroCheque = FILTROS_CHEQUES.some((f) => f.valor === estado)
    ? (estado as FiltroCheque)
    : "en_cartera";
  const q = (qParam ?? "").trim().slice(0, 60);

  const supabase = await createClient();
  const hoy = hoyISO();

  const [chequesRes, gastos] = await Promise.all([
    supabase
      .from("cheques")
      .select(
        "id, numero, cuit, recibido_de, puesto, proveedor, monto, estado, fecha_recibido, fecha_cobro, fecha_depositado, fecha_acreditado, fecha_entregado, entregado_en_cobro, gasto_id, gasto_diferencia, motivo_rechazo, rechazado_en, titular, cliente:clientes(nombre, codigo), gasto:gastos(descripcion, monto, rubro:rubros_gasto(nombre))"
      )
      .order("fecha_cobro", { ascending: true }),
    cargarGastosPendientes(supabase),
  ]);
  const cheques = chequesRes.data ?? [];

  const estaListo = (c: { estado: string; fecha_cobro: string }) =>
    c.estado === "en_cartera" && c.fecha_cobro <= hoy;
  const esSinGasto = (c: { estado: string; gasto_id: string | null }) =>
    c.estado === "entregado" && !c.gasto_id;

  const porCobrar = cheques.filter((c) => c.estado === "en_cartera");
  const listos = porCobrar.filter(estaListo);
  const sinGasto = cheques.filter(esSinGasto);
  const totalPorCobrar = porCobrar.reduce((acc, c) => acc + Number(c.monto), 0);
  const totalListos = listos.reduce((acc, c) => acc + Number(c.monto), 0);

  const conteos: Record<FiltroCheque, number> = {
    listos: listos.length,
    en_cartera: porCobrar.length,
    sin_gasto: sinGasto.length,
    entregado: cheques.filter((c) => c.estado === "entregado").length,
    depositado: cheques.filter((c) => c.estado === "depositado").length,
    acreditado: cheques.filter((c) => c.estado === "acreditado").length,
    rechazado: cheques.filter((c) => c.estado === "rechazado").length,
    todos: cheques.length,
  };

  const porFiltro =
    filtro === "todos"
      ? cheques
      : filtro === "listos"
        ? listos
        : filtro === "sin_gasto"
          ? sinGasto
          : cheques.filter((c) => c.estado === filtro);
  const nq = normalizar(q);
  const filtrados = nq
    ? porFiltro.filter(
        (c) =>
          normalizar(c.numero).includes(nq) ||
          normalizar(c.puesto).includes(nq) ||
          normalizar(c.recibido_de ?? c.titular).includes(nq) ||
          normalizar(c.cliente?.nombre).includes(nq) ||
          normalizar(c.proveedor).includes(nq) ||
          (c.cliente?.codigo !== undefined && String(c.cliente?.codigo) === nq)
      )
    : porFiltro;

  // Proveedores ya usados (sugerencias al entregar), del más reciente al más viejo.
  const proveedores = [
    ...new Set(
      [...cheques]
        .filter((c) => c.proveedor)
        .sort((a, b) => (b.fecha_entregado ?? "").localeCompare(a.fecha_entregado ?? ""))
        .map((c) => c.proveedor as string)
    ),
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Cheques"
        descripcion="Los cheques que se reciben al cobrar: por cobrar, depositados, entregados a proveedores y rechazados."
      >
        <BotonExportar dataset="cheques" periodo={periodoActual()} label="Cheques del mes (.xlsx)" />
        <div className="rounded-xl border bg-card px-5 py-2.5 text-right">
          <p className="text-sm text-muted-foreground">Por cobrar</p>
          <Money monto={totalPorCobrar} className="text-2xl font-bold" />
        </div>
      </PageHeader>

      {chequesRes.error ? (
        <p role="alert" className="rounded-lg bg-pendiente-suave px-4 py-3 text-base font-medium text-pendiente">
          No se pudieron cargar los cheques. Actualizá la página; si sigue pasando, avisale al Líder de
          Procesos.
        </p>
      ) : null}

      {listos.length > 0 && filtro !== "listos" ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-parcial/40 bg-parcial-suave px-5 py-4">
          <div className="flex items-start gap-3">
            <Landmark className="mt-0.5 size-6 shrink-0 text-parcial" strokeWidth={1.9} />
            <div>
              <p className="text-base font-semibold">
                {listos.length === 1
                  ? `Tenés 1 cheque listo para depositar por ${formatARS(totalListos)}`
                  : `Tenés ${listos.length} cheques listos para depositar por ${formatARS(totalListos)}`}
              </p>
              <p className="text-sm text-muted-foreground">Ya se pueden cobrar: llevalos al banco y marcalos.</p>
            </div>
          </div>
          <Button asChild variant="outline" className="h-11 bg-card px-4 text-base font-semibold">
            <Link href={hrefFiltroCheque("listos")}>
              Ver los listos
              <ArrowRight className="size-4" strokeWidth={2} />
            </Link>
          </Button>
        </div>
      ) : null}

      {sinGasto.length > 0 && filtro !== "sin_gasto" ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/30 bg-accent/60 px-5 py-4">
          <div className="flex items-start gap-3">
            <Link2 className="mt-0.5 size-6 shrink-0 text-primary" strokeWidth={1.9} />
            <div>
              <p className="text-base font-semibold">
                {sinGasto.length === 1
                  ? "1 cheque se entregó a un proveedor en el cobro y no dice qué gasto pagó"
                  : `${sinGasto.length} cheques se entregaron a proveedores en el cobro y no dicen qué gasto pagaron`}
              </p>
              <p className="text-sm text-muted-foreground">
                Elegí el gasto de cada uno: así el proveedor no figura impago.
              </p>
            </div>
          </div>
          <Button asChild className="h-11 px-4 text-base font-semibold">
            <Link href={hrefFiltroCheque("sin_gasto")}>
              Elegir los gastos
              <ArrowRight className="size-4" strokeWidth={2} />
            </Link>
          </Button>
        </div>
      ) : null}

      <div className="space-y-4">
        <FiltroEstado activo={filtro} conteos={conteos} q={q} />

        <form action="/cheques" method="get" role="search" className="flex max-w-xl gap-2">
          {filtro !== "en_cartera" ? <input type="hidden" name="estado" value={filtro} /> : null}
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.9}
            />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Buscá por N° de cheque, puesto o nombre"
              aria-label="Buscar cheque"
              className="h-12 pl-10 text-base"
            />
          </div>
          <Button type="submit" variant="outline" className="h-12 px-5 text-base">
            Buscar
          </Button>
        </form>

        {filtrados.length === 0 ? (
          q ? (
            <EmptyState
              icono={Search}
              titulo={`No encontramos cheques con «${q}»`}
              descripcion="Probá con el número del cheque, el puesto o el nombre de quien lo entregó."
            >
              <Button asChild variant="outline" className="h-11 px-4 text-base">
                <Link href={hrefFiltroCheque(filtro)}>Ver todos</Link>
              </Button>
            </EmptyState>
          ) : (
            <EmptyState icono={Banknote} titulo={VACIOS[filtro].titulo} descripcion={VACIOS[filtro].descripcion} />
          )
        ) : (
          <DatosCheques gastos={gastos} proveedores={proveedores}>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {filtrados.map((c) => {
              const listo = estaListo(c);
              const diferido = c.estado === "en_cartera" && !listo;
              const gastoEtiqueta = c.gasto
                ? etiquetaGasto(c.gasto.descripcion, c.gasto.rubro?.nombre)
                : null;
              const recibidoDe = c.recibido_de ?? c.titular ?? c.cliente?.nombre ?? "—";
              const diferencia = textoDiferencia(
                c.gasto_diferencia,
                Number(c.monto),
                c.gasto ? Number(c.gasto.monto) : null,
                c.proveedor
              );
              return (
                <li
                  key={c.id}
                  className={cn(
                    "grid gap-3 px-4 py-4 lg:grid-cols-[minmax(10rem,1fr)_minmax(0,1.6fr)_auto] lg:items-center lg:gap-6",
                    esSinGasto(c) && "bg-accent/40"
                  )}
                >
                  <div className="flex items-start justify-between gap-3 lg:block">
                    <div>
                      <p className="font-display text-xl font-bold tracking-tight tabular">N° {c.numero}</p>
                      {c.puesto ? (
                        <span className="mt-1 inline-flex rounded-md bg-muted px-2 py-0.5 text-sm font-medium">
                          {c.puesto}
                        </span>
                      ) : (
                        <span className="mt-1 block text-sm text-muted-foreground">Sin puesto</span>
                      )}
                    </div>
                    <Money monto={c.monto} className="text-xl font-bold lg:mt-1 lg:block" />
                  </div>

                  <div className="min-w-0 space-y-1 text-sm">
                    <p className="text-base">
                      <span className="text-muted-foreground">Lo entregó </span>
                      <span className="font-medium">{recibidoDe}</span>
                      {c.cliente ? (
                        <span className="text-muted-foreground tabular"> · Carpeta N° {c.cliente.codigo}</span>
                      ) : null}
                    </p>
                    <p className="text-muted-foreground tabular">
                      {c.cuit ? `CUIT ${formatCuit(c.cuit)} · ` : ""}
                      Recibido {formatFecha(c.fecha_recibido).slice(0, 5)} ·{" "}
                      {diferido ? (
                        <span className="font-semibold text-parcial">
                          Diferido: se cobra desde el {formatFecha(c.fecha_cobro)}
                        </span>
                      ) : (
                        <>Se cobra desde el {formatFecha(c.fecha_cobro).slice(0, 5)}</>
                      )}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <Sello estado={listo ? "listo_depositar" : c.estado} />
                      {c.estado === "entregado" ? (
                        <span>
                          a <strong>{c.proveedor ?? "un proveedor"}</strong>
                          {c.fecha_entregado ? ` el ${formatFecha(c.fecha_entregado).slice(0, 5)}` : ""}
                          {c.entregado_en_cobro ? " (en el cobro)" : ""}
                        </span>
                      ) : null}
                      {c.estado === "depositado" && c.fecha_depositado ? (
                        <span className="text-muted-foreground">el {formatFecha(c.fecha_depositado).slice(0, 5)}</span>
                      ) : null}
                      {c.estado === "acreditado" && c.fecha_acreditado ? (
                        <span className="text-muted-foreground">el {formatFecha(c.fecha_acreditado).slice(0, 5)}</span>
                      ) : null}
                    </div>
                    {gastoEtiqueta ? (
                      <p className="break-words">
                        <span className="text-muted-foreground">
                          {c.estado === "rechazado" ? "Iba a pagar: " : "Pagó: "}
                        </span>
                        <span className="font-medium">{gastoEtiqueta}</span>
                        {diferencia ? <span className="text-muted-foreground"> · {diferencia}</span> : null}
                      </p>
                    ) : esSinGasto(c) ? (
                      <p className="font-medium text-primary">Falta decir qué gasto pagó</p>
                    ) : null}
                    {c.estado === "rechazado" && c.motivo_rechazo ? (
                      <p className="text-pendiente">Motivo: {c.motivo_rechazo}</p>
                    ) : null}
                  </div>

                  <AccionesCheque
                    cheque={{
                      id: c.id,
                      numero: c.numero,
                      monto: Number(c.monto),
                      estado: c.estado,
                      fechaCobro: c.fecha_cobro,
                      fechaRecibido: c.fecha_recibido,
                      fechaDepositado: c.fecha_depositado,
                      puedeDepositar: listo,
                      proveedor: c.proveedor,
                      gastoId: c.gasto_id,
                      gastoEtiqueta,
                      gastoDiferencia: c.gasto_diferencia,
                      sobrante:
                        c.gasto && Number(c.monto) > Number(c.gasto.monto)
                          ? redondear2(Number(c.monto) - Number(c.gasto.monto))
                          : null,
                      puesto: c.puesto,
                    }}
                    hoy={hoy}
                  />
                </li>
              );
            })}
          </ul>
          </DatosCheques>
        )}
      </div>
    </div>
  );
}
