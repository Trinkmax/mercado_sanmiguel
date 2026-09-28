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
  type DatosCaja,
} from "@/components/caja/datos";
import { BandejaAdministracion } from "@/components/caja/bandeja-admin";
import { BannerOtroDia } from "@/components/caja/banner-otro-dia";
import { BotonImprimirCaja } from "@/components/caja/boton-imprimir-caja";
import { VistaCaja } from "@/components/caja/vista-caja";

export const metadata = { title: "Caja del día" };

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function primero(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Sello chico dentro de la pestaña: de un vistazo se ve cuál necesita atención. */
function EstadoPestania({ datos }: { datos: DatosCaja }) {
  if (!datos.caja) return <span className="text-xs font-normal text-muted-foreground">sin abrir</span>;
  return <Sello estado={datos.caja.reapertura_solicitada_en ? "reapertura_pedida" : datos.caja.estado} />;
}

/**
 * /caja                    → la caja de hoy.
 * /caja?fecha=…            → la caja de otro día (por ejemplo, una reabierta).
 * /caja?fecha=…&tipo=…     → Tesorería / Líder: abre esa pestaña (lo usan /tesoreria y la bandeja).
 *
 * Administración: su caja + la bandeja (cajas de portería para recibir, pedidos de reapertura).
 * Jefe de Portería: la caja de portería. Tesorería y el Líder: las dos cajas en pestañas;
 * el Líder con todas las acciones (§1.3), Tesorería cuenta, ajusta y valida desde acá.
 */
export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string | string[]; tipo?: string | string[] }>;
}) {
  const perfil = await requireRol("admin", "guardia", "tesoreria", "lider");
  const params = await searchParams;
  const fecha = normalizarFechaCaja(primero(params.fecha));
  const tipoPedido = primero(params.tipo) === "guardia" ? "guardia" : "administracion";
  const fechaLarga = capitalizar(formatFechaLarga(fecha));
  // Las planillas son mensuales: se bajan las del mes de la caja que se mira.
  const periodo = `${fecha.slice(0, 7)}-01`;

  const exportar =
    perfil.rol !== "guardia" ? (
      <>
        <BotonExportar dataset="cajas" periodo={periodo} label="Cajas del mes (.xlsx)" />
        <BotonExportar dataset="canon" periodo={periodo} label="Bono camioneros del mes (.xlsx)" />
      </>
    ) : null;

  if (perfil.rol === "tesoreria" || perfil.rol === "lider") {
    const [administracion, guardia, bandeja] = await Promise.all([
      cargarDatosCaja(perfil, "administracion", fecha),
      cargarDatosCaja(perfil, "guardia", fecha),
      cargarBandejaAdmin(perfil),
    ]);

    return (
      <div className="space-y-8">
        <PageHeader
          titulo="Cajas del día"
          descripcion={`${fechaLarga} · ${
            perfil.rol === "tesoreria"
              ? "Contá, ajustá y validá cada caja."
              : "Podés hacer todas las acciones de caja: queda firmado a tu nombre."
          }`}
        >
          {exportar}
        </PageHeader>
        <BannerOtroDia
          esHoy={administracion.esHoy}
          fecha={fecha}
          tipo={tipoPedido}
          cajaAbiertaOtroDia={
            tipoPedido === "guardia"
              ? (guardia.cajaAbiertaOtroDia ?? administracion.cajaAbiertaOtroDia)
              : (administracion.cajaAbiertaOtroDia ?? guardia.cajaAbiertaOtroDia)
          }
        />
        <Tabs key={`${fecha}-${tipoPedido}`} defaultValue={tipoPedido} className="gap-6">
          <TabsList className="h-auto! w-full p-1 sm:w-fit">
            <TabsTrigger value="administracion" className="min-h-11 flex-1 gap-2 px-4 text-base sm:flex-none sm:px-6">
              Administración
              <EstadoPestania datos={administracion} />
            </TabsTrigger>
            <TabsTrigger value="guardia" className="min-h-11 flex-1 gap-2 px-4 text-base sm:flex-none sm:px-6">
              Caja de portería
              <EstadoPestania datos={guardia} />
            </TabsTrigger>
          </TabsList>
          <TabsContent value="administracion" className="space-y-8">
            <BandejaAdministracion bandeja={bandeja} rol={perfil.rol} />
            <VistaCaja datos={administracion} rol={perfil.rol} miUserId={perfil.user_id} conEncabezado />
          </TabsContent>
          <TabsContent value="guardia" className="space-y-8">
            <VistaCaja datos={guardia} rol={perfil.rol} miUserId={perfil.user_id} conEncabezado />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  const tipo = perfil.rol === "guardia" ? "guardia" : "administracion";
  const [datos, bandeja] = await Promise.all([
    cargarDatosCaja(perfil, tipo, fecha),
    perfil.rol === "admin" ? cargarBandejaAdmin(perfil) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader titulo={tipo === "guardia" ? "Caja de portería" : "Caja del día"} descripcion={fechaLarga}>
        {datos.caja ? (
          <>
            <span className="inline-flex items-center gap-2">
              {datos.caja.reapertura_solicitada_en ? <Sello estado="reapertura_pedida" /> : null}
              <Sello estado={datos.caja.estado} />
            </span>
            <BotonImprimirCaja cajaId={datos.caja.id} abierta={datos.caja.estado === "abierta"} />
          </>
        ) : null}
        {exportar}
      </PageHeader>
      <BannerOtroDia esHoy={datos.esHoy} fecha={fecha} cajaAbiertaOtroDia={datos.cajaAbiertaOtroDia} />
      {bandeja ? <BandejaAdministracion bandeja={bandeja} rol={perfil.rol} /> : null}
      <VistaCaja datos={datos} rol={perfil.rol} miUserId={perfil.user_id} />
    </div>
  );
}
