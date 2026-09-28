import Link from "next/link";
import { KeyRound } from "lucide-react";
import { aplicaDirecto, requireRol, type Perfil, type Rol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hayClaveAdmin } from "@/lib/supabase/admin";
import { ORDEN_ROL, ROLES_ASIGNABLES_STAFF, rolesQueGestiona } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertTitle } from "@/components/ui/alert";
import {
  TablaConceptos,
  type CambioPendienteConcepto,
  type ConceptoFila,
} from "@/components/configuracion/tabla-conceptos";
import { FormGeneral } from "@/components/configuracion/form-general";
import { TablaRubros, type RubroFila } from "@/components/configuracion/tabla-rubros";
import {
  QuintasAmbulantes,
  type PrecioPorteria,
} from "@/components/configuracion/quintas-ambulantes";
import {
  PestanasConfiguracion,
  pestanasDeRol,
  type PestanaConfiguracion,
} from "@/components/configuracion/pestanas-configuracion";
import { ListaUsuarios } from "@/components/configuracion/usuarios/lista-usuarios";
import { AccesosSocios } from "@/components/configuracion/usuarios/accesos-socios";
import type {
  ClienteAcceso,
  EmpleadoPadron,
  UsuarioFila,
} from "@/components/configuracion/usuarios/tipos";
import { TarifasTransporte } from "@/components/configuracion/tarifas-transporte";
import type { TarifaTransporte } from "@/components/porteria/tarifas";

export const metadata = { title: "Configuración" };

type Supabase = Awaited<ReturnType<typeof createClient>>;

const SEGMENTOS_PORTERIA = ["quinteros", "ambulantes"];

