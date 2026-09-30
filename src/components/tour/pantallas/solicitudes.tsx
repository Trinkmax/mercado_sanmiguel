import {
  ArrowBigUpDash,
  ArrowLeft,
  ArrowRightCircle,
  ArrowRightLeft,
  Bell,
  Check,
  ChevronRight,
  CircleCheck,
  Gavel,
  Hand,
  Lock,
  MapPin,
  MessageSquare,
  Paperclip,
  Plus,
  Printer,
  Send,
  Store,
  Wallet,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sello } from "@/components/shared/sello";
import { BotonEjemplo, CampoEjemplo, MarcoPantalla, Resaltado } from "@/components/tour/pantalla";

// Tour guiado · solicitudes: pantallas de ejemplo (dibujos quietos, datos inventados).
// Se parecen a /solicitudes, /solicitudes/[id], /solicitudes/nueva y a lo del portal del socio.

/* ------------------------------------------------------------------------------------ */
/* Piezas chicas                                                                         */
/* ------------------------------------------------------------------------------------ */

const BOTON_CHICO = "min-h-7 px-2 text-[0.72rem]";

/** El sello de estado de verdad, en chico. */
function SelloChico({ estado, className }: { estado: string; className?: string }) {
  return <Sello estado={estado} className={cn("px-1.5 py-0.5 text-[0.72rem]", className)} />;
}

/** Chip del tipo (Solicitud / Informe / Reclamo / Consulta). */
function ChipTipo({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted px-1.5 text-[0.72rem] font-semibold whitespace-nowrap text-foreground/80">
      {children}
    </span>
  );
}

type Pestana = { label: string; n: number; activa?: boolean; urgente?: boolean };

/** Las pestañas de la lista, con su número. */
function Pestanas({ items }: { items: Pestana[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((p) => (
        <span
          key={p.label}
          className={cn(
            "inline-flex min-h-6 items-center gap-1 rounded-md border px-1.5 text-[0.72rem] font-medium whitespace-nowrap",
            p.activa
              ? "border-primary bg-primary text-primary-foreground"
              : p.urgente
                ? "border-parcial/50 bg-parcial-suave"
                : "border-border bg-card"
          )}
        >
          {p.label}
          <span
            className={cn(
              "tabular font-semibold",
              p.activa ? "text-primary-foreground/80" : p.urgente ? "text-parcial" : "text-muted-foreground"
            )}
          >
            {p.n}
          </span>
        </span>
      ))}
    </div>
  );
}

type DatosFila = {
  numero: number;
  asunto: string;
  tipo: string;
  /** "Carpeta 58 · Pocho" o el lugar ("Portón norte"). */
  sobre?: string;
  lugar?: boolean;
  origen: string;
  fecha: string;
  sello: string;
  mensajes: number;
  respuesta?: boolean;
  /** Espera al Jefe de Portería (fila en amarillo). */
  amarilla?: boolean;
};

/** Un renglón de la lista de solicitudes. */
function FilaSolicitud({ f }: { f: DatosFila }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 px-2.5 py-2",
        f.amarilla && "bg-parcial-suave/50",
        f.respuesta && "bg-accent/60"
      )}
    >
      <span className="flex min-w-8 shrink-0 items-baseline justify-end gap-0.5 font-display text-[0.9rem] leading-snug font-bold tabular">
        <span className="font-sans text-[0.72rem] font-medium text-muted-foreground">N°</span>
        {f.numero}
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-1">
          <p className={cn("text-[0.8rem] leading-snug", f.respuesta ? "font-bold" : "font-medium")}>{f.asunto}</p>
          <ChipTipo>{f.tipo}</ChipTipo>
          {f.respuesta ? (
            <span className="inline-flex items-center rounded-full bg-primary px-1.5 text-[0.72rem] font-bold text-primary-foreground">
              Respuesta nueva
            </span>
          ) : null}
        </div>
        {f.sobre ? (
          <p className="flex items-center gap-1 text-[0.72rem] text-foreground/80">
            {f.lugar ? <MapPin className="size-3 shrink-0" strokeWidth={2} /> : null}
            {f.sobre}
          </p>
        ) : null}
        <p className="text-[0.72rem] text-muted-foreground">
          {f.origen} · <span className="tabular">{f.fecha}</span>
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
        <SelloChico estado={f.sello} />
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full px-1.5 text-[0.72rem] font-semibold tabular",
            f.mensajes > 0 ? "bg-accent text-accent-foreground" : "text-muted-foreground"
          )}
        >
          <MessageSquare className="size-3" strokeWidth={2} />
          {f.mensajes}
        </span>
      </div>
    </div>
  );
}

/** Título de la lista con «Nueva solicitud» a la derecha. */
function CabeceraLista({ resaltarNueva = false }: { resaltarNueva?: boolean }) {
  const boton = (
    <BotonEjemplo className={BOTON_CHICO}>
      <Plus /> Nueva solicitud
    </BotonEjemplo>
  );
  return (
    <div className="flex items-end justify-between gap-2">
      <p className="font-display text-[0.95rem] font-bold">Solicitudes</p>
      {resaltarNueva ? <Resaltado>{boton}</Resaltado> : boton}
    </div>
  );
}

/** La lista (tarjeta con renglones); el primero puede ir señalado. */
function Lista({ filas, resaltarPrimera = false }: { filas: DatosFila[]; resaltarPrimera?: boolean }) {
  const [primera, ...resto] = filas;
  return (
    <div className="rounded-lg border border-border bg-card">
      {resaltarPrimera ? (
        <Resaltado className="rounded-lg">
          <FilaSolicitud f={primera} />
        </Resaltado>
      ) : (
        <FilaSolicitud f={primera} />
      )}
      {resto.map((f) => (
        <div key={f.numero} className="border-t border-border">
          <FilaSolicitud f={f} />
        </div>
      ))}
    </div>
  );
}

type PasoLinea = { label: string; fecha?: string; estado: "hecho" | "actual" | "pendiente" | "verde" };

