import type { Rol } from "@/lib/auth";
import type { ContenidoCapitulo, Paso } from "@/lib/tour/tipos";
import {
  PantallaAvisosSocio,
  PantallaBandeja,
  PantallaBloqueoCirculares,
  PantallaCircularSocio,
  PantallaDescargo,
  PantallaDescargoSocio,
  PantallaEnviarNovedad,
  PantallaGuardarNovedad,
  PantallaNovedadEnviada,
  PantallaNovedadGuardada,
  PantallaNuevoRegistro,
  PantallaPlanilla,
  PantallaPlanillaImpresa,
  PantallaPlanillaJefe,
  PantallaQuePaso,
  PantallaQuienLaVio,
  PantallaRechazada,
  PantallaSeguimientoRegistro,
  PortadaComunicaciones,
  PortadaNovedades,
  PortadaNovedadesJefe,
  PortadaSocioComunicaciones,
} from "@/components/tour/pantallas/comunicaciones-novedades";

// Tour guiado · comunicaciones-novedades: pasos de los capítulos de esta área (docs/GUIA-TOUR.md).

// ---------------------------------------------------------------------------
// Comunicaciones (Administración y Líder)
// ---------------------------------------------------------------------------

/** Capítulo "comunicaciones" (metadatos en src/lib/tour/indice.ts). */
export const COMUNICACIONES: ContenidoCapitulo = {
  portada: PortadaComunicaciones,
  pasos: (rol: Rol): Paso[] => [
    {
      // Para qué sirve y cómo se reparte: en un solo paso, así quedan lugares para mostrar
      // el aviso de verdad más abajo (máximo 9 pasos).
      id: "que-es",
      ancla: ["comunicaciones-pestanas", "encabezado"],
      titulo: "Avisos por escrito",
      texto:
        "Desde acá les avisás por escrito a los clientes y ves quién lo leyó. «Circulares» son para todos o para un grupo. «Notificaciones», «Apercibimientos» y «Sanciones» son para un solo cliente.",
      consejo:
        rol === "lider"
          ? "En «Términos» publicás una versión nueva de las reglas que acepta cada socio al entrar al portal."
          : "En «Términos» ves cuántos socios ya aceptaron las reglas del portal.",
    },
    {
      // Sin "?tab=circulares" en la ruta: la pestaña «Circulares» es "/comunicaciones" a secas,
      // y con la query se recargaría la pantalla cada vez. Si empezó en otra pestaña, se
      // señala «Circulares» (la variante) y el paso que sigue va derecho a "Nueva circular".
      id: "nueva-circular",
      ancla: ["comunicaciones-nueva-circular", "comunicaciones-pestana-circulares"],
      accion: "tocar",
      titulo: "Tocá «Nueva circular»",
      texto:
        "Así empezás una circular: un aviso para todos o para un grupo, como un cambio de horario o un corte de luz.",
      variantes: {
        "comunicaciones-pestana-circulares": {
          titulo: "Las circulares",
          texto:
            "«Nueva circular» está en la pestaña «Circulares». Tocá «Siguiente» y te muestro cómo se arma una.",
          accion: "mirar",
        },
      },
    },
    {
      id: "publico",
      ruta: "/comunicaciones/nueva",
      ancla: "comunicaciones-publico",
      titulo: "Elegí a quién le llega",
      texto:
        "Arriba escribís el título y qué dice, o adjuntás el PDF. Acá tocás «Todos» o uno o más grupos: se suman. El recuadro te dice a cuántos les llega.",
      consejo: "Los que no entran al portal aparecen aparte: a ellos avisales en persona.",
    },
    {
      id: "obligatoria",
      ruta: "/comunicaciones/nueva",
      ancla: "comunicaciones-obligatoria",
      titulo: "¿La tienen que confirmar?",
      texto:
        "Con «Recepción obligatoria» prendida, cada uno tiene que tocar «Confirmo que la recibí». Hasta que no lo hace, al entrar a su portal ve solo esa circular. Apagada, es informativa: ves quién la abrió.",
    },
    {
      id: "publicar",
      ruta: "/comunicaciones/nueva",
      ancla: "comunicaciones-publicar",
      titulo: "Publicala",
      texto:
        "El botón te dice a cuántos les llega, por ejemplo «Publicar para 42 clientes». Al tocarlo aparece en el portal de cada uno, y en la circular ves quién la vio y quién todavía no.",
      pantalla: PantallaQuienLaVio,
      consejo:
        "Una circular publicada no se corrige: si hay un error, la desactivás con «Desactivar» y publicás otra.",
    },
    {
      // Tocar la pestaña enseña a cambiar de pestaña. Si toca «Siguiente», el paso que sigue
      // (con "?tab=notificaciones" en la ruta) la abre solo.
      id: "avisos-a-uno",
      ancla: "comunicaciones-pestana-notificaciones",
      accion: "tocar",
      titulo: "Avisos para un solo cliente",
      texto:
        "Una notificación es un aviso formal. Un apercibimiento es un llamado de atención y una sanción, una medida de la cooperativa. Tocá «Notificaciones».",
      consejo:
        rol === "admin"
          ? "Vos les avisás a los puesteros. A quinteros y ambulantes les avisa el Líder, junto con el Jefe de Portería."
          : "Si el cliente no entra al portal, el sistema te lo marca: a ese avisale en persona.",
    },
    {
      id: "nuevo-aviso",
      ruta: "/comunicaciones?tab=notificaciones",
      ancla: "comunicaciones-nuevo-registro",
      titulo: "Mandar un aviso",
      texto:
        "Con «Nueva notificación» buscás al cliente por su puesto o su nombre, contás qué pasó y se lo mandás. Antes de mandarlo ves cómo lo va a ver el socio.",
      pantalla: PantallaNuevoRegistro,
      sinAncla: {
        texto:
          "En cada una de esas pestañas hay un botón para mandar uno nuevo. Lo buscás por su puesto o su nombre, contás qué pasó y se lo mandás. Así es la pantalla:",
      },
      consejo:
        "En apercibimientos y sanciones podés sumar una multa: se agrega a su cuenta como un cargo más.",
    },
    {
      id: "seguimiento",
      ruta: "/comunicaciones/registros/[id]",
      entrar: "comunicaciones-registro",
      ancla: "comunicaciones-seguimiento",
      titulo: "Si lo vio y en qué quedó",
      texto:
        "Cada aviso muestra su recorrido: «Notificado», la respuesta o el descargo del socio, y «Respondido». Abajo dice si el socio ya lo abrió, con fecha y hora.",
      sinAncla: {
        texto:
          "Cada aviso que mandás queda en la lista de su pestaña. Al abrirlo ves su recorrido: «Notificado», la respuesta o el descargo del socio, y «Respondido». También si el socio ya lo abrió, con fecha y hora.",
        pantalla: PantallaSeguimientoRegistro,
      },
    },
    {
      id: "responder",
      ruta: "/comunicaciones/registros/[id]",
      entrar: "comunicaciones-registro",
      ancla: "comunicaciones-responder",
      titulo: "Contestale desde acá",
      texto:
        "Cuando el socio contesta o presenta su descargo, la pestaña se marca con un número rojo y ese aviso queda primero en la lista. Leés lo que dice y le contestás en este recuadro: le llega a su portal.",
      sinAncla: {
        texto:
          "Cuando el socio contesta o presenta su descargo, la pestaña se marca con un número rojo. Abrís el aviso, leés lo que dice y le contestás abajo: le llega a su portal.",
        pantalla: PantallaDescargo,
      },
      consejo:
        "Si una multa no corresponde, en el aviso está «Dejar sin efecto la multa»: se saca de su cuenta y queda anotado quién lo hizo y por qué.",
    },
  ],
};

