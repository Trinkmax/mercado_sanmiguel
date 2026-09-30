# Tour guiado — cómo se escribe y cómo se mantiene

El sistema trae una **guía interactiva**: oscurece la pantalla, deja iluminado el botón
que importa, una manito lo señala y una tarjeta grande explica qué es y qué hacer. Recorre
las pantallas de verdad (navega sola de una a otra) y, cuando todavía no hay datos (lista
vacía), muestra una **pantalla de ejemplo** dibujada.

- **«Ayuda»** está en todas las pantallas (barra lateral, cabecera del celular, portal):
  ofrece *cómo se usa esta pantalla*, *todo mi trabajo paso a paso* y la **Guía**
  (`/guia`, en el portal `/mi-cuenta/guia`).
- La primera vez que alguien entra con un rol, se le ofrece el recorrido (bienvenida).
- Mientras dura el tour **no se puede tocar nada** salvo lo señalado en los pasos "tocá acá"
  (y esos pasos solo señalan cosas que no guardan nada). Nunca se guarda, cobra ni borra.

Usuarios: adultos mayores, tablets a plena luz, poca costumbre con la tecnología
(`PRODUCT.md`, `DESIGN.md`). **Todo se decide pensando en ellos.**

## Piezas

| Archivo | Qué es | Quién lo toca |
|---|---|---|
| `src/lib/tour/tipos.ts` | Tipos: `Paso`, `ContenidoCapitulo`, `MetaCapitulo` | motor |
| `src/lib/tour/indice.ts` | Capítulos (id, ruta, roles, ícono, título, resumen) y **recorridos por rol** | motor |
| `src/lib/tour/capitulos.ts` | Registro: une metadatos + contenido | motor |
| `src/lib/tour/anclas.ts`, `memoria.ts` | Buscar lo señalado; lo que se recuerda en el dispositivo | motor |
| `src/components/tour/*.tsx` | Proveedor, capa, «Ayuda», bienvenida, Guía, flujos | motor |
| `src/components/tour/pantalla.tsx` | Piezas para dibujar pantallas de ejemplo | motor |
| `src/lib/tour/contenido/<area>.ts` | **Los pasos de cada capítulo del área** | cada área |
| `src/components/tour/pantallas/<area>.tsx` | **Las pantallas de ejemplo del área** | cada área |
| `data-tour="…"` en los componentes | Anclas: qué se puede señalar | cada área, en sus archivos |

## Un capítulo

Un capítulo enseña **una sección** (Cobrar, Caja del día…) para **un rol**. Sus pasos:

La `portada` se muestra en la Guía; si el capítulo se ve muy distinto por rol, sumá
`portadaPorRol: (rol) => PortadaDelJefe` (devolvé `undefined` para usar la común).

```ts
// src/lib/tour/contenido/cobranza.ts
import type { ContenidoCapitulo } from "@/lib/tour/tipos";
import { PantallaCobro, PortadaCobrar } from "@/components/tour/pantallas/cobranza";

export const COBRAR: ContenidoCapitulo = {
  portada: PortadaCobrar,            // dibujo chico para la Guía
  pasos: (rol) => [
    {
      id: "que-es",
      ancla: "encabezado",           // el título de la página (PageHeader)
      titulo: "Acá cobrás",
      texto: rol === "guardia"
        ? "Desde acá le cobrás a quinteros y ambulantes, y le das su recibo."
        : "Desde acá le cobrás a cualquier cliente y le das su recibo.",
    },
    {
      id: "buscar",
      ancla: "cobranza-buscador",
      accion: "tocar",               // puede escribir: buscar no guarda nada
      titulo: "Buscá al cliente",
      texto: "Escribí el nombre, el apodo o el número de puesto.",
    },
    {
      id: "ficha",
      ruta: "/cobranza/[clienteId]", // pantalla con id: se entra por el link de la lista
      entrar: "cobranza-fila",
      ancla: "cobranza-boton-cobrar",
      titulo: "Tocá «Cobrar»",
      texto: "Se abre una ventana para anotar cuánto te paga y cómo.",
      pantalla: PantallaCobro,       // cómo es la ventana que se abre
      sinAncla: {                    // si no hay clientes todavía
        texto: "Cuando haya clientes, tocás uno y aparece «Cobrar». Así se ve la ventana:",
      },
    },
  ],
};
```

