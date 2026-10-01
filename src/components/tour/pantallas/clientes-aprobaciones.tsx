import {
  ArrowRight,
  ArrowUpRight,
  CheckCheck,
  CircleCheck,
  ClipboardClock,
  FolderOpen,
  HandCoins,
  Info,
  Minus,
  Pencil,
  Plus,
  Save,
  Search,
  Send,
  Stamp,
  Undo2,
  UserPlus,
  UserX,
  XCircle,
} from "lucide-react";
import type { CategoriaCliente } from "@/lib/segmentos";
import { cn } from "@/lib/utils";
import { Codigo } from "@/components/shared/codigo";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { ChipCategoria } from "@/components/clientes/chip-categoria";
import { BotonEjemplo, CampoEjemplo, FilaEjemplo, MarcoPantalla, Resaltado } from "@/components/tour/pantalla";

// Tour guiado · clientes-aprobaciones: pantallas de ejemplo (docs/GUIA-TOUR.md).
// Dibujos quietos, sin estado ni handlers. Mismos títulos y botones que las pantallas reales.

/** Sello en chico, para que entre en la tarjeta del tour. */
const SELLO_CHICO = "px-1.5 py-0.5 text-[0.72rem]";
/** Texto chico (el mínimo de las pantallas de ejemplo). */
const CHICO = "text-[0.72rem]";

/* ------------------------------------------------------------------ */
/* Piezas                                                              */
/* ------------------------------------------------------------------ */

function ChipFiltro({ label, cantidad, activo = false }: { label: string; cantidad: number; activo?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 font-medium whitespace-nowrap",
        CHICO,
        activo ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
      )}
    >
      {label}
      <span className={cn("tabular font-semibold", activo ? "text-primary-foreground/85" : "text-muted-foreground")}>
        {cantidad}
      </span>
    </span>
  );
}

function BuscadorEjemplo({ texto, placeholder }: { texto?: string; placeholder: string }) {
  return (
    <div className="flex min-h-8 items-center gap-2 rounded-md border border-border bg-card px-2.5">
      <Search className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
      {texto ? <span>{texto}</span> : <span className="text-muted-foreground/70">{placeholder}</span>}
    </div>
  );
}

function Interruptor({ prendido = true }: { prendido?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "inline-flex h-4 w-7 items-center rounded-full p-0.5",
          prendido ? "justify-end bg-primary" : "justify-start bg-muted-foreground/30"
        )}
      >
        <span className="size-3 rounded-full bg-white" />
      </span>
      <span className={cn(CHICO, "text-muted-foreground")}>{prendido ? "Se factura" : "No se factura"}</span>
    </span>
  );
}

/** − cantidad + (de cuarto en cuarto). */
function StepperEjemplo({ valor }: { valor: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="flex size-6 items-center justify-center rounded-md border border-border bg-card">
        <Minus className="size-3" strokeWidth={2.2} />
      </span>
      <span className="flex h-6 min-w-8 items-center justify-center rounded-md border border-border bg-card px-1 font-semibold tabular">
        {valor}
      </span>
      <span className="flex size-6 items-center justify-center rounded-md border border-border bg-card">
        <Plus className="size-3" strokeWidth={2.2} />
      </span>
    </span>
  );
}

/** El campo del porcentaje, escrito como en la pantalla real ("125", "1,25"). */
function PorcentajeEjemplo({ valor }: { valor: number }) {
  return (
    <span className="inline-flex h-6 w-16 shrink-0 items-center justify-end gap-1 rounded-md border border-border bg-card px-1.5 tabular">
      {valor.toLocaleString("es-AR", { maximumFractionDigits: 2 })}
      <span className="text-muted-foreground">%</span>
    </span>
  );
}

/** Un aviso como los que aparecen abajo al guardar ("Enviado al Líder…"). */
function AvisoEjemplo({ titulo, detalle, accion }: { titulo: string; detalle?: string; accion?: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-card px-2.5 py-2 shadow-sm">
      <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-pagado" strokeWidth={2.2} />
      <div className="min-w-0 flex-1">
        <p className={cn(CHICO, "font-semibold")}>{titulo}</p>
        {detalle ? <p className={cn(CHICO, "text-muted-foreground")}>{detalle}</p> : null}
      </div>
      {accion ? (
        <span className={cn(CHICO, "shrink-0 rounded-md bg-primary px-1.5 py-0.5 font-semibold text-primary-foreground")}>
          {accion}
        </span>
      ) : null}
    </div>
  );
}

