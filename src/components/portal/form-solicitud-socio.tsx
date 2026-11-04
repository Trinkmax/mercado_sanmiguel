"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, ChevronLeft, CircleHelp, Flag, Hand, MessageCircleWarning, Send, X, type LucideIcon } from "lucide-react";
import { crearSolicitudSocio } from "@/lib/actions/portal";
import { uuidV4 } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { ACCEPT_ADJUNTO, firmaFormulario, type TipoSolicitud } from "@/components/solicitudes/constantes";
import { errorPesoAdjunto, explicarFalloEnvio, prepararAdjuntos } from "@/components/comunicaciones/adjuntos";
import { AvisoError, irAlCampo } from "@/components/comunicaciones/aviso-error";
import { llamarAccion } from "@/lib/llamar-accion";

/** Las cuatro formas de escribirle a la cooperativa, en palabras de todos los días. */
const OPCIONES: {
  valor: TipoSolicitud;
  icono: LucideIcon;
  titulo: string;
  ayuda: string;
  pregunta: string;
  ejemplo: string;
}[] = [
  {
    valor: "consulta",
    icono: CircleHelp,
    titulo: "Preguntar algo",
    ayuda: "Una duda que necesita respuesta",
    pregunta: "¿Qué querés preguntar?",
    ejemplo: "Escribí tu pregunta…",
  },
  {
    valor: "solicitud",
    icono: Hand,
    titulo: "Pedir algo",
    ayuda: "Un cambio, un permiso, un espacio",
    pregunta: "¿Qué necesitás?",
    ejemplo: "Contá qué necesitás y desde cuándo…",
  },
  {
    valor: "reclamo",
    icono: MessageCircleWarning,
    titulo: "Hacer un reclamo",
    ayuda: "Algo no está bien y hay que arreglarlo",
    pregunta: "¿Qué pasa?",
    ejemplo: "Contá qué pasó, dónde y desde cuándo…",
  },
  {
    valor: "informe",
    icono: Flag,
    titulo: "Avisar de algo",
    ayuda: "Algo que pasó y querés que quede anotado",
    pregunta: "¿De qué querés avisar?",
    ejemplo: "Contá qué pasó…",
  },
];

/**
 * Escribirle a la cooperativa, de a una cosa por vez: qué querés hacer y después el mensaje.
 * Sin «asunto»: el servidor lo arma con la primera frase. Clave de idempotencia (`ref`): la
 * misma mientras no cambie lo escrito y hasta que se guarde; si se corta el wifi y toca
 * «Enviar» de nuevo, no sale otro mensaje igual.
 */
