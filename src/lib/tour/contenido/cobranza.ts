import type { Rol } from "@/lib/auth";
import type { ContenidoCapitulo, Paso } from "@/lib/tour/tipos";
import {
  PantallaBeneficio,
  PantallaBuscar,
  PantallaBuscarJefe,
  PantallaBuscarLider,
  PantallaCategoriasJefe,
  PantallaCategoriasLider,
  PantallaCobroAmbulante,
  PantallaCobroRegistrado,
  PantallaCobroRegistradoAmbulante,
  PantallaCobroRegistradoQuintero,
  PantallaCuenta,
  PantallaCuotasQuintero,
  PantallaFila,
  PantallaFilaJefe,
  PantallaFilaLider,
  PantallaFormCobro,
  PantallaMedios,
  PantallaRecibo,
  PantallaTransferencia,
  PortadaCobrar,
} from "@/components/tour/pantallas/cobranza";

// Tour guiado · cobranza: pasos de los capítulos de esta área (docs/GUIA-TOUR.md).
//
// Qué ve cada rol en /cobranza (page.tsx y buscador-clientes.tsx):
//  - Administración: solo puesteros (sin pestañas), busca por N° de puesto, cobra con
//    efectivo, transferencia o cheque, y todo va a su "Caja del día".
//  - Jefe de Portería: quinteros y ambulantes (pestañas), "Hoy cobraste" siempre a la vista,
//    sin cheque; al ambulante le cobra por día (sin precio fijo: escribe cuánto paga por día
//    en cada cobro). Todo va a su "Caja de portería".
//  - Líder: los tres grupos, con cheque; lo que cobra va a la caja de Administración.
// La cuenta del cliente es /cobranza/[id]: se entra por la primera fila de la lista. Con la
// lista vacía (producción arranca así) cada paso de la cuenta se cuenta con su dibujo.

/** La cuenta del cliente: se llega tocando la primera fila de la lista. */
const CUENTA = { ruta: "/cobranza/[clienteId]", entrar: "cobranza-fila" } as const;

function pasoQueEs(rol: Rol): Paso {
  const jefe = rol === "guardia";
  const lider = rol === "lider";
  return {
    id: "que-es",
    ancla: ["cobranza-aviso-caja", "encabezado"],
    titulo: "Acá cobrás",
    texto: jefe
      ? "Desde acá le cobrás a quinteros y ambulantes, y le das su recibo. Todo lo que cobrás queda en tu caja de portería."
      : lider
        ? "Desde acá le cobrás a cualquiera: puesteros, quinteros y ambulantes. Lo que cobrás va a la caja de Administración."
        : "Desde acá le cobrás a cada puestero y le das su recibo. Todo lo que cobrás queda en tu caja del día.",
    consejo: lider
      ? "Si la caja de Administración todavía no se abrió hoy, se abre sola con el primer cobro."
      : "Si todavía no abriste tu caja hoy, no pasa nada: se abre sola con el primer cobro.",
    variantes: {
      "cobranza-aviso-caja": {
        titulo: lider ? "Primero, la caja" : "Primero, tu caja",
        texto: lider
          ? "Este cartel avisa que la caja de Administración de hoy no está abierta, y así no se puede cobrar. El botón del cartel te lleva a Caja para resolverlo. Igual te muestro cómo se cobra."
          : "Este cartel avisa que tu caja de hoy no está abierta, y así no se puede cobrar. El botón del cartel te lleva a Caja para resolverlo. Igual te muestro cómo se cobra.",
        consejo: "Lo que ya cobraste hoy no se pierde: sigue en la caja.",
      },
    },
  };
}

/** Solo el Jefe: "Hoy cobraste" está siempre arriba de su lista. */
const pasoHoyJefe: Paso = {
  id: "hoy",
  ancla: "cobranza-hoy",
  titulo: "Lo que llevás cobrado",
  texto:
    "Acá ves cuánto cobraste hoy y a cuántos ambulantes y quinteros. Es la plata que después le rendís a Administración.",
};

function pasoCategorias(rol: Rol): Paso {
  const jefe = rol === "guardia";
  return {
    id: "categorias",
    ancla: "cobranza-categorias",
    accion: "tocar",
    titulo: jefe ? "¿Quintero o ambulante?" : "Elegí a quién cobrarle",
    texto: jefe
      ? "Arriba elegís qué lista ver: «Quinteros» o «Ambulantes». El número entre paréntesis dice cuántos hay."
      : "Arriba elegís qué lista ver: «Puesteros», «Quinteros» o «Ambulantes». El número entre paréntesis dice cuántos hay.",
    consejo: "Cuando volvés de un cobro, la lista queda en el mismo grupo.",
    sinAncla: {
      texto: jefe
        ? "Cuando haya quinteros y ambulantes cargados, arriba de la lista elegís cuál de los dos ver. Así se ve:"
        : "Cuando haya clientes cargados, arriba de la lista elegís qué grupo ver. Así se ve:",
      pantalla: jefe ? PantallaCategoriasJefe : PantallaCategoriasLider,
    },
  };
}

