import { ClipboardCheck, History, ThumbsDown } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LABEL_ROL } from "@/lib/roles";
import type { Rol } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CardCambio } from "@/components/aprobaciones/card-cambio";
import { TablaHistorial } from "@/components/aprobaciones/tabla-historial";
import type {
  CambioFila,
  Datos,
  ReferenciaCliente,
  ReferenciaConcepto,
} from "@/components/aprobaciones/tipos";

export const metadata = { title: "Aprobaciones" };

const LIMITE_HISTORIAL = 60;

function comoDatos(valor: unknown): Datos {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Datos)
    : {};
}

function Contador({ n, activo }: { n: number; activo?: boolean }) {
  return (
    <span
      className={
        activo
          ? "ml-1 inline-flex min-w-6 items-center justify-center rounded-full bg-parcial px-1.5 py-0.5 text-xs font-bold tabular text-white"
          : "ml-1 tabular text-xs font-semibold text-muted-foreground"
      }
    >
      {n}
    </span>
  );
}

export default async function AprobacionesPage() {
  const perfil = await requireRol("lider");
  const supabase = await createClient();
  const org = perfil.org_id;

  const columnas =
    "id, entidad, accion, entidad_id, cliente_id, datos, datos_anteriores, resumen, estado, solicitado_por, solicitado_en, revisado_por, revisado_en, motivo_rechazo, resultado_id";

  const [pendientesRes, revisadosRes, conceptosRes] = await Promise.all([
    supabase
      .from("cambios_pendientes")
      .select(columnas)
      .eq("org_id", org)
      .eq("estado", "pendiente")
      .order("solicitado_en", { ascending: true }),
    supabase
      .from("cambios_pendientes")
      .select(columnas)
      .eq("org_id", org)
      .neq("estado", "pendiente")
      .order("revisado_en", { ascending: false })
      .limit(LIMITE_HISTORIAL),
    supabase
      .from("conceptos")
      .select("id, codigo, nombre")
      .eq("org_id", org),
  ]);

  const crudos = [...(pendientesRes.data ?? []), ...(revisadosRes.data ?? [])];

  // Nombres de quien pidió / revisó y de los clientes afectados, en una pasada.
  const idsUsuarios = [
    ...new Set(
      crudos
        .flatMap((c) => [c.solicitado_por, c.revisado_por])
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const idsClientes = [
    ...new Set(crudos.map((c) => c.cliente_id).filter((id): id is string => Boolean(id))),
  ];

  const [perfilesRes, clientesRes] = await Promise.all([
    idsUsuarios.length > 0
      ? supabase.from("perfiles").select("user_id, nombre, rol").in("user_id", idsUsuarios)
      : Promise.resolve({ data: [] as { user_id: string; nombre: string; rol: Rol }[] }),
    idsClientes.length > 0
      ? supabase.from("clientes").select("id, codigo, nombre").in("id", idsClientes)
      : Promise.resolve({ data: [] as ReferenciaCliente[] }),
  ]);

  const perfilesPorId = new Map(
    (perfilesRes.data ?? []).map((p) => [p.user_id, { nombre: p.nombre, rol: p.rol as Rol }])
  );
  const clientesPorId = new Map(
    (clientesRes.data ?? []).map((c) => [c.id, { id: c.id, codigo: c.codigo, nombre: c.nombre }])
  );
  const conceptosPorId: Record<string, ReferenciaConcepto> = Object.fromEntries(
    (conceptosRes.data ?? []).map((c) => [c.id, { codigo: c.codigo, nombre: c.nombre }])
  );

  function traducir(c: (typeof crudos)[number]): CambioFila {
    const datos = comoDatos(c.datos);
    const anteriores = c.datos_anteriores ? comoDatos(c.datos_anteriores) : null;
    const entidad = c.entidad as CambioFila["entidad"];
    const accion = c.accion as CambioFila["accion"];

    let concepto: ReferenciaConcepto | null = null;
    if (entidad === "concepto") {
      concepto =
        (c.entidad_id ? conceptosPorId[c.entidad_id] : undefined) ??
        (accion === "alta" && typeof datos.codigo === "string"
          ? { codigo: datos.codigo, nombre: String(datos.nombre ?? "") }
          : null);
    } else if (entidad === "cliente_concepto") {
      const conceptoId = (anteriores?.concepto_id ?? datos.concepto_id) as string | undefined;
      concepto = conceptoId ? (conceptosPorId[conceptoId] ?? null) : null;
    }

    const solicitante = c.solicitado_por ? perfilesPorId.get(c.solicitado_por) : undefined;
    const revisor = c.revisado_por ? perfilesPorId.get(c.revisado_por) : undefined;

    return {
      id: c.id,
      entidad,
      accion,
      entidad_id: c.entidad_id,
      resumen: c.resumen,
      estado: c.estado,
      datos,
      datos_anteriores: anteriores,
      cliente: c.cliente_id ? (clientesPorId.get(c.cliente_id) ?? null) : null,
      concepto,
      solicitadoPor: solicitante?.nombre ?? null,
      solicitadoRol: solicitante ? LABEL_ROL[solicitante.rol] : null,
      solicitadoEn: c.solicitado_en,
      revisadoPor: revisor?.nombre ?? null,
      revisadoEn: c.revisado_en,
      motivoRechazo: c.motivo_rechazo,
      resultadoId: c.resultado_id,
    };
  }

  const pendientes = (pendientesRes.data ?? []).map(traducir);
  const revisados = (revisadosRes.data ?? []).map(traducir);
  const aprobados = revisados.filter((c) => c.estado === "aprobado");
  const rechazados = revisados.filter((c) => c.estado === "rechazado");

  const claseTab = "min-h-11 flex-none px-5 text-sm font-medium";

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Aprobaciones"
        descripcion="Altas, bajas y modificaciones de clientes y conceptos que propuso Administración. Nada se aplica hasta que lo apruebes."
      />

      <Tabs defaultValue="pendientes">
        <TabsList className="h-auto! w-full flex-wrap justify-start gap-1 p-1 sm:w-fit">
          <TabsTrigger value="pendientes" className={claseTab}>
            Pendientes
            <Contador n={pendientes.length} activo={pendientes.length > 0} />
          </TabsTrigger>
          <TabsTrigger value="aprobados" className={claseTab}>
            Aprobados
            <Contador n={aprobados.length} />
          </TabsTrigger>
          <TabsTrigger value="rechazados" className={claseTab}>
            Rechazados
            <Contador n={rechazados.length} />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pendientes" className="mt-4 text-sm/relaxed">
          {pendientes.length === 0 ? (
            <EmptyState
              icono={ClipboardCheck}
              titulo="No hay cambios esperando tu aprobación"
              descripcion="Cuando Administración proponga un alta, una baja o una modificación de un cliente o de un concepto, aparece acá para que la revises."
            />
          ) : (
            <div className="space-y-5">
              {pendientes.map((cambio) => (
                <CardCambio
                  key={cambio.id}
                  cambio={cambio}
                  conceptosPorId={conceptosPorId}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="aprobados" className="mt-4 text-sm/relaxed">
          {aprobados.length === 0 ? (
            <EmptyState
              icono={History}
              titulo="Todavía no aprobaste ningún cambio"
              descripcion="Los cambios que apruebes quedan acá, con quién los pidió y cuándo se aplicaron."
            />
          ) : (
            <TablaHistorial cambios={aprobados} />
          )}
        </TabsContent>

        <TabsContent value="rechazados" className="mt-4 text-sm/relaxed">
          {rechazados.length === 0 ? (
            <EmptyState
              icono={ThumbsDown}
              titulo="No rechazaste ningún cambio"
              descripcion="Si rechazás un cambio, queda acá con el motivo que escribiste."
            />
          ) : (
            <TablaHistorial cambios={rechazados} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
