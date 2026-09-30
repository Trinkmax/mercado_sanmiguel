"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CircleAlert,
  FolderOpen,
  HandCoins,
  Pencil,
  Plus,
  Save,
  Send,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import type { Rol } from "@/lib/auth";
import { crearCliente, editarCliente } from "@/lib/actions/clientes";
import { formatARS, formatDni, normalizarDni } from "@/lib/format";
import { categoriasDeRol, LABEL_CATEGORIA, type CategoriaCliente } from "@/lib/segmentos";
import { cn, uuidV4 } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Sello } from "@/components/shared/sello";
import {
  ConceptosAlta,
  normalizarCantidad,
  type ConceptoRecurrente,
} from "@/components/clientes/conceptos-alta";
import { CuotasMesPicker } from "@/components/clientes/cuotas-mes";
import { ICONO_CATEGORIA } from "@/components/clientes/chip-categoria";
import {
  TOAST_ENVIADO_APROBACION,
  aplicaDirectoRol,
  conceptoSigueConCategoria,
  cuotasDeCategoria,
  totalMensual,
} from "@/components/clientes/constantes";
import { llamarAccion } from "@/lib/llamar-accion";

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
  categoria: CategoriaCliente;
  es_socio: boolean;
};

/** Una línea que explica cada categoría en la tarjeta "¿Qué es?". */
const AYUDA_CATEGORIA: Record<CategoriaCliente, string> = {
  puestero: "Tiene puesto, local, galpón o contéiner",
  quintero: "Alquila la quinta: paga por mes",
  ambulante: "Vende por día: se le cobra cuando viene",
};

type Campos = {
  nombre: string;
  apodo: string;
  cuit: string;
  telefono: string;
  email: string;
  direccion: string;
  notas: string;
};

type AltaHecha = { id: string; nombre: string; codigo?: number; revisaLider: boolean };

/** Lo mensual que factura hoy (edición): para avisar qué deja de facturarse si cambia de categoría. */
export type ConceptoActivo = { codigo: string; nombre: string; segmento: string | null };

/**
 * Formulario de datos del cliente: sirve para el alta y para la edición.
 * El alta se adapta a lo que es (¿Qué es?): el ambulante lleva nombre, apodo, DNI y
 * teléfono (N° de carpeta automático); el quintero, la quinta ya marcada y sus cuotas;
 * el puestero, todo. Si el rol no es el Líder, lo que se guarda es una propuesta que
 * espera su aprobación — salvo el alta de un ambulante del Jefe, que se aplica en el
 * acto para poder cobrarle enseguida (§1.3 D-P1).
 */
