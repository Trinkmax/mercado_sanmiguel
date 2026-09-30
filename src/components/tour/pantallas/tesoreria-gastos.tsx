import {
  ArrowRight,
  Banknote,
  CalendarClock,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  FileText,
  FileWarning,
  Landmark,
  Paperclip,
  Percent,
  Plus,
  Printer,
  Shuffle,
  Stamp,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CajaRegistradora } from "@/components/shared/iconos";
import { Codigo } from "@/components/shared/codigo";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { MontoMoneda } from "@/components/tesoreria/monto";
import {
  BotonEjemplo,
  CampoEjemplo,
  FilaEjemplo,
  MarcoPantalla,
  Resaltado,
} from "@/components/tour/pantalla";

// Tour guiado · tesoreria-gastos: pantallas de ejemplo (dibujos quietos, datos inventados).
// Se parecen a /tesoreria y /gastos en chico: mismos títulos, mismos botones, mismo orden.

// ---------------------------------------------------------------------------------------
// Piezas chicas compartidas
// ---------------------------------------------------------------------------------------

/** Una opción elegible dibujada (chip de los formularios: «Pesos», «Banco», «Hoy»). */
function Opcion({ activo = false, children, className }: { activo?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center justify-center rounded-md border px-2 text-[0.72rem] font-medium",
        activo ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
        className
      )}
    >
      {children}
    </span>
  );
}