// ---------------------------------------------------------------------------
// Novedades del personal (Jefe de Portería, Administración y Líder)
// ---------------------------------------------------------------------------

function pasosNovedadesJefe(): Paso[] {
  return [
    {
      id: "que-es",
      ancla: "encabezado",
      titulo: "Las novedades del personal",
      texto:
        "Acá anotás las faltas, llegadas tarde, feriados trabajados, vacaciones, licencias y horas extra del personal de Portería. Con esto se arma la planilla del mes para los sueldos.",
    },
    pasoCargar(),
    pasoQuien("guardia"),
    pasoQuePaso(),
    {
      id: "enviar",
      ruta: "/novedades/nueva",
      ancla: "novedades-confirmar",
      titulo: "Leé la frase y enviala",
      texto:
        "Abajo queda todo escrito en una frase, para que lo leas antes de mandarlo. Si está bien, tocás «Enviar a Administración» y le llega para aprobar.",
      pantalla: PantallaNovedadEnviada,
      sinAncla: {
        texto:
          "Cuando está todo, abajo aparece en una frase lo que vas a mandar. Si está bien, tocás «Enviar a Administración» y le llega para aprobar. Así se ve:",
        pantalla: PantallaEnviarNovedad,
      },
    },
    pasoPlanilla("guardia", "Mientras espera el OK de Administración, desde el detalle la podés «Corregir» o «Borrar»."),
    pasoMes(),
    {
      id: "rechazadas",
      ancla: "novedades-rechazadas",
      titulo: "Si te rechazan una",
      texto:
        "Si Administración rechaza una novedad, aparece acá con el motivo. «Cargarla de nuevo» te abre el formulario con el empleado y lo que pasó ya elegidos. «Entendido» la saca del aviso.",
      sinAncla: {
        texto:
          "Si Administración rechaza una novedad que cargaste, aparece arriba de la planilla con el motivo, para que la corrijas. Así se ve:",
        pantalla: PantallaRechazada,
      },
    },
  ];
}

