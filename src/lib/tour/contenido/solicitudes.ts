import type { Rol } from "@/lib/auth";
import type { ContenidoCapitulo, Paso } from "@/lib/tour/tipos";
import {
  PantallaAccionesJefe,
  PantallaAccionesLider,
  PantallaAsignar,
  PantallaDetallePorteria,
  PantallaDetalleResuelta,
  PantallaEjecutar,
  PantallaEnviadaJefe,
  PantallaEnviadaLider,
  PantallaFormularioAdmin,
  PantallaFormularioPuesto,
  PantallaListaAdmin,
  PantallaListaJefe,
  PantallaListaLider,
  PantallaMensajes,
  PantallaMensajesJefe,
  PantallaRecorrido,
  PantallaRecorridoPorteria,
  PantallaResolucionConsejo,
  PantallaResolverJefe,
  PantallaRespuestaTesoreria,
  PantallaSocioBotonNueva,
  PantallaSocioEnviada,
  PantallaSocioFormularioAsunto,
  PantallaSocioFormularioTipo,
  PantallaSocioLista,
  PantallaSocioRecorrido,
  PantallaSocioRespuesta,
  PortadaSocioSolicitudes,
  PortadaSolicitudes,
} from "@/components/tour/pantallas/solicitudes";

// Tour guiado · solicitudes: pasos de los capítulos de esta área (docs/GUIA-TOUR.md).
//
// Recorrido de las pantallas: la lista (/solicitudes) → una solicitud (/solicitudes/[id],
// se entra por la primera fila) → «Nueva solicitud» (/solicitudes/nueva). Para entrar a una
// solicitud hay que estar en la lista (el link es la primera fila): si antes se mostró el
// formulario, va un paso de la lista en el medio (las pestañas, por ejemplo).

const DETALLE = "/solicitudes/[id]";
const NUEVA = "/solicitudes/nueva";

/* ------------------------------------------------------------------------------------ */
/* Pasos que comparten varios roles                                                      */
/* ------------------------------------------------------------------------------------ */

/** Abrir una solicitud de la lista (la primera fila). Sin filas, la lista de ejemplo. */
function pasoFila(titulo: string, texto: string, sinDatos: string, pantalla: Paso["pantalla"]): Paso {
  return {
    id: "abrir",
    ancla: "solicitudes-fila",
    accion: "tocar",
    titulo,
    texto,
    sinAncla: { titulo: "Así se ve la lista", texto: sinDatos, pantalla },
  };
}

/** «Nueva solicitud», arriba a la derecha de la lista (abre el formulario: no guarda nada). */
function pasoNueva(texto: string): Paso {
  return {
    id: "nueva",
    ancla: "solicitudes-nueva",
    accion: "tocar",
    titulo: "Tocá «Nueva solicitud»",
    texto,
  };
}

const pasoTipo: Paso = {
  id: "tipo",
  ruta: NUEVA,
  ancla: "solicitudes-form-tipo",
  titulo: "¿Qué es?",
  texto:
    "Elegí «Solicitud» si se pide algo, «Informe» si contás algo que pasó, «Reclamo» si algo está mal y «Consulta» si es una pregunta.",
};

/* ------------------------------------------------------------------------------------ */
/* Líder de Procesos                                                                     */
/* ------------------------------------------------------------------------------------ */

