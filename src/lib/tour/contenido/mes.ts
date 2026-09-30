import type { Rol } from "@/lib/auth";
import type { ContenidoCapitulo, Paso } from "@/lib/tour/tipos";
import type { PestanaConfiguracion } from "@/components/configuracion/pestanas-configuracion";
import {
  PantallaAgregarMedidor,
  PantallaAvanceLecturas,
  PantallaBalanceMes,
  PantallaBeneficioTermino,
  PantallaCargaLecturas,
  PantallaCobranzaDiaria,
  PantallaConfirmarGenerar,
  PantallaCredencial,
  PantallaCredencialPortal,
  PantallaCuotasQuinta,
  PantallaDarAcceso,
  PantallaEditarConceptoAdmin,
  PantallaEditarConceptoLider,
  PantallaEstimadoMes,
  PantallaExportarPlanillas,
  PantallaGastosMes,
  PantallaGeneral,
  PantallaHistorial,
  PantallaHistorialLider,
  PantallaIngresosConcepto,
  PantallaMesGenerado,
  PantallaNuevoUsuario,
  PantallaNuevoUsuarioPorteria,
  PantallaOrdenImputacion,
  PantallaPlanillaElectricista,
  PantallaPortalClientes,
  PantallaPrecioKwhAdmin,
  PantallaPrecioKwhLider,
  PantallaPrecioQuinta,
  PantallaPreciosAdmin,
  PantallaPreciosLider,
  PantallaQuitarAcceso,
  PantallaReporteContadora,
  PantallaRubroFijo,
  PantallaRubros,
  PantallaTarifasPorteria,
  PantallaTotalesMes,
  PantallaUsuariosEquipo,
  PortadaConfiguracion,
  PortadaConfiguracionAdmin,
  PortadaConfiguracionJefe,
  PortadaEnergia,
  PortadaFacturacion,
  PortadaReportes,
} from "@/components/tour/pantallas/mes";

// Tour guiado · mes: pasos de Facturación, Energía, Reportes y Configuración
// (docs/GUIA-TOUR.md).
//
// Producción arranca vacía: sin conceptos cargados en las carpetas no aparece el botón
// «Generar …», sin medidores no hay carga rápida y sin mes generado Reportes no tiene
// conceptos. Esos pasos señalan la tarjeta que siempre está (variante) o muestran su
// pantalla de ejemplo (sinAncla).
//
// Configuración tiene pestañas por link (?tab=): cada pestaña importante se enseña con un paso
// "tocá «…»" sobre ella y después pasos con ruta "/configuracion?tab=…" que señalan su
// contenido real. Si la persona sigue con «Siguiente» sin tocarla, el motor abre la pestaña
// solo; «Anterior» también vuelve a la pestaña del paso. La pantalla de ejemplo va en
// `sinAncla` cuando lo real ya se ve (no se repite el dibujo de lo que está a la vista).

// ---------------------------------------------------------------------------------------
// Facturación (admin, lider)
// ---------------------------------------------------------------------------------------

