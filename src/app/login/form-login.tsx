"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { iniciarSesion, type EstadoLogin } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle } from "@/components/ui/alert";

/** "12345678" → "12.345.678" mientras se tipea (puntos de a tres desde la derecha). */
function conPuntos(digitos: string): string {
  return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Con letras o "@" es un email (compatibilidad con los usuarios viejos). */
function pareceEmail(v: string): boolean {
  return /[a-z@]/i.test(v);
}

export function FormLogin() {
  const [estado, accion, pendiente] = useActionState<EstadoLogin, FormData>(
    iniciarSesion,
    null
  );
  // Lo tipeado (para decidir DNI o email). El input no es controlado: después de
  // un error React resetea el form al `defaultValue`, que es el DNI que vuelve de
  // la acción → el DNI queda escrito y solo se retipea la contraseña.
  const [texto, setTexto] = useState("");
  // En el celular el teclado numérico no tiene letras: "Entrar con email" lo cambia.
  const [modoEmail, setModoEmail] = useState(false);
  // Al cambiar de modo el campo arranca vacío hasta el próximo intento.
  const [limpiadoEn, setLimpiadoEn] = useState<EstadoLogin | undefined>(undefined);
  const [verContrasena, setVerContrasena] = useState(false);
  const refContrasena = useRef<HTMLInputElement>(null);

  const esEmail = modoEmail || pareceEmail(texto);
  const valorPrevio = limpiadoEn === estado ? "" : (estado?.usuario ?? "");

  // Después de un error, el cursor va a la contraseña (el DNI ya está puesto).
  useEffect(() => {
    if (estado?.error) refContrasena.current?.focus();
  }, [estado]);

  function alTipear(input: HTMLInputElement) {
    const v = input.value;
    if (modoEmail || pareceEmail(v)) {
      setTexto(v);
      return;
    }
    const formateado = conPuntos(v.replace(/\D/g, "").slice(0, 8));
    if (formateado !== v) input.value = formateado;
    setTexto(formateado);
  }

  return (
    <form action={accion} className="space-y-5">
      {estado?.error ? (
        <Alert variant="destructive" aria-live="assertive">
          <AlertTitle className="text-sm">{estado.error}</AlertTitle>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-end justify-between gap-3">
          <Label htmlFor="usuario" className="text-base font-semibold">
            {esEmail ? "Email" : "DNI"}
          </Label>
          <button
            type="button"
            onClick={() => {
              setModoEmail((m) => !m);
              setTexto("");
              setLimpiadoEn(estado);
            }}
            className="-mr-2 inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-primary hover:underline"
          >
            {modoEmail ? "Entrar con DNI" : "Entrar con email"}
          </button>
        </div>
        <Input
          // Cambiar de modo vacía el campo (remonta el input).
          key={modoEmail ? "email" : "dni"}
          id="usuario"
          name="usuario"
          type="text"
          defaultValue={valorPrevio}
          onChange={(e) => alTipear(e.currentTarget)}
          inputMode={esEmail ? "email" : "numeric"}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          autoFocus
          placeholder={esEmail ? "tuemail@ejemplo.com" : "Ej.: 12.345.678"}
          aria-describedby="ayuda-usuario"
          className={
            esEmail
              ? "h-14 bg-card text-lg md:text-lg"
              : "h-14 bg-card text-2xl font-semibold tracking-wide tabular md:text-2xl"
          }
        />
        <p id="ayuda-usuario" className="text-sm text-muted-foreground">
          {esEmail
            ? "Entrás con email. Si tenés DNI cargado, es más fácil con el DNI."
            : "Solo los números: los puntos se ponen solos."}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-base font-semibold">
          Contraseña
        </Label>
        <div className="relative">
          <Input
            ref={refContrasena}
            id="password"
            name="password"
            type={verContrasena ? "text" : "password"}
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            placeholder="Tu contraseña"
            className="h-14 bg-card pr-32 text-lg md:text-lg"
          />
          <button
            type="button"
            onClick={() => setVerContrasena((v) => !v)}
            aria-pressed={verContrasena}
            aria-controls="password"
            className="absolute inset-y-1.5 right-1.5 inline-flex min-w-11 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {verContrasena ? (
              <EyeOff className="size-5" strokeWidth={2} />
            ) : (
              <Eye className="size-5" strokeWidth={2} />
            )}
            {verContrasena ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        disabled={pendiente}
        className="h-12 w-full text-base font-semibold"
      >
        {pendiente ? (
          <>
            <Loader2 className="size-5 animate-spin" />
            Entrando…
          </>
        ) : (
          "Entrar"
        )}
      </Button>
    </form>
  );
}
