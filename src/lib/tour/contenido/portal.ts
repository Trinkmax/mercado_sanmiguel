import type { ContenidoCapitulo, Paso } from "@/lib/tour/tipos";
import {
  PantallaBeneficioSocio,
  PantallaBloqueoCirculares,
  PantallaCircularSocio,
  PantallaColoresCartel,
  PantallaConceptosSocio,
  PantallaCuotasSocio,
  PantallaDescargoSocio,
  PantallaHojaConcepto,
  PantallaLugarSocio,
  PantallaMensajesSocio,
  PantallaPagosSocio,
  PantallaReciboSocio,
  PantallaSocioContar,
  PantallaSocioEstado,
  PantallaSocioRespuesta,
  PantallaSocioTipo,
  PantallaSubirDocumentoSocio,
  PortadaSocioCarpeta,
  PortadaSocioComunicaciones,
  PortadaSocioCuenta,
  PortadaSocioPagos,
  PortadaSocioSolicitudes,
} from "@/components/tour/pantallas/portal";

// Tour guiado · portal: los capítulos del socio (docs/GUIA-TOUR.md).
//
// Es la persona con menos contexto: cada paso explica una sola cosa, en el orden en que aparece
// al bajar la pantalla. Lo que depende de datos y conviene saber igual (el beneficio, lo del mes,
// los pagos, el recibo) tiene su pantalla de ejemplo; lo que aparece solo a veces (el saldo a
// favor, el cartelito de mensajes nuevos, las cuotas) es `opcional`: quien no lo tiene no ve ese
// paso. El cartel lleva un ancla por color (portal-cuenta-al-dia / -en-termino / -vencido) para
// que el paso hable del estado real de la cuenta.

const MENSAJES = "/mi-cuenta/mensajes";
const SOCIO_DETALLE = "/mi-cuenta/solicitudes/[id]";
const SOCIO_NUEVA = "/mi-cuenta/solicitudes/nueva";