### Campos de un paso (`Paso`)

- `id` — único en el capítulo (kebab-case).
- `ancla` — el `data-tour` a señalar. Con **varias** (`["caja-cerrar", "caja-abrir"]`) se
  señala la primera que esté a la vista (sirve para estados: caja abierta o cerrada). Sin
  ancla la tarjeta va al centro.
- `titulo` — 2 a 6 palabras: qué es o qué hacer ("Buscá al cliente").
- `texto` — 1 a 3 oraciones cortas.
- `accion` — `"mirar"` (por defecto: se ilumina pero no se toca) o `"tocar"` (puede tocarlo
  y el tour sigue solo). **`"tocar"` SOLO para lo que no guarda nada**: links del menú,
  pestañas, filtros, buscar, abrir una ficha o una lista. **Nunca** en guardar, cobrar,
  confirmar, cerrar caja, aprobar, borrar, enviar, subir, imprimir.
- `ruta` — si el paso es en otra pantalla que la del capítulo. Con `[id]` (pantalla de un
  registro) hace falta `entrar`: el ancla de un link de la pantalla anterior que lleva ahí
  (la primera fila de la lista). Si no hay ninguno (lista vacía), el paso se muestra con
  su `pantalla`/`sinAncla` y los siguientes pasos de esa pantalla también. Un `[id]` no
  coincide con carpetas fijas (`nuevo`, `nueva`, `editar`, `registros`, `imprimir`).
  **Pestañas que son links con query** (`?tab=usuarios`, `?vista=personal`): poné la
  query en la ruta (`ruta: "/configuracion?tab=usuarios"`). Con «Siguiente» el tour abre
  la pestaña solo; si la persona la toca (paso "tocar" sobre la pestaña), espera a que
  cargue. Así cada pestaña puede tener un paso "tocá «Usuarios»" y después los pasos que
  iluminan su contenido.
- `pantalla` — una pantalla de ejemplo que acompaña el paso (lo que se abre al tocar, cómo
  queda después, un comprobante). En el celular aparece plegada ("Ver cómo se ve") cuando
  el elemento real está a la vista.
- `consejo` — un "ojo" o un truco, una oración.
- `variantes` — cambia título/texto/pantalla/consejo/acción según **qué ancla** se encontró
  (clave = nombre del ancla).
- `sinAncla` — lo mismo cuando **no apareció ninguna** (sin datos todavía, o el estado no
  lo muestra). **Todo paso cuya ancla depende de datos o de un estado necesita `sinAncla`
  con `pantalla`**: la producción arranca vacía. Si lo real aparece tarde (conexión
  lenta), el tour pasa solo a señalarlo.
- `opcional` — si su ancla no aparece, el paso **se saltea** (para lo que existe solo a
  veces: saldo a favor, avisos pendientes). No lo uses en pasos que enseñan algo que la
  persona igual tiene que saber.

Un paso "tocar" sobre un grupo (pestañas, filtros) sigue solo cuando se toca uno de sus
botones o links, no el espacio entre ellos. Tocar un campo (buscar) no lo hace seguir:
la persona escribe y toca «Siguiente». Arrastrar (mover el plano) tampoco cuenta.

El motor agrega solo: el paso "Vamos a «Sección»" que señala el link del menú (o el grupo
plegado, o «Menú» en la tablet) cuando el capítulo empieza en otra pantalla, y el cierre
("¡Listo!…", con "Seguir con «la sección que sigue»").

### Cómo se arma un buen capítulo

1. **Para qué sirve esta pantalla** en el trabajo de ese rol (ancla `encabezado` o la zona
   principal). Una oración que conecte con el proceso: "Lo que cobres hoy queda en tu caja".
2. **El camino principal, en el orden en que se hace**: de dónde se parte, qué se toca, qué
   se completa, qué pasa al confirmar (con `pantalla` para ventanas y resultados).