/** Una pregunta del formulario con sus opciones debajo. */
function Pregunta({ texto, children }: { texto: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[0.72rem] font-medium">{texto}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/** Título de un bloque de la pantalla ("Cajas para contar y validar") con su detalle. */
function TituloBloque({ titulo, detalle }: { titulo: string; detalle?: string }) {
  return (
    <div>
      <p className="font-display text-[0.8rem] font-bold">{titulo}</p>
      {detalle ? <p className="text-[0.72rem] text-muted-foreground">{detalle}</p> : null}
    </div>
  );
}

/** Las cuatro pestañas de Tesorería, con la activa marcada y el número ámbar de Conciliar. */
function PestanasTesoreria({ activa }: { activa: "Hoy" | "Movimientos" | "Conciliar" }) {
  const pestanas: { label: string; n?: number }[] = [
    { label: "Hoy" },
    { label: "Movimientos" },
    { label: "Conciliar", n: 3 },
    { label: "Saldos iniciales" },
  ];
  return (
    <div className="grid grid-cols-4 gap-0.5 rounded-lg border bg-muted/60 p-0.5">
      {pestanas.map((p) => (
        <span
          key={p.label}
          className={cn(
            "flex min-h-7 items-center justify-center gap-1 rounded-md px-0.5 text-center text-[0.72rem] leading-tight font-medium",
            p.label === activa ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          )}
        >
          {p.label}
          {p.n ? (
            <span className="rounded-full bg-parcial-suave px-1 text-[0.72rem] font-bold text-parcial tabular">{p.n}</span>
          ) : null}
        </span>
      ))}
    </div>
  );
}

/** La banda azul con el total de la plata de la cooperativa. */
function BandaTotal() {
  return (
    <div className="flex items-center justify-between gap-2 bg-primary px-2.5 py-2 text-primary-foreground">
      <div className="min-w-0">
        <p className="font-display text-[0.8rem] font-bold">Plata de la cooperativa hoy</p>
        <p className="text-[0.72rem] opacity-85">Efectivo + banco + cheques, en pesos</p>
      </div>
      <Money monto={4870000} className="shrink-0 text-[1rem] font-bold" />
    </div>
  );
}

/** Un gasto de la lista de Gastos, en chico. */
function FilaGastoEjemplo({
  titulo,
  codigo,
  rubro,
  detalle,
  monto,
  vencido = false,
  derecha,
}: {
  titulo: string;
  codigo: string;
  rubro: string;
  detalle: React.ReactNode;
  monto: number;
  vencido?: boolean;
  derecha?: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1 px-2.5 py-2", vencido && "bg-pendiente-suave/50")}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[0.8rem] font-semibold">{titulo}</p>
        <Money monto={monto} className={cn("shrink-0 text-[0.8rem] font-bold", vencido && "text-pendiente")} />
      </div>
      <p className="flex flex-wrap items-center gap-1 text-[0.72rem] text-muted-foreground">
        <Codigo codigo={codigo} />
        {rubro} · {detalle}
      </p>
      {derecha ? <div className="flex items-center justify-end gap-1.5">{derecha}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// Tesorería
// ---------------------------------------------------------------------------------------

/** Portada del capítulo "Tesorería": la pestaña Hoy en chico. */
export function PortadaTesoreria() {
  return (
    <MarcoPantalla titulo="Tesorería">
      <PestanasTesoreria activa="Hoy" />
      <div className="overflow-hidden rounded-lg border bg-card">
        <BandaTotal />
        <div className="grid grid-cols-3 divide-x">
          {[
            { label: "Efectivo", monto: 1080000 },
            { label: "Banco", monto: 3250000 },
            { label: "Cheques", monto: 540000 },
          ].map((d) => (
            <div key={d.label} className="px-2 py-1.5">
              <p className="text-[0.72rem] text-muted-foreground">{d.label}</p>
              <Money monto={d.monto} className="text-[0.8rem] font-bold" />
            </div>
          ))}
        </div>
      </div>
      <FilaEjemplo
        derecha={
          <BotonEjemplo className="min-h-7 px-2 text-[0.72rem]">
            <Stamp /> Contar y validar
          </BotonEjemplo>
        }
      >
        <p className="text-[0.72rem] font-semibold">Martes 29 de septiembre</p>
        <p className="text-[0.72rem] text-muted-foreground">
          Tiene que haber <Money monto={412300} className="font-semibold text-foreground" />
        </p>
      </FilaEjemplo>
    </MarcoPantalla>
  );
}

/** Pestaña Hoy: la plata de la cooperativa, cuenta por cuenta. */
export function PantallaPlataHoy() {
  return (
    <MarcoPantalla titulo="Tesorería · Hoy">
      <div className="overflow-hidden rounded-lg border bg-card">
        <BandaTotal />
        <div className="divide-y">
          <div className="space-y-1 px-2.5 py-2">
            <p className="text-[0.72rem] font-semibold tracking-widest text-muted-foreground uppercase">Pesos</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[0.72rem] text-muted-foreground">Efectivo</p>
                <Money monto={1080000} className="text-[0.9rem] font-bold" />
                <p className="text-[0.72rem] font-medium text-parcial">
                  <Money monto={186000} /> en cajas abiertas o sin validar
                </p>
              </div>
              <div>
                <p className="text-[0.72rem] text-muted-foreground">Banco</p>
                <Money monto={3250000} className="text-[0.9rem] font-bold" />
              </div>
            </div>
          </div>
          <div className="space-y-1 px-2.5 py-2">
            <p className="text-[0.72rem] font-semibold tracking-widest text-muted-foreground uppercase">Dólares</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[0.72rem] text-muted-foreground">Efectivo</p>
                <MontoMoneda monto={1200} moneda="USD" className="text-[0.9rem] font-bold" />
              </div>
              <div>
                <p className="text-[0.72rem] text-muted-foreground">Banco</p>
                <MontoMoneda monto={0} moneda="USD" className="text-[0.9rem] font-bold" />
              </div>
            </div>
            <p className="text-[0.72rem] text-muted-foreground">Los dólares no se suman a los pesos.</p>
          </div>
          <div className="space-y-1 px-2.5 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[0.72rem] font-semibold tracking-widest text-muted-foreground uppercase">Cheques</p>
              <span className="flex items-center gap-0.5 text-[0.72rem] font-medium text-primary">
                Ver cheques <ArrowRight className="size-3" />
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[0.72rem] text-muted-foreground">Por cobrar</p>
                <Money monto={540000} className="text-[0.9rem] font-bold" />
              </div>
              <div>
                <p className="text-[0.72rem] text-muted-foreground">Listos para depositar</p>
                <Money monto={150000} className="text-[0.8rem] font-semibold text-parcial" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </MarcoPantalla>
  );
}

/** Hoy sin saldos iniciales: el aviso y las cuentas para cargar (una ya completa). */
export function PantallaSaldosIniciales() {
  return (
    <MarcoPantalla titulo="Tesorería · Hoy">
      <div className="rounded-lg border border-primary/30 bg-accent/60 px-2.5 py-2">
        <p className="font-display text-[0.8rem] font-bold">Antes de empezar, cargá cuánta plata había</p>
        <p className="text-[0.72rem] text-muted-foreground">
          Desde ese día el sistema suma los cobros y resta los gastos solo.
        </p>
      </div>
      <div className="space-y-2 rounded-lg border bg-card px-2.5 py-2">
        <div className="flex items-center justify-between gap-2">
          <p className="font-display text-[0.8rem] font-bold">Pesos en efectivo</p>
          <Sello estado="pendiente" texto="Falta cargar" className="text-[0.72rem]" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <CampoEjemplo etiqueta="¿Cuánto había?" valor={<span className="font-semibold tabular">1.080.000</span>} />
          <CampoEjemplo etiqueta="Saldo al comenzar el día" valor={<span className="tabular">01/09/2026</span>} />
        </div>
        <Resaltado>
          <BotonEjemplo className="w-full">Guardar pesos en efectivo</BotonEjemplo>
        </Resaltado>
      </div>
      <div className="flex items-center justify-between gap-2 rounded-lg border bg-card px-2.5 py-2">
        <p className="font-display text-[0.8rem] font-bold">Pesos en el banco</p>
        <Sello estado="pendiente" texto="Falta cargar" className="text-[0.72rem]" />
      </div>
      <p className="text-[0.72rem] text-muted-foreground">Y lo mismo con los dólares, en efectivo y en el banco.</p>
    </MarcoPantalla>
  );
}

/** La ventana de «Comisión o impuesto», completa, con cómo quedan las cuentas. */
export function PantallaMovimientoBanco() {
  return (
    <MarcoPantalla titulo="Comisión o impuesto">
      <p className="flex items-center gap-1.5 text-[0.72rem] text-muted-foreground">
        <Percent className="size-3.5 text-primary" /> Lo que descuenta el banco
      </p>
      <Pregunta texto="¿Qué descontó el banco?">
        <Opcion>Comisión</Opcion>
        <Opcion activo>Impuesto</Opcion>
        <Opcion>IVA (débito fiscal)</Opcion>
      </Pregunta>
      <div className="grid grid-cols-2 gap-2">
        <Pregunta texto="¿En qué moneda?">
          <Opcion activo>Pesos</Opcion>
          <Opcion>Dólares</Opcion>
        </Pregunta>
        <Pregunta texto="¿En qué cuenta?">
          <Opcion>Efectivo</Opcion>
          <Opcion activo>Banco</Opcion>
        </Pregunta>
      </div>
      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <CampoEjemplo etiqueta="Monto" valor={<span className="font-semibold tabular">12.450</span>} />
        <Pregunta texto="¿Qué día?">
          <Opcion activo>Hoy</Opcion>
          <Opcion>Ayer</Opcion>
        </Pregunta>
      </div>
      <div className="rounded-lg bg-muted/60 px-2.5 py-1.5">
        <p className="text-[0.72rem] font-medium text-muted-foreground">Así quedan las cuentas</p>
        <p className="flex flex-wrap items-center gap-1.5 text-[0.8rem] tabular">
          <span className="font-medium">Banco</span>
          <Money monto={3250000} className="text-muted-foreground" />
          <ArrowRight className="size-3.5 text-muted-foreground" />
          <Money monto={3237550} className="font-bold text-pendiente" />
        </p>
      </div>
      <Resaltado className="mb-2">
        <BotonEjemplo className="w-full">
          Registrar impuesto de <Money monto={12450} />
        </BotonEjemplo>
      </Resaltado>
    </MarcoPantalla>
  );
}

/** Cajas para contar y validar: una de Administración y la de portería que ya recibió. */
export function PantallaCajasValidar() {
  return (
    <MarcoPantalla titulo="Tesorería · Hoy">
      <TituloBloque titulo="Cajas para contar y validar" detalle="1 de administración y 1 de portería" />
      <div className="divide-y overflow-hidden rounded-lg border bg-card">
        <div className="space-y-1 px-2.5 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[0.8rem] font-semibold">Martes 29 de septiembre</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[0.72rem] text-muted-foreground">Administración</span>
            <Sello estado="cerrada" className="text-[0.72rem]" />
            <span className="text-[0.72rem] text-muted-foreground">· La cerró Marta</span>
          </div>
          <p className="text-[0.8rem]">
            Tiene que haber <Money monto={412300} className="font-bold" /> en efectivo
          </p>
          <p className="text-[0.72rem] text-muted-foreground tabular">
            Banco $ 96.000 · Cheques $ 150.000 · Gastos pagados −$ 18.500
          </p>
          <div className="flex items-center justify-end gap-1.5 pt-0.5">
            <BotonEjemplo variante="contorno" className="min-h-7 px-2">
              <Printer />
            </BotonEjemplo>
            <Resaltado>
              <BotonEjemplo className="min-h-7 px-2.5">
                <Stamp /> Contar y validar
              </BotonEjemplo>
            </Resaltado>
          </div>
        </div>
        <div className="space-y-1 px-2.5 py-2 opacity-80">
          <p className="text-[0.8rem] font-semibold">Martes 29 de septiembre</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[0.72rem] text-muted-foreground">Caja de portería</span>
            <Sello estado="integrada" className="text-[0.72rem]" />
          </div>
          <p className="text-[0.72rem] text-muted-foreground">
            Ya está en la caja de administración del 29/09: se valida con esa.
          </p>
          <div className="flex justify-end">
            <BotonEjemplo variante="contorno" className="min-h-7 px-2.5">
              Ver caja
            </BotonEjemplo>
          </div>
        </div>
      </div>
    </MarcoPantalla>
  );
}

/** Cheques para depositar y gastos que vencen en 7 días, cada uno con su «Pagar». */
export function PantallaLoQueVence() {
  return (
    <MarcoPantalla titulo="Tesorería · Hoy">
      <div className="flex items-end justify-between gap-2">
        <TituloBloque titulo="Cheques para depositar" detalle="1 cheque por $ 150.000" />
        <BotonEjemplo className="min-h-7 shrink-0 px-2 text-[0.72rem]">
          Depositar en Cheques <ArrowRight />
        </BotonEjemplo>
      </div>
      <FilaEjemplo derecha={<Money monto={150000} className="text-[0.8rem] font-semibold" />}>
        <p className="text-[0.8rem] font-semibold tabular">Cheque N° 30412823</p>
        <p className="text-[0.72rem] text-muted-foreground">Puesto 58 · Pocho · se cobra desde el 28/09</p>
      </FilaEjemplo>
      <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1 pt-1">
        <TituloBloque titulo="Gastos a pagar" detalle="2 gastos vencidos o por vencer en 7 días: $ 249.300" />
        <BotonEjemplo variante="contorno" className="min-h-7 px-2 text-[0.72rem]">
          Ver todos los gastos <ArrowRight />
        </BotonEjemplo>
      </div>
      <div className="divide-y overflow-hidden rounded-lg border bg-card">
        <FilaGastoEjemplo
          titulo="Seguro del galpón"
          codigo="SEGUV"
          rubro="Seguros Varios"
          detalle={<span className="font-semibold text-pendiente">Venció 28/09</span>}
          monto={185000}
          vencido
          derecha={
            <Resaltado>
              <BotonEjemplo className="min-h-7 px-3">Pagar</BotonEjemplo>
            </Resaltado>
          }
        />
        <FilaGastoEjemplo
          titulo="Luz de los baños"
          codigo="GE"
          rubro="Gastos de Energía"
          detalle="Vence 02/10"
          monto={64300}
          derecha={<BotonEjemplo className="min-h-7 px-3">Pagar</BotonEjemplo>}
        />
      </div>
    </MarcoPantalla>
  );
}

/** Un casillero dibujado (marcado o no). */
function Casillero({ marcado = false }: { marcado?: boolean }) {
  return (
    <span
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded border",
        marcado ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
      )}
    >
      {marcado ? <Check className="size-3" strokeWidth={3} /> : null}
    </span>
  );
}

/** Conciliar: las transferencias sin conciliar, con su comprobante y «Conciliar». */
export function PantallaConciliar() {
  return (
    <MarcoPantalla titulo="Tesorería · Conciliar">
      <PestanasTesoreria activa="Conciliar" />
      <TituloBloque
        titulo="Transferencias contra el banco"
        detalle="Marcá cada transferencia cuando la veas acreditada en el resumen del banco."
      />
      <p className="flex w-fit items-center gap-1.5 rounded-md bg-parcial-suave px-2 py-1 text-[0.72rem] font-semibold text-parcial">
        3 transferencias por $ 1.310.000 sin conciliar
      </p>
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-2.5 py-1.5">
          <span className="flex items-center gap-2 text-[0.72rem] font-medium">
            <Casillero /> Seleccioná las que ya viste en el banco
          </span>
        </div>
        <div className="flex gap-2 bg-card px-2.5 py-2">
          <Casillero />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[0.8rem] font-medium">La Colorada</p>
            <p className="text-[0.72rem] text-muted-foreground tabular">
              Carpeta N° 58 · Recibo N° 1043 · 29/09 11:20
            </p>
            <p className="text-[0.72rem]">
              <span className="text-muted-foreground">Titular: </span>Rosa Benítez
            </p>
            <p className="flex items-center gap-1.5 text-[0.72rem] font-medium text-primary">
              <span className="grid size-6 place-items-center rounded border bg-muted text-muted-foreground">
                <FileText className="size-3.5" />
              </span>
              Ver comprobante
            </p>
            <div className="flex items-center justify-between gap-2">
              <Money monto={540000} className="text-[0.8rem] font-semibold" />
              <Resaltado>
                <BotonEjemplo variante="contorno" className="min-h-7 px-2.5">
                  <Check /> Conciliar
                </BotonEjemplo>
              </Resaltado>
            </div>
          </div>
        </div>
        <div className="flex gap-2 border-t px-2.5 py-2 opacity-70">
          <Casillero />
          <div className="min-w-0 flex-1">
            <p className="text-[0.8rem] font-medium">Pocho</p>
            <p className="text-[0.72rem] text-muted-foreground tabular">
              Carpeta N° 12 · Recibo N° 1047 · 29/09 16:05
            </p>
          </div>
          <Money monto={385000} className="text-[0.8rem] font-semibold" />
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-[0.72rem] text-muted-foreground">
        <CheckCheck className="size-3.5" /> Con varias marcadas: «Conciliar las seleccionadas».
      </p>
    </MarcoPantalla>
  );
}

/** Conciliar: facturas de gastos pagados para validar, y los pagados sin factura. */
export function PantallaFacturas() {
  return (
    <MarcoPantalla titulo="Tesorería · Conciliar">
      <TituloBloque titulo="Facturas de gastos pagados" detalle="Revisá la factura de cada gasto pagado y validala." />
      <div className="space-y-1.5 rounded-lg border bg-card px-2.5 py-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[0.8rem] font-medium">Seguro del galpón</p>
          <Money monto={185000} className="shrink-0 text-[0.8rem] font-semibold" />
        </div>
        <p className="flex flex-wrap items-center gap-1 text-[0.72rem] text-muted-foreground">
          <Codigo codigo="SEGUV" /> Seguros Varios · Tesorería · Banco · pagado el 29/09
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-[0.72rem] font-medium text-primary">
            <FileCheck2 className="size-3.5" /> Ver factura
          </span>
          <Resaltado>
            <BotonEjemplo className="min-h-7 px-2.5">
              <Stamp /> Validar comprobante
            </BotonEjemplo>
          </Resaltado>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-parcial/40 bg-parcial-suave/60">
        <div className="flex items-start gap-2 px-2.5 py-2">
          <FileWarning className="mt-0.5 size-4 shrink-0 text-parcial" />
          <div>
            <p className="text-[0.8rem] font-semibold">1 gasto pagado sin factura por $ 18.500</p>
            <p className="text-[0.72rem] text-muted-foreground">
              Pedile la factura a quien lo pagó: se adjunta desde Gastos y después la validás acá.
            </p>
          </div>
        </div>
        <div className="flex items-start justify-between gap-2 border-t bg-card px-2.5 py-1.5">
          <span className="min-w-0 text-[0.72rem]">
            <span className="block font-medium">Artículos de limpieza</span>
            <span className="flex flex-wrap items-center gap-1 text-muted-foreground">
              <Codigo codigo="GL" /> Gastos de Limpieza · Caja del 30/09
            </span>
          </span>
          <Money monto={18500} className="text-[0.72rem] font-semibold" />
        </div>
      </div>
    </MarcoPantalla>
  );
}

// ---------------------------------------------------------------------------------------
// Gastos
// ---------------------------------------------------------------------------------------

/** El mes con flechas y los totales (Por pagar en rojo, Pagado en verde). */
function ResumenMes() {
  return (
    <>
      <div className="flex items-center justify-center gap-2">
        <BotonEjemplo variante="contorno" className="size-8 px-0">
          <ChevronLeft />
        </BotonEjemplo>
        <p className="font-display text-[0.85rem] font-bold">Septiembre de 2026</p>
        <BotonEjemplo variante="contorno" className="size-8 px-0">
          <ChevronRight />
        </BotonEjemplo>
      </div>
      <div className="grid grid-cols-2 divide-x overflow-hidden rounded-lg border bg-card">
        <div className="px-2.5 py-1.5">
          <p className="text-[0.72rem] text-muted-foreground">Por pagar</p>
          <Money monto={249300} className="text-[0.95rem] font-bold text-pendiente" />
          <p className="text-[0.72rem] font-medium text-pendiente">1 vencido</p>
        </div>
        <div className="px-2.5 py-1.5">
          <p className="text-[0.72rem] text-muted-foreground">Pagado</p>
          <Money monto={1080000} className="text-[0.95rem] font-bold text-pagado" />
        </div>
      </div>
    </>
  );
}

/** Portada del capítulo "Gastos": el mes, los totales y lo que queda por pagar. */
export function PortadaGastos() {
  return (
    <MarcoPantalla titulo="Gastos">
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-[0.9rem] font-bold">Gastos</p>
        <BotonEjemplo>
          <Plus /> Cargar gasto
        </BotonEjemplo>
      </div>
      <ResumenMes />
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-display text-[0.8rem] font-bold">Por pagar</p>
        <p className="text-[0.72rem] text-muted-foreground">2 · $ 249.300</p>
      </div>
      <div className="divide-y overflow-hidden rounded-lg border bg-card">
        <FilaGastoEjemplo
          titulo="Seguro del galpón"
          codigo="SEGUV"
          rubro="Seguros Varios"
          detalle={
            <>
              Fijo · <span className="font-semibold text-pendiente">Venció 28/09</span>
            </>
          }
          monto={185000}
          vencido
          derecha={<BotonEjemplo className="min-h-7 px-3">Pagar</BotonEjemplo>}
        />
      </div>
    </MarcoPantalla>
  );
}

/** La ventana «Cargar gasto», completa. */
export function PantallaCargarGasto() {
  return (
    <MarcoPantalla titulo="Cargar gasto de Septiembre de 2026">
      <p className="text-[0.72rem] text-muted-foreground">
        Anotalo una sola vez. Si todavía no lo pagaste, lo pagás después desde la lista.
      </p>
      <div className="space-y-1">
        <p className="text-[0.72rem] font-medium text-muted-foreground">Rubro</p>
        <div className="flex min-h-8 items-center justify-between gap-2 rounded-md border bg-accent/40 px-2 text-[0.8rem] font-medium">
          <span className="flex items-center gap-1.5">
            <Codigo codigo="GL" /> Gastos de Limpieza
          </span>
          <span className="text-[0.72rem] text-muted-foreground">Cambiar</span>
        </div>
      </div>
      <div className="space-y-0.5">
        <CampoEjemplo etiqueta="Monto" valor={<span className="font-semibold tabular">18.500</span>} />
        <Money monto={18500} className="text-[0.72rem] font-semibold text-muted-foreground" />
      </div>
      <Pregunta texto="¿Se repite todos los meses?">
        <Opcion className="flex-1">Sí, es fijo</Opcion>
        <Opcion activo className="flex-1">
          No, es variable
        </Opcion>
      </Pregunta>
      <CampoEjemplo etiqueta="Descripción (opcional)" valor="Artículos de limpieza" />
      <div className="grid grid-cols-2 gap-2">
        <CampoEjemplo etiqueta="Vence (opcional)" valor={<span className="tabular">05/10/2026</span>} />
        <CampoEjemplo
          etiqueta="Factura (opcional)"
          valor={
            <span className="flex items-center gap-1 text-[0.72rem]">
              <Paperclip className="size-3.5" /> factura.jpg
            </span>
          }
        />
      </div>
      <div className="flex items-center justify-between rounded-lg border px-2.5 py-1.5">
        <span className="text-[0.8rem] font-medium">¿Ya lo pagaste?</span>
        <span className="flex h-4 w-7 items-center rounded-full bg-muted-foreground/30 p-0.5">
          <span className="size-3 rounded-full bg-white shadow-sm" />
        </span>
      </div>
      <Resaltado className="mb-2">
        <BotonEjemplo className="w-full">
          Cargar gasto de <Money monto={18500} />
        </BotonEjemplo>
      </Resaltado>
    </MarcoPantalla>
  );
}

/** Los fijos del mes, que se cargaron solos: el aviso y cómo quedan en «Por pagar». */
export function PantallaFijosSolos() {
  return (
    <MarcoPantalla titulo="Gastos · Octubre de 2026">
      <Resaltado>
        <div className="space-y-1 rounded-lg border bg-card px-2.5 py-2">
          <p className="flex items-center gap-1.5 font-display text-[0.8rem] font-bold">
            <CalendarClock className="size-3.5 text-primary" /> Fijos: se cargan solos
          </p>
          <p className="text-[0.72rem] text-muted-foreground">
            3 gastos fijos se cargaron solos en octubre: <strong className="text-foreground">$ 1.227.000</strong>.
          </p>
        </div>
      </Resaltado>
      <p className="pt-1 text-[0.72rem] font-medium text-muted-foreground">En «Por pagar», con su vencimiento:</p>
      {[
        { titulo: "Alquiler del Predio", codigo: "ALQ", vence: "10/10", monto: 850000 },
        { titulo: "Gastos de Internet", codigo: "GINT", vence: "15/10", monto: 42000 },
      ].map((f) => (
        <FilaEjemplo
          key={f.codigo}
          derecha={
            <span className="flex items-center gap-1.5">
              <Money monto={f.monto} className="text-[0.8rem] font-bold" />
              <BotonEjemplo className="min-h-7 px-2 text-[0.72rem]">Pagar</BotonEjemplo>
            </span>
          }
        >
          <p className="text-[0.8rem] font-semibold">{f.titulo}</p>
          <p className="flex items-center gap-1 text-[0.72rem] text-muted-foreground">
            <Codigo codigo={f.codigo} /> Fijo · se cargó solo · vence {f.vence}
          </p>
        </FilaEjemplo>
      ))}
    </MarcoPantalla>
  );
}

/** Los variables: cada rubro es un botón que abre «Cargar gasto» con el rubro elegido. */
export function PantallaVariables() {
  return (
    <MarcoPantalla titulo="Gastos · Octubre de 2026">
      <p className="flex items-center gap-1.5 font-display text-[0.8rem] font-bold">
        <Shuffle className="size-3.5 text-primary" /> Variables: cargalos cuando pasan
      </p>
      <div className="flex flex-wrap gap-1.5">
        <Resaltado mano={false} className="rounded-full">
          <span className="inline-flex min-h-7 items-center gap-1 rounded-full border bg-card px-2.5 text-[0.72rem] font-semibold">
            <Plus className="size-3 text-primary" /> Combustible <span className="font-medium text-muted-foreground">$ 45.000</span>
          </span>
        </Resaltado>
        {["Gastos de Limpieza", "Repuestos y Reparaciones", "Gastos Generales"].map((n) => (
          <span key={n} className="inline-flex min-h-7 items-center gap-1 rounded-full border bg-card px-2.5 text-[0.72rem] font-semibold">
            <Plus className="size-3 text-primary" /> {n}
          </span>
        ))}
      </div>
      <p className="pt-1 text-[0.72rem] font-medium text-muted-foreground">Al tocar «Combustible» se abre:</p>
      <div className="space-y-2 rounded-lg border bg-card p-2.5">
        <p className="font-display text-[0.8rem] font-bold">Cargar gasto de Octubre de 2026</p>
        <CampoEjemplo etiqueta="Rubro" valor={<span className="font-semibold">Combustible</span>} />
        <Resaltado>
          <CampoEjemplo etiqueta="Monto" valor={<span className="text-[0.95rem] font-semibold tabular">18.500</span>} />
        </Resaltado>
        <p className="text-[0.72rem] text-muted-foreground">«No, es variable» ya viene marcado.</p>
      </div>
    </MarcoPantalla>
  );
}

/** «¿De dónde sale la plata?»: las dos opciones grandes. */
function OrigenPlata({ caja }: { caja: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-[0.72rem] font-medium">¿De dónde sale la plata?</p>
      <div className="grid grid-cols-2 gap-1.5">
        <div
          className={cn(
            "space-y-0.5 rounded-lg border-2 px-2 py-1.5",
            caja ? "border-primary bg-accent" : "border-border bg-card"
          )}
        >
          <CajaRegistradora className="size-4 text-primary" strokeWidth={1.9} />
          <p className="text-[0.8rem] font-semibold">Caja del día</p>
          <p className="text-[0.72rem] leading-snug text-muted-foreground">Efectivo del cajón de Administración</p>
        </div>
        <div
          className={cn(
            "space-y-0.5 rounded-lg border-2 px-2 py-1.5",
            !caja ? "border-primary bg-accent" : "border-border bg-card"
          )}
        >
          <Landmark className="size-4 text-primary" strokeWidth={1.9} />
          <p className="text-[0.8rem] font-semibold">Tesorería</p>
          <p className="text-[0.72rem] leading-snug text-muted-foreground">Efectivo o banco</p>
        </div>
      </div>
    </div>
  );
}

/** «Pagar» desde la caja del día: elegís la caja y ves cuánto le queda. */
export function PantallaPagarCaja() {
  return (
    <MarcoPantalla titulo="Pagar Artículos de limpieza">
      <Money monto={18500} className="block text-[1rem] font-bold" />
      <OrigenPlata caja />
      <Pregunta texto="¿De qué día es la caja?">
        <Opcion activo className="flex-col items-start py-1">
          <span>Hoy · abierta</span>
          <span className="font-normal opacity-85">
            tiene <Money monto={412300} />
          </span>
        </Opcion>
        <Opcion className="flex-col items-start py-1">
          <span>Ayer 29/09 · cerrada</span>
          <span className="font-normal text-muted-foreground">
            tiene <Money monto={96000} />
          </span>
        </Opcion>
      </Pregunta>
      <p className="rounded-lg bg-muted/60 px-2.5 py-1.5 text-[0.72rem] tabular">
        Tiene $ 412.300 − este gasto $ 18.500 = <strong>queda $ 393.800</strong>
      </p>
      <div className="flex items-center gap-1.5 pb-2">
        <BotonEjemplo variante="contorno" className="shrink-0 px-2">
          No, volver
        </BotonEjemplo>
        <Resaltado className="min-w-0 flex-1">
          <BotonEjemplo className="w-full px-2 text-[0.72rem]">
            Pagar <Money monto={18500} /> con la caja de hoy
          </BotonEjemplo>
        </Resaltado>
      </div>
    </MarcoPantalla>
  );
}

/** «Pagar» desde Tesorería: efectivo o banco, y el día del pago. */
export function PantallaPagarTesoreria() {
  return (
    <MarcoPantalla titulo="Pagar Seguro del galpón">
      <Money monto={185000} className="block text-[1rem] font-bold" />
      <OrigenPlata caja={false} />
      <Pregunta texto="¿En efectivo o por banco?">
        <Opcion className="flex-1">Efectivo</Opcion>
        <Opcion activo className="flex-1">
          Banco
        </Opcion>
      </Pregunta>
      <Pregunta texto="¿Qué día se pagó?">
        <Opcion activo>Hoy</Opcion>
        <Opcion>Ayer</Opcion>
        <Opcion className="tabular">30/09/2026</Opcion>
      </Pregunta>
      <div className="flex items-center gap-1.5 pb-2">
        <BotonEjemplo variante="contorno" className="shrink-0 px-2">
          No, volver
        </BotonEjemplo>
        <Resaltado className="min-w-0 flex-1">
          <BotonEjemplo className="w-full px-2 text-[0.72rem]">
            Pagar <Money monto={185000} /> desde Tesorería (banco)
          </BotonEjemplo>
        </Resaltado>
      </div>
    </MarcoPantalla>
  );
}

/** Un gasto pagado sin factura, con «Adjuntar factura», y cómo cambia su sello. */
export function PantallaFacturaGasto() {
  return (
    <MarcoPantalla titulo="Gastos · Pagados">
      <div className="space-y-1 rounded-lg border bg-card px-2.5 py-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[0.8rem] font-semibold">Artículos de limpieza</p>
          <Money monto={18500} className="shrink-0 text-[0.8rem] font-bold" />
        </div>
        <p className="flex flex-wrap items-center gap-1 text-[0.72rem] text-muted-foreground">
          <Codigo codigo="GL" /> Gastos de Limpieza · Variable · Vencía 05/10
        </p>
        <p className="text-[0.72rem] text-muted-foreground">
          <span className="font-medium text-foreground">Caja del 30/09 · Efectivo</span> · pagado el 30/09 por Marta
        </p>
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <Sello estado="pendiente" texto="Sin factura" className="text-[0.72rem]" />
          <Resaltado>
            <BotonEjemplo variante="contorno" className="min-h-7 px-2">
              <Paperclip /> Adjuntar factura
            </BotonEjemplo>
          </Resaltado>
        </div>
        <div className="flex items-center justify-between gap-2 pt-2">
          <Sello estado="pagado" className="text-[0.72rem]" />
          <span className="flex items-center gap-1 text-[0.72rem] text-muted-foreground">
            <Undo2 className="size-3.5" /> Deshacer pago
          </span>
        </div>
      </div>
      <p className="pt-1 text-[0.72rem] font-medium text-muted-foreground">Así cambia el sello:</p>
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-start gap-1 text-center">
        <div className="space-y-1">
          <Sello estado="pendiente" texto="Sin factura" className="text-[0.72rem]" />
          <p className="text-[0.72rem] leading-snug text-muted-foreground">Falta la factura</p>
        </div>
        <ArrowRight className="mt-1 size-3.5 text-muted-foreground" />
        <div className="space-y-1">
          <Sello estado="parcial" texto="Sin validar" className="text-[0.72rem]" />
          <p className="text-[0.72rem] leading-snug text-muted-foreground">Tesorería la revisa</p>
        </div>
        <ArrowRight className="mt-1 size-3.5 text-muted-foreground" />
        <div className="space-y-1">
          <Sello estado="pagado" texto="Comprobante OK" className="text-[0.72rem]" />
          <p className="text-[0.72rem] leading-snug text-muted-foreground">Listo</p>
        </div>
      </div>
    </MarcoPantalla>
  );
}

/** Los filtros Todos · Fijos · Variables y los pagados, plegados. */
export function PantallaListaGastos() {
  return (
    <MarcoPantalla titulo="Gastos · Septiembre de 2026">
      <Resaltado className="w-fit">
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: "Todos", n: 8, activo: true },
            { label: "Fijos", n: 5, activo: false },
            { label: "Variables", n: 3, activo: false },
          ].map((c) => (
            <span
              key={c.label}
              className={cn(
                "inline-flex min-h-7 items-center gap-1 rounded-full border px-2.5 text-[0.72rem] font-medium",
                c.activo ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
              )}
            >
              {c.label}
              <span className="font-semibold tabular opacity-80">{c.n}</span>
            </span>
          ))}
        </div>
      </Resaltado>
      <div className="flex items-baseline justify-between gap-2 pt-1">
        <p className="font-display text-[0.8rem] font-bold">Por pagar</p>
        <p className="text-[0.72rem] text-muted-foreground">2 · $ 249.300</p>
      </div>
      <div className="divide-y overflow-hidden rounded-lg border bg-card">
        <FilaGastoEjemplo
          titulo="Seguro del galpón"
          codigo="SEGUV"
          rubro="Seguros Varios"
          detalle={
            <>
              Fijo · <span className="font-semibold text-pendiente">Venció 28/09</span>
            </>
          }
          monto={185000}
          vencido
          derecha={<BotonEjemplo className="min-h-7 px-3">Pagar</BotonEjemplo>}
        />
      </div>
      <div className="flex items-center justify-between gap-2 pt-1">
        <p className="flex items-baseline gap-2">
          <span className="font-display text-[0.8rem] font-bold">Pagados</span>
          <span className="text-[0.72rem] text-muted-foreground">6 · $ 1.080.000</span>
        </p>
        <BotonEjemplo variante="contorno" className="min-h-7 px-2 text-[0.72rem]">
          <ChevronDown /> Ver los 6 pagados
        </BotonEjemplo>
      </div>
    </MarcoPantalla>
  );
}

