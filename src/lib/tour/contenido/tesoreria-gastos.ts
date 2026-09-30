import type { Rol } from "@/lib/auth";
import { navParaRol } from "@/lib/navegacion";
import type { ContenidoCapitulo, Paso } from "@/lib/tour/tipos";
import {
  PantallaCajasValidar,
  PantallaCaminoGasto,
  PantallaCargarGasto,
  PantallaConciliar,
  PantallaFacturaGasto,
  PantallaFacturas,
  PantallaListaGastos,
  PantallaLoQueVence,
  PantallaMovimientoBanco,
  PantallaPagarCaja,
  PantallaPagarTesoreria,
  PantallaPlataHoy,
  PantallaSaldosIniciales,
  PantallaTraerFijos,
  PortadaGastos,
  PortadaTesoreria,
} from "@/components/tour/pantallas/tesoreria-gastos";

// Tour guiado · tesoreria-gastos: pasos de los capítulos de esta área (docs/GUIA-TOUR.md).
//
// Tesorería (/tesoreria) tiene cuatro pestañas por link (?tab=). Cada paso lleva la ruta
// de su pestaña con la query: los de «Hoy» van en "/tesoreria?tab=hoy" (la pestaña «Hoy»
// es "/tesoreria" sin query, y la página entiende tab=hoy) para que, al volver con
// «Anterior» desde «Conciliar» o al empezar desde otra pestaña, el tour abra «Hoy». Antes
// de los pasos de «Conciliar» va un paso "tocá «Conciliar»"; si la persona sigue con
// «Siguiente» sin tocarla, el tour abre la pestaña solo. La producción arranca sin saldos
// iniciales: la pestaña «Hoy» muestra primero el formulario de saldos (ancla
// tesoreria-saldos-aviso).
//
// Gastos (/gastos) filtra por link (?tipo=fijo, ?periodo=…), pero ningún paso depende
// del filtro: el paso de los filtros solo los muestra (tocarlos dejaría la lista filtrada
// al terminar la guía).

/** La pestaña «Hoy» de Tesorería (su link no lleva query; la página acepta tab=hoy). */
const TESORERIA_HOY = "/tesoreria?tab=hoy";
/** La pestaña «Conciliar» de Tesorería. */
const TESORERIA_CONCILIAR = "/tesoreria?tab=conciliar";

/** «Caja del día» como lo ve ese rol en su menú («Cajas del día» para Tesorería). */
function nombreCaja(rol: Rol): string {
  return navParaRol(rol).find((i) => i.href === "/caja")?.label ?? "Caja del día";
}