function pasoBuscar(rol: Rol): Paso {
  const jefe = rol === "guardia";
  const pantalla = jefe ? PantallaBuscarJefe : rol === "lider" ? PantallaBuscarLider : PantallaBuscar;
  return {
    id: "buscar",
    ancla: "cobranza-buscador",
    // Buscar no guarda nada: puede probar a escribir (el motor no avanza al tocar un campo).
    accion: "tocar",
    titulo: "Buscá al cliente",
    texto: jefe
      ? "Escribí el nombre, el apodo o el número de carpeta: la lista se achica mientras escribís. Probalo ahora si querés, no se guarda nada."
      : "Escribí el nombre, el apodo o el número de puesto: la lista se achica mientras escribís. Probalo ahora si querés, no se guarda nada.",
    consejo: jefe
      ? "Si es un ambulante nuevo, tocá «Nuevo ambulante», arriba: lo cargás y le cobrás enseguida."
      : "El número de la izquierda de cada fila es el de su carpeta: también sirve para buscar.",
    sinAncla: {
      texto: jefe
        ? "Cuando haya quinteros y ambulantes cargados, arriba de la lista está el buscador. Escribís el nombre, el apodo o el número de carpeta y la lista se achica."
        : "Cuando haya clientes cargados, arriba de la lista está el buscador. Escribís el nombre, el apodo o el número de puesto y la lista se achica.",
      pantalla,
    },
  };
}

function pasoFila(rol: Rol): Paso {
  const jefe = rol === "guardia";
  const lider = rol === "lider";
  const pantalla = jefe ? PantallaFilaJefe : lider ? PantallaFilaLider : PantallaFila;
  return {
    id: "fila",
    ancla: "cobranza-fila",
    accion: "tocar",
    titulo: jefe ? "Tocá al que te paga" : "Tocá al cliente",
    texto: jefe
      ? "Del quintero ves cuántas cuotas del mes pagó y cuánto le falta. Del ambulante, si hoy ya pagó. Tocá la fila para abrir su cuenta."
      : lider
        ? "Cada fila dice cuánto debe, con un sello: verde al día, ámbar en término, rojo vencido. Del ambulante, si hoy ya pagó. Tocá la fila para abrir su cuenta."
        : "Cada fila dice cuánto debe, con un sello: verde al día, ámbar en término, rojo vencido. Tocá la fila para abrir su cuenta.",
    consejo: jefe
      ? "Arriba aparecen los que tienen algo para pagar: los quinteros que deben y los ambulantes que hoy no pagaron."
      : "Arriba de todo aparecen los que más deben.",
    sinAncla: {
      texto: jefe
        ? "Cuando haya quinteros y ambulantes, cada fila dice lo que importa para cobrarle: al quintero, cuánto le falta del mes; al ambulante, si hoy pagó. Tocás la fila y se abre su cuenta. Así se ve:"
        : "Cuando haya clientes, cada fila dice cuánto debe con su sello: verde al día, ámbar en término, rojo vencido. Tocás la fila y se abre su cuenta. Así se ve:",
      pantalla,
    },
  };
}

const pasoDeuda: Paso = {
  id: "deuda",
  ...CUENTA,
  ancla: "cobranza-deuda",
  titulo: "Lo que debe hoy",
  texto:
    "Arriba, el total que debe hoy. Abajo, cada cosa que debe con su mes. Lo vencido lleva el sello rojo.",
  consejo: "Si tiene saldo a favor, se descuenta solo: abajo dice cuánto tiene que pagar hoy.",
  sinAncla: {
    texto:
      "Al abrir la cuenta de un cliente, arriba ves el total que debe hoy y, abajo, cada cosa que debe con su mes. Lo vencido lleva el sello rojo. Así se ve:",
    pantalla: PantallaCuenta,
  },
};

