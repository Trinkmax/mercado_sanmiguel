import type { Perfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AceptarTerminos } from "@/components/portal/aceptar-terminos";

/**
 * Gate de términos y condiciones del portal. Si hay una versión vigente y el
 * socio (cliente vinculado al usuario) no la aceptó, renderiza SOLO la
 * pantalla de aceptación; si no, deja pasar a los hijos.
 * Sin cliente vinculado no hay a quién pedirle aceptación: la página de
 * cuenta ya explica el caso.
 */
export async function GateTerminos({
  perfil,
  children,
}: {
  perfil: Perfil;
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const [clienteRes, terminosRes] = await Promise.all([
    supabase
      .from("clientes")
      .select("id")
      .eq("auth_user_id", perfil.user_id)
      .maybeSingle(),
    supabase
      .from("terminos")
      .select("id, version, titulo, contenido")
      .eq("org_id", perfil.org_id)
      .eq("vigente", true)
      .maybeSingle(),
  ]);

  const cliente = clienteRes.data;
  const terminos = terminosRes.data;
  if (!cliente || !terminos) return <>{children}</>;

  const { data: aceptacion } = await supabase
    .from("aceptaciones_terminos")
    .select("id")
    .eq("terminos_id", terminos.id)
    .eq("cliente_id", cliente.id)
    .maybeSingle();

  if (aceptacion) return <>{children}</>;

  return (
    <AceptarTerminos
      terminosId={terminos.id}
      titulo={terminos.titulo}
      contenido={terminos.contenido}
      version={terminos.version}
      nombre={perfil.nombre.split(" ")[0]}
    />
  );
}