/** Capítulo "socio-cuenta" (metadatos en src/lib/tour/indice.ts). */
export const SOCIO_CUENTA: ContenidoCapitulo = {
  portada: PortadaSocioCuenta,
  pasos: (): Paso[] => [
    {
      id: "tu-lugar",
      ancla: "portal-plano",
      titulo: "Este es tu lugar en el mercado",
      texto:
        "Es el mercado visto desde arriba. Lo que está prendido es lo tuyo, y el color te dice cómo está tu cuenta. Mirando no se cambia nada.",
      consejo:
        "A veces, al entrar, primero aparece una circular para leer: leé y tocá «Confirmo que la recibí», y después ves tu cuenta.",
    },
    {
      id: "cartel",
      ancla: ["portal-cuenta-vencido", "portal-cuenta-en-termino", "portal-cuenta-al-dia"],
      titulo: "El cartel de tu cuenta",
      texto:
        "Te dice de un vistazo cómo estás: verde si estás al día, amarillo si debés pero estás a tiempo, rojo si algo se venció.",
      pantalla: PantallaColoresCartel,
      variantes: {
        "portal-cuenta-al-dia": {
          titulo: "Estás al día",
          texto:
            "El verde quiere decir que no debés nada. Cuando tengas algo para pagar, se pone amarillo (estás a tiempo) o rojo (algo se venció), con el monto bien grande.",
        },
        "portal-cuenta-en-termino": {
          titulo: "Debés, pero estás a tiempo",
          texto:
            "El amarillo quiere decir que tenés algo para pagar y todavía estás en fecha. El número grande es lo que tenés que pagar. Abajo dice hasta qué día y cuántos días te quedan.",
        },
        "portal-cuenta-vencido": {
          titulo: "Tenés algo vencido",
          texto:
            "El rojo quiere decir que algo ya se venció. El número grande es lo vencido: eso hay que pagar hoy. Abajo dice qué más vence y cuándo. Cuando lo pagues, se va el rojo.",
        },
      },
      sinAncla: {
        texto:
          "Debajo del plano vas a ver un cartel con tu cuenta: verde si estás al día, amarillo si debés pero estás a tiempo, rojo si algo se venció.",
        consejo:
          "Si ves «Tu usuario no está unido a tu carpeta», pedí en Administración que lo unan.",
      },
    },
    {
      id: "beneficio",
      ancla: ["portal-beneficio", "portal-beneficio-perdido"],
      titulo: "Pagando a tiempo, ahorrás",
      texto:
        "Si pagás la expensa a tiempo, hasta el mismo día que vence, tenés un beneficio. Acá dice de cuánto es. El número grande ya lo tiene descontado: no le restes nada.",
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
          "Si pagás la expensa a tiempo, hasta el mismo día que vence, tenés un beneficio. Cuando la debas, en el cartel te dice de cuánto es y hasta qué día.",
      },
    },
    {
      // Solo quien paga en cuotas (por semana, por día…).
      id: "cuotas",
      ancla: "portal-cuotas",
      opcional: true,
      titulo: "Tu mes, en azulejos",
      texto:
        "Si pagás en partes, cada azulejo es una parte del mes. Los llenos ya están pagos. Abajo dice de cuánto es la próxima.",
      pantalla: PantallaCuotasSocio,
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
        "Si aparece este cartelito, la cooperativa te mandó algo o te contestó. Lo tocás y te lleva directo.",
      consejo: "Cuando lo leés (o lo contestás, si pide respuesta), se va solo.",
    },
    {
      id: "ultimo-pago",
      ancla: "portal-ultimo-pago",
      opcional: true,
      titulo: "Tu último pago",
      texto: "Apenas te anotan un pago, aparece acá. Lo tocás y ves el recibo.",
    },
    {
      id: "conceptos",
      ancla: ["portal-conceptos-vacio", "portal-conceptos"],
      titulo: "Lo que te toca este mes",
      texto:
        "Cada renglón es algo que pagás: cuánto es y un sello que dice cómo está: «Pagado», «Parcial» (pagaste una parte), «Pendiente» o «Vencido».",
      pantalla: PantallaHojaConcepto,
      consejo: "Cuando termine la guía, tocá un renglón: sube una hoja y te muestra en el plano dónde queda.",
      variantes: {
        "portal-conceptos-vacio": {
          texto:
            "Acá vas a ver cada cosa que te toca pagar este mes, con cuánto es y hasta cuándo vence. Todavía no están cargadas. Cuando estén, se ven así.",
          pantalla: PantallaConceptosSocio,
          consejo: undefined,
        },
      },
      sinAncla: {
        texto: "Acá vas a ver cada cosa que te toca pagar este mes, con cuánto es y un sello que dice si está pagada.",
        pantalla: PantallaConceptosSocio,
      },
    },
    {
      id: "atrasados",
      ancla: "portal-atrasados",
      opcional: true,
      titulo: "Lo de meses anteriores",
      texto: "Lo que quedó sin pagar de otros meses está acá, mes por mes. Lo que pagás va primero a lo más viejo.",
    },
    {
      id: "plan",
      ancla: "portal-plan",
      opcional: true,
      titulo: "Tu plan de pago",
      texto:
        "Es la deuda de antes que acordaste pagar en cuotas. No se vence y no te hace perder el beneficio. Cuando pagues, avisá cuánto es para el plan.",
    },
    {
      id: "donde",
      ancla: "portal-donde-pagar",
      titulo: "Dónde se paga",
      texto:
        "Acá no se paga: pagás como siempre y, apenas te lo anotan, aparece en tu cuenta con su recibo. Este renglón te dice adónde ir.",
    },
  ],
};

/** Capítulo "socio-pagos". */
export const SOCIO_PAGOS: ContenidoCapitulo = {
  portada: PortadaSocioPagos,
  pasos: (): Paso[] => [
    {
      id: "que-es",
      ancla: "encabezado",
      titulo: "Todo lo que pagaste",
      texto: "Cada vez que pagás en Administración o en Portería, aparece acá solo. Arriba dice cuánto pagaste este mes.",
    },
    {
      id: "talones",
      ancla: ["portal-pagos-vacio", "portal-pagos"],
      titulo: "Un talón por cada pago",
      texto:
        "Como en un talonario: a la izquierda la fecha; a la derecha cuánto, cómo pagaste y el número de recibo. Cada mes dice si quedó «Todo pagado».",
      consejo: "Si pagaste y todavía no lo ves, preguntá en Administración.",
      variantes: {
        "portal-pagos-vacio": {
          texto: "Todavía no hay pagos. Cuando pagues, cada pago aparece acá solo, con su recibo. Se ve así.",
          pantalla: PantallaPagosSocio,
        },
      },
      sinAncla: {
        texto: "Cuando pagues, cada pago aparece acá solo, con su recibo.",
        pantalla: PantallaPagosSocio,
      },
    },
    {
      id: "recibo",
      ancla: "portal-recibo",
      titulo: "Tu recibo, cuando lo necesites",
      texto:
        "Tocá un talón y ves el recibo. Con «Compartir el recibo» lo mandás por WhatsApp o lo guardás en el celular. Con «Volver» regresás.",
      pantalla: PantallaReciboSocio,
      sinAncla: {
        texto:
          "Cuando tengas pagos, tocás un talón y ves el recibo. Con «Compartir el recibo» lo mandás por WhatsApp o lo guardás en el celular.",
      },
    },
  ],
};

