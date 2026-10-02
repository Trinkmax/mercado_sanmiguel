import {
  AlertTriangle,
  ArrowLeft,
  BadgePercent,
  Banknote,
  CalendarDays,
  CalendarRange,
  Camera,
  Check,
  ChevronRight,
  FileText,
  Footprints,
  Images,
  Landmark,
  Minus,
  Plus,
  Printer,
  Repeat,
  Search,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Codigo } from "@/components/shared/codigo";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { BotonEjemplo, CampoEjemplo, MarcoPantalla, Resaltado } from "@/components/tour/pantalla";

// Tour guiado · cobranza: pantallas de ejemplo del capítulo "Cobrar" (docs/GUIA-TOUR.md).
// Dibujos quietos con datos inventados: la lista, la cuenta del cliente, el formulario de
// cobro, los medios de pago, el cobro registrado y el recibo impreso.

type Nivel = "al_dia" | "en_termino" | "vencido";

const COLOR_NIVEL: Record<Nivel, string> = {
  al_dia: "text-pagado",
  en_termino: "text-parcial",
  vencido: "text-pendiente",
};

// ---------------------------------------------------------------------------------------
// Piezas chicas
// ---------------------------------------------------------------------------------------

/** El buscador grande de la lista (con la lupa y el texto de ejemplo). */
function BuscadorEjemplo({ texto }: { texto: string }) {
  return (
    <div className="flex min-h-9 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-muted-foreground/70">
      <Search className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
      <span className="truncate">{texto}</span>
    </div>
  );
}

/** Los botones de arriba para elegir qué lista ver ("Quinteros (14)"). */
function CategoriasEjemplo({ opciones }: { opciones: { label: string; n: number; activa?: boolean }[] }) {
  return (
    <div className="flex overflow-hidden rounded-md border border-border bg-card">
      {opciones.map((o, i) => (
        <span
          key={o.label}
          className={cn(
            "flex min-h-10 flex-1 flex-col items-center justify-center text-[0.72rem] leading-tight font-semibold",
            i > 0 && "border-l border-border",
            o.activa ? "bg-muted text-foreground" : "text-muted-foreground"
          )}
        >
          <span>{o.label}</span>
          <span className="font-medium tabular opacity-80">({o.n})</span>
        </span>
      ))}
    </div>
  );
}

/** Barra del mes en cuotas: una celda por cuota, verde lo pagado sobre rojo suave. */
function BarraEjemplo({ cuotas, cubiertas, className }: { cuotas: number; cubiertas: number; className?: string }) {
  return (
    <div className={cn("flex h-1.5 w-24 gap-0.5", className)}>
      {Array.from({ length: cuotas }).map((_, i) => (
        <span key={i} className={cn("flex-1 rounded-sm", i < cubiertas ? "bg-pagado" : "bg-pendiente-suave")} />
      ))}
    </div>
  );
}

/** Un renglón de la lista de Cobrar: N° de carpeta, nombre, detalle y lo que debe con su sello. */
function FilaCobro({
  codigo,
  nombre,
  deuda,
  nivel,
  children,
}: {
  codigo: number;
  nombre: string;
  deuda: number;
  nivel: Nivel;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 bg-card px-2.5 py-2">
      <span className="w-7 shrink-0 text-right font-display font-bold tabular">{codigo}</span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate font-medium">{nombre}</p>
        {children}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Money monto={deuda} className={cn("font-semibold", COLOR_NIVEL[nivel])} />
        <Sello estado={nivel} className="text-[0.72rem]" />
      </div>
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
    </div>
  );
}

function Detalle({ children }: { children: React.ReactNode }) {
  return <p className="truncate text-[0.72rem] text-muted-foreground tabular">{children}</p>;
}

const FILAS_PUESTEROS = [
  <FilaCobro key="12" codigo={12} nombre="José Fernández" deuda={1100000} nivel="vencido">
    <Detalle>“Pocho” · Puestos 58 · 60</Detalle>
  </FilaCobro>,
  <FilaCobro key="27" codigo={27} nombre="María Luján Gómez" deuda={345000} nivel="en_termino">
    <Detalle>“La Colorada” · Galpón 9</Detalle>
  </FilaCobro>,
  <FilaCobro key="31" codigo={31} nombre="Ramón Quiroga" deuda={0} nivel="al_dia">
    <Detalle>“Don Ramón” · Puesto 14</Detalle>
  </FilaCobro>,
];

