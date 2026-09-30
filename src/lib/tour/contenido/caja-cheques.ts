import type { Rol } from "@/lib/auth";
import type { ContenidoCapitulo, Paso } from "@/lib/tour/tipos";
import {
  PantallaAcreditar,
  PantallaAjuste,
  PantallaArqueo,
  PantallaCartera,
  PantallaCerrar,
  PantallaChequesListos,
  PantallaCicloCheque,
  PantallaCierreImpreso,
  PantallaCircuito,
  PantallaCircuitoAdmin,
  PantallaCircuitoPorteria,
  PantallaCircuitoTesoreria,
  PantallaCobrosDia,
  PantallaCobrosPorteria,
  PantallaCanon,
  PantallaDepositar,
  PantallaEntregar,
  PantallaGastosCaja,
  PantallaHistorial,
  PantallaJuntado,
  PantallaJuntadoPorteria,
  PantallaPedidosReapertura,
  PantallaPedirReapertura,
  PantallaRechazar,
  PantallaRecibir,
  PantallaRendida,
  PantallaRendir,
  PantallaUltimosDias,
  PantallaValidar,
  PortadaCaja,
  PortadaCheques,
} from "@/components/tour/pantallas/caja-cheques";

// Tour guiado · caja-cheques: pasos de los capítulos de esta área (docs/GUIA-TOUR.md).
//
// La caja cambia mucho por rol y por estado (sin abrir → abierta → cerrada/rendida → en caja
// mayor → validada; pedido de reapertura). Cada paso que depende del estado señala varias
// anclas (la primera a la vista gana) y trae su pantalla de ejemplo para cuando no hay nada:
// producción arranca sin cajas ni cobros.

// ---------------------------------------------------------------------------
// Caja — pasos que se repiten entre roles
// ---------------------------------------------------------------------------

/** Cada cobro del día con su recibo (fila real, o la tarjeta vacía con el ejemplo). */
function pasoCobros(porteria: boolean): Paso {
  const pantalla = porteria ? PantallaCobrosPorteria : PantallaCobrosDia;
  const quien = porteria ? "ese quintero o ambulante" : "el cliente";
  return {
    id: "cobros",
    ancla: ["caja-cobro", "caja-cobros"],
    titulo: "Cada cobro, con su recibo",
    texto:
      "Cada cobro aparece así: a quién, cuánto y cómo pagó. Con «Ver recibo» lo volvés a mostrar o a imprimir.",
    consejo: `Si cargaste mal un cobro, tocá «Anular» mientras la caja está abierta: ${quien} vuelve a deber ese monto.`,
    variantes: {
      "caja-cobros": {
        texto: `Acá abajo va a aparecer cada cobro que hagas desde «Cobrar»: a quién, cuánto y cómo pagó. Así se ve con cobros:`,
        pantalla,
      },
    },
    sinAncla: {
      texto:
        "Con la caja abierta, abajo aparece cada cobro que hacés desde «Cobrar»: a quién, cuánto y cómo pagó, con su recibo.",
      pantalla,
    },
  };
}

/** Tesorería y el Líder: faltantes, sobrantes y comisiones de la caja. */
const pasoAjustes: Paso = {
  id: "ajustes",
  ancla: ["caja-cargar-ajuste", "caja-ajustes"],
  titulo: "Si falta o sobra plata",
  texto:
    "Si hubo una comisión del banco o un redondeo, tocá «Cargar un ajuste». Elegís si falta o sobra plata, dónde (en el cajón o en el banco), cuánto y por qué.",
  pantalla: PantallaAjuste,
  consejo: "Un ajuste se puede borrar mientras la caja no esté validada, y todo queda anotado en el historial.",
  variantes: {
    "caja-ajustes": {
      texto:
        "Acá quedan los faltantes, sobrantes y comisiones de esta caja, con el nombre de quien los cargó. Entran en la cuenta del arqueo.",
      pantalla: undefined,
    },
  },
  sinAncla: {
    texto:
      "Mientras una caja no está validada, abajo aparece «Ajustes de tesorería» con «Cargar un ajuste»: si falta o sobra, dónde, cuánto y por qué.",
  },
};