/** Capítulo "facturacion" (metadatos en src/lib/tour/indice.ts). */
export const FACTURACION: ContenidoCapitulo = {
  portada: PortadaFacturacion,
  pasos: (rol: Rol): Paso[] => {
    const lider = rol === "lider";
    return [
      {
        id: "que-es",
        ancla: "encabezado",
        titulo: "Lo que se cobra cada mes",
        texto:
          "A principio de mes generás acá los cargos de todos los clientes, de una sola vez. Desde ese momento cada uno ya tiene su deuda del mes, lista para cobrarle.",
      },
      {
        id: "mes",
        ancla: "facturacion-mes",
        titulo: "El mes que toca",
        texto:
          "Arriba dice qué mes toca generar y qué día vence. Vence el 30; si hace falta, se cambia en «Configuración», pestaña «General».",
        consejo:
          "Si el mes en curso ya está generado, acá aparece el que sigue. Ese lo generás recién cuando empiece.",
      },
      {
        id: "conceptos",
        ancla: ["facturacion-conceptos", "facturacion-mes"],
        titulo: "Qué se va a cobrar",
        texto:
          "Cada concepto dice cuántos clientes lo pagan y cuánto suma. Sale de la carpeta de cada cliente: cuántos tiene (una expensa y media, cuatro galpones) y qué porcentaje paga (el 90 %, el 110 %).",
        pantalla: PantallaEstimadoMes,
        consejo: "Un cambio de precio o de cantidad rige desde el próximo mes que se genere. Lo ya generado no cambia.",
        variantes: {
          "facturacion-mes": {
            titulo: "Primero, lo que paga cada cliente",
            texto:
              "Todavía no hay nada para facturar: falta cargar los conceptos en la carpeta de cada cliente. Después, acá aparece cada concepto con cuántos lo pagan y cuánto suma. Así se ve:",
          },
        },
        sinAncla: {
          texto:
            "En la tarjeta del mes aparece cada concepto con cuántos clientes lo pagan y cuánto suma, según la carpeta de cada uno. Así se ve:",
        },
      },
      {
        id: "generar",
        ancla: "facturacion-generar",
        titulo: "Generá el mes",
        texto:
          "Tocá el botón azul «Generar» con el nombre del mes. Te dice cuántos cargos se crean y por cuánto; si está bien, tocás «Sí, generar».",
        pantalla: PantallaConfirmarGenerar,
        consejo:
          "Quedate tranquilo: si se genera dos veces no se duplica nada. Solo suma lo que falte, como el abono de un medidor nuevo.",
        sinAncla: {
          texto:
            "Cuando haya clientes con conceptos, debajo del total aparece el botón «Generar» con el nombre del mes (por ejemplo, «Generar Octubre de 2026»). Al tocarlo se abre esta ventana:",
        },
      },
      {
        id: "despues",
        titulo: "Y ya se puede cobrar",
        texto:
          "Al generar, cada cliente ya debe su mes: lo ves en «Cobrar», en su carpeta y en el mapa, y el socio en su portal. Si alguno tenía saldo a favor, se le descuenta solo.",
        pantalla: PantallaMesGenerado,
        consejo: "El consumo de luz no va acá: se suma solo cuando se cargan las lecturas en «Energía».",
      },
      {
        id: "beneficio",
        titulo: "Hasta el 30, con beneficio",
        texto:
          "Quien paga hasta el vencimiento tiene el beneficio por pago en término. Con 15 % de beneficio, la expensa de $ 1.080.000 queda en $ 939.130,43: se divide por 1,15. Después del vencimiento, debe el importe completo.",
        pantalla: PantallaBeneficioTermino,
        consejo: "En «Cobrar» y en el portal, a cada uno se le avisa cuánto se ahorra pagando a tiempo.",
      },
      {
        id: "historial",
        ancla: ["facturacion-periodo", "facturacion-historial"],
        titulo: "Cómo viene cada mes",
        texto: lider
          ? "Cada mes generado queda en «Períodos generados», con lo estimado y lo cobrado. «Ver reporte» te lleva al detalle de ese mes, concepto por concepto."
          : "Cada mes generado queda en «Períodos generados», con lo estimado y lo cobrado. Así ves cómo avanza la cobranza del mes.",
        pantalla: lider ? PantallaHistorialLider : PantallaHistorial,
        consejo:
          "El estimado da un poco más que lo cobrado más lo que falta: la diferencia son los beneficios por pagar en término.",
        variantes: {
          "facturacion-historial": {
            texto:
              "Todavía no se generó ningún mes. Después del primero, acá queda cada mes con lo estimado y lo cobrado. Así se ve:",
          },
        },
        sinAncla: {
          texto: "Abajo, en «Períodos generados», queda cada mes con lo estimado y lo cobrado. Así se ve:",
        },
      },
    ];
  },
};

// ---------------------------------------------------------------------------------------
// Energía (admin, lider)
// ---------------------------------------------------------------------------------------

