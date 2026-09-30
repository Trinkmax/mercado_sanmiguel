import type { CSSProperties, ReactNode } from "react";
import {
  ArrowRight,
  Banknote,
  Check,
  ChevronRight,
  CircleCheck,
  ClipboardCheck,
  FilePen,
  Footprints,
  HandCoins,
  Landmark,
  Maximize2,
  MessageSquareText,
  MessagesSquare,
  Minus,
  PackageOpen,
  Paintbrush,
  Plus,
  Receipt,
  Scan,
  Search,
  Send,
  ShieldAlert,
  Tractor,
  Trash2,
  Truck,
  Undo2,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { Codigo } from "@/components/shared/codigo";
import { CajaRegistradora } from "@/components/shared/iconos";
import { GRIS_BENEFICIO, RAYADO_EN_TERMINO } from "@/components/reportes/fila-ingreso";
import { BotonEjemplo, CampoEjemplo, FilaEjemplo, MarcoPantalla, Resaltado } from "@/components/tour/pantalla";

// Tour guiado · inicio-mapa: pantallas de ejemplo de Inicio y del Mapa (docs/GUIA-TOUR.md).
// Dibujos quietos con datos inventados; se parecen a la pantalla real, en chico.

// ---------------------------------------------------------------------------------------
// Piezas comunes
// ---------------------------------------------------------------------------------------

/** Una tarjeta del sistema, en chico. */
function Tarjeta({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("space-y-1.5 rounded-lg border border-border bg-card p-2.5", className)}>{children}</div>;
}

function TituloTarjeta({ children, derecha }: { children: ReactNode; derecha?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="font-display text-[0.85rem] font-bold">{children}</p>
      {derecha}
    </div>
  );
}

function Chico({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[0.72rem] leading-snug text-muted-foreground", className)}>{children}</p>;
}

/** Barra de cobranza: verde lo cobrado sobre pista roja suave. */
function Barra({ pct, className }: { pct: number; className?: string }) {
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-pendiente-suave", className)}>
      <div className="h-full rounded-full bg-pagado" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Un concepto contra su estimado, como en Inicio y Reportes. */
function FilaConcepto({
  codigo,
  nombre,
  cobrado,
  estimado,
}: {
  codigo: string;
  nombre: string;
  cobrado: number;
  estimado: number;
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2.5 py-1.5">
      <Codigo codigo={codigo} className="mt-0.5" />
      <div className="min-w-0 space-y-1">
        <p className="text-[0.75rem] font-medium">{nombre}</p>
        <Barra pct={(cobrado / estimado) * 100} />
        <div className="flex flex-wrap justify-between gap-x-2 text-[0.72rem]">
          <span>
            <Money monto={cobrado} className="font-semibold text-pagado" />{" "}
            <span className="text-muted-foreground">
              de <Money monto={estimado} />
            </span>
          </span>
          <span className="font-medium text-pendiente">
            Faltan <Money monto={estimado - cobrado} />
          </span>
        </div>
      </div>
    </div>
  );
}

/** Tarjeta de aviso del Inicio: ámbar si espera una acción tuya, blanca si es deuda. */
function Aviso({
  n,
  titulo,
  descripcion,
  cta,
  icono: Icono,
  tono = "parcial",
}: {
  n: number;
  titulo: string;
  descripcion: string;
  cta: string;
  icono?: LucideIcon;
  tono?: "parcial" | "pendiente";
}) {
  const parcial = tono === "parcial";
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg border p-2.5",
        parcial ? "border-parcial bg-parcial-suave" : "border-border bg-card"
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[0.78rem] leading-snug font-semibold">
          <span className={cn("tabular", !parcial && "text-pendiente")}>{n}</span> {titulo}
        </p>
        <Chico>{descripcion}</Chico>
      </div>
      <BotonEjemplo variante={parcial ? "primario" : "contorno"} className="min-h-7 shrink-0 px-2 text-[0.72rem]">
        {Icono ? <Icono /> : null}
        {cta}
      </BotonEjemplo>
    </div>
  );
}

/** Saludo del Inicio: la fecha, "Hola, …" y (si cobra) el botón «Cobrar». */
function Saludo({ nombre, cobrar = true, resaltarCobrar = false }: { nombre: string; cobrar?: boolean; resaltarCobrar?: boolean }) {
  const boton = (
    <BotonEjemplo>
      <HandCoins /> Cobrar
    </BotonEjemplo>
  );
  return (
    <div className="flex items-end justify-between gap-2">
      <div>
        <Chico>Miércoles, 30 de septiembre</Chico>
        <p className="font-display text-[1.05rem] leading-tight font-extrabold">Hola, {nombre}</p>
      </div>
      {cobrar ? resaltarCobrar ? <Resaltado mano={false}>{boton}</Resaltado> : boton : null}
    </div>
  );
}

/** Quintas · Ambulantes · Bono camioneros, como en la caja de portería. */
function DesglosePorteria() {
  const partes: { icono: LucideIcon; label: string; monto: number }[] = [
    { icono: Tractor, label: "Quintas", monto: 300000 },
    { icono: Footprints, label: "Ambulantes", monto: 30000 },
    { icono: Truck, label: "Bono camioneros", monto: 15000 },
  ];
  return (
    <ul className="space-y-1 rounded-md border border-border px-2 py-1.5">
      {partes.map(({ icono: Icono, label, monto }) => (
        <li key={label} className="flex items-center justify-between gap-2 text-[0.72rem]">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Icono className="size-3.5" strokeWidth={2} />
            {label}
          </span>
          <Money monto={monto} className="font-semibold" />
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------------------
// Inicio
// ---------------------------------------------------------------------------------------

/** Portada del capítulo Inicio: el saludo, «Cobrar», la caja de hoy y la cobranza del mes. */
export function PortadaInicio() {
  return (
    <MarcoPantalla titulo="Inicio">
      <Saludo nombre="Marta" resaltarCobrar />
      <Tarjeta>
        <TituloTarjeta derecha={<Sello estado="abierta" />}>Caja de hoy</TituloTarjeta>
        <Chico>Juntaste hoy</Chico>
        <Money monto={1080000} className="font-display text-[1.1rem] font-extrabold" />
      </Tarjeta>
      <Tarjeta>
        <TituloTarjeta>Cobranza de Septiembre de 2026</TituloTarjeta>
        <FilaConcepto codigo="EXME" nombre="Expensas Cobradas" cobrado={21600000} estimado={32400000} />
      </Tarjeta>
    </MarcoPantalla>
  );
}

/** La caja de Administración de hoy, ya con cobros. */
export function PantallaCajaHoyAdmin() {
  return (
    <MarcoPantalla titulo="Inicio · Caja de hoy">
      <Tarjeta className="space-y-2">
        <TituloTarjeta derecha={<Sello estado="abierta" />}>Caja de hoy</TituloTarjeta>
        <div>
          <Chico>Juntaste hoy</Chico>
          <Money monto={1080000} className="font-display text-[1.3rem] font-extrabold" />
          <Chico>
            Cobraste <Money monto={735000} className="font-semibold text-foreground" /> y recibiste{" "}
            <Money monto={345000} className="font-semibold text-foreground" /> de la caja de portería.
          </Chico>
          <Chico>
            Tenés que tener <Money monto={860000} className="font-semibold text-foreground" /> en efectivo
          </Chico>
        </div>
        <BotonEjemplo variante="contorno" className="w-full">
          Ir a la caja <ArrowRight />
        </BotonEjemplo>
      </Tarjeta>
    </MarcoPantalla>
  );
}

/** Los avisos de Administración: lo que espera su acción, cada uno con su botón. */
export function PantallaAvisosAdmin() {
  return (
    <MarcoPantalla titulo="Inicio · Lo que te espera">
      <Resaltado>
        <Aviso
          n={1}
          titulo="caja de portería por recibir"
          descripcion="Sumalas a la caja de Administración para que el día cierre completo."
          cta="Recibir"
          icono={CajaRegistradora}
        />
      </Resaltado>
      <Aviso
        n={2}
        titulo="solicitudes asignadas a Administración"
        descripcion="El Líder de Procesos te las pasó para ejecutar."
        cta="Ver solicitudes"
        icono={MessagesSquare}
      />
      <Aviso
        n={3}
        titulo="clientes con deuda vencida"
        descripcion="Perdieron el beneficio por pagar en término."
        cta="Ver clientes"
        tono="pendiente"
      />
    </MarcoPantalla>
  );
}

/** La cobranza del mes: cada concepto con su barra y el total. */
export function PantallaCobranzaMes() {
  return (
    <MarcoPantalla titulo="Inicio · Cobranza del mes">
      <Tarjeta className="space-y-0.5">
        <TituloTarjeta>Cobranza de Septiembre de 2026</TituloTarjeta>
        <div className="divide-y divide-border">
          <FilaConcepto codigo="EXME" nombre="Expensas Cobradas" cobrado={21600000} estimado={32400000} />
          <FilaConcepto codigo="EXPC" nombre="Alquiler Cocheras" cobrado={186000} estimado={248000} />
          <FilaConcepto codigo="EXPG" nombre="Expensas Galpón" cobrado={360000} estimado={600000} />
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 border-t border-border pt-1.5">
          <Chico>Total del mes</Chico>
          <p className="flex flex-wrap gap-x-2.5 text-[0.75rem]">
            <span>
              <Money monto={22146000} className="font-bold text-pagado" />{" "}
              <span className="text-muted-foreground">cobrado</span>
            </span>
            <span>
              <Money monto={11102000} className="font-bold text-pendiente" />{" "}
              <span className="text-muted-foreground">por cobrar</span>
            </span>
          </p>
        </div>
      </Tarjeta>
    </MarcoPantalla>
  );
}

/** Una fila del escritorio del Líder: número grande, qué es y el botón. */
function FilaEscritorio({
  n,
  titulo,
  detalle,
  cta,
  icono: Icono,
}: {
  n: number;
  titulo: string;
  detalle: string;
  cta: string;
  icono: LucideIcon;
}) {
  return (
    <div className="grid grid-cols-[1.8rem_minmax(0,1fr)_auto] items-center gap-x-2 py-1.5">
      <p className={cn("font-display text-[1.25rem] font-extrabold tabular", n > 0 ? "text-parcial" : "text-muted-foreground/60")}>
        {n}
      </p>
      <div className="min-w-0">
        <p className="text-[0.75rem] font-medium">{titulo}</p>
        <Chico>{detalle}</Chico>
      </div>
      <BotonEjemplo variante={n > 0 ? "primario" : "contorno"} className="min-h-7 px-2 text-[0.72rem]">
        <Icono />
        {cta}
      </BotonEjemplo>
    </div>
  );
}

/** "Tu escritorio" del Líder con cosas esperando su decisión. */
export function PantallaEscritorioLider() {
  return (
    <MarcoPantalla titulo="Inicio · Tu escritorio">
      <Tarjeta className="space-y-0.5">
        <TituloTarjeta>Tu escritorio</TituloTarjeta>
        <Chico>Lo que espera tu decisión, en orden.</Chico>
        <div className="divide-y divide-border">
          <Resaltado mano={false} className="ring-offset-card">
            <FilaEscritorio
              n={3}
              titulo="Cambios por aprobar"
              detalle="Altas, bajas y cambios de clientes y precios que propuso el equipo."
              cta="Revisar"
              icono={ClipboardCheck}
            />
          </Resaltado>
          <FilaEscritorio
            n={2}
            titulo="Solicitudes por revisar"
            detalle="1 nueva · 1 en revisión"
            cta="Ver solicitudes"
            icono={MessagesSquare}
          />
          <FilaEscritorio
            n={1}
            titulo="En el Consejo"
            detalle="Esperan lo que resuelva el Consejo: registralo vos."
            cta="Ver"
            icono={Landmark}
          />
        </div>
      </Tarjeta>
    </MarcoPantalla>
  );
}

/** "Plata de hoy" del Líder: las dos cajas y los gastos pagados desde las cajas. */
export function PantallaPlataHoy() {
  return (
    <MarcoPantalla titulo="Inicio · Plata de hoy">
      <Tarjeta className="space-y-2">
        <TituloTarjeta>Plata de hoy</TituloTarjeta>
        <div>
          <Chico>Entró hoy</Chico>
          <Money monto={1425000} className="font-display text-[1.3rem] font-extrabold text-pagado" />
        </div>
        <div className="divide-y divide-border rounded-md border border-border">
          <div className="flex items-center justify-between gap-2 px-2 py-1.5">
            <span className="space-y-0.5">
              <span className="flex items-center gap-1.5 text-[0.75rem] font-medium">
                <CajaRegistradora className="size-3.5 text-muted-foreground" /> Administración
              </span>
              <Sello estado="abierta" />
            </span>
            <span className="flex items-center gap-0.5 text-[0.78rem] font-semibold">
              <Money monto={1080000} />
              <ChevronRight className="size-3.5 text-muted-foreground" />
            </span>
          </div>
          <div className="space-y-1.5 px-2 py-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="space-y-0.5">
                <span className="flex items-center gap-1.5 text-[0.75rem] font-medium">
                  <CajaRegistradora className="size-3.5 text-muted-foreground" /> Caja de portería
                </span>
                <Sello estado="abierta" />
              </span>
              <span className="flex items-center gap-0.5 text-[0.78rem] font-semibold">
                <Money monto={345000} />
                <ChevronRight className="size-3.5 text-muted-foreground" />
              </span>
            </div>
            <DesglosePorteria />
          </div>
          <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-[0.75rem]">
            <span className="flex items-center gap-1.5">
              <Receipt className="size-3.5 text-muted-foreground" /> Gastos pagados desde las cajas
            </span>
            <Money monto={48000} className="font-semibold text-pendiente" />
          </div>
        </div>
      </Tarjeta>
    </MarcoPantalla>
  );
}

/** "Correcciones de los últimos 7 días": quién anuló o corrigió qué, cuándo y por qué. */
export function PantallaCorrecciones() {
  const filas: { icono: LucideIcon; titulo: string; monto?: number; donde: string; motivo: string; quien: string }[] = [
    {
      icono: Undo2,
      titulo: "Recibo anulado",
      donde: "Caja de Administración del 29/09",
      motivo: "Se cargó dos veces el cobro de Pocho",
      quien: "Marta · 29/09 10:42",
    },
    {
      icono: Banknote,
      titulo: "Cheque rechazado",
      monto: 450000,
      donde: "Cheque N° 20413 · de La Colorada",
      motivo: "Sin fondos",
      quien: "Graciela · 26/09 15:10",
    },
  ];
  return (
    <MarcoPantalla titulo="Inicio · Correcciones">
      <Tarjeta>
        <TituloTarjeta>
          Correcciones de los últimos 7 días <span className="text-muted-foreground tabular">(2)</span>
        </TituloTarjeta>
        <div className="divide-y divide-border">
          {filas.map(({ icono: Icono, titulo, monto, donde, motivo, quien }) => (
            <div key={titulo} className="flex items-start gap-2 py-1.5">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted">
                <Icono className="size-3.5" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex justify-between gap-2 text-[0.75rem] font-semibold">
                  {titulo}
                  {monto ? <Money monto={monto} /> : null}
                </p>
                <p className="text-[0.72rem]">{donde}</p>
                <Chico>{motivo}</Chico>
                <Chico>{quien}</Chico>
              </div>
            </div>
          ))}
        </div>
      </Tarjeta>
    </MarcoPantalla>
  );
}

/** Los avisos del Líder: cajas que no terminaron su camino y deuda vencida. */
export function PantallaAvisosLider() {
  return (
    <MarcoPantalla titulo="Inicio · Avisos">
      <Resaltado>
        <Aviso
          n={1}
          titulo="caja sin validar"
          descripcion="Tesorería todavía no les dio el OK (o validalas vos)."
          cta="Ver la caja"
          icono={Landmark}
        />
      </Resaltado>
      <Aviso
        n={1}
        titulo="caja de portería sin recibir"
        descripcion="Administración todavía no las sumó a su caja."
        cta="Ver cajas"
        icono={CajaRegistradora}
      />
      <Aviso
        n={3}
        titulo="clientes con deuda vencida"
        descripcion="Perdieron el beneficio por pagar en término."
        cta="Ver clientes"
        tono="pendiente"
      />
    </MarcoPantalla>
  );
}

/** Inicio del Jefe de Portería: las quintas del mes y los ambulantes. */
export function PantallaQuintasJefe() {
  return (
    <MarcoPantalla titulo="Inicio · Quintas del mes">
      <Tarjeta className="space-y-2">
        <TituloTarjeta>
          <span className="flex items-center gap-1.5">
            <Tractor className="size-4 text-primary" strokeWidth={2} /> Quintas de Septiembre de 2026
          </span>
        </TituloTarjeta>
        <p className="text-[0.78rem]">
          Se cobró <Money monto={4200000} className="font-display text-[1.15rem] font-extrabold text-pagado" />{" "}
          <span className="text-muted-foreground">
            de <Money monto={6000000} className="font-semibold text-foreground" />
          </span>
        </p>
        <Barra pct={70} className="h-2.5" />
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="mr-1 text-[0.78rem] font-semibold text-pendiente">
            Faltan <Money monto={1800000} />
          </p>
          <Sello estado="al_dia" texto="14 al día" />
          <Sello estado="debe" texto="6 deben" />
        </div>
        <BotonEjemplo>
          <HandCoins /> Cobrar a un quintero
        </BotonEjemplo>
        <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-primary">
              <Footprints className="size-3.5" strokeWidth={2} />
            </span>
            <div>
              <Chico>Ambulantes cobrados este mes</Chico>
              <Money monto={390000} className="font-display text-[0.95rem] font-bold" />
            </div>
          </div>
          <BotonEjemplo variante="contorno" className="min-h-7 px-2 text-[0.72rem]">
            <Footprints /> Cobrar a un ambulante
          </BotonEjemplo>
        </div>
      </Tarjeta>
    </MarcoPantalla>
  );
}

/** La caja de portería de hoy, ya con cobros. */
export function PantallaCajaPorteria() {
  return (
    <MarcoPantalla titulo="Inicio · Caja de portería">
      <Tarjeta className="space-y-2">
        <TituloTarjeta derecha={<Sello estado="abierta" />}>Caja de portería de hoy</TituloTarjeta>
        <div>
          <Chico>En la caja, en efectivo</Chico>
          <Money monto={345000} className="font-display text-[1.3rem] font-extrabold" />
        </div>
        <DesglosePorteria />
        <BotonEjemplo variante="contorno" className="w-full">
          Ir a la caja <ArrowRight />
        </BotonEjemplo>
      </Tarjeta>
    </MarcoPantalla>
  );
}

/** El aviso del Jefe: solicitudes que Portería le pasó para resolver. */
export function PantallaAvisoJefe() {
  return (
    <MarcoPantalla titulo="Inicio · Para resolver">
      <Resaltado>
        <Aviso
          n={2}
          titulo="solicitudes de Portería para resolver"
          descripcion="Resolvela vos o elevala al Líder de Procesos."
          cta="Ver"
          icono={MessagesSquare}
        />
      </Resaltado>
    </MarcoPantalla>
  );
}

/** Lo que espera a Tesorería: cajas, transferencias, cheques y gastos. */
export function PantallaAvisosTesoreria() {
  return (
    <MarcoPantalla titulo="Inicio · Lo que te espera">
      <Resaltado>
        <Aviso
          n={1}
          titulo="caja para contar y validar"
          descripcion="Contá el efectivo y dale el OK definitivo."
          cta="Validar"
          icono={CajaRegistradora}
        />
      </Resaltado>
      <Aviso
        n={3}
        titulo="transferencias sin conciliar"
        descripcion="Cotejalas con el banco y marcalas conciliadas."
        cta="Conciliar"
        icono={Landmark}
      />
      <Aviso
        n={2}
        titulo="cheques para depositar"
        descripcion="Ya se pueden cobrar: llevalos al banco."
        cta="Ver cheques"
        icono={Banknote}
      />
      <Aviso
        n={1}
        titulo="gasto vencido sin pagar"
        descripcion="Pagalos desde Tesorería o desde la caja de un día."
        cta="Ver gastos"
        icono={Receipt}
        tono="pendiente"
      />
    </MarcoPantalla>
  );
}

/** Estimado y cobrado del mes (Tesorería): la barra en cuatro tramos. */
export function PantallaEstimadoTesoreria() {
  const total = 39248000;
  const tramos: { label: string; monto: number; muestra: ReactNode; clase?: string }[] = [
    { label: "Cobrado", monto: 26346000, muestra: <span className="size-2.5 rounded-full bg-pagado" />, clase: "text-pagado" },
    {
      label: "Beneficios otorgados",
      monto: 1944000,
      muestra: <span className={cn("size-2.5 rounded-full", GRIS_BENEFICIO)} />,
    },
    {
      label: "Beneficio en término",
      monto: 1296000,
      muestra: <span className="size-2.5 rounded-full bg-muted" style={RAYADO_EN_TERMINO} />,
    },
    {
      label: "Falta cobrar",
      monto: 9662000,
      muestra: <span className="size-2.5 rounded-full bg-pendiente-suave ring-1 ring-pendiente/40" />,
      clase: "text-pendiente",
    },
  ];
  const ancho = (m: number): CSSProperties => ({ width: `${(m / total) * 100}%` });
  return (
    <MarcoPantalla titulo="Inicio · Estimado y cobrado">
      <Tarjeta className="space-y-2">
        <TituloTarjeta>Estimado y cobrado de Septiembre de 2026</TituloTarjeta>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Chico>Se tendría que cobrar</Chico>
            <Money monto={total} className="font-display text-[1rem] font-extrabold" />
          </div>
          <div>
            <Chico>Se cobró</Chico>
            <p className="flex items-baseline gap-1">
              <Money monto={26346000} className="font-display text-[1rem] font-extrabold text-pagado" />
              <span className="text-[0.72rem] font-semibold text-muted-foreground">67 %</span>
            </p>
          </div>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-pendiente-suave">
          <div className="h-full bg-pagado" style={ancho(26346000)} />
          <div className={cn("h-full", GRIS_BENEFICIO)} style={ancho(1944000)} />
          <div className="h-full bg-muted" style={{ ...ancho(1296000), ...RAYADO_EN_TERMINO }} />
        </div>
        <dl className="grid grid-cols-2 gap-x-2 gap-y-1.5">
          {tramos.map((t) => (
            <div key={t.label}>
              <dt className="flex items-center gap-1.5 text-[0.72rem] text-muted-foreground">
                <span className="flex shrink-0">{t.muestra}</span>
                {t.label}
              </dt>
              <dd>
                <Money monto={t.monto} className={cn("text-[0.78rem] font-semibold", t.clase)} />
              </dd>
            </div>
          ))}
        </dl>
        <div className="flex items-center gap-2 border-t border-border pt-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-primary">
            <Truck className="size-3.5" strokeWidth={2} />
          </span>
          <div>
            <Chico>Bono camioneros del mes (cobrado en portería)</Chico>
            <Money monto={420000} className="font-display text-[0.95rem] font-bold" />
          </div>
        </div>
      </Tarjeta>
    </MarcoPantalla>
  );
}

// ---------------------------------------------------------------------------------------
// Mapa
// ---------------------------------------------------------------------------------------

type EstadoLugar = "al_dia" | "debe" | "vencido" | "libre" | "anonimo";

/** Colores del plano (los mismos de plano-svg), para dibujar los bloques en chico. */
const PINTURA: Record<EstadoLugar, { tapa: string; borde: string; faldon: string; texto: string }> = {
  al_dia: { tapa: "oklch(0.946 0.046 148)", borde: "oklch(0.64 0.1 148)", faldon: "oklch(0.51 0.12 150)", texto: "oklch(0.46 0.12 148)" },
  debe: { tapa: "oklch(0.962 0.026 27)", borde: "oklch(0.6 0.17 27)", faldon: "oklch(0.95 0.018 27)", texto: "oklch(0.52 0.19 27)" },
  vencido: { tapa: "oklch(0.525 0.19 27)", borde: "oklch(0.42 0.15 27)", faldon: "oklch(0.385 0.13 27)", texto: "#fff" },
  libre: { tapa: "#fff", borde: "oklch(0.79 0.014 258)", faldon: "oklch(0.885 0.01 258)", texto: "oklch(0.5 0.022 262)" },
  anonimo: { tapa: "oklch(0.938 0.013 74)", borde: "oklch(0.74 0.02 70)", faldon: "oklch(0.74 0.024 68)", texto: "oklch(0.38 0.03 262)" },
};

const RAYAS_DEBE = "repeating-linear-gradient(115deg, oklch(0.6 0.17 27) 0 1.5px, transparent 1.5px 4px)";

/** Un lugar del plano en chico: tapa, faldón (liso, a rayas o punteado) y su número. */
function Lugar({
  estado,
  numero,
  apodo,
  className,
  atenuado = false,
  elegido = false,
}: {
  estado: EstadoLugar;
  numero: string;
  apodo?: string;
  className?: string;
  atenuado?: boolean;
  elegido?: boolean;
}) {
  const p = PINTURA[estado];
  return (
    <div
      className={cn(
        "flex min-h-9 flex-col overflow-hidden rounded-[4px] border",
        atenuado && "opacity-35",
        elegido && "ring-2 ring-primary ring-offset-1 ring-offset-background",
        className
      )}
      style={{ borderColor: p.borde, background: p.tapa }}
    >
      <div className="flex flex-1 flex-col items-center justify-center px-0.5 leading-none">
        <span
          className={cn(
            "font-display text-[0.72rem] font-extrabold tabular",
            estado === "libre" && "rounded-[2px] border border-dashed px-0.5"
          )}
          style={{ color: p.texto, borderColor: estado === "libre" ? p.borde : undefined }}
        >
          {numero}
        </span>
        {apodo ? (
          <span className="mt-0.5 max-w-full truncate text-[0.72rem] leading-none font-semibold" style={{ color: p.texto }}>
            {apodo}
          </span>
        ) : null}
      </div>
      <div className="h-1.5" style={{ background: estado === "debe" ? `${RAYAS_DEBE}, ${p.faldon}` : p.faldon }} />
    </div>
  );
}

/** Muestra de un estado (para la leyenda). */
function Muestra({ estado }: { estado: EstadoLugar }) {
  const p = PINTURA[estado];
  return (
    <span
      aria-hidden
      className="flex h-4 w-5 shrink-0 flex-col overflow-hidden rounded-[3px] border"
      style={{ borderColor: p.borde, background: p.tapa }}
    >
      <span className="flex-1" />
      <span className="h-1.5" style={{ background: estado === "debe" ? `${RAYAS_DEBE}, ${p.faldon}` : p.faldon }} />
    </span>
  );
}

/** Chip de la leyenda que filtra el plano. */
function ChipFiltro({ estado, label, n, activo = false }: { estado: EstadoLugar; label: string; n: string; activo?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-[0.72rem] font-medium whitespace-nowrap",
        activo ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground"
      )}
    >
      <Muestra estado={estado} />
      {label}
      <span className="font-semibold text-foreground tabular">{n}</span>
    </span>
  );
}

/** La barra de arriba del mapa: buscador y botones. */
function BarraMapa({ texto, derecha }: { texto?: string; derecha?: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex min-h-8 min-w-0 flex-1 items-center gap-1.5 rounded-md border border-border bg-card px-2 text-[0.75rem]">
        <Search className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
        {texto ? <span>{texto}</span> : <span className="truncate text-muted-foreground">Buscá puestero o puesto</span>}
      </div>
      {derecha}
    </div>
  );
}

function BotonIcono({ children }: { children: ReactNode }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card [&_svg]:size-3.5">
      {children}
    </span>
  );
}

/** Los botones de zoom del plano: acercar, alejar y ver todo el predio. */
function Zoom() {
  return (
    <span className="flex overflow-hidden rounded-md border border-border bg-card shadow-sm [&_svg]:size-3.5">
      <span className="flex size-7 items-center justify-center">
        <Plus strokeWidth={2.2} />
      </span>
      <span className="flex size-7 items-center justify-center border-l border-border">
        <Minus strokeWidth={2.2} />
      </span>
      <span className="flex size-7 items-center justify-center border-l border-border">
        <Scan strokeWidth={2} />
      </span>
    </span>
  );
}

/** Una fila de puestos del plano (un pasillo), con sus colores. */
const FILA_A: { n: string; e: EstadoLugar; apodo?: string }[] = [
  { n: "52", e: "al_dia" },
  { n: "54", e: "al_dia", apodo: "Toto" },
  { n: "56", e: "libre" },
  { n: "58", e: "debe", apodo: "Pocho" },
  { n: "60", e: "debe", apodo: "Pocho" },
  { n: "62", e: "vencido" },
];
const FILA_B: { n: string; e: EstadoLugar; apodo?: string }[] = [
  { n: "53", e: "al_dia" },
  { n: "55", e: "vencido" },
  { n: "57", e: "al_dia", apodo: "Chola" },
  { n: "59", e: "libre" },
  { n: "61", e: "al_dia" },
  { n: "63", e: "debe" },
];

/** Un pedacito del plano: dos filas de puestos con el pasillo en el medio. */
function PlanoChico({
  elegidos = [],
  atenuarResto = false,
  soloEstado,
  children,
  className,
}: {
  elegidos?: string[];
  atenuarResto?: boolean;
  soloEstado?: EstadoLugar;
  children?: ReactNode;
  className?: string;
}) {
  const atenuado = (n: string, e: EstadoLugar) =>
    soloEstado ? e !== soloEstado : atenuarResto && elegidos.length > 0 && !elegidos.includes(n);
  return (
    <div className={cn("relative space-y-1.5 rounded-lg bg-muted/60 p-2", className)}>
      <div className="grid grid-cols-6 gap-1">
        {FILA_A.map((l) => (
          <Lugar key={l.n} estado={l.e} numero={l.n} apodo={l.apodo} atenuado={atenuado(l.n, l.e)} elegido={elegidos.includes(l.n)} />
        ))}
      </div>
      <div className="h-2 rounded-sm bg-background/70" />
      <div className="grid grid-cols-6 gap-1">
        {FILA_B.map((l) => (
          <Lugar key={l.n} estado={l.e} numero={l.n} apodo={l.apodo} atenuado={atenuado(l.n, l.e)} elegido={elegidos.includes(l.n)} />
        ))}
      </div>
      {children}
    </div>
  );
}

/** Portada del capítulo Mapa: buscador, leyenda que filtra y el plano pintado. */
export function PortadaMapa() {
  return (
    <MarcoPantalla titulo="Mapa del mercado">
      <BarraMapa
        derecha={
          <BotonIcono>
            <Maximize2 />
          </BotonIcono>
        }
      />
      <div className="flex flex-wrap items-center gap-1">
        <ChipFiltro estado="al_dia" label="Al día" n="14" />
        <ChipFiltro estado="debe" label="Debe el mes" n="6" />
        <ChipFiltro estado="vencido" label="Deuda atrasada" n="4" />
        <ChipFiltro estado="libre" label="Libres" n="6" />
      </div>
      <PlanoChico>
        <div className="flex pt-0.5">
          <Zoom />
        </div>
      </PlanoChico>
    </MarcoPantalla>
  );
}

/** Qué dice cada color del plano, con el filtro «Debe el mes» tocado. */
export function PantallaColoresMapa() {
  const filas: { estado: EstadoLugar; label: string; que: string }[] = [
    { estado: "al_dia", label: "Al día", que: "Pagó todo lo que debe." },
    { estado: "debe", label: "Debe el mes", que: "Le falta pagar algo de este mes." },
    { estado: "vencido", label: "Deuda atrasada", que: "Debe meses anteriores." },
    { estado: "libre", label: "Libres", que: "No tiene a nadie asignado." },
  ];
  return (
    <MarcoPantalla titulo="Mapa · Los colores">
      <ul className="space-y-1">
        {filas.map((f) => (
          <li key={f.estado} className="flex items-center gap-2 text-[0.75rem]">
            <Muestra estado={f.estado} />
            <span className="w-24 shrink-0 font-semibold">{f.label}</span>
            <span className="text-muted-foreground">{f.que}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-1 border-t border-border pt-2">
        <ChipFiltro estado="al_dia" label="Al día" n="14" />
        <Resaltado mano={false}>
          <ChipFiltro estado="debe" label="Debe el mes" n="6" activo />
        </Resaltado>
        <ChipFiltro estado="vencido" label="Deuda atrasada" n="4" />
      </div>
      <PlanoChico soloEstado="debe" />
    </MarcoPantalla>
  );
}

/** Los colores del mapa del Jefe de Portería: sus quintas, y los puestos todos iguales. */
export function PantallaColoresQuintas() {
  const filas: { estado: EstadoLugar; label: string; que: string }[] = [
    { estado: "al_dia", label: "Al día", que: "El quintero pagó todo." },
    { estado: "debe", label: "Deben el mes", que: "Le falta pagar algo de este mes." },
    { estado: "vencido", label: "Deuda atrasada", que: "Debe meses anteriores." },
    { estado: "anonimo", label: "Puestos", que: "Todos iguales: son de Administración." },
  ];
  return (
    <MarcoPantalla titulo="Mapa · Tus quinteros">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div>
          <p className="text-[0.78rem]">
            <span className="font-display font-bold tabular">20</span>{" "}
            <span className="text-muted-foreground">quinteros</span>
          </p>
          <Chico>
            <Money monto={1800000} className="font-semibold text-pendiente" /> por cobrar este mes
          </Chico>
        </div>
        <div className="flex flex-wrap gap-1">
          <ChipFiltro estado="al_dia" label="Al día" n="14" />
          <ChipFiltro estado="debe" label="Deben el mes" n="5" />
          <ChipFiltro estado="vencido" label="Deuda atrasada" n="1" />
        </div>
      </div>
      <ul className="space-y-1 border-t border-border pt-2">
        {filas.map((f) => (
          <li key={f.estado} className="flex items-center gap-2 text-[0.75rem]">
            <Muestra estado={f.estado} />
            <span className="w-24 shrink-0 font-semibold">{f.label}</span>
            <span className="text-muted-foreground">{f.que}</span>
          </li>
        ))}
      </ul>
    </MarcoPantalla>
  );
}

/** El buscador del mapa con resultados: se busca por nombre, apodo o número. */
export function PantallaBuscarMapa() {
  const filas: { insignia: string; lugar?: boolean; titulo: string; detalle: string }[] = [
    { insignia: "112", titulo: "Ramón Giménez · “Pocho”", detalle: "Puestos 58 y 60 · 1 cochera" },
    { insignia: "87", titulo: "Pochoclos Don Tito", detalle: "Puesto 31" },
  ];
  return (
    <MarcoPantalla titulo="Mapa del mercado">
      <Resaltado mano={false}>
        <BarraMapa texto="pocho" />
      </Resaltado>
      <div className="space-y-0.5 rounded-md border border-border bg-card p-1 shadow-sm">
        {filas.map((f, i) => (
          <div key={f.insignia} className={cn("flex items-center gap-2 rounded px-1.5 py-1", i === 0 && "bg-muted")}>
            <span
              className={cn(
                "flex h-6 min-w-7 shrink-0 items-center justify-center rounded px-1 font-display text-[0.72rem] font-bold tabular",
                f.lugar ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"
              )}
            >
              {f.insignia}
            </span>
            <span className="min-w-0">
              <span className="block text-[0.75rem] font-medium">{f.titulo}</span>
              <Chico>{f.detalle}</Chico>
            </span>
          </div>
        ))}
      </div>
      <Chico>También podés escribir un número: «58», «local 3», «cochera 12».</Chico>
    </MarcoPantalla>
  );
}

/** Pie de una tarjeta del mapa: la deuda y los botones (Cobrar resaltado). */
function PieTarjeta({ deuda }: { deuda: number }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
      <div className="mr-auto">
        <Chico>Deuda</Chico>
        <Money monto={deuda} className="font-display text-[1rem] font-bold text-pendiente" />
      </div>
      <BotonEjemplo variante="contorno" className="min-h-7 px-2 text-[0.72rem]">
        Ver ficha <ArrowRight />
      </BotonEjemplo>
      <Resaltado>
        <BotonEjemplo className="min-h-7 px-2.5 text-[0.72rem]">
          <HandCoins /> Cobrar
        </BotonEjemplo>
      </Resaltado>
    </div>
  );
}

/** Chips de los lugares de un cliente, como en la tarjeta real. */
function ChipsLugares({ grupos }: { grupos: { tipo: string; numeros: string[] }[] }) {
  return (
    <div className="space-y-1">
      {grupos.map((g) => (
        <div key={g.tipo} className="flex items-center gap-1">
          <span className="w-16 shrink-0 text-[0.72rem] text-muted-foreground">{g.tipo}</span>
          {g.numeros.map((n) => (
            <span
              key={n}
              className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-border bg-card px-1 font-display text-[0.75rem] font-bold tabular"
            >
              {n}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Cabecera de la tarjeta de un cliente en el mapa: sello, carpeta, nombre y apodo. */
function CabeceraCliente({ nombre, apodo, carpeta }: { nombre: string; apodo: string; carpeta: number }) {
  return (
    <div className="relative space-y-0.5 pr-6">
      <X className="absolute top-0 right-0 size-3.5 text-muted-foreground" strokeWidth={2} />
      <div className="flex items-center gap-1.5">
        <Sello estado="debe" texto="Debe el mes" />
        <span className="text-[0.72rem] text-muted-foreground tabular">Carpeta N° {carpeta}</span>
      </div>
      <p className="font-display text-[0.95rem] leading-snug font-bold">{nombre}</p>
      <Chico>Le dicen “{apodo}”</Chico>
    </div>
  );
}

/** La tarjeta que se abre al tocar un puesto ocupado: quién está, sus lugares y su deuda. */
export function PantallaTarjetaPuesto() {
  return (
    <MarcoPantalla titulo="Mapa del mercado">
      <PlanoChico elegidos={["58", "60"]} atenuarResto className="pb-6" />
      <div className="relative mx-1.5 -mt-6 space-y-2 rounded-xl bg-card p-2.5 shadow-[0_10px_24px_-10px_rgb(15_23_60/0.5)] ring-1 ring-foreground/10">
        <CabeceraCliente nombre="Ramón Giménez" apodo="Pocho" carpeta={112} />
        <ChipsLugares
          grupos={[
            { tipo: "Puestos", numeros: ["58", "60"] },
            { tipo: "Cochera", numeros: ["12"] },
          ]}
        />
        <PieTarjeta deuda={1080000} />
      </div>
    </MarcoPantalla>
  );
}

/** La tarjeta de un quintero en el mapa del Jefe de Portería. */
export function PantallaTarjetaQuintero() {
  return (
    <MarcoPantalla titulo="Mapa del mercado">
      <div className="space-y-2 rounded-xl bg-card p-2.5 shadow-[0_10px_24px_-10px_rgb(15_23_60/0.5)] ring-1 ring-foreground/10">
        <CabeceraCliente nombre="Juan Carlos Ruiz" apodo="El Tano" carpeta={205} />
        <ChipsLugares grupos={[{ tipo: "Quintas", numeros: ["40", "41"] }]} />
        <PieTarjeta deuda={150000} />
      </div>
    </MarcoPantalla>
  );
}

/** Asignar puestos: el pincel elegido, el toque en el plano y el aviso con «Deshacer». */
export function PantallaAsignar() {
  return (
    <MarcoPantalla titulo="Mapa · Asignar puestos">
      <BarraMapa
        derecha={
          <BotonEjemplo className="min-h-8 px-2.5 text-[0.72rem]">
            <Check /> Listo
          </BotonEjemplo>
        }
      />
      <div className="relative rounded-lg ring-2 ring-primary/45">
        <div className="flex justify-center pt-1.5">
          <p className="flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-[0.72rem] font-medium text-primary-foreground">
            <Paintbrush className="size-3" strokeWidth={2} /> Asignando a Pocho: tocá sus puestos
          </p>
        </div>
        <div className="grid grid-cols-6 gap-1 p-2">
          <Lugar estado="al_dia" numero="54" />
          <Lugar estado="libre" numero="56" />
          <Lugar estado="debe" numero="58" apodo="Pocho" elegido />
          <Resaltado className="rounded-[4px] ring-offset-1">
            <Lugar estado="debe" numero="60" apodo="Pocho" />
          </Resaltado>
          <Lugar estado="vencido" numero="62" />
          <Lugar estado="libre" numero="64" />
        </div>
      </div>
      <div className="space-y-1.5 rounded-lg border border-border bg-card p-2.5">
        <div className="flex items-start gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Paintbrush className="size-3.5" strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1">
            <Chico>Asignando a · Carpeta N° 112</Chico>
            <p className="font-display text-[0.85rem] font-bold">
              Ramón Giménez <span className="font-sans text-[0.72rem] font-normal text-muted-foreground">· “Pocho”</span>
            </p>
            <Chico>Tocá un puesto libre para sumárselo; tocá uno suyo para sacárselo.</Chico>
          </div>
          <BotonEjemplo variante="contorno" className="min-h-7 px-2 text-[0.72rem]">
            Elegir a otro
          </BotonEjemplo>
        </div>
        <p className="flex items-center justify-end gap-1 text-[0.72rem] font-medium text-pagado">
          <CircleCheck className="size-3" strokeWidth={2.2} /> Coincide con lo facturado
        </p>
        <div className="flex items-baseline gap-1.5 text-[0.72rem]">
          <Codigo codigo="EXME" />
          <span className="font-display text-[0.85rem] font-bold tabular">2</span>
          <span className="text-muted-foreground">de 2 puestos facturados</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-full rounded-full bg-primary" />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 rounded-lg bg-foreground px-2.5 py-1.5 text-[0.75rem] text-background">
        <span className="flex items-center gap-1.5">
          <Check className="size-3.5" strokeWidth={2.2} /> Puesto 60 → Pocho
        </span>
        <span className="rounded bg-background/15 px-1.5 py-0.5 font-semibold">Deshacer</span>
      </div>
    </MarcoPantalla>
  );
}

/** «Para revisar» (modo Asignar puestos): lo que no coincide entre el plano y la carpeta. */
export function PantallaParaRevisar() {
  return (
    <MarcoPantalla titulo="Asignar puestos · Para revisar">
      <div className="space-y-2 rounded-lg border border-border bg-muted/25 p-2.5">
        <p className="font-display text-[0.8rem] font-bold">Para revisar</p>
        <div className="space-y-1">
          <p className="text-[0.72rem] font-semibold">Por ubicar</p>
          <Chico>Facturan más de lo que tienen en el plano.</Chico>
          <div className="overflow-hidden rounded-md border border-border bg-card">
            <div className="px-2 py-1.5">
              <p className="text-[0.75rem] font-medium">La Colorada</p>
              <Chico>Factura 2 puestos y tiene 1 en el plano.</Chico>
            </div>
            <div className="flex items-center gap-1.5 border-t border-border bg-muted/30 px-2 py-1.5 text-[0.72rem] font-medium text-primary">
              <FilePen className="size-3.5" strokeWidth={2} />
              Facturar 1 en la carpeta
              <Codigo codigo="EXME" className="ml-auto" />
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-[0.72rem] font-semibold">Ocupan de más</p>
          <Chico>Tienen en el plano más de lo que se les factura.</Chico>
          <div className="overflow-hidden rounded-md border border-border bg-card">
            <div className="px-2 py-1.5">
              <p className="text-[0.75rem] font-medium">Don Ramón</p>
              <p className="text-[0.72rem] text-parcial">Factura 1 puesto y tiene 2 en el plano.</p>
            </div>
            <div className="flex items-center gap-1.5 border-t border-border bg-muted/30 px-2 py-1.5">
              <Sello estado="pendiente_aprobacion" />
            </div>
          </div>
        </div>
      </div>
    </MarcoPantalla>
  );
}

/** El aviso al Líder que manda el Jefe de Portería al tocar un puesto. */
export function PantallaAvisoPuesto() {
  const motivos: { valor: string; icono: LucideIcon; activo?: boolean }[] = [
    { valor: "Luz / electricidad", icono: Zap, activo: true },
    { valor: "Limpieza / residuos", icono: Trash2 },
    { valor: "Mercadería en el pasillo", icono: PackageOpen },
    { valor: "Seguridad", icono: ShieldAlert },
    { valor: "Otro", icono: MessageSquareText },
  ];
  return (
    <MarcoPantalla titulo="Mapa del mercado">
      <div className="space-y-2 rounded-xl bg-card p-2.5 shadow-[0_10px_24px_-10px_rgb(15_23_60/0.5)] ring-1 ring-foreground/10">
        <div className="relative pr-6">
          <X className="absolute top-0 right-0 size-3.5 text-muted-foreground" strokeWidth={2} />
          <p className="font-display text-[0.95rem] font-bold">Puesto 58</p>
          <Chico>¿Viste algo en este puesto? Avisale al Líder de Procesos.</Chico>
        </div>
        <div className="flex flex-wrap gap-1">
          {motivos.map(({ valor, icono: Icono, activo }) => (
            <span
              key={valor}
              className={cn(
                "inline-flex min-h-6 items-center gap-1 rounded-full border px-2 text-[0.72rem] font-medium",
                activo ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card"
              )}
            >
              <Icono className="size-3" strokeWidth={2} />
              {valor}
            </span>
          ))}
        </div>
        <CampoEjemplo etiqueta="Contá qué pasó (si querés)" valor="El cable del tablero está suelto" />
        <Resaltado>
          <BotonEjemplo className="w-full">
            <Send /> Avisar al Líder sobre el puesto 58
          </BotonEjemplo>
        </Resaltado>
        <div className="border-t border-border pt-1.5">
          <p className="text-[0.72rem] font-semibold">Avisos anteriores de este puesto</p>
          <FilaEjemplo className="mt-1 py-1" derecha={<Sello estado="en_revision" />}>
            <p className="text-[0.72rem] font-medium">Mercadería en el pasillo</p>
            <Chico>N° 198 · 12/09</Chico>
          </FilaEjemplo>
        </div>
      </div>
      <div className="flex items-center gap-1.5 rounded-lg bg-foreground px-2.5 py-1.5 text-[0.72rem] text-background">
        <Check className="size-3.5 shrink-0" strokeWidth={2.2} />
        Listo: el Líder recibió tu aviso (solicitud N° 214)
      </div>
    </MarcoPantalla>
  );
}
