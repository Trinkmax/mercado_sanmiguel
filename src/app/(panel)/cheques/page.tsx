import Link from "next/link";
import { ArrowRight, Banknote, Landmark } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatARS, formatFecha, hoyISO, periodoActual } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { BotonExportar } from "@/components/shared/boton-exportar";
import { AccionesCheque } from "@/components/cheques/acciones-cheque";
import {
  FiltroEstado,
  FILTROS_CHEQUES,
  hrefFiltroCheque,
  type FiltroCheque,
} from "@/components/cheques/filtro-estado";

export const metadata = { title: "Cheques" };

const VACIOS: Record<FiltroCheque, { titulo: string; descripcion: string }> = {
  listos: {
    titulo: "No hay cheques listos para depositar",
    descripcion:
      "Los cheques diferidos quedan en la cartera y pasan a esta lista cuando llega su fecha de cobro.",
  },
  en_cartera: {
    titulo: "No hay cheques en cartera",
    descripcion: "Cuando cobres con cheque desde Cobrar, queda guardado acá.",
  },
  depositado: {
    titulo: "No hay cheques depositados",
    descripcion: "Cuando deposites un cheque de la cartera, aparece acá.",
  },
  acreditado: {
    titulo: "Todavía no se acreditó ningún cheque",
    descripcion: "Cuando el banco acredite un depósito, marcalo y aparece acá.",
  },
  rechazado: {
    titulo: "No hay cheques rechazados",
    descripcion: "Si el banco rebota un cheque, marcalo como rechazado.",
  },
  todos: {
    titulo: "Todavía no se registró ningún cheque",
    descripcion: "Cuando cobres con cheque desde Cobrar, queda guardado acá.",
  },
};

export default async function ChequesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const perfil = await requireRol("admin", "tesoreria", "consejo", "lider");
  const { estado } = await searchParams;
  const filtro: FiltroCheque = FILTROS_CHEQUES.some((f) => f.valor === estado)
    ? (estado as FiltroCheque)
    : "en_cartera";

  const supabase = await createClient();
  const hoy = hoyISO();

  const { data } = await supabase
    .from("cheques")
    .select(
      "id, numero, banco, titular, es_tercero, monto, estado, fecha_recibido, fecha_cobro, fecha_depositado, fecha_acreditado, cliente:clientes(nombre, codigo)"
    )
    .order("fecha_cobro", { ascending: true });
  const cheques = data ?? [];

  const estaListo = (c: { estado: string; fecha_cobro: string }) =>
    c.estado === "en_cartera" && c.fecha_cobro <= hoy;

  const enCartera = cheques.filter((c) => c.estado === "en_cartera");
  const listos = enCartera.filter(estaListo);
  const totalCartera = enCartera.reduce((acc, c) => acc + Number(c.monto), 0);
  const totalListos = listos.reduce((acc, c) => acc + Number(c.monto), 0);

  const conteos: Record<FiltroCheque, number> = {
    listos: listos.length,
    en_cartera: enCartera.length,
    depositado: cheques.filter((c) => c.estado === "depositado").length,
    acreditado: cheques.filter((c) => c.estado === "acreditado").length,
    rechazado: cheques.filter((c) => c.estado === "rechazado").length,
    todos: cheques.length,
  };

  const filtrados =
    filtro === "todos"
      ? cheques
      : filtro === "listos"
        ? listos
        : cheques.filter((c) => c.estado === filtro);

  // Consejo y Líder de Procesos solo miran; admin y tesorería operan.
  const puedeOperar = perfil.rol === "admin" || perfil.rol === "tesoreria";

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Cheques"
        descripcion="La cartera de cheques: recibidos, depositados y acreditados."
      >
        <BotonExportar dataset="cheques" periodo={periodoActual()} label="Cheques del mes (.xlsx)" />
        <div className="rounded-lg border bg-card px-5 py-3 text-right">
          <p className="text-sm text-muted-foreground">Total en cartera</p>
          <p className="text-2xl font-bold tabular">{formatARS(totalCartera)}</p>
        </div>
      </PageHeader>

      {listos.length > 0 ? (
        <Card className="bg-parcial-suave ring-parcial/50">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <Landmark className="size-6 shrink-0 text-parcial" strokeWidth={1.9} />
              <div>
                <p className="font-semibold">
                  {listos.length === 1
                    ? `Tenés 1 cheque listo para depositar por ${formatARS(totalListos)}`
                    : `Tenés ${listos.length} cheques listos para depositar por ${formatARS(totalListos)}`}
                </p>
                <p className="text-sm text-muted-foreground">
                  Ya se pueden cobrar: llevalos al banco y marcalos como depositados.
                </p>
              </div>
            </div>
            {filtro !== "listos" ? (
              <Button asChild variant="outline" className="h-11 bg-card px-4 font-semibold">
                <Link href={hrefFiltroCheque("listos")}>
                  Ver los listos
                  <ArrowRight className="size-4" strokeWidth={2} />
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-4">
        <FiltroEstado activo={filtro} conteos={conteos} />

        {filtrados.length === 0 ? (
          <EmptyState
            icono={Banknote}
            titulo={VACIOS[filtro].titulo}
            descripcion={VACIOS[filtro].descripcion}
          />
        ) : (
          <Card className="py-0">
            <CardContent className="px-0">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">N° cheque</TableHead>
                    <TableHead>Banco</TableHead>
                    <TableHead>Titular</TableHead>
                    <TableHead>Lo entregó</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Recibido</TableHead>
                    <TableHead>Se cobra desde</TableHead>
                    <TableHead>Estado</TableHead>
                    {puedeOperar ? (
                      <TableHead className="pr-4 text-right">Acciones</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((c) => {
                    const listo = estaListo(c);
                    const diferido = c.estado === "en_cartera" && !listo;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="pl-4 font-semibold tabular">
                          {c.numero}
                        </TableCell>
                        <TableCell>{c.banco ?? "—"}</TableCell>
                        <TableCell>
                          <span className="inline-flex flex-wrap items-center gap-1.5">
                            {c.titular}
                            {c.es_tercero ? (
                              <Badge variant="outline">De tercero</Badge>
                            ) : null}
                          </span>
                        </TableCell>
                        <TableCell>
                          {c.cliente ? (
                            <span>
                              <span className="tabular text-muted-foreground">
                                {c.cliente.codigo}
                              </span>{" "}
                              {c.cliente.nombre}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Money className="font-semibold" monto={c.monto} />
                        </TableCell>
                        <TableCell className="tabular">
                          {formatFecha(c.fecha_recibido)}
                        </TableCell>
                        <TableCell className="tabular">
                          {diferido ? (
                            <span className="font-medium text-parcial">
                              Diferido al {formatFecha(c.fecha_cobro)}
                            </span>
                          ) : (
                            formatFecha(c.fecha_cobro)
                          )}
                        </TableCell>
                        <TableCell>
                          <Sello estado={listo ? "listo_depositar" : c.estado} />
                        </TableCell>
                        {puedeOperar ? (
                          <TableCell className="pr-4">
                            <AccionesCheque
                              cheque={{
                                id: c.id,
                                numero: c.numero,
                                banco: c.banco,
                                monto: Number(c.monto),
                                estado: c.estado,
                                fechaCobro: c.fecha_cobro,
                                puedeDepositar: listo,
                              }}
                            />
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