/** Capítulo "energia" (metadatos en src/lib/tour/indice.ts). */
export const ENERGIA: ContenidoCapitulo = {
  portada: PortadaEnergia,
  pasos: (rol: Rol): Paso[] => {
    const lider = rol === "lider";
    return [
      {
        id: "que-es",
        ancla: "encabezado",
        titulo: "La luz de cada puesto",
        texto:
          "Una vez por mes el electricista recorre los medidores con una planilla de papel. Vos cargás acá lo que anotó y el sistema calcula cuánto paga cada uno.",
      },
      {
        id: "planilla",
        ancla: "energia-planilla",
        titulo: "Imprimí la planilla",
        texto:
          "Tocá «Imprimir planilla para el electricista». Sale con cada medidor en el orden del recorrido y su lectura anterior; él anota la actual con lapicera.",
        pantalla: PantallaPlanillaElectricista,
        consejo: "Con «Exportar lecturas» bajás a Excel las lecturas del mes.",
      },
      {
        id: "mes",
        ancla: "energia-mes",
        titulo: "La energía del mes",
        texto:
          "Esta es la cuenta del mes: el abono de cada cliente con medidor, más el consumo que vas cargando, da el total de energía. Con las flechas de arriba mirás otro mes.",
        consejo: "El abono mensual se suma solo cuando se genera el mes en «Facturación».",
      },
      {
        id: "cargar",
        ancla: ["energia-actual-pendiente", "energia-actual", "energia-sin-medidores"],
        titulo: "Escribí la lectura actual",
        texto:
          "Los medidores están en el mismo orden que la planilla. En cada uno escribí el número que anotó el electricista y apretá Enter o «Guardar». El sistema calcula los kWh y el importe, y pasa solo al medidor siguiente.",
        pantalla: PantallaCargaLecturas,
        consejo: "Si te equivocaste, tocá «Corregir» en ese medidor y guardalo de nuevo.",
        variantes: {
          "energia-actual": {
            titulo: "Las lecturas del mes",
            texto:
              "Este mes ya están todas cargadas: cada medidor tiene su tilde verde. Si alguna quedó mal, tocá «Corregir» en ese medidor, escribí el número bueno y guardá.",
            consejo: "Las lecturas se cargan con el número que anotó el electricista en la planilla.",
          },
          "energia-sin-medidores": {
            titulo: "Primero, los medidores",
            texto:
              "Todavía no hay medidores. Cuando los agregues, cada uno aparece acá con su lectura anterior y un lugar para escribir la actual. Así se ve:",
          },
        },
        sinAncla: {
          texto:
            "Cada medidor aparece en la lista con su lectura anterior. Escribís la actual, apretás Enter y el sistema calcula los kWh y el importe. Así se ve:",
        },
      },
      {
        id: "avance",
        ancla: "energia-progreso",
        titulo: "Cuánto te falta",
        texto:
          "La barra verde te dice cuántas lecturas cargaste de todas. Cada lectura guardada ya es un cargo del cliente: se le puede cobrar en el momento.",
        pantalla: PantallaAvanceLecturas,
        sinAncla: {
          texto:
            "Arriba de la lista, una barra verde te dice cuántas lecturas cargaste de todas. Cada lectura guardada ya es un cargo del cliente, listo para cobrar. Así se ve:",
        },
      },
      {
        id: "precio",
        ancla: "energia-precio-kwh",
        titulo: "El precio del kWh",
        texto: lider
          ? "Arriba está el precio del kWh. Con el lápiz lo cambiás y tocás «Guardar precio»: vale para las próximas lecturas, las ya cargadas no cambian."
          : "Arriba está el precio del kWh. Con el lápiz proponés uno nuevo y tocás «Enviar a aprobación». Hasta que el Líder no lo apruebe, se sigue usando el de ahora.",
        pantalla: lider ? PantallaPrecioKwhLider : PantallaPrecioKwhAdmin,
        consejo: "El «Abono mensual» se cambia igual, con su lápiz, en el recuadro de la energía del mes.",
      },
      {
        id: "medidor",
        ancla: "energia-agregar-medidor",
        titulo: "Un medidor nuevo",
        texto:
          "Tocá «Agregar un medidor» y buscá al cliente. Se abre su carpeta en «Medidores», donde cargás el número y el lugar.",
        pantalla: PantallaAgregarMedidor,
        consejo:
          "Si el mes ya estaba generado, arriba aparece un aviso para sumarle el abono de ese mes, sin duplicar nada.",
      },
    ];
  },
};

// ---------------------------------------------------------------------------------------
// Reportes (lider)
// ---------------------------------------------------------------------------------------

