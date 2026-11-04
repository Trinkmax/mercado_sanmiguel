import {
  Banknote,
  Camera,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileText,
  Flag,
  FolderOpen,
  Hand,
  Megaphone,
  MessageCircle,
  MessageCircleWarning,
  MessageSquareWarning,
  MessagesSquare,
  PenLine,
  Printer,
  Receipt,
  Send,
  Share2,
  Store,
  Tag,
  Upload,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { MarcoPantalla, Resaltado } from "@/components/tour/pantalla";

// Tour guiado · portal: pantallas de ejemplo de los capítulos del socio (docs/GUIA-TOUR.md).
// Dibujos quietos con datos inventados, en chico y con el mismo lenguaje que el portal: el plano
// en azul, la chapa, el cartel de arco y las hojas de porcelana. Rosa Medina, carpeta 58, puesto
// 54. Los números cierran entre sí: debe $ 939.130 con el beneficio; si se le pasa el 30, debe
// $ 1.080.000. Texto mínimo 0.72rem.

const SELLO = "px-1.5 py-[0.2rem] text-[0.72rem]";

type Tono = "al_dia" | "en_termino" | "vencido";

/** La franja de arriba de cada pantalla: el azul del plano. */
function FondoPortal({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("-m-3 space-y-2 bg-esmalte p-3 text-porcelana", className)}>{children}</div>;
}

function ChapaMini({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-[0.3rem] bg-esmalte-hondo px-1.5 py-0.5 text-[0.72rem] font-extrabold text-white shadow-[inset_0_0_0_1px_var(--esmalte-hondo),inset_0_0_0_1.6px_white]">
      <i className="size-[3px] rounded-full bg-white/80" />
      {children}
      <i className="size-[3px] rounded-full bg-white/80" />
    </span>
  );
}

/** El mercado desde arriba, en chico: una fila de puestos con el tuyo prendido. */
function PlanoMini({ tono, etiqueta = "Puesto 54" }: { tono: Tono; etiqueta?: string }) {
  const numeros = ["58", "56", "54", "52", "50", "48"];
  return (
    <div className={cn("relative pb-1", `tono-${tono}`)}>
      <div className="flex justify-center gap-1 rounded-md border border-white/50 p-1.5">
        {numeros.map((n) => (
          <span
            key={n}
            className={cn(
              "flex h-7 w-8 items-center justify-center rounded-[0.2rem] text-[0.72rem] font-bold",
              n === "54"
                ? "bg-campo font-extrabold text-sobre-campo outline-2 outline-white"
                : "border border-white/40 bg-white/15 text-white/80"
            )}
          >
            {n}
          </span>
        ))}
      </div>
      <div className="mt-1 flex justify-center">
        <ChapaMini>{etiqueta}</ChapaMini>
      </div>
    </div>
  );
}

function CartelMini({ tono, children, className }: { tono: Tono; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative space-y-0.5 bg-campo px-3 pt-3 pb-2.5 text-sobre-campo [border-radius:50%_50%_0.55rem_0.55rem/0.8rem_0.8rem_0.55rem_0.55rem]",
        `tono-${tono}`,
        className
      )}
    >
      {children}
    </div>
  );
}

