import { cn } from "@/lib/utils";

type Variante = "pagado" | "pendiente" | "parcial" | "neutro" | "info";

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
  integrada: { texto: "En caja mayor", variante: "info" },
  validada: { texto: "Validada", variante: "pagado" },
  reapertura_pedida: { texto: "Pide reapertura", variante: "parcial" },
  // cheques
  en_cartera: { texto: "En cartera", variante: "parcial" },
  listo_depositar: { texto: "Listo para depositar", variante: "info" },
  depositado: { texto: "Depositado", variante: "neutro" },
  acreditado: { texto: "Acreditado", variante: "pagado" },
  rechazado: { texto: "Rechazado", variante: "pendiente" },
  // transferencias (conciliación de tesorería)
  conciliado: { texto: "Conciliada", variante: "pagado" },
  sin_conciliar: { texto: "Sin conciliar", variante: "parcial" },
  // comprobantes de gastos
  comprobante_ok: { texto: "Comprobante OK", variante: "pagado" },
  sin_validar: { texto: "Sin validar", variante: "parcial" },
  sin_factura: { texto: "Sin factura", variante: "pendiente" },
  // registros documentales del cliente
  sancion: { texto: "Sanción", variante: "pendiente" },
  notificacion: { texto: "Notificación", variante: "neutro" },
  apercibimiento: { texto: "Apercibimiento", variante: "parcial" },
  circular: { texto: "Circular", variante: "info" },
  recibida: { texto: "Recibida", variante: "pagado" },
  sin_recibir: { texto: "Sin confirmar", variante: "pendiente" },
  // deuda / cuenta corriente
  al_dia: { texto: "Al día", variante: "pagado" },
  debe: { texto: "Debe", variante: "pendiente" },
  saldo_favor: { texto: "Saldo a favor", variante: "pagado" },
  // solicitudes (ex peticiones)
  nueva: { texto: "Nueva", variante: "parcial" },
  en_revision: { texto: "En revisión", variante: "info" },
  en_consejo: { texto: "En el Consejo", variante: "info" },
  resuelta: { texto: "Resuelta", variante: "pagado" },
  asignada: { texto: "Asignada a Admin.", variante: "parcial" },
  ejecutada: { texto: "Ejecutada", variante: "pagado" },
  rechazada: { texto: "Rechazada", variante: "pendiente" },
  cerrada_solicitud: { texto: "Cerrada", variante: "neutro" },
  // aprobaciones (cambios pendientes)
  pendiente_aprobacion: { texto: "Esperando aprobación", variante: "parcial" },
  aprobado: { texto: "Aprobado", variante: "pagado" },
  // tesorería
  impuesto: { texto: "Impuesto", variante: "neutro" },
  debito_fiscal: { texto: "Débito fiscal", variante: "neutro" },
  comision: { texto: "Comisión", variante: "neutro" },
  ajuste: { texto: "Ajuste", variante: "info" },
  // personal / portería
  activo: { texto: "Activo", variante: "pagado" },
  inactivo: { texto: "Inactivo", variante: "neutro" },
  en_horario: { texto: "En horario", variante: "pagado" },
  fuera_horario: { texto: "Fuera de horario", variante: "parcial" },
  adentro: { texto: "Adentro", variante: "info" },
  salio: { texto: "Salió", variante: "neutro" },
  // canon diario
  camion: { texto: "Camión", variante: "neutro" },
  ambulante: { texto: "Ambulante", variante: "neutro" },
  quintero: { texto: "Quintero", variante: "neutro" },
};

/**
 * Sello de goma de estado, como en la carpeta de papel.
 * Verde = pagado/ok · Rojo = pendiente/debe · Ámbar = parcial/abierta ·
 * Azul (info) = en curso/administrativo · Gris = cerrado/neutro.
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