const pasoBeneficio: Paso = {
  id: "beneficio",
  ...CUENTA,
  ancla: ["cobranza-beneficio", "cobranza-vencida"],
  titulo: "Pagar a tiempo conviene",
  texto:
    "Este cartel dice hasta qué día mantiene el beneficio por pago en término y cuánto se ahorra. Si se pone ámbar, vence en pocos días. Contáselo al cliente: le conviene pagar antes.",
  consejo:
    "El sistema ya hace la cuenta: con el 15 %, una expensa de $ 115.000 pagada a tiempo queda en $ 100.000.",
  variantes: {
    "cobranza-vencida": {
      titulo: "Ya perdió el beneficio",
      texto:
        "Este cartel rojo avisa que tiene deuda vencida: perdió el beneficio por pago en término y lo vencido se paga completo.",
    },
  },
  sinAncla: {
    texto:
      "Cuando un cliente debe, arriba aparece un cartel. En verde, hasta qué día mantiene el beneficio por pago en término y cuánto se ahorra; se pone ámbar cuando faltan pocos días. En rojo, que ya lo perdió porque se le venció algo.",
    pantalla: PantallaBeneficio,
  },
};

/** Cuando no hay nada que cobrar: al día, o el saldo a favor ya cubre todo (form-cobro.tsx). */
const SIN_NADA_QUE_COBRAR: NonNullable<Paso["variantes"]> = {
  "cobranza-al-dia": {
    titulo: "Está al día",
    texto:
      "No tiene nada para pagar hoy. Si igual quiere dejarte plata, tocás «Quiere adelantar plata: registrar un pago a cuenta» y lo que te dé queda como saldo a favor.",
    consejo: "El saldo a favor se descuenta solo de lo próximo que deba.",
  },
  "cobranza-saldo-cubre": {
    titulo: "Su saldo a favor alcanza",
    texto:
      "Lo que tiene a favor cubre todo lo que debe: no hace falta cobrarle nada. Tocás «Aplicar los $ … a favor y dejarlo al día» y queda al día.",
    consejo: "No entra plata a la caja: se usa lo que ya había pagado de más.",
  },
};

/** El monto (Administración y Líder): cambia si paga en cuotas, si es ambulante o si está al día. */
function pasoMonto(rol: Rol): Paso {
  const lider = rol === "lider";
  return {
    id: "monto",
    ...CUENTA,
    ancla: lider
      ? [
          "cobranza-plan",
          "cobranza-monto",
          "cobranza-precio-dia",
          "cobranza-dias",
          "cobranza-al-dia",
          "cobranza-saldo-cubre",
        ]
      : ["cobranza-plan", "cobranza-monto", "cobranza-al-dia", "cobranza-saldo-cubre"],
    titulo: "¿Cuánto te pagan?",
    texto:
      "Acá escribís lo que te da. Si paga todo, tocás «Cobrar todo» y se completa solo. Abajo te dice cuánto le queda debiendo.",
    consejo: "Puede pagar una parte: lo que falta queda en su cuenta para la próxima.",
    variantes: {
      "cobranza-plan": {
        titulo: "Las cuotas del mes",
        texto:
          "Este cliente paga el mes en cuotas: acá ves cuántas cubrió y cuánto le falta. «Cobrar la cuota» te completa el monto; si te da otra cifra, la escribís abajo, en «¿Cuánto te pagan?».",
        consejo: "Si debe meses anteriores, la plata va primero a lo más viejo.",
      },
      "cobranza-precio-dia": {
        titulo: "¿Cuánto paga por día?",
        texto:
          "Al ambulante se le cobra por día y no hay un precio fijo: primero escribís cuánto te paga por día. Después elegís cuántos días («Solo hoy», «2 días», «3 días» o «Semana (7)»). Abajo, en verde, los días que ya pagó.",
        consejo:
          "El total se calcula solo: los días por el precio que escribiste. Si paga lo mismo que la otra vez, tocá «Como la última vez».",
      },
      "cobranza-dias": {
        titulo: "¿Cuántos días paga?",
        texto:
          "Al ambulante se le cobra por día. Arriba escribís cuánto te paga por día y acá elegís «Solo hoy», «2 días», «3 días» o «Semana (7)», o sumás y restás con los botones redondos. Abajo, en verde, los días que ya pagó.",
        consejo: "El total se calcula solo: los días por el precio que escribiste.",
      },
      ...SIN_NADA_QUE_COBRAR,
    },
    sinAncla: {
      texto:
        "Debajo de lo que debe, anotás el cobro: escribís lo que te da o tocás «Cobrar todo». Abajo te dice cuánto le queda debiendo. Así se ve:",
      pantalla: PantallaFormCobro,
    },
  };
}

