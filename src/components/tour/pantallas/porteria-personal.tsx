import {
  BadgeCheck,
  Banknote,
  Caravan,
  CircleCheck,
  ClipboardList,
  Clock,
  Container,
  Copy,
  Eraser,
  FileText,
  History,
  LogIn,
  LogOut,
  Minus,
  Paperclip,
  Pencil,
  PencilLine,
  Plus,
  Save,
  ScanLine,
  Search,
  Smartphone,
  SquareParking,
  TriangleAlert,
  Truck,
  Undo2,
  UserCheck,
  UserMinus,
  UserPlus,
  UserRound,
  UserRoundSearch,
  Users,
  Van,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { BotonEjemplo, CampoEjemplo, MarcoPantalla, Resaltado } from "@/components/tour/pantalla";

// Tour guiado · porteria-personal: pantallas de ejemplo (docs/GUIA-TOUR.md). Dibujos quietos,
// con datos inventados, de la garita (/porteria) y del padrón de personal (/personal).

/** Envuelve en el anillo que late solo si `si` (para reusar un dibujo señalando otra parte). */
function Quizas({ si, mano = true, className, children }: { si: boolean; mano?: boolean; className?: string; children: React.ReactNode }) {
  return si ? (
    <Resaltado mano={mano} className={className}>
      {children}
    </Resaltado>
  ) : (
    <>{children}</>
  );
}

/** Sello en chico, para que entre en el dibujo. */
function SelloChico({ estado, texto }: { estado: string; texto?: string }) {
  return <Sello estado={estado} texto={texto} className="px-1.5 py-0.5 text-[0.72rem]" />;
}

const BOTON_CHICO = "min-h-7 px-2 text-[0.72rem] [&_svg]:size-3";

// =====================================================================================
// Portería (la garita)
// =====================================================================================

/** Las dos pestañas grandes de la garita, con su dato vivo. */
function PestanasGarita({ activa, resaltar }: { activa: "canon" | "personal"; resaltar?: "personal" }) {
  const pestana = (clave: "canon" | "personal", Icono: LucideIcon, titulo: string, dato: string) => (
    <span
      className={cn(
        "flex min-h-9 flex-1 flex-col items-center justify-center rounded-md px-1 text-[0.72rem] leading-tight font-semibold",
        activa === clave ? "border border-foreground/10 bg-card text-primary shadow-sm" : "text-foreground/75"
      )}
    >
      <span className="inline-flex items-center gap-1">
        <Icono className="size-3.5" strokeWidth={2} />
        {titulo}
      </span>
      <span className="font-display font-bold tabular">{dato}</span>
    </span>
  );
  return (
    <div className="flex gap-1 rounded-lg bg-foreground/8 p-1">
      {pestana("canon", Truck, "Canon de transporte", "$ 44.000")}
      {resaltar === "personal" ? (
        <Resaltado className="flex flex-1">{pestana("personal", Users, "Personal", "2 adentro")}</Resaltado>
      ) : (
        pestana("personal", Users, "Personal", "2 adentro")
      )}
    </div>
  );
}

const TARIFAS: { nombre: string; precio: number; unidad: string; Icono: LucideIcon }[] = [
  { nombre: "Camioneta", precio: 6000, unidad: "por vehículo", Icono: Van },
  { nombre: "Chasis", precio: 8000, unidad: "por vehículo", Icono: Truck },
  { nombre: "Balancín", precio: 9000, unidad: "por vehículo", Icono: Caravan },
  { nombre: "Equipo", precio: 12000, unidad: "por vehículo", Icono: Container },
  { nombre: "Estadía diaria", precio: 12000, unidad: "por día", Icono: SquareParking },
];

/** Una tarjeta de "¿Qué entró?". */
function TarjetaTarifa({ tarifa, elegida }: { tarifa: (typeof TARIFAS)[number]; elegida: boolean }) {
  const { Icono } = tarifa;
  return (
    <div
      className={cn(
        "flex min-h-16 flex-col justify-between gap-1 rounded-lg border-2 p-1.5",
        elegida ? "border-primary bg-primary/[0.06] text-primary" : "border-border bg-card"
      )}
    >
      <span className="flex items-start justify-between">
        <Icono className="size-4.5" strokeWidth={1.9} />
        {elegida ? <CircleCheck className="size-3.5" strokeWidth={2.2} /> : null}
      </span>
      <span>
        <span className="block text-[0.78rem] leading-tight font-bold">{tarifa.nombre}</span>
        <span className={cn("block text-[0.72rem] leading-tight tabular", elegida ? "text-primary/85" : "text-muted-foreground")}>
          <Money monto={tarifa.precio} className="font-semibold" />
          {tarifa.unidad === "por día" ? " por día" : null}
        </span>
      </span>
    </div>
  );
}

/** El formulario del canon en chico, señalando una parte. */
function FormCanon({ resaltar, portada = false }: { resaltar?: "tarifa" | "cuantos" | "cobrar"; portada?: boolean }) {
  const tarifas = portada ? TARIFAS.slice(0, 3) : TARIFAS;
  return (
    <MarcoPantalla titulo="Portería">
      <PestanasGarita activa="canon" />
      <div className="space-y-1.5">
        <p className="font-display text-[0.85rem] font-bold">¿Qué entró?</p>
        <Quizas si={resaltar === "tarifa"}>
          <div className="grid grid-cols-3 gap-1.5">
            {tarifas.map((t, i) => (
              <TarjetaTarifa key={t.nombre} tarifa={t} elegida={i === 0} />
            ))}
          </div>
        </Quizas>
      </div>
      {portada ? null : (
        <Quizas si={resaltar === "cuantos"}>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[0.72rem] font-medium">¿Cuántos vehículos?</p>
              <div className="flex w-32 items-center gap-1">
                <span className="flex size-7 items-center justify-center rounded-md border bg-card text-muted-foreground/60">
                  <Minus className="size-3.5" strokeWidth={2.2} />
                </span>
                <span className="flex h-7 flex-1 items-center justify-center rounded-md border bg-card font-display text-[0.95rem] font-bold tabular">
                  1
                </span>
                <span className="flex size-7 items-center justify-center rounded-md border bg-card">
                  <Plus className="size-3.5" strokeWidth={2.2} />
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[0.72rem] font-medium">¿Cómo paga?</p>
              <div className="grid grid-cols-2 gap-1.5">
                <span className="flex h-7 items-center justify-center gap-1 rounded-md bg-primary text-[0.72rem] font-semibold text-primary-foreground">
                  <Banknote className="size-3.5" strokeWidth={2} />
                  Efectivo
                </span>
                <span className="flex h-7 items-center justify-center gap-1 rounded-md border bg-card text-[0.72rem] font-semibold">
                  <Smartphone className="size-3.5" strokeWidth={2} />
                  Transferencia
                </span>
              </div>
            </div>
          </div>
        </Quizas>
      )}
      <Quizas si={resaltar === "cobrar"}>
        <div className="space-y-1.5 rounded-lg border bg-card p-2">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-[0.72rem] text-muted-foreground">Total</p>
              <p className="text-[0.72rem] text-muted-foreground">Camioneta · Efectivo</p>
            </div>
            <Money monto={6000} className="font-display text-[1.15rem] font-bold" />
          </div>
          <BotonEjemplo className="w-full">Cobrar $ 6.000</BotonEjemplo>
        </div>
      </Quizas>
    </MarcoPantalla>
  );
}

/** Portada del capítulo "Portería": las pestañas y el "¿Qué entró?". */
export function PortadaPorteria() {
  return <FormCanon portada resaltar="tarifa" />;
}

/** Las tarjetas de "¿Qué entró?" (una por vehículo, con su precio). */
export function PantallaCanonQueEntro() {
  return <FormCanon resaltar="tarifa" />;
}

/** Cantidad y cómo paga. */
export function PantallaCanonCuantos() {
  return <FormCanon resaltar="cuantos" />;
}

/** El total y el botón «Cobrar $ 6.000». */
export function PantallaCanonCobrar() {
  return <FormCanon resaltar="cobrar" />;
}

/** Después de cobrar: el sello con el número y el aviso con «Deshacer». */
export function PantallaCobrado() {
  return (
    <MarcoPantalla titulo="Canon de transporte">
      <div className="flex items-start justify-between gap-2 rounded-lg border border-pagado/30 bg-pagado-suave px-2.5 py-2 shadow-sm">
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-[0.75rem] font-semibold">
            <CircleCheck className="size-3.5 shrink-0 text-pagado" strokeWidth={2.2} />
            Cobrado N° 14 · Camioneta · $ 6.000
          </p>
          <p className="pl-4.5 text-[0.72rem] text-muted-foreground">Efectivo</p>
        </div>
        <Resaltado>
          <BotonEjemplo variante="contorno" className={BOTON_CHICO}>
            Deshacer
          </BotonEjemplo>
        </Resaltado>
      </div>
      <div className="space-y-2 rounded-lg border bg-card p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Sello grande estado="pagado" texto="Cobrado N° 14" className="text-[0.85rem]" />
          <span className="text-[0.75rem] text-muted-foreground">
            Camioneta · <Money monto={6000} />
          </span>
        </div>
        <BotonEjemplo className="w-full">Cobrar $ 6.000</BotonEjemplo>
      </div>
    </MarcoPantalla>
  );
}

/** Un cobro de la lista del día. */
function FilaCobro({
  hora,
  numero,
  Icono,
  texto,
  detalle,
  monto,
  anulado,
  anular,
}: {
  hora: string;
  numero: number;
  Icono: LucideIcon;
  texto: string;
  detalle: string;
  monto: number;
  anulado?: string;
  anular?: "resaltado" | "si";
}) {
  const boton = (
    <BotonEjemplo variante="contorno" className={cn(BOTON_CHICO, "text-destructive")}>
      Anular
    </BotonEjemplo>
  );
  return (
    <div className={cn("flex items-center gap-2 px-2.5 py-2", anulado && "bg-muted/40")}>
      <div className="w-9 shrink-0">
        <p className="font-display text-[0.8rem] leading-tight font-bold tabular">{hora}</p>
        <p className="text-[0.72rem] text-muted-foreground tabular">N° {numero}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("flex items-center gap-1 text-[0.78rem] font-semibold", anulado && "text-muted-foreground line-through")}>
          <Icono className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.9} />
          {texto}
        </p>
        {anulado ? (
          <p className="flex flex-wrap items-center gap-1 pt-0.5 text-[0.72rem] text-muted-foreground">
            <SelloChico estado="anulado" /> {anulado}
          </p>
        ) : (
          <p className="truncate text-[0.72rem] text-muted-foreground">{detalle}</p>
        )}
      </div>
      <Money
        monto={monto}
        className={cn("text-[0.8rem] font-bold", anulado && "text-muted-foreground line-through")}
      />
      {anular === "resaltado" ? <Resaltado>{boton}</Resaltado> : anular === "si" ? boton : null}
    </div>
  );
}