const FILAS_QUINTEROS = [
  <FilaCobro key="205" codigo={205} nombre="Carlos Benítez" deuda={150000} nivel="en_termino">
    <Detalle>“El Tano”</Detalle>
    <BarraEjemplo cuotas={4} cubiertas={2} />
    <p className="text-[0.72rem] font-medium text-muted-foreground tabular">2 de 4 · Falta $ 150.000</p>
  </FilaCobro>,
  <FilaCobro key="218" codigo={218} nombre="Norma Acosta" deuda={150000} nivel="en_termino">
    <Detalle>“Doña Norma”</Detalle>
    <BarraEjemplo cuotas={2} cubiertas={1} />
    <p className="text-[0.72rem] font-medium text-muted-foreground tabular">1 de 2 · Falta $ 150.000</p>
  </FilaCobro>,
];

type Quien = "admin" | "lider" | "jefe";
type ParteLista = "categorias" | "buscador" | "fila";

/** La pantalla Cobrar como la ve cada uno, con una parte señalada. */
function ListaEjemplo({ quien, resaltar }: { quien: Quien; resaltar: ParteLista }) {
  const jefe = quien === "jefe";
  const marcar = (parte: Exclude<ParteLista, "fila">, nodo: React.ReactNode) =>
    resaltar === parte ? <Resaltado>{nodo}</Resaltado> : nodo;
  const filas = jefe ? FILAS_QUINTEROS : FILAS_PUESTEROS;
  const categorias = jefe
    ? [
        { label: "Quinteros", n: 14, activa: true },
        { label: "Ambulantes", n: 23 },
      ]
    : quien === "lider"
      ? [
          { label: "Puesteros", n: 212, activa: true },
          { label: "Quinteros", n: 14 },
          { label: "Ambulantes", n: 23 },
        ]
      : null;

  return (
    <MarcoPantalla titulo="Cobrar">
      {jefe ? (
        <div className="rounded-md border border-border bg-card px-2.5 py-1.5">
          <p className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-muted-foreground">Hoy cobraste</span>
            <Money monto={180000} className="font-bold" />
            <span className="text-[0.72rem] text-muted-foreground">· 5 ambulantes · 2 quinteros</span>
          </p>
        </div>
      ) : null}
      {categorias ? marcar("categorias", <CategoriasEjemplo opciones={categorias} />) : null}
      {marcar(
        "buscador",
        <BuscadorEjemplo texto={jefe ? "Nombre, apodo, N° de carpeta o DNI" : "Nombre, apodo, N° de puesto o DNI"} />
      )}
      {resaltar === "fila" ? (
        <>
          <Resaltado>
            <div className="overflow-hidden rounded-lg border border-border">{filas[0]}</div>
          </Resaltado>
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {filas.slice(1)}
          </div>
        </>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">{filas}</div>
      )}
    </MarcoPantalla>
  );
}

/** Portada del capítulo: la lista de Cobrar con el primer cliente señalado. */
export function PortadaCobrar() {
  return <ListaEjemplo quien="admin" resaltar="fila" />;
}

export function PantallaBuscar() {
  return <ListaEjemplo quien="admin" resaltar="buscador" />;
}

export function PantallaFila() {
  return <ListaEjemplo quien="admin" resaltar="fila" />;
}

export function PantallaCategoriasLider() {
  return <ListaEjemplo quien="lider" resaltar="categorias" />;
}

export function PantallaBuscarLider() {
  return <ListaEjemplo quien="lider" resaltar="buscador" />;
}

export function PantallaFilaLider() {
  return <ListaEjemplo quien="lider" resaltar="fila" />;
}

export function PantallaCategoriasJefe() {
  return <ListaEjemplo quien="jefe" resaltar="categorias" />;
}

