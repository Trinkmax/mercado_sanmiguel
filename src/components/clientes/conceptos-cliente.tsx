"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Info, Plus, Save, Send, Tags, Undo2 } from "lucide-react";
import type { Rol } from "@/lib/auth";
import {
  agregarConceptoCliente,
  editarConceptoCliente,
  editarCuotasMes,
} from "@/lib/actions/clientes";
import { formatFraccion, PASO_CANTIDAD } from "@/lib/format";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Codigo } from "@/components/shared/codigo";
import { EmptyState } from "@/components/shared/empty-state";
import { StepperCantidad } from "@/components/clientes/stepper-cantidad";
import { CuotasMesPicker } from "@/components/clientes/cuotas-mes";
import {
  TOAST_ENVIADO_APROBACION,
  aplicaDirectoRol,
} from "@/components/clientes/constantes";
import { cn } from "@/lib/utils";

type ItemConcepto = {
  id: string;
  cantidad: number;
  activo: boolean;
  codigo: string;
  nombre: string;
};

type ConceptoDisponible = { id: string; codigo: string; nombre: string };

/** Pestaña "Conceptos": qué paga el cliente y en cuántas veces por mes.
 * El Líder de Procesos aplica directo; los demás roles proponen y el cambio
 * queda esperando aprobación (se ve arriba en la ficha). */
