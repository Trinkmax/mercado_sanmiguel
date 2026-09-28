import { diasHasta, formatFecha, SELLO_NIVEL_DEUDA, type NivelDeuda } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";

/**
 * Semáforo de la cuenta del socio (B3). Tres luces con la activa encendida y SIEMPRE el texto
 * (el color nunca es la única señal):
 *   verde  = al día · ámbar = debe pero en término (mantiene el beneficio) · rojo = algo vencido.
 * Los números salen de v_deuda_clientes + v_saldo_favor (misma regla que nivelDeuda()).
 */
export function SemaforoDeuda({
  nivel,
  aPagar,
  vencido,
  vencidoDesde,
  enTermino,
  proximoVencimiento,
  beneficio,
  saldoFavorAplicado,
  saldoFavorSobrante,
}: {
  nivel: NivelDeuda;
  /** Lo que tiene que pagar hoy, ya descontado el saldo a favor. */
  aPagar: number;
  /** Deuda vencida (sin beneficio). */
  vencido: number;
  vencidoDesde: string | null;
  /** Deuda todavía en término (con beneficio). */
  enTermino: number;
  proximoVencimiento: string | null;
  /** Cuánto se ahorra pagando a tiempo. */
  beneficio: number;
  saldoFavorAplicado: number;
  saldoFavorSobrante: number;
}) {
  const fondo =
    nivel === "al_dia"
      ? "bg-pagado-suave border-pagado/30"
      : nivel === "en_termino"
        ? "bg-parcial-suave border-parcial/40"
        : "bg-pendiente-suave border-pendiente/30";

  return (
    <section
      aria-label="Estado de tu cuenta"
      className={cn("flex items-stretch gap-4 rounded-xl border-2 p-4 sm:gap-6 sm:p-6", fondo)}
    >
      <Luces nivel={nivel} />

      <div className="min-w-0 flex-1 space-y-3 self-center">
        <Sello estado={SELLO_NIVEL_DEUDA[nivel]} />

        {nivel === "al_dia" ? (
          <div className="space-y-1">
            <p className="font-display text-2xl font-bold tracking-tight text-pagado">
              Estás al día
            </p>
            <p className="text-[15px]">
              {saldoFavorAplicado > 0
                ? "Tu saldo a favor cubre lo que debías. ¡Gracias!"
                : "No debés nada. ¡Gracias!"}
            </p>
          </div>
        ) : nivel === "en_termino" ? (
          <div className="space-y-1">
            <Money monto={aPagar} className="block text-3xl font-bold text-parcial" />
            <p className="text-lg leading-snug">
              para pagar antes del{" "}
              <span className="font-semibold tabular">{formatFecha(proximoVencimiento)}</span>
            </p>
            {proximoVencimiento ? (
              <p className="text-[15px] font-medium">{textoDias(diasHasta(proximoVencimiento))}</p>
            ) : null}
            {beneficio > 0 ? (
              <p className="border-t border-parcial/30 pt-2 text-[15px]">
                Pagando a tiempo mantenés el beneficio de{" "}
                <Money monto={beneficio} className="font-semibold" />.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-1">
            <Money monto={aPagar} className="block text-3xl font-bold text-pendiente" />
            <p className="text-lg leading-snug">es lo que tenés que pagar hoy</p>
            <p className="border-t border-pendiente/20 pt-2 text-[15px]">
              <Money monto={vencido} className="font-semibold" /> vencido desde el{" "}
              <span className="tabular">{formatFecha(vencidoDesde)}</span>: perdiste el beneficio.
            </p>
            {enTermino > 0.009 && proximoVencimiento ? (
              <p className="text-[15px]">
                <Money monto={enTermino} className="font-semibold" /> vence el{" "}
                <span className="tabular">{formatFecha(proximoVencimiento)}</span>
                {beneficio > 0 ? (
                  <>
                    {" "}
                    (pagándolo antes ahorrás <Money monto={beneficio} />)
                  </>
                ) : null}
                .
              </p>
            ) : null}
          </div>
        )}

        {saldoFavorAplicado > 0 && nivel !== "al_dia" ? (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <Sello estado="saldo_favor" />
            <span>
              Ya descontamos tus <Money monto={saldoFavorAplicado} className="font-semibold" /> a favor.
            </span>
          </p>
        ) : null}
        {saldoFavorSobrante > 0 ? (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <Sello estado="saldo_favor" />
            <span>
              Te quedan <Money monto={saldoFavorSobrante} className="font-semibold text-pagado" /> a
              favor: se aplican solos a los próximos cargos.
            </span>
          </p>
        ) : null}
      </div>
    </section>
  );
}

function textoDias(dias: number): string {
  if (dias <= 0) return "Vence hoy";
  if (dias === 1) return "Te queda 1 día";
  return `Te quedan ${dias} días`;
}

/** Las tres luces: rojo arriba, ámbar al medio, verde abajo (como un semáforo de verdad). */
function Luces({ nivel }: { nivel: NivelDeuda }) {
  const luces: { clave: NivelDeuda; encendida: string; apagada: string }[] = [
    { clave: "vencido", encendida: "bg-pendiente ring-pendiente/25", apagada: "bg-pendiente/15" },
    { clave: "en_termino", encendida: "bg-parcial ring-parcial/25", apagada: "bg-parcial/15" },
    { clave: "al_dia", encendida: "bg-pagado ring-pagado/25", apagada: "bg-pagado/15" },
  ];
  return (
    <div
      aria-hidden
      className="flex shrink-0 flex-col items-center justify-center gap-2.5 rounded-full bg-foreground/85 px-2.5 py-3.5"
    >
      {luces.map((l) => (
        <span
          key={l.clave}
          className={cn(
            "block size-8 rounded-full transition-colors sm:size-9",
            l.clave === nivel ? cn("ring-4", l.encendida) : l.apagada
          )}
        />
      ))}
    </div>
  );
}
