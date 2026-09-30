"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Camera,
  Check,
  ClipboardList,
  FileText,
  Pencil,
  Search,
  Send,
  UserPlus,
  X,
} from "lucide-react";
import { cargarNovedad, editarNovedad } from "@/lib/actions/novedades";
import { cn, uuidV4 } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Sello } from "@/components/shared/sello";
import {
  LABEL_SECTOR,
  SECTORES_PERSONAL,
  nombreCompleto,
  type SectorPersonal,
} from "@/components/personal/constantes";
import {
  CHIPS_HORAS,
  CHIPS_MINUTOS,
  DEF_TIPO,
  MOTIVOS_LICENCIA,
  TIPOS_NOVEDAD,
  diasCorridos,
  fraseNovedad,
  hrefNovedades,
  horasAMinutos,
  minutosAHoras,
  nombrePila,
  nombresJuntos,
  selloNovedad,
  sumarDias,
  textoHoras,
  type EstadoNovedad,
  type TipoNovedad,
} from "./constantes";
import { llamarAccion } from "@/lib/llamar-accion";
import { AlertaError } from "@/components/cobranza/alerta-error";
import { ACCEPT_ADJUNTO } from "@/components/solicitudes/constantes";
import {
  AYUDA_PESO_ADJUNTO,
  errorPesoAdjunto,
  explicarFalloEnvio,
  prepararAdjuntos,
} from "@/components/comunicaciones/adjuntos";

export type EmpleadoElegible = {
  id: string;
  nombre: string;
  apellido: string;
  sector: SectorPersonal;
  cargo: string | null;
};

export type NovedadEditable = {
  id: string;
  empleado: EmpleadoElegible;
  tipo: TipoNovedad;
  fecha_desde: string;
  fecha_hasta: string | null;
  horas: number | null;
  justificada: boolean | null;
  detalle: string | null;
  tieneAdjunto: boolean;
  adjuntoUrl: string | null;
};

