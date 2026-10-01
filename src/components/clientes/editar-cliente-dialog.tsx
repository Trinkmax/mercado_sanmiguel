"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import type { Rol } from "@/lib/auth";
import { LABEL_CATEGORIA } from "@/lib/segmentos";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormCliente, type ConceptoActivo, type DatosCliente } from "./form-cliente";
import { aplicaDirectoRol } from "./constantes";

/** Botón "Editar" de la ficha: abre el formulario de datos en un diálogo. */
export function EditarClienteDialog({
  cliente,
  rol,
  conceptosActivos,
  lugaresTexto,
  lugaresSinCocheraTexto,
  medidoresActivos,
}: {
  cliente: DatosCliente;
  rol: Rol;
  /** Lo mensual que factura hoy (para avisar qué deja de facturarse si cambia de categoría). */
  conceptosActivos?: ConceptoActivo[];
  /** Sus lugares del plano (se liberan si pasa a ambulante). */
  lugaresTexto?: string | null;
  /** Los mismos sin las cocheras (las conserva si pasa a empleado). */
  lugaresSinCocheraTexto?: string | null;
  /** N° de sus medidores activos (se desactivan si pasa a ambulante). */
  medidoresActivos?: string[];
}) {
  const [abierto, setAbierto] = useState(false);
  const que = LABEL_CATEGORIA[cliente.categoria].toLowerCase();

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="h-12 px-5 text-base" data-tour="clientes-editar">
          <Pencil className="size-5" strokeWidth={2} />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar datos del {que}</DialogTitle>
          <DialogDescription>
            {aplicaDirectoRol(rol)
              ? "Corregí los datos de la carpeta y guardá."
              : "Corregí los datos de la carpeta y envialos: el Líder de Procesos los aprueba."}
          </DialogDescription>
        </DialogHeader>
        <FormCliente
          cliente={cliente}
          rol={rol}
          conceptosActivos={conceptosActivos}
          lugaresTexto={lugaresTexto}
          lugaresSinCocheraTexto={lugaresSinCocheraTexto}
          medidoresActivos={medidoresActivos}
          alGuardar={() => setAbierto(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