export function FormCliente({
  cliente,
  codigoSugerido,
  conceptos,
  rol,
  categoriaInicial,
  cuotasQuintero = 4,
  precioAmbulante,
  conceptosActivos = [],
  lugaresTexto = null,
  medidoresActivos = [],
  alGuardar,
}: {
  cliente?: DatosCliente;
  codigoSugerido?: number;
  /** Alta: conceptos mensuales que el rol puede asignar (con precio y segmento). */
  conceptos?: ConceptoRecurrente[];
  rol: Rol;
  /** Alta: `?categoria=` preselecciona (ej.: "Nuevo ambulante" desde Cobrar). */
  categoriaInicial?: CategoriaCliente;
  /** configuracion.cuotas_default_quintero (G7). */
  cuotasQuintero?: number;
  /** Precio por día del concepto AMB, para contarlo en el alta del ambulante. */
  precioAmbulante?: number | null;
  /** Edición: lo mensual que factura hoy (qué deja de facturarse al cambiar de categoría). */
  conceptosActivos?: ConceptoActivo[];
  /** Edición: sus lugares en el plano ("Puestos 58 · 60"), que se liberan si pasa a ambulante. */
  lugaresTexto?: string | null;
  /** Edición: N° de sus medidores activos, que se desactivan si pasa a ambulante. */
  medidoresActivos?: string[];
  alGuardar?: () => void;
}) {
  const router = useRouter();
  const directo = aplicaDirectoRol(rol);
  const esAlta = !cliente;
  const categoriasRol = categoriasDeRol(rol);
  const [pendiente, startTransition] = useTransition();

  const categoriaDefault: CategoriaCliente =
    cliente?.categoria ??
    (categoriaInicial && categoriasRol.includes(categoriaInicial)
      ? categoriaInicial
      : categoriasRol.length === 1
        ? categoriasRol[0]
        : rol === "guardia"
          ? "quintero"
          : "puestero");

  const [categoria, setCategoria] = useState<CategoriaCliente>(categoriaDefault);
  const [esSocio, setEsSocio] = useState<boolean | null>(cliente ? cliente.es_socio : null);
  const [tipoPersona, setTipoPersona] = useState<"fisica" | "juridica">(
    cliente?.tipo_persona ?? "fisica"
  );
  const [campos, setCampos] = useState<Campos>({
    nombre: cliente?.nombre ?? "",
    apodo: cliente?.apodo ?? "",
    cuit: cliente?.cuit ?? "",
    telefono: cliente?.telefono ?? "",
    email: cliente?.email ?? "",
    direccion: cliente?.direccion ?? "",
    notas: cliente?.notas ?? "",
  });
  const [cuotasMes, setCuotasMes] = useState<number>(
    cliente?.cuotas_mes ?? (categoriaDefault === "quintero" ? cuotasQuintero : 1)
  );
  const [cantidades, setCantidades] = useState<Record<string, number>>(() =>
    categoriaDefault === "quintero" ? cantidadesQuintero(conceptos) : {}
  );
  // Porcentaje del precio por concepto (sin cargar = 100 %).
  const [porcentajes, setPorcentajes] = useState<Record<string, number>>({});
  const [codigoAbierto, setCodigoAbierto] = useState(false);
  const [codigo, setCodigo] = useState<string>(String(cliente?.codigo ?? codigoSugerido ?? ""));
  const [notasAbiertas, setNotasAbiertas] = useState(Boolean(cliente?.notas));
  const [errores, setErrores] = useState<{ nombre?: string; socio?: string; codigo?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [altaHecha, setAltaHecha] = useState<AltaHecha | null>(null);
  // Un id por intento de alta: si el toque se repite o se corta la red, queda UNA sola alta.
  const [ref, setRef] = useState(() => uuidV4());

  const esAmbulante = categoria === "ambulante";
  const esQuintero = categoria === "quintero";
  const mostrarCategorias = categoriasRol.length > 1;
  const conceptosVisibles = (conceptos ?? []).filter((c) =>
    esQuintero
      ? c.segmento === "quinteros"
      : c.segmento !== "quinteros" && c.segmento !== "ambulantes"
  );
  const { opciones: opcionesCuotas, permitirOtra } = cuotasDeCategoria(categoria);
  const { total: totalMes } = totalMensual(
    conceptosVisibles
      .filter((c) => (cantidades[c.id] ?? 0) > 0)
      .map((c) => ({
        cantidad: cantidades[c.id],
        precio: c.precio,
        descuentoPp: c.descuentoPp,
        porcentaje: porcentajes[c.id] ?? 100,
      }))
  );

  function cambiarCampo<K extends keyof Campos>(campo: K, valor: string) {
    setCampos((prev) => ({ ...prev, [campo]: valor }));
    if (campo === "nombre" && errores.nombre) setErrores((e) => ({ ...e, nombre: undefined }));
  }

  function elegirCategoria(nueva: CategoriaCliente) {
    if (nueva === categoria) return;
    setCategoria(nueva);
    setError(null);
    if (!esAlta) return;
    // Cada categoría arranca con lo suyo: la quinta ya marcada, o nada.
    setPorcentajes({});
    if (nueva === "quintero") {
      setCantidades(cantidadesQuintero(conceptos));
      setCuotasMes(cuotasQuintero);
    } else {
      setCantidades({});
      setCuotasMes(1);
    }
  }

  function reiniciar() {
    setAltaHecha(null);
    setRef(uuidV4());
    setCampos({ nombre: "", apodo: "", cuit: "", telefono: "", email: "", direccion: "", notas: "" });
    setEsSocio(null);
    setCodigoAbierto(false);
    setErrores({});
    setError(null);
    router.refresh();
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const faltan: typeof errores = {};
    if (!campos.nombre.trim()) faltan.nombre = "Poné el nombre";
    if (!esAmbulante && esSocio === null) faltan.socio = "Elegí si es socio de la cooperativa";
    if (codigoAbierto && !/^\d+$/.test(codigo.trim()))
      faltan.codigo = "Poné el número de carpeta, solo números";
    setErrores(faltan);
    if (Object.keys(faltan).length > 0) {
      setError("Revisá lo que está marcado en rojo.");
      return;
    }
    setError(null);

    const datos = {
      nombre: campos.nombre,
      apodo: campos.apodo,
      cuit: esAmbulante ? normalizarDni(campos.cuit) : campos.cuit,
      telefono: campos.telefono,
      ...(esAmbulante
        ? {}
        : { email: campos.email, direccion: campos.direccion, tipo_persona: tipoPersona }),
      notas: campos.notas,
      categoria,
      es_socio: esAmbulante ? false : Boolean(esSocio),
    };

    startTransition(async () => {
      if (cliente) {
        const res = await llamarAccion(() => editarCliente({
          id: cliente.id,
          ...datos,
          ...(codigoAbierto ? { codigo: codigo.trim() } : {}),
        }));
        if (!res.ok) return mostrarError(res.error);
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

      // Alta: solo van los conceptos con cantidad mayor a 0 (el ambulante no tiene).
      const conceptosElegidos = esAmbulante
        ? []
        : conceptosVisibles
            .map((c) => ({
              concepto_id: c.id,
              cantidad: normalizarCantidad(cantidades[c.id] ?? 0),
              porcentaje: porcentajes[c.id] ?? 100,
            }))
            .filter((c) => c.cantidad > 0);

      const res = await llamarAccion(() => crearCliente({
        ...datos,
        ...(esAmbulante ? {} : { cuotas_mes: cuotasMes }),
        ...(codigoAbierto ? { codigo: codigo.trim() } : {}),
        conceptos: conceptosElegidos,
        ref,
      }));
      if (!res.ok) return mostrarError(res.error);
      if (res.data.repetido) toast.info("Esa alta ya estaba cargada: no se duplicó.");

      const nombre = campos.nombre.trim();
      if (res.data.estado === "aplicado" && res.data.id) {
        if (esAmbulante) {
          // D-P1: ya existe y se le puede cobrar. Pantalla de éxito con un solo camino.
          const revisaLider = !directo;
          setAltaHecha({ id: res.data.id, nombre, codigo: res.data.codigo, revisaLider });
          toast.success(
            revisaLider
              ? "Listo: ya le podés cobrar. El Líder lo va a revisar."
              : "Listo: ya le podés cobrar.",
            {
              action: {
                label: "Cobrarle ahora",
                onClick: () => router.push(`/cobranza/${res.data.id}`),
              },
            }
          );
          return;
        }
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
        description: `${nombre}${res.data.codigo ? ` (N° ${res.data.codigo})` : ""} va a aparecer en la lista cuando el Líder de Procesos apruebe el alta.`,
        duration: 7000,
      });
      router.push("/clientes");
    });
  }

  function mostrarError(mensaje: string) {
    // Si el problema es el N° de carpeta, abrimos el campo y proponemos el que sigue.
    const sugerido = /usá el (\d+)/.exec(mensaje);
    if (/n[úu]mero de carpeta/i.test(mensaje)) {
      setCodigoAbierto(true);
      if (sugerido) setCodigo(sugerido[1]);
      setErrores((e) => ({ ...e, codigo: mensaje }));
    }
    setError(mensaje);
    toast.error(mensaje);
  }

  if (altaHecha) {
    return (
      <div className="space-y-6 rounded-lg border bg-card p-6 text-center sm:p-8">
        <Sello estado="activo" texto="Dado de alta" grande />
        <div className="space-y-1">
          <p className="font-display text-2xl font-bold tracking-tight">{altaHecha.nombre}</p>
          <p className="text-base text-muted-foreground">
            Ambulante{altaHecha.codigo ? ` · N° de carpeta ${altaHecha.codigo}` : ""}
          </p>
        </div>
        <p className="text-base">
          Ya le podés cobrar.
          {altaHecha.revisaLider ? " El Líder de Procesos lo va a revisar después." : ""}
        </p>
        <div className="mx-auto flex max-w-sm flex-col gap-3">
          <Button asChild size="lg" className="h-14 text-lg font-semibold">
            <Link href={`/cobranza/${altaHecha.id}`}>
              <HandCoins className="size-6" />
              Cobrarle ahora
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-12 text-base">
            <Link href={`/clientes/${altaHecha.id}`}>
              <FolderOpen className="size-5" />
              Ver su carpeta
            </Link>
          </Button>
          <Button variant="ghost" size="lg" className="h-12 text-base" onClick={reiniciar}>
            <Plus className="size-5" />
            Dar de alta otro ambulante
          </Button>
        </div>
      </div>
    );
  }

  const textoBoton = directo
    ? cliente
      ? "Guardar cambios"
      : `Dar de alta ${articulo(categoria)}`
    : esAlta && esAmbulante && rol === "guardia"
      ? "Dar de alta al ambulante"
      : "Enviar a aprobación";
  const seAplicaYa = directo || (esAlta && esAmbulante && rol === "guardia");

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {mostrarCategorias ? (
        <fieldset className="space-y-2" data-tour="clientes-alta-que-es">
          <legend className="mb-2 text-base font-medium">¿Qué es?</legend>
          <div
            role="radiogroup"
            aria-label="¿Qué es?"
            className={cn(
              "grid gap-2",
              categoriasRol.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"
            )}
          >
            {categoriasRol.map((c) => {
              const Icono = ICONO_CATEGORIA[c];
              const activo = categoria === c;
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  onClick={() => elegirCategoria(c)}
                  className={cn(
                    "flex min-h-16 items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-colors",
                    activo
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border bg-card hover:bg-accent/50"
                  )}
                >
                  <Icono
                    className={cn("size-7 shrink-0", activo ? "text-primary" : "text-muted-foreground")}
                    strokeWidth={1.9}
                  />
                  <span className="min-w-0">
                    <span className="block text-base font-semibold">{LABEL_CATEGORIA[c]}</span>
                    <span className="block text-sm leading-snug text-muted-foreground">
                      {AYUDA_CATEGORIA[c]}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {!esAlta && categoria !== cliente?.categoria ? (
            <AvisoCambioCategoria
              categoria={categoria}
              dejaDe={conceptosActivos.filter((c) => !conceptoSigueConCategoria(c.segmento, categoria))}
              lugaresTexto={categoria === "ambulante" ? lugaresTexto : null}
              medidores={categoria === "ambulante" ? medidoresActivos : []}
              directo={directo}
            />
          ) : null}
        </fieldset>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="nombre" className="text-base">
          {tipoPersona === "juridica" && !esAmbulante ? "Razón social" : "Nombre y apellido"}
        </Label>
        <Input
          id="nombre"
          value={campos.nombre}
          onChange={(e) => cambiarCampo("nombre", e.target.value)}
          placeholder={esAmbulante ? "Ej.: Juan Pérez" : "Ej.: Verdulería Juárez e Hijos"}
          className="h-12 text-base"
          autoComplete="off"
          aria-invalid={errores.nombre ? true : undefined}
          maxLength={200}
        />
        {errores.nombre ? <ErrorCampo texto={errores.nombre} /> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="apodo" className="text-base">
          Apodo{" "}
          <span className="font-normal text-muted-foreground">(cómo le dicen, si tiene)</span>
        </Label>
        <Input
          id="apodo"
          value={campos.apodo}
          onChange={(e) => cambiarCampo("apodo", e.target.value)}
          placeholder="Ej.: El Tano"
          className="h-12 text-base"
          autoComplete="off"
          maxLength={80}
        />
      </div>

      {!esAmbulante ? (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-base font-medium">¿Es socio de la cooperativa?</legend>
          <div role="radiogroup" aria-label="¿Es socio de la cooperativa?" className="flex gap-2">
            {[
              { valor: true, label: "Sí, es socio" },
              { valor: false, label: "No" },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                role="radio"
                aria-checked={esSocio === o.valor}
                onClick={() => {
                  setEsSocio(o.valor);
                  setErrores((e) => ({ ...e, socio: undefined }));
                }}
                className={cn(
                  "h-12 min-w-28 flex-1 rounded-lg border-2 px-4 text-base font-semibold transition-colors sm:flex-none",
                  esSocio === o.valor
                    ? "border-primary bg-primary text-primary-foreground"
                    : errores.socio
                      ? "border-pendiente/50 bg-card hover:bg-accent"
                      : "border-border bg-card hover:bg-accent"
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          {errores.socio ? <ErrorCampo texto={errores.socio} /> : null}
        </fieldset>
      ) : null}

      {esAmbulante ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cuit" className="text-base">
              DNI <span className="font-normal text-muted-foreground">(si lo tiene a mano)</span>
            </Label>
            <Input
              id="cuit"
              inputMode="numeric"
              value={campos.cuit}
              onChange={(e) => cambiarCampo("cuit", e.target.value.replace(/[^\d.]/g, "").slice(0, 10))}
              placeholder="Ej.: 30.111.222"
              className="h-12 text-base tabular"
              autoComplete="off"
            />
            {normalizarDni(campos.cuit).length >= 7 ? (
              <p className="text-sm text-muted-foreground">DNI {formatDni(campos.cuit)}</p>
            ) : null}
          </div>
          <CampoTelefono valor={campos.telefono} onCambiar={(v) => cambiarCampo("telefono", v)} />
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <p className="text-base font-medium">¿Es una persona o una empresa?</p>
            <div className="flex gap-2">
              {(
                [
                  { valor: "fisica", label: "Persona" },
                  { valor: "juridica", label: "Empresa" },
                ] as const
              ).map((o) => (
                <button
                  key={o.valor}
                  type="button"
                  aria-pressed={tipoPersona === o.valor}
                  onClick={() => setTipoPersona(o.valor)}
                  className={cn(
                    "h-12 min-w-28 flex-1 rounded-lg border px-4 text-base font-medium transition-colors sm:flex-none",
                    tipoPersona === o.valor
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:bg-accent"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cuit" className="text-base">
                {tipoPersona === "juridica" ? "CUIT" : "DNI o CUIT"}
              </Label>
              <Input
                id="cuit"
                value={campos.cuit}
                onChange={(e) => cambiarCampo("cuit", e.target.value)}
                placeholder="Ej.: 20-12345678-3"
                className="h-12 text-base tabular"
                autoComplete="off"
                maxLength={20}
              />
            </div>
            <CampoTelefono valor={campos.telefono} onCambiar={(v) => cambiarCampo("telefono", v)} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-base">
                Email <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                value={campos.email}
                onChange={(e) => cambiarCampo("email", e.target.value)}
                placeholder="Ej.: nombre@correo.com"
                className="h-12 text-base"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="direccion" className="text-base">
                Dirección <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="direccion"
                value={campos.direccion}
                onChange={(e) => cambiarCampo("direccion", e.target.value)}
                placeholder="Ej.: San Martín 1234, Carlos Paz"
                className="h-12 text-base"
                autoComplete="off"
              />
            </div>
          </div>
        </>
      )}

      {esAlta && esAmbulante ? (
        <div className="rounded-lg bg-muted/50 px-4 py-3 text-base">
          <p className="font-medium">
            Se le cobra por día cuando viene
            {precioAmbulante ? `: ${formatARS(precioAmbulante)} por día` : ""}.
          </p>
          <p className="text-sm text-muted-foreground">
            No tiene acceso al portal ni paga en cuotas.
          </p>
        </div>
      ) : null}

      {esAlta && !esAmbulante && conceptosVisibles.length > 0 ? (
        <ConceptosAlta
          conceptos={conceptosVisibles}
          cantidades={cantidades}
          onCambiar={(conceptoId, cantidad) =>
            setCantidades((prev) => ({ ...prev, [conceptoId]: cantidad }))
          }
          porcentajes={porcentajes}
          onCambiarPorcentaje={(conceptoId, porcentaje) =>
            setPorcentajes((prev) => ({ ...prev, [conceptoId]: porcentaje }))
          }
        />
      ) : null}

      {esAlta && !esAmbulante ? (
        <div className="space-y-2">
          <p className="text-base font-medium">
            {esQuintero ? "¿En cuántos pagos cobra la quinta?" : "Paga el mes en"}
          </p>
          <CuotasMesPicker
            key={categoria}
            valor={cuotasMes}
            onCambiar={setCuotasMes}
            idPrefix="cuotas-alta"
            opciones={opcionesCuotas}
            permitirOtra={permitirOtra}
            totalMes={totalMes}
          />
        </div>
      ) : null}

      <div className="space-y-2">
        {codigoAbierto ? (
          <>
            <Label htmlFor="codigo" className="text-base">
              N° de carpeta
            </Label>
            <Input
              id="codigo"
              inputMode="numeric"
              pattern="[0-9]*"
              value={codigo}
              onChange={(e) => {
                setCodigo(e.target.value.replace(/[^\d]/g, "").slice(0, 9));
                setErrores((er) => ({ ...er, codigo: undefined }));
              }}
              className="h-12 w-40 text-base tabular"
              autoComplete="off"
              aria-invalid={errores.codigo ? true : undefined}
            />
            {errores.codigo ? <ErrorCampo texto={errores.codigo} /> : null}
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-base">
              <span className="text-muted-foreground">N° de carpeta:</span>{" "}
              <span className="font-semibold tabular">
                {String(cliente?.codigo ?? codigoSugerido ?? "") || "—"}
              </span>
              {esAlta ? (
                <span className="text-sm text-muted-foreground"> (el que sigue)</span>
              ) : null}
            </p>
            <Button
              type="button"
              variant="ghost"
              className="h-11 px-3 text-sm text-primary"
              onClick={() => {
                setCodigo(String(cliente?.codigo ?? codigoSugerido ?? ""));
                setCodigoAbierto(true);
              }}
            >
              <Pencil className="size-4" />
              Cambiar
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {notasAbiertas ? (
          <>
            <Label htmlFor="notas" className="text-base">
              Notas
            </Label>
            <Textarea
              id="notas"
              rows={3}
              value={campos.notas}
              onChange={(e) => cambiarCampo("notas", e.target.value)}
              placeholder="Lo que haga falta recordar de este cliente"
              className="text-base"
              maxLength={2000}
            />
          </>
        ) : (
          <Button
            type="button"
            variant="ghost"
            className="h-11 px-3 text-sm text-primary"
            onClick={() => setNotasAbiertas(true)}
          >
            <Plus className="size-4" />
            Agregar una nota
          </Button>
        )}
      </div>

      {error ? (
        <p className="flex items-center gap-2 font-medium text-pendiente" role="alert">
          <CircleAlert className="size-5 shrink-0" strokeWidth={2} />
          {error}
        </p>
      ) : null}

      <div className="space-y-2" data-tour="clientes-alta-enviar">
        <Button
          type="submit"
          size="lg"
          disabled={pendiente}
          className="h-13 w-full text-base font-semibold"
        >
          {pendiente ? (
            <Spinner className="size-5" />
          ) : !seAplicaYa ? (
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
            {seAplicaYa
              ? "Queda cargado en el acto para cobrarle; el Líder de Procesos lo revisa después."
              : cliente
                ? "Los cambios los revisa y aprueba el Líder de Procesos antes de aplicarse."
                : "El alta la revisa y aprueba el Líder de Procesos; hasta entonces no aparece en la lista."}
          </p>
        ) : null}
      </div>
    </form>
  );
}

/** EXPQ × 1 preseleccionado para el quintero (G5: la quinta entera por mes). */
function cantidadesQuintero(conceptos: ConceptoRecurrente[] | undefined): Record<string, number> {
  const quinta = (conceptos ?? []).find((c) => c.codigo === "EXPQ") ??
    (conceptos ?? []).find((c) => c.segmento === "quinteros");
  return quinta ? { [quinta.id]: 1 } : {};
}

function articulo(categoria: CategoriaCliente): string {
  return categoria === "puestero"
    ? "al puestero"
    : categoria === "quintero"
      ? "al quintero"
      : "al ambulante";
}

/**
 * Qué pasa al cambiar de categoría (lo aplica private.aplicar_cambio, 0024): lo mensual que
 * la categoría nueva no tiene deja de facturarse y, si pasa a ambulante, se liberan sus
 * lugares del plano y se desactivan sus medidores (abono y consumo de luz). Se dice ANTES
 * de guardar, con los códigos, para que no sorprenda.
 */
function AvisoCambioCategoria({
  categoria,
  dejaDe,
  lugaresTexto,
  medidores,
  directo,
}: {
  categoria: CategoriaCliente;
  dejaDe: ConceptoActivo[];
  lugaresTexto: string | null;
  medidores: string[];
  directo: boolean;
}) {
  const cuando = directo ? "Al guardar" : "Cuando el Líder lo apruebe";
  return (
    <div
      role="status"
      className="flex items-start gap-2.5 rounded-lg border border-parcial/40 bg-parcial-suave px-3.5 py-3 text-sm"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-parcial" strokeWidth={2} />
      <div className="min-w-0 space-y-1">
        <p className="font-medium">
          {categoria === "ambulante"
            ? "Como ambulante se le cobra por día: no paga por mes, ni en cuotas, y no es socio."
            : `Pasa a ser ${LABEL_CATEGORIA[categoria].toLowerCase()}.`}
        </p>
        {dejaDe.length > 0 ? (
          <p className="break-words">
            {cuando} deja de facturarse: {dejaDe.map((c) => `${c.codigo} (${c.nombre})`).join(", ")}.
          </p>
        ) : null}
        {lugaresTexto ? <p className="break-words">También se libera en el plano: {lugaresTexto}.</p> : null}
        {medidores.length > 0 ? (
          <p className="break-words">
            {medidores.length === 1
              ? `Se desactiva su medidor N° ${medidores[0]}: deja de pagar el abono y la luz que consuma.`
              : `Se desactivan sus medidores N° ${medidores.join(", ")}: deja de pagar el abono y la luz que consuma.`}
          </p>
        ) : null}
        {categoria !== "ambulante" ? (
          <p className="text-muted-foreground">Lo que tenga que pagar como {LABEL_CATEGORIA[categoria].toLowerCase()} se agrega desde “Qué paga”.</p>
        ) : null}
      </div>
    </div>
  );
}

function ErrorCampo({ texto }: { texto: string }) {
  return (
    <p className="flex items-center gap-1.5 text-sm font-medium text-pendiente">
      <CircleAlert className="size-4 shrink-0" strokeWidth={2} />
      {texto}
    </p>
  );
}

function CampoTelefono({ valor, onCambiar }: { valor: string; onCambiar: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label htmlFor="telefono" className="text-base">
        Teléfono <span className="font-normal text-muted-foreground">(opcional)</span>
      </Label>
      <Input
        id="telefono"
        type="tel"
        inputMode="tel"
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        placeholder="Ej.: 3541 123456"
        className="h-12 text-base"
        autoComplete="off"
        maxLength={40}
      />
    </div>
  );
}
