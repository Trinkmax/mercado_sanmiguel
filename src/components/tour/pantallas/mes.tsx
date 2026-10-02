import type { ReactNode } from "react";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Equal,
  FileSpreadsheet,
  FileText,
  Footprints,
  KeyRound,
  MapPin,
  Minus,
  Pencil,
  Plus,
  Printer,
  Receipt,
  Search,
  Send,
  Settings2,
  Tag,
  Tractor,
  TriangleAlert,
  Truck,
  UserPlus,
  UserX,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Codigo } from "@/components/shared/codigo";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { GRIS_BENEFICIO, RAYADO_EN_TERMINO } from "@/components/reportes/fila-ingreso";
import { BotonEjemplo, CampoEjemplo, FilaEjemplo, MarcoPantalla, Resaltado } from "@/components/tour/pantalla";

// Tour guiado · mes: pantallas de ejemplo de Facturación, Energía, Reportes y Configuración
// (docs/GUIA-TOUR.md). Dibujos quietos con datos inventados; se parecen a la pantalla real,
// en chico: mismos títulos, mismos botones, mismo orden.

// ---------------------------------------------------------------------------------------
// Piezas chicas compartidas
// ---------------------------------------------------------------------------------------

const MES = "Octubre de 2026";
const VENCE = "30/10/2026";

/** Texto chico gris (mínimo 0,72rem). */
function Chico({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[0.72rem] leading-snug text-muted-foreground", className)}>{children}</p>;
}

/** Título de un bloque, como los CardTitle de la pantalla real. */
function Titulo({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("font-display text-[0.85rem] font-bold", className)}>{children}</p>;
}

/** Una tarjeta blanca del sistema, en chico. */
function Tarjeta({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("space-y-1.5 rounded-lg border border-border bg-card p-2.5", className)}>{children}</div>;
}

/** Ventana (Dialog) dibujada: título, descripción, contenido y botones abajo. */
function Ventana({
  titulo,
  descripcion,
  children,
  botones,
}: {
  titulo: string;
  descripcion?: ReactNode;
  children?: ReactNode;
  botones: ReactNode;
}) {
  return (
    <div className="space-y-2.5 rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="space-y-0.5">
        <p className="font-display text-[0.9rem] font-bold">{titulo}</p>
        {descripcion ? <Chico>{descripcion}</Chico> : null}
      </div>
      {children}
      <div className="flex flex-wrap justify-end gap-1.5">{botones}</div>
    </div>
  );
}

/** Interruptor dibujado (Switch). */
function Interruptor({ prendido = true }: { prendido?: boolean }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-4 w-7 shrink-0 items-center rounded-full",
        prendido ? "bg-primary" : "bg-muted-foreground/35"
      )}
    >
      <span className={cn("absolute size-3 rounded-full bg-white", prendido ? "right-0.5" : "left-0.5")} />
    </span>
  );
}

/** Selector de mes: ← Octubre de 2026 →. */
function SelectorMes({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-1.5", className)}>
      <span className="flex size-7 items-center justify-center rounded-md border border-border bg-card">
        <ChevronLeft className="size-3.5" />
      </span>
      <p className="min-w-32 text-center font-display text-[0.85rem] font-bold">{MES}</p>
      <span className="flex size-7 items-center justify-center rounded-md border border-border bg-card">
        <ChevronRight className="size-3.5" />
      </span>
    </div>
  );
}