/** Chips "Camioneta ×4" del resumen. */
function ConteoVehiculos() {
  return (
    <div className="flex flex-wrap gap-1">
      {[
        { Icono: Van, texto: "Camioneta ×4" },
        { Icono: SquareParking, texto: "Estadía diaria 1 día" },
        { Icono: Truck, texto: "Chasis ×1" },
      ].map(({ Icono, texto }) => (
        <span key={texto} className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[0.72rem] font-medium tabular">
          <Icono className="size-3 text-muted-foreground" strokeWidth={1.9} />
          {texto}
        </span>
      ))}
    </div>
  );
}

/** Los cobros del día como los ve Portería: cuánto tiene que haber en la garita y la lista. */
export function PantallaCobrosDelDia() {
  return (
    <MarcoPantalla titulo="Cobros de hoy">
      <Resaltado mano={false}>
        <div className="space-y-1.5 rounded-lg border bg-card px-2.5 py-2">
          <p className="text-[0.72rem] font-medium text-muted-foreground">Tenés que tener en la garita</p>
          <p className="flex items-baseline gap-1.5">
            <Money monto={36000} className="font-display text-[1.25rem] font-bold" />
            <span className="text-[0.78rem] font-medium">en efectivo</span>
          </p>
          <p className="text-[0.72rem] text-muted-foreground">
            y <Money monto={8000} className="font-semibold text-foreground" /> por transferencia · 6 cobros · 1 anulado
          </p>
          <ConteoVehiculos />
        </div>
      </Resaltado>
      <div className="divide-y overflow-hidden rounded-lg border bg-card">
        <FilaCobro
          hora="10:42"
          numero={14}
          Icono={Van}
          texto="Camioneta"
          detalle="AB 123 CD · Puesto 58 · Efectivo"
          monto={6000}
          anular="resaltado"
        />
        <FilaCobro hora="10:15" numero={13} Icono={Truck} texto="Chasis" detalle="Verdulero · Transferencia" monto={8000} />
        <FilaCobro
          hora="09:50"
          numero={12}
          Icono={Van}
          texto="Camioneta"
          detalle=""
          monto={6000}
          anulado="Se cargó dos veces"
        />
      </div>
    </MarcoPantalla>
  );
}

