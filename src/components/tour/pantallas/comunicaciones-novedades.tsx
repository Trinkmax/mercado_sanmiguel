import {
  ArrowLeft,
  Ban,
  Bell,
  BellOff,
  CalendarCheck,
  Camera,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Eye,
  FileSignature,
  FileText,
  Gavel,
  Inbox,
  MapPin,
  Megaphone,
  MessageSquareWarning,
  Paperclip,
  Palmtree,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Send,
  Stethoscope,
  StickyNote,
  TimerReset,
  Trash2,
  Users,
  UserPlus,
  UserX,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import {
  BotonEjemplo,
  CampoEjemplo,
  FilaEjemplo,
  MarcoPantalla,
  Resaltado,
} from "@/components/tour/pantalla";

// Tour guiado · comunicaciones-novedades: pantallas de ejemplo (docs/GUIA-TOUR.md).
// Dibujos quietos, con datos inventados, parecidos a las pantallas reales en chico.

/** Sello en tamaño de pantalla de ejemplo. */
const SELLO = "px-1.5 py-[0.2rem] text-[0.72rem]";

// ---------------------------------------------------------------------------
// Piezas chicas
// ---------------------------------------------------------------------------

/** "La vieron X de Y": verde sobre rojo suave y, al final, gris rayado (sin portal). */
function BarraVieron({ vieron, total, sinPortal = 0 }: { vieron: number; total: number; sinPortal?: number }) {
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-pendiente-suave">
      <div className="h-full rounded-full bg-pagado" style={{ width: `${(vieron / total) * 100}%` }} />
      {sinPortal > 0 ? (
        <div
          className="absolute inset-y-0 right-0 bg-muted-foreground/25"
          style={{ width: `${(sinPortal / total) * 100}%` }}
        />
      ) : null}
    </div>
  );
}

const PESTANAS_STAFF = [
  { label: "Circulares", icono: Megaphone },
  { label: "Notificaciones", icono: Bell },
  { label: "Apercibimientos", icono: MessageSquareWarning },
  { label: "Sanciones", icono: Gavel },
  { label: "Términos", icono: FileSignature },
];

