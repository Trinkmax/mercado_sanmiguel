import { FilePenLine } from "lucide-react";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hoyISO } from "@/lib/format";
import { categoriasDeRol } from "@/lib/segmentos";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { FormRegistro } from "@/components/comunicaciones/form-registro";
import { ListaRegistros, ordenarRegistros } from "@/components/comunicaciones/lista-registros";
import { cargarRegistros } from "@/components/comunicaciones/datos";
import { opcionesClientes } from "@/components/comunicaciones/opciones-clientes";

/**
 * Pestaña "Registros" de la ficha del cliente (M5, contrato §6.10): notificaciones,
 * apercibimientos y sanciones con su estado, si lo vio y la multa, cada uno con link al detalle;
 * y el alta en la misma pantalla (reemplaza a NuevaSancion).
 */
export async function RegistrosCliente({
  clienteId,
  puedeRegistrar,
}: {
  clienteId: string;
  puedeRegistrar: boolean;
}) {
  const perfil = await getPerfil();
  if (!perfil) return <></>;
  const supabase = await createClient();
  const categorias = categoriasDeRol(perfil.rol);
  // Líder y Administración ven los registros de los clientes que gestionan (la RLS deja leer).
  const verTodo = categorias.length > 0 ? categorias : (["puestero", "quintero", "ambulante"] as const);
  const registros = ordenarRegistros(
    await cargarRegistros(supabase, { categorias: [...verTodo], clienteId })
  );
  const opciones = puedeRegistrar ? await opcionesClientes(supabase, categorias, clienteId) : [];
  const puede = puedeRegistrar && opciones.length === 1;

  return (
    <div className="space-y-6">
      <section className="space-y-3" aria-label="Registros del cliente">
        {registros.length === 0 ? (
          <EmptyState
            icono={FilePenLine}
            titulo="Sin notificaciones, apercibimientos ni sanciones"
            descripcion="Lo que le mandes queda acá, con si lo vio, su descargo y la multa si la tuvo."
          />
        ) : (
          <ListaRegistros registros={registros} mostrarCliente={false} />
        )}
      </section>

      {puede ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nuevo registro</CardTitle>
            <CardDescription>Le llega a su portal al instante. Si lleva multa, se suma a su cuenta.</CardDescription>
          </CardHeader>
          <CardContent>
            <FormRegistro
              clientes={opciones}
              clienteInicialId={clienteId}
              clienteFijo
              fechaHoy={hoyISO()}
              alTerminar="quedarse"
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