function pasosLider(): Paso[] {
  return [
    {
      id: "que-es",
      ancla: "encabezado",
      titulo: "Acá decidís los pedidos",
      texto:
        "Te llegan los pedidos, reclamos, informes y consultas de los socios, el Jefe de Portería, Tesorería y Administración. Vos decidís qué pasa con cada uno.",
      consejo: "El número sobre «Solicitudes» en el menú te dice cuántas esperan tu decisión.",
    },
    {
      id: "pestanas",
      ancla: "solicitudes-pestanas",
      accion: "tocar",
      titulo: "Cada pestaña, un paso",
      texto:
        "«Nuevas» son las que recién llegan. Después pasan por «En revisión», «En el Consejo», «Resueltas (para asignar)» y «Asignadas». El número de cada pestaña dice cuántas hay.",
      consejo:
        "«Con el Jefe de Portería» son las de los porteros que todavía ve el Jefe. Si hace falta, las podés tomar vos.",
    },
    pasoFila(
      "Abrí una",
      "Cada renglón tiene el número, el asunto, de dónde viene y el sello de su estado. Tocá una para abrirla.",
      "En esta pestaña todavía no hay ninguna. Cuando llegue una, la ves así y la tocás para abrirla.",
      PantallaListaLider
    ),
    {
      id: "recorrido",
      ruta: DETALLE,
      entrar: "solicitudes-fila",
      ancla: "solicitudes-recorrido",
      titulo: "Por dónde va",
      texto:
        "Esta línea muestra el camino: Nueva, En revisión, En el Consejo, Resuelta, Asignada y Ejecutada. Abajo dice quién la tiene ahora.",
      consejo: "Si un paso no hizo falta, por ejemplo el Consejo, queda marcado «salteado».",
      sinAncla: {
        texto: "Adentro de cada solicitud, una línea muestra el camino que hace y quién la tiene ahora.",
        pantalla: PantallaRecorrido,
      },
    },
    {
      id: "acciones",
      ruta: DETALLE,
      entrar: "solicitudes-fila",
      ancla: "solicitudes-acciones",
      titulo: "Tus botones",
      texto:
        "Acá aparecen solo los que sirven en ese momento. Con una nueva, empezá por «Tomarla para revisar»: así todos saben que la estás viendo.",
      pantalla: PantallaAccionesLider,
      consejo: "Si cerraste o rechazaste una por error, «Reabrir» la vuelve a revisión. Nada se pierde.",
      sinAncla: {
        texto:
          "Adentro de cada solicitud, al costado, están tus botones. Con una nueva, empezá por «Tomarla para revisar».",
      },
    },
    {
      id: "consejo",
      ruta: DETALLE,
      entrar: "solicitudes-fila",
      ancla: ["solicitudes-accion-derivar-consejo", "solicitudes-acciones"],
      titulo: "Lo que decide el Consejo",
      texto:
        "Si la tiene que decidir el Consejo, tocá «Derivar al Consejo». Cuando decidan en la reunión, tocá «Registrar lo que resolvió el Consejo» y escribilo.",
      pantalla: PantallaResolucionConsejo,
      consejo: "Si la decidís vos, es «Registrar resolución». Quien la pidió lo lee en los mensajes.",
      variantes: {
        "solicitudes-acciones": {
          texto:
            "«Derivar al Consejo» aparece acá cuando la solicitud es nueva o está en revisión. Cuando el Consejo decide en la reunión, volvés a la solicitud, tocás «Registrar lo que resolvió el Consejo» y lo escribís.",
        },
      },
      sinAncla: { pantalla: PantallaResolucionConsejo },
    },
    {
      id: "asignar",
      ruta: DETALLE,
      entrar: "solicitudes-fila",
      ancla: ["solicitudes-accion-asignar", "solicitudes-acciones"],
      titulo: "Pasásela a Administración",
      texto:
        "Con la resolución escrita, tocá «Asignar a Administración». Podés elegir a una persona o dejar «Cualquiera de Administración».",
      pantalla: PantallaAsignar,
      consejo: "A Administración le aparece como tarea. Cuando la hace, la marca ejecutada y vos lo ves acá.",
      variantes: {
        "solicitudes-acciones": {
          texto:
            "Cuando ya se decidió qué hacer, acá aparece «Asignar a Administración». Podés elegir a una persona o dejar «Cualquiera de Administración».",
        },
      },
      sinAncla: { pantalla: PantallaAsignar },
    },
    {
      id: "mensajes",
      ruta: DETALLE,
      entrar: "solicitudes-fila",
      ancla: "solicitudes-escribir",
      titulo: "La conversación",
      texto:
        "Arriba de esta caja quedan los mensajes y cada cambio de estado. Para contestar, escribí en «Tu mensaje» y tocá «Enviar mensaje».",
      pantalla: PantallaMensajes,
      consejo: "Con «Mensaje interno» prendido dejás una nota para el equipo: el socio no la ve.",
      sinAncla: {
        texto:
          "Adentro de cada solicitud, abajo, quedan los mensajes y cada cambio de estado. Para contestar, escribís en «Tu mensaje» y tocás «Enviar mensaje».",
        pantalla: PantallaMensajes,
      },
    },
    {
      id: "cargar",
      ancla: "solicitudes-nueva",
      titulo: "Cargar una vos",
      texto:
        "Con «Nueva solicitud» cargás una. Si te trajeron un formulario en papel, en «¿De dónde viene?» marcá de dónde vino.",
      pantalla: PantallaFormularioAdmin,
      consejo: "Al lado está «Solicitudes del mes (.xlsx)»: te baja la lista del mes en una planilla de Excel.",
    },
  ];
}

