import Link from "next/link";
import { ChevronRight, ClipboardClock, UserPlus, Users } from "lucide-react";
import { aplicaDirecto, requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { nivelDeuda, SELLO_NIVEL_DEUDA, type NivelDeuda } from "@/lib/format";
import { categoriasDeRol, LABEL_SEGMENTO, type CategoriaCliente, type Segmento } from "@/lib/segmentos";
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
import { ChipCategoria } from "@/components/clientes/chip-categoria";
import {
  etiquetasCliente,
  FILTROS_ESTADO,
  leerFiltrosListado,
  normalizarBusqueda,
  segmentosDeRol,
  type ConceptoDeCliente,
  type EspacioDeCliente,
  type FiltroEstado,
} from "@/components/clientes/segmentos-cliente";

export const metadata = { title: "Clientes" };

type Props = {
  searchParams: Promise<{ q?: string; seg?: string; estado?: string; tipo?: string; filtro?: string }>;
};

function hrefListado(p: { q?: string; seg?: string | null; estado?: string | null }): string {
  const params = new URLSearchParams();
  if (p.q) params.set("q", p.q);
  if (p.seg) params.set("seg", p.seg);
  if (p.estado) params.set("estado", p.estado);
  const qs = params.toString();
  return qs ? `/clientes?${qs}` : "/clientes";
}

/**
 * Fila de chips: en celular es UNA fila que se desliza de costado (con 9 chips + 3, en varias
 * filas tapaban la primera pantalla y la lista quedaba abajo); desde tablet se acomodan solos.
 */
const FILA_CHIPS =
  "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden";

/**
 * Chip de filtro: link con su conteo; en 0 se atenúa (sigue tocable para salir). h-11 con la
 * raíz en 15 px da 41 px: en pantallas táctiles sube a 44 px.
 */
function ChipFiltro({
  href,
  label,
  cantidad,
  activo,
}: {
  href: string;
  label: string;
  cantidad: number;
  activo: boolean;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={activo ? "true" : undefined}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors pointer-coarse:min-h-[44px]",
        activo
          ? "border-primary bg-primary text-primary-foreground"
          : cantidad === 0
            ? "border-dashed bg-card text-muted-foreground/60 hover:bg-accent"
            : "border-border bg-card text-foreground hover:bg-accent"
      )}
    >
      {label}
      <span
        className={cn(
          "tabular text-xs font-semibold",
          activo ? "text-primary-foreground/85" : "text-muted-foreground"
        )}
      >
        {cantidad}
      </span>
    </Link>
  );
}

