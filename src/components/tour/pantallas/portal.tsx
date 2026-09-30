import {
  ArrowLeft,
  Banknote,
  Bell,
  CheckCircle2,
  Download,
  Printer,
  Upload,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { BotonEjemplo, CampoEjemplo, MarcoPantalla, Resaltado } from "@/components/tour/pantalla";

// Tour guiado · portal: pantallas de ejemplo del capítulo "Mi cuenta" del socio
// (docs/GUIA-TOUR.md). Dibujos quietos con datos inventados: Rosa Medina, carpeta 58, en
// septiembre de 2026. Los números cierran entre sí: debe $ 450.000 con el beneficio;
// si se le pasa el 30/09, pasa a deber $ 510.000. La energía, a $ 600 el kWh.

const SELLO = "px-1.5 py-[0.2rem] text-[0.72rem]";

type Nivel = "al_dia" | "en_termino" | "vencido";

const FONDO_NIVEL: Record<Nivel, string> = {
  al_dia: "border-pagado/30 bg-pagado-suave",
  en_termino: "border-parcial/40 bg-parcial-suave",
  vencido: "border-pendiente/30 bg-pendiente-suave",
};

// ---------------------------------------------------------------------------------------
// Piezas chicas
// ---------------------------------------------------------------------------------------

/** Las tres luces del semáforo: rojo arriba, amarillo al medio, verde abajo. */
function Luces({ nivel }: { nivel: Nivel }) {
  const luces: { clave: Nivel; encendida: string; apagada: string }[] = [
    { clave: "vencido", encendida: "bg-pendiente ring-pendiente/25", apagada: "bg-pendiente/15" },
    { clave: "en_termino", encendida: "bg-parcial ring-parcial/25", apagada: "bg-parcial/15" },
    { clave: "al_dia", encendida: "bg-pagado ring-pagado/25", apagada: "bg-pagado/15" },
  ];
  return (
    <div className="flex shrink-0 flex-col items-center justify-center gap-1.5 rounded-full bg-foreground/85 px-1.5 py-2">
      {luces.map((l) => (
        <span
          key={l.clave}
          className={cn("block size-4 rounded-full", l.clave === nivel ? cn("ring-2", l.encendida) : l.apagada)}
        />
      ))}
    </div>
  );
}

/** La caja del semáforo, como arriba de «Mi cuenta». */
function Semaforo({ nivel, children, className }: { nivel: Nivel; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-stretch gap-3 rounded-xl border-2 p-2.5", FONDO_NIVEL[nivel], className)}>
      <Luces nivel={nivel} />
      <div className="min-w-0 flex-1 space-y-1 self-center">
        <Sello estado={nivel} className={SELLO} />
        {children}
      </div>
    </div>
  );
}

function AlDia({ gracias = true }: { gracias?: boolean }) {
  return (
    <div>
      <p className="font-display text-[1.05rem] font-bold tracking-tight text-pagado">Estás al día</p>
      {gracias ? <p className="text-[0.75rem]">No debés nada. ¡Gracias!</p> : null}
    </div>
  );
}

function APagarEnTermino() {
  return (
    <div>
      <Money monto={450000} className="block font-display text-[1.2rem] font-bold text-parcial" />
      <p className="leading-snug">
        para pagar hasta el <span className="font-semibold tabular">30/09/2026</span>
      </p>
    </div>
  );
}

function APagarVencido() {
  return (
    <div>
      <Money monto={510000} className="block font-display text-[1.2rem] font-bold text-pendiente" />
      <p className="leading-snug">es lo que tenés que pagar hoy</p>
    </div>
  );
}

function LineaBeneficio() {
  return (
    <p className="border-t border-parcial/30 pt-1 text-[0.75rem] leading-snug">
      Pagando a tiempo mantenés el beneficio de <Money monto={60000} className="font-semibold" />.
    </p>
  );
}

function LineaBeneficioPerdido() {
  return (
    <p className="border-t border-pendiente/20 pt-1 text-[0.75rem] leading-snug">
      <Money monto={510000} className="font-semibold" /> vencido desde el <span className="tabular">30/09/2026</span>:
      perdiste el beneficio.
    </p>
  );
}

/** "Hola, Rosa" y los dos botones grandes del portal. */
function CabeceraPortal() {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        <span className="flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-primary bg-primary px-2 text-[0.75rem] font-semibold text-primary-foreground">
          <Wallet className="size-3.5 shrink-0" strokeWidth={2} />
          Mi cuenta
        </span>
        <span className="flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2 text-[0.75rem] font-semibold">
          <Bell className="size-3.5 shrink-0" strokeWidth={2} />
          Comunicaciones
          <span className="inline-flex size-4.5 items-center justify-center rounded-full bg-parcial text-[0.72rem] font-bold text-primary-foreground">
            1
          </span>
        </span>
      </div>
      <div>
        <p className="font-display text-[1.05rem] font-bold tracking-tight">Hola, Rosa</p>
        <p className="text-[0.72rem] text-muted-foreground">Rosa Medina · Carpeta N° 58</p>
      </div>
    </div>
  );
}

