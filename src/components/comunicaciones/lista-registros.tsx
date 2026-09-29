import Link from "next/link";
import { ChevronRight, Eye, EyeOff, UserX } from "lucide-react";
import { formatFecha, formatFechaHora } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import {
  estadoMulta,
  saldoMulta,
  SELLO_MULTA,
  selloEstadoRegistro,
  type CargoMulta,
  type TipoRegistro,
} from "./constantes";

export type RegistroStaff = {
  id: string;
  numero: number;
  tipo: TipoRegistro;
  titulo: string;
  fecha: string;
  estado: string;
  visto_en: string | null;
  ultimo_mensaje_en: string | null;
  creado_en: string;
  multa: number | null;
  multa_sin_efecto_en: string | null;
  cargo: CargoMulta;
  cliente: { id: string; codigo: number; nombre: string; apodo: string | null };
  lugar: string | null;
  tienePortal: boolean;
};

export type FiltroRegistros = "todas" | "esperan" | "sin_ver" | "respondidas" | "sin_efecto";

export function filtrarRegistros(lista: RegistroStaff[], filtro: FiltroRegistros): RegistroStaff[] {
  switch (filtro) {
    case "esperan":
      return lista.filter((r) => r.estado === "descargo");
    case "sin_ver":
      return lista.filter((r) => !r.visto_en && r.tienePortal);
    case "respondidas":
      return lista.filter((r) => r.estado === "respondido");
    case "sin_efecto":
      return lista.filter((r) => r.multa_sin_efecto_en);
    default:
      return lista;
  }
}

/**
 * Lo que espera respuesta va primero (el que espera hace más, arriba); después lo más nuevo
 * por la fecha que se ve en la fila (la del registro), y a igual fecha el número más alto.
 * Antes el resto iba por creado_en: con varios cargados juntos el orden quedaba al azar
 * (Notificaciones salía 1 y después 4, al revés que las demás pestañas).
 */
export function ordenarRegistros(lista: RegistroStaff[]): RegistroStaff[] {
  return [...lista].sort((a, b) => {
    const ea = a.estado === "descargo" ? 0 : 1;
    const eb = b.estado === "descargo" ? 0 : 1;
    if (ea !== eb) return ea - eb;
    if (ea === 0) return (a.ultimo_mensaje_en ?? "").localeCompare(b.ultimo_mensaje_en ?? "");
    return b.fecha.localeCompare(a.fecha) || b.creado_en.localeCompare(a.creado_en) || b.numero - a.numero;
  });
}

/** Filas-enlace de registros (panel y ficha del cliente). */
export function ListaRegistros({
  registros,
  mostrarCliente = true,
}: {
  registros: RegistroStaff[];
  mostrarCliente?: boolean;
}) {
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">
      {registros.map((r) => {
        const eMulta = estadoMulta(r);
        const espera = r.estado === "descargo";
        return (
          <li key={r.id}>
            <Link
              href={`/comunicaciones/registros/${r.id}`}
              className={cn(
                "flex min-h-16 items-start gap-3 px-4 py-3 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
                espera && "bg-pendiente-suave/40"
              )}
            >
              <span className="w-10 shrink-0 pt-0.5 text-right font-display text-lg font-bold tabular">
                <span className="sr-only">N° </span>
                {r.numero}
              </span>

              {/* En el celular el sello va adentro (arriba del texto) y el texto usa todo el ancho:
                  a la derecha dejaba ~190 px y el nombre ocupaba 3 renglones. */}
              <span className="min-w-0 flex-1 space-y-1">
                <Sello estado={selloEstadoRegistro(r)} className="sm:hidden" />
                {mostrarCliente ? (
                  <span className="block text-sm break-words">
                    <span className="font-semibold">{r.cliente.nombre}</span>
                    {r.cliente.apodo ? (
                      <span className="text-muted-foreground"> · {r.cliente.apodo}</span>
                    ) : null}
                    {r.lugar ? (
                      <span className="whitespace-nowrap text-muted-foreground"> · {r.lugar}</span>
                    ) : null}
                  </span>
                ) : null}
                <span className="block text-base leading-snug font-medium break-words">{r.titulo}</span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span className="tabular">{formatFecha(r.fecha)}</span>
                  {!r.tienePortal ? (
                    <span className="inline-flex items-center gap-1">
                      <UserX className="size-3.5" strokeWidth={2} />
                      Sin portal: avisale en persona
                    </span>
                  ) : r.visto_en ? (
                    <span className="inline-flex items-center gap-1 text-pagado">
                      <Eye className="size-3.5" strokeWidth={2} />
                      Lo vio el <span className="tabular">{formatFechaHora(r.visto_en)}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <EyeOff className="size-3.5" strokeWidth={2} />
                      Todavía no lo vio
                    </span>
                  )}
                </span>
                {eMulta !== "sin_multa" ? (
                  <span className="flex flex-wrap items-center gap-2 pt-0.5">
                    <Money
                      monto={eMulta === "parcial" ? saldoMulta(r) : r.multa}
                      className={cn(
                        "text-sm font-semibold",
                        eMulta === "sin_efecto" && "text-muted-foreground line-through",
                        eMulta === "pagada" && "text-pagado",
                        (eMulta === "pendiente" || eMulta === "parcial") && "text-pendiente"
                      )}
                    />
                    <Sello estado={SELLO_MULTA[eMulta].estado} texto={SELLO_MULTA[eMulta].texto} />
                  </span>
                ) : null}
              </span>

              <Sello estado={selloEstadoRegistro(r)} className="shrink-0 max-sm:hidden" />
              <ChevronRight
                className="mt-1 size-4 shrink-0 text-muted-foreground max-sm:hidden"
                strokeWidth={2}
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
