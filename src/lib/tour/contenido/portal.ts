import type { ContenidoCapitulo, Paso } from "@/lib/tour/tipos";
import {
  PantallaBeneficioSocio,
  PantallaConceptosSocio,
  PantallaPagosSocio,
  PantallaReciboSocio,
  PantallaSemaforoColores,
  PantallaSubirDocumentoSocio,
  PortadaSocioCuenta,
} from "@/components/tour/pantallas/portal";

// Tour guiado · portal: pasos de los capítulos de esta área (docs/GUIA-TOUR.md).
//
// «Mi cuenta» del socio (/mi-cuenta). Es la persona con menos contexto: cada paso explica
// una sola cosa, en el orden en que aparece al bajar la pantalla. Arranca vacía (sin cargos
// ni pagos), así que lo que depende de datos y conviene saber igual (el beneficio, lo del
// mes, los pagos, el recibo) tiene su pantalla de ejemplo. Lo que aparece solo a veces (el
// saldo a favor, el recuadro de lo que te está esperando) es `opcional`: quien no lo tiene
// no ve ese paso. El semáforo lleva un ancla por color (portal-cuenta-al-dia / -en-termino /
// -vencido) para que el paso hable del estado real de la cuenta. Las solicitudes tienen su
// capítulo propio.

/** Capítulo "socio-cuenta" (metadatos en src/lib/tour/indice.ts). */
export const SOCIO_CUENTA: ContenidoCapitulo = {
  portada: PortadaSocioCuenta,
  pasos: (): Paso[] => [
    {
      id: "tu-cuenta",
      ancla: "encabezado",
      titulo: "Esta es tu cuenta",
      texto:
        "Es como la carpeta de tu puesto, pero en el celular. Acá ves cuánto debés, lo que ya pagaste y tus recibos. Mirando no se cambia nada.",
      consejo:
        "A veces, al entrar, primero aparecen los términos o una circular para leer: leé y tocá «Aceptar y entrar» o «Confirmo que la recibí», y después ves tu cuenta.",
    },
    {
      id: "semaforo",
      ancla: ["portal-cuenta-vencido", "portal-cuenta-en-termino", "portal-cuenta-al-dia"],
      titulo: "El semáforo de tu cuenta",
      texto:
        "Te dice con un color cómo está tu cuenta: verde si estás al día, amarillo si debés pero estás a tiempo, rojo si algo se venció.",
      pantalla: PantallaSemaforoColores,
      variantes: {
        "portal-cuenta-al-dia": {
          titulo: "Estás al día",
          texto:
            "La luz verde quiere decir que no debés nada. Cuando tengas algo para pagar, se prende la amarilla (estás a tiempo) o la roja (algo se venció), con el monto.",
        },
        "portal-cuenta-en-termino": {
          titulo: "Debés, pero estás a tiempo",
          texto:
            "La luz amarilla quiere decir que tenés algo para pagar y todavía estás en fecha. El número grande es lo que tenés que pagar. Abajo dice hasta qué día y cuántos días te quedan.",
        },
        "portal-cuenta-vencido": {
          titulo: "Tenés algo vencido",
          texto:
            "La luz roja quiere decir que algo ya se venció. El número grande es lo que tenés que pagar hoy. Cuando lo pagues, se apaga la roja.",
        },
      },
      sinAncla: {
        texto:
          "Arriba de todo vas a ver un semáforo con tu cuenta: verde si estás al día, amarillo si debés pero estás a tiempo, rojo si algo se venció.",
        consejo:
          "Si ves «Tu usuario no está vinculado a un puesto», pedí en Administración que lo unan a tu carpeta.",
      },
    },
    {
      id: "beneficio",
      ancla: ["portal-beneficio", "portal-beneficio-perdido"],
      titulo: "Pagando a tiempo, ahorrás",
      texto:
        "Si pagás la expensa a tiempo, hasta el mismo día que vence, tenés un beneficio. Acá dice cuánto te ahorrás. El número grande de arriba ya lo tiene descontado.",
      pantalla: PantallaBeneficioSocio,
      consejo: "Si se pasa la fecha, el beneficio se pierde y se paga el importe completo.",
      variantes: {
        "portal-beneficio-perdido": {
          titulo: "Se venció: perdiste el beneficio",
          texto:
            "Lo que se venció perdió el beneficio: ahora se paga el importe completo. Lo que todavía no venció lo mantiene, si lo pagás a tiempo.",
          consejo: "Para no perderlo la próxima vez, pagá hasta el mismo día que vence.",
        },
      },
      sinAncla: {
        texto:
          "Si pagás la expensa a tiempo, hasta el mismo día que vence, tenés un beneficio. Cuando la debas, en el semáforo de arriba te dice cuánto te ahorrás y hasta qué día.",
      },
    },
    {
      // Solo si tiene plata a favor.
      id: "saldo-favor",
      ancla: "portal-saldo-favor",
      opcional: true,
      titulo: "Tenés saldo a favor",
      texto:
        "Si pagaste de más o adelantaste, esa plata queda a tu favor. Se descuenta sola de lo que tengas que pagar: no tenés que hacer nada.",
    },
    {
      // Solo si hay algo para ver o contestar.
      id: "avisos",
      ancla: "portal-avisos",
      opcional: true,
      titulo: "Lo que te está esperando",
      texto:
        "Acá aparece lo que tenés que ver o contestar: una comunicación nueva, un aviso para responder o la respuesta a un pedido tuyo. Tocás el renglón y te lleva directo.",
      consejo: "Cuando lo leés (o lo contestás, si pide respuesta), el renglón se va solo.",
    },
    {
      id: "conceptos",
      ancla: ["portal-conceptos-vacio", "portal-conceptos"],
      titulo: "Lo que te toca este mes",
      texto:
        "En «Tus conceptos» está cada cosa que te toca pagar este mes, con cuánto es y hasta cuándo vence. El sello dice cómo está: «Pagado», «Parcial» (pagaste una parte), «Pendiente» o «Vencido». Lo de meses pasados queda más abajo, en «Meses anteriores».",
      consejo: "Si un renglón dice «× 2», pagás dos; si dice «150 %», pagás una vez y media.",
      variantes: {
        "portal-conceptos-vacio": {
          texto:
            "Acá vas a ver cada cosa que te toca pagar este mes, con cuánto es y hasta cuándo vence. Todavía no están cargadas. Cuando estén, se ven así.",
          pantalla: PantallaConceptosSocio,
        },
      },
      sinAncla: {
        texto:
          "En «Tus conceptos» vas a ver cada cosa que te toca pagar este mes, con cuánto es, hasta cuándo vence y un sello que dice si está pagada.",
        pantalla: PantallaConceptosSocio,
      },
    },
    {
      id: "pagos",
      ancla: ["portal-pagos-vacio", "portal-pagos"],
      titulo: "Lo que ya pagaste",
      texto:
        "Cada vez que pagás en Administración o en Portería, tu pago aparece acá solo: el número de recibo, la fecha, cómo pagaste y cuánto.",
      consejo: "Si pagaste y todavía no lo ves, preguntá en Administración.",
      variantes: {
        "portal-pagos-vacio": {
          texto:
            "Todavía no hay pagos. Cuando pagues en Administración o en Portería, cada pago aparece acá solo, con su recibo. Se ve así.",
          pantalla: PantallaPagosSocio,
        },
      },
      sinAncla: {
        texto:
          "Cuando pagues en Administración o en Portería, cada pago aparece acá solo, con su recibo.",
        pantalla: PantallaPagosSocio,
      },
    },
    {
      id: "recibo",
      ancla: "portal-recibo",
      titulo: "Tu recibo, cuando lo necesites",
      texto:
        "Cuando quieras ver un recibo, tocá «Recibo» al lado del pago. Arriba aparece «Descargar recibo (PDF)»: lo guardás en el celular o lo imprimís. Con «Volver» regresás a tu cuenta.",
      pantalla: PantallaReciboSocio,
      consejo:
        "Al tocar «Descargar recibo (PDF)», elegí «Guardar como PDF»; en el celular suele estar en «Compartir» y después «Imprimir».",
      sinAncla: {
        texto:
          "Cuando tengas pagos, al lado de cada uno aparece «Recibo». Lo tocás y ves tu recibo; con «Descargar recibo (PDF)» lo guardás o lo imprimís.",
      },
    },
    {
      id: "documentos",
      ancla: "portal-documentos",
      titulo: "Tus papeles, guardados",
      texto:
        "Si Administración te pide un papel (la habilitación, el apto eléctrico), tocá «Subir documento» y mandá una foto o un PDF. Queda guardado en tu carpeta y Administración lo ve. Con «Ver» abrís los que ya subiste.",
      pantalla: PantallaSubirDocumentoSocio,
      consejo:
        "Justo arriba están «Tus solicitudes»: tus pedidos y reclamos al Líder de Procesos. Cómo hacer uno te lo muestro más adelante, en «Solicitudes».",
    },
  ],
};
