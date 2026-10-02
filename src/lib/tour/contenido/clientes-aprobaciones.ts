import type { Rol } from "@/lib/auth";
import type { ContenidoCapitulo, Paso } from "@/lib/tour/tipos";
import {
  PantallaAltaAmbulante,
  PantallaAltaLider,
  PantallaAltaPuestero,
  PantallaAprobar,
  PantallaBuscarClientes,
  PantallaBuscarJefe,
  PantallaCambioPendiente,
  PantallaCambiosEsperando,
  PantallaCambiosEsperandoJefe,
  PantallaCambiosEsperandoLider,
  PantallaDiffCambio,
  PantallaEditarQuintero,
  PantallaFichaPuestero,
  PantallaFichaQuintero,
  PantallaGuardarDirecto,
  PantallaListaClientes,
  PantallaListaJefe,
  PantallaPedirCambio,
  PantallaPorcentaje,
  PantallaQuePaga,
  PantallaQuePagaQuintero,
  PantallaRechazo,
  PantallaRevisionJefe,
  PantallaSolapas,
  PantallaSolapasJefe,
  PortadaAprobaciones,
  PortadaClientes,
  PortadaClientesJefe,
} from "@/components/tour/pantallas/clientes-aprobaciones";

// Tour guiado · clientes-aprobaciones: pasos de los capítulos de esta área (docs/GUIA-TOUR.md).
//
// Clientes: la lista (/clientes) → la carpeta (/clientes/[id], se entra por la primera fila)
// → «Qué paga» (cantidad y porcentaje, que puede pasar de 100) → cómo se pide un cambio
// → de vuelta en la lista, «Nuevo cliente» → el alta (/clientes/nuevo).
// Administración ve solo puesteros y el Jefe de Portería solo quinteros y ambulantes; los dos
// PROPONEN y el Líder aprueba. El Líder aplica directo.
// Producción arranca vacía: todo lo de la carpeta lleva `sinAncla` con su pantalla de ejemplo.
//
// Pestañas de la carpeta (?tab=): desde «Qué paga» los pasos van en FICHA_PAGA. Si el tour
// entra desde la lista (por ejemplo, con «Atrás» desde el alta), la carpeta se abre directo
// en «Qué paga». OJO: si la persona ya está en la carpeta, cambiar ?tab no cambia la pestaña
// (son Tabs con defaultValue y Next no remonta la página por la query): por eso «Qué paga»
// se abre tocándola (paso "solapas") y, si no la tocó, el paso siguiente la señala para tocar.
// El paso "nuevo" (en la lista) va entre la carpeta y el alta: con «Atrás» desde el alta se
// vuelve a la lista, y de ahí la carpeta tiene una fila por donde entrar.

const FICHA = "/clientes/[id]";
const FICHA_PAGA = "/clientes/[id]?tab=paga";
const FILA = "clientes-fila";

/* ------------------------------------------------------------------ */
/* Clientes: pasos compartidos                                         */
/* ------------------------------------------------------------------ */

// El buscador va con "mirar": si la persona filtra o busca algo que no está, el paso
// siguiente («Abrí su carpeta») se quedaría sin ninguna fila para señalar.
function pasoBuscar(jefe: boolean, lider: boolean): Paso {
  return {
    id: "buscar",
    ancla: "clientes-buscar",
    titulo: "Buscá o filtrá",
    texto: jefe
      ? "Arriba escribís el nombre, el apodo, el N° de carpeta o el DNI, y la lista se achica sola. Abajo filtrás con un toque: «Quinteros», «Ambulantes», «Con deuda»."
      : lider
        ? "Arriba escribís el nombre, el apodo, el N° de puesto o el DNI, y la lista se achica sola. Abajo filtrás con un toque: «Galpones», «Quinteros», «Con deuda», «Vencidos»."
        : "Arriba escribís el nombre, el apodo, el N° de puesto o el DNI, y la lista se achica sola. Abajo filtrás con un toque: «Galpones», «Socios», «Con deuda», «Vencidos».",
    consejo: "El número de cada botón dice cuántos hay. Para ver a todos de nuevo, tocá «Sacar filtros».",
    sinAncla: {
      texto: jefe
        ? "Cuando haya quinteros y ambulantes, arriba de la lista aparece el buscador: escribís el nombre, el apodo, el N° de carpeta o el DNI. Abajo, botones para filtrar con un toque."
        : "Cuando haya clientes, arriba de la lista aparece el buscador: escribís el nombre, el apodo, el N° de puesto o el DNI. Abajo, botones para filtrar con un toque.",
      pantalla: jefe ? PantallaBuscarJefe : PantallaBuscarClientes,
      consejo: undefined,
    },
  };
}

