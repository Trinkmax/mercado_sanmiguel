import type { AjustePaso, ContenidoCapitulo, Paso } from "@/lib/tour/tipos";
import {
  PantallaCanonCobrar,
  PantallaCanonCuantos,
  PantallaCanonQueEntro,
  PantallaCobrado,
  PantallaCobrosDelDia,
  PantallaCobrosJefe,
  PantallaDarDeBaja,
  PantallaDniCoincidencias,
  PantallaFichaEmpleado,
  PantallaHorarios,
  PantallaHorariosGuardar,
  PantallaIngresoRegistrado,
  PantallaIngresosDelDia,
  PantallaIngresosLider,
  PantallaListaPersonal,
  PantallaNovedadesEmpleado,
  PantallaNuevoEmpleado,
  PantallaRegistroDni,
  PantallaRegistroFirma,
  PantallaReincorporar,
  PortadaPersonal,
  PortadaPorteria,
} from "@/components/tour/pantallas/porteria-personal";

// Tour guiado · porteria-personal: pasos de los capítulos de esta área (docs/GUIA-TOUR.md).

// ---------------------------------------------------------------------------------------
// Portería (/porteria): la garita. Portería y el Líder.
// ---------------------------------------------------------------------------------------

type Pestana = "canon" | "personal";

const NOMBRE_PESTANA: Record<Pestana, string> = {
  canon: "Canon de transporte",
  personal: "Personal",
};

/**
 * Paso que vive dentro de una de las dos pestañas de la garita. Si está abierta la otra, lo
 * real no se ve (la pestaña cerrada queda oculta): se señala la pestaña que hace falta (su
 * ancla `porteria-abrir-*` existe solo mientras está cerrada), se muestra el dibujo y se puede
 * tocar para abrirla. Los pasos de «Personal» llevan su dirección (?vista=personal): con
 * «Siguiente» el tour abre la pestaña solo; el respaldo queda por si la pantalla tarda.
 */
function enPestana(pestana: Pestana, paso: Paso): Paso {
  const abrir = `porteria-abrir-${pestana}`;
  const anclas = paso.ancla === undefined ? [] : Array.isArray(paso.ancla) ? paso.ancla : [paso.ancla];
  const ajuste: AjustePaso = {
    accion: "tocar",
    pantalla: paso.sinAncla?.pantalla ?? paso.pantalla,
    consejo: `Esto está en la pestaña «${NOMBRE_PESTANA[pestana]}». Tocala y seguimos ahí.`,
  };
  return {
    ...paso,
    ...(pestana === "personal" ? { ruta: "/porteria?vista=personal" } : {}),
    ancla: [...anclas, abrir],
    variantes: { ...paso.variantes, [abrir]: ajuste },
  };
}

