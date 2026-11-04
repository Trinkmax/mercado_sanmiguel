# DESIGN.md — Mercado San Miguel

Documentado desde el sistema construido (agosto 2026), tras el pin de la marca
real por el usuario. Identidad: **la marca de la cooperativa** — logo mosaico
multicolor, azul institucional, tipografía redondeada. Modo: **Operate**
(herramienta de trabajo diaria; usuarios mayores, tablets, a plena luz).

## La idea

La carpeta de papel del mercado, digitalizada. El azul del logotipo es la única
voz de marca; los **estados** hablan en sellos de goma — verde = pagado, rojo =
pendiente, ámbar = parcial (pedido textual del cliente y ley del sistema).

## Marca

- Assets reales en `public/`: `logo.png` (isologo mosaico, 651×249) y
  `logo_full.png` (isologo + wordmark azul + tagline roja, 663×575).
- Componente canónico: `<Marca />` (`src/components/shared/marca.tsx`) —
  isologo + "Mercado San Miguel" en Nunito extrabold + "Cooperativa
  Frutihortícola" en caps espaciadas. El texto hereda el color del contexto.
- `logo_full.png` se reserva para superficies protagonistas (panel derecho del
  login, sobre tarjeta blanca) — nunca sobre fondos oscuros sin tarjeta (el
  wordmark azul se pierde).

## Tokens (`src/app/globals.css`)

- **Primario / marca**: azul del logotipo `--primary: oklch(0.4 0.145 268)`.
  Barra lateral azul profundo `oklch(0.29 0.08 268)` con texto claro.
- **Fondo**: neutro frío muy claro `oklch(0.975 0.004 255)`; tarjetas blancas.
- **Estados** (nunca otro color para estados): `--pagado` verde, `--pendiente`
  rojo, `--parcial` ámbar, cada uno con su `-suave` de fondo. Fase 2 suma el
  sello `info` (azul `--accent`) para lo *en curso administrativo* —en revisión,
  en el Consejo, en caja mayor, listo para depositar— que no es un estado de
  cobro y no debe competir con verde/rojo.
- **Tema**: claro único (uso diurno en el mercado).
- Radio 0.625rem. Foco visible 3px. Inputs ≥ 1rem.
- Gradiente de marca (solo login): `linear-gradient(150deg, oklch(0.32 0.11 270),
  oklch(0.4 0.145 268) 45%, oklch(0.5 0.17 285))` + brillos radiales con los
  colores del mosaico (rojo, celeste, amarillo) desenfocados.

## Tipografía

- **Sans (todo el texto)**: Inter — con `.tabular` (números tabulares) en todo
  importe, alineado a la derecha en tablas.
- **Display (títulos y marca)**: Nunito 600–800 — la redondez del logotipo.
  Títulos en caja normal, `tracking-tight`; **nada de mayúsculas sostenidas ni
  stencil** (iteración anterior descartada por feedback del usuario). Mayúsculas
  solo en micro-etiquetas (bandas de arqueo) y sellos.
- **Escala contenida**: título de página `text-2xl`, saludo `~1.7rem`, montos
  protagonistas `text-2xl`–`text-3xl`. Nada de 4xl/5xl en el panel.

## Componentes canónicos (`src/components/shared/`)

- `Sello` — sello de goma de estado (verde/rojo/ámbar/azul info/gris); `grande` rota −2,5°;
  `.animar-estampado` al confirmar un cobro o un ingreso de personal (único momento de motion autoral).
- `BotonExportar` — link de descarga a Excel; `BotonImprimir` con `autoImprimir` (impresión directa).
- Navegación en grupos plegables (Hoy siempre abierto; Gestión / Plata / Dirección se pliegan, recuerdan el estado en el dispositivo y se abren solos donde está el usuario) con badges ámbar de pendientes; roles con ≤ 7 entradas ven lista plana.
- `Codigo` — chip azul (`--accent`) con el código en Nunito bold (EXPP, AGUA…).
- `Money` — todo importe pasa por acá (`formatARS`).
- `PageHeader` — título Nunito bold text-2xl + descripción text-sm.
- `EmptyState`, `Marca`, `.etiqueta > .etiqueta-interior` (marco doble filete,
  solo para imprimibles: recibos, libre deuda, arqueo).
- shadcn/ui (radix-mira); iconos lucide 1.8–2.2.

## Reglas duras

1. Un camino por pantalla; acción primaria grande y visible; targets ≥ 44 px.
2. Estados solo con `Sello`. Montos solo con `Money`. Fechas solo con helpers
   de `src/lib/format.ts` (huso argentino, idéntico a la SQL).