function pasoAbrir(jefe: boolean): Paso {
  return {
    id: "abrir",
    ancla: FILA,
    accion: "tocar",
    titulo: "Abrí su carpeta",
    texto: jefe
      ? "Cada fila tiene el N° de carpeta (el número azul), el nombre, si es quintero o ambulante y cuánto debe. Tocá esta fila y se abre su carpeta."
      : "Cada fila tiene el N° de carpeta (el número azul), el nombre, lo que tiene y cuánto debe. Tocá esta fila y se abre su carpeta.",
    sinAncla: {
      titulo: "Así se ve la lista",
      texto: jefe
        ? "Todavía no hay quinteros ni ambulantes en la lista. Cuando haya, cada fila muestra el N° de carpeta, el nombre y cuánto debe. Tocás una y se abre su carpeta."
        : "Todavía no hay clientes en la lista. Cuando haya, cada fila muestra el N° de carpeta, el nombre, lo que tiene y cuánto debe. Tocás una y se abre su carpeta.",
      pantalla: jefe ? PantallaListaJefe : PantallaListaClientes,
    },
  };
}

function pasoArriba(jefe: boolean): Paso {
  return {
    id: "arriba",
    ruta: FICHA,
    entrar: FILA,
    ancla: "clientes-deuda",
    titulo: "Lo que debe, de un vistazo",
    texto:
      "«Debe hoy» es lo que tiene que pagar. En verde, está al día; en ámbar, debe pero todavía no venció; en rojo, ya venció. Más arriba, «Cobrar» te lleva a cobrarle.",
    consejo: "Si no debe nada, arriba aparece «Libre deuda» para darle su constancia.",
    sinAncla: {
      titulo: "La carpeta, por arriba",
      texto:
        "Arriba de la carpeta están su nombre, sus sellos y cuánto debe hoy. En verde, está al día; en ámbar, debe pero todavía no venció; en rojo, ya venció. «Cobrar» te lleva a cobrarle.",
      pantalla: jefe ? PantallaFichaQuintero : PantallaFichaPuestero,
    },
  };
}

function pasoSolapas(jefe: boolean): Paso {
  return {
    id: "solapas",
    ruta: FICHA,
    entrar: FILA,
    ancla: "clientes-solapa-paga",
    accion: "tocar",
    titulo: "Las pestañas de la carpeta",
    texto: jefe
      ? "«Cuenta» tiene lo que se le cobró cada mes y lo que pagó; «Documentos», los papeles que le pedís. Ahora tocá «Qué paga»."
      : "«Cuenta» tiene lo que se le cobró cada mes y lo que pagó; «Documentos», la habilitación, el SENASA y el apto eléctrico. Ahora tocá «Qué paga».",
    consejo: jefe
      ? undefined
      : "«Registros» guarda las notificaciones, los apercibimientos y las sanciones; «Medidores», sus medidores de luz.",
    sinAncla: {
      texto: jefe
        ? "La carpeta tiene tres pestañas: «Cuenta» (lo que se le cobró y lo que pagó), «Qué paga» y «Documentos»."
        : "La carpeta se divide en pestañas: «Cuenta» (lo que se le cobró y lo que pagó), «Qué paga», «Documentos», «Registros» y «Medidores».",
      pantalla: jefe ? PantallaSolapasJefe : PantallaSolapas,
    },
  };
}

