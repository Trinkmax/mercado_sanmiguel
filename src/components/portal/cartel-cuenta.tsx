import { Check, Tag } from "lucide-react";
import { formatARS, formatFechaLarga, redondear2 } from "@/lib/format";
import { fraccionAvance } from "@/lib/segmentos";
import { Money } from "@/components/shared/money";
import { cn } from "@/lib/utils";
import {
  anchoMontoEm,
  diaEnPalabras,
  nombreCuotas,
  sinComa,
  textoDias,
  type Cuenta,
} from "./armar-cuenta";
import { AbanicoAlDia } from "./abanico";

/**
 * El cartel: cómo está la cuenta, en grande y en su color. Se lee de un vistazo, de pie y con
 * una mano ocupada: primero la frase, después el monto a todo el ancho, después hasta cuándo.
 * El color nunca es la única señal: la frase dice lo mismo.
 */

const ANCLA_NIVEL = {
  al_dia: "portal-cuenta-al-dia",
  en_termino: "portal-cuenta-en-termino",
  vencido: "portal-cuenta-vencido",
} as const;

/** El monto como en los precios del mercado: los centavos chicos y arriba, y llena el ancho. */
export function MontoCartel({ monto, className }: { monto: number; className?: string }) {
  const texto = formatARS(monto);
  const [entero, centavos] = texto.split(",");
  const em = anchoMontoEm(entero) + (centavos ? 0.5 : 0) + 0.04;
  return (
    <span className={cn("cartel-monto", className)} style={{ "--em": em } as React.CSSProperties}>
      {entero}
      {centavos ? (
        <sup>
          <span className="sr-only">,</span>
          {centavos}
        </sup>
      ) : null}
    </span>
  );
}