/** Una fila de "Qué paga cada mes": código, nombre, la cuenta y los controles. */
function ConceptoEjemplo({
  codigo,
  nombre,
  precio,
  cantidad,
  cantidadTexto,
  porcentaje,
  resaltarPorcentaje = false,
  boton,
}: {
  codigo: string;
  nombre: string;
  precio: number;
  cantidad: number;
  /** Cómo se ve la cantidad ("1½", "4"). */
  cantidadTexto: string;
  porcentaje: number;
  resaltarPorcentaje?: boolean;
  /** Si la fila tiene un cambio sin guardar: qué botón aparece. */
  boton?: "enviar" | "guardar";
}) {
  const monto = Math.round(cantidad * precio * porcentaje) / 100;
  const cuenta = [
    cantidad !== 1 ? cantidadTexto : null,
    cantidad !== 1 && porcentaje !== 100 ? "×" : null,
    porcentaje !== 100 ? `el ${porcentaje} %` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const porc = <PorcentajeEjemplo valor={porcentaje} />;
  return (
    <div className="space-y-1.5 px-2.5 py-2">
      <div className="flex items-start gap-2">
        <Codigo codigo={codigo} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{nombre}</p>
          <p className={cn(CHICO, "text-muted-foreground")}>
            <Money monto={precio} /> c/u
            {cuenta ? (
              <>
                {" "}
                · {cuenta} = <Money monto={monto} className="font-semibold text-foreground" />
              </>
            ) : null}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StepperEjemplo valor={cantidadTexto} />
        {resaltarPorcentaje ? (
          <Resaltado mano={!boton} className="rounded-md">
            {porc}
          </Resaltado>
        ) : (
          porc
        )}
        {boton ? (
          <Resaltado className="rounded-md">
            <BotonEjemplo className="min-h-6 px-2 text-[0.72rem]">
              {boton === "enviar" ? <Send /> : <Save />}
              {boton === "enviar" ? "Enviar a aprobación" : "Guardar"}
            </BotonEjemplo>
          </Resaltado>
        ) : null}
        {boton ? <Undo2 className="size-3.5 text-muted-foreground" strokeWidth={2} /> : <Interruptor />}
      </div>
    </div>
  );
}

function GrupoEjemplo({ children }: { children: string }) {
  return <p className={cn(CHICO, "bg-muted/40 px-2.5 py-1 font-semibold text-muted-foreground")}>{children}</p>;
}

function PorMes({ total, conBeneficio }: { total: number; conBeneficio?: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-lg bg-muted/50 px-2.5 py-2">
      <span className={cn(CHICO, "text-muted-foreground")}>Por mes</span>
      <span className="text-right">
        <Money monto={total} className="text-[0.95rem] font-bold" />
        {conBeneficio ? (
          <span className={cn(CHICO, "block text-muted-foreground")}>
            con beneficio en término <Money monto={conBeneficio} className="font-semibold text-pagado" />
          </span>
        ) : null}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lista de clientes                                                   */
/* ------------------------------------------------------------------ */

type FilaCliente = {
  codigo: string;
  nombre: string;
  detalle: string;
  categoria?: CategoriaCliente;
  socio?: boolean;
  deuda?: number;
  nivel: "al_dia" | "en_termino" | "vencido";
};

const PUESTEROS: FilaCliente[] = [
  {
    codigo: "58",
    nombre: "María Ledesma",
    detalle: "“La Colorada” · Puesto 58 · 4 galpones",
    socio: true,
    deuda: 1080000,
    nivel: "vencido",
  },
  { codigo: "12", nombre: "Oscar Fernández", detalle: "“Pocho” · Puestos 12 · 14", socio: true, nivel: "al_dia" },
  { codigo: "73", nombre: "Verdulería Juárez e Hijos", detalle: "Local 3", deuda: 450000, nivel: "en_termino" },
];

const DE_PORTERIA: FilaCliente[] = [
  { codigo: "201", nombre: "Ramón Aguirre", detalle: "“Don Ramón”", categoria: "quintero", deuda: 300000, nivel: "vencido" },
  { codigo: "312", nombre: "Hugo Ledesma", detalle: "“El Tucu”", categoria: "ambulante", nivel: "al_dia" },
  { codigo: "205", nombre: "Carmen Villalba", detalle: "“Carmencita”", categoria: "quintero", deuda: 75000, nivel: "en_termino" },
];

function FilaClienteEjemplo({ c }: { c: FilaCliente }) {
  return (
    <FilaEjemplo
      derecha={
        <span className="flex flex-col items-end gap-1">
          {c.deuda ? (
            <Money
              monto={c.deuda}
              className={cn("font-semibold", c.nivel === "vencido" ? "text-pendiente" : "text-parcial")}
            />
          ) : null}
          <Sello estado={c.nivel} className={SELLO_CHICO} />
        </span>
      }
    >
      <div className="flex items-start gap-2">
        <Codigo codigo={c.codigo} className="mt-0.5" />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1 font-medium">
            {c.nombre}
            {c.categoria ? <ChipCategoria categoria={c.categoria} className="py-0" /> : null}
            {c.socio ? <Sello estado="socio" className={SELLO_CHICO} /> : null}
          </p>
          <p className={cn(CHICO, "text-muted-foreground")}>{c.detalle}</p>
        </div>
      </div>
    </FilaEjemplo>
  );
}

function ListaEjemplo({ jefe = false, resaltar }: { jefe?: boolean; resaltar: "fila" | "buscar" | null }) {
  const filas = jefe ? DE_PORTERIA : PUESTEROS;
  const titulo = jefe ? "Quinteros y ambulantes" : "Clientes";
  const buscado = resaltar === "buscar";
  const buscar = (
    <div className="space-y-1.5">
      <BuscadorEjemplo
        texto={buscado ? (jefe ? "tucu" : "colo") : undefined}
        placeholder={jefe ? "Nombre, apodo o N° de carpeta" : "Nombre, apodo o N° de puesto"}
      />
      <p className={cn(CHICO, "font-medium text-muted-foreground")}>¿Qué tiene?</p>
      <div className="flex flex-wrap gap-1">
        {jefe ? (
          <>
            <ChipFiltro label="Quinteros" cantidad={18} />
            <ChipFiltro label="Ambulantes" cantidad={25} />
          </>
        ) : (
          <>
            <ChipFiltro label="Puesteros" cantidad={42} />
            <ChipFiltro label="Galpones" cantidad={6} />
            <ChipFiltro label="Socios" cantidad={38} />
          </>
        )}
      </div>
      <p className={cn(CHICO, "font-medium text-muted-foreground")}>¿Cómo está?</p>
      <div className="flex flex-wrap gap-1">
        <ChipFiltro label="Con deuda" cantidad={jefe ? 4 : 9} />
        <ChipFiltro label="Vencidos" cantidad={jefe ? 2 : 5} />
      </div>
    </div>
  );
  const visibles = buscado ? filas.slice(jefe ? 1 : 0, jefe ? 2 : 1) : filas.slice(0, 2);
  return (
    <MarcoPantalla titulo={titulo}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-[0.9rem] font-bold">{titulo}</p>
        <BotonEjemplo className="min-h-7 px-2 text-[0.72rem]">
          <UserPlus />
          {jefe ? "Nuevo quintero o ambulante" : "Nuevo cliente"}
        </BotonEjemplo>
      </div>
      {buscado ? <Resaltado className="p-1">{buscar}</Resaltado> : buscar}
      <div className="space-y-1.5">
        {visibles.map((c, i) =>
          resaltar === "fila" && i === 0 ? (
            <Resaltado key={c.codigo}>
              <FilaClienteEjemplo c={c} />
            </Resaltado>
          ) : (
            <FilaClienteEjemplo key={c.codigo} c={c} />
          )
        )}
      </div>
    </MarcoPantalla>
  );
}

/** Portada del capítulo: la lista de clientes con la primera fila señalada. */
export function PortadaClientes() {
  return <ListaEjemplo resaltar="fila" />;
}

/** Portada del Jefe de Portería: «Quinteros y ambulantes», con un quintero y un ambulante. */
export function PortadaClientesJefe() {
  return <ListaEjemplo jefe resaltar="fila" />;
}

/** Así se ve la lista cuando hay clientes (Administración y Líder). */
export function PantallaListaClientes() {
  return <ListaEjemplo resaltar="fila" />;
}

/** La lista del Jefe de Portería: quinteros y ambulantes. */
export function PantallaListaJefe() {
  return <ListaEjemplo jefe resaltar="fila" />;
}

/** El buscador y los botones para filtrar. */
export function PantallaBuscarClientes() {
  return <ListaEjemplo resaltar="buscar" />;
}

export function PantallaBuscarJefe() {
  return <ListaEjemplo jefe resaltar="buscar" />;
}

/* ------------------------------------------------------------------ */
/* Ficha: arriba, pestañas, qué paga                                   */
/* ------------------------------------------------------------------ */

function FichaArriba({ jefe = false }: { jefe?: boolean }) {
  const c = jefe
    ? {
        codigo: "201",
        categoria: "quintero" as const,
        socio: false,
        nombre: "Ramón Aguirre",
        contacto: "Le dicen “Don Ramón” · Persona física · 3541 998877",
        deuda: 300000,
      }
    : {
        codigo: "58",
        categoria: "puestero" as const,
        socio: true,
        nombre: "María Ledesma",
        contacto: "Le dicen “La Colorada” · Persona física · 3541 123456",
        deuda: 1080000,
      };
  return (
    <MarcoPantalla titulo="Ficha del cliente">
      <div className="flex flex-wrap items-center gap-1.5">
        <Codigo codigo={`N° ${c.codigo}`} />
        <ChipCategoria categoria={c.categoria} className="py-0" />
        {c.socio ? <Sello estado="socio" className={SELLO_CHICO} /> : null}
        <Sello estado="vencido" className={SELLO_CHICO} />
      </div>
      <div>
        <p className="font-display text-[0.95rem] font-bold">{c.nombre}</p>
        <p className={cn(CHICO, "text-muted-foreground")}>{c.contacto}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <BotonEjemplo className="min-h-7 px-2">
          <HandCoins /> Cobrar
        </BotonEjemplo>
        <BotonEjemplo variante="contorno" className="min-h-7 px-2">
          <Pencil /> Editar
        </BotonEjemplo>
        <BotonEjemplo variante="contorno" className="min-h-7 border-transparent bg-transparent px-2 text-destructive">
          <UserX /> Dar de baja
        </BotonEjemplo>
      </div>
      <Resaltado className="flex flex-wrap items-end gap-x-6 gap-y-1 px-2 py-1.5">
        <div>
          <p className={cn(CHICO, "text-muted-foreground")}>Debe hoy</p>
          <Money monto={c.deuda} className="block text-[1.15rem] font-bold text-pendiente" />
          <p className={cn(CHICO, "font-medium text-pendiente")}>
            <Money monto={c.deuda} /> vencido desde el 30/08/2026
          </p>
        </div>
        <div>
          <p className={cn(CHICO, "text-muted-foreground")}>Saldo a favor</p>
          <Money monto={0} className="block text-[1.15rem] font-bold text-muted-foreground/60" />
        </div>
      </Resaltado>
    </MarcoPantalla>
  );
}

/** La carpeta por arriba: sellos, nombre, botones y cuánto debe (puestero). */
export function PantallaFichaPuestero() {
  return <FichaArriba />;
}

/** La carpeta de un quintero, como la ve el Jefe de Portería. */
export function PantallaFichaQuintero() {
  return <FichaArriba jefe />;
}

function SolapasEjemplo({ jefe = false }: { jefe?: boolean }) {
  const solapas = jefe
    ? ["Cuenta", "Qué paga", "Documentos"]
    : ["Cuenta", "Qué paga", "Documentos", "Registros", "Medidores"];
  return (
    <MarcoPantalla titulo="Ficha del cliente">
      <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {solapas.map((s, i) =>
          s === "Qué paga" ? (
            <Resaltado key={s} className="rounded-md ring-offset-muted">
              <span className="flex h-6 items-center rounded-md px-2 font-medium">{s}</span>
            </Resaltado>
          ) : (
            <span
              key={s}
              className={cn(
                "flex h-6 items-center rounded-md px-2 font-medium",
                i === 0 ? "bg-card shadow-sm" : "text-muted-foreground"
              )}
            >
              {s}
            </span>
          )
        )}
      </div>
      <div className="space-y-1.5 opacity-60">
        <p className="font-semibold">Septiembre de 2026</p>
        <FilaEjemplo derecha={<Sello estado="vencido" className={SELLO_CHICO} />}>
          <p className="flex items-center gap-1.5">
            <Codigo codigo={jefe ? "EXPQ" : "EXME"} />
            {jefe ? "Expensas Quinteros" : "Expensas Cobradas"}
          </p>
        </FilaEjemplo>
      </div>
    </MarcoPantalla>
  );
}

/** Las pestañas de la carpeta, con «Qué paga» señalada. */
export function PantallaSolapas() {
  return <SolapasEjemplo />;
}

export function PantallaSolapasJefe() {
  return <SolapasEjemplo jefe />;
}

/** «Qué paga»: la expensa al 150 % (una y media) y 4 galpones al 110 %. */
export function PantallaQuePaga() {
  return (
    <MarcoPantalla titulo="Qué paga">
      <p className="font-display text-[0.85rem] font-bold">Qué paga cada mes</p>
      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        <GrupoEjemplo>Expensas</GrupoEjemplo>
        <ConceptoEjemplo
          codigo="EXME"
          nombre="Expensas Cobradas"
          precio={1080000}
          cantidad={1}
          cantidadTexto="1"
          porcentaje={150}
        />
        <GrupoEjemplo>Espacios</GrupoEjemplo>
        <ConceptoEjemplo
          codigo="EXPG"
          nombre="Expensas Galpón"
          precio={120000}
          cantidad={4}
          cantidadTexto="4"
          porcentaje={110}
          resaltarPorcentaje
        />
      </div>
      <PorMes total={2148000} conBeneficio={1936695.65} />
    </MarcoPantalla>
  );
}

/** Qué quiere decir cada porcentaje (más de 100 es más que el precio entero). */
function EquivalenciasEjemplo({ filas }: { filas: [number, string][] }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {filas.map(([p, dice]) => (
        <div key={p} className="flex items-center gap-1.5 rounded-md bg-muted/50 p-1">
          <PorcentajeEjemplo valor={p} />
          <span className={cn(CHICO, "leading-tight")}>{dice}</span>
        </div>
      ))}
    </div>
  );
}

/** Así sí (125) y así no (1,25): con 1,25 el monto da casi nada. */
function AsiSeEscribe({ precio, bien, mal }: { precio: number; bien: number; mal: number }) {
  const fila = (p: number, ok: boolean) => (
    <div className="flex items-center gap-2">
      {ok ? (
        <CircleCheck className="size-3.5 shrink-0 text-pagado" strokeWidth={2.2} />
      ) : (
        <XCircle className="size-3.5 shrink-0 text-pendiente" strokeWidth={2.2} />
      )}
      <span className={cn(CHICO, "w-11 shrink-0 font-semibold", ok ? "text-pagado" : "text-pendiente")}>
        {ok ? "Así sí" : "Así no"}
      </span>
      <PorcentajeEjemplo valor={p} />
      <Money monto={Math.round(precio * p) / 100} className={cn("font-semibold", !ok && "text-pendiente")} />
    </div>
  );
  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-card px-2.5 py-2">
      {fila(bien, true)}
      {fila(mal, false)}
    </div>
  );
}

/** El porcentaje de más de 100: la expensa al 125 % (una y cuarto), qué es cada número y
 * que se escribe 125, no 1,25. */
export function PantallaPorcentaje() {
  return (
    <MarcoPantalla titulo="Qué paga">
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <ConceptoEjemplo
          codigo="EXME"
          nombre="Expensas Cobradas"
          precio={1080000}
          cantidad={1}
          cantidadTexto="1"
          porcentaje={125}
          resaltarPorcentaje
        />
      </div>
      <EquivalenciasEjemplo
        filas={[
          [100, "el precio entero"],
          [125, "una y cuarto"],
          [150, "una y media"],
          [400, "cuatro veces el precio"],
        ]}
      />
      <AsiSeEscribe precio={1080000} bien={125} mal={1.25} />
    </MarcoPantalla>
  );
}

/** «Qué paga» de un quintero: la quinta y en cuántos pagos la cobra. */
export function PantallaQuePagaQuintero() {
  return (
    <MarcoPantalla titulo="Qué paga">
      <p className="font-display text-[0.85rem] font-bold">Qué paga cada mes</p>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <ConceptoEjemplo
          codigo="EXPQ"
          nombre="Expensas Quinteros"
          precio={300000}
          cantidad={1}
          cantidadTexto="1"
          porcentaje={100}
        />
      </div>
      <PorMes total={300000} />
      <p className="font-display text-[0.85rem] font-bold">¿En cuántos pagos cobra la quinta?</p>
      <Resaltado className="flex flex-wrap gap-1 p-1">
        {[
          ["1 vez", "Todo junto"],
          ["2 veces", "Quincenal"],
          ["3 veces", "Cada 10 días"],
          ["4 veces", "Semanal"],
        ].map(([o, ayuda]) => (
          <span
            key={o}
            className={cn(
              "flex min-w-14 flex-col items-center rounded-lg border px-1.5 py-1 leading-tight",
              o === "4 veces" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
            )}
          >
            <span className="font-semibold">{o}</span>
            <span
              className={cn(CHICO, o === "4 veces" ? "text-primary-foreground/85" : "text-muted-foreground")}
            >
              {ayuda}
            </span>
          </span>
        ))}
      </Resaltado>
      <p className={cn(CHICO, "text-muted-foreground")}>Hoy paga el mes en 4 veces. Son 4 pagos de ≈ $ 75.000.</p>
    </MarcoPantalla>
  );
}

/* ------------------------------------------------------------------ */
/* Pedir un cambio (Administración, Jefe) o guardarlo (Líder)          */
/* ------------------------------------------------------------------ */

/** Administración cambia el porcentaje del galpón y lo manda al Líder. */
export function PantallaPedirCambio() {
  return (
    <MarcoPantalla titulo="Qué paga">
      <p className={cn(CHICO, "flex items-start gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5")}>
        <Info className="mt-0.5 size-3 shrink-0" strokeWidth={2.2} />
        Los cambios rigen desde la próxima facturación mensual; el mes en curso no se toca. Cada cambio lo revisa y
        aprueba el Líder de Procesos.
      </p>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <ConceptoEjemplo
          codigo="EXPG"
          nombre="Expensas Galpón"
          precio={120000}
          cantidad={4}
          cantidadTexto="4"
          porcentaje={110}
          resaltarPorcentaje
          boton="enviar"
        />
      </div>
      <AvisoEjemplo
        titulo="Enviado al Líder de Procesos para su aprobación"
        detalle="Expensas Galpón sigue en 4 hasta que lo apruebe."
      />
    </MarcoPantalla>
  );
}

/** El Líder cambia el porcentaje y lo guarda en el acto. */
export function PantallaGuardarDirecto() {
  return (
    <MarcoPantalla titulo="Qué paga">
      <p className={cn(CHICO, "flex items-start gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5")}>
        <Info className="mt-0.5 size-3 shrink-0" strokeWidth={2.2} />
        Los cambios rigen desde la próxima facturación mensual; el mes en curso no se toca.
      </p>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <ConceptoEjemplo
          codigo="EXPG"
          nombre="Expensas Galpón"
          precio={120000}
          cantidad={4}
          cantidadTexto="4"
          porcentaje={110}
          resaltarPorcentaje
          boton="guardar"
        />
      </div>
      <AvisoEjemplo titulo="Expensas Galpón: ahora paga 4 al 110 %" />
    </MarcoPantalla>
  );
}

/** El Jefe corrige el teléfono de un quintero y lo manda al Líder. */
export function PantallaEditarQuintero() {
  return (
    <MarcoPantalla titulo="Editar datos del quintero">
      <p className={cn(CHICO, "text-muted-foreground")}>
        Corregí los datos de la carpeta y envialos: el Líder de Procesos los aprueba.
      </p>
      <CampoEjemplo etiqueta="Nombre y apellido" valor="Ramón Aguirre" />
      <CampoEjemplo etiqueta="Apodo (cómo le dicen, si tiene)" valor="Don Ramón" />
      <CampoEjemplo etiqueta="Teléfono (opcional)" valor="3541 556677" />
      <Resaltado>
        <BotonEjemplo className="w-full">
          <Send /> Enviar a aprobación
        </BotonEjemplo>
      </Resaltado>
      <p className={cn(CHICO, "text-center text-muted-foreground")}>
        Los cambios los revisa y aprueba el Líder de Procesos antes de aplicarse.
      </p>
    </MarcoPantalla>
  );
}

/* ------------------------------------------------------------------ */
/* Cambios esperando aprobación (arriba de la carpeta)                  */
/* ------------------------------------------------------------------ */

function CambiosEsperandoEjemplo({ quien }: { quien: "admin" | "jefe" | "lider" }) {
  const jefe = quien === "jefe";
  const pedido = jefe
    ? { resumen: "Cambiar teléfono de Ramón Aguirre", pidio: "Pidió Walter · 30/09, 09:10" }
    : {
        resumen: "Cambiar Expensas Galpón de María Ledesma: al 100 % → al 110 %",
        pidio: "Pidió Marta · 30/09, 10:15",
      };
  const rechazado = jefe
    ? {
        resumen: "Cambiar cómo paga el mes Ramón Aguirre: en 2 veces (quincenal)",
        motivo: "La quinta se cobra semanal, como todas.",
        pidio: "Pidió Walter · 22/09, 11:30 · Rechazó Graciela el 23/09, 09:05",
      }
    : {
        resumen: "Dejar de facturar Alquiler Cocheras a María Ledesma",
        motivo: "La cochera la sigue usando: se cobra igual.",
        pidio: "Pidió Marta · 22/09, 11:30 · Rechazó Graciela el 23/09, 09:05",
      };
  return (
    <MarcoPantalla titulo="Ficha del cliente">
      <Resaltado className="space-y-2 rounded-lg bg-card p-2.5">
        <p className="flex items-center gap-1.5 font-display font-bold">
          <ClipboardClock className="size-3.5 text-muted-foreground" strokeWidth={2} />
          Cambios esperando aprobación
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{pedido.resumen}</p>
            <p className={cn(CHICO, "text-muted-foreground")}>{pedido.pidio}</p>
          </div>
          <Sello estado="pendiente_aprobacion" className={SELLO_CHICO} />
        </div>
        {quien === "lider" ? (
          <p className={cn(CHICO, "text-muted-foreground")}>
            Los aprobás o rechazás desde <span className="font-medium text-primary">Aprobaciones</span>.
          </p>
        ) : (
          <p className={cn(CHICO, "text-muted-foreground")}>
            Hasta que el Líder de Procesos los apruebe, la carpeta sigue como está.
          </p>
        )}
      </Resaltado>
      {quien === "lider" ? null : (
        <div className="space-y-1">
          <p className={cn(CHICO, "font-medium text-muted-foreground")}>Rechazados en los últimos 15 días</p>
          <FilaEjemplo derecha={<Sello estado="rechazada" texto="Rechazado" className={SELLO_CHICO} />}>
            <p className="font-medium">{rechazado.resumen}</p>
            <p className={cn(CHICO, "text-pendiente")}>Motivo: {rechazado.motivo}</p>
            <p className={cn(CHICO, "text-muted-foreground")}>{rechazado.pidio}</p>
          </FilaEjemplo>
        </div>
      )}
    </MarcoPantalla>
  );
}

/** Lo que pidió Administración, esperando al Líder (y uno rechazado, con su motivo). */
export function PantallaCambiosEsperando() {
  return <CambiosEsperandoEjemplo quien="admin" />;
}

export function PantallaCambiosEsperandoJefe() {
  return <CambiosEsperandoEjemplo quien="jefe" />;
}

/** Lo que pidieron los demás, visto por el Líder. */
export function PantallaCambiosEsperandoLider() {
  return <CambiosEsperandoEjemplo quien="lider" />;
}

/* ------------------------------------------------------------------ */
/* Alta                                                                */
/* ------------------------------------------------------------------ */

/** Alta de un puestero (Administración): qué paga con porcentaje y «Enviar a aprobación». */
export function PantallaAltaPuestero() {
  return (
    <MarcoPantalla titulo="Nuevo puestero">
      <CampoEjemplo etiqueta="Nombre y apellido" valor="Oscar Fernández" />
      <div className="space-y-1">
        <p className={cn(CHICO, "font-medium text-muted-foreground")}>¿Es socio de la cooperativa?</p>
        <div className="flex gap-1.5">
          <span className="flex h-7 items-center rounded-lg border-2 border-primary bg-primary px-2 font-semibold text-primary-foreground">
            Sí, es socio
          </span>
          <span className="flex h-7 items-center rounded-lg border-2 border-border bg-card px-3 font-semibold">No</span>
        </div>
      </div>
      <p className="font-medium">¿Qué paga cada mes?</p>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="space-y-1.5 px-2.5 py-2">
          <div className="flex items-start gap-2">
            <Codigo codigo="EXME" className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">Expensas Cobradas</p>
              <p className={cn(CHICO, "text-muted-foreground")}>
                <Money monto={1080000} /> por mes
              </p>
            </div>
            <Money monto={1350000} className="font-semibold" />
          </div>
          <div className="flex items-center gap-2">
            <StepperEjemplo valor="1" />
            <Resaltado mano={false} className="rounded-md">
              <PorcentajeEjemplo valor={125} />
            </Resaltado>
          </div>
        </div>
      </div>
      <PorMes total={1350000} conBeneficio={1173913.04} />
      <Resaltado>
        <BotonEjemplo className="w-full">
          <Send /> Enviar a aprobación
        </BotonEjemplo>
      </Resaltado>
      <p className={cn(CHICO, "text-center text-muted-foreground")}>
        El alta la revisa y aprueba el Líder de Procesos; hasta entonces no aparece en la lista.
      </p>
    </MarcoPantalla>
  );
}

/** Alta de un ambulante por el Jefe: queda cargado en el acto y se le cobra enseguida. */
export function PantallaAltaAmbulante() {
  return (
    <MarcoPantalla titulo="Nuevo quintero o ambulante" contenidoClassName="space-y-2.5 p-3 text-center">
      <div className="pt-1">
        <Sello estado="activo" texto="Dado de alta" grande />
      </div>
      <div>
        <p className="font-display text-[1rem] font-bold">Hugo Ledesma</p>
        <p className={cn(CHICO, "text-muted-foreground")}>Ambulante · N° de carpeta 312</p>
      </div>
      <p>Ya le podés cobrar. El Líder de Procesos lo va a revisar después.</p>
      <div className="mx-auto flex max-w-60 flex-col gap-1.5">
        <Resaltado>
          <BotonEjemplo className="w-full">
            <HandCoins /> Cobrarle ahora
          </BotonEjemplo>
        </Resaltado>
        <BotonEjemplo variante="contorno" className="w-full">
          <FolderOpen /> Ver su carpeta
        </BotonEjemplo>
        <BotonEjemplo variante="contorno" className="w-full border-transparent bg-transparent">
          <Plus /> Dar de alta otro ambulante
        </BotonEjemplo>
      </div>
    </MarcoPantalla>
  );
}

/** Alta del Líder: elige qué es y lo da de alta en el acto. */
export function PantallaAltaLider() {
  const tarjeta = (label: string, ayuda: string, activo: boolean) => (
    <div
      className={cn(
        "rounded-lg border-2 px-2 py-1.5",
        activo ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card"
      )}
    >
      <p className="font-semibold">{label}</p>
      <p className={cn(CHICO, "text-muted-foreground")}>{ayuda}</p>
    </div>
  );
  return (
    <MarcoPantalla titulo="Nuevo cliente">
      <p className="font-medium">¿Qué es?</p>
      <Resaltado mano={false} className="grid gap-1.5 p-1">
        {tarjeta("Puestero", "Tiene puesto, local, galpón o contéiner", true)}
        {tarjeta("Quintero", "Alquila la quinta: paga por mes", false)}
        {tarjeta("Ambulante", "Vende por día: se le cobra cuando viene", false)}
        {tarjeta("Empleado", "Alquila cochera: solo se le cobra eso", false)}
      </Resaltado>
      <CampoEjemplo etiqueta="Nombre y apellido" valor="Oscar Fernández" />
      <BotonEjemplo className="w-full">
        <UserPlus /> Dar de alta al puestero
      </BotonEjemplo>
    </MarcoPantalla>
  );
}

/* ------------------------------------------------------------------ */
/* Aprobaciones                                                        */
/* ------------------------------------------------------------------ */

function PestanasAprobaciones({ activa = "pendientes" }: { activa?: "pendientes" | "revisar" }) {
  const pestanas: { valor: string; label: string; n: number; ambar: boolean }[] = [
    { valor: "pendientes", label: "Pendientes", n: 2, ambar: true },
    { valor: "revisar", label: "Aplicadas por el Jefe", n: 1, ambar: true },
    { valor: "aprobados", label: "Aprobados", n: 14, ambar: false },
    { valor: "rechazados", label: "Rechazados", n: 3, ambar: false },
  ];
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
      {pestanas.map((p) => (
        <span
          key={p.valor}
          className={cn(
            "flex h-6 items-center gap-1 rounded-md px-1.5 font-medium",
            p.valor === activa ? "bg-card shadow-sm" : "text-muted-foreground"
          )}
        >
          {p.label}
          <span
            className={cn(
              "tabular text-[0.72rem] font-bold",
              p.ambar ? "rounded-full bg-parcial px-1.5 text-white" : "text-muted-foreground"
            )}
          >
            {p.n}
          </span>
        </span>
      ))}
    </div>
  );
}