function normalizar(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** "1,5" → 1.5; vacío o inválido → null. */
function leerNumero(v: string): number | null {
  const n = Number(v.replace(",", ".").trim());
  return v.trim() && Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Cargar (o corregir) una novedad en una sola pantalla que se va abriendo:
 * ¿A quién? → ¿Qué pasó? → ¿Cuándo? / cuánto → frase de confirmación → guardar.
 * El Jefe de Portería la envía a Administración; Administración y el Líder la dejan aprobada.
 */
export function FormNovedad({
  rol,
  empleados,
  hoy,
  inicialEmpleadoIds = [],
  inicialTipo,
  editar,
}: {
  rol: "admin" | "guardia" | "lider";
  empleados: EmpleadoElegible[];
  hoy: string;
  inicialEmpleadoIds?: string[];
  inicialTipo?: TipoNovedad;
  editar?: NovedadEditable;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const archivoRef = useRef<HTMLInputElement>(null);
  const ayer = sumarDias(hoy, -1);

  const inicialTipoFinal = editar?.tipo ?? inicialTipo ?? null;
  const [elegidos, setElegidos] = useState<string[]>(editar ? [editar.empleado.id] : inicialEmpleadoIds);
  const [listaAbierta, setListaAbierta] = useState(!editar && inicialEmpleadoIds.length === 0);
  const [busqueda, setBusqueda] = useState("");
  const [tipo, setTipo] = useState<TipoNovedad | null>(inicialTipoFinal);
  const [fecha, setFecha] = useState<string>(editar?.fecha_desde ?? hoy);
  const [otroDia, setOtroDia] = useState<boolean>(Boolean(editar && editar.fecha_desde !== hoy && editar.fecha_desde !== ayer));
  const [hasta, setHasta] = useState<string>(editar?.fecha_hasta ?? "");
  const [minutos, setMinutos] = useState<number | null>(
    editar?.tipo === "llegada_tarde" && editar.horas ? horasAMinutos(editar.horas) : null
  );
  const [minutosOtro, setMinutosOtro] = useState<string>(
    editar?.tipo === "llegada_tarde" && editar.horas && !CHIPS_MINUTOS.includes(horasAMinutos(editar.horas))
      ? String(horasAMinutos(editar.horas))
      : ""
  );
  const [horas, setHoras] = useState<number | null>(
    editar && editar.tipo !== "llegada_tarde" ? editar.horas : null
  );
  const [horasOtro, setHorasOtro] = useState<string>(
    editar && editar.tipo !== "llegada_tarde" && editar.horas && !CHIPS_HORAS.includes(editar.horas)
      ? String(editar.horas).replace(".", ",")
      : ""
  );
  const [justificada, setJustificada] = useState<boolean | null>(editar?.justificada ?? null);
  const [detalle, setDetalle] = useState<string>(editar?.detalle ?? "");
  const [archivo, setArchivo] = useState<string | null>(null);
  const [quitarAdjunto, setQuitarAdjunto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<{ estado: EstadoNovedad; frase: string; cantidad: number } | null>(null);
  // Clave de idempotencia de la carga: la misma mientras no cambien los datos y hasta que se
  // guarde (un corte de red no la renueva: el reintento devuelve lo ya guardado en vez de
  // duplicarlo). Si cambian los empleados, el tipo o las fechas, es otra carga: otra clave.
  const loteRef = useRef<{ lote: string; firma: string } | null>(null);

  const porId = useMemo(() => new Map(empleados.map((e) => [e.id, e])), [empleados]);
  const elegidosEmp = elegidos.map((id) => porId.get(id)).filter((e): e is EmpleadoElegible => Boolean(e));
  const def = tipo ? DEF_TIPO[tipo] : null;
  const esJefe = rol === "guardia";

  const visibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    const lista = q
      ? empleados.filter(
          (e) =>
            normalizar(`${e.nombre} ${e.apellido}`).includes(q) ||
            normalizar(`${e.apellido} ${e.nombre}`).includes(q) ||
            (e.cargo ? normalizar(e.cargo).includes(q) : false)
        )
      : empleados;
    return SECTORES_PERSONAL.map((s) => ({ sector: s, empleados: lista.filter((e) => e.sector === s) })).filter(
      (g) => g.empleados.length > 0
    );
  }, [busqueda, empleados]);
  const variosSectores = new Set(empleados.map((e) => e.sector)).size > 1;

  // Valor final de las horas (en horas) según el tipo.
  const minutosFinal = minutosOtro ? leerNumero(minutosOtro) : minutos;
  const horasFinal: number | null = !def
    ? null
    : def.horas === "minutos"
      ? minutosFinal
        ? minutosAHoras(minutosFinal)
        : null
      : def.horas === "no"
        ? null
        : horasOtro
          ? leerNumero(horasOtro)
          : horas;
  const hastaFinal = def?.fechas === "rango" && hasta && hasta !== fecha ? hasta : null;
  const conAdjunto = Boolean(archivo) || (Boolean(editar?.tieneAdjunto) && !quitarAdjunto);

  const frase =
    def && elegidosEmp.length > 0
      ? fraseNovedad(
          {
            tipo: def.valor,
            fecha_desde: fecha,
            fecha_hasta: hastaFinal,
            horas: horasFinal,
            justificada: def.justificada ? justificada : null,
            detalle: detalle.trim() || null,
            conAdjunto,
          },
          nombresJuntos(elegidosEmp.map(nombrePila)),
          elegidosEmp.length > 1
        )
      : null;

  function alternar(id: string) {
    setError(null);
    if (editar) return;
    setElegidos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function elegirTipo(t: TipoNovedad) {
    setError(null);
    setTipo(t);
    if (elegidos.length > 0) setListaAbierta(false);
    const d = DEF_TIPO[t];
    if (!d.futuro && fecha > hoy) setFecha(hoy);
    if (d.fechas !== "rango") setHasta("");
  }

  /** Lo que falta, en el orden en que se lee la pantalla. */
  function faltante(): string | null {
    if (elegidosEmp.length === 0) return "Elegí a quién le pasó";
    if (!def) return "Elegí qué pasó";
    if (!fecha) return def.fechas === "rango" ? "Elegí desde cuándo" : "Elegí la fecha";
    if (!def.futuro && fecha > hoy) return "Esa novedad no puede tener fecha futura";
    if (def.fechas === "rango" && hasta && hasta < fecha) return "La fecha de fin no puede ser antes del inicio";
    if (def.horas === "minutos" && !horasFinal) return "Elegí cuántos minutos llegó tarde";
    if (def.horas === "horas" && !horasFinal) return "Elegí cuántas horas extra hizo";
    if (horasFinal !== null && horasFinal > 24) return "No pueden ser más de 24 horas en un día";
    if (def.justificada && justificada === null) return "Elegí si está justificada";
    if (def.detalleObligatorio && !detalle.trim()) return "Contá qué pasó";
    return null;
  }

  function quitarArchivo() {
    if (archivoRef.current) archivoRef.current.value = "";
    setArchivo(null);
  }

  function reiniciar(mismosEmpleados: boolean) {
    setHecho(null);
    loteRef.current = null;
    setTipo(null);
    setFecha(hoy);
    setOtroDia(false);
    setHasta("");
    setMinutos(null);
    setMinutosOtro("");
    setHoras(null);
    setHorasOtro("");
    setJustificada(null);
    setDetalle("");
    setArchivo(null);
    setError(null);
    if (archivoRef.current) archivoRef.current.value = "";
    if (!mismosEmpleados) {
      setElegidos([]);
      setBusqueda("");
      setListaAbierta(true);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente) return;
    const falta = faltante();
    if (falta) {
      setError(falta);
      return;
    }
    if (!def) return;
    const fd = new FormData();
    for (const id of elegidos) fd.append("empleadoId", id);
    fd.set("tipo", def.valor);
    fd.set("fechaDesde", fecha);
    if (hastaFinal) fd.set("fechaHasta", hastaFinal);
    if (horasFinal !== null) fd.set("horas", String(horasFinal));
    if (def.justificada && justificada !== null) fd.set("justificada", justificada ? "si" : "no");
    if (detalle.trim()) fd.set("detalle", detalle.trim());
    const file = archivoRef.current?.files?.[0];
    if (file) fd.set("adjunto", file, file.name);
    if (editar) {
      fd.set("id", editar.id);
      if (quitarAdjunto && !file) fd.set("quitarAdjunto", "true");
    } else {
      // El adjunto también entra en la firma: si después de un corte agregan la foto del
      // certificado, es otra carga y no se devuelve la de antes (que quedó sin foto).
      const firma = JSON.stringify([
        [...elegidos].sort(),
        def.valor,
        fecha,
        hastaFinal,
        horasFinal,
        justificada,
        detalle.trim(),
        file ? `${file.name}:${file.size}` : "",
      ]);
      if (loteRef.current?.firma !== firma) loteRef.current = { lote: uuidV4(), firma };
      fd.set("lote", loteRef.current.lote);
    }
    const fraseFinal = frase ?? "";
    setError(null);

    startTransition(async () => {
      // La foto del certificado se achica antes de subir (una de la tablet pesa 3–8 MB).
      const errorPeso = await prepararAdjuntos(fd, ["adjunto"]);
      if (errorPeso) {
        setError(errorPeso);
        return;
      }
      if (editar) {
        const res = await llamarAccion(() => editarNovedad(fd));
        if (!res.ok) {
          setError(explicarFalloEnvio(res.error, fd, ["adjunto"]));
          return;
        }
        toast.success("Novedad corregida");
        router.push(hrefNovedades({ periodo: `${fecha.slice(0, 7)}-01` }));
        router.refresh();
        return;
      }
      const res = await llamarAccion(() => cargarNovedad(fd));
      if (!res.ok) {
        // Lo cargado queda en pantalla y el lote se conserva para el reintento.
        setError(explicarFalloEnvio(res.error, fd, ["adjunto"]));
        return;
      }
      setError(null);
      loteRef.current = null;
      toast.success(
        res.data.repetido
          ? "Ya se había guardado: no se cargó dos veces"
          : res.data.estado === "pendiente"
          ? res.data.cantidad > 1
            ? `Enviadas a Administración para aprobar (${res.data.cantidad})`
            : "Enviada a Administración para aprobar"
          : res.data.cantidad > 1
            ? `Guardamos ${res.data.cantidad} novedades`
            : "Novedad guardada"
      );
      setHecho({ estado: res.data.estado, frase: fraseFinal, cantidad: res.data.cantidad });
      window.scrollTo({ top: 0, behavior: "smooth" });
      router.refresh();
    });
  }

  // ---------------------------------------------------------------- éxito
  if (hecho) {
    const uno = elegidosEmp.length === 1 ? elegidosEmp[0] : null;
    return (
      <div className="etiqueta">
        <div className="etiqueta-interior flex flex-col items-center gap-5 py-10 text-center">
          <Sello
            grande
            estado={selloNovedad(hecho.estado)}
            texto={hecho.estado === "pendiente" ? "Enviada" : "Guardada"}
            className="animar-estampado"
          />
          <div className="max-w-lg space-y-2">
            <p className="font-display text-2xl font-bold tracking-tight">
              {hecho.estado === "pendiente" ? "Le llegó a Administración para aprobar" : "Novedad guardada"}
            </p>
            <p className="text-[15px] text-muted-foreground">{hecho.frase}</p>
            {hecho.estado === "pendiente" ? (
              <p className="text-sm text-muted-foreground">
                Cuando la aprueben cuenta en la planilla. Si la rechazan, te avisamos acá en Novedades con el motivo.
              </p>
            ) : null}
          </div>
          <div className="flex w-full max-w-sm flex-col gap-2">
            <Button
              size="lg"
              className="h-auto min-h-12 py-2 text-base font-semibold whitespace-normal"
              onClick={() => reiniciar(true)}
            >
              <ClipboardList className="size-5" strokeWidth={2} />
              <span className="min-w-0 break-words">
                {uno ? `Cargar otra para ${uno.nombre}` : "Cargar otra para los mismos"}
              </span>
            </Button>
            <Button variant="outline" className="h-12 text-base" onClick={() => reiniciar(false)}>
              <UserPlus className="size-5" strokeWidth={2} />
              Otro empleado
            </Button>
            <Button asChild variant="ghost" className="h-12 text-base">
              <Link href={hrefNovedades({ periodo: `${fecha.slice(0, 7)}-01` })}>Ver la planilla</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- formulario
  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate>
      {/* ¿A quién? */}
      <section className="space-y-3" aria-labelledby="nov-quien">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="nov-quien" className="font-display text-lg font-bold tracking-tight">
            ¿A quién?
          </h2>
          {!editar && listaAbierta ? (
            <p className="text-sm text-muted-foreground">Podés elegir varios (por ejemplo, un feriado que trabajaron todos)</p>
          ) : null}
        </div>

        {elegidosEmp.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {elegidosEmp.map((e) => (
              <span
                key={e.id}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary/40 bg-accent px-4 text-sm font-semibold text-accent-foreground"
              >
                {nombrePila(e)}
                {!editar ? (
                  <button
                    type="button"
                    onClick={() => alternar(e.id)}
                    className="-mr-2 flex size-8 items-center justify-center rounded-full hover:bg-card"
                    aria-label={`Sacar a ${nombrePila(e)}`}
                  >
                    <X className="size-4" strokeWidth={2.2} />
                  </button>
                ) : null}
              </span>
            ))}
            {!editar && !listaAbierta ? (
              <Button type="button" variant="ghost" className="h-11" onClick={() => setListaAbierta(true)}>
                <UserPlus className="size-4" strokeWidth={2} />
                Agregar o cambiar
              </Button>
            ) : null}
          </div>
        ) : null}

        {!editar && listaAbierta ? (
          empleados.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              No hay empleados activos en tu sector. Pedile al Líder de Procesos que los cargue en Personal.
            </p>
          ) : (
            <div className="space-y-3">
              {empleados.length > 6 ? (
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
                    strokeWidth={2}
                  />
                  <Input
                    type="search"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscá por nombre, apellido o cargo"
                    aria-label="Buscar empleado"
                    className="h-12 pl-11 text-base md:text-base"
                    autoComplete="off"
                  />
                </div>
              ) : null}
              {visibles.length === 0 ? (
                <p className="px-1 text-sm text-muted-foreground">No encontramos a nadie con ese nombre.</p>
              ) : (
                visibles.map((g) => (
                  <div key={g.sector} className="space-y-2">
                    {variosSectores ? (
                      <p className="px-1 text-sm font-semibold text-muted-foreground">{LABEL_SECTOR[g.sector]}</p>
                    ) : null}
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {g.empleados.map((e) => {
                        const activo = elegidos.includes(e.id);
                        return (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => alternar(e.id)}
                            aria-pressed={activo}
                            className={cn(
                              "flex min-h-14 items-center gap-3 rounded-lg border px-4 py-2 text-left transition-colors",
                              activo
                                ? "border-primary bg-accent text-accent-foreground ring-2 ring-primary/20"
                                : "border-border bg-card hover:bg-accent/60"
                            )}
                          >
                            <span
                              className={cn(
                                "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                                activo ? "border-primary bg-primary text-primary-foreground" : "border-border"
                              )}
                            >
                              {activo ? <Check className="size-4" strokeWidth={3} /> : null}
                            </span>
                            <span className="min-w-0">
                              <span className="block leading-snug font-semibold break-words">{nombreCompleto(e)}</span>
                              {e.cargo ? (
                                <span className="block text-sm break-words text-muted-foreground">{e.cargo}</span>
                              ) : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
              {elegidos.length > 0 && tipo ? (
                <Button type="button" variant="outline" className="h-11" onClick={() => setListaAbierta(false)}>
                  Listo, seguir
                </Button>
              ) : null}
            </div>
          )
        ) : null}
      </section>

      {/* ¿Qué pasó? */}
      {elegidosEmp.length > 0 ? (
        <section className="space-y-3" aria-labelledby="nov-que">
          <h2 id="nov-que" className="font-display text-lg font-bold tracking-tight">
            ¿Qué pasó?
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" role="radiogroup" aria-labelledby="nov-que">
            {TIPOS_NOVEDAD.map((t) => {
              const activo = tipo === t.valor;
              const Icono = t.icono;
              return (
                <button
                  key={t.valor}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  onClick={() => elegirTipo(t.valor)}
                  className={cn(
                    "flex min-h-16 items-center gap-3 rounded-lg border px-4 py-2 text-left transition-colors",
                    activo
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:bg-accent/60"
                  )}
                >
                  <Icono className="size-6 shrink-0" strokeWidth={2} aria-hidden />
                  <span className="min-w-0">
                    <span className="block font-semibold leading-tight">{t.label}</span>
                    {t.ayuda ? (
                      <span className={cn("block text-xs", activo ? "text-primary-foreground/85" : "text-muted-foreground")}>
                        {t.ayuda}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Datos según el tipo */}
      {def && elegidosEmp.length > 0 ? (
        <section className="space-y-6 rounded-xl border bg-card p-4 sm:p-6" aria-label="Detalle de la novedad">
          {def.fechas === "dia" ? (
            <div className="space-y-2">
              <Label className="text-base">¿Qué día?</Label>
              <div className="flex flex-wrap gap-2">
                <ChipOpcion activo={!otroDia && fecha === hoy} onClick={() => { setOtroDia(false); setFecha(hoy); }}>
                  Hoy
                </ChipOpcion>
                <ChipOpcion activo={!otroDia && fecha === ayer} onClick={() => { setOtroDia(false); setFecha(ayer); }}>
                  Ayer
                </ChipOpcion>
                <ChipOpcion activo={otroDia} onClick={() => setOtroDia(true)}>
                  Otro día
                </ChipOpcion>
              </div>
              {otroDia ? (
                <Input
                  type="date"
                  value={fecha}
                  max={def.futuro ? undefined : hoy}
                  onChange={(e) => setFecha(e.target.value)}
                  aria-label="Fecha"
                  className="h-12 max-w-xs text-base md:text-base"
                />
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-base font-medium">¿Desde y hasta cuándo?</p>
              <div className="grid gap-3 sm:max-w-lg sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="nov-desde" className="text-sm text-muted-foreground">Desde</Label>
                  <Input
                    id="nov-desde"
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="h-12 text-base md:text-base"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="nov-hasta" className="text-sm text-muted-foreground">Hasta (inclusive)</Label>
                  <Input
                    id="nov-hasta"
                    type="date"
                    value={hasta}
                    min={fecha || undefined}
                    onChange={(e) => setHasta(e.target.value)}
                    className="h-12 text-base md:text-base"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { dias: 1, label: "Un solo día" },
                  { dias: 7, label: "Una semana" },
                  { dias: 14, label: "Dos semanas" },
                ].map((o) => (
                  <ChipOpcion
                    key={o.dias}
                    activo={diasCorridos(fecha, hastaFinal) === o.dias && (o.dias === 1 ? !hastaFinal : true)}
                    onClick={() => setHasta(o.dias === 1 ? "" : sumarDias(fecha, o.dias - 1))}
                  >
                    {o.label}
                  </ChipOpcion>
                ))}
                {fecha && (!hasta || hasta >= fecha) ? (
                  <span className="text-base font-semibold tabular" aria-live="polite">
                    {diasCorridos(fecha, hastaFinal) === 1 ? "1 día" : `${diasCorridos(fecha, hastaFinal)} días corridos`}
                  </span>
                ) : null}
              </div>
            </div>
          )}

          {def.horas === "minutos" ? (
            <div className="space-y-2">
              <Label className="text-base">¿Cuántos minutos tarde?</Label>
              <div className="flex flex-wrap items-center gap-2">
                {CHIPS_MINUTOS.map((m) => (
                  <ChipOpcion
                    key={m}
                    activo={!minutosOtro && minutos === m}
                    onClick={() => { setMinutos(m); setMinutosOtro(""); }}
                  >
                    {m === 60 ? "1 hora" : `${m} min`}
                  </ChipOpcion>
                ))}
                <Input
                  inputMode="numeric"
                  value={minutosOtro}
                  onChange={(e) => setMinutosOtro(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  placeholder="Otro (min)"
                  aria-label="Otros minutos"
                  className="h-11 w-32 text-base md:text-base"
                />
              </div>
            </div>
          ) : null}

          {def.horas === "horas" || def.horas === "horas_opcional" ? (
            <div className="space-y-2">
              <Label className="text-base">
                {def.horas === "horas" ? "¿Cuántas horas extra?" : "¿Cuántas horas trabajó? (opcional)"}
              </Label>
              <div className="flex flex-wrap items-center gap-2">
                {CHIPS_HORAS.map((h) => (
                  <ChipOpcion
                    key={h}
                    activo={!horasOtro && horas === h}
                    onClick={() => { setHoras(horas === h && def.horas === "horas_opcional" ? null : h); setHorasOtro(""); }}
                  >
                    {h} h
                  </ChipOpcion>
                ))}
                <Input
                  inputMode="decimal"
                  value={horasOtro}
                  onChange={(e) => setHorasOtro(e.target.value.replace(/[^\d,.]/g, "").slice(0, 5))}
                  placeholder="Otro (ej.: 1,5)"
                  aria-label="Otras horas"
                  className="h-11 w-36 text-base md:text-base"
                />
              </div>
              {horasFinal ? <p className="text-sm text-muted-foreground">{textoHoras(horasFinal)}</p> : null}
            </div>
          ) : null}

          {def.justificada ? (
            <div className="space-y-2">
              <Label className="text-base">¿Está justificada?</Label>
              <div className="grid max-w-md grid-cols-2 gap-2">
                <ChipOpcion grande activo={justificada === true} onClick={() => setJustificada(true)}>
                  Sí, justificada
                </ChipOpcion>
                <ChipOpcion grande activo={justificada === false} onClick={() => setJustificada(false)}>
                  No
                </ChipOpcion>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="nov-detalle" className="text-base">
              {def.detalleObligatorio
                ? "¿Qué pasó?"
                : def.valor === "licencia"
                  ? "Motivo de la licencia (opcional)"
                  : "Detalle (opcional)"}
            </Label>
            {def.valor === "licencia" ? (
              <div className="flex flex-wrap gap-2">
                {MOTIVOS_LICENCIA.map((m) => (
                  <ChipOpcion key={m} activo={detalle === m} onClick={() => setDetalle(m)}>
                    {m}
                  </ChipOpcion>
                ))}
              </div>
            ) : null}
            <Textarea
              id="nov-detalle"
              rows={3}
              value={detalle}
              maxLength={2000}
              onChange={(e) => setDetalle(e.target.value)}
              placeholder={
                def.detalleObligatorio
                  ? "Ej.: Se retiró antes por un trámite familiar"
                  : def.valor === "falta"
                    ? "Ej.: Avisó por teléfono que estaba enfermo"
                    : "Lo que haga falta aclarar"
              }
              className="min-h-24 text-base md:text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nov-adjunto" className="text-base">
              {def.valor === "falta" || def.valor === "licencia"
                ? "Certificado (opcional)"
                : "Foto o PDF (opcional)"}
            </Label>
            <input
              ref={archivoRef}
              id="nov-adjunto"
              type="file"
              accept={ACCEPT_ADJUNTO}
              className="sr-only"
              onChange={(e) => {
                const elegido = e.target.files?.[0] ?? null;
                const pesado = errorPesoAdjunto(elegido);
                if (pesado) {
                  e.target.value = "";
                  setArchivo(null);
                  setError(pesado);
                  return;
                }
                setError(null);
                setArchivo(elegido?.name ?? null);
                setQuitarAdjunto(false);
              }}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-auto min-h-12 max-w-full px-4 py-2 text-base whitespace-normal"
                onClick={() => archivoRef.current?.click()}
              >
                <Camera className="size-5 shrink-0" strokeWidth={2} />
                {archivo
                  ? "Cambiar la foto o el PDF"
                  : def.valor === "falta" || def.valor === "licencia"
                    ? "Sacá una foto del certificado"
                    : "Sacá una foto o elegí un PDF"}
              </Button>
              {archivo ? (
                <span className="flex min-w-0 max-w-full items-center gap-2 text-sm">
                  <FileText className="size-4 shrink-0" strokeWidth={2} />
                  <span className="min-w-0 truncate">{archivo}</span>
                  <Button type="button" variant="ghost" className="h-11 shrink-0 px-3" onClick={quitarArchivo}>
                    Quitar
                  </Button>
                </span>
              ) : editar?.tieneAdjunto && !quitarAdjunto ? (
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  {editar.adjuntoUrl ? (
                    <a href={editar.adjuntoUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-4 hover:underline">
                      Ver el que está cargado
                    </a>
                  ) : (
                    "Ya tiene uno cargado"
                  )}
                  <Button type="button" variant="ghost" className="h-11" onClick={() => setQuitarAdjunto(true)}>
                    Quitarlo
                  </Button>
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">Foto o PDF. {AYUDA_PESO_ADJUNTO}</span>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {/* Confirmación */}
      {frase ? (
        <div className="space-y-4">
          <div className="rounded-xl border-2 border-primary/25 bg-accent/50 px-5 py-4">
            <p className="text-sm font-medium text-muted-foreground">Vas a {editar ? "guardar" : esJefe ? "enviar" : "guardar"}:</p>
            <p className="mt-1 text-lg leading-snug font-semibold">{frase}</p>
            {esJefe && !editar ? (
              <p className="mt-1 text-sm text-muted-foreground">Le llega a Administración para que la apruebe.</p>
            ) : null}
          </div>

          {error ? (
            <AlertaError
              error={error}
              titulo={error === faltante() ? "Falta completar" : esJefe && !editar ? "No se pudo enviar" : "No se pudo guardar"}
            />
          ) : null}

          <Button
            type="submit"
            size="lg"
            disabled={pendiente}
            className="h-14 w-full text-base font-semibold sm:w-auto sm:px-10"
          >
            {pendiente ? (
              <Spinner className="size-5" />
            ) : editar ? (
              <Pencil className="size-5" strokeWidth={2} />
            ) : esJefe ? (
              <Send className="size-5" strokeWidth={2} />
            ) : (
              <Check className="size-5" strokeWidth={2.2} />
            )}
            {editar ? "Guardar cambios" : esJefe ? "Enviar a Administración" : "Guardar novedad"}
          </Button>
        </div>
      ) : error ? (
        <AlertaError error={error} titulo="Falta completar" />
      ) : null}
    </form>
  );
}

/** Chip de opción de un toque (≥ 44 px). */
function ChipOpcion({
  activo,
  onClick,
  grande = false,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  grande?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors",
        grande ? "min-h-12 rounded-lg text-base" : "min-h-11",
        activo
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:bg-accent"
      )}
    >
      {activo ? <Check className="size-4" strokeWidth={2.5} /> : null}
      {children}
    </button>
  );
}
