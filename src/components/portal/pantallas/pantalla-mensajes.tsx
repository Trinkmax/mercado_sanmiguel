import Link from "next/link";
import {
  Bell,
  ChevronRight,
  Gavel,
  Megaphone,
  MessageCircle,
  MessageSquareWarning,
  PenLine,
  type LucideIcon,
} from "lucide-react";
import { formatARS, formatFecha, formatFechaHora } from "@/lib/format";
import { esperaDescargo, registroSinVer, respuestaNueva } from "@/lib/segmentos";
import { cn } from "@/lib/utils";
import { Sello } from "@/components/shared/sello";
import type {
  CircularPortal,
  RegistroPortal,
  SolicitudPortal,
} from "@/components/portal/datos-portal";
import {
  estadoMulta,
  labelTipoRegistro,
  saldoMulta,
  SELLO_MULTA,
  selloEstadoRegistro,
} from "@/components/comunicaciones/constantes";
import { LABEL_TIPO, selloEstado } from "@/components/solicitudes/constantes";

const ICONO_REGISTRO: Record<string, LucideIcon> = {
  notificacion: Bell,
  apercibimiento: MessageSquareWarning,
  sancion: Gavel,
};

type Item = {
  id: string;
  href: string;
  icono: LucideIcon;
  titulo: string;
  sub: string;
  fecha: string;
  sello: string;
  selloTexto?: string;
  /** Lo está esperando: va arriba y en negrita. */
  importante: boolean;
  ancla: string;
};

/**
 * Todo lo que se habla con la cooperativa, en un solo lugar: lo que le mandan (circulares,
 * notificaciones, apercibimientos, sanciones) y lo que escribe (consultas, pedidos, reclamos).
 * Antes eran dos secciones y cuatro pestañas para aprender; ahora es una lista, como un chat:
 * arriba lo que espera algo de vos.
 */