/** Tesorería y el Líder: pedidos de reapertura y reabrir una caja cerrada. */
function pasoReaperturas(rol: Rol): Paso {
  return {
    id: "reaperturas",
    ancla: ["caja-pedidos-reapertura", "caja-reabrir"],
    titulo: "Si hay que corregir",
    texto:
      rol === "tesoreria"
        ? "Si alguien pide reabrir una caja, lo ves acá con su motivo: tocá «Autorizar y reabrir» o «Rechazar». Las que ya entraron en la caja mayor las reabrís vos: Administración no puede."
        : "Si alguien pide reabrir una caja, lo ves acá con su motivo: tocá «Autorizar y reabrir» o «Rechazar». Las que ya están en la caja mayor las reabren Tesorería o vos.",
    variantes: {
      "caja-reabrir": {
        texto:
          "Mientras no esté validada, una caja cerrada se puede reabrir con «Reabrir caja» para corregirla. Te pide el motivo y queda en el historial.",
      },
    },
    sinAncla: {
      texto:
        "Mientras no está validada, una caja se puede reabrir para corregirla. Si alguien lo pide, te aparece arriba con su motivo, así:",
      pantalla: PantallaPedidosReapertura,
    },
  };
}

/** Tesorería y el Líder: las dos pestañas con su sello. */
function pasoPestanias(rol: Rol): Paso {
  return {
    id: "pestanias",
    ancla: "caja-pestanias",
    titulo: "Dos cajas por día",
    texto:
      rol === "tesoreria"
        ? "Arriba elegís cuál mirar: «Administración» o «Caja de portería». El sello de cada una te dice cómo está: «Abierta», «Cerrada», «En caja mayor» o «Validada»."
        : "Arriba elegís cuál mirar: «Administración» o «Caja de portería». El sello te dice cómo está cada una: «Abierta», «Cerrada», «En caja mayor» o «Validada».",
    consejo: "Si una pestaña dice «sin abrir», esa caja no se abrió ese día.",
  };
}

// ---------------------------------------------------------------------------
// Caja — por rol
// ---------------------------------------------------------------------------