function pasosNovedadesRevisan(rol: Rol): Paso[] {
  return [
    {
      id: "que-es",
      ancla: "encabezado",
      titulo: "Las novedades del personal",
      texto:
        rol === "lider"
          ? "Acá se anotan las faltas, llegadas tarde, feriados trabajados, vacaciones, licencias y horas extra de todo el personal. Con esto se arma la planilla del mes para los sueldos."
          : "Acá anotás las faltas, llegadas tarde, feriados trabajados, vacaciones, licencias y horas extra de Portería, Limpieza y Mantenimiento. Con esto se arma la planilla del mes para los sueldos.",
    },
    {
      id: "bandeja",
      ancla: "novedades-bandeja",
      titulo: "Lo que espera tu OK",
      texto:
        "Lo que carga el Jefe de Portería llega acá. Leés la frase y tocás «Aprobar», o «Rechazar» contando el motivo. Hasta que la apruebes, no cuenta en la planilla.",
      sinAncla: {
        texto:
          "Cuando el Jefe de Portería cargue una novedad, aparece acá arriba para que la apruebes o la rechaces. Hasta que la apruebes, no cuenta en la planilla. Así se ve:",
        pantalla: PantallaBandeja,
      },
      consejo: "Si son varias y están bien, «Aprobar todas» las aprueba de una vez.",
    },
    pasoCargar(),
    pasoQuien(rol),
    pasoQuePaso(),
    {
      id: "guardar",
      ruta: "/novedades/nueva",
      ancla: "novedades-confirmar",
      titulo: "Leé la frase y guardala",
      texto:
        "Abajo queda todo escrito en una frase, para que lo leas antes de guardarlo. Si está bien, tocás «Guardar novedad»: queda aprobada y cuenta en la planilla.",
      pantalla: PantallaNovedadGuardada,
      sinAncla: {
        texto:
          "Cuando está todo, abajo aparece en una frase lo que vas a guardar. Si está bien, tocás «Guardar novedad»: queda aprobada y cuenta en la planilla. Así se ve:",
        pantalla: PantallaGuardarNovedad,
      },
    },
    pasoPlanilla(rol, "Lo aprobado no se borra: si hubo un error, en el detalle está «Anular», con el motivo."),
    pasoMes(),
    {
      id: "imprimir",
      ancla: "novedades-imprimir",
      titulo: "La planilla para los sueldos",
      texto:
        "A fin de mes tocás «Imprimir planilla»: sale cada empleado con sus horas y sus novedades aprobadas, con lugar para la firma del Líder y de Administración. Lo que espera aprobación no entra.",
      pantalla: PantallaPlanillaImpresa,
      consejo: "«Exportar el mes» te da lo mismo en una planilla de Excel.",
    },
  ];
}

function pasoCargar(): Paso {
  return {
    id: "cargar",
    ancla: "novedades-cargar",
    accion: "tocar",
    titulo: "Tocá «Cargar novedad»",
    texto: "Se abre una sola pantalla que se va completando de a poco: a quién le pasó, qué pasó y cuándo.",
  };
}

