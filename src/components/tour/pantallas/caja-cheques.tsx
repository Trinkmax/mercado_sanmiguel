import {
  ArrowDown,
  ArrowDownToLine,
  ArrowRight,
  Ban,
  Banknote,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  Footprints,
  HandCoins,
  History,
  Landmark,
  Lock,
  LockOpen,
  Minus,
  Plus,
  Printer,
  ReceiptText,
  ScrollText,
  Smartphone,
  Stamp,
  Tractor,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatARS } from "@/lib/format";
import { Codigo } from "@/components/shared/codigo";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { BotonEjemplo, CampoEjemplo, FilaEjemplo, MarcoPantalla, Resaltado } from "@/components/tour/pantalla";

// Tour guiado · caja-cheques: pantallas de ejemplo (dibujos quietos, datos inventados).
// Las cuentas cierran: Portería junta $ 220.000 (en mano $ 184.000); Administración junta
// $ 2.820.000, paga $ 45.000 de gastos y tiene que tener $ 2.775.000.

// ---------------------------------------------------------------------------
// Piezas de esta área
// ---------------------------------------------------------------------------

/** Una ventana (diálogo) abierta sobre la pantalla oscurecida. */
function Ventana({
  titulo,
  descripcion,
  children,
  pie,
}: {
  titulo: string;
  descripcion?: React.ReactNode;
  children?: React.ReactNode;
  pie?: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5 rounded-lg border border-border bg-card p-3 shadow-[0_10px_28px_-14px_rgb(15_23_60/0.55)]">
      <div className="space-y-0.5">
        <p className="font-display text-[0.88rem] leading-tight font-bold">{titulo}</p>
        {descripcion ? <p className="text-[0.72rem] text-muted-foreground">{descripcion}</p> : null}
      </div>
      {children}
      {pie ? <div className="flex flex-wrap justify-end gap-1.5 pt-0.5">{pie}</div> : null}
    </div>
  );
}

/** Fondo oscurecido detrás de una ventana. */
const FONDO_VENTANA = "bg-foreground/15 p-2.5";

/** Micro-etiqueta en mayúsculas, como las de la banda del arqueo. */
function Etiqueta({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-[0.72rem] font-semibold tracking-wider text-muted-foreground uppercase", className)}>
      {children}
    </p>
  );
}

/** Renglón de la cuenta del arqueo: signo en el margen, etiqueta y monto. */
function RenglonCuenta({
  signo,
  etiqueta,
  monto,
  apagado = false,
  fuerte = false,
}: {
  signo: "" | "−" | "±" | "=";
  etiqueta: string;
  monto: React.ReactNode;
  apagado?: boolean;
  fuerte?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[0.9rem_minmax(0,1fr)_auto] items-baseline gap-x-1.5 py-1",
        apagado && "opacity-60",
        fuerte && "mt-0.5 border-t-4 border-double border-foreground/60 pt-1.5"
      )}
    >
      <span className="text-center font-display text-[0.85rem] leading-none font-bold text-muted-foreground">
        {signo}
      </span>
      <span className="text-[0.72rem] font-semibold tracking-wider text-muted-foreground uppercase">{etiqueta}</span>
      <span className={cn("text-right", fuerte ? "text-[0.9rem] font-bold" : "text-[0.8rem] font-semibold")}>
        {monto}
      </span>
    </div>
  );
}

/** "En el cajón / En el banco / Cheques": lo que tiene que haber, por medio. */
function TenesQueTener({
  efectivo,
  banco,
  cheques,
}: {
  efectivo: number;
  banco: number;
  cheques?: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-1">
      <div className="col-span-2">
        <p className="text-[0.72rem] text-muted-foreground">En el cajón (efectivo)</p>
        <Money monto={efectivo} className="block text-[1.05rem] font-bold" />
      </div>
      <div>
        <p className="text-[0.72rem] text-muted-foreground">En el banco</p>
        <Money monto={banco} className="block text-[0.85rem] font-semibold" />
      </div>
      {cheques !== undefined ? (
        <div>
          <p className="text-[0.72rem] text-muted-foreground">Cheques en cartera</p>
          <Money monto={cheques} className="block text-[0.85rem] font-semibold" />
        </div>
      ) : null}
    </div>
  );
}