/** Jefe de Portería: su caja de quinteros, ambulantes y bono camioneros, que rinde a Administración. */
function pasosCajaPorteria(): Paso[] {
  return [
    {
      id: "que-es",
      ancla: "encabezado",
      titulo: "Tu caja de portería",
      texto:
        "Acá se junta lo que cobrás a quinteros y ambulantes, y el bono camioneros que cobra Portería en la garita. Al terminar el día, la rendís a Administración.",
    },
    {
      id: "juntado",
      ancla: ["caja-totales", "caja-abrir"],
      titulo: "Lo juntado hoy, en vivo",
      texto:
        "Cada cobro suma acá al instante: cuánto hay en efectivo, cuánto por transferencia, y de dónde vino (quintas, ambulantes y bono camioneros).",
      variantes: {
        "caja-abrir": {
          titulo: "Tu caja se abre sola",
          texto:
            "Se abre con tu primer cobro del día, o con el primer bono camioneros de la garita. Si querés dejarla lista antes, tocá «Abrir la caja de portería». Abierta, arriba ves lo juntado:",
          pantalla: PantallaJuntadoPorteria,
        },
      },
      sinAncla: {
        texto:
          "Mientras tu caja está abierta, arriba ves lo juntado en vivo: el efectivo, las transferencias y de dónde vino cada peso.",
        pantalla: PantallaJuntadoPorteria,
      },
    },
    pasoCobros(true),
    {
      id: "canon",
      ancla: "caja-canon",
      titulo: "El bono camioneros",
      texto:
        "Lo que cobra Portería en la garita a camiones y camionetas también entra en tu caja. Lo ves acá, uno por uno.",
      sinAncla: {
        texto:
          "Lo que cobra Portería en la garita a camiones y camionetas también entra en tu caja. Lo ves uno por uno, así:",
        pantalla: PantallaCanon,
      },
    },
    {
      id: "rendir",
      ancla: ["caja-cerrar", "caja-arqueo"],
      titulo: "Al terminar, rendí la caja",
      texto:
        "Cuando terminás el día, tocá «Rendir caja». Antes de confirmar te dice cuánto efectivo tenés que entregar en Administración.",
      pantalla: PantallaRendir,
      consejo: "Después de rendir ya no se cobra más en esta caja; si hubo un error, pedís la reapertura.",
      variantes: {
        "caja-arqueo": {
          titulo: "Tu caja ya está rendida",
          texto:
            "Acá ves la cuenta de lo que rendiste. Mientras Administración no la reciba, arriba te dice cuánto efectivo tenés que entregarle.",
          pantalla: undefined,
        },
      },
      sinAncla: {
        texto:
          "Con la caja abierta, al final del día aparece «Rendir caja». Antes de confirmar te dice cuánto efectivo tenés que entregar en Administración:",
      },
    },
    {
      id: "entregar",
      ancla: "caja-imprimir",
      titulo: "Llevá la plata y el papel",
      texto:
        "Al rendir te dice «Entregá en Administración» y cuánto. Llevá esa plata. Con «Imprimir cierre» sacás la hoja con la cuenta, para firmar cuando la entregás.",
      pantalla: PantallaRendida,
      consejo: "Con la caja abierta el botón dice «Imprimir parcial»: sirve para ver cómo vas.",
      sinAncla: {
        texto:
          "Al rendir te dice «Entregá en Administración» y cuánto. Llevá esa plata. Con la caja rendida, arriba aparece «Imprimir cierre»: saca la hoja con la cuenta, para firmar cuando la entregás.",
      },
    },
    {
      id: "reapertura",
      ancla: "caja-pedir-reapertura",
      titulo: "Si te equivocaste",
      texto:
        "Si después de rendir notás un error, tocá «Pedir reapertura» y contá qué pasó. Lo ve Administración (o Tesorería, si ya la recibieron) y, si lo autoriza, la caja vuelve a quedar abierta.",
      pantalla: PantallaPedirReapertura,
      consejo: "Mientras la caja está abierta no hace falta: anulás el cobro y lo cargás de nuevo.",
      sinAncla: {
        texto:
          "Si después de rendir notás un error (un cobro cargado dos veces, por ejemplo), aparece «Pedir reapertura». Contás qué pasó y Administración lo autoriza:",
      },
    },
    {
      id: "despues",
      ancla: "caja-ultimos",
      titulo: "Qué pasa con tu caja",
      texto:
        "Administración cuenta el efectivo que le entregás y lo suma a la caja mayor. Al día siguiente, Tesorería valida todo. En «Últimos días» ves cómo quedó cada caja.",
      pantalla: PantallaCircuitoPorteria,
      sinAncla: {
        texto:
          "Administración cuenta el efectivo que le entregás y lo suma a la caja mayor. Al día siguiente, Tesorería valida todo. El sello de tu caja te dice en qué paso está.",
      },
    },
  ];
}

