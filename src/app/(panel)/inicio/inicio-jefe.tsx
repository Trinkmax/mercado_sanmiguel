import Link from "next/link";
import { ArrowRight, Footprints, HandCoins, MessagesSquare, Tractor } from "lucide-react";
import type { Perfil } from "@/lib/auth";
import { labelPeriodo, periodoActual } from "@/lib/format";
import { CajaRegistradora } from "@/components/shared/iconos";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { cajaDeHoy, contar, resumenDelMes, type Supabase } from "./datos";
import { DesgloseCajaPorteria, TarjetaAviso, type Aviso } from "./bloques";

/**
 * Inicio del Jefe de Portería (G1, G5): sin ingresos de personal. Lo que importa
 * del mes es cuánto falta cobrar de las quintas (misma cuenta que Cobrar y el Mapa:
 * `v_avance_mes`) y lo que entró de ambulantes; al costado, la caja de portería
 * de hoy con su desglose.
 */
export async function InicioJefe({ perfil, supabase }: { perfil: Perfil; supabase: Supabase }) {
  const org = perfil.org_id;
  const periodo = periodoActual();

  const [resumen, quinterosRes, avanceRes, caja, paraResolver] = await Promise.all([
    resumenDelMes(supabase, periodo),
    supabase
      .from("clientes")
      .select("id")
      .eq("org_id", org)
      .eq("categoria", "quintero")
      .eq("activo", true),
    supabase
      .from("v_avance_mes")
      .select("cliente_id, total, falta")
      .eq("org_id", org)
      .eq("periodo", periodo),
    cajaDeHoy(supabase, org, "guardia"),
    contar(
      supabase
        .from("solicitudes")
        .select("id", { count: "exact", head: true })
        .eq("org_id", org)
        .eq("estado", "con_jefe")
    ),
  ]);

  const expq = resumen.find((f) => f.codigo === "EXPQ");
  const amb = resumen.find((f) => f.codigo === "AMB");
  const quinteros = new Set((quinterosRes.data ?? []).map((c) => c.id));
  const avanceQuinteros = (avanceRes.data ?? []).filter(
    (a) => a.cliente_id && quinteros.has(a.cliente_id) && Number(a.total ?? 0) > 0
  );
  const alDia = avanceQuinteros.filter((a) => Number(a.falta ?? 0) <= 0.009).length;
  const deben = avanceQuinteros.length - alDia;

  const estimado = Number(expq?.estimado ?? 0);
  const cobrado = Number(expq?.cobrado ?? 0);
  const falta = Math.max(estimado - cobrado - Number(expq?.descuentos ?? 0), 0);
  const pct = estimado > 0 ? Math.min((cobrado / estimado) * 100, 100) : 0;
  const mesGenerado = Boolean(expq) || avanceQuinteros.length > 0;

  const avisos: Aviso[] = [
    {
      clave: "con_jefe",
      n: paraResolver,
      singular: "solicitud de Portería para resolver",
      plural: "solicitudes de Portería para resolver",
      descripcion: "Resolvela vos o elevala al Líder de Procesos.",
      href: "/solicitudes",
      cta: "Ver",
      icono: MessagesSquare,
      tono: "parcial" as const,
    },
  ].filter((a) => a.n > 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      {/* Principal: las quintas del mes y los ambulantes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Tractor className="size-5 text-primary" strokeWidth={2} />
            Quintas de {labelPeriodo(periodo)}
          </CardTitle>
          <CardDescription>Lo que se cobró de la quinta del mes y lo que falta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {mesGenerado && estimado > 0 ? (
            <div className="space-y-3">
              <p className="text-base">
                Se cobró <Money monto={cobrado} className="font-display text-3xl font-extrabold text-pagado" />{" "}
                <span className="text-muted-foreground">
                  de <Money monto={estimado} className="font-semibold text-foreground" />
                </span>
              </p>
              <div
                className="h-4 overflow-hidden rounded-full bg-pendiente-suave"
                role="progressbar"
                aria-valuenow={Math.round(pct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Quintas: cobrado ${Math.round(pct)} %`}
              >
                <div className="h-full rounded-full bg-pagado" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {falta > 0.009 ? (
                  <p className="text-base font-semibold text-pendiente">
                    Faltan <Money monto={falta} />
                  </p>
                ) : (
                  <Sello estado="al_dia" texto="Cobrado completo" />
                )}
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <Sello estado="al_dia" texto={`${alDia} al día`} />
                  {deben > 0 ? <Sello estado="debe" texto={`${deben} ${deben === 1 ? "debe" : "deben"}`} /> : null}
                </p>
              </div>
            </div>
          ) : (
            <p className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              {labelPeriodo(periodo)} todavía no se generó. Cuando Administración lo genere vas a
              ver acá cuánto falta cobrar de cada quinta.
            </p>
          )}

          <Button asChild size="lg" className="h-12 w-full px-5 text-base font-semibold sm:w-auto">
            <Link href="/cobranza?cat=quintero">
              <HandCoins className="size-5" strokeWidth={2} />
              Cobrar a un quintero
            </Link>
          </Button>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-primary">
                <Footprints className="size-5" strokeWidth={2} />
              </span>
              <div>
                <p className="text-sm text-muted-foreground">Ambulantes cobrados este mes</p>
                <Money monto={Number(amb?.cobrado ?? 0)} className="font-display text-2xl font-bold" />
              </div>
            </div>
            <Button asChild size="lg" variant="outline" className="h-12 px-5 text-base">
              <Link href="/cobranza?cat=ambulante">
                <Footprints className="size-5" strokeWidth={2} />
                Cobrar a un ambulante
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lateral: la caja de portería de hoy y lo que espera al Jefe */}
      <div className="space-y-6 max-lg:order-first">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Caja de portería de hoy</CardTitle>
            {caja ? (
              <CardAction>
                <Sello estado={caja.estado} />
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {caja ? (
              <>
                {caja.arqueo ? (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {caja.estado === "abierta" ? "En la caja, en efectivo" : "Rendiste en efectivo"}
                      </p>
                      <Money monto={caja.arqueo.efectivo} className="font-display text-3xl font-extrabold" />
                      {caja.arqueo.transferencia > 0 ? (
                        <p className="text-sm text-muted-foreground">
                          y <Money monto={caja.arqueo.transferencia} /> por transferencia
                        </p>
                      ) : null}
                    </div>
                    <DesgloseCajaPorteria
                      quintas={caja.arqueo.quintas}
                      ambulantes={caja.arqueo.ambulantes}
                      canon={caja.arqueo.canon}
                      className="rounded-lg border px-3 py-2.5"
                    />
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No pudimos leer los números de la caja. Abrila para verlos.
                  </p>
                )}
                <Button asChild variant="outline" className="min-h-11 w-full text-base">
                  <Link href="/caja">
                    Ir a la caja
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Todavía no hay caja de portería hoy. Se abre sola con el primer cobro
                  (tuyo o del canon de Portería).
                </p>
                <Button asChild variant="outline" className="min-h-11 w-full text-base">
                  <Link href="/caja">
                    <CajaRegistradora className="size-5" />
                    Ir a la caja
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {avisos.map((aviso) => (
          <TarjetaAviso key={aviso.clave} aviso={aviso} />
        ))}
      </div>
    </div>
  );
}
