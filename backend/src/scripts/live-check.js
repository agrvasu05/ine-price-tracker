import assert from "node:assert/strict";
import { searchStore, scrapeProduct } from "../services/storeScraper.js";
import { closeSharedBrowser } from "../services/browser.js";

try {
  const partial = await searchStore("Ironwood Curved Monitor");
  assert(partial.length > 0, "Partial-name search must find products");
  const full = await searchStore(partial[0].name);
  assert(full.some((product) => product.url === partial[0].url), "Full-name search must find the same product");
  const result = await scrapeProduct(full[0].url, { onAttempt: async (attempt) => console.log(attempt) });
  assert(Number.isFinite(result.price) && typeof result.inStock === "boolean");
  console.log("Live search and price/stock extraction passed:", result);
} finally { await closeSharedBrowser(); }
