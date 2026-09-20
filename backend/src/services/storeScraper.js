import { setTimeout as sleep } from "node:timers/promises";
import { env } from "../config/env.js";
import { createHeadedBrowser, getSharedBrowser } from "./browser.js";
import { normalizeAndValidateStoreUrl } from "../utils/storeUrl.js";

// The store reshuffles its catalogue pages. Build a complete unique list before searching.
let cachedProducts = [];
let cacheTime = 0;
let pendingCatalogue = null;

async function loadCatalogue() {
  const products = new Map();
  for (let pass = 0; pass < 12; pass++) {
    let pageCount = 1;
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      let data;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const response = await fetch(`${env.storeBaseUrl}/api/catalog?page=${pageNumber}&pageSize=60`, {
            signal: AbortSignal.timeout(env.scrapeNavTimeoutMs)
          });
          if (!response.ok) throw new Error(`Catalogue HTTP ${response.status}`);
          data = await response.json();
          if (!Array.isArray(data.items) || !Number.isInteger(data.total) ||
              !Number.isInteger(data.pages) || data.total < 1 || data.pages < 1) {
            throw new Error("Invalid catalogue response");
          }
          break;
        } catch (error) {
          if (attempt === 3) throw error;
          await sleep(attempt * 700);
        }
      }
      pageCount = data.pages;
      for (const item of data.items) {
        if (!Number.isInteger(item.id) || item.id < 1 || !item.name?.trim()) {
          throw new Error("Invalid catalogue item");
        }
        products.set(item.id, {
          name: item.name.trim(),
          url: `${env.storeBaseUrl}/product/${item.id}`
        });
      }
      if (products.size === data.total) return [...products.values()];
    }
  }
  throw new Error("The store's catalogue was incomplete. Please search again.");
}

export async function searchStore(query) {
  const text = String(query ?? "").trim().toLowerCase();
  if (!text) return [];
  if (!cachedProducts.length || Date.now() - cacheTime > 60 * 60 * 1000) {
    // Concurrent searches wait for one catalogue load instead of loading it twice.
    if (!pendingCatalogue) pendingCatalogue = loadCatalogue();
    try {
      cachedProducts = await pendingCatalogue;
      cacheTime = Date.now();
    } finally {
      pendingCatalogue = null;
    }
  }
  return cachedProducts.filter((product) => product.name.toLowerCase().includes(text));
}

// The mock store was observed returning these currency and grouping formats.
// Reject unrecognized values instead of accidentally saving an old or decoy price.
export function parsePrice(text) {
  const cleaned = String(text ?? "").normalize("NFKC").replace(/[\s\u200B-\u200D\uFEFF]/g, "");
  const match = cleaned.match(/^(₹|Rs\.|INR|\$|USD|€|EUR|£|GBP)([\d.,]+)(?:\/-\(incl\.ofalltaxes\))?$/i);
  if (!match) throw new Error(`Invalid selling price: ${text}`);

  let numberText = match[2];
  if (/^\d{1,3}(?:\.\d{3})*,\d{2}$/.test(numberText)) {
    // European-style example: 12.345,00 -> 12345.00
    numberText = numberText.replaceAll(".", "").replace(",", ".");
  } else {
    // 12,345 or 1,23,456 or 12345.50, not malformed commas.
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d{1,2})?$/.test(numberText)) {
      throw new Error("Invalid price digits or comma grouping");
    }
    numberText = numberText.replaceAll(",", "");
  }
  const price = Number(numberText);
  if (!Number.isFinite(price) || price < 0) throw new Error("Invalid price");
  const currencies = {
    "₹": "INR", "RS.": "INR", INR: "INR", "$": "USD", USD: "USD",
    "€": "EUR", EUR: "EUR", "£": "GBP", GBP: "GBP"
  };
  return { price, currency: currencies[match[1].toUpperCase()] };
}

async function dismissCookies(page) {
  const dialog = page.getByRole("dialog", { name: "Cookie consent" });
  if (!await dialog.isVisible()) return;
  const decline = dialog.getByRole("button", { name: "Decline cookies" });
  for (let attempt = 0; attempt < 4 && await dialog.isVisible(); attempt++) {
    await decline.click();
  }
  if (await dialog.isVisible()) throw new Error("Cookie dialog could not be dismissed");
}