/** Un término de una cuenta (+, −, =) con su etiqueta y su monto. */
function Termino({
  signo: Signo,
  etiqueta,
  monto,
  className,
}: {
  signo?: LucideIcon;
  etiqueta: string;
  monto: number;
  className?: string;
}) {
  return (
    <div className="flex min-w-0 items-end gap-1.5">
      {Signo ? <Signo className="mb-0.5 size-3.5 shrink-0 text-muted-foreground" /> : null}
      <div className="min-w-0">
        <Chico>{etiqueta}</Chico>
        <Money monto={monto} className={cn("text-[0.85rem] font-bold", className)} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// Facturación
// ---------------------------------------------------------------------------------------

type ConceptoMes = { codigo: string; nombre: string; clientes: string; monto: number; luz?: boolean };

const CONCEPTOS_MES: ConceptoMes[] = [
  { codigo: "EXPC", nombre: "Alquiler Cocheras", clientes: "38 clientes", monto: 1240000 },
  { codigo: "EXCO", nombre: "Contribución Puestos", clientes: "112 clientes", monto: 2800000 },
  { codigo: "EXME", nombre: "Expensas Cobradas", clientes: "112 clientes", monto: 124200000 },
  { codigo: "EXPG", nombre: "Expensas Galpón", clientes: "9 clientes", monto: 1404000 },
  {
    codigo: "ABEN",
    nombre: "Abono mensual de energía",
    clientes: "96 clientes con medidor · se suma solo",
    monto: 1440000,
    luz: true,
  },
];
const TOTAL_MES = CONCEPTOS_MES.reduce((acc, c) => acc + c.monto, 0);

function ListaConceptosMes({ filas = CONCEPTOS_MES }: { filas?: ConceptoMes[] }) {
  return (
    <div className="divide-y divide-border">
      {filas.map((c) => (
        <div key={c.codigo} className="flex items-center gap-2 py-1.5">
          <Codigo codigo={c.codigo} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[0.75rem] font-medium">
              {c.luz ? <Zap className="mr-1 inline size-3 align-[-0.1em] text-primary" /> : null}
              {c.nombre}
            </p>
            <Chico>{c.clientes}</Chico>
          </div>
          <Money monto={c.monto} className="shrink-0 text-[0.75rem] font-medium" />
        </div>
      ))}
    </div>
  );
}

function CabeceraMes() {
  return (
    <div>
      <p className="font-display text-[1rem] font-bold">{MES}</p>
      <Chico>El mes en curso todavía no está generado. Vence el {VENCE}.</Chico>
    </div>
  );
}

function BotonGenerar() {
  return (
    <BotonEjemplo className="w-full">
      <CalendarCheck /> Generar {MES}
    </BotonEjemplo>
  );
}

/** Portada de Facturación: el mes que toca, lo que se va a cobrar y el botón para generarlo. */
export function PortadaFacturacion() {
  return (
    <MarcoPantalla titulo="Facturación">
      <Tarjeta className="space-y-2">
        <CabeceraMes />
        <ListaConceptosMes />
        <div className="flex items-baseline justify-between border-t border-border pt-1.5">
          <p className="text-[0.75rem] font-medium">Total estimado</p>
          <Money monto={TOTAL_MES} className="text-[0.95rem] font-bold" />
        </div>
        <Resaltado>
          <BotonGenerar />
        </Resaltado>
      </Tarjeta>
    </MarcoPantalla>
  );
}

/** Lo que se va a cobrar en el mes, concepto por concepto, y de dónde sale cada número. */
export function PantallaEstimadoMes() {
  return (
    <MarcoPantalla titulo="Facturación">
      <Tarjeta className="space-y-2">
        <CabeceraMes />
        <Resaltado mano={false} className="ring-offset-card">
          <ListaConceptosMes />
        </Resaltado>
        <div className="flex items-baseline justify-between border-t border-border pt-1.5">
          <p className="text-[0.75rem] font-medium">Total estimado</p>
          <Money monto={TOTAL_MES} className="text-[0.95rem] font-bold" />
        </div>
      </Tarjeta>
      <div className="space-y-1 rounded-lg bg-accent/60 p-2.5">
        <p className="text-[0.75rem] font-semibold">Sale de la carpeta de cada cliente</p>
        <FilaEjemplo derecha={<Money monto={1620000} className="text-[0.75rem] font-semibold" />}>
          <p className="text-[0.75rem] font-medium">La Colorada · Puesto 12</p>
          <Chico>1½ expensa</Chico>
        </FilaEjemplo>
        <FilaEjemplo derecha={<Money monto={132000} className="text-[0.75rem] font-semibold" />}>
          <p className="text-[0.75rem] font-medium">Don Ramón · Galpón 9</p>
          <Chico>1 galpón al 110 %</Chico>
        </FilaEjemplo>
        <FilaEjemplo derecha={<Money monto={432000} className="text-[0.75rem] font-semibold" />}>
          <p className="text-[0.75rem] font-medium">Frutas Lucía · Galpones 3 a 6</p>
          <Chico>4 galpones al 90 %</Chico>
        </FilaEjemplo>
      </div>
    </MarcoPantalla>
  );
}

/** La ventana que se abre al tocar «Generar …». */
export function PantallaConfirmarGenerar() {
  return (
    <MarcoPantalla titulo="Facturación" contenidoClassName="bg-sidebar/35 p-3">
      <Ventana
        titulo={`¿Generar ${MES}?`}
        descripcion={
          <>
            Se van a crear aprox. 367 cargos por <Money monto={TOTAL_MES} /> (incluye 96 abonos de energía). Si
            algún cliente tiene saldo a favor, se le descuenta solo. Esto se hace una vez por mes. Quedate
            tranquilo: si se corre dos veces, no se duplica nada (solo suma lo que falte, como un medidor nuevo).
          </>
        }
        botones={
          <>
            <BotonEjemplo variante="contorno">Cancelar</BotonEjemplo>
            <Resaltado>
              <BotonEjemplo>
                <CalendarCheck /> Sí, generar
              </BotonEjemplo>
            </Resaltado>
          </>
        }
      />
    </MarcoPantalla>
  );
}

/** Cómo queda después de generar, y cómo le llega a cada cliente. */
export function PantallaMesGenerado() {
  return (
    <MarcoPantalla titulo="Facturación">
      <div className="flex items-start gap-2 rounded-lg bg-pagado-suave px-2.5 py-2">
        <Check className="mt-0.5 size-4 shrink-0 text-pagado" strokeWidth={2.4} />
        <p className="text-[0.75rem] font-medium">
          {MES} quedó generado: 271 cargos, 96 abonos de energía y 0 consumos. Vence el {VENCE}.
        </p>
      </div>
      <div className="flex items-center justify-center gap-1 text-[0.72rem] text-muted-foreground">
        <ArrowRight className="size-3.5" /> Y en «Cobrar», cada cliente ya debe su mes:
      </div>
      <Tarjeta>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[0.8rem] font-semibold">Pocho Fernández · Puesto 58</p>
          <Sello estado="en_termino" />
        </div>
        <FilaEjemplo derecha={<Money monto={1080000} className="text-[0.75rem] font-semibold" />}>
          <p className="flex items-center gap-1.5 text-[0.75rem]">
            <Codigo codigo="EXME" /> Expensa de octubre
          </p>
        </FilaEjemplo>
        <FilaEjemplo derecha={<Money monto={15000} className="text-[0.75rem] font-semibold" />}>
          <p className="flex items-center gap-1.5 text-[0.75rem]">
            <Codigo codigo="ABEN" /> Abono de energía
          </p>
        </FilaEjemplo>
      </Tarjeta>
    </MarcoPantalla>
  );
}

/** El beneficio por pago en término: se divide por 1 + el porcentaje. */
export function PantallaBeneficioTermino() {
  return (
    <MarcoPantalla titulo="Expensa de Pocho · Puesto 58">
      <FilaEjemplo derecha={<Money monto={1080000} className="text-[0.85rem] font-bold" />}>
        <p className="text-[0.75rem] font-medium">Expensa de octubre</p>
        <Chico>Con 15 % de beneficio pagando en término</Chico>
      </FilaEjemplo>
      <Resaltado mano={false}>
        <FilaEjemplo
          className="border-pagado/40 bg-pagado-suave/50"
          derecha={<Money monto={939130.43} className="text-[0.95rem] font-bold text-pagado" />}
        >
          <p className="text-[0.75rem] font-semibold">Paga hasta el {VENCE}</p>
          <Chico>$ 1.080.000 ÷ 1,15</Chico>
        </FilaEjemplo>
      </Resaltado>
      <FilaEjemplo derecha={<Money monto={1080000} className="text-[0.85rem] font-bold text-pendiente" />}>
        <p className="text-[0.75rem] font-semibold">Paga desde el 31/10/2026</p>
        <Chico>Perdió el beneficio: el importe completo</Chico>
      </FilaEjemplo>
    </MarcoPantalla>
  );
}

function FilaPeriodo({
  mes,
  vence,
  generado,
  estimado,
  cobrado,
  reporte,
}: {
  mes: string;
  vence: string;
  generado: string;
  estimado: number;
  cobrado: number;
  reporte: boolean;
}) {
  return (
    <div className="space-y-1.5 py-2 first:pt-0 last:pb-0">
      <div>
        <p className="text-[0.8rem] font-semibold">{mes}</p>
        <Chico>
          Vence el {vence} · generado el {generado}
        </Chico>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Chico>Estimado</Chico>
          <Money monto={estimado} className="text-[0.8rem] font-semibold" />
        </div>
        <div>
          <Chico>Cobrado</Chico>
          <Money monto={cobrado} className="text-[0.8rem] font-semibold text-pagado" />
        </div>
      </div>
      {reporte ? (
        <BotonEjemplo variante="contorno" className="w-full">
          Ver reporte de {mes} <ArrowRight />
        </BotonEjemplo>
      ) : null}
    </div>
  );
}

function Historial({ reporte }: { reporte: boolean }) {
  return (
    <MarcoPantalla titulo="Facturación">
      <Tarjeta>
        <Titulo>Períodos generados</Titulo>
        <Resaltado mano={false} className="ring-offset-card">
          <div className="divide-y divide-border rounded-lg bg-card">
            <FilaPeriodo
              mes={MES}
              vence={VENCE}
              generado="01/10/2026 09:12 por Marta Núñez"
              estimado={TOTAL_MES}
              cobrado={48350000}
              reporte={reporte}
            />
          </div>
        </Resaltado>
        <div className="divide-y divide-border pt-1">
          <FilaPeriodo
            mes="Septiembre de 2026"
            vence="30/09/2026"
            generado="01/09/2026 08:47 por Marta Núñez"
            estimado={129870000}
            cobrado={114620000}
            reporte={false}
          />
        </div>
      </Tarjeta>
    </MarcoPantalla>
  );
}

/** Los meses ya generados, con lo estimado y lo cobrado (Administración). */
export function PantallaHistorial() {
  return <Historial reporte={false} />;
}

/** Los meses ya generados, con «Ver reporte» (Líder). */
export function PantallaHistorialLider() {
  return <Historial reporte />;
}

// ---------------------------------------------------------------------------------------
// Energía
// ---------------------------------------------------------------------------------------

function PrecioChico({ etiqueta, monto, lapiz = true }: { etiqueta: string; monto: number; lapiz?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card py-1 pr-1 pl-2">
      <div>
        <Chico className="font-medium">{etiqueta}</Chico>
        <Money monto={monto} className="text-[0.9rem] leading-tight font-bold" />
      </div>
      {lapiz ? (
        <span className="flex size-6 items-center justify-center text-muted-foreground">
          <Pencil className="size-3.5" />
        </span>
      ) : null}
    </div>
  );
}

function EnergiaDelMes() {
  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-card p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-display text-[0.8rem] font-bold">Energía de {MES}</p>
          <Chico>Abonos generados con el mes</Chico>
        </div>
        <PrecioChico etiqueta="Abono mensual" monto={15000} />
      </div>
      <div className="flex flex-wrap items-end gap-x-3 gap-y-1 border-t border-border pt-1.5">
        <Termino etiqueta="Abono × 96 clientes con medidor" monto={1440000} />
        <Termino signo={Plus} etiqueta="Consumo cargado" monto={2315400} />
        <Termino signo={Equal} etiqueta="Total de energía" monto={3755400} className="text-primary" />
      </div>
    </div>
  );
}

function Medidor({
  numero,
  lugar,
  cliente,
  anterior,
  actual,
  kwh,
  importe,
  cargada = false,
  resaltar = false,
}: {
  numero: string;
  lugar: string;
  cliente: string;
  anterior: string;
  actual: string;
  kwh: number;
  importe: number;
  cargada?: boolean;
  resaltar?: boolean;
}) {
  const campo = (
    <div>
      <Chico>Actual</Chico>
      <div
        className={cn(
          "flex h-7 items-center rounded-md border px-2 text-[0.8rem] font-semibold tabular",
          cargada ? "border-transparent" : "border-primary bg-card"
        )}
      >
        {actual}
      </div>
    </div>
  );
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-2 gap-y-1.5 rounded-lg border p-2",
        cargada ? "border-pagado/30 bg-pagado-suave/40" : "border-border bg-card"
      )}
    >
      <p className="self-center font-display text-[0.85rem] tracking-wide">{numero}</p>
      <span className="inline-flex items-center gap-1 justify-self-end rounded-md border border-border bg-card px-1.5 py-0.5 text-[0.72rem] font-medium">
        <MapPin className="size-3 text-primary" /> {lugar}
      </span>
      <div className="col-span-2">
        <p className="text-[0.8rem] font-medium">{cliente}</p>
        <Chico>+ abono $ 15.000</Chico>
      </div>
      <div>
        <Chico>Anterior</Chico>
        <p className="flex h-7 items-center text-[0.8rem] text-muted-foreground tabular">{anterior}</p>
      </div>
      {resaltar ? <Resaltado className="ring-offset-card">{campo}</Resaltado> : campo}
      <div>
        <Money monto={importe} className={cn("text-[0.85rem]", cargada ? "font-semibold" : "text-muted-foreground")} />
        <Chico>{kwh.toLocaleString("es-AR")} kWh</Chico>
      </div>
      <div className="flex items-center justify-end gap-1">
        {cargada ? (
          <>
            <Check className="size-4 text-pagado" strokeWidth={2.4} />
            <span className="px-1.5 text-[0.75rem] font-medium">Corregir</span>
          </>
        ) : (
          <BotonEjemplo className="min-h-7 px-2.5">Guardar</BotonEjemplo>
        )}
      </div>
    </div>
  );
}