export function PantallaBuscarJefe() {
  return <ListaEjemplo quien="jefe" resaltar="buscador" />;
}

export function PantallaFilaJefe() {
  return <ListaEjemplo quien="jefe" resaltar="fila" />;
}

// ---------------------------------------------------------------------------------------
// La cuenta del cliente
// ---------------------------------------------------------------------------------------

const CARGOS_POCHO = [
  { codigo: "EXPP", descripcion: "Expensas Puestos × 2", periodo: "Agosto de 2026", vencido: true, monto: 460000 },
  { codigo: "ENER", descripcion: "Recupero Energía (400 kWh)", periodo: "Agosto de 2026", vencido: true, monto: 240000 },
  { codigo: "EXPP", descripcion: "Expensas Puestos × 2", periodo: "Septiembre de 2026", vencido: false, monto: 400000 },
];

function CabeceraCuenta({ nombre, descripcion }: { nombre: string; descripcion: string }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-[0.72rem] font-medium text-muted-foreground">
        <ArrowLeft className="size-3" strokeWidth={2} />
        Volver a la lista
      </p>
      <p className="font-display text-[0.95rem] font-bold">{nombre}</p>
      <p className="text-[0.72rem] text-muted-foreground">{descripcion}</p>
    </div>
  );
}

/** "Debe hoy" con cada cosa que debe, como en la cuenta del cliente. */
function DeudaEjemplo() {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-2.5 py-2">
        <div>
          <p className="text-[0.72rem] text-muted-foreground">Debe hoy</p>
          <Money monto={1100000} className="text-[1.05rem] font-bold text-pendiente" />
        </div>
        <Sello grande estado="vencido" className="px-2 py-1 text-[0.8rem]" />
      </div>
      <div className="divide-y divide-border px-2.5">
        {CARGOS_POCHO.map((c) => (
          <div key={`${c.codigo}-${c.periodo}`} className="flex items-start gap-2 py-1.5">
            <Codigo codigo={c.codigo} className="mt-0.5 text-[0.72rem]" />
            <div className="min-w-0 flex-1">
              <p className="leading-tight font-medium">{c.descripcion}</p>
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.72rem] text-muted-foreground">
                {c.periodo}
                {c.vencido ? <Sello estado="vencido" className="text-[0.72rem]" /> : null}
              </p>
            </div>
            <Money monto={c.monto} className="shrink-0 font-semibold" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Los dos carteles de arriba: rojo si perdió el beneficio; verde hasta cuándo lo mantiene,
 * ámbar cuando faltan 3 días o menos (acá vence hoy, 30/09, como en la pantalla real).
 */
function AvisosBeneficio() {
  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-2 rounded-lg border border-pendiente/50 bg-pendiente-suave px-2.5 py-2 text-[0.72rem] leading-snug">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-pendiente" strokeWidth={2} />
        <p>
          <strong className="text-pendiente">Tiene deuda vencida:</strong> perdió el beneficio por mora y
          debe el importe completo (<Money monto={60000} className="font-semibold" /> de recargo efectivo).
        </p>
      </div>
      <div className="flex items-start gap-2 rounded-lg border border-parcial bg-parcial-suave px-2.5 py-2 text-[0.72rem] leading-snug">
        <BadgePercent className="mt-0.5 size-3.5 shrink-0 text-parcial" strokeWidth={2} />
        <p>
          Pagando hasta el <strong className="tabular">30/09/2026</strong> (vence hoy) mantiene el{" "}
          <strong>beneficio por pago en término</strong> (ahorra{" "}
          <Money monto={60000} className="font-semibold" />
          ).
        </p>
      </div>
    </div>
  );
}

function CuentaEjemplo({ resaltar }: { resaltar: "deuda" | "beneficio" }) {
  return (
    <MarcoPantalla titulo="Cobrar · José Fernández">
      <CabeceraCuenta nombre="José Fernández" descripcion="Carpeta N° 12 · Puestero · “Pocho”" />
      {resaltar === "beneficio" ? (
        <Resaltado>
          <AvisosBeneficio />
        </Resaltado>
      ) : (
        <AvisosBeneficio />
      )}
      <div className={resaltar === "beneficio" ? "pt-2" : undefined}>
        {resaltar === "deuda" ? (
          <Resaltado>
            <DeudaEjemplo />
          </Resaltado>
        ) : (
          <DeudaEjemplo />
        )}
      </div>
    </MarcoPantalla>
  );
}

/** La cuenta de un puestero: lo que debe hoy, señalado. */
export function PantallaCuenta() {
  return <CuentaEjemplo resaltar="deuda" />;
}

/** La cuenta de un puestero: los carteles del beneficio por pago en término, señalados. */
export function PantallaBeneficio() {
  return <CuentaEjemplo resaltar="beneficio" />;
}

// ---------------------------------------------------------------------------------------
// El formulario de cobro
// ---------------------------------------------------------------------------------------

const ICONO_MEDIO: Record<string, LucideIcon> = {
  Efectivo: Banknote,
  Transferencia: Landmark,
  Cheque: FileText,
};

/** Los botones grandes de "¿Cómo te paga?". */
function ChipsMedio({
  opciones,
  activo,
  resaltar = false,
}: {
  opciones: string[];
  activo: string;
  /** Señala el medio elegido. */
  resaltar?: boolean;
}) {
  return (
    <div className={cn("grid gap-1.5", opciones.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
      {opciones.map((o) => {
        const Icono = ICONO_MEDIO[o] ?? Banknote;
        const chip = (
          <span
            className={cn(
              "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg border-2 px-1 text-center text-[0.72rem] leading-tight font-medium break-words hyphens-auto",
              o === activo ? "border-primary bg-primary/5 text-primary" : "border-border bg-card text-muted-foreground"
            )}
          >
            <Icono className="size-4" strokeWidth={2} />
            {o}
          </span>
        );
        return resaltar && o === activo ? <Resaltado key={o}>{chip}</Resaltado> : <div key={o}>{chip}</div>;
      })}
    </div>
  );
}

function CampoMonto({ valor }: { valor: string }) {
  return (
    <div className="flex min-h-10 flex-1 items-center rounded-md border border-border bg-card px-2.5 text-[1.05rem] font-semibold tabular">
      {valor}
    </div>
  );
}

/** El formulario de cobro de un puestero, con el monto señalado. */
export function PantallaFormCobro() {
  return (
    <MarcoPantalla titulo="Cobrar · José Fernández">
      <div className="space-y-1">
        <p className="font-medium">¿Cuánto te pagan?</p>
        <Resaltado>
          <div className="flex gap-1.5">
            <CampoMonto valor="700.000" />
            <BotonEjemplo variante="contorno" className="min-h-10">
              Cobrar todo
            </BotonEjemplo>
          </div>
        </Resaltado>
        <p className="pt-2 text-[0.72rem] text-muted-foreground tabular">
          Vas a cobrar <span className="font-semibold text-foreground">$ 700.000</span> · queda debiendo $ 400.000
        </p>
      </div>
      <div className="space-y-1">
        <p className="font-medium">¿Cómo te paga?</p>
        <ChipsMedio opciones={["Efectivo", "Transferencia", "Cheque"]} activo="Efectivo" />
      </div>
      <BotonEjemplo variante="contorno" className="w-full border-dashed text-primary">
        <Plus /> Pagar una parte con otro medio
      </BotonEjemplo>
      <BotonEjemplo className="min-h-10 w-full">Registrar cobro de $ 700.000</BotonEjemplo>
    </MarcoPantalla>
  );
}

function OpcionFoto({ icono: Icono, children }: { icono: LucideIcon; children: React.ReactNode }) {
  return (
    <span className="flex min-h-9 items-center justify-center gap-1 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 px-1.5 text-center text-[0.72rem] font-semibold text-primary">
      <Icono className="size-3.5 shrink-0" strokeWidth={2} />
      {children}
    </span>
  );
}

function DatosTransferenciaEjemplo({ titular }: { titular: string }) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-2.5">
      <CampoEjemplo etiqueta="A nombre de quién está la cuenta" valor={titular} />
      <div className="space-y-1">
        <p className="text-[0.72rem] font-medium text-muted-foreground">
          Foto del comprobante <span className="font-normal">(opcional)</span>
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <OpcionFoto icono={Camera}>Sacar foto</OpcionFoto>
          <OpcionFoto icono={Images}>Elegir de la galería</OpcionFoto>
        </div>
      </div>
    </div>
  );
}

function ChipEjemplo({ activo = false, children }: { activo?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-md border-2 px-2 text-[0.72rem] font-medium",
        activo ? "border-primary bg-primary/5 text-primary" : "border-border bg-card"
      )}
    >
      {children}
    </span>
  );
}