3. Copy rioplatense con voseo, sin jerga; los botones nombran la acción.
4. Prohibido: kickers, grillas de cards iguales, texto degradé, border-left de
   color, sombras duras, monospace decorativo, emoji como iconos, mayúsculas
   sostenidas en títulos.
5. Login: pantalla partida (form a la izquierda, gradiente de marca + logo a la
   derecha) con el acceso rápido de demo por rol (sacar en producción).
6. Barras de cobranza: relleno verde sobre pista roja suave.

## Portal del socio: «Tu lugar en el mercado»

El portal (`src/app/(portal)`) tiene mundo propio desde el 03/11/2026; el panel sigue con todo lo de
arriba. Modo: **Operate**. Lo usan puesteros y quinteros, de pie en el galpón o al sol, con una mano
ocupada y poca costumbre con el celular. Comparten: el logo, el azul, la ley de colores y los sellos.
Estilos en `src/app/(portal)/portal.css` (solo se carga en estas rutas); tokens en `globals.css`.

**La idea.** La cuenta no es una planilla: es tu lugar en el mercado, prendido en el color de cómo
estás. El plano real queda quieto de fondo y todo lo demás sube por encima.

- **Color (Committed):** `--esmalte` (el azul del logotipo) a página entera; `--porcelana` y `--tinta`
  donde se lee. El campo del cartel y los lugares prendidos cambian con `.tono-al_dia`,
  `.tono-en_termino`, `.tono-vencido` y `.tono-neutro` (`--campo`, `--sobre-campo`). Verde, ámbar y rojo
  siguen significando lo mismo que en todo el sistema; la frase siempre dice lo mismo que el color.
- **Letra:** Archivo con eje de ancho (Omnibus-Type, Argentina), declarada en el layout del portal para
  que el panel no la descargue. Números grandes en `font-stretch` 86 %. Base del portal: 106,25 % (17 px
  si el navegador está en 16). A propósito es más grande que el panel: «escala contenida» rige allá.
- **Materiales:** `.chapa` (la de la numeración de la calle: filete blanco y tornillos), `.cartel` (arco
  con la curva del techo del logo y filete interior), `.hoja` y `.hoja-filas` (porcelana, sin tarjetas
  dentro de tarjetas), `.talon` (el pago, con la línea de corte), `.azulejo` (una cuota, inclinada como
  los del logo), `.burbuja` (conversación), `.boton-*`, `.campo-portal`.
- **Plano (`plano-portal.tsx`):** silueta estática en `silueta-plano.ts` (se regenera con
  `supabase/plano/silueta-portal.mjs`; sin datos de clientes); los lugares del socio salen de la base
  (RLS). Un `<path>` por tipo y ningún filtro SVG, para que el vuelo ande en Safari y en gama media
  (ver memoria de rendimiento del mapa).
- **Un solo momento de movimiento:** al entrar, la cámara vuela de todo el mercado a tu puesto y cae la
  chapa; al tocar un concepto o un lugar, vuela hasta ahí dentro de la hoja. Al estar al día, los azulejos
  del logo se colocan de a uno. Con «reducir movimiento» no se anima nada.
- **Navegación:** cuatro secciones abajo, siempre con texto: Mi cuenta, Mis pagos, Mensajes, Mi carpeta.
  En una conversación o un trámite la barra se esconde. Las hojas van en la dirección (`?ver=`, `?lugar=`):
  el «atrás» del celular las cierra.

**Reglas del portal**

1. El cartel responde primero: cómo estoy, cuánto, hasta cuándo. Nada le gana al monto.
2. Palabras de todos los días: «Expensas de tu puesto», «Luz», «Tu cochera» (el nombre contable queda al
   final de la hoja). Los montos nunca se recalculan: salen de las vistas de siempre (`armar-cuenta.ts`).
3. Mensajes es una sola lista, como un chat: lo que espera algo de vos, arriba. Sin pestañas.
4. Una cosa por vez: al escribir, primero qué querés hacer y después un solo cuadro (sin «asunto»: lo arma
   el servidor con la primera frase). Los avisos formales son sobrios: el papel arriba, la conversación
   abajo.
5. Pantallas en `src/components/portal/pantallas/` (solo reciben datos); las páginas leen y les pasan.

## Contrato de dirección

En `src/app/layout.tsx` como `<script type="text/x-direction-contract">`
(sobrevive al build; seed e94ff471 + pin de marca del usuario). Cambiar la
identidad = decisión de producto. El portal tiene el suyo al lado (seed 17b94eb3).