function Progreso({ cargadas, total }: { cargadas: number; total: number }) {
  const pct = Math.round((cargadas / total) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <p className="text-[0.75rem] font-semibold">
          <span className="text-pagado">{cargadas}</span> de {total} lecturas cargadas
        </p>
        <Chico className="tabular">{pct}%</Chico>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-pendiente-suave">
        <div className="h-full rounded-full bg-pagado" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Portada de Energía: los precios, la energía del mes y un medidor para cargar. */
export function PortadaEnergia() {
  return (
    <MarcoPantalla titulo="Energía">
      <div className="flex flex-wrap items-center gap-1.5">
        <PrecioChico etiqueta="Precio del kWh" monto={600} />
        <BotonEjemplo variante="contorno" className="min-h-7 px-2 text-[0.72rem]">
          <Printer /> Imprimir planilla para el electricista
        </BotonEjemplo>
      </div>
      <SelectorMes />
      <EnergiaDelMes />
      <Medidor
        numero="M-0458"
        lugar="Puesto 58"
        cliente="Pocho Fernández"
        anterior="12.340"
        actual="12.598"
        kwh={258}
        importe={154800}
        resaltar
      />
    </MarcoPantalla>
  );
}

/** La planilla de papel que se lleva el electricista. */
export function PantallaPlanillaElectricista() {
  const filas = [
    { n: "M-0458", c: "Pocho Fernández", u: "Puesto 58", a: "12.340", escrito: "12.598" },
    { n: "M-0461", c: "La Colorada", u: "Puesto 12", a: "8.902", escrito: "9.130" },
    { n: "M-0463", c: "Don Ramón", u: "Galpón 9", a: "30.115", escrito: "" },
    { n: "M-0470", c: "Frutas Lucía", u: "Galpón 4", a: "15.772", escrito: "" },
  ];
  return (
    <MarcoPantalla titulo="Planilla de lecturas" contenidoClassName="bg-white p-3">
      <div className="rounded-md border-2 border-foreground p-0.5">
        <div className="space-y-0.5 rounded border border-foreground px-2 py-1.5 text-center">
          <p className="font-display text-[0.8rem] font-semibold uppercase tracking-wide">
            Planilla de lecturas — {MES}
          </p>
          <Chico>96 medidores, en el orden del recorrido · Anotá la lectura actual de cada uno en la última columna.</Chico>
        </div>
      </div>
      <table className="w-full border-collapse text-[0.72rem]">
        <thead>
          <tr className="border-b-2 border-foreground text-left">
            <th className="py-1 pr-1 font-semibold">N° medidor</th>
            <th className="py-1 pr-1 font-semibold">Cliente</th>
            <th className="py-1 pr-1 text-right font-semibold">Anterior</th>
            <th className="border-2 border-foreground px-1 py-1 text-center font-semibold">Actual</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.n} className="border-b border-foreground/30">
              <td className="h-8 pr-1 font-display tracking-wide">{f.n}</td>
              <td className="pr-1">
                <p className="font-medium">{f.c}</p>
                <p className="text-muted-foreground">{f.u}</p>
              </td>
              <td className="pr-1 text-right tabular">{f.a}</td>
              <td className="border-2 border-foreground px-1 text-center font-display text-[0.85rem] text-primary italic">
                {f.escrito}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Chico>Leído por: ____________ · Fecha: __ / __ / ____</Chico>
    </MarcoPantalla>
  );
}

/** La carga rápida: solo se tipea la lectura actual; kWh e importe salen solos. */
export function PantallaCargaLecturas() {
  return (
    <MarcoPantalla titulo="Energía">
      <Progreso cargadas={12} total={96} />
      <Medidor
        numero="M-0458"
        lugar="Puesto 58"
        cliente="Pocho Fernández"
        anterior="12.340"
        actual="12.598"
        kwh={258}
        importe={154800}
        resaltar
      />
      <Medidor
        numero="M-0461"
        lugar="Puesto 12"
        cliente="La Colorada"
        anterior="8.902"
        actual="9.130"
        kwh={228}
        importe={136800}
        cargada
      />
      <Chico className="text-center">258 kWh × $ 600 = $ 154.800</Chico>
    </MarcoPantalla>
  );
}

/** El avance de las lecturas y la energía del mes. */
export function PantallaAvanceLecturas() {
  return (
    <MarcoPantalla titulo="Energía">
      <EnergiaDelMes />
      <Tarjeta>
        <Resaltado mano={false} className="ring-offset-card">
          <div className="p-1">
            <Progreso cargadas={58} total={96} />
          </div>
        </Resaltado>
        <Chico className="pt-1">
          Cada lectura guardada ya es un cargo del cliente, listo para cobrarse.
        </Chico>
      </Tarjeta>
    </MarcoPantalla>
  );
}

function VentanaPrecioKwh({ lider }: { lider: boolean }) {
  return (
    <MarcoPantalla titulo="Energía" contenidoClassName="bg-sidebar/35 p-3">
      <Ventana
        titulo="Cambiar precio del kWh"
        descripcion={
          lider
            ? "El precio nuevo vale para las próximas lecturas; las ya cargadas no cambian."
            : "El cambio lo aprueba el Líder de Procesos. Una vez aprobado, vale para las próximas lecturas; las ya cargadas no cambian."
        }
        botones={
          <>
            <BotonEjemplo variante="contorno">Cancelar</BotonEjemplo>
            <Resaltado>
              <BotonEjemplo>
                {lider ? (
                  "Guardar precio"
                ) : (
                  <>
                    <Send /> Enviar a aprobación
                  </>
                )}
              </BotonEjemplo>
            </Resaltado>
          </>
        }
      >
        <CampoEjemplo etiqueta="Precio por kWh, en pesos" valor="650" />
        <Chico>
          Queda en <strong className="text-foreground">$ 650</strong> por kWh. Hoy: $ 600.
        </Chico>
      </Ventana>
    </MarcoPantalla>
  );
}

/** Cambiar el precio del kWh (el Líder lo guarda directo). */
export function PantallaPrecioKwhLider() {
  return <VentanaPrecioKwh lider />;
}

/** Proponer el precio del kWh (Administración: lo aprueba el Líder). */
export function PantallaPrecioKwhAdmin() {
  return <VentanaPrecioKwh lider={false} />;
}

/** «Agregar un medidor»: se busca al cliente y se abre su carpeta en Medidores. */
export function PantallaAgregarMedidor() {
  return (
    <MarcoPantalla titulo="Energía" contenidoClassName="bg-sidebar/35 p-3">
      <div className="space-y-2 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div>
          <p className="font-display text-[0.9rem] font-bold">¿A qué cliente le ponés el medidor?</p>
          <Chico>Buscalo y tocalo: se abre su carpeta en Medidores para cargar el número y el lugar.</Chico>
        </div>
        <div className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2 text-[0.8rem]">
          <Search className="size-3.5 text-muted-foreground" /> Ramón
        </div>
        <Resaltado>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5">
            <div className="min-w-0 flex-1">
              <p className="text-[0.8rem] font-medium">Ramón Quiroga</p>
              <Chico>N° 31 · “Don Ramón”</Chico>
            </div>
            <Sello estado="puestero" />
            <ArrowRight className="size-3.5 text-muted-foreground" />
          </div>
        </Resaltado>
      </div>
    </MarcoPantalla>
  );
}

// ---------------------------------------------------------------------------------------
// Reportes
// ---------------------------------------------------------------------------------------

type Ingreso = {
  codigo: string;
  nombre: string;
  estimado: number;
  cobrado: number;
  otorgados: number;
  enTermino: number;
};

const INGRESOS: Ingreso[] = [
  { codigo: "EXPC", nombre: "Alquiler Cocheras", estimado: 1240000, cobrado: 1054000, otorgados: 0, enTermino: 0 },
  {
    codigo: "EXME",
    nombre: "Expensas Cobradas",
    estimado: 124200000,
    cobrado: 68420000,
    otorgados: 8370000,
    enTermino: 5600000,
  },
  { codigo: "ENER", nombre: "Recupero Energía (kWh)", estimado: 2315400, cobrado: 1180000, otorgados: 0, enTermino: 0 },
];

function FilaIngresoChica({ fila }: { fila: Ingreso }) {
  const pct = (m: number) => (m / fila.estimado) * 100;
  const falta = fila.estimado - fila.cobrado - fila.otorgados - fila.enTermino;
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 py-1.5">
      <Codigo codigo={fila.codigo} className="mt-0.5" />
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          <p className="text-[0.75rem] font-medium">{fila.nombre}</p>
          <p className="text-[0.72rem] text-muted-foreground tabular">
            <Money monto={fila.cobrado} className="font-semibold text-pagado" /> de <Money monto={fila.estimado} />
          </p>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-pendiente-suave">
          <div className="h-full bg-pagado" style={{ width: `${pct(fila.cobrado)}%` }} />
          {fila.otorgados > 0 ? (
            <div className={cn("h-full", GRIS_BENEFICIO)} style={{ width: `${pct(fila.otorgados)}%` }} />
          ) : null}
          {fila.enTermino > 0 ? (
            <div className="h-full bg-muted" style={{ width: `${pct(fila.enTermino)}%`, ...RAYADO_EN_TERMINO }} />
          ) : null}
        </div>
        <div className="flex flex-wrap justify-between gap-x-2 text-[0.72rem] text-muted-foreground">
          {fila.otorgados > 0 ? (
            <span>
              Beneficios otorgados <Money monto={fila.otorgados} />
            </span>
          ) : (
            <span />
          )}
          <span className="font-medium text-pendiente">
            Faltan <Money monto={falta} />
          </span>
        </div>
      </div>
    </div>
  );
}