/* ------------------------------------------------------------------------------------ */
/* Administración                                                                        */
/* ------------------------------------------------------------------------------------ */

function pasosAdmin(): Paso[] {
  return [
    {
      id: "que-es",
      ancla: "encabezado",
      titulo: "Pedidos y tareas",
      texto:
        "Acá están los pedidos, reclamos, informes y consultas. A vos te toca cargar los que llegan en papel y hacer lo que el Líder de Procesos te asigne.",
    },
    {
      id: "pestanas",
      ancla: "solicitudes-pestanas",
      accion: "tocar",
      titulo: "Empezá por tus tareas",
      texto:
        "«Asignadas a Administración» son las que el Líder ya decidió y te pasó para hacer. Las demás pestañas son para mirar cómo va todo.",
      consejo: "El número sobre «Solicitudes» en el menú te avisa cuántas tareas tenés.",
    },
    pasoFila(
      "Abrí una",
      "Tocá una para ver qué se pidió y qué se decidió.",
      "En esta pestaña todavía no hay ninguna. Cuando el Líder te asigne una, aparece así en «Asignadas a Administración».",
      PantallaListaAdmin
    ),
    {
      id: "resolucion",
      ruta: DETALLE,
      entrar: "solicitudes-fila",
      ancla: "solicitudes-detalle",
      titulo: "Qué hay que hacer",
      texto:
        "En el detalle está lo que se pidió. Cuando ya está decidida, la resolución aparece en verde: eso es lo que tenés que hacer.",
      sinAncla: {
        texto: "Adentro de cada una está lo que se pidió y, en verde, la resolución: eso es lo que tenés que hacer.",
        pantalla: PantallaDetalleResuelta,
      },
    },
    {
      id: "ejecutar",
      ruta: DETALLE,
      entrar: "solicitudes-fila",
      ancla: ["solicitudes-accion-ejecutar", "solicitudes-acciones", "solicitudes-como-sigue"],
      titulo: "Marcala cuando esté hecha",
      texto:
        "Cuando lo hiciste, tocá «Marcar ejecutada» y contá en pocas palabras qué se hizo. Quien la pidió lo ve.",
      pantalla: PantallaEjecutar,
      variantes: {
        "solicitudes-acciones": {
          texto:
            "Acá aparecen los botones que te tocan en este momento. Con una tarea asignada está «Marcar ejecutada»: la tocás cuando está hecha. Si ya está ejecutada, «Cerrar» la da por terminada.",
        },
        "solicitudes-como-sigue": {
          titulo: "Cómo sigue",
          texto:
            "En esta todavía no te toca nada: acá dice cómo sigue. Cuando el Líder te la asigne, aparece «Marcar ejecutada».",
        },
      },
      sinAncla: {
        texto:
          "Cuando te asignen una, al costado aparece «Marcar ejecutada». La tocás cuando está hecha y contás qué se hizo.",
      },
    },
    {
      id: "mensajes",
      ruta: DETALLE,
      entrar: "solicitudes-fila",
      ancla: "solicitudes-escribir",
      titulo: "Contestale al socio",
      texto: "Escribí en «Tu mensaje» y tocá «Enviar mensaje». El socio lo lee en su portal.",
      pantalla: PantallaMensajes,
      consejo: "Si es algo solo para el equipo, prendé «Mensaje interno»: el botón pasa a decir «Guardar nota interna» y el socio no lo ve.",
      sinAncla: {
        texto:
          "Adentro de cada una, abajo, está la conversación. Escribís en «Tu mensaje» y tocás «Enviar mensaje»: el socio lo lee en su portal.",
        pantalla: PantallaMensajes,
      },
    },
    pasoNueva("Si te traen un pedido en papel, lo pasás al sistema desde acá. Se abre un formulario corto."),
    {
      id: "formulario",
      ruta: NUEVA,
      ancla: "solicitudes-form-tipo",
      titulo: "Completalo de arriba para abajo",
      texto:
        "Elegí qué es, poné un «Asunto» corto y contá el «Detalle». En «¿Sobre qué es?» elegí «Un cliente», «Un lugar del plano» o «Algo general».",
    },
    {
      id: "origen",
      ruta: NUEVA,
      ancla: "solicitudes-form-origen",
      titulo: "¿De dónde viene?",
      texto:
        "Si lo trajeron en papel, marcá de dónde vino: por ejemplo, «Portería» si lo trajo un portero. Al tocar «Enviar solicitud», le llega al Líder de Procesos.",
      pantalla: PantallaEnviadaLider,
      consejo: "Después de enviarla, la podés imprimir con «Imprimir».",
    },
  ];
}

