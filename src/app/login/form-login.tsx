"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { iniciarSesion, type EstadoLogin } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle } from "@/components/ui/alert";

export function FormLogin() {
  const [estado, accion, pendiente] = useActionState<EstadoLogin, FormData>(
    iniciarSesion,
    null
  );

  return (
    <form action={accion} className="space-y-4">
      {estado?.error ? (
        <Alert variant="destructive">
          <AlertTitle className="text-sm">{estado.error}</AlertTitle>
        </Alert>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          placeholder="tuemail@ejemplo.com"
          className="h-11 bg-card"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="Tu contraseña"
          className="h-11 bg-card"
        />
      </div>

      <Button
        type="submit"
        disabled={pendiente}
        className="h-11 w-full font-semibold"
      >
        {pendiente ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Entrando…
          </>
        ) : (
          "Entrar"
        )}
      </Button>
    </form>
  );
}