/** Los cobros del día como los ve el Líder: el efectivo, por tarifa y por quién cobró. */
export function PantallaCobrosJefe() {
  return (
    <MarcoPantalla titulo="Cobros de hoy">
      <Resaltado mano={false}>
        <div className="space-y-1.5 rounded-lg border bg-card px-2.5 py-2">
          <p className="text-[0.72rem] font-medium text-muted-foreground">Bono camioneros en efectivo</p>
          <p className="flex items-baseline gap-1.5">
            <Money monto={36000} className="font-display text-[1.25rem] font-bold" />
            <span className="text-[0.78rem] font-medium">en efectivo</span>
          </p>
          <p className="text-[0.72rem] text-muted-foreground">
            y <Money monto={8000} className="font-semibold text-foreground" /> por transferencia · 6 cobros · 1 anulado
          </p>
          <ConteoVehiculos />
          <div className="space-y-0.5 border-t pt-1.5 text-[0.72rem]">
            <p className="flex flex-wrap items-baseline justify-between gap-x-2">
              <span className="inline-flex items-center gap-1 font-medium">
                <UserRound className="size-3 text-muted-foreground" strokeWidth={1.9} />
                Ramón Díaz · 4 cobros
              </span>
              <span className="tabular">
                <Money monto={24000} className="font-semibold" /> en efectivo
              </span>
            </p>
            <p className="flex flex-wrap items-baseline justify-between gap-x-2">
              <span className="inline-flex items-center gap-1 font-medium">
                <UserRound className="size-3 text-muted-foreground" strokeWidth={1.9} />
                Marta Gómez · 2 cobros
              </span>
              <span className="tabular">
                <Money monto={12000} className="font-semibold" /> en efectivo · <Money monto={8000} /> por transferencia
              </span>
            </p>
          </div>
        </div>
      </Resaltado>
      <div className="divide-y overflow-hidden rounded-lg border bg-card">
        <FilaCobro
          hora="10:42"
          numero={14}
          Icono={Van}
          texto="Camioneta"
          detalle="AB 123 CD · Efectivo · Ramón Díaz"
          monto={6000}
          anular="si"
        />
        <FilaCobro
          hora="10:15"
          numero={13}
          Icono={Truck}
          texto="Chasis"
          detalle="Verdulero · Transferencia · Marta Gómez"
          monto={8000}
          anular="si"
        />
      </div>
    </MarcoPantalla>
  );
}

