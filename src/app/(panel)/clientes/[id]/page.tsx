import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FileCheck,
  FileText,
  HandCoins,
  Megaphone,
  ReceiptText,
  ShieldAlert,
} from "lucide-react";
import { aplicaDirecto, requireRol } from "@/lib/auth";
import { ROLES_COBRAN } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import {
  formatARS,
  formatFecha,
  formatFechaHora,
  formatFechaTS,
  hoyISO,
  labelPeriodo,
  saldoCargo,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { Codigo } from "@/components/shared/codigo";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { EmptyState } from "@/components/shared/empty-state";
import { BotonExportar } from "@/components/shared/boton-exportar";
import { EditarClienteDialog } from "@/components/clientes/editar-cliente-dialog";
import { BajaCliente } from "@/components/clientes/baja-cliente";
import { AplicarSaldoFavor } from "@/components/clientes/aplicar-saldo-favor";
import { BannerDeuda } from "@/components/clientes/banner-deuda";
import {
  CambiosPendientesCliente,
  type CambioDeCliente,
} from "@/components/clientes/cambios-pendientes-cliente";
import { DeudaAnterior } from "@/components/clientes/deuda-anterior";
import { ConceptosCliente } from "@/components/clientes/conceptos-cliente";
import { SubirDocumento } from "@/components/clientes/subir-documento";
import { BorrarDocumento } from "@/components/clientes/borrar-documento";
import { NuevaSancion } from "@/components/clientes/nueva-sancion";
import {
  MedidoresCliente,
  type MedidorConLectura,
} from "@/components/clientes/medidores-cliente";
import {
  LABEL_MEDIO,
  LABEL_TIPO_PERSONA,
  labelCategoria,
} from "@/components/clientes/constantes";

export const metadata = { title: "Ficha del cliente" };

type Props = { params: Promise<{ id: string }> };

/** Estado que se muestra en el sello de un cargo: vencido si pasó la fecha. */
function estadoCargo(
  cargo: { estado: string; vencimiento: string },
  hoy: string
): string {
  if (
    (cargo.estado === "pendiente" || cargo.estado === "parcial") &&
    cargo.vencimiento < hoy
  ) {
    return "vencido";
  }
  return cargo.estado;
}

export default async function FichaClientePage({ params }: Props) {
  const perfil = await requireRol("admin", "tesoreria", "consejo", "lider");
  const { id } = await params;
  const supabase = await createClient();
  const hoy = hoyISO();
  const esLider = aplicaDirecto(perfil.rol);

  const { data: cliente } = await supabase
    .from("clientes")
    .select(
      "id, codigo, nombre, apodo, activo, tipo_persona, cuit, telefono, email, direccion, cuotas_mes, notas"
    )
    .eq("id", id)
    .maybeSingle();
  if (!cliente) notFound();

  const [
    cargosRes,
    pagosRes,
    itemsRes,
    conceptosRes,
    documentosRes,
    sancionesRes,
    medidoresRes,
    perfilesRes,
    saldoFavorRes,
    cambiosRes,
    circularesRes,
    recepcionesRes,
  ] = await Promise.all([
    supabase
      .from("cargos")
      .select(
        "id, codigo, descripcion, periodo, vencimiento, estado, monto, monto_pagado, descuento_pronto_pago"
      )
      .eq("cliente_id", id)
      .order("periodo", { ascending: false })
      .order("codigo"),
    supabase
      .from("pagos")
      .select(
        "id, numero, fecha, medio, monto, recibido_por, anulado, motivo_anulacion, titular_transferencia, imputaciones(monto)"
      )
      .eq("cliente_id", id)
      .order("fecha", { ascending: false }),
    supabase
      .from("cliente_conceptos")
      .select("id, cantidad, activo, concepto_id, conceptos(codigo, nombre)")
      .eq("cliente_id", id),
    supabase
      .from("conceptos")
      .select("id, codigo, nombre")
      .eq("tipo", "recurrente")
      .eq("activo", true)
      .order("codigo"),
    supabase
      .from("documentos_cliente")
      .select("id, titulo, categoria, creado_en, storage_path, subido_por")
      .eq("cliente_id", id)
      .order("creado_en", { ascending: false }),
    supabase
      .from("sanciones")
      .select("id, tipo, titulo, detalle, fecha, storage_path")
      .eq("cliente_id", id)
      .order("fecha", { ascending: false }),
    supabase
      .from("medidores")
      .select("id, numero, ubicacion, activo")
      .eq("cliente_id", id)
      .order("numero"),
    supabase.from("perfiles").select("user_id, nombre"),
    supabase
      .from("v_saldo_favor")
      .select("saldo_favor")
      .eq("cliente_id", id)
      .maybeSingle(),
    supabase
      .from("cambios_pendientes")
      .select(
        "id, resumen, estado, solicitado_por, solicitado_en, revisado_por, revisado_en, motivo_rechazo"
      )
      .or(`cliente_id.eq.${id},entidad_id.eq.${id}`)
      .in("estado", ["pendiente", "rechazado"])
      .order("solicitado_en", { ascending: false }),
    supabase
      .from("circulares")
      .select("id, numero, titulo, fecha, obligatoria, storage_path")
      .eq("activa", true)
      .order("fecha", { ascending: false }),
    supabase
      .from("circular_recepciones")
      .select("circular_id, recibida_en")
      .eq("cliente_id", id),
  ]);

  const cargos = cargosRes.data ?? [];
  const pagos = pagosRes.data ?? [];
  const items = itemsRes.data ?? [];
  const documentos = documentosRes.data ?? [];
  const sanciones = sancionesRes.data ?? [];
  const medidores = medidoresRes.data ?? [];
  const circulares = circularesRes.data ?? [];
  const nombrePorUsuario = new Map(
    (perfilesRes.data ?? []).map((p) => [p.user_id, p.nombre])
  );
  const nombreUsuario = (userId: string | null | undefined) =>
    userId ? (nombrePorUsuario.get(userId) ?? "—") : "—";

  // Deuda exigible hoy: suma del saldo de los cargos pendientes o parciales.
  const deuda = cargos
    .filter((c) => c.estado === "pendiente" || c.estado === "parcial")
    .reduce((acc, c) => acc + saldoCargo(c), 0);
  const debe = deuda > 0;
  const saldoFavor = Number(saldoFavorRes.data?.saldo_favor ?? 0);
  const tieneSaldoFavor = saldoFavor > 0.009;

  // Cambios de este cliente que esperan aprobación + rechazados recientes.
  const cambios: CambioDeCliente[] = (cambiosRes.data ?? []).map((c) => ({
    id: c.id,
    resumen: c.resumen,
    estado: c.estado,
    solicitadoPor: nombreUsuario(c.solicitado_por),
    solicitadoEn: c.solicitado_en,
    revisadoPor: c.revisado_por ? nombreUsuario(c.revisado_por) : null,
    revisadoEn: c.revisado_en,
    motivoRechazo: c.motivo_rechazo,
  }));
  const cambiosPendientes = cambios.filter((c) => c.estado === "pendiente");
  const cambiosRechazados = cambios
    .filter((c) => c.estado === "rechazado")
    .slice(0, 5);

  // Circulares activas de la organización y si este cliente las confirmó.
  const recibidaEn = new Map(
    (recepcionesRes.data ?? []).map((r) => [r.circular_id, r.recibida_en])
  );

  // Última lectura conocida de cada medidor.
  const ultimaPorMedidor = new Map<
    string,
    { lectura_actual: number; periodo: string; fecha_lectura: string }
  >();
  if (medidores.length > 0) {
    const { data: lecturas } = await supabase
      .from("lecturas")
      .select("medidor_id, lectura_actual, periodo, fecha_lectura")
      .in(
        "medidor_id",
        medidores.map((m) => m.id)
      )
      .order("periodo", { ascending: false });
    for (const l of lecturas ?? []) {
      if (!ultimaPorMedidor.has(l.medidor_id)) {
        ultimaPorMedidor.set(l.medidor_id, {
          lectura_actual: Number(l.lectura_actual),
          periodo: l.periodo,
          fecha_lectura: l.fecha_lectura,
        });
      }
    }
  }
  const medidoresConLectura: MedidorConLectura[] = medidores.map((m) => ({
    id: m.id,
    numero: m.numero,
    ubicacion: m.ubicacion,
    activo: m.activo,
    ultimaLectura: ultimaPorMedidor.get(m.id) ?? null,
  }));

  // URLs firmadas (1 h) para ver documentos, adjuntos de registros y circulares.
  const rutasArchivos = [
    ...documentos.map((d) => d.storage_path),
    ...sanciones.flatMap((s) => (s.storage_path ? [s.storage_path] : [])),
    ...circulares.flatMap((c) => (c.storage_path ? [c.storage_path] : [])),
  ];
  const urlPorRuta = new Map<string, string>();
  if (rutasArchivos.length > 0) {
    const { data: firmadas } = await supabase.storage
      .from("documentos")
      .createSignedUrls(rutasArchivos, 3600);
    for (const f of firmadas ?? []) {
      if (f.path && f.signedUrl) urlPorRuta.set(f.path, f.signedUrl);
    }
  }

  // Cargos agrupados por período (más nuevo arriba: ya vienen ordenados).
  const cargosPorPeriodo = new Map<string, typeof cargos>();
  for (const c of cargos) {
    const lista = cargosPorPeriodo.get(c.periodo);
    if (lista) lista.push(c);
    else cargosPorPeriodo.set(c.periodo, [c]);
  }

  // Conceptos del cliente y conceptos que todavía puede sumar.
  const itemsConceptos = items
    .map((i) => ({
      id: i.id,
      cantidad: Number(i.cantidad),
      activo: i.activo,
      conceptoId: i.concepto_id,
      codigo: i.conceptos?.codigo ?? "?",
      nombre: i.conceptos?.nombre ?? "Concepto",
    }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
  const asignados = new Set(itemsConceptos.map((i) => i.conceptoId));
  const disponibles = (conceptosRes.data ?? []).filter(
    (c) => !asignados.has(c.id)
  );

  const contacto = [
    cliente.apodo ? `Le dicen “${cliente.apodo}”` : null,
    LABEL_TIPO_PERSONA[cliente.tipo_persona],
    cliente.cuit ? `CUIT ${cliente.cuit}` : null,
    cliente.telefono,
    cliente.email,
    cliente.direccion,
  ]
    .filter(Boolean)
    .join(" · ");

  const puedeCobrar = ROLES_COBRAN.includes(perfil.rol);
  const puedeRegistrar =
    perfil.rol === "admin" || perfil.rol === "consejo" || perfil.rol === "lider";
  const puedeDeudaAnterior =
    perfil.rol === "admin" || perfil.rol === "tesoreria" || perfil.rol === "lider";
  const puedeAplicarSaldo =
    perfil.rol === "admin" || perfil.rol === "tesoreria" || perfil.rol === "lider";

  return (
    <div className="space-y-8">
      <div className="space-y-5">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Codigo codigo={`N° ${cliente.codigo}`} />
            {!cliente.activo ? (
              <Sello estado="inactivo" texto="Dado de baja" />
            ) : null}
            <Sello estado={debe ? "debe" : "al_dia"} />
            {tieneSaldoFavor ? (
              <span className="inline-flex items-center gap-1.5">
                <Sello estado="saldo_favor" />
                <Money
                  monto={saldoFavor}
                  className="text-sm font-semibold text-pagado"
                />
              </span>
            ) : null}
            {cambiosPendientes.length > 0 ? (
              <Sello estado="pendiente_aprobacion" />
            ) : null}
          </div>
          <PageHeader titulo={cliente.nombre} descripcion={contacto} className="pb-2">
            {puedeCobrar ? (
              <Button asChild size="lg" className="h-12 px-6 text-base font-semibold">
                <Link href={`/cobranza/${cliente.id}`}>
                  <HandCoins className="size-5" />
                  Cobrar
                </Link>
              </Button>
            ) : null}
            {!debe ? (
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 px-5 text-base"
              >
                <Link href={`/libre-deuda/${cliente.id}`}>
                  <FileCheck className="size-5" />
                  Libre deuda
                </Link>
              </Button>
            ) : null}
            <EditarClienteDialog cliente={cliente} rol={perfil.rol} />
            <BajaCliente
              clienteId={cliente.id}
              nombre={cliente.nombre}
              activo={cliente.activo}
              rol={perfil.rol}
            />
          </PageHeader>
        </div>

        {/* Debe hoy + Saldo a favor, lado a lado */}
        <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Debe hoy</p>
            <p
              className={cn(
                "text-3xl font-bold tabular",
                debe ? "text-pendiente" : "text-pagado"
              )}
            >
              {formatARS(deuda)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Saldo a favor</p>
            <Money
              monto={saldoFavor}
              className={cn(
                "block text-3xl font-bold",
                tieneSaldoFavor ? "text-pagado" : "text-muted-foreground/60"
              )}
            />
          </div>
          {tieneSaldoFavor && debe && puedeAplicarSaldo ? (
            <AplicarSaldoFavor
              clienteId={cliente.id}
              saldoFavor={saldoFavor}
              deuda={deuda}
            />
          ) : null}
        </div>

        <BannerDeuda cargos={cargos} hoy={hoy} />

        <CambiosPendientesCliente
          pendientes={cambiosPendientes}
          rechazados={cambiosRechazados}
          esLider={esLider}
        />
      </div>

      <Tabs defaultValue="cuenta">
        <TabsList className="h-auto! w-full flex-wrap justify-start gap-1 p-1">
          <TabsTrigger value="cuenta" className="h-11 flex-none px-4 text-sm font-medium">
            Cuenta
          </TabsTrigger>
          <TabsTrigger value="conceptos" className="h-11 flex-none px-4 text-sm font-medium">
            Conceptos
          </TabsTrigger>
          <TabsTrigger value="documentos" className="h-11 flex-none px-4 text-sm font-medium">
            Documentos
          </TabsTrigger>
          <TabsTrigger value="registros" className="h-11 flex-none px-4 text-sm font-medium">
            Registros
          </TabsTrigger>
          <TabsTrigger value="medidores" className="h-11 flex-none px-4 text-sm font-medium">
            Medidores
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------ Cuenta */}
        <TabsContent value="cuenta" className="space-y-6 pt-4 text-base">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <BotonExportar
              dataset="cuenta_corriente"
              extra={{ cliente: cliente.id }}
              label="Cuenta corriente de la carpeta (.xlsx)"
            />
            {puedeDeudaAnterior ? (
              <DeudaAnterior clienteId={cliente.id} fechaHoy={hoy} />
            ) : null}
          </div>
          {cargos.length === 0 ? (
            <EmptyState
              icono={ReceiptText}
              titulo="Todavía no tiene cargos"
              descripcion="Se generan solos con la facturación mensual, según los conceptos que paga."
            />
          ) : (
            Array.from(cargosPorPeriodo.entries()).map(([periodo, lista]) => (
              <Card key={periodo} className="text-base">
                <CardHeader>
                  <CardTitle className="text-lg">
                    {labelPeriodo(periodo)}
                  </CardTitle>
                  <CardAction>
                    <p className="text-sm text-muted-foreground">
                      Vence el {formatFecha(lista[0].vencimiento)}
                    </p>
                  </CardAction>
                </CardHeader>
                <CardContent className="divide-y">
                  {lista.map((c) => {
                    const saldo = saldoCargo(c);
                    return (
                      <div
                        key={c.id}
                        className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3"
                      >
                        <Codigo codigo={c.codigo} />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{c.descripcion}</p>
                          <p className="text-sm text-muted-foreground tabular">
                            {formatARS(c.monto)} · pagado{" "}
                            {formatARS(c.monto_pagado)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Saldo</p>
                          <Money
                            monto={saldo}
                            className={cn(
                              "font-semibold",
                              saldo > 0 ? "text-pendiente" : "text-pagado"
                            )}
                          />
                        </div>
                        <Sello estado={estadoCargo(c, hoy)} />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))
          )}

          <Card className="text-base">
            <CardHeader>
              <CardTitle className="text-lg">Pagos recibidos</CardTitle>
            </CardHeader>
            <CardContent>
              {pagos.length === 0 ? (
                <p className="py-4 text-muted-foreground">
                  Todavía no recibimos pagos de este cliente.
                </p>
              ) : (
                <div className="divide-y">
                  {pagos.map((p) => {
                    const imputado = (p.imputaciones ?? []).reduce(
                      (acc, i) => acc + Number(i.monto),
                      0
                    );
                    const sobrante =
                      Math.round((Number(p.monto) - imputado) * 100) / 100;
                    const medio =
                      p.medio === "transferencia" && p.titular_transferencia
                        ? `Transferencia de ${p.titular_transferencia}`
                        : (LABEL_MEDIO[p.medio] ?? p.medio);
                    return (
                      <div
                        key={p.id}
                        className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "font-medium",
                              p.anulado && "text-muted-foreground line-through"
                            )}
                          >
                            Recibo N° {p.numero} · {medio}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatFechaHora(p.fecha)} · Cobró{" "}
                            {nombreUsuario(p.recibido_por)}
                          </p>
                          {p.anulado ? (
                            <p className="text-sm text-muted-foreground">
                              Anulado{p.motivo_anulacion ? `: ${p.motivo_anulacion}` : ""}
                            </p>
                          ) : sobrante > 0.009 ? (
                            <p className="flex flex-wrap items-center gap-2 pt-1 text-sm">
                              <Sello estado="saldo_favor" />
                              <Money monto={sobrante} className="font-semibold text-pagado" />
                              <span className="text-muted-foreground">
                                sin imputar de este pago
                              </span>
                            </p>
                          ) : null}
                        </div>
                        <Money
                          monto={p.monto}
                          className={cn(
                            "font-semibold",
                            p.anulado && "text-muted-foreground line-through"
                          )}
                        />
                        <Link
                          href={`/recibos/${p.id}`}
                          className="flex min-h-11 items-center px-2 text-sm font-medium text-primary hover:underline"
                        >
                          Ver recibo
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------ Conceptos */}
        <TabsContent value="conceptos" className="pt-4 text-base">
          <ConceptosCliente
            clienteId={cliente.id}
            cuotasMes={cliente.cuotas_mes}
            items={itemsConceptos}
            disponibles={disponibles}
            rol={perfil.rol}
          />
        </TabsContent>

        {/* ------------------------------------------------ Documentos */}
        <TabsContent value="documentos" className="space-y-6 pt-4 text-base">
          <Card className="text-base">
            <CardHeader>
              <CardTitle className="text-lg">La carpeta</CardTitle>
            </CardHeader>
            <CardContent>
              {documentos.length === 0 ? (
                <EmptyState
                  icono={FileText}
                  titulo="La carpeta está vacía"
                  descripcion="Subí la habilitación, el SENASA, el apto eléctrico o lo que haga falta guardar."
                />
              ) : (
                <div className="divide-y">
                  {documentos.map((d) => {
                    const url = urlPorRuta.get(d.storage_path);
                    return (
                      <div
                        key={d.id}
                        className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"
                      >
                        <FileText
                          className="size-5 shrink-0 text-muted-foreground"
                          strokeWidth={1.8}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{d.titulo}</p>
                          <p className="text-sm text-muted-foreground">
                            {labelCategoria(d.categoria)} ·{" "}
                            {formatFechaTS(d.creado_en)} · Subió{" "}
                            {nombreUsuario(d.subido_por)}
                          </p>
                        </div>
                        {url ? (
                          <Button asChild variant="outline" className="h-11 px-4">
                            <a href={url} target="_blank" rel="noreferrer">
                              Ver
                            </a>
                          </Button>
                        ) : null}
                        {puedeRegistrar ? (
                          <BorrarDocumento
                            id={d.id}
                            clienteId={cliente.id}
                            titulo={d.titulo}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          <SubirDocumento clienteId={cliente.id} />
        </TabsContent>

        {/* ------------------------------------------------ Registros */}
        <TabsContent value="registros" className="space-y-6 pt-4 text-base">
          <Card className="text-base">
            <CardHeader>
              <CardTitle className="text-lg">Registros documentales</CardTitle>
            </CardHeader>
            <CardContent>
              {sanciones.length === 0 ? (
                <EmptyState
                  icono={ShieldAlert}
                  titulo="No tiene registros"
                  descripcion="Las notificaciones, los apercibimientos y las sanciones que resuelva el Consejo se guardan acá con su documento."
                />
              ) : (
                <div className="divide-y">
                  {sanciones.map((s) => {
                    const url = s.storage_path
                      ? urlPorRuta.get(s.storage_path)
                      : undefined;
                    return (
                      <div key={s.id} className="space-y-1 py-3">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <Sello estado={s.tipo} />
                          <p className="min-w-0 flex-1 font-medium">
                            {s.titulo}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatFecha(s.fecha)}
                          </p>
                        </div>
                        {s.detalle || url ? (
                          <details>
                            <summary className="cursor-pointer py-1 text-sm font-medium text-primary">
                              Ver detalle
                            </summary>
                            <div className="mt-1 space-y-2 pl-1">
                              {s.detalle ? (
                                <p className="text-sm whitespace-pre-wrap">
                                  {s.detalle}
                                </p>
                              ) : null}
                              {url ? (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline"
                                >
                                  Ver documento adjunto
                                </a>
                              ) : null}
                            </div>
                          </details>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {puedeRegistrar ? (
            <NuevaSancion clienteId={cliente.id} fechaHoy={hoy} />
          ) : null}

          <Card className="text-base">
            <CardHeader>
              <CardTitle className="text-lg">Circulares</CardTitle>
              <CardAction>
                <p className="text-sm text-muted-foreground">
                  Confirma la recepción desde su portal
                </p>
              </CardAction>
            </CardHeader>
            <CardContent>
              {circulares.length === 0 ? (
                <EmptyState
                  icono={Megaphone}
                  titulo="No hay circulares activas"
                  descripcion="Se crean desde Comunicaciones y el socio confirma que las recibió desde su portal."
                />
              ) : (
                <div className="divide-y">
                  {circulares.map((c) => {
                    const fechaRecibida = recibidaEn.get(c.id);
                    const url = c.storage_path
                      ? urlPorRuta.get(c.storage_path)
                      : undefined;
                    return (
                      <div
                        key={c.id}
                        className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"
                      >
                        <Megaphone
                          className="size-5 shrink-0 text-muted-foreground"
                          strokeWidth={1.8}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">
                            Circular N° {c.numero} · {c.titulo}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatFecha(c.fecha)}
                            {c.obligatoria ? " · Recepción obligatoria" : ""}
                            {fechaRecibida
                              ? ` · Recibida el ${formatFechaTS(fechaRecibida)}`
                              : ""}
                          </p>
                        </div>
                        <Sello estado={fechaRecibida ? "recibida" : "sin_recibir"} />
                        {url ? (
                          <Button asChild variant="outline" className="h-11 px-4">
                            <a href={url} target="_blank" rel="noreferrer">
                              Ver
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------ Medidores */}
        <TabsContent value="medidores" className="pt-4 text-base">
          <MedidoresCliente
            clienteId={cliente.id}
            medidores={medidoresConLectura}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
