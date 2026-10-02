import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { aplicaDirecto, requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { categoriasDeRol, CATEGORIAS, type CategoriaCliente } from "@/lib/segmentos";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { FormCliente } from "@/components/clientes/form-cliente";
import { conceptoAsignablePorRol } from "@/components/clientes/constantes";

export const metadata = { title: "Nuevo cliente" };

type Props = { searchParams: Promise<{ categoria?: string }> };

export default async function NuevoClientePage({ searchParams }: Props) {
  const perfil = await requireRol("admin", "guardia", "lider");
  const { categoria: categoriaParam } = await searchParams;
  const categoriasRol = categoriasDeRol(perfil.rol);
  const categoriaInicial = CATEGORIAS.includes(categoriaParam as CategoriaCliente)
    ? (categoriaParam as CategoriaCliente)
    : undefined;
  const supabase = await createClient();

  const [codigoRes, conceptosRes, configRes] = await Promise.all([
    // Mira TODOS los clientes y las altas pendientes (el Jefe no los ve por RLS).
    supabase.rpc("siguiente_codigo_cliente"),
    supabase
      .from("conceptos")
      .select("id, codigo, nombre, tipo, precio, descuento_pronto_pago, segmento, activo")
      .eq("activo", true)
      .order("orden_imputacion"),
    supabase.from("configuracion").select("cuotas_default_quintero").maybeSingle(),
  ]);

  // Lo que el rol puede asignar en alguna de las categorías que da de alta (el formulario
  // muestra lo de la elegida): a Administración también le llega la quinta, para el puestero
  // que además alquila una (0046).
  const conceptos = (conceptosRes.data ?? [])
    .filter((c) => categoriasRol.some((cat) => conceptoAsignablePorRol(c, perfil.rol, cat)))
    .map((c) => ({
      id: c.id,
      codigo: c.codigo,
      nombre: c.nombre,
      precio: Number(c.precio),
      descuentoPp: Number(c.descuento_pronto_pago),
      segmento: c.segmento,
    }));
  const esJefe = perfil.rol === "guardia";
  const soloAmbulante = categoriaInicial === "ambulante" && categoriasRol.includes("ambulante");

  const titulo = soloAmbulante
    ? "Nuevo ambulante"
    : esJefe
      ? "Nuevo quintero o ambulante"
      : categoriasRol.length === 1
        ? "Nuevo puestero"
        : "Nuevo cliente";
  const descripcion = soloAmbulante
    ? "Nombre, apodo y, si lo tiene, DNI y teléfono. Queda cargado en el acto y le podés cobrar enseguida."
    : aplicaDirecto(perfil.rol)
      ? "Abrí la carpeta y marcá qué paga cada mes. Documentos y medidores se cargan después desde su carpeta."
      : esJefe
        ? "El quintero lo aprueba el Líder de Procesos; el ambulante queda cargado en el acto para cobrarle."
        : "Cargá los datos y qué paga cada mes; el alta la aprueba el Líder de Procesos.";

  return (
    <div className="space-y-8">
      <PageHeader titulo={titulo} descripcion={descripcion}>
        <Button asChild variant="ghost" size="lg" className="h-12 px-4 text-base">
          <Link href={soloAmbulante && esJefe ? "/cobranza" : "/clientes"}>
            <ArrowLeft className="size-5" />
            Volver
          </Link>
        </Button>
      </PageHeader>
      <div className="max-w-2xl">
        {codigoRes.error ? (
          <p className="text-base font-medium text-pendiente">
            No pudimos calcular el próximo N° de carpeta. Recargá la página.
          </p>
        ) : null}
        <FormCliente
          codigoSugerido={codigoRes.data ?? undefined}
          conceptos={conceptos}
          rol={perfil.rol}
          categoriaInicial={categoriaInicial}
          cuotasQuintero={configRes.data?.cuotas_default_quintero ?? 4}
        />
      </div>
    </div>
  );
}
