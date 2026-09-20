import { supabase } from "../config/supabase.js";
import { scrapeProduct } from "./storeScraper.js";

const runningProducts = new Map();
let batchRunning = false;

// Each Supabase call below is an ordinary database query, not a stored procedure.
// These calls are NOT one transaction. If a later write fails, earlier writes can remain.
// We throw on every database error so the API never reports an incomplete save as complete.
export async function saveAttempt(productId, attempt, db = supabase) {
  const log = {
    product_id: productId,
    attempt_no: attempt.attempt,
    outcome: attempt.outcome,
    duration_ms: attempt.durationMs,
    error_message: attempt.errorMessage
  };

  if (attempt.outcome !== "success") {
    const { error } = await db.from("scrape_logs").insert(log);
    if (error) throw new Error(error.message);
    return;
  }

  const current = attempt.data;
  if (!current || !Number.isFinite(current.price) || current.price < 0 ||
      !current.currency || typeof current.inStock !== "boolean") {
    throw new Error("Cannot save incomplete product data");
  }

  // Read the preceding successful result for the optional alert bonus.
  const { data: history, error: historyError } = await db
    .from("price_history")
    .select("price,currency,in_stock")
    .eq("product_id", productId)
    .order("id", { ascending: false })
    .limit(1);
  if (historyError) throw new Error(historyError.message);
  const previous = history[0];

  // A scrape is recorded as successful only after its validated price is stored.
  const { error: priceError } = await db.from("price_history").insert({
    product_id: productId,
    price: current.price,
    currency: current.currency,
    in_stock: current.inStock
  });
  if (priceError) throw new Error(priceError.message);

  const { error: logError } = await db.from("scrape_logs").insert(log);
  if (logError) throw new Error(logError.message);

  const { error: productError } = await db.from("tracked_products")
    .update({
      last_price: current.price,
      last_currency: current.currency,
      last_in_stock: current.inStock,
      last_scraped_at: new Date().toISOString()
    })
    .eq("id", productId);
  if (productError) throw new Error(productError.message);

  // Bonus 1: in-app alerts. No alert on the first successful scrape.
  const alerts = [];
  if (previous && previous.currency === current.currency &&
      current.price < Number(previous.price)) {
    alerts.push({
      product_id: productId,
      kind: "price_drop",
      message: `${current.name}: price fell from ${previous.currency} ${previous.price} to ${current.currency} ${current.price}`
    });
  }
  if (previous?.in_stock === false && current.inStock === true) {
    alerts.push({
      product_id: productId,
      kind: "back_in_stock",
      message: `${current.name}: back in stock`
    });
  }
  if (alerts.length) {
    const { error: alertError } = await db.from("alerts").insert(alerts);
    if (alertError) throw new Error(alertError.message);
  }
}

export function runScrapeForProduct(product) {
  // Reuse an ongoing task when two requests ask for the same product concurrently.
  if (runningProducts.has(product.id)) return runningProducts.get(product.id);
  const task = (async () => {
    try {
      await scrapeProduct(product.store_url, {
        onAttempt: (attempt) => saveAttempt(product.id, attempt)
      });
      return { ok: true, productId: product.id };
    } catch (error) {
      console.error(`Scrape or database save failed for ${product.id}:`, error.message);
      return { ok: false, productId: product.id, error: error.message };
    }
  })();
  runningProducts.set(product.id, task);
  task.finally(() => runningProducts.delete(product.id));
  return task;
}

export async function runScheduledScrapes() {
  if (batchRunning) return { skipped: true, reason: "A scrape batch is already running" };
  batchRunning = true;
  try {
    const { data, error } = await supabase.from("tracked_products").select("*").order("created_at");
    if (error) throw new Error(error.message);
    const results = [];
    for (const product of data) results.push(await runScrapeForProduct(product));
    return { checked: data.length, results };
  } finally {
    batchRunning = false;
  }
}