function pasoQuien(rol: Rol): Paso {
  return {
    id: "quien",
    ruta: "/novedades/nueva",
    // Se ilumina un nombre y no toda la sección: así no se puede escribir en el buscador
    // (con Enter se mandaría el formulario si ya está completo).
    ancla: ["novedades-empleado-opcion", "novedades-quien"],
    accion: "tocar",
    titulo: "¿A quién le pasó?",
    texto:
      "Tocá el nombre del empleado. Podés elegir varios juntos, por ejemplo si todos trabajaron un feriado.",
    variantes: {
      "novedades-quien": {
        accion: "mirar",
        texto:
          rol === "lider"
            ? "Acá elegís a quién le pasó, tocando su nombre. Si no aparece nadie, primero cargá al personal en «Personal»."
            : "Acá elegís a quién le pasó, tocando su nombre. Si no aparece nadie, pedile al Líder que cargue al personal en «Personal».",
      },
    },
    consejo: "Es de práctica: mientras dura la guía no se guarda nada.",
  };
}

function pasoQuePaso(): Paso {
  return {
    id: "que-paso",
    ruta: "/novedades/nueva",
    ancla: "novedades-que-paso",
    accion: "tocar",
    titulo: "¿Qué pasó?",
    texto:
      "Tocá lo que pasó: «Faltó», «Llegó tarde», «Trabajó un feriado», «Vacaciones», «Licencia», «Horas extra» u «Otra». Según lo que elijas, te pregunta el día, los minutos o las horas.",
    sinAncla: {
      texto:
        "Cuando elegís a alguien, aparece «¿Qué pasó?»: «Faltó», «Llegó tarde», «Vacaciones» y las demás. Según lo que elijas, te pregunta el día, los minutos o las horas. Así se ve:",
      pantalla: PantallaQuePaso,
    },
    consejo: "En una falta o una licencia podés sacarle una foto al certificado: queda guardado con la novedad.",
  };
}

function pasoPlanilla(rol: Rol, consejo: string): Paso {
  // "Mirar" con el dibujo del detalle abierto: si se tocara la fila, el tour pasaría al
  // paso siguiente sin explicar lo que se abrió.
  return {
    id: "planilla",
    ancla: "novedades-empleado",
    titulo: "La planilla del mes",
    texto:
      "Cada empleado con las horas que marcó en Portería contra las que debería tener, y sus novedades aprobadas. Si tocás un nombre, se abre el detalle. Así:",
    pantalla: rol === "guardia" ? PantallaPlanillaJefe : PantallaPlanilla,
    sinAncla: {
      texto:
        rol === "lider"
          ? "Cuando cargues al personal en «Personal», acá aparece cada empleado con sus horas y sus novedades. Tocás un nombre y ves el detalle. Así se ve:"
          : "Cuando el Líder cargue al personal en «Personal», acá aparece cada empleado con sus horas y sus novedades. Tocás un nombre y ves el detalle. Así se ve:",
    },
    consejo,
  };
}

function pasoMes(): Paso {
  return {
    id: "mes",
    ancla: "novedades-mes",
    titulo: "Otros meses",
    texto: "Con las flechas mirás un mes anterior. En el mes en curso, las horas se cuentan hasta hoy.",
  };
}

/** Capítulo "novedades" (metadatos en src/lib/tour/indice.ts). */
export const NOVEDADES: ContenidoCapitulo = {
  portada: PortadaNovedades,
  portadaPorRol: (rol) => (rol === "guardia" ? PortadaNovedadesJefe : undefined),
  pasos: (rol: Rol): Paso[] => (rol === "guardia" ? pasosNovedadesJefe() : pasosNovedadesRevisan(rol)),
};

// ---------------------------------------------------------------------------
// Comunicaciones del socio (portal)
// ---------------------------------------------------------------------------

