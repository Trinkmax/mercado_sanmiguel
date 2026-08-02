import { cn } from "@/lib/utils";

type Variante = "pagado" | "pendiente" | "parcial" | "neutro";

const LABELS: Record<string, { texto: string; variante: Variante }> = {
  // cargos
  pagado: { texto: "Pagado", variante: "pagado" },
  pendiente: { texto: "Pendiente", variante: "pendiente" },
  parcial: { texto: "Parcial", variante: "parcial" },
  anulado: { texto: "Anulado", variante: "neutro" },
  vencido: { texto: "Vencido", variante: "pendiente" },
  // cajas
  abierta: { texto: "Abierta", variante: "parcial" },
  cerrada: { texto: "Cerrada", variante: "neutro" },
  validada: { texto: "Validada", variante: "pagado" },
  // cheques
  en_cartera: { texto: "En cartera", variante: "parcial" },
  depositado: { texto: "Depositado", variante: "neutro" },
  acreditado: { texto: "Acreditado", variante: "pagado" },
  rechazado: { texto: "Rechazado", variante: "pendiente" },
  // sanciones
  sancion: { texto: "Sanción", variante: "pendiente" },
  notificacion: { texto: "Notificación", variante: "neutro" },
  // deuda
  al_dia: { texto: "Al día", variante: "pagado" },
  debe: { texto: "Debe", variante: "pendiente" },
};

/**
 * Sello de goma de estado, como en la carpeta de papel.
 * Verde = pagado/ok · Rojo = pendiente/debe · Ámbar = parcial/abierta.
 * Uso: <Sello estado="pagado" /> o <Sello estado="pendiente" grande />
 */
export function Sello({
  estado,
  texto,
  grande = false,
  className,
}: {
  estado: string;
  texto?: string;
  grande?: boolean;
  className?: string;
}) {
  const def = LABELS[estado] ?? { texto: estado, variante: "neutro" as Variante };
  return (
    <span
      className={cn(
        "sello",
        `sello-${def.variante}`,
        grande && "sello-grande",
        className
      )}
    >
      {texto ?? def.texto}
    </span>
  );
}
