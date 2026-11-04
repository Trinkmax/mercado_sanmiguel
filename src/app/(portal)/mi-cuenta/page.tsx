import { UserX } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { aLugarPlano } from "@/components/portal/armar-cuenta";
import { PantallaCuenta } from "@/components/portal/pantallas/pantalla-cuenta";
import {
  getClienteSocio,
  getCuentaSocio,
  getLugaresSocio,
  getPendientesSocio,
  getRecibosSocio,
} from "@/components/portal/datos-portal";

export const metadata = { title: "Mi cuenta" };

export default async function MiCuentaPage() {
  const perfil = await requireRol("socio");
  const cliente = await getClienteSocio(perfil.user_id);

  if (!cliente) {
    return (
      <>
        <div className="portal-espacio" aria-hidden />
        <section className="cartel tono-neutro">
          <div className="relative flex flex-col gap-2">
            <UserX aria-hidden className="size-9" strokeWidth={2} />
            <h1 className="cartel-estado">Tu usuario no está unido a tu carpeta</h1>
            <p className="cartel-linea">Pedí en Administración que te unan a tu carpeta y vas a ver tu cuenta acá.</p>
          </div>
        </section>
        <div className="portal-suelo" />
      </>
    );
  }

  const [cuenta, lugares, recibos, pendientes] = await Promise.all([
    getCuentaSocio(perfil.user_id),
    getLugaresSocio(perfil.user_id),
    getRecibosSocio(perfil.user_id),
    getPendientesSocio(perfil.user_id),
  ]);
  if (!cuenta) return null;

  return (
    <PantallaCuenta
      cuenta={cuenta}
      planoLugares={lugares.map(aLugarPlano)}
      ultimo={recibos[0] ?? null}
      nuevos={pendientes.length}
      aResponder={pendientes.filter((p) => p.aResponder).length}
      avisoHref={pendientes.length === 1 ? pendientes[0].href : "/mi-cuenta/mensajes"}
      categoria={cliente.categoria}
    />
  );
}