/** El camino de un gasto, de la carga al «Comprobante OK». */
export function PantallaCaminoGasto() {
  const pasos: { n: number; titulo: string; detalle: string; sello?: React.ReactNode; icono: React.ReactNode }[] = [
    { n: 1, titulo: "Cargar gasto", detalle: "Se anota una sola vez, con su rubro y su monto.", icono: <Plus className="size-3.5" /> },
    {
      n: 2,
      titulo: "Pagar",
      detalle: "Los chicos, con la caja del día. Los grandes, Tesorería.",
      icono: <Banknote className="size-3.5" />,
    },
    {
      n: 3,
      titulo: "Adjuntar factura",
      detalle: "La foto o el PDF del comprobante.",
      sello: <Sello estado="parcial" texto="Sin validar" className="text-[0.72rem]" />,
      icono: <Paperclip className="size-3.5" />,
    },
    {
      n: 4,
      titulo: "Validar comprobante",
      detalle: "Tesorería la revisa y le da el OK.",
      sello: <Sello estado="pagado" texto="Comprobante OK" className="text-[0.72rem]" />,
      icono: <Stamp className="size-3.5" />,
    },
  ];
  return (
    <MarcoPantalla titulo="El camino de un gasto">
      <ol className="space-y-1.5">
        {pasos.map((p) => (
          <li key={p.n} className="flex items-start gap-2 rounded-lg border bg-card px-2.5 py-1.5">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
              {p.icono}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.8rem] font-semibold">
                {p.n}. {p.titulo}
              </p>
              <p className="text-[0.72rem] text-muted-foreground">{p.detalle}</p>
            </div>
            {p.sello ? <div className="shrink-0 pt-0.5">{p.sello}</div> : null}
          </li>
        ))}
      </ol>
    </MarcoPantalla>
  );
}