const PEDIDO_GALPON = "Cambiar Expensas Galpón de María Ledesma: al 100 % → al 110 %";

function CabeceraCambio() {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={cn(CHICO, "rounded-md bg-muted px-1.5 py-0.5 font-semibold text-muted-foreground")}>
          Concepto del cliente · Modificación
        </span>
        <Codigo codigo="EXPG" />
      </div>
      <p className="font-display text-[0.85rem] leading-snug font-bold">{PEDIDO_GALPON}</p>
      <p className={CHICO}>
        <span className="text-muted-foreground">Cambia: </span>
        <span className="font-medium">paga el</span>
      </p>
      <p className={cn(CHICO, "text-muted-foreground")}>
        Lo pidió <span className="font-medium text-foreground">Marta</span> (Administración) · 30/09, 10:15 ·{" "}
        <span className="inline-flex items-center font-medium text-primary">
          Ver ficha de María Ledesma
          <ArrowUpRight className="size-3" strokeWidth={2} />
        </span>
      </p>
    </div>
  );
}

function DiffEjemplo() {
  return (
    <div className={cn(CHICO, "overflow-hidden rounded-lg border border-border bg-card")}>
      <div className="grid grid-cols-[minmax(0,1fr)_1rem_minmax(0,1fr)] gap-x-2 border-b border-border bg-muted/40 px-2.5 py-1 font-semibold text-muted-foreground">
        <span>Antes</span>
        <span />
        <span>Después</span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_1rem_minmax(0,1fr)] gap-x-2 gap-y-0.5 px-2.5 py-1.5">
        <span className="col-span-3 font-medium text-muted-foreground">Paga el</span>
        <span className="text-muted-foreground">100 % del precio</span>
        <ArrowRight className="mt-0.5 size-3 text-muted-foreground" strokeWidth={2} />
        <span className="font-medium">110 % del precio</span>
      </div>
    </div>
  );
}

