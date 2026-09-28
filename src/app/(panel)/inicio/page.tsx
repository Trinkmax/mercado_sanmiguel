import Link from "next/link";
import { redirect } from "next/navigation";
import { HandCoins } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLES_COBRAN } from "@/lib/roles";
import { formatFechaLarga, hoyISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { InicioJefe } from "./inicio-jefe";
import { InicioTesoreria } from "./inicio-tesoreria";
import { InicioGestion } from "./inicio-gestion";

export const metadata = { title: "Inicio" };

/**
 * Inicio del staff, uno por rol (§6 M8.5):
 * - Jefe de Portería: quintas del mes + ambulantes + caja de portería de hoy (sin ingresos de personal, G1).
 * - Tesorería: estimado vs cobrado del mes, sin Cobrar ni caja propia (J1, J4).
 * - Administración y Líder: caja, cobranza del mes y avisos; el Líder además su
 *   escritorio, la plata de hoy y las correcciones de la semana.
 * - Portería arranca en /porteria.
 */
export default async function InicioPage() {
  const perfil = await requireStaff();
  if (perfil.rol === "porteria") redirect("/porteria");

  const supabase = await createClient();
  const puedeCobrar = ROLES_COBRAN.includes(perfil.rol);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground first-letter:uppercase">{formatFechaLarga(hoyISO())}</p>
          <h1 className="font-display text-[1.7rem] font-extrabold tracking-tight">
            Hola, {perfil.nombre.split(" ")[0]}
          </h1>
        </div>
        {puedeCobrar ? (
          <Button asChild size="lg" className="h-13 px-6 text-base font-semibold">
            <Link href="/cobranza">
              <HandCoins className="size-5" />
              Cobrar
            </Link>
          </Button>
        ) : null}
      </div>

      {perfil.rol === "guardia" ? (
        <InicioJefe perfil={perfil} supabase={supabase} />
      ) : perfil.rol === "tesoreria" ? (
        <InicioTesoreria perfil={perfil} supabase={supabase} />
      ) : (
        <InicioGestion perfil={perfil} supabase={supabase} />
      )}
    </div>
  );
}
