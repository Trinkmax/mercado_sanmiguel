"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, rutaInicio } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";

/* Superadministrador: ver y operar el sistema con cualquier rol ("Ver el sistema como").
 * El cambio de rol es real (la base lo aplica con cambiar_vista_superadmin y toda la RLS
 * sigue a perfiles.rol); el portal del socio se ve como vista previa de un cliente, en
 * solo lectura. Solo lo puede usar un perfil marcado superadmin desde la base. */

export type RolVista = "lider" | "admin" | "tesoreria" | "guardia" | "porteria" | "socio";

const vistaSchema = z
  .object({
    rol: z.enum(["lider", "admin", "tesoreria", "guardia", "porteria", "socio"], "Elegí un rol."),
    clienteId: z.uuid("Elegí el cliente.").nullable().optional(),
  })
  .refine((d) => d.rol !== "socio" || !!d.clienteId, {
    message: "Elegí el cliente cuyo portal querés ver.",
  });

/** Cambia el rol del superadministrador. Devuelve adónde ir (el inicio de ese rol). */
export async function cambiarVista(input: unknown): Promise<ActionResult<{ ruta: string }>> {
  const perfil = await getPerfil();
  if (!perfil?.superadmin) return fallo("No tenés permiso para cambiar de rol.");
  const parsed = vistaSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.rpc("cambiar_vista_superadmin", {
    p_rol: parsed.data.rol,
    ...(parsed.data.rol === "socio" && parsed.data.clienteId ? { p_cliente: parsed.data.clienteId } : {}),
  });
  if (error) return fallo(error);

  revalidatePath("/", "layout");
  return ok({ ruta: rutaInicio(parsed.data.rol) });
}

export type ClienteVista = {
  id: string;
  codigo: number;
  nombre: string;
  apodo: string | null;
  categoria: string;
  activo: boolean;
};

/** Clientes para elegir la vista previa del portal (funciona con cualquier rol actual). */
export async function buscarClientesVista(buscar: string): Promise<ActionResult<ClienteVista[]>> {
  const perfil = await getPerfil();
  if (!perfil?.superadmin) return fallo("No tenés permiso.");
  const texto = String(buscar ?? "").trim().slice(0, 80);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("clientes_para_vista", { p_buscar: texto });
  if (error) return fallo(error);
  return ok(
    (data ?? []).map((c) => ({
      id: c.id,
      codigo: c.codigo,
      nombre: c.nombre,
      apodo: c.apodo,
      categoria: String(c.categoria),
      activo: c.activo,
    }))
  );
}
