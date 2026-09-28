import { Map as MapIcon } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { ROLES_COBRAN } from "@/lib/roles";
import { categoriasDeRol, type AvanceMes, type CategoriaCliente } from "@/lib/segmentos";
import { createClient } from "@/lib/supabase/server";
import { periodoActual } from "@/lib/format";
import { EmptyState } from "@/components/shared/empty-state";
import { MapaOrientable } from "@/components/mapa/mapa-orientable";
import { cargarPlano } from "@/components/mapa/datos-plano";
import type {
  AvisoPuestoPrevio,
  ClienteMapa,
  CodigoPlano,
  EstadoCobro,
  Facturado,
  ItemCarpeta,
  VistaMapa,
} from "@/components/mapa/tipos";

export const metadata = { title: "Mapa del mercado" };

type Props = {
  searchParams: Promise<{
    cliente?: string | string[];
    puesto?: string | string[];
    espacio?: string | string[];
    editar?: string | string[];
  }>;
};

/** Código de concepto → qué cuenta en el plano (C6: EXME = puesto común, EXPP = propio). */
const CONCEPTO_FACTURADO: Record<string, keyof Facturado> = {
  EXME: "puestos",
  EXPP: "propios",
  EXPL: "locales",
  EXPE: "contenedores",
  EXPQ: "quintas",
  EXPC: "cocheras",
  EXPG: "galpones",
};