// «Qué paga»: si la persona tocó la pestaña se señala la primera fila. Si tocó «Siguiente»
// sin abrirla, la pestaña sigue cerrada (ver arriba): se señala la pestaña (última ancla) para
// que la toque, con la pantalla de ejemplo.

/** «Qué paga» para Administración y el Líder: la cantidad y el porcentaje. */
function pasoQuePaga(lider: boolean): Paso {
  const explicacion =
    "La cantidad dice cuántos tiene, de a cuartos: 4 galpones, ½ puesto. El porcentaje, cuánto del precio paga: 100 % es el precio entero; 70 %, menos; 110 %, un poco más.";
  return {
    id: "que-paga",
    ruta: FICHA_PAGA,
    entrar: FILA,
    ancla: lider
      ? ["clientes-paga-ambulante", "clientes-concepto-fila", "clientes-conceptos", "clientes-solapa-paga"]
      : ["clientes-concepto-fila", "clientes-conceptos", "clientes-solapa-paga"],
    titulo: "Qué paga: cantidad y porcentaje",
    texto: `Cada fila es algo que paga por mes. ${explicacion}`,
    pantalla: PantallaQuePaga,
    consejo:
      "¿Paga un monto fijo? Cambiá el porcentaje: el monto se actualiza mientras escribís, así llegás justo a ese número.",
    variantes: {
      "clientes-conceptos": {
        titulo: "Qué paga cada mes",
        texto:
          "Todavía no paga nada por mes. Abajo, en «Agregar algo que paga», tocás lo que corresponde y ponés «¿Cuántos?» y «¿Qué % paga?»: 100 % es el precio entero.",
      },
      "clientes-paga-ambulante": {
        titulo: "El ambulante paga por día",
        texto:
          "Al ambulante se le cobra por día, cuando viene; si alquila cochera, la cochera se cobra por mes. En un puestero o un quintero, acá ves cada cosa que paga con su cantidad y su porcentaje.",
      },
      "clientes-solapa-paga": {
        texto: `Lo que se le factura cada mes está en «Qué paga»: tocá la pestaña para verlo. ${explicacion}`,
        accion: "tocar",
      },
    },
    sinAncla: {
      texto: `En «Qué paga» está lo que se le factura cada mes. ${explicacion}`,
    },
  };
}

/** Administración y el Líder: el porcentaje puede pasar de 100, y cómo NO se escribe. */
const pasoPorcentaje: Paso = {
  id: "porcentaje",
  ruta: FICHA_PAGA,
  entrar: FILA,
  ancla: "clientes-porcentaje",
  titulo: "Más de 100 % también vale",
  texto:
    "El porcentaje puede pasar de 100. Por ejemplo: 125 % es una expensa y cuarto; 150 %, una y media; 400 %, cuatro veces el precio, como el cliente de los 4 galpones a monto fijo. Si tiene un puesto y medio, es más claro con la cantidad: 1½ al 100 % da lo mismo que 1 al 150 %.",
  pantalla: PantallaPorcentaje,
  consejo:
    "Ojo, que confunde a cualquiera: ahí se escribe 125, no 1,25. Con 1,25 queda en 1,25 % y el monto da casi nada.",
  sinAncla: {
    texto:
      "Cada cosa que paga tiene su porcentaje, y puede pasar de 100. Por ejemplo: 125 % es una expensa y cuarto; 150 %, una y media; 400 %, cuatro veces el precio, como el cliente de los 4 galpones a monto fijo. Si tiene un puesto y medio, es más claro con la cantidad: 1½ al 100 % da lo mismo que 1 al 150 %.",
  },
};