/** Portería: la persona de la garita. Cobra el canon y anota al personal. */
function pasosPorteria(): Paso[] {
  return [
    {
      id: "tareas",
      ancla: ["porteria-abrir-canon", "porteria-pestanas"],
      titulo: "Tus dos tareas en la garita",
      texto:
        "«Canon de transporte» es para cobrarle a los vehículos que entran. «Personal» es para anotar a los empleados que llegan y se van. Cada pestaña muestra cuánto se cobró hoy y cuántos hay adentro.",
      variantes: {
        "porteria-abrir-canon": {
          accion: "tocar",
          texto:
            "Acá hacés las dos tareas de la garita: cobrarle el canon a los vehículos y anotar al personal. Empezamos por el canon: tocá «Canon de transporte».",
        },
      },
    },
    enPestana("canon", {
      id: "que-entro",
      ancla: "porteria-que-entro",
      titulo: "Tocá lo que entró",
      texto:
        "Cuando llega un vehículo, tocá su tarjeta: Camioneta, Chasis, Balancín… El precio ya está puesto: vos no escribís ningún monto.",
      consejo: "La tarjeta que elegiste se pone azul, con un tilde.",
      sinAncla: {
        texto:
          "Todavía no hay tarifas cargadas: pedile al Líder que las cargue. Cuando estén, vas a ver una tarjeta por cada vehículo, así:",
        pantalla: PantallaCanonQueEntro,
      },
    }),
    enPestana("canon", {
      id: "cuantos",
      ancla: "porteria-cantidad-medio",
      titulo: "¿Cuántos y cómo paga?",
      texto:
        "Si entran varios iguales, o la estadía es de varios días, sumalos con «+». Después tocá «Efectivo» o «Transferencia», según cómo te pague.",
      consejo: "La patente y «¿A quién viene?» son opcionales: completalos solo si querés.",
      sinAncla: { pantalla: PantallaCanonCuantos },
    }),
    enPestana("canon", {
      id: "cobrar",
      ancla: ["porteria-caja-rendida", "porteria-cobrar"],
      titulo: "Tocá «Cobrar»",
      texto:
        "Abajo está el total. Cuando te pagó, tocá el botón azul: dice cuánto es, por ejemplo «Cobrar $ 6.000». Aparece un sello verde con el número del cobro.",
      pantalla: PantallaCobrado,
      consejo: "Si te equivocaste recién, tocá «Deshacer» en el aviso verde que aparece arriba. Dura unos segundos.",
      variantes: {
        "porteria-caja-rendida": {
          titulo: "La caja de hoy ya se rindió",
          texto:
            "Cuando el Jefe de Portería rinde la caja del día, ya no se puede cobrar. Avisale: él pide que la reabran y después podés cobrar de nuevo.",
          pantalla: undefined,
          consejo: undefined,
        },
      },
      sinAncla: { pantalla: PantallaCanonCobrar },
    }),
    enPestana("canon", {
      id: "cobros",
      ancla: ["porteria-cobros", "porteria-seccion-cobros"],
      titulo: "La plata de la garita",
      texto:
        "Acá dice cuánto efectivo tiene que haber en la garita. Abajo está cada cobro de hoy, con su hora y su número. Todo va a la caja de portería, que rinde el Jefe de Portería.",
      consejo:
        "¿Cobraste mal? Tocá «Anular» en ese cobro y elegí por qué. Tenés 15 minutos; después lo anula el Jefe de Portería.",
      variantes: {
        "porteria-seccion-cobros": {
          titulo: "Tus cobros de hoy",
          texto:
            "Todavía no cobraste nada hoy. Cuando cobres, cada cobro aparece acá con su número, y arriba cuánto efectivo tiene que haber en la garita. Así se ve:",
          pantalla: PantallaCobrosDelDia,
        },
      },
      sinAncla: { pantalla: PantallaCobrosDelDia },
    }),
    {
      id: "pestana-personal",
      ancla: ["porteria-abrir-personal", "porteria-pestana-personal"],
      accion: "tocar",
      titulo: "Ahora, el personal",
      texto: "Tocá «Personal». Ahí anotás a cada empleado que entra y marcás cuando se va.",
      variantes: {
        "porteria-pestana-personal": {
          accion: "mirar",
          texto: "En «Personal» anotás a cada empleado que entra y marcás cuando se va. Ya la tenés abierta.",
        },
      },
    },
    enPestana("personal", {
      id: "dni",
      ancla: "porteria-dni",
      titulo: "Escribí el DNI",
      texto:
        "Solo números, sin puntos. Con 3 números ya aparece la persona: tocala y se completan el apellido y el nombre. Si no aparece, escribilos a mano: el ingreso se anota igual.",
      pantalla: PantallaDniCoincidencias,
      consejo:
        "Si ves el botón «Escanear DNI», tocalo y apuntá la cámara al código de barras del frente del DNI: se completa solo.",
      sinAncla: { pantalla: PantallaRegistroDni },
    }),
    enPestana("personal", {
      id: "firma",
      ancla: "porteria-firma",
      titulo: "Que firme con el dedo",
      texto:
        "Pasale la tablet y que firme con el dedo en el recuadro blanco. Después tocá «Registrar ingreso»: aparece el sello y queda listo para el siguiente.",
      pantalla: PantallaIngresoRegistrado,
      consejo: "Si la firma salió mal, tocá «Borrar firma» y que firme de nuevo.",
      sinAncla: { pantalla: PantallaRegistroFirma },
    }),
    enPestana("personal", {
      id: "ingresos",
      // Si quedó gente adentro de otro día, se señala primero ese aviso ámbar: es lo urgente.
      ancla: ["porteria-quedaron", "porteria-ingreso", "porteria-seccion-ingresos"],
      titulo: "Quién está adentro",
      texto:
        "Cada renglón es alguien que entró hoy, con su firma y si llegó en horario. Cuando alguien se va, tocá «Marcar salida» en su renglón: se anota la hora de ese momento. Si se te pasó, «Otra hora» te deja elegir a qué hora salió.",
      consejo: "Si marcaste mal una salida, no pasa nada: avisale al Líder y él la corrige.",
      variantes: {
        "porteria-quedaron": {
          titulo: "Quedaron adentro de otros días",
          texto:
            "Estas personas entraron otro día y nadie les marcó la salida. Tocá «Marcar salida» en cada una y elegí a qué hora se fueron: si no, esas horas no se cuentan.",
          consejo: "Debajo está la lista de hoy: cuando alguien se va, tocá «Marcar salida» en su renglón.",
        },
        "porteria-seccion-ingresos": {
          titulo: "Quién entró hoy",
          texto:
            "Todavía no entró nadie hoy. Cuando anotes al primero, aparece acá con su firma y el botón «Marcar salida» para cuando se vaya. Así se ve:",
          pantalla: PantallaIngresosDelDia,
        },
      },
      sinAncla: { pantalla: PantallaIngresosDelDia },
    }),
  ];
}