/** Capítulo "socio-comunicaciones": lo que le manda la cooperativa, en «Mensajes». */
export const SOCIO_COMUNICACIONES: ContenidoCapitulo = {
  portada: PortadaSocioComunicaciones,
  pasos: (): Paso[] => [
    {
      // Con una circular obligatoria sin confirmar, el portal muestra solo esa (GateCirculares):
      // su título lleva "encabezado" y "socio-comunicaciones-bloqueo".
      id: "que-es",
      ancla: ["socio-comunicaciones-bloqueo", "encabezado"],
      titulo: "Todo lo que hablás con la cooperativa",
      texto: "Acá está todo junto, como en un chat: lo que te manda la cooperativa y lo que le escribís vos.",
      consejo: "El número rojo sobre «Mensajes» te dice cuántas cosas nuevas tenés.",
      variantes: {
        "socio-comunicaciones-bloqueo": {
          titulo: "Primero, esta circular",
          texto:
            "La cooperativa te mandó una circular que tenés que confirmar. Hasta que la confirmes, vas a ver solo esa. Igual te muestro cómo es esta sección.",
          consejo: undefined,
        },
      },
    },
    {
      id: "lista",
      ancla: ["mensajes-vacio", "mensajes-lista"],
      titulo: "Arriba, lo que te espera",
      texto:
        "Lo que espera algo de vos va primero, en «Te están esperando». El sello te dice qué hacer: «Nueva» si no lo abriste, «Tenés que responder» si espera tu versión, «Respuesta nueva» si te contestaron.",
      variantes: {
        "mensajes-vacio": {
          texto: "Todavía no hay mensajes. Cuando llegue algo, se ve así: lo que espera algo de vos va primero, con un sello que te dice qué hacer.",
          pantalla: PantallaMensajesSocio,
        },
      },
      sinAncla: { pantalla: PantallaMensajesSocio },
    },
    {
      id: "circulares",
      ancla: "socio-comunicaciones-circular",
      titulo: "Las circulares",
      texto:
        "Son avisos de la cooperativa para todos. Las que todavía no abriste dicen «Nueva». Tocás una y la leés entera; si trae un PDF, lo abrís ahí mismo. Después dice «Leída».",
      pantalla: PantallaCircularSocio,
      sinAncla: {
        texto:
          "Son avisos de la cooperativa para todos. Cuando llega una, dice «Nueva» hasta que la abrís. Así se ve por dentro:",
      },
    },
    {
      // "Mirar": el botón guarda (confirma la circular). Solo está a la vista si tiene una
      // circular obligatoria sin confirmar; si no, el dibujo.
      id: "confirmar",
      ancla: "socio-comunicaciones-confirmar",
      titulo: "Algunas hay que confirmarlas",
      texto:
        "Cuando llega una circular que hay que confirmar, al entrar vas a ver solo esa. La leés y tocás «Confirmo que la recibí». Después ves tu cuenta como siempre.",
      variantes: {
        "socio-comunicaciones-confirmar": {
          titulo: "Confirmala cuando termine la guía",
          texto:
            "Leé la circular entera y tocá «Confirmo que la recibí». Así la cooperativa sabe que te llegó, y después ves tu cuenta como siempre.",
        },
      },
      sinAncla: { pantalla: PantallaBloqueoCirculares },
      consejo: "Las circulares no se responden. Si tenés una duda, tocá «Escribirle a la cooperativa».",
    },
    {
      // Con el dibujo y sin abrir un aviso de verdad: abrirlo lo marca como visto
      // (RegistrarVista) y la cooperativa vería "lo abrió" aunque fuera la guía.
      id: "descargo",
      titulo: "Los avisos solo para vos",
      texto:
        "Una notificación es un aviso formal; un apercibimiento, un llamado de atención; una sanción, una medida. Los dos últimos pueden traer una multa, que se suma a tu cuenta. Abajo, en «Contá tu versión», escribís lo tuyo y podés sumar una foto.",
      pantalla: PantallaDescargoSocio,
      consejo: "La respuesta de la cooperativa te llega ahí mismo, con el sello «Respuesta nueva».",
    },
  ],
};