/** Una firma dibujada (trazo de birome sobre el recuadro blanco). */
function Firma({ className, chica = false }: { className?: string; chica?: boolean }) {
  return (
    <svg viewBox="0 0 140 44" className={className} aria-hidden>
      <path
        d="M8 32 C 14 8, 24 6, 26 26 S 34 40, 44 20 S 56 8, 60 26 L 66 18 C 72 10, 78 30, 88 24 S 102 14, 110 26 S 124 30, 132 18"
        fill="none"
        stroke="#1c2333"
        strokeWidth={chica ? 3 : 2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** El bloque "Registrar ingreso" en chico, señalando el DNI o la firma. */
function FormIngreso({ resaltar }: { resaltar: "dni" | "firma" }) {
  return (
    <MarcoPantalla titulo="Portería">
      <PestanasGarita activa="personal" />
      <div className="space-y-2 rounded-lg border bg-card p-2.5">
        <p className="font-display text-[0.85rem] font-bold">Registrar ingreso</p>
        <Quizas si={resaltar === "dni"}>
          <div className="space-y-1">
            <p className="text-[0.72rem] font-medium">DNI</p>
            <div className="flex gap-1.5">
              <span className="flex min-h-8 flex-1 items-center rounded-md border bg-card px-2 text-[0.95rem] font-semibold tracking-wide tabular">
                20445566
              </span>
              <BotonEjemplo variante="contorno" className="px-2 text-[0.72rem]">
                <ScanLine /> Escanear DNI
              </BotonEjemplo>
            </div>
            <p className="flex items-center gap-1 text-[0.72rem] font-medium text-pagado">
              <BadgeCheck className="size-3" strokeWidth={2.2} /> En el padrón · Sereno
            </p>
          </div>
        </Quizas>
        <div className="grid grid-cols-2 gap-2">
          <CampoEjemplo etiqueta="Apellido" valor="Aguirre" />
          <CampoEjemplo etiqueta="Nombre" valor="Luis" />
        </div>
        <Quizas si={resaltar === "firma"}>
          <div className="space-y-1">
            <p className="text-[0.72rem] font-medium">
              Firma <span className="font-normal text-muted-foreground">(obligatoria)</span>
            </p>
            <div className="relative h-16 overflow-hidden rounded-lg border-2 border-primary/60 bg-white">
              <Firma className="absolute inset-x-6 top-1 h-11" />
              <span className="absolute inset-x-4 bottom-3 flex items-end gap-1">
                <span className="text-[0.72rem] leading-none text-muted-foreground/60">×</span>
                <span className="h-px flex-1 bg-muted-foreground/40" />
              </span>
            </div>
            <div className="flex justify-end">
              <BotonEjemplo variante="contorno" className={BOTON_CHICO}>
                <Eraser /> Borrar firma
              </BotonEjemplo>
            </div>
          </div>
        </Quizas>
        <div className="flex gap-1.5">
          <BotonEjemplo className="flex-1">
            <LogIn /> Registrar ingreso
          </BotonEjemplo>
          <BotonEjemplo variante="contorno" className="px-2 text-[0.72rem] text-muted-foreground">
            Empezar de nuevo
          </BotonEjemplo>
        </div>
      </div>
    </MarcoPantalla>
  );
}

/** El registro de ingreso con el DNI señalado. */
export function PantallaRegistroDni() {
  return <FormIngreso resaltar="dni" />;
}

/** El registro de ingreso con la firma señalada. */
export function PantallaRegistroFirma() {
  return <FormIngreso resaltar="firma" />;
}

/** Con 3 números del DNI aparecen las coincidencias del padrón. */
export function PantallaDniCoincidencias() {
  const opcion = (nombre: string, detalle: string) => (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
      <UserRoundSearch className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
      <span className="min-w-0">
        <span className="block truncate text-[0.8rem] font-semibold">{nombre}</span>
        <span className="block truncate text-[0.72rem] text-muted-foreground tabular">{detalle}</span>
      </span>
    </div>
  );
  return (
    <MarcoPantalla titulo="Registrar ingreso">
      <div className="space-y-1">
        <p className="text-[0.72rem] font-medium">DNI</p>
        <span className="flex min-h-9 items-center rounded-md border-2 border-primary bg-card px-2 text-[1rem] font-semibold tracking-wide tabular">
          2044
        </span>
        <div className="space-y-0.5 rounded-lg border bg-popover p-1 shadow-md">
          <Resaltado>{opcion("Aguirre, Luis", "DNI 20445566 · Sereno")}</Resaltado>
          {opcion("Aguirre, Marta", "DNI 20448120 · Peón")}
        </div>
      </div>
      <p className="text-[0.72rem] text-muted-foreground">Tocás el nombre y se completan el apellido y el nombre.</p>
    </MarcoPantalla>
  );
}

/** Después de registrar: el sello, quién entró y si llegó en horario. */
export function PantallaIngresoRegistrado() {
  return (
    <MarcoPantalla titulo="Portería">
      <div className="flex flex-col items-center gap-1.5 rounded-lg border bg-card px-3 py-3 text-center">
        <Sello grande estado="pagado" texto="Ingreso registrado" className="text-[0.85rem]" />
        <p className="pt-1 font-display text-[1rem] font-bold">Aguirre, Luis</p>
        <p className="text-[0.78rem] text-muted-foreground tabular">05:58 · Sereno</p>
        <SelloChico estado="en_horario" />
      </div>
      <BotonEjemplo className="w-full">
        <LogIn /> Registrar otro ingreso
      </BotonEjemplo>
      <p className="text-center text-[0.72rem] text-muted-foreground">Vuelve solo al formulario en unos segundos.</p>
    </MarcoPantalla>
  );
}

/** Un ingreso de la lista del día. */
function FilaIngreso({
  hora,
  nombre,
  detalle,
  sellos,
  acciones,
}: {
  hora: string;
  nombre: string;
  detalle: string;
  sellos: React.ReactNode;
  acciones?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5 px-2.5 py-2">
      <div className="flex items-center gap-2">
        <p className="w-9 shrink-0 font-display text-[0.85rem] font-bold tabular">{hora}</p>
        <span className="flex h-7 w-14 shrink-0 items-center justify-center rounded-md border bg-white px-1">
          <Firma chica className="h-5 w-full" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.78rem] font-semibold">{nombre}</p>
          <p className="truncate text-[0.72rem] text-muted-foreground tabular">{detalle}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1 pl-11">
        {sellos}
        {acciones}
      </div>
    </div>
  );
}

/** Los ingresos del día (Portería marca salidas; el Líder además las corrige). */
function IngresosDelDia({ lider }: { lider: boolean }) {
  const marcar = (
    <BotonEjemplo variante="contorno" className={BOTON_CHICO}>
      <LogOut /> Marcar salida
    </BotonEjemplo>
  );
  const otraHora = (
    <span className="inline-flex min-h-7 items-center gap-1 px-1 text-[0.72rem] text-muted-foreground">
      <Clock className="size-3" strokeWidth={2} /> Otra hora
    </span>
  );
  const corregir = (
    <span className="inline-flex min-h-7 items-center gap-1 px-1 text-[0.72rem] text-muted-foreground">
      <PencilLine className="size-3" strokeWidth={2} /> Corregir salida
    </span>
  );
  return (
    <MarcoPantalla titulo="Ingresos de hoy">
      <div className="flex flex-wrap items-baseline gap-x-2 rounded-lg border bg-card px-2.5 py-1.5">
        <span className="font-display text-[1.2rem] font-bold text-accent-foreground tabular">2</span>
        <span className="text-[0.78rem] font-medium">personas adentro</span>
        <span className="ml-auto text-[0.72rem] text-muted-foreground tabular">3 ingresos · 1 fuera de horario</span>
      </div>
      <div className="divide-y overflow-hidden rounded-lg border bg-card">
        <FilaIngreso
          hora="05:58"
          nombre="Aguirre, Luis"
          detalle="DNI 20445566 · Sereno"
          sellos={
            <>
              <SelloChico estado="en_horario" />
              <SelloChico estado="adentro" />
            </>
          }
          acciones={
            lider ? (
              <>
                {marcar}
                {otraHora}
              </>
            ) : (
              <>
                <Resaltado>{marcar}</Resaltado>
                {otraHora}
              </>
            )
          }
        />
        <FilaIngreso
          hora="07:20"
          nombre="Benítez, Rosa"
          detalle="DNI 27331904 · Limpieza"
          sellos={
            <>
              <SelloChico estado="fuera_horario" />
              <SelloChico estado="salio" texto="Salió 13:05" />
            </>
          }
          acciones={lider ? <Resaltado>{corregir}</Resaltado> : null}
        />
        <FilaIngreso
          hora="08:05"
          nombre="Sosa, Héctor"
          detalle="DNI 30112456"
          sellos={
            <>
              <SelloChico estado="parcial" texto="Fuera del padrón" />
              <SelloChico estado="adentro" />
            </>
          }
          acciones={
            <>
              {marcar}
              {otraHora}
            </>
          }
        />
      </div>
      {lider ? null : (
        <p className="flex items-center gap-1 text-[0.72rem] text-muted-foreground">
          <History className="size-3 shrink-0" strokeWidth={2} />
          Si alguien quedó adentro de otro día, aparece arriba, en ámbar.
        </p>
      )}
    </MarcoPantalla>
  );
}

/** Ingresos del día como los ve Portería, con «Marcar salida» señalado. */
export function PantallaIngresosDelDia() {
  return <IngresosDelDia lider={false} />;
}

/** Ingresos del día como los ve el Líder, con «Corregir salida» señalado. */
export function PantallaIngresosLider() {
  return <IngresosDelDia lider />;
}

// =====================================================================================
// Personal (padrón de empleados)
// =====================================================================================

type Empleado = {
  nombre: string;
  dni: string;
  sector: string;
  horas: string | null;
  cargo: string;
  horarios: string | null;
};

const EMPLEADOS: Empleado[] = [
  {
    nombre: "Aguirre, Luis",
    dni: "20.445.566",
    sector: "Portería",
    horas: "48 h/sem",
    cargo: "Sereno · Planta permanente",
    horarios: "Lun–Sáb 06:00–14:00",
  },
  {
    nombre: "Benítez, Rosa",
    dni: "27.331.904",
    sector: "Limpieza",
    horas: "36 h/sem",
    cargo: "Contratado",
    horarios: "Lun–Sáb 07:00–13:00",
  },
  {
    nombre: "Ledesma, Ramón",
    dni: "31.908.227",
    sector: "Mantenimiento",
    horas: null,
    cargo: "Peón · Eventual",
    horarios: null,
  },
];

function FilaEmpleado({ e }: { e: Empleado }) {
  return (
    <div className="bg-card px-2.5 py-2">
      <p className="text-[0.8rem] leading-snug font-semibold">{e.nombre}</p>
      <p className="text-[0.72rem] text-muted-foreground tabular">DNI {e.dni}</p>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className="rounded-full border bg-muted px-1.5 py-px text-[0.72rem] font-semibold text-foreground/80">{e.sector}</span>
        {e.horas ? (
          <span className="text-[0.72rem] font-semibold tabular">{e.horas}</span>
        ) : (
          <span className="inline-flex items-center gap-0.5 text-[0.72rem] font-medium text-parcial">
            <TriangleAlert className="size-3" strokeWidth={2.2} /> Sin horas de contrato
          </span>
        )}
        <span className="text-[0.72rem] text-muted-foreground">{e.cargo}</span>
      </div>
      <p className={cn("mt-0.5 flex items-center gap-1 text-[0.72rem] tabular", e.horarios ? "text-foreground/80" : "text-parcial")}>
        <Clock className="size-3 shrink-0" strokeWidth={2} />
        {e.horarios ?? "Sin horarios cargados"}
      </p>
    </div>
  );
}

/** El listado de personal en chico. */
function ListaPersonal({ resaltar }: { resaltar: "fila" | "nuevo" }) {
  const chip = (texto: string, activo = false, cuenta?: number) => (
    <span
      key={texto}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.72rem] font-medium whitespace-nowrap",
        activo ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
      )}
    >
      {texto}
      {cuenta ? <span className="font-semibold tabular">{cuenta}</span> : null}
    </span>
  );
  return (
    <MarcoPantalla titulo="Personal">
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-[0.95rem] font-bold">Personal</p>
        <Quizas si={resaltar === "nuevo"}>
          <BotonEjemplo>
            <UserPlus /> Nuevo empleado
          </BotonEjemplo>
        </Quizas>
      </div>
      <div className="flex min-h-8 items-center gap-1.5 rounded-md border bg-card px-2 text-[0.75rem] text-muted-foreground">
        <Search className="size-3.5" strokeWidth={2} /> Buscá por apellido, nombre o DNI
      </div>
      <div className="flex flex-wrap gap-1">
        {chip("Activos", true)}
        {chip("Todos")}
        {chip("Todos los sectores", true)}
        {chip("Portería", false, 1)}
        {chip("Limpieza", false, 1)}
        {chip("Mantenimiento", false, 1)}
      </div>
      <div className="divide-y rounded-lg border">
        <Quizas si={resaltar === "fila"}>
          <FilaEmpleado e={EMPLEADOS[0]} />
        </Quizas>
        <FilaEmpleado e={EMPLEADOS[1]} />
        <FilaEmpleado e={EMPLEADOS[2]} />
      </div>
    </MarcoPantalla>
  );
}

