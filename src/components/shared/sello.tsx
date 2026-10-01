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
  // cheques ("Por cobrar" es el término del cliente, A2; el valor en la base sigue siendo en_cartera)
  en_cartera: { texto: "Por cobrar", variante: "parcial" },
  entregado: { texto: "Entregado a proveedor", variante: "info" },
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
  // estado del hilo de un registro (sanciones.estado) y su multa
  notificado: { texto: "Notificado", variante: "info" },
  descargo: { texto: "Descargo presentado", variante: "parcial" },
  respondio: { texto: "Respondió", variante: "parcial" },
  respondido: { texto: "Respondido", variante: "pagado" },
  multa: { texto: "Multa", variante: "pendiente" },
  multa_pagada: { texto: "Multa pagada", variante: "pagado" },
  sin_efecto: { texto: "Sin efecto", variante: "neutro" },
  // portal del socio (reglas en src/lib/segmentos.ts)
  a_responder: { texto: "Tenés que responder", variante: "pendiente" },
  respuesta_nueva: { texto: "Respuesta nueva", variante: "info" },
  nueva_comunicacion: { texto: "Nueva", variante: "parcial" },
  // circulares: quién la vio (D1)
  la_vio: { texto: "La vio", variante: "pagado" },
  no_la_vio: { texto: "Todavía no", variante: "neutro" },
  sin_portal: { texto: "Sin portal", variante: "neutro" },
  // deuda / cuenta corriente (semáforo B3: al_dia · en_termino · vencido)
  al_dia: { texto: "Al día", variante: "pagado" },
  en_termino: { texto: "En término", variante: "parcial" },
  debe: { texto: "Debe", variante: "pendiente" },
  saldo_favor: { texto: "Saldo a favor", variante: "pagado" },
  // clientes: categoría, socio y puesto propio
  puestero: { texto: "Puestero", variante: "neutro" },
  socio: { texto: "Socio", variante: "info" },
  propio: { texto: "Puesto propio", variante: "info" },
  // ambulantes
  pago_hoy: { texto: "Pagó hoy", variante: "pagado" },
  no_pago_hoy: { texto: "Hoy no pagó", variante: "neutro" },
  // solicitudes (ex peticiones)
  con_jefe: { texto: "Con el Jefe", variante: "info" },
  resuelta_jefe: { texto: "Resuelta por el Jefe", variante: "pagado" },
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
  revisar: { texto: "Revisala", variante: "parcial" },
  // novedades del personal
  aprobada: { texto: "Aprobada", variante: "pagado" },
  anulada: { texto: "Anulada", variante: "neutro" },
  // caja
  despues_cierre: { texto: "Después del cierre", variante: "parcial" },
  // tesorería
  impuesto: { texto: "Impuesto", variante: "neutro" },
  debito_fiscal: { texto: "Débito fiscal", variante: "neutro" },
  comision: { texto: "Comisión", variante: "neutro" },
  ajuste: { texto: "Ajuste", variante: "info" },
  deposito: { texto: "Depósito", variante: "info" },
  extraccion: { texto: "Extracción", variante: "info" },
  ingreso: { texto: "Ingreso", variante: "pagado" },
  egreso: { texto: "Egreso", variante: "neutro" },
  // personal / portería
  activo: { texto: "Activo", variante: "pagado" },
  inactivo: { texto: "Inactivo", variante: "neutro" },
  en_horario: { texto: "En horario", variante: "pagado" },
  fuera_horario: { texto: "Fuera de horario", variante: "parcial" },
  adentro: { texto: "Adentro", variante: "info" },
  salio: { texto: "Salió", variante: "neutro" },
  // categoría de cliente (ambulante y quintero se reusan); camion queda deprecado (canon viejo)
  camion: { texto: "Camión", variante: "neutro" },
  ambulante: { texto: "Ambulante", variante: "neutro" },
  quintero: { texto: "Quintero", variante: "neutro" },
  empleado: { texto: "Empleado", variante: "neutro" },
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