/** Capítulo "socio-solicitudes": escribirle a la cooperativa y seguir la conversación. */
export const SOCIO_SOLICITUDES: ContenidoCapitulo = {
  portada: PortadaSocioSolicitudes,
  pasos: (): Paso[] => [
    {
      id: "nueva",
      ancla: "solicitudes-socio-nueva",
      accion: "tocar",
      titulo: "Tocá «Escribirle a la cooperativa»",
      texto: "Está en «Mensajes». Sirve para preguntar, pedir, reclamar o avisar de algo.",
      sinAncla: {
        texto: "En «Mensajes» está «Escribirle a la cooperativa». Sirve para preguntar, pedir, reclamar o avisar de algo.",
      },
    },
    {
      id: "tipo",
      ruta: SOCIO_NUEVA,
      ancla: "solicitudes-socio-tipo",
      titulo: "¿Qué querés hacer?",
      texto: "Elegí una de las cuatro: «Preguntar algo», «Pedir algo», «Hacer un reclamo» o «Avisar de algo».",
      consejo: "Si no sabés cuál, elegí cualquiera: la leen igual.",
      sinAncla: { pantalla: PantallaSocioTipo },
    },
    {
      // Con el dibujo: el cuadro aparece recién después de elegir, y elegir por la guía no suma.
      id: "contar",
      ruta: SOCIO_NUEVA,
      titulo: "Contá de qué se trata",
      texto:
        "Escribí como en WhatsApp: qué pasó, desde cuándo, qué necesitás. Si tenés una foto, sumala con «Sumar una foto». Después tocá «Enviar».",
      pantalla: PantallaSocioContar,
      consejo: "Si se corta el wifi, tocá «Enviar» de nuevo: no se manda dos veces.",
    },
    {
      // Vuelve a «Mensajes»; sin conversaciones todavía, se saltea.
      id: "abrir",
      ruta: MENSAJES,
      ancla: "solicitudes-socio-fila",
      accion: "tocar",
      opcional: true,
      titulo: "Abrí una para seguirla",
      texto: "Lo que escribiste queda en «Mensajes», con un sello que dice cómo va. Tocá uno para abrirlo.",
      consejo: "Si uno dice «Respuesta nueva», te contestaron.",
    },
    {
      id: "estado",
      ruta: SOCIO_DETALLE,
      entrar: "solicitudes-socio-fila",
      ancla: "solicitudes-socio-estado",
      titulo: "En qué está",
      texto: "Arriba dice en qué está y quién lo tiene. Con «Ver por dónde va» ves todo el camino.",
      consejo: "Cuando se decide algo, la resolución aparece acá mismo.",
      sinAncla: {
        texto: "Cuando escribas, arriba de la conversación vas a ver en qué está y quién lo tiene. Con «Ver por dónde va» ves todo el camino.",
        pantalla: PantallaSocioEstado,
      },
    },
    {
      id: "respuesta",
      ruta: SOCIO_DETALLE,
      entrar: "solicitudes-socio-fila",
      ancla: "solicitudes-socio-mensajes",
      titulo: "Como un chat",
      texto: "Lo tuyo va a la derecha y lo de la cooperativa a la izquierda. Si querés agregar algo, escribí abajo y tocá «Enviar».",
      consejo: "Cuando te contestan, sobre «Mensajes» aparece un número rojo.",
      sinAncla: {
        texto: "La conversación es como un chat: lo tuyo a la derecha y lo de la cooperativa a la izquierda. Si querés agregar algo, escribís abajo y tocás «Enviar».",
        pantalla: PantallaSocioRespuesta,
      },
    },
  ],
};

/** Capítulo "socio-carpeta". */
export const SOCIO_CARPETA: ContenidoCapitulo = {
  portada: PortadaSocioCarpeta,
  pasos: (): Paso[] => [
    {
      id: "que-es",
      ancla: "encabezado",
      titulo: "Tu carpeta, en el celular",
      texto: "Es la misma carpeta con tu número que está en Administración: tus lugares y tus papeles.",
    },
    {
      id: "lugares",
      ancla: "carpeta-lugares",
      titulo: "Lo que tenés en el mercado",
      texto: "Tus puestos, tu cochera, tu quinta. Tocá uno y te muestro dónde queda y qué pagás por ese lugar.",
      pantalla: PantallaLugarSocio,
      sinAncla: {
        texto: "Cuando tengas tus lugares cargados, los vas a ver acá. Si falta alguno, avisá en Administración.",
      },
    },
    {
      id: "papeles",
      ancla: "portal-documentos",
      titulo: "Tus papeles, guardados",
      texto:
        "Si Administración te pide un papel (la habilitación, el apto eléctrico), tocá «Subir un papel», elegí cuál es y sacale una foto. Queda en tu carpeta y Administración lo ve.",
      pantalla: PantallaSubirDocumentoSocio,
    },
  ],
};