export function ConceptosCliente({
  clienteId,
  cuotasMes,
  items,
  disponibles,
  rol,
}: {
  clienteId: string;
  cuotasMes: number;
  items: ItemConcepto[];
  disponibles: ConceptoDisponible[];
  rol: Rol;
}) {
  const router = useRouter();
  const directo = aplicaDirectoRol(rol);
  const [, startTransition] = useTransition();
  const [conceptoNuevo, setConceptoNuevo] = useState("");
  const [cantidadNueva, setCantidadNueva] = useState(1);
  const [agregando, setAgregando] = useState(false);
  const [cuotas, setCuotas] = useState(cuotasMes);
  const [guardandoCuotas, setGuardandoCuotas] = useState(false);

  function agregar() {
    if (!conceptoNuevo) {
      toast.error("Elegí el concepto que va a pagar.");
      return;
    }
    setAgregando(true);
    startTransition(async () => {
      const res = await agregarConceptoCliente({
        clienteId,
        conceptoId: conceptoNuevo,
        cantidad: cantidadNueva,
      });
      setAgregando(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.data.estado === "aplicado") {
        toast.success("Concepto agregado");
      } else {
        toast.success(TOAST_ENVIADO_APROBACION, {
          description: "El concepto se suma a la carpeta cuando lo apruebe.",
        });
      }
      setConceptoNuevo("");
      setCantidadNueva(1);
      router.refresh();
    });
  }

  function guardarCuotas(valor: number) {
    if (valor === cuotasMes) return;
    setCuotas(valor);
    setGuardandoCuotas(true);
    startTransition(async () => {
      const res = await editarCuotasMes({ clienteId, cuotas_mes: valor });
      setGuardandoCuotas(false);
      if (!res.ok) {
        toast.error(res.error);
        setCuotas(cuotasMes);
        return;
      }
      if (res.data.estado === "aplicado") {
        toast.success(
          valor === 1
            ? "Guardado: paga todo el mes junto"
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

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="size-4" />
        <AlertDescription>
          Los cambios rigen desde la próxima generación mensual; el mes en curso
          no se modifica.
          {!directo
            ? " Cada cambio lo revisa y aprueba el Líder de Procesos."
            : null}
        </AlertDescription>
      </Alert>

      <Card className="text-base">
        <CardHeader>
          <CardTitle className="text-lg">Qué paga este cliente</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState
              icono={Tags}
              titulo="Todavía no tiene conceptos asignados"
              descripcion="Agregale abajo lo que paga cada mes (expensas, cocheras, galpón…)."
            />
          ) : (
            <div className="divide-y">
              {items.map((item) => (
                <FilaConcepto
                  key={`${item.id}-${item.cantidad}-${item.activo}`}
                  item={item}
                  clienteId={clienteId}
                  directo={directo}
                />
              ))}
            </div>
          )}

          <div className="mt-6 border-t pt-5">
            <p className="mb-1 font-medium">Agregar un concepto</p>
            <p className="mb-3 text-sm text-muted-foreground">
              Se aceptan cuartos: ¼ · ½ · ¾ · 1 · 1¼...
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-56 flex-1 space-y-2">
                <Label className="text-sm text-muted-foreground">Concepto</Label>
                <Select value={conceptoNuevo} onValueChange={setConceptoNuevo}>
                  <SelectTrigger className="h-12 w-full text-base">
                    <SelectValue
                      placeholder={
                        disponibles.length === 0
                          ? "Ya tiene todos los conceptos"
                          : "Elegí el concepto"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {disponibles.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.codigo} — {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="cantidad-nueva"
                  className="text-sm text-muted-foreground"
                >
                  Cantidad
                </Label>
                <StepperCantidad
                  id="cantidad-nueva"
                  valor={cantidadNueva}
                  min={PASO_CANTIDAD}
                  nombre="el concepto nuevo"
                  onCambiar={setCantidadNueva}
                />
              </div>
              <Button
                size="lg"
                className="h-12 px-5 text-base font-semibold"
                onClick={agregar}
                disabled={agregando || disponibles.length === 0}
              >
                {agregando ? (
                  <Spinner className="size-5" />
                ) : directo ? (
                  <Plus className="size-5" />
                ) : (
                  <Send className="size-5" />
                )}
                {directo ? "Agregar" : "Enviar a aprobación"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="text-base">
        <CardHeader>
          <CardTitle className="text-lg">Cómo paga el mes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <CuotasMesPicker
            key={`cuotas-${cuotasMes}`}
            valor={cuotas}
            onCambiar={setCuotas}
            disabled={guardandoCuotas}
            idPrefix="cuotas-ficha"
          />
          {cuotas !== cuotasMes ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                className="h-11 px-4 font-semibold"
                onClick={() => guardarCuotas(cuotas)}
                disabled={guardandoCuotas}
              >
                {guardandoCuotas ? (
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
                className="h-11 px-3"
                onClick={() => setCuotas(cuotasMes)}
                disabled={guardandoCuotas}
              >
                <Undo2 className="size-4" />
                Deshacer
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {cuotasMes === 1
                ? "Hoy paga todo el mes junto."
                : `Hoy paga el mes en ${cuotasMes} veces.`}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Un concepto de la carpeta: cantidad (de cuarto en cuarto) y si se factura. */
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

  function guardarCantidad() {
    if (!sucio) return;
    startTransition(async () => {
      const res = await editarConceptoCliente({
        id: item.id,
        clienteId,
        cantidad,
      });
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
      const res = await editarConceptoCliente({
        id: item.id,
        clienteId,
        activo: valor,
      });
      if (!res.ok) {
        toast.error(res.error);
        setActivo(item.activo);
        return;
      }
      if (res.data.estado === "aplicado") {
        toast.success(
          valor
            ? `${item.nombre}: se vuelve a facturar`
            : `${item.nombre}: no se factura más`
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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
      {/* En pantallas angostas el nombre ocupa su propio renglón. */}
      <div className="flex min-w-0 flex-1 basis-full items-center gap-3 sm:basis-0">
        <Codigo codigo={item.codigo} />
        <p
          className={cn(
            "min-w-0 flex-1 font-medium",
            !activo && "text-muted-foreground line-through"
          )}
        >
          {item.nombre}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Label
          htmlFor={`cantidad-${item.id}`}
          className="text-sm text-muted-foreground"
        >
          Cantidad
        </Label>
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
            <Button
              className="h-11 px-3 font-semibold"
              onClick={guardarCantidad}
              disabled={pendiente}
            >
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
      <div className="flex min-h-11 items-center gap-2 pl-2">
        <Switch
          id={`activo-${item.id}`}
          checked={activo}
          disabled={pendiente}
          onCheckedChange={cambiarActivo}
          aria-label={`${item.nombre}: facturar o no`}
        />
        <Label
          htmlFor={`activo-${item.id}`}
          className="text-sm text-muted-foreground"
        >
          {activo ? "Se factura" : "No se factura"}
        </Label>
      </div>
    </div>
  );
}