/** Capítulo "tesoreria" (metadatos en src/lib/tour/indice.ts). Roles: tesoreria, lider. */
export const TESORERIA: ContenidoCapitulo = {
  portada: PortadaTesoreria,
  pasos: (rol: Rol): Paso[] => {
    const lider = rol === "lider";
    return [
      {
        id: "que-es",
        ruta: TESORERIA_HOY,
        ancla: "encabezado",
        titulo: "La plata de la cooperativa",
        texto: lider
          ? "Acá está la plata real de la cooperativa: efectivo, banco, dólares y cheques. Es el trabajo diario de Tesorería; vos ves lo mismo y podés hacer todo."
          : "Acá controlás la plata real de la cooperativa: efectivo, banco, dólares y cheques. Los cobros y los gastos llegan solos; vos los cruzás con el banco.",
      },
      {
        id: "pestanas",
        ruta: TESORERIA_HOY,
        ancla: "tesoreria-pestanas",
        titulo: "Cuatro pestañas",
        texto:
          "«Hoy» es lo del día. «Movimientos» es lo que se anotó en el mes: depósitos, extracciones, comisiones. En «Conciliar» revisás transferencias y facturas, y en «Saldos iniciales», con cuánta plata se arrancó.",
        consejo: "Un número ámbar al lado de una pestaña te dice cuántas cosas te esperan ahí.",
      },
      {
        id: "plata",
        ruta: TESORERIA_HOY,
        ancla: ["tesoreria-plata-total", "tesoreria-saldos-aviso"],
        titulo: "Cuánta plata hay hoy",
        texto:
          "Este es el total en pesos: efectivo, banco y cheques juntos. Justo abajo está cada cuenta por separado: efectivo y banco, los dólares aparte y los cheques por cobrar.",
        consejo: "Si una cuenta dice «Falta cargar el saldo inicial», su número todavía no es real.",
        variantes: {
          "tesoreria-saldos-aviso": {
            titulo: "Primero, con cuánto se arranca",
            texto:
              "Antes de empezar, cargá cuánta plata había un día: el efectivo y el banco, en pesos y en dólares. Desde ese día el sistema suma y resta solo.",
            pantalla: PantallaSaldosIniciales,
            consejo:
              "Son cuatro cuentas y cada una se carga una sola vez. Si no tiene plata, poné cero. Las que falten las seguís en «Saldos iniciales».",
          },
        },
        sinAncla: {
          texto:
            "En la pestaña «Hoy» ves cuánta plata tiene la cooperativa: el total en pesos y cada cuenta por separado. Así se ve:",
          pantalla: PantallaPlataHoy,
        },
      },
      {
        id: "registrar",
        ruta: TESORERIA_HOY,
        ancla: "tesoreria-movimiento-botones",
        titulo: "Anotá lo que pasa en el banco",
        texto:
          "Cuando depositás, sacás plata o el banco te descuenta algo, tocá lo que pasó: por ejemplo «Deposité efectivo en el banco» o «Comisión o impuesto». Ponés el monto y el día, y antes de guardar ves cómo quedan las cuentas.",
        pantalla: PantallaMovimientoBanco,
        consejo: lider
          ? "Un movimiento anulado queda tachado con nombre y motivo, y lo ves en tu Inicio, en «Correcciones de los últimos 7 días»."
          : "Si anotaste algo mal, en «Movimientos» tocás «Anular» y elegís por qué: queda tachado, no se borra.",
        sinAncla: {
          texto:
            "Con los botones de «Registrar un movimiento» anotás depósitos, extracciones, comisiones e impuestos del banco. Están en «Movimientos» y, con los saldos iniciales cargados, también en «Hoy». Así se ve la ventana:",
          pantalla: PantallaMovimientoBanco,
        },
      },
      {
        id: "cajas",
        ruta: TESORERIA_HOY,
        ancla: ["tesoreria-caja-fila", "tesoreria-cajas"],
        titulo: "Las cajas para contar",
        texto: lider
          ? "Cada caja que se cierra aparece acá, con cuánto efectivo tiene que haber. Tesorería la cuenta y le da el OK final con «Contar y validar»; vos también podés."
          : "Cada caja que se cierra aparece acá, con cuánto efectivo tiene que haber. «Contar y validar» te lleva a esa caja: contás los billetes y le das el OK final.",
        pantalla: PantallaCajasValidar,
        consejo: `Cómo se cuentan los billetes y se valida, paso a paso, te lo muestro en la guía de «${nombreCaja(rol)}».`,
        variantes: {
          "tesoreria-cajas": {
            texto:
              "Ahora no hay ninguna para validar. Cuando Administración cierre su caja, aparece acá con cuánto efectivo tiene que haber y el botón «Contar y validar».",
          },
        },
        sinAncla: {
          texto:
            "Cuando Administración cierre su caja, aparece en «Hoy» con cuánto efectivo tiene que haber. «Contar y validar» te lleva a esa caja para contar los billetes y darle el OK final.",
          pantalla: PantallaCajasValidar,
        },
      },
      {
        id: "vence",
        ruta: TESORERIA_HOY,
        ancla: ["tesoreria-gasto", "tesoreria-gastos-pagar"],
        titulo: "Lo que no puede esperar",
        texto: lider
          ? "Acá aparecen los gastos vencidos o que vencen en los próximos 7 días, cada uno con su «Pagar». Al tocarlo elegís de dónde sale la plata: «Caja del día» o «Tesorería»."
          : "Acá aparecen los gastos vencidos o que vencen en los próximos 7 días, cada uno con su «Pagar». Al tocarlo ya viene elegido «Tesorería»: elegís banco o efectivo y el día.",
        pantalla: PantallaLoQueVence,
        consejo: "Justo arriba, «Cheques para depositar» te avisa los cheques que ya llegaron a su fecha.",
        variantes: {
          "tesoreria-gastos-pagar": {
            texto:
              "Ahora no hay nada vencido ni por vencer. Cuando a un gasto le falten 7 días o menos, aparece acá con su «Pagar».",
          },
        },
        sinAncla: {
          texto:
            "Al final de «Hoy» están los cheques listos para depositar y los gastos que vencen en 7 días, cada uno con su «Pagar». Así se ve:",
          pantalla: PantallaLoQueVence,
        },
      },
      {
        id: "ir-conciliar",
        ruta: TESORERIA_HOY,
        ancla: "tesoreria-pestana-conciliar",
        accion: "tocar",
        titulo: "Tocá «Conciliar»",
        texto:
          "Ahí cruzás con el resumen del banco lo que entró por transferencia, y revisás las facturas de los gastos pagados.",
      },
      {
        id: "transferencias",
        ruta: TESORERIA_CONCILIAR,
        ancla: ["tesoreria-transferencia", "tesoreria-transferencias"],
        titulo: "Una por una, contra el banco",
        texto:
          "Tocá «Ver comprobante» y buscá esa plata en el resumen del banco. Si está, tocá «Conciliar». Si te equivocás, en «Últimas conciliadas» está «Deshacer».",
        pantalla: PantallaConciliar,
        consejo: "Más abajo hacés lo mismo con el bono camioneros que Portería cobró por transferencia.",
        variantes: {
          "tesoreria-transferencias": {
            texto:
              "Ahora no hay ninguna. Cada cobro por transferencia aparece acá con la foto del comprobante, hasta que lo encuentres en el banco y toques «Conciliar».",
          },
        },
        sinAncla: {
          texto:
            "En «Conciliar», cada cobro por transferencia aparece con la foto del comprobante. Lo buscás en el resumen del banco y, si está, tocás «Conciliar». Así se ve:",
          pantalla: PantallaConciliar,
        },
      },
      {
        id: "facturas",
        ruta: TESORERIA_CONCILIAR,
        ancla: ["tesoreria-factura", "tesoreria-sin-factura", "tesoreria-facturas"],
        titulo: "Las facturas de los gastos",
        texto:
          "Cada gasto pagado con su factura llega acá. Tocá «Ver factura», fijate que coincida y tocá «Validar comprobante»: en Gastos, su sello pasa a «Comprobante OK».",
        pantalla: PantallaFacturas,
        consejo: "Si a un gasto pagado le falta la factura, aparece en un recuadro ámbar: pedísela a quien lo pagó.",
        variantes: {
          "tesoreria-sin-factura": {
            texto:
              "Estos gastos ya se pagaron, pero les falta la factura. Se adjunta desde Gastos y después aparece acá para que toques «Validar comprobante».",
            consejo: "Pedile la factura a quien pagó el gasto: Administración o Tesorería.",
          },
          "tesoreria-facturas": {
            texto:
              "Ahora no hay ninguna. Cuando alguien paga un gasto y adjunta la factura, aparece acá para que la revises y toques «Validar comprobante».",
          },
        },
        sinAncla: {
          texto:
            "En «Conciliar» también llegan las facturas de los gastos pagados. Tocás «Ver factura», te fijás que coincida y tocás «Validar comprobante». Así se ve:",
          pantalla: PantallaFacturas,
        },
      },
    ];
  },
};

