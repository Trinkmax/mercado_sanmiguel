import { ArrowDown, ArrowRight, Banknote, FileCheck2, MessagesSquare } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Rol } from "@/lib/auth";
import { LABEL_ROL } from "@/lib/roles";
import { cn } from "@/lib/utils";

/**
 * "Cómo encaja tu trabajo con el de los demás": los tres caminos de la cooperativa (la
 * plata, un cambio en una carpeta, una solicitud), paso por paso y quién hace cada uno.
 * Lo que hace el rol que mira queda resaltado con "Vos".
 */

type Etapa = {
  /** Quién la hace (se resalta si es el rol que mira). */
  roles: Rol[];
  /** Si nadie en particular (el sistema), un texto en lugar de roles. */
  quien?: string;
  hace: string;
};

type Flujo = {
  id: string;
  icono: LucideIcon;
  titulo: string;
  bajada: string;
  etapas: Etapa[];
  /** Roles que lo ven en su Guía. */
  para: Rol[];
};

const TODOS: Rol[] = ["admin", "guardia", "porteria", "tesoreria", "lider", "socio"];
const STAFF: Rol[] = ["admin", "guardia", "porteria", "tesoreria", "lider"];

export const FLUJOS: Flujo[] = [
  {
    id: "plata",
    icono: Banknote,
    titulo: "El camino de la plata",
    bajada: "Desde que alguien paga hasta que la plata queda controlada.",
    para: TODOS,
    etapas: [
      { roles: ["socio"], hace: "Paga su cuenta: en efectivo, por transferencia o con cheque" },
      {
        roles: ["admin", "guardia", "porteria", "lider"],
        hace: "Cobra y da el recibo (Portería cobra el canon de transporte)",
      },
      { roles: [], quien: "El sistema", hace: "Reparte el pago solo: primero lo más viejo; y en el cierre dice cuánto tiene que haber en la caja" },
      { roles: ["guardia"], hace: "Cierra la caja de portería y se la rinde a Administración" },
      { roles: ["admin"], hace: "La recibe, la suma a la caja mayor y cierra el día" },
      { roles: ["tesoreria"], hace: "Al día siguiente controla cada caja, le da el OK y concilia el banco" },
      { roles: ["lider"], hace: "Mira en Reportes cuánto entró y cuánto falta cobrar" },
    ],
  },
  {
    id: "cambio",
    icono: FileCheck2,
    titulo: "El camino de un cambio",
    bajada: "Un cliente nuevo, lo que paga cada uno o un precio: nada cambia sin aprobación.",
    para: STAFF,
    etapas: [
      {
        roles: ["admin", "guardia"],
        hace: "Propone el cambio (Administración: puesteros; Jefe de Portería: quinteros y ambulantes)",
      },
      { roles: ["lider"], hace: "Lo revisa en Aprobaciones y lo aprueba o lo rechaza" },
      { roles: [], quien: "El sistema", hace: "Lo aplica: queda en la carpeta del cliente con quién lo pidió y quién lo aprobó" },
      { roles: ["admin", "lider"], hace: "Genera el mes en Facturación: cada cliente paga lo que tiene en su carpeta" },
      { roles: ["admin", "guardia"], hace: "Cobra con los montos nuevos" },
    ],
  },
  {
    id: "solicitud",
    icono: MessagesSquare,
    titulo: "El camino de una solicitud",
    bajada: "Un pedido, un reclamo o una consulta, hasta que se resuelve.",
    para: TODOS,
    etapas: [
      {
        roles: ["socio", "admin", "tesoreria"],
        hace: "Hace el pedido: el socio desde su portal; Administración y Tesorería desde el sistema",
      },
      { roles: ["porteria"], hace: "Portería anota lo que pasa en la garita y lo imprime" },
      { roles: ["guardia"], hace: "El Jefe de Portería resuelve lo de Portería o se lo pasa al Líder" },
      { roles: ["lider"], hace: "La revisa y, si la tiene que decidir el Consejo, se la lleva" },
      { roles: ["lider"], hace: "Anota lo que resolvió el Consejo y se lo asigna a Administración" },
      { roles: ["admin"], hace: "Lo hace y la marca ejecutada: el socio ve la respuesta en su portal" },
    ],
  },
];

function EtapaFlujo({ etapa, numero, rol }: { etapa: Etapa; numero: number; rol: Rol }) {
  const vos = etapa.roles.includes(rol);
  const quien = etapa.quien ?? etapa.roles.filter((r) => r !== "consejo").map((r) => LABEL_ROL[r]).join(" · ");
  return (
    <div
      className={cn(
        "relative flex w-full min-w-0 flex-1 flex-col gap-1.5 self-stretch rounded-xl border p-3",
        vos ? "border-primary bg-primary text-primary-foreground shadow-[0_10px_24px_-14px_rgb(15_23_60/0.7)]" : "border-border bg-card"
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold tabular",
            vos ? "bg-white text-primary" : "bg-accent text-accent-foreground"
          )}
        >
          {numero}
        </span>
        <span className={cn("min-w-0 text-xs leading-tight font-semibold", vos ? "text-primary-foreground/90" : "text-muted-foreground")}>
          {quien}
        </span>
        {vos ? (
          <span className="ml-auto shrink-0 rounded-full bg-white px-2 py-0.5 text-[0.7rem] font-bold text-primary">Vos</span>
        ) : null}
      </div>
      <p className="text-sm leading-snug">{etapa.hace}</p>
    </div>
  );
}

export function FlujosProceso({ rol }: { rol: Rol }) {
  const flujos = FLUJOS.filter((f) => f.para.includes(rol));
  return (
    <div className="space-y-6">
      {flujos.map((f) => {
        const Icono = f.icono;
        return (
          <section key={f.id} aria-labelledby={`flujo-${f.id}`} className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Icono className="size-5" strokeWidth={2} />
              </span>
              <div>
                <h3 id={`flujo-${f.id}`} className="font-display text-lg leading-snug font-bold">
                  {f.titulo}
                </h3>
                <p className="text-sm text-muted-foreground">{f.bajada}</p>
              </div>
            </div>
            <ol className="flex flex-col xl:flex-row xl:items-stretch">
              {f.etapas.map((e, i) => (
                <li key={i} className="flex min-w-0 flex-col items-center xl:flex-1 xl:flex-row">
                  <EtapaFlujo etapa={e} numero={i + 1} rol={rol} />
                  {i < f.etapas.length - 1 ? (
                    <span aria-hidden className="flex shrink-0 items-center justify-center py-1 text-muted-foreground xl:px-1 xl:py-0">
                      <ArrowDown className="size-4 xl:hidden" strokeWidth={2.2} />
                      <ArrowRight className="hidden size-4 xl:block" strokeWidth={2.2} />
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