/** Capítulo "reportes" (metadatos en src/lib/tour/indice.ts). */
export const REPORTES: ContenidoCapitulo = {
  portada: PortadaReportes,
  pasos: (): Paso[] => [
    {
      id: "que-es",
      ancla: "encabezado",
      titulo: "Cómo viene la plata del mes",
      texto:
        "Acá ves cuánto se esperaba cobrar, cuánto entró y cuánto se gastó. No cargás nada: se arma solo con los cobros, las lecturas y los gastos que carga cada uno.",
      consejo: "Esta pantalla es solo tuya: Administración no la ve.",
    },
    {
      id: "mes",
      ancla: "reportes-selector",
      titulo: "Elegí el mes",
      texto: "Con las flechas pasás al mes anterior o al siguiente. Todo lo de abajo, y lo que exportes, cambia a ese mes.",
    },
    {
      id: "dia-a-dia",
      ancla: ["reportes-grafico", "reportes-cobranza"],
      titulo: "Lo cobrado, día por día",
      texto: "Cada barra es lo que se cobró ese día, sumando todas las cajas y el bono camioneros de Portería.",
      pantalla: PantallaCobranzaDiaria,
      variantes: {
        "reportes-cobranza": {
          texto:
            "Este mes todavía no hay cobros. Cuando entren, cada barra va a ser lo que se cobró ese día, sumando todas las cajas y el bono camioneros. Así se ve:",
        },
      },
      sinAncla: {
        texto: "«Cobranza día a día» muestra con una barra lo que se cobró cada día del mes. Así se ve:",
      },
    },
    {
      id: "ingresos",
      ancla: ["reportes-conceptos", "reportes-ingresos"],
      titulo: "Estimado contra cobrado",
      texto:
        "Cada concepto con su barra: verde lo cobrado, gris los beneficios y rojo claro lo que falta. El estimado se sabe desde el día 1, porque es lo que se generó en «Facturación».",
      pantalla: PantallaIngresosConcepto,
      variantes: {
        "reportes-ingresos": {
          titulo: "Primero se genera el mes",
          texto:
            "Este mes todavía no se generó. Cuando se genere en «Facturación», acá vas a ver cada concepto con lo estimado, lo cobrado y lo que falta. Así se ve:",
        },
      },
      sinAncla: {
        texto: "En «Ingresos» está cada concepto con lo estimado, lo cobrado y lo que falta. Así se ve:",
      },
    },
    {
      id: "cuenta",
      ancla: "reportes-totales",
      titulo: "La cuenta cierra",
      texto:
        "Estimado = cobrado + beneficios otorgados + beneficio en término + falta cobrar. El «Beneficio en término» es de quienes todavía están a tiempo: si pagan tarde, pasa a «Falta cobrar».",
      pantalla: PantallaTotalesMes,
      sinAncla: {
        texto:
          "Debajo de los conceptos van los totales del mes: estimado = cobrado + beneficios otorgados + beneficio en término + falta cobrar. Así se ve:",
      },
    },
    {
      id: "gastos",
      ancla: "reportes-gastos",
      titulo: "Lo que se gastó",
      texto:
        "Los gastos del mes por rubro, con lo pagado y lo pendiente, separados en fijos y variables. Salen de lo que se carga en «Gastos».",
      pantalla: PantallaGastosMes,
    },
    {
      id: "balance",
      ancla: "reportes-balance",
      titulo: "El resultado del mes",
      texto: "Lo cobrado menos lo gastado que ya se pagó. En verde si quedó plata; en rojo si salió más de lo que entró.",
      pantalla: PantallaBalanceMes,
    },
    {
      id: "contadora",
      ancla: "reportes-contadora",
      titulo: "Para la contadora",
      texto:
        "«Reporte para la contadora» abre una hoja con los ingresos y los gastos del mes, lista para imprimir o guardar como PDF y mandársela.",
      pantalla: PantallaReporteContadora,
    },
    {
      id: "excel",
      ancla: "reportes-exportar",
      titulo: "Todo a Excel",
      texto:
        "«Exportar planillas» baja a Excel la lista que necesites: clientes, pagos, cuenta corriente, cajas, gastos, cheques y más. Al lado, «Balance del mes (.xlsx)» baja el balance entero.",
      pantalla: PantallaExportarPlanillas,
      consejo: "Las planillas de cada mes salen con el mes que elegiste arriba.",
    },
  ],
};

// ---------------------------------------------------------------------------------------
// Configuración (admin, guardia, lider): pestañas distintas para cada uno
// ---------------------------------------------------------------------------------------