/** Jefe: primero el quintero (cuotas del mes); el ambulante va en el paso que sigue. */
const pasoCuotasJefe: Paso = {
  id: "cuotas",
  ...CUENTA,
  ancla: ["cobranza-plan", "cobranza-monto", "cobranza-al-dia", "cobranza-saldo-cubre"],
  titulo: "Las cuotas del quintero",
  texto:
    "Si el quintero paga el mes en cuotas, acá ves cuántas cubrió y cuánto le falta. «Cobrar la cuota» te completa el monto solo; si te da otra cifra, la escribís abajo.",
  consejo: "Si debe meses anteriores, la plata va primero a lo más viejo: «Cuota + lo atrasado» cobra todo junto.",
  variantes: {
    "cobranza-monto": {
      titulo: "¿Cuánto te pagan?",
      texto:
        "Acá escribís lo que te da. Si paga todo, tocás «Cobrar todo» y se completa solo. Abajo te dice cuánto le queda debiendo.",
      consejo: "Puede pagar una parte: lo que falta queda en su cuenta para la próxima.",
    },
    ...SIN_NADA_QUE_COBRAR,
  },
  sinAncla: {
    texto:
      "Al abrir un quintero ves lo que debe y, si paga el mes en cuotas, cuántas cubrió. «Cobrar la cuota» te completa el monto solo. Así se ve:",
    pantalla: PantallaCuotasQuintero,
  },
};

/** Jefe: el ambulante no tiene precio fijo; primero cuánto paga por día, después los días. */
const pasoAmbulanteJefe: Paso = {
  id: "ambulante",
  ...CUENTA,
  ancla: ["cobranza-precio-dia", "cobranza-dias"],
  titulo: "Al ambulante, ¿cuánto por día?",
  texto:
    "Al ambulante se le cobra por día y no hay un precio fijo: cada vez escribís cuánto te paga por día. El campo arranca vacío.",
  consejo: "Si paga lo mismo que la otra vez, tocá «Como la última vez» y se completa solo.",
  variantes: {
    "cobranza-dias": {
      titulo: "Al ambulante, por día",
      texto:
        "Al ambulante se le cobra por día. Arriba escribís cuánto te paga por día y acá elegís «Solo hoy», «2 días», «3 días» o «Semana (7)», o sumás y restás con los botones redondos.",
      consejo: "El total se calcula solo: los días por el precio que escribiste.",
    },
  },
  sinAncla: {
    texto:
      "Al ambulante se le cobra por día y no hay un precio fijo: escribís cuánto te paga por día, elegís cuántos días y el total se calcula solo. Los días en verde ya están pagos. Así se ve:",
    pantalla: PantallaCobroAmbulante,
  },
};

/** Jefe: los días del ambulante (si no hay un ambulante en pantalla, ya lo mostró el dibujo). */
const pasoDiasAmbulanteJefe: Paso = {
  id: "ambulante-dias",
  ...CUENTA,
  ancla: "cobranza-dias",
  titulo: "¿Cuántos días paga?",
  texto:
    "Elegís «Solo hoy», «2 días», «3 días» o «Semana (7)», o sumás y restás con los botones redondos. Abajo, en verde, los días que ya pagó.",
  consejo: "El total se calcula solo: los días por el precio que escribiste. Por ejemplo, 3 días × $ 8.000 = $ 24.000.",
  opcional: true,
};

function pasoMedio(rol: Rol): Paso {
  const jefe = rol === "guardia";
  return {
    id: "medio",
    ...CUENTA,
    ancla: "cobranza-medio",
    titulo: "¿Cómo te paga?",
    texto: jefe
      ? "Elegís «Efectivo» o «Transferencia». Con transferencia anotás a nombre de quién está la cuenta y, si querés, le sacás foto al comprobante."
      : "Elegís «Efectivo», «Transferencia» o «Cheque». Con transferencia anotás a nombre de quién está la cuenta y, si querés, le sacás foto al comprobante. Con cheque, el número, el CUIT y desde cuándo se puede cobrar.",
    pantalla: jefe ? PantallaTransferencia : PantallaMedios,
    consejo:
      "Si paga una parte en efectivo y otra por transferencia, tocá «Pagar una parte con otro medio»: sale un solo recibo.",
    sinAncla: {
      texto: jefe
        ? "Debajo del monto elegís «Efectivo» o «Transferencia». Con transferencia anotás a nombre de quién está la cuenta y la foto del comprobante. Así se ve:"
        : "Debajo del monto elegís cómo te paga. Con transferencia anotás a nombre de quién está la cuenta y la foto del comprobante; con cheque, sus datos. Así se ve:",
    },
  };
}

