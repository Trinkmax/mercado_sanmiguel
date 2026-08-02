"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Gauge, Pencil, Plus, Power, Save, X } from "lucide-react";
import { crearMedidor, editarMedidor } from "@/lib/actions/clientes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sello } from "@/components/shared/sello";
import { EmptyState } from "@/components/shared/empty-state";
import { formatFecha, formatNumero, labelPeriodo } from "@/lib/format";
import { cn } from "@/lib/utils";

export type MedidorConLectura = {
  id: string;
  numero: string;
  ubicacion: string | null;
  activo: boolean;
  ultimaLectura: {
    lectura_actual: number;
    periodo: string;
    fecha_lectura: string;
  } | null;
};

/** Pestaña "Medidores": los medidores de luz del cliente. */
export function MedidoresCliente({
  clienteId,
  medidores,
}: {
  clienteId: string;
  medidores: MedidorConLectura[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editando, setEditando] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function agregar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setGuardando(true);
    startTransition(async () => {
      const res = await crearMedidor({
        clienteId,
        numero: String(fd.get("numero") ?? ""),
        ubicacion: String(fd.get("ubicacion") ?? ""),
      });
      setGuardando(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Medidor agregado");
      form.reset();
      router.refresh();
    });
  }

  function guardarEdicion(medidorId: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setGuardando(true);
    startTransition(async () => {
      const res = await editarMedidor({
        id: medidorId,
        clienteId,
        numero: String(fd.get("numero") ?? ""),
        ubicacion: String(fd.get("ubicacion") ?? ""),
      });
      setGuardando(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Medidor guardado");
      setEditando(null);
      router.refresh();
    });
  }

  function cambiarActivo(m: MedidorConLectura) {
    startTransition(async () => {
      const res = await editarMedidor({
        id: m.id,
        clienteId,
        activo: !m.activo,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        m.activo
          ? `Medidor ${m.numero} desactivado: no entra más en la planilla`
          : `Medidor ${m.numero} activado de nuevo`
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card className="text-base">
        <CardHeader>
          <CardTitle className="text-lg">Medidores de luz</CardTitle>
        </CardHeader>
        <CardContent>
          {medidores.length === 0 ? (
            <EmptyState
              icono={Gauge}
              titulo="Todavía no tiene medidores cargados"
              descripcion="Agregá abajo el número de cada medidor de luz del cliente."
            />
          ) : (
            <div className="divide-y">
              {medidores.map((m) =>
                editando === m.id ? (
                  <form
                    key={m.id}
                    onSubmit={(e) => guardarEdicion(m.id, e)}
                    className="flex flex-wrap items-end gap-3 py-3"
                  >
                    <div className="space-y-2">
                      <Label
                        htmlFor={`numero-${m.id}`}
                        className="text-sm text-muted-foreground"
                      >
                        Número
                      </Label>
                      <Input
                        id={`numero-${m.id}`}
                        name="numero"
                        defaultValue={m.numero}
                        className="h-12 w-40 text-base"
                        autoComplete="off"
                        required
                      />
                    </div>
                    <div className="min-w-48 flex-1 space-y-2">
                      <Label
                        htmlFor={`ubicacion-${m.id}`}
                        className="text-sm text-muted-foreground"
                      >
                        Ubicación
                      </Label>
                      <Input
                        id={`ubicacion-${m.id}`}
                        name="ubicacion"
                        defaultValue={m.ubicacion ?? ""}
                        placeholder="Ej.: Nave 2, columna 5"
                        className="h-12 text-base"
                        autoComplete="off"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="h-12 px-4 font-semibold"
                      disabled={guardando}
                    >
                      <Save className="size-4" />
                      Guardar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 px-4"
                      onClick={() => setEditando(null)}
                    >
                      <X className="size-4" />
                      Cancelar
                    </Button>
                  </form>
                ) : (
                  <div
                    key={m.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"
                  >
                    <Gauge
                      className="size-5 shrink-0 text-muted-foreground"
                      strokeWidth={1.8}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "font-semibold",
                          !m.activo && "text-muted-foreground"
                        )}
                      >
                        Medidor {m.numero}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {m.ubicacion ?? "Sin ubicación"}
                        {m.ultimaLectura
                          ? ` · Última lectura: ${formatNumero(m.ultimaLectura.lectura_actual)} (${labelPeriodo(m.ultimaLectura.periodo)}, ${formatFecha(m.ultimaLectura.fecha_lectura)})`
                          : " · Sin lecturas todavía"}
                      </p>
                    </div>
                    <Sello
                      estado={m.activo ? "pagado" : "anulado"}
                      texto={m.activo ? "Activo" : "Inactivo"}
                    />
                    <Button
                      variant="outline"
                      className="h-11 px-3"
                      onClick={() => setEditando(m.id)}
                    >
                      <Pencil className="size-4" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      className={cn(
                        "h-11 px-3",
                        m.activo && "text-destructive hover:text-destructive"
                      )}
                      onClick={() => cambiarActivo(m)}
                    >
                      <Power className="size-4" />
                      {m.activo ? "Desactivar" : "Reactivar"}
                    </Button>
                  </div>
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="text-base">
        <CardHeader>
          <CardTitle className="text-lg">Agregar un medidor</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={agregar} className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="nuevo-numero" className="text-base">
                Número
              </Label>
              <Input
                id="nuevo-numero"
                name="numero"
                placeholder="Ej.: 10422"
                className="h-12 w-40 text-base"
                autoComplete="off"
                required
              />
            </div>
            <div className="min-w-48 flex-1 space-y-2">
              <Label htmlFor="nueva-ubicacion" className="text-base">
                Ubicación
              </Label>
              <Input
                id="nueva-ubicacion"
                name="ubicacion"
                placeholder="Ej.: Nave 2, columna 5"
                className="h-12 text-base"
                autoComplete="off"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="h-12 px-5 text-base font-semibold"
              disabled={guardando}
            >
              <Plus className="size-5" />
              Agregar medidor
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
