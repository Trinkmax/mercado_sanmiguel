import { requireRol } from "@/lib/auth";
import { formatFechaLarga, hoyISO } from "@/lib/format";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { Sello } from "@/components/shared/sello";
import { cargarDatosCaja } from "@/components/caja/datos";
import { VistaCaja } from "@/components/caja/vista-caja";

export const metadata = { title: "Caja del día" };

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export default async function CajaPage() {
  const perfil = await requireRol("admin", "guardia", "tesoreria");
  const fechaLarga = capitalizar(formatFechaLarga(hoyISO()));

  // Tesorería supervisa las dos cajas; admin y guardia ven solo la suya.
  if (perfil.rol === "tesoreria") {
    const [administracion, guardia] = await Promise.all([
      cargarDatosCaja(perfil, "administracion"),
      cargarDatosCaja(perfil, "guardia"),
    ]);

    return (
      <div className="space-y-8">
        <PageHeader titulo="Caja del día" descripcion={fechaLarga} />
        <Tabs defaultValue="administracion" className="gap-6">
          <TabsList className="h-auto! p-1">
            <TabsTrigger
              value="administracion"
              className="min-h-11 px-6 text-base"
            >
              Administración
            </TabsTrigger>
            <TabsTrigger value="guardia" className="min-h-11 px-6 text-base">
              Guardia
            </TabsTrigger>
          </TabsList>
          <TabsContent value="administracion">
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
  const datos = await cargarDatosCaja(perfil, tipo);

  return (
    <div className="space-y-8">
      <PageHeader titulo="Caja del día" descripcion={fechaLarga}>
        {datos.caja ? <Sello estado={datos.caja.estado} /> : null}
      </PageHeader>
      <VistaCaja datos={datos} rol={perfil.rol} />
    </div>
  );
}