/** El Líder: la misma garita, más otros días, las tarifas y las correcciones. */
function pasosLiderPorteria(): Paso[] {
  return [
    {
      id: "que-es",
      ancla: "encabezado",
      titulo: "La garita, desde tu lugar",
      texto:
        "Es la pantalla de Portería: el canon de transporte y el ingreso del personal. Podés hacer lo mismo que el portero y, además, mirar otros días y cambiar los precios.",
    },
    {
      id: "otro-dia",
      ancla: "porteria-fecha",
      titulo: "Mirá otro día",
      texto:
        "Elegí una fecha y ves lo que se cobró y quién entró ese día. Para cobrar o anotar a alguien, volvé con «Volver a hoy».",
      consejo: "«Canon del mes (.xlsx)» te baja todos los cobros del mes en una planilla.",
    },
    {
      id: "tarifas",
      ancla: "porteria-tarifas",
      titulo: "Los precios los ponés vos",
      texto:
        "Con «Editar tarifas» cambiás el precio de cada vehículo: Camioneta, Chasis, Estadía diaria… En la garita nadie escribe montos: se cobra lo que dice la tarifa.",
    },
    {
      id: "tareas",
      ancla: ["porteria-abrir-canon", "porteria-pestanas"],
      titulo: "Las dos tareas de la garita",
      texto:
        "«Canon de transporte» para cobrarle a los vehículos y «Personal» para el ingreso de los empleados. Cada pestaña muestra lo del día: lo cobrado y cuántos hay adentro.",
      variantes: {
        "porteria-abrir-canon": {
          accion: "tocar",
          texto:
            "«Canon de transporte» para cobrarle a los vehículos y «Personal» para el ingreso de los empleados. Empezamos por el canon: tocá «Canon de transporte».",
        },
      },
    },
    enPestana("canon", {
      id: "cobrar",
      ancla: "porteria-que-entro",
      titulo: "Cobrar, si hace falta",
      texto:
        "Es el mismo formulario del portero: se toca lo que entró, cuántos, cómo paga y «Cobrar». Lo que cobres acá va a la caja de portería de hoy.",
      consejo: "Si la caja de portería de hoy ya se rindió, el formulario queda trabado hasta que la reabran.",
      sinAncla: {
        texto:
          "Mirando otro día no se cobra: tocá «Volver a hoy». Si no hay tarifas, cargalas con «Editar tarifas». El formulario de hoy se ve así:",
        pantalla: PantallaCanonQueEntro,
      },
    }),
    enPestana("canon", {
      id: "cobros",
      ancla: ["porteria-cobros", "porteria-seccion-cobros"],
      titulo: "Lo cobrado y quién lo cobró",
      texto:
        "El efectivo que tiene que haber en la garita, cuántos vehículos entraron de cada tipo y cuánto cobró cada portero. Abajo, cada cobro con su número. Todo va a la caja de portería: la rinde el Jefe de Portería y al final la valida Tesorería.",
      consejo:
        "Podés anular un cobro aunque la caja ya se haya rendido, mientras Tesorería no la valide. Queda tachado, con el motivo.",
      variantes: {
        "porteria-seccion-cobros": {
          texto:
            "Todavía no hay cobros en el día que estás mirando. Cuando haya, ves el efectivo de la garita, cuántos vehículos entraron de cada tipo y cuánto cobró cada portero. Así se ve:",
          pantalla: PantallaCobrosJefe,
        },
      },
      sinAncla: { pantalla: PantallaCobrosJefe },
    }),
    {
      id: "pestana-personal",
      ancla: ["porteria-abrir-personal", "porteria-pestana-personal"],
      accion: "tocar",
      titulo: "Ahora, el personal",
      texto: "Tocá «Personal». Ahí se anota a cada empleado que entra, con su DNI y su firma, y ves quién está adentro.",
      variantes: {
        "porteria-pestana-personal": {
          accion: "mirar",
          texto:
            "En «Personal» se anota a cada empleado que entra, con su DNI y su firma, y ves quién está adentro. Ya la tenés abierta.",
        },
      },
    },
    enPestana("personal", {
      id: "ingresos",
      ancla: ["porteria-ingreso", "porteria-seccion-ingresos"],
      titulo: "Quién entró y a qué hora",
      texto:
        "Cada ingreso con su firma y si llegó en horario. Si una salida quedó mal marcada, solo vos la arreglás con «Corregir salida».",
      consejo: "«Exportar el mes a Excel» te baja todos los ingresos del mes.",
      variantes: {
        "porteria-seccion-ingresos": {
          texto:
            "Todavía no hay ingresos en el día que estás mirando. Cuando haya, ves cada uno con su firma, si llegó en horario y «Corregir salida» para arreglar una salida mal marcada. Así se ve:",
          pantalla: PantallaIngresosLider,
        },
      },
      sinAncla: { pantalla: PantallaIngresosLider },
    }),
    {
      id: "horas",
      titulo: "De acá salen las horas",
      texto:
        "Con cada entrada y salida se arman las horas del mes de cada empleado en «Novedades». Un ingreso sin salida no suma horas. Para saber si llegó fuera de horario, se usan los horarios que cargás en «Personal».",
    },
  ];
}

