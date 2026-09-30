import type { Rol } from "@/lib/auth";
import { MAX_PLANO, navParaRol } from "@/lib/navegacion";
import type { ContenidoCapitulo, Paso } from "@/lib/tour/tipos";
import { PantallaComoFunciona, PortadaComoMoverte } from "@/components/tour/pantallas/general";

// Tour guiado · general: el primer capítulo de cada recorrido ("Cómo moverte").

const pasoGuia = (socio: boolean): Paso => ({
  id: "como-funciona",
  titulo: "Así funciona esta guía",
  texto: socio
    ? "Te muestro tu portal de verdad y te señalo cada parte con una mano. Leés y tocás «Siguiente». Mientras mirás no se guarda ni se cambia nada."
    : "Te muestro el sistema de verdad y te señalo cada parte con una mano. Leés y tocás «Siguiente». Mientras mirás no se guarda, no se cobra y no se borra nada.",
  pantalla: PantallaComoFunciona,
  consejo: "Para cortar, tocá la X de arriba. Después lo retomás desde donde quedaste.",
});

const pasoAyuda: Paso = {
  id: "ayuda",
  ancla: "ayuda",
  titulo: "Si te perdés, tocá acá",
  texto:
    "«Ayuda» te explica la pantalla en la que estás, paso a paso. Desde ahí también volvés a ver este recorrido cuando quieras.",
};

function pasoSalir(socio: boolean): Paso {
  return {
    id: "salir",
    ancla: socio ? "salir" : ["salir", "nav:menu"],
    titulo: "Para salir",
    texto: "Cuando termines, tocá «Salir». Así nadie usa el sistema con tu nombre.",
    variantes: {
      "nav:menu": {
        texto: "Cuando termines, abrí «Menú» y tocá «Salir» (está debajo de tu nombre). Así nadie usa el sistema con tu nombre.",
      },
    },
  };
}

export const BIENVENIDA: ContenidoCapitulo = {
  portada: PortadaComoMoverte,
  pasos: (rol: Rol) => {
    const agrupado = navParaRol(rol).length > MAX_PLANO;
    return [
      pasoGuia(false),
      {
        id: "menu",
        ancla: ["menu-lateral", "nav:barra"],
        titulo: "Tus secciones",
        texto: "Acá están tus secciones. Tocás una y vas directo.",
        consejo: "Un numerito de color sobre una sección te dice cuántas cosas te esperan ahí.",
        variantes: {
          "menu-lateral": {
            texto: agrupado
              ? "A la izquierda están tus secciones, ordenadas en Hoy, Gestión, Plata y Dirección. Tocá el nombre de un grupo para abrirlo o cerrarlo."
              : "A la izquierda están tus secciones. Tocás una y vas directo.",
          },
          "nav:barra": {
            texto: "Abajo están las secciones que usás todos los días. Todo lo demás está en «Menú», el último botón.",
          },
        },
      },
      pasoAyuda,
      pasoSalir(false),
    ];
  },
};

export const BIENVENIDA_SOCIO: ContenidoCapitulo = {
  portada: PortadaComoMoverte,
  pasos: () => [
    pasoGuia(true),
    {
      id: "mi-cuenta",
      ancla: "nav:/mi-cuenta",
      titulo: "Mi cuenta",
      texto: "Acá ves cuánto debés, lo que ya pagaste y tus recibos. También tus pedidos a Administración.",
    },
    {
      id: "comunicaciones",
      ancla: "nav:/mi-cuenta/comunicaciones",
      titulo: "Comunicaciones",
      texto: "Las circulares de la cooperativa y los avisos de tu carpeta. El número te dice cuántas nuevas tenés.",
    },
    pasoAyuda,
    pasoSalir(true),
  ],
};
