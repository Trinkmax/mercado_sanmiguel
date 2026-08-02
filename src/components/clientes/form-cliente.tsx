"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleAlert, Save, UserPlus } from "lucide-react";
import { crearCliente, editarCliente } from "@/lib/actions/clientes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ConceptosAlta,
  normalizarCantidad,
  type ConceptoRecurrente,
} from "@/components/clientes/conceptos-alta";

export type DatosCliente = {
  id: string;
  nombre: string;
  tipo_persona: "fisica" | "juridica";
  cuit: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  codigo: number;
  cuotas_mes: number;
  notas: string | null;
};

/** Formulario de datos del cliente: sirve para el alta y para la edición.
 * En el alta, `conceptos` habilita la sección "¿Qué paga?" para dejar la
 * carpeta lista (quintero, local, cocheras…) sin pasos extra. */
export function FormCliente({
  cliente,
  codigoSugerido,
  conceptos,
  alGuardar,
}: {
  cliente?: DatosCliente;
  codigoSugerido?: number;
  conceptos?: ConceptoRecurrente[];
  alGuardar?: () => void;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [tipoPersona, setTipoPersona] = useState<"fisica" | "juridica">(
    cliente?.tipo_persona ?? "fisica"
  );
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const datos = {
      nombre: String(fd.get("nombre") ?? ""),
      tipo_persona: tipoPersona,
      cuit: String(fd.get("cuit") ?? ""),
      telefono: String(fd.get("telefono") ?? ""),
      email: String(fd.get("email") ?? ""),
      direccion: String(fd.get("direccion") ?? ""),
      codigo: String(fd.get("codigo") ?? ""),
      cuotas_mes: String(fd.get("cuotas_mes") ?? ""),
      notas: String(fd.get("notas") ?? ""),
    };

    startTransition(async () => {
      if (cliente) {
        const res = await editarCliente({ id: cliente.id, ...datos });
        if (!res.ok) {
          setError(res.error);
          toast.error(res.error);
          return;
        }
        setError(null);
        toast.success("Datos del cliente guardados");
        router.refresh();
        alGuardar?.();
        return;
      }

      // Alta: solo van los conceptos con cantidad mayor a 0.
      const conceptosElegidos = Object.entries(cantidades)
        .map(([concepto_id, cantidad]) => ({
          concepto_id,
          cantidad: normalizarCantidad(cantidad),
        }))
        .filter((c) => c.cantidad > 0);

      const res = await crearCliente({ ...datos, conceptos: conceptosElegidos });
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      setError(null);
      if (res.data.advertencia) {
        toast.error(res.data.advertencia);
      } else {
        toast.success(
          conceptosElegidos.length > 0
            ? "Cliente creado con lo que paga. Esta es su carpeta."
            : "Cliente creado. Esta es su carpeta."
        );
      }
      router.push(`/clientes/${res.data.id}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="nombre" className="text-base">
          Nombre o razón social
        </Label>
        <Input
          id="nombre"
          name="nombre"
          defaultValue={cliente?.nombre ?? ""}
          placeholder="Ej.: Verdulería Juárez e Hijos"
          className="h-12 text-base"
          autoComplete="off"
          required
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-base">Tipo</Label>
          <Select
            value={tipoPersona}
            onValueChange={(v) => setTipoPersona(v as "fisica" | "juridica")}
          >
            <SelectTrigger className="h-12 w-full text-base">
              <SelectValue placeholder="Elegí el tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fisica">Persona física</SelectItem>
              <SelectItem value="juridica">Empresa</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cuit" className="text-base">
            CUIT / DNI
          </Label>
          <Input
            id="cuit"
            name="cuit"
            defaultValue={cliente?.cuit ?? ""}
            placeholder="Ej.: 20-12345678-3"
            className="h-12 text-base"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="telefono" className="text-base">
            Teléfono
          </Label>
          <Input
            id="telefono"
            name="telefono"
            type="tel"
            inputMode="tel"
            defaultValue={cliente?.telefono ?? ""}
            placeholder="Ej.: 3541 123456"
            className="h-12 text-base"
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-base">
            Email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            defaultValue={cliente?.email ?? ""}
            placeholder="Ej.: nombre@correo.com"
            className="h-12 text-base"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="direccion" className="text-base">
          Dirección
        </Label>
        <Input
          id="direccion"
          name="direccion"
          defaultValue={cliente?.direccion ?? ""}
          placeholder="Ej.: Nave 2, puesto 14"
          className="h-12 text-base"
          autoComplete="off"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="codigo" className="text-base">
            N° de carpeta
          </Label>
          <Input
            id="codigo"
            name="codigo"
            inputMode="numeric"
            pattern="[0-9]*"
            defaultValue={cliente?.codigo ?? codigoSugerido ?? ""}
            className="h-12 text-base tabular"
            autoComplete="off"
            required
          />
          {!cliente && codigoSugerido ? (
            <p className="text-sm text-muted-foreground">
              Te sugerimos el {codigoSugerido}, que es el que sigue.
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="cuotas_mes" className="text-base">
            Paga el mes en
          </Label>
          <div className="flex items-center gap-3">
            <Input
              id="cuotas_mes"
              name="cuotas_mes"
              type="number"
              inputMode="numeric"
              min={1}
              max={10}
              step={1}
              defaultValue={cliente?.cuotas_mes ?? 1}
              className="h-12 w-24 text-center text-base tabular"
            />
            <span className="text-muted-foreground">
              {cliente ? "veces" : "veces (1 = todo junto)"}
            </span>
          </div>
        </div>
      </div>

      {!cliente && conceptos && conceptos.length > 0 ? (
        <ConceptosAlta
          conceptos={conceptos}
          cantidades={cantidades}
          onCambiar={(conceptoId, cantidad) =>
            setCantidades((prev) => ({ ...prev, [conceptoId]: cantidad }))
          }
        />
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="notas" className="text-base">
          Notas
        </Label>
        <Textarea
          id="notas"
          name="notas"
          rows={3}
          defaultValue={cliente?.notas ?? ""}
          placeholder="Lo que haga falta recordar de este cliente"
          className="text-base"
        />
      </div>

      {error ? (
        <p className="flex items-center gap-2 font-medium text-pendiente">
          <CircleAlert className="size-5 shrink-0" strokeWidth={2} />
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={pendiente}
        className="h-13 w-full text-base font-semibold"
      >
        {pendiente ? (
          <Spinner className="size-5" />
        ) : cliente ? (
          <Save className="size-5" />
        ) : (
          <UserPlus className="size-5" />
        )}
        {cliente ? "Guardar cambios" : "Crear cliente"}
      </Button>
    </form>
  );
}