/** Administración: su caja del día, la rendición de Portería y el cierre con arqueo. */
function pasosCajaAdministracion(): Paso[] {
  return [
    {
      id: "que-es",
      ancla: "encabezado",
      titulo: "Tu caja del día",
      texto:
        "Acá se junta todo lo que cobrás hoy: efectivo, transferencias y cheques. También entra la caja de Portería cuando la recibís. Al final del día la cerrás y el sistema hace la cuenta.",
    },
    {
      id: "juntado",
      ancla: ["caja-totales", "caja-abrir"],
      titulo: "Lo juntado hoy, en vivo",
      texto:
        "Cada cobro suma acá al instante, separado en efectivo, transferencias y cheques. Cuando recibís la caja de Portería, también se suma y aparece en la parte de abajo.",
      variantes: {
        "caja-abrir": {
          titulo: "La caja se abre sola",
          texto:
            "Se abre con tu primer cobro del día. Si querés dejarla lista antes, tocá «Abrir caja». Abierta, acá arriba ves lo juntado:",
          pantalla: PantallaJuntado,
        },
      },
      sinAncla: {
        texto:
          "Mientras la caja está abierta, arriba ves lo juntado en vivo, separado en efectivo, transferencias y cheques.",
        pantalla: PantallaJuntado,
      },
    },
    pasoCobros(false),
    {
      id: "recibir",
      ancla: "caja-recibir",
      titulo: "Recibí la caja de Portería",
      texto:
        "Cuando el Jefe de Portería rinde, su caja aparece acá. Tocá «Recibir e integrar», poné cuánto efectivo te entregó y confirmá. Entra en tu caja de hoy.",
      pantalla: PantallaRecibir,
      consejo: "Si no coincide, contá qué pasó: queda como faltante o sobrante de Portería y lo ve Tesorería.",
      sinAncla: {
        texto:
          "Cuando el Jefe de Portería rinde su caja, arriba aparece «Cajas de portería para recibir». Tocás «Recibir e integrar», ponés cuánto efectivo te entregó y confirmás:",
      },
    },
    {
      id: "gastos",
      ancla: "caja-gastos",
      titulo: "Gastos pagados con la caja",
      texto:
        "Si pagás algo con la plata de la caja, cargalo con «Pagar un gasto desde esta caja». Se resta del efectivo que tenés que tener.",
      sinAncla: {
        texto:
          "Si pagás algo con la plata de la caja (artículos de limpieza, una reparación), se carga desde acá y se resta del efectivo que tenés que tener:",
        pantalla: PantallaGastosCaja,
      },
    },
    {
      id: "cerrar",
      ancla: ["caja-cerrar", "caja-arqueo"],
      titulo: "Al terminar, «Cerrar caja»",
      texto:
        "Cuando terminás el día, tocá «Cerrar caja». Antes de confirmar te muestra la cuenta: lo juntado, menos los gastos, y cuánto tenés que tener.",
      pantalla: PantallaCerrar,
      consejo: "Después de cerrar no se cargan más cobros; si te olvidaste de algo, se reabre mientras Tesorería no la valide.",
      variantes: {
        "caja-arqueo": {
          titulo: "El arqueo de tu caja",
          texto:
            "Tu caja ya está cerrada. Esta es la cuenta: lo juntado, menos los gastos, más o menos los ajustes. Abajo, cuánto tiene que haber en el cajón, en el banco y en cheques.",
          pantalla: undefined,
          consejo: "Si te olvidaste de algo, tocá «Reabrir caja» mientras Tesorería no la valide.",
        },
      },
      sinAncla: {
        texto:
          "Con la caja abierta, al final del día aparece «Cerrar caja». Antes de confirmar te muestra la cuenta: lo juntado, menos los gastos, y cuánto tenés que tener:",
      },
    },
    {
      id: "contar",
      ancla: "caja-imprimir",
      titulo: "Contá y guardá el papel",
      texto:
        "Con la caja cerrada, contá la plata y fijate que coincida. «Imprimir cierre» saca la hoja con la cuenta y el lugar para las firmas.",
      pantalla: PantallaCierreImpreso,
      consejo: "Con la caja abierta el botón dice «Imprimir parcial»: sirve para ver cómo vas.",
      sinAncla: {
        texto:
          "Con la caja cerrada, contá la plata y fijate que coincida. Arriba aparece «Imprimir cierre», que saca esta hoja con la cuenta y las firmas:",
      },
    },
    {
      id: "reaperturas",
      ancla: "caja-pedidos-reapertura",
      titulo: "Pedidos de reapertura",
      texto:
        "Si el Jefe de Portería se equivocó después de rendir, te pide reabrir su caja con un motivo. Lo ves acá: tocá «Autorizar y reabrir» o «Rechazar».",
      consejo: "Si ya la recibiste en la caja mayor, solo Tesorería puede reabrirla.",
      sinAncla: {
        texto:
          "Si el Jefe de Portería se equivoca después de rendir, te pide la reapertura con un motivo. Te aparece arriba de todo, así:",
        pantalla: PantallaPedidosReapertura,
      },
    },
    {
      id: "despues",
      ancla: "caja-ultimos",
      titulo: "Al día siguiente, Tesorería",
      texto:
        "Tesorería cuenta la plata y valida tu caja: ahí queda cerrada para siempre. En «Últimos días» ves cada caja con su sello.",
      pantalla: PantallaCircuitoAdmin,
      sinAncla: {
        texto:
          "Al día siguiente, Tesorería cuenta la plata y valida tu caja: ahí queda cerrada para siempre. El sello te dice en qué paso está cada caja.",
      },
    },
  ];
}