const CODIGOS_PLANO: CodigoPlano[] = ["EXME", "EXPP", "EXPL", "EXPE"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function MapaPage({ searchParams }: Props) {
  // J5: Tesorería no entra al mapa. El Jefe ve solo quintas + avisos (G11).
  const perfil = await requireRol("admin", "guardia", "lider");
  const sp = await searchParams;
  const supabase = await createClient();
  const periodo = periodoActual();
  const vista: VistaMapa = perfil.rol === "guardia" ? "porteria" : "completa";
  const puedeEditar = perfil.rol === "admin" || perfil.rol === "lider";

  // Clientes: el Jefe solo sus quinteros (los ambulantes no tienen lugar en el plano);
  // Administración y el Líder, todos menos ambulantes. El Jefe NO trae datos de puesteros.
  let consultaClientes = supabase
    .from("clientes")
    .select("id, codigo, nombre, apodo, categoria, cliente_conceptos(id, cantidad, activo, conceptos(id, codigo))")
    .eq("org_id", perfil.org_id)
    .eq("activo", true)
    .order("codigo");
  consultaClientes =
    vista === "porteria" ? consultaClientes.eq("categoria", "quintero") : consultaClientes.neq("categoria", "ambulante");

  const [plano, clientesRes, deudaRes, avanceRes, conceptosRes, pendientesRes, avisosRes] = await Promise.all([
    cargarPlano(supabase, perfil, { conClientes: vista === "completa" }),
    consultaClientes,
    supabase.from("v_deuda_clientes").select("cliente_id, deuda, periodo_mas_viejo").eq("org_id", perfil.org_id),
    supabase
      .from("v_avance_mes")
      .select("cliente_id, total, pagado, falta, cuotas, cuotas_cubiertas, cuota_sugerida")
      .eq("org_id", perfil.org_id)
      .eq("periodo", periodo),
    vista === "completa"
      ? supabase.from("conceptos").select("id, codigo").eq("org_id", perfil.org_id).in("codigo", CODIGOS_PLANO)
      : Promise.resolve({ data: [] as { id: string; codigo: string }[] }),
    vista === "completa"
      ? supabase
          .from("cambios_pendientes")
          .select("cliente_id")
          .eq("org_id", perfil.org_id)
          .eq("entidad", "cliente_concepto")
          .eq("estado", "pendiente")
      : Promise.resolve({ data: [] as { cliente_id: string | null }[] }),
    // Avisos del Jefe sobre puestos (G11): los que su RLS le deja ver (suyos y de Portería).
    vista === "porteria"
      ? supabase
          .from("solicitudes")
          .select("id, numero, asunto, estado, creada_en, espacio_id")
          .eq("org_id", perfil.org_id)
          .not("espacio_id", "is", null)
          .order("creada_en", { ascending: false })
          .limit(300)
      : Promise.resolve({ data: [] as { id: string; numero: number; asunto: string; estado: string; creada_en: string; espacio_id: string | null }[] }),
  ]);

  // El Jefe no ve "puesto propio" (no es dato suyo y no tiene leyenda): todos iguales.
  const espacios =
    vista === "porteria" ? plano.espacios.map((e) => ({ ...e, propio: false })) : plano.espacios;
  const elementos = plano.elementos;

  const deudaPorCliente = new Map(
    (deudaRes.data ?? []).filter((d) => d.cliente_id).map((d) => [d.cliente_id as string, d])
  );
  const avancePorCliente = new Map<string, AvanceMes>(
    (avanceRes.data ?? [])
      .filter((a) => a.cliente_id)
      .map((a) => [
        a.cliente_id as string,
        {
          total: Number(a.total ?? 0),
          pagado: Number(a.pagado ?? 0),
          falta: Number(a.falta ?? 0),
          cuotas: Number(a.cuotas ?? 1),
          cuotas_cubiertas: Number(a.cuotas_cubiertas ?? 0),
          cuota_sugerida: Number(a.cuota_sugerida ?? 0),
        },
      ])
  );
  const conPendiente = new Set(
    (pendientesRes.data ?? []).map((p) => p.cliente_id).filter((id): id is string => Boolean(id))
  );
  const conceptosPlano: Partial<Record<CodigoPlano, string>> = {};
  for (const c of conceptosRes.data ?? []) {
    if (CODIGOS_PLANO.includes(c.codigo as CodigoPlano)) conceptosPlano[c.codigo as CodigoPlano] = c.id;
  }

  const clientes: ClienteMapa[] = (clientesRes.data ?? []).map((c) => {
    const facturado: Facturado = {
      puestos: 0,
      propios: 0,
      locales: 0,
      contenedores: 0,
      quintas: 0,
      cocheras: 0,
      galpones: 0,
    };
    const carpeta: Partial<Record<CodigoPlano, ItemCarpeta>> = {};
    for (const cc of c.cliente_conceptos ?? []) {
      if (!cc.conceptos) continue;
      const codigo = cc.conceptos.codigo;
      if (CODIGOS_PLANO.includes(codigo as CodigoPlano)) {
        carpeta[codigo as CodigoPlano] = { id: cc.id, cantidad: Number(cc.cantidad), activo: cc.activo };
      }
      if (!cc.activo) continue;
      const clave = CONCEPTO_FACTURADO[codigo];
      if (clave) facturado[clave] = (facturado[clave] ?? 0) + Number(cc.cantidad);
    }
    const d = deudaPorCliente.get(c.id);
    const deuda = Number(d?.deuda ?? 0);
    // Debe = tiene saldo del mes; deuda atrasada = arrastra meses anteriores.
    const estado: EstadoCobro =
      deuda <= 0
        ? "al_dia"
        : d?.periodo_mas_viejo && d.periodo_mas_viejo < periodo
          ? "vencido"
          : "debe";
    return {
      id: c.id,
      codigo: c.codigo,
      nombre: c.nombre,
      apodo: c.apodo?.trim() ? c.apodo.trim() : null,
      deuda,
      estado,
      facturado,
      categoria: c.categoria as CategoriaCliente,
      mes: avancePorCliente.get(c.id) ?? null,
      ...(vista === "completa" ? { carpeta, cambioPendiente: conPendiente.has(c.id) } : {}),
    };
  });

  const avisos: Record<string, AvisoPuestoPrevio[]> = {};
  for (const s of avisosRes.data ?? []) {
    if (!s.espacio_id) continue;
    (avisos[s.espacio_id] ??= []).push({
      id: s.id,
      numero: s.numero,
      asunto: s.asunto,
      estado: s.estado,
      creadaEn: s.creada_en,
    });
  }

  const inicialEspacio = uno(sp.espacio);

  // La pantalla entera es el plano: sin título, del alto de la ventana menos
  // las barras del celular (0 en escritorio).
  return (
    <div className="flex h-[calc(100dvh-var(--cabecera-movil)-var(--nav-inferior))] min-h-[26rem] flex-col">
      <h1 className="sr-only">{vista === "porteria" ? "Mapa del mercado: quintas y avisos" : "Mapa del mercado"}</h1>
      {espacios.length === 0 ? (
        <div className="p-4 md:p-7">
          <EmptyState
            icono={MapIcon}
            titulo={plano.error ? "No pudimos cargar el plano" : "Todavía no está cargado el plano"}
            descripcion={
              plano.error
                ? "Recargá la página en un rato. Si sigue igual, avisale al Líder de Procesos."
                : "Cuando se carguen los puestos del predio (supabase/plano), acá vas a ver el mapa con el estado de cobro de cada uno."
            }
          />
        </div>
      ) : (
        <MapaOrientable
          espacios={espacios}
          elementos={elementos}
          clientes={clientes}
          puedeEditar={puedeEditar}
          destinos={{
            ficha: "/clientes",
            cobro: ROLES_COBRAN.includes(perfil.rol) ? "/cobranza" : null,
          }}
          soloQuinteros={perfil.rol === "guardia"}
          vista={vista}
          avisos={avisos}
          conceptosPlano={conceptosPlano}
          categoriasGestion={categoriasDeRol(perfil.rol)}
          inicial={{
            clienteId: uno(sp.cliente) ?? null,
            puesto: uno(sp.puesto) ?? null,
            espacioId: inicialEspacio && UUID.test(inicialEspacio) ? inicialEspacio : null,
            editar: puedeEditar && uno(sp.editar) === "1",
          }}
        />
      )}
    </div>
  );
}