/** Portada del capítulo "Personal": la lista con «Nuevo empleado». */
export function PortadaPersonal() {
  return <ListaPersonal resaltar="nuevo" />;
}

/** La lista de empleados, con el primero señalado. */
export function PantallaListaPersonal() {
  return <ListaPersonal resaltar="fila" />;
}

/** Chips de opción (sector, tipo de contrato). */
function Opciones({ opciones, elegida }: { opciones: string[]; elegida: string }) {
  return (
    <div className="flex flex-wrap gap-1">
      {opciones.map((o) => (
        <span
          key={o}
          className={cn(
            "inline-flex min-h-6 items-center rounded-md border px-2 text-[0.72rem] font-semibold",
            o === elegida ? "border-primary bg-primary text-primary-foreground" : "bg-card"
          )}
        >
          {o}
        </span>
      ))}
    </div>
  );
}

/** El alta de un empleado: datos, sector y contrato laboral. */
export function PantallaNuevoEmpleado() {
  return (
    <MarcoPantalla titulo="Nuevo empleado">
      <div className="space-y-2 rounded-lg border bg-card p-2.5">
        <p className="font-display text-[0.85rem] font-bold">Datos</p>
        <div className="grid grid-cols-2 gap-2">
          <CampoEjemplo etiqueta="Apellido" valor="Aguirre" />
          <CampoEjemplo etiqueta="Nombre" valor="Luis" />
          <CampoEjemplo etiqueta="DNI" valor={<span className="tabular">20445566</span>} />
          <CampoEjemplo etiqueta="CUIL" valor={<span className="tabular">20-20445566-3</span>} />
        </div>
        <div className="space-y-1">
          <p className="text-[0.72rem] font-medium text-muted-foreground">Sector</p>
          <Opciones opciones={["Portería", "Limpieza", "Mantenimiento", "Administración"]} elegida="Portería" />
        </div>
      </div>
      <div className="space-y-2 rounded-lg border bg-card p-2.5">
        <p className="font-display text-[0.85rem] font-bold">Contrato laboral</p>
        <div className="space-y-1">
          <p className="text-[0.72rem] font-medium text-muted-foreground">Tipo de contrato</p>
          <Opciones opciones={["Planta permanente", "Contratado", "Eventual"]} elegida="Planta permanente" />
        </div>
        <div className="flex items-end gap-2">
          <CampoEjemplo etiqueta="Horas por semana según contrato" valor={<span className="tabular">48</span>} className="w-40" />
          <p className="pb-2 text-[0.72rem] text-muted-foreground tabular">≈ 6,9 h por día</p>
        </div>
        <div className="flex items-center gap-2">
          <BotonEjemplo variante="contorno" className="px-2 text-[0.72rem]">
            <Paperclip /> Elegir archivo
          </BotonEjemplo>
          <span className="flex min-w-0 items-center gap-1 text-[0.72rem] text-muted-foreground">
            <FileText className="size-3 shrink-0" strokeWidth={2} />
            <span className="truncate">contrato-aguirre.pdf</span>
          </span>
        </div>
      </div>
      <div className="flex gap-1.5">
        <BotonEjemplo variante="contorno">Cancelar</BotonEjemplo>
        <Resaltado className="flex-1">
          <BotonEjemplo className="w-full">
            <UserPlus /> Crear empleado
          </BotonEjemplo>
        </Resaltado>
      </div>
    </MarcoPantalla>
  );
}

