"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { crearAccesoSocio } from "@/lib/actions/usuarios";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ClienteSinAcceso = {
  id: string;
  codigo: number;
  nombre: string;
};

export function FormAccesoSocio({
  clientes,
}: {
  clientes: ClienteSinAcceso[];
}) {
  const [clienteId, setClienteId] = useState("");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creando, startCrear] = useTransition();

  function elegirCliente(id: string) {
    setClienteId(id);
    if (!nombre.trim()) {
      const cliente = clientes.find((c) => c.id === id);
      if (cliente) setNombre(cliente.nombre);
    }
  }

  function crear() {
    if (!clienteId) {
      setError("Elegí el cliente.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña tiene que tener al menos 8 caracteres.");
      return;
    }
    setError(null);
    startCrear(async () => {
      const res = await crearAccesoSocio({
        cliente_id: clienteId,
        nombre,
        email,
        password,
      });
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success(`Listo. El socio ya puede entrar con ${res.data.email}.`);
      setClienteId("");
      setNombre("");
      setEmail("");
      setPassword("");
    });
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-lg">Acceso para un socio</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {clientes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todos los clientes ya tienen acceso al portal.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Creá el usuario del portal para que el socio vea su cuenta desde
              el celular: verde pagado, rojo pendiente.
            </p>

            <div className="space-y-2">
              <Label htmlFor="cliente-acceso" className="text-sm">
                Cliente
              </Label>
              <Select value={clienteId} onValueChange={elegirCliente}>
                <SelectTrigger
                  id="cliente-acceso"
                  className="h-12 w-full text-base"
                >
                  <SelectValue placeholder="Elegí el cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((cliente) => (
                    <SelectItem
                      key={cliente.id}
                      value={cliente.id}
                      className="min-h-11 text-base"
                    >
                      N.º {cliente.codigo} — {cliente.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nombre-acceso" className="text-sm">
                Nombre del socio
              </Label>
              <Input
                id="nombre-acceso"
                autoComplete="off"
                className="h-12 text-base md:text-base"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-acceso" className="text-sm">
                Email
              </Label>
              <Input
                id="email-acceso"
                type="email"
                inputMode="email"
                autoComplete="off"
                className="h-12 text-base md:text-base"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Con este email va a entrar al portal.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password-acceso" className="text-sm">
                Contraseña
              </Label>
              <Input
                id="password-acceso"
                autoComplete="off"
                className="h-12 text-base md:text-base"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Mínimo 8 caracteres. Anotala para dársela al socio.
              </p>
            </div>

            {error ? (
              <p className="text-sm font-medium text-destructive">{error}</p>
            ) : null}

            <Button
              size="lg"
              className="h-12 w-full text-base font-semibold"
              disabled={
                creando || !clienteId || !nombre.trim() || !email.trim() || !password
              }
              onClick={crear}
            >
              {creando ? "Creando acceso…" : "Crear acceso"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
