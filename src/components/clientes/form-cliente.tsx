"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleAlert, Save, Send, UserPlus } from "lucide-react";
import type { Rol } from "@/lib/auth";
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
import { CuotasMesPicker } from "@/components/clientes/cuotas-mes";
import {
  TOAST_ENVIADO_APROBACION,
  aplicaDirectoRol,
} from "@/components/clientes/constantes";

export type DatosCliente = {
  id: string;
  nombre: string;
  apodo: string | null;
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
 * carpeta lista (quintero, local, cocheras…) sin pasos extra.
 * Si el rol no es el Líder de Procesos, lo que se guarda es una propuesta
 * que queda esperando su aprobación. */
export function FormCliente({
  cliente,
  codigoSugerido,
  conceptos,
  rol,
  alGuardar,
}: {
  cliente?: DatosCliente;
  codigoSugerido?: number;
  conceptos?: ConceptoRecurrente[];
  rol: Rol;
  alGuardar?: () => void;
}) {
  const router = useRouter();
  const directo = aplicaDirectoRol(rol);
  const [pendiente, startTransition] = useTransition();
  const [tipoPersona, setTipoPersona] = useState<"fisica" | "juridica">(
    cliente?.tipo_persona ?? "fisica"
  );
  const [cuotasMes, setCuotasMes] = useState<number>(cliente?.cuotas_mes ?? 1);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const datos = {
      nombre: String(fd.get("nombre") ?? ""),
      apodo: String(fd.get("apodo") ?? ""),
      tipo_persona: tipoPersona,
      cuit: String(fd.get("cuit") ?? ""),
      telefono: String(fd.get("telefono") ?? ""),
      email: String(fd.get("email") ?? ""),
      direccion: String(fd.get("direccion") ?? ""),
      codigo: String(fd.get("codigo") ?? ""),
      cuotas_mes: cuotasMes,
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
        if (res.data.estado === "aplicado") {
          toast.success("Datos del cliente guardados");
        } else {
          toast.success(TOAST_ENVIADO_APROBACION, {
            description: "Los datos se actualizan cuando el Líder de Procesos apruebe el cambio.",
          });
        }
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

      if (res.data.estado === "aplicado" && res.data.id) {
        toast.success(
          conceptosElegidos.length > 0
            ? "Cliente creado con lo que paga. Esta es su carpeta."
            : "Cliente creado. Esta es su carpeta."
        );
        router.push(`/clientes/${res.data.id}`);
        return;
      }

      // Pendiente: el cliente todavía no existe; volvemos al listado.
      toast.success(TOAST_ENVIADO_APROBACION, {
        description: `${datos.nombre} va a aparecer en la lista cuando el Líder de Procesos apruebe el alta.`,
        duration: 7000,
      });
      router.push("/clientes");
    });
  }

  const textoBoton = directo
    ? cliente
      ? "Guardar cambios"
      : "Crear cliente"
    : "Enviar a aprobación";

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

      <div className="space-y-2">
        <Label htmlFor="apodo" className="text-base">
          Apodo{" "}
          <span className="font-normal text-muted-foreground">
            (cómo le dicen en el mercado, opcional)
          </span>
        </Label>
        <Input
          id="apodo"
          name="apodo"
          defaultValue={cliente?.apodo ?? ""}
          placeholder="Ej.: El Tano"
          className="h-12 text-base"
          autoComplete="off"
          maxLength={80}
        />
        <p className="text-sm text-muted-foreground">
          Se muestra en el mapa, debajo del número de puesto.
        </p>
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
          className="h-12 w-40 text-base tabular"
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
        <Label className="text-base">Paga el mes en</Label>
        <CuotasMesPicker
          valor={cuotasMes}
          onCambiar={setCuotasMes}
          idPrefix={cliente ? `cuotas-${cliente.id}` : "cuotas-alta"}
        />
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

      <div className="space-y-2">
        <Button
          type="submit"
          size="lg"
          disabled={pendiente}
          className="h-13 w-full text-base font-semibold"
        >
          {pendiente ? (
            <Spinner className="size-5" />
          ) : !directo ? (
            <Send className="size-5" />
          ) : cliente ? (
            <Save className="size-5" />
          ) : (
            <UserPlus className="size-5" />
          )}
          {textoBoton}
        </Button>
        {!directo ? (
          <p className="text-center text-sm text-muted-foreground">
            {cliente
              ? "Los cambios los revisa y aprueba el Líder de Procesos antes de aplicarse."
              : "El alta la revisa y aprueba el Líder de Procesos; hasta entonces el cliente no aparece en la lista."}
          </p>
        ) : null}
      </div>
    </form>
  );
}
