"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Footprints, Info, Plus, Save, Send, Tags, TriangleAlert, Undo2 } from "lucide-react";
import type { Rol } from "@/lib/auth";
import {
  agregarConceptoCliente,
  editarConceptoCliente,
  editarCuotasMes,
} from "@/lib/actions/clientes";
import {
  CUOTAS_TODOS_LOS_DIAS,
  formatFraccion,
  formatPorcentaje,
  montoConcepto,
  PASO_CANTIDAD,
} from "@/lib/format";
import { LABEL_CATEGORIA, type CategoriaCliente } from "@/lib/segmentos";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Codigo } from "@/components/shared/codigo";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { EmptyState } from "@/components/shared/empty-state";
import { StepperCantidad } from "@/components/clientes/stepper-cantidad";
import { CampoPorcentaje } from "@/components/clientes/campo-porcentaje";
import { CuotasMesPicker, textoVistaPrevia } from "@/components/clientes/cuotas-mes";
import {
  AYUDA_CONCEPTO,
  GRUPOS_CONCEPTO,
  TOAST_ENVIADO_APROBACION,
  aplicaDirectoRol,
  ayudaAlOfrecer,
  conceptoAsignablePorRol,
  conceptoSigueConCategoria,
  cuotasDeCategoria,
  grupoDeConcepto,
  totalMensual,
} from "@/components/clientes/constantes";
import { cn } from "@/lib/utils";
import { llamarAccion } from "@/lib/llamar-accion";

export type ItemConcepto = {
  id: string;
  cantidad: number;
  /** Porcentaje del precio que paga (100 = entero). */
  porcentaje: number;
  activo: boolean;
  codigo: string;
  nombre: string;
  precio: number;
  descuentoPp: number;
  segmento: string | null;
  /** Tiene un cambio esperando la aprobación del Líder: no se toca hasta que se resuelva. */
  pendiente?: boolean;
};

/** Un concepto que se pidió agregar y espera la aprobación del Líder. */
export type AltaPendiente = {
  id: string;
  codigo: string;
  nombre: string;
  precio: number;
  cantidad: number;
  porcentaje: number;
};

export type ConceptoDisponible = {
  id: string;
  codigo: string;
  nombre: string;
  precio: number;
  descuentoPp: number;
  segmento: string | null;
};

function textoComoPaga(cuotas: number): string {
  if (cuotas === 1) return "Hoy paga todo el mes junto.";
  if (cuotas === CUOTAS_TODOS_LOS_DIAS) return "Hoy paga todos los días.";
  return `Hoy paga el mes en ${cuotas} veces.`;
}

/** "todo el mes junto" · "todos los días" · "en 4 veces" */
function textoCuotasCorto(cuotas: number): string {
  if (cuotas === 1) return "todo el mes junto";
  if (cuotas === CUOTAS_TODOS_LOS_DIAS) return "todos los días";
  return `en ${cuotas} veces`;
}

/** Pestaña "Qué paga": lo que se le factura cada mes (agrupado, con precio y total) y en
 * cuántas veces lo paga. El Líder aplica directo; Administración y el Jefe proponen y el
 * cambio queda esperando aprobación (se ve arriba en la ficha). El ambulante paga por día
 * y, si alquila cochera o quinta, eso por mes (0045, 0047): sin cuotas. */
