import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client -- bypasses RLS entirely. Used ONLY inside the
// server-side Zoho sync job (lib/zoho/sync.ts, app/api/sync/zoho/route.ts).
// Never import this from a Server/Client Component or expose it to the browser.
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