const CONCEPTOS = [
  { descripcion: "Expensas Puestos × 2", vence: "30/09/2026", monto: 400000, estado: "pendiente" },
  { descripcion: "Alquiler Cocheras", vence: "30/09/2026", monto: 50000, estado: "parcial" },
  { descripcion: "Energía · Medidor N° 58 (160 kWh)", vence: null, monto: 96000, estado: "pagado" },
] as const;

/** Un renglón de «Tus conceptos»: lo pagado va gris y sin fecha; lo que falta, con su vencimiento. */
function FilaConcepto({ c }: { c: (typeof CONCEPTOS)[number] }) {
  const pagado = c.estado === "pagado";
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <div className="min-w-0">
        <p className="leading-tight font-medium">{c.descripcion}</p>
        {c.vence ? <p className="text-[0.72rem] text-muted-foreground tabular">Vence el {c.vence}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Money monto={c.monto} className={pagado ? "text-muted-foreground" : "font-semibold"} />
        <Sello estado={c.estado} className={SELLO} />
      </div>
    </div>
  );
}

function TarjetaConceptos() {
  return (
    <div className="rounded-lg border border-border bg-card px-2.5 py-2">
      <p className="font-display text-[0.85rem] font-bold">Tus conceptos de Septiembre de 2026</p>
      <div className="divide-y divide-border">
        {CONCEPTOS.map((c) => (
          <FilaConcepto key={c.descripcion} c={c} />
        ))}
      </div>
    </div>
  );
}

const RECIBOS = [
  { numero: 2417, fecha: "15/09/2026", como: "Efectivo", monto: 126000 },
  { numero: 2290, fecha: "28/08/2026", como: "Transferencia de Rosa Medina", monto: 556000 },
];

// ---------------------------------------------------------------------------------------
// Portada
// ---------------------------------------------------------------------------------------

/** Portada de "Mi cuenta": el saludo, el semáforo y lo del mes. */
export function PortadaSocioCuenta() {
  return (
    <MarcoPantalla titulo="Mi cuenta">
      <CabeceraPortal />
      <Resaltado mano={false}>
        <Semaforo nivel="en_termino">
          <APagarEnTermino />
          <LineaBeneficio />
        </Semaforo>
      </Resaltado>
      <div className="pt-1">
        <TarjetaConceptos />
      </div>
    </MarcoPantalla>
  );
}

// ---------------------------------------------------------------------------------------
// El semáforo y el beneficio
// ---------------------------------------------------------------------------------------

/** Los tres colores del semáforo, uno debajo del otro. */
export function PantallaSemaforoColores() {
  return (
    <MarcoPantalla titulo="Mi cuenta">
      <Semaforo nivel="al_dia">
        <AlDia />
      </Semaforo>
      <Semaforo nivel="en_termino">
        <APagarEnTermino />
      </Semaforo>
      <Semaforo nivel="vencido">
        <APagarVencido />
      </Semaforo>
    </MarcoPantalla>
  );
}

/** El mismo mes pagado a tiempo (con el beneficio) y después del vencimiento (sin él). */
export function PantallaBeneficioSocio() {
  return (
    <MarcoPantalla titulo="Mi cuenta">
      <p className="text-[0.72rem] font-semibold text-muted-foreground">Si pagás a tiempo</p>
      <Semaforo nivel="en_termino">
        <APagarEnTermino />
        <p className="text-[0.75rem] font-medium">Te quedan 10 días</p>
        <Resaltado className="ring-offset-parcial-suave">
          <LineaBeneficio />
        </Resaltado>
      </Semaforo>
      <p className="pt-2 text-[0.72rem] font-semibold text-muted-foreground">Si se pasa la fecha</p>
      <Semaforo nivel="vencido">
        <APagarVencido />
        <LineaBeneficioPerdido />
      </Semaforo>
    </MarcoPantalla>
  );
}

// ---------------------------------------------------------------------------------------
// Lo del mes, los pagos y el recibo
// ---------------------------------------------------------------------------------------

/** «Tus conceptos» del mes con los tres sellos, y un mes anterior ya pagado. */
export function PantallaConceptosSocio() {
  return (
    <MarcoPantalla titulo="Mi cuenta">
      <Resaltado mano={false}>
        <TarjetaConceptos />
      </Resaltado>
      <div className="mt-2 rounded-lg border border-border bg-card px-2.5 py-2">
        <p className="font-display text-[0.85rem] font-bold">Meses anteriores</p>
        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="font-medium">Agosto de 2026</p>
          <p className="flex items-center gap-1 font-medium text-pagado">
            <CheckCircle2 className="size-3.5" strokeWidth={2} />
            Todo pagado
          </p>
        </div>
      </div>
    </MarcoPantalla>
  );
}