function pasoRegistrar(rol: Rol): Paso {
  const admin = rol === "admin";
  const jefe = rol === "guardia";
  // Con el monto vacío (como está durante la guía) el botón dice «Registrar cobro» y está
  // apagado: el texto cuenta cómo se ve cuando ya se escribió cuánto paga.
  const ejemplo = jefe ? "$ 75.000" : "$ 700.000";
  return {
    id: "registrar",
    ...CUENTA,
    // El del ambulante lleva las dos anclas: si se ve, se cuenta el cobro por días.
    ancla: ["cobranza-cobrar-dias", "cobranza-registrar"],
    titulo: "Registrá el cobro",
    texto: admin
      ? `Cuando escribiste cuánto te paga, este botón lo dice: «Registrar cobro de ${ejemplo}». Al tocarlo, la plata se reparte sola en lo que debe, empezando por lo más viejo, y aparece el recibo.`
      : `Cuando escribiste cuánto te paga, este botón lo dice: «Registrar cobro de ${ejemplo}». Al tocarlo, la plata se reparte sola, empezando por lo más viejo. Después tocás «Ver recibo» y se lo imprimís.`,
    pantalla: jefe ? PantallaCobroRegistradoQuintero : PantallaCobroRegistrado,
    consejo: admin
      ? "Si te paga de más, antes te pregunta si lo que sobra queda como saldo a favor."
      : jefe
        ? "Si te equivocaste, se anula desde «Caja de portería» mientras no la hayas rendido, y el cliente vuelve a deber ese monto."
        : "Queda en la caja de Administración de hoy. Si hubo un error, se anula desde «Caja del día» con «Anular» y un motivo.",
    variantes: {
      "cobranza-cobrar-dias": {
        texto:
          "Con el precio por día escrito, el botón dice cuántos días y cuánto: «Cobrar 3 días — $ 24.000». Al tocarlo, esos días quedan pagos y sale el recibo. Después tocás «Ver recibo» y se lo imprimís.",
        consejo: "Si te olvidaste de escribir cuánto paga por día, el botón te lo marca y te lleva al campo.",
        pantalla: PantallaCobroRegistradoAmbulante,
      },
    },
    sinAncla: {
      texto: jefe
        ? "Abajo de todo está el botón grande que dice cuánto vas a cobrar. Al tocarlo, la plata se reparte sola, empezando por lo más viejo, y sale el recibo. Queda así:"
        : "Abajo de todo está el botón «Registrar cobro de…», que dice cuánto vas a cobrar. Al tocarlo, la plata se reparte sola, empezando por lo más viejo. Queda así:",
    },
  };
}

/** Solo Administración: el recibo impreso y qué pasa con la plata después. */
const pasoReciboAdmin: Paso = {
  id: "recibo",
  ...CUENTA,
  titulo: "El recibo y tu caja",
  texto:
    "Tocá «Ver recibo» y después «Imprimir / Guardar PDF» para dárselo. Si es socio, también lo ve en su portal. El cobro queda en tu caja del día, y Tesorería la revisa cuando la cerrás.",
  pantalla: PantallaRecibo,
  consejo:
    "Si te equivocaste, se puede anular desde «Caja del día» mientras no la cierres: tocás «Anular» en ese recibo, escribís el motivo y el cliente vuelve a deber ese monto.",
};

/** Capítulo "cobrar" (metadatos en src/lib/tour/indice.ts). */
export const COBRAR: ContenidoCapitulo = {
  portada: PortadaCobrar,
  pasos: (rol) => {
    if (rol === "guardia") {
      return [
        pasoQueEs(rol),
        pasoHoyJefe,
        pasoCategorias(rol),
        pasoBuscar(rol),
        pasoFila(rol),
        pasoCuotasJefe,
        pasoAmbulanteJefe,
        pasoDiasAmbulanteJefe,
        pasoMedio(rol),
        pasoRegistrar(rol),
      ];
    }
    if (rol === "lider") {
      return [
        pasoQueEs(rol),
        pasoCategorias(rol),
        pasoBuscar(rol),
        pasoFila(rol),
        pasoDeuda,
        pasoBeneficio,
        pasoMonto(rol),
        pasoMedio(rol),
        pasoRegistrar(rol),
      ];
    }
    if (rol === "admin") {
      return [
        pasoQueEs(rol),
        pasoBuscar(rol),
        pasoFila(rol),
        pasoDeuda,
        pasoBeneficio,
        pasoMonto(rol),
        pasoMedio(rol),
        pasoRegistrar(rol),
        pasoReciboAdmin,
      ];
    }
    return [];
  },
};
