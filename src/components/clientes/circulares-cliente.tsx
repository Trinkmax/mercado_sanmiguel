import Link from "next/link";
import { ChevronRight, Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatFecha, formatFechaHora } from "@/lib/format";
import { clienteEnPublico } from "@/lib/segmentos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sello } from "@/components/shared/sello";
import { cargarClientesPublico } from "@/components/comunicaciones/datos";

/**
 * Circulares de la ficha del cliente (M5, contrato §6.10): SOLO las de su público (más las que
 * ya vio aunque hoy no le lleguen), con "La vio el …" / "Todavía no" / "Sin portal".
 */
export async function CircularesCliente({ clienteId }: { clienteId: string }) {
  const supabase = await createClient();
  const [clientes, circularesRes, recepcionesRes] = await Promise.all([
    cargarClientesPublico(supabase, { clienteId }),
    supabase
      .from("circulares")
      .select("id, numero, titulo, fecha, obligatoria, activa, publico")
      .order("numero", { ascending: false }),
    supabase.from("circular_recepciones").select("circular_id, recibida_en").eq("cliente_id", clienteId),
  ]);
  const cliente = clientes[0];
  const vio = new Map((recepcionesRes.data ?? []).map((r) => [r.circular_id, r.recibida_en]));
  const suyas = (circularesRes.data ?? []).filter(
    (c) => vio.has(c.id) || (c.activa && cliente && clienteEnPublico(cliente, c.publico))
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Circulares</CardTitle>
      </CardHeader>
      <CardContent>
        {suyas.length === 0 ? (
          <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Megaphone className="size-4" strokeWidth={1.8} />
            No hay circulares para su grupo.
          </p>
        ) : (
          <ul className="-mx-2 divide-y">
            {suyas.map((c) => {
              const fecha = vio.get(c.id);
              return (
                <li key={c.id}>
                  <Link
                    href={`/comunicaciones/${c.id}`}
                    className="flex min-h-14 items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-accent"
                  >
                    <span className="w-8 shrink-0 text-right font-display text-base font-bold tabular">
                      {c.numero}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span title={c.titulo} className="line-clamp-2 font-medium break-words">
                        {c.titulo}
                      </span>
                      <span className="text-xs tabular text-muted-foreground">
                        {formatFecha(c.fecha)} · {c.obligatoria ? "Obligatoria" : "Informativa"}
                        {!c.activa ? " · Desactivada" : ""}
                      </span>
                    </span>
                    {fecha ? (
                      <span className="shrink-0 text-right">
                        <Sello estado="la_vio" />
                        <span className="mt-0.5 block text-xs tabular text-muted-foreground">
                          {formatFechaHora(fecha)}
                        </span>
                      </span>
                    ) : (
                      <Sello estado={cliente?.tiene_portal ? "no_la_vio" : "sin_portal"} className="shrink-0" />
                    )}
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground max-sm:hidden" strokeWidth={2} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
