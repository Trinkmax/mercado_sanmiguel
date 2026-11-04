import Link from "next/link";
import { BookOpen, ChevronRight, FileText } from "lucide-react";
import { formatFechaTS } from "@/lib/format";
import { LABEL_CATEGORIA, type CategoriaCliente } from "@/lib/segmentos";
import { labelCategoria } from "@/components/portal/constantes";
import { LugaresCarpeta, type LugarCarpeta } from "@/components/portal/lugares-carpeta";
import { SubirDocumento } from "@/components/portal/subir-documento";
import { BotonSalir } from "@/components/portal/boton-salir";

export type DocumentoPortal = {
  id: string;
  titulo: string;
  categoria: string;
  creado_en: string;
  url: string | null;
};

/** La carpeta numerada, en el celular: quién sos, qué tenés en el mercado y tus papeles. */
export function PantallaCarpeta({
  cliente,
  lugaresCarpeta,
  documentos,
}: {
  cliente: { nombre: string; codigo: number; categoria: CategoriaCliente } | null;
  lugaresCarpeta: LugarCarpeta[];
  documentos: DocumentoPortal[];
}) {
  return (
    <>
      <div className="portal-espacio-chico" data-tour="encabezado">
        <h1 className="portal-titulo">Mi carpeta</h1>
        {cliente ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="chapa text-[1.08rem]" data-tour="carpeta-numero">
              Carpeta N° {cliente.codigo}
            </span>
            <span className="min-w-0 text-[1.05rem] font-bold">
              {cliente.nombre} · {LABEL_CATEGORIA[cliente.categoria]}
            </span>
          </div>
        ) : null}
      </div>

      <div className="portal-suelo !pt-1">
        {lugaresCarpeta.length > 0 ? (
          <section className="portal-seccion" data-tour="carpeta-lugares">
            <h2 className="portal-seccion-titulo">Tus lugares en el mercado</h2>
            <p className="portal-seccion-nota">Tocá uno y te muestro dónde queda.</p>
            <LugaresCarpeta lugares={lugaresCarpeta} />
          </section>
        ) : null}

        <section className="portal-seccion" data-tour="portal-documentos">
          <h2 className="portal-seccion-titulo">Tus papeles</h2>
          <p className="portal-seccion-nota">La habilitación, el apto eléctrico: lo que te pida Administración.</p>
          {documentos.length > 0 ? (
            <ul className="hoja hoja-filas">
              {documentos.map((d) => {
                const url = d.url;
                const contenido = (
                  <>
                    <span className="fila-icono" aria-hidden>
                      <FileText strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="fila-titulo block">{d.titulo}</span>
                      <span className="fila-sub block">
                        {labelCategoria(d.categoria)} · {formatFechaTS(d.creado_en)}
                      </span>
                    </span>
                    {url ? <ChevronRight aria-hidden className="-mr-1.5 size-5 shrink-0 text-tinta-2" strokeWidth={2.2} /> : null}
                  </>
                );
                return (
                  <li key={d.id}>
                    {url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer" className="fila-toque rounded-[inherit]">
                        {contenido}
                      </a>
                    ) : (
                      <div className="fila-toque rounded-[inherit]">{contenido}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}
          <SubirDocumento />
        </section>

        <section className="portal-seccion">
          <h2 className="portal-seccion-titulo">Ayuda</h2>
          <Link href="/mi-cuenta/guia" className="hoja fila-toque">
            <span className="fila-icono" aria-hidden>
              <BookOpen strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="fila-titulo block">Cómo se usa el portal</span>
              <span className="fila-sub block">Te lo muestro paso a paso, sobre la pantalla.</span>
            </span>
            <ChevronRight aria-hidden className="-mr-1.5 size-5 shrink-0 text-tinta-2" strokeWidth={2.2} />
          </Link>
          <p className="px-1.5 text-[1rem] leading-snug text-pretty">
            ¿Te olvidaste la contraseña o algo no coincide? Preguntá en Administración.
          </p>
        </section>

        <BotonSalir ancla className="pt-1" />
      </div>
    </>
  );
}