function BotonesCambio({ resaltar }: { resaltar: "aprobar" | "rechazar" | null }) {
  const rechazar = (
    <BotonEjemplo variante="contorno" className="min-h-7 px-2">
      <XCircle /> Rechazar
    </BotonEjemplo>
  );
  const aprobar = (
    <BotonEjemplo className="min-h-7 px-3">
      <Stamp /> Aprobar
    </BotonEjemplo>
  );
  return (
    <div className="flex justify-end gap-1.5 border-t border-border pt-2">
      {resaltar === "rechazar" ? <Resaltado className="rounded-md">{rechazar}</Resaltado> : rechazar}
      {resaltar === "aprobar" ? <Resaltado className="rounded-md">{aprobar}</Resaltado> : aprobar}
    </div>
  );
}

function TarjetaCambio({ resaltar }: { resaltar: "cabecera" | "diff" | "aprobar" | null }) {
  return (
    <div className="space-y-2 rounded-lg bg-card p-2.5 ring-1 ring-foreground/10">
      {resaltar === "cabecera" ? (
        <Resaltado className="p-1">
          <CabeceraCambio />
        </Resaltado>
      ) : (
        <CabeceraCambio />
      )}
      {resaltar === "diff" ? (
        <Resaltado>
          <DiffEjemplo />
        </Resaltado>
      ) : (
        <DiffEjemplo />
      )}
      <BotonesCambio resaltar={resaltar === "aprobar" ? "aprobar" : null} />
    </div>
  );
}