/* ------------------------------------------------------------------------------------ */
/* Jefe de Portería                                                                      */
/* ------------------------------------------------------------------------------------ */

function pasosJefe(): Paso[] {
  return [
    {
      id: "que-es",
      ancla: "encabezado",
      titulo: "Lo de Portería pasa por vos",
      texto:
        "Lo que cargan los porteros te llega primero a vos. Lo resolvés o, si no te corresponde, lo elevás al Líder de Procesos.",
    },
    {
      id: "pestanas",
      ancla: "solicitudes-pestanas",
      accion: "tocar",
      titulo: "Lo que te espera",
      texto:
        "«Para resolver» son las que esperan tu respuesta. «En manos del Líder» son las que elevaste y tus avisos sobre puestos. El número de cada pestaña dice cuántas hay.",
      consejo: "Si estás en otra pestaña y alguna espera tu respuesta, «Para resolver» se pinta de amarillo. El número sobre «Solicitudes» en el menú también te avisa.",
    },
    pasoFila(
      "Abrí una",
      "Las que esperan tu respuesta se ven en amarillo. Tocá una para leerla.",
      "En esta pestaña todavía no hay ninguna. Cuando un portero cargue una, la ves así, en amarillo.",
      PantallaListaJefe
    ),
    {
      id: "detalle",
      ruta: DETALLE,
      entrar: "solicitudes-fila",
      ancla: "solicitudes-detalle",
      titulo: "Leé qué pasó",
      texto:
        "Acá está lo que escribió el portero: dónde fue y qué pasó. Si sacó una foto, la ves con «Ver adjunto».",
      sinAncla: {
        texto: "Adentro de cada una está lo que escribió el portero: dónde fue, qué pasó y la foto, si la sacó.",
        pantalla: PantallaDetallePorteria,
      },
    },
    {
      id: "resolver",
      ruta: DETALLE,
      entrar: "solicitudes-fila",
      ancla: ["solicitudes-accion-resolver-jefe", "solicitudes-como-sigue"],
      titulo: "Resolvela vos",
      texto:
        "Si lo podés decidir vos, tocá «Resolver» y contá qué decidiste. Hay respuestas de un toque, como «Aprobado». Le llega al portero y queda cerrada.",
      pantalla: PantallaResolverJefe,
      variantes: {
        "solicitudes-como-sigue": {
          titulo: "Cómo sigue",
          texto:
            "Esta ya no está en tus manos: acá dice quién la tiene. Las que esperan tu respuesta tienen «Resolver», y ahí contás qué decidiste.",
        },
      },
      sinAncla: {
        texto:
          "Adentro de cada una, al costado, está «Resolver». Contás qué decidiste, le llega al portero y queda cerrada.",
      },
    },
    {
      id: "elevar",
      ruta: DETALLE,
      entrar: "solicitudes-fila",
      ancla: ["solicitudes-accion-elevar", "solicitudes-como-sigue"],
      titulo: "O pasásela al Líder",
      texto:
        "Si hace falta plata, un permiso o algo que no decidís vos, tocá «Elevar al Líder de Procesos» y contale por qué. Pasa a «En manos del Líder».",
      pantalla: PantallaAccionesJefe,
      consejo: "«Rechazar» te pide el motivo, y el portero lo lee.",
      variantes: {
        "solicitudes-como-sigue": {
          texto:
            "Cuando una espera tu respuesta, además de «Resolver» está «Elevar al Líder de Procesos»: se la pasás al Líder y le contás por qué.",
        },
      },
      sinAncla: { pantalla: PantallaAccionesJefe },
    },
    {
      id: "mensajes",
      ruta: DETALLE,
      entrar: "solicitudes-fila",
      ancla: "solicitudes-escribir",
      titulo: "Si te falta un dato",
      texto:
        "Preguntale al portero antes de decidir. Escribí en «Tu mensaje» y tocá «Enviar mensaje». Todo queda en la solicitud.",
      pantalla: PantallaMensajesJefe,
      sinAncla: { pantalla: PantallaMensajesJefe },
    },
    {
      id: "cargar",
      ancla: "solicitudes-nueva",
      titulo: "Mandale algo al Líder",
      texto:
        "Con «Nueva solicitud» le mandás un pedido o un aviso al Líder de Procesos. Si es sobre un puesto, tocá «Un puesto» y escribí el número.",
      pantalla: PantallaFormularioPuesto,
      consejo: "Lo que mandás vos va directo al Líder: lo seguís en «En manos del Líder».",
    },
  ];
}

