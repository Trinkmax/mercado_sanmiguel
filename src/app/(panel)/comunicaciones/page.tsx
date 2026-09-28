import Link from "next/link";
import {
  Bell,
  ChevronRight,
  FileSignature,
  Gavel,
  Megaphone,
  MessageSquareWarning,
  Plus,
} from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatFecha, formatFechaTS } from "@/lib/format";
import { categoriasDeRol, textoPublico } from "@/lib/segmentos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { BotonExportar } from "@/components/shared/boton-exportar";
import {
  PestanasComunicaciones,
  type PestanaComunicaciones,
} from "@/components/comunicaciones/pestanas";
import { BarraRecepcion } from "@/components/comunicaciones/barra-recepcion";
import { PublicarTerminos } from "@/components/comunicaciones/publicar-terminos";
import {
  filtrarRegistros,
  ListaRegistros,
  ordenarRegistros,
  type FiltroRegistros,
} from "@/components/comunicaciones/lista-registros";
import { cargarClientesPublico, cargarRegistros } from "@/components/comunicaciones/datos";
import { resumenLectura } from "@/components/comunicaciones/publico";
import {
  infoTipoRegistro,
  saldoMulta,
  tipoDePestana,
  type TipoRegistro,
} from "@/components/comunicaciones/constantes";

export const metadata = { title: "Comunicaciones" };

const PESTANAS_VALIDAS: PestanaComunicaciones[] = [
  "circulares",
  "notificaciones",
  "apercibimientos",
  "sanciones",
  "terminos",
];

const FILTROS: { valor: FiltroRegistros; label: string }[] = [
  { valor: "todas", label: "Todas" },
  { valor: "esperan", label: "Esperan respuesta" },
  { valor: "sin_ver", label: "Sin ver" },
  { valor: "respondidas", label: "Respondidas" },
  { valor: "sin_efecto", label: "Sin efecto" },
];

