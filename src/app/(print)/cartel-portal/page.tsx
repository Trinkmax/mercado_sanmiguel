import Image from "next/image";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { requireRol } from "@/lib/auth";
import { BotonImprimir } from "@/components/shared/boton-imprimir";
import logoFull from "../../../../public/logo_full.png";

export const metadata = { title: "Cartel del portal" };

/**
 * Cartel para pegar en el mercado (pedido de Franco, 02/11/2026): un QR que lleva al login
 * y cómo se entra (usuario y contraseña = el DNI). La dirección sale del pedido: impreso
 * desde el sistema publicado apunta al sistema publicado.
 */
export default async function CartelPortalPage() {
  await requireRol("lider", "admin", "guardia");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "mercadosanmiguel.vercel.app";
  const protocolo = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const url = `${protocolo}://${host}/login`;
  const qr = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M" });

  return (
    <div>
      <BotonImprimir volverA="/configuracion?tab=usuarios&ver=socios" />

      <div className="etiqueta mx-auto max-w-[17cm] break-inside-avoid">
        <div className="etiqueta-interior flex flex-col items-center gap-6 py-8 text-center">
          <Image src={logoFull} alt="Mercado San Miguel" className="h-24 w-auto" priority />

          <div className="space-y-2">
            <h1 className="font-display text-4xl font-bold text-balance">Tu cuenta en el celular</h1>
            <p className="text-xl text-muted-foreground">
              Escaneá el código con la cámara del celular
            </p>
          </div>

          <div
            className="w-[9cm] max-w-full [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
            role="img"
            aria-label={`Código QR que lleva a ${url}`}
            // El SVG lo arma la librería con nuestra propia dirección: no hay texto de afuera.
            dangerouslySetInnerHTML={{ __html: qr }}
          />
          <p className="font-display text-lg font-semibold tracking-wide break-all">
            {host}
          </p>

          <dl className="grid w-full max-w-md grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-3 rounded-lg border-2 border-foreground px-6 py-5 text-left">
            <dt className="text-xl text-muted-foreground">Usuario</dt>
            <dd className="font-display text-3xl font-bold">tu DNI</dd>
            <dt className="text-xl text-muted-foreground">Contraseña</dt>
            <dd className="font-display text-3xl font-bold">tu DNI</dd>
          </dl>
          <p className="text-lg">Solo los números, sin puntos. Por ejemplo: 12345678</p>

          <p className="max-w-md text-lg text-balance text-muted-foreground">
            Ahí ves cuánto debés, tus pagos y recibos, y los avisos del mercado. ¿No podés
            entrar? Consultá en Administración.
          </p>
        </div>
      </div>
    </div>
  );
}