/** Lo que se completa con transferencia y con cheque (Administración y el Líder). */
export function PantallaMedios() {
  return (
    <MarcoPantalla titulo="¿Cómo te paga?">
      <ChipsMedio opciones={["Efectivo", "Transferencia", "Cheque"]} activo="Transferencia" resaltar />
      <div className="pt-1.5">
        <DatosTransferenciaEjemplo titular="José Fernández" />
      </div>
      <p className="text-[0.72rem] font-semibold text-muted-foreground">Si te paga con cheque:</p>
      <div className="space-y-2 rounded-lg border border-border bg-card p-2.5">
        <div className="grid grid-cols-2 gap-2">
          <CampoEjemplo etiqueta="N° de cheque" valor={<span className="font-semibold tabular">00012345</span>} />
          <CampoEjemplo etiqueta="CUIT del cheque" valor={<span className="font-semibold tabular">20-17894561-1</span>} />
        </div>
        <div className="space-y-1">
          <p className="text-[0.72rem] font-medium text-muted-foreground">¿Desde cuándo se puede cobrar?</p>
          <div className="flex flex-wrap gap-1">
            <ChipEjemplo>Hoy</ChipEjemplo>
            <ChipEjemplo activo>30 días</ChipEjemplo>
            <ChipEjemplo>60 días</ChipEjemplo>
            <ChipEjemplo>90 días</ChipEjemplo>
          </div>
          <p className="flex items-center gap-1 text-[0.72rem] text-muted-foreground">
            <CalendarDays className="size-3 shrink-0" strokeWidth={2} />
            Diferido: se cobra en 30 días (el 30/10/2026)
          </p>
        </div>
      </div>
    </MarcoPantalla>
  );
}