export function CartelCuenta({ cuenta }: { cuenta: Cuenta }) {
  const { nivel, avance } = cuenta;
  return (
    <section
      aria-label="Cómo está tu cuenta"
      data-tour={`portal-cartel ${ANCLA_NIVEL[nivel]}`}
      className={cn("cartel cartel-entra", `tono-${nivel}`)}
    >
      <div className="relative flex flex-col gap-2">
        {nivel === "al_dia" ? (
          <AlDia cuenta={cuenta} />
        ) : nivel === "vencido" ? (
          <Vencido cuenta={cuenta} />
        ) : cuenta.principal > 0.009 ? (
          <ATiempo cuenta={cuenta} />
        ) : (
          <SoloPlan cuenta={cuenta} />
        )}

        {/* En rojo manda lo vencido: las cuotas del mes van más abajo, en «Lo de noviembre». */}
        {nivel !== "vencido" && avance && Number(avance.falta) > 0.009 && Number(avance.cuotas) > 1 ? (
          <div className="cartel-separador mt-1 pt-2.5">
            <CuotasDelMes avance={avance} />
          </div>
        ) : null}

        {cuenta.favorAplicado > 0.009 && nivel !== "al_dia" ? (
          <p data-tour="portal-saldo-favor" className="cartel-linea text-[1.02rem]">
            Ya te descontamos <Money monto={cuenta.favorAplicado} className="font-extrabold" /> que tenías a favor.
          </p>
        ) : null}
        {cuenta.favorSobrante > 0.009 ? (
          <p data-tour="portal-saldo-favor" className="cartel-linea text-[1.02rem]">
            Te quedan <Money monto={cuenta.favorSobrante} className="font-extrabold" /> a favor: se usan solos en lo
            próximo.
          </p>
        ) : null}
        {cuenta.plan > 0.009 && cuenta.principal > 0.009 ? (
          <p className="cartel-linea text-[1.02rem]">
            Además, de tu plan de pago te quedan <Money monto={cuenta.plan} className="font-extrabold" />.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function AlDia({ cuenta }: { cuenta: Cuenta }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[3.05rem] leading-[0.98] font-extrabold tracking-[-0.022em] [font-stretch:86%]">
            Estás
            <br />
            al día
          </h2>
        </div>
        <AbanicoAlDia className="mt-1 w-[7.2rem] shrink-0" />
      </div>
      <p className="cartel-linea">
        {cuenta.favorAplicado > 0.009 ? "Tu saldo a favor cubre lo que debías. ¡Gracias!" : "No debés nada. ¡Gracias!"}
      </p>
    </>
  );
}

function ATiempo({ cuenta }: { cuenta: Cuenta }) {
  const fecha = cuenta.proximoVencimiento;
  return (
    <>
      <h2 className="cartel-estado">Estás a tiempo</h2>
      <p className="-mt-1">
        <MontoCartel monto={cuenta.principal} />
      </p>
      {fecha ? (
        <>
          <p className="cartel-linea -mt-1">
            para pagar{" "}
            {diaEnPalabrasVa(fecha)} <strong>{diaEnPalabras(fecha)}</strong>
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-0.5">
            <span className="sello-tinta text-[1rem]">{textoDias(fecha)}</span>
          </div>
        </>
      ) : (
        <p className="cartel-linea -mt-1">es lo que tenés para pagar</p>
      )}
      {cuenta.beneficio > 0.009 ? (
        <p data-tour="portal-beneficio" className="cartel-linea flex items-start gap-2 pt-0.5">
          <Tag aria-hidden className="mt-1 size-[1.15rem] shrink-0" strokeWidth={2.4} />
          <span>
            Ya incluye tu beneficio de <Money monto={cuenta.beneficio} className="font-extrabold" /> por pagar a tiempo
          </span>
        </p>
      ) : null}
    </>
  );
}

/** "hasta el domingo 30 de noviembre" · "hoy" y "mañana" sin artículo. */
function diaEnPalabrasVa(iso: string): string {
  const d = diaEnPalabras(iso);
  return d === "hoy" || d === "mañana" ? "hasta" : "hasta el";
}

function Vencido({ cuenta }: { cuenta: Cuenta }) {
  // Lo que hay que pagar hoy es lo vencido; lo que todavía no venció va aparte, con su fecha.
  const fecha = cuenta.proximoVencimiento;
  const haySeparado = cuenta.vencido > 0.009;
  return (
    <>
      <h2 className="cartel-estado">Tenés algo vencido</h2>
      <p className="-mt-1">
        <MontoCartel monto={haySeparado ? cuenta.vencido : cuenta.principal} />
      </p>
      {haySeparado ? (
        <p className="cartel-linea -mt-1">
          {cuenta.vencidoDesde ? (
            <>
              {cuenta.vencidoVariasFechas ? "vencido desde el" : "se venció el"}{" "}
              <strong>{sinComa(formatFechaLarga(cuenta.vencidoDesde))}</strong>.
            </>
          ) : (
            "ya se venció."
          )}
          {cuenta.perdioBeneficio ? (
            <span data-tour="portal-beneficio-perdido"> Perdiste el beneficio de esa parte.</span>
          ) : null}
        </p>
      ) : (
        <p className="cartel-linea -mt-1">es lo que tenés para pagar</p>
      )}
      {haySeparado && cuenta.enTermino > 0.009 ? (
        <p className="cartel-separador cartel-linea mt-1 pt-2.5 text-[1.05rem]">
          Además, <Money monto={cuenta.enTermino} className="font-extrabold" /> vence{" "}
          {fecha ? (
            <>
              {diaEnPalabrasVa(fecha) === "hasta" ? "" : "el "}
              <strong>{diaEnPalabras(fecha)}</strong>
            </>
          ) : (
            "más adelante"
          )}
          {cuenta.beneficio > 0.009 ? (
            <>
              , ya con tu beneficio de <Money monto={cuenta.beneficio} className="font-extrabold" />
            </>
          ) : null}
          .
        </p>
      ) : null}
    </>
  );
}

function SoloPlan({ cuenta }: { cuenta: Cuenta }) {
  return (
    <>
      <h2 className="cartel-estado">Vas con tu plan de pago</h2>
      <p className="-mt-1">
        <MontoCartel monto={cuenta.plan} />
      </p>
      <p className="cartel-linea -mt-1">
        es lo que te queda del plan. Lo del mes está al día y no perdés el beneficio.
      </p>
    </>
  );
}

/** El mes en azulejos, para quien paga en partes: los llenos ya están pagos. */
export function CuotasDelMes({ avance }: { avance: NonNullable<Cuenta["avance"]> }) {
  const cuotas = Math.max(1, Number(avance.cuotas));
  const cubiertas = Number(avance.cuotas_cubiertas);
  const frac = fraccionAvance(avance);
  // La misma cuota que le sugiere Cobrar a quien le cobra.
  const sugerida = redondear2(Number(avance.cuota_sugerida));
  const nombre = nombreCuotas(avance);
  const ultima = cuotas - cubiertas <= 1;
  // Hasta 15 por renglón: 4 semanas son azulejos grandes; 30 días, dos filas de chiquitos.
  const columnas = cuotas <= 15 ? cuotas : Math.ceil(cuotas / 2);
  const alto = cuotas <= 6 ? "1.85rem" : cuotas <= 15 ? "1.3rem" : "0.82rem";
  const monto = <Money monto={sugerida} className="font-extrabold" />;

  return (
    <div data-tour="portal-cuotas" className="flex flex-col gap-2">
      <div
        role="img"
        aria-label={`Pagaste ${cubiertas} de ${cuotas} ${nombre.varios}`}
        className={cn("mosaico", cuotas > 15 && "mosaico-chico")}
        style={{ "--columnas": columnas, "--alto-azulejo": alto } as React.CSSProperties}
      >
        {Array.from({ length: cuotas }).map((_, i) => {
          const lleno = Math.min(1, Math.max(0, frac * cuotas - i));
          return (
            <span key={i} className="azulejo">
              <i style={{ "--lleno": `${lleno * 100}%` } as React.CSSProperties} />
              {lleno >= 1 && cuotas <= 6 ? <Check strokeWidth={3.4} aria-hidden /> : null}
            </span>
          );
        })}
      </div>
      <p className="cartel-linea">
        <strong>
          {cubiertas === 0 ? `Son ${cuotas} ${nombre.varios}` : `Pagaste ${cubiertas} de ${cuotas} ${nombre.varios}`}
        </strong>
        {sugerida > 0.009 ? (
          <>
            {cubiertas === 0 ? ": " : " · "}
            {ultima ? <>te queda la última, de {monto}</> : <>la próxima es de {monto}</>}
          </>
        ) : null}
      </p>
    </div>
  );
}

/** El cartel mientras carga: mismo lugar y mismo tamaño, para que no salte nada. */
export function CartelCargando() {
  return (
    <div aria-hidden className="cartel tono-neutro">
      <div className="relative flex flex-col gap-3">
        <div className="esqueleto-sobre-campo h-7 w-44" />
        <div className="esqueleto-sobre-campo h-16 w-full" />
        <div className="esqueleto-sobre-campo h-6 w-3/4" />
        <div className="esqueleto-sobre-campo h-8 w-40" />
      </div>
    </div>
  );
}
