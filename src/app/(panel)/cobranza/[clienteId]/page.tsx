import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Car, UserX } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { centavosConBeneficio, formatARS, formatFecha, hoyISO, labelPeriodo, saldoCargo } from "@/lib/format";
import { diaAnteriorValido } from "@/lib/dia-caja";
import {
  LABEL_CATEGORIA,
  categoriasDeRol,
  type AvanceMes,
  type CategoriaCliente,
} from "@/lib/segmentos";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Codigo } from "@/components/shared/codigo";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { FormCobro, type PlanDelMes } from "@/components/cobranza/form-cobro";
import { AvisoDeuda } from "@/components/cobranza/aviso-deuda";
import { CobroAmbulante } from "@/components/cobranza/cobro-ambulante";
import { OtrasDeudas } from "@/components/cobranza/otras-deudas";
import { DescripcionCargo } from "@/components/cobranza/descripcion-cargo";
import {
  AvisoCajaCerrada,
  AvisoDiaAnterior,
  cajaAnteriorNoDejaCobrar,
  cajaNoDejaCobrar,
  hrefCajaDelDia,
  type CajaDeHoy,
} from "@/components/cobranza/aviso-caja";
import { sumarDias, type MedioPago } from "@/components/cobranza/tipos";

export const metadata = { title: "Cobrar" };

function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Beneficio por pago en término de un cargo (monto − objetivo con beneficio),
 * en centavos enteros con el mismo redondeo que saldoCargo y la RPC.
 */
function beneficioCargo(monto: number, descuentoPct: number): number {
  const montoCents = Math.round(monto * 100);
  const objetivoCents = centavosConBeneficio(montoCents, descuentoPct);
  return Math.max((montoCents - objetivoCents) / 100, 0);
}

/** "Puesto 34½", "Local 3", "Contéiner 7", "Galpón 9": el puesto del cheque (mismo texto
 * que la base, private.puestos_cliente). */
function etiquetaEspacio(e: { tipo: string; numero: string | null; medio: boolean }): string {
  const n = e.numero ?? "";
  if (e.tipo === "puesto") return `Puesto ${n}${e.medio ? "½" : ""}`;
  if (e.tipo === "local") return `Local ${n}`;
  if (e.tipo === "contenedor") return `Contéiner ${n}`;
  if (e.tipo === "galpon") return `Galpón ${n}`;
  if (e.tipo === "invernadero") return `Invernadero ${n}`;
  if (e.tipo === "cochera") return `Cochera ${n}`;
  if (e.tipo === "quinta") return `Quinta ${n}`;
  return `Bar ${n}`.trim();
}

/** El rol no cobra a esta categoría (Admin ↔ Jefe de Portería): pantalla simple, no 404. */
function CobroAjeno({ mensaje, volverA }: { mensaje: string; volverA: string }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5 rounded-lg border bg-card px-6 py-12 text-center">
      <UserX className="size-10 text-muted-foreground" strokeWidth={1.8} />
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold tracking-tight">{mensaje}</h1>
        <p className="text-sm text-muted-foreground">
          Desde acá no se le puede cobrar. Buscá otro cliente en la lista.
        </p>
      </div>
      <Button asChild size="lg" className="h-12 w-full text-base font-semibold">
        <Link href={volverA}>
          <ArrowLeft className="size-5" strokeWidth={2} />
          Volver
        </Link>
      </Button>
    </div>
  );
}

/**
 * /cobranza/{cliente}            → se cobra en la caja de hoy.
 * /cobranza/{cliente}?fecha=…    → carga atrasada: en la caja de ese día anterior.
 */
