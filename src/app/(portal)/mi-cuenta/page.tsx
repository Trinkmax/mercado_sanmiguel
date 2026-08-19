import Link from "next/link";
import {
  CheckCircle2,
  ChevronRight,
  FileText,
  Megaphone,
  MessagesSquare,
  Plus,
  Receipt,
  UserX,
} from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  formatARS,
  formatFecha,
  formatFechaHora,
  formatFechaTS,
  hoyISO,
  labelPeriodo,
  periodoActual,
  saldoCargo,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { SubirDocumento } from "@/components/portal/subir-documento";
import { ConfirmarCircular } from "@/components/portal/confirmar-circular";
import { labelCategoria, LABEL_MEDIO } from "@/components/portal/constantes";
import { ChipTipo } from "@/components/solicitudes/chip-tipo";
import { selloEstado } from "@/components/solicitudes/constantes";

export const metadata = { title: "Mi cuenta" };

type Cargo = {
  id: string;
  codigo: string;
  descripcion: string;
  periodo: string;
  vencimiento: string;
  monto: number;
  monto_pagado: number;
  descuento_pronto_pago: number;
  estado: "pendiente" | "parcial" | "pagado" | "anulado";
};

/** Estado a mostrar: un cargo pendiente ya vencido se sella "Vencido". */
function estadoSello(cargo: Cargo): string {
  if (cargo.estado === "pendiente" && cargo.vencimiento < hoyISO())
    return "vencido";
  return cargo.estado;
}

/** Cuánto se ahorra hoy por pagar en término (0 si no aplica o ya venció). */
function beneficioCargo(cargo: Cargo): number {
  if (cargo.estado === "pagado" || cargo.estado === "anulado") return 0;
  if (cargo.descuento_pronto_pago <= 0 || hoyISO() > cargo.vencimiento) return 0;
  const beneficio = cargo.monto - cargo.monto_pagado - saldoCargo(cargo);
  return beneficio > 0 ? Math.round(beneficio * 100) / 100 : 0;
}