/** Portada de Reportes: los botones de arriba, el mes y los ingresos por concepto. */
export function PortadaReportes() {
  return (
    <MarcoPantalla titulo="Reportes">
      <div className="flex flex-wrap items-center gap-1.5">
        <BotonEjemplo variante="contorno" className="min-h-7 px-2 text-[0.72rem]">
          <FileSpreadsheet /> Exportar planillas <ChevronDown />
        </BotonEjemplo>
        <BotonEjemplo className="min-h-7 px-2 text-[0.72rem]">
          <FileText /> Reporte para la contadora
        </BotonEjemplo>
      </div>
      <SelectorMes />
      <Tarjeta>
        <Titulo>Ingresos de {MES}</Titulo>
        <div className="divide-y divide-border">
          {INGRESOS.slice(0, 2).map((f) => (
            <FilaIngresoChica key={f.codigo} fila={f} />
          ))}
        </div>
      </Tarjeta>
    </MarcoPantalla>
  );
}

/** Cobranza día a día: una barra por día. */
export function PantallaCobranzaDiaria() {
  const dias = [3.1, 5.4, 4.2, 0, 0, 6.8, 7.9, 5.1, 4.4, 3.6, 0, 0, 8.2, 9.6, 6.3, 5.2, 4.8, 0, 0, 7.1, 6.6];
  const max = Math.max(...dias);
  return (
    <MarcoPantalla titulo="Reportes">
      <Tarjeta>
        <Titulo>Cobranza día a día</Titulo>
        <Resaltado mano={false} className="ring-offset-card">
          <div className="flex h-24 items-end gap-[3px] px-1 pt-2">
            {dias.map((d, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm bg-primary/80"
                style={{ height: `${Math.max((d / max) * 100, 2)}%`, opacity: d === 0 ? 0.25 : 1 }}
              />
            ))}
          </div>
        </Resaltado>
        <div className="flex justify-between pt-1">
          <Chico>1/10</Chico>
          <Chico>21/10</Chico>
        </div>
        <Chico>El martes 14/10 entró lo más: $ 9.600.000.</Chico>
      </Tarjeta>
    </MarcoPantalla>
  );
}

/** Estimado contra cobrado, concepto por concepto. */
export function PantallaIngresosConcepto() {
  return (
    <MarcoPantalla titulo="Reportes">
      <Tarjeta>
        <Titulo>Ingresos de {MES}</Titulo>
        <Resaltado mano={false} className="ring-offset-card">
          <div className="divide-y divide-border rounded-lg bg-card px-1">
            {INGRESOS.map((f) => (
              <FilaIngresoChica key={f.codigo} fila={f} />
            ))}
          </div>
        </Resaltado>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-1 text-[0.72rem] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block size-2.5 rounded-full bg-pagado" /> Cobrado
          </span>
          <span className="flex items-center gap-1">
            <span className={cn("inline-block size-2.5 rounded-full", GRIS_BENEFICIO)} /> Beneficios
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-2.5 rounded-full bg-pendiente-suave ring-1 ring-pendiente/40" /> Falta
          </span>
        </div>
      </Tarjeta>
    </MarcoPantalla>
  );
}

/** La cuenta del mes: estimado = cobrado + beneficios + falta cobrar. */
export function PantallaTotalesMes() {
  const datos: { etiqueta: string; monto: number; className?: string; nota?: string }[] = [
    { etiqueta: "Estimado", monto: 131132000, className: "font-semibold" },
    { etiqueta: "Cobrado", monto: 72480000, className: "font-bold text-pagado" },
    { etiqueta: "Beneficios otorgados", monto: 8370000, className: "font-semibold" },
    { etiqueta: "Beneficio en término", monto: 5600000, className: "font-semibold", nota: "se pierde si pagan tarde" },
    { etiqueta: "Falta cobrar", monto: 44682000, className: "font-bold text-pendiente" },
  ];
  return (
    <MarcoPantalla titulo="Reportes">
      <Tarjeta>
        <Titulo>Ingresos de {MES}</Titulo>
        <Resaltado mano={false} className="ring-offset-card">
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-card p-1.5">
            {datos.map((d) => (
              <div key={d.etiqueta} className="min-w-0">
                <Chico>{d.etiqueta}</Chico>
                <Money monto={d.monto} className={cn("text-[0.8rem]", d.className)} />
                {d.nota ? <Chico>{d.nota}</Chico> : null}
              </div>
            ))}
          </div>
        </Resaltado>
        <Chico className="pt-1">
          Estimado = cobrado + beneficios otorgados + beneficio en término + falta cobrar.
        </Chico>
      </Tarjeta>
    </MarcoPantalla>
  );
}

