import { Sello } from "@/components/shared/sello";
import { LineaEstado, type FechasSolicitud } from "@/components/solicitudes/linea-estado";
import { ESTADOS_TERMINADOS, LABEL_TIPO, selloEstado, type TipoSolicitud } from "@/components/solicitudes/constantes";
import { CajaChat } from "@/components/portal/caja-chat";
import { EncabezadoDetalle } from "@/components/portal/encabezado-detalle";
import { HiloPortal, type ItemChat } from "@/components/portal/hilo-portal";

/** Qué significa el estado actual, en palabras del socio. */
const EXPLICACION: Record<string, string> = {
  nueva: "Lo recibimos. El Líder de Procesos lo va a revisar.",
  en_revision: "Lo está revisando el Líder de Procesos.",
  en_consejo: "Pasó al Consejo para que decida.",
  resuelta: "Ya hay una resolución.",
  asignada: "Administración está trabajando en lo que se resolvió.",
  ejecutada: "Lo resuelto ya se hizo.",
  rechazada: "No se pudo dar curso.",
  cerrada: "Terminado.",
};

/** Una consulta o pedido: en qué está y la conversación, como un chat. */
export function PantallaSolicitud({
  s,
  items,
}: {
  s: FechasSolicitud & {
    id: string;
    numero: number;
    tipo: TipoSolicitud;
    asunto: string;
    resolucion: string | null;
    nota_ejecucion: string | null;
  };
  items: ItemChat[];
}) {
  const terminada = ESTADOS_TERMINADOS.includes(s.estado);

  return (
    <>
      <EncabezadoDetalle
        volverA="/mi-cuenta/mensajes"
        volverTexto="Mensajes"
        titulo={s.asunto}
        bajada={`${LABEL_TIPO[s.tipo]} N° ${s.numero}`}
      />

      <div className="chat-fondo">
        <div className="flex flex-col gap-3 px-3 pt-3 pb-4">
          <section data-tour="solicitudes-socio-estado" className="hoja flex flex-col gap-2 px-4 py-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <Sello estado={selloEstado(s.estado)} />
            </div>
            <p className="text-[1.05rem] leading-snug text-pretty">{EXPLICACION[s.estado]}</p>
            {s.resolucion ? (
              <p className="rounded-xl bg-porcelana-2 px-3 py-2.5 text-[1.05rem] leading-snug whitespace-pre-line">
                <strong className="font-extrabold">{s.estado === "rechazada" ? "Motivo: " : "Resolución: "}</strong>
                {s.resolucion}
              </p>
            ) : null}
            {s.nota_ejecucion ? (
              <p className="rounded-xl bg-porcelana-2 px-3 py-2.5 text-[1.05rem] leading-snug whitespace-pre-line">
                <strong className="font-extrabold">Qué se hizo: </strong>
                {s.nota_ejecucion}
              </p>
            ) : null}
            <details className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center text-[1.02rem] font-bold text-esmalte underline underline-offset-4 group-open:mb-2">
                Ver por dónde va
              </summary>
              <LineaEstado solicitud={s} />
            </details>
          </section>

          <div data-tour="solicitudes-socio-mensajes">
            <HiloPortal items={items} />
          </div>
        </div>

        <CajaChat
          destino={{ tipo: "solicitud", id: s.id }}
          placeholder={terminada ? "¿Querés agregar algo? Podés seguir escribiendo." : "Escribile a la cooperativa…"}
          listo="Listo: tu mensaje se envió."
        />
      </div>
    </>
  );
}