export function PantallaMensajes({
  circulares,
  registros,
  solicitudes,
  respondidas,
}: {
  circulares: CircularPortal[];
  registros: RegistroPortal[];
  solicitudes: SolicitudPortal[];
  /** Ids de las solicitudes con una respuesta que todavía no abrió. */
  respondidas: string[];
}) {
  const conRespuesta = new Set(respondidas);

  const items: Item[] = [
    ...circulares.map((c): Item => ({
      id: `c-${c.id}`,
      href: `/mi-cuenta/circulares/${c.id}`,
      icono: Megaphone,
      titulo: c.titulo,
      sub: `Circular N° ${c.numero} · ${formatFecha(c.fecha)}`,
      fecha: c.fecha,
      sello: c.recibida_en ? "recibida" : "nueva_comunicacion",
      selloTexto: c.recibida_en ? (c.obligatoria ? "Confirmada" : "Leída") : undefined,
      importante: !c.recibida_en,
      ancla: "socio-comunicaciones-circular",
    })),
    ...registros.map((r): Item => {
      const aviso = registroSinVer(r)
        ? "nueva_comunicacion"
        : respuestaNueva(r)
          ? "respuesta_nueva"
          : esperaDescargo(r)
            ? "a_responder"
            : null;
      const multa = estadoMulta(r);
      const textoMulta =
        multa === "sin_multa"
          ? ""
          : multa === "pendiente" || multa === "parcial"
            ? ` · Multa ${formatARS(saldoMulta(r))}`
            : ` · ${SELLO_MULTA[multa].texto}`;
      return {
        id: `r-${r.id}`,
        href: `/mi-cuenta/comunicaciones/${r.id}`,
        icono: ICONO_REGISTRO[r.tipo] ?? Bell,
        titulo: r.titulo,
        sub: `${labelTipoRegistro(r.tipo)} N° ${r.numero} · ${formatFecha(r.fecha)}${textoMulta}`,
        fecha: r.ultimo_mensaje_en ?? r.fecha,
        sello: aviso ?? selloEstadoRegistro(r),
        importante: aviso !== null,
        ancla: "socio-comunicaciones-registro",
      };
    }),
    ...solicitudes.map((s): Item => {
      const nueva = conRespuesta.has(s.id);
      return {
        id: `s-${s.id}`,
        href: `/mi-cuenta/solicitudes/${s.id}`,
        icono: MessageCircle,
        titulo: s.asunto,
        sub: `${LABEL_TIPO[s.tipo]} N° ${s.numero} · ${formatFechaHora(s.actualizada_en)}`,
        fecha: s.actualizada_en,
        sello: nueva ? "respuesta_nueva" : selloEstado(s.estado),
        importante: nueva,
        ancla: "solicitudes-socio-fila",
      };
    }),
  ];

  const ordenados = [...items].sort((a, b) => b.fecha.localeCompare(a.fecha));
  // Primero lo que pide respuesta: es lo único que puede traer consecuencias.
  const importantes = ordenados
    .filter((i) => i.importante)
    .sort((a, b) => Number(b.sello === "a_responder") - Number(a.sello === "a_responder"));
  const resto = ordenados.filter((i) => !i.importante);

  const escribir = (
    <Link href="/mi-cuenta/solicitudes/nueva" data-tour="solicitudes-socio-nueva" className="boton boton-claro w-full">
      <PenLine aria-hidden strokeWidth={2.3} />
      Escribirle a la cooperativa
    </Link>
  );

  return (
    <>
      <div className="portal-espacio-chico" data-tour="encabezado">
        <h1 className="portal-titulo">Mensajes</h1>
        <p className="portal-bajada">Lo que te manda la cooperativa y lo que le escribís.</p>
      </div>

      <div className="portal-suelo !pt-1">
        {importantes.length === 0 ? escribir : null}

        {items.length === 0 ? (
          <div data-tour="mensajes-vacio solicitudes-socio-vacia" className="hoja flex flex-col items-center gap-2 px-6 py-9 text-center">
            <MessageCircle aria-hidden className="size-9 text-esmalte" strokeWidth={1.8} />
            <p className="text-[1.15rem] font-extrabold">Todavía no hay mensajes</p>
            <p className="max-w-[25rem] text-[1.02rem] leading-snug text-tinta-2 text-pretty">
              Cuando la cooperativa te mande algo, aparece acá. Si necesitás preguntar o pedir algo, escribí con el
              botón de arriba y te respondemos por acá.
            </p>
          </div>
        ) : null}

        {importantes.length > 0 ? (
          <section className="portal-seccion" data-tour="mensajes-lista">
            <h2 className="portal-seccion-titulo">Te están esperando</h2>
            <ListaItems items={importantes} />
          </section>
        ) : null}
        {importantes.length > 0 ? escribir : null}
        {resto.length > 0 ? (
          <section className="portal-seccion" data-tour={importantes.length > 0 ? undefined : "mensajes-lista"}>
            {importantes.length > 0 ? <h2 className="portal-seccion-titulo">Anteriores</h2> : null}
            <ListaItems items={resto} />
          </section>
        ) : null}
      </div>
    </>
  );
}

function ListaItems({ items }: { items: Item[] }) {
  return (
    <ul className="hoja hoja-filas">
      {items.map((i) => {
        const Icono = i.icono;
        return (
          <li key={i.id}>
            <Link href={i.href} data-tour={i.ancla} className="fila-toque rounded-[inherit]">
              <span className="fila-icono" aria-hidden>
                <Icono strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("fila-titulo block line-clamp-2", i.importante && "font-extrabold")}>{i.titulo}</span>
                <span className="fila-sub block">{i.sub}</span>
                <span className="mt-1.5 block">
                  <Sello estado={i.sello} texto={i.selloTexto} />
                </span>
              </span>
              <ChevronRight aria-hidden className="-mr-1.5 size-5 shrink-0 text-tinta-2" strokeWidth={2.2} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