export function FormSolicitudSocio() {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [tipo, setTipo] = useState<TipoSolicitud | null>(null);
  const archivoRef = useRef<HTMLInputElement>(null);
  const [nombreAdjunto, setNombreAdjunto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const claveRef = useRef<{ firma: string; ref: string } | null>(null);

  const opcion = OPCIONES.find((o) => o.valor === tipo) ?? null;

  function elegir(valor: TipoSolicitud) {
    setTipo(valor);
    // Es lo único que falta hacer: el cuadro queda listo para escribir.
    requestAnimationFrame(() => document.getElementById("soc-detalle")?.focus());
  }

  function quitarAdjunto() {
    if (archivoRef.current) archivoRef.current.value = "";
    setNombreAdjunto(null);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente || !tipo) return;
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (!String(fd.get("detalle") ?? "").trim()) {
      setError("Escribí lo que nos querés contar antes de enviarlo.");
      irAlCampo("soc-detalle");
      return;
    }
    fd.set("tipo", tipo);
    const firma = firmaFormulario(fd);
    if (claveRef.current?.firma !== firma) claveRef.current = { firma, ref: uuidV4() };
    fd.set("ref", claveRef.current.ref);
    startTransition(async () => {
      const errorPeso = await prepararAdjuntos(fd, ["adjunto"]);
      if (errorPeso) {
        setError(errorPeso);
        return;
      }
      const res = await llamarAccion(() => crearSolicitudSocio(fd));
      if (!res.ok) {
        // Lo escrito queda y la clave se conserva: tocar «Enviar» de nuevo no lo manda dos veces.
        setError(explicarFalloEnvio(res.error, fd, ["adjunto"]));
        return;
      }
      claveRef.current = null;
      if (res.data.repetido) toast.info("Ya lo habíamos recibido: no se mandó dos veces.");
      else toast.success("Listo: tu mensaje llegó a la cooperativa.");
      router.push(`/mi-cuenta/solicitudes/${res.data.id}`);
    });
  }

  return (
    <>
      <fieldset hidden={opcion !== null} className="flex flex-col gap-2.5 [&[hidden]]:hidden" data-tour="solicitudes-socio-tipo">
        <legend className="mb-2.5 px-1.5 text-[1.32rem] font-extrabold [font-stretch:92%]">¿Qué querés hacer?</legend>
        <div className="hoja hoja-filas">
          {OPCIONES.map((o) => {
            const Icono = o.icono;
            return (
              <button key={o.valor} type="button" className="fila-toque" onClick={() => elegir(o.valor)}>
                <span className="fila-icono" aria-hidden>
                  <Icono strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="fila-titulo block">{o.titulo}</span>
                  <span className="fila-sub block">{o.ayuda}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Queda siempre montado: al elegir otra opción no se pierde lo escrito ni la foto. */}
      <form onSubmit={onSubmit} noValidate hidden={opcion === null} className="flex flex-1 flex-col gap-3 [&[hidden]]:hidden">
      <button
        type="button"
        onClick={() => setTipo(null)}
        className="inline-flex min-h-11 items-center gap-1 self-start rounded-lg pr-3 text-[1.02rem] font-bold text-esmalte"
      >
        <ChevronLeft aria-hidden className="size-5" strokeWidth={2.6} />
        Elegí otra cosa
      </button>

      <div className="flex flex-col gap-2" data-tour="solicitudes-socio-asunto">
        <label htmlFor="soc-detalle" className="px-1 text-[1.32rem] font-extrabold [font-stretch:92%]">
          {opcion?.pregunta}
        </label>
        <textarea
          id="soc-detalle"
          name="detalle"
          rows={6}
          maxLength={6000}
          placeholder={opcion?.ejemplo}
          className="campo-portal min-h-[10rem]"
          onChange={() => error && setError(null)}
        />
      </div>

      <div className="flex items-stretch gap-2">
        <label htmlFor="soc-adjunto" className="boton boton-suave min-w-0 flex-1 cursor-pointer !text-[1.02rem]">
          <Camera aria-hidden strokeWidth={2.2} />
          <span className="truncate">{nombreAdjunto ?? "Sumar una foto (si querés)"}</span>
        </label>
        {nombreAdjunto ? (
          <button type="button" onClick={quitarAdjunto} aria-label="Quitar la foto" className="boton boton-suave !px-3">
            <X aria-hidden strokeWidth={2.4} />
          </button>
        ) : null}
        <input
          ref={archivoRef}
          id="soc-adjunto"
          name="adjunto"
          type="file"
          accept={ACCEPT_ADJUNTO}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            const pesado = errorPesoAdjunto(f);
            if (pesado) {
              quitarAdjunto();
              setError(pesado);
              return;
            }
            setError(null);
            setNombreAdjunto(f?.name ?? null);
          }}
        />
      </div>

      {error ? <AvisoError mensaje={error} /> : null}

      <button
        type="submit"
        disabled={pendiente}
        data-tour="solicitudes-socio-enviar"
        className="boton boton-primario mt-auto min-h-[3.8rem] w-full !text-[1.2rem]"
      >
        {pendiente ? <Spinner className="size-5" /> : <Send aria-hidden strokeWidth={2.3} />}
        Enviar
      </button>
      </form>
    </>
  );
}
