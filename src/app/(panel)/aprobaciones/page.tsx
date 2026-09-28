import { CheckCheck, ClipboardCheck, History, ThumbsDown } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LABEL_ROL } from "@/lib/roles";
import type { Rol } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CardCambio } from "@/components/aprobaciones/card-cambio";
import { CardRevision } from "@/components/aprobaciones/card-revision";
import { TablaHistorial } from "@/components/aprobaciones/tabla-historial";
import type {
  CambioFila,
  Datos,
  ReferenciaCliente,
  ReferenciaConcepto,
} from "@/components/aprobaciones/tipos";

export const metadata = { title: "Aprobaciones" };

const LIMITE_HISTORIAL = 60;
const PESTANAS = ["pendientes", "revisar", "aprobados", "rechazados"] as const;

type Props = { searchParams: Promise<{ tab?: string }> };

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

export default async function AprobacionesPage({ searchParams }: Props) {
  const perfil = await requireRol("lider");
  const { tab } = await searchParams;
  const supabase = await createClient();
  const org = perfil.org_id;

  const columnas =
    "id, entidad, accion, entidad_id, cliente_id, datos, datos_anteriores, resumen, estado, solicitado_por, solicitado_en, revisado_por, revisado_en, motivo_rechazo, resultado_id, revisar_despues";

  const [pendientesRes, porRevisarRes, revisadosRes, conceptosRes] = await Promise.all([
    supabase
      .from("cambios_pendientes")
      .select(columnas)
      .eq("org_id", org)
      .eq("estado", "pendiente")
      .order("solicitado_en", { ascending: true }),
    // §1.3 D-P1: altas de ambulantes que el Jefe aplicó en el acto y el Líder todavía no miró.
    supabase
      .from("cambios_pendientes")
      .select(columnas)
      .eq("org_id", org)
      .eq("estado", "aprobado")
      .eq("revisar_despues", true)
      .is("revisado_por", null)
      .order("solicitado_en", { ascending: true }),
    supabase
      .from("cambios_pendientes")
      .select(columnas)
      .eq("org_id", org)
      .neq("estado", "pendiente")
      .not("revisado_por", "is", null)
      .order("revisado_en", { ascending: false })
      .limit(LIMITE_HISTORIAL),
    supabase.from("conceptos").select("id, codigo, nombre").eq("org_id", org),
  ]);

  const crudos = [
    ...(pendientesRes.data ?? []),
    ...(porRevisarRes.data ?? []),
    ...(revisadosRes.data ?? []),
  ];

  // Nombres de quien pidió / revisó y de los clientes afectados, en una pasada.
  const idsUsuarios = [
    ...new Set(
      crudos
        .flatMap((c) => [c.solicitado_por, c.revisado_por])
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const idsClientes = [
    ...new Set(
      crudos
        .flatMap((c) => [c.cliente_id, c.entidad === "cliente" ? c.resultado_id : null])
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const [perfilesRes, clientesRes] = await Promise.all([
    idsUsuarios.length > 0
      ? supabase.from("perfiles").select("user_id, nombre, rol").in("user_id", idsUsuarios)
      : Promise.resolve({ data: [] as { user_id: string; nombre: string; rol: Rol }[] }),
    idsClientes.length > 0
      ? supabase.from("clientes").select("id, codigo, nombre, activo").in("id", idsClientes)
      : Promise.resolve({ data: [] as (ReferenciaCliente & { activo: boolean })[] }),
  ]);

  const perfilesPorId = new Map(
    (perfilesRes.data ?? []).map((p) => [p.user_id, { nombre: p.nombre, rol: p.rol as Rol }])
  );
  const clientesPorId = new Map(
    (clientesRes.data ?? []).map((c) => [
      c.id,
      { id: c.id, codigo: c.codigo, nombre: c.nombre, activo: c.activo },
    ])
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
    // Altas ya aplicadas: el cliente es el resultado (así el Líder llega a la ficha).
    const clienteId = c.cliente_id ?? (entidad === "cliente" && c.estado === "aprobado" ? c.resultado_id : null);

    return {
      id: c.id,
      entidad,
      accion,
      entidad_id: c.entidad_id,
      resumen: c.resumen,
      estado: c.estado,
      datos,
      datos_anteriores: anteriores,
      cliente: clienteId ? (clientesPorId.get(clienteId) ?? null) : null,
      concepto,
      solicitadoPor: solicitante?.nombre ?? null,
      solicitadoRol: solicitante ? LABEL_ROL[solicitante.rol] : null,
      solicitadoEn: c.solicitado_en,
      revisadoPor: revisor?.nombre ?? null,
      revisadoEn: c.revisado_en,
      motivoRechazo: c.motivo_rechazo,
      resultadoId: c.resultado_id,
      revisarDespues: Boolean(c.revisar_despues),
    };
  }

  const pendientes = (pendientesRes.data ?? []).map(traducir);
  const porRevisar = (porRevisarRes.data ?? []).map(traducir);
  const revisados = (revisadosRes.data ?? []).map(traducir);
  const aprobados = revisados.filter((c) => c.estado === "aprobado");
  const rechazados = revisados.filter((c) => c.estado === "rechazado");

  const pestanaInicial = PESTANAS.includes(tab as (typeof PESTANAS)[number])
    ? (tab as string)
    : pendientes.length === 0 && porRevisar.length > 0
      ? "revisar"
      : "pendientes";
  const claseTab = "min-h-11 flex-none px-5 text-sm font-medium";

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Aprobaciones"
        descripcion="Altas, bajas y modificaciones que proponen Administración y el Jefe de Portería. Nada se aplica hasta que lo apruebes, salvo las altas de ambulantes: el Jefe las carga en el acto para cobrarles y vos las revisás después."
      />

      <Tabs defaultValue={pestanaInicial}>
        <TabsList className="h-auto! w-full flex-wrap justify-start gap-1 p-1 sm:w-fit">
          <TabsTrigger value="pendientes" className={claseTab}>
            Pendientes
            <Contador n={pendientes.length} activo={pendientes.length > 0} />
          </TabsTrigger>
          <TabsTrigger value="revisar" className={claseTab}>
            Aplicadas por el Jefe
            <Contador n={porRevisar.length} activo={porRevisar.length > 0} />
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
              descripcion="Cuando Administración o el Jefe de Portería propongan un alta, una baja o una modificación, aparece acá para que la revises."
            />
          ) : (
            <div className="space-y-5">
              {pendientes.map((cambio) => (
                <CardCambio key={cambio.id} cambio={cambio} conceptosPorId={conceptosPorId} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="revisar" className="mt-4 text-sm/relaxed">
          {porRevisar.length === 0 ? (
            <EmptyState
              icono={CheckCheck}
              titulo="No hay altas del Jefe para revisar"
              descripcion="Cuando el Jefe de Portería dé de alta un ambulante, queda cargado en el acto y aparece acá para que lo mires."
            />
          ) : (
            <div className="space-y-5">
              {porRevisar.map((cambio) => (
                <CardRevision key={cambio.id} cambio={cambio} conceptosPorId={conceptosPorId} />
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
