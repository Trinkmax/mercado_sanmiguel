"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Footprints, Info, Plus, Save, Send, Tags, Undo2 } from "lucide-react";
import type { Rol } from "@/lib/auth";
import {
  agregarConceptoCliente,
  editarConceptoCliente,
  editarCuotasMes,
} from "@/lib/actions/clientes";
import { CUOTAS_TODOS_LOS_DIAS, formatARS, formatFraccion, PASO_CANTIDAD } from "@/lib/format";
import type { CategoriaCliente } from "@/lib/segmentos";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Codigo } from "@/components/shared/codigo";
import { Money } from "@/components/shared/money";
import { EmptyState } from "@/components/shared/empty-state";
import { StepperCantidad } from "@/components/clientes/stepper-cantidad";
import { CuotasMesPicker, textoVistaPrevia } from "@/components/clientes/cuotas-mes";
import {
  AYUDA_CONCEPTO,
  GRUPOS_CONCEPTO,
  TOAST_ENVIADO_APROBACION,
  aplicaDirectoRol,
  cuotasDeCategoria,
  grupoDeConcepto,
  totalMensual,
} from "@/components/clientes/constantes";
import { cn } from "@/lib/utils";
import { llamarAccion } from "@/lib/llamar-accion";

export type ItemConcepto = {
  id: string;
  cantidad: number;
  activo: boolean;
  codigo: string;
  nombre: string;
  precio: number;
  descuentoPp: number;
  segmento: string | null;
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

/** Pestaña "Qué paga": lo que se le factura cada mes (agrupado, con precio y total) y en
 * cuántas veces lo paga. El Líder aplica directo; Administración y el Jefe proponen y el
 * cambio queda esperando aprobación (se ve arriba en la ficha). */
export function ConceptosCliente({
  clienteId,
  categoria,
  cuotasMes,
  items,
  disponibles,
  rol,
  precioAmbulante,
}: {
  clienteId: string;
  categoria: CategoriaCliente;
  cuotasMes: number;
  items: ItemConcepto[];
  disponibles: ConceptoDisponible[];
  rol: Rol;
  precioAmbulante?: number | null;
}) {
  const directo = aplicaDirectoRol(rol);

  if (categoria === "ambulante") {
    return (
      <Card className="text-base">
        <CardContent className="flex flex-wrap items-center gap-4 py-2">
          <Footprints className="size-8 shrink-0 text-muted-foreground" strokeWidth={1.7} />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-lg font-semibold">Se le cobra por día, cuando viene</p>
            <p className="text-muted-foreground">
              {precioAmbulante
                ? `${formatARS(precioAmbulante)} por día (concepto AMB).`
                : "El precio por día sale del concepto AMB."}{" "}
              No tiene cargos mensuales ni paga en cuotas.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const activos = items.filter((i) => i.activo);
  const { total, conBeneficio } = totalMensual(activos);
  const grupos = GRUPOS_CONCEPTO.map((g) => ({
    ...g,
    items: items.filter((i) => grupoDeConcepto(i) === g.valor),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="size-4" />
        <AlertDescription>
          Los cambios rigen desde la próxima facturación mensual; el mes en curso no se toca.
          {!directo ? " Cada cambio lo revisa y aprueba el Líder de Procesos." : null}
        </AlertDescription>
      </Alert>

      <Card className="text-base">
        <CardHeader>
          <CardTitle className="text-lg">Qué paga cada mes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {items.length === 0 ? (
            <EmptyState
              icono={Tags}
              titulo="Todavía no paga nada por mes"
              descripcion={
                categoria === "quintero"
                  ? "Agregale abajo la quinta (Expensas Quinteros)."
                  : "Agregale abajo lo que paga cada mes: la expensa del puesto, un local, un galpón…"
              }
            />
          ) : (
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
                        key={`${item.id}-${item.cantidad}-${item.activo}`}
                        item={item}
                        clienteId={clienteId}
                        directo={directo}
                      />
                    ))}
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
          )}

          <AgregarConcepto clienteId={clienteId} disponibles={disponibles} directo={directo} />
        </CardContent>
      </Card>

      <CuotasCard
        clienteId={clienteId}
        categoria={categoria}
        cuotasMes={cuotasMes}
        totalMes={total}
        directo={directo}
      />
    </div>
  );
}

/** "Agregar": chips con lo que todavía no paga (pocas opciones → un toque), cantidad y botón. */
function AgregarConcepto({
  clienteId,
  disponibles,
  directo,
}: {
  clienteId: string;
  disponibles: ConceptoDisponible[];
  directo: boolean;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [elegido, setElegido] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const concepto = disponibles.find((c) => c.id === elegido) ?? null;

  if (disponibles.length === 0) return null;

  function agregar() {
    if (!concepto) return;
    startTransition(async () => {
      const res = await llamarAccion(() => agregarConceptoCliente({
        clienteId,
        conceptoId: concepto.id,
        cantidad,
      }));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.data.estado === "aplicado") {
        toast.success(`Agregado: ${concepto.nombre} × ${formatFraccion(cantidad)}`);
      } else {
        toast.success(TOAST_ENVIADO_APROBACION, {
          description: `${concepto.nombre} se suma a la carpeta cuando lo apruebe.`,
        });
      }
      setElegido(null);
      setCantidad(1);
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
          <p className="min-w-40 flex-1 pb-2.5 text-sm text-muted-foreground">
            {AYUDA_CONCEPTO[concepto.codigo] ?? concepto.nombre} ·{" "}
            <Money
              monto={Math.round(cantidad * concepto.precio * 100) / 100}
              className="font-semibold text-foreground"
            />{" "}
            por mes
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
  totalMes,
  directo,
}: {
  clienteId: string;
  categoria: CategoriaCliente;
  cuotasMes: number;
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

  return (
    <Card className="text-base">
      <CardHeader>
        <CardTitle className="text-lg">
          {categoria === "quintero" ? "¿En cuántos pagos cobra la quinta?" : "Cómo paga el mes"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <CuotasMesPicker
          key={`cuotas-${cuotasMes}`}
          valor={cuotas}
          onCambiar={setCuotas}
          disabled={pendiente}
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
}: {
  item: ItemConcepto;
  clienteId: string;
  directo: boolean;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [cantidad, setCantidad] = useState(item.cantidad);
  const [activo, setActivo] = useState(item.activo);
  const sucio = cantidad !== item.cantidad;
  const ayuda = AYUDA_CONCEPTO[item.codigo];

  function guardarCantidad() {
    if (!sucio) return;
    startTransition(async () => {
      const res = await llamarAccion(() => editarConceptoCliente({ id: item.id, clienteId, cantidad }));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.data.estado === "aplicado") {
        toast.success(`${item.nombre}: ahora paga ${formatFraccion(cantidad)}`);
      } else {
        toast.success(TOAST_ENVIADO_APROBACION, {
          description: `${item.nombre} sigue en ${formatFraccion(item.cantidad)} hasta que lo apruebe.`,
        });
        setCantidad(item.cantidad);
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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3">
      {/* En pantallas angostas el nombre ocupa su propio renglón. */}
      <div className="flex min-w-0 flex-1 basis-full items-start gap-3 sm:basis-0">
        <Codigo codigo={item.codigo} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className={cn("font-medium", !activo && "text-muted-foreground line-through")}>
            {item.nombre}
          </p>
          <p className="text-sm text-muted-foreground">
            <Money monto={item.precio} /> c/u
            {cantidad !== 1 ? (
              <>
                {" "}
                · {formatFraccion(cantidad)} ={" "}
                <Money
                  monto={Math.round(cantidad * item.precio * 100) / 100}
                  className="font-semibold text-foreground"
                />
              </>
            ) : null}
            {ayuda ? <span className="block text-xs">{ayuda}</span> : null}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StepperCantidad
          id={`cantidad-${item.id}`}
          valor={cantidad}
          min={PASO_CANTIDAD}
          nombre={item.nombre}
          disabled={!activo || pendiente}
          onCambiar={setCantidad}
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
              onClick={() => setCantidad(item.cantidad)}
              disabled={pendiente}
              aria-label={`Deshacer el cambio de cantidad de ${item.nombre}`}
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
          disabled={pendiente}
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