/** Un dato de la ficha (etiqueta chica arriba, valor abajo). */
function Dato({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div>
      <p className="text-[0.72rem] text-muted-foreground">{etiqueta}</p>
      <p className="text-[0.78rem] font-medium">{valor}</p>
    </div>
  );
}

/** La ficha del empleado con su contrato laboral. */
export function PantallaFichaEmpleado() {
  return (
    <MarcoPantalla titulo="Ficha del empleado">
      <div className="space-y-1">
        <SelloChico estado="activo" />
        <p className="font-display text-[1rem] font-bold">Aguirre, Luis</p>
        <p className="text-[0.72rem] text-muted-foreground tabular">Sereno · Planta permanente · DNI 20.445.566</p>
      </div>
      <div className="flex gap-1.5">
        <BotonEjemplo variante="contorno" className="px-2 text-[0.72rem]">
          <Pencil /> Editar datos
        </BotonEjemplo>
        <BotonEjemplo variante="contorno" className="px-2 text-[0.72rem] text-pendiente">
          <UserMinus /> Dar de baja
        </BotonEjemplo>
      </div>
      <Resaltado>
        <div className="space-y-2 rounded-lg border bg-card p-2.5">
          <div>
            <p className="font-display text-[0.85rem] font-bold">Contrato laboral</p>
            <p className="text-[0.72rem] text-muted-foreground">Planta permanente</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Dato etiqueta="Fecha de ingreso" valor={<span className="tabular">03/03/2019</span>} />
            <Dato etiqueta="Fecha de egreso" valor="Sigue trabajando" />
            <Dato etiqueta="Horas por semana" valor={<span className="tabular">48 h (contrato)</span>} />
          </div>
          <BotonEjemplo variante="contorno" className="px-2 text-[0.72rem]">
            <FileText /> Ver contrato
          </BotonEjemplo>
        </div>
      </Resaltado>
    </MarcoPantalla>
  );
}

