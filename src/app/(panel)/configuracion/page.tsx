import { KeyRound } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
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

const ORDEN_ROL: Record<string, number> = {
  admin: 0,
  tesoreria: 1,
  consejo: 2,
  guardia: 3,
  socio: 4,
};

export default async function ConfiguracionPage() {
  const perfil = await requireRol("admin", "tesoreria", "consejo");
  const supabase = await createClient();
  const hayClaveAdmin = Boolean(process.env.SUPABASE_SECRET_KEY);

  const [conceptosRes, configRes, perfilesRes, rubrosRes, clientesRes] =
    await Promise.all([
      supabase
        .from("conceptos")
        .select(
          "id, codigo, nombre, tipo, precio, descuento_pronto_pago, orden_imputacion, activo"
        )
        .eq("org_id", perfil.org_id)
        .order("orden_imputacion"),
      supabase
        .from("configuracion")
        .select("dia_vencimiento, precio_canon_camion")
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

  const usuarios: UsuarioFila[] = (perfilesRes.data ?? [])
    .slice()
    .sort(
      (a, b) =>
        (ORDEN_ROL[a.rol] ?? 9) - (ORDEN_ROL[b.rol] ?? 9) ||
        a.nombre.localeCompare(b.nombre, "es")
    );

  const rubros: RubroFila[] = rubrosRes.data ?? [];
  const clientesSinAcceso: ClienteSinAcceso[] = clientesRes.data ?? [];

  const diaVencimiento = configRes.data?.dia_vencimiento ?? 30;
  const precioCanonCamion = Number(configRes.data?.precio_canon_camion ?? 0);

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Configuración"
        descripcion="Precios, vencimiento, usuarios y rubros de gasto. Los cambios rigen para lo que se genere de acá en adelante."
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
          <TablaConceptos conceptos={conceptos} />
        </TabsContent>

        <TabsContent value="general" className="mt-4 text-sm/relaxed">
          <FormGeneral
            diaVencimiento={diaVencimiento}
            precioCanonCamion={precioCanonCamion}
          />
        </TabsContent>

        <TabsContent value="usuarios" className="mt-4 space-y-6 text-sm/relaxed">
          <TablaUsuarios
            usuarios={usuarios}
            miUserId={perfil.user_id}
            miEmail={perfil.email}
            puedeGestionar={perfil.rol === "admin" || perfil.rol === "consejo"}
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
