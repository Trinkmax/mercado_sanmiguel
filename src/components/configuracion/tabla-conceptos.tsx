"use client";

import { useState, useTransition } from "react";
import { Info, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  actualizarConcepto,
  cambiarActivoConcepto,
} from "@/lib/actions/configuracion";
import { formatARS } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Codigo } from "@/components/shared/codigo";
import { Money } from "@/components/shared/money";

export type ConceptoFila = {
  id: string;
  codigo: string;
  nombre: string;
  tipo: "recurrente" | "energia" | "canon_diario" | "deuda";
  precio: number;
  descuento_pronto_pago: number;
  orden_imputacion: number;
  activo: boolean;
};

const LABEL_TIPO: Record<ConceptoFila["tipo"], string> = {
  recurrente: "Mensual",
  energia: "Energía",
  canon_diario: "Canon diario",
  deuda: "Deuda",
};

function soloDigitos(valor: string): string {
  return valor.replace(/\D+/g, "");
}

export function TablaConceptos({ conceptos }: { conceptos: ConceptoFila[] }) {
  const [editando, setEditando] = useState<ConceptoFila | null>(null);
  const [precio, setPrecio] = useState("");
  const [descuento, setDescuento] = useState("");
  const [orden, setOrden] = useState("");
  const [guardando, startGuardar] = useTransition();
  const [togglePendiente, setTogglePendiente] = useState<string | null>(null);
  const [, startToggle] = useTransition();

  function abrirEdicion(concepto: ConceptoFila) {
    setEditando(concepto);
    setPrecio(String(Math.round(concepto.precio)));
    setDescuento(String(concepto.descuento_pronto_pago));
    setOrden(String(concepto.orden_imputacion));
  }

  function guardar() {
    if (!editando) return;
    startGuardar(async () => {
      const res = await actualizarConcepto({
        id: editando.id,
        precio: Number(precio || 0),
        descuento_pronto_pago: Number(descuento || 0),
        orden_imputacion: Number(orden || 0),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Guardado. ${editando.nombre} quedó actualizado.`);
      setEditando(null);
    });
  }

  function cambiarActivo(concepto: ConceptoFila, activo: boolean) {
    setTogglePendiente(concepto.id);
    startToggle(async () => {
      const res = await cambiarActivoConcepto({ id: concepto.id, activo });
      if (!res.ok) toast.error(res.error);
      else
        toast.success(
          activo
            ? `${concepto.nombre} quedó activo.`
            : `${concepto.nombre} quedó inactivo: no se genera más.`
        );
      setTogglePendiente(null);
    });
  }

  return (
    <div className="space-y-4">
      <Alert className="px-4 py-3">
        <Info strokeWidth={2} />
        <AlertTitle className="text-sm">
          Los precios nuevos rigen desde la próxima generación mensual. Lo ya
          generado no cambia.
        </AlertTitle>
        <AlertDescription className="text-sm">
          Cuando un cliente paga, la plata entra sola en el orden de esta tabla
          (primero la deuda más vieja; dentro del mes, el número de orden más
          bajo cobra primero). Cambiá el orden acá y rige para los próximos
          cobros. Para que un concepto no se le aplique a un cliente puntual,
          desactivalo desde su carpeta, pestaña Conceptos.
        </AlertDescription>
      </Alert>

      <div className="rounded-lg border bg-card">
        <Table className="text-sm">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Código</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Pronto pago</TableHead>
              <TableHead className="text-right">Orden</TableHead>
              <TableHead>Activo</TableHead>
              <TableHead className="pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {conceptos.map((concepto) => (
              <TableRow key={concepto.id} className="h-14">
                <TableCell className="pl-4">
                  <Codigo codigo={concepto.codigo} />
                </TableCell>
                <TableCell className="font-medium">{concepto.nombre}</TableCell>
                <TableCell className="text-muted-foreground">
                  {LABEL_TIPO[concepto.tipo]}
                </TableCell>
                <TableCell className="text-right tabular">
                  <Money monto={concepto.precio} />
                </TableCell>
                <TableCell className="text-right tabular">
                  {Number(concepto.descuento_pronto_pago) > 0
                    ? `${concepto.descuento_pronto_pago} %`
                    : "—"}
                </TableCell>
                <TableCell className="text-right tabular">
                  {concepto.orden_imputacion}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={concepto.activo}
                    disabled={togglePendiente === concepto.id}
                    onCheckedChange={(activo) =>
                      cambiarActivo(concepto, activo)
                    }
                    aria-label={`${concepto.nombre} activo`}
                  />
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <Button
                    variant="outline"
                    className="min-h-11 px-4 text-sm"
                    onClick={() => abrirEdicion(concepto)}
                  >
                    <Pencil className="size-4" strokeWidth={2} />
                    Editar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={editando !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setEditando(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {editando ? editando.nombre : ""}
            </DialogTitle>
            <DialogDescription className="text-sm">
              El precio nuevo rige desde la próxima generación mensual.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="precio-concepto" className="text-sm">
                Precio
              </Label>
              <Input
                id="precio-concepto"
                inputMode="numeric"
                autoComplete="off"
                className="h-12 text-base md:text-base"
                value={precio}
                onChange={(e) => setPrecio(soloDigitos(e.target.value))}
              />
              <p className="text-sm text-muted-foreground tabular">
                {formatARS(Number(precio || 0))}
                {editando?.tipo === "energia" ? " por kWh" : ""}
                {editando?.tipo === "canon_diario" ? " por día" : ""}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descuento-concepto" className="text-sm">
                Descuento por pago en término (%)
              </Label>
              <Input
                id="descuento-concepto"
                inputMode="numeric"
                autoComplete="off"
                className="h-12 text-base md:text-base"
                value={descuento}
                onChange={(e) =>
                  setDescuento(soloDigitos(e.target.value).slice(0, 3))
                }
              />
              <p className="text-sm text-muted-foreground">
                0 si no tiene descuento. La expensa hoy usa 15.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="orden-concepto" className="text-sm">
                Orden de imputación
              </Label>
              <Input
                id="orden-concepto"
                inputMode="numeric"
                autoComplete="off"
                className="h-12 w-24 text-base md:text-base"
                value={orden}
                onChange={(e) => setOrden(soloDigitos(e.target.value).slice(0, 3))}
              />
              <p className="text-sm text-muted-foreground">
                Más bajo = cobra primero.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              size="lg"
              className="h-12 w-full text-base font-semibold"
              disabled={guardando || !precio || !orden}
              onClick={guardar}
            >
              {guardando ? "Guardando…" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
