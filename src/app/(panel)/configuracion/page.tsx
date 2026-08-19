import { KeyRound } from "lucide-react";
import { aplicaDirecto, requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ORDEN_ROL } from "@/lib/roles";
import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertTitle } from "@/components/ui/alert";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  TablaConceptos,
  type CambioPendienteConcepto,
  type ConceptoFila,
} from "@/components/configuracion/tabla-conceptos";
import { FormGeneral } from "@/components/configuracion/form-general";
import {
  TablaUsuarios,
  type UsuarioFila,
} from "@/components/configuracion/tabla-usuarios";
import {
  FormAccesoSocio,
  type ClienteSinAcceso,
} from "@/components/configuracion/form-acceso-socio";
import {
  TablaRubros,
  type RubroFila,
} from "@/components/configuracion/tabla-rubros";

export const metadata = { title: "Configuración" };

export default async function ConfiguracionPage() {
  const perfil = await requireRol("admin", "tesoreria", "consejo", "lider");
  const supabase = await createClient();
  const hayClaveAdmin = Boolean(process.env.SUPABASE_SECRET_KEY);
  const esLider = aplicaDirecto(perfil.rol);

  const [conceptosRes, pendientesRes, configRes, perfilesRes, rubrosRes, clientesRes] =
    await Promise.all([
      supabase
        .from("conceptos")
        .select(
          "id, codigo, nombre, tipo, precio, descuento_pronto_pago, orden_imputacion, activo"
        )
        .eq("org_id", perfil.org_id)
        .order("orden_imputacion"),
      // Cambios de conceptos que esperan la aprobación del Líder.
      supabase
        .from("cambios_pendientes")
        .select("entidad_id, resumen, solicitado_en")
        .eq("org_id", perfil.org_id)
        .eq("entidad", "concepto")
        .eq("estado", "pendiente")
        .order("solicitado_en"),
      supabase
        .from("configuracion")
        .select(
          "dia_vencimiento, precio_canon_camion, precio_canon_ambulante, precio_canon_quintero_dia, impresion_directa"
        )
        .eq("org_id", perfil.org_id)
        .maybeSingle(),
      supabase
        .from("perfiles")
        .select("user_id, nombre, rol, activo")
        .eq("org_id", perfil.org_id)
        .order("nombre"),
      supabase
        .from("rubros_gasto")
        .select("id, codigo, nombre, activo")
        .eq("org_id", perfil.org_id)
        .order("codigo"),
      hayClaveAdmin
        ? supabase
            .from("clientes")
            .select("id, codigo, nombre")
            .eq("org_id", perfil.org_id)
            .is("auth_user_id", null)
            .eq("activo", true)
            .order("codigo")
        : Promise.resolve({ data: null }),
    ]);

  const conceptos: ConceptoFila[] = (conceptosRes.data ?? []).map((c) => ({
    ...c,
    precio: Number(c.precio),
    descuento_pronto_pago: Number(c.descuento_pronto_pago),
    orden_imputacion: Number(c.orden_imputacion),
  }));

  const pendientesPorConcepto: Record<string, CambioPendienteConcepto[]> = {};
  for (const p of pendientesRes.data ?? []) {
    if (!p.entidad_id) continue;
    (pendientesPorConcepto[p.entidad_id] ??= []).push({
      resumen: p.resumen,
      solicitadoEn: p.solicitado_en,
    });
  }

  const usuarios: UsuarioFila[] = (perfilesRes.data ?? [])
    .slice()
    .sort((a, b) => {
      const ia = ORDEN_ROL.indexOf(a.rol);
      const ib = ORDEN_ROL.indexOf(b.rol);
      return (
        (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) ||
        a.nombre.localeCompare(b.nombre, "es")
      );
    });

  const rubros: RubroFila[] = rubrosRes.data ?? [];
  const clientesSinAcceso: ClienteSinAcceso[] = clientesRes.data ?? [];

  const config = configRes.data;
  const diaVencimiento = config?.dia_vencimiento ?? 30;
  const preciosPorteria = {
    camion: Number(config?.precio_canon_camion ?? 0),
    ambulante: Number(config?.precio_canon_ambulante ?? 0),
    quintero: Number(config?.precio_canon_quintero_dia ?? 0),
  };
  const impresionDirecta = Boolean(config?.impresion_directa ?? false);

  const puedeGestionarUsuarios =
    perfil.rol === "admin" || perfil.rol === "consejo" || perfil.rol === "lider";

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Configuración"
        descripcion="Precios, vencimiento, cobro en portería, usuarios y rubros de gasto. Los cambios rigen para lo que se genere de acá en adelante."
      />

      <Tabs defaultValue="precios">
        <TabsList className="h-auto! w-full flex-wrap justify-start gap-1 p-1 sm:w-fit">
          <TabsTrigger
            value="precios"
            className="min-h-11 flex-none px-5 text-sm font-medium"
          >
            Precios
          </TabsTrigger>
          <TabsTrigger
            value="general"
            className="min-h-11 flex-none px-5 text-sm font-medium"
          >
            General
          </TabsTrigger>
          <TabsTrigger
            value="usuarios"
            className="min-h-11 flex-none px-5 text-sm font-medium"
          >
            Usuarios
          </TabsTrigger>
          <TabsTrigger
            value="rubros"
            className="min-h-11 flex-none px-5 text-sm font-medium"
          >
            Rubros de gasto
          </TabsTrigger>
        </TabsList>

        <TabsContent value="precios" className="mt-4 text-sm/relaxed">
          <TablaConceptos
            conceptos={conceptos}
            pendientes={pendientesPorConcepto}
            aplicaDirecto={esLider}
          />
        </TabsContent>

        <TabsContent value="general" className="mt-4 text-sm/relaxed">
          <FormGeneral
            diaVencimiento={diaVencimiento}
            preciosPorteria={preciosPorteria}
            impresionDirecta={impresionDirecta}
            esLider={esLider}
          />
        </TabsContent>

        <TabsContent value="usuarios" className="mt-4 space-y-6 text-sm/relaxed">
          <TablaUsuarios
            usuarios={usuarios}
            miUserId={perfil.user_id}
            miEmail={perfil.email}
            puedeGestionar={puedeGestionarUsuarios}
          />
          {hayClaveAdmin ? (
            <FormAccesoSocio clientes={clientesSinAcceso} />
          ) : (
            <Alert className="px-4 py-3">
              <KeyRound strokeWidth={2} />
              <AlertTitle className="text-sm">
                Para crear accesos de socios desde acá, cargá la
                SUPABASE_SECRET_KEY en el servidor (ver .env.local).
              </AlertTitle>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="rubros" className="mt-4 text-sm/relaxed">
          <TablaRubros rubros={rubros} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
