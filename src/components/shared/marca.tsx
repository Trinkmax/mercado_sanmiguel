import Image from "next/image";
import { cn } from "@/lib/utils";
import logo from "../../../public/logo.png";

/**
 * Marca de la cooperativa: isologo real (mosaico) + nombre.
 * El texto hereda el color del contexto (crema en la barra, tinta en papel).
 */
export function Marca({
  className,
  compacta = false,
}: {
  className?: string;
  compacta?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Image
        src={logo}
        alt="Mercado San Miguel"
        className={cn("w-auto shrink-0", compacta ? "h-5" : "h-8")}
        priority
      />
      <div className="font-display leading-tight">
        <span
          className={cn(
            "block font-extrabold",
            compacta ? "text-[13px]" : "text-[15px]"
          )}
        >
          Mercado San Miguel
        </span>
        {compacta ? null : (
          <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.16em] opacity-75">
            Cooperativa Frutihortícola
          </span>
        )}
      </div>
    </div>
  );
}
