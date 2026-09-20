import { createClient } from "@supabase/supabase-js";
import { assertBackendEnv, env } from "./env.js";

assertBackendEnv();

export const supabase = createClient(
  env.supabaseUrl,
  env.supabaseServiceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);
