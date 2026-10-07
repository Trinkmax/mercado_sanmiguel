import type { Rol } from "@/lib/auth";
import type { ContenidoCapitulo, Paso } from "@/lib/tour/tipos";
import {
  PantallaAsignar,
  PantallaAvisoJefe,
  PantallaAvisoPuesto,
  PantallaAvisosAdmin,
  PantallaAvisosLider,
  PantallaAvisosTesoreria,
  PantallaBuscarMapa,
  PantallaCajaHoyAdmin,
  PantallaCajaPorteria,
  PantallaCobranzaMes,
  PantallaColoresMapa,
  PantallaColoresQuintas,
  PantallaCorrecciones,
  PantallaEscritorioLider,
  PantallaEstimadoTesoreria,
  PantallaParaRevisar,
  PantallaPlataHoy,
  PantallaQuintasJefe,
  PantallaTarjetaPuesto,
  PantallaTarjetaQuintero,
  PortadaInicio,
  PortadaMapa,
} from "@/components/tour/pantallas/inicio-mapa";

// Tour guiado · inicio-mapa: pasos de los capítulos de esta área (docs/GUIA-TOUR.md).
// Inicio cambia mucho por rol (src/app/(panel)/inicio/: InicioGestion para Administración
// y el Líder, InicioJefe, InicioTesoreria); el Mapa tiene dos vistas: la completa
// (Administración y Líder) y la de portería (el Jefe: quintas y avisos al Líder).

// ---------------------------------------------------------------------------------------
// Inicio
// ---------------------------------------------------------------------------------------

/** La cobranza del mes (Administración y Líder): con el mes generado o todavía sin generar. */
function pasoCobranzaMes(rol: Rol): Paso {
  const lider = rol === "lider";
  return {
    id: "cobranza-mes",
    ancla: ["inicio-cobranza-mes", "inicio-cobranza-vacia"],
    titulo: "Cómo viene el mes",
    texto: lider
      ? "Cada concepto tiene su barra: verde lo cobrado y rojo lo que falta, contra lo que se espera cobrar si pagan en término. Abajo, el total cobrado, el total por cobrar y el estimado del mes; en chico, hasta cuánto sería si pagan fuera de término. «Ver reportes» te lleva al detalle, mes a mes."
      : "Cada concepto tiene su barra: verde lo cobrado y rojo lo que falta, contra lo que se espera cobrar si pagan en término. Abajo, el total cobrado, el total por cobrar y el estimado del mes. Son los puesteros, sin quintas ni ambulantes: esos no entran acá.",
    variantes: {
      "inicio-cobranza-vacia": {
        texto: lider
          ? "Este mes todavía no se generó: se genera desde «Facturación». Después, acá vas a ver cada concepto con su barra, así:"
          : "Este mes todavía no se generó: se genera desde «Facturación» con «Ir a Facturación». Después, acá vas a ver cada concepto con su barra, así:",
        pantalla: PantallaCobranzaMes,
      },
    },
    sinAncla: {
      texto: "Acá vas a ver la cobranza del mes: cada concepto con su barra, verde lo cobrado y rojo lo que falta. Así se ve:",
      pantalla: PantallaCobranzaMes,
    },
  };
}