export default async function CobrarClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ clienteId: string }>;
  searchParams: Promise<{ fecha?: string | string[] }>;
}) {
  const { clienteId } = await params;
  const { fecha: fechaParam } = await searchParams;
  const perfil = await requireRol("admin", "guardia", "lider");
  const supabase = await createClient();
  const esJefe = perfil.rol === "guardia";
  // Carga atrasada: el día anterior en cuya caja entra el cobro (null = la de hoy). Todo lo
  // que la pantalla calcula "a hoy" (deuda, beneficio, vencidos) se calcula a ESE día, igual
  // que la base al imputar.
  const diaCaja = diaAnteriorValido(Array.isArray(fechaParam) ? fechaParam[0] : fechaParam);
  const sufijoFecha = diaCaja ? `&fecha=${diaCaja}` : "";
  const listaHref = diaCaja ? `/cobranza?fecha=${diaCaja}` : "/cobranza";

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, codigo, nombre, apodo, categoria, cuotas_mes, activo")
    .eq("id", clienteId)
    .maybeSingle();

  // El Jefe no ve puesteros ni empleados (RLS). 0052: si tiene cochera, se la cobra él (solo
  // la cochera); si no, lo cobra Administración.
  if (!cliente) {
    if (esJefe) {
      const { data: cocheras } = await supabase.rpc("cocheras_para_cobrar", { p_cliente: clienteId });
      const fila = cocheras?.[0];
      if (fila) {
        return (
          <CobroCochera
            fila={fila}
            diaCaja={diaCaja}
            volverA={`/cobranza?cat=cocheras${sufijoFecha}`}
          />
        );
      }
      return <CobroAjeno mensaje="A este cliente lo cobra Administración" volverA={listaHref} />;
    }
    notFound();
  }
  const categoria = cliente.categoria as CategoriaCliente;
  if (!categoriasDeRol(perfil.rol).includes(categoria)) {
    return (
      <CobroAjeno
        mensaje={
          categoria === "puestero"
            ? "A este cliente lo cobra Administración"
            : "A este cliente lo cobra el Jefe de Portería"
        }
        volverA={listaHref}
      />
    );
  }

  const hoy = diaCaja ?? hoyISO();
  const periodo = `${hoy.slice(0, 7)}-01`;
  const esAmbulante = categoria === "ambulante";
  const recibeCheques = !esJefe;
  const conPlan = !esAmbulante && cliente.cuotas_mes > 1;

  const [cargosRes, saldoFavorRes, avanceRes, espaciosRes, proveedoresRes, ultimoPrecioRes, cajaRes, ultimoPagoRes, ambRes] =
    await Promise.all([
      // Los días pagados de un ambulante (un cargo por cobro) crecen sin techo: de esos se traen
      // solo los de los últimos dos meses (la tira y los choques miran ±30 días), así la consulta
      // nunca llega al tope de 1000 filas. Lo que se debe y los cargos mensuales van todos.
      supabase
        .from("cargos")
        .select(
          "id, codigo, descripcion, periodo, vencimiento, estado, monto, monto_pagado, descuento_pronto_pago, origen, reconocimiento, desde, hasta, conceptos(orden_imputacion)"
        )
        .eq("cliente_id", clienteId)
        .neq("estado", "anulado")
        .or(`origen.neq.diario,estado.in.(pendiente,parcial),hasta.gte.${sumarDias(hoy, -62)}`),
      supabase.from("v_saldo_favor").select("saldo_favor").eq("cliente_id", clienteId).maybeSingle(),
      conPlan
        ? supabase
            .from("v_avance_mes")
            .select("total, pagado, falta, cuotas, cuotas_cubiertas, cuota_sugerida")
            .eq("cliente_id", clienteId)
            .eq("periodo", periodo)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      // Puesto del cheque: solo quien recibe cheques (el Jefe no lee el plano con clientes).
      recibeCheques
        ? supabase
            .from("espacios")
            .select("tipo, numero, medio")
            .eq("cliente_id", clienteId)
        : Promise.resolve({ data: null }),
      recibeCheques
        ? supabase
            .from("cheques")
            .select("proveedor")
            .not("proveedor", "is", null)
            .order("creado_en", { ascending: false })
            .limit(200)
        : Promise.resolve({ data: null }),
      // El ambulante no tiene precio fijo: quien cobra pone cuánto paga por día. Del último
      // cobro por días sale el atajo «Como la última vez» (no se precarga solo).
      esAmbulante
        ? supabase
            .from("cargos")
            .select("precio_unitario")
            .eq("cliente_id", clienteId)
            .eq("origen", "diario")
            .neq("estado", "anulado")
            .order("creado_en", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      // La caja de hoy de quien cobra: si ya está cerrada, se avisa ANTES de cargar el cobro.
      supabase
        .from("cajas")
        .select("estado, reapertura_solicitada_en")
        .eq("tipo", esJefe ? "guardia" : "administracion")
        .eq("fecha", hoy)
        .maybeSingle(),
      // Último día pago del ambulante aunque sea de hace más de dos meses ("Último día pago: …").
      esAmbulante
        ? supabase
            .from("v_ultimo_pago_ambulante")
            .select("pago_hasta")
            .eq("cliente_id", clienteId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      // Con el concepto AMB apagado no se cobra a ambulantes (cobrar_diario lo frena): se avisa antes.
      esAmbulante
        ? supabase.from("conceptos").select("activo").eq("org_id", perfil.org_id).eq("codigo", "AMB").maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  // Saldo exigible hoy de cada cargo, en el orden en que la RPC imputa: el reconocimiento de
  // deuda al final (0055), sin vencerse (tiene un plan de pago acordado).
  const todos = (cargosRes.data ?? []).map((c) => ({
    id: c.id,
    codigo: c.codigo,
    descripcion: c.descripcion,
    periodo: c.periodo,
    vencimiento: c.vencimiento,
    origen: c.origen,
    reconocimiento: c.reconocimiento,
    desde: c.desde,
    hasta: c.hasta,
    orden: Number(c.conceptos?.orden_imputacion ?? 0),
    saldo: saldoCargo(c, hoy),
    monto: Number(c.monto),
    descuento: Number(c.descuento_pronto_pago ?? 0),
    vencido: c.vencimiento < hoy && !c.reconocimiento,
    enTermino: hoy <= c.vencimiento,
  }));
  const items = todos
    .filter((c) => c.saldo > 0)
    .sort(
      (a, b) =>
        Number(a.reconocimiento) - Number(b.reconocimiento) ||
        a.periodo.localeCompare(b.periodo) ||
        a.orden - b.orden
    );

  const deudaTotal = redondear2(items.reduce((acc, c) => acc + c.saldo, 0));
  const saldoFavor = Number(saldoFavorRes.data?.saldo_favor ?? 0);
  const deudaNeta = Math.max(redondear2(deudaTotal - saldoFavor), 0);
  // Lo que queda del reconocimiento después de lo que cubra el saldo a favor (que va primero a lo demás).
  const deudaReconocimiento = redondear2(items.filter((c) => c.reconocimiento).reduce((acc, c) => acc + c.saldo, 0));
  const reconocimientoNeto = Math.min(deudaReconocimiento, deudaNeta);

  const enTerminoConBeneficio = items.filter((c) => c.enTermino && c.descuento > 0);
  const ahorroEnTermino = redondear2(
    enTerminoConBeneficio.reduce((acc, c) => acc + beneficioCargo(c.monto, c.descuento), 0)
  );
  const vencimientoBeneficio = enTerminoConBeneficio.length
    ? enTerminoConBeneficio.map((c) => c.vencimiento).sort()[0]
    : null;
  const vencidos = items.filter((c) => c.vencido);
  const recargoPerdido = redondear2(
    vencidos.reduce((acc, c) => acc + beneficioCargo(c.monto, c.descuento), 0)
  );

  const medios: MedioPago[] = recibeCheques
    ? ["efectivo", "transferencia", "cheque"]
    : ["efectivo", "transferencia"];
  const puestos = [...new Set((espaciosRes.data ?? []).map(etiquetaEspacio))].sort((a, b) =>
    a.localeCompare(b, "es", { numeric: true })
  );
  const proveedores = [
    ...new Set(
      (proveedoresRes.data ?? [])
        .map((c) => c.proveedor?.trim())
        .filter((p): p is string => Boolean(p))
    ),
  ].slice(0, 40);

  let plan: PlanDelMes | null = null;
  if (conPlan) {
    const a = avanceRes.data;
    const avance: AvanceMes | null = a
      ? {
          total: Number(a.total ?? 0),
          pagado: Number(a.pagado ?? 0),
          falta: Number(a.falta ?? 0),
          cuotas: Number(a.cuotas ?? cliente.cuotas_mes),
          cuotas_cubiertas: Number(a.cuotas_cubiertas ?? 0),
          cuota_sugerida: Number(a.cuota_sugerida ?? 0),
        }
      : null;
    const viejos = items.filter((c) => c.periodo < periodo && !c.reconocimiento);
    const montoViejo = redondear2(viejos.reduce((acc, c) => acc + c.saldo, 0));
    plan = {
      avance,
      periodo,
      esQuintero: categoria === "quintero",
      atrasado:
        montoViejo > 0
          ? { meses: [...new Set(viejos.map((c) => c.periodo))].sort(), monto: montoViejo }
          : null,
    };
  }

  const cajaHoy: CajaDeHoy = cajaRes.data
    ? {
        estado: cajaRes.data.estado,
        reaperturaPedida: Boolean(cajaRes.data.reapertura_solicitada_en),
      }
    : null;
  const cajaCerrada = diaCaja ? cajaAnteriorNoDejaCobrar(cajaHoy) : cajaNoDejaCobrar(cajaHoy);
  const irACaja = diaCaja
    ? hrefCajaDelDia(diaCaja, perfil.rol)
    : perfil.rol === "lider"
      ? "/caja?tipo=administracion"
      : "/caja";

  const volverA = `/cobranza?cat=${categoria}${sufijoFecha}`;
  const descripcion = [
    `Carpeta N° ${cliente.codigo}`,
    LABEL_CATEGORIA[categoria],
    cliente.apodo ? `“${cliente.apodo}”` : null,
    cliente.activo ? null : "Dado de baja",
  ]
    .filter(Boolean)
    .join(" · ");

  const deudaDelDia = (
    <section data-tour="cobranza-deuda" className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
        <div>
          <p className="text-sm text-muted-foreground">{diaCaja ? `Debe al ${formatFecha(diaCaja)}` : "Debe hoy"}</p>
          {deudaTotal > 0 ? (
            <p className="text-3xl font-bold tabular text-pendiente">{formatARS(deudaTotal)}</p>
          ) : (
            <p className="text-3xl font-bold tabular text-pagado">$ 0 — Al día</p>
          )}
        </div>
        <Sello
          grande
          estado={deudaTotal <= 0 ? "al_dia" : vencidos.length > 0 ? "vencido" : "en_termino"}
        />
      </div>

      {items.length > 0 ? (
        <div className="divide-y px-5">
          {items.map((c) => (
            <div key={c.id} className="flex items-start gap-3 py-3">
              <Codigo codigo={c.codigo} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                {/* Completa, en los renglones que haga falta: "× 4" o el medidor y su consumo
                    explican el importe si el cliente pregunta. */}
                <p className="font-medium break-words">
                  <DescripcionCargo texto={c.descripcion} />
                </p>
                {/* El sello va debajo, junto al período: en un celular no le come el lugar al nombre.
                    La deuda pasada no es de un mes: es de antes del sistema (@/lib/deuda-pasada). */}
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                  {c.reconocimiento
                    ? "Con plan de pago · se paga después de lo demás"
                    : c.origen === "deuda"
                      ? "De antes del sistema"
                      : labelPeriodo(c.periodo)}
                  {c.vencido ? <Sello estado="vencido" /> : null}
                </p>
              </div>
              <Money monto={c.saldo} className="shrink-0 pt-px font-semibold" />
            </div>
          ))}
        </div>
      ) : null}

      {saldoFavor > 0 ? (
        <div className="space-y-2 border-t bg-pagado-suave/60 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Sello estado="saldo_favor" />
              <p className="text-sm">Crédito del cliente, se aplica solo</p>
            </div>
            <Money monto={-saldoFavor} className="font-semibold text-pagado" />
          </div>
          {deudaTotal > 0 ? (
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="font-medium">{diaCaja ? "Tiene que pagar" : "Tiene que pagar hoy"}</p>
              <p className="text-2xl font-bold tabular">{formatARS(deudaNeta)}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );

  // Siempre montado en la misma posición: tras registrar el cobro, si la página se vuelve a
  // renderizar, la confirmación con el recibo no se pierde.
  const formCobro = (
    <FormCobro
      clienteId={cliente.id}
      clienteNombre={cliente.nombre}
      deudaTotal={deudaNeta}
      deudaBruta={deudaTotal}
      reconocimiento={reconocimientoNeto}
      saldoFavorPrevio={saldoFavor}
      medios={medios}
      puestos={puestos}
      proveedores={proveedores}
      plan={plan}
      volverA={volverA}
      cajaCerrada={cajaCerrada}
      irACaja={irACaja}
      fechaCaja={diaCaja ?? undefined}
    />
  );

  const tieneOtrosCargos = todos.some((c) => c.origen !== "diario");
  // El ambulante que alquila cochera o quinta la paga por mes (EXPC, 0045; EXPQ, 0047): se
  // cobra en "Otras deudas".
  const delMes = [
    items.some((c) => c.codigo === "EXPC") ? "la cochera" : null,
    items.some((c) => c.codigo === "EXPQ") ? "la quinta" : null,
  ].filter((t): t is string => t !== null);
  const debeOtras = items.some((c) => c.codigo !== "EXPC" && c.codigo !== "EXPQ");
  // "La cochera: tocá para cobrarla" · "La cochera y la quinta: tocá para cobrarlas" ·
  // "La quinta y otros cargos: tocá para cobrarlos"
  const partesOtras = [...delMes, ...(debeOtras ? ["otros cargos"] : [])];
  const listaOtras =
    partesOtras.length > 1
      ? `${partesOtras.slice(0, -1).join(", ")} y ${partesOtras[partesOtras.length - 1]}`
      : (partesOtras[0] ?? "");
  const detalleOtras =
    delMes.length > 0
      ? `${listaOtras.charAt(0).toUpperCase()}${listaOtras.slice(1)}: tocá para ${
          debeOtras ? "cobrarlos" : delMes.length > 1 ? "cobrarlas" : "cobrarla"
        }`
      : undefined;
  const pagados = todos
    .filter((c) => c.origen === "diario" && c.desde && c.hasta)
    .map((c) => ({ desde: c.desde as string, hasta: c.hasta as string }));

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <div>
        <Link
          href={volverA}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" strokeWidth={2} />
          Volver a la lista
        </Link>
        <PageHeader titulo={cliente.nombre} descripcion={descripcion} className="pb-0" />
      </div>

      {diaCaja ? (
        <AvisoDiaAnterior
          fecha={diaCaja}
          caja={cajaHoy}
          rol={perfil.rol}
          volverAHoy={`/cobranza/${cliente.id}`}
        />
      ) : (
        <AvisoCajaCerrada caja={cajaHoy} rol={perfil.rol} />
      )}

      {esAmbulante ? (
        <>
          {/* AMB apagado frena solo el cobro por día: la cochera o la quinta del mes y otras
              deudas se siguen cobrando abajo (registrar_cobro no depende de AMB). */}
          {!ambRes.data?.activo ? (
            <Alert variant="destructive">
              <AlertTitle className="text-base font-semibold">Los cobros por día están desactivados</AlertTitle>
              <AlertDescription className="text-base">
                El concepto «Ambulantes» (AMB) está apagado en Configuración → Precios. Pedile al Líder de
                Procesos que lo prenda para poder cobrar por día.
              </AlertDescription>
            </Alert>
          ) : (
            <CobroAmbulante
              clienteId={cliente.id}
              clienteNombre={cliente.nombre}
              precioAnterior={
                Number(ultimoPrecioRes.data?.precio_unitario ?? 0) > 0
                  ? Number(ultimoPrecioRes.data?.precio_unitario)
                  : null
              }
              pagados={pagados}
              ultimoPagoHasta={ultimoPagoRes.data?.pago_hasta ?? null}
              volverA={volverA}
              cajaCerrada={cajaCerrada}
              irACaja={irACaja}
              fechaCaja={diaCaja ?? undefined}
            />
          )}
          {tieneOtrosCargos || deudaTotal > 0 ? (
            <OtrasDeudas deuda={deudaNeta} detalle={detalleOtras}>
              {deudaDelDia}
              {formCobro}
            </OtrasDeudas>
          ) : null}
        </>
      ) : (
        <>
          {deudaTotal > 0 ? (
            <AvisoDeuda
              hayVencidos={vencidos.length > 0}
              recargoPerdido={recargoPerdido}
              ahorroEnTermino={ahorroEnTermino}
              vencimientoBeneficio={vencimientoBeneficio}
            />
          ) : null}
          {deudaDelDia}
          {formCobro}
        </>
      )}
    </div>
  );
}

type FilaCochera = {
  cliente_id: string;
  codigo: number;
  nombre: string;
  apodo: string | null;
  categoria: string;
  cocheras: string | null;
  deuda: number;
  cargos: unknown;
};

type CargoCochera = {
  id: string;
  codigo: string;
  descripcion: string;
  periodo: string;
  vencimiento: string;
  estado: string;
  monto: number;
  monto_pagado: number;
  descuento_pronto_pago: number;
};

/**
 * 0052 · El Jefe de Portería le cobra la cochera a un puestero o a un empleado: SOLO la
 * cochera (lo demás se lo cobra Administración), en la caja de portería y sin saldo a favor.
 * Los datos salen de cocheras_para_cobrar (el Jefe no lee a esos clientes).
 */
async function CobroCochera({
  fila,
  diaCaja,
  volverA,
}: {
  fila: FilaCochera;
  diaCaja: string | null;
  volverA: string;
}) {
  // Solo el Jefe de Portería llega acá (los demás leen al cliente y cobran todo).
  const rol = "guardia" as const;
  const supabase = await createClient();
  const hoy = diaCaja ?? hoyISO();
  const { data: caja } = await supabase
    .from("cajas")
    .select("estado, reapertura_solicitada_en")
    .eq("tipo", "guardia")
    .eq("fecha", hoy)
    .maybeSingle();
  const cajaHoy: CajaDeHoy = caja
    ? { estado: caja.estado, reaperturaPedida: Boolean(caja.reapertura_solicitada_en) }
    : null;
  const cajaCerrada = diaCaja ? cajaAnteriorNoDejaCobrar(cajaHoy) : cajaNoDejaCobrar(cajaHoy);

  const cargos = (Array.isArray(fila.cargos) ? (fila.cargos as CargoCochera[]) : []).map((c) => ({
    ...c,
    monto: Number(c.monto),
    monto_pagado: Number(c.monto_pagado),
    descuento_pronto_pago: Number(c.descuento_pronto_pago),
  }));
  const items = cargos
    .map((c) => ({ ...c, saldo: saldoCargo(c, hoy), vencido: c.vencimiento < hoy }))
    .filter((c) => c.saldo > 0);
  const deuda = redondear2(items.reduce((acc, c) => acc + c.saldo, 0));
  const categoria = fila.categoria as CategoriaCliente;
  const descripcion = [
    `Carpeta N° ${fila.codigo}`,
    LABEL_CATEGORIA[categoria] ?? null,
    fila.cocheras ? fila.cocheras.replace(/ · Cochera /g, " · ") : "Cochera sin número",
    fila.apodo ? `“${fila.apodo}”` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <div>
        <Link
          href={volverA}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" strokeWidth={2} />
          Volver a la lista
        </Link>
        <PageHeader titulo={fila.nombre} descripcion={descripcion} className="pb-0" />
      </div>

      {diaCaja ? (
        <AvisoDiaAnterior fecha={diaCaja} caja={cajaHoy} rol={rol} volverAHoy={`/cobranza/${fila.cliente_id}?cochera=1`} />
      ) : (
        <AvisoCajaCerrada caja={cajaHoy} rol={rol} />
      )}

      <div className="flex items-start gap-3 rounded-lg border border-accent-foreground/20 bg-accent px-4 py-3" role="note">
        <Car className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
        <p className="text-sm">
          <span className="font-semibold">Le cobrás solo la cochera.</span> Lo demás (expensas, energía…) se
          lo cobra Administración. Entra en la caja de portería, como tus otros cobros.
        </p>
      </div>

      <section data-tour="cobranza-deuda" className="rounded-lg border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
          <div>
            <p className="text-sm text-muted-foreground">
              {diaCaja ? `Debe de cochera al ${formatFecha(diaCaja)}` : "Debe de cochera hoy"}
            </p>
            {deuda > 0 ? (
              <p className="text-3xl font-bold tabular text-pendiente">{formatARS(deuda)}</p>
            ) : (
              <p className="text-3xl font-bold tabular text-pagado">$ 0 — Al día</p>
            )}
          </div>
          <Sello grande estado={deuda <= 0 ? "al_dia" : items.some((c) => c.vencido) ? "vencido" : "en_termino"} />
        </div>
        {items.length > 0 ? (
          <div className="divide-y px-5">
            {items.map((c) => (
              <div key={c.id} className="flex items-start gap-3 py-3">
                <Codigo codigo={c.codigo} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium break-words">
                    <DescripcionCargo texto={c.descripcion} />
                  </p>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                    {labelPeriodo(c.periodo)}
                    {c.vencido ? <Sello estado="vencido" /> : null}
                  </p>
                </div>
                <Money monto={c.saldo} className="shrink-0 pt-px font-semibold" />
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <FormCobro
        clienteId={fila.cliente_id}
        clienteNombre={fila.nombre}
        deudaTotal={deuda}
        medios={["efectivo", "transferencia"]}
        volverA={volverA}
        cajaCerrada={cajaCerrada}
        irACaja={diaCaja ? hrefCajaDelDia(diaCaja, rol) : "/caja"}
        fechaCaja={diaCaja ?? undefined}
        sinSaldoFavor={`A ${fila.nombre} le cobrás solo la cochera: hasta ${formatARS(deuda)}. Lo demás lo cobra Administración.`}
      />
    </div>
  );
}