export default async function ComunicacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; filtro?: string }>;
}) {
  const perfil = await requireRol("admin", "lider");
  const { tab, filtro } = await searchParams;
  const pestana: PestanaComunicaciones = PESTANAS_VALIDAS.includes(tab as PestanaComunicaciones)
    ? (tab as PestanaComunicaciones)
    : "circulares";
  const tipo = tipoDePestana(pestana);
  const categorias = categoriasDeRol(perfil.rol);
  const supabase = await createClient();

  // Descargos que esperan respuesta, por tipo (badge rojo en cada pestaña).
  const { data: esperando } = await supabase
    .from("sanciones")
    .select("tipo, clientes!inner(categoria)")
    .eq("estado", "descargo")
    .in("clientes.categoria", categorias);
  const badges: Partial<Record<PestanaComunicaciones, number>> = {};
  for (const e of esperando ?? []) {
    const p = infoTipoRegistro(e.tipo as TipoRegistro).pestana;
    badges[p] = (badges[p] ?? 0) + 1;
  }

  const descripcion =
    pestana === "circulares"
      ? "Avisos para los socios por grupo: vas a ver quién la vio y quién no."
      : pestana === "terminos"
        ? "Los términos y condiciones que acepta cada socio al entrar al portal."
        : `${infoTipoRegistro(tipo ?? "notificacion").ayuda} El socio lo ve en su portal.`;

  return (
    <div className="space-y-6">
      <PageHeader titulo="Comunicaciones" descripcion={descripcion}>
        {pestana === "circulares" ? (
          <>
            <BotonExportar dataset="circulares" />
            <Button asChild size="lg" className="h-12 px-5 text-base font-semibold">
              <Link href="/comunicaciones/nueva">
                <Plus className="size-5" strokeWidth={2.2} />
                Nueva circular
              </Link>
            </Button>
          </>
        ) : tipo ? (
          <>
            <BotonExportar dataset="registros" />
            <Button asChild size="lg" className="h-12 px-5 text-base font-semibold">
              <Link href={`/comunicaciones/registros/nuevo?tipo=${tipo}`}>
                <Plus className="size-5" strokeWidth={2.2} />
                {infoTipoRegistro(tipo).nuevo}
              </Link>
            </Button>
          </>
        ) : null}
      </PageHeader>

      <PestanasComunicaciones activa={pestana} badges={badges} />

      {pestana === "circulares" ? (
        <PestanaCirculares />
      ) : pestana === "terminos" ? (
        <PestanaTerminos esLider={perfil.rol === "lider"} />
      ) : tipo ? (
        <PestanaRegistros
          tipo={tipo}
          filtro={FILTROS.some((f) => f.valor === filtro) ? (filtro as FiltroRegistros) : "todas"}
          categorias={categorias}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Circulares
// ---------------------------------------------------------------------------

async function PestanaCirculares() {
  const supabase = await createClient();
  const [circularesRes, recepcionesRes, clientes] = await Promise.all([
    supabase
      .from("circulares")
      .select("id, numero, titulo, fecha, obligatoria, activa, publico")
      .order("numero", { ascending: false }),
    supabase.from("circular_recepciones").select("circular_id, cliente_id, recibida_en"),
    cargarClientesPublico(supabase),
  ]);
  const circulares = circularesRes.data ?? [];

  if (circulares.length === 0) {
    return (
      <EmptyState
        icono={Megaphone}
        titulo="Todavía no hay circulares"
        descripcion="Publicá la primera: elegís a qué grupo le llega y ves quién la vio. Si es obligatoria, el socio tiene que confirmar que la recibió."
      >
        <Button asChild size="lg" className="mt-2 h-12 px-5 font-semibold">
          <Link href="/comunicaciones/nueva">
            <Plus className="size-5" strokeWidth={2.2} />
            Nueva circular
          </Link>
        </Button>
      </EmptyState>
    );
  }

  const recepciones = new Map<string, Map<string, string>>();
  for (const r of recepcionesRes.data ?? []) {
    const m = recepciones.get(r.circular_id) ?? new Map<string, string>();
    m.set(r.cliente_id, r.recibida_en);
    recepciones.set(r.circular_id, m);
  }

  return (
    <Card className="gap-0 divide-y overflow-hidden py-0">
      {circulares.map((c) => {
        const res = resumenLectura(c.publico, clientes, recepciones.get(c.id) ?? new Map());
        return (
          <Link
            key={c.id}
            href={`/comunicaciones/${c.id}`}
            className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
          >
            <span
              className="w-10 shrink-0 text-right font-display text-lg font-bold tabular"
              aria-label={`Circular N° ${c.numero}`}
            >
              {c.numero}
            </span>

            <div className="min-w-0 flex-1 space-y-1">
              <p className={cn("line-clamp-2 font-medium leading-snug", !c.activa && "text-muted-foreground")}>
                {c.titulo}
              </p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span className="tabular">{formatFecha(c.fecha)}</span>
                <span className="rounded-full border bg-muted/60 px-2 py-px font-medium text-foreground">
                  {textoPublico(c.publico)}
                </span>
                <span
                  className={cn(
                    "rounded-full border px-2 py-px font-medium",
                    c.obligatoria ? "border-parcial/40 bg-parcial-suave text-parcial" : "bg-muted"
                  )}
                >
                  {c.obligatoria ? "Obligatoria" : "Informativa"}
                </span>
              </div>
              <div className="flex items-center gap-3 pt-0.5">
                <p className="shrink-0 text-sm tabular">
                  La vieron{" "}
                  <span
                    className={cn(
                      "font-semibold",
                      res.total > 0 && res.vieron >= res.total
                        ? "text-pagado"
                        : res.vieron === 0
                          ? "text-pendiente"
                          : "text-foreground"
                    )}
                  >
                    {res.vieron}
                  </span>{" "}
                  de {res.total}
                </p>
                <BarraRecepcion
                  recibidas={res.vieron}
                  total={res.total}
                  sinPortal={res.sinPortal}
                  compacta
                  soloBarra
                  className="max-w-48 flex-1"
                />
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {!c.activa ? <Sello estado="inactivo" texto="Desactivada" /> : null}
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
            </div>
          </Link>
        );
      })}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Notificaciones · Apercibimientos · Sanciones
// ---------------------------------------------------------------------------

async function PestanaRegistros({
  tipo,
  filtro,
  categorias,
}: {
  tipo: TipoRegistro;
  filtro: FiltroRegistros;
  categorias: ReturnType<typeof categoriasDeRol>;
}) {
  const supabase = await createClient();
  const todos = ordenarRegistros(await cargarRegistros(supabase, { categorias, tipo }));
  const info = infoTipoRegistro(tipo);

  const esperan = todos.filter((r) => r.estado === "descargo").length;
  const sinVer = todos.filter((r) => !r.visto_en && r.tienePortal).length;
  const multasPendientes = todos.reduce((acc, r) => acc + saldoMulta(r), 0);
  const conteo: Record<FiltroRegistros, number> = {
    todas: todos.length,
    esperan,
    sin_ver: sinVer,
    respondidas: todos.filter((r) => r.estado === "respondido").length,
    sin_efecto: todos.filter((r) => r.multa_sin_efecto_en).length,
  };
  const lista = filtrarRegistros(todos, filtro);
  const base = `/comunicaciones?tab=${info.pestana}`;

  if (todos.length === 0) {
    return (
      <EmptyState
        icono={tipo === "notificacion" ? Bell : tipo === "apercibimiento" ? MessageSquareWarning : Gavel}
        titulo={`Todavía no hay ${info.plural.toLowerCase()}`}
        descripcion={
          info.llevaMulta
            ? "Elegís al cliente o su puesto, contás qué pasó y, si corresponde, le sumás una multa a su cuenta. El socio lo ve en su portal y puede presentar su descargo."
            : "Elegís al cliente o su puesto y le mandás un aviso formal. Lo ve en su portal y puede responder."
        }
      >
        <Button asChild size="lg" className="mt-2 h-12 px-5 font-semibold">
          <Link href={`/comunicaciones/registros/nuevo?tipo=${tipo}`}>
            <Plus className="size-5" strokeWidth={2.2} />
            {info.nuevo}
          </Link>
        </Button>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-5">
      {/* Lo que importa, grande: quién espera respuesta, quién no lo vio y cuánto falta cobrar */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
        <Link
          href={`${base}&filtro=esperan`}
          className="flex min-h-20 flex-col justify-center bg-card px-4 py-3 transition-colors hover:bg-accent sm:px-5"
        >
          <span className="text-sm text-muted-foreground">Esperan tu respuesta</span>
          <span
            className={cn(
              "font-display text-2xl font-bold tabular",
              esperan > 0 ? "text-pendiente" : "text-foreground"
            )}
          >
            {esperan}
          </span>
        </Link>
        <Link
          href={`${base}&filtro=sin_ver`}
          className="flex min-h-20 flex-col justify-center bg-card px-4 py-3 transition-colors hover:bg-accent sm:px-5"
        >
          <span className="text-sm text-muted-foreground">Sin ver</span>
          <span className={cn("font-display text-2xl font-bold tabular", sinVer > 0 && "text-parcial")}>
            {sinVer}
          </span>
        </Link>
        <div className="col-span-2 flex min-h-20 flex-col justify-center bg-card px-4 py-3 sm:col-span-1 sm:px-5">
          <span className="text-sm text-muted-foreground">
            {info.llevaMulta ? "Multas por cobrar" : "Respondidas"}
          </span>
          {info.llevaMulta ? (
            <Money
              monto={multasPendientes}
              className={cn(
                "font-display text-2xl font-bold",
                multasPendientes > 0 ? "text-pendiente" : "text-foreground"
              )}
            />
          ) : (
            <span className="font-display text-2xl font-bold tabular">{conteo.respondidas}</span>
          )}
        </div>
      </div>

      {/* Filtros */}
      <nav aria-label="Filtrar" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {FILTROS.filter((f) => info.llevaMulta || f.valor !== "sin_efecto").map((f) => {
          const activo = f.valor === filtro;
          return (
            <Link
              key={f.valor}
              href={f.valor === "todas" ? base : `${base}&filtro=${f.valor}`}
              aria-current={activo ? "true" : undefined}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors",
                activo
                  ? "border-primary bg-accent text-foreground ring-2 ring-primary/25"
                  : "bg-card hover:bg-accent/60",
                conteo[f.valor] === 0 && !activo && "text-muted-foreground"
              )}
            >
              {f.label}
              <span className="tabular text-muted-foreground">{conteo[f.valor]}</span>
            </Link>
          );
        })}
      </nav>

      {lista.length === 0 ? (
        <EmptyState
          titulo="Nada por acá"
          descripcion="No hay registros con ese filtro."
          className="py-10"
        >
          <Button asChild variant="outline" className="min-h-11">
            <Link href={base}>Ver todas</Link>
          </Button>
        </EmptyState>
      ) : (
        <ListaRegistros registros={lista} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Términos y condiciones
// ---------------------------------------------------------------------------

async function PestanaTerminos({ esLider }: { esLider: boolean }) {
  const supabase = await createClient();
  const [terminosRes, clientes] = await Promise.all([
    supabase
      .from("terminos")
      .select("id, version, titulo, contenido, creado_en, vigente")
      .eq("vigente", true)
      .maybeSingle(),
    cargarClientesPublico(supabase),
  ]);
  const terminos = terminosRes.data;
  const totalPortal = clientes.filter((c) => c.activo && c.tiene_portal).length;
  const { count: aceptaron } = terminos
    ? await supabase
        .from("aceptaciones_terminos")
        .select("id", { count: "exact", head: true })
        .eq("terminos_id", terminos.id)
    : { count: 0 };

  return (
    <div className="space-y-6">
      {terminos ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg leading-snug">{terminos.titulo}</CardTitle>
            <CardDescription className="text-sm">
              Versión {terminos.version} · vigente desde{" "}
              <span className="tabular">{formatFechaTS(terminos.creado_en)}</span>
            </CardDescription>
            <CardAction>
              <Sello estado="activo" texto="Vigente" />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">Aceptada por</p>
              <p className="mt-0.5 text-2xl font-bold tabular">
                {aceptaron ?? 0}
                <span className="text-base font-normal text-muted-foreground">
                  {" "}
                  de {totalPortal} socios con acceso al portal
                </span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Los que faltan la van a aceptar la próxima vez que entren: sin aceptar no ven su
                cuenta.
              </p>
            </div>
            <div className="max-h-[28rem] overflow-y-auto rounded-lg border bg-card p-5">
              <p className="whitespace-pre-line text-[15px] leading-relaxed">{terminos.contenido}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icono={FileSignature}
          titulo="Todavía no hay términos y condiciones publicados"
          descripcion="Mientras no haya una versión vigente, el portal no pide aceptación."
        />
      )}

      {esLider ? (
        <PublicarTerminos
          tituloActual={terminos?.titulo ?? "Términos y condiciones del portal de socios"}
          contenidoActual={terminos?.contenido ?? ""}
          versionActual={terminos?.version ?? 0}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Solo el Líder de Procesos publica versiones nuevas.
        </p>
      )}
    </div>
  );
}
