import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Users } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatFecha, formatFechaHora } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Sello } from "@/components/shared/sello";
import { BarraRecepcion } from "@/components/comunicaciones/barra-recepcion";
import { DesactivarCircular } from "@/components/comunicaciones/desactivar-circular";

export const metadata = { title: "Circular" };

export default async function CircularPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const perfil = await requireRol("admin", "consejo", "lider");
  const { id } = await params;
  const supabase = await createClient();

  const { data: c } = await supabase
    .from("circulares")
    .select("id, numero, titulo, detalle, fecha, obligatoria, activa, storage_path, creada_en, creada_por")
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();

  const [clientesRes, recepcionesRes, autorRes] = await Promise.all([
    supabase
      .from("clientes")
      .select("id, codigo, nombre, apodo")
      .eq("activo", true)
      .not("auth_user_id", "is", null)
      .order("codigo"),
    supabase
      .from("circular_recepciones")
      .select("cliente_id, recibida_en")
      .eq("circular_id", c.id),
    c.creada_por
      ? supabase.from("perfiles").select("nombre").eq("user_id", c.creada_por).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const clientes = clientesRes.data ?? [];
  const recibidaEn = new Map<string, string>();
  for (const r of recepcionesRes.data ?? []) recibidaEn.set(r.cliente_id, r.recibida_en);
  const recibidas = clientes.filter((cl) => recibidaEn.has(cl.id)).length;

  // Primero los que faltan (es lo que hay que perseguir), después los que ya confirmaron.
  const ordenados = [...clientes].sort((a, b) => {
    const ra = recibidaEn.has(a.id) ? 1 : 0;
    const rb = recibidaEn.has(b.id) ? 1 : 0;
    return ra - rb || a.codigo - b.codigo;
  });

  const pdfUrl = c.storage_path
    ? (await supabase.storage.from("documentos").createSignedUrl(c.storage_path, 3600)).data
        ?.signedUrl
    : undefined;

  const puedeEditar = perfil.rol === "admin" || perfil.rol === "lider";

  return (
    <div className="space-y-8">
      <PageHeader titulo={`Circular N° ${c.numero}`} descripcion={c.titulo}>
        <Sello estado={c.activa ? "activo" : "inactivo"} texto={c.activa ? "Activa" : "Inactiva"} />
        {pdfUrl ? (
          <Button asChild variant="outline" className="min-h-11">
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
              <FileText className="size-4" strokeWidth={2} />
              Ver PDF
            </a>
          </Button>
        ) : null}
        {puedeEditar && c.activa ? (
          <DesactivarCircular id={c.id} numero={c.numero} titulo={c.titulo} />
        ) : null}
        <Button asChild variant="ghost" className="min-h-11">
          <Link href="/comunicaciones">
            <ArrowLeft className="size-4" />
            Volver
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contenido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Fecha</dt>
                <dd className="font-medium tabular">{formatFecha(c.fecha)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Recepción</dt>
                <dd className="font-medium">
                  {c.obligatoria ? (
                    <span className="text-parcial">Obligatoria — bloquea el portal hasta confirmar</span>
                  ) : (
                    "Informativa"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">La publicó</dt>
                <dd className="font-medium">
                  {autorRes.data?.nombre ?? "—"}
                  <span className="tabular text-muted-foreground">
                    {" "}· {formatFechaHora(c.creada_en)}
                  </span>
                </dd>
              </div>
            </dl>
            <div className="border-t pt-4">
              {c.detalle ? (
                <p className="whitespace-pre-line text-[15px] leading-relaxed">{c.detalle}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Sin texto: el contenido está en el PDF adjunto.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recepción</CardTitle>
          </CardHeader>
          <CardContent>
            <BarraRecepcion recibidas={recibidas} total={clientes.length} />
            <p className="mt-3 text-sm text-muted-foreground">
              {clientes.length === 0
                ? "Ningún socio tiene acceso al portal todavía."
                : recibidas === clientes.length
                  ? "Todos los socios con acceso al portal la confirmaron."
                  : `Faltan ${clientes.length - recibidas} socios. La ven apenas entran al portal.`}
            </p>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-bold tracking-tight">
          Socios con acceso al portal
          <span className="ml-2 text-base font-normal text-muted-foreground tabular">
            {clientes.length}
          </span>
        </h2>
        {clientes.length === 0 ? (
          <EmptyState
            icono={Users}
            titulo="Ningún socio tiene usuario del portal"
            descripcion="Cuando se vinculen usuarios a las carpetas, acá vas a ver quién confirmó la recepción."
          />
        ) : (
          <Card className="py-0">
            <CardContent className="overflow-x-auto px-0">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">N°</TableHead>
                    <TableHead>Socio</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="pr-4">Confirmó el</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordenados.map((cl) => {
                    const fecha = recibidaEn.get(cl.id);
                    return (
                      <TableRow key={cl.id}>
                        <TableCell className="pl-4 font-display text-base font-bold tabular">
                          {cl.codigo}
                        </TableCell>
                        <TableCell>
                          <Link href={`/clientes/${cl.id}`} className="font-medium hover:underline">
                            {cl.nombre}
                          </Link>
                          {cl.apodo ? (
                            <span className="ml-2 text-muted-foreground">{cl.apodo}</span>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {fecha ? (
                            <Sello estado="recibida" texto={c.obligatoria ? "Recibida" : "Leída"} />
                          ) : c.obligatoria ? (
                            <Sello estado="sin_recibir" />
                          ) : (
                            <Sello estado="circular" texto="Sin leer" />
                          )}
                        </TableCell>
                        <TableCell className="pr-4 tabular text-muted-foreground">
                          {fecha ? formatFechaHora(fecha) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