/** Tesorería: al día siguiente cuenta, ajusta y valida cada caja (el OK final). */
function pasosCajaTesoreria(): Paso[] {
  return [
    {
      id: "que-es",
      ancla: "encabezado",
      titulo: "Las cajas, para tu OK",
      texto:
        "Acá ves las cajas de cada día: la de Administración y la de Portería. Tu trabajo es contar la plata y validarlas. Tu OK es el cierre definitivo.",
    },
    pasoPestanias("tesoreria"),
    {
      id: "otro-dia",
      // "Ir a esa caja" es el botón (no todo el aviso): si toca el texto, no avanza sin navegar.
      ancla: ["caja-otro-dia", "caja-ir-a-esa-caja", "caja-ultimos-dia"],
      accion: "tocar",
      titulo: "Abrí la caja de ayer",
      texto:
        "Las cajas se validan al día siguiente, ya cerradas. Abajo, en «Últimos días», tocá la fecha de la caja que querés revisar.",
      consejo: "En «Tesorería» también ves las cajas que esperan tu OK, y las abrís desde ahí.",
      variantes: {
        "caja-otro-dia": {
          titulo: "Estás en la caja de otro día",
          texto:
            "Arriba dice de qué día es la caja que estás mirando. Para ver otra, tocá su fecha en «Últimos días», abajo. Con «Volver a hoy» volvés a la de hoy.",
          accion: "mirar",
        },
        "caja-ir-a-esa-caja": {
          titulo: "Una caja quedó abierta",
          texto:
            "Arriba te avisa que una caja de otro día sigue abierta: así no se puede validar. Tocá «Ir a esa caja» para cerrarla, contarla y validarla.",
        },
      },
      sinAncla: {
        texto:
          "Las cajas se validan al día siguiente, ya cerradas. Cuando haya cajas de otros días, aparecen abajo en «Últimos días»: tocás la fecha y se abre esa caja.",
        pantalla: PantallaUltimosDias,
      },
    },
    {
      id: "arqueo",
      ancla: ["caja-arqueo", "caja-totales", "caja-sin-abrir"],
      titulo: "La cuenta de la caja",
      texto:
        "Esta es la cuenta de la caja cerrada: lo juntado, menos los gastos, más o menos los ajustes. Abajo, cuánto tiene que haber en el cajón, en el banco y en cheques.",
      variantes: {
        "caja-totales": {
          titulo: "Esta caja sigue abierta",
          texto:
            "Sus números cambian con cada cobro: se valida recién cuando la cierran. Cerrada, la cuenta se ve así:",
          pantalla: PantallaArqueo,
        },
        "caja-sin-abrir": {
          titulo: "Esta caja no se abrió",
          texto:
            "La abre quien cobra, con el primer cobro del día. Cuando esté cerrada, vas a ver su cuenta así:",
          pantalla: PantallaArqueo,
        },
      },
      sinAncla: {
        texto:
          "Cuando una caja está cerrada, ves su cuenta: lo juntado, menos los gastos, más o menos los ajustes, y cuánto tiene que haber en el cajón, en el banco y en cheques.",
        pantalla: PantallaArqueo,
      },
    },
    pasoAjustes,
    {
      id: "validar",
      ancla: ["caja-validar", "caja-cerrar"],
      titulo: "Contá y validá",
      texto:
        "Tocá «Contar y validar», poné cuánto efectivo contaste y confirmá. Si no coincide, el faltante o sobrante queda anotado en el mismo paso.",
      pantalla: PantallaValidar,
      consejo: "Validar es el cierre definitivo: después la caja ya no se reabre.",
      variantes: {
        "caja-cerrar": {
          titulo: "Esta caja quedó abierta",
          texto:
            "Si una caja de un día anterior quedó abierta, cerrala vos con «Cerrar (quedó abierta)». Queda anotado que la cerró Tesorería. Después la contás y la validás.",
          pantalla: undefined,
        },
      },
      sinAncla: {
        texto:
          "Cuando una caja está cerrada, aparece «Contar y validar». Ponés cuánto efectivo contaste y confirmás. Si no coincide, la diferencia queda anotada sola:",
      },
    },
    {
      id: "porteria",
      ancla: "caja-pestania-porteria",
      titulo: "La caja de Portería",
      texto:
        "Administración recibe la caja de Portería y la suma a la suya. Cuando validás la de Administración, se validan con ella las de Portería que recibió.",
      pantalla: PantallaCircuitoTesoreria,
      consejo: "Si Administración todavía no la recibió, la podés recibir vos con «Recibir e integrar».",
    },
    pasoReaperturas("tesoreria"),
    {
      id: "historial",
      ancla: "caja-historial",
      titulo: "Todo queda anotado",
      texto:
        "En «Historial de la caja» ves quién hizo qué y cuándo: el cierre, la recepción, los ajustes y tu validación.",
      sinAncla: {
        texto:
          "Cada caja guarda su historial: quién la abrió, quién la cerró, quién la recibió, los ajustes y tu validación. Lo ves al pie de la caja:",
        pantalla: PantallaHistorial,
      },
    },
  ];
}