/** Capítulo "gastos" (metadatos en src/lib/tour/indice.ts). Roles: admin, tesoreria, lider. */
export const GASTOS: ContenidoCapitulo = {
  portada: PortadaGastos,
  pasos: (rol: Rol): Paso[] => {
    const tesoreria = rol === "tesoreria";
    const lider = rol === "lider";
    return [
      {
        id: "que-es",
        ancla: "encabezado",
        titulo: "Lo que paga el mercado",
        texto: tesoreria
          ? "Acá están todos los gastos del mercado, mes a mes. Los grandes los pagás vos, desde el banco o el efectivo de Tesorería; los chicos los paga Administración con la caja del día."
          : lider
            ? "Acá están todos los gastos del mercado, mes a mes. Los chicos los paga Administración con la caja del día y los grandes, Tesorería; vos podés cargar, pagar y corregir cualquiera."
            : "Acá anotás lo que paga el mercado: la luz, la limpieza, un arreglo. Los gastos chicos los pagás vos con la plata de la caja; los grandes los paga Tesorería.",
      },
      {
        id: "cargar",
        ancla: "gastos-cargar",
        titulo: "Tocá «Cargar gasto»",
        texto:
          "Se abre una ventana: buscá el rubro (luz, limpieza, seguridad…), poné el monto y decí si se repite todos los meses. El vencimiento, la descripción y la factura son opcionales.",
        pantalla: PantallaCargarGasto,
        consejo: tesoreria
          ? "Si ya lo pagaste, prendé «¿Ya lo pagaste?»: ya viene elegido «Tesorería». Queda cargado y pagado de una vez."
          : lider
            ? "Si ya se pagó, prendé «¿Ya lo pagaste?» y elegí de dónde salió la plata. Queda cargado y pagado de una vez."
            : "Si ya lo pagaste con plata del cajón, prendé «¿Ya lo pagaste?»: ya viene elegida «Caja del día». Queda cargado y pagado de una vez.",
      },
      {
        id: "resumen",
        ancla: "gastos-resumen",
        titulo: "El mes y lo que falta pagar",
        texto:
          "Con las flechas pasás de un mes a otro. Al lado ves cuánto queda por pagar (en rojo), cuánto ya se pagó (en verde) y lo que vence en los próximos 7 días.",
        consejo: "En el mes de hoy, justo debajo aparecen también los gastos de meses anteriores que quedaron sin pagar.",
      },
      {
        id: "fijos",
        ancla: ["gastos-traer-fijos", "gastos-fijos-lista"],
        titulo: "Los fijos, con un toque",
        texto:
          "Son los gastos fijos del mes pasado que todavía no trajiste. Tocá el botón azul que empieza con «Traer». Se abre la lista: cambiá los montos que subieron o bajaron y tocá el botón de abajo, que empieza con «Cargar».",
        pantalla: PantallaTraerFijos,
        consejo: "Así quedan todos cargados de una vez, sin escribirlos de nuevo.",
        variantes: {
          "gastos-fijos-lista": {
            texto:
              "Son los gastos fijos del mes pasado, listos para traer. Cambiá los montos que subieron o bajaron y destildá los que no van. Después tocá el botón de abajo, que empieza con «Cargar».",
          },
        },
        sinAncla: {
          texto:
            "Los gastos que cargaste con «Sí, es fijo» (el alquiler, internet) no se escriben de nuevo cada mes. Al empezar el mes aparece este aviso: revisás los montos y los traés todos juntos.",
          pantalla: PantallaTraerFijos,
        },
      },
      {
        id: "pagar",
        ancla: ["gastos-pagar", "gastos-fila"],
        titulo: "Tocá «Pagar»",
        texto: tesoreria
          ? "Cuando pagás un gasto, tocá «Pagar»: ya viene elegido «Tesorería». Elegí banco o efectivo y el día en que se pagó."
          : lider
            ? "Cuando se paga un gasto, tocá «Pagar» y elegí de dónde sale la plata: «Caja del día» (el efectivo del cajón de Administración) o «Tesorería» (efectivo o banco)."
            : "Cuando sacás plata del cajón para un gasto, tocá «Pagar». Ya viene elegida «Caja del día», y la ventana te muestra cuánto efectivo le queda a tu caja.",
        pantalla: tesoreria ? PantallaPagarTesoreria : PantallaPagarCaja,
        consejo:
          tesoreria || lider
            ? "Si te equivocás, en «Pagados» tocás «Deshacer pago» y contás por qué. Si se pagó con un cheque, se deshace desde «Cheques»."
            : "Si te equivocás, en «Pagados» tocás «Deshacer pago» y contás por qué: vuelve a «Por pagar» y la caja se corrige sola.",
        variantes: {
          "gastos-fila": {
            texto:
              "Acá no queda nada sin pagar. Cuando un gasto está sin pagar, tiene su botón «Pagar»; al tocarlo se abre esta ventana:",
          },
        },
        sinAncla: {
          texto:
            "Cada gasto sin pagar aparece en «Por pagar», con su botón «Pagar». Al tocarlo se abre esta ventana:",
          pantalla: tesoreria ? PantallaPagarTesoreria : PantallaPagarCaja,
        },
      },
      {
        id: "factura",
        ancla: ["gastos-adjuntar-factura", "gastos-comprobante"],
        titulo: "Guardá la factura",
        texto:
          "Tocá «Adjuntar factura», elegí la foto o el PDF y tocá «Guardar factura». El sello te dice cómo está: «Sin factura», «Sin validar» o «Comprobante OK».",
        pantalla: PantallaFacturaGasto,
        consejo: tesoreria
          ? "Las facturas las validás vos, en «Tesorería», pestaña «Conciliar»."
          : "Después Tesorería la revisa y la valida: ahí el sello pasa a «Comprobante OK».",
        variantes: {
          "gastos-comprobante": {
            texto:
              "El sello de cada gasto te dice cómo está su factura: «Sin factura», «Sin validar» o «Comprobante OK». Con «Ver factura» la abrís.",
          },
        },
        sinAncla: {
          texto:
            "Cada gasto pagado necesita su factura: tocás «Adjuntar factura», elegís la foto o el PDF y tocás «Guardar factura». El sello te dice cómo está:",
          pantalla: PantallaFacturaGasto,
        },
      },
      {
        id: "filtros",
        ancla: "gastos-filtro",
        titulo: "Fijos, variables y pagados",
        texto:
          "Con «Todos», «Fijos» y «Variables» mirás solo una parte de la lista. Lo que ya se pagó queda más abajo, en «Pagados»: mientras quede algo por pagar, está cerrado para que no moleste.",
        pantalla: PantallaListaGastos,
        sinAncla: {
          texto:
            "Cuando el mes tenga gastos, arriba de la lista aparecen «Todos», «Fijos» y «Variables» para mirar solo una parte. Lo pagado queda abajo, en «Pagados».",
          pantalla: PantallaListaGastos,
        },
      },
      {
        id: "despues",
        titulo: "Y después, ¿qué pasa?",
        texto: tesoreria
          ? "Lo que pagás desde Tesorería baja del banco o del efectivo, y lo ves en «Tesorería». Lo que paga Administración con la caja entra en su arqueo, y lo controlás al validar esa caja."
          : lider
            ? "Tesorería revisa cada factura y le da el OK. Si alguien deshace un pago, lo ves con nombre y motivo en tu Inicio, en «Correcciones de los últimos 7 días». Los gastos del mes, por rubro, están en «Reportes»."
            : "Lo que pagás con la caja ya se descuenta del efectivo que tiene que haber al cerrarla. Tesorería revisa cada factura y le da el OK.",
        pantalla: PantallaCaminoGasto,
      },
    ];
  },
};