/** Capítulo "socio-comunicaciones" (metadatos en src/lib/tour/indice.ts). */
export const SOCIO_COMUNICACIONES: ContenidoCapitulo = {
  portada: PortadaSocioComunicaciones,
  pasos: (): Paso[] => [
    {
      // Con una circular obligatoria sin confirmar, el portal muestra solo esa (GateCirculares):
      // su título lleva "encabezado" y "socio-comunicaciones-bloqueo".
      id: "que-es",
      ancla: ["socio-comunicaciones-bloqueo", "encabezado"],
      titulo: "Lo que te manda la cooperativa",
      texto: "Acá llegan las circulares para todos y los avisos que la cooperativa te manda a vos.",
      variantes: {
        "socio-comunicaciones-bloqueo": {
          titulo: "Primero, esta circular",
          texto:
            "La cooperativa te mandó una circular que tenés que confirmar. Hasta que la confirmes, vas a ver solo esa. Igual te muestro cómo es esta sección.",
        },
      },
    },
    {
      id: "pestanas",
      ancla: "socio-comunicaciones-pestanas",
      titulo: "Cuatro pestañas",
      texto:
        "«Circulares» son avisos para todos. «Notificaciones», «Apercibimientos» y «Sanciones» son avisos solo para vos. El número de color te dice cuántas cosas nuevas hay en cada una.",
      // Con una circular para confirmar, el portal muestra solo esa: no hay pestañas a la vista.
      sinAncla: { pantalla: PortadaSocioComunicaciones },
    },
    {
      id: "circulares",
      // Si está en otra pestaña (o todavía no hay circulares), se señala la pestaña.
      ancla: ["socio-comunicaciones-circular", "socio-comunicaciones-pestana-circulares"],
      titulo: "Las circulares",
      texto:
        "Las que todavía no abriste dicen «Nueva». Tocás una y la leés entera; si trae un PDF, lo abrís ahí mismo. Después pasa a «Leída».",
      pantalla: PantallaCircularSocio,
      variantes: {
        "socio-comunicaciones-pestana-circulares": {
          texto:
            "En «Circulares» están los avisos para todos. Cuando llega una nueva, dice «Nueva» hasta que la abrís. Así se ve por dentro:",
        },
      },
      sinAncla: {
        texto:
          "Cuando la cooperativa publique una circular para tu grupo, aparece en «Circulares» con el sello «Nueva». Así se ve por dentro:",
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
      consejo: "Las circulares no se responden. Si tenés una duda, hacé una solicitud.",
    },
    {
      id: "avisos",
      ancla: "socio-comunicaciones-pestana-notificaciones",
      accion: "tocar",
      titulo: "Avisos solo para vos",
      texto:
        "En las otras pestañas están los avisos que la cooperativa te manda a vos. Un apercibimiento es un llamado de atención y una sanción, una medida: los dos pueden traer una multa. Tocá «Notificaciones».",
      sinAncla: {
        texto:
          "En las otras pestañas están los avisos que la cooperativa te manda a vos. Un apercibimiento es un llamado de atención y una sanción, una medida: los dos pueden traer una multa.",
      },
    },
    {
      // Si tocó «Siguiente» en vez de la pestaña, la ruta la abre sola.
      id: "sellos",
      ruta: "/mi-cuenta/comunicaciones?tab=notificaciones",
      ancla: "socio-comunicaciones-registro",
      titulo: "Qué te pide cada aviso",
      texto:
        "El sello te dice qué hacer: «Nueva» si no lo abriste, «Tenés que responder» si espera tu descargo, «Respuesta nueva» si la cooperativa te contestó.",
      sinAncla: {
        texto:
          "En cada pestaña, los avisos llevan un sello que te dice qué hacer: «Nueva», «Tenés que responder» o «Respuesta nueva». Así se ve:",
        pantalla: PantallaAvisosSocio,
      },
    },
    {
      // Con el dibujo y sin abrir un aviso de verdad: abrirlo lo marca como visto
      // (RegistrarVista) y la cooperativa vería "lo abrió" aunque fuera la guía.
      id: "descargo",
      titulo: "Contá tu versión",
      texto:
        "Adentro de cada aviso ves qué pasó y la multa, si tiene: se suma a tu cuenta. Abajo contás tu versión en «Presentar mi descargo» (en una notificación dice «Responder») y podés sumar una foto.",
      pantalla: PantallaDescargoSocio,
      consejo: "La respuesta de la cooperativa te llega ahí mismo, con el sello «Respuesta nueva».",
    },
  ],
};