function pasosInicioAdmin(): Paso[] {
  return [
    {
      id: "que-es",
      ancla: "encabezado",
      titulo: "Tu día, de un vistazo",
      texto:
        "Esta es tu pantalla de inicio. Cada vez que entrás ves cómo va tu caja, cuánto se cobró en el mes y lo que te está esperando.",
    },
    {
      id: "cobrar",
      ancla: "inicio-cobrar",
      titulo: "Para cobrar, «Cobrar»",
      texto:
        "Es el botón que más vas a usar. Te lleva a buscar al puestero y cobrarle. Todo lo que cobres queda en tu caja de hoy.",
    },
    {
      id: "caja-hoy",
      ancla: ["inicio-caja-hoy", "inicio-caja-sin-abrir"],
      titulo: "Tu caja de hoy",
      texto:
        "Cuánto juntaste hoy y cuánto tenés que tener en efectivo. «Ir a la caja» te lleva al detalle, para recibir la caja de portería y cerrar el día.",
      consejo: "Cuando cerrás la caja, al otro día Tesorería cuenta la plata y le da el OK.",
      variantes: {
        "inicio-caja-sin-abrir": {
          texto:
            "Todavía no abriste la caja de hoy: se abre sola con el primer cobro. Desde ese momento, acá ves cuánto juntaste y cuánto tenés que tener en efectivo:",
          pantalla: PantallaCajaHoyAdmin,
        },
      },
      sinAncla: {
        texto: "Acá ves tu caja de hoy: cuánto juntaste y cuánto tenés que tener en efectivo. Así se ve:",
        pantalla: PantallaCajaHoyAdmin,
      },
    },
    {
      id: "avisos",
      ancla: "inicio-aviso",
      titulo: "Lo que te espera",
      texto:
        "Cada tarjeta amarilla es algo que necesita tu mano: una caja de portería para recibir, un pedido para reabrir una caja, una novedad del Jefe de Portería o una solicitud que te pasó el Líder. Tocás su botón y vas directo.",
      consejo: "La tarjeta blanca te avisa cuántos puesteros tienen deuda vencida.",
      sinAncla: {
        texto:
          "Ahora no hay nada esperándote. Cuando haya algo, aparece acá una tarjeta con su botón, así:",
        pantalla: PantallaAvisosAdmin,
        consejo: "Si no ves tarjetas, es que no hay nada pendiente.",
      },
    },
    pasoCobranzaMes("admin"),
    {
      id: "ultimos-dias",
      ancla: "inicio-ultimos-14",
      titulo: "Las últimas dos semanas",
      texto:
        "Una columna por día con lo que se cobró. Arriba, lo de hoy y el total de los 14 días. Sirve para ver si el mes viene bien.",
    },
  ];
}

function pasosInicioLider(): Paso[] {
  return [
    {
      id: "que-es",
      ancla: "encabezado",
      titulo: "Cómo viene todo",
      texto:
        "Esta es tu pantalla de control: lo que espera tu decisión, la plata que entró hoy y cómo viene la cobranza del mes.",
    },
    {
      id: "escritorio",
      ancla: "inicio-escritorio",
      titulo: "Tu escritorio",
      texto:
        "Lo que espera tu decisión, en orden: cambios por aprobar, solicitudes por revisar y las que están en el Consejo. El número grande te dice cuántas hay y el botón te lleva directo.",
      pantalla: PantallaEscritorioLider,
      consejo: "Lo que propone el equipo no se aplica hasta que lo apruebes: mientras tanto figura «Esperando aprobación».",
    },
    {
      id: "plata-hoy",
      ancla: "inicio-plata-hoy",
      titulo: "La plata de hoy",
      texto:
        "Lo que entró hoy en las dos cajas, Administración y portería, y lo que salió en gastos pagados desde las cajas. Tocá una caja para ver su detalle.",
      pantalla: PantallaPlataHoy,
    },
    {
      id: "correcciones",
      ancla: "inicio-correcciones",
      titulo: "Lo que se corrigió",
      texto:
        "Todo lo que se anuló o se corrigió en la última semana: recibos anulados, ajustes, cheques rechazados, cambios de acceso. Con quién lo hizo, cuándo y por qué.",
      pantalla: PantallaCorrecciones,
      consejo: "Si dice «Nadie anuló ni corrigió nada en la última semana», está todo en orden.",
    },
    {
      id: "avisos",
      ancla: "inicio-aviso",
      titulo: "Cajas que no terminaron",
      texto:
        "Si una caja de portería no se recibió o Tesorería todavía no validó una caja, te aparece acá con su botón. También los clientes con deuda vencida.",
      sinAncla: {
        texto: "Ahora no hay nada de esto. Cuando una caja quede a mitad de camino, aparece una tarjeta así:",
        pantalla: PantallaAvisosLider,
      },
    },
    pasoCobranzaMes("lider"),
    {
      id: "cobrar",
      ancla: "inicio-cobrar",
      titulo: "También podés cobrar",
      texto:
        "Con «Cobrar» le cobrás a cualquier cliente: puesteros, quinteros y ambulantes. Lo que cobres va a la caja de Administración.",
    },
  ];
}

