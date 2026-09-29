"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Paperclip, Save, UserPlus, X } from "lucide-react";
import { crearEmpleado, editarEmpleado } from "@/lib/actions/personal";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  LABEL_SECTOR,
  LABEL_TIPO_CONTRATO,
  SECTORES_PERSONAL,
  SUGERENCIAS_CARGO,
  TIPOS_CONTRATO,
  formatHorasNumero,
  type SectorPersonal,
  type TipoContrato,
} from "@/components/personal/constantes";
import { llamarAccion } from "@/lib/llamar-accion";
import { AlertaError } from "@/components/cobranza/alerta-error";
import { ACCEPT_ADJUNTO } from "@/components/solicitudes/constantes";
import {
  AYUDA_PESO_ADJUNTO,
  errorPesoAdjunto,
  explicarFalloEnvio,
  prepararAdjuntos,
} from "@/components/comunicaciones/adjuntos";

export type DatosEmpleado = {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  cuil: string | null;
  cargo: string | null;
  telefono: string | null;
  email: string | null;
  sector: SectorPersonal;
  horas_semanales: number | null;
  tipo_contrato: TipoContrato;
  fecha_ingreso: string | null;
  fecha_egreso: string | null;
  observaciones: string | null;
  contrato_path: string | null;
};

function Bloque({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5 rounded-lg border bg-card p-5 sm:p-6">
      <div className="space-y-0.5">
        <h2 className="font-display text-lg font-bold tracking-tight">{titulo}</h2>
        {descripcion ? (
          <p className="text-sm text-muted-foreground">{descripcion}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** Alta y edición de empleado en dos bloques: datos personales y contrato laboral. */
export function FormEmpleado({
  empleado,
  cancelarHref,
  horasSegunHorario,
}: {
  empleado?: DatosEmpleado;
  /** A dónde vuelve "Cancelar" (listado en el alta, ficha en la edición). */
  cancelarHref?: string;
  /** Horas por semana que suman sus horarios cargados (para "Usar este número"). */
  horasSegunHorario?: number;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [tipoContrato, setTipoContrato] = useState<TipoContrato>(
    empleado?.tipo_contrato ?? "planta_permanente"
  );
  const [sector, setSector] = useState<SectorPersonal | null>(empleado?.sector ?? null);
  const [cargo, setCargo] = useState(empleado?.cargo ?? "");
  const [horas, setHoras] = useState(
    empleado?.horas_semanales ? formatHorasNumero(empleado.horas_semanales) : ""
  );
  const horasNum = Number(horas.replace(/\./g, "").replace(",", "."));
  const horasValidas = horas.trim() !== "" && Number.isFinite(horasNum) && horasNum > 0 && horasNum <= 84;
  const [error, setError] = useState<string | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const inputArchivo = useRef<HTMLInputElement>(null);

  function quitarArchivo() {
    if (inputArchivo.current) inputArchivo.current.value = "";
    setNombreArchivo(null);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente) return;
    if (!sector) {
      setError("Elegí el sector donde trabaja: define quién carga sus novedades.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    fd.set("tipo_contrato", tipoContrato);
    fd.set("sector", sector);
    fd.set("cargo", cargo);
    fd.set("horas_semanales", horasValidas ? String(horasNum) : horas.trim());
    // El DNI va sin puntos ni espacios, pase lo que pase.
    fd.set("dni", String(fd.get("dni") ?? "").replace(/\D/g, ""));
    if (empleado) fd.set("id", empleado.id);
    setError(null);

    startTransition(async () => {
      // La foto del contrato se achica antes de subir (una de la tablet pesa 3–8 MB).
      const errorPeso = await prepararAdjuntos(fd, ["contrato"]);
      if (errorPeso) {
        setError(errorPeso);
        return;
      }
      // Si se corta la red, lo cargado queda; reintentar no duplica (el DNI no se repite).
      const res = empleado ? await llamarAccion(() => editarEmpleado(fd)) : await llamarAccion(() => crearEmpleado(fd));
      if (!res.ok) {
        setError(explicarFalloEnvio(res.error, fd, ["contrato"]));
        return;
      }
      setError(null);
      if (empleado) {
        toast.success("Datos del empleado guardados");
      } else {
        toast.success("Empleado creado. Ahora cargale los horarios de trabajo.");
      }
      router.push(`/personal/${res.data.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Bloque titulo="Datos" descripcion="Cómo figura en el padrón y cómo ubicarlo.">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="apellido" className="text-base">
              Apellido
            </Label>
            <Input
              id="apellido"
              name="apellido"
              defaultValue={empleado?.apellido ?? ""}
              placeholder="Ej.: Aguirre"
              className="h-12 text-base md:text-base"
              autoComplete="off"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nombre" className="text-base">
              Nombre
            </Label>
            <Input
              id="nombre"
              name="nombre"
              defaultValue={empleado?.nombre ?? ""}
              placeholder="Ej.: Luis"
              className="h-12 text-base md:text-base"
              autoComplete="off"
              required
            />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="dni" className="text-base">
              DNI
            </Label>
            <Input
              id="dni"
              name="dni"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              defaultValue={empleado?.dni ?? ""}
              placeholder="Solo números, sin puntos"
              className="h-12 text-base tabular md:text-base"
              autoComplete="off"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cuil" className="text-base">
              CUIL
            </Label>
            <Input
              id="cuil"
              name="cuil"
              inputMode="numeric"
              defaultValue={empleado?.cuil ?? ""}
              placeholder="Ej.: 20-12345678-3"
              className="h-12 text-base tabular md:text-base"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-base" id="sector-label">
            Sector
          </Label>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="sector-label">
            {SECTORES_PERSONAL.map((sec) => {
              const activo = sec === sector;
              return (
                <button
                  key={sec}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  onClick={() => {
                    setSector(sec);
                    setError(null);
                  }}
                  className={cn(
                    "inline-flex min-h-12 items-center rounded-lg border px-5 text-base font-semibold transition-colors",
                    activo
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:bg-accent"
                  )}
                >
                  {LABEL_SECTOR[sec]}
                </button>
              );
            })}
          </div>
          <p className="text-sm text-muted-foreground">
            Define quién carga sus novedades: Portería la carga el Jefe de Portería; Limpieza y
            Mantenimiento, Administración.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cargo" className="text-base">
            Cargo
          </Label>
          <Input
            id="cargo"
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            placeholder="Ej.: Encargado de turno, Sereno, Peón"
            className="h-12 text-base md:text-base"
            autoComplete="off"
          />
          <div className="flex flex-wrap gap-2">
            {SUGERENCIAS_CARGO.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCargo(c)}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors",
                  cargo === c
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {c}
              </button>
            ))}
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
              defaultValue={empleado?.telefono ?? ""}
              placeholder="Ej.: 3541 123456"
              className="h-12 text-base md:text-base"
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
              defaultValue={empleado?.email ?? ""}
              placeholder="Ej.: nombre@correo.com"
              className="h-12 text-base md:text-base"
              autoComplete="off"
            />
          </div>
        </div>
      </Bloque>

      <Bloque
        titulo="Contrato laboral"
        descripcion="Tipo de vínculo, fechas y el contrato firmado (PDF o foto)."
      >
        <div className="space-y-2">
          <Label className="text-base">Tipo de contrato</Label>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de contrato">
            {TIPOS_CONTRATO.map((t) => {
              const activo = t === tipoContrato;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  onClick={() => setTipoContrato(t)}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors",
                    activo
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  {LABEL_TIPO_CONTRATO[t]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="horas_semanales" className="text-base">
            Horas por semana según contrato
          </Label>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              id="horas_semanales"
              inputMode="decimal"
              value={horas}
              onChange={(e) => setHoras(e.target.value.replace(/[^\d,]/g, "").slice(0, 5))}
              placeholder="Ej.: 44"
              className="h-12 w-32 text-base tabular md:text-base"
              autoComplete="off"
              aria-describedby="horas-ayuda"
            />
            {horasValidas ? (
              <span className="text-sm text-muted-foreground tabular">
                {formatHorasNumero(horasNum)} h por semana ≈ {formatHorasNumero(Math.round((horasNum / 7) * 10) / 10)} h por día
              </span>
            ) : null}
            {horasSegunHorario && horasSegunHorario > 0 && (!horasValidas || horasNum !== horasSegunHorario) ? (
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => setHoras(formatHorasNumero(horasSegunHorario))}
              >
                Según sus horarios: {formatHorasNumero(horasSegunHorario)} h · Usar este número
              </Button>
            ) : null}
          </div>
          <p id="horas-ayuda" className="text-sm text-muted-foreground">
            Sirve para Novedades: cuántas horas tendría que haber trabajado en el mes. Si lo dejás
            vacío, se calculan con sus horarios.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fecha_ingreso" className="text-base">
              Fecha de ingreso
            </Label>
            <Input
              id="fecha_ingreso"
              name="fecha_ingreso"
              type="date"
              defaultValue={empleado?.fecha_ingreso ?? ""}
              className="h-12 text-base md:text-base"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fecha_egreso" className="text-base">
              Fecha de egreso{" "}
              <span className="font-normal text-muted-foreground">(si ya no trabaja)</span>
            </Label>
            <Input
              id="fecha_egreso"
              name="fecha_egreso"
              type="date"
              defaultValue={empleado?.fecha_egreso ?? ""}
              className="h-12 text-base md:text-base"
              aria-describedby="egreso-ayuda"
            />
          </div>
        </div>
        <p id="egreso-ayuda" className="-mt-2 text-sm text-muted-foreground">
          Con una fecha de egreso que ya pasó deja de figurar como activo. Si vuelve a trabajar, usá
          «Reincorporar» en su ficha.
        </p>

        <div className="space-y-2">
          <Label htmlFor="contrato" className="text-base">
            Archivo del contrato
          </Label>
          <input
            ref={inputArchivo}
            id="contrato"
            name="contrato"
            type="file"
            accept={ACCEPT_ADJUNTO}
            className="sr-only"
            onChange={(e) => {
              const archivo = e.target.files?.[0] ?? null;
              const pesado = errorPesoAdjunto(archivo);
              if (pesado) {
                e.target.value = "";
                setNombreArchivo(null);
                setError(pesado);
                return;
              }
              setError(null);
              setNombreArchivo(archivo?.name ?? null);
            }}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 px-4 text-base"
              onClick={() => inputArchivo.current?.click()}
            >
              <Paperclip className="size-5" strokeWidth={2} />
              {empleado?.contrato_path ? "Reemplazar contrato" : "Elegir archivo"}
            </Button>
            <div className="flex min-w-0 max-w-full items-center gap-2 text-sm text-muted-foreground">
              {nombreArchivo ? (
                <>
                  <FileText className="size-4 shrink-0" strokeWidth={2} />
                  <span className="min-w-0 truncate">{nombreArchivo}</span>
                  <Button type="button" variant="ghost" className="h-11 shrink-0 px-3" onClick={quitarArchivo}>
                    <X className="size-4" strokeWidth={2} />
                    Quitar
                  </Button>
                </>
              ) : empleado?.contrato_path ? (
                <p>Ya hay un contrato cargado. Si elegís otro, lo reemplaza.</p>
              ) : (
                <p>PDF o foto. {AYUDA_PESO_ADJUNTO} Se puede cargar después.</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="observaciones" className="text-base">
            Observaciones
          </Label>
          <Textarea
            id="observaciones"
            name="observaciones"
            rows={3}
            defaultValue={empleado?.observaciones ?? ""}
            placeholder="Lo que haga falta recordar del contrato o del empleado"
            className="text-base md:text-base"
          />
        </div>
      </Bloque>

      {error ? <AlertaError error={error} titulo={empleado ? "No se guardaron los cambios" : "No se pudo crear"} /> : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        {cancelarHref ? (
          <Button asChild variant="outline" size="lg" className="h-13 px-6 text-base">
            <Link href={cancelarHref}>Cancelar</Link>
          </Button>
        ) : null}
        <Button
          type="submit"
          size="lg"
          disabled={pendiente}
          className="h-13 w-full text-base font-semibold sm:flex-1"
        >
          {pendiente ? (
            <Spinner className="size-5" />
          ) : empleado ? (
            <Save className="size-5" />
          ) : (
            <UserPlus className="size-5" />
          )}
          {empleado ? "Guardar cambios" : "Crear empleado"}
        </Button>
      </div>
    </form>
  );
}
