import { formatFecha } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { CajaChat } from "@/components/portal/caja-chat";
import { EncabezadoDetalle } from "@/components/portal/encabezado-detalle";
import { BotonDocumento, HiloPortal, type ItemChat } from "@/components/portal/hilo-portal";
import { LineaEstadoRegistro } from "@/components/comunicaciones/linea-estado-registro";
import {
  estadoMulta,
  etiquetaLugar,
  nombreRegistro,
  saldoMulta,
  SELLO_MULTA,
  type CargoMulta,
  type TipoRegistro,
} from "@/components/comunicaciones/constantes";

/** Qué es cada aviso, en una línea: son palabras formales que no todos usan. */
const QUE_ES: Record<TipoRegistro, string> = {
  notificacion: "Un aviso formal de la cooperativa.",
  apercibimiento: "Un llamado de atención por escrito.",
  sancion: "Una medida que decidió la cooperativa.",
};

/** Un aviso formal: el papel arriba, sobrio; abajo la conversación para contar su versión. */
export function PantallaAviso({
  r,
  espacio,
  docUrl,
  datosMulta,
  items,
  descargoEn,
  respondidoEn,
  yaEscribio,
}: {
  r: {
    id: string;
    numero: number;
    tipo: string;
    titulo: string;
    detalle: string | null;
    fecha: string;
    estado: string;
    creado_en: string;
    multa_vencimiento: string | null;
  };
  espacio: { tipo: string; numero: string | null; medio?: boolean | null } | null;
  docUrl?: string;
  datosMulta: { multa: number | null; multa_sin_efecto_en: string | null; cargo: CargoMulta };
  items: ItemChat[];
  descargoEn: string | null;
  respondidoEn: string | null;
  yaEscribio: boolean;
}) {
  const tipo = r.tipo as TipoRegistro;
  const multa = datosMulta.multa;
  const eMulta = estadoMulta(datosMulta);
  const esNotificacion = tipo === "notificacion";

  return (
    <>
      <EncabezadoDetalle
        volverA="/mi-cuenta/mensajes"
        volverTexto="Mensajes"
        titulo={r.titulo}
        bajada={nombreRegistro(r)}
      />

      <div className="chat-fondo">
        <div className="flex flex-col gap-3 px-3 pt-3 pb-4">
          <section className="hoja flex flex-col gap-3 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Sello estado={tipo} />
              <p className="text-[0.98rem] text-tinta-2 tabular">
                {formatFecha(r.fecha)}
                {espacio ? ` · ${etiquetaLugar(espacio)}` : ""}
              </p>
            </div>
            <p className="text-[1rem] leading-snug text-tinta-2 text-pretty">{QUE_ES[tipo]}</p>
            {r.detalle ? <p className="text-[1.1rem] leading-relaxed whitespace-pre-line">{r.detalle}</p> : null}
            {!yaEscribio ? (
              <a href={`#chat-${r.id}`} className="boton boton-primario w-full">
                {esNotificacion ? "Responder" : "Contá tu versión"}
              </a>
            ) : null}
            {docUrl ? <BotonDocumento href={docUrl}>Ver el documento</BotonDocumento> : null}
            <details className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center text-[1.02rem] font-bold text-esmalte underline underline-offset-4 group-open:mb-2">
                Ver por dónde va
              </summary>
              <LineaEstadoRegistro
                tipo={tipo}
                estado={r.estado}
                notificadoEn={r.creado_en}
                descargoEn={descargoEn}
                respondidoEn={respondidoEn}
                paraSocio
              />
            </details>
          </section>

          {eMulta !== "sin_multa" && multa !== null ? (
            <section
              aria-label="Multa"
              className={cn(
                "flex flex-col gap-1.5 rounded-[1.1rem] px-4 py-3.5",
                eMulta === "sin_efecto" ? "bg-[oklch(0.9_0.015_265)]" : eMulta === "pagada" ? "bg-pagado-suave" : "bg-pendiente-suave"
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[1.05rem] font-extrabold">Multa</p>
                <Sello estado={SELLO_MULTA[eMulta].estado} texto={SELLO_MULTA[eMulta].texto} />
              </div>
              <Money
                monto={multa}
                className={cn(
                  "text-[2.1rem] leading-none font-extrabold [font-stretch:88%]",
                  eMulta === "sin_efecto" ? "text-tinta-2 line-through" : eMulta === "pagada" ? "text-pagado" : "text-pendiente"
                )}
              />
              <p className="text-[1.02rem] leading-snug">
                {eMulta === "sin_efecto" ? (
                  "Quedó sin efecto: no la tenés que pagar."
                ) : eMulta === "pagada" ? (
                  "Ya está pagada. ¡Gracias!"
                ) : eMulta === "parcial" ? (
                  <>
                    Te falta pagar <Money monto={saldoMulta(datosMulta)} className="font-bold" />. Vence el{" "}
                    <span className="tabular">{formatFecha(r.multa_vencimiento)}</span>.
                  </>
                ) : (
                  <>
                    Se sumó a tu cuenta. Vence el <span className="font-bold tabular">{formatFecha(r.multa_vencimiento)}</span>.
                  </>
                )}
              </p>
            </section>
          ) : null}

          <HiloPortal items={items} />
        </div>

        <div className="mt-auto scroll-mt-4">
          <CajaChat
            pegada={false}
            destino={{ tipo: "registro", id: r.id }}
            etiqueta={yaEscribio ? "¿Querés agregar algo más?" : esNotificacion ? "Responder" : "Contá tu versión"}
            ayuda={
              !yaEscribio && !esNotificacion
                ? "Es tu descargo: contá qué pasó. Si tenés una foto o un papel que lo muestre, sumalo."
                : undefined
            }
            placeholder={esNotificacion ? "Escribí tu respuesta…" : "Contá tu versión…"}
            boton={esNotificacion || yaEscribio ? "Enviar" : "Enviar mi versión"}
            listo={
              esNotificacion ? "Listo: enviamos tu respuesta." : "Listo: enviamos tu descargo. Te vamos a responder por acá."
            }
          />
        </div>
      </div>
    </>
  );
}
