import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Cliente admin de Supabase (usa la SUPABASE_SECRET_KEY, saltea RLS).
 * SOLO para server actions que lo necesitan (alta de accesos de socios).
 * NUNCA importar desde un componente cliente ni exponer la key.
 */
export function hayClaveAdmin(): boolean {
  return Boolean(process.env.SUPABASE_SECRET_KEY);
}

export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) {
    throw new Error("Falta la SUPABASE_SECRET_KEY en el servidor.");
  }
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}
