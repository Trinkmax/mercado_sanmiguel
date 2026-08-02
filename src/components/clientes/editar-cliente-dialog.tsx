"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormCliente, type DatosCliente } from "./form-cliente";

/** Botón "Editar" de la ficha: abre el formulario de datos en un diálogo. */
export function EditarClienteDialog({ cliente }: { cliente: DatosCliente }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="h-12 px-5 text-base">
          <Pencil className="size-5" strokeWidth={2} />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar datos del cliente</DialogTitle>
          <DialogDescription>
            Corregí los datos de la carpeta y guardá.
          </DialogDescription>
        </DialogHeader>
        <FormCliente cliente={cliente} alGuardar={() => setAbierto(false)} />
      </DialogContent>
    </Dialog>
  );
}