/** Portada de Aprobaciones: las pestañas y un pedido de Administración. */
export function PortadaAprobaciones() {
  return (
    <MarcoPantalla titulo="Aprobaciones">
      <PestanasAprobaciones />
      <TarjetaCambio resaltar="aprobar" />
    </MarcoPantalla>
  );
}

/** Un pedido en «Pendientes»: qué es, quién lo pidió y cuándo. */
export function PantallaCambioPendiente() {
  return (
    <MarcoPantalla titulo="Aprobaciones">
      <PestanasAprobaciones />
      <TarjetaCambio resaltar="cabecera" />
    </MarcoPantalla>
  );
}

/** El antes y el después de un pedido. */
export function PantallaDiffCambio() {
  return (
    <MarcoPantalla titulo="Aprobaciones">
      <TarjetaCambio resaltar="diff" />
    </MarcoPantalla>
  );
}

/** «Aprobar» y lo que pasa después: el aviso «Aplicado» con «Ver ficha». */
export function PantallaAprobar() {
  return (
    <MarcoPantalla titulo="Aprobaciones">
      <TarjetaCambio resaltar="aprobar" />
      <AvisoEjemplo titulo="Aplicado" detalle={PEDIDO_GALPON} accion="Ver ficha" />
    </MarcoPantalla>
  );
}