function pasosInicioJefe(): Paso[] {
  return [
    {
      id: "que-es",
      ancla: "encabezado",
      titulo: "Tu día, de un vistazo",
      texto:
        "Acá ves tu caja de portería de hoy, cómo vienen las quintas del mes y lo que cobraste de ambulantes.",
    },
    {
      id: "caja-hoy",
      ancla: ["inicio-caja-hoy", "inicio-caja-sin-abrir"],
      titulo: "Tu caja de portería",
      texto:
        "Cuánto tenés en la caja en efectivo, separado en quintas, ambulantes y bono camioneros. «Ir a la caja» te lleva a rendirla.",
      consejo: "Al final del día la rendís; Administración la recibe y la suma a su caja.",
      variantes: {
        "inicio-caja-sin-abrir": {
          texto:
            "Todavía no hay caja hoy: se abre sola con el primer cobro, el tuyo o el bono camioneros que cobra Portería. Después se ve así:",
          pantalla: PantallaCajaPorteria,
        },
      },
      sinAncla: {
        texto: "Acá ves tu caja de portería de hoy. Así se ve cuando ya cobraste:",
        pantalla: PantallaCajaPorteria,
      },
    },
    {
      id: "quintas",
      ancla: ["inicio-quintas", "inicio-quintas-sin-generar"],
      titulo: "Las quintas del mes",
      texto:
        "Cuánto se cobró de las quintas y cuánto falta. Los sellos te dicen cuántos quinteros están al día y cuántos deben.",
      variantes: {
        "inicio-quintas-sin-generar": {
          texto:
            "Este mes todavía no se generó. Cuando Administración lo genere, acá vas a ver cuánto falta cobrar, así:",
          pantalla: PantallaQuintasJefe,
        },
      },
      sinAncla: {
        texto: "Acá ves cuánto se cobró de las quintas del mes y cuánto falta. Así se ve:",
        pantalla: PantallaQuintasJefe,
      },
    },
    {
      id: "cobrar-quintero",
      ancla: "inicio-cobrar-quintero",
      titulo: "Cobrarle a un quintero",
      texto:
        "«Cobrar a un quintero» te lleva directo a la lista de quinteros, para cobrarle y darle su recibo. El «Cobrar» de arriba te muestra quinteros y ambulantes juntos.",
    },
    {
      id: "ambulantes",
      ancla: "inicio-ambulantes",
      titulo: "Los ambulantes",
      texto:
        "Acá ves cuánto cobraste de ambulantes en el mes. «Cobrar a un ambulante» te lleva a cobrarle el día.",
    },
    {
      id: "avisos",
      ancla: "inicio-aviso",
      titulo: "Solicitudes para resolver",
      texto:
        "Cuando Portería anota un pedido o un reclamo, te aparece acá. Lo resolvés vos o se lo elevás al Líder de Procesos.",
      sinAncla: {
        texto: "Ahora no hay ninguna. Cuando Portería anote un pedido o un reclamo, aparece una tarjeta así:",
        pantalla: PantallaAvisoJefe,
      },
    },
  ];
}

function pasosInicioTesoreria(): Paso[] {
  return [
    {
      id: "que-es",
      ancla: "encabezado",
      titulo: "Lo que te espera hoy",
      texto:
        "Acá ves lo que espera tu control y cómo viene la cobranza del mes. Vos no cobrás: revisás la plata y das el OK.",
    },
    {
      id: "pendientes",
      ancla: ["inicio-aviso", "inicio-nada-pendiente"],
      titulo: "Tu trabajo del día",
      texto:
        "Cada tarjeta es algo para hacer: cajas para contar y validar, transferencias sin conciliar, cheques para depositar y gastos vencidos. Tocás su botón y vas directo.",
      consejo: "Validar una caja es el último paso: después de tu OK, Administración ya no la puede reabrir.",
      variantes: {
        "inicio-nada-pendiente": {
          texto:
            "Hoy no hay nada esperando tu control. Cuando haya, aparecen tarjetas así, cada una con su botón:",
          pantalla: PantallaAvisosTesoreria,
        },
      },
      sinAncla: {
        texto: "Acá aparecen las cajas para validar, las transferencias y los cheques, cada uno con su botón. Así:",
        pantalla: PantallaAvisosTesoreria,
      },
    },
    {
      id: "estimado",
      ancla: ["inicio-estimado", "inicio-estimado-vacio"],
      titulo: "Estimado y cobrado",
      texto:
        "Lo que se tendría que cobrar en el mes si pagan en término y lo que ya entró, con el porcentaje. La barra es lo cobrado y lo que falta cobrar; abajo, en chico, hasta cuánto sería si pagan fuera de término.",
      consejo: "El bono camioneros va aparte, abajo: se cobra en portería en el momento.",
      variantes: {
        "inicio-estimado-vacio": {
          texto: "Este mes todavía no se generó. Cuando Administración lo genere, acá se ve así:",
          pantalla: PantallaEstimadoTesoreria,
        },
      },
      sinAncla: {
        texto: "Acá ves lo que se tendría que cobrar en el mes si pagan en término y lo que ya entró. Así se ve:",
        pantalla: PantallaEstimadoTesoreria,
      },
    },
    {
      id: "ultimos-dias",
      ancla: "inicio-ultimos-14",
      titulo: "Lo que entró por día",
      texto:
        "Las últimas dos semanas, una columna por día: cobros y bono camioneros. Te sirve para compararlo con el banco.",
    },
    {
      id: "despues",
      ancla: "nav:/tesoreria",
      titulo: "Y después, «Tesorería»",
      texto:
        "Lo que validás pasa a ser la plata real de la cooperativa. La ves en «Tesorería», junto con el banco y las transferencias.",
    },
  ];
}