/** Cada pestaña es un link con ?tab= (pestanas-configuracion.tsx). La primera de cada rol
 * es "/configuracion" sin query; igual se pide con su ?tab= para que «Anterior» vuelva a ella. */
function pestana(tab: PestanaConfiguracion): string {
  return `/configuracion?tab=${tab}`;
}

const PASO_QUE_ES: Record<"lider" | "admin" | "guardia", Paso> = {
  lider: {
    id: "que-es",
    ancla: "encabezado",
    titulo: "Las reglas del sistema",
    texto:
      "Acá decidís cuánto cuesta cada cosa, cuándo vence el mes y quién puede entrar. Lo que cambies rige de acá en adelante: lo ya generado o cobrado no cambia.",
  },
  admin: {
    id: "que-es",
    ancla: "encabezado",
    titulo: "Precios, vencimiento y portal",
    texto:
      "Acá proponés los precios de los puestos y elegís qué día vence el mes. También les das a los clientes su acceso al portal y cargás los rubros de gasto.",
  },
  guardia: {
    id: "que-es",
    ancla: "encabezado",
    titulo: "Tus ajustes",
    texto:
      "Acá decidís en cuántos pagos se cobra la quinta, proponés los precios de quintas y ambulantes y creás los usuarios de Portería.",
  },
};

/** «Precios» (la pestaña de entrada del Líder y de Administración): la lista de conceptos. */
function pasoPrecios(lider: boolean): Paso {
  return {
    id: "precios",
    ruta: pestana("precios"),
    ancla: "config-conceptos",
    titulo: lider ? "Cada concepto, con su precio" : "Los precios de los puestos",
    texto: lider
      ? "Cada concepto dice su precio, su beneficio por pago en término y su orden. El interruptor «Activo» lo apaga para todos los clientes: no se genera más."
      : "Cada concepto dice su precio, su beneficio por pago en término y su orden de cobro. Las quintas y los ambulantes no están: los maneja el Jefe de Portería.",
    sinAncla: {
      texto:
        "En «Precios» aparece cada concepto con su precio, su beneficio por pago en término y su orden. Así se ve:",
      pantalla: lider ? PantallaPreciosLider : PantallaPreciosAdmin,
    },
  };
}

/** «General»: tocar la pestaña y el vencimiento del mes (Líder y Administración). */
function pasosGeneral(): Paso[] {
  return [
    {
      id: "pestana-general",
      ancla: "config-pestana-general",
      accion: "tocar",
      titulo: "Tocá «General»",
      texto: "Ahí está el día que vence el mes y si el recibo se imprime apenas se emite.",
    },
    {
      id: "vencimiento",
      ruta: pestana("general"),
      ancla: "config-vencimiento",
      titulo: "El día que vence el mes",
      texto:
        "Hasta ese día se paga con beneficio; después se debe el importe completo. Para cambiarlo, escribí el día y tocá «Guardar vencimiento».",
      consejo: "Un vencimiento nuevo rige desde el próximo mes que se genere.",
      sinAncla: {
        texto:
          "En «General» está el día que vence el mes: hasta ese día se paga con beneficio, después se debe el importe completo. Así se ve:",
        pantalla: PantallaGeneral,
      },
    },
  ];
}

/** Rubros de gasto: fijo (se carga solo cada mes) o variable. Administración y el Líder. */
const PASO_RUBROS_FIJOS: Paso = {
  id: "rubros-fijos",
  ruta: pestana("rubros"),
  ancla: ["config-rubros-fijos", "config-rubro-tipo"],
  titulo: "Fijo o variable",
  texto:
    "Lo que se paga todos los meses (el alquiler, internet, los sueldos) marcalo «Fijo»: poné el monto de cada mes y el día que vence, y tocá «Guardar fijo». Desde ahí se carga solo en «Gastos» el 1° de cada mes. Lo demás queda «Variable» y se carga cada vez que pasa.",
  pantalla: PantallaRubroFijo,
  consejo:
    "Si el monto cambia para siempre, cambialo acá. Si cambia solo un mes, tocá «Cambiar monto» en ese gasto, en «Gastos».",
  sinAncla: {
    texto:
      "En «Rubros de gasto» cada rubro es «Fijo» o «Variable». El fijo lleva su monto y el día que vence, y se carga solo en «Gastos» el 1° de cada mes. Así se ve:",
    pantalla: PantallaRubroFijo,
  },
};

