"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Gauge, MapPin, Pencil, Plus, Power, Save, X, Zap } from "lucide-react";
import { crearMedidor, editarMedidor, eximirAbono } from "@/lib/actions/clientes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Sello } from "@/components/shared/sello";
import { Money } from "@/components/shared/money";
import { EmptyState } from "@/components/shared/empty-state";
import { formatFecha, formatNumero, labelPeriodo } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  UbicacionMedidor,
  ubicacionParaGuardar,
  type UbicacionElegida,
} from "@/components/clientes/ubicacion-medidor";
import { TOAST_ENVIADO_APROBACION, aplicaDirectoRol } from "@/components/clientes/constantes";
import { llamarAccion } from "@/lib/llamar-accion";

export type MedidorConLectura = {
  id: string;
  numero: string;
  ubicacion: string | null;
  espacioId: string | null;
  activo: boolean;
  ultimaLectura: {
    lectura_actual: number;
    periodo: string;
    fecha_lectura: string;
  } | null;
};

/** Abono mensual de energía (ABEN, I1) del cliente. */
export type AbonoEnergia = {
  /** Precio del concepto ABEN (null si no existe o está inactivo). */
  precio: number | null;
  /** Tiene cliente_conceptos ABEN con activo = false. */
  exento: boolean;
  /** Hay un cambio del abono esperando al Líder. */
  pendiente: boolean;
};

function ubicacionInicial(m: MedidorConLectura): UbicacionElegida {
  if (m.espacioId && m.ubicacion) return { tipo: "plano", lugar: { espacioId: m.espacioId, etiqueta: m.ubicacion } };
  if (m.ubicacion) return { tipo: "texto", texto: m.ubicacion };
  return { tipo: "nada" };
}