/** Capítulo "inicio" (metadatos en src/lib/tour/indice.ts). */
export const INICIO: ContenidoCapitulo = {
  portada: PortadaInicio,
  portadaPorRol: (rol) =>
    rol === "guardia" ? PantallaQuintasJefe : rol === "tesoreria" ? PantallaEstimadoTesoreria : undefined,
  pasos: (rol) => {
    switch (rol) {
      case "admin":
        return pasosInicioAdmin();
      case "lider":
        return pasosInicioLider();
      case "guardia":
        return pasosInicioJefe();
      case "tesoreria":
        return pasosInicioTesoreria();
      default:
        return [];
    }
  },
};

// ---------------------------------------------------------------------------------------
// Mapa
// ---------------------------------------------------------------------------------------

/**
 * Con una tarjeta (o el panel de asignar) abierta, el plano lleva además el ancla
 * "mapa-plano-con-tarjeta". En el celular esa tarjeta tapa los botones de zoom y tiene
 * botones que sí guardan («Sumárselo a…», «Avisar al Líder…», «Facturar … en la
 * carpeta»): ahí los pasos "tocá" del plano pasan a "mirá", para que ningún toque guarde.
 */
const CON_TARJETA = "mapa-plano-con-tarjeta";

const pasoZoom: Paso = {
  id: "moverse",
  ancla: [CON_TARJETA, "mapa-zoom"],
  accion: "tocar",
  titulo: "Acercá y alejá",
  texto:
    "Con «+» acercás y con «−» alejás. El cuadradito te muestra todo el predio de nuevo. Con el dedo también: arrastrá para moverte y pellizcá para acercar.",
  consejo: "El botón de las dos flechitas, arriba a la derecha, pone el plano en pantalla completa.",
  variantes: {
    [CON_TARJETA]: {
      accion: "mirar",
      texto:
        "Arrastrá el plano con el dedo para moverte y pellizcalo para acercar o alejar. Abajo a la izquierda también tenés «+», «−» y el cuadradito que muestra todo el predio.",
      consejo: "Si una tarjeta abierta tapa esos botones, cerrala con su X.",
    },
  },
};

/**
 * Tocar el plano mirando no guarda nada (solo elige): se puede probar. Pero asignando
 * puestos (Administración y Líder, «Listo» a la vista) cada toque sí guarda: ahí se
 * señala «Listo», que solo vuelve a mirar (lo asignado ya quedó guardado en cada toque).
 * Con una tarjeta ya abierta, solo se mira (sus botones pueden guardar).
 */
function pasoTocarPlano(jefe: boolean): Paso {
  return {
    id: "tocar",
    ancla: jefe ? [CON_TARJETA, "mapa-plano"] : ["mapa-listo", CON_TARJETA, "mapa-plano"],
    accion: "tocar",
    titulo: jefe ? "Tocá una quinta o un puesto" : "Tocá un puesto",
    texto: jefe
      ? "Tocá la quinta de un quintero para ver su tarjeta, o un puesto para avisarle algo al Líder. Tocar no cambia nada."
      : "Tocá cualquier puesto del plano y abajo se abre su tarjeta. Tocar no cambia nada.",
    variantes: {
      [CON_TARJETA]: {
        accion: "mirar",
        texto: jefe
          ? "Tocás una quinta o un puesto y abajo se abre su tarjeta. Ya tenés una abierta: te la muestro en el paso que sigue."
          : "Tocás un puesto y abajo se abre su tarjeta. Ya tenés una abierta: te la muestro en el paso que sigue.",
      },
      ...(jefe
        ? {}
        : {
            "mapa-listo": {
              titulo: "Primero, tocá «Listo»",
              texto:
                "Ahora estás asignando puestos: así, cada toque en el plano le da un puesto a alguien. Tocá «Listo» para volver a mirar sin cambiar nada.",
            },
          }),
    },
  };
}

