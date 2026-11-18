"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, CircleHelp, Flag, Hand, MessageCircleWarning, Send, type LucideIcon } from "lucide-react";
import { crearSolicitudSocio } from "@/lib/actions/portal";
import { uuidV4 } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { firmaFormulario, type TipoSolicitud } from "@/components/solicitudes/constantes";
import { explicarFalloEnvio, prepararAdjuntos } from "@/components/comunicaciones/adjuntos";
import { AvisoError, irAlCampo } from "@/components/comunicaciones/aviso-error";
import { llamarAccion } from "@/lib/llamar-accion";
import {
  cuantosArchivos,
  mandarArchivosSueltos,
  type ArchivoElegido,
} from "@/components/solicitudes/archivos-sueltos";
import { BotonSumarArchivos, ListaArchivos } from "@/components/portal/elegir-archivos";

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
 * Fotos o PDF: varios (hasta 10). El primero va con el mensaje y los demás después, cada uno
 * en su pedido (archivos-sueltos.ts). Si alguno no llega, el mensaje ya está en la cooperativa:
 * lo escrito queda fijo y «Mandar lo que falta» manda solo esos, sin repetir ninguno.
 */
export function FormSolicitudSocio() {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [tipo, setTipo] = useState<TipoSolicitud | null>(null);
  const [archivos, setArchivos] = useState<ArchivoElegido[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** «2 de 5» mientras se mandan varios archivos. */
  const [avance, setAvance] = useState<string | null>(null);
  /** La solicitud ya se creó pero faltan archivos: su id. */
  const [creada, setCreada] = useState<string | null>(null);
  const claveRef = useRef<{ firma: string; ref: string } | null>(null);

  const opcion = OPCIONES.find((o) => o.valor === tipo) ?? null;

  function elegir(valor: TipoSolicitud) {
    setTipo(valor);
    // Es lo único que falta hacer: el cuadro queda listo para escribir.
    requestAnimationFrame(() => document.getElementById("soc-detalle")?.focus());
  }

  function irALaConversacion(id: string) {
    router.push(`/mi-cuenta/solicitudes/${id}`);
  }

  /** Manda los archivos que van sueltos; si llegan todos, a la conversación. */
  async function mandarSueltos(id: string, pendientes: ArchivoElegido[], yaVan: number, total: number) {
    let van = yaVan;
    setAvance(`${van + 1} de ${total}`);
    const r = await mandarArchivosSueltos(id, pendientes, {
      desdePortal: true,
      alLlegar: (a) => {
        van += 1;
        setArchivos((lista) => lista.filter((x) => x.ref !== a.ref));
        if (van < total) setAvance(`${van + 1} de ${total}`);
      },
    });
    setAvance(null);
    if (r.error) {
      const faltan = pendientes.length - r.llegaron.length;
      setError(
        `Tu mensaje ya llegó a la cooperativa, pero ${faltan === 1 ? "falta" : "faltan"} mandar ${cuantosArchivos(faltan)}. ${r.error}`
      );
      return;
    }
    toast.success(
      yaVan === 0 ? "Listo: llegó lo que faltaba." : `Listo: tu mensaje y ${cuantosArchivos(total)} llegaron a la cooperativa.`
    );
    irALaConversacion(id);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente || !tipo) return;
    setError(null);

    if (creada) {
      // El mensaje ya llegó: solo faltan archivos (si los quitó todos, a la conversación).
      if (archivos.length === 0) {
        irALaConversacion(creada);
        return;
      }
      const pendientes = archivos;
      startTransition(() => mandarSueltos(creada, pendientes, 0, pendientes.length));
      return;
    }

    const fd = new FormData(e.currentTarget);
    if (!String(fd.get("detalle") ?? "").trim()) {
      setError("Escribí lo que nos querés contar antes de enviarlo.");
      irAlCampo("soc-detalle");
      return;
    }
    fd.set("tipo", tipo);
    const [primero, ...resto] = archivos;
    if (primero) fd.set("adjunto", primero.archivo, primero.archivo.name);
    const firma = firmaFormulario(fd);
    if (claveRef.current?.firma !== firma) claveRef.current = { firma, ref: uuidV4() };
    fd.set("ref", claveRef.current.ref);
    const total = archivos.length;
    startTransition(async () => {
      if (total > 1) setAvance(`1 de ${total}`);
      const errorPeso = await prepararAdjuntos(fd, ["adjunto"]);
      if (errorPeso) {
        setAvance(null);
        setError(errorPeso);
        return;
      }
      const res = await llamarAccion(() => crearSolicitudSocio(fd));
      if (!res.ok) {
        // Lo escrito queda y la clave se conserva: tocar «Enviar» de nuevo no lo manda dos veces.
        setAvance(null);
        setError(explicarFalloEnvio(res.error, fd, ["adjunto"]));
        return;
      }
      claveRef.current = null;
      if (resto.length === 0) {
        if (res.data.repetido) toast.info("Ya lo habíamos recibido: no se mandó dos veces.");
        else toast.success("Listo: tu mensaje llegó a la cooperativa.");
        irALaConversacion(res.data.id);
        return;
      }
      setCreada(res.data.id);
      setArchivos(resto);
      await mandarSueltos(res.data.id, resto, 1, total);
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

      {/* Queda siempre montado: al elegir otra opción no se pierde lo escrito ni las fotos. */}
      <form onSubmit={onSubmit} noValidate hidden={opcion === null} className="flex flex-1 flex-col gap-3 [&[hidden]]:hidden">
      {creada ? null : (
        <button
          type="button"
          onClick={() => setTipo(null)}
          className="inline-flex min-h-11 items-center gap-1 self-start rounded-lg pr-3 text-[1.02rem] font-bold text-esmalte"
        >
          <ChevronLeft aria-hidden className="size-5" strokeWidth={2.6} />
          Elegí otra cosa
        </button>
      )}

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
          // Ya está en la cooperativa: cambiarlo acá no cambiaría lo que llegó.
          readOnly={creada !== null}
          className="campo-portal min-h-[10rem] read-only:bg-porcelana-2 read-only:text-tinta-2"
          onChange={() => error && setError(null)}
        />
      </div>

      <ListaArchivos
        archivos={archivos}
        deshabilitado={pendiente}
        onQuitar={(ref) => {
          setArchivos((lista) => lista.filter((a) => a.ref !== ref));
          setError(null);
        }}
      />
      <BotonSumarArchivos
        id="soc-adjunto"
        archivos={archivos}
        deshabilitado={pendiente}
        texto="Sumar fotos o PDF (si querés)"
        textoOtro="Sumar otra foto o PDF"
        onCambio={setArchivos}
        onError={setError}
      />

      {error ? <AvisoError mensaje={error} /> : null}

      <button
        type="submit"
        disabled={pendiente}
        data-tour="solicitudes-socio-enviar"
        className="boton boton-primario mt-auto min-h-[3.8rem] w-full !text-[1.2rem]"
      >
        {pendiente ? <Spinner className="size-5" /> : <Send aria-hidden strokeWidth={2.3} />}
        {avance ? `Enviando ${avance}…` : creada ? (archivos.length > 0 ? "Mandar lo que falta" : "Ver la conversación") : "Enviar"}
      </button>
      {creada && archivos.length > 0 ? (
        <Link
          href={`/mi-cuenta/solicitudes/${creada}`}
          className="inline-flex min-h-11 items-center justify-center self-center px-3 text-[1.02rem] font-bold text-esmalte underline underline-offset-4"
        >
          Dejarlo así y ver la conversación
        </Link>
      ) : null}
      </form>
    </>
  );
}
