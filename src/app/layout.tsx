import type { Metadata, Viewport } from "next";
import { Inter, Nunito, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

// Nunito acompaña la redondez del logotipo real de la cooperativa.
const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Mercado San Miguel",
    template: "%s · Mercado San Miguel",
  },
  description:
    "Sistema de gestión de la Cooperativa Mercado San Miguel: clientes, cobranza, cajas, energía, gastos y reportes.",
};

// viewport-fit=cover: la barra de navegación del celular respeta el área segura
// (la rayita del iPhone) con env(safe-area-inset-bottom).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1f2a5c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-AR"
      className={cn(
        "h-full antialiased font-sans",
        inter.variable,
        nunito.variable,
        geistMono.variable
      )}
    >
      <body className="min-h-full flex flex-col">
        {/* Contrato de dirección: script inerte para que sobreviva al build. */}
        <script
          type="text/x-direction-contract"
          dangerouslySetInnerHTML={{
            __html: `
THESIS: la carpeta de papel del mercado, digitalizada — una etiqueta por cada
cosa que se cobra; rechaza el dashboard generico de tarjetas iguales.
OWN-WORLD (anclado a la marca real de la cooperativa, pineada por el usuario):
azul del logotipo como unica marca, fondo neutro claro, barra lateral azul
profundo; titulos en Nunito (la redondez del logotipo), texto en Inter; estados
como sellos de goma: PAGADO verde, PENDIENTE rojo, PARCIAL ambar (pedido
textual del cliente); montos tabulares.
STORY: la administrativa camina el mercado con la tablet, busca el puesto, ve
rojo/verde de un vistazo, cobra, y el sistema imputa, arquea y reporta solo.
FIRST VIEWPORT: inicio por rol: saludo, caja de hoy y cobranza del periodo con
barras verde/rojo; Cobrar siempre a un toque.
FORM: etiqueta de cajon de mercado, candidato 5 de 7 del mundo cultural del
mercado argentino; seed e94ff471.
FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, and DESIGN.md.`,
          }}
        />
        {/* Contrato de dirección del portal del socio (DESIGN.md → «Portal del socio»). */}
        <script
          type="text/x-direction-contract"
          data-superficie="portal"
          dangerouslySetInnerHTML={{
            __html: `
THESIS: la cuenta del socio es su lugar en el mercado: el plano real con su puesto
prendido en el color de cómo está; rechaza la billetera de tarjeta y movimientos.
OWN-WORLD: azul del logotipo como chapa enlozada a página entera, líneas de plano en
porcelana, chapas con filete y tornillos, cartel de arco verde/ámbar/rojo con tinta,
talones perforados, sellos de goma, letra Archivo.
STORY: abre, ve su puesto y el color, lee cuánto y hasta cuándo; toca un concepto y
la cámara vuela hasta ese lugar.
FIRST VIEWPORT: un tercio de plano con su puesto y su chapa; cartel de arco con el
monto a todo el ancho; abajo, cuatro chapas al alcance del pulgar.
FORM: el plano del mercado, candidato 6 de 7; seed 17b94eb3.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
review, the verdict, and DESIGN.md`,
          }}
        />
        {children}
        {/* Debajo de la barra superior en tablet/celular: no tapa el menú ni "Salir". */}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