/** Los gastos del mes por rubro, pagado y pendiente. */
export function PantallaGastosMes() {
  const gastos = [
    { codigo: "SJ", nombre: "Sueldos y Jornales", tipo: "Fijo", pagado: 4900000, pendiente: 0 },
    { codigo: "ALQ", nombre: "Alquiler del Predio", tipo: "Fijo", pagado: 2500000, pendiente: 0 },
    { codigo: "AGUA", nombre: "Agua de Malagueño", tipo: "Fijo", pagado: 380000, pendiente: 0 },
    { codigo: "GM", nombre: "Gastos de Mantenimiento", tipo: "Variable", pagado: 420000, pendiente: 180000 },
  ];
  return (
    <MarcoPantalla titulo="Reportes">
      <Tarjeta>
        <Titulo>Gastos de {MES}</Titulo>
        <div className="divide-y divide-border">
          {gastos.map((g) => (
            <div key={g.codigo} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 py-1.5">
              <Codigo codigo={g.codigo} />
              <div className="min-w-0">
                <p className="text-[0.75rem] font-medium">{g.nombre}</p>
                <Chico>{g.tipo}</Chico>
              </div>
              <div className="text-right text-[0.72rem]">
                <Money monto={g.pagado} className="font-medium" />
                {g.pendiente > 0 ? (
                  <p className="text-pendiente">
                    <Money monto={g.pendiente} /> pendiente
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-baseline justify-between border-t border-border pt-1.5">
          <p className="text-[0.8rem] font-bold">Total del mes</p>
          <p className="text-right text-[0.72rem]">
            <Money monto={8200000} className="text-[0.85rem] font-bold" />
            <span className="block text-pendiente">
              <Money monto={180000} /> pendiente
            </span>
          </p>
        </div>
      </Tarjeta>
    </MarcoPantalla>
  );
}

/** El balance del mes: cobrado menos gastado. */
export function PantallaBalanceMes() {
  return (
    <MarcoPantalla titulo="Reportes">
      <Tarjeta>
        <Titulo>Balance de {MES}</Titulo>
        <div className="flex flex-wrap items-end gap-x-3 gap-y-1.5">
          <Termino etiqueta="Cobrado" monto={72480000} className="text-pagado" />
          <Termino signo={Minus} etiqueta="Gastado (pagado)" monto={8200000} />
          <Resaltado mano={false} className="ring-offset-card">
            <div className="px-1">
              <Termino signo={Equal} etiqueta="Resultado del mes" monto={64280000} className="text-pagado" />
            </div>
          </Resaltado>
        </div>
      </Tarjeta>
    </MarcoPantalla>
  );
}

/** La hoja para la contadora, lista para imprimir o guardar como PDF. */
export function PantallaReporteContadora() {
  return (
    <MarcoPantalla titulo="Reporte mensual" contenidoClassName="bg-white p-3">
      <div className="flex justify-end gap-1.5">
        <BotonEjemplo variante="contorno" className="min-h-7 px-2 text-[0.72rem]">
          Volver
        </BotonEjemplo>
        <Resaltado>
          <BotonEjemplo className="min-h-7 px-2 text-[0.72rem]">
            <Printer /> Imprimir / Guardar PDF
          </BotonEjemplo>
        </Resaltado>
      </div>
      <div className="rounded-md border-2 border-foreground p-0.5">
        <div className="space-y-2 rounded border border-foreground p-2">
          <div className="flex items-start justify-between border-b-2 border-foreground pb-1.5">
            <p className="font-display text-[0.75rem] font-bold">Mercado San Miguel</p>
            <div className="text-right">
              <p className="font-display text-[0.8rem] font-semibold uppercase tracking-wide">Reporte mensual</p>
              <Chico className="uppercase">{MES}</Chico>
            </div>
          </div>
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-wider">Ingresos por concepto</p>
            {INGRESOS.slice(0, 2).map((f) => (
              <div key={f.codigo} className="flex justify-between border-b border-border py-0.5 text-[0.72rem]">
                <span>
                  {f.codigo} · {f.nombre}
                </span>
                <Money monto={f.cobrado} />
              </div>
            ))}
          </div>
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-wider">Gastos por rubro</p>
            <div className="flex justify-between border-b border-border py-0.5 text-[0.72rem]">
              <span>SJ · Sueldos y Jornales</span>
              <Money monto={4900000} />
            </div>
          </div>
          <div className="flex justify-between text-[0.75rem] font-bold">
            <span>Resultado del mes</span>
            <Money monto={64280000} />
          </div>
        </div>
      </div>
    </MarcoPantalla>
  );
}

/** «Exportar planillas»: las listas que se bajan a Excel. */
export function PantallaExportarPlanillas() {
  const grupos: { grupo: string; items: string[] }[] = [
    { grupo: "Cobranza", items: ["Clientes", "Cuenta corriente", "Pagos"] },
    { grupo: "Plata", items: ["Cheques", "Gastos", "Cajas"] },
  ];
  return (
    <MarcoPantalla titulo="Reportes">
      <div className="flex flex-wrap items-center gap-2">
        <Resaltado mano={false}>
          <BotonEjemplo variante="contorno" className="min-h-7 px-2 text-[0.72rem]">
            <FileSpreadsheet /> Exportar planillas <ChevronDown />
          </BotonEjemplo>
        </Resaltado>
        <BotonEjemplo variante="contorno" className="min-h-7 px-2 text-[0.72rem]">
          <FileSpreadsheet /> Balance del mes (.xlsx)
        </BotonEjemplo>
      </div>
      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-2.5 py-1.5">
          <p className="font-display text-[0.8rem] font-bold">
            Planillas de Excel <span className="font-sans font-normal text-muted-foreground">(15)</span>
          </p>
          <Chico>Las mensuales salen con {MES}.</Chico>
        </div>
        <div className="grid grid-cols-2 gap-x-2 p-1.5">
          {grupos.map((g) => (
            <div key={g.grupo}>
              <Chico className="px-1 pt-1 font-semibold">{g.grupo}</Chico>
              {g.items.map((i) => (
                <p key={i} className="flex items-center gap-1 px-1 py-0.5 text-[0.75rem] font-medium">
                  <FileSpreadsheet className="size-3 text-muted-foreground" /> {i}
                </p>
              ))}
            </div>
          ))}
        </div>
        <Chico className="border-t border-border px-2.5 py-1.5">
          Y más: lecturas de energía, bono camioneros, solicitudes, personal…
        </Chico>
      </div>
    </MarcoPantalla>
  );
}

// ---------------------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------------------

type PestanaDibujo = { label: string; icono: LucideIcon; n?: number };

const PESTANAS_LIDER: PestanaDibujo[] = [
  { label: "Precios", icono: Tag, n: 2 },
  { label: "General", icono: Settings2 },
  { label: "Tarifas de transporte", icono: Truck },
  { label: "Quintas y ambulantes", icono: Tractor },
  { label: "Usuarios", icono: Users },
  { label: "Rubros de gasto", icono: Receipt },
];
const PESTANAS_ADMIN: PestanaDibujo[] = [
  { label: "Precios", icono: Tag },
  { label: "General", icono: Settings2 },
  { label: "Portal de clientes", icono: Users },
  { label: "Rubros de gasto", icono: Receipt },
];
const PESTANAS_JEFE: PestanaDibujo[] = [
  { label: "Quintas y ambulantes", icono: Tractor },
  { label: "Usuarios de Portería", icono: Users },
];

function Pestanas({ pestanas, activa }: { pestanas: PestanaDibujo[]; activa: string }) {
  return (
    <div className="grid grid-cols-2 gap-1">
      {pestanas.map(({ label, icono: Icono, n }) => (
        <span
          key={label}
          className={cn(
            "flex min-h-7 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[0.72rem] leading-tight font-semibold",
            label === activa ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
          )}
        >
          <Icono className="size-3 shrink-0" />
          <span className="min-w-0 flex-1">{label}</span>
          {n ? (
            <span className="rounded-full bg-parcial px-1 text-[0.72rem] font-bold text-white tabular">{n}</span>
          ) : null}
        </span>
      ))}
    </div>
  );
}

function FilaConcepto({
  codigo,
  nombre,
  detalle,
  precio,
  espera = false,
  editar = false,
}: {
  codigo: string;
  nombre: string;
  detalle: string;
  precio: number;
  espera?: boolean;
  editar?: boolean;
}) {
  const boton = (
    <BotonEjemplo variante="contorno" className="min-h-6 px-2 text-[0.72rem]">
      <Pencil /> Editar
    </BotonEjemplo>
  );
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 px-2 py-1.5">
      <Codigo codigo={codigo} />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-1 text-[0.75rem] font-semibold">
          {nombre} {espera ? <Sello estado="pendiente_aprobacion" /> : null}
        </p>
        <Chico>{detalle}</Chico>
      </div>
      <div className="col-start-2 flex items-center justify-between gap-2">
        <p className="text-[0.72rem] text-muted-foreground">
          <Money monto={precio} className="font-display text-[0.85rem] font-bold text-foreground" /> por mes
        </p>
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1 text-[0.72rem] text-muted-foreground">
            <Interruptor /> Activo
          </span>
          {editar ? <Resaltado className="ring-offset-card">{boton}</Resaltado> : boton}
        </div>
      </div>
    </div>
  );
}

function ListaPrecios({ editar = false, espera = false }: { editar?: boolean; espera?: boolean }) {
  return (
    <div className="space-y-1">
      <div>
        <p className="font-display text-[0.8rem] font-bold">Puestos y espacios</p>
        <Chico>Lo que paga cada mes quien ocupa un puesto, local, galpón, contéiner o cochera.</Chico>
      </div>
      <div className="divide-y divide-border rounded-lg border border-border bg-card">
        <FilaConcepto codigo="EXPC" nombre="Alquiler Cocheras" detalle="Por mes · orden 10" precio={31000} />
        <FilaConcepto
          codigo="EXME"
          nombre="Expensas Cobradas"
          detalle="Por mes · 15 % de beneficio pagando en término · orden 40"
          precio={1080000}
          editar={editar}
        />
        <FilaConcepto
          codigo="EXPG"
          nombre="Expensas Galpón"
          detalle="Por mes · orden 60"
          precio={120000}
          espera={espera}
        />
      </div>
    </div>
  );
}

/**
 * Portada de Configuración del Líder (y la común): un precio que se cambia y una persona
 * que puede entrar. Sin pestañas, porque cada rol ve las suyas. Administración y el Jefe de
 * Portería tienen la suya (abajo).
 */
export function PortadaConfiguracion() {
  return (
    <MarcoPantalla titulo="Configuración">
      <div className="space-y-1">
        <Titulo>Precios</Titulo>
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          <FilaConcepto
            codigo="EXME"
            nombre="Expensas Cobradas"
            detalle="Por mes · 15 % de beneficio pagando en término · orden 40"
            precio={1080000}
            editar
          />
        </div>
      </div>
      <div className="space-y-1">
        <Titulo>Usuarios</Titulo>
        <div className="rounded-lg border border-border bg-card">
          <FilaPersona nombre="Luis Aguirre" dni="31.245.678" rol="Portería" botones={false} />
        </div>
      </div>
    </MarcoPantalla>
  );
}

/** Portada de Administración: un precio que espera al Líder y un cliente para darle el portal. */
export function PortadaConfiguracionAdmin() {
  return (
    <MarcoPantalla titulo="Configuración">
      <div className="space-y-1">
        <Titulo>Precios</Titulo>
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          <FilaConcepto
            codigo="EXME"
            nombre="Expensas Cobradas"
            detalle="Por mes · 15 % de beneficio pagando en término · orden 40"
            precio={1080000}
            espera
          />
        </div>
      </div>
      <div className="space-y-1">
        <Titulo>Portal de clientes</Titulo>
        <div className="rounded-lg border border-border bg-card">
          <FilaCliente carpeta={58} nombre="José Fernández" apodo="Pocho" lugares="Puesto 58 · 60" socio />
        </div>
      </div>
    </MarcoPantalla>
  );
}

/** Portada del Jefe de Portería: en cuántos pagos se cobra la quinta y los usuarios de la garita. */
export function PortadaConfiguracionJefe() {
  return (
    <MarcoPantalla titulo="Configuración">
      <CuotasQuinta />
      <div className="space-y-1">
        <Titulo>Usuarios de Portería</Titulo>
        <div className="rounded-lg border border-border bg-card">
          <FilaPersona nombre="Luis Aguirre" dni="31.245.678" botones={false} />
        </div>
      </div>
    </MarcoPantalla>
  );
}

/** La pestaña «Precios»: cada concepto con su precio, su beneficio y su orden. */
export function PantallaPreciosLider() {
  return (
    <MarcoPantalla titulo="Configuración">
      <Pestanas pestanas={PESTANAS_LIDER} activa="Precios" />
      <Resaltado mano={false}>
        <ListaPrecios espera />
      </Resaltado>
    </MarcoPantalla>
  );
}

/** La pestaña «Precios» de Administración. */
export function PantallaPreciosAdmin() {
  return (
    <MarcoPantalla titulo="Configuración">
      <Pestanas pestanas={PESTANAS_ADMIN} activa="Precios" />
      <Resaltado mano={false}>
        <ListaPrecios espera />
      </Resaltado>
    </MarcoPantalla>
  );
}

function VentanaConcepto({ lider }: { lider: boolean }) {
  return (
    <MarcoPantalla titulo="Configuración" contenidoClassName="bg-sidebar/35 p-3">
      <Ventana
        titulo="Expensas Cobradas"
        descripcion={
          lider
            ? "El precio nuevo rige desde la próxima generación mensual."
            : "El cambio lo aprueba el Líder de Procesos; una vez aprobado, rige desde la próxima generación mensual."
        }
        botones={
          <>
            <BotonEjemplo variante="contorno">No, volver</BotonEjemplo>
            <Resaltado>
              <BotonEjemplo>
                {lider ? (
                  "Guardar cambios"
                ) : (
                  <>
                    <Send /> Enviar a aprobación
                  </>
                )}
              </BotonEjemplo>
            </Resaltado>
          </>
        }
      >
        <CampoEjemplo etiqueta="Precio" valor="1150000" />
        <Chico>$ 1.150.000 por mes</Chico>
        <CampoEjemplo etiqueta="Beneficio por pago en término (%)" valor="15" />
        <div className="flex items-end gap-2">
          <CampoEjemplo etiqueta="Orden de imputación" valor="40" className="w-24" />
          <Chico className="pb-1.5">Más bajo = cobra primero.</Chico>
        </div>
      </Ventana>
    </MarcoPantalla>
  );
}

/** «Editar» un concepto (Líder: se aplica en el acto). */
export function PantallaEditarConceptoLider() {
  return <VentanaConcepto lider />;
}

/** «Editar» un concepto (Administración: va a aprobación del Líder). */
export function PantallaEditarConceptoAdmin() {
  return <VentanaConcepto lider={false} />;
}

/** Orden de imputación: un pago parcial entra primero en el orden más bajo. */
export function PantallaOrdenImputacion() {
  const filas = [
    { codigo: "EXPC", nombre: "Cocheras · orden 10", monto: 31000, estado: "pagado" },
    { codigo: "EXCO", nombre: "Contribución · orden 20", monto: 25000, estado: "pagado" },
    { codigo: "EXME", nombre: "Expensa · orden 40", monto: 939130.43, estado: "parcial" },
  ];
  return (
    <MarcoPantalla titulo="Cobro a Pocho · Puesto 58">
      <FilaEjemplo derecha={<Money monto={600000} className="text-[0.95rem] font-bold" />}>
        <p className="text-[0.75rem] font-semibold">Pocho paga una parte</p>
        <Chico>La plata entra sola, en este orden:</Chico>
      </FilaEjemplo>
      <div className="space-y-1">
        {filas.map((f, i) => (
          <div key={f.codigo} className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent font-display text-[0.72rem] font-bold text-primary">
              {i + 1}
            </span>
            <Codigo codigo={f.codigo} />
            <div className="min-w-0 flex-1">
              <p className="text-[0.75rem] font-medium">{f.nombre}</p>
              <Money monto={f.monto} className="text-[0.72rem] text-muted-foreground" />
            </div>
            <Sello estado={f.estado} />
          </div>
        ))}
      </div>
      <Chico>
        Cocheras y contribución quedan pagadas; a la expensa van los $ 544.000 que sobran.
      </Chico>
    </MarcoPantalla>
  );
}

/** La pestaña «General»: vencimiento del mes e impresión directa. */
export function PantallaGeneral() {
  return (
    <MarcoPantalla titulo="Configuración">
      <Resaltado mano={false}>
        <Tarjeta>
          <Titulo>Vencimiento</Titulo>
          <Chico>
            Hasta ese día del mes los cargos se pagan con el beneficio por pago en término. Después, se debe el
            importe completo.
          </Chico>
          <CampoEjemplo etiqueta="Día de vencimiento del mes" valor="30" className="w-40" />
          <Chico>De 1 a 31. Si el mes es más corto, vence el último día.</Chico>
          <BotonEjemplo>Guardar vencimiento</BotonEjemplo>
        </Tarjeta>
      </Resaltado>
      <Tarjeta>
        <Titulo className="flex items-center gap-1.5">
          <Printer className="size-3.5 text-muted-foreground" /> Impresión directa
        </Titulo>
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-2 py-1.5">
          <span className="text-[0.72rem] font-medium">
            Al emitir un recibo, abrir el cartel para imprimir automáticamente
          </span>
          <Interruptor />
        </div>
      </Tarjeta>
    </MarcoPantalla>
  );
}

/** Una tarifa de transporte como la ve el Líder: nombre y precio para cambiar, y si se cobra. */
function TarifaEditable({ nombre, precio }: { nombre: string; precio: number }) {
  return (
    <div className="space-y-1.5 rounded-lg border border-border p-2">
      <div className="flex items-end gap-1.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border-2 border-border bg-card text-primary">
          <Truck className="size-4" />
        </span>
        <CampoEjemplo etiqueta="Nombre" valor={nombre} className="min-w-0 flex-1" />
        <CampoEjemplo etiqueta="Precio" valor={String(precio)} className="w-20" />
      </div>
      <div className="flex items-center justify-between gap-2">
        <Chico>
          Portería va a cobrar <Money monto={precio} className="font-semibold text-foreground" /> por vehículo.
        </Chico>
        <span className="flex shrink-0 items-center gap-1 text-[0.72rem] font-medium">
          <Interruptor /> Se cobra
        </span>
      </div>
    </div>
  );
}

/** Lo que cobra Portería: tarifas de transporte, la quinta y el ambulante (Líder). */
export function PantallaTarifasPorteria() {
  return (
    <MarcoPantalla titulo="Configuración">
      <Tarjeta>
        <Titulo className="flex items-center gap-1.5">
          Tarifas de transporte <Codigo codigo="BC" />
        </Titulo>
        <Chico>
          Lo que cobra Portería por cada vehículo que entra (bono camioneros). Un precio nuevo rige desde el
          próximo cobro.
        </Chico>
        <TarifaEditable nombre="Camioneta" precio={6000} />
        <TarifaEditable nombre="Chasis" precio={8000} />
        <BotonEjemplo variante="contorno" className="min-h-7 px-2 text-[0.72rem]">
          <Plus /> Agregar tarifa
        </BotonEjemplo>
      </Tarjeta>
      <Tarjeta>
        <Titulo>Quintas y ambulantes</Titulo>
        <FilaEjemplo derecha={<Money monto={330000} className="text-[0.8rem] font-bold" />}>
          <p className="flex items-center gap-1.5 text-[0.75rem] font-semibold">
            <Tractor className="size-3.5 text-primary" /> Quinta <Codigo codigo="EXPQ" />
          </p>
          <Chico>En 4 pagos: $ 82.500 cada uno</Chico>
        </FilaEjemplo>
        <FilaEjemplo>
          <p className="flex items-center gap-1.5 text-[0.75rem] font-semibold">
            <Footprints className="size-3.5 text-primary" /> Ambulante <Codigo codigo="AMB" />
          </p>
          <Chico>El precio por día se pone en cada cobro.</Chico>
        </FilaEjemplo>
      </Tarjeta>
    </MarcoPantalla>
  );
}

function CuotasQuinta({ resaltar = false }: { resaltar?: boolean }) {
  const opciones = [
    { n: 1, label: "1 pago", ayuda: "Todo junto" },
    { n: 2, label: "2 pagos", ayuda: "Quincenal" },
    { n: 3, label: "3 pagos", ayuda: "Cada 10 días" },
    { n: 4, label: "4 pagos", ayuda: "Semanal" },
  ];
  const grilla = (
    <div className="grid grid-cols-4 gap-1">
      {opciones.map((o) => (
        <span
          key={o.n}
          className={cn(
            "flex min-h-11 flex-col items-center justify-center rounded-md border px-0.5 text-center",
            o.n === 4 ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
          )}
        >
          <span className="font-display text-[0.8rem] font-bold">{o.label}</span>
          <span className="text-[0.72rem] leading-tight opacity-80">{o.ayuda}</span>
        </span>
      ))}
    </div>
  );
  return (
    <Tarjeta>
      <Titulo>¿En cuántos pagos cobrás la quinta?</Titulo>
      <Chico>Es lo que se propone al dar de alta un quintero. Rige para los quinteros nuevos.</Chico>
      {resaltar ? <Resaltado className="ring-offset-card">{grilla}</Resaltado> : grilla}
      <p className="text-[0.75rem]">
        Son 4 pagos de ≈ <strong className="tabular">$ 82.500</strong>{" "}
        <span className="text-muted-foreground">(quinta de $ 330.000)</span>
      </p>
    </Tarjeta>
  );
}

/** En cuántos pagos se cobra la quinta (Jefe de Portería). */
export function PantallaCuotasQuinta() {
  return (
    <MarcoPantalla titulo="Configuración">
      <Pestanas pestanas={PESTANAS_JEFE} activa="Quintas y ambulantes" />
      <CuotasQuinta resaltar />
    </MarcoPantalla>
  );
}

/** Cambiar el precio de la quinta: se manda al Líder (Jefe de Portería). */
export function PantallaPrecioQuinta() {
  return (
    <MarcoPantalla titulo="Configuración">
      <div>
        <Titulo>Precios</Titulo>
        <Chico>
          El de la quinta lo aprueba el Líder de Procesos. Hasta que lo apruebe, se sigue cobrando el precio de ahora.
        </Chico>
      </div>
      <Tarjeta>
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-primary">
            <Tractor className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[0.8rem] font-semibold">
              Quinta <Codigo codigo="EXPQ" />
            </p>
            <Chico>En 4 pagos: $ 82.500 cada uno</Chico>
          </div>
          <p className="text-right">
            <Money monto={330000} className="font-display text-[0.95rem] font-bold" />
            <Chico>por mes</Chico>
          </p>
        </div>
        <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-2">
          <CampoEjemplo etiqueta="Precio nuevo por mes" valor="360000" />
          <p className="text-[0.75rem] tabular">
            <strong>$ 360.000</strong> por mes <span className="text-muted-foreground">· En 4 pagos: $ 90.000 cada uno</span>
          </p>
          <div className="flex gap-1.5">
            <Resaltado>
              <BotonEjemplo>
                <Send /> Enviar al Líder
              </BotonEjemplo>
            </Resaltado>
            <BotonEjemplo variante="contorno">Cancelar</BotonEjemplo>
          </div>
        </div>
      </Tarjeta>
      <FilaEjemplo>
        <p className="flex items-center gap-1.5 text-[0.75rem] font-semibold">
          <Footprints className="size-3.5 text-primary" /> Ambulante <Codigo codigo="AMB" />
        </p>
        <Chico>El precio por día se pone en cada cobro: escribís cuánto paga y se multiplica por los días.</Chico>
      </FilaEjemplo>
    </MarcoPantalla>
  );
}

function FilaPersona({
  nombre,
  dni,
  rol,
  botones = true,
  className,
}: {
  nombre: string;
  dni: string;
  rol?: string;
  botones?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-2 px-2 py-2", className)}>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent font-display text-[0.8rem] font-bold text-primary">
        {nombre.charAt(0)}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-center gap-1.5 text-[0.8rem] font-semibold">
          {nombre} <Sello estado="activo" texto="Puede entrar" />
        </p>
        <Chico>
          <span className="text-foreground tabular">DNI {dni}</span>
          {rol ? ` · ${rol}` : ""}
        </Chico>
        {botones ? (
          <div className="flex flex-wrap gap-1">
            <BotonEjemplo variante="contorno" className="min-h-6 px-1.5 text-[0.72rem]">
              <KeyRound /> Nueva contraseña
            </BotonEjemplo>
            <BotonEjemplo variante="contorno" className="min-h-6 px-1.5 text-[0.72rem]">
              <Pencil /> Editar
            </BotonEjemplo>
            <span className="inline-flex min-h-6 items-center gap-1 px-1.5 text-[0.72rem] font-semibold text-destructive">
              <UserX className="size-3.5" /> Quitar acceso
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** «Usuarios» del Líder: Equipo o Portal de clientes, y la lista del equipo. */
export function PantallaUsuariosEquipo() {
  return (
    <MarcoPantalla titulo="Configuración">
      <Resaltado mano={false}>
        <div className="flex gap-1.5">
          <span className="inline-flex min-h-7 items-center gap-1 rounded-full border border-primary bg-primary px-2.5 text-[0.75rem] font-semibold text-primary-foreground">
            Equipo <span className="opacity-80">7</span>
          </span>
          <span className="inline-flex min-h-7 items-center gap-1 rounded-full border border-border bg-card px-2.5 text-[0.75rem] font-semibold">
            Portal de clientes <span className="opacity-80">74 con acceso</span>
          </span>
        </div>
      </Resaltado>
      <div className="flex items-end justify-between gap-2">
        <div>
          <Titulo>Equipo</Titulo>
          <Chico>7 pueden entrar. Entran con su DNI.</Chico>
        </div>
        <BotonEjemplo className="min-h-7 px-2 text-[0.72rem]">
          <UserPlus /> Nuevo usuario
        </BotonEjemplo>
      </div>
      <div className="divide-y divide-border rounded-lg border border-border bg-card">
        <FilaPersona nombre="Marta Núñez" dni="28.456.123" rol="Administración" />
        <FilaPersona nombre="Graciela Paz" dni="25.310.884" rol="Tesorería" botones={false} />
      </div>
    </MarcoPantalla>
  );
}

function FormNuevoUsuario({ porteria }: { porteria: boolean }) {
  return (
    <div className="space-y-2 rounded-xl border-2 border-primary/25 bg-card p-2.5">
      <div>
        <Titulo>{porteria ? "Nuevo usuario de Portería" : "Nuevo usuario"}</Titulo>
        <Chico>Entra con su DNI y la contraseña que le damos acá.</Chico>
      </div>
      <p className="text-[0.75rem] font-semibold">¿Quién es?</p>
      <div className="flex flex-wrap gap-1">
        <span className="flex flex-col rounded-md border border-primary bg-accent px-1.5 py-0.5">
          <span className="flex items-center gap-1 text-[0.72rem] font-semibold">
            <Check className="size-3 text-primary" strokeWidth={2.6} /> Aguirre, Luis
          </span>
          <span className="text-[0.72rem] text-muted-foreground tabular">DNI 31.245.678</span>
        </span>
        <span className="flex flex-col rounded-md border border-border bg-card px-1.5 py-0.5">
          <span className="text-[0.72rem] font-semibold">Sosa, Mirta</span>
          <span className="text-[0.72rem] text-muted-foreground tabular">DNI 33.902.115</span>
        </span>
      </div>
      <p className="text-[0.75rem] font-semibold">¿Qué hace en la cooperativa?</p>
      {porteria ? (
        <p className="rounded-md border border-border bg-muted/40 px-2 py-1 text-[0.72rem]">
          <strong>Portería:</strong> cobra el canon de transporte, registra el ingreso del personal y genera solicitudes.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-1">
          {["Líder de Procesos", "Administración", "Tesorería", "Jefe de Portería", "Portería"].map((r) => (
            <span
              key={r}
              className={cn(
                "rounded-md border px-1.5 py-1 text-[0.72rem] font-semibold",
                r === "Portería" ? "border-primary bg-accent" : "border-border bg-card"
              )}
            >
              {r}
            </span>
          ))}
        </div>
      )}
      <CampoEjemplo etiqueta="Contraseña para entrar" valor="Tomate-4821" />
      <Resaltado>
        <BotonEjemplo className="w-full">
          <UserPlus /> Crear el usuario de Luis
        </BotonEjemplo>
      </Resaltado>
    </div>
  );
}

/** «Nuevo usuario» del Líder: quién es, qué hace y la contraseña. */
export function PantallaNuevoUsuario() {
  return (
    <MarcoPantalla titulo="Configuración">
      <FormNuevoUsuario porteria={false} />
    </MarcoPantalla>
  );
}

/** «Nuevo usuario de Portería» del Jefe: el rol ya viene elegido. */
export function PantallaNuevoUsuarioPorteria() {
  return (
    <MarcoPantalla titulo="Configuración">
      <FormNuevoUsuario porteria />
    </MarcoPantalla>
  );
}

function Credencial({
  titulo,
  nombre,
  dni,
  contrasena,
}: {
  titulo: string;
  nombre: string;
  dni: string;
  contrasena: string;
}) {
  return (
    <MarcoPantalla titulo="Configuración">
      <div className="space-y-2 rounded-xl border-2 border-pagado/40 bg-pagado-suave/40 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-display text-[0.85rem] font-bold">{titulo}</p>
            <Chico>{nombre}</Chico>
          </div>
          <Sello estado="activo" texto="Listo para entrar" />
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-card p-2">
          <div>
            <Chico>Entra con su DNI</Chico>
            <p className="font-display text-[0.9rem] font-bold tabular">{dni}</p>
          </div>
          <div>
            <Chico>Contraseña</Chico>
            <p className="font-display text-[0.9rem] font-bold">{contrasena}</p>
          </div>
        </div>
        <p className="flex items-start gap-1.5 text-[0.72rem] font-medium">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-parcial" />
          Anotala ahora: después no se puede volver a ver.
        </p>
        <div className="flex gap-1.5">
          <Resaltado>
            <BotonEjemplo>
              <Printer /> Imprimir
            </BotonEjemplo>
          </Resaltado>
          <BotonEjemplo variante="contorno">
            <Copy /> Copiar
          </BotonEjemplo>
          <span className="ml-auto inline-flex items-center gap-1 px-1 text-[0.8rem] font-semibold">
            <Check className="size-3.5" /> Listo
          </span>
        </div>
      </div>
    </MarcoPantalla>
  );
}

/** La tarjeta con el DNI y la contraseña de un usuario nuevo, para imprimir y dar en mano. */
export function PantallaCredencial() {
  return <Credencial titulo="Usuario creado" nombre="Luis Aguirre" dni="31.245.678" contrasena="Tomate-4821" />;
}

/** La tarjeta del acceso al portal de un cliente, para imprimir y dar en mano. */
export function PantallaCredencialPortal() {
  return (
    <Credencial titulo="Acceso al portal creado" nombre="José Fernández" dni="20.345.678" contrasena="Durazno-3915" />
  );
}

/** Quitar el acceso a alguien: pregunta antes y se puede devolver. */
export function PantallaQuitarAcceso() {
  return (
    <MarcoPantalla titulo="Configuración">
      <div className="rounded-lg border border-border bg-card">
        <FilaPersona nombre="Luis Aguirre" dni="31.245.678" />
      </div>
      <Ventana
        titulo="¿Le quitás el acceso a Luis Aguirre?"
        descripcion="Luis Aguirre no va a poder entrar más. Sus datos quedan. Si hace falta, le devolvés el acceso con un toque."
        botones={
          <>
            <BotonEjemplo variante="contorno">No, dejalo</BotonEjemplo>
            <BotonEjemplo className="bg-destructive text-white">
              <UserX /> Quitar acceso
            </BotonEjemplo>
          </>
        }
      />
    </MarcoPantalla>
  );
}

function FilaCliente({
  carpeta,
  nombre,
  apodo,
  lugares,
  socio = false,
  abierto = false,
}: {
  carpeta: number;
  nombre: string;
  apodo?: string;
  lugares: string;
  socio?: boolean;
  /** Con el alta abierta el botón pasa a decir «Cerrar». */
  abierto?: boolean;
}) {
  const boton = abierto ? (
    <BotonEjemplo className="min-h-7 bg-secondary px-2 text-[0.72rem] text-secondary-foreground">
      <KeyRound /> Cerrar
    </BotonEjemplo>
  ) : (
    <BotonEjemplo className="min-h-7 px-2 text-[0.72rem]">
      <KeyRound /> Dar acceso
    </BotonEjemplo>
  );
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1.5">
      <div className="min-w-0">
        <p className="text-[0.75rem] font-semibold">
          <span className="text-muted-foreground tabular">Carpeta {carpeta}</span> · {nombre}
          {apodo ? <span className="font-normal text-muted-foreground"> ({apodo})</span> : null}
          {socio ? <Sello estado="socio" className="ml-1 align-middle" /> : null}
        </p>
        <Chico>{lugares}</Chico>
      </div>
      {boton}
    </div>
  );
}

/** «Portal de clientes»: sin acceso y con acceso, y el buscador. */
export function PantallaPortalClientes() {
  return (
    <MarcoPantalla titulo="Configuración">
      <div>
        <Titulo>Clientes en el portal</Titulo>
        <Chico>Desde el portal ve su cuenta, descarga sus recibos y recibe las comunicaciones. Entra con su DNI.</Chico>
      </div>
      <Resaltado mano={false}>
        <div className="grid grid-cols-2 overflow-hidden rounded-md border border-border">
          <span className="bg-muted px-2 py-1 text-center text-[0.75rem] font-semibold">
            Sin acceso <span className="opacity-80">38</span>
          </span>
          <span className="bg-card px-2 py-1 text-center text-[0.75rem]">
            Con acceso <span className="opacity-80">74</span>
          </span>
        </div>
      </Resaltado>
      <div className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2 text-[0.75rem] text-muted-foreground">
        <Search className="size-3.5" /> Carpeta, nombre, apodo o puesto
      </div>
      <div className="divide-y divide-border rounded-lg border border-border bg-card">
        <FilaCliente carpeta={58} nombre="José Fernández" apodo="Pocho" lugares="Puesto 58 · 60" socio />
        <FilaCliente carpeta={12} nombre="Rosa Medina" apodo="La Colorada" lugares="Puesto 12" />
      </div>
    </MarcoPantalla>
  );
}

/** «Dar acceso»: se abre en la misma fila, con el DNI sacado del CUIT. */
export function PantallaDarAcceso() {
  return (
    <MarcoPantalla titulo="Configuración">
      <div className="rounded-lg border border-border bg-card">
        <FilaCliente carpeta={58} nombre="José Fernández" apodo="Pocho" lugares="Puesto 58 · 60" socio abierto />
        <div className="mx-2 mb-2 space-y-1.5 rounded-lg border border-border p-2">
          <Resaltado className="ring-offset-card">
            <div className="space-y-1 p-1">
              <CampoEjemplo etiqueta="DNI" valor="20.345.678" />
              <Chico>Lo sacamos del CUIT: revisalo con el documento.</Chico>
            </div>
          </Resaltado>
          <CampoEjemplo etiqueta="¿Quién va a entrar?" valor="José Fernández" />
          <CampoEjemplo etiqueta="Contraseña para entrar" valor="Durazno-3915" />
          <BotonEjemplo className="w-full">
            <UserPlus /> Dar acceso a José Fernández
          </BotonEjemplo>
        </div>
      </div>
    </MarcoPantalla>
  );
}

/** «Rubros de gasto»: un rubro fijo con su monto y su día, y los variables. */
export function PantallaRubroFijo() {
  return (
    <MarcoPantalla titulo="Configuración · Rubros de gasto">
      <div className="space-y-1.5 rounded-lg border border-border bg-card px-2 py-2">
        <div className="flex items-center gap-2">
          <Codigo codigo="ALQ" />
          <p className="min-w-0 flex-1 text-[0.75rem] font-medium">Alquiler del Predio</p>
          <Resaltado mano={false}>
            <span className="flex gap-0.5 rounded-md bg-muted p-0.5 text-[0.7rem] font-semibold">
              <span className="rounded px-1.5 py-0.5 text-muted-foreground">Variable</span>
              <span className="rounded bg-card px-1.5 py-0.5 text-primary shadow-sm">Fijo</span>
            </span>
          </Resaltado>
        </div>
        <div className="flex items-end gap-1.5 rounded-md border border-primary/20 bg-accent/40 p-1.5">
          <CampoEjemplo etiqueta="Monto de cada mes" valor={<span className="font-semibold tabular">850.000</span>} className="flex-1" />
          <CampoEjemplo etiqueta="Vence el día" valor={<span className="font-semibold tabular">10</span>} className="w-16" />
        </div>
        <p className="text-[0.7rem] text-muted-foreground">
          Todos los meses se carga solo en «Gastos»: <strong className="text-foreground">$ 850.000</strong>, vence el 10.
        </p>
        <Resaltado>
          <BotonEjemplo>Guardar fijo</BotonEjemplo>
        </Resaltado>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5">
        <Codigo codigo="COMB" />
        <p className="min-w-0 flex-1 text-[0.75rem] font-medium">Combustible</p>
        <span className="flex gap-0.5 rounded-md bg-muted p-0.5 text-[0.7rem] font-semibold">
          <span className="rounded bg-card px-1.5 py-0.5 text-primary shadow-sm">Variable</span>
          <span className="rounded px-1.5 py-0.5 text-muted-foreground">Fijo</span>
        </span>
      </div>
    </MarcoPantalla>
  );
}

/** «Rubros de gasto»: el alta de un rubro y la lista con su interruptor. */
export function PantallaRubros() {
  const rubros = [
    { codigo: "AGUA", nombre: "Agua de Malagueño", activo: true },
    { codigo: "ALQ", nombre: "Alquiler del Predio", activo: true },
    { codigo: "GINT", nombre: "Gastos de Internet", activo: false },
  ];
  return (
    <MarcoPantalla titulo="Configuración">
      <Resaltado mano={false}>
        <Tarjeta>
          <Titulo>Nuevo rubro</Titulo>
          <div className="flex items-end gap-1.5">
            <CampoEjemplo etiqueta="Código" valor="PAPEL" className="w-20" />
            <CampoEjemplo etiqueta="Nombre" valor="Papelería y librería" className="flex-1" />
          </div>
          <BotonEjemplo>
            <Plus /> Agregar rubro
          </BotonEjemplo>
        </Tarjeta>
      </Resaltado>
      <div className="divide-y divide-border rounded-lg border border-border bg-card">
        {rubros.map((r) => (
          <div key={r.codigo} className="flex items-center gap-2 px-2 py-1.5">
            <Codigo codigo={r.codigo} />
            <p className="min-w-0 flex-1 text-[0.75rem] font-medium">{r.nombre}</p>
            <span className="flex items-center gap-1 text-[0.72rem] text-muted-foreground">
              <Interruptor prendido={r.activo} /> {r.activo ? "Activo" : "Apagado"}
            </span>
          </div>
        ))}
      </div>
    </MarcoPantalla>
  );
}
