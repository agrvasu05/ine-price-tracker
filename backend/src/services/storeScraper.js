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
          const response = await fetch(`${env.storeBaseUrl}/api/v2/listings?page=${pageNumber}&limit=60`, {
            signal: AbortSignal.timeout(env.scrapeNavTimeoutMs)
          });
          if (!response.ok) throw new Error(`Catalogue HTTP ${response.status}`);
          data = await response.json();
          if (!Array.isArray(data.results) || !Number.isInteger(data.count) ||
              !Number.isInteger(data.totalPages) || data.count < 1 || data.totalPages < 1) {
            throw new Error("Invalid catalogue response");
          }
          break;
        } catch (error) {
          if (attempt === 3) throw error;
          await sleep(attempt * 700);
        }
      }
      pageCount = data.totalPages;
      for (const item of data.results) {
        if (!Number.isInteger(item.id) || item.id < 1 || !item.name?.trim()) {
          throw new Error("Invalid catalogue item");
        }
        products.set(item.id, {
          name: item.name.trim(),
          url: `${env.storeBaseUrl}/item/${item.id}`
        });
      }
      if (products.size === data.count) return [...products.values()];
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

async function readProduct(page, url) {
  page.setDefaultTimeout(env.scrapeNavTimeoutMs);

  // The store gives its price elements random class names that change over time.
  // The page downloads today's names from /api/v2/ui/manifest, so we read that same file.
  const manifestResponse = page.waitForResponse((res) => res.url().includes("/api/v2/ui/manifest"));
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: env.scrapeNavTimeoutMs });
  if (!response || !response.ok()) {
    throw new Error(`Product page HTTP ${response?.status() ?? "no response"}`);
  }
  const { classes } = await (await manifestResponse).json();

  // The cookie pop-up can appear at any time and blocks clicks.
  // Playwright closes it automatically whenever it gets in the way.
  await page.addLocatorHandler(page.getByRole("dialog", { name: "Privacy preferences" }), async (dialog) => {
    await dialog.getByRole("button", { name: "Reject cookies" }).click();
  });

  const name = (await page.locator("h1").first().innerText()).trim();

  // Some products have options (pack size, kit...) and the store picks one at random.
  // Always choose the first option so every scrape records the same variant.
  const firstOption = page.locator(".opt-chip").first();
  if (await firstOption.count()) await firstOption.click();

  // "Check today's price" stays disabled until the mouse has moved over the price area
  // for a while (the store wants at least 8 moves and 600 ms). If the cookie pop-up opens
  // in the middle, the moves or the click get lost, so we try the whole step up to 3 times.
  const priceArea = page.locator(`.${classes.priceWrap}`);
  const checkButton = page.getByRole("button", { name: "Check today’s price" });
  for (let tryNo = 0; tryNo < 3 && await checkButton.isVisible(); tryNo++) {
    await priceArea.hover(); // a Playwright action, so the cookie pop-up is closed first
    const box = await priceArea.boundingBox();
    for (let step = 0; step < 12; step++) {
      await page.mouse.move(box.x + 20 + step * 10, box.y + box.height / 2);
      await sleep(90);
    }
    if (await checkButton.isEnabled()) await checkButton.click();
    await sleep(1500);
  }
  if (await checkButton.isVisible()) throw new Error("Price did not unlock");

  // Wait for either the price or the store's own error message.
  const priceValue = page.locator(`.${classes.priceValue}`);
  const retryButton = page.getByRole("button", { name: "Retry", exact: true });
  await priceValue.or(retryButton).first().waitFor();
  if (await retryButton.isVisible()) throw new Error("The store could not load the price");
  if (await page.getByText("Refreshing prices").isVisible()) throw new Error("Price is still refreshing");

  // Do NOT read the hidden decoy prices or the struck-out MRP: only the element the manifest names.
  if (await priceValue.count() !== 1) throw new Error("Selling price is missing or ambiguous");
  const stockClass = await page.locator(".avail-pill").getAttribute("class");
  if (!name || !/\bavail-(yes|no)\b/.test(stockClass || "")) {
    throw new Error("Missing product name or stock state");
  }
  return {
    name,
    ...parsePrice(await priceValue.innerText()),
    inStock: stockClass.includes("avail-yes")
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
          await page.route("**/api/v2/items/*/quote*", (route) => route.fulfill({ status: 503, body: "Demo temporary failure" }));
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