/** «Qué paga» para el Jefe: la quinta, en cuántos pagos, y el ambulante que paga por día. */
const pasoQuePagaJefe: Paso = {
  id: "que-paga",
  ruta: FICHA_PAGA,
  entrar: FILA,
  ancla: ["clientes-paga-ambulante", "clientes-concepto-fila", "clientes-conceptos", "clientes-solapa-paga"],
  titulo: "Qué paga cada mes",
  texto:
    "El quintero paga su quinta por mes (EXPQ). La cantidad es cuántas quintas tiene; el porcentaje, cuánto del precio paga: 100 % es el precio entero, y puede pasar de 100 (150 % es una y media). Más abajo está en cuántos pagos la cobra: 1, 2, 3 o 4.",
  pantalla: PantallaQuePagaQuintero,
  consejo:
    "Ojo, que confunde a cualquiera: en el porcentaje se escribe 150, no 1,5. Con 1,5 el monto da casi nada: fijate, que se actualiza mientras escribís.",
  variantes: {
    "clientes-paga-ambulante": {
      titulo: "El ambulante paga por día",
      texto:
        "Al ambulante se le cobra por día, cuando viene, y no paga en cuotas; si alquila cochera, la cochera se cobra por mes. Lo mensual del quintero es su quinta y en cuántos pagos la cobra.",
    },
    "clientes-conceptos": {
      texto:
        "Todavía no paga nada por mes. Abajo, en «Agregar algo que paga», tocás la quinta (EXPQ) y ponés cuántas. Más abajo elegís en cuántos pagos la cobra.",
    },
    "clientes-solapa-paga": {
      texto:
        "En «Qué paga» el quintero tiene su quinta (EXPQ), con su cantidad y su porcentaje, y en cuántos pagos la cobra: 1, 2, 3 o 4. Tocá la pestaña para verlo. Al ambulante se le cobra por día, cuando viene.",
      accion: "tocar",
    },
  },
  sinAncla: {
    texto:
      "En «Qué paga» el quintero tiene su quinta (EXPQ), con su cantidad y su porcentaje, y en cuántos pagos la cobra: 1, 2, 3 o 4. Al ambulante se le cobra por día, cuando viene.",
  },
};

/** Administración y el Jefe: todo cambio se pide y lo aprueba el Líder. */
function pasoPedir(jefe: boolean): Paso {
  const pantalla = jefe ? PantallaEditarQuintero : PantallaPedirCambio;
  return {
    id: "pedir",
    ruta: FICHA_PAGA,
    entrar: FILA,
    ancla: "clientes-editar",
    titulo: "Para cambiar algo, lo pedís",
    texto: jefe
      ? "Sus datos se corrigen con «Editar»; lo que paga, en «Qué paga». En los dos casos el botón dice «Enviar a aprobación»: el pedido le llega al Líder de Procesos."
      : "Sus datos se corrigen con «Editar»; lo que paga, en «Qué paga» (por ejemplo, el galpón al 110 %). En los dos casos el botón dice «Enviar a aprobación»: el pedido le llega al Líder de Procesos.",
    pantalla,
    consejo: "Para darlo de baja, tocá «Dar de baja» y contá por qué. También lo aprueba el Líder.",
    sinAncla: { pantalla },
  };
}

function pasoDespues(jefe: boolean): Paso {
  return {
    id: "despues",
    ruta: FICHA_PAGA,
    entrar: FILA,
    ancla: "clientes-cambios",
    titulo: "Hasta que el Líder lo apruebe",
    texto:
      "Lo que pediste aparece arriba de la carpeta con el sello «Esperando aprobación». Hasta que el Líder no lo apruebe, no cambia nada: se sigue facturando como antes. Si lo rechaza, ahí ves el motivo.",
    consejo: "Si te equivocaste en un pedido, no pasa nada: avisale al Líder, lo rechaza y lo mandás de nuevo.",
    sinAncla: {
      texto:
        "Cuando pidas un cambio, arriba de la carpeta aparece así, con el sello «Esperando aprobación». Hasta que el Líder no lo apruebe, no cambia nada. Si lo rechaza, ahí ves el motivo.",
      pantalla: jefe ? PantallaCambiosEsperandoJefe : PantallaCambiosEsperando,
    },
  };
}

/** De vuelta en la lista, el botón para cargar uno nuevo. Va entre la carpeta y el alta:
 * con «Atrás» desde el alta se vuelve acá, y de acá hay una fila para entrar a la carpeta. */
