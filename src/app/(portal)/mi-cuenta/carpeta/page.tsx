import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getClienteSocio, getCuentaSocio, getLugaresSocio } from "@/components/portal/datos-portal";
import type { LugarCarpeta } from "@/components/portal/lugares-carpeta";
import { PantallaCarpeta } from "@/components/portal/pantallas/pantalla-carpeta";
import { aLugarPlano, nombreMes } from "@/components/portal/armar-cuenta";
import { etiquetaEspacio } from "@/components/mapa/geometria";

export const metadata = { title: "Mi carpeta" };

export default async function CarpetaPage() {
  const perfil = await requireRol("socio");
  const [cliente, lugares, cuenta] = await Promise.all([
    getClienteSocio(perfil.user_id),
    getLugaresSocio(perfil.user_id),
    getCuentaSocio(perfil.user_id),
  ]);

  const supabase = await createClient();
  const { data: docs } = cliente
    ? await supabase
        .from("documentos_cliente")
        .select("id, titulo, categoria, creado_en, storage_path")
        .eq("cliente_id", cliente.id)
        .order("creado_en", { ascending: false })
    : { data: [] };
  const documentos = docs ?? [];
  const urls = new Map<string, string>();
  const paths = documentos.map((d) => d.storage_path).filter((p): p is string => Boolean(p));
  if (paths.length > 0) {
    const { data: firmadas } = await supabase.storage.from("documentos").createSignedUrls(paths, 3600);
    for (const f of firmadas ?? []) if (f.path && f.signedUrl) urls.set(f.path, f.signedUrl);
  }

  // Lo que se paga por cada lugar: lo del mes y lo que quedó atrasado.
  const conceptos = cuenta ? [...cuenta.conceptosMes, ...cuenta.atrasados.flatMap((x) => x.conceptos)] : [];
  const lugaresCarpeta: LugarCarpeta[] = lugares.map((l) => {
    const suyos = conceptos.filter((c) => c.lugares.includes(l.id));
    return {
      plano: aLugarPlano(l),
      etiqueta: etiquetaEspacio(l),
      tono:
        suyos.length === 0
          ? "neutro"
          : suyos.some((c) => c.tono === "vencido")
            ? "vencido"
            : suyos.every((c) => c.tono === "al_dia")
              ? "al_dia"
              : "en_termino",
      conceptos: suyos.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        sello: c.sello,
        monto: c.sello === "pagado" ? c.pagado : c.saldo,
        entre: c.lugares.length,
        mes: cuenta && c.periodo < cuenta.periodo ? nombreMes(c.periodo) : null,
      })),
    };
  });

  return (
    <PantallaCarpeta
      cliente={cliente}
      lugaresCarpeta={lugaresCarpeta}
      documentos={documentos.map((d) => ({
        id: d.id,
        titulo: d.titulo,
        categoria: d.categoria,
        creado_en: d.creado_en,
        url: urls.get(d.storage_path) ?? null,
      }))}
    />
  );
}
