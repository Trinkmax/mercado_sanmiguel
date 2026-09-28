import { Map as MapIcon } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { ROLES_COBRAN } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { periodoActual } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { MapaMercado } from "@/components/mapa/mapa-mercado";
import type {
  ClienteMapa,
  ElementoPlano,
  Espacio,
  EstadoCobro,
  Facturado,
  TipoElemento,
  TipoEspacio,
} from "@/components/mapa/tipos";

export const metadata = { title: "Mapa del mercado" };

type Props = {
  searchParams: Promise<{ cliente?: string | string[]; puesto?: string | string[]; editar?: string | string[] }>;
};

const TIPOS_ESPACIO: TipoEspacio[] = ["puesto", "bar", "local", "contenedor"];
const TIPOS_ELEMENTO: TipoElemento[] = [
  "nave",
  "pasillo",
  "cocheras",
  "quinteros",
  "administracion",
  "invernadero",
  "recinto",
  "rotulo",
];

/** Código de concepto → qué cuenta en el plano. */
const CONCEPTO_FACTURADO: Record<string, keyof Facturado> = {
  EXPP: "puestos",
  EXPL: "locales",
  EXPE: "contenedores",
  EXPQ: "quintas",
  EXPC: "cocheras",
  EXPG: "galpones",
};

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function MapaPage({ searchParams }: Props) {
  const perfil = await requireRol("admin", "guardia", "tesoreria", "consejo", "lider");
  const sp = await searchParams;
  const supabase = await createClient();
  const periodo = periodoActual();
  const puedeEditar = perfil.rol === "admin" || perfil.rol === "lider";

  const [espaciosRes, elementosRes, clientesRes, deudaRes] = await Promise.all([
    supabase
      .from("espacios")
      .select("id, tipo, numero, medio, grupo, nota, cliente_id, x, y, w, h")
      .eq("org_id", perfil.org_id),
    supabase
      .from("plano_elementos")
      .select("id, tipo, etiqueta, capacidad, x, y, w, h, orden")
      .eq("org_id", perfil.org_id)
      .order("orden"),
    supabase
      .from("clientes")
      .select("id, codigo, nombre, apodo, cliente_conceptos(cantidad, activo, conceptos(codigo))")
      .eq("activo", true)
      .order("codigo"),
    supabase.from("v_deuda_clientes").select("cliente_id, deuda, periodo_mas_viejo"),
  ]);

  const espacios: Espacio[] = (espaciosRes.data ?? [])
    .filter((e): e is typeof e & { tipo: TipoEspacio } =>
      TIPOS_ESPACIO.includes(e.tipo as TipoEspacio)
    )
    .map((e) => ({
      id: e.id,
      tipo: e.tipo,
      numero: e.numero,
      medio: e.medio,
      grupo: e.grupo,
      nota: e.nota,
      clienteId: e.cliente_id,
      x: Number(e.x),
      y: Number(e.y),
      w: Number(e.w),
      h: Number(e.h),
    }));

  const elementos: ElementoPlano[] = (elementosRes.data ?? [])
    .filter((e): e is typeof e & { tipo: TipoElemento } =>
      TIPOS_ELEMENTO.includes(e.tipo as TipoElemento)
    )
    .map((e) => ({
      id: e.id,
      tipo: e.tipo,
      etiqueta: e.etiqueta,
      capacidad: e.capacidad,
      x: Number(e.x),
      y: Number(e.y),
      w: Number(e.w),
      h: Number(e.h),
    }));

  const deudaPorCliente = new Map(
    (deudaRes.data ?? [])
      .filter((d) => d.cliente_id)
      .map((d) => [d.cliente_id as string, d])
  );

  const clientes: ClienteMapa[] = (clientesRes.data ?? []).map((c) => {
    const facturado: Facturado = {
      puestos: 0,
      locales: 0,
      contenedores: 0,
      quintas: 0,
      cocheras: 0,
      galpones: 0,
    };
    for (const cc of c.cliente_conceptos ?? []) {
      if (!cc.activo || !cc.conceptos) continue;
      const clave = CONCEPTO_FACTURADO[cc.conceptos.codigo];
      if (clave) facturado[clave] += Number(cc.cantidad);
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
    };
  });

  const inicialCliente = uno(sp.cliente);
  const inicialPuesto = uno(sp.puesto);

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Mapa del mercado"
        descripcion={
          puedeEditar
            ? "El plano real del predio con el estado de cobro de cada puesto. Tocá un puesto para ver quién lo ocupa, o entrá en “Asignar puestos” para cargar la ocupación."
            : "El plano real del predio con el estado de cobro de cada puesto. Tocá un puesto para ver quién lo ocupa."
        }
      />

      {espacios.length === 0 ? (
        <EmptyState
          icono={MapIcon}
          titulo="Todavía no está cargado el plano"
          descripcion="Cuando se carguen los puestos del predio (supabase/plano), acá vas a ver el mapa con el estado de cobro de cada uno."
        />
      ) : (
        <MapaMercado
          espacios={espacios}
          elementos={elementos}
          clientes={clientes}
          puedeEditar={puedeEditar}
          destinos={{
            ficha: perfil.rol === "guardia" ? null : "/clientes",
            cobro: ROLES_COBRAN.includes(perfil.rol) ? "/cobranza" : null,
          }}
          soloQuinteros={perfil.rol === "guardia"}
          inicial={{
            clienteId: inicialCliente ?? null,
            puesto: inicialPuesto ?? null,
            editar: puedeEditar && uno(sp.editar) === "1",
          }}
        />
      )}
    </div>
  );
}
