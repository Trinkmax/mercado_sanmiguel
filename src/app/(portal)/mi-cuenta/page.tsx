import { CheckCircle2, FileText, Receipt, UserX } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  formatFecha,
  formatFechaTS,
  hoyISO,
  labelPeriodo,
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
import { labelCategoria, LABEL_MEDIO } from "@/components/portal/constantes";

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

  const [cargosRes, pagosRes, docsRes, sancionesRes] = await Promise.all([
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
      .select("id, fecha, numero, monto, medio")
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

  // ---- El dato: cuánto debe hoy ----
  const pendientes = cargos.filter((c) => saldoCargo(c) > 0);
  const deudaTotal = pendientes.reduce((acc, c) => acc + Number(saldoCargo(c)), 0);
  const periodoMasViejo = pendientes.reduce(
    (min, c) => (c.periodo < min ? c.periodo : min),
    pendientes[0]?.periodo ?? periodo
  );

  const cargosMes = cargos.filter((c) => c.periodo === periodo);
  const exppEnTermino = cargosMes.find(
    (c) =>
      c.codigo === "EXPP" &&
      c.estado !== "pagado" &&
      c.descuento_pronto_pago > 0 &&
      hoy <= c.vencimiento
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

  // ---- Links firmados para ver documentos (1 h) ----
  const paths = [
    ...documentos.map((d) => d.storage_path),
    ...sanciones.map((s) => s.storage_path),
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
      {/* 1. Hero de estado */}
      <PageHeader
        titulo={`Hola, ${nombrePila}`}
        descripcion={`${cliente.nombre} · Carpeta N° ${cliente.codigo}`}
        className="pb-0"
      />

      <div className="etiqueta">
        {deudaTotal === 0 ? (
          <div className="etiqueta-interior flex flex-col items-center gap-4 bg-pagado-suave py-10 text-center">
            <Sello grande estado="al_dia" />
            <p className="text-lg font-medium">No debés nada. ¡Gracias!</p>
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
            {exppEnTermino ? (
              <p className="border-t pt-3 font-medium">
                Pagando antes del {formatFecha(exppEnTermino.vencimiento)}{" "}
                mantenés el descuento por pago en término.
              </p>
            ) : null}
          </div>
        )}
      </div>

      {/* 2. Conceptos del mes actual */}
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

      {/* 3. Meses anteriores */}
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

      {/* 4. Pagos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tus pagos</CardTitle>
        </CardHeader>
        <CardContent>
          {pagos.length === 0 ? (
            <EmptyState
              icono={Receipt}
              titulo="Todavía no hay pagos registrados"
              descripcion="Cuando pagues en administración o con el guardia, tu pago aparece acá."
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
                        {LABEL_MEDIO[p.medio] ?? p.medio}
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

      {/* 5. Documentos */}
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

      {/* 6. Notificaciones y sanciones */}
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
  );
}