/** Pestaña "Medidores" (Administración y Líder): medidores de luz, su lugar en el plano y el abono. */
export function MedidoresCliente({
  clienteId,
  medidores,
  espaciosCliente,
  abono,
  rol,
}: {
  clienteId: string;
  medidores: MedidorConLectura[];
  /** ids de los espacios del cliente (se sugieren como ubicación). */
  espaciosCliente: string[];
  abono: AbonoEnergia;
  rol: string;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [editando, setEditando] = useState<string | null>(null);
  const [numeroNuevo, setNumeroNuevo] = useState("");
  const [ubicacionNueva, setUbicacionNueva] = useState<UbicacionElegida>({ tipo: "nada" });
  const [errorNuevo, setErrorNuevo] = useState<string | null>(null);
  const hayActivo = medidores.some((m) => m.activo);

  function agregar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!numeroNuevo.trim()) {
      setErrorNuevo("Poné el número del medidor (está en el frente del aparato)");
      return;
    }
    setErrorNuevo(null);
    startTransition(async () => {
      const res = await llamarAccion(() => crearMedidor({
        clienteId,
        numero: numeroNuevo,
        ...ubicacionParaGuardar(ubicacionNueva),
      }));
      if (!res.ok) {
        setErrorNuevo(res.error);
        toast.error(res.error);
        return;
      }
      const donde = ubicacionParaGuardar(ubicacionNueva).ubicacion;
      toast.success(`Medidor ${numeroNuevo.trim()} agregado${donde ? ` en ${donde}` : ""}`);
      setNumeroNuevo("");
      setUbicacionNueva({ tipo: "nada" });
      router.refresh();
    });
  }

  function cambiarActivo(m: MedidorConLectura) {
    startTransition(async () => {
      const res = await llamarAccion(() => editarMedidor({ id: m.id, clienteId, activo: !m.activo }));
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
      <BloqueAbono clienteId={clienteId} abono={abono} hayActivo={hayActivo} rol={rol} />

      <Card className="text-base">
        <CardHeader>
          <CardTitle className="text-lg">Medidores de luz</CardTitle>
        </CardHeader>
        <CardContent>
          {medidores.length === 0 ? (
            <EmptyState
              icono={Gauge}
              titulo="Todavía no tiene medidores cargados"
              descripcion="Agregá abajo el número de cada medidor y tocá en el plano dónde está."
            />
          ) : (
            <div className="divide-y">
              {medidores.map((m) =>
                editando === m.id ? (
                  <EditarMedidor
                    key={m.id}
                    medidor={m}
                    clienteId={clienteId}
                    sugeridos={espaciosCliente}
                    alTerminar={() => setEditando(null)}
                  />
                ) : (
                  <div key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                    <Gauge className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className={cn("font-semibold", !m.activo && "text-muted-foreground")}>
                        Medidor {m.numero}
                      </p>
                      {m.espacioId ? (
                        <Link
                          href={`/mapa?espacio=${m.espacioId}`}
                          className="group inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-primary"
                        >
                          <MapPin className="size-4" strokeWidth={2} />
                          {m.ubicacion ?? "En el plano"} · Ver en el plano
                          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
                        </Link>
                      ) : (
                        <p className="text-sm text-muted-foreground">{m.ubicacion ?? "Sin ubicación"}</p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {m.ultimaLectura
                          ? `Última lectura: ${formatNumero(m.ultimaLectura.lectura_actual)} (${labelPeriodo(m.ultimaLectura.periodo)}, ${formatFecha(m.ultimaLectura.fecha_lectura)})`
                          : "Sin lecturas todavía"}
                      </p>
                    </div>
                    <Sello estado={m.activo ? "activo" : "inactivo"} />
                    <Button variant="outline" className="h-11 px-3" onClick={() => setEditando(m.id)}>
                      <Pencil className="size-4" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      className={cn("h-11 px-3", m.activo && "text-destructive hover:text-destructive")}
                      onClick={() => cambiarActivo(m)}
                      disabled={pendiente}
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
          <form onSubmit={agregar} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="nuevo-numero" className="text-base">
                Número del medidor
              </Label>
              <Input
                id="nuevo-numero"
                value={numeroNuevo}
                onChange={(e) => setNumeroNuevo(e.target.value)}
                placeholder="Ej.: 10422"
                className="h-12 w-48 text-base tabular"
                autoComplete="off"
                maxLength={50}
                aria-invalid={errorNuevo ? true : undefined}
              />
            </div>
            <UbicacionMedidor
              valor={ubicacionNueva}
              onCambiar={setUbicacionNueva}
              sugeridos={espaciosCliente}
            />
            {errorNuevo ? <p className="font-medium text-pendiente">{errorNuevo}</p> : null}
            <Button type="submit" size="lg" className="h-12 px-5 text-base font-semibold" disabled={pendiente}>
              {pendiente ? <Spinner className="size-5" /> : <Plus className="size-5" />}
              Agregar medidor
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function EditarMedidor({
  medidor,
  clienteId,
  sugeridos,
  alTerminar,
}: {
  medidor: MedidorConLectura;
  clienteId: string;
  sugeridos: string[];
  alTerminar: () => void;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [numero, setNumero] = useState(medidor.numero);
  const [ubicacion, setUbicacion] = useState<UbicacionElegida>(ubicacionInicial(medidor));

  function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const res = await llamarAccion(() => editarMedidor({
        id: medidor.id,
        clienteId,
        numero,
        ...ubicacionParaGuardar(ubicacion),
      }));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Medidor ${numero.trim()} guardado`);
      alTerminar();
      router.refresh();
    });
  }

  return (
    <form onSubmit={guardar} className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor={`numero-${medidor.id}`} className="text-sm text-muted-foreground">
          Número
        </Label>
        <Input
          id={`numero-${medidor.id}`}
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          className="h-12 w-48 text-base tabular"
          autoComplete="off"
          maxLength={50}
        />
      </div>
      <UbicacionMedidor valor={ubicacion} onCambiar={setUbicacion} sugeridos={sugeridos} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="h-12 px-5 text-base font-semibold" disabled={pendiente}>
          {pendiente ? <Spinner className="size-5" /> : <Save className="size-5" />}
          Guardar
        </Button>
        <Button type="button" variant="outline" className="h-12 px-4 text-base" onClick={alTerminar}>
          <X className="size-5" />
          Cancelar
        </Button>
      </div>
    </form>
  );
}

/** "Abono mensual de energía: $15.000 — lo paga porque tiene medidor activo" + "Eximir del abono". */
function BloqueAbono({
  clienteId,
  abono,
  hayActivo,
  rol,
}: {
  clienteId: string;
  abono: AbonoEnergia;
  hayActivo: boolean;
  rol: string;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [exento, setExento] = useState(abono.exento);
  const directo = aplicaDirectoRol(rol);

  function cambiar(valor: boolean) {
    setExento(valor);
    startTransition(async () => {
      const res = await llamarAccion(() => eximirAbono({ clienteId, eximir: valor }));
      if (!res.ok) {
        toast.error(res.error);
        setExento(abono.exento);
        return;
      }
      if (res.data.estado === "aplicado") {
        toast.success(valor ? "Listo: queda eximido del abono de energía" : "Listo: vuelve a pagar el abono de energía");
      } else {
        toast.success(TOAST_ENVIADO_APROBACION, {
          description: valor
            ? "Sigue pagando el abono hasta que el Líder lo apruebe."
            : "Sigue eximido hasta que el Líder lo apruebe.",
        });
        setExento(abono.exento);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border bg-card px-4 py-4">
      <Zap className="size-6 shrink-0 text-muted-foreground" strokeWidth={1.8} />
      <div className="min-w-0 flex-1 basis-60">
        {!hayActivo ? (
          <>
            <p className="font-semibold">Sin medidor activo: no paga abono de energía</p>
            <p className="text-sm text-muted-foreground">
              {abono.exento
                ? "Además está eximido: si le ponen un medidor, igual no lo paga."
                : "Cuando tenga un medidor activo se le suma el abono mensual."}
            </p>
          </>
        ) : exento ? (
          <>
            <p className="font-semibold">Eximido del abono mensual de energía</p>
            <p className="text-sm text-muted-foreground">Paga solo lo que consume (kWh).</p>
          </>
        ) : (
          <>
            <p className="font-semibold">
              Abono mensual de energía:{" "}
              {abono.precio !== null ? <Money monto={abono.precio} /> : "sin precio cargado"}
            </p>
            <p className="text-sm text-muted-foreground">
              Lo paga porque tiene medidor activo, además de lo que consume (kWh).
            </p>
          </>
        )}
      </div>
      {abono.pendiente ? (
        <Sello estado="pendiente_aprobacion" />
      ) : (
        <div className="flex min-h-11 items-center gap-2">
          {pendiente ? <Spinner className="size-4" /> : null}
          <Switch
            id={`eximir-${clienteId}`}
            checked={exento}
            disabled={pendiente}
            onCheckedChange={cambiar}
            aria-label="Eximir del abono de energía"
          />
          <Label htmlFor={`eximir-${clienteId}`} className="text-base">
            Eximir del abono
          </Label>
        </div>
      )}
      {!directo && !abono.pendiente ? (
        <p className="basis-full text-xs text-muted-foreground">
          La exención la aprueba el Líder de Procesos.
        </p>
      ) : null}
    </div>
  );
}
