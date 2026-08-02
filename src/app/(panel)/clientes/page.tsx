import Link from "next/link";
import { ChevronRight, UserPlus, Users } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { periodoActual } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { Codigo } from "@/components/shared/codigo";
import { EmptyState } from "@/components/shared/empty-state";
import { BuscadorClientes } from "@/components/clientes/buscador-clientes";
import {
  FILTROS_CLIENTES,
  TIPO_POR_FILTRO,
  derivarTipoCliente,
  extrasCliente,
} from "@/components/clientes/tipo-cliente";

export const metadata = { title: "Clientes" };

type Props = {
  searchParams: Promise<{ q?: string; filtro?: string; tipo?: string }>;
};

function hrefListado(texto: string, tipo?: string): string {
  const params = new URLSearchParams();
  if (texto) params.set("q", texto);
  if (tipo) params.set("tipo", tipo);
  const qs = params.toString();
  return qs ? `/clientes?${qs}` : "/clientes";
}

export default async function ClientesPage({ searchParams }: Props) {
  await requireRol("admin", "tesoreria", "consejo");
  const { q = "", filtro, tipo: tipoParam } = await searchParams;
  const texto = q.trim();
  // Compat: ?filtro=vencidos (links viejos) equivale a ?tipo=vencidos.
  const tipo = tipoParam ?? (filtro === "vencidos" ? "vencidos" : undefined);

  const supabase = await createClient();

  let consulta = supabase
    .from("clientes")
    .select(
      "id, codigo, nombre, telefono, activo, cliente_conceptos(cantidad, activo, conceptos(codigo))"
    )
    .order("codigo");
  if (texto) {
    consulta = /^\d+$/.test(texto)
      ? consulta.eq("codigo", Number(texto))
      : consulta.ilike("nombre", `%${texto}%`);
  }

  const [clientesRes, deudaRes] = await Promise.all([
    consulta,
    supabase
      .from("v_deuda_clientes")
      .select("cliente_id, deuda, periodo_mas_viejo"),
  ]);

  const deudaPorCliente = new Map(
    (deudaRes.data ?? [])
      .filter((d) => d.cliente_id)
      .map((d) => [d.cliente_id as string, d])
  );

  // Tipo y extras derivados de los conceptos activos, todo en memoria.
  let clientes = (clientesRes.data ?? []).map((c) => {
    const items = (c.cliente_conceptos ?? []).map((i) => ({
      cantidad: Number(i.cantidad),
      activo: i.activo,
      codigo: i.conceptos?.codigo ?? "",
    }));
    return {
      ...c,
      tipoCliente: derivarTipoCliente(items),
      extras: extrasCliente(items),
      deuda: Number(deudaPorCliente.get(c.id)?.deuda ?? 0),
      periodoMasViejo: deudaPorCliente.get(c.id)?.periodo_mas_viejo ?? null,
    };
  });

  if (tipo === "deuda") {
    clientes = clientes.filter((c) => c.deuda > 0);
  } else if (tipo === "vencidos") {
    const periodo = periodoActual();
    clientes = clientes.filter(
      (c) => c.periodoMasViejo != null && c.periodoMasViejo < periodo && c.deuda > 0
    );
  } else if (tipo && TIPO_POR_FILTRO[tipo]) {
    clientes = clientes.filter((c) => c.tipoCliente === TIPO_POR_FILTRO[tipo]);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Clientes"
        descripcion="La carpeta de cada uno: sus datos, su cuenta, sus documentos y sus medidores."
      >
        <Button asChild size="lg" className="h-13 px-6 text-base font-semibold">
          <Link href="/clientes/nuevo">
            <UserPlus className="size-5" />
            Nuevo cliente
          </Link>
        </Button>
      </PageHeader>

      <div className="space-y-3">
        <BuscadorClientes inicial={texto} tipo={tipo} />

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar clientes">
          {FILTROS_CLIENTES.map((f) => {
            const activo = f.valor === tipo;
            return (
              <Link
                key={f.label}
                href={hrefListado(texto, f.valor)}
                aria-current={activo ? "true" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium transition-colors",
                  activo
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
      </div>

      {clientes.length === 0 ? (
        texto || tipo ? (
          <EmptyState
            icono={Users}
            titulo="No encontramos clientes"
            descripcion={
              texto
                ? "Probá con otra parte del nombre o con el número de carpeta."
                : "No hay clientes con ese filtro. Tocá Todos para ver la lista completa."
            }
          />
        ) : (
          <EmptyState
            icono={Users}
            titulo="Todavía no hay clientes cargados"
            descripcion="Creá el primero para abrir su carpeta."
          >
            <Button asChild size="lg" className="h-12 px-5 font-semibold">
              <Link href="/clientes/nuevo">
                <UserPlus className="size-5" />
                Nuevo cliente
              </Link>
            </Button>
          </EmptyState>
        )
      ) : (
        <Card className="gap-0 divide-y overflow-hidden py-0">
          {clientes.map((c) => {
            const debe = c.deuda > 0;
            return (
              <Link
                key={c.id}
                href={`/clientes/${c.id}`}
                className="flex min-h-12 items-center gap-3 px-4 py-2 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                <Codigo codigo={String(c.codigo)} />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p
                      className={cn(
                        "truncate text-sm font-medium",
                        !c.activo && "text-muted-foreground"
                      )}
                    >
                      {c.nombre}
                    </p>
                    <span className="shrink-0 rounded-full border bg-muted px-2 py-px text-xs font-medium text-muted-foreground">
                      {c.tipoCliente}
                    </span>
                  </div>
                  {c.extras || c.telefono ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {c.extras ?? c.telefono}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Money
                    monto={c.deuda}
                    className={cn(
                      "text-right text-sm font-semibold",
                      debe ? "text-pendiente" : "text-muted-foreground"
                    )}
                  />
                  <Sello estado={debe ? "debe" : "al_dia"} />
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground max-sm:hidden"
                    strokeWidth={2}
                  />
                </div>
              </Link>
            );
          })}
        </Card>
      )}
    </div>
  );
}
