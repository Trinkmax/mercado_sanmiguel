import { FileText } from "lucide-react";
import { formatFechaTS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { BorrarDocumento } from "@/components/clientes/borrar-documento";
import { SubirDocumento } from "@/components/clientes/subir-documento";
import { CATEGORIAS_DOCUMENTO, labelCategoria } from "@/components/clientes/constantes";

export type DocumentoFicha = {
  id: string;
  titulo: string;
  categoria: string;
  creado_en: string;
  subidoPor: string;
  url: string | null;
};

/**
 * Pestaña "Documentos": la carpeta agrupada por categoría, con un contador por categoría
 * arriba (de un vistazo se ve qué falta: habilitación, SENASA, apto eléctrico…) y el alta
 * con categorías libres (C7).
 */
export function DocumentosCliente({
  clienteId,
  documentos,
  usadas,
  puedeBorrar,
}: {
  clienteId: string;
  documentos: DocumentoFicha[];
  /** Categorías que ya usó la cooperativa (texto), para ofrecerlas como chip. */
  usadas: string[];
  puedeBorrar: boolean;
}) {
  const grupos = new Map<string, DocumentoFicha[]>();
  for (const d of documentos) {
    const clave = labelCategoria(d.categoria);
    grupos.set(clave, [...(grupos.get(clave) ?? []), d]);
  }
  const sugeridas: string[] = CATEGORIAS_DOCUMENTO.map((c) => c.label);
  const resumen = [
    ...sugeridas.map((c) => ({ categoria: c, cantidad: grupos.get(c)?.length ?? 0 })),
    ...[...grupos.entries()]
      .filter(([c]) => !sugeridas.includes(c))
      .map(([c, lista]) => ({ categoria: c, cantidad: lista.length })),
  ];
  const ordenGrupos = resumen.filter((r) => r.cantidad > 0).map((r) => r.categoria);

  return (
    <div className="space-y-6">
      <Card className="text-base">
        <CardHeader>
          <CardTitle className="text-lg">La carpeta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <ul className="flex flex-wrap gap-2" aria-label="Documentos por categoría">
            {resumen.map((r) => (
              <li
                key={r.categoria}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm",
                  r.cantidad > 0 ? "bg-card font-medium" : "border-dashed text-muted-foreground"
                )}
              >
                {r.categoria}
                <span className="tabular text-xs font-semibold text-muted-foreground">
                  {r.cantidad > 0 ? r.cantidad : "Sin cargar"}
                </span>
              </li>
            ))}
          </ul>

          {documentos.length === 0 ? (
            <EmptyState
              icono={FileText}
              titulo="La carpeta está vacía"
              descripcion="Subí abajo la habilitación, el SENASA, el apto eléctrico o lo que haga falta guardar."
            />
          ) : (
            <div className="space-y-5">
              {ordenGrupos.map((categoria) => (
                <section key={categoria} className="space-y-1">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    {categoria} ({grupos.get(categoria)?.length ?? 0})
                  </h3>
                  <div className="divide-y rounded-lg border">
                    {(grupos.get(categoria) ?? []).map((d) => (
                      <div key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
                        <FileText className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{d.titulo}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatFechaTS(d.creado_en)} · Subió {d.subidoPor}
                          </p>
                        </div>
                        {d.url ? (
                          <Button asChild variant="outline" className="h-11 px-4">
                            <a href={d.url} target="_blank" rel="noreferrer">
                              Ver
                            </a>
                          </Button>
                        ) : null}
                        {puedeBorrar ? (
                          <BorrarDocumento id={d.id} clienteId={clienteId} titulo={d.titulo} />
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <SubirDocumento clienteId={clienteId} usadas={usadas} />
    </div>
  );
}
