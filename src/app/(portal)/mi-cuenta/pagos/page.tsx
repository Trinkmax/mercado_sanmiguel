import { requireRol } from "@/lib/auth";
import { getCargosSocio, getRecibosSocio } from "@/components/portal/datos-portal";
import { PantallaPagos } from "@/components/portal/pantallas/pantalla-pagos";

export const metadata = { title: "Mis pagos" };

export default async function PagosPage() {
  const perfil = await requireRol("socio");
  const [recibos, cargos] = await Promise.all([getRecibosSocio(perfil.user_id), getCargosSocio(perfil.user_id)]);
  return <PantallaPagos recibos={recibos} cargos={cargos} />;
}
