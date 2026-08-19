import { Receipt, FileText } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  formatFecha,
  hoyISO,
  labelPeriodo,
  periodoActual,
  sumarMeses,
} from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Codigo } from "@/components/shared/codigo";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { BotonExportar } from "@/components/shared/boton-exportar";
import { SelectorMes } from "@/components/gastos/selector-mes";
import { DialogNuevoGasto } from "@/components/gastos/dialog-nuevo-gasto";
import { AccionesGasto } from "@/components/gastos/acciones-gasto";
import { AdjuntarFactura } from "@/components/gastos/adjuntar-factura";
import { SelloComprobante } from "@/components/gastos/sello-comprobante";

export const metadata = { title: "Gastos" };

const LABEL_MEDIO: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  cheque: "Cheque",
};

const ORDEN_ESTADO: Record<string, number> = {
  pendiente: 0,
  pagado: 1,
  anulado: 2,
};

export default async function GastosPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const perfil = await requireRol("admin", "tesoreria", "consejo", "lider");
  const sp = await searchParams;
  const periodo = /^\d{4}-\d{2}-01$/.test(sp.periodo ?? "")
    ? sp.periodo!
    : periodoActual();
  const finPeriodo = sumarMeses(periodo, 1);
  const hoy = hoyISO();

  const supabase = await createClient();
  const [gastosRes, rubrosRes, cajaRes] = await Promise.all([
    supabase
      .from("gastos")
      .select(
        "id, descripcion, tipo, monto, estado, vencimiento, fecha_pago, medio_pago, pagado_desde, factura_path, comprobante_validado, notas, creado_en, rubro:rubros_gasto(codigo, nombre)"
      ),
    supabase
      .from("rubros_gasto")
      .select("id, codigo, nombre")
      .eq("activo", true)
      .order("codigo"),
    supabase
      .from("cajas")
      .select("id")
      .eq("tipo", "administracion")
      .eq("fecha", hoy)
      .eq("estado", "abierta")
      .maybeSingle(),
  ]);

  const rubros = rubrosRes.data ?? [];
  const hayCajaAbierta = Boolean(cajaRes.data);
  // Consejo y Líder de Procesos solo miran; admin y tesorería operan.
  const puedeOperar = perfil.rol === "admin" || perfil.rol === "tesoreria";

  // Gastos del mes: coalesce(fecha_pago, vencimiento, creado_en) dentro del período.
  const delMes = (gastosRes.data ?? []).filter((g) => {
    const clave = g.fecha_pago ?? g.vencimiento ?? g.creado_en.slice(0, 10);
    return clave >= periodo && clave < finPeriodo;
  });

  // Vencimientos próximos primero; después los pagados y al final los anulados.
  delMes.sort((a, b) => {
    const ea = ORDEN_ESTADO[a.estado] ?? 3;
    const eb = ORDEN_ESTADO[b.estado] ?? 3;
    if (ea !== eb) return ea - eb;
    if (a.estado === "pendiente") {
      return (a.vencimiento ?? "9999-12-31").localeCompare(
        b.vencimiento ?? "9999-12-31"
      );
    }
    return (b.fecha_pago ?? b.creado_en).localeCompare(a.fecha_pago ?? a.creado_en);
  });

  const pagado = delMes
    .filter((g) => g.estado === "pagado")
    .reduce((acc, g) => acc + Number(g.monto), 0);
  const pendiente = delMes
    .filter((g) => g.estado === "pendiente")
    .reduce((acc, g) => acc + Number(g.monto), 0);
  const total = pagado + pendiente;

  // Link firmado para ver cada factura adjunta (1 h).
  const urlsFactura = new Map<string, string>();
  const paths = delMes
    .map((g) => g.factura_path)
    .filter((p): p is string => Boolean(p));
  if (paths.length > 0) {
    const { data: firmadas } = await supabase.storage
      .from("documentos")
      .createSignedUrls(paths, 3600);
    for (const f of firmadas ?? []) {
      if (f.path && f.signedUrl) urlsFactura.set(f.path, f.signedUrl);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Gastos"
        descripcion="Los gastos fijos y variables del mercado, mes a mes, con su comprobante."
      >
        <BotonExportar dataset="gastos" periodo={periodo} />
        {puedeOperar ? <DialogNuevoGasto rubros={rubros} /> : null}
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <SelectorMes periodo={periodo} />
        <div className="flex items-center gap-6 rounded-lg border bg-card px-5 py-3">
          <div>
            <p className="text-sm text-muted-foreground">Pagado</p>
            <Money className="text-lg font-bold text-pagado" monto={pagado} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Pendiente</p>
            <Money className="text-lg font-bold text-pendiente" monto={pendiente} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total</p>
            <Money className="text-lg font-bold" monto={total} />
          </div>
        </div>
      </div>

      {delMes.length === 0 ? (
        <EmptyState
          icono={Receipt}
          titulo={`No hay gastos cargados en ${labelPeriodo(periodo)}`}
          descripcion={
            puedeOperar
              ? "Cargá el primer gasto del mes con el botón de arriba."
              : "Cuando Administración o Tesorería carguen gastos, van a aparecer acá."
          }
        />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Vencimiento</TableHead>
                  <TableHead>Rubro</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Comprobante</TableHead>
                  <TableHead className="pr-4 text-right">Pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {delMes.map((g) => {
                  const vencidoYPendiente =
                    g.estado === "pendiente" &&
                    Boolean(g.vencimiento) &&
                    g.vencimiento! < hoy;
                  const urlFactura = g.factura_path
                    ? urlsFactura.get(g.factura_path)
                    : undefined;
                  return (
                    <TableRow key={g.id}>
                      <TableCell className="pl-4 tabular">
                        {g.vencimiento ? (
                          <span
                            className={
                              vencidoYPendiente
                                ? "font-semibold text-pendiente"
                                : undefined
                            }
                          >
                            {formatFecha(g.vencimiento)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {g.rubro ? <Codigo codigo={g.rubro.codigo} /> : "—"}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{g.descripcion}</p>
                        {g.notas ? (
                          <p className="max-w-56 truncate text-sm text-muted-foreground">
                            {g.notas}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {g.tipo === "fijo" ? "Fijo" : "Variable"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Money className="font-semibold" monto={g.monto} />
                      </TableCell>
                      <TableCell>
                        <Sello estado={g.estado} />
                      </TableCell>
                      <TableCell>
                        {g.estado === "anulado" ? (
                          "—"
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <SelloComprobante
                              estadoGasto={g.estado}
                              tieneFactura={Boolean(g.factura_path)}
                              validado={g.comprobante_validado}
                            />
                            {urlFactura ? (
                              <a
                                href={urlFactura}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex min-h-11 items-center gap-1.5 font-medium text-primary hover:underline"
                              >
                                <FileText className="size-4" strokeWidth={2} />
                                Ver
                              </a>
                            ) : !g.factura_path && puedeOperar ? (
                              <AdjuntarFactura
                                gasto={{
                                  id: g.id,
                                  descripcion: g.descripcion,
                                  monto: Number(g.monto),
                                }}
                              />
                            ) : null}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        {g.estado === "pendiente" && puedeOperar ? (
                          <AccionesGasto
                            gasto={{
                              id: g.id,
                              descripcion: g.descripcion,
                              monto: Number(g.monto),
                            }}
                            hayCajaAbierta={hayCajaAbierta}
                          />
                        ) : g.estado === "pagado" ? (
                          <span className="text-sm text-muted-foreground tabular">
                            {formatFecha(g.fecha_pago)}
                            {g.medio_pago
                              ? ` · ${LABEL_MEDIO[g.medio_pago] ?? g.medio_pago}`
                              : ""}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