/** La ventana de «Rechazar»: el motivo es obligatorio. */
export function PantallaRechazo() {
  return (
    <MarcoPantalla titulo="Aprobaciones" contenidoClassName="space-y-2 bg-foreground/10 p-3">
      <div className="space-y-2 rounded-lg border border-border bg-card p-2.5 shadow-sm">
        <p className="font-display text-[0.85rem] font-bold">¿Rechazar este cambio?</p>
        <p className={cn(CHICO, "text-muted-foreground")}>
          {PEDIDO_GALPON}. No se aplica nada; quien lo pidió va a ver tu motivo para corregirlo y volver a
          enviarlo.
        </p>
        <Resaltado mano={false}>
          <CampoEjemplo etiqueta="Motivo del rechazo" valor="El contrato dice 4 galpones al 100 %." />
        </Resaltado>
        <p className={cn(CHICO, "text-muted-foreground")}>
          Obligatorio. Lo ve quien lo pidió junto al cambio rechazado.
        </p>
        <div className="flex justify-end gap-1.5">
          <BotonEjemplo variante="contorno" className="min-h-7 px-2">
            Volver
          </BotonEjemplo>
          <BotonEjemplo className="min-h-7 bg-destructive px-2 text-white">
            <XCircle /> Rechazar cambio
          </BotonEjemplo>
        </div>
      </div>
    </MarcoPantalla>
  );
}