function pasoNuevo(quien: "admin" | "jefe" | "lider"): Paso {
  const texto =
    quien === "jefe"
      ? "Volvimos a la lista. Un quintero o un ambulante nuevo se carga con «Nuevo quintero o ambulante», arriba de la lista. Tocalo y te muestro qué se completa."
      : quien === "admin"
        ? "Volvimos a la lista. Un puestero nuevo se carga con «Nuevo cliente», arriba de la lista. Tocalo y te muestro qué se completa."
        : "Volvimos a la lista. Un cliente nuevo se carga con «Nuevo cliente», arriba de la lista. Tocalo y te muestro qué se completa.";
  return {
    id: "nuevo",
    ruta: "/clientes",
    ancla: "clientes-nuevo",
    accion: "tocar",
    titulo: "¿Llega uno nuevo?",
    texto,
  };
}

/* ------------------------------------------------------------------ */
/* Clientes: por rol                                                   */
/* ------------------------------------------------------------------ */

function pasosAdministracion(): Paso[] {
  return [
    {
      id: "que-es",
      ancla: "encabezado",
      titulo: "La carpeta de cada puestero",
      texto:
        "Acá está la carpeta de cada puestero, como la de papel: sus datos, lo que paga, su cuenta y sus documentos. Lo que dice en «Qué paga» es lo que se le factura cada mes.",
    },
    pasoBuscar(false, false),
    pasoAbrir(false),
    pasoArriba(false),
    pasoSolapas(false),
    pasoQuePaga(false),
    pasoPorcentaje,
    pasoPedir(false),
    pasoDespues(false),
    pasoNuevo("admin"),
    {
      id: "alta",
      ruta: "/clientes/nuevo",
      ancla: ["clientes-alta-que-es", "clientes-alta-conceptos", "clientes-alta-enviar"],
      titulo: "Un puestero nuevo",
      texto:
        "Cargás sus datos y marcás qué paga cada mes, con cantidad y porcentaje. Al final tocás «Enviar a aprobación»: aparece en la lista cuando el Líder lo apruebe.",
      pantalla: PantallaAltaPuestero,
      consejo:
        "Si solo alquila una cochera, en «¿Qué es?» elegí «Empleado»: alcanza con el nombre y se le cobra solo la cochera. Mientras espera, arriba de la lista vas a ver «Hay 1 alta esperando la aprobación del Líder de Procesos».",
      sinAncla: {
        texto:
          "Acá se cargan sus datos y qué paga cada mes, con cantidad y porcentaje. Al final tocás «Enviar a aprobación»: aparece en la lista cuando el Líder lo apruebe.",
      },
    },
  ];
}

function pasosJefe(): Paso[] {
  return [
    {
      id: "que-es",
      ancla: "encabezado",
      titulo: "Tus quinteros y ambulantes",
      texto:
        "Acá está la carpeta de cada quintero y cada ambulante: sus datos, lo que paga, su cuenta y sus documentos. A los puesteros los lleva Administración.",
    },
    pasoBuscar(true, false),
    pasoAbrir(true),
    pasoArriba(true),
    pasoSolapas(true),
    pasoQuePagaJefe,
    pasoPedir(true),
    pasoDespues(true),
    pasoNuevo("jefe"),
    {
      id: "alta",
      ruta: "/clientes/nuevo",
      ancla: "clientes-alta-que-es",
      titulo: "Un quintero o un ambulante nuevo",
      texto:
        "Primero elegís qué es y después cargás sus datos. El ambulante queda cargado en el acto con «Dar de alta al ambulante» y le cobrás enseguida; el quintero va con «Enviar a aprobación».",
      pantalla: PantallaAltaAmbulante,
      consejo: "Si llega un ambulante nuevo mientras cobrás, en «Cobrar» tenés «Nuevo ambulante»: es lo mismo.",
      sinAncla: {
        texto:
          "Acá elegís si es quintero o ambulante y cargás sus datos. El ambulante queda cargado en el acto con «Dar de alta al ambulante» y le cobrás enseguida; el quintero va con «Enviar a aprobación».",
      },
    },
  ];
}