function pasosLider(): Paso[] {
  return [
    PASO_QUE_ES.lider,
    {
      id: "pestanas",
      ancla: "config-pestanas",
      titulo: "Seis pestañas",
      texto:
        "«Precios» y «General»: lo que se cobra y cuándo vence. «Tarifas de transporte» y «Quintas y ambulantes»: lo que cobra Portería. «Usuarios» y «Rubros de gasto»: quién entra, y qué gastos son fijos (se cargan solos) o variables.",
      consejo: "Un número ámbar en una pestaña son precios que proponen otros y esperan tu OK en «Aprobaciones».",
    },
    pasoPrecios(true),
    {
      id: "editar",
      ruta: pestana("precios"),
      ancla: "config-editar",
      titulo: "Cambiá precio, beneficio y orden",
      texto:
        "Tocá «Editar» en un concepto: cambiás el precio, el beneficio por pago en término y el orden, y tocás «Guardar cambios». Rige desde la próxima generación del mes.",
      pantalla: PantallaEditarConceptoLider,
      consejo:
        "Con 15 % de beneficio, quien paga a tiempo una expensa de $ 1.080.000 paga $ 939.130,43: se divide por 1,15.",
      sinAncla: {
        texto:
          "En «Precios», cada concepto tiene su «Editar». Se abre esta ventana: precio, beneficio por pago en término y orden de imputación.",
      },
    },
    {
      id: "orden",
      ruta: pestana("precios"),
      ancla: "config-orden",
      titulo: "El orden de imputación",
      texto:
        "Cuando alguien paga una parte, la plata entra sola: primero la deuda más vieja y, dentro del mes, el concepto con el número de orden más bajo.",
      pantalla: PantallaOrdenImputacion,
      consejo: "Para que un concepto se cobre antes, bajale el número de orden con «Editar».",
      sinAncla: {
        texto:
          "Cuando alguien paga una parte, la plata entra sola: primero la deuda más vieja y, dentro del mes, el concepto con el orden más bajo. Así se reparte:",
      },
    },
    ...pasosGeneral(),
    {
      id: "pestana-tarifas",
      ancla: "config-pestana-tarifas",
      accion: "tocar",
      titulo: "Tocá «Tarifas de transporte»",
      texto: "Ahí está lo que cobra Portería por cada vehículo que entra.",
    },
    {
      id: "tarifas",
      ruta: pestana("tarifas"),
      ancla: "config-tarifas",
      titulo: "Lo que cobra Portería",
      texto:
        "Cada vehículo que entra, con su precio. Si cambiás uno, tocás «Guardar cambios» y rige desde el próximo cobro: los cobros ya hechos no cambian. Con «Agregar tarifa» sumás otro.",
      consejo:
        "La quinta y el ambulante están en «Quintas y ambulantes»: los propone el Jefe de Portería y, si los cambiás vos, se aplican en el acto.",
      sinAncla: {
        texto:
          "En «Tarifas de transporte» está cada vehículo con su precio; al lado, en «Quintas y ambulantes», la quinta y el ambulante. Así se ve:",
        pantalla: PantallaTarifasPorteria,
      },
    },
    {
      id: "pestana-usuarios",
      ancla: "config-pestana-usuarios",
      accion: "tocar",
      titulo: "Tocá «Usuarios»",
      texto: "Ahí creás el usuario de cada persona que trabaja con el sistema y les das a los clientes su acceso al portal.",
    },
    {
      id: "equipo",
      ruta: pestana("usuarios"),
      ancla: "config-usuarios-ver",
      titulo: "Equipo y clientes",
      texto:
        "«Equipo» es la gente que trabaja con el sistema. «Portal de clientes», los puesteros y quinteros que ven su cuenta desde el celular.",
      sinAncla: {
        texto:
          "En «Usuarios» está el equipo que trabaja con el sistema y, aparte, los clientes con acceso al portal. Así se ve:",
        pantalla: PantallaUsuariosEquipo,
      },
    },
    {
      id: "nuevo-usuario",
      ruta: pestana("usuarios"),
      ancla: ["config-nuevo-usuario", "config-dar-acceso"],
      titulo: "Tocá «Nuevo usuario»",
      texto:
        "Elegís a la persona del personal (o le escaneás el DNI), qué hace en la cooperativa, y tocás «Crear el usuario de …». Entra con su DNI.",
      pantalla: PantallaNuevoUsuario,
      consejo: "Al final aparece su contraseña: imprimila y dásela en mano, porque después no se puede volver a ver.",
      variantes: {
        // Si ya estaba mirando «Portal de clientes».
        "config-dar-acceso": {
          titulo: "Tocá «Dar acceso»",
          texto:
            "Se abre en la misma fila: el DNI sale del CUIT (revisalo con el documento) y la contraseña ya viene lista. Tocás «Dar acceso a …» y listo.",
          pantalla: PantallaDarAcceso,
        },
      },
      sinAncla: {
        texto:
          "En «Usuarios», «Nuevo usuario» abre este formulario: quién es, qué hace y su contraseña. Entra con su DNI.",
      },
    },
    PASO_RUBROS_FIJOS,
  ];
}

