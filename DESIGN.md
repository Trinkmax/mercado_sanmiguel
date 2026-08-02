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
  rojo, `--parcial` ámbar, cada uno con su `-suave` de fondo.
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

- `Sello` — sello de goma de estado (verde/rojo/ámbar); `grande` rota −2,5°;
  `.animar-estampado` al confirmar un cobro (único momento de motion autoral).
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

## Contrato de dirección

En `src/app/layout.tsx` como `<script type="text/x-direction-contract">`
(sobrevive al build; seed e94ff471 + pin de marca del usuario). Cambiar la
identidad = decisión de producto.