function pasosLider(): Paso[] {
  return [
    {
      id: "que-es",
      ancla: "encabezado",
      titulo: "Todos los clientes",
      texto:
        "Acá están todos: puesteros, quinteros y ambulantes. Cada uno tiene su carpeta, como la de papel: sus datos, lo que paga, sus documentos y su cuenta.",
    },
    pasoBuscar(false, true),
    pasoAbrir(false),
    pasoArriba(false),
    pasoSolapas(false),
    pasoQuePaga(true),
    pasoPorcentaje,
    {
      id: "directo",
      ruta: FICHA_PAGA,
      entrar: FILA,
      ancla: "clientes-editar",
      titulo: "Vos lo guardás en el acto",
      texto:
        "Lo que vos cambiás se aplica en el acto, sin esperar a nadie. Corregís sus datos con «Editar» y lo que paga en «Qué paga» (por ejemplo, el galpón al 110 %). Apenas guardás, queda hecho.",
      pantalla: PantallaGuardarDirecto,
      consejo: "Lo que paga rige desde la próxima facturación: el mes en curso no se toca.",
      sinAncla: { pantalla: PantallaGuardarDirecto },
    },
    {
      id: "pedidos",
      ruta: FICHA_PAGA,
      entrar: FILA,
      ancla: "clientes-cambios",
      titulo: "Lo que piden los demás",
      texto:
        "Si Administración o el Jefe de Portería pidieron un cambio para este cliente, aparece arriba de la carpeta. Lo aprobás o lo rechazás desde «Aprobaciones».",
      sinAncla: {
        texto:
          "Cuando Administración o el Jefe de Portería pidan un cambio para un cliente, aparece así arriba de su carpeta. Lo aprobás o lo rechazás desde «Aprobaciones».",
        pantalla: PantallaCambiosEsperandoLider,
      },
    },
    pasoNuevo("lider"),
    {
      id: "alta",
      ruta: "/clientes/nuevo",
      ancla: "clientes-alta-que-es",
      titulo: "Un cliente nuevo",
      texto:
        "En «¿Qué es?» elegís si es puestero, quintero, ambulante o empleado (solo alquila cochera), y cargás sus datos y qué paga. Al final tocás «Dar de alta al puestero» (o al que corresponda) y queda creado en el acto.",
      sinAncla: {
        texto:
          "Acá elegís si es puestero, quintero, ambulante o empleado, y cargás sus datos y qué paga. Al final tocás «Dar de alta al puestero» (o al que corresponda) y queda creado en el acto.",
        pantalla: PantallaAltaLider,
      },
    },
  ];
}

/** Capítulo "clientes" (metadatos en src/lib/tour/indice.ts). */
export const CLIENTES: ContenidoCapitulo = {
  portada: PortadaClientes,
  // El Jefe de Portería ve «Quinteros y ambulantes», no la lista de puesteros.
  portadaPorRol: (rol) => (rol === "guardia" ? PortadaClientesJefe : undefined),
  pasos: (rol: Rol) => {
    if (rol === "guardia") return pasosJefe();
    if (rol === "lider") return pasosLider();
    if (rol === "admin") return pasosAdministracion();
    return [];
  },
};

/* ------------------------------------------------------------------ */
/* Aprobaciones (solo el Líder)                                        */
/* ------------------------------------------------------------------ */