function pasosAdmin(): Paso[] {
  return [
    PASO_QUE_ES.admin,
    pasoPrecios(false),
    {
      id: "proponer",
      ruta: pestana("precios"),
      ancla: "config-editar",
      titulo: "Proponé un precio nuevo",
      texto:
        "Tocá «Editar» en el concepto, cambiá el precio y tocá «Enviar a aprobación». Hasta que el Líder no lo apruebe no cambia nada: se sigue cobrando el precio de ahora.",
      pantalla: PantallaEditarConceptoAdmin,
      consejo: "Mientras espera, el concepto muestra el sello «Esperando aprobación».",
      sinAncla: {
        texto:
          "En «Precios», cada concepto tiene su «Editar». Se abre esta ventana; al tocar «Enviar a aprobación», el cambio espera el OK del Líder.",
      },
    },
    ...pasosGeneral(),
    {
      id: "pestana-portal",
      ancla: "config-pestana-usuarios",
      accion: "tocar",
      titulo: "Tocá «Portal de clientes»",
      texto:
        "Ahí les das a los puesteros su acceso al portal: desde el celular ven su cuenta, bajan sus recibos y reciben las circulares.",
    },
    {
      id: "portal",
      ruta: pestana("usuarios"),
      ancla: "config-portal-vista",
      titulo: "Sin acceso y con acceso",
      texto:
        "«Sin acceso» son los que todavía no pueden entrar; «Con acceso», los que ya entran. Para encontrar a uno, escribí su carpeta, nombre, apodo o puesto.",
      sinAncla: {
        titulo: "Clientes en el portal",
        texto: "En «Portal de clientes» están los puesteros con y sin acceso al portal. Así se ve:",
        pantalla: PantallaPortalClientes,
      },
    },
    {
      id: "dar-acceso",
      ruta: pestana("usuarios"),
      ancla: "config-dar-acceso",
      titulo: "Tocá «Dar acceso»",
      texto:
        "Se abre en la misma fila: el DNI sale del CUIT (revisalo con el documento) y la contraseña ya viene lista. Tocás «Dar acceso a …» y listo.",
      pantalla: PantallaDarAcceso,
      sinAncla: {
        texto:
          "Cada cliente sin acceso tiene su «Dar acceso». Se abre así, con el DNI sacado del CUIT y la contraseña lista:",
      },
    },
    {
      id: "credencial",
      titulo: "Dale su contraseña en mano",
      texto:
        "Al terminar aparece una tarjeta con su DNI y su contraseña. Tocá «Imprimir» y dásela: después no se puede volver a ver.",
      pantalla: PantallaCredencialPortal,
      consejo: "Si la pierde, buscalo en «Con acceso» y tocá «Nueva contraseña».",
    },
    {
      id: "pestana-rubros",
      ancla: "config-pestana-rubros",
      accion: "tocar",
      titulo: "Tocá «Rubros de gasto»",
      texto: "Son los códigos para ordenar los gastos (AGUA, ALQ…) y ahí decís cuáles son fijos.",
    },
    PASO_RUBROS_FIJOS,
    {
      id: "rubros",
      ruta: pestana("rubros"),
      ancla: "config-rubro-nuevo",
      titulo: "Un rubro nuevo",
      texto:
        "Escribí un código corto y el nombre, y tocá «Agregar rubro». El que no se usa más, apagalo en la lista: deja de aparecer al cargar gastos.",
      sinAncla: {
        titulo: "Rubros de gasto",
        texto: "En «Rubros de gasto» agregás un rubro con su código y su nombre, y apagás el que no se usa. Así se ve:",
        pantalla: PantallaRubros,
      },
    },
  ];
}