function pasosMapaGestion(rol: Rol): Paso[] {
  const lider = rol === "lider";
  return [
    {
      id: "que-es",
      ancla: "mapa-plano",
      titulo: "El plano del mercado",
      texto:
        "Es el mercado visto desde arriba: cada bloque es un lugar (puesto, local, contéiner, galpón, cochera o quinta). El color dice cómo viene de pagos quien lo ocupa, y cambia solo con cada cobro.",
      sinAncla: {
        texto: "Acá vas a ver el mercado visto desde arriba, con cada lugar pintado según cómo viene de pagos. Así:",
        pantalla: PortadaMapa,
      },
    },
    pasoZoom,
    {
      id: "colores",
      ancla: "mapa-resumen",
      accion: "tocar",
      titulo: "Qué dice cada color",
      texto:
        "Verde es «Al día». Con rayas rojas, «Debe el mes». Rojo lleno, «Deuda atrasada»: debe meses anteriores. Blanco con el número punteado, «Libres». Tocá uno y el plano muestra solo esos; tocalo de nuevo para ver todo.",
      pantalla: PantallaColoresMapa,
      consejo: "A la izquierda ves cuántos puestos están ocupados. La banderita azul marca los puestos propios de la cooperativa.",
    },
    {
      id: "buscar",
      ancla: "mapa-buscador",
      titulo: "Buscá a alguien",
      texto:
        "Escribí el nombre, el apodo, el número de carpeta o el del puesto. Tocás el resultado y el plano te lleva ahí.",
      pantalla: PantallaBuscarMapa,
    },
    pasoTocarPlano(false),
    {
      id: "tarjeta",
      ancla: ["mapa-detalle-cliente", "mapa-detalle-espacio", "mapa-plano"],
      titulo: "Quién está y cuánto debe",
      texto:
        "La tarjeta dice quién ocupa el lugar, cómo le dicen, qué lugares tiene y cuánto debe. «Cobrar» te lleva a cobrarle y «Ver ficha», a su carpeta.",
      consejo: "Para cerrar la tarjeta, tocá su X o el fondo del plano, fuera de los puestos.",
      variantes: {
        "mapa-detalle-espacio": {
          titulo: "Un lugar libre",
          texto:
            "Este lugar no tiene a nadie: con «Asignar puestero» (en una cochera, «Asignar cliente») se lo das a alguien. Cuando está ocupado, la tarjeta dice quién es, cuánto debe y tiene el botón «Cobrar», así:",
          pantalla: PantallaTarjetaPuesto,
        },
        "mapa-plano": {
          texto:
            "Cuando tocás un puesto ocupado, abajo se abre su tarjeta: quién es, cómo le dicen, sus lugares y su deuda. Con «Cobrar» vas directo a cobrarle. Así se ve:",
          pantalla: PantallaTarjetaPuesto,
          consejo: undefined,
        },
      },
      sinAncla: {
        texto:
          "Cuando tocás un puesto ocupado, se abre su tarjeta: quién es, sus lugares y su deuda, con el botón «Cobrar». Así se ve:",
        pantalla: PantallaTarjetaPuesto,
      },
    },
    {
      id: "asignar",
      ancla: ["mapa-asignar", "mapa-listo"],
      titulo: "Asignar puestos",
      texto:
        "Con «Asignar puestos» (el pincel) elegís a un puestero y tocás sus puestos en el plano. Cada toque se guarda solo; si te equivocás, tocá «Deshacer» o tocá el puesto de nuevo. Al terminar, tocá «Listo».",
      pantalla: PantallaAsignar,
      consejo:
        "Más rápido: tocá un puesto libre pegado al de alguien y su tarjeta te ofrece «Sumárselo a…». Queda unido a su puesto.",
      variantes: {
        "mapa-listo": {
          titulo: "Estás asignando puestos",
          texto:
            "Elegí a un puestero y tocá sus puestos en el plano: cada toque se guarda solo, y si te equivocás, tocá «Deshacer». Cuando termines, tocá «Listo».",
        },
      },
    },
    {
      id: "revisar",
      ancla: ["mapa-asignar", "mapa-listo"],
      titulo: "Lo que no coincide",
      texto: lider
        ? "Mientras asignás, «Para revisar» te muestra a quien paga más o menos lugares de los que tiene en el plano. Tocá su nombre para ubicarle lo que falta, o «Facturar … en la carpeta» para que pague lo que tiene. Como sos el Líder, ese cambio se aplica en el momento."
        : "Mientras asignás, «Para revisar» te muestra a quien paga más o menos lugares de los que tiene en el plano. Tocá su nombre para ubicarle lo que falta, o «Facturar … en la carpeta» para que pague lo que tiene. Ese cambio le llega al Líder: hasta que no lo apruebe, no cambia lo que paga.",
      pantalla: PantallaParaRevisar,
    },
  ];
}