/** Una franja "06:00 a 14:00" con su «Quitar». */
function Franja({ desde, hasta }: { desde: string; hasta: string }) {
  const hora = (h: string) => (
    <span className="flex h-7 w-12 items-center justify-center rounded-md border bg-card text-[0.8rem] tabular">{h}</span>
  );
  return (
    <div className="flex items-center gap-1">
      {hora(desde)}
      <span className="text-[0.72rem] text-muted-foreground">a</span>
      {hora(hasta)}
      <span className="inline-flex items-center gap-0.5 px-1 text-[0.72rem] text-muted-foreground">
        <X className="size-3" strokeWidth={2} /> Quitar
      </span>
    </div>
  );
}

/** El editor de horarios de la ficha, señalando el lunes o copiar y guardar. */
function Horarios({ resaltar }: { resaltar: "dia" | "guardar" }) {
  const dia = (nombre: string, contenido: React.ReactNode) => (
    <div className="flex items-start gap-2 px-2.5 py-2">
      <p className="w-16 shrink-0 pt-1 font-display text-[0.8rem] font-bold">{nombre}</p>
      <div className="min-w-0 flex-1 space-y-1">{contenido}</div>
    </div>
  );
  const agregar = (texto: string, contorno: boolean) => (
    <BotonEjemplo
      variante="contorno"
      className={cn(BOTON_CHICO, contorno ? "" : "border-transparent bg-transparent text-primary")}
    >
      <Plus /> {texto}
    </BotonEjemplo>
  );
  return (
    <MarcoPantalla titulo="Horarios de trabajo">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <p className="text-[0.72rem] text-muted-foreground tabular">Lun–Sáb 06:00–14:00</p>
        <Quizas si={resaltar === "guardar"} mano={false}>
          <BotonEjemplo variante="contorno" className={BOTON_CHICO}>
            <Copy /> Copiar lunes a martes–sábado
          </BotonEjemplo>
        </Quizas>
      </div>
      <div className="divide-y rounded-lg border bg-card">
        <Quizas si={resaltar === "dia"}>
          {dia(
            "Lunes",
            <>
              <Franja desde="06:00" hasta="14:00" />
              {agregar("Agregar otra franja", false)}
            </>
          )}
        </Quizas>
        {dia("Martes", <Franja desde="06:00" hasta="14:00" />)}
        {dia(
          "Domingo",
          <>
            <p className="pt-1 text-[0.72rem] text-muted-foreground">No trabaja</p>
            {agregar("Agregar horario", true)}
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Quizas si={resaltar === "guardar"}>
          <BotonEjemplo>
            <Save /> Guardar horarios
          </BotonEjemplo>
        </Quizas>
        <p className="text-[0.72rem] font-medium text-parcial">Tenés cambios sin guardar</p>
      </div>
    </MarcoPantalla>
  );
}

/** Los horarios de la semana, con el lunes señalado. */
export function PantallaHorarios() {
  return <Horarios resaltar="dia" />;
}

/** Los horarios de la semana, con «Copiar lunes…» y «Guardar horarios» señalados. */
export function PantallaHorariosGuardar() {
  return <Horarios resaltar="guardar" />;
}

/** La ventana de «Dar de baja». */
export function PantallaDarDeBaja() {
  return (
    <MarcoPantalla titulo="Dar de baja a Aguirre, Luis">
      <p className="text-[0.75rem] text-muted-foreground">
        Deja de figurar como activo y Portería ya no lo va a encontrar en el padrón. Sus ingresos anteriores se
        conservan.
      </p>
      <Resaltado mano={false}>
        <CampoEjemplo etiqueta="Fecha de egreso" valor={<span className="tabular">30/09/2026</span>} />
      </Resaltado>
      <div className="flex justify-end gap-1.5 pt-1">
        <BotonEjemplo variante="contorno">Cancelar</BotonEjemplo>
        <BotonEjemplo className="bg-destructive text-white">
          <UserMinus /> Confirmar la baja
        </BotonEjemplo>
      </div>
    </MarcoPantalla>
  );
}

/** La ventana de «Reincorporar» (vuelve a trabajar o la baja fue un error). */
export function PantallaReincorporar() {
  const opcion = (Icono: LucideIcon, titulo: string, detalle: string, activa: boolean) => (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border px-2.5 py-2",
        activa ? "border-primary bg-accent ring-2 ring-primary/20" : "bg-card"
      )}
    >
      <span
        className={cn(
          "mt-0.5 size-3.5 shrink-0 rounded-full border-2",
          activa ? "border-primary bg-primary" : "border-border"
        )}
      />
      <span className="min-w-0">
        <span className="flex items-center gap-1 text-[0.78rem] font-semibold">
          <Icono className="size-3.5" strokeWidth={2} /> {titulo}
        </span>
        <span className="block text-[0.72rem] text-muted-foreground">{detalle}</span>
      </span>
    </div>
  );
  return (
    <MarcoPantalla titulo="Reincorporar a Aguirre, Luis">
      <p className="text-[0.75rem] text-muted-foreground">Está dado de baja desde el 14/08/2026. ¿Qué pasó?</p>
      {opcion(UserCheck, "Vuelve a trabajar", "El tiempo que estuvo afuera no cuenta en las planillas de novedades.", true)}
      {opcion(Undo2, "Fue un error: deshacer la baja", "Queda como si nunca se hubiera ido.", false)}
      <div className="flex justify-end gap-1.5 pt-1">
        <BotonEjemplo variante="contorno">Cancelar</BotonEjemplo>
        <BotonEjemplo>
          <UserCheck /> Reincorporar
        </BotonEjemplo>
      </div>
    </MarcoPantalla>
  );
}