function pasosJefe(): Paso[] {
  return [
    PASO_QUE_ES.guardia,
    {
      id: "cuotas",
      ruta: pestana("quintas"),
      ancla: "config-cuotas-quinta",
      titulo: "¿En cuántos pagos, la quinta?",
      texto:
        "Tocás 1, 2, 3 o 4 pagos. Es lo que se le propone a un quintero nuevo; los que ya están siguen como estaban.",
      consejo: "Se guarda al tocar. Si te equivocaste, tocá «Deshacer» en el aviso que aparece.",
      sinAncla: {
        texto: "En «Quintas y ambulantes» elegís en cuántos pagos se cobra la quinta a los quinteros nuevos. Así se ve:",
        pantalla: PantallaCuotasQuinta,
      },
    },
    {
      id: "precios",
      ruta: pestana("quintas"),
      ancla: "config-precios-porteria",
      titulo: "Precios de quinta y ambulante",
      texto:
        "La quinta va por mes y el ambulante por día. Para cambiar uno tocás «Cambiar el precio», escribís el nuevo y tocás «Enviar al Líder».",
      pantalla: PantallaPrecioQuinta,
      consejo: "Hasta que el Líder no lo apruebe, se sigue cobrando el precio de ahora.",
      sinAncla: {
        texto:
          "En «Quintas y ambulantes» están el precio de la quinta por mes y el del ambulante por día. Con «Cambiar el precio» proponés uno nuevo:",
      },
    },
    {
      id: "pestana-usuarios",
      ancla: "config-pestana-usuarios",
      accion: "tocar",
      titulo: "Tocá «Usuarios de Portería»",
      texto: "Ahí están las personas de la garita que usan el sistema. Cada una entra con su DNI y su contraseña.",
    },
    {
      id: "nuevo",
      ruta: pestana("usuarios"),
      ancla: "config-nuevo-usuario",
      titulo: "Tocá «Nuevo usuario de Portería»",
      texto:
        "Lo elegís del personal de Portería, le escaneás el DNI o lo escribís a mano, y tocás «Crear el usuario de …». Ya queda como Portería: no tenés que elegir qué hace.",
      pantalla: PantallaNuevoUsuarioPorteria,
      sinAncla: {
        texto:
          "En «Usuarios de Portería», «Nuevo usuario de Portería» abre este formulario: quién es y su contraseña. Entra con su DNI.",
      },
    },
    {
      id: "credencial",
      titulo: "Dale su contraseña en mano",
      texto:
        "Al terminar aparece una tarjeta con su DNI y su contraseña. Tocá «Imprimir» y dásela: después no se puede volver a ver.",
      pantalla: PantallaCredencial,
    },
    {
      id: "quitar",
      ruta: pestana("usuarios"),
      ancla: "config-usuario-fila",
      titulo: "Si alguien deja la garita",
      texto:
        "En su fila tocás «Quitar acceso» y ya no puede entrar; sus datos quedan. Si se olvida la contraseña, tocás «Nueva contraseña».",
      pantalla: PantallaQuitarAcceso,
      consejo: "Si le quitaste el acceso por error, en su fila aparece «Devolver acceso».",
      sinAncla: {
        texto:
          "Cada usuario tiene su fila con «Nueva contraseña», «Editar» y «Quitar acceso». Antes de quitar, te pregunta:",
      },
    },
  ];
}

/** Capítulo "configuracion" (metadatos en src/lib/tour/indice.ts). */
export const CONFIGURACION: ContenidoCapitulo = {
  portada: PortadaConfiguracion,
  portadaPorRol: (rol) =>
    rol === "admin" ? PortadaConfiguracionAdmin : rol === "guardia" ? PortadaConfiguracionJefe : undefined,
  pasos: (rol: Rol): Paso[] => {
    if (rol === "lider") return pasosLider();
    if (rol === "admin") return pasosAdmin();
    if (rol === "guardia") return pasosJefe();
    return [];
  },
};
