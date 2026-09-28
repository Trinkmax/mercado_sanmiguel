import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  MessageSquareWarning,
  MessagesSquare,
  Plus,
  Receipt,
  UserX,
} from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  formatFecha,
  formatFechaHora,
  formatFechaTS,
  hoyISO,
  labelPeriodo,
  nivelDeuda,
  periodoActual,
  saldoCargo,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { SubirDocumento } from "@/components/portal/subir-documento";
import { SemaforoDeuda } from "@/components/portal/semaforo-deuda";
import { labelCategoria, LABEL_MEDIO } from "@/components/portal/constantes";
import { getClienteSocio, getResumenComunicaciones } from "@/components/portal/datos-portal";
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

/** Estado a mostrar: un cargo impago (pendiente o parcial) ya vencido se sella "Vencido". */
function estadoSello(cargo: Cargo): string {
  if ((cargo.estado === "pendiente" || cargo.estado === "parcial") && cargo.vencimiento < hoyISO())
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

type Recibo = {
  pagoId: string;
  numero: number;
  fecha: string;
  total: number;
  medios: string[];
  titular: string | null;
};

export default async function MiCuentaPage() {
  const perfil = await requireRol("socio");
  const supabase = await createClient();
  const periodo = periodoActual();
  const nombrePila = perfil.nombre.split(" ")[0];

  const cliente = await getClienteSocio(perfil.user_id);
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

  const [cargosRes, pagosRes, docsRes, deudaRes, saldoFavorRes, solicitudesRes, resumen] =
    await Promise.all([
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
        .select("id, fecha, numero, monto, medio, titular_transferencia, lote_id, linea")
        .eq("cliente_id", cliente.id)
        .eq("anulado", false)
        .order("fecha", { ascending: false })
        .order("numero", { ascending: false })
        .order("linea", { ascending: true })
        .limit(40),
      supabase
        .from("documentos_cliente")
        .select("id, titulo, categoria, creado_en, storage_path")
        .eq("cliente_id", cliente.id)
        .order("creado_en", { ascending: false }),
      supabase
        .from("v_deuda_clientes")
        .select("deuda, deuda_vencida, vencido_desde, proximo_vencimiento")
        .eq("cliente_id", cliente.id)
        .maybeSingle(),
      supabase
        .from("v_saldo_favor")
        .select("saldo_favor")
        .eq("cliente_id", cliente.id)
        .maybeSingle(),
      supabase
        .from("solicitudes")
        .select("id, numero, tipo, asunto, estado, actualizada_en")
        .eq("cliente_id", cliente.id)
        .order("actualizada_en", { ascending: false }),
      getResumenComunicaciones(perfil.user_id),
    ]);

  const cargos: Cargo[] = (cargosRes.data ?? []).map((c) => ({
    ...c,
    periodo: c.periodo.slice(0, 10),
    monto: Number(c.monto),
    monto_pagado: Number(c.monto_pagado),
    descuento_pronto_pago: Number(c.descuento_pronto_pago),
  }));
  const documentos = docsRes.data ?? [];
  const solicitudes = solicitudesRes.data ?? [];

  // ---- Semáforo (B3): la cuenta sale de v_deuda_clientes + v_saldo_favor ----
  const deuda = Number(deudaRes.data?.deuda ?? 0);
  const deudaVencida = Number(deudaRes.data?.deuda_vencida ?? 0);
  const saldoFavor = Number(saldoFavorRes.data?.saldo_favor ?? 0);
  const nivel = nivelDeuda({ deuda, deudaVencida, saldoFavor });
  const saldoFavorAplicado = Math.min(saldoFavor, deuda);
  const aPagar = Math.max(Math.round((deuda - saldoFavorAplicado) * 100) / 100, 0);
  const saldoFavorSobrante = Math.max(Math.round((saldoFavor - saldoFavorAplicado) * 100) / 100, 0);
  const pendientes = cargos.filter((c) => saldoCargo(c) > 0);
  const beneficioEnTermino = pendientes.reduce((acc, c) => acc + Number(beneficioCargo(c)), 0);

  const cargosMes = cargos.filter((c) => c.periodo === periodo);

  // ---- Meses anteriores, agrupados por período ----
  const porPeriodo = new Map<string, Cargo[]>();
  for (const c of cargos.filter((x) => x.periodo < periodo)) {
    const lista = porPeriodo.get(c.periodo);
    if (lista) lista.push(c);
    else porPeriodo.set(c.periodo, [c]);
  }
  const periodosAnteriores = [...porPeriodo.entries()].sort(([a], [b]) => (a < b ? 1 : -1));

  // ---- Tus pagos: una fila por recibo (lote), con todos sus medios ----
  const recibos: Recibo[] = [];
  const porLote = new Map<string, Recibo>();
  for (const p of pagosRes.data ?? []) {
    const clave = p.lote_id ?? p.id;
    const existente = porLote.get(clave);
    if (existente) {
      existente.total += Number(p.monto);
      if (!existente.medios.includes(p.medio)) existente.medios.push(p.medio);
      continue;
    }
    const nuevo: Recibo = {
      pagoId: p.id,
      numero: p.numero,
      fecha: p.fecha,
      total: Number(p.monto),
      medios: [p.medio],
      titular: p.medio === "transferencia" ? p.titular_transferencia : null,
    };
    porLote.set(clave, nuevo);
    recibos.push(nuevo);
  }
  const ultimosRecibos = recibos.slice(0, 10);

  // ---- Lo que requiere acción (va arriba, después del semáforo) ----
  const aResponder = resumen.aResponder.apercibimientos + resumen.aResponder.sanciones;
  const acciones: { href: string; texto: string; icono: typeof Bell }[] = [];
  if (resumen.aResponder.apercibimientos > 0)
    acciones.push({
      href: "/mi-cuenta/comunicaciones?tab=apercibimientos",
      texto:
        resumen.aResponder.apercibimientos === 1
          ? "Tenés 1 apercibimiento para responder"
          : `Tenés ${resumen.aResponder.apercibimientos} apercibimientos para responder`,
      icono: MessageSquareWarning,
    });
  if (resumen.aResponder.sanciones > 0)
    acciones.push({
      href: "/mi-cuenta/comunicaciones?tab=sanciones",
      texto:
        resumen.aResponder.sanciones === 1
          ? "Tenés 1 sanción para responder"
          : `Tenés ${resumen.aResponder.sanciones} sanciones para responder`,
      icono: MessageSquareWarning,
    });
  if (resumen.total > 0) {
    const tab =
      resumen.nuevas.apercibimientos > 0
        ? "apercibimientos"
        : resumen.nuevas.sanciones > 0
          ? "sanciones"
          : resumen.nuevas.notificaciones > 0
            ? "notificaciones"
            : "circulares";
    acciones.push({
      href: `/mi-cuenta/comunicaciones?tab=${tab}`,
      texto:
        resumen.total === 1
          ? "Tenés 1 comunicación nueva"
          : `Tenés ${resumen.total} comunicaciones nuevas`,
      icono: Bell,
    });
  }

  // ---- Links firmados para ver documentos (1 h) ----
  const urls = new Map<string, string>();
  const paths = documentos.map((d) => d.storage_path).filter((p): p is string => Boolean(p));
  if (paths.length > 0) {
    const { data: firmadas } = await supabase.storage
      .from("documentos")
      .createSignedUrls(paths, 3600);
    for (const f of firmadas ?? []) if (f.path && f.signedUrl) urls.set(f.path, f.signedUrl);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        titulo={`Hola, ${nombrePila}`}
        descripcion={`${cliente.nombre} · Carpeta N° ${cliente.codigo}`}
        className="pb-0"
      />

      {/* 1. Semáforo de la cuenta */}
      <SemaforoDeuda
        nivel={nivel}
        aPagar={aPagar}
        vencido={deudaVencida}
        vencidoDesde={deudaRes.data?.vencido_desde ?? null}
        enTermino={Math.max(deuda - deudaVencida, 0)}
        proximoVencimiento={deudaRes.data?.proximo_vencimiento ?? null}
        beneficio={beneficioEnTermino}
        saldoFavorAplicado={saldoFavorAplicado}
        saldoFavorSobrante={saldoFavorSobrante}
      />

      {/* 2. Lo que requiere acción */}
      {acciones.length > 0 ? (
        <Card className="gap-0 overflow-hidden border-2 border-parcial/50 py-0">
          {acciones.map((a) => {
            const Icono = a.icono;
            return (
              <Link
                key={a.href + a.texto}
                href={a.href}
                className="flex min-h-14 items-center gap-3 border-b px-4 py-3 last:border-b-0 transition-colors hover:bg-parcial-suave/60 active:bg-parcial-suave"
              >
                <Icono className="size-5 shrink-0 text-parcial" strokeWidth={2} />
                <span className="flex-1 text-base font-semibold">{a.texto}</span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" strokeWidth={2} />
              </Link>
            );
          })}
          {aResponder > 0 ? (
            <p className="bg-parcial-suave/50 px-4 py-2 text-sm text-muted-foreground">
              Podés contar tu versión y adjuntar una foto. Te respondemos por ahí mismo.
            </p>
          ) : null}
        </Card>
      ) : null}

      {/* 3. Conceptos del mes actual */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tus conceptos de {labelPeriodo(periodo)}</CardTitle>
        </CardHeader>
        <CardContent>
          {cargosMes.length === 0 ? (
            <p className="py-2 text-muted-foreground">
              Todavía no hay cargos de {labelPeriodo(periodo)}. Cuando se generen, los vas a ver acá.
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

      {/* 4. Pagos, con su recibo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tus pagos</CardTitle>
        </CardHeader>
        <CardContent>
          {ultimosRecibos.length === 0 ? (
            <EmptyState
              icono={Receipt}
              titulo="Todavía no hay pagos registrados"
              descripcion="Cuando pagues en administración o en portería, tu pago y su recibo aparecen acá."
              className="py-8"
            />
          ) : (
            <>
              <div className="divide-y">
                {ultimosRecibos.map((r) => (
                  <div key={r.pagoId} className="flex min-h-16 items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        Recibo N° <span className="tabular">{r.numero}</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <span className="tabular">{formatFechaTS(r.fecha)}</span> ·{" "}
                        {r.medios.length === 1 && r.titular
                          ? `Transferencia de ${r.titular}`
                          : r.medios.map((m) => LABEL_MEDIO[m] ?? m).join(" + ")}
                      </p>
                    </div>
                    <Money monto={r.total} className="shrink-0 font-semibold" />
                    <Button asChild variant="outline" className="min-h-11 shrink-0 px-3.5">
                      <Link href={`/recibos/${r.pagoId}`} aria-label={`Ver el recibo N° ${r.numero}`}>
                        <Download className="size-4" strokeWidth={2} />
                        Recibo
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
              <p className="mt-3 border-t pt-3 text-sm text-muted-foreground">
                Tocá <span className="font-medium text-foreground">Recibo</span> para verlo,
                guardarlo en PDF o imprimirlo.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* 5. Meses anteriores */}
      {periodosAnteriores.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Meses anteriores</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {periodosAnteriores.map(([per, items]) => {
              const todoPagado = items.every((c) => c.estado === "pagado");
              const deudaPeriodo = items.reduce((acc, c) => acc + Number(saldoCargo(c)), 0);
              return todoPagado ? (
                <div key={per} className="flex min-h-14 items-center justify-between gap-3 py-3">
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
                      <Money monto={deudaPeriodo} className="font-semibold text-pendiente" />
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

      {/* 6. Solicitudes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tus solicitudes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Pedidos, reclamos, informes o consultas a la administración. Acá seguís cómo van y
            podés responder.
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
                      <span className="line-clamp-2 font-medium leading-snug">{s.asunto}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                        <ChipTipo tipo={s.tipo} />
                        <span className="tabular">Actualizada {formatFechaHora(s.actualizada_en)}</span>
                      </span>
                    </span>
                    <Sello estado={selloEstado(s.estado)} className="shrink-0" />
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" strokeWidth={2} />
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

      {/* 7. Documentos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tus documentos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Subí acá la documentación que te pida administración (habilitaciones, apto
            eléctrico, etc.).
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
                  <div key={d.id} className="flex min-h-14 items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">{d.titulo}</p>
                      <p className="text-sm text-muted-foreground">
                        {labelCategoria(d.categoria)} · {formatFechaTS(d.creado_en)}
                      </p>
                    </div>
                    {url ? (
                      <Button asChild variant="outline" className="min-h-11 shrink-0 px-5">
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
    </div>
  );
}
