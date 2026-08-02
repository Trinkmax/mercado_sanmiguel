"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Info, Plus, Tags } from "lucide-react";
import {
  agregarConceptoCliente,
  editarConceptoCliente,
  editarCuotasMes,
} from "@/lib/actions/clientes";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";

type ItemConcepto = {
  id: string;
  cantidad: number;
  activo: boolean;
  codigo: string;
  nombre: string;
};

type ConceptoDisponible = { id: string; codigo: string; nombre: string };

/** Pestaña "Conceptos": qué paga el cliente y en cuántas veces por mes. */
export function ConceptosCliente({
  clienteId,
  cuotasMes,
  items,
  disponibles,
}: {
  clienteId: string;
  cuotasMes: number;
  items: ItemConcepto[];
  disponibles: ConceptoDisponible[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [conceptoNuevo, setConceptoNuevo] = useState("");
  const [cantidadNueva, setCantidadNueva] = useState("1");
  const [agregando, setAgregando] = useState(false);

  function guardarCantidad(item: ItemConcepto, valor: number) {
    if (Number.isNaN(valor)) {
      toast.error("Poné una cantidad válida (ej.: 0,5 · 1 · 1,5).");
      return;
    }
    if (valor === item.cantidad) return;
    startTransition(async () => {
      const res = await editarConceptoCliente({
        id: item.id,
        clienteId,
        cantidad: valor,
      });
      if (!res.ok) {
        toast.error(res.error);
        router.refresh();
        return;
      }
      toast.success(`Cantidad de ${item.codigo} guardada`);
    });
  }

  function cambiarActivo(item: ItemConcepto, activo: boolean) {
    startTransition(async () => {
      const res = await editarConceptoCliente({ id: item.id, clienteId, activo });
      if (!res.ok) {
        toast.error(res.error);
        router.refresh();
        return;
      }
      toast.success(
        activo
          ? `${item.nombre}: se vuelve a facturar`
          : `${item.nombre}: no se factura más`
      );
    });
  }

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
      toast.success("Concepto agregado");
      setConceptoNuevo("");
      setCantidadNueva("1");
      router.refresh();
    });
  }

  function guardarCuotas(valor: number) {
    if (Number.isNaN(valor)) {
      toast.error("Poné en cuántas veces paga el mes.");
      return;
    }
    if (valor === cuotasMes) return;
    startTransition(async () => {
      const res = await editarCuotasMes({ clienteId, cuotas_mes: valor });
      if (!res.ok) {
        toast.error(res.error);
        router.refresh();
        return;
      }
      toast.success(
        valor === 1
          ? "Guardado: paga todo el mes junto"
          : `Guardado: paga en ${valor} veces por mes`
      );
    });
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="size-4" />
        <AlertDescription>
          Los cambios rigen desde la próxima generación mensual; el mes en curso
          no se modifica.
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
                <div
                  key={`${item.id}-${item.cantidad}-${item.activo}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"
                >
                  <Codigo codigo={item.codigo} />
                  <p
                    className={cn(
                      "min-w-0 flex-1 font-medium",
                      !item.activo && "text-muted-foreground line-through"
                    )}
                  >
                    {item.nombre}
                  </p>
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={`cantidad-${item.id}`}
                      className="text-sm text-muted-foreground"
                    >
                      Cantidad
                    </Label>
                    <Input
                      id={`cantidad-${item.id}`}
                      type="number"
                      inputMode="decimal"
                      step={0.5}
                      min={0.5}
                      defaultValue={item.cantidad}
                      disabled={!item.activo}
                      onBlur={(e) =>
                        guardarCantidad(item, e.currentTarget.valueAsNumber)
                      }
                      className="h-11 w-24 text-center text-base tabular"
                    />
                  </div>
                  <div className="flex min-h-11 items-center gap-2 pl-2">
                    <Switch
                      id={`activo-${item.id}`}
                      defaultChecked={item.activo}
                      onCheckedChange={(v) => cambiarActivo(item, v)}
                      aria-label={`${item.nombre}: facturar o no`}
                    />
                    <Label
                      htmlFor={`activo-${item.id}`}
                      className="text-sm text-muted-foreground"
                    >
                      {item.activo ? "Se factura" : "No se factura"}
                    </Label>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 border-t pt-5">
            <p className="mb-3 font-medium">Agregar un concepto</p>
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
                <Input
                  id="cantidad-nueva"
                  type="number"
                  inputMode="decimal"
                  step={0.5}
                  min={0.5}
                  value={cantidadNueva}
                  onChange={(e) => setCantidadNueva(e.target.value)}
                  className="h-12 w-24 text-center text-base tabular"
                />
              </div>
              <Button
                size="lg"
                className="h-12 px-5 text-base font-semibold"
                onClick={agregar}
                disabled={agregando || disponibles.length === 0}
              >
                <Plus className="size-5" />
                Agregar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="text-base">
        <CardHeader>
          <CardTitle className="text-lg">Cómo paga el mes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <Label htmlFor="cuotas-mes" className="text-base">
              Paga en
            </Label>
            <Input
              id="cuotas-mes"
              key={`cuotas-${cuotasMes}`}
              type="number"
              inputMode="numeric"
              min={1}
              max={10}
              step={1}
              defaultValue={cuotasMes}
              onBlur={(e) => guardarCuotas(e.currentTarget.valueAsNumber)}
              className="h-12 w-20 text-center text-base tabular"
            />
            <span className="text-base">
              {" "}
              veces por mes{" "}
              <span className="text-muted-foreground">(1 = todo junto)</span>
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
