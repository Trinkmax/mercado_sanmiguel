import { FileCheck2 } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatFechaTS, labelPeriodo, periodoActual } from "@/lib/format";
import { categoriasDeRol, LABEL_CATEGORIA } from "@/lib/segmentos";
import { CATEGORIAS_LIBRES_DEUDA } from "@/lib/libre-deuda";
import { textoEspacios } from "@/components/mapa/geometria";
import type { TipoEspacio } from "@/components/mapa/tipos";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { AlertaError } from "@/components/cobranza/alerta-error";
import { mensajeDeError } from "@/lib/actions/result";
import { ListaLibresDeuda, type FilaLibreDeuda } from "@/components/libre-deuda/lista-libres-deuda";

export const metadata = { title: "Libres deuda" };

/**
 * Pedido de Administración (12/11/2026): «cuando un cliente paga el 100%, que nos marque una
 * alerta para que las chicas impriman los libres de deuda todos juntos… lo firman y se los
 * reparten». Los que pagaron todo el mes y no deben nada (libres_deuda_del_mes, 0064); el
 * número del menú cuenta los que todavía no se imprimieron.
 */
export default async function LibresDeudaPage() {
  const perfil = await requireRol("admin", "lider");
  const periodo = periodoActual();
  const mes = labelPeriodo(periodo).toLowerCase();
  const categorias = categoriasDeRol(perfil.rol).filter((c) => CATEGORIAS_LIBRES_DEUDA.includes(c));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("libres_deuda_del_mes", { p_periodo: periodo });
  const delMes = (data ?? [])
    .filter((f) => categorias.includes(f.categoria))
    .sort((a, b) => a.codigo - b.codigo);

  const ids = delMes.map((f) => f.cliente_id);
  const { data: espacios } =
    ids.length > 0
      ? await supabase
          .from("espacios")
          .select("cliente_id, tipo, numero, medio, propio, x, y")
          .eq("org_id", perfil.org_id)
          .in("cliente_id", ids)
      : { data: [] };

  const filas: FilaLibreDeuda[] = delMes.map((f) => {
    const lugares = textoEspacios(
      (espacios ?? [])
        .filter((e) => e.cliente_id === f.cliente_id)
        .map((e) => ({
          tipo: e.tipo as TipoEspacio,
          numero: e.numero,
          medio: e.medio,
          propio: e.propio,
          x: Number(e.x),
          y: Number(e.y),
        }))
    );
    return {
      clienteId: f.cliente_id,
      codigo: f.codigo,
      nombre: f.nombre,
      lugares: lugares || (categorias.length > 1 ? LABEL_CATEGORIA[f.categoria] : ""),
      completo: f.completo_en ? formatFechaTS(f.completo_en).slice(0, 5) : null,
      impreso: f.impreso_en ? formatFechaTS(f.impreso_en).slice(0, 5) : null,
      veces: f.veces ?? 0,
    };
  });
  const paraImprimir = filas.filter((f) => !f.impreso).length;

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Libres deuda"
        descripcion={`Los que ya pagaron todo ${mes}: imprimí sus libres deuda juntos, firmalos y entregalos.`}
      />

      {error ? (
        <AlertaError error={mensajeDeError(error)} titulo="No se pudo armar la lista" />
      ) : filas.length === 0 ? (
        <EmptyState
          icono={FileCheck2}
          titulo={`Todavía nadie pagó todo ${mes}`}
          descripcion="Apenas un cliente salda el mes completo y no debe nada de antes, aparece acá para imprimir su libre deuda."
        />
      ) : (
        <>
          <p className="text-base" data-tour="libres-resumen">
            {paraImprimir === 0
              ? `Ya imprimiste todos los de ${mes}. Si alguien más termina de pagar, aparece arriba de todo.`
              : paraImprimir === 1
                ? "1 cliente pagó todo y falta imprimir su libre deuda."
                : `${paraImprimir} clientes pagaron todo y falta imprimir sus libres deuda.`}{" "}
            <span className="text-muted-foreground">
              Salen uno por hoja. Al imprimir quedan anotados, y el número del menú se apaga.
            </span>
          </p>
          <ListaLibresDeuda filas={filas} />
          <p className="text-sm text-muted-foreground">
            Aparece quien pagó todo lo de {mes} y no debe nada de antes (ni lo que todavía no venció). Si
            después se le carga algo, sale de la lista hasta que lo pague.
          </p>
        </>
      )}
    </div>
  );
}
