import Link from "next/link";
import { ChevronRight, Receipt } from "lucide-react";
import { CajaRegistradora } from "@/components/shared/iconos";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { cajaDeHoy, type CajaHoy, type Supabase } from "./datos";
import { DesgloseCajaPorteria } from "./bloques";

/**
 * "Plata de hoy" del Líder (control del dueño): cuánto entró en Administración y
 * en la caja de portería (Quintas · Ambulantes · Bono camioneros) y cuánto salió
 * en gastos pagados desde las cajas. Todo sale de `arqueo_caja` (la misma cuenta
 * que ve cada caja).
 */
export async function PlataDeHoy({ org, supabase }: { org: string; supabase: Supabase }) {
  const [admin, porteria] = await Promise.all([
    cajaDeHoy(supabase, org, "administracion"),
    cajaDeHoy(supabase, org, "guardia"),
  ]);

  // Administración: lo que cobró ella (lo rendido por portería ya se cuenta en portería).
  const cobradoAdmin = admin?.arqueo?.cobros ?? 0;
  const juntadoPorteria = (porteria?.arqueo?.cobros ?? 0) + (porteria?.arqueo?.canon ?? 0);
  const gastos = (admin?.arqueo?.gastos_pagados ?? 0) + (porteria?.arqueo?.gastos_pagados ?? 0);
  const entro = cobradoAdmin + juntadoPorteria;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Plata de hoy</CardTitle>
        <CardDescription>Lo que entró en las dos cajas y lo que salió en gastos.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Entró hoy</p>
          <Money monto={entro} className="font-display text-3xl font-extrabold text-pagado" />
        </div>
        <ul className="divide-y rounded-lg border">
          <FilaCaja
            titulo="Administración"
            caja={admin}
            monto={admin && !admin.arqueo ? null : cobradoAdmin}
            href="/caja?tipo=administracion"
          />
          <FilaCaja
            titulo="Caja de portería"
            caja={porteria}
            monto={porteria && !porteria.arqueo ? null : juntadoPorteria}
            href="/caja?tipo=guardia"
          >
            {porteria?.arqueo ? (
              <DesgloseCajaPorteria
                quintas={porteria.arqueo.quintas}
                ambulantes={porteria.arqueo.ambulantes}
                canon={porteria.arqueo.canon}
                className="mt-2"
              />
            ) : null}
          </FilaCaja>
          <li className="flex items-center justify-between gap-3 px-3 py-3">
            <span className="flex min-w-0 items-center gap-2 text-sm">
              <Receipt className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
              Gastos pagados desde las cajas
            </span>
            <Money
              monto={gastos}
              className={
                gastos > 0 ? "shrink-0 text-base font-semibold text-pendiente" : "shrink-0 text-base text-muted-foreground"
              }
            />
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}

function FilaCaja({
  titulo,
  caja,
  monto,
  href,
  children,
}: {
  titulo: string;
  caja: CajaHoy | null;
  /** null = la caja existe pero no se pudo leer su arqueo. */
  monto: number | null;
  href: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="px-3 py-3">
      {/* El nombre de la caja en su renglón y el sello debajo: en la columna angosta del
          escritorio no se aprietan con el monto. */}
      <Link
        href={href}
        className="-mx-1 flex min-h-11 items-center justify-between gap-3 rounded-md px-1 py-1 hover:bg-muted/60"
      >
        <span className="flex min-w-0 items-start gap-2">
          <CajaRegistradora className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 space-y-1">
            <span className="block text-sm font-medium">{titulo}</span>
            {caja ? (
              <Sello estado={caja.estado} />
            ) : (
              <span className="block text-sm text-muted-foreground">Sin abrir</span>
            )}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {monto === null ? (
            <span className="text-sm text-muted-foreground">sin datos</span>
          ) : (
            <Money monto={monto} className="text-base font-semibold" />
          )}
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
        </span>
      </Link>
      {children}
    </li>
  );
}
