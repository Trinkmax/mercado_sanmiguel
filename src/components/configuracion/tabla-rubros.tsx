"use client";

import { useState, useTransition } from "react";
import { Plus, Receipt } from "lucide-react";
import { toast } from "sonner";
import { cambiarActivoRubro, crearRubro } from "@/lib/actions/configuracion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { EmptyState } from "@/components/shared/empty-state";
import { llamarAccion } from "@/lib/llamar-accion";

export type RubroFila = {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
};

export function TablaRubros({ rubros }: { rubros: RubroFila[] }) {
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [creando, startCrear] = useTransition();
  const [pendiente, setPendiente] = useState<string | null>(null);
  const [, startToggle] = useTransition();
  // Aviso en el acto si el código ya existe (antes el ejemplo "AGUA" era justo uno cargado).
  const repetido = codigo ? rubros.find((r) => r.codigo.toUpperCase() === codigo.toUpperCase()) : undefined;

  function crear() {
    startCrear(async () => {
      const res = await llamarAccion(() => crearRubro({ codigo, nombre }));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Rubro ${codigo.toUpperCase()} agregado.`);
      setCodigo("");
      setNombre("");
    });
  }

  function cambiarActivo(rubro: RubroFila, activo: boolean) {
    setPendiente(rubro.id);
    startToggle(async () => {
      const res = await llamarAccion(() => cambiarActivoRubro({ id: rubro.id, activo }));
      if (!res.ok) toast.error(res.error);
      else
        toast.success(
          activo
            ? `${rubro.nombre} quedó activo.`
            : `${rubro.nombre} quedó inactivo: no aparece más al cargar gastos.`
        );
      setPendiente(null);
    });
  }

  return (
    <div className="space-y-6">
      <Card data-tour="config-rubro-nuevo">
        <CardHeader>
          <CardTitle className="text-lg">Nuevo rubro</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="codigo-rubro" className="text-sm">
                Código
              </Label>
              {/* Los ejemplos van con "Ej.:" y de un rubro que no existe: en gris parecían datos cargados. */}
              <Input
                id="codigo-rubro"
                autoComplete="off"
                maxLength={8}
                placeholder="Ej.: PAPEL"
                aria-invalid={repetido ? true : undefined}
                aria-describedby="codigo-rubro-ayuda"
                className="h-12 w-36 text-base uppercase placeholder:normal-case md:text-base"
                value={codigo}
                onChange={(e) =>
                  setCodigo(
                    e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
                  )
                }
              />
            </div>
            <div className="min-w-56 flex-1 space-y-2">
              <Label htmlFor="nombre-rubro" className="text-sm">
                Nombre
              </Label>
              <Input
                id="nombre-rubro"
                autoComplete="off"
                placeholder="Ej.: Papelería y librería"
                className="h-12 text-base md:text-base"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>
            <Button
              size="lg"
              className="h-12 px-6 text-base font-semibold"
              disabled={creando || !codigo.trim() || !nombre.trim() || Boolean(repetido)}
              onClick={crear}
            >
              <Plus className="size-5" strokeWidth={2} />
              {creando ? "Agregando…" : "Agregar rubro"}
            </Button>
          </div>
          <p
            id="codigo-rubro-ayuda"
            className={repetido ? "mt-2 text-sm font-medium text-destructive" : "mt-2 text-sm text-muted-foreground"}
          >
            {repetido
              ? `El código ${repetido.codigo} ya es de "${repetido.nombre}". Elegí otro.`
              : "Un código corto (hasta 8 letras o números) y el nombre como lo van a ver al cargar un gasto."}
          </p>
        </CardContent>
      </Card>

      {rubros.length === 0 ? (
        <EmptyState
          icono={Receipt}
          titulo="Todavía no hay rubros de gasto"
          descripcion="Agregá el primero acá arriba: un código corto (AGUA, ALQ…) y su nombre."
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className="pr-4">Activo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rubros.map((rubro) => (
                <TableRow key={rubro.id} className="h-14">
                  <TableCell className="pl-4">
                    <Codigo codigo={rubro.codigo} />
                  </TableCell>
                  <TableCell className="font-medium">{rubro.nombre}</TableCell>
                  <TableCell className="pr-4">
                    {/* Con su rótulo al lado: se ve qué se prende y se apaga, y la zona para tocar es más grande. */}
                    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                      <Switch
                        checked={rubro.activo}
                        disabled={pendiente === rubro.id}
                        onCheckedChange={(activo) => cambiarActivo(rubro, activo)}
                        aria-label={`${rubro.nombre} activo`}
                      />
                      {rubro.activo ? "Activo" : "Apagado"}
                    </label>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