export function ConceptosCliente({
  clienteId,
  categoria,
  cuotasMes,
  items,
  disponibles,
  altasPendientes = [],
  cuotasPedidas = null,
  rol,
}: {
  clienteId: string;
  categoria: CategoriaCliente;
  cuotasMes: number;
  items: ItemConcepto[];
  disponibles: ConceptoDisponible[];
  /** Conceptos pedidos que esperan al Líder (no se ofrecen de nuevo para agregar). */
  altasPendientes?: AltaPendiente[];
  /** "En cuántas veces paga" pedido y esperando al Líder. */
  cuotasPedidas?: number | null;
  rol: Rol;
}) {
  const directo = aplicaDirectoRol(rol);
  // Lo que el rol no puede tocar (la cochera de un ambulante, para el Jefe) se ve sin controles.
  // La quinta de un puestero sí la toca Administración (0046).
  const soloLectura = (i: ItemConcepto) =>
    !conceptoAsignablePorRol({ tipo: "recurrente", segmento: i.segmento }, rol, categoria);

  if (categoria === "ambulante") {
    // El ambulante paga por día; por mes, solo la cochera y la quinta si alquila (0045, 0047),
    // en un pago. Si le quedó otra cosa mensual prendida (de antes de pasar a ambulante), se
    // muestra aparte para apagarla: no queda escondida.
    const mensuales = items.filter((i) => conceptoSigueConCategoria(i.segmento, categoria));
    const prendidos = items.filter((i) => i.activo && !conceptoSigueConCategoria(i.segmento, categoria));
    const alquila = mensuales.some((i) => i.activo) || altasPendientes.length > 0;
    const puedeCambiar = disponibles.length > 0 || mensuales.some((i) => !soloLectura(i));
    return (
      <div className="space-y-6">
        <Card className="text-base" data-tour="clientes-paga-ambulante">
          <CardContent className="flex flex-wrap items-center gap-4 py-2">
            <Footprints className="size-8 shrink-0 text-muted-foreground" strokeWidth={1.7} />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-lg font-semibold">Se le cobra por día, cuando viene</p>
              <p className="text-muted-foreground">
                No hay un precio fijo: cuánto paga por día se pone en cada cobro. No paga en cuotas.{" "}
                {alquila ? textoAlquilaAmbulante(mensuales) : "Si alquila cochera o quinta, se cobra aparte, por mes."}
              </p>
            </div>
          </CardContent>
        </Card>
        {mensuales.length > 0 || altasPendientes.length > 0 || disponibles.length > 0 ? (
          <Card className="text-base">
            <CardHeader>
              <CardTitle className="text-lg">Cochera y quinta, por mes</CardTitle>
              <CardDescription>
                Aparte de lo que paga por día, en un pago por mes.
                {puedeCambiar
                  ? ` Los cambios rigen desde la próxima facturación mensual${directo ? "." : ": cada uno lo aprueba el Líder de Procesos."}`
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {mensuales.length === 0 && altasPendientes.length === 0 ? (
                <p className="text-muted-foreground">{textoSinAlquilerAmbulante(disponibles, directo)}</p>
              ) : (
                <ListaConceptos
                  items={mensuales}
                  altasPendientes={altasPendientes}
                  clienteId={clienteId}
                  categoria={categoria}
                  directo={directo}
                  soloLectura={soloLectura}
                />
              )}
              <AgregarConcepto clienteId={clienteId} categoria={categoria} disponibles={disponibles} directo={directo} />
            </CardContent>
          </Card>
        ) : null}
        {prendidos.length > 0 ? (
          <Card className="text-base">
            <CardHeader>
              <CardTitle className="text-lg">Todavía tiene algo mensual prendido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-parcial/40 bg-parcial-suave">
                <TriangleAlert className="size-4 text-parcial" />
                <AlertDescription className="text-base text-foreground">
                  Como ambulante, por mes solo se le facturan la cochera y la quinta.{" "}
                  {prendidos.every(soloLectura)
                    ? "Avisale al Líder de Procesos para que lo apague."
                    : `Apagalo para que quede en orden${directo ? "." : ": el Líder de Procesos lo aprueba."}`}
                </AlertDescription>
              </Alert>
              <div className="divide-y rounded-lg border">
                {prendidos.map((item) => (
                  <FilaConcepto
                    key={`${item.id}-${item.cantidad}-${item.porcentaje}-${item.activo}`}
                    item={item}
                    clienteId={clienteId}
                    directo={directo}
                    soloApagar
                    soloLectura={soloLectura(item)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    );
  }

  const { total } = totalMensual(items.filter((i) => i.activo));

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="size-4" />
        <AlertDescription>
          Los cambios rigen desde la próxima facturación mensual; el mes en curso no se toca.
          {!directo ? " Cada cambio lo revisa y aprueba el Líder de Procesos." : null}
        </AlertDescription>
      </Alert>

      <Card className="text-base" data-tour="clientes-conceptos">
        <CardHeader>
          <CardTitle className="text-lg">Qué paga cada mes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {items.length === 0 && altasPendientes.length === 0 ? (
            <EmptyState
              icono={Tags}
              titulo="Todavía no paga nada por mes"
              descripcion={
                categoria === "quintero"
                  ? "Agregale abajo la quinta (Expensas Quinteros)."
                  : categoria === "empleado"
                    ? "Agregale abajo la cochera: es lo único que se le cobra a un empleado."
                    : "Agregale abajo lo que paga cada mes: la expensa del puesto, un local, un galpón…"
              }
            />
          ) : (
            <ListaConceptos
              items={items}
              altasPendientes={altasPendientes}
              clienteId={clienteId}
              categoria={categoria}
              directo={directo}
              soloLectura={soloLectura}
            />
          )}

          <AgregarConcepto clienteId={clienteId} categoria={categoria} disponibles={disponibles} directo={directo} />
        </CardContent>
      </Card>

      {/* El empleado paga la cochera en un solo pago por mes (0040): no elige cuotas. */}
      {categoria !== "empleado" ? (
        <CuotasCard
          clienteId={clienteId}
          categoria={categoria}
          cuotasMes={cuotasMes}
          cuotasPedidas={cuotasPedidas}
          totalMes={total}
          directo={directo}
        />
      ) : null}
    </div>
  );
}

/** Ambulante que alquila: qué se le cobra por mes, aparte de los días ("Aparte, la quinta se
 * le cobra por mes."). Con solo un pedido esperando al Líder, sin nombrarlo. */
function textoAlquilaAmbulante(mensuales: ItemConcepto[]): string {
  const cochera = mensuales.some((i) => i.activo && i.segmento === "cocheras");
  const quinta = mensuales.some((i) => i.activo && i.segmento === "quinteros");
  if (cochera && quinta) return "Aparte, la cochera y la quinta se le cobran por mes.";
  if (cochera) return "Aparte, la cochera se le cobra por mes.";
  if (quinta) return "Aparte, la quinta se le cobra por mes.";
  return "Aparte, lo que alquila se le cobra por mes.";
}

/** Ambulante que no alquila nada: qué puede agregar quien mira (el Jefe, la quinta; el
 * Líder, cochera y quinta, 0047). */
function textoSinAlquilerAmbulante(disponibles: ConceptoDisponible[], directo: boolean): string {
  const cochera = disponibles.some((c) => c.segmento === "cocheras");
  const quinta = disponibles.some((c) => c.segmento === "quinteros");
  if (cochera && quinta) return "No alquila cochera ni quinta. Si alquila, agregalo abajo: se le cobra por mes.";
  if (quinta)
    return `No alquila cochera ni quinta. Si alquila una quinta, agregala abajo: se le cobra por mes.${
      directo ? "" : " La cochera la carga el Líder de Procesos."
    }`;
  if (cochera) return "No alquila cochera ni quinta. Si alquila una cochera, agregala abajo: se le cobra por mes.";
  return "No alquila cochera ni quinta.";
}

/** Lo que paga por mes, agrupado, con las altas que esperan al Líder y el total del mes. */
function ListaConceptos({
  items,
  altasPendientes,
  clienteId,
  categoria,
  directo,
  soloLectura,
}: {
  items: ItemConcepto[];
  altasPendientes: AltaPendiente[];
  clienteId: string;
  categoria: CategoriaCliente;
  directo: boolean;
  /** El rol no puede tocar esta fila (se ve sin controles). */
  soloLectura: (item: ItemConcepto) => boolean;
}) {
  const { total, conBeneficio } = totalMensual(items.filter((i) => i.activo));
  const grupos = GRUPOS_CONCEPTO.map((g) => ({
    ...g,
    items: items.filter((i) => grupoDeConcepto(i) === g.valor),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      <div className="divide-y rounded-lg border">
        {grupos.map((g) => (
          <div key={g.valor} className="divide-y">
            {grupos.length > 1 ? (
              <p className="bg-muted/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                {g.label}
              </p>
            ) : null}
            {g.items.map((item) => (
              <FilaConcepto
                key={`${item.id}-${item.cantidad}-${item.porcentaje}-${item.activo}-${item.pendiente ? 1 : 0}`}
                item={item}
                clienteId={clienteId}
                directo={directo}
                noCorresponde={
                  conceptoSigueConCategoria(item.segmento, categoria)
                    ? null
                    : LABEL_CATEGORIA[categoria].toLowerCase()
                }
                soloLectura={soloLectura(item)}
              />
            ))}
          </div>
        ))}
        {altasPendientes.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-parcial-suave/40 px-3 py-3">
            <div className="flex min-w-0 flex-1 basis-full items-start gap-3 sm:basis-0">
              <Codigo codigo={a.codigo} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="font-medium break-words">{a.nombre}</p>
                <p className="text-sm text-muted-foreground">
                  Pedido: {formatFraccion(a.cantidad)}
                  {a.porcentaje !== 100 ? ` al ${formatPorcentaje(a.porcentaje)}` : ""} ·{" "}
                  <Money monto={montoConcepto(a.cantidad, a.precio, a.porcentaje)} /> por mes. Se suma cuando
                  lo apruebe el Líder de Procesos.
                </p>
              </div>
            </div>
            <Sello estado="pendiente_aprobacion" />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-lg bg-muted/50 px-4 py-3">
        <span className="text-sm text-muted-foreground">Por mes</span>
        <span className="text-right">
          <Money monto={total} className="text-xl font-bold" />
          {conBeneficio < total ? (
            <span className="block text-sm text-muted-foreground">
              con beneficio en término{" "}
              <Money monto={conBeneficio} className="font-semibold text-pagado" />
            </span>
          ) : null}
        </span>
      </div>
    </>
  );
}

/** "Agregar": chips con lo que todavía no paga (pocas opciones → un toque), cantidad y botón. */
function AgregarConcepto({
  clienteId,
  categoria,
  disponibles,
  directo,
}: {
  clienteId: string;
  categoria: CategoriaCliente;
  disponibles: ConceptoDisponible[];
  directo: boolean;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [elegido, setElegido] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [porcentaje, setPorcentaje] = useState(100);
  const concepto = disponibles.find((c) => c.id === elegido) ?? null;

  if (disponibles.length === 0) return null;

  function agregar() {
    if (!concepto) return;
    startTransition(async () => {
      const res = await llamarAccion(() => agregarConceptoCliente({
        clienteId,
        conceptoId: concepto.id,
        cantidad,
        porcentaje,
      }));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.data.estado === "aplicado") {
        toast.success(
          `Agregado: ${concepto.nombre} × ${formatFraccion(cantidad)}${
            porcentaje !== 100 ? ` al ${formatPorcentaje(porcentaje)}` : ""
          }`
        );
      } else {
        toast.success(TOAST_ENVIADO_APROBACION, {
          description: `${concepto.nombre} se suma a la carpeta cuando lo apruebe.`,
        });
      }
      setElegido(null);
      setCantidad(1);
      setPorcentaje(100);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 border-t pt-5">
      <div>
        <p className="font-medium">Agregar algo que paga</p>
        <p className="text-sm text-muted-foreground">Tocá lo que corresponde.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Concepto para agregar">
        {disponibles.map((c) => {
          const activo = elegido === c.id;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => {
                setElegido(activo ? null : c.id);
                setCantidad(1);
                setPorcentaje(100);
              }}
              className={cn(
                "flex min-h-12 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                activo
                  ? "border-primary bg-accent text-accent-foreground ring-1 ring-primary"
                  : "border-border bg-card hover:bg-accent/50"
              )}
            >
              <Codigo codigo={c.codigo} />
              <span>
                <span className="block font-medium">{c.nombre}</span>
                <span className="block text-xs text-muted-foreground">
                  <Money monto={c.precio} /> por mes
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {concepto ? (
        <div className="flex flex-wrap items-end gap-3 rounded-lg bg-muted/40 p-3">
          <div className="space-y-1">
            <Label htmlFor="cantidad-nueva" className="text-sm text-muted-foreground">
              ¿Cuántos?
            </Label>
            <StepperCantidad
              id="cantidad-nueva"
              valor={cantidad}
              min={PASO_CANTIDAD}
              nombre={concepto.nombre}
              onCambiar={setCantidad}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="porcentaje-nuevo" className="text-sm text-muted-foreground">
              ¿Qué % paga?
            </Label>
            <CampoPorcentaje
              id="porcentaje-nuevo"
              valor={porcentaje}
              nombre={concepto.nombre}
              onCambiar={setPorcentaje}
            />
          </div>
          <p className="min-w-40 flex-1 pb-2.5 text-sm text-muted-foreground">
            {ayudaAlOfrecer(concepto, categoria) ?? concepto.nombre} ·{" "}
            <Money
              monto={montoConcepto(cantidad, concepto.precio, porcentaje)}
              className="font-semibold text-foreground"
            />{" "}
            por mes
            {porcentaje !== 100 ? ` (el ${formatPorcentaje(porcentaje)} del precio)` : ""}
          </p>
          <Button
            size="lg"
            className="h-12 px-5 text-base font-semibold"
            onClick={agregar}
            disabled={pendiente}
          >
            {pendiente ? (
              <Spinner className="size-5" />
            ) : directo ? (
              <Plus className="size-5" />
            ) : (
              <Send className="size-5" />
            )}
            {directo ? `Agregar ${concepto.codigo}` : "Enviar a aprobación"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** "Cómo paga el mes": chips de cuotas según la categoría y vista previa por pago. */
function CuotasCard({
  clienteId,
  categoria,
  cuotasMes,
  cuotasPedidas,
  totalMes,
  directo,
}: {
  clienteId: string;
  categoria: CategoriaCliente;
  cuotasMes: number;
  /** Cambio de cuotas que ya espera al Líder (no se manda otro igual). */
  cuotasPedidas: number | null;
  totalMes: number;
  directo: boolean;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [cuotas, setCuotas] = useState(cuotasMes);
  const { opciones, permitirOtra } = cuotasDeCategoria(categoria);

  function guardar() {
    if (cuotas === cuotasMes) return;
    const valor = cuotas;
    startTransition(async () => {
      const res = await llamarAccion(() => editarCuotasMes({ clienteId, cuotas_mes: valor }));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.data.estado === "aplicado") {
        toast.success(
          valor === 1
            ? "Guardado: paga todo el mes junto"
            : valor === CUOTAS_TODOS_LOS_DIAS
              ? "Guardado: paga todos los días"
              : `Guardado: paga en ${valor} veces por mes`
        );
      } else {
        toast.success(TOAST_ENVIADO_APROBACION, {
          description: "Mientras tanto sigue pagando como hasta ahora.",
        });
        setCuotas(cuotasMes);
      }
      router.refresh();
    });
  }

  const actual = textoVistaPrevia(cuotasMes, totalMes);
  // Mientras espera al Líder, Administración y el Jefe no mandan otro pedido encima.
  const esperando = cuotasPedidas !== null && cuotasPedidas !== cuotasMes;
  const bloqueado = esperando && !directo;

  return (
    <Card className="text-base">
      <CardHeader>
        <CardTitle className="text-lg">
          {categoria === "quintero" ? "¿En cuántos pagos cobra la quinta?" : "Cómo paga el mes"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {esperando ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-parcial-suave/60 px-3 py-2.5">
            <Sello estado="pendiente_aprobacion" />
            <p className="min-w-0 flex-1 basis-48 text-sm">
              Se pidió que pague {textoCuotasCorto(cuotasPedidas ?? cuotasMes)}.{" "}
              {directo
                ? "Lo aprobás o rechazás desde Aprobaciones."
                : "Hasta que el Líder lo apruebe sigue como está."}
            </p>
          </div>
        ) : null}
        <CuotasMesPicker
          key={`cuotas-${cuotasMes}`}
          valor={cuotas}
          onCambiar={setCuotas}
          disabled={pendiente || bloqueado}
          idPrefix="cuotas-ficha"
          opciones={opciones}
          permitirOtra={permitirOtra}
          totalMes={cuotas !== cuotasMes ? totalMes : undefined}
        />
        {cuotas !== cuotasMes ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="h-12 px-5 text-base font-semibold"
              onClick={guardar}
              disabled={pendiente}
            >
              {pendiente ? (
                <Spinner className="size-5" />
              ) : directo ? (
                <Save className="size-5" />
              ) : (
                <Send className="size-5" />
              )}
              {directo ? "Guardar" : "Enviar a aprobación"}
            </Button>
            <Button
              variant="ghost"
              className="h-12 px-4 text-base"
              onClick={() => setCuotas(cuotasMes)}
              disabled={pendiente}
            >
              <Undo2 className="size-5" />
              Dejar como estaba
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {textoComoPaga(cuotasMes)}
            {actual && cuotasMes > 1 ? ` ${actual}.` : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Un concepto de la carpeta: precio, cantidad (de cuarto en cuarto) y si se factura. */
function FilaConcepto({
  item,
  clienteId,
  directo,
  soloApagar = false,
  noCorresponde = null,
  soloLectura = false,
}: {
  item: ItemConcepto;
  clienteId: string;
  directo: boolean;
  /** Ambulante: solo el interruptor para dejar de facturarlo (sin cantidad). */
  soloApagar?: boolean;
  /** La categoría del cliente ("quintero") cuando el concepto ya no le corresponde (quedó
   * de antes de cambiar de categoría): solo se puede apagar, no prender ni cambiar. */
  noCorresponde?: string | null;
  /** El rol no lo puede cambiar (la cochera de un ambulante, para el Jefe): se ve sin controles. */
  soloLectura?: boolean;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [cantidad, setCantidad] = useState(item.cantidad);
  const [porcentaje, setPorcentaje] = useState(item.porcentaje);
  const [activo, setActivo] = useState(item.activo);
  const cambioCantidad = cantidad !== item.cantidad;
  const cambioPorcentaje = porcentaje !== item.porcentaje;
  const sucio = cambioCantidad || cambioPorcentaje;
  const ayuda = AYUDA_CONCEPTO[item.codigo];
  // Ya hay un cambio de esta fila esperando al Líder: no se manda otro encima.
  const esperando = Boolean(item.pendiente) && !directo;

  function guardarCantidad() {
    if (!sucio) return;
    startTransition(async () => {
      const res = await llamarAccion(() =>
        editarConceptoCliente({
          id: item.id,
          clienteId,
          ...(cambioCantidad ? { cantidad } : {}),
          ...(cambioPorcentaje ? { porcentaje } : {}),
        })
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const texto = (c: number, p: number) =>
        `${formatFraccion(c)}${p !== 100 ? ` al ${formatPorcentaje(p)}` : ""}`;
      if (res.data.estado === "aplicado") {
        toast.success(`${item.nombre}: ahora paga ${texto(cantidad, porcentaje)}`);
      } else {
        toast.success(TOAST_ENVIADO_APROBACION, {
          description: `${item.nombre} sigue en ${texto(item.cantidad, item.porcentaje)} hasta que lo apruebe.`,
        });
        setCantidad(item.cantidad);
        setPorcentaje(item.porcentaje);
      }
      router.refresh();
    });
  }

  function cambiarActivo(valor: boolean) {
    setActivo(valor);
    startTransition(async () => {
      const res = await llamarAccion(() => editarConceptoCliente({ id: item.id, clienteId, activo: valor }));
      if (!res.ok) {
        toast.error(res.error);
        setActivo(item.activo);
        return;
      }
      if (res.data.estado === "aplicado") {
        toast.success(
          valor ? `${item.nombre}: se vuelve a facturar` : `${item.nombre}: no se factura más`
        );
      } else {
        toast.success(TOAST_ENVIADO_APROBACION, {
          description: valor
            ? `${item.nombre} se vuelve a facturar cuando lo apruebe.`
            : `${item.nombre} se sigue facturando hasta que apruebe la baja.`,
        });
        setActivo(item.activo);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3" data-tour="clientes-concepto-fila">
      {/* En pantallas angostas el nombre ocupa su propio renglón. */}
      <div className="flex min-w-0 flex-1 basis-full items-start gap-3 sm:basis-0">
        <Codigo codigo={item.codigo} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className={cn("font-medium break-words", !activo && "text-muted-foreground line-through")}>
            {item.nombre}
          </p>
          <p className="text-sm text-muted-foreground">
            <Money monto={item.precio} /> c/u
            {cantidad !== 1 || porcentaje !== 100 ? (
              <>
                {" "}
                · {cantidad !== 1 ? formatFraccion(cantidad) : null}
                {cantidad !== 1 && porcentaje !== 100 ? " × " : null}
                {porcentaje !== 100 ? `el ${formatPorcentaje(porcentaje)}` : null} ={" "}
                <Money
                  monto={montoConcepto(cantidad, item.precio, porcentaje)}
                  className="font-semibold text-foreground"
                />
              </>
            ) : null}
            {ayuda ? <span className="block text-xs">{ayuda}</span> : null}
          </p>
          {noCorresponde ? (
            <p className="text-sm font-medium text-parcial">
              No le corresponde a un {noCorresponde}
              {activo && !soloLectura ? ": apagalo para dejar de facturarlo." : "."}
            </p>
          ) : null}
          {soloLectura ? (
            <p className="text-sm text-muted-foreground">Lo cambia el Líder de Procesos.</p>
          ) : null}
        </div>
      </div>
      {item.pendiente ? <Sello estado="pendiente_aprobacion" /> : null}
      <div className={cn("flex flex-wrap items-center gap-2", (soloApagar || noCorresponde || soloLectura) && "hidden")}>
        <StepperCantidad
          id={`cantidad-${item.id}`}
          valor={cantidad}
          min={PASO_CANTIDAD}
          nombre={item.nombre}
          disabled={!activo || pendiente || esperando}
          onCambiar={setCantidad}
        />
        <CampoPorcentaje
          id={`porcentaje-${item.id}`}
          valor={porcentaje}
          nombre={item.nombre}
          disabled={!activo || pendiente || esperando}
          onCambiar={setPorcentaje}
        />
        {sucio ? (
          <div className="flex items-center gap-1">
            <Button className="h-11 px-3 font-semibold" onClick={guardarCantidad} disabled={pendiente}>
              {pendiente ? (
                <Spinner className="size-4" />
              ) : directo ? (
                <Save className="size-4" />
              ) : (
                <Send className="size-4" />
              )}
              {directo ? "Guardar" : "Enviar a aprobación"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              onClick={() => {
                setCantidad(item.cantidad);
                setPorcentaje(item.porcentaje);
              }}
              disabled={pendiente}
              aria-label={`Deshacer el cambio de ${item.nombre}`}
            >
              <Undo2 className="size-4" />
            </Button>
          </div>
        ) : null}
      </div>
      <div className="flex min-h-11 items-center gap-2 pl-1">
        <Switch
          id={`activo-${item.id}`}
          checked={activo}
          disabled={pendiente || esperando || soloLectura || (Boolean(noCorresponde) && !activo)}
          onCheckedChange={cambiarActivo}
          aria-label={`${item.nombre}: facturar o no`}
        />
        <Label htmlFor={`activo-${item.id}`} className="text-sm text-muted-foreground">
          {activo ? "Se factura" : "No se factura"}
        </Label>
      </div>
    </div>
  );
}