/** La línea del recorrido (Nueva → En revisión → … → Ejecutada), en chico. */
function LineaEjemplo({ pasos }: { pasos: PasoLinea[] }) {
  return (
    <ol className="flex w-full items-start">
      {pasos.map((p, i) => {
        const siguiente = pasos[i + 1];
        const pintadaIzq = i > 0 && p.estado !== "pendiente";
        const pintadaDer = siguiente ? siguiente.estado !== "pendiente" : false;
        return (
          <li key={p.label} className="flex min-w-0 flex-1 flex-col items-center text-center">
            <div className="flex w-full items-center">
              <span className={cn("h-0.5 flex-1", i === 0 ? "bg-transparent" : pintadaIzq ? "bg-primary/60" : "bg-border")} />
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border-2 text-[0.72rem] font-bold",
                  p.estado === "hecho" && "border-primary bg-primary text-primary-foreground",
                  p.estado === "actual" && "border-primary bg-card text-primary ring-3 ring-primary/25",
                  p.estado === "pendiente" && "border-border bg-card text-muted-foreground",
                  p.estado === "verde" && "border-pagado bg-pagado-suave text-pagado ring-3 ring-pagado/10"
                )}
              >
                {p.estado === "hecho" || p.estado === "verde" ? <Check className="size-3" strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={cn(
                  "h-0.5 flex-1",
                  i === pasos.length - 1 ? "bg-transparent" : pintadaDer ? "bg-primary/60" : "bg-border"
                )}
              />
            </div>
            <p
              className={cn(
                "mt-1 px-0.5 text-[0.72rem] leading-tight",
                p.estado === "actual"
                  ? "font-semibold text-primary"
                  : p.estado === "verde"
                    ? "font-semibold"
                    : p.estado === "hecho"
                      ? "text-foreground/80"
                      : "text-muted-foreground"
              )}
            >
              {p.label}
            </p>
            {p.fecha ? (
              <p className="text-[0.72rem] text-muted-foreground tabular">{p.fecha}</p>
            ) : p.estado === "actual" ? (
              <p className="text-[0.72rem] font-medium text-primary">ahora</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Encabezado del detalle: «Volver a …», "Solicitud N° …", el asunto y el sello. */
function CabeceraDetalle({
  numero,
  asunto,
  sello,
  volver = "Volver a Solicitudes",
  imprimir = true,
  resaltarImprimir = false,
}: {
  numero: number;
  asunto: string;
  sello: string;
  volver?: string;
  imprimir?: boolean;
  resaltarImprimir?: boolean;
}) {
  const boton = (
    <BotonEjemplo variante="contorno" className={BOTON_CHICO}>
      <Printer /> Imprimir
    </BotonEjemplo>
  );
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1 text-[0.72rem] font-medium">
        <ArrowLeft className="size-3" /> {volver}
      </p>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-[0.95rem] font-bold">Solicitud N° {numero}</p>
          <p className="text-[0.72rem] text-muted-foreground">{asunto}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <SelloChico estado={sello} />
          {imprimir ? resaltarImprimir ? <Resaltado>{boton}</Resaltado> : boton : null}
        </div>
      </div>
    </div>
  );
}

/** Una tarjeta blanca como las del sistema. */
function Tarjeta({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-2 rounded-lg border border-border bg-card p-2.5", className)}>{children}</div>;
}

/** Una ventana (diálogo) abierta sobre la pantalla. */
function Dialogo({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-2.5 shadow-md">
      <div className="space-y-0.5">
        <p className="font-display text-[0.85rem] font-bold">{titulo}</p>
        <p className="text-[0.72rem] text-muted-foreground">{descripcion}</p>
      </div>
      {children}
    </div>
  );
}

/** Pie de una ventana: «Volver» y el botón que confirma (señalado). */
function PieDialogo({ confirmar }: { confirmar: string }) {
  return (
    <div className="flex items-center justify-end gap-1.5 pt-0.5 pb-3">
      <BotonEjemplo variante="contorno" className={BOTON_CHICO}>
        Volver
      </BotonEjemplo>
      <Resaltado>
        <BotonEjemplo className={BOTON_CHICO}>{confirmar}</BotonEjemplo>
      </Resaltado>
    </div>
  );
}

/** Chip redondo para elegir (tipo, a quién, de dónde viene). */
function ChipOpcion({ children, activo = false }: { children: React.ReactNode; activo?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1 rounded-full border px-2 text-[0.72rem] font-semibold whitespace-nowrap",
        activo ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
      )}
    >
      {activo ? <Check className="size-3" strokeWidth={2.5} /> : null}
      {children}
    </span>
  );
}

/** Botón cuadrado para elegir (¿Qué es?, ¿Sobre qué es?). */
function OpcionCuadrada({ children, activo = false }: { children: React.ReactNode; activo?: boolean }) {
  return (
    <span
      className={cn(
        "flex min-h-7 items-center justify-center gap-1 rounded-md border px-1.5 text-center text-[0.72rem] font-semibold",
        activo ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
      )}
    >
      {activo ? <Check className="size-3" strokeWidth={2.5} /> : null}
      {children}
    </span>
  );
}

type Mensaje = {
  autor: string;
  rol?: string;
  hora: string;
  texto: string;
  tipo: "mio" | "otro" | "socio" | "interno" | "automatico";
};

/** El hilo de mensajes, como en la pantalla real. */
function Hilo({ mensajes }: { mensajes: Mensaje[] }) {
  return (
    <div className="space-y-1.5">
      {mensajes.map((m, i) =>
        m.tipo === "automatico" ? (
          <p
            key={i}
            className="mx-auto flex max-w-[92%] items-start gap-1 rounded-md bg-muted/70 px-2 py-1 text-[0.72rem] text-muted-foreground"
          >
            <ArrowRightCircle className="mt-0.5 size-3 shrink-0" strokeWidth={1.8} />
            <span>
              <span className="font-medium text-foreground/80">{m.autor}</span> {m.texto} ·{" "}
              <span className="tabular">{m.hora}</span>
            </span>
          </p>
        ) : (
          <div key={i} className={cn("flex", m.tipo === "mio" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-lg border px-2 py-1.5",
                m.tipo === "interno"
                  ? "border-parcial/40 bg-parcial-suave"
                  : m.tipo === "mio"
                    ? "border-accent bg-accent/60"
                    : m.tipo === "socio"
                      ? "border-primary/25 bg-card"
                      : "border-border bg-muted/60"
              )}
            >
              <p className="flex flex-wrap items-center gap-x-1 text-[0.72rem]">
                <span className="font-semibold">{m.tipo === "mio" ? "Vos" : m.autor}</span>
                {m.tipo === "socio" ? (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-primary px-1.5 font-semibold text-primary-foreground">
                    <Store className="size-2.5" strokeWidth={2.2} /> Socio
                  </span>
                ) : m.rol ? (
                  <span className="text-muted-foreground">{m.rol}</span>
                ) : null}
                <span className="text-muted-foreground tabular">{m.hora}</span>
              </p>
              {m.tipo === "interno" ? (
                <p className="flex items-center gap-1 text-[0.72rem] font-semibold text-parcial">
                  <Lock className="size-3" strokeWidth={2.2} /> Interno — no lo ve el socio
                </p>
              ) : null}
              <p className="text-[0.8rem] leading-snug">{m.texto}</p>
            </div>
          </div>
        )
      )}
    </div>
  );
}

/** La caja para escribir: «Tu mensaje», adjuntar, «Mensaje interno» (equipo) y enviar. */
function CajaEscribir({
  staff,
  resaltar = "enviar",
  placeholder,
}: {
  staff: boolean;
  resaltar?: "enviar" | "interno";
  placeholder: string;
}) {
  const interno = (
    <span className="inline-flex items-center gap-1 text-[0.72rem] font-medium">
      <span className="flex h-3.5 w-6 items-center rounded-full bg-muted-foreground/30 p-0.5">
        <span className="size-2.5 rounded-full bg-card" />
      </span>
      <Lock className="size-3 text-parcial" strokeWidth={2} /> Mensaje interno
    </span>
  );
  const enviar = (
    <BotonEjemplo className={BOTON_CHICO}>
      <Send /> Enviar mensaje
    </BotonEjemplo>
  );
  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-card p-2">
      <CampoEjemplo etiqueta="Tu mensaje" valor={<span className="text-muted-foreground/70">{placeholder}</span>} />
      <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex min-h-6 items-center gap-1 rounded-md border border-border px-1.5 text-[0.72rem] font-medium">
            <Paperclip className="size-3" strokeWidth={2} /> Adjuntar foto o PDF
          </span>
          {staff ? resaltar === "interno" ? <Resaltado mano={false}>{interno}</Resaltado> : interno : null}
        </div>
        {resaltar === "enviar" ? <Resaltado>{enviar}</Resaltado> : enviar}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------ */
/* Datos inventados                                                                      */
/* ------------------------------------------------------------------------------------ */

const LUMINARIA: DatosFila = {
  numero: 131,
  asunto: "Luminaria rota frente al Puesto 58",
  tipo: "Reclamo",
  sobre: "Carpeta 58 · Pocho",
  origen: "Portal del socio",
  fecha: "Creada 30/09 09:40",
  sello: "nueva",
  mensajes: 0,
};
const MEDIO_PUESTO: DatosFila = {
  numero: 130,
  asunto: "Pedido de medio puesto más",
  tipo: "Solicitud",
  sobre: "Carpeta 112 · La Colorada",
  origen: "Portal del socio",
  fecha: "Actualizada 29/09 17:05",
  sello: "en_revision",
  mensajes: 3,
};
const PRECIO_LUZ: DatosFila = {
  numero: 128,
  asunto: "Consulta por el precio de la luz",
  tipo: "Consulta",
  sobre: "Carpeta 34 · Doña Tita",
  origen: "Portal del socio",
  fecha: "Creada 29/09 18:20",
  sello: "nueva",
  mensajes: 0,
};
const GALPON: DatosFila = {
  numero: 127,
  asunto: "Cambio de titular del Galpón 9",
  tipo: "Solicitud",
  sobre: "Carpeta 9 · Don Ramón",
  origen: "Administración",
  fecha: "Actualizada 26/09 12:30",
  sello: "en_consejo",
  mensajes: 2,
};
const PORTON: DatosFila = {
  numero: 129,
  asunto: "Portón norte trabado",
  tipo: "Informe",
  sobre: "Portón norte",
  lugar: true,
  origen: "Portería",
  fecha: "Creada 30/09 06:40",
  sello: "con_jefe",
  mensajes: 0,
  amarilla: true,
};
const CAMION: DatosFila = {
  numero: 126,
  asunto: "Camión estacionado en la entrada de quintas",
  tipo: "Informe",
  sobre: "Playón de maniobras",
  lugar: true,
  origen: "Portería",
  fecha: "Creada 29/09 22:15",
  sello: "con_jefe",
  mensajes: 1,
  amarilla: true,
};
const CANILLA: DatosFila = {
  numero: 124,
  asunto: "Arreglar la canilla del baño de mujeres",
  tipo: "Reclamo",
  sobre: "Carpeta 71 · Doña Rosa",
  origen: "Portal del socio",
  fecha: "Actualizada 30/09 08:10",
  sello: "asignada",
  mensajes: 4,
};

/* ------------------------------------------------------------------------------------ */
/* Panel: la lista                                                                       */
/* ------------------------------------------------------------------------------------ */

/** Portada del capítulo: la lista del Líder con sus pestañas. */
export function PortadaSolicitudes() {
  return (
    <MarcoPantalla titulo="Solicitudes">
      <CabeceraLista />
      <Pestanas
        items={[
          { label: "Nuevas", n: 2 },
          { label: "En revisión", n: 1 },
          { label: "En el Consejo", n: 1 },
          { label: "Todas", n: 17, activa: true },
        ]}
      />
      <Lista filas={[LUMINARIA, MEDIO_PUESTO, GALPON]} resaltarPrimera />
    </MarcoPantalla>
  );
}

/** Lista del Líder: «Nuevas» abierta y la primera señalada. */
export function PantallaListaLider() {
  return (
    <MarcoPantalla titulo="Solicitudes" contenidoClassName="space-y-2 p-3 pb-5">
      <Pestanas
        items={[
          { label: "Nuevas", n: 2, activa: true },
          { label: "En revisión", n: 1 },
          { label: "En el Consejo", n: 1 },
          { label: "Resueltas (para asignar)", n: 0 },
        ]}
      />
      <Lista filas={[LUMINARIA, PRECIO_LUZ]} resaltarPrimera />
    </MarcoPantalla>
  );
}

/** Lista de Administración: «Asignadas a Administración» con una tarea. */
export function PantallaListaAdmin() {
  return (
    <MarcoPantalla titulo="Solicitudes" contenidoClassName="space-y-2 p-3 pb-5">
      <Pestanas
        items={[
          { label: "Asignadas a Administración", n: 1, activa: true },
          { label: "Nuevas", n: 2 },
          { label: "En curso", n: 5 },
          { label: "Terminadas", n: 12 },
        ]}
      />
      <Lista filas={[CANILLA]} resaltarPrimera />
    </MarcoPantalla>
  );
}

/** Lista del Jefe de Portería: «Para resolver» con las de los porteros en amarillo. */
export function PantallaListaJefe() {
  return (
    <MarcoPantalla titulo="Solicitudes" contenidoClassName="space-y-2 p-3 pb-5">
      <Pestanas
        items={[
          { label: "Para resolver", n: 2, activa: true },
          { label: "En manos del Líder", n: 1 },
          { label: "Terminadas", n: 8 },
          { label: "Todas", n: 11 },
        ]}
      />
      <Lista filas={[PORTON, CAMION]} resaltarPrimera />
    </MarcoPantalla>
  );
}

/* ------------------------------------------------------------------------------------ */
/* Panel: adentro de una solicitud                                                       */
/* ------------------------------------------------------------------------------------ */

/** El recorrido de una solicitud del Líder: en revisión, con quién la tiene. */
export function PantallaRecorrido() {
  return (
    <MarcoPantalla titulo="Solicitud N° 130">
      <CabeceraDetalle numero={130} asunto="Pedido de medio puesto más" sello="en_revision" />
      <Resaltado>
        <Tarjeta>
          <LineaEjemplo
            pasos={[
              { label: "Nueva", fecha: "29/09", estado: "hecho" },
              { label: "En revisión", estado: "actual" },
              { label: "En el Consejo", estado: "pendiente" },
              { label: "Resuelta", estado: "pendiente" },
              { label: "Asignada", estado: "pendiente" },
              { label: "Ejecutada", estado: "pendiente" },
            ]}
          />
          <p className="border-t border-border pt-1.5 text-center text-[0.72rem]">
            Ahora la tiene: <span className="font-semibold">el Líder de Procesos</span>
          </p>
        </Tarjeta>
      </Resaltado>
      <div className="h-2" />
    </MarcoPantalla>
  );
}

/** Los botones del Líder con una solicitud nueva. */
export function PantallaAccionesLider() {
  return (
    <MarcoPantalla titulo="Solicitud N° 131" contenidoClassName="space-y-2 p-3 pb-5">
      <Tarjeta>
        <p className="font-display text-[0.85rem] font-bold">Acciones</p>
        <div className="flex flex-col gap-1.5">
          <Resaltado>
            <BotonEjemplo className="w-full justify-start">
              <Hand /> Tomarla para revisar
            </BotonEjemplo>
          </Resaltado>
          <BotonEjemplo variante="contorno" className="w-full justify-start">
            <ArrowRightLeft /> Derivar al Consejo
          </BotonEjemplo>
          <BotonEjemplo variante="contorno" className="w-full justify-start">
            <Gavel /> Registrar resolución
          </BotonEjemplo>
          <BotonEjemplo variante="contorno" className="w-full justify-start">
            <Send /> Asignar a Administración
          </BotonEjemplo>
          <BotonEjemplo variante="contorno" className="w-full justify-start text-pendiente">
            <XCircle /> Rechazar
          </BotonEjemplo>
        </div>
      </Tarjeta>
    </MarcoPantalla>
  );
}

/** La ventana para anotar lo que decidió el Consejo en la reunión. */
export function PantallaResolucionConsejo() {
  return (
    <MarcoPantalla titulo="Solicitud N° 130" contenidoClassName="bg-muted/60 p-3">
      <Dialogo
        titulo="Registrar lo que resolvió el Consejo"
        descripcion="Escribí lo que decidió el Consejo en su reunión. Queda como resolución del Consejo."
      >
        <CampoEjemplo
          etiqueta="Texto"
          valor="Se aprueba el medio puesto adicional para La Colorada desde octubre."
          className="[&>div]:py-1.5"
        />
        <PieDialogo confirmar="Registrar la resolución del Consejo" />
      </Dialogo>
    </MarcoPantalla>
  );
}

/** La ventana para pasarle la resolución a Administración. */
export function PantallaAsignar() {
  return (
    <MarcoPantalla titulo="Solicitud N° 130" contenidoClassName="bg-muted/60 p-3">
      <Dialogo
        titulo="Asignar a Administración"
        descripcion="Administración la ve como tarea pendiente y la marca ejecutada cuando esté hecha."
      >
        <CampoEjemplo
          etiqueta="Texto (opcional)"
          valor="Marcar el medio puesto en el plano y avisarle a La Colorada."
          className="[&>div]:py-1.5"
        />
        <div className="space-y-1">
          <p className="text-[0.72rem] font-medium">¿A quién de Administración? (opcional)</p>
          <div className="flex flex-wrap gap-1">
            <ChipOpcion activo>Cualquiera de Administración</ChipOpcion>
            <ChipOpcion>Marta</ChipOpcion>
            <ChipOpcion>Susana</ChipOpcion>
          </div>
        </div>
        <PieDialogo confirmar="Asignar a Administración" />
      </Dialogo>
    </MarcoPantalla>
  );
}

/** El detalle de una tarea de Administración, con la resolución en verde. */
export function PantallaDetalleResuelta() {
  return (
    <MarcoPantalla titulo="Solicitud N° 124" contenidoClassName="space-y-2 p-3 pb-5">
      <CabeceraDetalle numero={124} asunto="Arreglar la canilla del baño de mujeres" sello="asignada" />
      <Tarjeta>
        <p className="flex items-center gap-1.5 font-display text-[0.85rem] font-bold">
          <ChipTipo>Reclamo</ChipTipo> Detalle
        </p>
        <div className="grid grid-cols-2 gap-1.5 text-[0.72rem]">
          <p>
            <span className="block text-muted-foreground">Cliente</span>
            <span className="inline-flex items-center gap-1 font-medium">
              <Store className="size-3 shrink-0 text-muted-foreground" strokeWidth={2} /> Carpeta 71 · Doña Rosa
            </span>
          </p>
          <p>
            <span className="block text-muted-foreground">Asignada a</span>
            <span className="font-medium">Marta (Administración)</span>
          </p>
        </div>
        <p className="border-t border-border pt-1.5 text-[0.8rem] leading-snug">
          La canilla del baño de mujeres pierde agua desde el sábado.
        </p>
        <Resaltado>
          <div className="rounded-md border border-pagado/30 bg-pagado-suave px-2 py-1.5">
            <p className="text-[0.72rem] font-semibold text-foreground/80">Resolución</p>
            <p className="text-[0.8rem] leading-snug">Se cambia el cuerito esta semana. Llamar al plomero de siempre.</p>
          </div>
        </Resaltado>
      </Tarjeta>
    </MarcoPantalla>
  );
}

/** La ventana para marcar que lo resuelto ya se hizo. */
export function PantallaEjecutar() {
  return (
    <MarcoPantalla titulo="Solicitud N° 124" contenidoClassName="bg-muted/60 p-3">
      <Dialogo titulo="Marcar como ejecutada" descripcion="Contá brevemente qué se hizo (opcional).">
        <CampoEjemplo
          etiqueta="Texto (opcional)"
          valor="El plomero cambió el cuerito el 30/09."
          className="[&>div]:py-1.5"
        />
        <PieDialogo confirmar="Marcar ejecutada" />
      </Dialogo>
    </MarcoPantalla>
  );
}

/** Los mensajes de una solicitud de un socio, vistos por el equipo. */
export function PantallaMensajes() {
  return (
    <MarcoPantalla titulo="Solicitud N° 130" contenidoClassName="space-y-2 p-3">
      <p className="font-display text-[0.85rem] font-bold">
        Mensajes <span className="font-sans font-normal text-muted-foreground tabular">4</span>
      </p>
      <Hilo
        mensajes={[
          { autor: "Rubén", hora: "29/09 11:02", texto: "tomó la solicitud para revisarla", tipo: "automatico" },
          {
            autor: "La Colorada",
            hora: "29/09 17:05",
            texto: "¿Desde cuándo lo podría usar?",
            tipo: "socio",
          },
          {
            autor: "Marta",
            rol: "Administración",
            hora: "30/09 08:30",
            texto: "Ojo: el medio puesto de al lado está pedido por otro.",
            tipo: "interno",
          },
        ]}
      />
      <CajaEscribir staff placeholder="Escribile al socio o dejá una nota interna…" />
    </MarcoPantalla>
  );
}

/** El Jefe de Portería le pregunta al portero antes de decidir. */
export function PantallaMensajesJefe() {
  return (
    <MarcoPantalla titulo="Solicitud N° 129" contenidoClassName="space-y-2 p-3">
      <p className="font-display text-[0.85rem] font-bold">
        Mensajes <span className="font-sans font-normal text-muted-foreground tabular">2</span>
      </p>
      <Hilo
        mensajes={[
          {
            autor: "Juan",
            rol: "Portería",
            hora: "30/09 06:45",
            texto: "Lo dejamos atado con la cadena hasta que venga alguien.",
            tipo: "otro",
          },
          { autor: "Beto", hora: "30/09 07:10", texto: "¿Probaste con la llave de repuesto?", tipo: "mio" },
        ]}
      />
      <CajaEscribir staff placeholder="Escribí un mensaje o dejá una nota interna…" />
    </MarcoPantalla>
  );
}

/** La respuesta del Líder a un pedido de Tesorería. */
export function PantallaRespuestaTesoreria() {
  return (
    <MarcoPantalla titulo="Solicitud N° 125" contenidoClassName="space-y-2 p-3">
      <CabeceraDetalle numero={125} asunto="Autorizar el pago al electricista" sello="en_revision" />
      <p className="font-display text-[0.85rem] font-bold">
        Mensajes <span className="font-sans font-normal text-muted-foreground tabular">2</span>
      </p>
      <Resaltado mano={false}>
        <Hilo
          mensajes={[
            { autor: "Rubén", hora: "30/09 09:15", texto: "tomó la solicitud para revisarla", tipo: "automatico" },
            {
              autor: "Rubén",
              rol: "Líder de Procesos",
              hora: "30/09 09:20",
              texto: "Autorizado. Pagale con transferencia y subí el comprobante a Gastos.",
              tipo: "otro",
            },
          ]}
        />
      </Resaltado>
      <CajaEscribir staff placeholder="Escribí un mensaje o dejá una nota interna…" />
    </MarcoPantalla>
  );
}

/** Lo que cargó el portero, como lo lee el Jefe. */
export function PantallaDetallePorteria() {
  return (
    <MarcoPantalla titulo="Solicitud N° 129" contenidoClassName="space-y-2 p-3 pb-5">
      <CabeceraDetalle numero={129} asunto="Portón norte trabado" sello="con_jefe" />
      <Resaltado>
        <Tarjeta>
          <p className="flex items-center gap-1.5 font-display text-[0.85rem] font-bold">
            <ChipTipo>Informe</ChipTipo> Detalle
          </p>
          <div className="grid grid-cols-2 gap-1.5 text-[0.72rem]">
            <p>
              <span className="block text-muted-foreground">Lugar</span>
              <span className="font-medium">Portón norte</span>
            </p>
            <p>
              <span className="block text-muted-foreground">La cargó</span>
              <span className="font-medium">
                Juan · <span className="tabular">30/09 06:40</span>
              </span>
            </p>
          </div>
          <p className="border-t border-border pt-1.5 text-[0.8rem] leading-snug">
            Desde anoche el portón norte no cierra. Los camiones de la madrugada entraron igual.
          </p>
          <BotonEjemplo variante="contorno" className={BOTON_CHICO}>
            <Paperclip /> Ver adjunto
          </BotonEjemplo>
        </Tarjeta>
      </Resaltado>
    </MarcoPantalla>
  );
}

/** La ventana del Jefe para resolver, con respuestas de un toque. */
export function PantallaResolverJefe() {
  return (
    <MarcoPantalla titulo="Solicitud N° 129" contenidoClassName="bg-muted/60 p-3">
      <Dialogo
        titulo="Resolver la solicitud"
        descripcion="Contá qué decidiste. Le llega a quien la cargó y queda cerrada."
      >
        <div className="flex flex-wrap gap-1">
          <ChipOpcion>Aprobado</ChipOpcion>
          <ChipOpcion>Ya está solucionado</ChipOpcion>
          <ChipOpcion>Lo hablé con el portero</ChipOpcion>
        </div>
        <CampoEjemplo
          etiqueta="Texto"
          valor="Ya está solucionado: se aceitó la guía del portón."
          className="[&>div]:py-1.5"
        />
        <PieDialogo confirmar="Resolver y cerrar" />
      </Dialogo>
    </MarcoPantalla>
  );
}

/** Los botones del Jefe de Portería, con «Elevar al Líder de Procesos» señalado. */
export function PantallaAccionesJefe() {
  return (
    <MarcoPantalla titulo="Solicitud N° 129" contenidoClassName="space-y-2 p-3 pb-5">
      <Tarjeta>
        <p className="font-display text-[0.85rem] font-bold">Acciones</p>
        <div className="flex flex-col gap-1.5">
          <BotonEjemplo className="w-full justify-start">
            <Gavel /> Resolver
          </BotonEjemplo>
          <Resaltado>
            <BotonEjemplo variante="contorno" className="w-full justify-start">
              <ArrowBigUpDash /> Elevar al Líder de Procesos
            </BotonEjemplo>
          </Resaltado>
          <BotonEjemplo variante="contorno" className="w-full justify-start text-pendiente">
            <XCircle /> Rechazar
          </BotonEjemplo>
        </div>
      </Tarjeta>
    </MarcoPantalla>
  );
}

/** Lo que ve el portero cuando el Jefe la resolvió. */
export function PantallaRecorridoPorteria() {
  return (
    <MarcoPantalla titulo="Solicitud N° 129" contenidoClassName="space-y-2 p-3 pb-5">
      <CabeceraDetalle numero={129} asunto="Portón norte trabado" sello="resuelta_jefe" />
      <Tarjeta>
        <LineaEjemplo
          pasos={[
            { label: "Cargada", fecha: "30/09", estado: "hecho" },
            { label: "Jefe de Portería", fecha: "30/09", estado: "hecho" },
            { label: "Resuelta por el Jefe", fecha: "30/09", estado: "verde" },
          ]}
        />
      </Tarjeta>
      <Resaltado>
        <Hilo
          mensajes={[
            {
              autor: "Beto",
              hora: "30/09 07:30",
              texto: "la resolvió: Ya está solucionado, se aceitó la guía del portón.",
              tipo: "automatico",
            },
          ]}
        />
      </Resaltado>
    </MarcoPantalla>
  );
}

/* ------------------------------------------------------------------------------------ */
/* Panel: cargar una nueva                                                               */
/* ------------------------------------------------------------------------------------ */

/** «¿Sobre qué es?» con un puesto elegido por número (Portería, el Jefe, Tesorería). */
export function PantallaFormularioPuesto() {
  return (
    <MarcoPantalla titulo="Nueva solicitud" contenidoClassName="space-y-2 p-3 pb-5">
      <p className="text-[0.8rem] font-medium">¿Sobre qué es?</p>
      <div className="grid grid-cols-2 gap-1.5">
        <OpcionCuadrada activo>
          <MapPin className="size-3" /> Un puesto
        </OpcionCuadrada>
        <OpcionCuadrada>Algo general</OpcionCuadrada>
      </div>
      <div className="flex gap-1">
        <ChipOpcion activo>Puesto</ChipOpcion>
        <ChipOpcion>Local</ChipOpcion>
        <ChipOpcion>Contéiner</ChipOpcion>
      </div>
      <div className="flex items-center gap-2">
        <span className="flex min-h-8 w-24 items-center gap-1.5 rounded-md border border-border bg-card px-2 font-display text-[0.9rem] font-bold tabular">
          <MapPin className="size-3.5 text-muted-foreground" /> 58
        </span>
        <Resaltado>
          <BotonEjemplo>
            <CircleCheck /> Es el Puesto 58
          </BotonEjemplo>
        </Resaltado>
      </div>
    </MarcoPantalla>
  );
}

/** El formulario de Administración o del Líder cargando un papel que trajo Portería. */
export function PantallaFormularioAdmin() {
  return (
    <MarcoPantalla titulo="Nueva solicitud" contenidoClassName="space-y-2 p-3 pb-5">
      <p className="text-[0.8rem] font-medium">¿Qué es?</p>
      <div className="grid grid-cols-4 gap-1">
        <OpcionCuadrada>Solicitud</OpcionCuadrada>
        <OpcionCuadrada activo>Informe</OpcionCuadrada>
        <OpcionCuadrada>Reclamo</OpcionCuadrada>
        <OpcionCuadrada>Consulta</OpcionCuadrada>
      </div>
      <CampoEjemplo etiqueta="Asunto" valor="Falta luz en el pasillo de las quintas" />
      <p className="text-[0.8rem] font-medium">¿Sobre qué es?</p>
      <div className="grid grid-cols-3 gap-1">
        <OpcionCuadrada>Un cliente</OpcionCuadrada>
        <OpcionCuadrada activo>Un lugar del plano</OpcionCuadrada>
        <OpcionCuadrada>Algo general</OpcionCuadrada>
      </div>
      <Resaltado>
        <div className="space-y-1 p-1">
          <p className="text-[0.8rem] font-medium">¿De dónde viene?</p>
          <div className="flex flex-wrap gap-1">
            <ChipOpcion>Portal del socio</ChipOpcion>
            <ChipOpcion activo>Portería</ChipOpcion>
            <ChipOpcion>Administración</ChipOpcion>
            <ChipOpcion>Tesorería</ChipOpcion>
            <ChipOpcion>Líder de Procesos</ChipOpcion>
          </div>
        </div>
      </Resaltado>
    </MarcoPantalla>
  );
}

/** Lo que se ve al enviar: el sello y a quién le llegó. */
function Enviada({
  numero,
  estado,
  alJefe,
  resaltarImprimir,
}: {
  numero: number;
  estado: string;
  alJefe: boolean;
  resaltarImprimir: boolean;
}) {
  const imprimir = (
    <span className="inline-flex min-h-7 items-center justify-center gap-1 text-[0.72rem] font-semibold">
      <Printer className="size-3.5" /> Imprimir
    </span>
  );
  return (
    <MarcoPantalla titulo="Nueva solicitud" contenidoClassName="p-3 pb-5">
      <div className="flex flex-col items-center gap-2 rounded-md border-2 border-double border-foreground/30 bg-card px-3 py-3 text-center">
        <Sello estado={estado} grande className="text-[0.85rem]" />
        <p className="font-display text-[0.95rem] font-bold">
          {alJefe ? "Le llegó al Jefe de Portería" : "Le llegó al Líder de Procesos"}
        </p>
        <p className="text-[0.72rem] text-muted-foreground">
          Solicitud N° {numero}.{" "}
          {alJefe
            ? "El Jefe la resuelve o, si hace falta, la eleva al Líder de Procesos. Las respuestas las ves en Solicitudes."
            : "Las respuestas y el avance los ves en Solicitudes."}
        </p>
        <div className="flex w-full max-w-56 flex-col gap-1">
          <BotonEjemplo className={BOTON_CHICO}>Ver la solicitud</BotonEjemplo>
          <BotonEjemplo variante="contorno" className={BOTON_CHICO}>
            Cargar otra
          </BotonEjemplo>
          {resaltarImprimir ? <Resaltado>{imprimir}</Resaltado> : imprimir}
        </div>
      </div>
    </MarcoPantalla>
  );
}

/** Enviada por Portería: le llegó al Jefe; «Imprimir» señalado. */
export function PantallaEnviadaJefe() {
  return <Enviada numero={132} estado="con_jefe" alJefe resaltarImprimir />;
}

/** Enviada por Administración, el Jefe o Tesorería: le llegó al Líder. */
export function PantallaEnviadaLider() {
  return <Enviada numero={133} estado="nueva" alJefe={false} resaltarImprimir={false} />;
}

/* ------------------------------------------------------------------------------------ */
/* Portal del socio                                                                      */
/* ------------------------------------------------------------------------------------ */

/** "Tus solicitudes" en «Mi cuenta», con el número de respuestas nuevas arriba. */
function SocioLista({ resaltar }: { resaltar?: "fila" | "nueva" }) {
  const fila = (
    <div className="flex items-center gap-2 bg-accent/60 px-2 py-1.5">
      <span className="w-6 shrink-0 text-right font-display text-[0.8rem] font-bold tabular">131</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.8rem] leading-snug font-bold">Luminaria rota frente al puesto</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[0.72rem] text-muted-foreground">
          <ChipTipo>Reclamo</ChipTipo>
          <SelloChico estado="resuelta" />
          <span className="tabular">Actualizada 30/09 11:25</span>
        </span>
      </span>
      <SelloChico estado="respuesta_nueva" className="shrink-0" />
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
    </div>
  );
  const nueva = (
    <BotonEjemplo className="w-full">
      <Plus /> Nueva solicitud
    </BotonEjemplo>
  );
  return (
    <MarcoPantalla titulo="Mi cuenta" contenidoClassName="space-y-2 p-3 pb-5">
      <div className="grid grid-cols-2 gap-1.5">
        <span className="flex min-h-8 items-center justify-center gap-1 rounded-md bg-primary text-[0.8rem] font-semibold text-primary-foreground">
          <Wallet className="size-3.5" /> Mi cuenta
          <span className="inline-flex size-4 items-center justify-center rounded-full bg-card text-[0.72rem] font-bold text-parcial">
            1
          </span>
        </span>
        <span className="flex min-h-8 items-center justify-center gap-1 rounded-md border border-border bg-card text-[0.8rem] font-semibold">
          <Bell className="size-3.5" /> Comunicaciones
        </span>
      </div>
      <Tarjeta>
        <p className="font-display text-[0.85rem] font-bold">Tus solicitudes</p>
        <div className="divide-y divide-border rounded-md border border-border">
          {resaltar === "fila" ? <Resaltado className="rounded-md">{fila}</Resaltado> : fila}
          <div className="flex items-center gap-2 px-2 py-1.5">
            <span className="w-6 shrink-0 text-right font-display text-[0.8rem] font-bold tabular">118</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.8rem] leading-snug font-medium">Horario de carga los sábados</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[0.72rem] text-muted-foreground">
                <ChipTipo>Consulta</ChipTipo>
                <span className="tabular">Actualizada 12/09 16:00</span>
              </span>
            </span>
            <SelloChico estado="resuelta" className="shrink-0" />
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          </div>
        </div>
        {resaltar === "nueva" ? <Resaltado>{nueva}</Resaltado> : nueva}
      </Tarjeta>
    </MarcoPantalla>
  );
}

/** Portada del capítulo del socio: sus solicitudes en «Mi cuenta». */
export function PortadaSocioSolicitudes() {
  return <SocioLista />;
}

/** «Tus solicitudes» en «Mi cuenta», con la que tiene respuesta nueva señalada. */
export function PantallaSocioLista() {
  return <SocioLista resaltar="fila" />;
}

/** «Tus solicitudes» en «Mi cuenta», con el botón «Nueva solicitud» señalado. */
export function PantallaSocioBotonNueva() {
  return <SocioLista resaltar="nueva" />;
}

/** El formulario del socio completo, con la parte que explica el paso señalada. */
function SocioFormulario({ resaltar }: { resaltar: "tipo" | "asunto" }) {
  const tipo = (
    <div className="space-y-1">
      <p className="text-[0.8rem] font-medium">¿Qué querés hacer?</p>
      <div className="grid grid-cols-2 gap-1">
        <OpcionCuadrada>Solicitud</OpcionCuadrada>
        <OpcionCuadrada>Informe</OpcionCuadrada>
        <OpcionCuadrada activo>Reclamo</OpcionCuadrada>
        <OpcionCuadrada>Consulta</OpcionCuadrada>
      </div>
      <p className="text-[0.72rem] text-muted-foreground">Algo no está bien y hay que arreglarlo</p>
    </div>
  );
  const asunto = <CampoEjemplo etiqueta="Asunto" valor="Luminaria rota frente al puesto" />;
  return (
    <MarcoPantalla titulo="Nueva solicitud" contenidoClassName="space-y-2 p-3 pb-5">
      <div>
        <p className="font-display text-[0.95rem] font-bold">Nueva solicitud</p>
        <p className="text-[0.72rem] text-muted-foreground">
          Para Pocho · Carpeta N° 58. La recibe el Líder de Procesos y te respondemos por acá.
        </p>
      </div>
      {resaltar === "tipo" ? <Resaltado>{tipo}</Resaltado> : tipo}
      {resaltar === "asunto" ? <Resaltado>{asunto}</Resaltado> : asunto}
      <CampoEjemplo
        etiqueta="Contanos más"
        valor="Desde el lunes no anda la luz del pasillo. A la tarde queda muy oscuro."
        className="[&>div]:py-1.5"
      />
      <div className="space-y-1">
        <p className="text-[0.72rem] font-medium text-muted-foreground">Foto o PDF (opcional)</p>
        <span className="flex min-h-7 items-center gap-1 rounded-md border border-border bg-card px-2 text-[0.72rem] font-medium">
          <Paperclip className="size-3" strokeWidth={2} /> Sacar una foto o elegir archivo
        </span>
      </div>
      <BotonEjemplo className="w-full">
        <Send /> Enviar solicitud
      </BotonEjemplo>
    </MarcoPantalla>
  );
}

/** El formulario del socio con «¿Qué querés hacer?» señalado. */
export function PantallaSocioFormularioTipo() {
  return <SocioFormulario resaltar="tipo" />;
}

/** El formulario del socio con «Asunto» señalado. */
export function PantallaSocioFormularioAsunto() {
  return <SocioFormulario resaltar="asunto" />;
}


/** La solicitud del socio recién enviada: número, sello «Nueva» y qué quiere decir. */
export function PantallaSocioEnviada() {
  return (
    <MarcoPantalla titulo="Solicitud N° 131" contenidoClassName="space-y-2 p-3 pb-5">
      <CabeceraDetalle
        numero={131}
        asunto="Luminaria rota frente al puesto"
        sello="nueva"
        volver="Volver a Mi cuenta"
        imprimir={false}
      />
      <Resaltado>
        <Tarjeta>
          <p className="text-[0.8rem]">
            <span className="font-semibold">Nueva.</span> La recibimos. El Líder de Procesos la va a revisar.
          </p>
        </Tarjeta>
      </Resaltado>
    </MarcoPantalla>
  );
}

/** La línea del recorrido, vista por el socio. */
export function PantallaSocioRecorrido() {
  return (
    <MarcoPantalla titulo="Solicitud N° 131" contenidoClassName="space-y-2 p-3 pb-5">
      <Resaltado>
        <Tarjeta>
          <p className="text-[0.8rem]">
            <span className="font-semibold">En revisión.</span> La está revisando el Líder de Procesos.
          </p>
          <LineaEjemplo
            pasos={[
              { label: "Nueva", fecha: "30/09", estado: "hecho" },
              { label: "En revisión", fecha: "30/09", estado: "actual" },
              { label: "En el Consejo", estado: "pendiente" },
              { label: "Resuelta", estado: "pendiente" },
              { label: "Asignada", estado: "pendiente" },
              { label: "Ejecutada", estado: "pendiente" },
            ]}
          />
        </Tarjeta>
      </Resaltado>
    </MarcoPantalla>
  );
}

/** La respuesta en «Mensajes» y la caja para contestar. */
export function PantallaSocioRespuesta() {
  return (
    <MarcoPantalla titulo="Solicitud N° 131" contenidoClassName="space-y-2 p-3">
      <p className="font-display text-[0.85rem] font-bold">Mensajes</p>
      <Hilo
        mensajes={[
          {
            autor: "Rubén",
            hora: "30/09 11:20",
            texto: "registró la resolución: Se cambia la luminaria esta semana.",
            tipo: "automatico",
          },
          {
            autor: "Marta",
            rol: "Administración",
            hora: "30/09 11:25",
            texto: "Ya pedimos el repuesto. El jueves a la mañana la cambian.",
            tipo: "otro",
          },
        ]}
      />
      <CajaEscribir staff={false} placeholder="Escribile a la administración…" />
    </MarcoPantalla>
  );
}
