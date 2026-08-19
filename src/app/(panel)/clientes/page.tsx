import Link from "next/link";
import { ChevronRight, ClipboardClock, UserPlus, Users } from "lucide-react";
import { aplicaDirecto, requireRol } from "@/lib/auth";
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
import { BotonExportar } from "@/components/shared/boton-exportar";
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

/** Patrón ilike seguro para usar dentro de `.or()` de PostgREST. */
function patronBusqueda(texto: string): string {
  return `%${texto.replace(/[,()"\\%_]/g, " ").trim()}%`;
}

export default async function ClientesPage({ searchParams }: Props) {
  const perfil = await requireRol("admin", "tesoreria", "consejo", "lider");
  const { q = "", filtro, tipo: tipoParam } = await searchParams;
  const texto = q.trim();
  // Compat: ?filtro=vencidos (links viejos) equivale a ?tipo=vencidos.
  const tipo = tipoParam ?? (filtro === "vencidos" ? "vencidos" : undefined);
  const esLider = aplicaDirecto(perfil.rol);

  const supabase = await createClient();

  let consulta = supabase
    .from("clientes")
    .select(
      "id, codigo, nombre, apodo, telefono, activo, cliente_conceptos(cantidad, activo, conceptos(codigo))"
    )
    .order("codigo");
  if (texto) {
    if (/^\d+$/.test(texto)) {
      consulta = consulta.eq("codigo", Number(texto));
    } else {
      const patron = patronBusqueda(texto);
      consulta = consulta.or(`nombre.ilike.${patron},apodo.ilike.${patron}`);
    }
  }

  const [clientesRes, deudaRes, saldoRes, cambiosRes] = await Promise.all([
    consulta,
    supabase
      .from("v_deuda_clientes")
      .select("cliente_id, deuda, periodo_mas_viejo"),
    supabase.from("v_saldo_favor").select("cliente_id, saldo_favor"),
    supabase
      .from("cambios_pendientes")
      .select("cliente_id, entidad, accion, resumen")
      .eq("estado", "pendiente"),
  ]);

  const deudaPorCliente = new Map(
    (deudaRes.data ?? [])
      .filter((d) => d.cliente_id)
      .map((d) => [d.cliente_id as string, d])
  );
  const saldoPorCliente = new Map(
    (saldoRes.data ?? [])
      .filter((s) => s.cliente_id)
      .map((s) => [s.cliente_id as string, Number(s.saldo_favor ?? 0)])
  );
  // Cambios esperando aprobación: por cliente (sello en la fila) y altas
  // de clientes que todavía no existen (aviso arriba de la lista).
  const cambiosPendientes = cambiosRes.data ?? [];
  const conPendientes = new Set(
    cambiosPendientes.flatMap((c) => (c.cliente_id ? [c.cliente_id] : []))
  );
  const altasPendientes = cambiosPendientes.filter(
    (c) => c.entidad === "cliente" && c.accion === "alta"
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
      saldoFavor: saldoPorCliente.get(c.id) ?? 0,
      tienePendientes: conPendientes.has(c.id),
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
        <BotonExportar dataset="clientes" className="h-12 px-4 text-base" />
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

      {altasPendientes.length > 0 && !texto && !tipo ? (
        <div className="flex flex-wrap items-start gap-3 rounded-lg border border-parcial/30 bg-parcial-suave px-4 py-3 text-parcial">
          <ClipboardClock className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
          <div className="min-w-0 flex-1 text-sm leading-snug">
            <p className="font-semibold">
              {altasPendientes.length === 1
                ? "Hay 1 cliente nuevo esperando aprobación del Líder de Procesos"
                : `Hay ${altasPendientes.length} clientes nuevos esperando aprobación del Líder de Procesos`}
            </p>
            <p className="text-parcial/90">
              {altasPendientes.map((a) => a.resumen.replace(/^Alta de cliente /, "")).join(" · ")}
              {esLider ? (
                <>
                  {" "}
                  ·{" "}
                  <Link href="/aprobaciones" className="font-medium underline underline-offset-2">
                    Revisar en Aprobaciones
                  </Link>
                </>
              ) : null}
            </p>
          </div>
        </div>
      ) : null}

      {clientes.length === 0 ? (
        texto || tipo ? (
          <EmptyState
            icono={Users}
            titulo="No encontramos clientes"
            descripcion={
              texto
                ? "Probá con otra parte del nombre, el apodo o el número de carpeta."
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
            const tieneSaldo = c.saldoFavor > 0.009;
            const detalle = [
              c.apodo ? `“${c.apodo}”` : null,
              c.extras ?? c.telefono,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <Link
                key={c.id}
                href={`/clientes/${c.id}`}
                className="flex min-h-12 items-center gap-3 px-4 py-2 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                <Codigo codigo={String(c.codigo)} />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
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
                    {!c.activo ? (
                      <Sello estado="inactivo" texto="Dado de baja" className="px-1.5 py-1 text-[0.62rem]" />
                    ) : null}
                    {c.tienePendientes ? (
                      <Sello
                        estado="pendiente_aprobacion"
                        className="px-1.5 py-1 text-[0.62rem]"
                      />
                    ) : null}
                  </div>
                  {detalle ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {detalle}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right">
                    <Money
                      monto={debe ? c.deuda : tieneSaldo ? c.saldoFavor : 0}
                      className={cn(
                        "block text-sm font-semibold",
                        debe
                          ? "text-pendiente"
                          : tieneSaldo
                            ? "text-pagado"
                            : "text-muted-foreground"
                      )}
                    />
                    {debe && tieneSaldo ? (
                      <span className="block text-xs text-pagado">
                        a favor <Money monto={c.saldoFavor} />
                      </span>
                    ) : null}
                  </div>
                  <Sello
                    estado={debe ? "debe" : tieneSaldo ? "saldo_favor" : "al_dia"}
                  />
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