function BarraMini({ activa, globo = 0 }: { activa: string; globo?: number }) {
  const tabs: { label: string; icono: LucideIcon }[] = [
    { label: "Mi cuenta", icono: Store },
    { label: "Mis pagos", icono: Receipt },
    { label: "Mensajes", icono: MessagesSquare },
    { label: "Mi carpeta", icono: FolderOpen },
  ];
  return (
    <div className="-mx-3 -mb-3 mt-2 grid grid-cols-4 gap-0.5 bg-porcelana p-1 text-tinta">
      {tabs.map((t) => {
        const Icono = t.icono;
        const activo = t.label === activa;
        return (
          <span
            key={t.label}
            className={cn(
              "relative flex flex-col items-center gap-0.5 rounded-md py-1 text-[0.72rem] leading-none font-bold",
              activo && "bg-esmalte text-porcelana"
            )}
          >
            <Icono className="size-3.5" strokeWidth={2.2} />
            {t.label}
            {t.label === "Mensajes" && globo > 0 ? (
              <span className="absolute top-0 right-1.5 flex size-3.5 items-center justify-center rounded-full bg-[oklch(0.56_0.215_27)] text-[0.72rem] leading-none font-bold text-white">
                {globo}
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

function Hoja({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-lg bg-porcelana text-tinta", className)}>{children}</div>;
}

function IconoFila({ icono: Icono }: { icono: LucideIcon }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-[0.3rem] bg-esmalte text-porcelana">
      <Icono className="size-3.5" strokeWidth={2} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Mi cuenta
// ---------------------------------------------------------------------------

function CartelATiempo({ conBeneficio = true }: { conBeneficio?: boolean }) {
  return (
    <CartelMini tono="en_termino">
      <p className="text-[0.8rem] leading-tight font-extrabold">Estás a tiempo</p>
      <Money monto={939130} className="block text-[1.5rem] leading-none font-extrabold [font-stretch:86%]" />
      <p className="text-[0.72rem] leading-snug font-semibold">
        para pagar hasta el <strong className="font-extrabold">lunes 30 de noviembre</strong>
      </p>
      {conBeneficio ? (
        <p className="flex items-center gap-1 pt-0.5 text-[0.72rem] font-semibold">
          <Tag className="size-3 shrink-0" strokeWidth={2.4} />
          Ya incluye tu beneficio de <Money monto={140870} className="font-extrabold" />
        </p>
      ) : null}
    </CartelMini>
  );
}

function CartelVencido() {
  return (
    <CartelMini tono="vencido">
      <p className="text-[0.8rem] leading-tight font-extrabold">Tenés algo vencido</p>
      <Money monto={1080000} className="block text-[1.5rem] leading-none font-extrabold [font-stretch:86%]" />
      <p className="text-[0.72rem] leading-snug font-semibold">se venció el viernes 30 de octubre</p>
    </CartelMini>
  );
}

function CartelAlDia() {
  return (
    <CartelMini tono="al_dia">
      <p className="text-[1.15rem] leading-none font-extrabold [font-stretch:86%]">Estás al día</p>
      <p className="text-[0.72rem] font-semibold">No debés nada. ¡Gracias!</p>
    </CartelMini>
  );
}

/** Portada de «Mi cuenta»: el plano con tu puesto y el cartel. */
export function PortadaSocioCuenta() {
  return (
    <MarcoPantalla titulo="Mi cuenta">
      <FondoPortal>
        <PlanoMini tono="en_termino" />
        <CartelATiempo />
        <BarraMini activa="Mi cuenta" />
      </FondoPortal>
    </MarcoPantalla>
  );
}

/** Los tres colores del cartel, uno debajo del otro. */
export function PantallaColoresCartel() {
  return (
    <MarcoPantalla titulo="Mi cuenta">
      <FondoPortal className="space-y-1.5">
        <CartelAlDia />
        <CartelATiempo conBeneficio={false} />
        <CartelVencido />
      </FondoPortal>
    </MarcoPantalla>
  );
}

/** El mismo mes pagado a tiempo (con el beneficio) y después del vencimiento (sin él). */
export function PantallaBeneficioSocio() {
  return (
    <MarcoPantalla titulo="Mi cuenta">
      <FondoPortal className="space-y-1.5">
        <p className="text-[0.72rem] font-bold">Si pagás a tiempo</p>
        <Resaltado mano={false} className="ring-offset-esmalte">
          <CartelATiempo />
        </Resaltado>
        <p className="pt-1 text-[0.72rem] font-bold">Si se pasa la fecha</p>
        <CartelVencido />
      </FondoPortal>
    </MarcoPantalla>
  );
}

/** Quien paga por semana: el mes en azulejos. */
export function PantallaCuotasSocio() {
  return (
    <MarcoPantalla titulo="Mi cuenta">
      <FondoPortal>
        <CartelMini tono="en_termino" className="space-y-1">
          <p className="text-[0.8rem] leading-tight font-extrabold">Estás a tiempo</p>
          <Money monto={247500} className="block text-[1.5rem] leading-none font-extrabold [font-stretch:86%]" />
          <Resaltado mano={false} className="mt-1 ring-offset-campo">
            <div className="grid grid-cols-4 gap-1">
              {[1, 0, 0, 0].map((lleno, i) => (
                <span
                  key={i}
                  className={cn("h-3.5 -skew-x-[9deg] rounded-[0.15rem] border-[1.5px] border-current", lleno ? "bg-current" : "")}
                />
              ))}
            </div>
          </Resaltado>
          <p className="pt-1 text-[0.72rem] leading-snug font-semibold">
            <strong className="font-extrabold">Pagaste 1 de 4 semanas</strong> · la próxima es de{" "}
            <Money monto={82500} className="font-extrabold" />
          </p>
        </CartelMini>
      </FondoPortal>
    </MarcoPantalla>
  );
}

function FilaConceptoMini({
  icono,
  nombre,
  lugar,
  monto,
  sello,
}: {
  icono: LucideIcon;
  nombre: string;
  lugar: string;
  monto: number;
  sello: string;
}) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <IconoFila icono={icono} />
      <div className="min-w-0 flex-1">
        <p className="text-[0.8rem] leading-tight font-bold">{nombre}</p>
        <p className="text-[0.72rem] leading-tight text-tinta-2">{lugar}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1">
          <Money monto={monto} className="text-[0.8rem] font-extrabold" />
          <Sello estado={sello} className={SELLO} />
        </p>
      </div>
      <ChevronRight className="size-3.5 shrink-0 text-tinta-2" />
    </div>
  );
}

/** «Lo de noviembre»: un renglón por cosa que paga. */
export function PantallaConceptosSocio() {
  return (
    <MarcoPantalla titulo="Mi cuenta">
      <FondoPortal>
        <p className="text-[0.85rem] font-extrabold">Lo de noviembre</p>
        <Hoja className="divide-y divide-border">
          <FilaConceptoMini icono={Store} nombre="Expensas de tu puesto" lugar="Puesto 54" monto={939130} sello="pendiente" />
          <FilaConceptoMini icono={Car} nombre="Tu cochera" lugar="Cochera 12" monto={31000} sello="pagado" />
          <FilaConceptoMini icono={Zap} nombre="Luz" lugar="Puesto 54" monto={76000} sello="parcial" />
        </Hoja>
      </FondoPortal>
    </MarcoPantalla>
  );
}

/** Lo que sube al tocar un renglón: el plano vuela hasta ese lugar. */
export function PantallaHojaConcepto() {
  return (
    <MarcoPantalla titulo="Tu cochera" contenidoClassName="space-y-0 p-0">
      <div className="bg-esmalte p-2 text-porcelana">
        <PlanoMini tono="al_dia" etiqueta="Cochera 12" />
      </div>
      <div className="space-y-1 bg-porcelana p-2.5 text-tinta">
        <p className="text-[0.95rem] leading-tight font-extrabold">Tu cochera</p>
        <div className="flex items-center gap-2">
          <Money monto={31000} className="text-[1.2rem] font-extrabold [font-stretch:88%]" />
          <Sello estado="pagado" className={SELLO} />
        </div>
        <p className="text-[0.72rem]">Ya está pagado. ¡Gracias!</p>
      </div>
    </MarcoPantalla>
  );
}

// ---------------------------------------------------------------------------
// Mis pagos
// ---------------------------------------------------------------------------

const RECIBOS = [
  { numero: 2417, dia: "02", mes: "nov", como: "Efectivo", monto: 51000 },
  { numero: 2290, dia: "28", mes: "oct", como: "Transferencia de Rosa Medina", monto: 556000 },
];

function TalonarioMini({ barra = false }: { barra?: boolean }) {
  return (
    <MarcoPantalla titulo="Mis pagos">
      <FondoPortal>
        <p className="text-[1.05rem] font-extrabold">Mis pagos</p>
        <p className="text-[0.72rem]">
          En noviembre pagaste <Money monto={51000} className="font-extrabold" />.
        </p>
        {RECIBOS.map((r, i) => {
          const talon = (
            <Hoja className="flex items-stretch">
              <span className="flex w-10 shrink-0 flex-col items-center justify-center border-r-2 border-dashed border-border py-1 leading-none">
                <span className="text-[0.95rem] font-extrabold tabular">{r.dia}</span>
                <span className="text-[0.72rem] font-bold text-tinta-2">{r.mes}</span>
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-1 px-2 py-1">
                <span className="min-w-0 flex-1">
                  <Money monto={r.monto} className="block text-[0.85rem] font-extrabold" />
                  <span className="block text-[0.72rem] leading-tight text-tinta-2">
                    {r.como} · Recibo N° {r.numero}
                  </span>
                </span>
                <ChevronRight className="size-3.5 shrink-0 text-tinta-2" />
              </span>
            </Hoja>
          );
          return i === 0 ? (
            <Resaltado key={r.numero} className="ring-offset-esmalte">
              {talon}
            </Resaltado>
          ) : (
            <div key={r.numero}>{talon}</div>
          );
        })}
        {barra ? <BarraMini activa="Mis pagos" /> : null}
      </FondoPortal>
    </MarcoPantalla>
  );
}

/** Portada de «Mis pagos». */
export function PortadaSocioPagos() {
  return <TalonarioMini barra />;
}

/** El talonario: un talón por pago. */
export function PantallaPagosSocio() {
  return <TalonarioMini />;
}

/** El recibo como lo ve el socio: mandarlo, guardarlo y el papel. */
export function PantallaReciboSocio() {
  return (
    <MarcoPantalla titulo="Recibo N° 2417 — Rosa Medina" contenidoClassName="space-y-2 bg-white p-3">
      <Resaltado>
        <span className="flex min-h-8 items-center justify-center gap-1.5 rounded-md bg-esmalte text-[0.8rem] font-extrabold text-porcelana">
          <Share2 className="size-3.5" /> Compartir el recibo
        </span>
      </Resaltado>
      <span className="flex min-h-7 items-center justify-center gap-1.5 rounded-md border border-border text-[0.72rem] font-bold">
        <Printer className="size-3.5" /> Imprimir o guardar en PDF
      </span>
      <div className="etiqueta">
        <div className="etiqueta-interior space-y-2 p-2.5 text-[0.72rem]">
          <div className="flex items-start justify-between gap-2 border-b border-border pb-1.5">
            <p className="font-semibold">Cooperativa Mercado San Miguel</p>
            <p className="shrink-0 text-right font-semibold">Recibo N° 2417</p>
          </div>
          <p>
            <span className="text-muted-foreground">Recibimos de:</span> <strong>Rosa Medina</strong> (Carpeta N° 58)
          </p>
          <div className="flex items-center gap-2 rounded border border-border px-2 py-1">
            <Banknote className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
            <p className="flex-1 font-medium">Efectivo</p>
            <Money monto={51000} className="font-semibold" />
          </div>
          <div className="flex items-baseline justify-between border-t-2 border-foreground pt-1">
            <p className="font-semibold">Total</p>
            <Money monto={51000} className="text-[1.05rem] font-bold" />
          </div>
          <Sello grande estado="pagado" texto="Pago recibido" className="px-1.5 py-0.5 text-[0.72rem]" />
        </div>
      </div>
    </MarcoPantalla>
  );
}

// ---------------------------------------------------------------------------
// Mensajes
// ---------------------------------------------------------------------------

function FilaMensajeMini({
  icono,
  titulo,
  sub,
  sello,
  fuerte = false,
}: {
  icono: LucideIcon;
  titulo: string;
  sub: string;
  sello: string;
  fuerte?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <IconoFila icono={icono} />
      <div className="min-w-0 flex-1">
        <p className={cn("text-[0.8rem] leading-tight", fuerte ? "font-extrabold" : "font-bold")}>{titulo}</p>
        <p className="text-[0.72rem] leading-tight text-tinta-2">{sub}</p>
        <Sello estado={sello} className={cn(SELLO, "mt-0.5")} />
      </div>
      <ChevronRight className="size-3.5 shrink-0 text-tinta-2" />
    </div>
  );
}

function ListaMensajesMini({ resaltar = true }: { resaltar?: boolean }) {
  const primera = (
    <FilaMensajeMini
      icono={MessageSquareWarning}
      titulo="Mercadería en el pasillo"
      sub="Apercibimiento N° 12 · 01/11/2026"
      sello="a_responder"
      fuerte
    />
  );
  return (
    <>
      <p className="text-[1.05rem] font-extrabold">Mensajes</p>
      <span className="flex min-h-8 items-center justify-center gap-1.5 rounded-md bg-porcelana text-[0.8rem] font-extrabold text-esmalte">
        <PenLine className="size-3.5" /> Escribirle a la cooperativa
      </span>
      <p className="pt-1 text-[0.85rem] font-extrabold">Te están esperando</p>
      <Hoja className="divide-y divide-border">
        {resaltar ? <Resaltado className="rounded-t-lg ring-inset ring-offset-0">{primera}</Resaltado> : primera}
        <FilaMensajeMini
          icono={MessageCircle}
          titulo="Se rompió la luminaria"
          sub="Reclamo N° 31 · 02/11 15:30"
          sello="respuesta_nueva"
          fuerte
        />
        <FilaMensajeMini icono={Megaphone} titulo="Horarios de carga" sub="Circular N° 3 · 02/11/2026" sello="nueva_comunicacion" fuerte />
      </Hoja>
    </>
  );
}

/** Portada de «Mensajes»: todo junto, como un chat. */
export function PortadaSocioComunicaciones() {
  return (
    <MarcoPantalla titulo="Mensajes">
      <FondoPortal>
        <ListaMensajesMini resaltar={false} />
        <BarraMini activa="Mensajes" globo={3} />
      </FondoPortal>
    </MarcoPantalla>
  );
}

/** La lista de mensajes, con lo que espera algo arriba y su sello. */
export function PantallaMensajesSocio() {
  return (
    <MarcoPantalla titulo="Mensajes">
      <FondoPortal>
        <ListaMensajesMini />
      </FondoPortal>
    </MarcoPantalla>
  );
}

/** Una circular abierta: se lee y, si trae PDF, se abre ahí. */
export function PantallaCircularSocio() {
  return (
    <MarcoPantalla titulo="Circular N° 3">
      <FondoPortal>
        <p className="flex items-center gap-0.5 text-[0.72rem] font-extrabold">
          <ChevronLeft className="size-3.5" /> Mensajes
        </p>
        <p className="text-[0.95rem] leading-tight font-extrabold">Horarios de carga durante las fiestas</p>
        <Hoja className="space-y-1.5 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <Sello estado="circular" className={SELLO} />
            <p className="text-[0.72rem] text-tinta-2 tabular">02/11/2026</p>
          </div>
          <p className="text-[0.8rem] leading-snug">Durante diciembre la playa abre una hora antes.</p>
          <Resaltado>
            <span className="flex min-h-7 items-center justify-center gap-1.5 rounded-md border-2 border-esmalte text-[0.72rem] font-extrabold text-esmalte">
              <FileText className="size-3.5" /> Abrir el PDF de la circular
            </span>
          </Resaltado>
        </Hoja>
      </FondoPortal>
    </MarcoPantalla>
  );
}

/** Lo que ve el socio al entrar si tiene una circular obligatoria sin confirmar. */
export function PantallaBloqueoCirculares() {
  return (
    <MarcoPantalla titulo="Mercado San Miguel">
      <FondoPortal>
        <p className="text-[0.95rem] leading-tight font-extrabold">Tenés una circular para leer</p>
        <p className="text-[0.72rem] leading-snug">
          Leela y tocá <strong>Confirmo que la recibí</strong>. Después ves tu cuenta como siempre.
        </p>
        <Hoja className="space-y-1.5 p-2.5">
          <Sello estado="sin_recibir" className={SELLO} />
          <p className="text-[0.85rem] leading-tight font-extrabold">Asamblea anual de socios</p>
          <p className="text-[0.72rem] leading-snug">Viernes 28 a las 18, en el salón de la cooperativa.</p>
          <Resaltado>
            <span className="flex min-h-8 items-center justify-center gap-1.5 rounded-md bg-esmalte text-[0.8rem] font-extrabold text-porcelana">
              <CheckCircle2 className="size-3.5" /> Confirmo que la recibí
            </span>
          </Resaltado>
        </Hoja>
      </FondoPortal>
    </MarcoPantalla>
  );
}

/** Un apercibimiento abierto: qué pasó, la multa y «Contá tu versión». */
export function PantallaDescargoSocio() {
  return (
    <MarcoPantalla titulo="Apercibimiento N° 12">
      <FondoPortal>
        <p className="text-[0.95rem] leading-tight font-extrabold">Mercadería en el pasillo</p>
        <Hoja className="space-y-1 p-2.5">
          <Sello estado="apercibimiento" className={SELLO} />
          <p className="text-[0.8rem] leading-snug">El jueves quedaron cajones en el pasillo central toda la mañana.</p>
        </Hoja>
        <div className="space-y-0.5 rounded-lg bg-pendiente-suave p-2.5 text-tinta">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[0.72rem] font-extrabold">Multa</p>
            <Sello estado="multa" texto="Multa pendiente" className={SELLO} />
          </div>
          <Money monto={25000} className="block text-[1.1rem] font-extrabold text-pendiente" />
          <p className="text-[0.72rem]">Se sumó a tu cuenta. Vence el 11/11/2026.</p>
        </div>
        <Resaltado className="ring-offset-esmalte">
          <Hoja className="space-y-1 p-2.5">
            <p className="text-[0.85rem] font-extrabold">Contá tu versión</p>
            <div className="min-h-8 rounded-md border border-border px-2 py-1 text-[0.72rem] text-tinta-2">Contá tu versión…</div>
            <div className="flex gap-1">
              <span className="flex min-h-7 flex-1 items-center justify-center gap-1 rounded-md border-2 border-esmalte text-[0.72rem] font-bold text-esmalte">
                <Camera className="size-3" /> Sumar una foto
              </span>
              <span className="flex min-h-7 items-center justify-center gap-1 rounded-md bg-esmalte px-2 text-[0.72rem] font-extrabold text-porcelana">
                <Send className="size-3" /> Enviar mi versión
              </span>
            </div>
          </Hoja>
        </Resaltado>
      </FondoPortal>
    </MarcoPantalla>
  );
}

// ---------------------------------------------------------------------------
// Escribirle a la cooperativa
// ---------------------------------------------------------------------------

/** Portada: el botón para escribir y una conversación. */
export function PortadaSocioSolicitudes() {
  return (
    <MarcoPantalla titulo="Mensajes">
      <FondoPortal>
        <span className="flex min-h-8 items-center justify-center gap-1.5 rounded-md bg-porcelana text-[0.8rem] font-extrabold text-esmalte">
          <PenLine className="size-3.5" /> Escribirle a la cooperativa
        </span>
        <ChatMini />
      </FondoPortal>
    </MarcoPantalla>
  );
}

/** «¿Qué querés hacer?»: las cuatro opciones. */
export function PantallaSocioTipo() {
  const opciones: { icono: LucideIcon; titulo: string; ayuda: string }[] = [
    { icono: CircleHelp, titulo: "Preguntar algo", ayuda: "Una duda que necesita respuesta" },
    { icono: Hand, titulo: "Pedir algo", ayuda: "Un cambio, un permiso, un espacio" },
    { icono: MessageCircleWarning, titulo: "Hacer un reclamo", ayuda: "Algo no está bien" },
    { icono: Flag, titulo: "Avisar de algo", ayuda: "Algo que pasó" },
  ];
  return (
    <MarcoPantalla titulo="Escribirle a la cooperativa">
      <p className="text-[0.95rem] font-extrabold">¿Qué querés hacer?</p>
      <Hoja className="divide-y divide-border border border-border">
        {opciones.map((o) => (
          <div key={o.titulo} className="flex items-center gap-2 px-2 py-1.5">
            <IconoFila icono={o.icono} />
            <div>
              <p className="text-[0.8rem] leading-tight font-bold">{o.titulo}</p>
              <p className="text-[0.72rem] leading-tight text-tinta-2">{o.ayuda}</p>
            </div>
          </div>
        ))}
      </Hoja>
    </MarcoPantalla>
  );
}

/** Un solo cuadro para escribir, la foto y «Enviar». */
export function PantallaSocioContar() {
  return (
    <MarcoPantalla titulo="Escribirle a la cooperativa">
      <p className="text-[0.95rem] font-extrabold">¿Qué pasa?</p>
      <Resaltado mano={false}>
        <div className="min-h-16 rounded-md border border-border bg-white px-2 py-1.5 text-[0.8rem] leading-snug">
          Se rompió la luminaria frente al puesto 54. Desde el lunes estamos a oscuras a la mañana.
        </div>
      </Resaltado>
      <span className="flex min-h-7 items-center justify-center gap-1 rounded-md border-2 border-esmalte text-[0.72rem] font-bold text-esmalte">
        <Camera className="size-3" /> Sumar una foto (si querés)
      </span>
      <Resaltado>
        <span className="flex min-h-8 items-center justify-center gap-1.5 rounded-md bg-esmalte text-[0.8rem] font-extrabold text-porcelana">
          <Send className="size-3.5" /> Enviar
        </span>
      </Resaltado>
    </MarcoPantalla>
  );
}

function ChatMini() {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-porcelana-2 p-2 text-tinta">
      <p className="ml-auto max-w-[85%] rounded-lg rounded-br-sm bg-esmalte px-2 py-1 text-[0.8rem] leading-snug text-porcelana">
        Se rompió la luminaria frente al puesto 54.
      </p>
      <p className="self-center rounded-full bg-[oklch(0.91_0.018_265)] px-2 py-0.5 text-[0.72rem]">
        Líder de Procesos tomó la solicitud
      </p>
      <div className="max-w-[85%] rounded-lg rounded-bl-sm bg-white px-2 py-1 text-[0.8rem] leading-snug">
        <p className="text-[0.72rem] font-extrabold text-esmalte">Líder de Procesos</p>
        Gracias por avisar. Mañana pasa el electricista.
      </div>
    </div>
  );
}

/** En qué está: el sello, qué quiere decir y por dónde va. */
export function PantallaSocioEstado() {
  return (
    <MarcoPantalla titulo="Reclamo N° 31">
      <FondoPortal>
        <Hoja className="space-y-1 p-2.5">
          <Sello estado="en_revision" className={SELLO} />
          <p className="text-[0.8rem] leading-snug">Lo está revisando el Líder de Procesos.</p>
          <p className="text-[0.72rem] font-bold text-esmalte underline">Ver por dónde va</p>
        </Hoja>
      </FondoPortal>
    </MarcoPantalla>
  );
}

/** La conversación: lo tuyo a la derecha y lo de ellos a la izquierda. */
export function PantallaSocioRespuesta() {
  return (
    <MarcoPantalla titulo="Reclamo N° 31">
      <ChatMini />
    </MarcoPantalla>
  );
}

// ---------------------------------------------------------------------------
// Mi carpeta
// ---------------------------------------------------------------------------

/** Portada de «Mi carpeta». */
export function PortadaSocioCarpeta() {
  return (
    <MarcoPantalla titulo="Mi carpeta">
      <FondoPortal>
        <p className="text-[1.05rem] font-extrabold">Mi carpeta</p>
        <ChapaMini>Carpeta N° 58</ChapaMini>
        <Hoja className="divide-y divide-border">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <IconoFila icono={Store} />
            <p className="flex-1 text-[0.8rem] font-bold">Puesto 54</p>
            <ChevronRight className="size-3.5 text-tinta-2" />
          </div>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <IconoFila icono={Car} />
            <p className="flex-1 text-[0.8rem] font-bold">Cochera 12</p>
            <ChevronRight className="size-3.5 text-tinta-2" />
          </div>
        </Hoja>
        <BarraMini activa="Mi carpeta" />
      </FondoPortal>
    </MarcoPantalla>
  );
}

/** Lo que sube al tocar un lugar. */
export function PantallaLugarSocio() {
  return <PantallaHojaConcepto />;
}

/** Subir un papel: qué es y la foto. */
export function PantallaSubirDocumentoSocio() {
  return (
    <MarcoPantalla titulo="Subir un papel">
      <p className="text-[0.95rem] font-extrabold">¿Qué papel es?</p>
      <div className="grid grid-cols-2 gap-1">
        {["Habilitación municipal", "SENASA", "Apto eléctrico", "Otro"].map((c, i) => (
          <span
            key={c}
            className={cn(
              "flex min-h-8 items-center justify-center rounded-md px-1 text-center text-[0.72rem] leading-tight font-bold",
              i === 0 ? "bg-esmalte text-porcelana" : "bg-porcelana-2 text-tinta"
            )}
          >
            {c}
          </span>
        ))}
      </div>
      <span className="flex min-h-7 items-center justify-center gap-1 rounded-md border-2 border-esmalte text-[0.72rem] font-bold text-esmalte">
        <Camera className="size-3" /> Foto de la habilitación.jpg
      </span>
      <Resaltado>
        <span className="flex min-h-8 items-center justify-center gap-1.5 rounded-md bg-esmalte text-[0.8rem] font-extrabold text-porcelana">
          <Upload className="size-3.5" /> Subir
        </span>
      </Resaltado>
    </MarcoPantalla>
  );
}