/** Transferencia (el Jefe de Portería no recibe cheques). */
export function PantallaTransferencia() {
  return (
    <MarcoPantalla titulo="¿Cómo te paga?">
      <ChipsMedio opciones={["Efectivo", "Transferencia"]} activo="Transferencia" resaltar />
      <div className="pt-1.5">
        <DatosTransferenciaEjemplo titular="Carlos Benítez" />
      </div>
      <p className="text-[0.72rem] text-muted-foreground">
        Si el cliente te mandó la captura por WhatsApp, elegila de la galería.
      </p>
    </MarcoPantalla>
  );
}

// ---------------------------------------------------------------------------------------
// Después de cobrar
// ---------------------------------------------------------------------------------------

type Imputacion = { codigo: string; descripcion: string; periodo: string; monto: number; saldado: boolean };

function CobroRegistradoEjemplo({
  nombre,
  numero,
  monto,
  imputaciones,
  destacado,
  otro = "Cobrar a otro cliente",
}: {
  nombre: string;
  numero: number;
  monto: number;
  imputaciones: Imputacion[];
  /** Línea grande debajo del N° (el ambulante: "Pagó hasta el mié 30/09"). */
  destacado?: string;
  /** El link de abajo: "Cobrar a otro cliente" (o "Cobrar a otro ambulante"). */
  otro?: string;
}) {
  return (
    <MarcoPantalla titulo={`Cobrar · ${nombre}`}>
      <div className="flex flex-col items-center gap-1.5 pt-1 text-center">
        <Sello grande estado="pagado" texto="Cobro registrado" className="px-2 py-1 text-[0.85rem]" />
        <p>
          Recibo <span className="font-display text-[1.05rem] font-bold tabular">N° {numero}</span>
        </p>
        {destacado ? <p className="font-semibold">{destacado}</p> : null}
      </div>
      <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5">
        <Banknote className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
        <p className="min-w-0 flex-1 font-medium">Efectivo</p>
        <Money monto={monto} className="font-semibold" />
      </div>
      <div className="space-y-1">
        <p className="text-[0.72rem] font-medium text-muted-foreground">Se aplicó a</p>
        <div className="divide-y divide-border rounded-md border border-border bg-card">
          {imputaciones.map((i) => (
            <div key={`${i.codigo}-${i.descripcion}`} className="flex items-start gap-2 px-2.5 py-1.5">
              <Codigo codigo={i.codigo} className="mt-0.5 text-[0.72rem]" />
              <div className="min-w-0 flex-1">
                <p className="leading-tight font-medium">{i.descripcion}</p>
                <p className="flex flex-wrap items-center gap-x-1.5 text-[0.72rem] text-muted-foreground">
                  {i.periodo}
                  {i.saldado ? (
                    <span className="inline-flex items-center gap-0.5 font-medium text-pagado">
                      <Check className="size-3" strokeWidth={2.4} />
                      Saldado
                    </span>
                  ) : null}
                </p>
              </div>
              <Money monto={i.monto} className="shrink-0 font-semibold" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Resaltado>
          <BotonEjemplo className="min-h-10 w-full">
            <FileText /> Ver recibo
          </BotonEjemplo>
        </Resaltado>
        <BotonEjemplo variante="contorno" className="mt-2 w-full">
          <Repeat /> Cobrar otra vez a {nombre}
        </BotonEjemplo>
        <p className="flex items-center justify-center gap-1.5 py-1 font-semibold">
          {otro === "Cobrar a otro ambulante" ? (
            <Footprints className="size-3.5" strokeWidth={2} />
          ) : (
            <Users className="size-3.5" strokeWidth={2} />
          )}
          {otro}
        </p>
      </div>
    </MarcoPantalla>
  );
}

/** Así queda la cuenta de un puestero al registrar el cobro: lo más viejo se pagó primero. */
export function PantallaCobroRegistrado() {
  return (
    <CobroRegistradoEjemplo
      nombre="José Fernández"
      numero={2417}
      monto={700000}
      imputaciones={[
        { codigo: "EXPP", descripcion: "Expensas Puestos × 2", periodo: "Agosto de 2026", monto: 460000, saldado: true },
        { codigo: "ENER", descripcion: "Recupero Energía (400 kWh)", periodo: "Agosto de 2026", monto: 240000, saldado: true },
      ]}
    />
  );
}

/** El cobro de una cuota de un quintero, registrado. */
export function PantallaCobroRegistradoQuintero() {
  return (
    <CobroRegistradoEjemplo
      nombre="Carlos Benítez"
      numero={2418}
      monto={75000}
      imputaciones={[
        { codigo: "EXPQ", descripcion: "Expensas Quinteros", periodo: "Septiembre de 2026", monto: 75000, saldado: false },
      ]}
    />
  );
}

/** El cobro por día de un ambulante, registrado: dice hasta qué día pagó. */
export function PantallaCobroRegistradoAmbulante() {
  return (
    <CobroRegistradoEjemplo
      nombre="Rosa Villalba"
      numero={2419}
      monto={24000}
      destacado="Pagó hasta el vie 02/10"
      otro="Cobrar a otro ambulante"
      imputaciones={[
        {
          codigo: "AMB",
          descripcion: "Ambulantes · 3 días (30/09 al 02/10)",
          periodo: "Septiembre de 2026",
          monto: 24000,
          saldado: true,
        },
      ]}
    />
  );
}

/** El recibo para imprimir y darle al cliente. */
export function PantallaRecibo() {
  return (
    <MarcoPantalla titulo="Recibo N° 2417 — José Fernández" contenidoClassName="space-y-2 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <BotonEjemplo variante="contorno" className="min-h-7 px-2 text-[0.72rem]">
          <ArrowLeft /> Volver
        </BotonEjemplo>
        <Resaltado>
          <BotonEjemplo className="min-h-7 px-2 text-[0.72rem]">
            <Printer /> Imprimir / Guardar PDF
          </BotonEjemplo>
        </Resaltado>
      </div>
      <div className="etiqueta mt-3">
        <div className="etiqueta-interior space-y-2 p-2.5 text-[0.72rem]">
          <div className="flex items-start justify-between gap-2 border-b border-border pb-1.5">
            <div className="min-w-0">
              <p className="font-display font-semibold tracking-wide uppercase">Cooperativa Mercado San Miguel</p>
              <p className="text-muted-foreground">Malagueño, Córdoba</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display text-[0.8rem] font-semibold tracking-wide uppercase">Recibo N° 2417</p>
              <p className="text-muted-foreground tabular">30/09/2026, 10:42</p>
            </div>
          </div>
          <p>
            <span className="text-muted-foreground">Recibimos de:</span> <strong>José Fernández</strong> (Carpeta
            N° 12)
          </p>
          <div className="flex items-center gap-2 rounded border border-border px-2 py-1">
            <Banknote className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
            <p className="flex-1 font-medium">Efectivo</p>
            <Money monto={700000} className="font-semibold" />
          </div>
          <div className="divide-y divide-dashed divide-border">
            <div className="flex justify-between gap-2 py-1">
              <span>Expensas Puestos × 2 · Agosto de 2026</span>
              <Money monto={460000} />
            </div>
            <div className="flex justify-between gap-2 py-1">
              <span>Recupero Energía (400 kWh) · Agosto de 2026</span>
              <Money monto={240000} />
            </div>
          </div>
          <div className="flex items-baseline justify-between border-t-2 border-foreground pt-1">
            <p className="font-display font-semibold tracking-wide uppercase">Total</p>
            <Money monto={700000} className="text-[1.05rem] font-bold" />
          </div>
          <div className="flex items-end justify-between gap-2 pt-1">
            <div className="space-y-1">
              <Sello grande estado="pagado" texto="Pago recibido" className="px-1.5 py-0.5 text-[0.72rem]" />
              <p>Recibió: Marta Sosa · Administración</p>
            </div>
            <p className="w-20 shrink-0 border-t border-foreground pt-0.5 text-center text-muted-foreground">Firma</p>
          </div>
        </div>
      </div>
    </MarcoPantalla>
  );
}

// ---------------------------------------------------------------------------------------
// Jefe de Portería: quinteros en cuotas y ambulantes por día
// ---------------------------------------------------------------------------------------

/** La cuenta de un quintero que paga el mes en 4 cuotas: «Cobrar la cuota» completa el monto. */
export function PantallaCuotasQuintero() {
  return (
    <MarcoPantalla titulo="Cobrar · Carlos Benítez">
      <div className="space-y-2 rounded-lg border border-border bg-card p-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="flex items-center gap-1.5 font-medium">
            <CalendarRange className="size-3.5 text-muted-foreground" strokeWidth={2} />
            Quinta de septiembre
          </p>
          <Money monto={300000} className="text-[1.05rem] font-bold" />
        </div>
        <BarraEjemplo cuotas={4} cubiertas={2} className="h-2.5 w-full" />
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          <p className="font-semibold">Cubrió 2 de 4 cuotas</p>
          <p className="text-[0.72rem] text-muted-foreground">
            Pagó <Money monto={150000} className="font-medium text-foreground" /> · Falta{" "}
            <Money monto={150000} className="font-semibold text-pendiente" />
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-lg border border-parcial/50 bg-parcial-suave px-2.5 py-2">
          <p>
            <span className="text-[0.72rem] text-muted-foreground">Cuota sugerida</span>
            <br />
            <Money monto={75000} className="font-bold" />
          </p>
          <Resaltado>
            <BotonEjemplo>Cobrar la cuota</BotonEjemplo>
          </Resaltado>
        </div>
      </div>
      <div className="space-y-1 pt-2">
        <p className="font-medium">¿Cuánto te pagan?</p>
        <div className="flex gap-1.5">
          <CampoMonto valor="75.000" />
          <BotonEjemplo variante="contorno" className="min-h-10">
            Cobrar todo
          </BotonEjemplo>
        </div>
        <p className="text-[0.72rem] text-muted-foreground tabular">
          Vas a cobrar <span className="font-semibold text-foreground">$ 75.000</span> · queda debiendo $ 75.000
        </p>
      </div>
    </MarcoPantalla>
  );
}

const TIRA_DIAS = [
  { dia: "Lun", n: "28", pagado: true },
  { dia: "Mar", n: "29" },
  { dia: "Hoy", n: "30", elegido: true },
  { dia: "Jue", n: "01", elegido: true },
  { dia: "Vie", n: "02", elegido: true },
  { dia: "Sáb", n: "03" },
  { dia: "Dom", n: "04" },
];

/** El cobro por día de un ambulante: no hay precio fijo, primero se escribe cuánto paga por
 * día (o «Como la última vez»), después cuántos días, y el total es días × precio. */
export function PantallaCobroAmbulante() {
  return (
    <MarcoPantalla titulo="Cobrar · Rosa Villalba">
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-[1.05rem] font-bold">Cobro por día</p>
        <span className="rounded-full bg-muted px-2 py-1 text-[0.72rem] font-semibold text-muted-foreground">
          Último día pago: lun 28/09
        </span>
      </div>
      <Resaltado>
        <div className="space-y-1.5 p-1">
          <p className="font-medium">¿Cuánto paga por día?</p>
          <CampoMonto valor="8.000" />
          <div className="flex flex-wrap items-center gap-1.5">
            <ChipEjemplo activo>
              <Repeat className="mr-1 size-3" strokeWidth={2} />
              Como la última vez: $ 8.000
            </ChipEjemplo>
          </div>
        </div>
      </Resaltado>
      <div className="space-y-1.5 pt-2">
        <p className="font-medium">¿Cuántos días paga?</p>
        <div className="flex items-center justify-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-full border border-border bg-card">
            <Minus className="size-4" strokeWidth={2.2} />
          </span>
          <p>
            <span className="font-display text-[1.3rem] font-bold tabular">3</span>{" "}
            <span className="text-muted-foreground">días</span>
          </p>
          <span className="flex size-8 items-center justify-center rounded-full border border-border bg-card">
            <Plus className="size-4" strokeWidth={2.2} />
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-1">
          <ChipEjemplo>Solo hoy</ChipEjemplo>
          <ChipEjemplo>2 días</ChipEjemplo>
          <ChipEjemplo activo>3 días</ChipEjemplo>
          <ChipEjemplo>Semana (7)</ChipEjemplo>
        </div>
      </div>
      <div className="space-y-1 pt-2">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium">Paga del mié 30/09 al vie 02/10</p>
          <span className="flex items-center gap-1 text-[0.72rem] font-semibold text-primary">
            <CalendarDays className="size-3" strokeWidth={2} />
            Empieza otro día
          </span>
        </div>
        <div className="flex gap-1">
          {TIRA_DIAS.map((d) => (
            <span
              key={d.n}
              className={cn(
                "flex h-11 w-8 flex-col items-center justify-center rounded-md border-2 text-[0.72rem] leading-tight font-medium",
                d.elegido
                  ? "border-primary bg-primary text-primary-foreground"
                  : d.pagado
                    ? "border-transparent bg-pagado-suave text-pagado"
                    : "border-border bg-card"
              )}
            >
              <span>{d.dia}</span>
              <span className="font-bold tabular">{d.n}</span>
            </span>
          ))}
        </div>
        <p className="text-[0.72rem] text-muted-foreground">Tocá un día libre para empezar ahí. En verde, lo ya pagado.</p>
      </div>
      <div className="flex items-end justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5">
        <div>
          <p className="text-[0.72rem] text-muted-foreground">Total</p>
          <Money monto={24000} className="text-[1.05rem] font-bold" />
        </div>
        <p className="text-[0.72rem] text-muted-foreground tabular">3 días × $ 8.000 = $ 24.000</p>
      </div>
      <BotonEjemplo className="min-h-10 w-full">Cobrar 3 días — $ 24.000</BotonEjemplo>
    </MarcoPantalla>
  );
}