/** Las pestañas grandes de Comunicaciones (panel). */
function PestanasStaff({ activa, rojo }: { activa: string; rojo?: { pestana: string; n: number } }) {
  return (
    <div className="flex flex-wrap gap-1">
      {PESTANAS_STAFF.map((p) => {
        const Icono = p.icono;
        const esActiva = p.label === activa;
        return (
          <span
            key={p.label}
            className={cn(
              "inline-flex min-h-6 items-center gap-1 rounded-md border px-1.5 text-[0.72rem] font-medium",
              esActiva ? "border-primary bg-primary text-primary-foreground" : "bg-card"
            )}
          >
            <Icono className="size-3 shrink-0" strokeWidth={2} />
            {p.label}
            {rojo && rojo.pestana === p.label ? (
              <span className="inline-flex size-4 items-center justify-center rounded-full bg-pendiente text-[0.72rem] font-bold text-primary-foreground">
                {rojo.n}
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

const PESTANAS_SOCIO = [
  { label: "Circulares", icono: Megaphone },
  { label: "Notificaciones", icono: Bell },
  { label: "Apercibimientos", icono: MessageSquareWarning },
  { label: "Sanciones", icono: Gavel },
];

/** Las pestañas del portal: 2 × 2 en el celular, con el número de nuevas. */
function PestanasSocio({ activa, nuevas = {} }: { activa: string; nuevas?: Record<string, number> }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {PESTANAS_SOCIO.map((p) => {
        const Icono = p.icono;
        const n = nuevas[p.label] ?? 0;
        return (
          <span
            key={p.label}
            className={cn(
              "flex min-h-8 items-center gap-1.5 rounded-lg border px-2 text-[0.75rem] font-semibold",
              p.label === activa ? "border-primary bg-accent ring-2 ring-primary/30" : "bg-card"
            )}
          >
            <Icono className="size-3.5 shrink-0 text-primary" strokeWidth={2} />
            <span className="min-w-0 flex-1 truncate">{p.label}</span>
            {n > 0 ? (
              <span className="inline-flex size-4.5 items-center justify-center rounded-full bg-parcial text-[0.72rem] font-bold text-primary-foreground">
                {n}
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

/** Los tres pasos de un aviso: Notificado → (respuesta o descargo) → Respondido. */
function LineaEstado({ pasos, actual }: { pasos: [string, string, string]; actual: number }) {
  return (
    <div className="flex items-start">
      {pasos.map((p, i) => {
        const hecho = i <= actual;
        return (
          <div key={p} className="flex min-w-0 flex-1 flex-col items-center text-center">
            <div className="flex w-full items-center">
              <span className={cn("h-0.5 flex-1", i === 0 ? "invisible" : hecho ? "bg-primary" : "bg-border")} />
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border-2 text-[0.72rem] font-bold",
                  hecho ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground",
                  i === actual && "ring-2 ring-primary/25"
                )}
              >
                {hecho ? <Check className="size-3" strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={cn(
                  "h-0.5 flex-1",
                  i === pasos.length - 1 ? "invisible" : i < actual ? "bg-primary" : "bg-border"
                )}
              />
            </div>
            <p
              className={cn(
                "mt-1 px-0.5 text-[0.72rem] leading-tight",
                i === actual ? "font-semibold" : hecho ? "text-foreground/80" : "text-muted-foreground"
              )}
            >
              {p}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/** Un chip de opción (Hoy, Ayer, Sí, No…). */
function Chip({ children, activo = false }: { children: React.ReactNode; activo?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1 rounded-full border px-2 text-[0.72rem] font-semibold",
        activo ? "border-primary bg-primary text-primary-foreground" : "bg-card"
      )}
    >
      {activo ? <Check className="size-3" strokeWidth={3} /> : null}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Comunicaciones (Administración y Líder)
// ---------------------------------------------------------------------------

function FilaCircular({
  numero,
  titulo,
  publico,
  obligatoria,
  vieron,
  total,
}: {
  numero: number;
  titulo: string;
  publico: string;
  obligatoria: boolean;
  vieron: number;
  total: number;
}) {
  return (
    <div className="flex items-start gap-2 px-2.5 py-2">
      <span className="w-5 shrink-0 text-right font-display text-[0.85rem] font-bold tabular">{numero}</span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="leading-snug font-semibold">{titulo}</p>
        <div className="flex flex-wrap items-center gap-1 text-[0.72rem] text-muted-foreground">
          <span className="rounded-full border bg-muted/60 px-1.5 font-medium text-foreground">{publico}</span>
          <span
            className={cn(
              "rounded-full border px-1.5 font-medium",
              obligatoria ? "border-parcial/40 bg-parcial-suave text-parcial" : "bg-muted"
            )}
          >
            {obligatoria ? "Obligatoria" : "Informativa"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <p className="shrink-0 text-[0.72rem] tabular">
            La vieron{" "}
            <span className={cn("font-semibold", vieron >= total ? "text-pagado" : "text-foreground")}>{vieron}</span> de{" "}
            {total}
          </p>
          <BarraVieron vieron={vieron} total={total} />
        </div>
      </div>
      <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
    </div>
  );
}

/** Portada de "Comunicaciones": las pestañas y la lista de circulares con "La vieron X de Y". */
export function PortadaComunicaciones() {
  return (
    <MarcoPantalla titulo="Comunicaciones">
      <PestanasStaff activa="Circulares" rojo={{ pestana: "Apercibimientos", n: 1 }} />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.72rem] text-muted-foreground">Avisos por grupo: ves quién la vio y quién no.</p>
        <Resaltado mano={false} className="shrink-0">
          <BotonEjemplo className="min-h-7 px-2 text-[0.75rem]">
            <Plus /> Nueva circular
          </BotonEjemplo>
        </Resaltado>
      </div>
      <div className="divide-y overflow-hidden rounded-lg border bg-card">
        <FilaCircular numero={12} titulo="Horario de carga y descarga" publico="Todos los clientes" obligatoria vieron={30} total={42} />
        <FilaCircular numero={11} titulo="Corte de luz del domingo" publico="Galpones" obligatoria={false} vieron={9} total={9} />
      </div>
    </MarcoPantalla>
  );
}

function FilaLector({
  codigo,
  nombre,
  apodo,
  estado,
  cuando,
}: {
  codigo: number;
  nombre: string;
  apodo?: string;
  estado: "la_vio" | "no_la_vio" | "sin_portal";
  cuando?: string;
}) {
  return (
    <div className="flex items-start gap-2 px-2.5 py-1.5">
      <span className="w-6 shrink-0 text-right font-display text-[0.8rem] font-bold tabular">{codigo}</span>
      <div className="min-w-0 flex-1">
        <p className="leading-snug font-medium">
          {nombre}
          {apodo ? <span className="font-normal text-muted-foreground"> · {apodo}</span> : null}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5">
          <Sello estado={estado} className={SELLO} />
          {cuando ? <span className="text-[0.72rem] text-muted-foreground tabular">{cuando}</span> : null}
        </p>
      </div>
    </div>
  );
}

/** La circular publicada: "La vieron X de Y" y quién la vio y quién todavía no. */
export function PantallaQuienLaVio() {
  return (
    <MarcoPantalla titulo="Circular N° 12">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 text-[0.72rem] text-muted-foreground">Horario de carga y descarga</p>
        <BotonEjemplo variante="contorno" className="min-h-6 shrink-0 px-2 text-[0.72rem] text-destructive">
          <BellOff /> Desactivar
        </BotonEjemplo>
      </div>
      <Resaltado className="space-y-1.5 rounded-lg border bg-card p-2.5">
        <div className="flex flex-wrap items-end justify-between gap-1.5">
          <p className="font-display text-[1.05rem] font-bold tabular">
            La vieron 30 <span className="text-muted-foreground">de 42</span>
          </p>
          <span className="rounded-full border border-parcial/40 bg-parcial-suave px-1.5 text-[0.72rem] font-medium text-parcial">
            Obligatoria
          </span>
        </div>
        <BarraVieron vieron={30} total={42} sinPortal={3} />
        <p className="text-[0.72rem] text-muted-foreground">
          Faltan 12: 3 no tienen usuario del portal (avisales en persona). Al entrar al portal no ven su cuenta hasta
          confirmarla.
        </p>
      </Resaltado>
      <p className="flex items-center gap-1 pt-1 font-display text-[0.8rem] font-bold">
        <Eye className="size-3.5 text-pagado" /> La vieron <span className="font-normal text-muted-foreground">(30)</span>
      </p>
      <div className="divide-y rounded-lg border bg-card">
        <FilaLector codigo={58} nombre="Carlos Pereyra" apodo="Pocho" estado="la_vio" cuando="29/09 10:15" />
      </div>
      <p className="flex items-center gap-1 pt-1 font-display text-[0.8rem] font-bold">
        <Users className="size-3.5 text-pendiente" /> Todavía no <span className="font-normal text-muted-foreground">(12)</span>
      </p>
      <div className="divide-y rounded-lg border bg-card">
        <FilaLector codigo={9} nombre="Rosa Gutiérrez" apodo="La Colorada" estado="no_la_vio" />
      </div>
      <p className="flex items-center gap-1 text-[0.72rem] font-semibold text-parcial">
        <UserX className="size-3.5" /> Sin usuario del portal (3) — avisales en persona
      </p>
      <div className="divide-y rounded-lg border bg-card">
        <FilaLector codigo={112} nombre="Ramón Sosa" apodo="Don Ramón" estado="sin_portal" />
      </div>
    </MarcoPantalla>
  );
}

/** El formulario de un aviso para un cliente: a quién, qué es, qué pasó y cómo lo ve el socio. */
export function PantallaNuevoRegistro() {
  return (
    <MarcoPantalla titulo="Nueva notificación">
      <p className="font-display text-[0.8rem] font-bold">¿A quién?</p>
      <div className="flex items-center gap-2 rounded-lg border-2 border-primary/40 bg-accent/50 px-2.5 py-2">
        <div className="min-w-0 flex-1">
          <p className="leading-snug font-semibold">
            Carlos Pereyra <span className="font-normal text-muted-foreground">· Pocho</span>
          </p>
          <p className="text-[0.72rem] text-muted-foreground">Carpeta N° 58 · Al día</p>
        </div>
        <BotonEjemplo variante="contorno" className="min-h-6 px-2 text-[0.72rem]">
          Cambiar
        </BotonEjemplo>
      </div>
      <p className="font-display text-[0.8rem] font-bold">¿Qué es?</p>
      <div className="flex flex-wrap gap-1">
        {(["notificacion", "apercibimiento", "sancion"] as const).map((t) => (
          <span
            key={t}
            className={cn(
              "flex min-h-7 items-center gap-1 rounded-md border px-1.5",
              t === "notificacion" ? "border-primary bg-accent ring-2 ring-primary/30" : "bg-card"
            )}
          >
            <Sello estado={t} className={SELLO} />
            {t === "notificacion" ? <Check className="size-3 text-primary" strokeWidth={3} /> : null}
          </span>
        ))}
      </div>
      <CampoEjemplo etiqueta="Título" valor="Limpieza del puesto" />
      <div className="space-y-1 rounded-lg border bg-muted/30 p-2">
        <p className="flex items-center gap-1 text-[0.72rem] font-semibold">
          <Eye className="size-3 text-primary" /> Así lo ve el socio
        </p>
        <div className="space-y-1 rounded-md border bg-card p-2">
          <div className="flex gap-1">
            <Sello estado="notificacion" className={SELLO} />
            <Sello estado="nueva_comunicacion" className={SELLO} />
          </div>
          <p className="font-semibold">Limpieza del puesto</p>
          <p className="text-[0.72rem] text-muted-foreground">Abajo tiene un botón para responder.</p>
        </div>
      </div>
      <Resaltado>
        <BotonEjemplo className="w-full">
          <Send /> Notificar a Carlos Pereyra (Puesto 58)
        </BotonEjemplo>
      </Resaltado>
    </MarcoPantalla>
  );
}

/** Un aviso ya mandado: su recorrido, si el socio lo abrió y la multa. */
export function PantallaSeguimientoRegistro() {
  return (
    <MarcoPantalla titulo="Apercibimiento N° 3">
      <div className="flex flex-wrap items-center gap-1">
        <p className="mr-1 font-semibold">Mercadería en el pasillo</p>
        <Sello estado="apercibimiento" className={SELLO} />
        <Sello estado="descargo" className={SELLO} />
      </div>
      <FilaEjemplo className="block space-y-0.5">
        <p className="text-[0.72rem] text-muted-foreground">Para</p>
        <p className="leading-snug font-semibold">Carlos Pereyra</p>
        <p className="flex items-center gap-1 text-[0.72rem]">
          <MapPin className="size-3 text-primary" /> Carpeta N° 58 · Pocho · Puesto 58
        </p>
      </FilaEjemplo>
      <Resaltado className="space-y-2 rounded-lg border bg-card p-2.5">
        <LineaEstado pasos={["Notificado", "Descargo presentado", "Respondido"]} actual={1} />
        <p className="flex items-center gap-1 border-t pt-1.5 text-[0.72rem]">
          <Eye className="size-3.5 text-pagado" /> Visto por el socio el <span className="font-semibold tabular">28/09 18:40</span>
        </p>
      </Resaltado>
      <div className="space-y-1 rounded-lg border-2 border-pendiente/30 bg-pendiente-suave p-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[0.72rem] font-medium text-muted-foreground">Multa</p>
          <Sello estado="multa" texto="Multa pendiente" className={SELLO} />
        </div>
        <Money monto={25000} className="block font-display text-[1.1rem] font-bold text-pendiente" />
        <p className="text-[0.72rem]">Está en su cuenta como un cargo más. Vence el 10/10/2026.</p>
      </div>
    </MarcoPantalla>
  );
}

/** El descargo del socio y el recuadro para contestarle. */
export function PantallaDescargo() {
  return (
    <MarcoPantalla titulo="Apercibimiento N° 3">
      <p className="font-display text-[0.85rem] font-bold">Descargo y respuestas</p>
      <div className="max-w-[88%] rounded-lg border border-parcial/40 bg-parcial-suave/50 px-2.5 py-2">
        <p className="flex flex-wrap items-baseline gap-x-1.5 text-[0.72rem]">
          <span className="font-semibold">Carlos Pereyra</span>
          <span className="text-muted-foreground">Descargo</span>
          <span className="text-muted-foreground tabular">30/09 09:12</span>
        </p>
        <p className="leading-snug">Los cajones eran del proveedor. Ya los saqué a la mañana temprano.</p>
        <span className="mt-1 inline-flex min-h-6 items-center gap-1 rounded-md border bg-card px-2 text-[0.72rem] font-medium">
          <Paperclip className="size-3" /> Ver adjunto
        </span>
      </div>
      <Resaltado className="space-y-1.5 rounded-lg border-2 border-pendiente/40 bg-card p-2.5">
        <p className="font-semibold">Carlos Pereyra espera tu respuesta</p>
        <div className="min-h-10 rounded-md border bg-card px-2 py-1 text-[0.75rem] text-muted-foreground/70">
          Respondé su descargo…
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex min-h-6 items-center gap-1 rounded-md border bg-card px-2 text-[0.72rem] font-medium">
            <Paperclip className="size-3" /> Adjuntar foto o PDF
          </span>
          <BotonEjemplo className="min-h-7 px-2 text-[0.75rem]">
            <Send /> Enviar respuesta
          </BotonEjemplo>
        </div>
      </Resaltado>
    </MarcoPantalla>
  );
}

// ---------------------------------------------------------------------------
// Novedades del personal
// ---------------------------------------------------------------------------

function BarraHorasEjemplo({ registro, deberia, nivel }: { registro: number; deberia: number; nivel: "pagado" | "parcial" | "pendiente" }) {
  const pct = Math.round((registro / deberia) * 100);
  return (
    <div className="space-y-1">
      <p className="text-[0.72rem]">
        Registró <span className="font-display text-[0.85rem] font-bold tabular">{registro} h</span> de{" "}
        <span className="font-semibold tabular">{deberia} h</span>{" "}
        <span
          className={cn(
            "font-semibold tabular",
            nivel === "pagado" ? "text-pagado" : nivel === "parcial" ? "text-parcial" : "text-pendiente"
          )}
        >
          {pct} %
        </span>
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            nivel === "pagado" ? "bg-pagado" : nivel === "parcial" ? "bg-parcial" : "bg-pendiente"
          )}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

function ContadorEjemplo({ icono: Icono, children }: { icono: typeof UserX; children: React.ReactNode }) {
  return (
    <span className="inline-flex min-h-5 items-center gap-1 rounded-full border bg-card px-1.5 text-[0.72rem]">
      <Icono className="size-3 text-muted-foreground" /> {children}
    </span>
  );
}

function SelectorMesEjemplo() {
  return (
    <div className="flex items-center gap-1.5">
      <span className="flex size-6 items-center justify-center rounded-md border bg-card">
        <ChevronLeft className="size-3.5" />
      </span>
      <p className="min-w-28 text-center font-display text-[0.9rem] font-bold">Septiembre 2026</p>
      <span className="flex size-6 items-center justify-center rounded-md border bg-card text-muted-foreground/40">
        <ChevronRight className="size-3.5" />
      </span>
    </div>
  );
}

function EncabezadoEmpleado({ nombre, sector }: { nombre: string; sector: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <p className="font-semibold">{nombre}</p>
      <span className="rounded-full border bg-muted px-1.5 text-[0.72rem] font-semibold text-foreground/80">{sector}</span>
    </div>
  );
}

function PlanillaPortada({ soloPorteria }: { soloPorteria: boolean }) {
  return (
    <MarcoPantalla titulo="Novedades del personal">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <BotonEjemplo variante="contorno" className="min-h-7 px-2 text-[0.72rem]">
          <Printer /> Imprimir planilla
        </BotonEjemplo>
        <Resaltado mano={false}>
          <BotonEjemplo className="min-h-7 px-2 text-[0.75rem]">
            <Plus /> Cargar novedad
          </BotonEjemplo>
        </Resaltado>
      </div>
      <SelectorMesEjemplo />
      <div className="divide-y overflow-hidden rounded-lg border bg-card">
        <div className="space-y-1.5 px-2.5 py-2">
          <EncabezadoEmpleado nombre="Sosa, Walter" sector="Portería" />
          <BarraHorasEjemplo registro={162} deberia={176} nivel="parcial" />
          <div className="flex flex-wrap gap-1">
            <ContadorEjemplo icono={UserX}>1 falta</ContadorEjemplo>
            <ContadorEjemplo icono={Clock}>1 llegada tarde · 15 min</ContadorEjemplo>
          </div>
        </div>
        {soloPorteria ? (
          <div className="space-y-1.5 px-2.5 py-2">
            <EncabezadoEmpleado nombre="Pérez, Juan" sector="Portería" />
            <BarraHorasEjemplo registro={181} deberia={176} nivel="pagado" />
            <div className="flex flex-wrap gap-1">
              <ContadorEjemplo icono={TimerReset}>2 h extra</ContadorEjemplo>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5 px-2.5 py-2">
            <EncabezadoEmpleado nombre="Gómez, Ana" sector="Limpieza" />
            <BarraHorasEjemplo registro={180} deberia={176} nivel="pagado" />
            <p className="text-[0.72rem] text-muted-foreground">Sin novedades aprobadas</p>
          </div>
        )}
      </div>
    </MarcoPantalla>
  );
}

/** Portada de "Novedades": el mes, la planilla con las horas y los contadores de cada empleado. */
export function PortadaNovedades() {
  return <PlanillaPortada soloPorteria={false} />;
}

/** Portada de "Novedades" del Jefe de Portería: ve solo al personal de Portería. */
export function PortadaNovedadesJefe() {
  return <PlanillaPortada soloPorteria />;
}

function NovedadEjemplo({
  icono: Icono,
  nombre,
  estado,
  frase,
  pie,
  children,
}: {
  icono: typeof UserX;
  nombre?: string;
  estado: "aprobada" | "pendiente_aprobacion" | "rechazada";
  frase: string;
  pie: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-2 py-2">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icono className="size-3.5 text-foreground/80" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1">
          {nombre ? <span className="font-semibold">{nombre}</span> : null}
          <Sello estado={estado} className={SELLO} />
        </div>
        <p className="leading-snug">{frase}</p>
        <p className="text-[0.72rem] text-muted-foreground">{pie}</p>
        {children ? <div className="flex flex-wrap gap-1 pt-0.5">{children}</div> : null}
      </div>
    </div>
  );
}

/** La bandeja de Administración: lo que cargó el Jefe de Portería y espera el OK. */
export function PantallaBandeja() {
  return (
    <MarcoPantalla titulo="Novedades del personal">
      <div className="space-y-2 rounded-lg border border-parcial/40 bg-parcial-suave/70 p-2.5">
        <div className="flex items-start gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-card text-parcial">
            <Inbox className="size-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display leading-snug font-bold">2 novedades del Jefe de Portería esperan tu OK</p>
            <p className="text-[0.72rem] text-muted-foreground">Hasta que las apruebes no cuentan en la planilla.</p>
          </div>
        </div>
        <BotonEjemplo className="min-h-7 px-2 text-[0.75rem]">
          <CheckCheck /> Aprobar todas (2)
        </BotonEjemplo>
        <div className="divide-y rounded-md border bg-card px-2.5">
          <NovedadEjemplo
            icono={Clock}
            nombre="Sosa, Walter"
            estado="pendiente_aprobacion"
            frase="Llegó 15 min tarde el lunes 28 de septiembre (justificada)"
            pie="Cargó Hugo Díaz · 28/09 07:20"
          >
            <Resaltado>
              <BotonEjemplo className="min-h-6 px-2 text-[0.72rem]">
                <Check /> Aprobar
              </BotonEjemplo>
            </Resaltado>
            <BotonEjemplo variante="contorno" className="min-h-6 px-2 text-[0.72rem] text-pendiente">
              <X /> Rechazar
            </BotonEjemplo>
          </NovedadEjemplo>
          <NovedadEjemplo
            icono={TimerReset}
            nombre="Pérez, Juan"
            estado="pendiente_aprobacion"
            frase="Hizo 2 h extra el sábado 26 de septiembre"
            pie="Cargó Hugo Díaz · 26/09 19:05"
          />
        </div>
      </div>
    </MarcoPantalla>
  );
}

const TIPOS_EJEMPLO = [
  { label: "Faltó", icono: UserX },
  { label: "Llegó tarde", icono: Clock },
  { label: "Trabajó un feriado", icono: CalendarCheck, ayuda: "Se paga doble" },
  { label: "Vacaciones", icono: Palmtree },
  { label: "Licencia", icono: Stethoscope, ayuda: "Enfermedad, examen, familiar…" },
  { label: "Horas extra", icono: TimerReset },
  { label: "Otra", icono: StickyNote },
];

/** "¿Qué pasó?": las siete opciones y, al elegir una, lo que pregunta. */
export function PantallaQuePaso() {
  return (
    <MarcoPantalla titulo="Cargar novedad">
      <p className="font-display text-[0.8rem] font-bold">¿A quién?</p>
      <span className="inline-flex min-h-6 items-center gap-1 rounded-full border border-primary/40 bg-accent px-2 text-[0.72rem] font-semibold">
        Walter Sosa <X className="size-3" />
      </span>
      <p className="font-display text-[0.8rem] font-bold">¿Qué pasó?</p>
      <Resaltado className="grid grid-cols-2 gap-1">
        {TIPOS_EJEMPLO.map((t) => {
          const Icono = t.icono;
          const activo = t.label === "Faltó";
          return (
            <span
              key={t.label}
              className={cn(
                "flex min-h-8 items-center gap-1.5 rounded-md border px-2 py-1",
                activo ? "border-primary bg-primary text-primary-foreground" : "bg-card"
              )}
            >
              <Icono className="size-3.5 shrink-0" />
              <span className="min-w-0">
                <span className="block text-[0.75rem] leading-tight font-semibold">{t.label}</span>
                {t.ayuda ? (
                  <span className={cn("block text-[0.72rem] leading-tight", activo ? "" : "text-muted-foreground")}>
                    {t.ayuda}
                  </span>
                ) : null}
              </span>
            </span>
          );
        })}
      </Resaltado>
      <div className="space-y-1.5 rounded-lg border bg-card p-2">
        <p className="text-[0.75rem] font-medium">¿Qué día?</p>
        <div className="flex gap-1">
          <Chip activo>Hoy</Chip>
          <Chip>Ayer</Chip>
          <Chip>Otro día</Chip>
        </div>
        <p className="text-[0.75rem] font-medium">¿Está justificada?</p>
        <div className="flex gap-1">
          <Chip activo>Sí, justificada</Chip>
          <Chip>No</Chip>
        </div>
      </div>
    </MarcoPantalla>
  );
}

function FraseConfirmacion({ verbo, aviso }: { verbo: string; aviso?: string }) {
  return (
    <div className="rounded-lg border-2 border-primary/25 bg-accent/50 px-2.5 py-2">
      <p className="text-[0.72rem] font-medium text-muted-foreground">Vas a {verbo}:</p>
      <p className="leading-snug font-semibold">
        Walter Sosa faltó el martes 29 de septiembre (justificada, con certificado)
      </p>
      {aviso ? <p className="text-[0.72rem] text-muted-foreground">{aviso}</p> : null}
    </div>
  );
}

function ResultadoNovedad({ enviada }: { enviada: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border bg-card px-3 py-3 text-center">
      <Sello
        grande
        estado={enviada ? "pendiente_aprobacion" : "aprobada"}
        texto={enviada ? "Enviada" : "Guardada"}
        className="text-[0.85rem]"
      />
      <p className="font-display text-[0.95rem] font-bold">
        {enviada ? "Le llegó a Administración para aprobar" : "Novedad guardada"}
      </p>
      <p className="text-[0.72rem] text-muted-foreground">
        Walter Sosa faltó el martes 29 de septiembre (justificada, con certificado)
      </p>
      {enviada ? (
        <p className="text-[0.72rem] text-muted-foreground">
          Cuando la aprueben cuenta en la planilla. Si la rechazan, te avisamos acá en Novedades con el motivo.
        </p>
      ) : null}
    </div>
  );
}

/** Jefe de Portería: la frase para revisar y «Enviar a Administración». */
export function PantallaEnviarNovedad() {
  return (
    <MarcoPantalla titulo="Cargar novedad">
      <FraseConfirmacion verbo="enviar" aviso="Le llega a Administración para que la apruebe." />
      <Resaltado>
        <BotonEjemplo className="w-full">
          <Send /> Enviar a Administración
        </BotonEjemplo>
      </Resaltado>
      <p className="pt-1 text-center text-[0.72rem] font-semibold text-muted-foreground">Después:</p>
      <ResultadoNovedad enviada />
    </MarcoPantalla>
  );
}

/** Jefe de Portería: cómo queda después de enviarla. */
export function PantallaNovedadEnviada() {
  return (
    <MarcoPantalla titulo="Cargar novedad">
      <ResultadoNovedad enviada />
      <div className="flex flex-col gap-1">
        <BotonEjemplo>
          <ClipboardList /> Cargar otra para Walter
        </BotonEjemplo>
        <BotonEjemplo variante="contorno">
          <UserPlus /> Otro empleado
        </BotonEjemplo>
      </div>
    </MarcoPantalla>
  );
}

/** Administración y Líder: la frase para revisar y «Guardar novedad». */
export function PantallaGuardarNovedad() {
  return (
    <MarcoPantalla titulo="Cargar novedad">
      <FraseConfirmacion verbo="guardar" />
      <Resaltado>
        <BotonEjemplo className="w-full">
          <Check /> Guardar novedad
        </BotonEjemplo>
      </Resaltado>
      <p className="pt-1 text-center text-[0.72rem] font-semibold text-muted-foreground">Después:</p>
      <ResultadoNovedad enviada={false} />
    </MarcoPantalla>
  );
}

/** Administración y Líder: cómo queda después de guardarla. */
export function PantallaNovedadGuardada() {
  return (
    <MarcoPantalla titulo="Cargar novedad">
      <ResultadoNovedad enviada={false} />
      <div className="flex flex-col gap-1">
        <BotonEjemplo>
          <ClipboardList /> Cargar otra para Walter
        </BotonEjemplo>
        <BotonEjemplo variante="contorno">
          <UserPlus /> Otro empleado
        </BotonEjemplo>
      </div>
    </MarcoPantalla>
  );
}

/**
 * Un empleado de la planilla, abierto: sus novedades del mes con lo que se puede hacer.
 * Administración y el Líder aprueban, rechazan y anulan; el Jefe de Portería corrige o
 * borra lo suyo mientras espera el OK.
 */
function PlanillaAbierta({ revisa }: { revisa: boolean }) {
  const chico = "min-h-6 px-2 text-[0.72rem]";
  return (
    <MarcoPantalla titulo="Novedades del personal">
      <SelectorMesEjemplo />
      <div className="rounded-lg border bg-card">
        <Resaltado className="space-y-1.5 rounded-b-none bg-accent/30 px-2.5 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <EncabezadoEmpleado nombre="Sosa, Walter" sector="Portería" />
            <Sello estado="pendiente_aprobacion" texto="1 esperando OK" className={SELLO} />
          </div>
          <BarraHorasEjemplo registro={162} deberia={176} nivel="parcial" />
          <div className="flex flex-wrap gap-1">
            <ContadorEjemplo icono={UserX}>1 falta</ContadorEjemplo>
          </div>
          <p className="flex items-center gap-0.5 text-[0.72rem] font-medium text-primary">
            Ocultar <ChevronDown className="size-3.5 rotate-180" />
          </p>
        </Resaltado>
        <div className="divide-y rounded-b-lg border-t bg-muted/30 px-2.5">
          <NovedadEjemplo
            icono={UserX}
            estado="aprobada"
            frase="Faltó el miércoles 23 de septiembre (justificada, con certificado)"
            pie="Cargó Hugo Díaz · 23/09 08:40 · Aprobó Marta Ríos"
          >
            <span className="inline-flex min-h-6 items-center gap-1 rounded-md border bg-card px-2 text-[0.72rem] font-medium">
              <Paperclip className="size-3" /> Ver certificado
            </span>
            {revisa ? (
              <BotonEjemplo variante="contorno" className={cn(chico, "border-transparent bg-transparent text-muted-foreground")}>
                <Ban /> Anular
              </BotonEjemplo>
            ) : null}
          </NovedadEjemplo>
          <NovedadEjemplo
            icono={Clock}
            estado="pendiente_aprobacion"
            frase="Llegó 15 min tarde el lunes 28 de septiembre (justificada)"
            pie="Cargó Hugo Díaz · 28/09 07:20"
          >
            {revisa ? (
              <>
                <BotonEjemplo className={chico}>
                  <Check /> Aprobar
                </BotonEjemplo>
                <BotonEjemplo variante="contorno" className={cn(chico, "text-pendiente")}>
                  <X /> Rechazar
                </BotonEjemplo>
              </>
            ) : null}
            <BotonEjemplo variante="contorno" className={chico}>
              <Pencil /> Corregir
            </BotonEjemplo>
            {revisa ? null : (
              <BotonEjemplo variante="contorno" className={cn(chico, "border-transparent bg-transparent text-muted-foreground")}>
                <Trash2 /> Borrar
              </BotonEjemplo>
            )}
          </NovedadEjemplo>
          <div className="py-2">
            <BotonEjemplo variante="contorno" className="min-h-7 px-2 text-[0.75rem]">
              <Plus /> Cargar novedad para Walter
            </BotonEjemplo>
          </div>
        </div>
      </div>
    </MarcoPantalla>
  );
}

/** Administración y Líder: un empleado abierto, con «Aprobar», «Rechazar» y «Anular». */
export function PantallaPlanilla() {
  return <PlanillaAbierta revisa />;
}

/** Jefe de Portería: un empleado abierto; lo que espera el OK se corrige o se borra. */
export function PantallaPlanillaJefe() {
  return <PlanillaAbierta revisa={false} />;
}

/** Jefe de Portería: el aviso de lo que Administración le rechazó, con el motivo. */
export function PantallaRechazada() {
  return (
    <MarcoPantalla titulo="Novedades del personal">
      <div className="space-y-2 rounded-lg border border-pendiente/30 bg-pendiente-suave/70 p-2.5">
        <p className="font-display leading-snug font-bold">Administración rechazó 1 novedad que cargaste</p>
        <p className="text-[0.72rem] text-muted-foreground">
          Si hay que corregirla, tocá «Cargarla de nuevo». Si no, tocá «Entendido» y deja de aparecer.
        </p>
        <div className="space-y-1.5 rounded-md border bg-card p-2.5">
          <p className="leading-snug font-medium">Walter Sosa faltó el miércoles 23 de septiembre (sin justificar)</p>
          <p className="text-[0.72rem]">
            <span className="font-semibold">Motivo:</span> Ese día estaba de franco
          </p>
          <div className="flex flex-wrap gap-1">
            <Resaltado>
              <BotonEjemplo variante="contorno" className="min-h-6 px-2 text-[0.72rem]">
                <RotateCcw /> Cargarla de nuevo
              </BotonEjemplo>
            </Resaltado>
            <BotonEjemplo variante="contorno" className="min-h-6 border-transparent bg-transparent px-2 text-[0.72rem]">
              <Check /> Entendido
            </BotonEjemplo>
          </div>
        </div>
      </div>
    </MarcoPantalla>
  );
}

/** La planilla impresa del mes: horas, novedades aprobadas y lugar para las firmas. */
export function PantallaPlanillaImpresa() {
  const th = "py-1 pr-1 text-left text-[0.72rem] font-bold";
  const td = "py-1 pr-1 text-[0.72rem] tabular";
  return (
    <MarcoPantalla titulo="Imprimir planilla" contenidoClassName="bg-muted/40 p-3">
      <div className="space-y-2 rounded-md border bg-card p-2.5 shadow-sm">
        <div className="border-b-2 border-foreground pb-1.5">
          <p className="font-display text-[0.85rem] font-bold">Novedades del personal — Septiembre 2026</p>
          <p className="text-[0.72rem] text-muted-foreground">Portería, Limpieza y Mantenimiento · 6 empleados</p>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-foreground">
              <th className={th}>Empleado</th>
              <th className={cn(th, "text-right")}>Debería</th>
              <th className={cn(th, "text-right")}>Registró</th>
              <th className={cn(th, "text-right")}>Faltas</th>
              <th className={cn(th, "text-right")}>Extra</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-foreground/20">
              <td className={cn(td, "font-semibold")}>Sosa, Walter</td>
              <td className={cn(td, "text-right")}>176</td>
              <td className={cn(td, "text-right")}>162</td>
              <td className={cn(td, "text-right")}>1</td>
              <td className={cn(td, "text-right")}>—</td>
            </tr>
            <tr className="border-b border-foreground/20">
              <td className={cn(td, "font-semibold")}>Pérez, Juan</td>
              <td className={cn(td, "text-right")}>176</td>
              <td className={cn(td, "text-right")}>181</td>
              <td className={cn(td, "text-right")}>—</td>
              <td className={cn(td, "text-right")}>2 h</td>
            </tr>
          </tbody>
        </table>
        <div className="grid grid-cols-2 gap-4 pt-4">
          <p className="border-t border-foreground pt-0.5 text-center text-[0.72rem]">Líder de Procesos</p>
          <p className="border-t border-foreground pt-0.5 text-center text-[0.72rem]">Administración</p>
        </div>
      </div>
    </MarcoPantalla>
  );
}

// ---------------------------------------------------------------------------
// Portal del socio
// ---------------------------------------------------------------------------

/** Portada de "Comunicaciones" del socio: las pestañas y sus circulares. */
export function PortadaSocioComunicaciones() {
  return (
    <MarcoPantalla titulo="Comunicaciones">
      <PestanasSocio activa="Circulares" nuevas={{ Circulares: 1 }} />
      <div className="divide-y overflow-hidden rounded-lg border bg-card">
        <Resaltado mano={false} className="rounded-none ring-inset ring-offset-0">
          <div className="flex items-center gap-2 px-2.5 py-2">
            <div className="min-w-0 flex-1">
              <p className="leading-snug font-medium">Circular N° 12 · Horario de carga y descarga</p>
              <p className="text-[0.72rem] text-muted-foreground tabular">29/09/2026</p>
            </div>
            <Sello estado="nueva_comunicacion" className={SELLO} />
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          </div>
        </Resaltado>
        <div className="flex items-center gap-2 px-2.5 py-2">
          <div className="min-w-0 flex-1">
            <p className="leading-snug font-medium">Circular N° 11 · Corte de luz del domingo</p>
            <p className="text-[0.72rem] text-muted-foreground tabular">18/09/2026</p>
          </div>
          <Sello estado="recibida" texto="Leída" className={SELLO} />
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
        </div>
      </div>
    </MarcoPantalla>
  );
}

/**
 * Una circular abierta desde la lista del portal: se lee y, si trae PDF, se abre ahí.
 * Las que hay que confirmar no llegan por acá: el portal las muestra solas al entrar
 * (PantallaBloqueoCirculares).
 */
export function PantallaCircularSocio() {
  return (
    <MarcoPantalla titulo="Circular N° 11">
      <p className="flex items-center gap-1 text-[0.72rem] font-medium">
        <ArrowLeft className="size-3.5" /> Volver a Circulares
      </p>
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">Corte de luz del domingo</p>
        <Sello estado="circular" className={SELLO} />
      </div>
      <div className="space-y-2 rounded-lg border bg-card p-2.5">
        <p className="text-[0.72rem] text-muted-foreground tabular">18/09/2026</p>
        <p className="leading-snug">
          El domingo 21 de 6 a 10 se corta la luz en los galpones por un arreglo de la cooperativa eléctrica. Las
          cámaras de frío quedan con el generador.
        </p>
        <Resaltado>
          <BotonEjemplo variante="contorno" className="w-full">
            <FileText /> Abrir el PDF de la circular
          </BotonEjemplo>
        </Resaltado>
      </div>
      <p className="rounded-md bg-muted/60 px-2 py-1.5 text-[0.72rem] text-muted-foreground">
        Las circulares no se responden. ¿Tenés una duda? <span className="font-semibold text-primary">Hacé una solicitud</span>.
      </p>
    </MarcoPantalla>
  );
}

/** Lo que ve el socio al entrar si tiene una circular obligatoria sin confirmar. */
export function PantallaBloqueoCirculares() {
  return (
    <MarcoPantalla titulo="Mercado San Miguel">
      <div className="flex items-start gap-2">
        <Megaphone className="mt-0.5 size-5 shrink-0 text-parcial" />
        <div>
          <p className="font-display text-[0.95rem] font-bold">Tenés una circular para leer</p>
          <p className="text-[0.72rem] text-muted-foreground">
            Leela y tocá <span className="font-semibold text-foreground">Confirmo que la recibí</span>. Después vas a ver
            tu cuenta como siempre.
          </p>
        </div>
      </div>
      <div className="space-y-2 rounded-lg border-2 border-parcial bg-parcial-suave/40 p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <p className="leading-snug font-semibold">Circular N° 12 · Horario de carga y descarga</p>
          <Sello estado="sin_recibir" className={SELLO} />
        </div>
        <p className="leading-snug">Desde el lunes 5 de octubre, los camiones descargan de 5 a 9.</p>
        <Resaltado>
          <BotonEjemplo className="w-full">
            <CheckCircle2 /> Confirmo que la recibí
          </BotonEjemplo>
        </Resaltado>
      </div>
    </MarcoPantalla>
  );
}

function FilaAvisoSocio({
  titulo,
  numero,
  fecha,
  sello,
  texto,
}: {
  titulo: string;
  numero: number;
  fecha: string;
  sello: string;
  texto?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-2">
      <div className="min-w-0 flex-1">
        <p className="leading-snug font-medium">{titulo}</p>
        <p className="text-[0.72rem] text-muted-foreground tabular">
          N° {numero} · {fecha}
        </p>
      </div>
      <Sello estado={sello} texto={texto} className={SELLO} />
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
    </div>
  );
}

/** Los avisos del socio, cada uno con el sello que le dice qué hacer. */
export function PantallaAvisosSocio() {
  return (
    <MarcoPantalla titulo="Comunicaciones">
      <PestanasSocio activa="Notificaciones" nuevas={{ Notificaciones: 2, Apercibimientos: 1 }} />
      <div className="divide-y overflow-hidden rounded-lg border bg-card">
        <Resaltado mano={false} className="rounded-none ring-inset ring-offset-0">
          <FilaAvisoSocio titulo="Aviso de deuda atrasada" numero={7} fecha="29/09/2026" sello="nueva_comunicacion" />
        </Resaltado>
        <FilaAvisoSocio titulo="Limpieza del puesto" numero={5} fecha="15/09/2026" sello="respuesta_nueva" />
        <FilaAvisoSocio titulo="Horario de carga y descarga" numero={2} fecha="20/08/2026" sello="respondido" />
      </div>
    </MarcoPantalla>
  );
}

/** Un apercibimiento abierto en el portal: qué pasó, la multa y «Presentar mi descargo». */
export function PantallaDescargoSocio() {
  return (
    <MarcoPantalla titulo="Apercibimiento N° 3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">Mercadería en el pasillo</p>
        <Sello estado="apercibimiento" className={SELLO} />
      </div>
      <div className="space-y-1.5 rounded-lg border bg-card p-2.5">
        <LineaEstado pasos={["Te notificamos", "Tu descargo", "Te respondimos"]} actual={0} />
        <p className="border-t pt-1.5 text-[0.72rem] text-muted-foreground">Del 28/09/2026 · Puesto 58</p>
        <p className="leading-snug">El jueves quedaron cajones en el pasillo central toda la mañana.</p>
      </div>
      <div className="space-y-0.5 rounded-lg border-2 border-pendiente/30 bg-pendiente-suave p-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[0.72rem] font-medium text-muted-foreground">Multa</p>
          <Sello estado="multa" texto="Multa pendiente" className={SELLO} />
        </div>
        <Money monto={25000} className="block font-display text-[1.1rem] font-bold text-pendiente" />
        <p className="text-[0.72rem]">Se sumó a tu cuenta · vence el 10/10/2026.</p>
      </div>
      <Resaltado className="space-y-1.5 rounded-lg border-2 border-primary/25 bg-card p-2.5">
        <p className="font-display font-bold">Presentar mi descargo</p>
        <div className="min-h-9 rounded-md border px-2 py-1 text-[0.75rem] text-muted-foreground/70">Contá tu versión…</div>
        <span className="inline-flex min-h-6 items-center gap-1 rounded-md border bg-card px-2 text-[0.72rem] font-medium">
          <Camera className="size-3" /> Sacar una foto o elegir archivo
        </span>
        <BotonEjemplo className="w-full">
          <Send /> Enviar mi descargo
        </BotonEjemplo>
      </Resaltado>
    </MarcoPantalla>
  );
}