/** «Tus pagos»: un renglón por recibo, con su botón «Recibo». */
export function PantallaPagosSocio() {
  return (
    <MarcoPantalla titulo="Mi cuenta">
      <div className="rounded-lg border border-border bg-card px-2.5 py-2">
        <p className="font-display text-[0.85rem] font-bold">Tus pagos</p>
        <div className="divide-y divide-border">
          {RECIBOS.map((r, i) => {
            const boton = (
              <BotonEjemplo variante="contorno" className="min-h-7 px-2 text-[0.72rem]">
                <Download /> Recibo
              </BotonEjemplo>
            );
            return (
              <div key={r.numero} className="flex items-center gap-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    Recibo N° <span className="tabular">{r.numero}</span>
                  </p>
                  <p className="text-[0.72rem] leading-tight text-muted-foreground">
                    <span className="tabular">{r.fecha}</span> · {r.como}
                  </p>
                </div>
                <Money monto={r.monto} className="shrink-0 font-semibold" />
                {i === 0 ? <Resaltado className="shrink-0">{boton}</Resaltado> : <div className="shrink-0">{boton}</div>}
              </div>
            );
          })}
        </div>
        <p className="mt-1 border-t border-border pt-1.5 text-[0.72rem] text-muted-foreground">
          Tocá <span className="font-medium text-foreground">Recibo</span> para verlo, guardarlo en PDF o imprimirlo.
        </p>
      </div>
    </MarcoPantalla>
  );
}

/** El recibo como lo ve el socio: «Volver», «Descargar recibo (PDF)» y el papel. */
export function PantallaReciboSocio() {
  return (
    <MarcoPantalla titulo="Recibo N° 2417 — Rosa Medina" contenidoClassName="space-y-2 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <BotonEjemplo variante="contorno" className="min-h-7 px-2 text-[0.72rem]">
          <ArrowLeft /> Volver
        </BotonEjemplo>
        <Resaltado>
          <BotonEjemplo className="min-h-7 px-2 text-[0.72rem]">
            <Printer /> Descargar recibo (PDF)
          </BotonEjemplo>
        </Resaltado>
      </div>
      <p className="pt-1 text-right text-[0.72rem] text-muted-foreground">
        Elegí &quot;Guardar como PDF&quot;. En el celular: Compartir → Imprimir → Guardar como PDF.
      </p>
      <div className="etiqueta">
        <div className="etiqueta-interior space-y-2 p-2.5 text-[0.72rem]">
          <div className="flex items-start justify-between gap-2 border-b border-border pb-1.5">
            <div className="min-w-0">
              <p className="font-display font-semibold tracking-wide uppercase">Cooperativa Mercado San Miguel</p>
              <p className="text-muted-foreground">Malagueño, Córdoba</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display text-[0.8rem] font-semibold tracking-wide uppercase">Recibo N° 2417</p>
              <p className="text-muted-foreground tabular">15/09/2026, 10:42</p>
            </div>
          </div>
          <p>
            <span className="text-muted-foreground">Recibimos de:</span> <strong>Rosa Medina</strong> (Carpeta N° 58)
          </p>
          <p className="font-display font-semibold">Cómo pagó</p>
          <div className="flex items-center gap-2 rounded border border-border px-2 py-1">
            <Banknote className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
            <p className="flex-1 font-medium">Efectivo</p>
            <Money monto={126000} className="font-semibold" />
          </div>
          <div className="divide-y divide-dashed divide-border">
            <div className="flex justify-between gap-2 py-1">
              <span>Energía · Medidor N° 58 (160 kWh) · Septiembre de 2026</span>
              <Money monto={96000} />
            </div>
            <div className="flex justify-between gap-2 py-1">
              <span>Alquiler Cocheras · Septiembre de 2026</span>
              <Money monto={30000} />
            </div>
          </div>
          <div className="flex items-baseline justify-between border-t-2 border-foreground pt-1">
            <p className="font-display font-semibold tracking-wide uppercase">Total</p>
            <Money monto={126000} className="text-[1.05rem] font-bold" />
          </div>
          <div className="flex items-end justify-between gap-2 pt-1">
            <div className="space-y-1">
              <Sello grande estado="pagado" texto="Pago recibido" className="px-1.5 py-0.5 text-[0.72rem]" />
              <p>Recibió: Marta Ríos · Administración</p>
            </div>
            <p className="w-20 shrink-0 border-t border-foreground pt-0.5 text-center text-muted-foreground">Firma</p>
          </div>
        </div>
      </div>
    </MarcoPantalla>
  );
}

// ---------------------------------------------------------------------------------------
// Documentos
// ---------------------------------------------------------------------------------------

/** La ventana que abre «Subir documento»: título, categoría y la foto. */
export function PantallaSubirDocumentoSocio() {
  return (
    <MarcoPantalla titulo="Subir documento">
      <p className="text-[0.72rem] text-muted-foreground">Puede ser un PDF o una foto (JPG, PNG o WEBP).</p>
      <CampoEjemplo etiqueta="Título" valor="Habilitación municipal 2026" />
      <CampoEjemplo etiqueta="Categoría" valor="Habilitación municipal" />
      <CampoEjemplo etiqueta="Archivo" valor="Foto de la habilitación.jpg" />
      <p className="text-[0.72rem] text-muted-foreground">Las fotos se achican solas.</p>
      <Resaltado>
        <BotonEjemplo className="w-full">
          <Upload /> Subir documento
        </BotonEjemplo>
      </Resaltado>
    </MarcoPantalla>
  );
}