/** Un alta de ambulante que el Jefe cargó en el acto, para mirar y marcar revisada. */
export function PantallaRevisionJefe() {
  const datos: [string, React.ReactNode][] = [
    ["N° de carpeta", "N.º 312"],
    ["Categoría", "Ambulante"],
    ["Nombre", "Hugo Ledesma"],
    ["Apodo", "El Tucu"],
    ["Socio de la cooperativa", "No"],
    ["CUIT / DNI", "30111222"],
  ];
  return (
    <MarcoPantalla titulo="Aprobaciones">
      <PestanasAprobaciones activa="revisar" />
      <div className="space-y-2 rounded-lg bg-card p-2.5 ring-1 ring-foreground/10">
        <Sello estado="revisar" className={SELLO_CHICO} />
        <p className="font-display text-[0.85rem] font-bold">Alta de ambulante Hugo Ledesma (N° 312)</p>
        <p className={cn(CHICO, "text-muted-foreground")}>
          Lo cargó <span className="font-medium text-foreground">Walter</span> (Jefe de Portería) · 30/09, 08:40
        </p>
        <dl className={cn(CHICO, "grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5")}>
          {datos.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-right text-muted-foreground">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="flex justify-end gap-1.5 border-t border-border pt-2">
          <BotonEjemplo variante="contorno" className="min-h-7 px-2 text-destructive">
            <UserX /> Dar de baja
          </BotonEjemplo>
          <Resaltado className="rounded-md">
            <BotonEjemplo className="min-h-7 px-2">
              <CheckCheck /> Marcar revisada
            </BotonEjemplo>
          </Resaltado>
        </div>
      </div>
    </MarcoPantalla>
  );
}