async function revealPrice(page) {
  const block = page.locator(".price-block");
  await block.waitFor({ state: "visible" });
  await dismissCookies(page);
  // The mock store disables Reveal until the mouse moves over the price area.
  // A single hover does not meet its observed 8-move / 600-ms requirement.
  await block.hover();
  const box = await block.boundingBox();
  if (!box) throw new Error("Price area is not visible");
  for (let step = 0; step < 12; step++) {
    await page.mouse.move(box.x + 15 + step * Math.min(8, (box.width - 30) / 12), box.y + 20);
    await sleep(90);
  }

  const reveal = page.getByRole("button", { name: "Reveal price", exact: true });
  // Some clicks are ignored. Try up to three times while the button is visible.
  for (let click = 0; click < 3 && await reveal.isVisible(); click++) {
    await dismissCookies(page);
    await reveal.click();
    await sleep(1200);
  }

  // Refresh if the store reports that its price is still updating.
  for (let refresh = 0; refresh < 3; refresh++) {
    await page.locator(".price-success, .price-error").waitFor({ state: "visible" });
    if (await page.locator(".price-error").isVisible()) {
      throw new Error((await block.innerText()).slice(0, 500));
    }
    if (!(await block.innerText()).includes("Updating…")) return;
    if (refresh === 2) throw new Error("Price is still updating");
    await page.getByRole("button", { name: "Refresh price", exact: true }).click();
    await sleep(1200);
  }
}

async function readProduct(page, url) {
  page.setDefaultTimeout(env.scrapeNavTimeoutMs);
  const response = await page.goto(url, {
    waitUntil: "domcontentloaded", timeout: env.scrapeNavTimeoutMs
  });
  if (!response || !response.ok()) {
    throw new Error(`Product page HTTP ${response?.status() ?? "no response"}`);
  }
  await dismissCookies(page);
  await page.locator(".price-block, .detail .grid-error").waitFor({ state: "visible" });
  const pageError = page.locator(".detail .grid-error");
  if (await pageError.isVisible()) throw new Error(await pageError.innerText());

  await revealPrice(page);
  // Do NOT read the hidden decoy, struck-out MRP, or promotional deal text.
  const sellingPrice = page.locator('.price-main > [style*="font-size"]:visible');
  if (await sellingPrice.count() !== 1) throw new Error("Selling price is missing or ambiguous");
  const name = (await page.locator(".detail-info h1").innerText()).trim();
  const stockClass = await page.locator(".price-facets .stock-badge").getAttribute("class");
  if (!name || !/\b(in-stock|out-stock)\b/.test(stockClass || "")) {
    throw new Error("Missing product name or stock state");
  }
  return {
    name,
    ...parsePrice(await sellingPrice.textContent()),
    inStock: stockClass.split(" ").includes("in-stock")
  };
}

export async function scrapeProduct(productUrl, { headed = false, simulateFirstFailure = false, onAttempt = async () => {} } = {}) {
  const url = normalizeAndValidateStoreUrl(productUrl);
  let browser;
  try {
    let lastError;
    for (let attempt = 1; attempt <= env.scrapeMaxAttempts; attempt++) {
      const startedAt = Date.now();
      let page;
      let data;
      let failure;
      try {
        browser = headed ? (browser || await createHeadedBrowser()) : await getSharedBrowser();
        // Each attempt gets a fresh page, so retrying repeats navigation and interaction.
        page = await browser.newPage();
        if (simulateFirstFailure && attempt === 1) {
          // Headed demo only: label this injected 503 in the recording.
          await page.route("**/api/product/*", (route) => route.fulfill({ status: 503, body: "Demo temporary failure" }));
        }
        data = await readProduct(page, url);
      } catch (error) {
        failure = error;
      } finally {
        await page?.close().catch(() => {});
      }

      // Logging is OUTSIDE the catch. If database logging fails, stop immediately:
      // do not retry and accidentally save a second history row.
      await onAttempt({
        attempt,
        outcome: failure ? (attempt === env.scrapeMaxAttempts ? "failed" : "retried") : "success",
        durationMs: Date.now() - startedAt,
        errorMessage: failure ? String(failure.message || failure).slice(0, 1000) : null,
        data
      });
      if (!failure) return data;
      lastError = failure;
      if (attempt < env.scrapeMaxAttempts) await sleep(700 * attempt);
    }
    throw lastError;
  } finally {
    if (headed) await browser?.close().catch(() => {});
  }
}