/** Líder de Procesos: ve las dos cajas y puede hacer todas las acciones. */
function pasosCajaLider(): Paso[] {
  return [
    {
      id: "que-es",
      ancla: "encabezado",
      titulo: "Las dos cajas del día",
      texto:
        "Ves la caja de Administración y la de Portería. Podés hacer todo lo que hacen ellos: abrir, cerrar, recibir, ajustar y validar. Lo que hagas queda firmado a tu nombre.",
    },
    pasoPestanias("lider"),
    {
      id: "juntado",
      ancla: ["caja-totales", "caja-arqueo", "caja-abrir"],
      titulo: "Cómo viene la caja",
      texto:
        "Con la caja abierta, arriba ves lo juntado en vivo: efectivo, transferencias y cheques, y lo que rindió Portería.",
      variantes: {
        "caja-arqueo": {
          titulo: "La cuenta de la caja",
          texto:
            "La caja está cerrada: lo juntado, menos los gastos, más o menos los ajustes, y cuánto tiene que haber en el cajón, en el banco y en cheques.",
        },
        "caja-abrir": {
          titulo: "Todavía no se abrió",
          texto:
            "Se abre sola con el primer cobro. Si hace falta, la abrís vos con «Abrir caja». Abierta, se ve así:",
          pantalla: PantallaJuntado,
        },
      },
      sinAncla: {
        texto: "Con la caja abierta, arriba ves lo juntado en vivo, separado en efectivo, transferencias y cheques:",
        pantalla: PantallaJuntado,
      },
    },
    {
      id: "circuito",
      titulo: "El recorrido de la plata",
      texto:
        "Portería rinde su caja a Administración. Administración la recibe, la suma a la suya y cierra. Al día siguiente, Tesorería cuenta y valida: ese es el cierre definitivo.",
      pantalla: PantallaCircuito,
    },
    {
      id: "accion",
      ancla: ["caja-validar", "caja-recibir", "caja-cerrar"],
      titulo: "Lo que falta hacer",
      texto:
        "Según cómo esté la caja, acá aparece lo que falta: «Cerrar caja», «Recibir e integrar» o «Contar y validar».",
      variantes: {
        "caja-validar": {
          titulo: "Contá y validá",
          texto:
            "La caja está cerrada: tocá «Contar y validar», poné cuánto efectivo hay y confirmá. Es el cierre definitivo.",
          pantalla: PantallaValidar,
        },
        "caja-recibir": {
          titulo: "Recibir la caja de Portería",
          texto:
            "Portería ya rindió. Tocá «Recibir e integrar», poné cuánto efectivo te entregaron y confirmá: entra en la caja de Administración.",
          pantalla: PantallaRecibir,
        },
        "caja-cerrar": {
          titulo: "Cerrar la caja",
          texto:
            "Al terminar el día, este botón cierra la caja (en Portería dice «Rendir caja»). Antes de confirmar muestra la cuenta:",
          pantalla: PantallaCerrar,
        },
      },
      sinAncla: {
        texto:
          "Según cómo esté la caja, arriba aparece lo que falta hacer: cerrarla, recibirla o validarla. Validar se ve así:",
        pantalla: PantallaValidar,
      },
    },
    pasoAjustes,
    pasoReaperturas("lider"),
    {
      id: "ultimos",
      ancla: "caja-ultimos",
      titulo: "Otros días",
      texto:
        "En «Últimos días» abrís la caja de cualquier día tocando la fecha. La impresora de cada fila saca su cierre.",
      sinAncla: {
        texto:
          "Cuando haya cajas de otros días, aparecen abajo en «Últimos días», con su sello. Tocás la fecha y se abre esa caja:",
        pantalla: PantallaUltimosDias,
      },
    },
  ];
}