3. **Lo que está alrededor** y se usa seguido (filtros, exportar, imprimir, estados), sin
   señalar cada botón: lo importante, no todo.
4. **Qué pasa después y a quién le llega** (Tesorería lo valida, el Líder lo aprueba, el
   socio lo ve en su portal). Así cada uno entiende el proceso entero.

4 a 9 pasos por rol. Si un rol ve la pantalla distinto (el Jefe de Portería solo quinteros
y ambulantes; Tesorería valida en vez de cerrar), **los pasos cambian por rol**
(`pasos: (rol) => …`). Leé la página y sus componentes para saber qué ve cada rol.

## Cómo se escribe (voz)

- Rioplatense con voseo: *tocá, elegí, fijate, escribí*. Nada de "hacé clic", "seleccione",
  "usuario", "registro", "ítem", "módulo", "dashboard", "click".
- Frases cortas. Una idea por oración. Sin jerga ni siglas sin explicar.
- Los botones y pestañas se nombran **exactamente como dicen en pantalla**, entre comillas
  latinas: «Cobrar», «Cerrar caja». Si el texto del botón cambia, el paso también.
- Montos y fechas como en el sistema: $ 1.080.000, 30/09. Nombres inventados y cálidos
  (Pocho, La Colorada, Don Ramón), puestos creíbles (Puesto 58, Galpón 9).
- Tranquilizar donde da miedo: "Si te equivocás, se puede anular", "Hasta que el Líder no
  lo apruebe, no cambia nada".
- Sin emoji. Sin signos de exclamación salvo el cierre.

## Anclas (`data-tour`)

- Nombre: `<area>-<cosa>` en kebab-case, en castellano: `cobranza-buscador`,
  `caja-cerrar`, `clientes-fila`. Un elemento puede tener varios separados por espacio.
- Se ponen en el elemento **que se ve y se toca** (el botón, la tarjeta, la pestaña), en
  el JSX de tu área. Los componentes de `ui/` y `Button` pasan `data-tour` al DOM; si un
  componente propio no lo pasa, poné el ancla en un `div`/`span` que lo envuelva o sumale
  la prop. **Nada más**: no cambies estilos, textos ni comportamiento.
- Listas: la misma ancla en todas las filas (se señala la primera visible).
- Reservadas (las pone el motor, no las repitas): `nav:/ruta`, `nav-grupo:…`, `nav:menu`,
  `nav:barra`, `menu-lateral`, `ayuda`, `salir`, `encabezado` (en `PageHeader`).
- Las páginas que no usan `PageHeader` (Inicio, Mapa, …) pueden poner `encabezado` en su
  título.

## Pantallas de ejemplo

Dibujos **quietos** de ≈ 360 px de ancho, con datos inventados. Van en
`src/components/tour/pantallas/<area>.tsx`:

- Componentes sin estado, sin hooks, sin `"use client"`, sin handlers, sin datos reales.
- Se arman con `MarcoPantalla` (la ventanita con barra azul y título), `Resaltado` (el
  anillo que late con la manito: para señalar la parte que el paso explica), `BotonEjemplo`,
  `CampoEjemplo`, `FilaEjemplo` (de `@/components/tour/pantalla`) y los componentes de
  verdad que son solo visuales: `Money`, `Sello`, `Codigo`, íconos de lucide.
- Tienen que **parecerse a la pantalla real** (mismos títulos, mismos botones, mismo orden),
  en chico. Texto mínimo `text-[0.72rem]`.
- Cada capítulo lleva una `portada` (la pantalla principal en chico) y pantallas para: las
  ventanas que se abren, el resultado de las acciones importantes (recibo, arqueo) y todo
  lo que depende de datos (para `sinAncla`).

## Cambiar algo después

- Cambió un botón o un texto de una pantalla → actualizá el paso que lo nombra.
- Pantalla nueva → capítulo nuevo: `IdCapitulo` en `tipos.ts`, metadatos en `indice.ts`
  (y en `RECORRIDOS` de los roles que la usan), contenido en `contenido/`, registro en
  `capitulos.ts`.
- Antes de subir: `npx tsc --noEmit`, `npx eslint`, y recorrer el capítulo con «Ayuda».