/* ------------------------------------------------------------------------------------ */
/* Portería                                                                              */
/* ------------------------------------------------------------------------------------ */

function pasosPorteria(): Paso[] {
  return [
    {
      id: "que-es",
      ancla: "encabezado",
      titulo: "Dejalo por escrito",
      texto:
        "Si pasa algo en la garita o alguien pide algo, cargalo acá. Le llega al Jefe de Portería, que lo resuelve o se lo pasa al Líder de Procesos.",
    },
    pasoNueva("Se abre un formulario corto. Te lo muestro parte por parte."),
    pasoTipo,
    {
      id: "asunto",
      ruta: NUEVA,
      ancla: "solicitudes-form-asunto",
      titulo: "Contá qué pasó",
      texto:
        "En «Asunto», pocas palabras: «Portón norte trabado». Abajo, en «Detalle», qué pasó, a qué hora y quiénes estaban.",
    },
    {
      id: "donde",
      ruta: NUEVA,
      ancla: "solicitudes-form-sobre",
      titulo: "¿Dónde fue?",
      texto:
        "Si es sobre un puesto, tocá «Un puesto», escribí el número y tocá «Es el Puesto…». Si no, dejá «Algo general» y escribí el lugar en «¿Dónde?».",
      pantalla: PantallaFormularioPuesto,
      consejo: "Si tenés una foto, sumala con «Sacá una foto o elegí un PDF».",
    },
    {
      id: "enviar",
      ruta: NUEVA,
      ancla: "solicitudes-form-enviar",
      titulo: "Enviala e imprimila",
      texto:
        "Tocá «Enviar solicitud» y le llega al Jefe de Portería. En la pantalla que sigue está «Imprimir»: sale el papel, con lugar para la firma de quien lo recibe.",
      pantalla: PantallaEnviadaJefe,
      consejo: "Si se corta el wifi, tocá «Enviar solicitud» de nuevo: no se manda dos veces.",
    },
    {
      id: "pestanas",
      ancla: "solicitudes-pestanas",
      accion: "tocar",
      titulo: "Seguí cada una",
      texto:
        "En «Mis solicitudes» están todas las que cargaste. «En curso» son las que se están viendo y «Terminadas», las que ya se cerraron.",
    },
    {
      id: "respuesta",
      ruta: DETALLE,
      entrar: "solicitudes-fila",
      ancla: "solicitudes-recorrido",
      titulo: "La respuesta te llega acá",
      texto:
        "Adentro de cada una ves por dónde va y quién la tiene. Lo que te contesten aparece más abajo, en «Mensajes».",
      consejo: "Arriba está «Imprimir», por si necesitás el papel otra vez.",
      sinAncla: {
        texto:
          "Cuando cargues una, la tocás en la lista y ves por dónde va y lo que te contestaron. Así se ve una que resolvió el Jefe:",
        pantalla: PantallaRecorridoPorteria,
      },
    },
    {
      // Por dónde llega el portero en el día a día: el recuadro de su pantalla de Portería.
      id: "desde-porteria",
      ruta: "/porteria",
      ancla: "porteria-solicitudes",
      titulo: "También desde «Portería»",
      texto:
        "En tu pantalla de «Portería», abajo, tenés este recuadro. «Generar solicitud o informe» abre el mismo formulario y «Ver mis solicitudes» te lleva a tu lista.",
      consejo:
        "Cuando te contestan, «Ver mis solicitudes» te avisa con «1 respuesta nueva», y aparece un número sobre «Solicitudes».",
      sinAncla: {
        texto:
          "En tu pantalla de «Portería», abajo, está «Solicitudes e informes». «Generar solicitud o informe» abre el mismo formulario y «Ver mis solicitudes» te lleva a tu lista.",
      },
    },
  ];
}