/** Capítulo "porteria" (metadatos en src/lib/tour/indice.ts). */
export const PORTERIA: ContenidoCapitulo = {
  portada: PortadaPorteria,
  pasos: (rol) => (rol === "lider" ? pasosLiderPorteria() : pasosPorteria()),
};

// ---------------------------------------------------------------------------------------
// Personal (/personal y la ficha /personal/[id]): solo el Líder.
// ---------------------------------------------------------------------------------------

/** Pasos en la ficha de un empleado: se entra por el primer renglón de la lista. */
const FICHA = { ruta: "/personal/[id]", entrar: "personal-fila" } as const;

/** Capítulo "personal" (metadatos en src/lib/tour/indice.ts). */
export const PERSONAL: ContenidoCapitulo = {
  portada: PortadaPersonal,
  pasos: () => [
    {
      id: "que-es",
      ancla: "encabezado",
      titulo: "El padrón del personal",
      texto:
        "Acá están los empleados de la cooperativa, con su contrato y sus horarios. Portería los busca en esta lista cuando anota un ingreso, y Novedades usa sus horarios para contar las horas.",
      consejo: "«Novedades del mes», arriba, te lleva a la planilla de horas de todos.",
    },
    {
      id: "nuevo",
      ancla: "personal-nuevo",
      titulo: "Dar de alta a alguien",
      texto:
        "Tocá «Nuevo empleado» y completá sus datos, el sector y el contrato. Al tocar «Crear empleado» se abre su ficha, y ahí le cargás los horarios.",
      pantalla: PantallaNuevoEmpleado,
      consejo:
        "El sector dice quién carga sus novedades: los de Portería, el Jefe de Portería; Limpieza y Mantenimiento, Administración.",
    },
    {
      id: "buscar",
      ancla: "personal-buscar",
      titulo: "Buscá y filtrá",
      texto:
        "Escribí el apellido, el nombre o el DNI. «Activos» muestra a los que trabajan; «Todos» suma a los que están de baja. Los botones de sector achican la lista.",
    },
    {
      id: "fila",
      ancla: "personal-fila",
      accion: "tocar",
      titulo: "Cada renglón, un empleado",
      texto:
        "Ves su sector, las horas por semana y sus horarios. Lo que falta cargar aparece en color ámbar. Tocalo para abrir su ficha.",
      sinAncla: {
        texto:
          "Cuando cargues al primero, aparece acá con su sector, sus horas por semana y sus horarios. Así se ve la lista:",
        pantalla: PantallaListaPersonal,
      },
    },
    {
      id: "contrato",
      ...FICHA,
      ancla: "personal-contrato",
      titulo: "Su contrato",
      texto:
        "El tipo de contrato, la fecha de ingreso y las horas por semana. Si cargaste el archivo firmado, lo abrís con «Ver contrato». Para cambiar algo, tocá «Editar datos», arriba.",
      sinAncla: {
        texto:
          "En la ficha de cada empleado está su contrato: el tipo, la fecha de ingreso, las horas por semana y el archivo firmado. Para cambiar algo, «Editar datos». Así se ve:",
        pantalla: PantallaFichaEmpleado,
      },
    },
    {
      id: "horarios",
      ...FICHA,
      ancla: "personal-dia",
      titulo: "Sus horarios, día por día",
      texto:
        "En cada día tocá «Agregar horario» y escribí la entrada y la salida en 24 horas: 14:00, no 2 de la tarde. Si corta al mediodía, sumá «Agregar otra franja».",
      consejo: "Turno de noche (de 22:00 a 06:00): cargalo en el día que entra. La salida queda para el día siguiente.",
      sinAncla: {
        texto:
          "En la ficha cargás sus horarios: en cada día, «Agregar horario» y la entrada y la salida en 24 horas (14:00, no 2 de la tarde). Así se ve:",
        pantalla: PantallaHorarios,
      },
    },
    {
      id: "guardar",
      ...FICHA,
      ancla: "personal-guardar-horarios",
      titulo: "Guardá los horarios",
      texto:
        "Cuando termines, tocá «Guardar horarios»: hasta que no lo toques, no cambia nada. Si trabaja igual toda la semana, antes usá «Copiar lunes a martes–sábado», arriba.",
      pantalla: PantallaHorariosGuardar,
      consejo: "Portería compara cada ingreso con estos horarios y marca si llegó «Fuera de horario».",
      sinAncla: { pantalla: PantallaHorariosGuardar },
    },
    {
      id: "baja",
      ...FICHA,
      ancla: ["personal-baja", "personal-reincorporar"],
      titulo: "Si deja de trabajar",
      texto:
        "Tocá «Dar de baja» y elegí la fecha de egreso. Portería ya no lo encuentra en el padrón, pero sus ingresos anteriores quedan guardados.",
      pantalla: PantallaDarDeBaja,
      consejo: "Si vuelve a trabajar o la baja fue un error, en su ficha aparece «Reincorporar».",
      variantes: {
        "personal-reincorporar": {
          titulo: "Si vuelve a trabajar",
          texto:
            "Este empleado está de baja. Con «Reincorporar» vuelve a figurar como activo: elegís si vuelve desde una fecha o si la baja fue un error.",
          pantalla: PantallaReincorporar,
          consejo: "Mientras está de baja, Portería no lo encuentra en el padrón.",
        },
      },
      sinAncla: {
        texto:
          "En la ficha de cada empleado está «Dar de baja»: elegís la fecha de egreso y Portería ya no lo encuentra en el padrón. Sus ingresos anteriores quedan guardados.",
      },
    },
    {
      id: "novedades",
      ...FICHA,
      ancla: "personal-novedades",
      titulo: "Sus horas del mes",
      texto:
        "Acá se comparan las horas que tendría que trabajar con las que anotó Portería. Las faltas, las llegadas tarde y las horas extra se cargan con «Cargar novedad».",
      consejo: "Más abajo, «Últimos ingresos por portería» muestra cada entrada y salida que anotó la garita.",
      sinAncla: {
        texto:
          "En la ficha también ves sus horas del mes: las que tendría que trabajar contra las que anotó Portería. Las faltas y las horas extra se cargan con «Cargar novedad». Así se ve:",
        pantalla: PantallaNovedadesEmpleado,
      },
    },
  ],
};
