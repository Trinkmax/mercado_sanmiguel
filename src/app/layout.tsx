import type { Metadata } from "next";
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
        {children}
        {/* Debajo de la barra superior en tablet/celular: no tapa el menú ni "Salir". */}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