/** Capítulo "caja" (metadatos en src/lib/tour/indice.ts). */
export const CAJA: ContenidoCapitulo = {
  portada: PortadaCaja,
  pasos: (rol) => {
    if (rol === "guardia") return pasosCajaPorteria();
    if (rol === "admin") return pasosCajaAdministracion();
    if (rol === "tesoreria") return pasosCajaTesoreria();
    if (rol === "lider") return pasosCajaLider();
    return [];
  },
};

// ---------------------------------------------------------------------------
// Cheques (Tesorería y el Líder, con las mismas acciones)
// ---------------------------------------------------------------------------

/** Capítulo "cheques" (metadatos en src/lib/tour/indice.ts). */
export const CHEQUES: ContenidoCapitulo = {
  portada: PortadaCheques,
  pasos: (rol) => {
    if (rol !== "tesoreria" && rol !== "lider") return [];
    return [
      {
        id: "que-es",
        ancla: "encabezado",
        titulo: "Los cheques recibidos",
        texto:
          rol === "tesoreria"
            ? "Acá llegan los cheques que recibe Administración al cobrar. Vos los llevás al banco o se los das a un proveedor para pagar un gasto. Arriba ves cuánto hay por cobrar."
            : "Acá están los cheques que recibe Administración al cobrar, hasta que se cobran. Los mueve Tesorería, y vos también podés. Arriba ves cuánto hay por cobrar.",
      },
      {
        id: "estados",
        ancla: "cheques-filtros",
        accion: "tocar",
        titulo: "Cada cheque, en su paso",
        texto:
          "Un cheque empieza en «Por cobrar». Cuando llega su fecha pasa a «Listos para depositar», y después a «Depositados» y «Acreditados». Tocá uno de estos botones para ver esos cheques.",
        pantalla: PantallaCicloCheque,
        consejo: "El número dice cuántos hay; los que piden tu atención se pintan de amarillo.",
      },
      {
        id: "buscar",
        ancla: "cheques-buscar",
        accion: "tocar",
        titulo: "Buscar un cheque",
        texto: "Escribí el número del cheque, el puesto o el nombre de quien lo entregó, y tocá «Buscar».",
        consejo: "Buscar no cambia nada: solo te muestra los cheques que coinciden.",
      },
      {
        // El botón, no todo el aviso: si toca el texto, el tour no sigue sin abrir la lista.
        id: "listos",
        ancla: "cheques-ver-listos",
        accion: "tocar",
        titulo: "Los que ya se pueden cobrar",
        texto:
          "Cuando llega la fecha de cobro de un cheque, arriba te avisa cuántos están listos. Tocá «Ver los listos» para ver cuáles llevar al banco.",
        sinAncla: {
          accion: "mirar",
          texto:
            "Cuando llega la fecha de cobro de un cheque, arriba te aparece un aviso así. Con «Ver los listos» ves cuáles llevar al banco:",
          pantalla: PantallaChequesListos,
        },
      },
      {
        id: "cheque",
        ancla: "cheques-fila",
        titulo: "Cada cheque",
        texto:
          "Tiene su número, el monto, el puesto, quién lo entregó y desde qué día se puede cobrar. Si dice «Diferido», todavía no se puede depositar.",
        sinAncla: {
          texto:
            "Cuando haya cheques, cada uno aparece así: número, monto, puesto, quién lo entregó y desde qué día se cobra. Si dice «Diferido», todavía no se puede depositar.",
          pantalla: PantallaCartera,
        },
      },
      {
        id: "depositar",
        ancla: ["cheques-depositar", "cheques-depositar-diferido"],
        titulo: "Depositar en el banco",
        texto:
          "Cuando lo llevás al banco, tocá «Depositar» y elegí qué día lo depositaste. Pasa a «Depositados».",
        pantalla: PantallaDepositar,
        consejo: "Si te equivocaste, en «Depositados» está «Deshacer depósito»: el cobro del cliente no se toca.",
        variantes: {
          "cheques-depositar-diferido": {
            texto:
              "Este todavía no se puede depositar: «Depositar» se habilita el día de cobro. Ese día lo tocás y elegís qué día lo llevaste al banco.",
          },
        },
        sinAncla: {
          texto:
            "Cuando lo llevás al banco, tocás «Depositar» en ese cheque y elegís qué día lo depositaste. Pasa a «Depositados»:",
        },
      },
      {
        id: "acreditar",
        ancla: "cheques-acreditar",
        titulo: "Cuando el banco lo acredita",
        texto:
          "Unas 72 horas después, fijate en el banco. Si ya está, tocá «Se acreditó»: la plata suma al saldo del banco, en «Tesorería».",
        pantalla: PantallaAcreditar,
        sinAncla: {
          texto:
            "Unas 72 horas después del depósito, fijate en el banco. Si ya está, en «Depositados» tocás «Se acreditó» y la plata suma al saldo del banco:",
        },
      },
      {
        id: "entregar",
        ancla: "cheques-entregar",
        titulo: "Pagarle a un proveedor",
        texto:
          "Si le das el cheque a un proveedor, tocá «Entregar a proveedor». Escribís a quién, qué día y, si querés, qué gasto paga: ese gasto queda pagado.",
        pantalla: PantallaEntregar,
        consejo:
          "Si en un cobro se entregó un cheque y no dice qué gasto pagó, arriba aparece «Elegir los gastos».",
        sinAncla: {
          texto:
            "Si le das un cheque a un proveedor, tocás «Entregar a proveedor» en ese cheque. Escribís a quién, qué día y qué gasto paga:",
        },
      },
      {
        id: "rechazar",
        ancla: "cheques-rechazar",
        titulo: "Si el cheque rebota",
        texto:
          "Solo si el banco lo rebota, tocá «Rechazar»: el cobro se anula y el cliente vuelve a deber. Si solo te equivocaste de paso, usá «Deshacer».",
        pantalla: PantallaRechazar,
        consejo: "«Rechazar» no se puede deshacer; «Deshacer» sí, y no toca el cobro del cliente.",
        sinAncla: {
          texto:
            "Si el banco rebota un cheque, tocás «Rechazar» y elegís el motivo. El cobro se anula y el cliente vuelve a deber:",
        },
      },
    ];
  },
};
