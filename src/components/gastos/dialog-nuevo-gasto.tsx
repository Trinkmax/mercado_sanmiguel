"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { formatARS } from "@/lib/format";
import { crearGasto } from "@/lib/actions/gastos";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Rubro = { id: string; codigo: string; nombre: string };

/** Botón primario + formulario para cargar un gasto nuevo del mes. */
export function DialogNuevoGasto({ rubros }: { rubros: Rubro[] }) {
  const [abierto, setAbierto] = useState(false);
  const [rubroId, setRubroId] = useState("");
  const [tipo, setTipo] = useState<"fijo" | "variable">("fijo");
  const [monto, setMonto] = useState("");
  const [pendiente, startTransition] = useTransition();

  function cerrar(abrir: boolean) {
    setAbierto(abrir);
    if (!abrir) {
      setRubroId("");
      setTipo("fijo");
      setMonto("");
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("rubro_id", rubroId);
    fd.set("tipo", tipo);
    fd.set("monto", monto);
    startTransition(async () => {
      const res = await crearGasto(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Gasto cargado.");
      cerrar(false);
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={cerrar}>
      <DialogTrigger asChild>
        <Button size="lg" className="h-13 px-6 text-base font-semibold">
          <Plus className="size-5" strokeWidth={2} />
          Cargar gasto
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cargar gasto</DialogTitle>
          <DialogDescription>
            Anotá el gasto una sola vez: después lo pagás desde la caja o tesorería.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label className="text-base">Rubro</Label>
            <Select value={rubroId} onValueChange={setRubroId}>
              <SelectTrigger className="min-h-11 w-full">
                <SelectValue placeholder="Elegí el rubro" />
              </SelectTrigger>
              <SelectContent>
                {rubros.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.codigo} — {r.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-base">Tipo de gasto</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["fijo", "variable"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  aria-pressed={tipo === t}
                  className={cn(
                    "h-11 rounded-md border text-sm font-medium transition-colors",
                    tipo === t
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-card hover:bg-accent"
                  )}
                >
                  {t === "fijo" ? "Fijo" : "Variable"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gasto-descripcion" className="text-base">
              Descripción
            </Label>
            <Input
              id="gasto-descripcion"
              name="descripcion"
              className="h-11"
              placeholder="Ej.: Factura de agua de agosto"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gasto-monto" className="text-base">
              Monto
            </Label>
            <Input
              id="gasto-monto"
              inputMode="numeric"
              className="h-11"
              placeholder="Ej.: 150000"
              value={monto}
              onChange={(e) => setMonto(e.target.value.replace(/\D/g, ""))}
              required
            />
            {monto ? (
              <p className="text-sm font-medium text-muted-foreground tabular">
                {formatARS(Number(monto))}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="gasto-vencimiento" className="text-base">
              Vencimiento <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="gasto-vencimiento"
              name="vencimiento"
              type="date"
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gasto-factura" className="text-base">
              Factura <span className="font-normal text-muted-foreground">(opcional, PDF o foto)</span>
            </Label>
            <Input
              id="gasto-factura"
              name="factura"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="h-11 pt-2.5"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gasto-notas" className="text-base">
              Notas <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea id="gasto-notas" name="notas" rows={2} />
          </div>

          <Button
            type="submit"
            size="lg"
            className="h-12 w-full text-base font-semibold"
            disabled={pendiente || !rubroId || !monto}
          >
            {pendiente ? <Spinner /> : null}
            Cargar gasto
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
