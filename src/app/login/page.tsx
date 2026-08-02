import type { Metadata } from "next";
import Image from "next/image";
import { Marca } from "@/components/shared/marca";
import { FormLogin } from "./form-login";
import { AccesoDemo } from "./acceso-demo";
import logoFull from "../../../public/logo_full.png";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Izquierda: el formulario */}
      <div className="flex flex-col bg-background px-6 py-8 sm:px-12">
        <Marca compacta className="text-foreground" />

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm space-y-8">
            <div className="space-y-1.5">
              <h1 className="font-display text-3xl font-extrabold tracking-tight">
                Hola de nuevo
              </h1>
              <p className="text-muted-foreground">
                Entrá con el usuario que te dio la cooperativa.
              </p>
            </div>

            <FormLogin />

            <AccesoDemo />
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          ¿No podés entrar? Consultá en administración.
        </p>
      </div>

      {/* Derecha: gradiente de la marca con el logo */}
      <div className="relative hidden items-center justify-center overflow-hidden bg-[linear-gradient(150deg,oklch(0.32_0.11_270)_0%,oklch(0.4_0.145_268)_45%,oklch(0.5_0.17_285)_100%)] lg:flex">
        {/* brillos del mosaico */}
        <div className="pointer-events-none absolute -top-32 -right-24 size-[28rem] rounded-full bg-[oklch(0.62_0.19_25)] opacity-25 blur-[110px]" />
        <div className="pointer-events-none absolute -bottom-36 -left-20 size-[26rem] rounded-full bg-[oklch(0.75_0.13_195)] opacity-25 blur-[110px]" />
        <div className="pointer-events-none absolute top-1/3 left-1/4 size-72 rounded-full bg-[oklch(0.85_0.15_95)] opacity-15 blur-[90px]" />

        <div className="relative z-10 flex flex-col items-center px-12 text-center">
          <div className="rounded-3xl bg-white/95 px-10 py-8 shadow-2xl shadow-black/25">
            <Image
              src={logoFull}
              alt="Mercado San Miguel — Cooperativa Frutihortícola"
              className="h-auto w-64"
              priority
            />
          </div>
          <p className="mt-10 max-w-sm text-balance font-display text-xl font-bold text-white">
            La gestión de la cooperativa, en un solo lugar.
          </p>
          <p className="mt-2 max-w-xs text-sm text-white/70">
            Cobranza, cajas, energía, gastos y reportes — el dato entra una vez
            y el sistema hace el resto.
          </p>
        </div>
      </div>
    </div>
  );
}
