import type { Perfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatFecha } from "@/lib/format";
import { Sello } from "@/components/shared/sello";
import { ConfirmarCircular } from "@/components/portal/confirmar-circular";
import { getResumenComunicaciones } from "@/components/portal/datos-portal";
import { BotonDocumento } from "@/components/portal/hilo-portal";
import { BotonSalir } from "@/components/portal/boton-salir";

/**
 * Bloqueo por circulares obligatorias (va después de GateTerminos, en el layout): mientras
 * haya alguna de SU público sin confirmar, el portal entero muestra solo esas circulares.
 */
export async function GateCirculares({ perfil, children }: { perfil: Perfil; children: React.ReactNode }) {
  const { obligatoriasPendientes: pendientes } = await getResumenComunicaciones(perfil.user_id);
  if (pendientes.length === 0) return <>{children}</>;

  const paths = pendientes.map((c) => c.storage_path).filter((p): p is string => Boolean(p));
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const supabase = await createClient();
    const { data } = await supabase.storage.from("documentos").createSignedUrls(paths, 3600);
    for (const f of data ?? []) if (f.path && f.signedUrl) urls.set(f.path, f.signedUrl);
  }

  return (
    <>
      <div className="portal-espacio-chico !min-h-[11rem]" data-tour="encabezado socio-comunicaciones-bloqueo">
        <h1 className="portal-titulo">
          {pendientes.length === 1 ? "Tenés una circular para leer" : `Tenés ${pendientes.length} circulares para leer`}
        </h1>
        <p className="portal-bajada">
          Leela y tocá <strong className="font-extrabold">Confirmo que la recibí</strong>. Después ves tu cuenta como
          siempre.
        </p>
      </div>
      <div className="portal-suelo !gap-3 !pt-1">
        {pendientes.map((c) => {
          const url = c.storage_path ? urls.get(c.storage_path) : undefined;
          return (
            <section key={c.id} className="hoja flex flex-col gap-3 px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Sello estado="sin_recibir" />
                <p className="text-[0.98rem] text-tinta-2 tabular">
                  Circular N° {c.numero} · {formatFecha(c.fecha)}
                </p>
              </div>
              <h2 className="text-[1.3rem] leading-tight font-extrabold [font-stretch:92%] text-balance">{c.titulo}</h2>
              {c.detalle ? <p className="text-[1.08rem] leading-relaxed whitespace-pre-line">{c.detalle}</p> : null}
              {url ? <BotonDocumento href={url}>Abrir el PDF de la circular</BotonDocumento> : null}
              <ConfirmarCircular circularId={c.id} numero={c.numero} />
            </section>
          );
        })}
        <BotonSalir className="pt-1" />
      </div>
    </>
  );
}
