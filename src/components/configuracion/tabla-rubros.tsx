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

  function crear() {
    startCrear(async () => {
      const res = await crearRubro({ codigo, nombre });
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
      const res = await cambiarActivoRubro({ id: rubro.id, activo });
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
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Nuevo rubro</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="codigo-rubro" className="text-sm">
                Código
              </Label>
              <Input
                id="codigo-rubro"
                autoComplete="off"
                maxLength={8}
                placeholder="AGUA"
                className="h-12 w-32 text-base uppercase md:text-base"
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
                placeholder="Agua corriente"
                className="h-12 text-base md:text-base"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>
            <Button
              size="lg"
              className="h-12 px-6 text-base font-semibold"
              disabled={creando || !codigo.trim() || !nombre.trim()}
              onClick={crear}
            >
              <Plus className="size-5" strokeWidth={2} />
              {creando ? "Agregando…" : "Agregar rubro"}
            </Button>
          </div>
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
                    <Switch
                      checked={rubro.activo}
                      disabled={pendiente === rubro.id}
                      onCheckedChange={(activo) => cambiarActivo(rubro, activo)}
                      aria-label={`${rubro.nombre} activo`}
                    />
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