export default async function ClientesPage({ searchParams }: Props) {
  const perfil = await requireRol("admin", "guardia", "lider");
  const sp = await searchParams;
  const texto = (sp.q ?? "").trim();
  const filtros = leerFiltrosListado(sp);
  const esJefe = perfil.rol === "guardia";
  const esLider = aplicaDirecto(perfil.rol);
  const categorias = categoriasDeRol(perfil.rol);
  const chipsSegmento = segmentosDeRol(perfil.rol);
  // Un segmento que el rol no tiene como chip (link viejo) no filtra.
  const seg = filtros.seg && chipsSegmento.includes(filtros.seg) ? filtros.seg : null;
  const estado = filtros.estado;

  const supabase = await createClient();
  const [clientesRes, itemsRes, espaciosRes, deudaRes, saldoRes, cambiosRes] = await Promise.all([
    // Administración lee todos (joins de caja y circulares) pero acá ve solo puesteros (G8).
    supabase
      .from("v_clientes_segmentos")
      .select("cliente_id, codigo, nombre, apodo, categoria, es_socio, activo, segmentos")
      .in("categoria", categorias)
      .order("codigo"),
    supabase
      .from("cliente_conceptos")
      .select("cliente_id, cantidad, conceptos(codigo, activo)")
      .eq("activo", true),
    // El Jefe no lee la tabla espacios (0022): sus quinteros y ambulantes no están en el plano.
    esJefe
      ? Promise.resolve({ data: [] as (EspacioDeCliente & { cliente_id: string | null })[] })
      : supabase
          .from("espacios")
          .select("cliente_id, tipo, numero, medio, propio")
          .not("cliente_id", "is", null),
    supabase.from("v_deuda_clientes").select("cliente_id, deuda, deuda_vencida"),
    supabase.from("v_saldo_favor").select("cliente_id, saldo_favor"),
    supabase
      .from("cambios_pendientes")
      .select("cliente_id, entidad, accion, resumen, datos")
      .eq("estado", "pendiente"),
  ]);

  const deudaPorCliente = new Map(
    (deudaRes.data ?? []).flatMap((d) =>
      d.cliente_id
        ? [[d.cliente_id, { deuda: Number(d.deuda ?? 0), vencida: Number(d.deuda_vencida ?? 0) }] as const]
        : []
    )
  );
  const saldoPorCliente = new Map(
    (saldoRes.data ?? []).flatMap((s) =>
      s.cliente_id ? [[s.cliente_id, Number(s.saldo_favor ?? 0)] as const] : []
    )
  );
  const conceptosPorCliente = new Map<string, ConceptoDeCliente[]>();
  for (const i of itemsRes.data ?? []) {
    if (!i.conceptos?.activo) continue;
    const lista = conceptosPorCliente.get(i.cliente_id) ?? [];
    lista.push({ codigo: i.conceptos.codigo, cantidad: Number(i.cantidad) });
    conceptosPorCliente.set(i.cliente_id, lista);
  }
  const espaciosPorCliente = new Map<string, EspacioDeCliente[]>();
  for (const e of espaciosRes.data ?? []) {
    if (!e.cliente_id) continue;
    const lista = espaciosPorCliente.get(e.cliente_id) ?? [];
    lista.push({ tipo: e.tipo, numero: e.numero, medio: e.medio, propio: Boolean(e.propio) });
    espaciosPorCliente.set(e.cliente_id, lista);
  }

  // Cambios esperando aprobación: sello en la fila y altas de clientes que todavía no existen.
  const cambiosPendientes = cambiosRes.data ?? [];
  const conPendientes = new Set(cambiosPendientes.flatMap((c) => (c.cliente_id ? [c.cliente_id] : [])));
  const altasPendientes = cambiosPendientes.filter((c) => {
    if (c.entidad !== "cliente" || c.accion !== "alta") return false;
    const cat = (c.datos as { categoria?: string } | null)?.categoria ?? "puestero";
    return categorias.includes(cat as CategoriaCliente);
  });

  const todos = (clientesRes.data ?? []).flatMap((c) => {
    if (!c.cliente_id || !c.categoria) return [];
    const d = deudaPorCliente.get(c.cliente_id);
    const saldoFavor = saldoPorCliente.get(c.cliente_id) ?? 0;
    const deuda = d?.deuda ?? 0;
    const nivel: NivelDeuda = nivelDeuda({ deuda, deudaVencida: d?.vencida ?? 0, saldoFavor });
    const espacios = espaciosPorCliente.get(c.cliente_id) ?? [];
    return [
      {
        id: c.cliente_id,
        codigo: c.codigo ?? 0,
        nombre: c.nombre ?? "",
        apodo: c.apodo,
        categoria: c.categoria as CategoriaCliente,
        esSocio: Boolean(c.es_socio),
        activo: Boolean(c.activo),
        segmentos: (c.segmentos ?? []) as string[],
        etiquetas: etiquetasCliente(espacios, conceptosPorCliente.get(c.cliente_id) ?? []),
        numerosPlano: espacios.map((e) => e.numero ?? ""),
        deuda,
        vencida: d?.vencida ?? 0,
        saldoFavor,
        nivel,
        pendiente: conPendientes.has(c.cliente_id),
      },
    ];
  });
  type Fila = (typeof todos)[number];

  // Búsqueda: número = carpeta o N° de puesto; texto = nombre o apodo (sin tildes).
  const buscado = normalizarBusqueda(texto);
  const coincideTexto = (c: Fila) => {
    if (!buscado) return true;
    if (/^\d+$/.test(buscado))
      return String(c.codigo) === buscado || c.numerosPlano.includes(buscado);
    return (
      normalizarBusqueda(c.nombre).includes(buscado) ||
      normalizarBusqueda(c.apodo ?? "").includes(buscado)
    );
  };
  const coincideEstado = (c: Fila, e: FiltroEstado | null) => {
    if (e === "bajas") return !c.activo;
    if (!c.activo) return false; // las bajas se ven solo con su chip
    if (e === "deuda") return c.nivel !== "al_dia";
    if (e === "vencidos") return c.nivel === "vencido";
    return true;
  };
  const coincideSegmento = (c: Fila, s: Segmento | null) => !s || c.segmentos.includes(s);

  const buscados = todos.filter(coincideTexto);
  const conteoSegmento = (s: Segmento) =>
    buscados.filter((c) => coincideEstado(c, estado) && coincideSegmento(c, s)).length;
  const conteoEstado = (e: FiltroEstado) =>
    buscados.filter((c) => coincideEstado(c, e) && coincideSegmento(c, seg)).length;

  const clientes = buscados
    .filter((c) => coincideEstado(c, estado) && coincideSegmento(c, seg))
    .sort((a, b) =>
      estado === "deuda" || estado === "vencidos" ? b.deuda - a.deuda : a.codigo - b.codigo
    );
  const totalDeuda = clientes.reduce((acc, c) => acc + (c.activo ? c.deuda : 0), 0);
  const totalVencido = clientes.reduce((acc, c) => acc + (c.activo ? c.vencida : 0), 0);
  const hayFiltro = Boolean(texto || seg || estado);
  const hayClientes = todos.length > 0;

  const titulo = esJefe ? "Quinteros y ambulantes" : "Clientes";
  const nuevo = esJefe ? "Nuevo quintero o ambulante" : "Nuevo cliente";

  return (
    <div className="space-y-8">
      <PageHeader
        titulo={titulo}
        descripcion={
          esJefe
            ? "La carpeta de cada quintero y ambulante: sus datos, su cuenta y sus documentos."
            : "La carpeta de cada uno: sus datos, su cuenta, sus documentos y sus medidores."
        }
      >
        {hayClientes ? <BotonExportar dataset="clientes" className="h-12 px-4 text-base" /> : null}
        <Button asChild size="lg" className="h-12 px-6 text-base font-semibold" data-tour="clientes-nuevo">
          <Link href="/clientes/nuevo">
            <UserPlus className="size-5" />
            {nuevo}
          </Link>
        </Button>
      </PageHeader>

      {altasPendientes.length > 0 && !hayFiltro ? (
        <div className="flex flex-wrap items-start gap-3 rounded-lg border border-parcial/30 bg-parcial-suave px-4 py-3 text-parcial">
          <ClipboardClock className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
          <div className="min-w-0 flex-1 text-sm leading-snug">
            <p className="font-semibold">
              {altasPendientes.length === 1
                ? "Hay 1 alta esperando la aprobación del Líder de Procesos"
                : `Hay ${altasPendientes.length} altas esperando la aprobación del Líder de Procesos`}
            </p>
            <p className="text-parcial/90">
              {altasPendientes
                .map((a) => a.resumen.replace(/^Alta de (cliente|puestero|quintero|ambulante|empleado) /, ""))
                .join(" · ")}
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

      {hayClientes ? (
        <div className="space-y-3 sm:space-y-4" data-tour="clientes-buscar">
          <BuscadorClientes
            inicial={texto}
            seg={seg}
            estado={estado}
            // Corto para que entre entero en un celular de 360 px; el aria-label dice todo.
            placeholder={esJefe ? "Nombre, apodo o N° de carpeta" : "Nombre, apodo o N° de puesto"}
            etiqueta={
              esJefe
                ? "Buscá al quintero o ambulante por nombre, apodo o N° de carpeta"
                : "Buscá por nombre, apodo, N° de puesto o N° de carpeta"
            }
          />

          <div className="space-y-1.5 sm:space-y-2">
            <p className="text-sm font-medium text-muted-foreground">¿Qué tiene?</p>
            <div className={FILA_CHIPS} role="group" aria-label="Filtrar por lo que tiene">
              {chipsSegmento.map((s) => (
                <ChipFiltro
                  key={s}
                  href={hrefListado({ q: texto, seg: seg === s ? null : s, estado })}
                  label={LABEL_SEGMENTO[s]}
                  cantidad={conteoSegmento(s)}
                  activo={seg === s}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <p className="text-sm font-medium text-muted-foreground">¿Cómo está?</p>
            <div className={FILA_CHIPS} role="group" aria-label="Filtrar por cómo está">
              {FILTROS_ESTADO.map((f) => (
                <ChipFiltro
                  key={f.valor}
                  href={hrefListado({ q: texto, seg, estado: estado === f.valor ? null : f.valor })}
                  label={f.label}
                  cantidad={conteoEstado(f.valor)}
                  activo={estado === f.valor}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {!hayClientes ? (
        <EmptyState
          icono={Users}
          titulo={esJefe ? "Todavía no hay quinteros ni ambulantes" : "Todavía no hay clientes cargados"}
          descripcion={
            esJefe
              ? "Dá de alta al primero. Al ambulante le podés cobrar apenas lo cargás."
              : "Creá el primero para abrir su carpeta."
          }
        >
          <Button asChild size="lg" className="h-12 px-5 font-semibold">
            <Link href="/clientes/nuevo">
              <UserPlus className="size-5" />
              {nuevo}
            </Link>
          </Button>
        </EmptyState>
      ) : clientes.length === 0 ? (
        <EmptyState
          icono={Users}
          titulo="No encontramos a nadie con eso"
          descripcion={
            texto
              ? esJefe
                ? "Probá con otra parte del nombre, el apodo o el N° de carpeta (el número azul de cada fila)."
                : "Probá con otra parte del nombre, el apodo, el N° de puesto o el N° de carpeta (el número azul de cada fila)."
              : "Nadie cumple con los filtros elegidos. Tocá un chip marcado para sacarlo."
          }
        >
          <Button asChild variant="outline" size="lg" className="h-11 px-5 text-base">
            <Link href="/clientes">Ver todos</Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="space-y-3">
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-muted-foreground">
            <span>
              {clientes.length === 1 ? "1 cliente" : `${clientes.length} clientes`}
              {estado === "bajas" ? " dados de baja" : ""}
            </span>
            {totalDeuda > 0.009 ? (
              <span>
                · deben <Money monto={totalDeuda} className="font-semibold text-pendiente" />
                {totalVencido > 0.009 ? (
                  <>
                    {" "}
                    (<Money monto={totalVencido} className="font-semibold text-pendiente" /> vencido)
                  </>
                ) : null}
              </span>
            ) : null}
            {hayFiltro ? (
              <Link
                href="/clientes"
                scroll={false}
                className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
              >
                Sacar filtros
              </Link>
            ) : null}
          </p>

          <Card className="gap-0 divide-y overflow-hidden py-0">
            {clientes.map((c) => {
              const tieneSaldo = c.saldoFavor > 0.009;
              const detalle = [c.apodo ? `“${c.apodo}”` : null, ...c.etiquetas]
                .filter(Boolean)
                .join(" · ");
              return (
                <Link
                  key={c.id}
                  href={`/clientes/${c.id}`}
                  data-tour="clientes-fila"
                  className="flex min-h-16 items-start gap-3 px-4 py-3 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none sm:items-center sm:py-2.5"
                >
                  <Codigo codigo={String(c.codigo)} className="mt-0.5 sm:mt-0" />
                  {/* Celular: nombre y lugares a todo el ancho, la deuda en su renglón de abajo.
                      Desde tablet: la deuda a la derecha. Nada se corta con "…". */}
                  <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <p
                          title={c.nombre}
                          className={cn(
                            "min-w-0 text-base leading-snug font-medium break-words",
                            !c.activo && "text-muted-foreground"
                          )}
                        >
                          {c.nombre}
                        </p>
                        {categorias.length > 1 ? <ChipCategoria categoria={c.categoria} /> : null}
                        {c.esSocio ? <Sello estado="socio" className="px-1.5 py-1 text-[0.62rem]" /> : null}
                        {!c.activo ? (
                          <Sello estado="inactivo" texto="Dado de baja" className="px-1.5 py-1 text-[0.62rem]" />
                        ) : null}
                        {c.pendiente ? (
                          <Sello estado="pendiente_aprobacion" className="px-1.5 py-1 text-[0.62rem]" />
                        ) : null}
                      </div>
                      {detalle ? (
                        <p className="text-sm leading-snug break-words text-muted-foreground">{detalle}</p>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 sm:mt-0 sm:shrink-0 sm:flex-col sm:items-end sm:gap-1 sm:text-right">
                      {c.deuda > 0.009 ? (
                        <Money
                          monto={c.deuda}
                          className={cn(
                            "text-base font-semibold",
                            c.nivel === "vencido" ? "text-pendiente" : c.nivel === "en_termino" ? "text-parcial" : "text-muted-foreground"
                          )}
                        />
                      ) : tieneSaldo ? (
                        <span className="text-sm whitespace-nowrap text-pagado">
                          a favor <Money monto={c.saldoFavor} className="font-semibold" />
                        </span>
                      ) : null}
                      <Sello estado={SELLO_NIVEL_DEUDA[c.nivel]} />
                    </div>
                  </div>
                  <ChevronRight
                    className="size-4 shrink-0 self-center text-muted-foreground max-sm:hidden"
                    strokeWidth={2}
                  />
                </Link>
              );
            })}
          </Card>
        </div>
      )}
    </div>
  );
}
