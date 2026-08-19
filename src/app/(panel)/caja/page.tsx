import { requireRol } from "@/lib/auth";
import { formatFechaLarga } from "@/lib/format";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { Sello } from "@/components/shared/sello";
import { BotonExportar } from "@/components/shared/boton-exportar";
import {
  cargarBandejaAdmin,
  cargarDatosCaja,
  normalizarFechaCaja,
} from "@/components/caja/datos";
import { BandejaAdministracion } from "@/components/caja/bandeja-admin";
import { BannerOtroDia } from "@/components/caja/banner-otro-dia";
import { VistaCaja } from "@/components/caja/vista-caja";

export const metadata = { title: "Caja del día" };

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * /caja            → la caja de hoy.
 * /caja?fecha=…    → la caja de otro día (por ejemplo, una reabierta).
 * Tesorería supervisa las dos cajas en pestañas; admin y el Jefe de Portería
 * ven solo la suya. Administración además recibe las rendiciones de portería
 * y resuelve los pedidos de reapertura.
 */
export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string | string[] }>;
}) {
  const perfil = await requireRol("admin", "guardia", "tesoreria");
  const { fecha: fechaParam } = await searchParams;
  const fecha = normalizarFechaCaja(
    Array.isArray(fechaParam) ? fechaParam[0] : fechaParam
  );
  const fechaLarga = capitalizar(formatFechaLarga(fecha));
  // Las planillas son mensuales: se bajan las del mes de la caja que se mira.
  const periodo = `${fecha.slice(0, 7)}-01`;

  const exportar =
    perfil.rol !== "guardia" ? (
      <>
        <BotonExportar dataset="cajas" periodo={periodo} label="Cajas del mes (.xlsx)" />
        <BotonExportar dataset="canon" periodo={periodo} label="Canon del mes (.xlsx)" />
      </>
    ) : null;

  if (perfil.rol === "tesoreria") {
    const [administracion, guardia, bandeja] = await Promise.all([
      cargarDatosCaja(perfil, "administracion", fecha),
      cargarDatosCaja(perfil, "guardia", fecha),
      cargarBandejaAdmin(perfil),
    ]);

    return (
      <div className="space-y-8">
        <PageHeader titulo="Caja del día" descripcion={fechaLarga}>
          {exportar}
        </PageHeader>
        <BannerOtroDia
          esHoy={administracion.esHoy}
          fecha={fecha}
          cajaAbiertaOtroDia={
            administracion.cajaAbiertaOtroDia ?? guardia.cajaAbiertaOtroDia
          }
        />
        <Tabs defaultValue="administracion" className="gap-6">
          <TabsList className="h-auto! p-1">
            <TabsTrigger
              value="administracion"
              className="min-h-11 px-6 text-base"
            >
              Administración
            </TabsTrigger>
            <TabsTrigger value="guardia" className="min-h-11 px-6 text-base">
              Portería
            </TabsTrigger>
          </TabsList>
          <TabsContent value="administracion" className="space-y-8">
            <BandejaAdministracion bandeja={bandeja} rol={perfil.rol} />
            <VistaCaja datos={administracion} rol={perfil.rol} conEncabezado />
          </TabsContent>
          <TabsContent value="guardia">
            <VistaCaja datos={guardia} rol={perfil.rol} conEncabezado />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  const tipo = perfil.rol === "guardia" ? "guardia" : "administracion";
  const [datos, bandeja] = await Promise.all([
    cargarDatosCaja(perfil, tipo, fecha),
    perfil.rol === "admin"
      ? cargarBandejaAdmin(perfil)
      : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader titulo="Caja del día" descripcion={fechaLarga}>
        {datos.caja ? (
          <span className="inline-flex items-center gap-2">
            {datos.caja.reapertura_solicitada_en ? (
              <Sello estado="reapertura_pedida" />
            ) : null}
            <Sello estado={datos.caja.estado} />
          </span>
        ) : null}
        {exportar}
      </PageHeader>
      <BannerOtroDia
        esHoy={datos.esHoy}
        fecha={fecha}
        cajaAbiertaOtroDia={datos.cajaAbiertaOtroDia}
      />
      {bandeja ? <BandejaAdministracion bandeja={bandeja} rol={perfil.rol} /> : null}
      <VistaCaja datos={datos} rol={perfil.rol} />
    </div>
  );
}
