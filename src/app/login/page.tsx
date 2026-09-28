import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { LogIn, UserX } from "lucide-react";
import { destinoTrasEntrar, getPerfil, sesionSinAcceso } from "@/lib/auth";
import { modoDemoActivo } from "@/lib/demo";
import { rutaVolverSegura } from "@/lib/volver";
import { Marca } from "@/components/shared/marca";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FormLogin } from "./form-login";
import { AccesoDemo } from "./acceso-demo";
import logoFull from "../../../public/logo_full.png";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string | string[]; volver?: string | string[] }>;
}) {
  const { motivo, volver: volverParam } = await searchParams;
  // Pantalla donde estaba cuando se le cerró la sesión (la pone el proxy).
  const volver = rutaVolverSegura(volverParam);

  // Con sesión y acceso, el login no tiene sentido: a su inicio (o adonde estaba).
  // Con sesión pero SIN acceso (desactivado, Consejo) se queda acá con el aviso:
  // nada de bucles.
  const perfil = await getPerfil();
  if (perfil) redirect(destinoTrasEntrar(perfil.rol, volver));

  const desactivado = motivo === "inactivo" && (await sesionSinAcceso());
  // La sesión se cerró (se venció o la cerraron): se explica, sin asustar.
  const sesionCerrada = motivo === "sesion" && !desactivado;

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
                Entrá con tu DNI y la contraseña que te dio la cooperativa.
              </p>
            </div>

            {desactivado ? (
              <Alert className="border-parcial bg-parcial-suave px-4 py-3">
                <UserX strokeWidth={2} />
                <AlertTitle className="text-sm">
                  Tu usuario está desactivado. Consultá en Administración.
                </AlertTitle>
                <AlertDescription className="text-sm">
                  Si tenés otro usuario, podés entrar con ese acá abajo.
                </AlertDescription>
              </Alert>
            ) : sesionCerrada ? (
              <Alert className="border-primary/30 bg-accent px-4 py-3 text-accent-foreground">
                <LogIn strokeWidth={2} />
                <AlertTitle className="text-sm">Tu sesión se cerró.</AlertTitle>
                <AlertDescription className="text-sm">
                  {volver
                    ? "Entrá de nuevo con tu DNI y seguís donde estabas."
                    : "Entrá de nuevo con tu DNI."}
                </AlertDescription>
              </Alert>
            ) : null}

            <FormLogin volver={volver} />

            {modoDemoActivo() ? <AccesoDemo /> : null}
          </div>
        </div>

        <p className="mx-auto max-w-sm text-center text-sm text-muted-foreground text-balance">
          ¿Te olvidaste la contraseña? Pedí una nueva en Administración (socios) o
          al Líder de Procesos (equipo).
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