const DESCRIPCION: Partial<Record<Rol, string>> = {
  lider:
    "Precios, tarifas de transporte, cómo se cobra la quinta, usuarios y rubros. Los cambios rigen de acá en adelante.",
  admin:
    "Precios de los puestos, vencimiento del mes, acceso de los socios al portal y rubros de gasto.",
  guardia: "Cómo cobrás a quinteros y ambulantes, y los usuarios de Portería.",
};

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[]; ver?: string | string[] }>;
}) {
  const perfil = await requireRol("admin", "guardia", "lider");
  const sp = await searchParams;
  const disponibles = pestanasDeRol(perfil.rol);
  const pedida = typeof sp.tab === "string" ? (sp.tab as PestanaConfiguracion) : null;
  const pestana: PestanaConfiguracion =
    pedida && disponibles.includes(pedida) ? pedida : disponibles[0];
  const supabase = await createClient();

  // Cambios de conceptos que esperan al Líder: globo en Precios / Quintas y ambulantes.
  const [pendientesRes, conceptosMinRes] = await Promise.all([
    supabase
      .from("cambios_pendientes")
      .select("entidad_id, resumen, solicitado_en")
      .eq("org_id", perfil.org_id)
      .eq("entidad", "concepto")
      .eq("estado", "pendiente")
      .order("solicitado_en"),
    supabase.from("conceptos").select("id, codigo, segmento").eq("org_id", perfil.org_id),
  ]);
  const pendientesPorConcepto: Record<string, CambioPendienteConcepto[]> = {};
  for (const p of pendientesRes.data ?? []) {
    if (!p.entidad_id) continue;
    (pendientesPorConcepto[p.entidad_id] ??= []).push({
      resumen: p.resumen,
      solicitadoEn: p.solicitado_en,
    });
  }
  const esPorteria = new Set(
    (conceptosMinRes.data ?? [])
      .filter((c) => SEGMENTOS_PORTERIA.includes(c.segmento ?? ""))
      .map((c) => c.id)
  );
  const idsPendientes = Object.keys(pendientesPorConcepto);
  const globos: Partial<Record<PestanaConfiguracion, number>> = {
    precios: idsPendientes.filter((id) => perfil.rol === "lider" || !esPorteria.has(id)).length,
    quintas: idsPendientes.filter((id) => esPorteria.has(id)).length,
  };

  let contenido: React.ReactNode = null;
  if (pestana === "precios") {
    contenido = await Precios(supabase, perfil, pendientesPorConcepto);
  } else if (pestana === "general") {
    contenido = await General(supabase, perfil);
  } else if (pestana === "tarifas") {
    contenido = await Tarifas(supabase, perfil);
  } else if (pestana === "quintas") {
    contenido = await Quintas(supabase, perfil, pendientesPorConcepto);
  } else if (pestana === "usuarios") {
    const ver = sp.ver === "socios" ? "socios" : "equipo";
    contenido = await Usuarios(supabase, perfil, ver);
  } else if (pestana === "rubros") {
    contenido = await Rubros(supabase, perfil);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Configuración"
        descripcion={DESCRIPCION[perfil.rol]}
        className="pb-0"
      />
      <PestanasConfiguracion rol={perfil.rol} activa={pestana} pendientes={globos} />
      <div className="text-sm/relaxed">{contenido}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Pestañas: cada una trae solo lo suyo                              */
/* ---------------------------------------------------------------- */

async function Precios(
  supabase: Supabase,
  perfil: Perfil,
  pendientes: Record<string, CambioPendienteConcepto[]>
) {
  const { data } = await supabase
    .from("conceptos")
    .select("id, codigo, nombre, tipo, segmento, precio, descuento_pronto_pago, orden_imputacion, activo")
    .eq("org_id", perfil.org_id)
    .order("orden_imputacion");
  const esLider = aplicaDirecto(perfil.rol);
  const conceptos: ConceptoFila[] = (data ?? [])
    // Administración no ve Quintas, Ambulantes ni el bono camioneros (los maneja Portería).
    .filter((c) => esLider || (!SEGMENTOS_PORTERIA.includes(c.segmento ?? "") && c.codigo !== "BC"))
    .map((c) => ({
      ...c,
      precio: Number(c.precio),
      descuento_pronto_pago: Number(c.descuento_pronto_pago),
      orden_imputacion: Number(c.orden_imputacion),
    }));
  return (
    <TablaConceptos
      conceptos={conceptos}
      pendientes={pendientes}
      aplicaDirecto={esLider}
      verTarifas={esLider}
    />
  );
}

async function General(supabase: Supabase, perfil: Perfil) {
  const { data } = await supabase
    .from("configuracion")
    .select("dia_vencimiento, impresion_directa")
    .eq("org_id", perfil.org_id)
    .maybeSingle();
  return (
    <FormGeneral
      diaVencimiento={data?.dia_vencimiento ?? 30}
      impresionDirecta={Boolean(data?.impresion_directa ?? false)}
    />
  );
}

async function Tarifas(supabase: Supabase, perfil: Perfil) {
  const { data } = await supabase
    .from("tarifas_transporte")
    .select("id, nombre, precio, unidad, icono, orden, activo")
    .eq("org_id", perfil.org_id)
    .order("orden");
  const tarifas: TarifaTransporte[] = (data ?? []).map((t) => ({
    id: t.id,
    nombre: t.nombre,
    precio: Number(t.precio),
    unidad: t.unidad as TarifaTransporte["unidad"],
    icono: t.icono as TarifaTransporte["icono"],
    orden: t.orden,
    activo: t.activo,
  }));
  return <TarifasTransporte tarifas={tarifas} puedeEditar={perfil.rol === "lider"} />;
}

async function Quintas(
  supabase: Supabase,
  perfil: Perfil,
  pendientes: Record<string, CambioPendienteConcepto[]>
) {
  const [conceptosRes, configRes] = await Promise.all([
    supabase
      .from("conceptos")
      .select("id, codigo, nombre, precio")
      .eq("org_id", perfil.org_id)
      .in("codigo", ["EXPQ", "AMB"]),
    supabase
      .from("configuracion")
      .select("cuotas_default_quintero")
      .eq("org_id", perfil.org_id)
      .maybeSingle(),
  ]);
  const precio = (codigo: string): PrecioPorteria | null => {
    const c = (conceptosRes.data ?? []).find((x) => x.codigo === codigo);
    if (!c) return null;
    const enEspera = pendientes[c.id] ?? [];
    return {
      id: c.id,
      codigo: c.codigo,
      nombre: c.nombre,
      precio: Number(c.precio),
      pendiente: enEspera.length > 0 ? enEspera.map((p) => p.resumen).join(" · ") : null,
    };
  };
  return (
    <QuintasAmbulantes
      quinta={precio("EXPQ")}
      ambulante={precio("AMB")}
      cuotasDefault={configRes.data?.cuotas_default_quintero ?? 4}
      aplicaDirecto={aplicaDirecto(perfil.rol)}
    />
  );
}

async function Rubros(supabase: Supabase, perfil: Perfil) {
  const { data } = await supabase
    .from("rubros_gasto")
    .select("id, codigo, nombre, activo")
    .eq("org_id", perfil.org_id)
    .order("codigo");
  const rubros: RubroFila[] = data ?? [];
  return <TablaRubros rubros={rubros} />;
}

/* ---------- Usuarios ---------- */

const NOMBRE_TIPO_ESPACIO: Record<string, string> = {
  puesto: "Puesto",
  local: "Local",
  contenedor: "Contéiner",
  bar: "Bar",
};
const ORDEN_TIPO_ESPACIO = ["puesto", "local", "contenedor", "bar"];

/** "Puesto 58 · 60 · Local 3" para reconocer y buscar al cliente. */
function lugaresDe(espacios: { tipo: string; numero: string | null; medio: boolean }[]): string | null {
  if (espacios.length === 0) return null;
  const porTipo = new Map<string, string[]>();
  for (const e of espacios) {
    const n = `${e.numero ?? ""}${e.medio ? "½" : ""}`.trim();
    if (!porTipo.has(e.tipo)) porTipo.set(e.tipo, []);
    if (n) porTipo.get(e.tipo)!.push(n);
  }
  const orden = (t: string) => {
    const i = ORDEN_TIPO_ESPACIO.indexOf(t);
    return i === -1 ? 99 : i;
  };
  const tipos = [...porTipo.keys()].sort((a, b) => orden(a) - orden(b));
  return tipos
    .map((t) => {
      const nums = porTipo.get(t)!.sort((a, b) => parseFloat(a) - parseFloat(b));
      const nombre = NOMBRE_TIPO_ESPACIO[t] ?? t;
      return nums.length > 0 ? `${nombre} ${nums.join(" · ")}` : nombre;
    })
    .join(" · ");
}

function aFila(p: {
  user_id: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  dni: string | null;
  desactivado_en: string | null;
  desactivado_por: string | null;
}): UsuarioFila {
  return {
    user_id: p.user_id,
    nombre: p.nombre,
    rol: p.rol,
    activo: p.activo,
    dni: p.dni,
    desactivadoEn: p.desactivado_en,
    desactivadoPor: p.desactivado_por,
  };
}

async function Usuarios(supabase: Supabase, perfil: Perfil, ver: "equipo" | "socios") {
  const claveAdmin = hayClaveAdmin();
  // El Líder elige qué mirar; Administración solo socios; el Jefe solo Portería.
  const alcance =
    perfil.rol === "admin" ? "socios" : perfil.rol === "guardia" ? "porteria" : ver;

  // Todos los perfiles que este rol ve (RLS): nombres para "lo quitó …" y DNIs ocupados.
  const { data: perfiles } = await supabase
    .from("perfiles")
    .select("user_id, nombre, rol, activo, dni, desactivado_en, desactivado_por")
    .eq("org_id", perfil.org_id)
    .neq("rol", "consejo");
  const todos = perfiles ?? [];
  const nombresPorId = Object.fromEntries(todos.map((p) => [p.user_id, p.nombre]));

  const avisoClave = claveAdmin ? null : (
    <Alert className="mb-5 border-parcial bg-parcial-suave px-4 py-3">
      <KeyRound strokeWidth={2} />
      <AlertTitle className="text-sm">
        Para crear usuarios o cambiar contraseñas falta la SUPABASE_SECRET_KEY en el servidor.
        Igual podés quitar y devolver accesos.
      </AlertTitle>
    </Alert>
  );

  const selectorLider =
    perfil.rol === "lider" ? (
      <div className="mb-5 flex gap-2" role="group" aria-label="Qué usuarios ver">
        {(
          [
            { valor: "equipo", label: "Equipo", n: todos.filter((p) => p.rol !== "socio").length },
            { valor: "socios", label: "Socios", n: todos.filter((p) => p.rol === "socio").length },
          ] as const
        ).map((o) => (
          <Link
            key={o.valor}
            href={o.valor === "equipo" ? "/configuracion?tab=usuarios" : "/configuracion?tab=usuarios&ver=socios"}
            aria-current={alcance === o.valor ? "page" : undefined}
            className={cn(
              "inline-flex min-h-12 items-center gap-2 rounded-full border px-5 text-base font-semibold transition-colors",
              alcance === o.valor ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"
            )}
          >
            {o.label}
            <span className="tabular opacity-80">{o.n}</span>
          </Link>
        ))}
      </div>
    ) : null;

  if (alcance === "socios") {
    const categorias = perfil.rol === "lider" ? ["puestero", "quintero"] : ["puestero"];
    const { data: clientes } = await supabase
      .from("clientes")
      .select("id, codigo, nombre, apodo, cuit, tipo_persona, auth_user_id")
      .eq("org_id", perfil.org_id)
      .eq("activo", true)
      .in("categoria", categorias as ("puestero" | "quintero")[])
      .order("codigo");
    const ids = (clientes ?? []).map((c) => c.id);
    const { data: espacios } =
      ids.length > 0
        ? await supabase.from("espacios").select("cliente_id, tipo, numero, medio").in("cliente_id", ids)
        : { data: [] };
    const espaciosPorCliente = new Map<string, { tipo: string; numero: string | null; medio: boolean }[]>();
    for (const e of espacios ?? []) {
      if (!e.cliente_id) continue;
      if (!espaciosPorCliente.has(e.cliente_id)) espaciosPorCliente.set(e.cliente_id, []);
      espaciosPorCliente.get(e.cliente_id)!.push(e);
    }
    const perfilPorId = new Map(todos.map((p) => [p.user_id, p]));
    const lista: ClienteAcceso[] = (clientes ?? []).map((c) => {
      const socio = c.auth_user_id ? perfilPorId.get(c.auth_user_id) : undefined;
      return {
        id: c.id,
        codigo: c.codigo,
        nombre: c.nombre,
        apodo: c.apodo,
        cuit: c.cuit,
        tipoPersona: c.tipo_persona,
        lugares: lugaresDe(espaciosPorCliente.get(c.id) ?? []),
        acceso: socio ? aFila(socio) : null,
      };
    });
    return (
      <>
        {selectorLider}
        {avisoClave}
        <AccesosSocios
          clientes={lista}
          miUserId={perfil.user_id}
          miRol={perfil.rol}
          nombresPorId={nombresPorId}
          hayClaveAdmin={claveAdmin}
        />
      </>
    );
  }

  // Equipo (Líder) o Portería (Jefe).
  const rolesVisibles: Rol[] = alcance === "porteria" ? ["porteria"] : ROLES_ASIGNABLES_STAFF;
  const usuarios: UsuarioFila[] = todos
    .filter((p) => rolesVisibles.includes(p.rol))
    .map(aFila)
    .sort(
      (a, b) =>
        Number(b.activo) - Number(a.activo) ||
        ORDEN_ROL.indexOf(a.rol) - ORDEN_ROL.indexOf(b.rol) ||
        a.nombre.localeCompare(b.nombre, "es")
    );

  // Padrón de Personal para elegir a quién se le crea el usuario (el Jefe: solo Portería).
  let consultaEmpleados = supabase
    .from("empleados")
    .select("id, nombre, apellido, dni, sector, cargo")
    .eq("org_id", perfil.org_id)
    .eq("activo", true)
    .order("apellido");
  if (alcance === "porteria") consultaEmpleados = consultaEmpleados.eq("sector", "porteria");
  const { data: empleadosRes } = await consultaEmpleados;
  const dnisConUsuario = new Set(todos.map((p) => p.dni).filter(Boolean));
  const empleados: EmpleadoPadron[] = (empleadosRes ?? []).map((e) => ({
    id: e.id,
    nombre: e.nombre,
    apellido: e.apellido,
    dni: e.dni,
    sector: e.sector,
    cargo: e.cargo,
    conUsuario: dnisConUsuario.has(e.dni),
  }));

  const rolesCreables = rolesQueGestiona(perfil.rol).filter((r) => r !== "socio");

  return (
    <>
      {selectorLider}
      {avisoClave}
      <ListaUsuarios
        usuarios={usuarios}
        miUserId={perfil.user_id}
        miRol={perfil.rol}
        rolesCreables={rolesCreables}
        empleados={empleados}
        nombresPorId={nombresPorId}
        hayClaveAdmin={claveAdmin}
      />
    </>
  );
}