/** Las horas del mes en la ficha: lo que tendría que trabajar contra lo que anotó Portería. */
export function PantallaNovedadesEmpleado() {
  return (
    <MarcoPantalla titulo="Ficha del empleado">
      <div className="space-y-2 rounded-lg border bg-card p-2.5">
        <div>
          <p className="font-display text-[0.85rem] font-bold">Novedades de septiembre</p>
          <p className="text-[0.72rem] text-muted-foreground">
            Horas que debería tener contra las que registró en Portería, y lo que se cargó en el mes.
          </p>
        </div>
        <Resaltado mano={false}>
          <div className="space-y-1 p-0.5">
            <p className="flex flex-wrap items-baseline gap-x-1.5 text-[0.75rem]">
              Registró <span className="font-display text-[0.95rem] font-bold tabular">132 h</span> de{" "}
              <span className="font-semibold tabular">144 h</span>
              <span className="font-semibold text-parcial tabular">92 %</span>
              <span className="text-[0.72rem] text-muted-foreground">hasta hoy</span>
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-[92%] rounded-full bg-parcial" />
            </div>
          </div>
        </Resaltado>
        <div className="flex flex-wrap gap-1">
          {["1 llegada tarde · 20 min", "4 h extra"].map((t) => (
            <span key={t} className="rounded-full border bg-muted/40 px-2 py-0.5 text-[0.72rem] font-medium tabular">
              {t}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <BotonEjemplo className="px-2 text-[0.72rem]">
            <Plus /> Cargar novedad
          </BotonEjemplo>
          <BotonEjemplo variante="contorno" className="px-2 text-[0.72rem]">
            <ClipboardList /> Ver la planilla del mes
          </BotonEjemplo>
        </div>
      </div>
    </MarcoPantalla>
  );
}