/* ------------------------------------------------------------------------------------ */
/* Tesorería                                                                             */
/* ------------------------------------------------------------------------------------ */

function pasosTesoreria(): Paso[] {
  return [
    {
      id: "que-es",
      ancla: "encabezado",
      titulo: "Tus pedidos al Líder",
      texto:
        "Si necesitás algo del Líder de Procesos, pedíselo por acá. Queda por escrito y la respuesta te llega a esta misma pantalla.",
    },
    pasoNueva("Se abre un formulario corto."),
    pasoTipo,
    {
      id: "asunto",
      ruta: NUEVA,
      ancla: "solicitudes-form-asunto",
      titulo: "Contalo en pocas palabras",
      texto:
        "En «Asunto», de qué se trata: «Autorizar el pago al electricista». Abajo, en «Detalle», todo lo que haga falta para decidir.",
      consejo: "Podés sumar una foto o un PDF, por ejemplo un presupuesto.",
    },
    {
      id: "enviar",
      ruta: NUEVA,
      ancla: "solicitudes-form-enviar",
      titulo: "Enviala",
      texto: "Tocá «Enviar solicitud». Le llega al Líder de Procesos y en pantalla ves el número de tu solicitud.",
      pantalla: PantallaEnviadaLider,
    },
    {
      id: "pestanas",
      ancla: "solicitudes-pestanas",
      accion: "tocar",
      titulo: "Seguí cada una",
      texto:
        "En «Mis solicitudes» están todas las tuyas. «En curso» son las que el Líder todavía está viendo y «Terminadas», las que ya se cerraron.",
    },
    {
      id: "respuesta",
      ruta: DETALLE,
      entrar: "solicitudes-fila",
      ancla: "solicitudes-mensajes",
      titulo: "La respuesta, en los mensajes",
      texto:
        "Adentro de cada una ves por dónde va y lo que te contesta el Líder. Si hace falta, respondé abajo con «Enviar mensaje».",
      pantalla: PantallaRespuestaTesoreria,
      consejo: "Cuando te contestan, en la lista aparece «Respuesta nueva» y un número sobre «Solicitudes».",
      sinAncla: {
        texto: "Cuando cargues una, la tocás en la lista y ves lo que te contestó el Líder. Así se ve:",
        pantalla: PantallaRespuestaTesoreria,
      },
    },
  ];
}

