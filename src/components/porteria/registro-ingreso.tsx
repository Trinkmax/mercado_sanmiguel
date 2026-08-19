"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BadgeCheck, CircleAlert, LogIn, RotateCcw, UserRoundSearch } from "lucide-react";
import {
  buscarEmpleados,
  registrarIngreso,
  type EmpleadoBusqueda,
  type IngresoRegistrado,
} from "@/lib/actions/porteria";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Sello } from "@/components/shared/sello";
import { FirmaPad, type FirmaPadHandle } from "@/components/porteria/firma-pad";
import { EscanerDni, type DatosDni } from "@/components/porteria/escaner-dni";
import { horaAR } from "@/components/porteria/fechas";

const SEGUNDOS_CONFIRMACION = 8;

type CampoBusqueda = "dni" | "apellido";

/**
 * Bloque primario de la garita: DNI (con autocompletado del padrón o lectura
 * del código del DNI), nombre y apellido, firma con el dedo y listo.
 * Al registrar, estampa el sello y vuelve al estado inicial para el siguiente.
 */
export function RegistroIngreso() {
  const router = useRouter();
  const [dni, setDni] = useState("");
  const [apellido, setApellido] = useState("");
  const [nombre, setNombre] = useState("");
  const [empleado, setEmpleado] = useState<EmpleadoBusqueda | null>(null);
  const [coincidencias, setCoincidencias] = useState<EmpleadoBusqueda[]>([]);
  const [campoBusqueda, setCampoBusqueda] = useState<CampoBusqueda | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [sinPadron, setSinPadron] = useState(false);
  const [tieneFirma, setTieneFirma] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<IngresoRegistrado | null>(null);
  const [pendiente, startTransition] = useTransition();
  const firmaRef = useRef<FirmaPadHandle>(null);
  const dniRef = useRef<HTMLInputElement>(null);
  const ultimaBusqueda = useRef(0);

  const dniValido = /^\d{7,8}$/.test(dni);
  const listo = dniValido && apellido.trim().length > 0 && nombre.trim().length > 0 && tieneFirma;

  const elegirEmpleado = useCallback((e: EmpleadoBusqueda) => {
    setEmpleado(e);
    setDni(e.dni);
    setApellido(e.apellido);
    setNombre(e.nombre);
    setCoincidencias([]);
    setCampoBusqueda(null);
    setSinPadron(false);
    setError(null);
  }, []);

  // ¿Hay que consultar el padrón? Por DNI (prefijo, 3+ números) o por apellido (3+ letras),
  // salvo que el DNI ya corresponda al empleado elegido.
  const textoBusqueda =
    campoBusqueda === "dni" ? dni : campoBusqueda === "apellido" ? apellido.trim() : "";
  const debeBuscar =
    campoBusqueda !== null &&
    textoBusqueda.length >= 3 &&
    !(empleado && campoBusqueda === "dni" && empleado.dni === dni);

  // Búsqueda en el padrón con debounce; el resultado llega en el callback.
  useEffect(() => {
    const id = ++ultimaBusqueda.current;
    if (!debeBuscar) return;
    const texto = textoBusqueda;
    const campo = campoBusqueda;
    const timer = setTimeout(async () => {
      setBuscando(true);
      const res = await buscarEmpleados(texto);
      if (id !== ultimaBusqueda.current) return;
      setBuscando(false);
      if (!res.ok) {
        setCoincidencias([]);
        return;
      }
      // DNI completo que está en el padrón: se completa solo, sin tocar nada.
      const exacto = campo === "dni" ? res.data.find((e) => e.dni === texto) : undefined;
      if (exacto) {
        elegirEmpleado(exacto);
        return;
      }
      setCoincidencias(res.data);
      if (campo === "dni") setSinPadron(/^\d{7,8}$/.test(texto));
    }, 250);
    return () => clearTimeout(timer);
  }, [debeBuscar, textoBusqueda, campoBusqueda, elegirEmpleado]);

  // La confirmación se va sola: la garita sigue con el siguiente.
  useEffect(() => {
    if (!resultado) return;
    const timer = setTimeout(() => {
      setResultado(null);
      dniRef.current?.focus();
    }, SEGUNDOS_CONFIRMACION * 1000);
    return () => clearTimeout(timer);
  }, [resultado]);

  const alLeerDni = useCallback(
    (datos: DatosDni) => {
      setDni(datos.dni);
      setApellido(datos.apellido);
      setNombre(datos.nombre);
      setEmpleado(null);
      setCoincidencias([]);
      setSinPadron(false);
      setCampoBusqueda("dni");
      setError(null);
      toast.success(`DNI leído: ${datos.apellido}, ${datos.nombre}`);
    },
    []
  );

  function cambiarDni(valor: string) {
    const limpio = valor.replace(/\D/g, "").slice(0, 8);
    setDni(limpio);
    setError(null);
    setSinPadron(false);
    if (campoBusqueda !== "dni") {
      setCampoBusqueda("dni");
      setCoincidencias([]);
    }
    if (empleado && empleado.dni !== limpio) setEmpleado(null);
  }

  function enfocarCampo(campo: CampoBusqueda | null) {
    if (campo === campoBusqueda) return;
    setCampoBusqueda(campo);
    setCoincidencias([]);
  }

  function reiniciar() {
    setDni("");
    setApellido("");
    setNombre("");
    setEmpleado(null);
    setCoincidencias([]);
    setCampoBusqueda(null);
    setSinPadron(false);
    setError(null);
    firmaRef.current?.limpiar();
    setTieneFirma(false);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente) return;
    if (!dniValido) {
      setError("El DNI tiene que tener 7 u 8 números, sin puntos");
      dniRef.current?.focus();
      return;
    }
    if (!apellido.trim() || !nombre.trim()) {
      setError("Completá el apellido y el nombre");
      return;
    }
    startTransition(async () => {
      const firma = await firmaRef.current?.obtenerBlob();
      if (!firma) {
        setError("Falta la firma: pedile que firme en el recuadro");
        return;
      }
      const fd = new FormData();
      fd.set("dni", dni);
      fd.set("apellido", apellido.trim());
      fd.set("nombre", nombre.trim());
      if (empleado) fd.set("empleado_id", empleado.id);
      fd.set("firma", firma, "firma.png");

      const res = await registrarIngreso(fd);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      setError(null);
      toast.success(
        `Ingreso registrado: ${res.data.apellido}, ${res.data.nombre} · ${horaAR(res.data.ingreso_en)}`
      );
      setResultado(res.data);
      reiniciar();
      router.refresh();
    });
  }

  const mostrarLista = debeBuscar && coincidencias.length > 0;

  // ---------- Confirmación: el sello reemplaza al formulario ----------
  if (resultado) {
    return (
      <section className="space-y-6 rounded-lg border bg-card p-5 sm:p-6" aria-live="polite">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <Sello grande estado="pagado" texto="Ingreso registrado" className="animar-estampado" />
          <p className="font-display text-2xl font-bold tracking-tight">
            {resultado.apellido}, {resultado.nombre}
          </p>
          <p className="text-lg text-muted-foreground tabular">
            {horaAR(resultado.ingreso_en)}
            {resultado.cargo ? ` · ${resultado.cargo}` : ""}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {resultado.en_padron ? (
              <Sello estado={resultado.fuera_de_horario ? "fuera_horario" : "en_horario"} />
            ) : (
              <Sello estado="parcial" texto="Fuera del padrón" />
            )}
          </div>
        </div>
        <Button
          type="button"
          size="lg"
          className="h-16 w-full text-lg font-semibold"
          onClick={() => {
            setResultado(null);
            setTimeout(() => dniRef.current?.focus(), 0);
          }}
        >
          <LogIn className="size-6" strokeWidth={2} />
          Registrar otro ingreso
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Vuelve solo al formulario en unos segundos.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border bg-card p-5 sm:p-6">
      <form onSubmit={onSubmit} className="space-y-6" autoComplete="off">
        <div className="space-y-0.5">
          <h2 className="font-display text-xl font-bold tracking-tight">Registrar ingreso</h2>
          <p className="text-sm text-muted-foreground">
            DNI, nombre y firma de quien entra. Si está en el padrón, se completa solo.
          </p>
        </div>

        {/* ---------- DNI ---------- */}
        <div className="space-y-2">
          <Label htmlFor="dni-ingreso" className="text-base">
            DNI
          </Label>
          <div className="flex flex-wrap items-start gap-3">
            <div className="relative min-w-0 flex-1 basis-56">
              <Input
                ref={dniRef}
                id="dni-ingreso"
                name="dni"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={dni}
                onChange={(e) => cambiarDni(e.target.value)}
                onFocus={() => enfocarCampo("dni")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && mostrarLista && coincidencias.length === 1) {
                    e.preventDefault();
                    elegirEmpleado(coincidencias[0]);
                  }
                }}
                placeholder="Solo números"
                autoFocus
                aria-autocomplete="list"
                aria-expanded={mostrarLista && campoBusqueda === "dni"}
                aria-controls="coincidencias-padron"
                className="h-14 text-2xl font-semibold tracking-wide tabular md:text-2xl"
              />
              {debeBuscar && buscando && campoBusqueda === "dni" ? (
                <Spinner className="absolute top-1/2 right-4 size-5 -translate-y-1/2 text-muted-foreground" />
              ) : null}
              {mostrarLista && campoBusqueda === "dni" ? (
                <ListaCoincidencias items={coincidencias} onElegir={elegirEmpleado} />
              ) : null}
            </div>
            <EscanerDni onLeido={alLeerDni} disabled={pendiente} />
          </div>
          {empleado ? (
            <p className="flex items-center gap-1.5 text-sm font-medium text-pagado">
              <BadgeCheck className="size-4 shrink-0" strokeWidth={2.2} />
              En el padrón{empleado.cargo ? ` · ${empleado.cargo}` : ""}
            </p>
          ) : sinPadron ? (
            <p className="flex items-center gap-1.5 text-sm font-medium text-parcial">
              <CircleAlert className="size-4 shrink-0" strokeWidth={2.2} />
              {apellido.trim() && nombre.trim()
                ? "No está en el padrón de personal: el ingreso queda registrado igual, con estos datos."
                : "No está en el padrón de personal: escribí el apellido y el nombre a mano."}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Con 3 números ya aparecen las coincidencias del padrón.
            </p>
          )}
        </div>

        {/* ---------- Apellido y nombre ---------- */}
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="relative space-y-2">
            <Label htmlFor="apellido-ingreso" className="text-base">
              Apellido
            </Label>
            <Input
              id="apellido-ingreso"
              name="apellido"
              value={apellido}
              onChange={(e) => {
                setApellido(e.target.value);
                setError(null);
                if (!empleado) enfocarCampo("apellido");
              }}
              onFocus={() => {
                if (!empleado) enfocarCampo("apellido");
              }}
              placeholder="Ej.: Aguirre"
              autoCapitalize="words"
              aria-autocomplete="list"
              aria-expanded={mostrarLista && campoBusqueda === "apellido"}
              className="h-12 text-lg md:text-lg"
            />
            {mostrarLista && campoBusqueda === "apellido" ? (
              <ListaCoincidencias items={coincidencias} onElegir={elegirEmpleado} />
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="nombre-ingreso" className="text-base">
              Nombre
            </Label>
            <Input
              id="nombre-ingreso"
              name="nombre"
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value);
                setError(null);
              }}
              onFocus={() => enfocarCampo(null)}
              placeholder="Ej.: Luis"
              autoCapitalize="words"
              className="h-12 text-lg md:text-lg"
            />
          </div>
        </div>

        {/* ---------- Firma ---------- */}
        <div className="space-y-2">
          <Label className="text-base">
            Firma{" "}
            <span className="font-normal text-muted-foreground">(obligatoria)</span>
          </Label>
          <FirmaPad ref={firmaRef} onCambio={setTieneFirma} disabled={pendiente} />
        </div>

        {error ? (
          <p className="flex items-center gap-2 font-medium text-pendiente" role="alert">
            <CircleAlert className="size-5 shrink-0" strokeWidth={2} />
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            size="lg"
            disabled={pendiente || !listo}
            className="h-16 min-w-0 flex-1 basis-64 text-lg font-semibold"
          >
            {pendiente ? <Spinner className="size-6" /> : <LogIn className="size-6" strokeWidth={2} />}
            Registrar ingreso
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="h-16 px-5 text-base text-muted-foreground"
            onClick={reiniciar}
            disabled={pendiente || (!dni && !apellido && !nombre && !tieneFirma)}
          >
            <RotateCcw className="size-5" strokeWidth={2} />
            Empezar de nuevo
          </Button>
        </div>
        {!listo && !error ? (
          <p className="text-sm text-muted-foreground">
            {!dniValido
              ? "Falta el DNI completo."
              : !apellido.trim() || !nombre.trim()
                ? "Falta el apellido o el nombre."
                : !tieneFirma
                  ? "Falta la firma."
                  : null}
          </p>
        ) : null}
      </form>
    </section>
  );
}

/** Lista flotante de coincidencias del padrón, debajo del campo activo. */
function ListaCoincidencias({
  items,
  onElegir,
}: {
  items: EmpleadoBusqueda[];
  onElegir: (e: EmpleadoBusqueda) => void;
}) {
  return (
    <ul
      id="coincidencias-padron"
      role="listbox"
      className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg ring-1 ring-foreground/10"
    >
      {items.map((e) => (
        <li key={e.id} role="option" aria-selected={false}>
          <button
            type="button"
            onMouseDown={(ev) => ev.preventDefault()}
            onClick={() => onElegir(e)}
            className={cn(
              "flex min-h-14 w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
              "hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
            )}
          >
            <UserRoundSearch className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.8} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-semibold">
                {e.apellido}, {e.nombre}
              </span>
              <span className="block truncate text-sm text-muted-foreground tabular">
                DNI {e.dni}
                {e.cargo ? ` · ${e.cargo}` : ""}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
