import { Router } from "express";
import { supabase } from "../config/supabase.js";
import { runScrapeForProduct } from "../services/scrapeRunner.js";
import { normalizeAndValidateStoreUrl } from "../utils/storeUrl.js";

const router = Router();

router.get("/", async (_req, res) => {
  const { data, error } = await supabase.from("tracked_products").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  res.json({ products: data });
});

router.post("/", async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Product name is required" });
  let storeUrl;
  try { storeUrl = normalizeAndValidateStoreUrl(req.body.url); }
  catch (error) { return res.status(400).json({ error: error.message }); }
  const existing = await supabase.from("tracked_products").select("*").eq("store_url", storeUrl).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return res.json({ product: existing.data, alreadyTracked: true });
  const { data, error } = await supabase.from("tracked_products").insert({ name, store_url: storeUrl }).select().single();
  if (error) {
    if (error.code === "23505") return res.status(409).json({ error: "Product already tracked; refresh the list" });
    throw error;
  }
  const initialScrape = await runScrapeForProduct(data);
  res.status(201).json({ product: data, initialScrape });
});

router.get("/:id", async (req, res) => {
  const id = req.params.id;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: "Invalid product ID" });
  const [product, history, logs, alerts] = await Promise.all([
    supabase.from("tracked_products").select("*").eq("id", id).single(),
    supabase.from("price_history").select("*").eq("product_id", id).order("scraped_at", { ascending: false }).limit(100),
    supabase.from("scrape_logs").select("*").eq("product_id", id).order("attempted_at", { ascending: false }).limit(100),
    supabase.from("alerts").select("*").eq("product_id", id).order("created_at", { ascending: false }).limit(50)
  ]);
  if (product.error || history.error || logs.error || alerts.error) {
    throw product.error || history.error || logs.error || alerts.error;
  }
  res.json({ product: product.data, history: history.data, logs: logs.data, alerts: alerts.data });
});

export default router;