function FilaCargo({ cargo }: { cargo: Cargo }) {
  const pagado = cargo.estado === "pagado";
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="font-medium">{cargo.descripcion}</p>
        {pagado ? null : (
          <p className="text-sm text-muted-foreground">
            Vence el {formatFecha(cargo.vencimiento)}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Money
          monto={pagado ? cargo.monto_pagado : saldoCargo(cargo)}
          className={pagado ? "text-muted-foreground" : "font-semibold"}
        />
        <Sello estado={estadoSello(cargo)} />
      </div>
    </div>
  );
}

export default async function MiCuentaPage() {
  const perfil = await requireRol("socio");
  const supabase = await createClient();
  const periodo = periodoActual();
  const hoy = hoyISO();
  const nombrePila = perfil.nombre.split(" ")[0];

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, nombre, codigo")
    .eq("auth_user_id", perfil.user_id)
    .maybeSingle();

  if (!cliente) {
    return (
      <div className="space-y-8">
        <PageHeader titulo={`Hola, ${nombrePila}`} />
        <EmptyState
          icono={UserX}
          titulo="Tu usuario no está vinculado a un puesto"
          descripcion="Consultá en administración para que te asocien a tu carpeta."
        />
      </div>
    );
  }

  const [
    cargosRes,
    pagosRes,
    docsRes,
    sancionesRes,
    saldoFavorRes,
    circularesRes,
    recepcionesRes,
    solicitudesRes,
  ] = await Promise.all([
    supabase
      .from("cargos")
      .select(
        "id, codigo, descripcion, periodo, vencimiento, monto, monto_pagado, descuento_pronto_pago, estado"
      )
      .eq("cliente_id", cliente.id)
      .neq("estado", "anulado")
      .order("periodo", { ascending: false })
      .order("descripcion"),
    supabase
      .from("pagos")
      .select("id, fecha, numero, monto, medio, titular_transferencia")
      .eq("cliente_id", cliente.id)
      .eq("anulado", false)
      .order("fecha", { ascending: false })
      .order("numero", { ascending: false })
      .limit(10),
    supabase
      .from("documentos_cliente")
      .select("id, titulo, categoria, creado_en, storage_path")
      .eq("cliente_id", cliente.id)
      .order("creado_en", { ascending: false }),
    supabase
      .from("sanciones")
      .select("id, tipo, titulo, fecha, detalle, storage_path")
      .eq("cliente_id", cliente.id)
      .order("fecha", { ascending: false }),
    supabase
      .from("v_saldo_favor")
      .select("saldo_favor")
      .eq("cliente_id", cliente.id)
      .maybeSingle(),
    supabase
      .from("circulares")
      .select("id, numero, titulo, detalle, fecha, obligatoria, storage_path")
      .eq("activa", true)
      .order("fecha", { ascending: false })
      .order("numero", { ascending: false }),
    supabase
      .from("circular_recepciones")
      .select("circular_id, recibida_en")
      .eq("cliente_id", cliente.id),
    supabase
      .from("solicitudes")
      .select("id, numero, tipo, asunto, estado, actualizada_en")
      .eq("cliente_id", cliente.id)
      .order("actualizada_en", { ascending: false }),
  ]);

  const cargos: Cargo[] = (cargosRes.data ?? []).map((c) => ({
    ...c,
    periodo: c.periodo.slice(0, 10),
    monto: Number(c.monto),
    monto_pagado: Number(c.monto_pagado),
    descuento_pronto_pago: Number(c.descuento_pronto_pago),
  }));
  const pagos = pagosRes.data ?? [];
  const documentos = docsRes.data ?? [];
  const sanciones = sancionesRes.data ?? [];
  const saldoFavor = Number(saldoFavorRes.data?.saldo_favor ?? 0);
  const circulares = circularesRes.data ?? [];
  const solicitudes = solicitudesRes.data ?? [];

  const recibidaEn = new Map<string, string>();
  for (const r of recepcionesRes.data ?? []) recibidaEn.set(r.circular_id, r.recibida_en);
  const circularesPendientes = circulares.filter(
    (c) => c.obligatoria && !recibidaEn.has(c.id)
  );
  const circularesVistas = circulares.filter(
    (c) => !c.obligatoria || recibidaEn.has(c.id)
  );
  const bloqueado = circularesPendientes.length > 0;

  // ---- El dato: cuánto debe hoy ----
  const pendientes = cargos.filter((c) => saldoCargo(c) > 0);
  const deudaBruta = pendientes.reduce((acc, c) => acc + Number(saldoCargo(c)), 0);
  // El saldo a favor se usa primero al cobrar (registrar_pago lo aplica antes de imputar):
  // lo que "tiene que pagar hoy" es lo que falta después de su crédito.
  const saldoFavorAplicable = Math.min(saldoFavor, deudaBruta);
  const deudaTotal = Math.round((deudaBruta - saldoFavorAplicable) * 100) / 100;
  const saldoFavorSobrante = Math.round((saldoFavor - saldoFavorAplicable) * 100) / 100;
  const periodoMasViejo = pendientes.reduce(
    (min, c) => (c.periodo < min ? c.periodo : min),
    pendientes[0]?.periodo ?? periodo
  );

  const cargosMes = cargos.filter((c) => c.periodo === periodo);
  const beneficioEnTermino = pendientes.reduce(
    (acc, c) => acc + Number(beneficioCargo(c)),
    0
  );
  const proximoVencimientoConBeneficio = pendientes
    .filter((c) => beneficioCargo(c) > 0)
    .map((c) => c.vencimiento)
    .sort()[0];
  const perdioBeneficio = pendientes.some(
    (c) => c.descuento_pronto_pago > 0 && c.vencimiento < hoy
  );

  // ---- Meses anteriores, agrupados por período ----
  const anteriores = cargos.filter((c) => c.periodo < periodo);
  const porPeriodo = new Map<string, Cargo[]>();
  for (const c of anteriores) {
    const lista = porPeriodo.get(c.periodo);
    if (lista) lista.push(c);
    else porPeriodo.set(c.periodo, [c]);
  }
  const periodosAnteriores = [...porPeriodo.entries()].sort(([a], [b]) =>
    a < b ? 1 : -1
  );

  // ---- Links firmados para ver documentos y PDFs de circulares (1 h) ----
  const paths = [
    ...documentos.map((d) => d.storage_path),
    ...sanciones.map((s) => s.storage_path),
    ...circulares.map((c) => c.storage_path),
  ].filter((p): p is string => Boolean(p));
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: firmadas } = await supabase.storage
      .from("documentos")
      .createSignedUrls(paths, 3600);
    for (const f of firmadas ?? []) {
      if (f.path && f.signedUrl) urls.set(f.path, f.signedUrl);
    }
  }

  return (
    <div className="space-y-8">
      {/* 0. Saludo */}
      <PageHeader
        titulo={`Hola, ${nombrePila}`}
        descripcion={`${cliente.nombre} · Carpeta N° ${cliente.codigo}`}
        className="pb-0"
      />

      {/* 1. Circulares obligatorias sin confirmar: bloquean el resto */}
      {bloqueado ? (
        <section className="space-y-4" aria-label="Circulares pendientes de confirmación">
          <div className="flex items-start gap-3">
            <Megaphone className="mt-0.5 size-6 shrink-0 text-parcial" strokeWidth={2} />
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight">
                {circularesPendientes.length === 1
                  ? "Tenés una circular para leer"
                  : `Tenés ${circularesPendientes.length} circulares para leer`}
              </h2>
              <p className="text-sm text-muted-foreground">
                Confirmá que la recibiste para seguir viendo tu cuenta.
              </p>
            </div>
          </div>
          {circularesPendientes.map((c) => {
            const url = c.storage_path ? urls.get(c.storage_path) : undefined;
            return (
              <Card
                key={c.id}
                className="border-2 border-parcial bg-parcial-suave/40 ring-0"
              >
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-lg leading-snug">
                      Circular N° {c.numero} · {c.titulo}
                    </CardTitle>
                    <Sello estado="sin_recibir" />
                  </div>
                  <p className="text-sm text-muted-foreground tabular">
                    {formatFecha(c.fecha)}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {c.detalle ? (
                    <p className="whitespace-pre-line text-[15px] leading-relaxed">
                      {c.detalle}
                    </p>
                  ) : null}
                  {url ? (
                    <Button asChild variant="outline" className="min-h-12 w-full bg-card text-base">
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        <FileText className="size-5" strokeWidth={2} />
                        Abrir el PDF de la circular
                      </a>
                    </Button>
                  ) : null}
                  <ConfirmarCircular circularId={c.id} numero={c.numero} />
                </CardContent>
              </Card>
            );
          })}
        </section>
      ) : null}

      {bloqueado ? (
        <p
          className="rounded-md border border-dashed bg-muted/40 px-4 py-3 text-center text-sm font-medium text-muted-foreground"
          role="status"
        >
          Confirmá la recepción de las circulares para seguir.
        </p>
      ) : null}

      {/* El resto del portal: atenuado mientras haya circulares sin confirmar */}
      <div
        className={cn(
          "space-y-8",
          bloqueado && "pointer-events-none opacity-50 select-none"
        )}
        aria-hidden={bloqueado || undefined}
        inert={bloqueado || undefined}
      >
        {/* 2. Banda de deuda */}
        <div className="etiqueta">
          {deudaTotal === 0 ? (
            <div className="etiqueta-interior flex flex-col items-center gap-4 bg-pagado-suave py-10 text-center">
              <Sello grande estado="al_dia" />
              <p className="text-lg font-medium">
                {saldoFavorAplicable > 0
                  ? "Tu saldo a favor cubre lo de este mes. ¡Gracias!"
                  : "No debés nada. ¡Gracias!"}
              </p>
              {saldoFavorAplicable > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Pasá por administración o portería para que lo apliquen al mes (
                  <Money monto={saldoFavorAplicable} className="font-medium" /> de tu crédito).
                </p>
              ) : null}
              {saldoFavorSobrante > 0 ? (
                <p className="flex flex-wrap items-center justify-center gap-2 border-t pt-4 text-[15px]">
                  <Sello estado="saldo_favor" />
                  <span>
                    Te quedan <Money monto={saldoFavorSobrante} className="font-semibold text-pagado" /> a
                    favor: se aplican solos a los próximos cargos.
                  </span>
                </p>
              ) : null}
            </div>
          ) : (
            <div className="etiqueta-interior space-y-3 bg-pendiente-suave py-8">
              <div>
                <Money
                  monto={deudaTotal}
                  className="block text-3xl font-bold text-pendiente sm:text-4xl"
                />
                <p className="mt-1 text-lg">es lo que tenés que pagar hoy</p>
              </div>
              <p className="text-muted-foreground">
                {pendientes.length === 1
                  ? "1 concepto pendiente"
                  : `${pendientes.length} conceptos pendientes`}
                {" · el más viejo de "}
                {labelPeriodo(periodoMasViejo)}
              </p>
              {beneficioEnTermino > 0 && proximoVencimientoConBeneficio ? (
                <p className="border-t pt-3 font-medium">
                  Pagando antes del {formatFecha(proximoVencimientoConBeneficio)}{" "}
                  mantenés el beneficio por pago en término de{" "}
                  {formatARS(beneficioEnTermino)}.
                </p>
              ) : perdioBeneficio ? (
                <p className="border-t pt-3 font-medium">
                  Se perdió el beneficio por pago en término por mora: se debe el
                  importe completo.
                </p>
              ) : null}
              {saldoFavorAplicable > 0 ? (
                <p className="flex flex-wrap items-center gap-2 border-t pt-3 text-[15px]">
                  <Sello estado="saldo_favor" />
                  <span>
                    Ya descontamos tus{" "}
                    <Money monto={saldoFavorAplicable} className="font-semibold text-pagado" /> a
                    favor (debías <Money monto={deudaBruta} className="font-medium" />).
                  </span>
                </p>
              ) : null}
            </div>
          )}
        </div>

        {/* 3. Conceptos del mes actual */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Tus conceptos de {labelPeriodo(periodo)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cargosMes.length === 0 ? (
              <p className="py-2 text-muted-foreground">
                Todavía no hay cargos de {labelPeriodo(periodo)}. Cuando se
                generen, los vas a ver acá.
              </p>
            ) : (
              <div className="divide-y">
                {cargosMes.map((c) => (
                  <FilaCargo key={c.id} cargo={c} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 4. Meses anteriores */}
        {periodosAnteriores.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Meses anteriores</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {periodosAnteriores.map(([per, items]) => {
                const todoPagado = items.every((c) => c.estado === "pagado");
                const deudaPeriodo = items.reduce(
                  (acc, c) => acc + Number(saldoCargo(c)),
                  0
                );
                return todoPagado ? (
                  <div
                    key={per}
                    className="flex min-h-14 items-center justify-between gap-3 py-3"
                  >
                    <p className="font-medium">{labelPeriodo(per)}</p>
                    <p className="flex items-center gap-1.5 font-medium text-pagado">
                      <CheckCircle2 className="size-5" strokeWidth={2} />
                      Todo pagado
                    </p>
                  </div>
                ) : (
                  <div key={per} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{labelPeriodo(per)}</p>
                      <p className="text-sm text-muted-foreground">
                        Te falta pagar{" "}
                        <Money
                          monto={deudaPeriodo}
                          className="font-semibold text-pendiente"
                        />
                      </p>
                    </div>
                    <div className="divide-y">
                      {items.map((c) => (
                        <FilaCargo key={c.id} cargo={c} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : null}

        {/* 5. Solicitudes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tus solicitudes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Pedidos, reclamos, informes o consultas a la administración. Acá
              seguís cómo van y podés responder.
            </p>
            {solicitudes.length === 0 ? (
              <EmptyState
                icono={MessagesSquare}
                titulo="Todavía no hiciste solicitudes"
                descripcion="Cuando mandes una, la vas a seguir acá: cada cambio de estado y cada respuesta."
                className="py-8"
              />
            ) : (
              <ul className="divide-y overflow-hidden rounded-lg border">
                {solicitudes.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/mi-cuenta/solicitudes/${s.id}`}
                      className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 active:bg-muted"
                    >
                      <span className="w-8 shrink-0 text-right font-display text-base font-bold tabular">
                        {s.numero}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 font-medium leading-snug">
                          {s.asunto}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                          <ChipTipo tipo={s.tipo} />
                          <span className="tabular">
                            Actualizada {formatFechaHora(s.actualizada_en)}
                          </span>
                        </span>
                      </span>
                      <Sello estado={selloEstado(s.estado)} className="shrink-0" />
                      <ChevronRight
                        className="size-5 shrink-0 text-muted-foreground"
                        strokeWidth={2}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Button asChild size="lg" className="h-12 w-full text-base font-semibold">
              <Link href="/mi-cuenta/solicitudes/nueva">
                <Plus className="size-5" strokeWidth={2.2} />
                Nueva solicitud
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* 6. Pagos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tus pagos</CardTitle>
          </CardHeader>
          <CardContent>
            {pagos.length === 0 ? (
              <EmptyState
                icono={Receipt}
                titulo="Todavía no hay pagos registrados"
                descripcion="Cuando pagues en administración o en portería, tu pago aparece acá."
                className="py-8"
              />
            ) : (
              <>
                <div className="divide-y">
                  {pagos.map((p) => (
                    <div
                      key={p.id}
                      className="flex min-h-14 items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">Recibo N° {p.numero}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatFechaTS(p.fecha)} ·{" "}
                          {p.medio === "transferencia" && p.titular_transferencia
                            ? `Transferencia de ${p.titular_transferencia}`
                            : (LABEL_MEDIO[p.medio] ?? p.medio)}
                        </p>
                      </div>
                      <Money monto={p.monto} className="shrink-0 font-semibold" />
                    </div>
                  ))}
                </div>
                <p className="mt-3 border-t pt-3 text-sm text-muted-foreground">
                  Estos pagos valen como constancia. Si necesitás el recibo
                  impreso, pedilo en administración.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* 7. Circulares */}
        {circularesVistas.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Circulares</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {circularesVistas.map((c) => {
                const url = c.storage_path ? urls.get(c.storage_path) : undefined;
                const fechaRecibida = recibidaEn.get(c.id);
                return (
                  <div key={c.id} className="space-y-1.5 py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">
                        Circular N° {c.numero} · {c.titulo}
                      </p>
                      <Sello estado={fechaRecibida ? "recibida" : "circular"} />
                    </div>
                    <p className="text-sm text-muted-foreground tabular">
                      {formatFecha(c.fecha)}
                      {fechaRecibida
                        ? ` · confirmaste el ${formatFechaTS(fechaRecibida)}`
                        : ""}
                    </p>
                    {c.detalle ? (
                      <p className="whitespace-pre-line text-[15px] leading-relaxed">
                        {c.detalle}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      {url ? (
                        <Button asChild variant="outline" className="mt-1 min-h-11 px-5">
                          <a href={url} target="_blank" rel="noopener noreferrer">
                            <FileText className="size-4" strokeWidth={2} />
                            Ver PDF
                          </a>
                        </Button>
                      ) : null}
                      {!c.obligatoria && !fechaRecibida ? (
                        <ConfirmarCircular
                          circularId={c.id}
                          numero={c.numero}
                          variante="leida"
                        />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : null}

        {/* 8. Documentos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tus documentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Subí acá la documentación que te pida administración
              (habilitaciones, apto eléctrico, etc.).
            </p>
            {documentos.length === 0 ? (
              <EmptyState
                icono={FileText}
                titulo="Todavía no hay documentos en tu carpeta"
                descripcion="Subí el primero con el botón de abajo."
                className="py-8"
              />
            ) : (
              <div className="divide-y">
                {documentos.map((d) => {
                  const url = urls.get(d.storage_path);
                  return (
                    <div
                      key={d.id}
                      className="flex min-h-14 items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{d.titulo}</p>
                        <p className="text-sm text-muted-foreground">
                          {labelCategoria(d.categoria)} ·{" "}
                          {formatFechaTS(d.creado_en)}
                        </p>
                      </div>
                      {url ? (
                        <Button
                          asChild
                          variant="outline"
                          className="min-h-11 shrink-0 px-5"
                        >
                          <a href={url} target="_blank" rel="noopener noreferrer">
                            Ver
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
            <SubirDocumento />
          </CardContent>
        </Card>

        {/* 9. Notificaciones, apercibimientos y sanciones */}
        {sanciones.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notificaciones</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {sanciones.map((s) => {
                const url = s.storage_path ? urls.get(s.storage_path) : undefined;
                return (
                  <div key={s.id} className="space-y-1.5 py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{s.titulo}</p>
                      <Sello estado={s.tipo} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatFecha(s.fecha)}
                    </p>
                    {s.detalle ? <p>{s.detalle}</p> : null}
                    {url ? (
                      <Button
                        asChild
                        variant="outline"
                        className="mt-1 min-h-11 px-5"
                      >
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          Ver documento
                        </a>
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