/** Capítulo "aprobaciones" (metadatos en src/lib/tour/indice.ts). */
export const APROBACIONES: ContenidoCapitulo = {
  portada: PortadaAprobaciones,
  pasos: (rol: Rol) =>
    rol !== "lider"
      ? []
      : [
          {
            id: "que-es",
            ancla: "encabezado",
            titulo: "Lo que espera tu OK",
            texto:
              "Acá llegan las altas, bajas y cambios que proponen Administración y el Jefe de Portería: de clientes, de lo que paga cada uno y de precios. Nada se aplica hasta que lo apruebes, salvo el alta de un ambulante, que te muestro más adelante.",
            consejo:
              "Cuando hay algo esperando, «Aprobaciones» muestra un número en el menú. En Inicio también lo ves, en «Tu escritorio».",
          },
          {
            id: "pendientes",
            ancla: "aprobaciones-pestana-pendientes",
            accion: "tocar",
            titulo: "Lo que espera tu decisión",
            texto:
              "En «Pendientes» está todo lo que espera tu OK, del más viejo al más nuevo. El número en ámbar dice cuántos son. Tocala.",
          },
          {
            id: "cambio",
            ancla: "aprobaciones-cambio",
            titulo: "Qué se pide y quién",
            texto:
              "Cada pedido dice qué cambia, quién lo pidió y cuándo. Con «Ver ficha de…» abrís la carpeta del cliente para mirarla antes de decidir.",
            sinAncla: {
              texto:
                "Ahora no hay pedidos esperando. Cuando Administración o el Jefe pidan algo, aparece así: qué cambia, quién lo pidió y cuándo.",
              pantalla: PantallaCambioPendiente,
            },
          },
          {
            id: "antes-despues",
            ancla: "aprobaciones-diff",
            titulo: "Antes y después",
            texto:
              "Acá ves qué cambia: cada dato como está hoy y cómo queda si lo aprobás. Por ejemplo, el galpón que pasa del 100 % al 110 % del precio.",
            pantalla: PantallaDiffCambio,
            consejo: "En un alta ves los datos del cliente nuevo y lo que va a pagar. En una baja, el motivo está en el título.",
            sinAncla: {
              texto:
                "Cada pedido trae una tabla con el antes y el después de cada dato. Por ejemplo, el galpón que pasa del 100 % al 110 % del precio.",
            },
          },
          {
            id: "aprobar",
            ancla: "aprobaciones-aprobar",
            titulo: "«Aprobar» lo aplica en el acto",
            texto:
              "Tocás «Aprobar» y el cambio queda hecho en la carpeta del cliente. Aparece el aviso «Aplicado», con «Ver ficha» para mirarlo.",
            pantalla: PantallaAprobar,
            consejo: "«Aprobar» no pregunta dos veces. Si te equivocás, lo corregís vos: lo que cambiás se aplica en el acto.",
            sinAncla: {
              texto:
                "Abajo de cada pedido está «Aprobar». Lo tocás y el cambio queda hecho en la carpeta del cliente, en el acto.",
            },
          },
          {
            id: "rechazar",
            ancla: "aprobaciones-rechazar",
            titulo: "O rechazalo, con motivo",
            texto:
              "Si algo no está bien, tocá «Rechazar» y escribí por qué. No se aplica nada. Quien lo pidió ve tu motivo y lo puede corregir.",
            pantalla: PantallaRechazo,
            sinAncla: {
              texto:
                "Al lado de «Aprobar» está «Rechazar»: escribís por qué y no se aplica nada. Quien lo pidió ve tu motivo y lo puede corregir.",
            },
          },
          {
            id: "aplicadas-jefe",
            ancla: "aprobaciones-pestana-revisar",
            accion: "tocar",
            titulo: "Aplicadas por el Jefe",
            texto:
              "Al ambulante, el Jefe de Portería lo da de alta en el acto para cobrarle enseguida. Esas altas no te esperan: las mirás después, acá. Tocala.",
          },
          {
            id: "revisada",
            ancla: "aprobaciones-revision",
            titulo: "Mirala y marcala",
            texto:
              "Si está bien, tocá «Marcar revisada». Si no corresponde, tocá «Dar de baja» y contá por qué: lo que ya pagó queda registrado.",
            sinAncla: {
              texto:
                "Cuando el Jefe dé de alta un ambulante, aparece así. Si está bien, «Marcar revisada». Si no corresponde, «Dar de baja» con el motivo: lo que ya pagó queda registrado.",
              pantalla: PantallaRevisionJefe,
            },
          },
          {
            id: "despues",
            ancla: "aprobaciones-pestanas",
            titulo: "Quien lo pidió se entera",
            texto:
              "Lo que aprobás queda hecho en la carpeta y pasa a «Aprobados». Lo que rechazás pasa a «Rechazados», y quien lo pidió ve tu motivo arriba de la carpeta del cliente.",
          },
        ],
};
