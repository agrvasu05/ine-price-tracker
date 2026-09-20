import dotenv from "dotenv";

dotenv.config();

function intFromEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const env = {
  port: intFromEnv("PORT", 5000),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  storeBaseUrl: process.env.STORE_BASE_URL || "https://demo.inelabteamdev.com",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  cronSecret: process.env.CRON_SECRET || "",
  scrapeMaxAttempts: intFromEnv("SCRAPE_MAX_ATTEMPTS", 3),
  scrapeNavTimeoutMs: intFromEnv("SCRAPE_NAV_TIMEOUT_MS", 30000)
};

export function assertBackendEnv() {
  const missing = [];
  if (!env.supabaseUrl) missing.push("SUPABASE_URL");
  if (!env.supabaseServiceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!env.cronSecret) missing.push("CRON_SECRET");

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
