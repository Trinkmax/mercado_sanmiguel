import { Truck } from "lucide-react";
import { ICONO_TARIFA, type IconoTarifa } from "@/components/porteria/tarifas";

/** El dibujo de una tarifa de transporte (camioneta, camión…); un camión si no se conoce. */
export function DibujoTarifa({
  icono,
  className,
  strokeWidth = 1.9,
}: {
  icono: IconoTarifa | string | null | undefined;
  className?: string;
  strokeWidth?: number;
}) {
  const Icono = icono && icono in ICONO_TARIFA ? ICONO_TARIFA[icono as IconoTarifa] : Truck;
  return <Icono className={className} strokeWidth={strokeWidth} aria-hidden />;
}