/** Capítulo "solicitudes" (metadatos en src/lib/tour/indice.ts). */
export const SOLICITUDES: ContenidoCapitulo = {
  portada: PortadaSolicitudes,
  pasos: (rol: Rol) => {
    switch (rol) {
      case "lider":
        return pasosLider();
      case "admin":
        return pasosAdmin();
      case "guardia":
        return pasosJefe();
      case "porteria":
        return pasosPorteria();
      case "tesoreria":
        return pasosTesoreria();
      default:
        return [];
    }
  },
};

/* ------------------------------------------------------------------------------------ */
/* Socio (portal)                                                                        */
/* ------------------------------------------------------------------------------------ */

// La lista del socio vive en «Mi cuenta» (/mi-cuenta/solicitudes redirige ahí; la ruta del
// capítulo es "/mi-cuenta"). Los pasos van en el orden del trámite: dónde están → hacer una
// (el formulario, parte por parte) → seguirla. Para seguirla se vuelve a «Mi cuenta» y se
// abre una de verdad por la primera fila; sin solicitudes, ese paso se saltea y los de
// adentro muestran el ejemplo. Lo que manda el socio le llega al Líder de Procesos.

const SOCIO_DETALLE = "/mi-cuenta/solicitudes/[id]";
const SOCIO_NUEVA = "/mi-cuenta/solicitudes/nueva";

