import "server-only";
import type { createClient } from "@/lib/supabase/server";

/** Integridad multitenant: el cliente tiene que ser de MI organización. */
export async function clientePerteneceAOrg(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clienteId: string,
  orgId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("clientes")
    .select("id")
    .eq("id", clienteId)
    .eq("org_id", orgId)
    .maybeSingle();
  return Boolean(data);
}