function pasosMapaJefe(): Paso[] {
  return [
    {
      id: "que-es",
      ancla: "mapa-plano",
      titulo: "El plano del mercado",
      texto:
        "Es el mercado visto desde arriba. Tus quintas están pintadas según cómo viene con el pago el quintero (o el ambulante) que la alquila; en blanco, las libres, y en azul las que alquila un puestero (esas las lleva Administración). Los puestos van todos del mismo color, porque son de Administración.",
      sinAncla: {
        texto: "Acá vas a ver el mercado visto desde arriba, con tus quintas pintadas según cómo viene cada quintero. Así:",
        pantalla: PortadaMapa,
      },
    },
    pasoZoom,
    {
      id: "quinteros",
      ancla: "mapa-resumen",
      accion: "tocar",
      titulo: "Cómo vienen tus quinteros",
      texto:
        "A la izquierda, cuántos quinteros tenés y cuánto falta cobrar este mes. Tocá «Al día», «Deben el mes» o «Deuda atrasada» para ver solo esos. Tocalo de nuevo para ver todos.",
      pantalla: PantallaColoresQuintas,
    },
    {
      id: "buscar",
      ancla: "mapa-buscador",
      titulo: "Buscá un quintero o un puesto",
      texto:
        "Escribí el nombre, el apodo o el número (por ejemplo «quinta 40» o «58»). Tocás el resultado y el plano te lleva ahí.",
    },
    pasoTocarPlano(true),
    {
      id: "quintero",
      ancla: ["mapa-detalle-cliente", "mapa-aviso", "mapa-plano"],
      titulo: "La tarjeta del quintero",
      texto:
        "Dice quién tiene la quinta, cómo le dicen y cuánto debe. «Cobrar» te lleva a cobrarle y «Ver ficha», a su carpeta.",
      consejo: "Para cerrar la tarjeta, tocá su X o el fondo del plano, fuera de los puestos.",
      variantes: {
        "mapa-aviso": {
          titulo: "Esta tarjeta es para avisar",
          texto:
            "Tocaste un puesto o una quinta sin quintero: ahí la tarjeta sirve para avisarle algo al Líder (lo vemos en el paso que sigue). Si tocás la quinta de un quintero, se abre su tarjeta, así:",
          pantalla: PantallaTarjetaQuintero,
          consejo: undefined,
        },
        "mapa-plano": {
          texto:
            "Cuando tocás la quinta de un quintero, se abre su tarjeta: cómo le dicen, sus quintas y cuánto debe, con el botón «Cobrar». Así se ve:",
          pantalla: PantallaTarjetaQuintero,
          consejo: undefined,
        },
      },
      sinAncla: {
        texto:
          "Cuando tocás la quinta de un quintero, se abre su tarjeta: sus quintas y cuánto debe, con el botón «Cobrar». Así se ve:",
        pantalla: PantallaTarjetaQuintero,
      },
    },
    {
      id: "avisar",
      ancla: ["mapa-aviso", "mapa-plano"],
      titulo: "Avisale algo al Líder",
      texto:
        "Si ves algo en un puesto, tocalo, elegí qué viste (luz, limpieza, mercadería en el pasillo, seguridad) y tocá «Avisar al Líder sobre el puesto…». Le llega al Líder como una solicitud.",
      pantalla: PantallaAvisoPuesto,
      consejo: "Abajo quedan los avisos anteriores de ese puesto, así no avisás dos veces lo mismo.",
    },
  ];
}

/** Capítulo "mapa" (metadatos en src/lib/tour/indice.ts). */
export const MAPA: ContenidoCapitulo = {
  portada: PortadaMapa,
  // El Jefe de Portería no ve quién está en los puestos: su portada son las quintas.
  portadaPorRol: (rol) => (rol === "guardia" ? PantallaColoresQuintas : undefined),
  pasos: (rol) => {
    switch (rol) {
      case "admin":
      case "lider":
        return pasosMapaGestion(rol);
      case "guardia":
        return pasosMapaJefe();
      default:
        return [];
    }
  },
};