/** Capítulo "socio-solicitudes" (metadatos en src/lib/tour/indice.ts). */
export const SOCIO_SOLICITUDES: ContenidoCapitulo = {
  portada: PortadaSocioSolicitudes,
  pasos: () => [
    {
      id: "donde",
      ancla: ["solicitudes-socio-vacia", "solicitudes-socio-lista"],
      titulo: "Tus pedidos, en «Mi cuenta»",
      texto:
        "En «Tus solicitudes» le mandás un pedido, un reclamo o una consulta al Líder de Procesos. Cada una queda en esta lista, con un sello que dice cómo va.",
      variantes: {
        "solicitudes-socio-vacia": {
          texto:
            "En «Tus solicitudes» le mandás un pedido, un reclamo o una consulta al Líder de Procesos. Todavía no mandaste ninguna. Cuando mandes, quedan en esta lista y se ven así.",
          pantalla: PantallaSocioLista,
        },
      },
      sinAncla: {
        texto:
          "En «Mi cuenta», más abajo, está «Tus solicitudes». Por ahí le mandás un pedido, un reclamo o una consulta al Líder de Procesos, y seguís cómo va.",
        pantalla: PantallaSocioLista,
      },
    },
    {
      id: "nueva",
      ancla: "solicitudes-socio-nueva",
      accion: "tocar",
      titulo: "Tocá «Nueva solicitud»",
      texto: "Está al pie de «Tus solicitudes». Se abre un formulario corto: te lo muestro parte por parte.",
      sinAncla: {
        texto: "Al pie de «Tus solicitudes» está «Nueva solicitud». Lo tocás y se abre un formulario corto.",
        pantalla: PantallaSocioBotonNueva,
      },
    },
    {
      id: "tipo",
      ruta: SOCIO_NUEVA,
      ancla: "solicitudes-socio-tipo",
      titulo: "¿Qué querés hacer?",
      texto:
        "Elegí «Solicitud» si pedís algo, «Informe» si contás algo que pasó, «Reclamo» si algo no está bien y «Consulta» si es una pregunta.",
      consejo: "Si no sabés cuál, dejá «Solicitud»: la leen igual.",
      sinAncla: { pantalla: PantallaSocioFormularioTipo },
    },
    {
      id: "asunto",
      ruta: SOCIO_NUEVA,
      ancla: "solicitudes-socio-asunto",
      titulo: "Contá de qué se trata",
      texto:
        "En «Asunto», pocas palabras: «Luminaria rota frente al puesto». Abajo, en «Contanos más», qué pasó, desde cuándo y qué necesitás.",
      consejo: "Si tenés una foto del problema, sumala con «Sacar una foto o elegir archivo».",
      sinAncla: { pantalla: PantallaSocioFormularioAsunto },
    },
    {
      id: "enviar",
      ruta: SOCIO_NUEVA,
      ancla: "solicitudes-socio-enviar",
      titulo: "Mandala con «Enviar solicitud»",
      texto:
        "Cuando esté todo, tocá «Enviar solicitud». Le llega al Líder de Procesos y se abre tu solicitud, con su número y el sello «Nueva»: quiere decir que la recibimos.",
      pantalla: PantallaSocioEnviada,
      consejo: "Si se corta el wifi, tocá «Enviar solicitud» de nuevo: no se manda dos veces.",
    },
    {
      // Vuelve a «Mi cuenta»; sin solicitudes todavía, se saltea.
      id: "abrir",
      ancla: "solicitudes-socio-fila",
      accion: "tocar",
      opcional: true,
      titulo: "Abrí una para seguirla",
      texto:
        "Tus pedidos quedan en «Tus solicitudes», con su número, el asunto y un sello que dice cómo van. Tocá uno para abrirlo.",
      consejo: "Si uno dice «Respuesta nueva», te contestaron.",
    },
    {
      id: "estado",
      ruta: SOCIO_DETALLE,
      entrar: "solicitudes-socio-fila",
      ancla: "solicitudes-socio-estado",
      titulo: "Por dónde va",
      texto:
        "Arriba dice en qué está y qué quiere decir. La línea muestra el camino: Nueva, En revisión, En el Consejo, Resuelta… El paso de ahora está marcado en azul.",
      consejo: "Cuando se decide, la resolución aparece en verde, en «Lo que enviaste».",
      sinAncla: {
        texto:
          "Cuando mandes una, la tocás en «Tus solicitudes» y adentro ves en qué está. Una línea muestra el camino: Nueva, En revisión, En el Consejo, Resuelta… El paso de ahora está marcado en azul.",
        pantalla: PantallaSocioRecorrido,
      },
    },
    {
      id: "respuesta",
      ruta: SOCIO_DETALLE,
      entrar: "solicitudes-socio-fila",
      ancla: "solicitudes-socio-mensajes",
      titulo: "Leé la respuesta",
      texto:
        "Lo que te contestan aparece en «Mensajes». Si querés agregar algo, escribí en «Tu mensaje» y tocá «Enviar mensaje».",
      consejo: "Cuando te contestan, sobre «Mi cuenta» aparece un número y la solicitud dice «Respuesta nueva».",
      sinAncla: {
        texto:
          "Adentro de cada solicitud, abajo, está «Mensajes»: ahí aparece lo que te contestan. Si querés agregar algo, escribís en «Tu mensaje» y tocás «Enviar mensaje».",
        pantalla: PantallaSocioRespuesta,
      },
    },
  ],
};
