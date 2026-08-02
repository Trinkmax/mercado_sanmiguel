import { Map as MapIcon } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { periodoActual } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { MapaMercado } from "@/components/mapa/mapa-mercado";
import type {
  DepositoMapa,
  EspacioMapa,
  EstadoEspacio,
} from "@/components/mapa/tipos";

export const metadata = { title: "Mapa del mercado" };

export default async function MapaPage() {
  const perfil = await requireRol("admin", "guardia", "tesoreria", "consejo");
  const supabase = await createClient();
  const periodo = periodoActual();

  const [clientesRes, deudaRes] = await Promise.all([
    supabase
      .from("clientes")
      .select("id, codigo, nombre, cliente_conceptos(cantidad, activo, conceptos(codigo))")
      .eq("activo", true)
      .order("codigo"),
    supabase
      .from("v_deuda_clientes")
      .select("cliente_id, deuda, periodo_mas_viejo"),
  ]);

  const deudaPorCliente = new Map(
    (deudaRes.data ?? [])
      .filter((d) => d.cliente_id)
      .map((d) => [d.cliente_id as string, d])
  );

  const puesteros: EspacioMapa[] = [];
  const quinteros: EspacioMapa[] = [];
  const locales: EspacioMapa[] = [];
  const depositos: DepositoMapa[] = [];
  let cocheras = 0;
  const conDeuda = new Set<string>();

  for (const c of clientesRes.data ?? []) {
    // Cantidades por código de concepto (solo ítems activos).
    const cantidades = new Map<string, number>();
    for (const cc of c.cliente_conceptos ?? []) {
      if (!cc.activo || !cc.conceptos) continue;
      const codigo = cc.conceptos.codigo;
      cantidades.set(codigo, (cantidades.get(codigo) ?? 0) + Number(cc.cantidad));
    }

    cocheras += cantidades.get("EXPC") ?? 0;

    const d = deudaPorCliente.get(c.id);
    const deuda = Number(d?.deuda ?? 0);
    const estado: EstadoEspacio =
      deuda <= 0
        ? "al_dia"
        : d?.periodo_mas_viejo && d.periodo_mas_viejo < periodo
          ? "vencido"
          : "debe";
    const base: EspacioMapa = {
      id: c.id,
      codigo: c.codigo,
      nombre: c.nombre,
      deuda,
      estado,
    };

    const esPuestero = (cantidades.get("EXPP") ?? 0) > 0;
    const galpones = cantidades.get("EXPG") ?? 0;
    const contenedores = cantidades.get("EXPE") ?? 0;

    if (esPuestero) puesteros.push(base);
    if ((cantidades.get("EXPQ") ?? 0) > 0) quinteros.push(base);
    if ((cantidades.get("EXPL") ?? 0) > 0) locales.push(base);
    // Depósito puro: alquila galpón/contéiner sin tener puesto (si tiene
    // puesto, el galpón se le marca igual pero su lugar es la nave).
    if (!esPuestero && (galpones > 0 || contenedores > 0)) {
      depositos.push({ ...base, galpones, contenedores });
    }

    const enMapa =
      esPuestero ||
      (cantidades.get("EXPQ") ?? 0) > 0 ||
      (cantidades.get("EXPL") ?? 0) > 0 ||
      galpones > 0 ||
      contenedores > 0;
    if (enMapa && deuda > 0) conDeuda.add(c.id);
  }

  const hayEspacios =
    puesteros.length + quinteros.length + locales.length + depositos.length > 0;

  const stats = [
    { valor: puesteros.length, label: "Puestos ocupados", alerta: false },
    { valor: quinteros.length, label: "Quintas", alerta: false },
    { valor: locales.length, label: "Locales", alerta: false },
    { valor: conDeuda.size, label: "Con deuda", alerta: conDeuda.size > 0 },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Mapa del mercado"
        descripcion="El plano del predio con el estado de cobro de cada espacio. La ubicación es ilustrativa (se ordena por N° de carpeta)."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} size="sm" className="gap-0">
            <CardContent>
              <p
                className={cn(
                  "text-xl font-bold tabular",
                  s.alerta && "text-pendiente"
                )}
              >
                {s.valor}
              </p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {hayEspacios ? (
        <Card>
          <CardContent>
            <MapaMercado
              puesteros={puesteros}
              quinteros={quinteros}
              locales={locales}
              depositos={depositos}
              cocheras={cocheras}
              hrefBase={perfil.rol === "guardia" ? "/cobranza" : "/clientes"}
            />
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icono={MapIcon}
          titulo="Todavía no hay espacios para mostrar"
          descripcion="Cuando los clientes tengan sus ítems cargados (puestos, quintas, locales o galpones), acá vas a ver el plano con el estado de cobro de cada uno."
        />
      )}
    </div>
  );
}