/** "Quintas $ 126.000" con su ícono, como pieza del desglose de Portería. */
function Pieza({
  icono: Icono,
  etiqueta,
  monto,
}: {
  icono?: typeof Tractor;
  etiqueta: string;
  monto: number;
}) {
  return (
    <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
      {Icono ? <Icono className="size-3 shrink-0 translate-y-0.5 text-muted-foreground" strokeWidth={2} /> : null}
      <span className="text-muted-foreground">{etiqueta}</span>
      <Money monto={monto} className="font-semibold" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Caja: lo juntado (caja abierta)
// ---------------------------------------------------------------------------

/** Banda "Juntado hoy — en vivo" de la caja de Administración. */
function BandaAdministracion({ resaltar = false }: { resaltar?: boolean }) {
  const banda = (
    <div className="overflow-hidden rounded-lg border-2 border-foreground/70 bg-card">
      <div className="flex items-baseline justify-between gap-2 border-b border-dashed border-foreground/30 px-2.5 py-1">
        <Etiqueta>Juntado hoy — en vivo</Etiqueta>
        <p className="text-[0.72rem] text-muted-foreground">
          Total <Money monto={2820000} className="font-bold text-foreground" />
        </p>
      </div>
      <div className="grid grid-cols-2">
        <div className="col-span-2 border-b border-dashed border-foreground/30 px-2.5 py-1.5">
          <Etiqueta>Efectivo</Etiqueta>
          <Money monto={1254000} className="block text-[1.1rem] font-bold" />
        </div>
        <div className="border-r border-dashed border-foreground/30 px-2.5 py-1.5">
          <Etiqueta>Transferencias</Etiqueta>
          <Money monto={1116000} className="block text-[0.85rem] font-semibold" />
        </div>
        <div className="px-2.5 py-1.5">
          <Etiqueta>Cheques</Etiqueta>
          <Money monto={450000} className="block text-[0.85rem] font-semibold" />
        </div>
      </div>
      <div className="space-y-0.5 border-t border-dashed border-foreground/30 px-2.5 py-1.5 text-[0.72rem]">
        <p className="font-medium">
          Caja de portería <Money monto={220000} className="font-bold" />
        </p>
        <p className="flex flex-wrap gap-x-2.5 gap-y-0.5">
          <Pieza icono={Tractor} etiqueta="Quintas" monto={126000} />
          <Pieza icono={Footprints} etiqueta="Ambulantes" monto={30000} />
          <Pieza icono={Truck} etiqueta="Bono camioneros" monto={64000} />
        </p>
      </div>
    </div>
  );
  return resaltar ? <Resaltado>{banda}</Resaltado> : banda;
}

/** Banda "Juntado hoy — en vivo" de la caja de portería. */
function BandaPorteria({ resaltar = false }: { resaltar?: boolean }) {
  const banda = (
    <div className="overflow-hidden rounded-lg border-2 border-foreground/70 bg-card">
      <div className="flex items-baseline justify-between gap-2 border-b border-dashed border-foreground/30 px-2.5 py-1">
        <Etiqueta>Juntado hoy — en vivo</Etiqueta>
        <p className="text-[0.72rem] text-muted-foreground">
          Total <Money monto={220000} className="font-bold text-foreground" />
        </p>
      </div>
      <div className="grid grid-cols-2">
        <div className="border-r border-dashed border-foreground/30 px-2.5 py-1.5">
          <Etiqueta>Efectivo</Etiqueta>
          <Money monto={184000} className="block text-[1.1rem] font-bold" />
        </div>
        <div className="px-2.5 py-1.5">
          <Etiqueta>Transferencias</Etiqueta>
          <Money monto={36000} className="block text-[0.85rem] font-semibold" />
        </div>
      </div>
      <p className="flex flex-wrap gap-x-2.5 gap-y-0.5 border-t border-dashed border-foreground/30 px-2.5 py-1.5 text-[0.72rem]">
        <Pieza icono={Tractor} etiqueta="Quintas (tus cobros)" monto={126000} />
        <Pieza icono={Footprints} etiqueta="Ambulantes" monto={30000} />
        <Pieza icono={Truck} etiqueta="Bono camioneros (Portería)" monto={64000} />
      </p>
    </div>
  );
  return resaltar ? <Resaltado>{banda}</Resaltado> : banda;
}

/** La tarjeta "¿Terminaste el día?" con su botón. */
function TarjetaTerminaste({ porteria = false, resaltar = false }: { porteria?: boolean; resaltar?: boolean }) {
  const boton = (
    <BotonEjemplo>
      {porteria ? <HandCoins /> : <Lock />}
      {porteria ? "Rendir caja" : "Cerrar caja"}
    </BotonEjemplo>
  );
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-2.5 py-2">
      <div className="min-w-0">
        <p className="text-[0.8rem] font-semibold">¿Terminaste el día?</p>
        <p className="text-[0.72rem] text-muted-foreground">
          {porteria ? "Rendí la caja y te dice cuánto entregar." : "Cerrá la caja y te dice cuánto tenés que tener."}
        </p>
      </div>
      {resaltar ? <Resaltado className="shrink-0">{boton}</Resaltado> : boton}
    </div>
  );
}

/** Portada del capítulo "Caja": la caja del día abierta, con lo juntado y el cierre. */
export function PortadaCaja() {
  return (
    <MarcoPantalla titulo="Caja del día">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="font-display text-[0.9rem] font-bold">Caja del día</p>
          <p className="text-[0.72rem] text-muted-foreground">Miércoles, 30 de septiembre</p>
        </div>
        <Sello estado="abierta" />
      </div>
      <BandaAdministracion />
      <TarjetaTerminaste resaltar />
    </MarcoPantalla>
  );
}

/** La caja de Administración abierta: lo juntado en vivo. */
export function PantallaJuntado() {
  return (
    <MarcoPantalla titulo="Caja del día">
      <BandaAdministracion resaltar />
    </MarcoPantalla>
  );
}

/** La caja de portería abierta: lo juntado en vivo, con quintas, ambulantes y bono camioneros. */
export function PantallaJuntadoPorteria() {
  return (
    <MarcoPantalla titulo="Caja de portería">
      <BandaPorteria resaltar />
    </MarcoPantalla>
  );
}

// ---------------------------------------------------------------------------
// Caja: cobros y bono camioneros
// ---------------------------------------------------------------------------

type CobroEjemplo = {
  hora: string;
  nombre: string;
  carpeta: string;
  medio: "Efectivo" | "Transferencia" | "Cheque";
  detalle?: string;
  monto: number;
  recibo: string;
  sello?: "quintero" | "ambulante";
};

const ICONO_MEDIO = { Efectivo: Banknote, Transferencia: Smartphone, Cheque: ScrollText } as const;

function ListaCobros({ titulo, cobros, total }: { titulo: string; cobros: CobroEjemplo[]; total: number }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-baseline justify-between gap-2 px-2.5 pt-2 pb-1">
        <p className="font-display text-[0.8rem] font-bold">{titulo}</p>
        <p className="text-[0.72rem] text-muted-foreground">
          {cobros.length} recibos · <Money monto={total} className="font-semibold text-foreground" />
        </p>
      </div>
      <div className="divide-y divide-border">
        {cobros.map((c, i) => {
          const Icono = ICONO_MEDIO[c.medio];
          const acciones = (
            <span className="flex items-center gap-1">
              <span className="inline-flex items-center gap-0.5 text-[0.72rem] font-medium text-primary">
                <ReceiptText className="size-3" /> Ver recibo
              </span>
              <span className="inline-flex items-center gap-0.5 rounded border border-border px-1 text-[0.72rem] font-semibold text-destructive">
                <Ban className="size-3" /> Anular
              </span>
            </span>
          );
          return (
            <div key={c.recibo} className="flex items-start gap-2 px-2.5 py-1.5">
              <span className="w-8 shrink-0 pt-px text-[0.72rem] text-muted-foreground tabular">{c.hora}</span>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="flex flex-wrap items-center gap-1">
                  <span className="text-[0.8rem] font-semibold">{c.nombre}</span>
                  <span className="text-[0.72rem] text-muted-foreground">{c.carpeta}</span>
                  {c.sello ? <Sello estado={c.sello} className="scale-90" /> : null}
                </p>
                <p className="flex items-center gap-1 text-[0.72rem]">
                  <Icono className="size-3 shrink-0 text-muted-foreground" />
                  {c.medio} <Money monto={c.monto} className="font-medium" />
                  {c.detalle ? <span className="truncate text-muted-foreground">{c.detalle}</span> : null}
                </p>
                {i === 0 ? <Resaltado className="w-fit rounded-md">{acciones}</Resaltado> : acciones}
              </div>
              <div className="shrink-0 text-right">
                <Money monto={c.monto} className="block text-[0.85rem] font-bold" />
                <span className="text-[0.72rem] text-muted-foreground">N° {c.recibo}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Los cobros del día de Administración, cada uno con su recibo. */
export function PantallaCobrosDia() {
  return (
    <MarcoPantalla titulo="Caja del día">
      <ListaCobros
        titulo="Cobros del día"
        total={2070000}
        cobros={[
          { hora: "09:12", nombre: "Pocho", carpeta: "Carpeta 58", medio: "Efectivo", monto: 540000, recibo: "4812" },
          {
            hora: "10:40",
            nombre: "La Colorada",
            carpeta: "Carpeta 9",
            medio: "Transferencia",
            detalle: "de Frutas La Colorada",
            monto: 1080000,
            recibo: "4813",
          },
          {
            hora: "11:05",
            nombre: "Doña Rosa",
            carpeta: "Carpeta 112",
            medio: "Cheque",
            detalle: "N° 00384512",
            monto: 450000,
            recibo: "4814",
          },
        ]}
      />
    </MarcoPantalla>
  );
}

/** Los cobros a quinteros y ambulantes de la caja de portería. */
export function PantallaCobrosPorteria() {
  return (
    <MarcoPantalla titulo="Caja de portería">
      <ListaCobros
        titulo="Cobros a quinteros y ambulantes"
        total={42000}
        cobros={[
          { hora: "06:20", nombre: "Don Ramón", carpeta: "Carpeta 912", medio: "Efectivo", monto: 18000, recibo: "4790", sello: "quintero" },
          {
            hora: "06:45",
            nombre: "Los Vera",
            carpeta: "Carpeta 931",
            medio: "Transferencia",
            monto: 18000,
            recibo: "4791",
            sello: "quintero",
          },
          { hora: "07:10", nombre: "Chiquito Acosta", carpeta: "Carpeta 954", medio: "Efectivo", monto: 6000, recibo: "4792", sello: "ambulante" },
        ]}
      />
    </MarcoPantalla>
  );
}

/** El bono camioneros de la garita, dentro de la caja de portería. */
export function PantallaCanon() {
  const filas = [
    { hora: "05:40", n: "31", texto: "Camión grande", patente: "AB 123 CD", medio: "Efectivo", monto: 12000 },
    { hora: "05:52", n: "32", texto: "Camioneta", patente: "AC 874 KL", medio: "Transferencia", monto: 6000 },
    { hora: "06:05", n: "33", texto: "Camión chico", patente: "OPR 512", medio: "Efectivo", monto: 8000 },
  ];
  return (
    <MarcoPantalla titulo="Caja de portería">
      <div className="flex items-baseline justify-between gap-2">
        <p className="flex items-center gap-1 font-display text-[0.8rem] font-bold">
          <Truck className="size-3.5 text-muted-foreground" /> Bono camioneros
        </p>
        <p className="text-[0.72rem] text-muted-foreground">Lo cobra Portería en la garita.</p>
      </div>
      <Resaltado>
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          {filas.map((f) => (
            <div key={f.n} className="flex items-center gap-2 px-2.5 py-1.5">
              <div className="w-9 shrink-0">
                <p className="font-display text-[0.8rem] leading-tight font-bold tabular">{f.hora}</p>
                <p className="text-[0.72rem] text-muted-foreground">N° {f.n}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 text-[0.8rem] font-semibold">
                  <Truck className="size-3 text-muted-foreground" /> {f.texto}
                </p>
                <p className="text-[0.72rem] text-muted-foreground">
                  <span className="font-semibold tracking-wider text-foreground/80">{f.patente}</span> · {f.medio}
                </p>
              </div>
              <Money monto={f.monto} className="text-[0.85rem] font-bold" />
            </div>
          ))}
        </div>
      </Resaltado>
    </MarcoPantalla>
  );
}

// ---------------------------------------------------------------------------
// Caja: rendir (Portería) y cerrar (Administración)
// ---------------------------------------------------------------------------

/** La ventana de «Rendir caja» antes de confirmar: cuánto efectivo se entrega. */
export function PantallaRendir() {
  return (
    <MarcoPantalla titulo="Caja de portería" contenidoClassName={FONDO_VENTANA}>
      <Ventana
        titulo="Rendir la caja a Administración"
        descripcion="Vas a rendir con lo cargado hasta ahora:"
        pie={
          <>
            <BotonEjemplo variante="contorno">Todavía no</BotonEjemplo>
            <Resaltado>
              <BotonEjemplo>
                <HandCoins /> Rendir caja
              </BotonEjemplo>
            </Resaltado>
          </>
        }
      >
        <div className="rounded-md border border-border px-2.5 py-2">
          <p className="text-[0.8rem]">
            Entregás <Money monto={184000} className="text-[1.05rem] font-bold" /> en efectivo
          </p>
          <p className="text-[0.72rem] text-muted-foreground">
            Quintas {formatARS(126000)} · Ambulantes {formatARS(30000)} · Bono camioneros {formatARS(64000)} ·{" "}
            {formatARS(36000)} por transferencia
          </p>
        </div>
        <p className="text-[0.72rem] text-muted-foreground">
          Después de rendir, Portería no puede cobrar más canon hoy; si hubo un error pedí la reapertura.
        </p>
      </Ventana>
    </MarcoPantalla>
  );
}

/** Cómo queda al rendir: cuánto entregar en Administración y el papel para imprimir. */
export function PantallaRendida() {
  return (
    <MarcoPantalla titulo="Caja de portería" contenidoClassName={FONDO_VENTANA}>
      <Ventana
        titulo="Caja de portería rendida"
        descripcion="Llevá el efectivo a Administración. Cuando lo reciban, entra en la caja mayor."
        pie={
          <>
            <BotonEjemplo variante="contorno">Listo</BotonEjemplo>
            <Resaltado>
              <BotonEjemplo>
                <Printer /> Imprimir cierre
              </BotonEjemplo>
            </Resaltado>
          </>
        }
      >
        <div className="space-y-1 rounded-md bg-muted/60 px-2.5 py-2 text-center">
          <Sello grande estado="cerrada" texto="Rendida" />
          <p className="text-[0.8rem]">Entregá en Administración</p>
          <Money monto={184000} className="block text-[1.2rem] font-bold" />
          <p className="text-[0.72rem] text-muted-foreground">en efectivo (+{formatARS(36000)} ya están en el banco)</p>
        </div>
      </Ventana>
    </MarcoPantalla>
  );
}

/** La ventana de «Cerrar caja»: la cuenta antes de confirmar. */
export function PantallaCerrar() {
  return (
    <MarcoPantalla titulo="Caja del día" contenidoClassName={FONDO_VENTANA}>
      <Ventana
        titulo="Cerrar la caja"
        descripcion="Vas a cerrar con esta cuenta (lo cargado hasta ahora):"
        pie={
          <>
            <BotonEjemplo variante="contorno">Todavía no</BotonEjemplo>
            <Resaltado>
              <BotonEjemplo>
                <Lock /> Cerrar caja
              </BotonEjemplo>
            </Resaltado>
          </>
        }
      >
        <div className="rounded-md border border-border px-2 py-1">
          <RenglonCuenta signo="" etiqueta="Juntaste" monto={<Money monto={2820000} />} />
          <RenglonCuenta signo="−" etiqueta="Gastos pagados desde esta caja" monto={<Money monto={45000} className="text-pendiente" />} />
          <RenglonCuenta signo="±" etiqueta="Ajustes de tesorería" monto={<Money monto={0} />} apagado />
          <RenglonCuenta signo="=" etiqueta="Tenés que tener" monto={<Money monto={2775000} />} fuerte />
          <TenesQueTener efectivo={1209000} banco={1116000} cheques={450000} />
        </div>
        <p className="text-[0.72rem] text-muted-foreground">
          Después de cerrar no se cargan más cobros. Si te olvidaste de algo, se reabre mientras Tesorería no la valide.
        </p>
      </Ventana>
    </MarcoPantalla>
  );
}

/** El arqueo de una caja ya cerrada, como lo ve Tesorería en «Cajas del día». */
export function PantallaArqueo() {
  return (
    <MarcoPantalla titulo="Cajas del día">
      <div className="space-y-2 rounded-lg border-2 border-double border-foreground/60 bg-card p-2.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-display text-[0.88rem] font-bold">Arqueo — 29/09</p>
            <p className="text-[0.72rem] text-muted-foreground">Cerrada el 29/09 18:40 por Susana</p>
          </div>
          <Sello grande estado="cerrada" />
        </div>
        <Resaltado>
          <div className="rounded-md px-1">
            <RenglonCuenta signo="" etiqueta="Juntaste" monto={<Money monto={2820000} />} />
            <RenglonCuenta signo="−" etiqueta="Gastos pagados desde esta caja" monto={<Money monto={45000} className="text-pendiente" />} />
            <RenglonCuenta signo="±" etiqueta="Ajustes de tesorería" monto={<Money monto={0} />} apagado />
            <RenglonCuenta signo="=" etiqueta="Tenés que tener" monto={<Money monto={2775000} />} fuerte />
            <TenesQueTener efectivo={1209000} banco={1116000} cheques={450000} />
          </div>
        </Resaltado>
      </div>
    </MarcoPantalla>
  );
}

/** Hoja impresa del cierre: la cuenta, el recuadro para contar a mano y las firmas. */
export function PantallaCierreImpreso() {
  return (
    <MarcoPantalla titulo="Imprimir cierre" contenidoClassName="bg-muted/50 p-2.5">
      <div className="space-y-2 rounded-sm border border-border bg-white p-2.5 text-foreground shadow-sm">
        <div className="flex items-start justify-between gap-2 border-b-2 border-foreground pb-1.5">
          <div>
            <p className="font-display text-[0.8rem] font-semibold tracking-wide uppercase">Cierre de caja — Administración</p>
            <p className="text-[0.72rem]">Martes, 29 de septiembre de 2026</p>
          </div>
          <Sello estado="cerrada" />
        </div>
        <div>
          <p className="border-b border-foreground/40 font-display text-[0.72rem] font-bold tracking-wider uppercase">La cuenta</p>
          <RenglonCuenta signo="" etiqueta="Juntaste" monto={<Money monto={2820000} />} />
          <RenglonCuenta signo="−" etiqueta="Gastos" monto={<Money monto={45000} />} />
          <RenglonCuenta signo="=" etiqueta="Tiene que haber" monto={<Money monto={2775000} />} fuerte />
        </div>
        <Resaltado>
          <div className="space-y-1.5 rounded-md border-2 border-foreground p-2">
            <p className="text-[0.72rem] text-muted-foreground">
              Para completar a mano: lo cuenta Tesorería. Tiene que haber <Money monto={1209000} className="font-semibold text-foreground" /> en efectivo.
            </p>
            <p className="flex items-end gap-1.5 text-[0.72rem] font-semibold">
              Efectivo contado $ <span className="mb-0.5 flex-1 border-b border-foreground" />
            </p>
          </div>
        </Resaltado>
        <div className="grid grid-cols-2 gap-4 pt-3 text-center text-[0.72rem]">
          <p className="border-t border-foreground pt-0.5">Entregó</p>
          <p className="border-t border-foreground pt-0.5">Recibió</p>
        </div>
      </div>
    </MarcoPantalla>
  );
}

// ---------------------------------------------------------------------------
// Caja: reapertura
// ---------------------------------------------------------------------------

/** La ventana de «Pedir reapertura» del Jefe de Portería. */
export function PantallaPedirReapertura() {
  return (
    <MarcoPantalla titulo="Caja de portería" contenidoClassName={FONDO_VENTANA}>
      <Ventana
        titulo="Pedir la reapertura de la caja"
        descripcion="Administración va a ver tu pedido y, si lo autoriza, la caja vuelve a quedar abierta para corregir lo que haga falta."
        pie={
          <>
            <BotonEjemplo variante="contorno">Volver</BotonEjemplo>
            <Resaltado>
              <BotonEjemplo>
                <LockOpen /> Enviar pedido
              </BotonEjemplo>
            </Resaltado>
          </>
        }
      >
        <CampoEjemplo etiqueta="¿Qué pasó?" valor="Le cobré dos veces a Don Ramón" />
      </Ventana>
    </MarcoPantalla>
  );
}

/** El pedido de reapertura como le llega a Administración (y a Tesorería). */
export function PantallaPedidosReapertura() {
  return (
    <MarcoPantalla titulo="Caja del día">
      <div className="space-y-2 rounded-lg border border-parcial/60 bg-card p-2.5">
        <p className="flex items-center gap-1.5 font-display text-[0.85rem] font-bold">
          <LockOpen className="size-3.5 text-parcial" /> Pedidos de reapertura
        </p>
        <p className="text-[0.72rem] text-muted-foreground">
          Una caja ya cerrada necesita corregirse. Autorizala o rechazá el pedido.
        </p>
        <div className="space-y-1 border-t border-border pt-2">
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="font-display text-[0.8rem] font-bold text-primary">Caja de portería — 29/09</span>
            <Sello estado="cerrada" />
          </p>
          <p className="text-[0.8rem]">«Le cobré dos veces a Don Ramón»</p>
          <p className="text-[0.72rem] text-muted-foreground">Pedido el 29/09 19:05 por Rubén</p>
          <div className="flex justify-end gap-1.5 pt-1">
            <BotonEjemplo variante="contorno">
              <Ban /> Rechazar
            </BotonEjemplo>
            <Resaltado>
              <BotonEjemplo>
                <LockOpen /> Autorizar y reabrir
              </BotonEjemplo>
            </Resaltado>
          </div>
        </div>
      </div>
    </MarcoPantalla>
  );
}

// ---------------------------------------------------------------------------
// Caja: recibir la caja de portería (Administración)
// ---------------------------------------------------------------------------

/** La ventana de «Recibir e integrar»: contar lo que entrega el Jefe de Portería. */
export function PantallaRecibir() {
  return (
    <MarcoPantalla titulo="Caja del día" contenidoClassName={FONDO_VENTANA}>
      <Ventana
        titulo="Recibir la caja de portería del 30/09"
        descripcion="Contá el efectivo que te entrega el Jefe de Portería y confirmá. Entra en tu caja de hoy."
        pie={
          <>
            <BotonEjemplo variante="contorno">Todavía no</BotonEjemplo>
            <Resaltado>
              <BotonEjemplo>
                <ArrowDownToLine /> Recibí {formatARS(184000)}
              </BotonEjemplo>
            </Resaltado>
          </>
        }
      >
        <div className="divide-y divide-border rounded-md border border-border">
          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
            <span className="text-[0.8rem] font-medium">Tiene que entregarte (en mano)</span>
            <Money monto={184000} className="text-[1rem] font-bold" />
          </div>
          <div className="flex items-center justify-between gap-2 px-2.5 py-1 text-[0.72rem]">
            <span className="text-muted-foreground">Por transferencia (ya en el banco)</span>
            <Money monto={36000} className="font-semibold" />
          </div>
        </div>
        <CampoEjemplo etiqueta="¿Cuánto efectivo te entregó?" valor={<span className="text-[0.95rem] font-semibold tabular">184.000</span>} />
        <p className="flex items-center gap-1 text-[0.72rem] font-medium text-pagado">
          <Check className="size-3.5" strokeWidth={2.5} /> Coincide con lo que rindió.
        </p>
      </Ventana>
    </MarcoPantalla>
  );
}

// ---------------------------------------------------------------------------
// Caja: gastos, últimos días, historial
// ---------------------------------------------------------------------------

/** "Gastos pagados desde esta caja": se restan del efectivo. */
export function PantallaGastosCaja() {
  return (
    <MarcoPantalla titulo="Caja del día">
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-baseline justify-between gap-2 px-2.5 pt-2 pb-1">
          <p className="font-display text-[0.8rem] font-bold">Gastos pagados desde esta caja</p>
          <span className="text-[0.85rem] font-bold text-pendiente tabular">
            − <Money monto={45000} />
          </span>
        </div>
        <div className="divide-y divide-border">
          <div className="flex items-start gap-2 px-2.5 py-1.5">
            <Codigo codigo="GL" className="scale-90" />
            <div className="min-w-0 flex-1">
              <p className="text-[0.8rem] font-medium">Lavandina y trapos de piso</p>
              <p className="text-[0.72rem] text-muted-foreground">Pagó Susana · 30/09 10:15</p>
            </div>
            <Money monto={28000} className="text-[0.8rem] font-semibold" />
          </div>
          <div className="flex items-start gap-2 px-2.5 py-1.5">
            <Codigo codigo="COMB" className="scale-90" />
            <div className="min-w-0 flex-1">
              <p className="text-[0.8rem] font-medium">Nafta para el tractor</p>
              <p className="text-[0.72rem] text-muted-foreground">Pagó Susana · 30/09 12:30</p>
            </div>
            <Money monto={17000} className="text-[0.8rem] font-semibold" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border px-2.5 py-1.5">
          <p className="text-[0.72rem] text-muted-foreground">Se restan del efectivo que tenés que tener.</p>
          <Resaltado className="shrink-0">
            <span className="inline-flex items-center gap-0.5 px-1 text-[0.72rem] font-medium text-primary">
              <Plus className="size-3" /> Pagar un gasto desde esta caja
            </span>
          </Resaltado>
        </div>
      </div>
    </MarcoPantalla>
  );
}

/** "Últimos días": cada caja anterior con su sello; tocando la fecha se abre. */
export function PantallaUltimosDias() {
  const dias = [
    { fecha: "29/09", efectivo: 1209000, estado: "cerrada" },
    { fecha: "28/09", efectivo: 986500, estado: "validada" },
    { fecha: "27/09", efectivo: 1102000, estado: "validada" },
  ];
  return (
    <MarcoPantalla titulo="Cajas del día">
      <div className="rounded-lg border border-border bg-card p-2.5">
        <p className="pb-1 font-display text-[0.8rem] font-bold">Últimos días</p>
        <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-2.5 gap-y-1.5 text-[0.72rem]">
          <span className="text-muted-foreground">Fecha</span>
          <span className="text-right text-muted-foreground">Efectivo</span>
          <span className="text-right text-muted-foreground">Estado</span>
          <span />
          {dias.map((d, i) => (
            <div key={d.fecha} className="contents">
              {i === 0 ? (
                <Resaltado className="rounded-sm">
                  <span className="px-0.5 text-[0.8rem] font-medium text-primary underline">{d.fecha}</span>
                </Resaltado>
              ) : (
                <span className="text-[0.8rem] font-medium text-primary">{d.fecha}</span>
              )}
              <Money monto={d.efectivo} className="text-right text-[0.8rem]" />
              <span className="text-right">
                <Sello estado={d.estado} />
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Printer className="size-3.5" />
                <ChevronRight className="size-3.5" />
              </span>
            </div>
          ))}
        </div>
      </div>
    </MarcoPantalla>
  );
}

/** "Historial de la caja": quién hizo qué y cuándo. */
export function PantallaHistorial() {
  const eventos = [
    { cuando: "29/09 07:02", que: "Apertura", quien: "Susana" },
    { cuando: "29/09 17:30", que: "Recibe la caja de portería", quien: "Susana" },
    { cuando: "29/09 18:40", que: "Cierre", quien: "Susana" },
    { cuando: "30/09 09:15", que: "Validación de Tesorería", quien: "Graciela" },
  ];
  return (
    <MarcoPantalla titulo="Cajas del día">
      <Resaltado>
        <div className="rounded-lg border border-border bg-card">
          <p className="flex items-center gap-1.5 px-2.5 py-1.5 text-[0.8rem] font-medium">
            <History className="size-3.5 text-muted-foreground" />
            Historial de la caja <span className="text-muted-foreground">(4 movimientos)</span>
            <ChevronDown className="ml-auto size-3.5 rotate-180 text-muted-foreground" />
          </p>
          <div className="divide-y divide-border border-t border-border">
            {eventos.map((e) => (
              <p key={e.cuando} className="flex items-baseline gap-2 px-2.5 py-1 text-[0.72rem]">
                <span className="w-16 shrink-0 text-muted-foreground tabular">{e.cuando}</span>
                <span className="font-medium">{e.que}</span>
                <span className="ml-auto text-muted-foreground">{e.quien}</span>
              </p>
            ))}
          </div>
        </div>
      </Resaltado>
    </MarcoPantalla>
  );
}

// ---------------------------------------------------------------------------
// Caja: Tesorería (ajustes y validación)
// ---------------------------------------------------------------------------

/** El formulario de «Cargar un ajuste»: falta o sobra, dónde, cuánto y por qué. */
export function PantallaAjuste() {
  const opcion = (texto: React.ReactNode, activo: boolean) => (
    <span
      className={cn(
        "flex min-h-7 flex-1 items-center justify-center gap-1 rounded-md border text-[0.72rem] font-medium",
        activo ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
      )}
    >
      {texto}
    </span>
  );
  return (
    <MarcoPantalla titulo="Ajustes de tesorería">
      <div className="space-y-2 rounded-lg border border-dashed border-border p-2.5">
        <div className="space-y-1">
          <p className="text-[0.72rem] font-medium">¿Qué pasó?</p>
          <div className="flex gap-1.5">
            {opcion(
              <>
                <Minus className="size-3" /> Falta plata
              </>,
              true
            )}
            {opcion(
              <>
                <Plus className="size-3" /> Sobra plata
              </>,
              false
            )}
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-[0.72rem] font-medium">¿Dónde?</p>
          <div className="flex gap-1.5">
            {opcion("En el cajón", false)}
            {opcion("En el banco", true)}
          </div>
        </div>
        <CampoEjemplo etiqueta="¿Cuánto?" valor="2.500" />
        <p className="text-[0.72rem]">
          Faltan <strong className="tabular">{formatARS(2500)}</strong> en el banco: tiene que haber{" "}
          <span className="text-muted-foreground tabular line-through">{formatARS(1116000)}</span> →{" "}
          <strong className="tabular">{formatARS(1113500)}</strong>
        </p>
        <div className="space-y-1">
          <p className="text-[0.72rem] font-medium">¿Por qué?</p>
          <div className="flex flex-wrap gap-1">
            <BotonEjemplo variante="contorno" className="min-h-6 px-2 text-[0.72rem]">
              Faltante en el conteo
            </BotonEjemplo>
            <BotonEjemplo className="min-h-6 px-2 text-[0.72rem]">Comisión bancaria</BotonEjemplo>
          </div>
        </div>
        <Resaltado className="w-fit">
          <BotonEjemplo>
            <Minus /> Registrar faltante de {formatARS(2500)}
          </BotonEjemplo>
        </Resaltado>
      </div>
    </MarcoPantalla>
  );
}

/** La ventana de «Contar y validar»: la cuenta, lo contado y el OK final. */
export function PantallaValidar() {
  return (
    <MarcoPantalla titulo="Cajas del día" contenidoClassName={FONDO_VENTANA}>
      <Ventana
        titulo="Contar y validar la caja del 29/09"
        descripcion="Administración · Validar es el cierre definitivo: después ya no se reabre."
        pie={
          <Resaltado className="w-full">
            <BotonEjemplo className="w-full">
              <Stamp /> Coincide: validar la caja
            </BotonEjemplo>
          </Resaltado>
        }
      >
        <div className="rounded-md border border-border px-2 py-0.5">
          <RenglonCuenta signo="" etiqueta="Juntó en efectivo" monto={<Money monto={1254000} />} />
          <RenglonCuenta signo="−" etiqueta="Gastos pagados desde la caja" monto={<Money monto={45000} />} />
          <RenglonCuenta signo="=" etiqueta="Tiene que haber en efectivo" monto={<Money monto={1209000} />} fuerte />
        </div>
        <CampoEjemplo
          etiqueta="¿Cuánto efectivo contaste?"
          valor={<span className="text-[0.95rem] font-bold tabular">1.209.000</span>}
        />
        <p className="flex items-center gap-1.5 text-[0.8rem] font-semibold">
          Contaste {formatARS(1209000)} <Sello estado="pagado" texto="Coincide" />
        </p>
      </Ventana>
    </MarcoPantalla>
  );
}

// ---------------------------------------------------------------------------
// Caja: el recorrido de la plata (Portería → Administración → Tesorería)
// ---------------------------------------------------------------------------

type Etapa = "porteria" | "administracion" | "tesoreria";

function Circuito({ resaltar }: { resaltar: Etapa | null }) {
  const etapas: { id: Etapa; quien: string; hace: string; sello: React.ReactNode; icono: typeof HandCoins }[] = [
    {
      id: "porteria",
      quien: "Jefe de Portería",
      hace: "Rinde su caja y entrega el efectivo",
      sello: <Sello estado="cerrada" texto="Rendida" />,
      icono: HandCoins,
    },
    {
      id: "administracion",
      quien: "Administración",
      hace: "La recibe, la suma a la suya y cierra",
      sello: <Sello estado="integrada" />,
      icono: ArrowDownToLine,
    },
    {
      id: "tesoreria",
      quien: "Tesorería, al día siguiente",
      hace: "Cuenta la plata y da el OK final",
      sello: <Sello estado="validada" />,
      icono: Stamp,
    },
  ];
  return (
    <MarcoPantalla titulo="El recorrido de la plata" contenidoClassName="space-y-1 p-3">
      {etapas.map((e, i) => {
        const Icono = e.icono;
        const fila = (
          <FilaEjemplo derecha={e.sello} className={cn(resaltar !== null && resaltar !== e.id && "opacity-60")}>
            <p className="flex items-center gap-1.5 text-[0.8rem] font-semibold">
              <Icono className="size-3.5 shrink-0 text-primary" /> {e.quien}
            </p>
            <p className="text-[0.72rem] text-muted-foreground">{e.hace}</p>
          </FilaEjemplo>
        );
        return (
          <div key={e.id} className="space-y-1">
            {resaltar === e.id ? <Resaltado>{fila}</Resaltado> : fila}
            {i < etapas.length - 1 ? (
              <ArrowDown className="mx-auto size-3.5 text-muted-foreground" aria-hidden />
            ) : null}
          </div>
        );
      })}
    </MarcoPantalla>
  );
}

/** El recorrido, con el paso del Jefe de Portería señalado. */
export function PantallaCircuitoPorteria() {
  return <Circuito resaltar="porteria" />;
}

/** El recorrido, con el paso de Administración señalado. */
export function PantallaCircuitoAdmin() {
  return <Circuito resaltar="administracion" />;
}

/** El recorrido, con el paso de Tesorería señalado. */
export function PantallaCircuitoTesoreria() {
  return <Circuito resaltar="tesoreria" />;
}

/** El recorrido completo, sin señalar ninguno (el Líder ve todo). */
export function PantallaCircuito() {
  return <Circuito resaltar={null} />;
}

// ---------------------------------------------------------------------------
// Cheques
// ---------------------------------------------------------------------------

type ChequeEjemplo = {
  numero: string;
  monto: number;
  puesto: string;
  entrego: string;
  carpeta: string;
  cuando: React.ReactNode;
  estado: "listo_depositar" | "en_cartera";
  diferido?: boolean;
};

const CHEQUES: ChequeEjemplo[] = [
  {
    numero: "00384512",
    monto: 450000,
    puesto: "Puesto 112",
    entrego: "Doña Rosa",
    carpeta: "Carpeta N° 112",
    cuando: <>Recibido 30/09 · Se cobra desde el 30/09</>,
    estado: "listo_depositar",
  },
  {
    numero: "00917733",
    monto: 1080000,
    puesto: "Galpón 9",
    entrego: "La Colorada",
    carpeta: "Carpeta N° 9",
    cuando: (
      <>
        Recibido 26/09 · <span className="font-semibold text-parcial">Diferido: se cobra desde el 15/10/2026</span>
      </>
    ),
    estado: "en_cartera",
    diferido: true,
  },
];

function FilaCheque({ c, resaltarDepositar = false }: { c: ChequeEjemplo; resaltarDepositar?: boolean }) {
  const depositar = (
    <BotonEjemplo className={cn("min-h-7 px-2 text-[0.72rem]", c.diferido && "opacity-50")}>
      {c.diferido ? <CalendarClock /> : <Landmark />} Depositar
    </BotonEjemplo>
  );
  return (
    <div className="space-y-1 px-2.5 py-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-[0.9rem] leading-tight font-bold tabular">N° {c.numero}</p>
          <span className="inline-flex rounded bg-muted px-1.5 text-[0.72rem] font-medium">{c.puesto}</span>
        </div>
        <Money monto={c.monto} className="text-[0.95rem] font-bold" />
      </div>
      <p className="text-[0.8rem]">
        <span className="text-muted-foreground">Lo entregó </span>
        <span className="font-medium">{c.entrego}</span>
        <span className="text-muted-foreground"> · {c.carpeta}</span>
      </p>
      <p className="text-[0.72rem] text-muted-foreground tabular">{c.cuando}</p>
      <Sello estado={c.estado} />
      <div className="flex flex-wrap gap-1 pt-0.5">
        {resaltarDepositar ? <Resaltado>{depositar}</Resaltado> : depositar}
        <BotonEjemplo variante="contorno" className="min-h-7 px-2 text-[0.72rem]">
          <HandCoins /> Entregar a proveedor
        </BotonEjemplo>
        <BotonEjemplo variante="contorno" className="min-h-7 px-2 text-[0.72rem] text-destructive">
          Rechazar
        </BotonEjemplo>
      </div>
    </div>
  );
}

/** Los filtros por estado, como chips. */
function ChipsCheques({ resaltar = false }: { resaltar?: boolean }) {
  // Los mismos que la pantalla real, en su orden (FILTROS_CHEQUES). «Entregados sin gasto» solo
  // aparece cuando hay alguno.
  const chips: { label: string; n: number; activo?: boolean; atencion?: boolean }[] = [
    { label: "Listos para depositar", n: 1, atencion: true },
    { label: "Por cobrar", n: 2, activo: true },
    { label: "Entregados a proveedor", n: 4 },
    { label: "Depositados", n: 3 },
    { label: "Acreditados", n: 12 },
    { label: "Rechazados", n: 0 },
    { label: "Todos", n: 21 },
  ];
  const fila = (
    <div className="flex flex-wrap gap-1">
      {chips.map((c) => (
        <span
          key={c.label}
          className={cn(
            "inline-flex min-h-6 items-center gap-1 rounded-full border px-2 text-[0.72rem] font-medium",
            c.activo
              ? "border-primary bg-primary text-primary-foreground"
              : c.atencion
                ? "border-parcial/50 bg-parcial-suave"
                : "border-border bg-card"
          )}
        >
          {c.label}
          <span className={cn("font-semibold tabular", c.activo ? "text-primary-foreground/80" : "text-muted-foreground")}>
            {c.n}
          </span>
        </span>
      ))}
    </div>
  );
  return resaltar ? <Resaltado mano={false}>{fila}</Resaltado> : fila;
}

/** Portada del capítulo "Cheques": lo que hay por cobrar, los filtros y un cheque. */
export function PortadaCheques() {
  return (
    <MarcoPantalla titulo="Cheques">
      <div className="flex items-end justify-between gap-2">
        <p className="font-display text-[0.9rem] font-bold">Cheques</p>
        <div className="rounded-lg border border-border bg-card px-2.5 py-1 text-right">
          <p className="text-[0.72rem] text-muted-foreground">Por cobrar</p>
          <Money monto={1530000} className="text-[0.95rem] font-bold" />
        </div>
      </div>
      <ChipsCheques />
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <FilaCheque c={CHEQUES[0]} resaltarDepositar />
      </div>
    </MarcoPantalla>
  );
}

/** El camino de un cheque: por cobrar → listo → depositado → acreditado (o rechazado). */
export function PantallaCicloCheque() {
  const pasos: { estado: string; texto: string }[] = [
    { estado: "en_cartera", texto: "Lo recibió Administración al cobrar" },
    { estado: "listo_depositar", texto: "Llegó su fecha: ya se puede depositar" },
    { estado: "depositado", texto: "Lo llevaste al banco" },
    { estado: "acreditado", texto: "El banco lo pagó: suma al saldo" },
  ];
  // El sello no se corta (nowrap): va arriba y la explicación abajo, así nada se pisa a 360 px.
  const paso = (estado: string, texto: string) => (
    <div className="space-y-0.5">
      <Sello estado={estado} />
      <p className="text-[0.72rem] text-muted-foreground">{texto}</p>
    </div>
  );
  return (
    <MarcoPantalla titulo="Cheques" contenidoClassName="space-y-1 p-3">
      {pasos.map((p, i) => (
        <div key={p.estado} className="space-y-1">
          {paso(p.estado, p.texto)}
          {i < pasos.length - 1 ? <ArrowDown className="ml-4 size-3 text-muted-foreground" aria-hidden /> : null}
        </div>
      ))}
      <div className="mt-1 space-y-1.5 border-t border-dashed border-border pt-1.5">
        {paso("entregado", "O se lo diste a un proveedor para pagar un gasto")}
        {paso("rechazado", "Solo si el banco lo rebota")}
      </div>
    </MarcoPantalla>
  );
}

/** La lista de cheques con dos ejemplos: uno listo y uno diferido. */
export function PantallaCartera() {
  return (
    <MarcoPantalla titulo="Cheques">
      <Resaltado>
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {CHEQUES.map((c) => (
            <FilaCheque key={c.numero} c={c} />
          ))}
        </div>
      </Resaltado>
    </MarcoPantalla>
  );
}

/** El aviso de arriba cuando hay cheques listos para depositar. */
export function PantallaChequesListos() {
  return (
    <MarcoPantalla titulo="Cheques">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-parcial/40 bg-parcial-suave px-2.5 py-2">
        <div className="flex items-start gap-1.5">
          <Landmark className="mt-0.5 size-4 shrink-0 text-parcial" />
          <div>
            <p className="text-[0.8rem] font-semibold">Tenés 1 cheque listo para depositar por {formatARS(450000)}</p>
            <p className="text-[0.72rem] text-muted-foreground">Ya se pueden cobrar: llevalos al banco y marcalos.</p>
          </div>
        </div>
        <Resaltado>
          <BotonEjemplo variante="contorno">
            Ver los listos <ArrowRight />
          </BotonEjemplo>
        </Resaltado>
      </div>
      <ChipsCheques />
    </MarcoPantalla>
  );
}

/** Elegir la fecha: Hoy / Ayer / otro día. */
function ElegirFechaEjemplo() {
  return (
    <div className="flex items-center gap-1.5">
      <BotonEjemplo className="min-h-7 px-3 text-[0.72rem]">Hoy</BotonEjemplo>
      <BotonEjemplo variante="contorno" className="min-h-7 px-3 text-[0.72rem]">
        Ayer
      </BotonEjemplo>
      <span className="flex min-h-7 flex-1 items-center rounded-md border border-border bg-card px-2 text-[0.72rem] text-muted-foreground">
        30/09/2026
      </span>
    </div>
  );
}

/** La ventana de «Depositar». */
export function PantallaDepositar() {
  return (
    <MarcoPantalla titulo="Cheques" contenidoClassName={FONDO_VENTANA}>
      <Ventana
        titulo="Depositar el cheque N° 00384512"
        descripcion={`${formatARS(450000)} · Puesto 112. Impacta en el banco en unas 72 horas.`}
        pie={
          <Resaltado className="w-full">
            <BotonEjemplo className="w-full">Depositar {formatARS(450000)}</BotonEjemplo>
          </Resaltado>
        }
      >
        <p className="text-[0.8rem] font-medium">¿Qué día lo depositaste?</p>
        <ElegirFechaEjemplo />
      </Ventana>
    </MarcoPantalla>
  );
}

/** La ventana de «Se acreditó». */
export function PantallaAcreditar() {
  return (
    <MarcoPantalla titulo="Cheques" contenidoClassName={FONDO_VENTANA}>
      <Ventana
        titulo="¿Se acreditó el cheque N° 00384512?"
        descripcion={`${formatARS(450000)} ya están en el banco: suman al saldo del banco.`}
        pie={
          <Resaltado className="w-full">
            <BotonEjemplo className="w-full">Sí, se acreditó</BotonEjemplo>
          </Resaltado>
        }
      >
        <p className="text-[0.8rem] font-medium">¿Qué día se acreditó?</p>
        <ElegirFechaEjemplo />
      </Ventana>
    </MarcoPantalla>
  );
}

/** La ventana de «Entregar a proveedor», pagando un gasto con el cheque. */
export function PantallaEntregar() {
  return (
    <MarcoPantalla titulo="Cheques" contenidoClassName={FONDO_VENTANA}>
      <Ventana
        titulo="Entregar el cheque N° 00917733 a un proveedor"
        descripcion={`${formatARS(1080000)}. Sale de la cartera (sin tocar ninguna caja).`}
        pie={
          <Resaltado className="w-full">
            <BotonEjemplo className="w-full">
              <HandCoins /> Entregar y pagar Contenedores de septiembre
            </BotonEjemplo>
          </Resaltado>
        }
      >
        <CampoEjemplo etiqueta="¿A qué proveedor?" valor="Contenedores El Tala" />
        <p className="text-[0.72rem] font-medium">¿Qué día se lo diste?</p>
        <ElegirFechaEjemplo />
        <p className="text-[0.72rem] font-medium">
          ¿Paga un gasto? <span className="font-normal text-muted-foreground">(opcional)</span>
        </p>
        <div className="flex items-center justify-between gap-2 rounded-md bg-primary px-2.5 py-1.5 text-primary-foreground">
          <span className="flex min-w-0 items-center gap-1.5">
            <Check className="size-3.5 shrink-0" strokeWidth={2.4} />
            <span className="min-w-0">
              <span className="block text-[0.8rem] font-medium">Contenedores de septiembre</span>
              <span className="block text-[0.72rem] text-primary-foreground/80">Vence 05/10</span>
            </span>
          </span>
          <Money monto={1080000} className="text-[0.8rem] font-semibold" />
        </div>
      </Ventana>
    </MarcoPantalla>
  );
}

/** La ventana de «Rechazar»: solo si el cheque rebotó. */
export function PantallaRechazar() {
  const motivos = ["Sin fondos", "Firma no coincide", "Cuenta cerrada"];
  return (
    <MarcoPantalla titulo="Cheques" contenidoClassName={FONDO_VENTANA}>
      <Ventana
        titulo="¿El cheque N° 00384512 rebotó?"
        descripcion={`${formatARS(450000)}. El cobro que respaldaba se anula y la deuda del cliente vuelve a figurar. No se puede deshacer.`}
        pie={
          <>
            <BotonEjemplo variante="contorno">No, volver</BotonEjemplo>
            <Resaltado>
              <BotonEjemplo className="bg-destructive/10 text-destructive">Rechazar cheque</BotonEjemplo>
            </Resaltado>
          </>
        }
      >
        <p className="text-[0.8rem] font-medium">¿Por qué se rechazó?</p>
        <div className="flex flex-wrap gap-1">
          {motivos.map((m, i) => (
            <span
              key={m}
              className={cn(
                "inline-flex min-h-6 items-center rounded-full border px-2 text-[0.72rem] font-medium",
                i === 0 ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
              )}
            >
              {m}
            </span>
          ))}
        </div>
      </Ventana>
    </MarcoPantalla>
  );
}
